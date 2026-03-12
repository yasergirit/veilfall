/**
 * In-memory mock database for development without PostgreSQL.
 * Stores all game state in memory — resets on server restart.
 */

import type { Faction } from '@veilfall/shared';
import { STARTING_RESOURCES } from '@veilfall/shared';

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
  settlementId: string; // source settlement
  targetSettlementId: string;
  targetPlayerId: string;
  type: 'intel' | 'sabotage';
  status: 'infiltrating' | 'active' | 'completed' | 'failed' | 'caught';
  startedAt: number;
  arrivedAt: number;
  completedAt?: number;
  result?: {
    // Intel mission results
    resources?: Record<string, number>;
    buildings?: Array<{ type: string; level: number }>;
    units?: Record<string, number>;
    // Sabotage results
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

class MockDatabase {
  players: Map<string, MockPlayer> = new Map();
  settlements: Map<string, MockSettlement> = new Map();
  heroes: Map<string, MockHero> = new Map();
  marches: Map<string, MockMarch> = new Map();
  alliances: Map<string, MockAlliance> = new Map();
  diplomacy: Map<string, MockDiplomacy> = new Map();
  messages: Map<string, MockMessage> = new Map();
  messagesByChannel: Map<string, string[]> = new Map();
  events: MockEvent[] = [];
  battleReports: Map<string, MockBattleReport> = new Map();
  mapEvents: Map<string, MockMapEvent> = new Map();

  tradeOffers: Map<string, MockTradeOffer> = new Map();

  spyMissions: Map<string, MockSpyMission> = new Map();

  seasonalEvents: Map<string, MockSeasonalEvent> = new Map();
  eventProgress: Map<string, MockEventProgress> = new Map();

  mails: Map<string, MockMail> = new Map();

  worldBosses: Map<string, MockWorldBoss> = new Map();

  heroQuests: Map<string, MockHeroQuest> = new Map();

  // Index helpers
  playersByEmail: Map<string, string> = new Map();
  playersByUsername: Map<string, string> = new Map();
  settlementsByPlayer: Map<string, string[]> = new Map();
  alliancesByTag: Map<string, string> = new Map();

  createPlayer(player: MockPlayer): MockPlayer {
    this.players.set(player.id, player);
    this.playersByEmail.set(player.email, player.id);
    this.playersByUsername.set(player.username, player.id);
    return player;
  }

  getPlayerByEmail(email: string): MockPlayer | undefined {
    const id = this.playersByEmail.get(email);
    return id ? this.players.get(id) : undefined;
  }

  getPlayerByUsername(username: string): MockPlayer | undefined {
    const id = this.playersByUsername.get(username);
    return id ? this.players.get(id) : undefined;
  }

  createSettlement(settlement: MockSettlement): MockSettlement {
    this.settlements.set(settlement.id, settlement);
    const existing = this.settlementsByPlayer.get(settlement.playerId) ?? [];
    existing.push(settlement.id);
    this.settlementsByPlayer.set(settlement.playerId, existing);
    return settlement;
  }

  getSettlementsByPlayer(playerId: string): MockSettlement[] {
    const ids = this.settlementsByPlayer.get(playerId) ?? [];
    return ids.map((id) => this.settlements.get(id)!).filter(Boolean);
  }

  getSettlement(id: string): MockSettlement | undefined {
    return this.settlements.get(id);
  }

  updateSettlement(id: string, update: Partial<MockSettlement>): MockSettlement | undefined {
    const existing = this.settlements.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.settlements.set(id, updated);
    return updated;
  }

  createHero(hero: MockHero): MockHero {
    this.heroes.set(hero.id, hero);
    return hero;
  }

  getHeroesByPlayer(playerId: string): MockHero[] {
    return [...this.heroes.values()].filter((h) => h.playerId === playerId);
  }

  createMarch(march: MockMarch): MockMarch {
    this.marches.set(march.id, march);
    return march;
  }

  getMarchesBySettlement(settlementId: string): MockMarch[] {
    return [...this.marches.values()].filter((m) => m.settlementId === settlementId);
  }

  getMarch(id: string): MockMarch | undefined {
    return this.marches.get(id);
  }

  updateMarch(id: string, update: Partial<MockMarch>): MockMarch | undefined {
    const existing = this.marches.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.marches.set(id, updated);
    return updated;
  }

  deleteMarch(id: string): boolean {
    return this.marches.delete(id);
  }

  // ── Alliance CRUD ──

  createAlliance(alliance: MockAlliance): MockAlliance {
    this.alliances.set(alliance.id, alliance);
    this.alliancesByTag.set(alliance.tag.toLowerCase(), alliance.id);
    return alliance;
  }

  getAlliance(id: string): MockAlliance | undefined {
    return this.alliances.get(id);
  }

  getAllianceByTag(tag: string): MockAlliance | undefined {
    const id = this.alliancesByTag.get(tag.toLowerCase());
    return id ? this.alliances.get(id) : undefined;
  }

  getAllianceByPlayer(playerId: string): MockAlliance | undefined {
    const player = this.players.get(playerId);
    if (!player?.allianceId) return undefined;
    return this.alliances.get(player.allianceId);
  }

  updateAlliance(id: string, update: Partial<MockAlliance>): MockAlliance | undefined {
    const existing = this.alliances.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.alliances.set(id, updated);
    return updated;
  }

  addAllianceMember(allianceId: string, playerId: string, role: 'leader' | 'officer' | 'member'): boolean {
    const alliance = this.alliances.get(allianceId);
    const player = this.players.get(playerId);
    if (!alliance || !player) return false;
    alliance.members.push({ playerId, role, joinedAt: Date.now() });
    player.allianceId = allianceId;
    this.players.set(playerId, player);
    return true;
  }

  removeAllianceMember(allianceId: string, playerId: string): boolean {
    const alliance = this.alliances.get(allianceId);
    const player = this.players.get(playerId);
    if (!alliance || !player) return false;
    alliance.members = alliance.members.filter((m) => m.playerId !== playerId);
    player.allianceId = undefined;
    this.players.set(playerId, player);
    return true;
  }

  deleteAlliance(id: string): boolean {
    const alliance = this.alliances.get(id);
    if (!alliance) return false;
    // Clear allianceId from all members
    for (const member of alliance.members) {
      const player = this.players.get(member.playerId);
      if (player) {
        player.allianceId = undefined;
        this.players.set(member.playerId, player);
      }
    }
    this.alliancesByTag.delete(alliance.tag.toLowerCase());
    this.alliances.delete(id);
    return true;
  }

  // ── Diplomacy CRUD ──

  createDiplomacy(diplomacy: MockDiplomacy): MockDiplomacy {
    this.diplomacy.set(diplomacy.id, diplomacy);
    return diplomacy;
  }

  getDiplomacyByAlliance(allianceId: string): MockDiplomacy[] {
    return [...this.diplomacy.values()].filter(
      (d) => d.fromAllianceId === allianceId || d.toAllianceId === allianceId,
    );
  }

  // ── Message CRUD ──

  addMessage(message: MockMessage): MockMessage {
    this.messages.set(message.id, message);
    const channelKey = `${message.channelType}:${message.channelId}`;
    const ids = this.messagesByChannel.get(channelKey) ?? [];
    ids.push(message.id);
    // Keep last 100 per channel
    if (ids.length > 100) {
      const removed = ids.shift()!;
      this.messages.delete(removed);
    }
    this.messagesByChannel.set(channelKey, ids);
    return message;
  }

  getMessages(channelType: string, channelId: string, limit: number, before?: number): MockMessage[] {
    const channelKey = `${channelType}:${channelId}`;
    const ids = this.messagesByChannel.get(channelKey) ?? [];
    let msgs = ids.map((id) => this.messages.get(id)!).filter(Boolean);
    if (before) {
      msgs = msgs.filter((m) => m.timestamp < before);
    }
    return msgs.slice(-limit);
  }

  // ── Event / Chronicle CRUD ──

  addEvent(event: MockEvent): MockEvent {
    this.events.push(event);
    // Sort descending by timestamp
    this.events.sort((a, b) => b.timestamp - a.timestamp);
    // Keep max 500 per player
    const playerEventCount: Record<string, number> = {};
    this.events = this.events.filter((e) => {
      playerEventCount[e.playerId] = (playerEventCount[e.playerId] ?? 0) + 1;
      return playerEventCount[e.playerId] <= 500;
    });
    return event;
  }

  getEvents(playerId: string, limit: number, offset: number, type?: string): MockEvent[] {
    let filtered = this.events.filter((e) => e.playerId === playerId);
    if (type && type !== 'all') {
      filtered = filtered.filter((e) => e.type === type);
    }
    return filtered.slice(offset, offset + limit);
  }

  // ── Battle Report CRUD ──

  addBattleReport(report: MockBattleReport): MockBattleReport {
    this.battleReports.set(report.id, report);
    return report;
  }

  getReportsByPlayer(playerId: string, limit: number, offset: number): MockBattleReport[] {
    const reports = [...this.battleReports.values()]
      .filter((r) => r.attackerId === playerId || r.defenderId === playerId)
      .sort((a, b) => b.timestamp - a.timestamp);
    return reports.slice(offset, offset + limit);
  }

  getBattleReport(id: string): MockBattleReport | undefined {
    return this.battleReports.get(id);
  }

  // ── Map Event CRUD ──

  addMapEvent(event: MockMapEvent): MockMapEvent {
    this.mapEvents.set(event.id, event);
    return event;
  }

  getActiveMapEvents(): MockMapEvent[] {
    return [...this.mapEvents.values()].filter((e) => e.status === 'active');
  }

  getMapEvent(id: string): MockMapEvent | undefined {
    return this.mapEvents.get(id);
  }

  getMapEventAt(q: number, r: number): MockMapEvent | undefined {
    return [...this.mapEvents.values()].find(
      (e) => e.q === q && e.r === r && e.status === 'active',
    );
  }

  updateMapEvent(id: string, update: Partial<MockMapEvent>): MockMapEvent | undefined {
    const existing = this.mapEvents.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.mapEvents.set(id, updated);
    return updated;
  }

  updateHero(id: string, update: Partial<MockHero>): MockHero | undefined {
    const existing = this.heroes.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.heroes.set(id, updated);
    return updated;
  }

  getHero(id: string): MockHero | undefined {
    return this.heroes.get(id);
  }

  // ── Trade Offer CRUD ──

  createTradeOffer(offer: MockTradeOffer): MockTradeOffer {
    this.tradeOffers.set(offer.id, offer);
    return offer;
  }

  getTradeOffer(id: string): MockTradeOffer | undefined {
    return this.tradeOffers.get(id);
  }

  getOpenTradeOffers(resource?: string): MockTradeOffer[] {
    let offers = [...this.tradeOffers.values()].filter((o) => o.status === 'open');
    if (resource && resource !== 'all') {
      offers = offers.filter((o) => o.offerResource === resource || o.requestResource === resource);
    }
    return offers.sort((a, b) => b.createdAt - a.createdAt);
  }

  getTradeOffersByPlayer(playerId: string, limit: number): MockTradeOffer[] {
    return [...this.tradeOffers.values()]
      .filter((o) => o.sellerId === playerId || o.completedBy === playerId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  updateTradeOffer(id: string, update: Partial<MockTradeOffer>): MockTradeOffer | undefined {
    const existing = this.tradeOffers.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.tradeOffers.set(id, updated);
    return updated;
  }

  // ── Spy Mission CRUD ──

  createSpyMission(mission: MockSpyMission): MockSpyMission {
    this.spyMissions.set(mission.id, mission);
    return mission;
  }

  getSpyMission(id: string): MockSpyMission | undefined {
    return this.spyMissions.get(id);
  }

  getSpyMissionsByPlayer(playerId: string): MockSpyMission[] {
    return [...this.spyMissions.values()]
      .filter((m) => m.playerId === playerId)
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  updateSpyMission(id: string, update: Partial<MockSpyMission>): MockSpyMission | undefined {
    const existing = this.spyMissions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.spyMissions.set(id, updated);
    return updated;
  }

  // ── Seasonal Event CRUD ──

  createSeasonalEvent(event: MockSeasonalEvent): MockSeasonalEvent {
    this.seasonalEvents.set(event.id, event);
    return event;
  }

  getSeasonalEvent(id: string): MockSeasonalEvent | undefined {
    return this.seasonalEvents.get(id);
  }

  getActiveSeasonalEvent(): MockSeasonalEvent | undefined {
    return [...this.seasonalEvents.values()].find((e) => e.status === 'active');
  }

  getSeasonalEventHistory(limit: number): MockSeasonalEvent[] {
    return [...this.seasonalEvents.values()]
      .filter((e) => e.status !== 'active')
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  updateSeasonalEvent(id: string, update: Partial<MockSeasonalEvent>): MockSeasonalEvent | undefined {
    const existing = this.seasonalEvents.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.seasonalEvents.set(id, updated);
    return updated;
  }

  // ── Event Progress CRUD ──

  createEventProgress(progress: MockEventProgress): MockEventProgress {
    this.eventProgress.set(progress.id, progress);
    return progress;
  }

  getEventProgress(id: string): MockEventProgress | undefined {
    return this.eventProgress.get(id);
  }

  getEventProgressByPlayerAndEvent(playerId: string, eventId: string): MockEventProgress | undefined {
    return [...this.eventProgress.values()].find(
      (p) => p.playerId === playerId && p.eventId === eventId,
    );
  }

  getEventProgressByEvent(eventId: string): MockEventProgress[] {
    return [...this.eventProgress.values()].filter((p) => p.eventId === eventId);
  }

  updateEventProgress(id: string, update: Partial<MockEventProgress>): MockEventProgress | undefined {
    const existing = this.eventProgress.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.eventProgress.set(id, updated);
    return updated;
  }

  // ── World Boss CRUD ──

  createWorldBoss(boss: MockWorldBoss): MockWorldBoss {
    this.worldBosses.set(boss.id, boss);
    return boss;
  }

  getWorldBoss(id: string): MockWorldBoss | undefined {
    return this.worldBosses.get(id);
  }

  getActiveWorldBosses(): MockWorldBoss[] {
    return [...this.worldBosses.values()].filter((b) => b.status === 'active');
  }

  updateWorldBoss(id: string, update: Partial<MockWorldBoss>): MockWorldBoss | undefined {
    const existing = this.worldBosses.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.worldBosses.set(id, updated);
    return updated;
  }

  // ── Mail CRUD ──

  createMail(mail: MockMail): MockMail {
    this.mails.set(mail.id, mail);
    return mail;
  }

  getMail(id: string): MockMail | undefined {
    return this.mails.get(id);
  }

  getMailsForPlayer(playerId: string, limit: number, offset: number, unreadOnly: boolean): { mails: MockMail[]; unreadCount: number; total: number } {
    const allMails = [...this.mails.values()]
      .filter((m) => m.toPlayerId === playerId && !m.deletedByRecipient)
      .sort((a, b) => b.sentAt - a.sentAt);

    const unreadCount = allMails.filter((m) => !m.read).length;

    const filtered = unreadOnly ? allMails.filter((m) => !m.read) : allMails;
    const total = filtered.length;
    const mails = filtered.slice(offset, offset + limit);

    return { mails, unreadCount, total };
  }

  getSentMails(playerId: string, limit: number, offset: number): { mails: MockMail[]; total: number } {
    const allMails = [...this.mails.values()]
      .filter((m) => m.fromPlayerId === playerId && !m.deletedBySender)
      .sort((a, b) => b.sentAt - a.sentAt);

    const total = allMails.length;
    const mails = allMails.slice(offset, offset + limit);

    return { mails, total };
  }

  updateMail(id: string, update: Partial<MockMail>): MockMail | undefined {
    const existing = this.mails.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.mails.set(id, updated);
    return updated;
  }

  // ── Hero Quest CRUD ──

  createHeroQuest(quest: MockHeroQuest): MockHeroQuest {
    this.heroQuests.set(quest.id, quest);
    return quest;
  }

  getHeroQuest(id: string): MockHeroQuest | undefined {
    return this.heroQuests.get(id);
  }

  getActiveHeroQuestsByPlayer(playerId: string): MockHeroQuest[] {
    return [...this.heroQuests.values()].filter(
      (q) => q.playerId === playerId && q.status === 'active',
    );
  }

  getHeroQuestsByPlayer(playerId: string, limit: number): MockHeroQuest[] {
    return [...this.heroQuests.values()]
      .filter((q) => q.playerId === playerId && q.status !== 'active')
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  getActiveHeroQuestByHero(heroId: string): MockHeroQuest | undefined {
    return [...this.heroQuests.values()].find(
      (q) => q.heroId === heroId && q.status === 'active',
    );
  }

  getCompletedHeroQuests(): MockHeroQuest[] {
    return [...this.heroQuests.values()].filter((q) => q.status === 'active');
  }

  updateHeroQuest(id: string, update: Partial<MockHeroQuest>): MockHeroQuest | undefined {
    const existing = this.heroQuests.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.heroQuests.set(id, updated);
    return updated;
  }
}

export const mockDb = new MockDatabase();
