import { useState, useEffect } from 'react';
import { useGameStore } from '../stores/game-store.js';
import { api } from '../lib/api.js';
import { useToastStore } from '../stores/toast-store.js';

/* ─── Types ─── */

interface ResearchNode {
  type: string;
  name: string;
  description: string;
  effects: string;
  maxLevel: number;
  cost: Record<string, number>;
  time: number;
  requiredBuilding?: string;
}

interface ResearchStatus {
  completed: Record<string, number>; // type -> level
  active?: {
    type: string;
    level: number;
    endsAt: number;
  } | null;
}

/* ─── Helpers ─── */

const RESOURCE_LABELS: Record<string, string> = {
  food: 'Food',
  wood: 'Wood',
  stone: 'Stone',
  iron: 'Iron',
  aether_stone: 'Aether',
};

function formatTime(seconds: number): string {
  if (seconds <= 0) return 'Done!';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function useCountdown(endsAt: number | undefined): number {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!endsAt) {
      setRemaining(0);
      return;
    }
    const update = () => setRemaining(Math.max(0, (endsAt - Date.now()) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return remaining;
}

/* ─── Main Component ─── */

export default function ResearchPanel() {
  const settlements = useGameStore((s) => s.settlements);
  const activeSettlementId = useGameStore((s) => s.activeSettlementId);
  const setSettlements = useGameStore((s) => s.setSettlements);
  const addToast = useToastStore((s) => s.addToast);

  const activeSettlement = settlements.find((s) => s.id === activeSettlementId);

  const [tree, setTree] = useState<ResearchNode[]>([]);
  const [status, setStatus] = useState<ResearchStatus>({ completed: {} });
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [treeData, statusData] = await Promise.all([
          api.getResearchTree(),
          activeSettlementId ? api.getResearchStatus(activeSettlementId) : null,
        ]);
        setTree(treeData.research ?? treeData.tree ?? []);
        if (statusData) {
          setStatus({
            completed: statusData.completed ?? {},
            active: statusData.active ?? null,
          });
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeSettlementId]);

  // Refresh status when active research might complete
  useEffect(() => {
    if (!status.active || !activeSettlementId) return;
    const remaining = status.active.endsAt - Date.now();
    if (remaining <= 0) return;
    const timeout = setTimeout(async () => {
      try {
        const statusData = await api.getResearchStatus(activeSettlementId);
        setStatus({
          completed: statusData.completed ?? {},
          active: statusData.active ?? null,
        });
        const data = await api.getSettlements();
        setSettlements(data.settlements);
        addToast({ message: 'Research complete!', type: 'success' });
      } catch {
        // ignore
      }
    }, remaining + 1000);
    return () => clearTimeout(timeout);
  }, [status.active, activeSettlementId, setSettlements, addToast]);

  const handleStartResearch = async (type: string) => {
    if (!activeSettlementId || researching) return;
    setResearching(true);
    try {
      await api.startResearch(activeSettlementId, type);
      addToast({ message: 'Research started!', type: 'success' });

      // Refresh both status and settlements
      const [statusData, settData] = await Promise.all([
        api.getResearchStatus(activeSettlementId),
        api.getSettlements(),
      ]);
      setStatus({
        completed: statusData.completed ?? {},
        active: statusData.active ?? null,
      });
      setSettlements(settData.settlements);
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Research failed',
        type: 'error',
      });
    } finally {
      setResearching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--ruin-grey)]">
        Loading research...
      </div>
    );
  }

  const resources = (activeSettlement?.resources ?? {}) as Record<string, number>;
  const buildings = activeSettlement?.buildings ?? [];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl mb-1" style={{ fontFamily: 'Cinzel, serif' }}>
          Research
        </h2>
        <p className="text-sm text-[var(--parchment-dim)] mb-6">
          Unlock new technologies and strengthen your settlement
        </p>

        {/* Active Research */}
        {status.active && (
          <ActiveResearch
            active={status.active}
            tree={tree}
          />
        )}

        {/* Research Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {tree.map((node) => {
            const currentLevel = status.completed[node.type] ?? 0;
            const isMaxed = currentLevel >= node.maxLevel;
            const nextLevel = currentLevel + 1;
            const isActive = status.active?.type === node.type;
            const nextCost = Object.fromEntries(
              Object.entries(node.cost).map(([res, amount]) => [res, amount * nextLevel]),
            );
            const nextTime = node.time * nextLevel;
            const hasBuilding = !node.requiredBuilding || buildings.some((b) => b.type === node.requiredBuilding);
            const canAfford = Object.entries(nextCost).every(
              ([res, amount]) => (resources[res] ?? 0) >= amount,
            );
            const canStart = !isMaxed && !isActive && !status.active && hasBuilding && canAfford && !researching;

            return (
              <div
                key={node.type}
                className={`p-4 rounded-lg border transition-all ${
                  isMaxed
                    ? 'border-green-700/40 bg-green-900/10'
                    : isActive
                    ? 'border-[var(--ember-gold)]/40 bg-[var(--ember-gold)]/5'
                    : canStart
                    ? 'border-[var(--ruin-grey)]/30 bg-[var(--veil-blue)]/50 hover:border-[var(--aether-violet)]/60'
                    : 'border-[var(--ruin-grey)]/20 bg-[var(--veil-blue)]/20 opacity-70'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-sm font-medium text-[var(--parchment)]">
                      {node.name}
                    </span>
                    <span className="ml-2 text-xs text-[var(--ruin-grey)]">
                      {currentLevel} / {node.maxLevel}
                    </span>
                  </div>
                  {isMaxed && (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-800/50 text-green-300 font-semibold">
                      MAXED
                    </span>
                  )}
                  {isActive && (
                    <span className="text-xs px-2 py-0.5 rounded bg-[var(--ember-gold)]/20 text-[var(--ember-gold)]">
                      Researching
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-[var(--ruin-grey)] leading-relaxed mb-1">
                  {node.description}
                </p>

                {/* Effects */}
                <p className="text-xs text-[var(--aether-violet)] mb-2">
                  {node.effects}
                </p>

                {/* Required building warning */}
                {!hasBuilding && node.requiredBuilding && (
                  <p className="text-xs text-[var(--ruin-grey)] italic mb-2">
                    Requires: {node.requiredBuilding.replace(/_/g, ' ')}
                  </p>
                )}

                {/* Cost + time (for non-maxed, non-active) */}
                {!isMaxed && !isActive && (
                  <div className="mt-2 pt-2 border-t border-[var(--ruin-grey)]/15">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                      {Object.entries(nextCost).map(([res, amount]) => {
                        const have = resources[res] ?? 0;
                        const enough = have >= amount;
                        return (
                          <span
                            key={res}
                            className={`text-xs ${enough ? 'text-[var(--parchment-dim)]' : 'text-red-400'}`}
                          >
                            {RESOURCE_LABELS[res] || res}: {amount}
                          </span>
                        );
                      })}
                      <span className="text-xs text-[var(--ruin-grey)]">
                        {formatTime(nextTime)}
                      </span>
                    </div>
                    <button
                      disabled={!canStart}
                      onClick={() => canStart && handleStartResearch(node.type)}
                      className={`w-full px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        canStart
                          ? 'bg-[var(--aether-violet)]/30 border border-[var(--aether-violet)]/50 text-[var(--parchment)] hover:bg-[var(--aether-violet)]/50'
                          : 'bg-[var(--ruin-grey)]/20 border border-[var(--ruin-grey)]/20 text-[var(--ruin-grey)] cursor-not-allowed'
                      }`}
                    >
                      {status.active
                        ? 'Research in progress'
                        : !hasBuilding
                        ? 'Missing building'
                        : !canAfford
                        ? 'Cannot afford'
                        : `Research Lv${nextLevel}`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {tree.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-4xl mb-4 opacity-30">{'\uD83D\uDD2C'}</span>
            <p className="text-[var(--ruin-grey)] text-sm italic">
              No research available yet. Develop your settlement to unlock technologies.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Active Research Display ─── */

function ActiveResearch({
  active,
  tree,
}: {
  active: { type: string; level: number; endsAt: number };
  tree: ResearchNode[];
}) {
  const remaining = useCountdown(active.endsAt);
  const node = tree.find((n) => n.type === active.type);
  const totalTime = node ? node.time * active.level : 60;
  const elapsed = totalTime - remaining;
  const progress = totalTime > 0 ? Math.max(0, Math.min(100, (elapsed / totalTime) * 100)) : 100;

  return (
    <div className="mb-6 p-4 rounded-lg border border-[var(--ember-gold)]/30 bg-[var(--ember-gold)]/5">
      <h3 className="text-sm font-semibold text-[var(--ember-gold)] mb-2">
        Active Research
      </h3>
      <div className="flex items-center gap-3">
        <span className="text-lg">{'\uD83D\uDD2C'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-[var(--parchment)]">
              {node?.name ?? active.type} Lv{active.level}
            </span>
            <span className="text-xs text-[var(--ember-gold)] font-mono">
              {remaining > 0 ? formatTime(remaining) : 'Complete!'}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[var(--veil-blue-deep)]">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--aether-violet), var(--aether-glow, #c084fc))',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
