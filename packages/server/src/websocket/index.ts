import type { FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import type Redis from 'ioredis';

export async function initWebSocket(app: FastifyInstance, redis: Redis) {
  const io = new Server(app.server, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? ['https://veilfall.com']
        : ['http://localhost:5173'],
      credentials: true,
    },
    path: '/ws',
  });

  // Auth middleware for WebSocket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = app.jwt.verify(token);
      socket.data.player = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const player = socket.data.player;
    app.log.info(`Player connected: ${player.username} (${player.id})`);

    // Join personal room
    socket.join(`player:${player.id}`);

    // Join alliance room if applicable
    // TODO: Look up player's alliance and join room

    // --- Event Handlers ---

    socket.on('map:subscribe', (data: { q: number; r: number; radius: number }) => {
      const regionKey = `region:${Math.floor(data.q / 10)},${Math.floor(data.r / 10)}`;
      socket.join(regionKey);
    });

    socket.on('map:unsubscribe', (data: { q: number; r: number }) => {
      const regionKey = `region:${Math.floor(data.q / 10)},${Math.floor(data.r / 10)}`;
      socket.leave(regionKey);
    });

    socket.on('chat:send', (data: { channel: string; message: string }) => {
      // TODO: Validate, store in DB, broadcast
      io.to(`alliance:${player.allianceId}`).emit('chat:message', {
        sender: player.username,
        message: data.message,
        timestamp: Date.now(),
      });
    });

    socket.on('disconnect', () => {
      app.log.info(`Player disconnected: ${player.username}`);
    });
  });

  // Decorate app with io for use in game loop
  app.decorate('io', io);

  return io;
}
