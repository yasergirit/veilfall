import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { mockDb } from '../db/mock-db.js';
import { STARTING_RESOURCES } from '@veilfall/shared';
import { syncPlayer, syncSettlement } from '../db/supabase-sync.js';

const STARTER_HEROES: Record<string, { name: string; heroClass: string }> = {
  ironveil: { name: 'Thorne', heroClass: 'warlord' },
  aetheri: { name: 'Lyris', heroClass: 'sage' },
  thornwatch: { name: 'Ashka', heroClass: 'shadowblade' },
  ashen: { name: 'Kael', heroClass: 'warlord' },
};

const HERO_CLASS_STATS: Record<string, { strength: number; intellect: number; agility: number; endurance: number }> = {
  warlord:     { strength: 8, intellect: 3, agility: 4, endurance: 7 },
  sage:        { strength: 3, intellect: 8, agility: 4, endurance: 5 },
  shadowblade: { strength: 5, intellect: 4, agility: 8, endurance: 3 },
  steward:     { strength: 4, intellect: 6, agility: 4, endurance: 6 },
};

const HERO_CLASS_LEVEL1_ABILITY: Record<string, string> = {
  warlord:     'rally_cry',
  sage:        'aether_bolt',
  shadowblade: 'shadow_strike',
  steward:     'inspire',
};

const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  faction: z.enum(['ironveil', 'aetheri', 'thornwatch', 'ashen']),
  settlementName: z.string().min(2).max(30),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(6).max(128),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    if (mockDb.getPlayerByEmail(body.email)) {
      return reply.status(409).send({ error: 'Email already registered' });
    }
    if (mockDb.getPlayerByUsername(body.username)) {
      return reply.status(409).send({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(body.password, 12);
    const playerId = crypto.randomUUID();

    const player = mockDb.createPlayer({
      id: playerId,
      username: body.username,
      email: body.email,
      passwordHash: hashedPassword,
      faction: body.faction,
      createdAt: new Date(),
    });
    syncPlayer(player);

    const q = Math.floor(Math.random() * 20) - 10;
    const r = Math.floor(Math.random() * 20) - 10;

    const settlement = mockDb.createSettlement({
      id: crypto.randomUUID(),
      playerId,
      name: body.settlementName,
      level: 1,
      q, r, s: -q - r,
      resources: { ...STARTING_RESOURCES },
      buildings: [{ type: 'town_center', level: 1, position: 0 }],
      buildQueue: [],
      units: {},
      trainQueue: [],
      researched: {},
      researchQueue: null,
    });
    syncSettlement(settlement);

    const starterHero = STARTER_HEROES[body.faction];
    const heroClass = starterHero.heroClass;
    const baseStats = HERO_CLASS_STATS[heroClass] ?? { strength: 5, intellect: 5, agility: 5, endurance: 5 };
    // Starter equipment: rusty_sword + leather_armor for everyone
    const starterEquipment: Record<string, string | null> = { weapon: 'rusty_sword', armor: 'leather_armor', accessory: null, relic: null };
    // Apply equipment stat bonuses: rusty_sword +2 strength, leather_armor +3 endurance
    const statsWithEquip = {
      ...baseStats,
      strength: baseStats.strength + 2,
      endurance: baseStats.endurance + 3,
    };
    // Auto-unlock level 1 ability
    const level1Ability = HERO_CLASS_LEVEL1_ABILITY[heroClass];
    const startingAbilities = level1Ability ? [level1Ability] : [];

    mockDb.createHero({
      id: crypto.randomUUID(),
      playerId,
      name: starterHero.name,
      heroClass,
      level: 1, xp: 0, loyalty: 80, status: 'idle',
      abilities: startingAbilities,
      equipment: starterEquipment,
      stats: statsWithEquip,
    });

    const token = app.jwt.sign({ id: playerId, username: body.username, faction: body.faction, email: body.email });
    const refreshToken = app.jwt.sign({ id: playerId, type: 'refresh' }, { expiresIn: '7d' });

    reply.status(201).send({
      player: { id: playerId, username: body.username, faction: body.faction, email: body.email, settlementName: body.settlementName },
      token,
      refreshToken,
    });
  });

  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const player = mockDb.getPlayerByEmail(body.email);
    if (!player) return reply.status(401).send({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(body.password, player.passwordHash);
    if (!valid) return reply.status(401).send({ error: 'Invalid email or password' });

    const token = app.jwt.sign({ id: player.id, username: player.username, faction: player.faction, email: player.email });
    const refreshToken = app.jwt.sign({ id: player.id, type: 'refresh' }, { expiresIn: '7d' });
    const settlements = mockDb.getSettlementsByPlayer(player.id);

    reply.send({
      player: { id: player.id, username: player.username, faction: player.faction, email: player.email, settlementName: settlements[0]?.name ?? 'Unknown' },
      token,
      refreshToken,
    });
  });

  app.post('/forgot-password', async (request, reply) => {
    const body = forgotPasswordSchema.parse(request.body);
    const player = mockDb.getPlayerByEmail(body.email);

    // Always return success to prevent email enumeration
    if (!player) {
      return reply.send({ message: 'If that email exists, a reset link has been sent.' });
    }

    const resetToken = mockDb.createPasswordResetToken(player.id, body.email);

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetLink = `${clientUrl}/reset-password?token=${resetToken}`;

    // Send email via Resend (free tier: 3000/month)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'Veilfall <onboarding@resend.dev>',
            to: [body.email],
            subject: 'Veilfall - Password Reset',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0e1a; color: #e8dcc4; padding: 32px; border-radius: 8px;">
                <h1 style="text-align: center; letter-spacing: 4px; color: #c4a0ff;">VEILFALL</h1>
                <p style="text-align: center; color: #8a8a9a; font-size: 13px;">Echoes of the Sky Rupture</p>
                <hr style="border: 1px solid #2a3a5a; margin: 24px 0;" />
                <p>Commander <strong>${player.username}</strong>,</p>
                <p>A password reset was requested for your account. Click the button below to set a new password:</p>
                <div style="text-align: center; margin: 28px 0;">
                  <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #7c3aed, #a855f7); color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
                </div>
                <p style="font-size: 13px; color: #8a8a9a;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
              </div>
            `,
          }),
        });
        if (!emailRes.ok) {
          const errBody = await emailRes.text();
          app.log.error(`[RESEND ERROR] ${errBody}`);
        }
      } catch (err) {
        app.log.error(`[RESEND ERROR] ${err}`);
      }
    } else {
      app.log.info(`[PASSWORD RESET] No RESEND_API_KEY set. Link for ${body.email}: ${resetLink}`);
    }

    reply.send({ message: 'If that email exists, a reset link has been sent.' });
  });

  app.post('/reset-password', async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body);

    const tokenEntry = mockDb.getPasswordResetToken(body.token);
    if (!tokenEntry) {
      return reply.status(400).send({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(body.password, 12);
    const updated = mockDb.updatePlayerPassword(tokenEntry.playerId, hashedPassword);

    if (!updated) {
      return reply.status(404).send({ error: 'Player not found' });
    }

    mockDb.deletePasswordResetToken(body.token);

    reply.send({ message: 'Password has been reset successfully' });
  });
}
