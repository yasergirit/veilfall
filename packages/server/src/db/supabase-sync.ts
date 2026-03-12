/**
 * Supabase Sync Layer for VEILFALL
 *
 * Strategy: Keep mock-db as the in-memory cache (fast game loop).
 * On startup: load all data from Supabase into mock-db.
 * Periodically: flush dirty data from mock-db to Supabase.
 * On critical writes (player create, settlement create): write-through immediately.
 */

import { supabase } from './supabase.js';
import { mockDb } from './mock-db.js';
import type {
  MockPlayer, MockSettlement, MockHero, MockMarch,
  MockAlliance, MockDiplomacy, MockMessage, MockEvent,
  MockBattleReport, MockMapEvent, MockTradeOffer, MockSpyMission,
  MockSeasonalEvent, MockEventProgress, MockMail, MockHeroQuest, MockWorldBoss,
} from './mock-db.js';

let syncEnabled = false;
let syncInterval: ReturnType<typeof setInterval> | null = null;

// ── Row-to-Interface mappers (Supabase snake_case → mockDb camelCase) ──

function rowToPlayer(row: any): MockPlayer {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    faction: row.faction,
    allianceId: row.alliance_id ?? undefined,
    createdAt: new Date(row.created_at),
  };
}

function rowToSettlement(row: any): MockSettlement {
  return {
    id: row.id,
    playerId: row.player_id,
    name: row.name,
    level: row.level,
    q: row.q,
    r: row.r,
    s: row.s,
    resources: row.resources,
    buildings: row.buildings,
    buildQueue: row.build_queue ?? [],
    units: row.units ?? {},
    trainQueue: row.train_queue ?? [],
    researched: row.researched ?? {},
    researchQueue: row.research_queue ?? null,
  };
}

function rowToHero(row: any): MockHero {
  return {
    id: row.id,
    playerId: row.player_id,
    name: row.name,
    heroClass: row.hero_class,
    level: row.level,
    xp: row.xp,
    loyalty: row.loyalty,
    status: row.status,
    abilities: row.abilities ?? [],
    equipment: row.equipment ?? {},
    stats: row.stats ?? { strength: 10, intellect: 10, agility: 10, endurance: 10 },
  };
}

function rowToMarch(row: any): MockMarch {
  return {
    id: row.id,
    playerId: row.player_id,
    settlementId: row.settlement_id,
    units: row.units,
    fromQ: row.from_q,
    fromR: row.from_r,
    toQ: row.to_q,
    toR: row.to_r,
    type: row.type,
    startedAt: Number(row.started_at),
    arrivedAt: Number(row.arrived_at),
    status: row.status,
    heroId: row.hero_id ?? undefined,
  };
}

function rowToAlliance(row: any): MockAlliance {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    description: row.description,
    leaderId: row.leader_id,
    members: row.members ?? [],
    createdAt: new Date(row.created_at).getTime(),
    banner: row.banner ?? { primaryColor: '#4A6670', secondaryColor: '#1A2744', icon: 'shield' },
  };
}

function rowToMapEvent(row: any): MockMapEvent {
  return {
    id: row.id,
    type: row.type,
    q: row.q,
    r: row.r,
    name: row.name,
    description: row.description,
    rewards: row.rewards,
    guardians: row.guardians ?? undefined,
    discoveredBy: row.discovered_by ?? undefined,
    status: row.status,
    expiresAt: new Date(row.expires_at).getTime(),
    createdAt: new Date(row.created_at).getTime(),
  };
}

function rowToTradeOffer(row: any): MockTradeOffer {
  return {
    id: row.id,
    sellerId: row.seller_id,
    settlementId: row.settlement_id,
    offerResource: row.offer_resource,
    offerAmount: row.offer_amount,
    requestResource: row.request_resource,
    requestAmount: row.request_amount,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    completedBy: row.completed_by ?? undefined,
  };
}

function rowToSpyMission(row: any): MockSpyMission {
  return {
    id: row.id,
    playerId: row.player_id,
    settlementId: row.settlement_id,
    targetSettlementId: row.target_settlement_id,
    targetPlayerId: row.target_player_id,
    type: row.type,
    status: row.status,
    startedAt: Number(row.started_at),
    arrivedAt: Number(row.arrived_at),
    completedAt: row.completed_at ? Number(row.completed_at) : undefined,
    result: row.result ?? undefined,
  };
}

