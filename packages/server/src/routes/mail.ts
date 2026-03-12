import type { FastifyInstance } from 'fastify';
import { mockDb } from '../db/mock-db.js';
import type { MockMail } from '../db/mock-db.js';
import { pushNotification } from './notifications.js';

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function mailRoutes(app: FastifyInstance) {
  // Auth hook — every route in this plugin requires a valid JWT.
  app.addHook('onRequest', async (request) => {
    await request.jwtVerify();
  });

  // -----------------------------------------------------------------------
  // GET /inbox — Get received mails (paginated, newest first)
  // -----------------------------------------------------------------------
  app.get('/inbox', async (request) => {
    const player = request.user;
    const query = request.query as { limit?: string; offset?: string; unreadOnly?: string };

    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const unreadOnly = query.unreadOnly === 'true';

    const result = mockDb.getMailsForPlayer(player.id, limit, offset, unreadOnly);

    return {
      mails: result.mails,
      unreadCount: result.unreadCount,
      total: result.total,
    };
  });

  // -----------------------------------------------------------------------
  // GET /sent — Get sent mails (paginated)
  // -----------------------------------------------------------------------
  app.get('/sent', async (request) => {
    const player = request.user;
    const query = request.query as { limit?: string; offset?: string };

    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);

    const result = mockDb.getSentMails(player.id, limit, offset);

    return {
      mails: result.mails,
      total: result.total,
    };
  });

  // -----------------------------------------------------------------------
  // POST /send — Send a mail
  // -----------------------------------------------------------------------
  app.post('/send', async (request, reply) => {
    const player = request.user;
    const { toUsername, subject, body } = request.body as {
      toUsername?: string;
      subject?: string;
      body?: string;
    };

    // Validate required fields
    if (!toUsername || !subject || !body) {
      return reply.status(400).send({ error: 'toUsername, subject, and body are required' });
    }

    // Validate lengths
    if (subject.length > 100) {
      return reply.status(400).send({ error: 'Subject must be 100 characters or fewer' });
    }
    if (body.length > 2000) {
      return reply.status(400).send({ error: 'Body must be 2000 characters or fewer' });
    }

    // Cannot send mail to yourself
    const sender = mockDb.players.get(player.id);
    if (!sender) {
      return reply.status(401).send({ error: 'Sender not found' });
    }

    if (toUsername === sender.username) {
      return reply.status(400).send({ error: 'Cannot send mail to yourself' });
    }

    // Validate recipient exists
    const recipient = mockDb.getPlayerByUsername(toUsername);
    if (!recipient) {
      return reply.status(404).send({ error: 'Recipient not found' });
    }

    const mail: MockMail = {
      id: crypto.randomUUID(),
      fromPlayerId: player.id,
      fromUsername: sender.username,
      toPlayerId: recipient.id,
      toUsername: recipient.username,
      subject: subject.trim(),
      body: body.trim(),
      read: false,
      starred: false,
      deletedBySender: false,
      deletedByRecipient: false,
      sentAt: Date.now(),
    };

    mockDb.createMail(mail);

    // Push notification to recipient
    pushNotification(recipient.id, {
      type: 'system',
      title: 'New Mail',
      message: `New mail from ${sender.username}`,
    });

    return { mail, message: 'Mail sent successfully' };
  });

  // -----------------------------------------------------------------------
  // POST /read/:id — Mark mail as read
  // -----------------------------------------------------------------------
  app.post('/read/:id', async (request, reply) => {
    const player = request.user;
    const { id } = request.params as { id: string };

    const mail = mockDb.getMail(id);
    if (!mail) {
      return reply.status(404).send({ error: 'Mail not found' });
    }

    // Only the recipient can mark as read
    if (mail.toPlayerId !== player.id) {
      return reply.status(403).send({ error: 'Only the recipient can mark mail as read' });
    }

    mockDb.updateMail(id, { read: true });

    return { success: true };
  });

  // -----------------------------------------------------------------------
  // POST /star/:id — Toggle star on a mail
  // -----------------------------------------------------------------------
  app.post('/star/:id', async (request, reply) => {
    const player = request.user;
    const { id } = request.params as { id: string };

    const mail = mockDb.getMail(id);
    if (!mail) {
      return reply.status(404).send({ error: 'Mail not found' });
    }

    // Both sender and recipient can star
    if (mail.fromPlayerId !== player.id && mail.toPlayerId !== player.id) {
      return reply.status(403).send({ error: 'You do not have access to this mail' });
    }

    const newStarred = !mail.starred;
    mockDb.updateMail(id, { starred: newStarred });

    return { starred: newStarred };
  });

  // -----------------------------------------------------------------------
  // POST /delete/:id — Soft delete (marks deleted for the requesting user)
  // -----------------------------------------------------------------------
  app.post('/delete/:id', async (request, reply) => {
    const player = request.user;
    const { id } = request.params as { id: string };

    const mail = mockDb.getMail(id);
    if (!mail) {
      return reply.status(404).send({ error: 'Mail not found' });
    }

    if (mail.fromPlayerId === player.id) {
      mockDb.updateMail(id, { deletedBySender: true });
    } else if (mail.toPlayerId === player.id) {
      mockDb.updateMail(id, { deletedByRecipient: true });
    } else {
      return reply.status(403).send({ error: 'You do not have access to this mail' });
    }

    return { success: true };
  });

  // -----------------------------------------------------------------------
  // GET /unread-count — Get unread mail count (for badge in sidebar)
  // -----------------------------------------------------------------------
  app.get('/unread-count', async (request) => {
    const player = request.user;

    const count = [...mockDb.mails.values()].filter(
      (m) => m.toPlayerId === player.id && !m.read && !m.deletedByRecipient,
    ).length;

    return { count };
  });
}
