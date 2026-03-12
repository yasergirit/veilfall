/**
 * Supabase-backed database layer for VEILFALL.
 * Drop-in replacement for mock-db — same interfaces, same method signatures.
 * All methods are now async (the routes already use await for most operations).
 */

import { supabase } from './supabase.js';
import type { Faction } from '@veilfall/shared';

// Re-export all the same interfaces so nothing else needs to change
export interface MockPlayer {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  faction: Faction;
  allianceId?: string;
  createdAt: Date;
}

export interface MockSettlement {
  id: string;
  playerId: string;
  name: string;
  level: number;
  q: number;
  r: number;
  s: number;
  resources: Record<string, number>;
  buildings: Array<{ type: string; level: number; position: number }>;
  buildQueue: Array<{ type: string; targetLevel: number; startedAt: number; endsAt: number }>;
  units: Record<string, number>;
  trainQueue: Array<{ unitType: string; count: number; startedAt: number; endsAt: number }>;
  researched: Record<string, number>;
  researchQueue: { type: string; level: number; startedAt: number; endsAt: number } | null;
}

export interface MockMarch {
  id: string;
  playerId: string;
  settlementId: string;
  units: Record<string, number>;
  fromQ: number;
  fromR: number;
  toQ: number;
  toR: number;
  type: 'attack' | 'scout' | 'reinforce';
  startedAt: number;
  arrivedAt: number;
  status: 'marching' | 'arrived' | 'returning';
  heroId?: string;
}

export interface MockHero {
  id: string;
  playerId: string;
  name: string;
  heroClass: string;
  level: number;
  xp: number;
  loyalty: number;
  status: string;
  abilities: string[];
  equipment: Record<string, string | null>;
  stats: { strength: number; intellect: number; agility: number; endurance: number };
}

export interface MockBattleReport {
  id: string;
  attackerId: string;
  defenderId: string | null;
  location: { q: number; r: number };
  timestamp: number;
  attackerUnits: Record<string, number>;
  defenderUnits: Record<string, number>;
  attackerLosses: Record<string, number>;
  defenderLosses: Record<string, number>;
  winner: 'attacker' | 'defender' | 'draw';
  loot: Record<string, number>;
  heroInvolved?: { id: string; name: string; xpGained: number };
}

export interface MockMapEvent {
  id: string;
  type: 'ruin' | 'resource_node' | 'npc_camp' | 'aether_surge';
  q: number;
  r: number;
  name: string;
  description: string;
  rewards: Record<string, number>;
  guardians?: Record<string, number>;
  discoveredBy?: string;
  status: 'active' | 'claimed' | 'expired';
  expiresAt: number;
  createdAt: number;
}

export interface MockAlliance {
  id: string;
  name: string;
  tag: string;
  description: string;
  leaderId: string;
  members: Array<{ playerId: string; role: 'leader' | 'officer' | 'member'; joinedAt: number }>;
  createdAt: number;
  banner: { primaryColor: string; secondaryColor: string; icon: string };
}

export interface MockDiplomacy {
  id: string;
  fromAllianceId: string;
  toAllianceId: string;
  type: 'alliance' | 'nap' | 'war';
  status: 'pending' | 'active' | 'rejected';
  createdAt: number;
}

export interface MockEvent {
  id: string;
  playerId: string;
  type: 'building_complete' | 'building_upgrade' | 'unit_trained' | 'march_sent' | 'march_returned' | 'combat' | 'alliance_joined' | 'quest_complete' | 'lore_discovered';
  title: string;
  description: string;
  timestamp: number;
  data?: Record<string, any>;
}

export interface MockResearch {
  id: string;
  type: string;
  level: number;
  completedAt: number;
}

export interface MockMessage {
  id: string;
  channelType: 'global' | 'alliance' | 'whisper';
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
}

export interface MockSeasonalEvent {
  id: string;
  type: 'harvest_moon' | 'aether_storm' | 'ironclad_tournament';
  name: string;
  description: string;
  startedAt: number;
  endsAt: number;
  status: 'active' | 'completed' | 'expired';
  objectives: { description: string; target: number };
  rewards: Record<string, number>;
  bonusDescription: string;
}

export interface MockEventProgress {
  id: string;
  playerId: string;
  eventId: string;
  progress: number;
  completed: boolean;
  claimedReward: boolean;
}

export interface MockTradeOffer {
  id: string;
  sellerId: string;
  settlementId: string;
  offerResource: string;
  offerAmount: number;
  requestResource: string;
  requestAmount: number;
  status: 'open' | 'completed' | 'cancelled';
  createdAt: number;
  completedBy?: string;
}

export interface MockSpyMission {
  id: string;
  playerId: string;
  settlementId: string;
  targetSettlementId: string;
  targetPlayerId: string;
  type: 'intel' | 'sabotage';
  status: 'infiltrating' | 'active' | 'completed' | 'failed' | 'caught';
  startedAt: number;
  arrivedAt: number;
  completedAt?: number;
  result?: {
    resources?: Record<string, number>;
    buildings?: Array<{ type: string; level: number }>;
    units?: Record<string, number>;
    sabotaged?: { buildingType: string; levelsLost: number };
  };
}

