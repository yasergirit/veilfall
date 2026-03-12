import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import { useGameStore } from '../stores/game-store.js';

interface SpyMission {
  id: string;
  targetQ: number;
  targetR: number;
  type: 'intel' | 'sabotage';
  status: 'infiltrating' | 'completed' | 'failed' | 'caught';
  startedAt: number;
  completedAt?: number;
  report?: SpyReport;
}

interface SpyReport {
  id: string;
  type: 'intel' | 'sabotage';
  target: { q: number; r: number; playerName?: string; settlementName?: string };
  intel?: {
    resources?: Record<string, number>;
    buildings?: Array<{ type: string; level: number }>;
    units?: Record<string, number>;
  };
  sabotage?: {
    damaged: string;
    amount: number;
    description: string;
  };
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  infiltrating: { bg: 'bg-yellow-900/40', text: 'text-yellow-400', label: 'Infiltrating...' },
  completed: { bg: 'bg-green-900/40', text: 'text-green-400', label: 'Completed' },
  failed: { bg: 'bg-red-900/40', text: 'text-red-400', label: 'Failed' },
  caught: { bg: 'bg-red-900/60', text: 'text-red-300', label: 'Caught \u{1F480}' },
};

export default function SpyPanel() {
  const settlements = useGameStore((s) => s.settlements);
  const activeSettlementId = useGameStore((s) => s.activeSettlementId);
  const activeSettlement = settlements.find((s) => s.id === activeSettlementId);

  const [missions, setMissions] = useState<SpyMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<SpyReport | null>(null);

  // Send form state
  const [targetQ, setTargetQ] = useState('');
  const [targetR, setTargetR] = useState('');
  const [missionType, setMissionType] = useState<'intel' | 'sabotage'>('intel');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const hasSpyGuild = activeSettlement?.buildings?.some(
    (b) => b.type === 'spy_guild' && b.level >= 1,
  );

  const fetchMissions = useCallback(() => {
    api.getSpyMissions()
      .then((data: any) => {
        setMissions(data.missions ?? []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchMissions();
    const interval = setInterval(fetchMissions, 10_000);
    return () => clearInterval(interval);
  }, [fetchMissions]);

  const handleSend = async () => {
    if (!activeSettlementId) return;
    const q = parseInt(targetQ, 10);
    const r = parseInt(targetR, 10);
    if (isNaN(q) || isNaN(r)) {
      setSendError('Enter valid coordinates.');
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await api.sendSpy(activeSettlementId, q, r, missionType);
      setTargetQ('');
      setTargetR('');
      fetchMissions();
    } catch (err: any) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  };

  const viewReport = async (missionId: string) => {
    try {
      const data = await api.getSpyReport(missionId);
      setSelectedReport(data.report ?? data);
    } catch {
      /* noop */
    }
  };

  if (!hasSpyGuild) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div
          className="text-center max-w-md p-8 rounded-xl border border-[var(--ruin-grey)]/20"
          style={{ background: 'rgba(26, 39, 68, 0.6)' }}
        >
          <div className="text-5xl mb-4 opacity-50">{'\u{1F5E1}'}</div>
          <h2 className="font-[Cinzel] text-xl text-[var(--parchment)] mb-3">
            Spy Guild Required
          </h2>
          <p className="text-[var(--ruin-grey)] text-sm leading-relaxed">
            Construct a Spy Guild in your settlement to unlock espionage missions.
            Your agents await their orders, my lord.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-[Cinzel] text-2xl text-[var(--parchment)] mb-1">
            Espionage
          </h1>
          <p className="text-[var(--ruin-grey)] text-sm">
            Dispatch agents to gather intelligence or sabotage your enemies.
          </p>
        </div>

        {/* Send Spy Form */}
        <div
          className="rounded-xl p-5 mb-6 border border-[var(--ruin-grey)]/15"
          style={{ background: 'rgba(15, 22, 40, 0.8)' }}
        >
          <h2 className="font-[Cinzel] text-lg text-[var(--parchment)] mb-4">
            Send Spy
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[var(--ruin-grey)] mb-1">Target Q</label>
              <input
                type="number"
                value={targetQ}
                onChange={(e) => setTargetQ(e.target.value)}
                placeholder="0"
                className="w-full bg-[var(--veil-blue)]/60 border border-[var(--ruin-grey)]/20 rounded-lg px-3 py-2 text-[var(--parchment)] text-sm placeholder-[var(--ruin-grey)]/40 focus:outline-none focus:border-[var(--aether-violet)]/50"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--ruin-grey)] mb-1">Target R</label>
              <input
                type="number"
                value={targetR}
                onChange={(e) => setTargetR(e.target.value)}
                placeholder="0"
                className="w-full bg-[var(--veil-blue)]/60 border border-[var(--ruin-grey)]/20 rounded-lg px-3 py-2 text-[var(--parchment)] text-sm placeholder-[var(--ruin-grey)]/40 focus:outline-none focus:border-[var(--aether-violet)]/50"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-[var(--ruin-grey)] mb-2">Mission Type</label>
            <div className="flex gap-3">
              <button
                onClick={() => setMissionType('intel')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                  missionType === 'intel'
                    ? 'bg-[var(--aether-violet)]/20 border-[var(--aether-violet)]/50 text-[var(--parchment)]'
                    : 'bg-transparent border-[var(--ruin-grey)]/20 text-[var(--ruin-grey)] hover:border-[var(--ruin-grey)]/40'
                }`}
              >
                {'\u{1F441}'} Intelligence
              </button>
              <button
                onClick={() => setMissionType('sabotage')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                  missionType === 'sabotage'
                    ? 'bg-red-900/30 border-red-500/50 text-red-300'
                    : 'bg-transparent border-[var(--ruin-grey)]/20 text-[var(--ruin-grey)] hover:border-[var(--ruin-grey)]/40'
                }`}
              >
                {'\u{1F4A3}'} Sabotage
              </button>
            </div>
          </div>

          {/* Cost */}
          <div className="flex items-center gap-4 mb-4 text-xs text-[var(--ruin-grey)]">
            <span>Cost:</span>
            <span className="text-[var(--ember-gold)]">{'\u{1F33E}'} 100 Food</span>
            <span className="text-slate-400">{'\u{2699}'} 50 Iron</span>
          </div>

          {sendError && (
            <p className="text-red-400 text-xs mb-3">{sendError}</p>
          )}

          <button
            onClick={handleSend}
            disabled={sending || !targetQ || !targetR}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-all bg-[var(--aether-violet)]/80 hover:bg-[var(--aether-violet)] text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? 'Dispatching Agent...' : 'Dispatch Spy'}
          </button>
        </div>

        {/* Mission List */}
        <div>
          <h2 className="font-[Cinzel] text-lg text-[var(--parchment)] mb-3">
            Active Missions
          </h2>

          {loading && (
            <p className="text-[var(--ruin-grey)] text-sm">Loading missions...</p>
          )}

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          {!loading && missions.length === 0 && (
            <div
              className="text-center py-8 rounded-xl border border-[var(--ruin-grey)]/10"
              style={{ background: 'rgba(15, 22, 40, 0.5)' }}
            >
              <p className="text-[var(--ruin-grey)] text-sm">
                No active missions. Your spies stand ready.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {missions.map((mission) => {
              const style = STATUS_STYLES[mission.status] ?? STATUS_STYLES.failed;
              return (
                <div
                  key={mission.id}
                  className="rounded-xl p-4 border border-[var(--ruin-grey)]/15 transition-all hover:border-[var(--ruin-grey)]/30"
                  style={{ background: 'rgba(15, 22, 40, 0.7)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {mission.type === 'intel' ? '\u{1F441}' : '\u{1F4A3}'}
                      </span>
                      <div>
                        <span className="text-[var(--parchment)] text-sm font-medium">
                          {mission.type === 'intel' ? 'Intelligence' : 'Sabotage'} Mission
                        </span>
                        <span className="text-[var(--ruin-grey)] text-xs ml-2">
                          ({mission.targetQ}, {mission.targetR})
                        </span>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
                    >
                      {style.label}
                    </span>
                  </div>

                  {mission.status === 'infiltrating' && (
                    <div className="mt-2">
                      <div className="h-1 rounded-full bg-[var(--veil-blue)] overflow-hidden">
                        <div
                          className="h-full bg-yellow-500/60 rounded-full animate-pulse"
                          style={{ width: '60%' }}
                        />
                      </div>
                    </div>
                  )}

                  {(mission.status === 'completed' || mission.status === 'failed' || mission.status === 'caught') && (
                    <button
                      onClick={() => viewReport(mission.id)}
                      className="mt-2 text-xs text-[var(--aether-violet)] hover:text-[var(--parchment)] transition-colors"
                    >
                      View Report \u{2192}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Report Modal */}
        {selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div
              className="max-w-lg w-full mx-4 rounded-xl p-6 border border-[var(--ruin-grey)]/20"
              style={{ background: 'rgba(15, 22, 40, 0.95)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-[Cinzel] text-lg text-[var(--parchment)]">
                  {selectedReport.type === 'intel' ? '\u{1F441} Intelligence' : '\u{1F4A3} Sabotage'} Report
                </h3>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-[var(--ruin-grey)] hover:text-[var(--parchment)] transition-colors text-xl"
                >
                  \u{2715}
                </button>
              </div>

              {selectedReport.target && (
                <p className="text-[var(--ruin-grey)] text-xs mb-4">
                  Target: ({selectedReport.target.q}, {selectedReport.target.r})
                  {selectedReport.target.playerName && ` - ${selectedReport.target.playerName}`}
                  {selectedReport.target.settlementName && ` (${selectedReport.target.settlementName})`}
                </p>
              )}

              {/* Intel Results */}
              {selectedReport.intel && (
                <div className="space-y-3">
                  {selectedReport.intel.resources && (
                    <div>
                      <h4 className="text-xs text-[var(--ruin-grey)] uppercase tracking-wider mb-1">Resources</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(selectedReport.intel.resources).map(([k, v]) => (
                          <div key={k} className="bg-[var(--veil-blue)]/40 rounded-lg px-3 py-1.5 text-sm">
                            <span className="text-[var(--ruin-grey)]">{k}:</span>{' '}
                            <span className="text-[var(--ember-gold)]">{v.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedReport.intel.buildings && selectedReport.intel.buildings.length > 0 && (
                    <div>
                      <h4 className="text-xs text-[var(--ruin-grey)] uppercase tracking-wider mb-1">Buildings</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedReport.intel.buildings.map((b, i) => (
                          <div key={i} className="bg-[var(--veil-blue)]/40 rounded-lg px-3 py-1.5 text-sm text-[var(--parchment)]">
                            {b.type} <span className="text-[var(--ruin-grey)]">Lv.{b.level}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedReport.intel.units && Object.keys(selectedReport.intel.units).length > 0 && (
                    <div>
                      <h4 className="text-xs text-[var(--ruin-grey)] uppercase tracking-wider mb-1">Units</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(selectedReport.intel.units).map(([k, v]) => (
                          <div key={k} className="bg-[var(--veil-blue)]/40 rounded-lg px-3 py-1.5 text-sm">
                            <span className="text-[var(--parchment)]">{k}:</span>{' '}
                            <span className="text-[var(--ember-gold)]">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sabotage Results */}
              {selectedReport.sabotage && (
                <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4">
                  <p className="text-red-300 text-sm font-medium mb-1">
                    Damaged: {selectedReport.sabotage.damaged}
                  </p>
                  <p className="text-[var(--ruin-grey)] text-xs">
                    {selectedReport.sabotage.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