function rowToSeasonalEvent(row: any): MockSeasonalEvent {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description,
    startedAt: new Date(row.started_at).getTime(),
    endsAt: new Date(row.ends_at).getTime(),
    status: row.status,
    objectives: row.objectives,
    rewards: row.rewards,
    bonusDescription: row.bonus_description,
  };
}

function rowToEventProgress(row: any): MockEventProgress {
  return {
    id: row.id,
    playerId: row.player_id,
    eventId: row.event_id,
    progress: row.progress,
    completed: row.completed,
    claimedReward: row.claimed_reward,
  };
}

function rowToMail(row: any): MockMail {
  return {
    id: row.id,
    fromPlayerId: row.from_player_id,
    fromUsername: row.from_username,
    toPlayerId: row.to_player_id,
    toUsername: row.to_username,
    subject: row.subject,
    body: row.body,
    read: row.read,
    starred: row.starred,
    deletedBySender: row.deleted_by_sender,
    deletedByRecipient: row.deleted_by_recipient,
    sentAt: new Date(row.sent_at).getTime(),
  };
}

function rowToHeroQuest(row: any): MockHeroQuest {
  return {
    id: row.id,
    playerId: row.player_id,
    heroId: row.hero_id,
    questType: row.quest_type,
    status: row.status,
    startedAt: Number(row.started_at),
    endsAt: Number(row.ends_at),
    difficulty: row.difficulty,
    rewards: row.rewards ?? undefined,
  };
}

function rowToWorldBoss(row: any): MockWorldBoss {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    type: row.type,
    q: row.q,
    r: row.r,
    health: row.health,
    maxHealth: row.max_health,
    attack: row.attack,
    defense: row.defense,
    rewards: row.rewards,
    status: row.status,
    spawnedAt: new Date(row.spawned_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
    attackers: row.attackers ?? [],
  };
}

// ── LOAD: Pull all data from Supabase into mock-db ──

