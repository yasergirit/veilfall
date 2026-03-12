import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';

/* --- Types --- */

interface ChronicleEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

interface LoreFragment {
  id: string;
  title: string;
  content: string;
  discoveredBy?: string;
  discovered: boolean;
}

interface BattleUnit {
  type: string;
  count: number;
  lost: number;
}

interface BattleReport {
  id: string;
  timestamp: string;
  type: 'attack' | 'defend';
  targetQ: number;
  targetR: number;
  result: 'victory' | 'defeat' | 'draw';
  attackerUnits: BattleUnit[];
  defenderUnits: BattleUnit[];
  loot?: Record<string, number>;
  heroInvolved?: string;
  heroXpGained?: number;
}

/* --- Event type config --- */

const EVENT_ICONS: Record<string, string> = {
  building_complete: '\uD83C\uDFD7\uFE0F',
  building_upgrade: '\u2B06\uFE0F',
  unit_trained: '\u2694\uFE0F',
  march_sent: '\uD83D\uDEA9',
  march_returned: '\uD83C\uDFE0',
  combat: '\uD83D\uDCA5',
  alliance_joined: '\uD83E\uDD1D',
  quest_complete: '\u2728',
  lore_discovered: '\uD83D\uDCDC',
};

const EVENT_COLORS: Record<string, string> = {
  building_complete: 'var(--ember-gold)',
  building_upgrade: 'var(--ember-gold)',
  unit_trained: '#e05555',
  march_sent: '#e05555',
  march_returned: '#e05555',
  combat: '#e05555',
  alliance_joined: 'var(--aether-violet)',
  quest_complete: 'var(--aether-violet)',
  lore_discovered: '#55e080',
};

function getEventColor(type: string): string {
  return EVENT_COLORS[type] ?? 'var(--ruin-grey)';
}

function getEventIcon(type: string): string {
  return EVENT_ICONS[type] ?? '\uD83D\uDCCC';
}

/* --- Relative time --- */

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* --- Resource Icons --- */

const RESOURCE_ICONS: Record<string, string> = {
  food: '\u{1F33E}',
  wood: '\u{1FAB5}',
  stone: '\u{1FAA8}',
  iron: '\u{2699}',
  aether_stone: '\u{1F48E}',
};

/* --- Main Component --- */

type Tab = 'events' | 'lore' | 'battles';

