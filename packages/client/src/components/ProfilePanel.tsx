import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store.js';
import { useGameStore } from '../stores/game-store.js';
import { api } from '../lib/api.js';

/* ─── Faction color map ─── */
const FACTION_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  ironveil:   { bg: 'rgba(74, 102, 112, 0.25)', text: '#B8622A', label: 'The Ironveil Compact' },
  aetheri:    { bg: 'rgba(155, 110, 212, 0.25)', text: '#C0E0FF', label: 'The Aetheri Dominion' },
  thornwatch: { bg: 'rgba(58, 107, 53, 0.25)',   text: '#3A6B35', label: 'The Thornwatch Clans' },
  ashen:      { bg: 'rgba(139, 26, 26, 0.25)',   text: '#D4A574', label: 'The Ashen Covenant' },
};

/* ─── Achievement definitions ─── */
interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  check: (ctx: AchievementContext) => boolean;
}

interface AchievementContext {
  totalBuildings: number;
  totalUnits: number;
  totalMarches: number;
  totalResearch: number;
  totalTrades: number;
  townCenterLevel: number;
  hasAlliance: boolean;
  hasAetherExtractor: boolean;
}

const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Build your first building',
    icon: '\u{1F3D7}',
    check: (ctx) => ctx.totalBuildings >= 1,
  },
  {
    id: 'builder',
    name: 'Builder',
    description: 'Have 5 buildings',
    icon: '\u{1F3E0}',
    check: (ctx) => ctx.totalBuildings >= 5,
  },
  {
    id: 'architect',
    name: 'Architect',
    description: 'Have 10 buildings',
    icon: '\u{1F3DB}',
    check: (ctx) => ctx.totalBuildings >= 10,
  },
  {
    id: 'commander',
    name: 'Commander',
    description: 'Train 50 units',
    icon: '\u{2694}',
    check: (ctx) => ctx.totalUnits >= 50,
  },
  {
    id: 'warlord',
    name: 'Warlord',
    description: 'Train 200 units',
    icon: '\u{1F525}',
    check: (ctx) => ctx.totalUnits >= 200,
  },
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'Send 5 marches',
    icon: '\u{1F9ED}',
    check: (ctx) => ctx.totalMarches >= 5,
  },
  {
    id: 'scholar',
    name: 'Scholar',
    description: 'Complete 3 research',
    icon: '\u{1F4D6}',
    check: (ctx) => ctx.totalResearch >= 3,
  },
  {
    id: 'merchant',
    name: 'Merchant',
    description: 'Complete 5 trades',
    icon: '\u{1F4B0}',
    check: (ctx) => ctx.totalTrades >= 5,
  },
  {
    id: 'fortress',
    name: 'Fortress',
    description: 'Town Center level 3',
    icon: '\u{1F3F0}',
    check: (ctx) => ctx.townCenterLevel >= 3,
  },
  {
    id: 'citadel',
    name: 'Citadel',
    description: 'Town Center level 5',
    icon: '\u{1F451}',
    check: (ctx) => ctx.townCenterLevel >= 5,
  },
  {
    id: 'alliance_member',
    name: 'Alliance Member',
    description: 'Join an alliance',
    icon: '\u{1F91D}',
    check: (ctx) => ctx.hasAlliance,
  },
  {
    id: 'aether_touched',
    name: 'Aether Touched',
    description: 'Build an aether extractor',
    icon: '\u{1F48E}',
    check: (ctx) => ctx.hasAetherExtractor,
  },
];

