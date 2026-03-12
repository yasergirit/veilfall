import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import { useGameStore } from '../stores/game-store.js';

interface WorldBoss {
  id: string;
  name: string;
  title: string;
  type: 'veil_titan' | 'aether_wyrm' | 'shadow_colossus';
  hp: number;
  maxHp: number;
  despawnAt: number;
  defeated: boolean;
  rewards?: Array<{ type: string; amount: number }>;
  leaderboard: Array<{ playerName: string; damage: number; rank: number }>;
}

const BOSS_THEMES: Record<string, { color: string; bg: string; border: string; gradient: string; label: string }> = {
  veil_titan: {
    color: 'text-purple-300',
    bg: 'bg-purple-900/30',
    border: 'border-purple-500/40',
    gradient: 'from-purple-600 to-purple-900',
    label: 'Veil Titan',
  },
  aether_wyrm: {
    color: 'text-blue-300',
    bg: 'bg-blue-900/30',
    border: 'border-blue-500/40',
    gradient: 'from-blue-500 to-blue-900',
    label: 'Aether Wyrm',
  },
  shadow_colossus: {
    color: 'text-red-300',
    bg: 'bg-red-900/30',
    border: 'border-red-800/40',
    gradient: 'from-red-700 to-red-950',
    label: 'Shadow Colossus',
  },
};