export default function ChroniclePanel() {
  const [activeTab, setActiveTab] = useState<Tab>('events');

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl mb-1" style={{ fontFamily: 'Cinzel, serif' }}>
          Chronicle
        </h2>
        <p className="text-sm text-[var(--parchment-dim)] mb-6">
          A record of your deeds and discoveries
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[var(--ruin-grey)]/20">
          {(['events', 'lore', 'battles'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-[var(--ember-gold)] border-b-2 border-[var(--ember-gold)]'
                  : 'text-[var(--ruin-grey)] hover:text-[var(--parchment-dim)]'
              }`}
            >
              {tab === 'events' ? 'Events' : tab === 'lore' ? 'Lore' : 'Battles'}
            </button>
          ))}
        </div>

        {activeTab === 'events' && <EventsTab />}
        {activeTab === 'lore' && <LoreTab />}
        {activeTab === 'battles' && <BattlesTab />}
      </div>
    </div>
  );
}

/* --- Events Tab --- */

function EventsTab() {
  const [events, setEvents] = useState<ChronicleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchEvents = useCallback(async (offset = 0) => {
    try {
      const data = await api.getChronicleEvents(20, offset);
      const fetched: ChronicleEvent[] = data.events ?? [];
      if (offset === 0) {
        setEvents(fetched);
      } else {
        setEvents((prev) => [...prev, ...fetched]);
      }
      if (fetched.length < 20) setHasMore(false);
    } catch {
      if (offset === 0) setEvents([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchEvents(0).finally(() => setLoading(false));
  }, [fetchEvents]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchEvents(events.length);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--ruin-grey)]">
        Loading chronicle...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-4xl mb-4 opacity-30">{'\uD83D\uDCDC'}</span>
        <p className="text-[var(--ruin-grey)] text-sm italic">
          Your chronicle is empty. Build something to begin writing history.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline vertical line */}
      <div
        className="absolute left-3 top-2 bottom-2 w-px"
        style={{ background: 'var(--ruin-grey)', opacity: 0.2 }}
      />

      <div className="space-y-4">
        {events.map((event) => {
          const color = getEventColor(event.type);
          const icon = getEventIcon(event.type);
          return (
            <div key={event.id} className="relative flex gap-4 pl-8">
              {/* Timeline dot */}
              <div
                className="absolute left-1.5 top-1 w-3.5 h-3.5 rounded-full border-2 shrink-0"
                style={{
                  borderColor: color,
                  background: 'var(--veil-blue-deep)',
                }}
              />

              {/* Event content */}
              <div className="flex-1 pb-1">
                <div className="flex items-start gap-2">
                  <span className="text-base shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className="text-sm font-medium"
                        style={{ color }}
                      >
                        {event.title}
                      </span>
                      <span className="text-xs text-[var(--ruin-grey)] shrink-0">
                        {relativeTime(event.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--parchment-dim)] leading-relaxed mt-0.5">
                      {event.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 rounded text-xs text-[var(--parchment)] bg-[var(--veil-blue)] border border-[var(--ruin-grey)]/30 hover:border-[var(--aether-violet)]/50 transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

/* --- Lore Tab --- */

function LoreTab() {
  const [lore, setLore] = useState<LoreFragment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getChronicleLore()
      .then((data) => setLore(data.lore ?? []))
      .catch(() => setLore([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--ruin-grey)]">
        Loading lore...
      </div>
    );
  }

  const discovered = lore.filter((l) => l.discovered).length;
  const total = lore.length || 8;

  return (
    <div>
      {/* Progress */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-[var(--veil-blue-deep)]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${total > 0 ? (discovered / total) * 100 : 0}%`,
              background: 'linear-gradient(90deg, #55e080, #80e0b0)',
            }}
          />
        </div>
        <span className="text-xs text-[var(--parchment-dim)] shrink-0">
          {discovered} of {total} lore fragments discovered
        </span>
      </div>

      {/* Lore Cards */}
      <div className="space-y-4">
        {lore.map((fragment) =>
          fragment.discovered ? (
            <div
              key={fragment.id}
              className="p-5 rounded-lg border border-[var(--ember-gold)]/20 relative overflow-hidden"
              style={{
                background:
                  'linear-gradient(135deg, rgba(60, 45, 20, 0.4), rgba(40, 30, 15, 0.6))',
              }}
            >
              {/* Parchment texture overlay */}
              <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage:
                    'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23d4a04a\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                }}
              />
              <h3
                className="text-base mb-2 relative"
                style={{
                  fontFamily: 'Cinzel, serif',
                  color: 'var(--ember-gold)',
                }}
              >
                {fragment.title}
              </h3>
              <p className="text-sm text-[var(--parchment)] italic leading-relaxed relative mb-3">
                {fragment.content}
              </p>
              {fragment.discoveredBy && (
                <p className="text-xs text-[var(--ruin-grey)] relative">
                  Discovered by building {fragment.discoveredBy}
                </p>
              )}
            </div>
          ) : (
            <div
              key={fragment.id}
              className="p-5 rounded-lg border border-[var(--ruin-grey)]/15 bg-[var(--veil-blue)]/20 opacity-50"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{'\uD83D\uDD12'}</span>
                <h3
                  className="text-base text-[var(--ruin-grey)]"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  ???
                </h3>
              </div>
              <p className="text-sm text-[var(--ruin-grey)] italic">
                This lore fragment has not yet been discovered.
              </p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/* --- Battles Tab --- */

const RESULT_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  victory: { bg: 'bg-green-900/30', border: 'border-green-700/50', text: 'text-green-300', label: 'Victory' },
  defeat: { bg: 'bg-red-900/30', border: 'border-red-700/50', text: 'text-red-300', label: 'Defeat' },
  draw: { bg: 'bg-yellow-900/30', border: 'border-yellow-700/50', text: 'text-yellow-300', label: 'Draw' },
};

function formatUnitSummary(units: BattleUnit[]): string {
  return units
    .filter((u) => u.count > 0)
    .map((u) => `${u.count} ${u.type.replace('_', ' ')}`)
    .join(', ');
}

function formatLossSummary(units: BattleUnit[]): string {
  const losses = units.filter((u) => u.lost > 0);
  if (losses.length === 0) return 'no losses';
  return 'lost ' + losses.map((u) => `${u.lost} ${u.type.replace('_', ' ')}`).join(', ');
}

function BattlesTab() {
  const [reports, setReports] = useState<BattleReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchReports = useCallback(async (offset = 0) => {
    try {
      const data = await api.getBattleReports(20, offset);
      const fetched: BattleReport[] = data.reports ?? [];
      if (offset === 0) {
        setReports(fetched);
      } else {
        setReports((prev) => [...prev, ...fetched]);
      }
      if (fetched.length < 20) setHasMore(false);
    } catch {
      if (offset === 0) setReports([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchReports(0).finally(() => setLoading(false));
  }, [fetchReports]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchReports(reports.length);
    setLoadingMore(false);
  };

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--ruin-grey)]">
        Loading battle reports...
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-4xl mb-4 opacity-30">{'\uD83D\uDCA5'}</span>
        <p className="text-[var(--ruin-grey)] text-sm italic">
          No battles fought yet. Send your forces to write history in blood.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => {
        const resultStyle = RESULT_STYLES[report.result] ?? RESULT_STYLES.draw;
        const isExpanded = expandedId === report.id;
        const title = report.type === 'attack'
          ? `Attack on [${report.targetQ}, ${report.targetR}]`
          : `Defended at [${report.targetQ}, ${report.targetR}]`;

        const myUnits = report.type === 'attack' ? report.attackerUnits : report.defenderUnits;
        const enemyUnits = report.type === 'attack' ? report.defenderUnits : report.attackerUnits;

        return (
          <div key={report.id} className="rounded-lg border border-[var(--ruin-grey)]/30 bg-[var(--veil-blue)]/50 overflow-hidden">
            {/* Report card header - clickable */}
            <button
              onClick={() => toggleExpanded(report.id)}
              className="w-full p-4 text-left hover:bg-[var(--veil-blue)]/70 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[var(--parchment)]">{title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${resultStyle.bg} border ${resultStyle.border} ${resultStyle.text}`}>
                      {resultStyle.label}
                    </span>
                  </div>
                  {/* Compact unit summary */}
                  <p className="text-xs text-[var(--parchment-dim)] leading-relaxed">
                    {formatUnitSummary(myUnits)} {'\u2192'} {formatLossSummary(myUnits)}
                  </p>
                  {/* Loot if won */}
                  {report.result === 'victory' && report.loot && Object.keys(report.loot).length > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[var(--ember-gold)]">Loot:</span>
                      {Object.entries(report.loot).map(([res, amount]) => (
                        <span key={res} className="text-xs text-[var(--ember-gold)]">
                          {RESOURCE_ICONS[res] ?? ''} {amount}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs text-[var(--ruin-grey)]">{relativeTime(report.timestamp)}</span>
                  <span className="text-xs text-[var(--ruin-grey)]">{isExpanded ? '\u25B2' : '\u25BC'}</span>
                </div>
              </div>
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-[var(--ruin-grey)]/20">
                <div className="grid grid-cols-2 gap-4 mt-3">
                  {/* Attacker breakdown */}
                  <div>
                    <h5 className="text-xs font-semibold text-[var(--ember-gold)] mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                      Attacker Forces
                    </h5>
                    <div className="space-y-1.5">
                      {report.attackerUnits.map((unit) => (
                        <div key={unit.type} className="flex items-center justify-between text-xs">
                          <span className="text-[var(--parchment)] capitalize">{unit.type.replace('_', ' ')}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--parchment-dim)]">{unit.count}</span>
                            {unit.lost > 0 && (
                              <span className="text-red-400">-{unit.lost}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Defender breakdown */}
                  <div>
                    <h5 className="text-xs font-semibold text-[var(--aether-violet)] mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                      Defender Forces
                    </h5>
                    <div className="space-y-1.5">
                      {report.defenderUnits.map((unit) => (
                        <div key={unit.type} className="flex items-center justify-between text-xs">
                          <span className="text-[var(--parchment)] capitalize">{unit.type.replace('_', ' ')}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--parchment-dim)]">{unit.count}</span>
                            {unit.lost > 0 && (
                              <span className="text-red-400">-{unit.lost}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {report.defenderUnits.length === 0 && (
                        <p className="text-xs text-[var(--ruin-grey)] italic">No defenders</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hero involvement */}
                {report.heroInvolved && (
                  <div className="mt-3 p-2 rounded bg-[var(--aether-violet)]/10 border border-[var(--aether-violet)]/20">
                    <span className="text-xs text-[var(--aether-violet)]">
                      Hero: {report.heroInvolved}
                      {report.heroXpGained != null && report.heroXpGained > 0 && (
                        <span className="ml-2 text-[var(--ember-gold)]">+{report.heroXpGained} XP</span>
                      )}
                    </span>
                  </div>
                )}

                {/* Loot breakdown in expanded */}
                {report.result === 'victory' && report.loot && Object.keys(report.loot).length > 0 && (
                  <div className="mt-3 p-2 rounded bg-[var(--ember-gold)]/10 border border-[var(--ember-gold)]/20">
                    <span className="text-xs font-semibold text-[var(--ember-gold)] block mb-1">Loot Gained</span>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(report.loot).map(([res, amount]) => (
                        <span key={res} className="text-xs text-[var(--parchment)]">
                          {RESOURCE_ICONS[res] ?? ''} {res.replace('_', ' ')}: +{amount}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Load more */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 rounded text-xs text-[var(--parchment)] bg-[var(--veil-blue)] border border-[var(--ruin-grey)]/30 hover:border-[var(--aether-violet)]/50 transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
