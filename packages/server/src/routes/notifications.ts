import type { FastifyInstance } from 'fastify';
import { mockDb } from '../db/mock-db.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  playerId: string;
  type:
    | 'building_complete'
    | 'unit_trained'
    | 'march_arrived'
    | 'combat_result'
    | 'trade_completed'
    | 'research_complete'
    | 'alliance_invite'
    | 'aether_cycle'
    | 'system';
  title: string;
  message: string;
  read: boolean;
  timestamp: number;
  data?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

/** All notifications keyed by notification id. */
const notifications: Map<string, Notification> = new Map();

/** Ordered list of notification ids for each player (newest last). */
const playerNotifications: Map<string, string[]> = new Map();

/** Active SSE writer callbacks for each player. */
const sseClients: Map<string, Set<(data: string) => void>> = new Map();

const MAX_NOTIFICATIONS_PER_PLAYER = 100;

// ---------------------------------------------------------------------------
// Helpers — exported so the game loop can push notifications
// ---------------------------------------------------------------------------

/**
 * Create and store a notification, then broadcast it to any connected SSE
 * clients for the given player.  Oldest notifications beyond the per-player
 * cap are trimmed automatically.
 */
export function pushNotification(
  playerId: string,
  notification: Omit<Notification, 'id' | 'playerId' | 'read' | 'timestamp'>,
): void {
  const id = crypto.randomUUID();
  const full: Notification = {
    ...notification,
    id,
    playerId,
    read: false,
    timestamp: Date.now(),
  };

  notifications.set(id, full);

  // Append to the player's ordered list
  let ids = playerNotifications.get(playerId);
  if (!ids) {
    ids = [];
    playerNotifications.set(playerId, ids);
  }
  ids.push(id);

  // Trim oldest when over cap
  while (ids.length > MAX_NOTIFICATIONS_PER_PLAYER) {
    const removed = ids.shift()!;
    notifications.delete(removed);
  }

  // Broadcast to connected SSE clients
  const clients = sseClients.get(playerId);
  if (clients && clients.size > 0) {
    const payload = `event: notification\ndata: ${JSON.stringify(full)}\n\n`;
    for (const write of clients) {
      try {
        write(payload);
      } catch {
        // Client likely disconnected — will be cleaned up on close.
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function notificationRoutes(app: FastifyInstance) {
  // Auth hook — every route in this plugin requires a valid JWT.
  app.addHook('onRequest', async (request) => {
    await request.jwtVerify();
  });

  // -----------------------------------------------------------------------
  // GET /stream — Server-Sent Events
  // -----------------------------------------------------------------------
  app.get('/stream', async (request, reply) => {
    const player = request.user;

    // Write SSE headers on the raw response so Fastify does not buffer.
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Writer callback that the push helper will invoke.
    const write = (data: string) => {
      reply.raw.write(data);
    };

    // Register this client
    let clients = sseClients.get(player.id);
    if (!clients) {
      clients = new Set();
      sseClients.set(player.id, clients);
    }
    clients.add(write);

    // Send any unread notifications that were queued before the client
    // connected so the UI can render them immediately.
    const ids = playerNotifications.get(player.id);
    if (ids) {
      for (const id of ids) {
        const n = notifications.get(id);
        if (n && !n.read) {
          reply.raw.write(`event: notification\ndata: ${JSON.stringify(n)}\n\n`);
        }
      }
    }

    // Heartbeat to keep the connection alive and detect stale clients.
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 30_000);

    // Cleanup on disconnect
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      const set = sseClients.get(player.id);
      if (set) {
        set.delete(write);
        if (set.size === 0) {
          sseClients.delete(player.id);
        }
      }
    });

    // Prevent Fastify from sending its own response — we already wrote
    // headers on the raw socket.  Returning the reply without calling
    // `send()` is the idiomatic way in Fastify 5.
    await reply.hijack();
  });

  // -----------------------------------------------------------------------
  // GET / — List notifications
  // -----------------------------------------------------------------------
  app.get('/', async (request) => {
    const player = request.user;
    const query = request.query as { limit?: string; unreadOnly?: string };

    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
    const unreadOnly = query.unreadOnly === 'true';

    const ids = playerNotifications.get(player.id) ?? [];

    // Walk newest-first so the most recent notifications come first.
    const result: Notification[] = [];
    for (let i = ids.length - 1; i >= 0 && result.length < limit; i--) {
      const n = notifications.get(ids[i]);
      if (!n) continue;
      if (unreadOnly && n.read) continue;
      result.push(n);
    }

    const unreadCount = ids.reduce((count, id) => {
      const n = notifications.get(id);
      return count + (n && !n.read ? 1 : 0);
    }, 0);

    return { notifications: result, unreadCount };
  });

  // -----------------------------------------------------------------------
  // POST /read/:id — Mark a single notification as read
  // -----------------------------------------------------------------------
  app.post('/read/:id', async (request, reply) => {
    const player = request.user;
    const { id } = request.params as { id: string };

    const notification = notifications.get(id);
    if (!notification || notification.playerId !== player.id) {
      return reply.status(404).send({ error: 'Notification not found' });
    }

    notification.read = true;
    return { success: true };
  });

  // -----------------------------------------------------------------------
  // POST /read-all — Mark every notification as read for the player
  // -----------------------------------------------------------------------
  app.post('/read-all', async (request) => {
    const player = request.user;
    const ids = playerNotifications.get(player.id) ?? [];

    let count = 0;
    for (const id of ids) {
      const n = notifications.get(id);
      if (n && !n.read) {
        n.read = true;
        count++;
      }
    }

    return { success: true, count };
  });
}