export interface MockMail {
  id: string;
  fromPlayerId: string;
  fromUsername: string;
  toPlayerId: string;
  toUsername: string;
  subject: string;
  body: string;
  read: boolean;
  starred: boolean;
  deletedBySender: boolean;
  deletedByRecipient: boolean;
  sentAt: number;
}

export interface MockHeroQuest {
  id: string;
  playerId: string;
  heroId: string;
  questType: 'exploration' | 'training' | 'relic_hunt' | 'veil_expedition';
  status: 'active' | 'completed' | 'failed';
  startedAt: number;
  endsAt: number;
  difficulty: 1 | 2 | 3;
  rewards?: {
    xp: number;
    resources?: Record<string, number>;
    equipment?: string;
    loreFragment?: string;
  };
}

export interface MockWorldBoss {
  id: string;
  name: string;
  title: string;
  type: 'veil_titan' | 'aether_wyrm' | 'shadow_colossus';
  q: number;
  r: number;
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  rewards: Record<string, number>;
  status: 'active' | 'defeated' | 'despawned';
  spawnedAt: number;
  expiresAt: number;
  attackers: Array<{ playerId: string; username: string; damage: number; unitsLost: Record<string, number> }>;
}

// ── Row-to-Interface mappers ──

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
    buildQueue: row.build_queue,
    units: row.units,
    trainQueue: row.train_queue,
    researched: row.researched,
    researchQueue: row.research_queue,
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
    abilities: row.abilities,
    equipment: row.equipment,
    stats: row.stats,
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
    members: row.members,
    createdAt: new Date(row.created_at).getTime(),
    banner: row.banner,
  };
}

