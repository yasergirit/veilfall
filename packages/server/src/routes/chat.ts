import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import { z } from 'zod';

const sendMessageSchema = z.object({
  channelType: z.enum(['global', 'alliance', 'whisper']),
  channelId: z.string(),
  content: z.string().min(1).max(500),
});

const getMessagesSchema = z.object({
  channelType: z.enum(['global', 'alliance', 'whisper']),
  channelId: z.string(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.coerce.number().optional(),
});

export async function chatRoutes(app: FastifyInstance) {
  // Send message
  app.post('/send', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { channelType, channelId, content } = sendMessageSchema.parse(request.body);

    const existingPlayer = mockDb.players.get(player.id);
    if (!existingPlayer) return reply.status(404).send({ error: 'Player not found' });

    // Validate channel access
    if (channelType === 'alliance') {
      if (!existingPlayer.allianceId || existingPlayer.allianceId !== channelId) {
        return reply.status(403).send({ error: 'Not a member of this alliance' });
      }
    }

    if (channelType === 'whisper') {
      const recipient = mockDb.players.get(channelId);
      if (!recipient) return reply.status(404).send({ error: 'Recipient not found' });
    }

    const message = mockDb.addMessage({
      id: crypto.randomUUID(),
      channelType,
      channelId,
      senderId: player.id,
      senderName: player.username,
      content,
      timestamp: Date.now(),
    });

    return { message: 'Message sent', data: message };
  });

  // Get messages
  app.get('/messages', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { channelType, channelId, limit, before } = getMessagesSchema.parse(request.query);

    const existingPlayer = mockDb.players.get(player.id);
    if (!existingPlayer) return reply.status(404).send({ error: 'Player not found' });

    // Validate channel access
    if (channelType === 'alliance') {
      if (!existingPlayer.allianceId || existingPlayer.allianceId !== channelId) {
        return reply.status(403).send({ error: 'Not a member of this alliance' });
      }
    }

    if (channelType === 'whisper') {
      // Player must be the sender or recipient
      if (channelId !== player.id) {
        // channelId is the other person — check messages exist for this pair
        // Allow access if player is sender or if channelId is the recipient
        // For whisper, channelId is the recipientPlayerId from sender's perspective
        // We need to return messages where player is sender OR recipient
        const sentMessages = mockDb.getMessages('whisper', channelId, limit, before)
          .filter((m) => m.senderId === player.id);
        const receivedMessages = mockDb.getMessages('whisper', player.id, limit, before)
          .filter((m) => m.senderId === channelId);
        const allMessages = [...sentMessages, ...receivedMessages]
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-limit);
        return { messages: allMessages };
      }
    }

    const messages = mockDb.getMessages(channelType, channelId, limit, before);
    return { messages };
  });

  // Get available channels
  app.get('/channels', { preHandler: requireAuth }, async (request) => {
    const player = request.user;
    const existingPlayer = mockDb.players.get(player.id);

    const channels: Array<{ type: string; id: string; name: string }> = [
      { type: 'global', id: 'global', name: 'World Chat' },
    ];

    if (existingPlayer?.allianceId) {
      const alliance = mockDb.getAlliance(existingPlayer.allianceId);
      if (alliance) {
        channels.push({ type: 'alliance', id: alliance.id, name: `[${alliance.tag}] ${alliance.name}` });
      }
    }

    return { channels };
  });
}
