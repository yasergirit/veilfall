import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import { pushNotification } from './notifications.js';

// ─── Quest Type Definitions ───

export interface QuestObjective {
  type: 'build' | 'upgrade' | 'train' | 'gather' | 'research' | 'march' | 'scout' | 'total_units' | 'total_buildings' | 'tc_level';
  target?: string;     // building type, unit type, resource type, etc.
  amount: number;      // target amount (1 for build, N for gather/train)
}

export interface QuestReward {
  resources?: Record<string, number>;
  xp?: number;         // hero XP distributed to first idle hero
}

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  narrator: string;
  category: 'story' | 'daily' | 'milestone';
  objective: QuestObjective;
  reward: QuestReward;
  order?: number;       // for story quests: sequential order
  storyPhase?: number;  // story phase grouping
}

export interface PlayerQuest {
  id: string;
  playerId: string;
  questDefId: string;
  category: 'story' | 'daily' | 'milestone';
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  generatedAt: number;
  completedAt?: number;
}

// ─── Story Quests (Main Progression) ───

const STORY_QUESTS: QuestDefinition[] = [
  {
    id: 'story_1', title: 'A Full Stomach', order: 1, storyPhase: 1,
    description: 'We\'ve been living off scavenged food. Build a Gathering Post — an empire starts with a full stomach.',
    narrator: 'Sera', category: 'story',
    objective: { type: 'build', target: 'gathering_post', amount: 1 },
    reward: { resources: { food: 100, wood: 50 } },
  },
  {
    id: 'story_2', title: 'Walls of Hope', order: 2, storyPhase: 1,
    description: 'Scavengers have been seen nearby. We need protection before they find our Aether Stone.',
    narrator: 'Sera', category: 'story',
    objective: { type: 'build', target: 'palisade_wall', amount: 1 },
    reward: { resources: { wood: 100, stone: 80 } },
  },
  {
    id: 'story_3', title: 'Timber and Stone', order: 3, storyPhase: 1,
    description: 'The settlement grows, but we need more materials. Establish a proper wood supply.',
    narrator: 'Sera', category: 'story',
    objective: { type: 'build', target: 'woodcutter_lodge', amount: 1 },
    reward: { resources: { food: 80, wood: 120 } },
  },
  {
    id: 'story_4', title: 'Strengthen the Core', order: 4, storyPhase: 2,
    description: 'We\'ve outgrown these makeshift walls. Upgrade the Town Center — it\'s time to build something real.',
    narrator: 'Sera', category: 'story',
    objective: { type: 'tc_level', amount: 2 },
    reward: { resources: { food: 200, wood: 200, stone: 150 } },
  },
  {
    id: 'story_5', title: 'Deep Foundations', order: 5, storyPhase: 2,
    description: 'Stone. We need stone for proper walls, proper buildings. The quarry to the north has deposits.',
    narrator: 'Sera', category: 'story',
    objective: { type: 'build', target: 'stone_quarry', amount: 1 },
    reward: { resources: { stone: 150, iron: 50 } },
  },
  {
    id: 'story_6', title: 'Iron Will', order: 6, storyPhase: 2,
    description: 'For weapons and armor, we need iron. There are veins beneath us — Elder Maren mentioned them in her letter.',
    narrator: 'Sera', category: 'story',
    objective: { type: 'build', target: 'iron_mine', amount: 1 },
    reward: { resources: { iron: 150, food: 100 } },
  },
  {
    id: 'story_7', title: 'Idle Hands', order: 7, storyPhase: 2,
    description: 'We need soldiers. Not many — just enough to make the scavengers think twice.',
    narrator: 'Sera', category: 'story',
    objective: { type: 'build', target: 'militia_barracks', amount: 1 },
    reward: { resources: { food: 150, wood: 100, iron: 80 } },
  },
  {
    id: 'story_8', title: 'First Swords', order: 8, storyPhase: 2,
    description: 'A barracks without soldiers is just an empty hall. Train your first militia — five should do for now.',
    narrator: 'Sera', category: 'story',
    objective: { type: 'train', target: 'militia', amount: 5 },
    reward: { resources: { food: 200, iron: 100 } },
  },
  {
    id: 'story_9', title: 'Eyes on the Horizon', order: 9, storyPhase: 3,
    description: 'We\'re blind out there. Build a Scout Tower and we can see what\'s coming before it arrives.',
    narrator: 'Sera', category: 'story',
    objective: { type: 'build', target: 'scout_tower', amount: 1 },
    reward: { resources: { wood: 150, stone: 100 } },
  },
  {
    id: 'story_10', title: 'The Blue Glow', order: 10, storyPhase: 3,
    description: 'See those crystals growing from the earth? That\'s Aether Stone. Everyone\'s fighting over it. We should harvest some.',
    narrator: 'Sera', category: 'story',
    objective: { type: 'build', target: 'aether_extractor', amount: 1 },
    reward: { resources: { aether_stone: 50, iron: 100 } },
  },
  {
    id: 'story_11', title: 'The Stranger\'s Oath', order: 11, storyPhase: 3,
    description: 'A wanderer approaches your gates — tired, armed, scarred. They say they\'ve been looking for a Bloodline Seat. Are you the heir?',
    narrator: '???', category: 'story',
    objective: { type: 'build', target: 'hero_hall', amount: 1 },
    reward: { resources: { food: 200, wood: 200, stone: 150 }, xp: 100 },
  },
  {
    id: 'story_12', title: 'Knowledge is Power', order: 12, storyPhase: 3,
    description: 'Research the basics — Agriculture will feed your growing settlement more efficiently.',
    narrator: 'Sera', category: 'story',
    objective: { type: 'research', target: 'agriculture', amount: 1 },
    reward: { resources: { food: 300, wood: 150 } },
  },
  {
    id: 'story_13', title: 'The Heart of Command', order: 13, storyPhase: 4,
    description: 'Your settlement thrives. Upgrade the Town Center to level 3 — it\'s time to unlock the deeper secrets of this land.',
    narrator: 'Sera', category: 'story',
    objective: { type: 'tc_level', amount: 3 },
    reward: { resources: { food: 500, wood: 500, stone: 300, iron: 200, aether_stone: 50 } },
  },
  {
    id: 'story_14', title: 'A Standing Army', order: 14, storyPhase: 4,
    description: 'Twenty soldiers. That\'s what we need to be taken seriously. Train militia, archers — whatever you can muster.',
    narrator: 'Sera', category: 'story',
    objective: { type: 'total_units', amount: 20 },
    reward: { resources: { food: 400, iron: 200 }, xp: 150 },
  },
  {
    id: 'story_15', title: 'The Elder\'s Secret', order: 15, storyPhase: 4,
    description: 'The walls are strong. Dig beneath the town center — Elder Maren said there was something hidden below. Something from the old world...',
    narrator: 'Sera', category: 'story',
    objective: { type: 'tc_level', amount: 4 },
    reward: { resources: { food: 1000, wood: 1000, stone: 500, iron: 300, aether_stone: 100 }, xp: 300 },
  },
];

