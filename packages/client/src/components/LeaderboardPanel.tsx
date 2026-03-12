import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth-store.js';

/* ─── Types ─── */

interface RankedPlayer {
  id: string;
  username: string;
  faction: string;
  score: number;
  rank: number;
}

interface MyRank {
  rank: number;
  score: number;
  type: string;
}

interface AllianceRanking {
  id: string;
  name: string;
  tag: string;
  memberCount: number;
  totalPower: number;
  rank: number;
}

type TabKey = 'power' | 'military' | 'buildings' | 'alliance';

/* ─── Constants ─── */

const TABS: { key: TabKey; label: string }[] = [
  { key: 'power', label: 'Power' },
  { key: 'military', label: 'Military' },
  { key: 'buildings', label: 'Buildings' },
  { key: 'alliance', label: 'Alliance' },
];

const FACTION_COLORS: Record<string, string> = {
  ironhold: '#A0AEC0',
  sunforge: '#D4A843',
  thornveil: '#48BB78',
  shadowmere: '#9F7AEA',
  stormcall: '#63B3ED',
  emberpeak: '#F56565',
};

const RANK_STYLES: Record<number, { bg: string; border: string; text: string; icon: string }> = {
  1: { bg: 'rgba(212, 168, 67, 0.15)', border: 'rgba(212, 168, 67, 0.6)', text: '#D4A843', icon: '\uD83E\uDD47' },
  2: { bg: 'rgba(192, 192, 192, 0.1)', border: 'rgba(192, 192, 192, 0.5)', text: '#C0C0C0', icon: '\uD83E\uDD48' },
  3: { bg: 'rgba(205, 127, 50, 0.1)', border: 'rgba(205, 127, 50, 0.5)', text: '#CD7F32', icon: '\uD83E\uDD49' },
};

/* ─── Helpers ─── */

function formatScore(score: number): string {
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}M`;
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}K`;
  return score.toLocaleString();
}

function FactionBadge({ faction }: { faction: string }) {
  const color = FACTION_COLORS[faction.toLowerCase()] ?? 'var(--ruin-grey)';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.7rem',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color,
        backgroundColor: `${color}20`,
        border: `1px solid ${color}40`,
      }}
    >
      {faction}
    </span>
  );
}

/* ─── Main Component ─── */

