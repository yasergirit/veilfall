import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

let db: ReturnType<typeof drizzle>;

export async function initDatabase() {
  const connectionString = process.env.DATABASE_URL
    || 'postgresql://veilfall:veilfall_dev_2024@localhost:5432/veilfall';

  const client = postgres(connectionString, {
    max: 20,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  db = drizzle(client);

  // Test connection
  await client`SELECT 1`;
  console.log('PostgreSQL connected');

  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}