/* ─── Component ─── */
export default function ProfilePanel() {
  const player = useAuthStore((s) => s.player);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const settlements = useGameStore((s) => s.settlements);

  const [rankData, setRankData] = useState<any>(null);
  const [allianceData, setAllianceData] = useState<any>(null);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  /* Fetch rank, alliance, and trade history on mount */
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      const results = await Promise.allSettled([
        api.getMyRank(),
        api.getMyAlliance(),
        api.getTradeHistory(),
      ]);
      if (cancelled) return;
      if (results[0].status === 'fulfilled') setRankData(results[0].value);
      if (results[1].status === 'fulfilled') setAllianceData(results[1].value);
      if (results[2].status === 'fulfilled') {
        const val = results[2].value;
        setTradeHistory(Array.isArray(val) ? val : val?.trades ?? []);
      }
      setLoading(false);
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  /* Compute aggregated stats across all settlements */
  const stats = useMemo(() => {
    let totalBuildings = 0;
    let totalUnits = 0;
    let townCenterLevel = 0;
    let hasAetherExtractor = false;

    for (const s of settlements) {
      totalBuildings += s.buildings?.length ?? 0;
      const unitCounts = Object.values(s.units ?? {});
      for (const c of unitCounts) {
        totalUnits += typeof c === 'number' ? c : 0;
      }
      for (const b of s.buildings ?? []) {
        if (b.type === 'town_center' && b.level > townCenterLevel) {
          townCenterLevel = b.level;
        }
        if (b.type === 'aether_extractor') {
          hasAetherExtractor = true;
        }
      }
    }

    return { totalBuildings, totalUnits, townCenterLevel, hasAetherExtractor };
  }, [settlements]);

  /* Achievement context (some values are approximated client-side) */
  const achievementCtx = useMemo<AchievementContext>(() => {
    return {
      totalBuildings: stats.totalBuildings,
      totalUnits: stats.totalUnits,
      totalMarches: rankData?.marchesCompleted ?? rankData?.marches ?? 0,
      totalResearch: rankData?.researchCompleted ?? rankData?.research ?? 0,
      totalTrades: tradeHistory.length,
      townCenterLevel: stats.townCenterLevel,
      hasAlliance: !!(allianceData?.alliance || allianceData?.id || allianceData?.name),
      hasAetherExtractor: stats.hasAetherExtractor,
    };
  }, [stats, rankData, tradeHistory, allianceData]);

  const unlockedCount = useMemo(
    () => ACHIEVEMENTS.filter((a) => a.check(achievementCtx)).length,
    [achievementCtx],
  );

  /* Power breakdown */
  const powerScore = rankData?.power ?? rankData?.score ?? 0;
  const rank = rankData?.rank ?? '---';
  const factionInfo = FACTION_COLORS[player?.faction ?? ''] ?? FACTION_COLORS.ironveil;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6">
      {/* ── Header Card ── */}
      <div
        className="rounded-xl border border-[var(--ruin-grey)]/20 p-6 mb-6"
        style={{ background: 'rgba(26, 39, 68, 0.95)' }}
      >
        <div className="flex items-center gap-4">
          {/* Avatar placeholder */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl border-2"
            style={{
              background: factionInfo.bg,
              borderColor: factionInfo.text,
            }}
          >
            {(player?.username?.[0] ?? '?').toUpperCase()}
          </div>

          <div className="flex-1">
            <h1
              className="text-2xl font-bold text-[var(--ember-gold)] mb-1"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              {player?.username ?? 'Unknown'}
            </h1>
            <div className="flex items-center gap-3">
              <span
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{
                  background: factionInfo.bg,
                  color: factionInfo.text,
                  border: `1px solid ${factionInfo.text}40`,
                }}
              >
                {factionInfo.label}
              </span>
              {allianceData?.alliance?.tag && (
                <span className="text-xs px-2 py-0.5 rounded bg-[var(--aether-violet)]/20 text-[var(--aether-violet)] border border-[var(--aether-violet)]/30">
                  [{allianceData.alliance.tag}]
                </span>
              )}
            </div>
          </div>

          {/* Rank badge */}
          <div className="text-center">
            <div
              className="text-3xl font-bold text-[var(--ember-gold)]"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              #{rank}
            </div>
            <div className="text-[10px] text-[var(--parchment-dim)] uppercase tracking-wider mt-0.5">
              Global Rank
            </div>
          </div>
        </div>
      </div>

      {/* ── Power Summary ── */}
      <div
        className="rounded-xl border border-[var(--ruin-grey)]/20 p-5 mb-6"
        style={{ background: 'rgba(26, 39, 68, 0.95)' }}
      >
        <h2
          className="text-sm font-semibold text-[var(--ember-gold)] mb-4 uppercase tracking-wider"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          Power Summary
        </h2>

        <div className="flex items-center gap-6 mb-5">
          <div>
            <div
              className="text-3xl font-bold text-[var(--parchment)]"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              {loading ? '...' : powerScore.toLocaleString()}
            </div>
            <div className="text-[10px] text-[var(--parchment-dim)] uppercase tracking-wider mt-1">
              Total Power
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <PowerStat
            label="Military"
            value={stats.totalUnits}
            icon={'\u{2694}'}
            color="var(--ember-gold)"
            total={powerScore || 1}
            portion={stats.totalUnits * 10}
          />
          <PowerStat
            label="Buildings"
            value={stats.totalBuildings}
            icon={'\u{1F3D7}'}
            color="var(--aether-violet)"
            total={powerScore || 1}
            portion={stats.totalBuildings * 50}
          />
          <PowerStat
            label="Settlements"
            value={settlements.length}
            icon={'\u{1F3F0}'}
            color="#63B3ED"
            total={powerScore || 1}
            portion={settlements.length * 200}
          />
        </div>
      </div>

      {/* ── Achievements Grid ── */}
      <div
        className="rounded-xl border border-[var(--ruin-grey)]/20 p-5 mb-6"
        style={{ background: 'rgba(26, 39, 68, 0.95)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-sm font-semibold text-[var(--ember-gold)] uppercase tracking-wider"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Achievements
          </h2>
          <span className="text-xs text-[var(--parchment-dim)]">
            {unlockedCount} / {ACHIEVEMENTS.length} unlocked
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {ACHIEVEMENTS.map((achievement) => {
            const unlocked = achievement.check(achievementCtx);
            return (
              <AchievementBadge
                key={achievement.id}
                achievement={achievement}
                unlocked={unlocked}
              />
            );
          })}
        </div>
      </div>

      {/* ── Settlement Overview ── */}
      <div
        className="rounded-xl border border-[var(--ruin-grey)]/20 p-5"
        style={{ background: 'rgba(26, 39, 68, 0.95)' }}
      >
        <h2
          className="text-sm font-semibold text-[var(--ember-gold)] mb-4 uppercase tracking-wider"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          Settlement Overview
        </h2>

        {settlements.length === 0 ? (
          <p className="text-sm text-[var(--parchment-dim)] italic">No settlements yet.</p>
        ) : (
          <div className="space-y-3">
            {settlements.map((s) => {
              const unitCount = Object.values(s.units ?? {}).reduce(
                (sum: number, c: unknown) => sum + (typeof c === 'number' ? c : 0),
                0,
              );
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--ruin-grey)]/15 bg-[var(--veil-blue)]/30 hover:border-[var(--ember-gold)]/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-[var(--aether-violet)]/15 border border-[var(--aether-violet)]/30"
                    >
                      {'\u{1F3F0}'}
                    </div>
                    <div>
                      <div
                        className="text-sm font-semibold text-[var(--parchment)]"
                        style={{ fontFamily: 'Cinzel, serif' }}
                      >
                        {s.name}
                      </div>
                      <div className="text-[10px] text-[var(--parchment-dim)]">
                        ({s.coordinates.q}, {s.coordinates.r})
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 text-xs">
                    <div className="text-center">
                      <div className="font-semibold text-[var(--ember-gold)] tabular-nums">
                        Lv.{s.level ?? 1}
                      </div>
                      <div className="text-[10px] text-[var(--parchment-dim)]">Level</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-[var(--parchment)] tabular-nums">
                        {s.buildings?.length ?? 0}
                      </div>
                      <div className="text-[10px] text-[var(--parchment-dim)]">Buildings</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-[var(--parchment)] tabular-nums">
                        {unitCount}
                      </div>
                      <div className="text-[10px] text-[var(--parchment-dim)]">Units</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Logout ── */}
      <div className="mt-6">
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full py-3 rounded-xl border border-red-700/40 bg-red-950/30 text-red-400 text-sm font-semibold hover:bg-red-950/50 hover:border-red-600/60 hover:text-red-300 transition-colors"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          Log Out
        </button>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function PowerStat({
  label,
  value,
  icon,
  color,
  total,
  portion,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  total: number;
  portion: number;
}) {
  const pct = Math.min(100, Math.round((portion / total) * 100));
  return (
    <div className="p-3 rounded-lg border border-[var(--ruin-grey)]/15 bg-[var(--veil-blue)]/20">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] text-[var(--parchment-dim)] uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-lg font-bold tabular-nums" style={{ color, fontFamily: 'Cinzel, serif' }}>
        {value.toLocaleString()}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-[var(--ruin-grey)]/20 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}80, ${color})`,
          }}
        />
      </div>
    </div>
  );
}

function AchievementBadge({
  achievement,
  unlocked,
}: {
  achievement: AchievementDef;
  unlocked: boolean;
}) {
  return (
    <div
      className={`relative group p-3 rounded-lg border text-center transition-all duration-300 ${
        unlocked
          ? 'border-[var(--ember-gold)]/50 bg-[var(--ember-gold)]/5 hover:bg-[var(--ember-gold)]/10 hover:scale-105 hover:border-[var(--ember-gold)]/80'
          : 'border-[var(--ruin-grey)]/15 bg-[var(--ruin-grey)]/5 opacity-40 hover:opacity-60'
      }`}
      style={
        unlocked
          ? {
              boxShadow: '0 0 12px rgba(218, 165, 32, 0.15), inset 0 0 12px rgba(218, 165, 32, 0.05)',
            }
          : {}
      }
    >
      {/* Icon */}
      <div className="text-2xl mb-1.5 transition-transform duration-300 group-hover:scale-110">
        {unlocked ? achievement.icon : '\u{1F512}'}
      </div>

      {/* Name */}
      <div
        className={`text-[11px] font-semibold leading-tight mb-0.5 ${
          unlocked ? 'text-[var(--ember-gold)]' : 'text-[var(--ruin-grey)]'
        }`}
        style={{ fontFamily: 'Cinzel, serif' }}
      >
        {achievement.name}
      </div>

      {/* Description */}
      <div
        className={`text-[9px] leading-tight ${
          unlocked ? 'text-[var(--parchment-dim)]' : 'text-[var(--ruin-grey)]'
        }`}
      >
        {achievement.description}
      </div>

      {/* Unlocked sparkle effect on hover */}
      {unlocked && (
        <div
          className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(218, 165, 32, 0.08) 0%, transparent 70%)',
          }}
        />
      )}
    </div>
  );
}
