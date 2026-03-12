import type { FastifyInstance } from 'fastify';
import { mockDb } from '../db/mock-db.js';

// ---------------------------------------------------------------------------
// Score computation helpers
// ---------------------------------------------------------------------------

interface PlayerScore {
  playerId: string;
  username: string;
  faction: string;
  power: number;
  settlements: number;
  military: number;
  buildings: number;
  totalResources: number;
  research: number;
}

function computePlayerScores(): PlayerScore[] {
  const scores: PlayerScore[] = [];

  for (const [playerId, player] of mockDb.players) {
    const settlementIds = mockDb.settlementsByPlayer.get(playerId) ?? [];
    const settlements = settlementIds
      .map((id) => mockDb.settlements.get(id))
      .filter(Boolean);

    let totalBuildingLevels = 0;
    let totalResearchLevels = 0;
    let totalBuildings = 0;
    let totalUnits = 0;
    let totalResources = 0;

    for (const s of settlements) {
      if (!s) continue;
      totalBuildings += s.buildings.length;

      for (const b of s.buildings) totalBuildingLevels += b.level;
      for (const level of Object.values(s.researched)) totalResearchLevels += (level as number);

      for (const count of Object.values(s.units)) {
        totalUnits += count;
      }

      for (const amount of Object.values(s.resources)) {
        totalResources += amount;
      }
    }

    // Add hero levels
    const heroes = mockDb.getHeroesByPlayer ? mockDb.getHeroesByPlayer(playerId) : [];
    const heroLevelsSum = heroes.reduce((sum: number, h: any) => sum + h.level, 0);

    const power =
      totalBuildingLevels * 80 +
      totalUnits * 12 +
      totalResearchLevels * 60 +
      Math.floor(totalResources / 150) +
      heroLevelsSum * 20;

    scores.push({
      playerId,
      username: player.username,
      faction: player.faction,
      power,
      settlements: settlements.length,
      military: totalUnits,
      buildings: totalBuildings,
      totalResources,
      research: totalResearchLevels,
    });
  }

  return scores;
}

type RankingType = 'power' | 'settlements' | 'military' | 'buildings' | 'research';

function scoreForType(entry: PlayerScore, type: RankingType): number {
  switch (type) {
    case 'power':
      return entry.power;
    case 'settlements':
      return entry.settlements;
    case 'military':
      return entry.military;
    case 'buildings':
      return entry.buildings;
    case 'research':
      return entry.research;
  }
}

function rankByType(scores: PlayerScore[], type: RankingType) {
  return [...scores].sort((a, b) => scoreForType(b, type) - scoreForType(a, type));
}

function detailsForEntry(entry: PlayerScore) {
  return {
    power: entry.power,
    settlements: entry.settlements,
    military: entry.military,
    buildings: entry.buildings,
    totalResources: entry.totalResources,
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function leaderboardRoutes(app: FastifyInstance) {
  // All routes require a valid JWT
  app.addHook('onRequest', async (request) => {
    await request.jwtVerify();
  });

  // -----------------------------------------------------------------------
  // GET /rankings
  // -----------------------------------------------------------------------
  app.get('/rankings', async (request) => {
    const query = request.query as { type?: string; limit?: string };
    const type: RankingType =
      query.type && ['power', 'settlements', 'military', 'buildings', 'research'].includes(query.type)
        ? (query.type as RankingType)
        : 'power';

    const limit = Math.min(Math.max(parseInt(query.limit ?? '20', 10) || 20, 1), 100);

    const scores = computePlayerScores();
    const sorted = rankByType(scores, type);

    const rankings = sorted.slice(0, limit).map((entry, index) => ({
      rank: index + 1,
      playerId: entry.playerId,
      username: entry.username,
      faction: entry.faction,
      score: scoreForType(entry, type),
      details: detailsForEntry(entry),
    }));

    return { rankings };
  });

  // -----------------------------------------------------------------------
  // GET /me
  // -----------------------------------------------------------------------
  app.get('/me', async (request) => {
    const playerId = request.user.id;

    const scores = computePlayerScores();
    const playerEntry = scores.find((s) => s.playerId === playerId);

    if (!playerEntry) {
      return {
        power: { rank: 0, score: 0 },
        military: { rank: 0, score: 0 },
        buildings: { rank: 0, score: 0 },
      };
    }

    function rankFor(type: RankingType) {
      const sorted = rankByType(scores, type);
      const rank = sorted.findIndex((s) => s.playerId === playerId) + 1;
      return { rank, score: scoreForType(playerEntry!, type) };
    }

    return {
      power: rankFor('power'),
      military: rankFor('military'),
      buildings: rankFor('buildings'),
    };
  });

  // -----------------------------------------------------------------------
  // GET /alliance-rankings
  // -----------------------------------------------------------------------
  app.get('/alliance-rankings', async () => {
    const playerScores = computePlayerScores();
    const powerByPlayer = new Map<string, number>();
    for (const entry of playerScores) {
      powerByPlayer.set(entry.playerId, entry.power);
    }

    const allianceRankings: Array<{
      allianceId: string;
      name: string;
      tag: string;
      memberCount: number;
      totalPower: number;
    }> = [];

    for (const [allianceId, alliance] of mockDb.alliances) {
      let totalPower = 0;
      for (const member of alliance.members) {
        totalPower += powerByPlayer.get(member.playerId) ?? 0;
      }

      allianceRankings.push({
        allianceId,
        name: alliance.name,
        tag: alliance.tag,
        memberCount: alliance.members.length,
        totalPower,
      });
    }

    allianceRankings.sort((a, b) => b.totalPower - a.totalPower);

    const rankings = allianceRankings.map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));

    return { rankings };
  });
}