// ─── Milestone Quests (Achievements) ───

const MILESTONE_QUESTS: QuestDefinition[] = [
  {
    id: 'mile_build_5', title: 'Fledgling Town', category: 'milestone',
    description: 'Build 5 different buildings in your settlement.',
    narrator: 'Achievement', objective: { type: 'total_buildings', amount: 5 },
    reward: { resources: { food: 200, wood: 200 } },
  },
  {
    id: 'mile_build_10', title: 'Growing Settlement', category: 'milestone',
    description: 'Build 10 different buildings in your settlement.',
    narrator: 'Achievement', objective: { type: 'total_buildings', amount: 10 },
    reward: { resources: { food: 500, wood: 500, stone: 300 } },
  },
  {
    id: 'mile_army_10', title: 'Small Warband', category: 'milestone',
    description: 'Have 10 units garrisoned in your settlement.',
    narrator: 'Achievement', objective: { type: 'total_units', amount: 10 },
    reward: { resources: { food: 200, iron: 100 } },
  },
  {
    id: 'mile_army_50', title: 'Standing Army', category: 'milestone',
    description: 'Have 50 units garrisoned in your settlement.',
    narrator: 'Achievement', objective: { type: 'total_units', amount: 50 },
    reward: { resources: { food: 500, iron: 300, aether_stone: 30 } },
  },
  {
    id: 'mile_army_100', title: 'Military Power', category: 'milestone',
    description: 'Have 100 units garrisoned in your settlement.',
    narrator: 'Achievement', objective: { type: 'total_units', amount: 100 },
    reward: { resources: { food: 1000, iron: 500, aether_stone: 80 }, xp: 200 },
  },
  {
    id: 'mile_gather_5k', title: 'Resourceful', category: 'milestone',
    description: 'Accumulate 5,000 total resources.',
    narrator: 'Achievement', objective: { type: 'gather', amount: 5000 },
    reward: { resources: { food: 300, wood: 300 } },
  },
  {
    id: 'mile_gather_25k', title: 'Prosperous', category: 'milestone',
    description: 'Accumulate 25,000 total resources.',
    narrator: 'Achievement', objective: { type: 'gather', amount: 25000 },
    reward: { resources: { food: 800, wood: 800, stone: 500, iron: 300 } },
  },
  {
    id: 'mile_gather_100k', title: 'Overflowing Coffers', category: 'milestone',
    description: 'Accumulate 100,000 total resources.',
    narrator: 'Achievement', objective: { type: 'gather', amount: 100000 },
    reward: { resources: { food: 2000, wood: 2000, stone: 1000, iron: 500, aether_stone: 200 }, xp: 500 },
  },
  {
    id: 'mile_tc3', title: 'Established Power', category: 'milestone',
    description: 'Upgrade Town Center to level 3.',
    narrator: 'Achievement', objective: { type: 'tc_level', amount: 3 },
    reward: { resources: { aether_stone: 50, iron: 200 } },
  },
  {
    id: 'mile_tc5', title: 'Capital City', category: 'milestone',
    description: 'Upgrade Town Center to level 5.',
    narrator: 'Achievement', objective: { type: 'tc_level', amount: 5 },
    reward: { resources: { food: 3000, wood: 3000, stone: 2000, iron: 1000, aether_stone: 500 }, xp: 1000 },
  },
  {
    id: 'mile_march_1', title: 'First March', category: 'milestone',
    description: 'Send your first army march.',
    narrator: 'Achievement', objective: { type: 'march', amount: 1 },
    reward: { resources: { food: 150, iron: 80 }, xp: 50 },
  },
  {
    id: 'mile_scout_1', title: 'Explorer', category: 'milestone',
    description: 'Send your first scout mission.',
    narrator: 'Achievement', objective: { type: 'scout', amount: 1 },
    reward: { resources: { wood: 150, stone: 100 } },
  },
  {
    id: 'mile_research_3', title: 'Scholar', category: 'milestone',
    description: 'Complete 3 different researches.',
    narrator: 'Achievement', objective: { type: 'research', amount: 3 },
    reward: { resources: { aether_stone: 30, iron: 150 }, xp: 100 },
  },
];

