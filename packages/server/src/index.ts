import './env.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { registerRoutes } from './routes/index.js';
import { startGameLoop } from './game-loop/index.js';
import { testConnection, loadFromSupabase, startSync, flushToSupabase } from './db/supabase-sync.js';
import { initWebSocket } from './websocket/index.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const isDev = process.env.NODE_ENV !== 'production';
  const app = Fastify({
    logger: isDev
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : true,
  });

  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
  ];
  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    sign: { expiresIn: '24h' },
  });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  // Global error handler for Zod validation errors
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      const messages = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      return reply.status(400).send({ error: 'Validation failed', details: messages });
    }
    reply.status(error.statusCode ?? 500).send({ error: error.message });
  });

  await registerRoutes(app);

  // Supabase integration: load persisted data and start sync
  const supabaseConnected = await testConnection();
  if (supabaseConnected) {
    await loadFromSupabase();
    startSync(30_000); // flush to Supabase every 30 seconds
    app.log.info('Supabase connected — data loaded, periodic sync active');
  } else {
    app.log.info('Supabase not available — running with in-memory only');
  }

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`VEILFALL server running on http://${HOST}:${PORT}`);

  await initWebSocket(app);
  app.log.info('WebSocket server initialized');

  startGameLoop();
  app.log.info('Game loop started');

  // Graceful shutdown: flush data before exit
  const shutdown = async () => {
    app.log.info('Shutting down — flushing data to Supabase...');
    await flushToSupabase();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