export async function loadFromSupabase(): Promise<void> {
  console.log('[Supabase] Loading data from Supabase...');

  try {
    // Players
    const { data: players } = await supabase.from('players').select('*');
    for (const row of players ?? []) {
      const player = rowToPlayer(row);
      mockDb.players.set(player.id, player);
      mockDb.playersByEmail.set(player.email, player.id);
      mockDb.playersByUsername.set(player.username, player.id);
    }
    console.log(`[Supabase] Loaded ${players?.length ?? 0} players`);

    // Settlements
    const { data: settlements } = await supabase.from('settlements').select('*');
    for (const row of settlements ?? []) {
      const s = rowToSettlement(row);
      mockDb.settlements.set(s.id, s);
      const existing = mockDb.settlementsByPlayer.get(s.playerId) ?? [];
      existing.push(s.id);
      mockDb.settlementsByPlayer.set(s.playerId, existing);
    }
    console.log(`[Supabase] Loaded ${settlements?.length ?? 0} settlements`);

    // Heroes
    const { data: heroes } = await supabase.from('heroes').select('*');
    for (const row of heroes ?? []) {
      mockDb.heroes.set(row.id, rowToHero(row));
    }
    console.log(`[Supabase] Loaded ${heroes?.length ?? 0} heroes`);

    // Marches
    const { data: marches } = await supabase.from('marches').select('*');
    for (const row of marches ?? []) {
      mockDb.marches.set(row.id, rowToMarch(row));
    }
    console.log(`[Supabase] Loaded ${marches?.length ?? 0} marches`);

    // Alliances
    const { data: alliances } = await supabase.from('alliances').select('*');
    for (const row of alliances ?? []) {
      const a = rowToAlliance(row);
      mockDb.alliances.set(a.id, a);
      mockDb.alliancesByTag.set(a.tag.toLowerCase(), a.id);
    }
    console.log(`[Supabase] Loaded ${alliances?.length ?? 0} alliances`);

    // Map events (only active)
    const { data: mapEvents } = await supabase.from('map_events').select('*').eq('status', 'active');
    for (const row of mapEvents ?? []) {
      mockDb.mapEvents.set(row.id, rowToMapEvent(row));
    }
    console.log(`[Supabase] Loaded ${mapEvents?.length ?? 0} active map events`);

    // Trade offers (only open)
    const { data: trades } = await supabase.from('trade_offers').select('*').eq('status', 'open');
    for (const row of trades ?? []) {
      mockDb.tradeOffers.set(row.id, rowToTradeOffer(row));
    }
    console.log(`[Supabase] Loaded ${trades?.length ?? 0} open trade offers`);

    // Spy missions (active)
    const { data: spyMissions } = await supabase.from('spy_missions').select('*').eq('status', 'infiltrating');
    for (const row of spyMissions ?? []) {
      mockDb.spyMissions.set(row.id, rowToSpyMission(row));
    }
    console.log(`[Supabase] Loaded ${spyMissions?.length ?? 0} active spy missions`);

    // Seasonal events (active)
    const { data: seasonalEvents } = await supabase.from('seasonal_events').select('*').eq('status', 'active');
    for (const row of seasonalEvents ?? []) {
      mockDb.seasonalEvents.set(row.id, rowToSeasonalEvent(row));
    }
    console.log(`[Supabase] Loaded ${seasonalEvents?.length ?? 0} active seasonal events`);

    // Event progress
    const { data: eventProgress } = await supabase.from('event_progress').select('*');
    for (const row of eventProgress ?? []) {
      mockDb.eventProgress.set(row.id, rowToEventProgress(row));
    }
    console.log(`[Supabase] Loaded ${eventProgress?.length ?? 0} event progress entries`);

    // World bosses (active)
    const { data: worldBosses } = await supabase.from('world_bosses').select('*').eq('status', 'active');
    for (const row of worldBosses ?? []) {
      mockDb.worldBosses.set(row.id, rowToWorldBoss(row));
    }
    console.log(`[Supabase] Loaded ${worldBosses?.length ?? 0} active world bosses`);

    // Mail (recent)
    const { data: mails } = await supabase.from('mail').select('*')
      .or('deleted_by_sender.eq.false,deleted_by_recipient.eq.false')
      .order('sent_at', { ascending: false })
      .limit(1000);
    for (const row of mails ?? []) {
      mockDb.mails.set(row.id, rowToMail(row));
    }
    console.log(`[Supabase] Loaded ${mails?.length ?? 0} mails`);

    // Hero quests (active)
    const { data: heroQuests } = await supabase.from('hero_quests').select('*').eq('status', 'active');
    for (const row of heroQuests ?? []) {
      mockDb.heroQuests.set(row.id, rowToHeroQuest(row));
    }
    console.log(`[Supabase] Loaded ${heroQuests?.length ?? 0} active hero quests`);

    console.log('[Supabase] Data load complete!');
  } catch (err) {
    console.error('[Supabase] Failed to load data:', err);
    console.log('[Supabase] Continuing with empty in-memory database');
  }
}

// ── FLUSH: Push all in-memory data to Supabase ──

