import { useState, useEffect } from 'react';
import { useGameStore } from '../stores/game-store.js';
import { api } from '../lib/api.js';
import { useToastStore } from '../stores/toast-store.js';

const UNIT_TYPES = [
  {
    type: 'militia', name: 'Militia', icon: '\u2694\uFE0F',
    stats: { attack: 10, defense: 5, speed: 3, carry: 20 },
    cost: { food: 30, wood: 20 }, time: 30,
    requires: 'militia_barracks',
  },
  {
    type: 'archer', name: 'Archer', icon: '\u{1F3F9}',
    stats: { attack: 15, defense: 3, speed: 3, carry: 10 },
    cost: { food: 40, wood: 50 }, time: 45,
    requires: 'militia_barracks',
  },
  {
    type: 'shieldbearer', name: 'Shieldbearer', icon: '\u{1F6E1}\uFE0F',
    stats: { attack: 5, defense: 20, speed: 2, carry: 15 },
    cost: { food: 50, iron: 40 }, time: 60,
    requires: 'militia_barracks',
  },
  {
    type: 'scout', name: 'Scout', icon: '\u{1F441}\uFE0F',
    stats: { attack: 3, defense: 2, speed: 8, carry: 5 },
    cost: { food: 20, wood: 10 }, time: 20,
    requires: 'scout_tower',
  },
  {
    type: 'siege_ram', name: 'Siege Ram', icon: '\u{1F3D7}\uFE0F',
    stats: { attack: 30, defense: 10, speed: 1, carry: 0 },
    cost: { wood: 100, iron: 80, stone: 60 }, time: 120,
    requires: 'militia_barracks',
  },
];

const RESOURCE_LABELS: Record<string, string> = {
  food: 'Food', wood: 'Wood', stone: 'Stone', iron: 'Iron', aether_stone: 'Aether',
};

function formatTime(seconds: number): string {
  if (seconds <= 0) return 'Done!';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

interface UnitPanelProps {
  settlementId: string;
  resources: Record<string, number>;
  buildings: Array<{ type: string; level: number; position: number }>;
  units: Record<string, number>;
  trainQueue: Array<{ unitType: string; count: number; endsAt: number }>;
}

export default function UnitPanel({ settlementId, resources, buildings, units, trainQueue }: UnitPanelProps) {
  const setSettlements = useGameStore((s) => s.setSettlements);
  const addToast = useToastStore((s) => s.addToast);
  const [counts, setCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(UNIT_TYPES.map((u) => [u.type, 1])),
  );
  const [training, setTraining] = useState(false);
  const [configs, setConfigs] = useState<any>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    api.getUnitConfigs().then((data) => setConfigs(data.configs)).catch(() => {});
  }, []);

  const hasBuildingFor = (requires: string) => buildings.some((b) => b.type === requires);

  const canAfford = (cost: Record<string, number | undefined>, count: number) =>
    Object.entries(cost).every(([res, amount]) => amount == null || (resources[res] ?? 0) >= amount * count);

  const handleTrain = async (unitType: string, count: number) => {
    if (training) return;
    setTraining(true);
    setMessage(null);
    try {
      await api.trainUnits(settlementId, unitType, count);
      const msg = `Training ${count} ${unitType} started`;
      setMessage({ text: msg, type: 'success' });
      addToast({ message: msg, type: 'success' });
      const data = await api.getSettlements();
      setSettlements(data.settlements);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Training failed';
      setMessage({ text: msg, type: 'error' });
      addToast({ message: msg, type: 'error' });
    } finally {
      setTraining(false);
    }
  };

  const handleCountChange = (unitType: string, value: string) => {
    const num = Math.max(1, Math.min(50, parseInt(value) || 1));
    setCounts((prev) => ({ ...prev, [unitType]: num }));
  };

  return (
    <div>
      {message && (
        <div className={`mb-4 p-3 rounded text-sm ${
          message.type === 'success'
            ? 'bg-green-900/30 border border-green-700/50 text-green-300'
            : 'bg-red-900/30 border border-red-700/50 text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Train Queue */}
      {trainQueue.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-[var(--ember-gold)] mb-2">Training Queue</h4>
          <div className="space-y-2">
            {trainQueue.map((item, idx) => {
              const unitDef = UNIT_TYPES.find((u) => u.type === item.unitType);
              return (
                <div key={idx} className="flex items-center gap-3 p-2 rounded bg-[var(--veil-blue)]/60 border border-[var(--ember-gold)]/20 text-xs">
                  <span>{unitDef?.icon ?? '?'}</span>
                  <span className="text-[var(--parchment)]">{unitDef?.name ?? item.unitType} x{item.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {UNIT_TYPES.map((unit) => {
          const hasBuilding = hasBuildingFor(unit.requires);
          const count = counts[unit.type] ?? 1;
          const affordable = canAfford(unit.cost, count);
          const canTrain = hasBuilding && affordable && !training;
          const currentCount = units[unit.type] ?? 0;

          return (
            <div
              key={unit.type}
              className={`p-4 rounded-lg border text-left transition-all ${
                !hasBuilding
                  ? 'border-[var(--ruin-grey)]/20 bg-[var(--veil-blue)]/20 opacity-50'
                  : 'border-[var(--ruin-grey)]/30 bg-[var(--veil-blue)]/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{unit.icon}</span>
                  <div>
                    <span className="text-sm font-medium text-[var(--parchment)]">{unit.name}</span>
                    {currentCount > 0 && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-[var(--aether-violet)]/20 text-[var(--aether-violet)]">
                        x{currentCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2 text-xs text-[var(--parchment-dim)]">
                <span>ATK {unit.stats.attack}</span>
                <span>DEF {unit.stats.defense}</span>
                <span>SPD {unit.stats.speed}</span>
                <span>CAR {unit.stats.carry}</span>
              </div>

              {/* Cost per unit */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                {Object.entries(unit.cost).filter((e): e is [string, number] => e[1] != null).map(([res, amount]) => {
                  const total = amount * count;
                  const have = resources[res] ?? 0;
                  const enough = have >= total;
                  return (
                    <span key={res} className={`text-xs ${enough ? 'text-[var(--parchment-dim)]' : 'text-red-400'}`}>
                      {RESOURCE_LABELS[res] || res}: {total}
                    </span>
                  );
                })}
                <span className="text-xs text-[var(--ruin-grey)]">
                  {formatTime(unit.time * count)}
                </span>
              </div>

              {/* Training controls */}
              {hasBuilding ? (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={count}
                    onChange={(e) => handleCountChange(unit.type, e.target.value)}
                    className="w-16 px-2 py-1 text-xs rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/30 text-[var(--parchment)] text-center"
                  />
                  <button
                    disabled={!canTrain}
                    onClick={() => handleTrain(unit.type, count)}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      canTrain
                        ? 'bg-[var(--aether-violet)]/30 border border-[var(--aether-violet)]/50 text-[var(--parchment)] hover:bg-[var(--aether-violet)]/50'
                        : 'bg-[var(--ruin-grey)]/20 border border-[var(--ruin-grey)]/20 text-[var(--ruin-grey)] cursor-not-allowed'
                    }`}
                  >
                    Train
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[var(--ruin-grey)] italic mt-2">
                  Requires {UNIT_TYPES.find((u) => u.type === unit.type)?.requires?.replace('_', ' ')}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