// ─── Daily Quest Generation Algorithm ───

interface DailyQuestTemplate {
  type: QuestObjective['type'];
  titleFn: (target: string, amount: number) => string;
  descFn: (target: string, amount: number) => string;
  targets: string[];
  amountRange: [number, number];
  rewardScale: number; // multiplier for reward calculation
  requires?: string;   // building required in settlement
}

const DAILY_TEMPLATES: DailyQuestTemplate[] = [
  {
    type: 'gather',
    titleFn: (t, a) => `Gather ${a} ${t}`,
    descFn: (t, a) => `Stockpile ${a} ${t} for the settlement. Every resource counts in these uncertain times.`,
    targets: ['food', 'wood', 'stone', 'iron'],
    amountRange: [200, 800],
    rewardScale: 0.3,
  },
  {
    type: 'gather',
    titleFn: (_, a) => `Harvest ${a} Aether Stone`,
    descFn: (_, a) => `The Veil's energy is valuable. Collect ${a} aether stone before others claim it.`,
    targets: ['aether_stone'],
    amountRange: [20, 80],
    rewardScale: 1.5,
    requires: 'aether_extractor',
  },
  {
    type: 'train',
    titleFn: (t, a) => `Train ${a} ${t}`,
    descFn: (t, a) => `Strengthen your forces. Train ${a} ${t} to bolster your defenses.`,
    targets: ['militia', 'archer', 'shieldbearer'],
    amountRange: [3, 12],
    rewardScale: 2.0,
    requires: 'militia_barracks',
  },
  {
    type: 'train',
    titleFn: (_, a) => `Train ${a} Scouts`,
    descFn: (_, a) => `Knowledge is power. Train ${a} scouts to expand your vision.`,
    targets: ['scout'],
    amountRange: [3, 8],
    rewardScale: 1.5,
    requires: 'scout_tower',
  },
  {
    type: 'upgrade',
    titleFn: () => 'Improve Your Settlement',
    descFn: () => 'Upgrade any building to strengthen your settlement. Growth must never stall.',
    targets: ['any'],
    amountRange: [1, 1],
    rewardScale: 3.0,
  },
  {
    type: 'research',
    titleFn: () => 'Advance Knowledge',
    descFn: () => 'Complete a research project. The secrets of the old world await.',
    targets: ['any'],
    amountRange: [1, 1],
    rewardScale: 3.5,
    requires: 'academy',
  },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function getDaySeed(playerId: string): number {
  const dayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let hash = 0;
  const combined = playerId + dayStr;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generateDailyQuests(playerId: string): QuestDefinition[] {
  const settlements = mockDb.getSettlementsByPlayer(playerId);
  if (settlements.length === 0) return [];
  const settlement = settlements[0];
  const buildingTypes = new Set(settlement.buildings.map(b => b.type));
  const tcLevel = settlement.buildings.find(b => b.type === 'town_center')?.level ?? 1;

  // Filter templates to ones the player can actually do
  const eligible = DAILY_TEMPLATES.filter(t => {
    if (t.requires && !buildingTypes.has(t.requires)) return false;
    return true;
  });

  if (eligible.length === 0) return [];

  // Use seeded random for daily consistency (same quests all day for same player)
  const seed = getDaySeed(playerId);
  const rng = seededRandom(seed);

  const selected: QuestDefinition[] = [];
  const usedTypes = new Set<string>();

  // Pick 3 unique daily quests
  const shuffled = [...eligible].sort(() => rng() - 0.5);

  for (const template of shuffled) {
    if (selected.length >= 3) break;

    // Avoid duplicate quest types in same daily set
    const key = `${template.type}_${template.targets.join(',')}`;
    if (usedTypes.has(key)) continue;
    usedTypes.add(key);

    const target = template.targets[Math.floor(rng() * template.targets.length)];

    // Scale amount based on TC level (higher TC = harder daily quests = better rewards)
    const scaleFactor = 1 + (tcLevel - 1) * 0.4;
    const baseAmount = template.amountRange[0] + Math.floor(rng() * (template.amountRange[1] - template.amountRange[0]));
    const amount = Math.round(baseAmount * scaleFactor);

    // Calculate reward based on amount and scale
    const rewardValue = Math.round(amount * template.rewardScale * scaleFactor);
    const reward: QuestReward = { resources: {} };

    // Distribute rewards across resource types
    if (template.type === 'gather' && target !== 'aether_stone') {
      // Don't reward the same resource they're gathering
      const otherRes = ['food', 'wood', 'stone', 'iron'].filter(r => r !== target);
      const pick = otherRes[Math.floor(rng() * otherRes.length)];
      reward.resources = { [pick]: rewardValue };
    } else if (template.type === 'train') {
      reward.resources = { food: Math.round(rewardValue * 0.6), iron: Math.round(rewardValue * 0.4) };
    } else if (template.type === 'gather' && target === 'aether_stone') {
      reward.resources = { food: Math.round(rewardValue * 0.5), iron: Math.round(rewardValue * 0.5) };
    } else {
      // Build/upgrade/research
      reward.resources = {
        food: Math.round(rewardValue * 0.3),
        wood: Math.round(rewardValue * 0.3),
        stone: Math.round(rewardValue * 0.2),
        iron: Math.round(rewardValue * 0.2),
      };
    }

    // Add XP reward for harder quests
    if (tcLevel >= 3) {
      reward.xp = Math.round(rewardValue * 0.3);
    }

    selected.push({
      id: `daily_${selected.length}_${new Date().toISOString().slice(0, 10)}`,
      title: template.titleFn(target, amount),
      description: template.descFn(target, amount),
      narrator: 'Daily',
      category: 'daily',
      objective: { type: template.type, target, amount },
      reward,
    });
  }

  return selected;
}

// ─── Quest Progress Evaluation ───

function evaluateQuestProgress(quest: PlayerQuest, playerId: string): number {
  const settlements = mockDb.getSettlementsByPlayer(playerId);
  if (settlements.length === 0) return 0;
  const settlement = settlements[0];

  const def = getAllQuestDefs().find(d => d.id === quest.questDefId);
  if (!def) return 0;

  const obj = def.objective;

  switch (obj.type) {
    case 'build':
      return settlement.buildings.some(b => b.type === obj.target) ? 1 : 0;

    case 'upgrade':
      // Count total upgrade levels across all buildings
      return settlement.buildings.reduce((sum, b) => sum + Math.max(0, b.level - 1), 0);

    case 'tc_level':
      return settlement.buildings.find(b => b.type === 'town_center')?.level ?? 1;

    case 'total_buildings':
      return settlement.buildings.length;

    case 'total_units':
      return Object.values(settlement.units).reduce((sum, n) => sum + n, 0);

    case 'gather': {
      if (obj.target === 'aether_stone') {
        return Math.floor(settlement.resources['aether_stone'] ?? 0);
      }
      if (obj.target && obj.target !== 'any') {
        return Math.floor(settlement.resources[obj.target] ?? 0);
      }
      // Total resources
      return Math.floor(Object.values(settlement.resources).reduce((sum, n) => sum + n, 0));
    }

    case 'train':
      // Tracked incrementally via game loop, use quest.progress
      return quest.progress;

    case 'research': {
      if (obj.target === 'any' || !obj.target) {
        return Object.keys(settlement.researched).length;
      }
      return settlement.researched[obj.target] ?? 0;
    }

    case 'march':
      return quest.progress;

    case 'scout':
      return quest.progress;

    default:
      return quest.progress;
  }
}

function getAllQuestDefs(): QuestDefinition[] {
  return [...STORY_QUESTS, ...MILESTONE_QUESTS];
}

// ─── Routes ───

export async function questRoutes(app: FastifyInstance) {

  // GET /quests — returns all quest state for current player
  app.get('/', { preHandler: [requireAuth()] }, async (request) => {
    const playerId = request.user.id;

    // Ensure story + milestone quests exist for this player
    initPlayerQuests(playerId);

    // Generate/refresh daily quests
    refreshDailyQuests(playerId);

    // Evaluate all quest progress
    const quests = getPlayerQuests(playerId);
    for (const q of quests) {
      if (q.completed || q.claimed) continue;
      const progress = evaluateQuestProgress(q, playerId);
      q.progress = progress;
      if (progress >= q.target) {
        q.completed = true;
        q.completedAt = Date.now();
      }
    }

    // Build response with definitions
    const allDefs = [...getAllQuestDefs(), ...generateDailyQuests(playerId)];
    const defMap = new Map(allDefs.map(d => [d.id, d]));

    const result = quests.map(q => {
      const def = defMap.get(q.questDefId);
      return {
        id: q.id,
        questDefId: q.questDefId,
        category: q.category,
        title: def?.title ?? 'Unknown',
        description: def?.description ?? '',
        narrator: def?.narrator ?? '',
        objective: def?.objective,
        reward: def?.reward,
        progress: q.progress,
        target: q.target,
        completed: q.completed,
        claimed: q.claimed,
        order: def?.order,
      };
    });

    // Sort: story by order, milestones by id, daily last
    const story = result.filter(q => q.category === 'story').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const milestones = result.filter(q => q.category === 'milestone');
    const daily = result.filter(q => q.category === 'daily');

    return { story, daily, milestones };
  });

  // POST /quests/:questId/claim — claim reward for completed quest
  app.post('/:questId/claim', { preHandler: [requireAuth()] }, async (request, reply) => {
    const playerId = request.user.id;
    const { questId } = request.params as { questId: string };

    const quests = getPlayerQuests(playerId);
    const quest = quests.find(q => q.id === questId);
    if (!quest) return reply.status(404).send({ error: 'Quest not found' });
    if (!quest.completed) return reply.status(400).send({ error: 'Quest not completed yet' });
    if (quest.claimed) return reply.status(400).send({ error: 'Quest already claimed' });

    const allDefs = [...getAllQuestDefs(), ...generateDailyQuests(playerId)];
    const def = allDefs.find(d => d.id === quest.questDefId);
    if (!def) return reply.status(404).send({ error: 'Quest definition not found' });

    // Grant rewards
    const settlements = mockDb.getSettlementsByPlayer(playerId);
    if (settlements.length > 0 && def.reward.resources) {
      const settlement = settlements[0];
      for (const [res, amount] of Object.entries(def.reward.resources)) {
        settlement.resources[res] = (settlement.resources[res] ?? 0) + amount;
      }
      mockDb.updateSettlement(settlement.id, { resources: settlement.resources });
    }

    // Grant XP to first idle hero
    if (def.reward.xp) {
      const heroes = mockDb.getHeroesByPlayer(playerId);
      const hero = heroes.find(h => h.status === 'idle');
      if (hero) {
        hero.xp += def.reward.xp;
        while (hero.xp >= hero.level * 100) {
          hero.xp -= hero.level * 100;
          hero.level += 1;
          const statKeys: Array<keyof typeof hero.stats> = ['strength', 'intellect', 'agility', 'endurance'];
          const randomStat = statKeys[Math.floor(Math.random() * statKeys.length)];
          hero.stats[randomStat] += 1;
        }
        mockDb.updateHero(hero.id, { xp: hero.xp, level: hero.level, stats: hero.stats });
      }
    }

    quest.claimed = true;

    pushNotification(playerId, {
      type: 'system',
      title: `Quest Reward: ${def.title}`,
      message: `Claimed rewards for "${def.title}"!`,
    });

    return { message: 'Reward claimed', reward: def.reward };
  });
}

// ─── Quest State Management (in-memory, keyed by playerId) ───

const playerQuestStore = new Map<string, PlayerQuest[]>();

function getPlayerQuests(playerId: string): PlayerQuest[] {
  return playerQuestStore.get(playerId) ?? [];
}

function initPlayerQuests(playerId: string) {
  if (playerQuestStore.has(playerId)) return;

  const quests: PlayerQuest[] = [];

  // Initialize story quests
  for (const def of STORY_QUESTS) {
    quests.push({
      id: `${playerId}_${def.id}`,
      playerId,
      questDefId: def.id,
      category: 'story',
      progress: 0,
      target: def.objective.amount,
      completed: false,
      claimed: false,
      generatedAt: Date.now(),
    });
  }

  // Initialize milestone quests
  for (const def of MILESTONE_QUESTS) {
    quests.push({
      id: `${playerId}_${def.id}`,
      playerId,
      questDefId: def.id,
      category: 'milestone',
      progress: 0,
      target: def.objective.amount,
      completed: false,
      claimed: false,
      generatedAt: Date.now(),
    });
  }

  playerQuestStore.set(playerId, quests);
}

function refreshDailyQuests(playerId: string) {
  const quests = playerQuestStore.get(playerId);
  if (!quests) return;

  const today = new Date().toISOString().slice(0, 10);

  // Check if daily quests are from today
  const existingDaily = quests.filter(q => q.category === 'daily');
  const needsRefresh = existingDaily.length === 0 ||
    existingDaily.some(q => new Date(q.generatedAt).toISOString().slice(0, 10) !== today);

  if (!needsRefresh) return;

  // Remove old dailies
  const filtered = quests.filter(q => q.category !== 'daily');

  // Generate new dailies
  const dailyDefs = generateDailyQuests(playerId);
  for (const def of dailyDefs) {
    filtered.push({
      id: `${playerId}_${def.id}`,
      playerId,
      questDefId: def.id,
      category: 'daily',
      progress: 0,
      target: def.objective.amount,
      completed: false,
      claimed: false,
      generatedAt: Date.now(),
    });
  }

  playerQuestStore.set(playerId, filtered);
}

// ─── Exported helpers for game loop integration ───

export function incrementQuestProgress(playerId: string, type: QuestObjective['type'], target: string, amount: number) {
  const quests = playerQuestStore.get(playerId);
  if (!quests) return;

  const allDefs = [...getAllQuestDefs(), ...generateDailyQuests(playerId)];
  const defMap = new Map(allDefs.map(d => [d.id, d]));

  for (const quest of quests) {
    if (quest.completed || quest.claimed) continue;
    const def = defMap.get(quest.questDefId);
    if (!def) continue;

    // Only increment for event-tracked types (train, march, scout)
    if (def.objective.type !== type) continue;
    if (def.objective.target && def.objective.target !== 'any' && def.objective.target !== target) continue;

    quest.progress += amount;
    if (quest.progress >= quest.target) {
      quest.completed = true;
      quest.completedAt = Date.now();
    }
  }
}

export { STORY_QUESTS, MILESTONE_QUESTS };
