import type { FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import { mockDb } from '../db/mock-db.js';

let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

export async function initWebSocket(app: FastifyInstance) {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
  ];

  const io = new Server(app.server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    path: '/ws',
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  ioInstance = io;

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = app.jwt.verify(token) as { id: string; username: string; faction: string };
      socket.data.player = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const player = socket.data.player;
    app.log.info(`[WS] Connected: ${player.username} (${player.id})`);

    // Join personal room
    socket.join(`player:${player.id}`);

    // Join global chat room
    socket.join('chat:global');

    // Join alliance room if applicable
    const dbPlayer = mockDb.players.get(player.id);
    if (dbPlayer?.allianceId) {
      socket.join(`chat:alliance:${dbPlayer.allianceId}`);
    }

    // ── Chat: Send Message ──
    socket.on('chat:send', (data: { channelType: string; channelId: string; content: string }, ack?: (res: any) => void) => {
      const { channelType, channelId, content } = data;

      // Validate
      if (!content || content.length === 0 || content.length > 500) {
        ack?.({ error: 'Message must be 1-500 characters' });
        return;
      }
      if (!['global', 'alliance', 'whisper'].includes(channelType)) {
        ack?.({ error: 'Invalid channel type' });
        return;
      }

      const existingPlayer = mockDb.players.get(player.id);
      if (!existingPlayer) {
        ack?.({ error: 'Player not found' });
        return;
      }

      // Alliance access check
      if (channelType === 'alliance') {
        if (!existingPlayer.allianceId || existingPlayer.allianceId !== channelId) {
          ack?.({ error: 'Not a member of this alliance' });
          return;
        }
      }

      // Store in DB
      const message = mockDb.addMessage({
        id: crypto.randomUUID(),
        channelType: channelType as 'global' | 'alliance' | 'whisper',
        channelId,
        senderId: player.id,
        senderName: player.username,
        content,
        timestamp: Date.now(),
      });

      // Build broadcast payload
      const payload = {
        id: message.id,
        senderId: player.id,
        senderUsername: player.username,
        senderFaction: player.faction,
        content: message.content,
        timestamp: new Date(message.timestamp).toISOString(),
        channelType,
        channelId,
      };

      // Broadcast to appropriate room
      if (channelType === 'global') {
        io.to('chat:global').emit('chat:message', payload);
      } else if (channelType === 'alliance') {
        io.to(`chat:alliance:${channelId}`).emit('chat:message', payload);
      } else if (channelType === 'whisper') {
        // Send to both sender and recipient
        io.to(`player:${player.id}`).emit('chat:message', payload);
        io.to(`player:${channelId}`).emit('chat:message', payload);
      }

      ack?.({ ok: true, message: payload });
    });

    // ── Map subscriptions ──
    socket.on('map:subscribe', (data: { q: number; r: number; radius: number }) => {
      const regionKey = `region:${Math.floor(data.q / 10)},${Math.floor(data.r / 10)}`;
      socket.join(regionKey);
    });

    socket.on('map:unsubscribe', (data: { q: number; r: number }) => {
      const regionKey = `region:${Math.floor(data.q / 10)},${Math.floor(data.r / 10)}`;
      socket.leave(regionKey);
    });

    socket.on('disconnect', () => {
      app.log.info(`[WS] Disconnected: ${player.username}`);
    });
  });

  // Track online count
  setInterval(() => {
    const count = io.sockets.sockets.size;
    io.emit('online:count', count);
  }, 30_000);

  app.decorate('io', io);
  return io;
}