function formatTimeLeft(despawnAt: number): string {
  const diff = despawnAt - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function WorldBossPanel() {
  const settlements = useGameStore((s) => s.settlements);
  const activeSettlementId = useGameStore((s) => s.activeSettlementId);
  const activeSettlement = settlements.find((s) => s.id === activeSettlementId);

  const [bosses, setBosses] = useState<WorldBoss[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<Record<string, string>>({});

  // Attack form
  const [attackingBossId, setAttackingBossId] = useState<string | null>(null);
  const [unitSelection, setUnitSelection] = useState<Record<string, number>>({});
  const [attacking, setAttacking] = useState(false);
  const [attackError, setAttackError] = useState<string | null>(null);

  const fetchBosses = useCallback(() => {
    api.getWorldBosses()
      .then((data: any) => {
        setBosses(data.bosses ?? []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchBosses();
    const interval = setInterval(fetchBosses, 15_000);
    return () => clearInterval(interval);
  }, [fetchBosses]);

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const next: Record<string, string> = {};
      bosses.forEach((b) => {
        next[b.id] = formatTimeLeft(b.despawnAt);
      });
      setTimeLeft(next);
    }, 1_000);
    return () => clearInterval(interval);
  }, [bosses]);

  const handleAttack = async (bossId: string) => {
    if (!activeSettlementId) return;
    const nonZeroUnits: Record<string, number> = {};
    for (const [k, v] of Object.entries(unitSelection)) {
      if (v > 0) nonZeroUnits[k] = v;
    }
    if (Object.keys(nonZeroUnits).length === 0) {
      setAttackError('Select at least one unit.');
      return;
    }
    setAttacking(true);
    setAttackError(null);
    try {
      await api.attackWorldBoss(bossId, activeSettlementId, nonZeroUnits);
      setAttackingBossId(null);
      setUnitSelection({});
      fetchBosses();
    } catch (err: any) {
      setAttackError(err.message);
    } finally {
      setAttacking(false);
    }
  };

  const availableUnits = activeSettlement?.units ?? {};

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[var(--ruin-grey)]">Scanning for threats...</p>
      </div>
    );
  }

  const activeBosses = bosses.filter((b) => !b.defeated);
  const defeatedBosses = bosses.filter((b) => b.defeated);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-[Cinzel] text-2xl text-[var(--parchment)] mb-1">
            World Threats
          </h1>
          <p className="text-[var(--ruin-grey)] text-sm">
            Colossal entities threaten the realm. Rally your forces.
          </p>
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        {/* No bosses */}
        {activeBosses.length === 0 && defeatedBosses.length === 0 && (
          <div
            className="text-center py-16 rounded-xl border border-[var(--ruin-grey)]/10"
            style={{ background: 'rgba(15, 22, 40, 0.5)' }}
          >
            <div className="text-5xl mb-4 animate-pulse opacity-30">{'\u{1F409}'}</div>
            <h2 className="font-[Cinzel] text-xl text-[var(--parchment)]/60 mb-2">
              The Realm is at Peace
            </h2>
            <p className="text-[var(--ruin-grey)] text-sm">
              No world threats detected. Remain vigilant.
            </p>
          </div>
        )}

        {/* Active Bosses */}
        {activeBosses.map((boss) => {
          const theme = BOSS_THEMES[boss.type] ?? BOSS_THEMES.veil_titan;
          const hpPercent = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));
          const isAttacking = attackingBossId === boss.id;

          return (
            <div
              key={boss.id}
              className={`rounded-xl p-6 mb-6 border ${theme.border}`}
              style={{ background: 'rgba(15, 22, 40, 0.85)' }}
            >
              {/* Boss Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className={`font-[Cinzel] text-2xl ${theme.color}`}>
                    {boss.name}
                  </h2>
                  <p className="text-[var(--ruin-grey)] text-sm italic">
                    {boss.title}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${theme.bg} ${theme.color} border ${theme.border}`}>
                  {theme.label}
                </span>
              </div>

              {/* Health Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-red-400 font-medium">HP</span>
                  <span className="text-[var(--ruin-grey)]">
                    {boss.hp.toLocaleString()} / {boss.maxHp.toLocaleString()}
                  </span>
                </div>
                <div className="h-5 rounded-full overflow-hidden bg-red-950/60 border border-red-900/40">
                  <div
                    className="h-full rounded-full transition-all duration-500 relative"
                    style={{
                      width: `${hpPercent}%`,
                      background: 'linear-gradient(90deg, #991b1b, #dc2626, #b91c1c)',
                      boxShadow: '0 0 12px rgba(220, 38, 38, 0.4)',
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Timer */}
              <div className="flex items-center gap-2 mb-4 text-sm">
                <span className="text-[var(--ruin-grey)]">Despawns in:</span>
                <span className="text-[var(--ember-gold)] font-medium font-mono">
                  {timeLeft[boss.id] ?? '--'}
                </span>
              </div>

              {/* Rewards Preview */}
              {boss.rewards && boss.rewards.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs text-[var(--ruin-grey)] uppercase tracking-wider mb-2">Rewards</h4>
                  <div className="flex gap-2 flex-wrap">
                    {boss.rewards.map((r, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg text-xs bg-[var(--ember-gold)]/10 text-[var(--ember-gold)] border border-[var(--ember-gold)]/20"
                      >
                        {r.type}: {r.amount.toLocaleString()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Attack Button / Unit Selection */}
              {!isAttacking ? (
                <button
                  onClick={() => {
                    setAttackingBossId(boss.id);
                    setUnitSelection({});
                    setAttackError(null);
                  }}
                  className="w-full py-3 rounded-lg font-[Cinzel] font-bold text-sm tracking-wider transition-all border border-red-500/40 bg-red-900/30 text-red-300 hover:bg-red-900/50 hover:border-red-500/60"
                >
                  \u{2694} ATTACK
                </button>
              ) : (
                <div className="border border-[var(--ruin-grey)]/20 rounded-xl p-4 bg-[var(--veil-blue)]/30">
                  <h4 className="text-sm text-[var(--parchment)] font-medium mb-3">Select Units</h4>
                  {Object.keys(availableUnits).length === 0 ? (
                    <p className="text-[var(--ruin-grey)] text-xs mb-3">No units available.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {Object.entries(availableUnits).map(([unitType, count]) => (
                        <div key={unitType} className="flex items-center justify-between bg-[var(--veil-blue)]/50 rounded-lg px-3 py-2">
                          <div>
                            <span className="text-[var(--parchment)] text-sm">{unitType}</span>
                            <span className="text-[var(--ruin-grey)] text-xs ml-1">({count})</span>
                          </div>
                          <input
                            type="number"
                            min={0}
                            max={count}
                            value={unitSelection[unitType] ?? 0}
                            onChange={(e) =>
                              setUnitSelection((prev) => ({
                                ...prev,
                                [unitType]: Math.min(count, Math.max(0, parseInt(e.target.value) || 0)),
                              }))
                            }
                            className="w-16 bg-[var(--veil-blue)] border border-[var(--ruin-grey)]/20 rounded px-2 py-1 text-[var(--parchment)] text-sm text-right focus:outline-none focus:border-[var(--aether-violet)]/50"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {attackError && (
                    <p className="text-red-400 text-xs mb-2">{attackError}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAttack(boss.id)}
                      disabled={attacking}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all bg-red-700/80 hover:bg-red-700 text-white disabled:opacity-40"
                    >
                      {attacking ? 'Attacking...' : 'Confirm Attack'}
                    </button>
                    <button
                      onClick={() => {
                        setAttackingBossId(null);
                        setAttackError(null);
                      }}
                      className="px-4 py-2 rounded-lg text-sm text-[var(--ruin-grey)] hover:text-[var(--parchment)] border border-[var(--ruin-grey)]/20 hover:border-[var(--ruin-grey)]/40 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Leaderboard */}
              {boss.leaderboard && boss.leaderboard.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-xs text-[var(--ruin-grey)] uppercase tracking-wider mb-2">
                    Top Damage Dealers
                  </h4>
                  <div className="space-y-1">
                    {boss.leaderboard.slice(0, 10).map((entry, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg text-sm"
                        style={{ background: i < 3 ? 'rgba(212, 168, 67, 0.06)' : 'transparent' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-5 text-center text-xs font-bold ${
                            i === 0 ? 'text-[var(--ember-gold)]' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-[var(--ruin-grey)]'
                          }`}>
                            {entry.rank ?? i + 1}
                          </span>
                          <span className="text-[var(--parchment)]">{entry.playerName}</span>
                        </div>
                        <span className="text-[var(--ember-gold)] text-xs font-mono">
                          {entry.damage.toLocaleString()} dmg
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Defeated Bosses */}
        {defeatedBosses.map((boss) => {
          const theme = BOSS_THEMES[boss.type] ?? BOSS_THEMES.veil_titan;
          return (
            <div
              key={boss.id}
              className="rounded-xl p-6 mb-6 border border-[var(--ruin-grey)]/15 relative overflow-hidden"
              style={{ background: 'rgba(15, 22, 40, 0.6)' }}
            >
              {/* Defeated Banner */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span
                  className="font-[Cinzel] text-5xl font-bold tracking-widest text-red-500/15"
                  style={{ transform: 'rotate(-15deg)' }}
                >
                  DEFEATED
                </span>
              </div>

              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className={`font-[Cinzel] text-xl ${theme.color} opacity-60`}>
                      {boss.name}
                    </h2>
                    <p className="text-[var(--ruin-grey)] text-sm italic opacity-60">
                      {boss.title}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-900/30 text-green-400 border border-green-500/30">
                    DEFEATED
                  </span>
                </div>

                {/* Rewards */}
                {boss.rewards && boss.rewards.length > 0 && (
                  <div>
                    <h4 className="text-xs text-[var(--ruin-grey)] uppercase tracking-wider mb-2">Rewards Distributed</h4>
                    <div className="flex gap-2 flex-wrap">
                      {boss.rewards.map((r, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg text-xs bg-[var(--ember-gold)]/10 text-[var(--ember-gold)]/70 border border-[var(--ember-gold)]/15"
                        >
                          {r.type}: {r.amount.toLocaleString()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Leaderboard */}
                {boss.leaderboard && boss.leaderboard.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs text-[var(--ruin-grey)] uppercase tracking-wider mb-2">Final Rankings</h4>
                    <div className="space-y-1">
                      {boss.leaderboard.slice(0, 5).map((entry, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-3 py-1.5 rounded-lg text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-5 text-center text-xs font-bold ${
                              i === 0 ? 'text-[var(--ember-gold)]' : 'text-[var(--ruin-grey)]'
                            }`}>
                              {entry.rank ?? i + 1}
                            </span>
                            <span className="text-[var(--parchment)]/70">{entry.playerName}</span>
                          </div>
                          <span className="text-[var(--ruin-grey)] text-xs font-mono">
                            {entry.damage.toLocaleString()} dmg
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