export default function LeaderboardPanel() {
  const player = useAuthStore((s) => s.player);

  const [activeTab, setActiveTab] = useState<TabKey>('power');
  const [rankings, setRankings] = useState<RankedPlayer[]>([]);
  const [allianceRankings, setAllianceRankings] = useState<AllianceRanking[]>([]);
  const [myRank, setMyRank] = useState<MyRank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (tab: TabKey) => {
    setLoading(true);
    setError(null);

    try {
      if (tab === 'alliance') {
        const [allianceRes, myRankRes] = await Promise.allSettled([
          api.getAllianceRankings(),
          api.getMyRank(),
        ]);

        if (allianceRes.status === 'fulfilled') {
          setAllianceRankings(allianceRes.value.rankings ?? []);
        }
        if (myRankRes.status === 'fulfilled') {
          setMyRank(myRankRes.value);
        }
      } else {
        const [rankRes, myRankRes] = await Promise.allSettled([
          api.getLeaderboard(tab, 50),
          api.getMyRank(),
        ]);

        if (rankRes.status === 'fulfilled') {
          setRankings(rankRes.value.rankings ?? []);
        } else {
          throw (rankRes as PromiseRejectedResult).reason;
        }
        if (myRankRes.status === 'fulfilled') {
          setMyRank(myRankRes.value);
        }
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab, fetchData]);

  function handleTabChange(tab: TabKey) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setRankings([]);
    setAllianceRankings([]);
  }

  /* ─── Render ─── */

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'rgba(26, 39, 68, 0.95)',
        borderRadius: '8px',
        border: '1px solid rgba(107, 110, 115, 0.2)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px 0',
          borderBottom: '1px solid rgba(107, 110, 115, 0.2)',
        }}
      >
        <h2
          style={{
            margin: '0 0 14px 0',
            fontFamily: 'Cinzel, serif',
            fontSize: '1.25rem',
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: 'var(--ember-gold)',
            textAlign: 'center',
          }}
        >
          LEADERBOARD
        </h2>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  border: 'none',
                  borderBottom: isActive
                    ? '2px solid var(--ember-gold)'
                    : '2px solid transparent',
                  backgroundColor: isActive
                    ? 'rgba(212, 168, 67, 0.1)'
                    : 'transparent',
                  color: isActive ? 'var(--ember-gold)' : 'var(--parchment-dim, #b8ad9a)',
                  fontFamily: 'Cinzel, serif',
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textTransform: 'uppercase',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--parchment)';
                    e.currentTarget.style.backgroundColor = 'rgba(123, 79, 191, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--parchment-dim, #b8ad9a)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchData(activeTab)} />
        ) : (
          <>
            {/* My rank card (player tabs only) */}
            {activeTab !== 'alliance' && myRank && player && (
              <MyRankCard
                rank={myRank.rank}
                score={myRank.score}
                username={player.username}
                faction={player.faction}
              />
            )}

            {/* Rankings table */}
            {activeTab === 'alliance' ? (
              <AllianceTable rankings={allianceRankings} />
            ) : (
              <PlayerTable rankings={rankings} currentPlayerId={player?.id ?? ''} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function MyRankCard({
  rank,
  score,
  username,
  faction,
}: {
  rank: number;
  score: number;
  username: string;
  faction: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        marginBottom: '12px',
        borderRadius: '6px',
        border: '1px solid rgba(212, 168, 67, 0.5)',
        backgroundColor: 'rgba(212, 168, 67, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'rgba(212, 168, 67, 0.15)',
            border: '1px solid rgba(212, 168, 67, 0.4)',
            fontFamily: 'Cinzel, serif',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: 'var(--ember-gold)',
          }}
        >
          #{rank}
        </span>
        <div>
          <div
            style={{
              color: 'var(--parchment)',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            {username}
          </div>
          <div style={{ marginTop: '2px' }}>
            <FactionBadge faction={faction} />
          </div>
        </div>
      </div>
      <div
        style={{
          fontFamily: 'Cinzel, serif',
          fontSize: '1rem',
          fontWeight: 700,
          color: 'var(--ember-gold)',
        }}
      >
        {formatScore(score)}
      </div>
    </div>
  );
}

function PlayerTable({
  rankings,
  currentPlayerId,
}: {
  rankings: RankedPlayer[];
  currentPlayerId: string;
}) {
  if (rankings.length === 0) {
    return <EmptyState message="No rankings available yet." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '50px 1fr 100px 90px',
          padding: '6px 10px',
          fontSize: '0.65rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--ruin-grey)',
          borderBottom: '1px solid rgba(107, 110, 115, 0.15)',
          marginBottom: '4px',
        }}
      >
        <span>Rank</span>
        <span>Player</span>
        <span>Faction</span>
        <span style={{ textAlign: 'right' }}>Score</span>
      </div>

      {rankings.map((entry) => {
        const isCurrentPlayer = entry.id === currentPlayerId;
        const podium = RANK_STYLES[entry.rank];

        return (
          <div
            key={entry.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '50px 1fr 100px 90px',
              alignItems: 'center',
              padding: '8px 10px',
              borderRadius: '4px',
              border: isCurrentPlayer
                ? '1px solid rgba(212, 168, 67, 0.35)'
                : podium
                  ? `1px solid ${podium.border}`
                  : '1px solid transparent',
              backgroundColor: isCurrentPlayer
                ? 'rgba(212, 168, 67, 0.06)'
                : podium
                  ? podium.bg
                  : 'transparent',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isCurrentPlayer
                ? 'rgba(212, 168, 67, 0.1)'
                : 'rgba(123, 79, 191, 0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isCurrentPlayer
                ? 'rgba(212, 168, 67, 0.06)'
                : podium
                  ? podium.bg
                  : 'transparent';
            }}
          >
            {/* Rank */}
            <span
              style={{
                fontFamily: 'Cinzel, serif',
                fontWeight: 700,
                fontSize: '0.85rem',
                color: podium ? podium.text : 'var(--parchment-dim, #b8ad9a)',
              }}
            >
              {podium ? podium.icon : `#${entry.rank}`}
            </span>

            {/* Player name */}
            <span
              style={{
                fontWeight: isCurrentPlayer ? 700 : 500,
                fontSize: '0.85rem',
                color: isCurrentPlayer ? 'var(--ember-gold)' : 'var(--parchment)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.username}
              {isCurrentPlayer && (
                <span
                  style={{
                    marginLeft: '6px',
                    fontSize: '0.6rem',
                    color: 'var(--aether-violet)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  (You)
                </span>
              )}
            </span>

            {/* Faction */}
            <FactionBadge faction={entry.faction} />

            {/* Score */}
            <span
              style={{
                textAlign: 'right',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: podium ? podium.text : 'var(--parchment-dim, #b8ad9a)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatScore(entry.score)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AllianceTable({ rankings }: { rankings: AllianceRanking[] }) {
  if (rankings.length === 0) {
    return <EmptyState message="No alliance rankings available yet." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '50px 1fr 80px 90px',
          padding: '6px 10px',
          fontSize: '0.65rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--ruin-grey)',
          borderBottom: '1px solid rgba(107, 110, 115, 0.15)',
          marginBottom: '4px',
        }}
      >
        <span>Rank</span>
        <span>Alliance</span>
        <span style={{ textAlign: 'center' }}>Members</span>
        <span style={{ textAlign: 'right' }}>Power</span>
      </div>

      {rankings.map((entry) => {
        const podium = RANK_STYLES[entry.rank];

        return (
          <div
            key={entry.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '50px 1fr 80px 90px',
              alignItems: 'center',
              padding: '8px 10px',
              borderRadius: '4px',
              border: podium
                ? `1px solid ${podium.border}`
                : '1px solid transparent',
              backgroundColor: podium ? podium.bg : 'transparent',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(123, 79, 191, 0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = podium ? podium.bg : 'transparent';
            }}
          >
            {/* Rank */}
            <span
              style={{
                fontFamily: 'Cinzel, serif',
                fontWeight: 700,
                fontSize: '0.85rem',
                color: podium ? podium.text : 'var(--parchment-dim, #b8ad9a)',
              }}
            >
              {podium ? podium.icon : `#${entry.rank}`}
            </span>

            {/* Alliance name + tag */}
            <div style={{ overflow: 'hidden' }}>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: 'var(--parchment)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.name}
              </span>
              <span
                style={{
                  marginLeft: '6px',
                  fontSize: '0.65rem',
                  color: 'var(--aether-violet)',
                  fontWeight: 600,
                }}
              >
                [{entry.tag}]
              </span>
            </div>

            {/* Member count */}
            <span
              style={{
                textAlign: 'center',
                fontSize: '0.8rem',
                color: 'var(--parchment-dim, #b8ad9a)',
              }}
            >
              {entry.memberCount}
            </span>

            {/* Total power */}
            <span
              style={{
                textAlign: 'right',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: podium ? podium.text : 'var(--parchment-dim, #b8ad9a)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatScore(entry.totalPower)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Utility States ─── */

function LoadingState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 0',
        gap: '12px',
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          border: '2px solid rgba(123, 79, 191, 0.3)',
          borderTopColor: 'var(--aether-violet)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span
        style={{
          color: 'var(--parchment-dim, #b8ad9a)',
          fontSize: '0.8rem',
        }}
      >
        Loading rankings...
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 20px',
        gap: '12px',
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: '0.85rem', color: '#F56565' }}>{message}</span>
      <button
        onClick={onRetry}
        style={{
          padding: '6px 16px',
          border: '1px solid rgba(123, 79, 191, 0.4)',
          borderRadius: '4px',
          backgroundColor: 'rgba(123, 79, 191, 0.1)',
          color: 'var(--aether-violet)',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background-color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(123, 79, 191, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(123, 79, 191, 0.1)';
        }}
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 20px',
        color: 'var(--parchment-dim, #b8ad9a)',
        fontSize: '0.85rem',
        textAlign: 'center',
      }}
    >
      {message}
    </div>
  );
}