function rowToDiplomacy(row: any): MockDiplomacy {
  return {
    id: row.id,
    fromAllianceId: row.from_alliance_id,
    toAllianceId: row.to_alliance_id,
    type: row.type,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function rowToMessage(row: any): MockMessage {
  return {
    id: row.id,
    channelType: row.channel_type,
    channelId: row.channel_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    content: row.content,
    timestamp: new Date(row.timestamp).getTime(),
  };
}

function rowToEvent(row: any): MockEvent {
  return {
    id: row.id,
    playerId: row.player_id,
    type: row.type,
    title: row.title,
    description: row.description,
    timestamp: new Date(row.timestamp).getTime(),
    data: row.data ?? undefined,
  };
}

function rowToBattleReport(row: any): MockBattleReport {
  return {
    id: row.id,
    attackerId: row.attacker_id,
    defenderId: row.defender_id ?? null,
    location: row.location,
    timestamp: new Date(row.timestamp).getTime(),
    attackerUnits: row.attacker_units,
    defenderUnits: row.defender_units,
    attackerLosses: row.attacker_losses,
    defenderLosses: row.defender_losses,
    winner: row.winner,
    loot: row.loot,
    heroInvolved: row.hero_involved ?? undefined,
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
    attackers: row.attackers,
  };
}

// ── Supabase Database Class ──

class SupabaseDatabase {

  // ── Player CRUD ──

  async createPlayer(player: MockPlayer): Promise<MockPlayer> {
    const { data, error } = await supabase.from('players').insert({
      id: player.id,
      username: player.username,
      email: player.email,
      password_hash: player.passwordHash,
      faction: player.faction,
      alliance_id: player.allianceId ?? null,
      created_at: player.createdAt.toISOString(),
    }).select().single();
    if (error) throw new Error(`createPlayer: ${error.message}`);
    return rowToPlayer(data);
  }

  async getPlayerByEmail(email: string): Promise<MockPlayer | undefined> {
    const { data } = await supabase.from('players').select('*').eq('email', email).maybeSingle();
    return data ? rowToPlayer(data) : undefined;
  }

  async getPlayerByUsername(username: string): Promise<MockPlayer | undefined> {
    const { data } = await supabase.from('players').select('*').eq('username', username).maybeSingle();
    return data ? rowToPlayer(data) : undefined;
  }

  async getPlayer(id: string): Promise<MockPlayer | undefined> {
    const { data } = await supabase.from('players').select('*').eq('id', id).maybeSingle();
    return data ? rowToPlayer(data) : undefined;
  }

  async updatePlayer(id: string, update: Partial<{ allianceId: string | undefined }>): Promise<void> {
    const mapped: any = {};
    if ('allianceId' in update) mapped.alliance_id = update.allianceId ?? null;
    await supabase.from('players').update(mapped).eq('id', id);
  }

  // ── Settlement CRUD ──

  async createSettlement(settlement: MockSettlement): Promise<MockSettlement> {
    const { data, error } = await supabase.from('settlements').insert({
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
    }).select().single();
    if (error) throw new Error(`createSettlement: ${error.message}`);
    return rowToSettlement(data);
  }

  async getSettlementsByPlayer(playerId: string): Promise<MockSettlement[]> {
    const { data } = await supabase.from('settlements').select('*').eq('player_id', playerId);
    return (data ?? []).map(rowToSettlement);
  }

  async getSettlement(id: string): Promise<MockSettlement | undefined> {
    const { data } = await supabase.from('settlements').select('*').eq('id', id).maybeSingle();
    return data ? rowToSettlement(data) : undefined;
  }

  async updateSettlement(id: string, update: Partial<MockSettlement>): Promise<MockSettlement | undefined> {
    const mapped: any = {};
    if ('name' in update) mapped.name = update.name;
    if ('level' in update) mapped.level = update.level;
    if ('resources' in update) mapped.resources = update.resources;
    if ('buildings' in update) mapped.buildings = update.buildings;
    if ('buildQueue' in update) mapped.build_queue = update.buildQueue;
    if ('units' in update) mapped.units = update.units;
    if ('trainQueue' in update) mapped.train_queue = update.trainQueue;
    if ('researched' in update) mapped.researched = update.researched;
    if ('researchQueue' in update) mapped.research_queue = update.researchQueue;

    const { data, error } = await supabase.from('settlements').update(mapped).eq('id', id).select().single();
    if (error || !data) return undefined;
    return rowToSettlement(data);
  }

  async getAllSettlements(): Promise<MockSettlement[]> {
    const { data } = await supabase.from('settlements').select('*');
    return (data ?? []).map(rowToSettlement);
  }

  // ── Hero CRUD ──

  async createHero(hero: MockHero): Promise<MockHero> {
    const { data, error } = await supabase.from('heroes').insert({
      id: hero.id,
      player_id: hero.playerId,
      name: hero.name,
      hero_class: hero.heroClass,
      level: hero.level,
      xp: hero.xp,
      loyalty: hero.loyalty,
      status: hero.status,
      abilities: hero.abilities,
      equipment: hero.equipment,
      stats: hero.stats,
    }).select().single();
    if (error) throw new Error(`createHero: ${error.message}`);
    return rowToHero(data);
  }

  async getHeroesByPlayer(playerId: string): Promise<MockHero[]> {
    const { data } = await supabase.from('heroes').select('*').eq('player_id', playerId);
    return (data ?? []).map(rowToHero);
  }

  async getHero(id: string): Promise<MockHero | undefined> {
    const { data } = await supabase.from('heroes').select('*').eq('id', id).maybeSingle();
    return data ? rowToHero(data) : undefined;
  }

  async updateHero(id: string, update: Partial<MockHero>): Promise<MockHero | undefined> {
    const mapped: any = {};
    if ('name' in update) mapped.name = update.name;
    if ('level' in update) mapped.level = update.level;
    if ('xp' in update) mapped.xp = update.xp;
    if ('loyalty' in update) mapped.loyalty = update.loyalty;
    if ('status' in update) mapped.status = update.status;
    if ('abilities' in update) mapped.abilities = update.abilities;
    if ('equipment' in update) mapped.equipment = update.equipment;
    if ('stats' in update) mapped.stats = update.stats;

    const { data, error } = await supabase.from('heroes').update(mapped).eq('id', id).select().single();
    if (error || !data) return undefined;
    return rowToHero(data);
  }

  // ── March CRUD ──

  async createMarch(march: MockMarch): Promise<MockMarch> {
    const { data, error } = await supabase.from('marches').insert({
      id: march.id,
      player_id: march.playerId,
      settlement_id: march.settlementId,
      units: march.units,
      from_q: march.fromQ,
      from_r: march.fromR,
      to_q: march.toQ,
      to_r: march.toR,
      type: march.type,
      started_at: march.startedAt,
      arrived_at: march.arrivedAt,
      status: march.status,
      hero_id: march.heroId ?? null,
    }).select().single();
    if (error) throw new Error(`createMarch: ${error.message}`);
    return rowToMarch(data);
  }

  async getMarchesBySettlement(settlementId: string): Promise<MockMarch[]> {
    const { data } = await supabase.from('marches').select('*').eq('settlement_id', settlementId);
    return (data ?? []).map(rowToMarch);
  }

  async getMarch(id: string): Promise<MockMarch | undefined> {
    const { data } = await supabase.from('marches').select('*').eq('id', id).maybeSingle();
    return data ? rowToMarch(data) : undefined;
  }

  async updateMarch(id: string, update: Partial<MockMarch>): Promise<MockMarch | undefined> {
    const mapped: any = {};
    if ('status' in update) mapped.status = update.status;
    if ('units' in update) mapped.units = update.units;
    if ('arrivedAt' in update) mapped.arrived_at = update.arrivedAt;

    const { data, error } = await supabase.from('marches').update(mapped).eq('id', id).select().single();
    if (error || !data) return undefined;
    return rowToMarch(data);
  }

  async deleteMarch(id: string): Promise<boolean> {
    const { error } = await supabase.from('marches').delete().eq('id', id);
    return !error;
  }

  async getAllMarches(): Promise<MockMarch[]> {
    const { data } = await supabase.from('marches').select('*');
    return (data ?? []).map(rowToMarch);
  }

  // ── Alliance CRUD ──

  async createAlliance(alliance: MockAlliance): Promise<MockAlliance> {
    const { data, error } = await supabase.from('alliances').insert({
      id: alliance.id,
      name: alliance.name,
      tag: alliance.tag,
      description: alliance.description,
      leader_id: alliance.leaderId,
      members: alliance.members,
      created_at: new Date(alliance.createdAt).toISOString(),
      banner: alliance.banner,
    }).select().single();
    if (error) throw new Error(`createAlliance: ${error.message}`);
    return rowToAlliance(data);
  }

  async getAlliance(id: string): Promise<MockAlliance | undefined> {
    const { data } = await supabase.from('alliances').select('*').eq('id', id).maybeSingle();
    return data ? rowToAlliance(data) : undefined;
  }

  async getAllianceByTag(tag: string): Promise<MockAlliance | undefined> {
    const { data } = await supabase.from('alliances').select('*').eq('tag', tag.toLowerCase()).maybeSingle();
    return data ? rowToAlliance(data) : undefined;
  }

  async getAllianceByPlayer(playerId: string): Promise<MockAlliance | undefined> {
    const player = await this.getPlayer(playerId);
    if (!player?.allianceId) return undefined;
    return this.getAlliance(player.allianceId);
  }

  async updateAlliance(id: string, update: Partial<MockAlliance>): Promise<MockAlliance | undefined> {
    const mapped: any = {};
    if ('name' in update) mapped.name = update.name;
    if ('tag' in update) mapped.tag = update.tag;
    if ('description' in update) mapped.description = update.description;
    if ('leaderId' in update) mapped.leader_id = update.leaderId;
    if ('members' in update) mapped.members = update.members;
    if ('banner' in update) mapped.banner = update.banner;

    const { data, error } = await supabase.from('alliances').update(mapped).eq('id', id).select().single();
    if (error || !data) return undefined;
    return rowToAlliance(data);
  }

  async addAllianceMember(allianceId: string, playerId: string, role: 'leader' | 'officer' | 'member'): Promise<boolean> {
    const alliance = await this.getAlliance(allianceId);
    if (!alliance) return false;
    alliance.members.push({ playerId, role, joinedAt: Date.now() });
    await this.updateAlliance(allianceId, { members: alliance.members });
    await this.updatePlayer(playerId, { allianceId });
    return true;
  }

  async removeAllianceMember(allianceId: string, playerId: string): Promise<boolean> {
    const alliance = await this.getAlliance(allianceId);
    if (!alliance) return false;
    alliance.members = alliance.members.filter((m) => m.playerId !== playerId);
    await this.updateAlliance(allianceId, { members: alliance.members });
    await this.updatePlayer(playerId, { allianceId: undefined });
    return true;
  }

  async deleteAlliance(id: string): Promise<boolean> {
    const alliance = await this.getAlliance(id);
    if (!alliance) return false;
    for (const member of alliance.members) {
      await this.updatePlayer(member.playerId, { allianceId: undefined });
    }
    const { error } = await supabase.from('alliances').delete().eq('id', id);
    return !error;
  }

  async searchAlliances(query: string): Promise<MockAlliance[]> {
    const { data } = await supabase.from('alliances').select('*').or(`name.ilike.%${query}%,tag.ilike.%${query}%`).limit(20);
    return (data ?? []).map(rowToAlliance);
  }

  async getAllAlliances(): Promise<MockAlliance[]> {
    const { data } = await supabase.from('alliances').select('*');
    return (data ?? []).map(rowToAlliance);
  }

  // ── Diplomacy CRUD ──

  async createDiplomacy(diplomacy: MockDiplomacy): Promise<MockDiplomacy> {
    const { data, error } = await supabase.from('diplomacy').insert({
      id: diplomacy.id,
      from_alliance_id: diplomacy.fromAllianceId,
      to_alliance_id: diplomacy.toAllianceId,
      type: diplomacy.type,
      status: diplomacy.status,
      created_at: new Date(diplomacy.createdAt).toISOString(),
    }).select().single();
    if (error) throw new Error(`createDiplomacy: ${error.message}`);
    return rowToDiplomacy(data);
  }

  async getDiplomacyByAlliance(allianceId: string): Promise<MockDiplomacy[]> {
    const { data } = await supabase.from('diplomacy').select('*')
      .or(`from_alliance_id.eq.${allianceId},to_alliance_id.eq.${allianceId}`);
    return (data ?? []).map(rowToDiplomacy);
  }

  async updateDiplomacy(id: string, update: Partial<MockDiplomacy>): Promise<MockDiplomacy | undefined> {
    const mapped: any = {};
    if ('status' in update) mapped.status = update.status;
    const { data, error } = await supabase.from('diplomacy').update(mapped).eq('id', id).select().single();
    if (error || !data) return undefined;
    return rowToDiplomacy(data);
  }

  // ── Message CRUD ──

  async addMessage(message: MockMessage): Promise<MockMessage> {
    const { data, error } = await supabase.from('messages').insert({
      id: message.id,
      channel_type: message.channelType,
      channel_id: message.channelId,
      sender_id: message.senderId,
      sender_name: message.senderName,
      content: message.content,
      timestamp: new Date(message.timestamp).toISOString(),
    }).select().single();
    if (error) throw new Error(`addMessage: ${error.message}`);
    return rowToMessage(data);
  }

  async getMessages(channelType: string, channelId: string, limit: number, _before?: number): Promise<MockMessage[]> {
    let query = supabase.from('messages').select('*')
      .eq('channel_type', channelType)
      .eq('channel_id', channelId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (_before) {
      query = query.lt('timestamp', new Date(_before).toISOString());
    }

    const { data } = await query;
    return (data ?? []).map(rowToMessage).reverse();
  }

  // ── Event / Chronicle CRUD ──

  async addEvent(event: MockEvent): Promise<MockEvent> {
    const { data, error } = await supabase.from('chronicle_events').insert({
      id: event.id,
      player_id: event.playerId,
      type: event.type,
      title: event.title,
      description: event.description,
      timestamp: new Date(event.timestamp).toISOString(),
      data: event.data ?? null,
    }).select().single();
    if (error) throw new Error(`addEvent: ${error.message}`);
    return rowToEvent(data);
  }

  async getEvents(playerId: string, limit: number, offset: number, type?: string): Promise<MockEvent[]> {
    let query = supabase.from('chronicle_events').select('*')
      .eq('player_id', playerId)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    const { data } = await query;
    return (data ?? []).map(rowToEvent);
  }

  // ── Battle Report CRUD ──

  async addBattleReport(report: MockBattleReport): Promise<MockBattleReport> {
    const { data, error } = await supabase.from('battle_reports').insert({
      id: report.id,
      attacker_id: report.attackerId,
      defender_id: report.defenderId,
      location: report.location,
      timestamp: new Date(report.timestamp).toISOString(),
      attacker_units: report.attackerUnits,
      defender_units: report.defenderUnits,
      attacker_losses: report.attackerLosses,
      defender_losses: report.defenderLosses,
      winner: report.winner,
      loot: report.loot,
      hero_involved: report.heroInvolved ?? null,
    }).select().single();
    if (error) throw new Error(`addBattleReport: ${error.message}`);
    return rowToBattleReport(data);
  }

  async getReportsByPlayer(playerId: string, limit: number, offset: number): Promise<MockBattleReport[]> {
    const { data } = await supabase.from('battle_reports').select('*')
      .or(`attacker_id.eq.${playerId},defender_id.eq.${playerId}`)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
    return (data ?? []).map(rowToBattleReport);
  }

  async getBattleReport(id: string): Promise<MockBattleReport | undefined> {
    const { data } = await supabase.from('battle_reports').select('*').eq('id', id).maybeSingle();
    return data ? rowToBattleReport(data) : undefined;
  }

  // ── Map Event CRUD ──

  async addMapEvent(event: MockMapEvent): Promise<MockMapEvent> {
    const { data, error } = await supabase.from('map_events').insert({
      id: event.id,
      type: event.type,
      q: event.q,
      r: event.r,
      name: event.name,
      description: event.description,
      rewards: event.rewards,
      guardians: event.guardians ?? null,
      discovered_by: event.discoveredBy ?? null,
      status: event.status,
      expires_at: new Date(event.expiresAt).toISOString(),
      created_at: new Date(event.createdAt).toISOString(),
    }).select().single();
    if (error) throw new Error(`addMapEvent: ${error.message}`);
    return rowToMapEvent(data);
  }

  async getActiveMapEvents(): Promise<MockMapEvent[]> {
    const { data } = await supabase.from('map_events').select('*').eq('status', 'active');
    return (data ?? []).map(rowToMapEvent);
  }

  async getMapEvent(id: string): Promise<MockMapEvent | undefined> {
    const { data } = await supabase.from('map_events').select('*').eq('id', id).maybeSingle();
    return data ? rowToMapEvent(data) : undefined;
  }

  async getMapEventAt(q: number, r: number): Promise<MockMapEvent | undefined> {
    const { data } = await supabase.from('map_events').select('*')
      .eq('q', q).eq('r', r).eq('status', 'active').maybeSingle();
    return data ? rowToMapEvent(data) : undefined;
  }

  async updateMapEvent(id: string, update: Partial<MockMapEvent>): Promise<MockMapEvent | undefined> {
    const mapped: any = {};
    if ('status' in update) mapped.status = update.status;
    if ('discoveredBy' in update) mapped.discovered_by = update.discoveredBy;
    if ('rewards' in update) mapped.rewards = update.rewards;

    const { data, error } = await supabase.from('map_events').update(mapped).eq('id', id).select().single();
    if (error || !data) return undefined;
    return rowToMapEvent(data);
  }

  // ── Trade Offer CRUD ──

  async createTradeOffer(offer: MockTradeOffer): Promise<MockTradeOffer> {
    const { data, error } = await supabase.from('trade_offers').insert({
      id: offer.id,
      seller_id: offer.sellerId,
      settlement_id: offer.settlementId,
      offer_resource: offer.offerResource,
      offer_amount: offer.offerAmount,
      request_resource: offer.requestResource,
      request_amount: offer.requestAmount,
      status: offer.status,
      created_at: new Date(offer.createdAt).toISOString(),
      completed_by: offer.completedBy ?? null,
    }).select().single();
    if (error) throw new Error(`createTradeOffer: ${error.message}`);
    return rowToTradeOffer(data);
  }

  async getTradeOffer(id: string): Promise<MockTradeOffer | undefined> {
    const { data } = await supabase.from('trade_offers').select('*').eq('id', id).maybeSingle();
    return data ? rowToTradeOffer(data) : undefined;
  }

  async getOpenTradeOffers(resource?: string): Promise<MockTradeOffer[]> {
    let query = supabase.from('trade_offers').select('*').eq('status', 'open').order('created_at', { ascending: false });
    if (resource && resource !== 'all') {
      query = query.or(`offer_resource.eq.${resource},request_resource.eq.${resource}`);
    }
    const { data } = await query;
    return (data ?? []).map(rowToTradeOffer);
  }

  async getTradeOffersByPlayer(playerId: string, limit: number): Promise<MockTradeOffer[]> {
    const { data } = await supabase.from('trade_offers').select('*')
      .or(`seller_id.eq.${playerId},completed_by.eq.${playerId}`)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map(rowToTradeOffer);
  }

  async updateTradeOffer(id: string, update: Partial<MockTradeOffer>): Promise<MockTradeOffer | undefined> {
    const mapped: any = {};
    if ('status' in update) mapped.status = update.status;
    if ('completedBy' in update) mapped.completed_by = update.completedBy;

    const { data, error } = await supabase.from('trade_offers').update(mapped).eq('id', id).select().single();
    if (error || !data) return undefined;
    return rowToTradeOffer(data);
  }

  // ── Spy Mission CRUD ──

  async createSpyMission(mission: MockSpyMission): Promise<MockSpyMission> {
    const { data, error } = await supabase.from('spy_missions').insert({
      id: mission.id,
      player_id: mission.playerId,
      settlement_id: mission.settlementId,
      target_settlement_id: mission.targetSettlementId,
      target_player_id: mission.targetPlayerId,
      type: mission.type,
      status: mission.status,
      started_at: mission.startedAt,
      arrived_at: mission.arrivedAt,
      completed_at: mission.completedAt ?? null,
      result: mission.result ?? null,
    }).select().single();
    if (error) throw new Error(`createSpyMission: ${error.message}`);
    return rowToSpyMission(data);
  }

  async getSpyMission(id: string): Promise<MockSpyMission | undefined> {
    const { data } = await supabase.from('spy_missions').select('*').eq('id', id).maybeSingle();
    return data ? rowToSpyMission(data) : undefined;
  }

  async getSpyMissionsByPlayer(playerId: string): Promise<MockSpyMission[]> {
    const { data } = await supabase.from('spy_missions').select('*')
      .eq('player_id', playerId)
      .order('started_at', { ascending: false });
    return (data ?? []).map(rowToSpyMission);
  }

  async updateSpyMission(id: string, update: Partial<MockSpyMission>): Promise<MockSpyMission | undefined> {
    const mapped: any = {};
    if ('status' in update) mapped.status = update.status;
    if ('completedAt' in update) mapped.completed_at = update.completedAt;
    if ('result' in update) mapped.result = update.result;

    const { data, error } = await supabase.from('spy_missions').update(mapped).eq('id', id).select().single();
    if (error || !data) return undefined;
    return rowToSpyMission(data);
  }

  async getAllActiveSpyMissions(): Promise<MockSpyMission[]> {
    const { data } = await supabase.from('spy_missions').select('*').eq('status', 'infiltrating');
    return (data ?? []).map(rowToSpyMission);
  }

  // ── Seasonal Event CRUD ──

  async createSeasonalEvent(event: MockSeasonalEvent): Promise<MockSeasonalEvent> {
    const { data, error } = await supabase.from('seasonal_events').insert({
      id: event.id,
      type: event.type,
      name: event.name,
      description: event.description,
      started_at: new Date(event.startedAt).toISOString(),
      ends_at: new Date(event.endsAt).toISOString(),
      status: event.status,
      objectives: event.objectives,
      rewards: event.rewards,
      bonus_description: event.bonusDescription,
    }).select().single();
    if (error) throw new Error(`createSeasonalEvent: ${error.message}`);
    return rowToSeasonalEvent(data);
  }

  async getSeasonalEvent(id: string): Promise<MockSeasonalEvent | undefined> {
    const { data } = await supabase.from('seasonal_events').select('*').eq('id', id).maybeSingle();
    return data ? rowToSeasonalEvent(data) : undefined;
  }

  async getActiveSeasonalEvent(): Promise<MockSeasonalEvent | undefined> {
    const { data } = await supabase.from('seasonal_events').select('*').eq('status', 'active').maybeSingle();
    return data ? rowToSeasonalEvent(data) : undefined;
  }

  async getSeasonalEventHistory(limit: number): Promise<MockSeasonalEvent[]> {
    const { data } = await supabase.from('seasonal_events').select('*')
      .neq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map(rowToSeasonalEvent);
  }

  async updateSeasonalEvent(id: string, update: Partial<MockSeasonalEvent>): Promise<MockSeasonalEvent | undefined> {
    const mapped: any = {};
    if ('status' in update) mapped.status = update.status;
    if ('objectives' in update) mapped.objectives = update.objectives;

    const { data, error } = await supabase.from('seasonal_events').update(mapped).eq('id', id).select().single();
    if (error || !data) return undefined;
    return rowToSeasonalEvent(data);
  }

  // ── Event Progress CRUD ──

  async createEventProgress(progress: MockEventProgress): Promise<MockEventProgress> {
    const { data, error } = await supabase.from('event_progress').insert({
      id: progress.id,
      player_id: progress.playerId,
      event_id: progress.eventId,
      progress: progress.progress,
      completed: progress.completed,
      claimed_reward: progress.claimedReward,
    }).select().single();
    if (error) throw new Error(`createEventProgress: ${error.message}`);
    return rowToEventProgress(data);
  }

  async getEventProgress(id: string): Promise<MockEventProgress | undefined> {
    const { data } = await supabase.from('event_progress').select('*').eq('id', id).maybeSingle();
    return data ? rowToEventProgress(data) : undefined;
  }

  async getEventProgressByPlayerAndEvent(playerId: string, eventId: string): Promise<MockEventProgress | undefined> {
    const { data } = await supabase.from('event_progress').select('*')
      .eq('player_id', playerId).eq('event_id', eventId).maybeSingle();
    return data ? rowToEventProgress(data) : undefined;
  }

  async getEventProgressByEvent(eventId: string): Promise<MockEventProgress[]> {
    const { data } = await supabase.from('event_progress').select('*').eq('event_id', eventId);
    return (data ?? []).map(rowToEventProgress);
  }

  async updateEventProgress(id: string, update: Partial<MockEventProgress>): Promise<MockEventProgress | undefined> {
    const mapped: any = {};
    if ('progress' in update) mapped.progress = update.progress;
    if ('completed' in update) mapped.completed = update.completed;
    if ('claimedReward' in update) mapped.claimed_reward = update.claimedReward;

    const { data, error } = await supabase.from('event_progress').update(mapped).eq('id', id).select().single();
    if (error || !data) return undefined;
    return rowToEventProgress(data);
  }

  // ── World Boss CRUD ──

  async createWorldBoss(boss: MockWorldBoss): Promise<MockWorldBoss> {
    const { data, error } = await supabase.from('world_bosses').insert({
      id: boss.id,
      name: boss.name,
      title: boss.title,
      type: boss.type,
      q: boss.q,
      r: boss.r,
      health: boss.health,
      max_health: boss.maxHealth,
      attack: boss.attack,
      defense: boss.defense,
      rewards: boss.rewards,
      status: boss.status,
      spawned_at: new Date(boss.spawnedAt).toISOString(),
      expires_at: new Date(boss.expiresAt).toISOString(),
      attackers: boss.attackers,
    }).select().single();
    if (error) throw new Error(`createWorldBoss: ${error.message}`);
    return rowToWorldBoss(data);
  }

  async getWorldBoss(id: string): Promise<MockWorldBoss | undefined> {
    const { data } = await supabase.from('world_bosses').select('*').eq('id', id).maybeSingle();
    return data ? rowToWorldBoss(data) : undefined;
  }

  async getActiveWorldBosses(): Promise<MockWorldBoss[]> {
    const { data } = await supabase.from('world_bosses').select('*').eq('status', 'active');
    return (data ?? []).map(rowToWorldBoss);
  }

  async updateWorldBoss(id: string, update: Partial<MockWorldBoss>): Promise<MockWorldBoss | undefined> {
    const mapped: any = {};
    if ('health' in update) mapped.health = update.health;
    if ('status' in update) mapped.status = update.status;
    if ('attackers' in update) mapped.attackers = update.attackers;
    if ('rewards' in update) mapped.rewards = update.rewards;

    const { data, error } = await supabase.from('world_bosses').update(mapped).eq('id', id).select().single();
    if (error || !data) return undefined;
    return rowToWorldBoss(data);
  }

  // ── Mail CRUD ──

  async createMail(mail: MockMail): Promise<MockMail> {
    const { data, error } = await supabase.from('mail').insert({
      id: mail.id,
      from_player_id: mail.fromPlayerId,
      from_username: mail.fromUsername,
      to_player_id: mail.toPlayerId,
      to_username: mail.toUsername,
      subject: mail.subject,
      body: mail.body,
      read: mail.read,
      starred: mail.starred,
      deleted_by_sender: mail.deletedBySender,
      deleted_by_recipient: mail.deletedByRecipient,
      sent_at: new Date(mail.sentAt).toISOString(),
    }).select().single();
    if (error) throw new Error(`createMail: ${error.message}`);
    return rowToMail(data);
  }

  async getMail(id: string): Promise<MockMail | undefined> {
    const { data } = await supabase.from('mail').select('*').eq('id', id).maybeSingle();
    return data ? rowToMail(data) : undefined;
  }

  async getMailsForPlayer(playerId: string, limit: number, offset: number, unreadOnly: boolean): Promise<{ mails: MockMail[]; unreadCount: number; total: number }> {
    // Get unread count
    const { count: unreadCount } = await supabase.from('mail')
      .select('*', { count: 'exact', head: true })
      .eq('to_player_id', playerId)
      .eq('deleted_by_recipient', false)
      .eq('read', false);

    let query = supabase.from('mail').select('*', { count: 'exact' })
      .eq('to_player_id', playerId)
      .eq('deleted_by_recipient', false)
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, count } = await query;

    return {
      mails: (data ?? []).map(rowToMail),
      unreadCount: unreadCount ?? 0,
      total: count ?? 0,
    };
  }

  async getSentMails(playerId: string, limit: number, offset: number): Promise<{ mails: MockMail[]; total: number }> {
    const { data, count } = await supabase.from('mail').select('*', { count: 'exact' })
      .eq('from_player_id', playerId)
      .eq('deleted_by_sender', false)
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return {
      mails: (data ?? []).map(rowToMail),
      total: count ?? 0,
    };
  }

  async updateMail(id: string, update: Partial<MockMail>): Promise<MockMail | undefined> {
    const mapped: any = {};
    if ('read' in update) mapped.read = update.read;
    if ('starred' in update) mapped.starred = update.starred;
    if ('deletedBySender' in update) mapped.deleted_by_sender = update.deletedBySender;
    if ('deletedByRecipient' in update) mapped.deleted_by_recipient = update.deletedByRecipient;

    const { data, error } = await supabase.from('mail').update(mapped).eq('id', id).select().single();
    if (error || !data) return undefined;
    return rowToMail(data);
  }

  // ── Hero Quest CRUD ──

  async createHeroQuest(quest: MockHeroQuest): Promise<MockHeroQuest> {
    const { data, error } = await supabase.from('hero_quests').insert({
      id: quest.id,
      player_id: quest.playerId,
      hero_id: quest.heroId,
      quest_type: quest.questType,
      status: quest.status,
      started_at: quest.startedAt,
      ends_at: quest.endsAt,
      difficulty: quest.difficulty,
      rewards: quest.rewards ?? null,
    }).select().single();
    if (error) throw new Error(`createHeroQuest: ${error.message}`);
    return rowToHeroQuest(data);
  }

  async getHeroQuest(id: string): Promise<MockHeroQuest | undefined> {
    const { data } = await supabase.from('hero_quests').select('*').eq('id', id).maybeSingle();
    return data ? rowToHeroQuest(data) : undefined;
  }

  async getActiveHeroQuestsByPlayer(playerId: string): Promise<MockHeroQuest[]> {
    const { data } = await supabase.from('hero_quests').select('*')
      .eq('player_id', playerId).eq('status', 'active');
    return (data ?? []).map(rowToHeroQuest);
  }

  async getHeroQuestsByPlayer(playerId: string, limit: number): Promise<MockHeroQuest[]> {
    const { data } = await supabase.from('hero_quests').select('*')
      .eq('player_id', playerId)
      .neq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map(rowToHeroQuest);
  }

  async getActiveHeroQuestByHero(heroId: string): Promise<MockHeroQuest | undefined> {
    const { data } = await supabase.from('hero_quests').select('*')
      .eq('hero_id', heroId).eq('status', 'active').maybeSingle();
    return data ? rowToHeroQuest(data) : undefined;
  }

  async getCompletedHeroQuests(): Promise<MockHeroQuest[]> {
    const { data } = await supabase.from('hero_quests').select('*').eq('status', 'active');
    return (data ?? []).map(rowToHeroQuest);
  }

  async updateHeroQuest(id: string, update: Partial<MockHeroQuest>): Promise<MockHeroQuest | undefined> {
    const mapped: any = {};
    if ('status' in update) mapped.status = update.status;
    if ('rewards' in update) mapped.rewards = update.rewards;

    const { data, error } = await supabase.from('hero_quests').update(mapped).eq('id', id).select().single();
    if (error || !data) return undefined;
    return rowToHeroQuest(data);
  }

  async getAllActiveHeroQuests(): Promise<MockHeroQuest[]> {
    const { data } = await supabase.from('hero_quests').select('*').eq('status', 'active');
    return (data ?? []).map(rowToHeroQuest);
  }

  // ── Notification CRUD ──

  async createNotification(notif: { id: string; playerId: string; type: string; title: string; message: string; data?: any }): Promise<any> {
    const { data, error } = await supabase.from('notifications').insert({
      id: notif.id,
      player_id: notif.playerId,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      data: notif.data ?? null,
    }).select().single();
    if (error) throw new Error(`createNotification: ${error.message}`);
    return data;
  }

  async getNotifications(playerId: string, limit: number, unreadOnly: boolean): Promise<any[]> {
    let query = supabase.from('notifications').select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (unreadOnly) query = query.eq('read', false);
    const { data } = await query;
    return data ?? [];
  }

  async markNotificationRead(id: string): Promise<void> {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  }

  // ── Leaderboard helpers ──

  async getAllPlayers(): Promise<MockPlayer[]> {
    const { data } = await supabase.from('players').select('*');
    return (data ?? []).map(rowToPlayer);
  }
}

export const mockDb = new SupabaseDatabase();
