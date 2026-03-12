import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import { z } from 'zod';

const createAllianceSchema = z.object({
  name: z.string().min(3).max(30),
  tag: z.string().min(2).max(5),
  description: z.string().max(500).default(''),
  banner: z.object({
    primaryColor: z.string(),
    secondaryColor: z.string(),
    icon: z.string(),
  }),
});

const kickSchema = z.object({
  playerId: z.string(),
});

const promoteSchema = z.object({
  playerId: z.string(),
  role: z.enum(['officer', 'member']),
});

const diplomacySchema = z.object({
  targetAllianceId: z.string(),
  type: z.enum(['alliance', 'nap', 'war']),
});

export async function allianceRoutes(app: FastifyInstance) {
  // Create alliance
  app.post('/create', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const body = createAllianceSchema.parse(request.body);

    const existingPlayer = mockDb.players.get(player.id);
    if (!existingPlayer) return reply.status(404).send({ error: 'Player not found' });
    if (existingPlayer.allianceId) return reply.status(400).send({ error: 'Already in an alliance' });

    if (mockDb.getAllianceByTag(body.tag)) {
      return reply.status(400).send({ error: 'Alliance tag already taken' });
    }

    const alliance = mockDb.createAlliance({
      id: crypto.randomUUID(),
      name: body.name,
      tag: body.tag,
      description: body.description,
      leaderId: player.id,
      members: [{ playerId: player.id, role: 'leader', joinedAt: Date.now() }],
      createdAt: Date.now(),
      banner: body.banner,
    });

    existingPlayer.allianceId = alliance.id;
    mockDb.players.set(player.id, existingPlayer);

    return { message: 'Alliance created', alliance };
  });

  // Get player's alliance
  app.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const alliance = mockDb.getAllianceByPlayer(player.id);
    if (!alliance) return reply.status(404).send({ error: 'Not in an alliance' });

    const members = alliance.members.map((m) => {
      const p = mockDb.players.get(m.playerId);
      return {
        playerId: m.playerId,
        username: p?.username ?? 'Unknown',
        faction: p?.faction,
        role: m.role,
        joinedAt: m.joinedAt,
      };
    });

    return { alliance: { ...alliance, members } };
  });

  // Search alliances
  app.get('/search', { preHandler: requireAuth }, async (request) => {
    const { q } = request.query as { q?: string };
    const term = (q ?? '').toLowerCase();

    const results = [...mockDb.alliances.values()]
      .filter((a) => a.name.toLowerCase().includes(term) || a.tag.toLowerCase().includes(term))
      .slice(0, 20)
      .map((a) => ({
        id: a.id,
        name: a.name,
        tag: a.tag,
        description: a.description,
        memberCount: a.members.length,
        banner: a.banner,
      }));

    return { alliances: results };
  });

  // Get alliance details (public)
  app.get('/:allianceId', { preHandler: requireAuth }, async (request, reply) => {
    const { allianceId } = request.params as { allianceId: string };
    const alliance = mockDb.getAlliance(allianceId);
    if (!alliance) return reply.status(404).send({ error: 'Alliance not found' });

    const members = alliance.members.map((m) => {
      const p = mockDb.players.get(m.playerId);
      return {
        playerId: m.playerId,
        username: p?.username ?? 'Unknown',
        faction: p?.faction,
        role: m.role,
        joinedAt: m.joinedAt,
      };
    });

    return { alliance: { ...alliance, members } };
  });

  // Join alliance
  app.post('/:allianceId/join', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { allianceId } = request.params as { allianceId: string };

    const existingPlayer = mockDb.players.get(player.id);
    if (!existingPlayer) return reply.status(404).send({ error: 'Player not found' });
    if (existingPlayer.allianceId) return reply.status(400).send({ error: 'Already in an alliance' });

    const alliance = mockDb.getAlliance(allianceId);
    if (!alliance) return reply.status(404).send({ error: 'Alliance not found' });

    mockDb.addAllianceMember(allianceId, player.id, 'member');

    return { message: `Joined alliance ${alliance.name}` };
  });

  // Leave alliance
  app.post('/:allianceId/leave', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { allianceId } = request.params as { allianceId: string };

    const alliance = mockDb.getAlliance(allianceId);
    if (!alliance) return reply.status(404).send({ error: 'Alliance not found' });

    const member = alliance.members.find((m) => m.playerId === player.id);
    if (!member) return reply.status(400).send({ error: 'Not a member of this alliance' });

    if (member.role === 'leader') {
      // Leader must transfer or disband
      const otherMembers = alliance.members.filter((m) => m.playerId !== player.id);
      if (otherMembers.length > 0) {
        // Transfer leadership to first officer, or first member
        const newLeader = otherMembers.find((m) => m.role === 'officer') ?? otherMembers[0];
        newLeader.role = 'leader';
        alliance.leaderId = newLeader.playerId;
        mockDb.removeAllianceMember(allianceId, player.id);
        mockDb.updateAlliance(allianceId, { leaderId: newLeader.playerId, members: alliance.members });
        return { message: 'Left alliance. Leadership transferred.' };
      } else {
        // Disband
        mockDb.deleteAlliance(allianceId);
        return { message: 'Alliance disbanded (no remaining members)' };
      }
    }

    mockDb.removeAllianceMember(allianceId, player.id);
    return { message: 'Left alliance' };
  });

  // Kick member
  app.post('/:allianceId/kick', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { allianceId } = request.params as { allianceId: string };
    const { playerId: targetId } = kickSchema.parse(request.body);

    const alliance = mockDb.getAlliance(allianceId);
    if (!alliance) return reply.status(404).send({ error: 'Alliance not found' });

    const requester = alliance.members.find((m) => m.playerId === player.id);
    if (!requester || (requester.role !== 'leader' && requester.role !== 'officer')) {
      return reply.status(403).send({ error: 'Only leaders and officers can kick members' });
    }

    const target = alliance.members.find((m) => m.playerId === targetId);
    if (!target) return reply.status(400).send({ error: 'Player is not a member' });
    if (target.role === 'leader') return reply.status(400).send({ error: 'Cannot kick the leader' });
    if (target.role === 'officer' && requester.role !== 'leader') {
      return reply.status(403).send({ error: 'Only the leader can kick officers' });
    }

    mockDb.removeAllianceMember(allianceId, targetId);
    return { message: 'Member kicked' };
  });

  // Promote member
  app.post('/:allianceId/promote', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { allianceId } = request.params as { allianceId: string };
    const { playerId: targetId, role } = promoteSchema.parse(request.body);

    const alliance = mockDb.getAlliance(allianceId);
    if (!alliance) return reply.status(404).send({ error: 'Alliance not found' });

    const requester = alliance.members.find((m) => m.playerId === player.id);
    if (!requester || requester.role !== 'leader') {
      return reply.status(403).send({ error: 'Only the leader can change roles' });
    }

    const target = alliance.members.find((m) => m.playerId === targetId);
    if (!target) return reply.status(400).send({ error: 'Player is not a member' });
    if (target.role === 'leader') return reply.status(400).send({ error: 'Cannot change leader role this way' });

    target.role = role;
    mockDb.updateAlliance(allianceId, { members: alliance.members });

    return { message: `Player role updated to ${role}` };
  });

  // Create diplomacy request
  app.post('/:allianceId/diplomacy', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { allianceId } = request.params as { allianceId: string };
    const { targetAllianceId, type } = diplomacySchema.parse(request.body);

    const alliance = mockDb.getAlliance(allianceId);
    if (!alliance) return reply.status(404).send({ error: 'Alliance not found' });

    const requester = alliance.members.find((m) => m.playerId === player.id);
    if (!requester || (requester.role !== 'leader' && requester.role !== 'officer')) {
      return reply.status(403).send({ error: 'Only leaders and officers can manage diplomacy' });
    }

    const targetAlliance = mockDb.getAlliance(targetAllianceId);
    if (!targetAlliance) return reply.status(404).send({ error: 'Target alliance not found' });
    if (targetAllianceId === allianceId) return reply.status(400).send({ error: 'Cannot create diplomacy with yourself' });

    const diplomacy = mockDb.createDiplomacy({
      id: crypto.randomUUID(),
      fromAllianceId: allianceId,
      toAllianceId: targetAllianceId,
      type,
      status: 'pending',
      createdAt: Date.now(),
    });

    return { message: `Diplomacy request sent (${type})`, diplomacy };
  });

  // Get diplomacy relations
  app.get('/:allianceId/diplomacy', { preHandler: requireAuth }, async (request, reply) => {
    const { allianceId } = request.params as { allianceId: string };

    const alliance = mockDb.getAlliance(allianceId);
    if (!alliance) return reply.status(404).send({ error: 'Alliance not found' });

    const relations = mockDb.getDiplomacyByAlliance(allianceId).map((d) => {
      const from = mockDb.getAlliance(d.fromAllianceId);
      const to = mockDb.getAlliance(d.toAllianceId);
      return {
        ...d,
        fromAllianceName: from?.name,
        fromAllianceTag: from?.tag,
        toAllianceName: to?.name,
        toAllianceTag: to?.tag,
      };
    });

    return { diplomacy: relations };
  });
}