export async function flushToSupabase(): Promise<void> {
  if (!syncEnabled) return;

  try {
    // Upsert all players
    const players = [...mockDb.players.values()].map((p) => ({
      id: p.id,
      username: p.username,
      email: p.email,
      password_hash: p.passwordHash,
      faction: p.faction,
      alliance_id: p.allianceId ?? null,
      created_at: p.createdAt.toISOString(),
    }));
    if (players.length > 0) {
      const { error } = await supabase.from('players').upsert(players, { onConflict: 'id' });
      if (error) console.error('[Supabase] Player sync error:', error.message);
    }

    // Upsert all settlements
    const settlements = [...mockDb.settlements.values()].map((s) => ({
      id: s.id,
      player_id: s.playerId,
      name: s.name,
      level: s.level,
      q: s.q,
      r: s.r,
      s: s.s,
      resources: s.resources,
      buildings: s.buildings,
      build_queue: s.buildQueue,
      units: s.units,
      train_queue: s.trainQueue,
      researched: s.researched,
      research_queue: s.researchQueue,
    }));
    if (settlements.length > 0) {
      const { error } = await supabase.from('settlements').upsert(settlements, { onConflict: 'id' });
      if (error) console.error('[Supabase] Settlement sync error:', error.message);
    }

    // Upsert heroes
    const heroes = [...mockDb.heroes.values()].map((h) => ({
      id: h.id,
      player_id: h.playerId,
      name: h.name,
      hero_class: h.heroClass,
      level: h.level,
      xp: h.xp,
      loyalty: h.loyalty,
      status: h.status,
      abilities: h.abilities,
      equipment: h.equipment,
      stats: h.stats,
    }));
    if (heroes.length > 0) {
      const { error } = await supabase.from('heroes').upsert(heroes, { onConflict: 'id' });
      if (error) console.error('[Supabase] Hero sync error:', error.message);
    }

    // Upsert marches
    const marches = [...mockDb.marches.values()].map((m) => ({
      id: m.id,
      player_id: m.playerId,
      settlement_id: m.settlementId,
      units: m.units,
      from_q: m.fromQ,
      from_r: m.fromR,
      to_q: m.toQ,
      to_r: m.toR,
      type: m.type,
      started_at: m.startedAt,
      arrived_at: m.arrivedAt,
      status: m.status,
      hero_id: m.heroId ?? null,
    }));
    if (marches.length > 0) {
      const { error } = await supabase.from('marches').upsert(marches, { onConflict: 'id' });
      if (error) console.error('[Supabase] March sync error:', error.message);
    }

    // Upsert alliances
    const alliances = [...mockDb.alliances.values()].map((a) => ({
      id: a.id,
      name: a.name,
      tag: a.tag,
      description: a.description,
      leader_id: a.leaderId,
      members: a.members,
      created_at: new Date(a.createdAt).toISOString(),
      banner: a.banner,
    }));
    if (alliances.length > 0) {
      const { error } = await supabase.from('alliances').upsert(alliances, { onConflict: 'id' });
      if (error) console.error('[Supabase] Alliance sync error:', error.message);
    }

    // Upsert world bosses
    const worldBosses = [...mockDb.worldBosses.values()].map((b) => ({
      id: b.id,
      name: b.name,
      title: b.title,
      type: b.type,
      q: b.q,
      r: b.r,
      health: b.health,
      max_health: b.maxHealth,
      attack: b.attack,
      defense: b.defense,
      rewards: b.rewards,
      status: b.status,
      spawned_at: new Date(b.spawnedAt).toISOString(),
      expires_at: new Date(b.expiresAt).toISOString(),
      attackers: b.attackers,
    }));
    if (worldBosses.length > 0) {
      const { error } = await supabase.from('world_bosses').upsert(worldBosses, { onConflict: 'id' });
      if (error) console.error('[Supabase] WorldBoss sync error:', error.message);
    }

    console.log(`[Supabase] Synced: ${players.length} players, ${settlements.length} settlements, ${heroes.length} heroes, ${marches.length} marches`);
  } catch (err) {
    console.error('[Supabase] Flush error:', err);
  }
}

// ── Write-through helpers for critical operations ──

export async function syncPlayer(player: MockPlayer): Promise<void> {
  if (!syncEnabled) return;
  try {
    await supabase.from('players').upsert({
      id: player.id,
      username: player.username,
      email: player.email,
      password_hash: player.passwordHash,
      faction: player.faction,
      alliance_id: player.allianceId ?? null,
      created_at: player.createdAt.toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.error('[Supabase] syncPlayer error:', err);
  }
}

export async function syncSettlement(settlement: MockSettlement): Promise<void> {
  if (!syncEnabled) return;
  try {
    await supabase.from('settlements').upsert({
      id: settlement.id,
      player_id: settlement.playerId,
      name: settlement.name,
      level: settlement.level,
      q: settlement.q,
      r: settlement.r,
      s: settlement.s,
      resources: settlement.resources,
      buildings: settlement.buildings,
      build_queue: settlement.buildQueue,
      units: settlement.units,
      train_queue: settlement.trainQueue,
      researched: settlement.researched,
      research_queue: settlement.researchQueue,
    }, { onConflict: 'id' });
  } catch (err) {
    console.error('[Supabase] syncSettlement error:', err);
  }
}

// ── Start/Stop sync ──

export function startSync(intervalMs = 30_000): void {
  syncEnabled = true;
  syncInterval = setInterval(() => {
    flushToSupabase().catch(console.error);
  }, intervalMs);
  console.log(`[Supabase] Periodic sync started (every ${intervalMs / 1000}s)`);
}

export function stopSync(): void {
  syncEnabled = false;
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  console.log('[Supabase] Sync stopped');
}

// ── Check connectivity ──

export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('players').select('id').limit(1);
    if (error) {
      console.error('[Supabase] Connection test failed:', error.message);
      return false;
    }
    console.log('[Supabase] Connection test passed');
    return true;
  } catch (err) {
    console.error('[Supabase] Connection test error:', err);
    return false;
  }
}
