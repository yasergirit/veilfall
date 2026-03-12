import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth-store.js';
import { useToastStore } from '../stores/toast-store.js';

const BANNER_ICONS = [
  { key: 'sword', emoji: '\u2694\uFE0F' },
  { key: 'shield', emoji: '\uD83D\uDEE1\uFE0F' },
  { key: 'castle', emoji: '\uD83C\uDFF0' },
  { key: 'dragon', emoji: '\uD83D\uDC09' },
  { key: 'eagle', emoji: '\uD83E\uDD85' },
  { key: 'fire', emoji: '\uD83D\uDD25' },
  { key: 'gem', emoji: '\uD83D\uDC8E' },
  { key: 'lightning', emoji: '\u26A1' },
];

const BANNER_COLORS = [
  '#8B0000', '#1a2744', '#2d1b4e', '#1a3a1a', '#4a3000',
  '#3a0a0a', '#0a2a3a', '#2a0a3a', '#3a2a0a', '#1a1a2e',
];

const RELATION_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ally: { label: 'Ally', color: 'text-green-300', bg: 'bg-green-900/30', border: 'border-green-700/50' },
  nap: { label: 'NAP', color: 'text-blue-300', bg: 'bg-blue-900/30', border: 'border-blue-700/50' },
  war: { label: 'War', color: 'text-red-300', bg: 'bg-red-900/30', border: 'border-red-700/50' },
};

const ROLE_STYLES: Record<string, { label: string; color: string }> = {
  leader: { label: 'Leader', color: 'var(--ember-gold)' },
  officer: { label: 'Officer', color: 'var(--aether-violet)' },
  member: { label: 'Member', color: 'var(--ruin-grey)' },
};

interface AllianceMember {
  id: string;
  username: string;
  faction: string;
  role: string;
}

interface Alliance {
  id: string;
  name: string;
  tag: string;
  description: string;
  banner: { color1: string; color2: string; icon: string };
  members: AllianceMember[];
  leaderId: string;
  memberCount: number;
  leaderName?: string;
}

interface DiplomacyRelation {
  targetAllianceId: string;
  targetAllianceName: string;
  targetAllianceTag: string;
  type: string;
}

interface SearchResult {
  id: string;
  name: string;
  tag: string;
  memberCount: number;
  leaderName: string;
}

type ViewState = 'no-alliance' | 'has-alliance' | 'view-details';

export default function AlliancePanel() {
  const player = useAuthStore((s) => s.player);
  const addToast = useToastStore((s) => s.addToast);
  const [viewState, setViewState] = useState<ViewState>('no-alliance');
  const [myAlliance, setMyAlliance] = useState<Alliance | null>(null);
  const [viewedAlliance, setViewedAlliance] = useState<Alliance | null>(null);
  const [diplomacy, setDiplomacy] = useState<DiplomacyRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchMyAlliance = useCallback(async () => {
    try {
      const data = await api.getMyAlliance();
      if (data && data.id) {
        setMyAlliance(data);
        setViewState('has-alliance');
        const dipData = await api.getDiplomacy(data.id);
        setDiplomacy(dipData.relations ?? []);
      } else {
        setMyAlliance(null);
        setViewState('no-alliance');
      }
    } catch {
      setMyAlliance(null);
      setViewState('no-alliance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyAlliance();
  }, [fetchMyAlliance]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    addToast({ message: text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleViewAlliance = async (id: string) => {
    try {
      const data = await api.getAlliance(id);
      setViewedAlliance(data);
      setViewState('view-details');
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to load alliance', 'error');
    }
  };

  const handleJoin = async (id: string) => {
    try {
      await api.joinAlliance(id);
      showMessage('Joined alliance!', 'success');
      await fetchMyAlliance();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to join', 'error');
    }
  };

  const handleLeave = async () => {
    if (!myAlliance) return;
    try {
      await api.leaveAlliance(myAlliance.id);
      showMessage('Left alliance.', 'success');
      setMyAlliance(null);
      setViewState('no-alliance');
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to leave', 'error');
    }
  };

  const handleKick = async (playerId: string) => {
    if (!myAlliance) return;
    try {
      await api.kickMember(myAlliance.id, playerId);
      showMessage('Member kicked.', 'success');
      await fetchMyAlliance();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to kick', 'error');
    }
  };

  const handlePromote = async (playerId: string, role: string) => {
    if (!myAlliance) return;
    try {
      await api.promoteMember(myAlliance.id, playerId, role);
      showMessage(`Member promoted to ${role}.`, 'success');
      await fetchMyAlliance();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to promote', 'error');
    }
  };

  const handleProposeDiplomacy = async (targetAllianceId: string, type: string) => {
    if (!myAlliance) return;
    try {
      await api.proposeDiplomacy(myAlliance.id, targetAllianceId, type);
      showMessage(`Diplomacy proposal sent: ${type}`, 'success');
      const dipData = await api.getDiplomacy(myAlliance.id);
      setDiplomacy(dipData.relations ?? []);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to propose diplomacy', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--ruin-grey)]">
        Loading alliance data...
      </div>
    );
  }

  const myRole = myAlliance?.members.find((m) => m.id === player?.id)?.role;
  const isLeaderOrOfficer = myRole === 'leader' || myRole === 'officer';

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Status message */}
        {message && (
          <div className={`mb-4 p-3 rounded text-sm ${
            message.type === 'success'
              ? 'bg-green-900/30 border border-green-700/50 text-green-300'
              : 'bg-red-900/30 border border-red-700/50 text-red-300'
          }`}>
            {message.text}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded text-sm bg-red-900/30 border border-red-700/50 text-red-300">
            {error}
          </div>
        )}

        {/* Back button when viewing details */}
        {viewState === 'view-details' && (
          <button
            onClick={() => setViewState(myAlliance ? 'has-alliance' : 'no-alliance')}
            className="mb-4 text-sm text-[var(--aether-violet)] hover:text-[var(--parchment)] transition-colors"
          >
            &larr; Back
          </button>
        )}

        {viewState === 'no-alliance' && (
          <NoAllianceView
            onCreated={fetchMyAlliance}
            onViewAlliance={handleViewAlliance}
            onJoin={handleJoin}
            showMessage={showMessage}
          />
        )}

        {viewState === 'has-alliance' && myAlliance && (
          <HasAllianceView
            alliance={myAlliance}
            playerId={player?.id ?? ''}
            myRole={myRole ?? 'member'}
            isLeaderOrOfficer={isLeaderOrOfficer}
            diplomacy={diplomacy}
            onKick={handleKick}
            onPromote={handlePromote}
            onLeave={handleLeave}
            onProposeDiplomacy={handleProposeDiplomacy}
            onViewAlliance={handleViewAlliance}
          />
        )}

        {viewState === 'view-details' && viewedAlliance && (
          <AllianceDetailsView
            alliance={viewedAlliance}
            canJoin={!myAlliance}
            onJoin={handleJoin}
          />
        )}
      </div>
    </div>
  );
}

/* ─── No Alliance View ─── */

function NoAllianceView({
  onCreated,
  onViewAlliance,
  onJoin,
  showMessage,
}: {
  onCreated: () => void;
  onViewAlliance: (id: string) => void;
  onJoin: (id: string) => void;
  showMessage: (text: string, type: 'success' | 'error') => void;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <h2 className="text-2xl mb-6" style={{ fontFamily: 'Cinzel, serif' }}>Alliance</h2>

      <div className="mb-6 p-4 rounded-lg border border-[var(--ember-gold)]/30 bg-[var(--ember-gold)]/5">
        <p className="text-sm text-[var(--parchment)] italic leading-relaxed">
          "Alone, even the mightiest stronghold falls. Seek allies among the factions,
          or forge your own banner and let others rally to your cause."
        </p>
      </div>

      <div className="flex gap-3 mb-8">
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--aether-violet)]/20 border border-[var(--aether-violet)]/50 text-[var(--parchment)] hover:bg-[var(--aether-violet)]/40 transition-colors"
        >
          Create Alliance
        </button>
      </div>

      {showCreate && (
        <CreateAllianceForm
          onCreated={() => { setShowCreate(false); onCreated(); }}
          onCancel={() => setShowCreate(false)}
          showMessage={showMessage}
        />
      )}

      <AllianceSearch onViewAlliance={onViewAlliance} onJoin={onJoin} />
    </>
  );
}

/* ─── Create Alliance Form ─── */

function CreateAllianceForm({
  onCreated,
  onCancel,
  showMessage,
}: {
  onCreated: () => void;
  onCancel: () => void;
  showMessage: (text: string, type: 'success' | 'error') => void;
}) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [color1, setColor1] = useState(BANNER_COLORS[0]);
  const [color2, setColor2] = useState(BANNER_COLORS[1]);
  const [icon, setIcon] = useState(BANNER_ICONS[0].key);
  const [submitting, setSubmitting] = useState(false);

  const isValid = name.length >= 3 && name.length <= 30 && tag.length >= 2 && tag.length <= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await api.createAlliance({
        name,
        tag: tag.toUpperCase(),
        description,
        banner: { color1, color2, icon },
      });
      showMessage('Alliance created!', 'success');
      onCreated();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to create alliance', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedIconEmoji = BANNER_ICONS.find((i) => i.key === icon)?.emoji ?? '';

  return (
    <form onSubmit={handleSubmit} className="mb-8 p-5 rounded-lg border border-[var(--ruin-grey)]/30 bg-[var(--veil-blue)]/40">
      <h3 className="text-lg mb-4" style={{ fontFamily: 'Cinzel, serif', color: 'var(--ember-gold)' }}>
        Create Alliance
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs text-[var(--parchment-dim)] mb-1">Alliance Name (3-30 chars)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            className="w-full px-3 py-2 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/30 text-[var(--parchment)] text-sm focus:outline-none focus:border-[var(--aether-violet)]/60"
            placeholder="Enter alliance name"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--parchment-dim)] mb-1">Tag (2-5 chars, uppercase)</label>
          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 5))}
            maxLength={5}
            className="w-full px-3 py-2 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/30 text-[var(--parchment)] text-sm focus:outline-none focus:border-[var(--aether-violet)]/60 uppercase"
            placeholder="TAG"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs text-[var(--parchment-dim)] mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/30 text-[var(--parchment)] text-sm focus:outline-none focus:border-[var(--aether-violet)]/60 resize-none"
          placeholder="Describe your alliance..."
        />
      </div>

      {/* Banner Preview */}
      <div className="mb-4">
        <label className="block text-xs text-[var(--parchment-dim)] mb-2">Banner</label>
        <div className="flex items-center gap-4 mb-3">
          <div
            className="w-16 h-20 rounded-lg flex items-center justify-center text-2xl border border-white/10"
            style={{ background: `linear-gradient(135deg, ${color1}, ${color2})` }}
          >
            {selectedIconEmoji}
          </div>
          <div className="text-sm text-[var(--parchment-dim)]">
            [{tag || '???'}] {name || 'Alliance Name'}
          </div>
        </div>

        {/* Color Pickers */}
        <div className="flex gap-4 mb-3">
          <div>
            <span className="text-xs text-[var(--ruin-grey)] block mb-1">Primary Color</span>
            <div className="flex gap-1.5 flex-wrap">
              {BANNER_COLORS.map((c) => (
                <button
                  key={`c1-${c}`}
                  type="button"
                  onClick={() => setColor1(c)}
                  className={`w-6 h-6 rounded border-2 transition-all ${color1 === c ? 'border-[var(--ember-gold)] scale-110' : 'border-transparent hover:border-white/30'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-[var(--ruin-grey)] block mb-1">Secondary Color</span>
            <div className="flex gap-1.5 flex-wrap">
              {BANNER_COLORS.map((c) => (
                <button
                  key={`c2-${c}`}
                  type="button"
                  onClick={() => setColor2(c)}
                  className={`w-6 h-6 rounded border-2 transition-all ${color2 === c ? 'border-[var(--ember-gold)] scale-110' : 'border-transparent hover:border-white/30'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Icon Selector */}
        <div>
          <span className="text-xs text-[var(--ruin-grey)] block mb-1">Icon</span>
          <div className="flex gap-2">
            {BANNER_ICONS.map((i) => (
              <button
                key={i.key}
                type="button"
                onClick={() => setIcon(i.key)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                  icon === i.key
                    ? 'bg-[var(--aether-violet)]/30 border border-[var(--aether-violet)]/60 scale-110'
                    : 'bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/20 hover:border-[var(--ruin-grey)]/50'
                }`}
              >
                {i.emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!isValid || submitting}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            isValid && !submitting
              ? 'bg-[var(--aether-violet)]/30 border border-[var(--aether-violet)]/50 text-[var(--parchment)] hover:bg-[var(--aether-violet)]/50'
              : 'bg-[var(--ruin-grey)]/20 border border-[var(--ruin-grey)]/20 text-[var(--ruin-grey)] cursor-not-allowed'
          }`}
        >
          {submitting ? 'Creating...' : 'Create Alliance'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded text-sm text-[var(--ruin-grey)] hover:text-[var(--parchment)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ─── Alliance Search ─── */

function AllianceSearch({
  onViewAlliance,
  onJoin,
}: {
  onViewAlliance: (id: string) => void;
  onJoin: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await api.searchAlliances(query);
      setResults(data.alliances ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg mb-3" style={{ fontFamily: 'Cinzel, serif' }}>Find Alliances</h3>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 px-3 py-2 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/30 text-[var(--parchment)] text-sm focus:outline-none focus:border-[var(--aether-violet)]/60"
          placeholder="Search by name or tag..."
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="px-4 py-2 rounded text-sm bg-[var(--veil-blue)] border border-[var(--ruin-grey)]/30 text-[var(--parchment)] hover:border-[var(--aether-violet)]/50 transition-colors"
        >
          {searching ? '...' : 'Search'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between p-3 rounded-lg border border-[var(--ruin-grey)]/20 bg-[var(--veil-blue)]/40 hover:border-[var(--aether-violet)]/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[var(--ember-gold)] bg-[var(--ember-gold)]/10 px-2 py-1 rounded">
                  [{a.tag}]
                </span>
                <div>
                  <span className="text-sm text-[var(--parchment)]">{a.name}</span>
                  <span className="text-xs text-[var(--ruin-grey)] ml-2">
                    {a.memberCount} members &middot; Led by {a.leaderName}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onViewAlliance(a.id)}
                  className="px-3 py-1 rounded text-xs text-[var(--parchment-dim)] border border-[var(--ruin-grey)]/30 hover:border-[var(--aether-violet)]/50 transition-colors"
                >
                  View
                </button>
                <button
                  onClick={() => onJoin(a.id)}
                  className="px-3 py-1 rounded text-xs text-[var(--parchment)] bg-[var(--aether-violet)]/20 border border-[var(--aether-violet)]/40 hover:bg-[var(--aether-violet)]/40 transition-colors"
                >
                  Join
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Has Alliance View ─── */

function HasAllianceView({
  alliance,
  playerId,
  myRole,
  isLeaderOrOfficer,
  diplomacy,
  onKick,
  onPromote,
  onLeave,
  onProposeDiplomacy,
  onViewAlliance,
}: {
  alliance: Alliance;
  playerId: string;
  myRole: string;
  isLeaderOrOfficer: boolean;
  diplomacy: DiplomacyRelation[];
  onKick: (id: string) => void;
  onPromote: (id: string, role: string) => void;
  onLeave: () => void;
  onProposeDiplomacy: (targetAllianceId: string, type: string) => void;
  onViewAlliance: (id: string) => void;
}) {
  const [showDiplomacyForm, setShowDiplomacyForm] = useState(false);
  const [dipTargetId, setDipTargetId] = useState('');
  const [dipType, setDipType] = useState('ally');

  const bannerIcon = BANNER_ICONS.find((i) => i.key === alliance.banner?.icon)?.emoji ?? '';

  return (
    <>
      {/* Alliance Header */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-16 h-20 rounded-lg flex items-center justify-center text-2xl border border-white/10 shrink-0"
          style={{
            background: alliance.banner
              ? `linear-gradient(135deg, ${alliance.banner.color1}, ${alliance.banner.color2})`
              : 'var(--veil-blue)',
          }}
        >
          {bannerIcon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--ember-gold)] bg-[var(--ember-gold)]/10 px-2 py-0.5 rounded">
              [{alliance.tag}]
            </span>
            <h2 className="text-2xl" style={{ fontFamily: 'Cinzel, serif' }}>{alliance.name}</h2>
          </div>
          {alliance.description && (
            <p className="text-sm text-[var(--parchment-dim)] mt-1">{alliance.description}</p>
          )}
          <p className="text-xs text-[var(--ruin-grey)] mt-1">
            {alliance.members.length} members &middot; Your role: {ROLE_STYLES[myRole]?.label ?? myRole}
          </p>
        </div>
      </div>

      {/* Members */}
      <div className="mb-6">
        <h3 className="text-lg mb-3" style={{ fontFamily: 'Cinzel, serif' }}>Members</h3>
        <div className="space-y-1">
          {alliance.members
            .sort((a, b) => {
              const order = { leader: 0, officer: 1, member: 2 };
              return (order[a.role as keyof typeof order] ?? 3) - (order[b.role as keyof typeof order] ?? 3);
            })
            .map((member) => {
              const roleStyle = ROLE_STYLES[member.role] ?? ROLE_STYLES.member;
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--ruin-grey)]/15 bg-[var(--veil-blue)]/30"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                      style={{ color: roleStyle.color, background: `color-mix(in srgb, ${roleStyle.color} 15%, transparent)` }}
                    >
                      {roleStyle.label}
                    </span>
                    <span className="text-sm text-[var(--parchment)]">{member.username}</span>
                    <span className="text-xs text-[var(--ruin-grey)]">{member.faction}</span>
                  </div>
                  {isLeaderOrOfficer && member.id !== playerId && member.role !== 'leader' && (
                    <div className="flex gap-2">
                      {myRole === 'leader' && member.role === 'member' && (
                        <button
                          onClick={() => onPromote(member.id, 'officer')}
                          className="px-2 py-1 rounded text-[10px] text-[var(--aether-violet)] border border-[var(--aether-violet)]/30 hover:bg-[var(--aether-violet)]/20 transition-colors"
                        >
                          Promote
                        </button>
                      )}
                      {myRole === 'leader' && member.role === 'officer' && (
                        <button
                          onClick={() => onPromote(member.id, 'member')}
                          className="px-2 py-1 rounded text-[10px] text-[var(--ruin-grey)] border border-[var(--ruin-grey)]/30 hover:bg-[var(--ruin-grey)]/20 transition-colors"
                        >
                          Demote
                        </button>
                      )}
                      <button
                        onClick={() => onKick(member.id)}
                        className="px-2 py-1 rounded text-[10px] text-red-400 border border-red-700/30 hover:bg-red-900/20 transition-colors"
                      >
                        Kick
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Diplomacy */}
      <div className="mb-6">
        <h3 className="text-lg mb-3" style={{ fontFamily: 'Cinzel, serif' }}>Diplomacy</h3>
        {diplomacy.length > 0 ? (
          <div className="space-y-2 mb-4">
            {diplomacy.map((rel) => {
              const style = RELATION_STYLES[rel.type] ?? RELATION_STYLES.nap;
              return (
                <div
                  key={rel.targetAllianceId}
                  className={`flex items-center justify-between p-3 rounded-lg border ${style.border} ${style.bg}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold ${style.color}`}>{style.label}</span>
                    <button
                      onClick={() => onViewAlliance(rel.targetAllianceId)}
                      className="text-sm text-[var(--parchment)] hover:text-[var(--aether-violet)] transition-colors"
                    >
                      [{rel.targetAllianceTag}] {rel.targetAllianceName}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--ruin-grey)] mb-4">No diplomatic relations yet.</p>
        )}

        {isLeaderOrOfficer && (
          <>
            {!showDiplomacyForm ? (
              <button
                onClick={() => setShowDiplomacyForm(true)}
                className="px-3 py-1.5 rounded text-xs text-[var(--parchment)] bg-[var(--veil-blue)] border border-[var(--ruin-grey)]/30 hover:border-[var(--aether-violet)]/50 transition-colors"
              >
                Propose Diplomacy
              </button>
            ) : (
              <div className="p-4 rounded-lg border border-[var(--ruin-grey)]/30 bg-[var(--veil-blue)]/40">
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={dipTargetId}
                    onChange={(e) => setDipTargetId(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/30 text-[var(--parchment)] text-sm focus:outline-none focus:border-[var(--aether-violet)]/60"
                    placeholder="Target Alliance ID"
                  />
                  <select
                    value={dipType}
                    onChange={(e) => setDipType(e.target.value)}
                    className="px-3 py-1.5 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/30 text-[var(--parchment)] text-sm focus:outline-none"
                  >
                    <option value="ally">Ally</option>
                    <option value="nap">NAP</option>
                    <option value="war">War</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { onProposeDiplomacy(dipTargetId, dipType); setShowDiplomacyForm(false); setDipTargetId(''); }}
                    className="px-3 py-1.5 rounded text-xs text-[var(--parchment)] bg-[var(--aether-violet)]/20 border border-[var(--aether-violet)]/40 hover:bg-[var(--aether-violet)]/40 transition-colors"
                  >
                    Send Proposal
                  </button>
                  <button
                    onClick={() => setShowDiplomacyForm(false)}
                    className="px-3 py-1.5 rounded text-xs text-[var(--ruin-grey)] hover:text-[var(--parchment)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Leave Button */}
      <div className="pt-4 border-t border-[var(--ruin-grey)]/20">
        <button
          onClick={onLeave}
          className="px-4 py-2 rounded text-sm text-red-400 border border-red-700/30 hover:bg-red-900/20 transition-colors"
        >
          Leave Alliance
        </button>
      </div>
    </>
  );
}

/* ─── Alliance Details View ─── */

function AllianceDetailsView({
  alliance,
  canJoin,
  onJoin,
}: {
  alliance: Alliance;
  canJoin: boolean;
  onJoin: (id: string) => void;
}) {
  const bannerIcon = BANNER_ICONS.find((i) => i.key === alliance.banner?.icon)?.emoji ?? '';

  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-16 h-20 rounded-lg flex items-center justify-center text-2xl border border-white/10 shrink-0"
          style={{
            background: alliance.banner
              ? `linear-gradient(135deg, ${alliance.banner.color1}, ${alliance.banner.color2})`
              : 'var(--veil-blue)',
          }}
        >
          {bannerIcon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--ember-gold)] bg-[var(--ember-gold)]/10 px-2 py-0.5 rounded">
              [{alliance.tag}]
            </span>
            <h2 className="text-2xl" style={{ fontFamily: 'Cinzel, serif' }}>{alliance.name}</h2>
          </div>
          {alliance.description && (
            <p className="text-sm text-[var(--parchment-dim)] mt-1">{alliance.description}</p>
          )}
          <p className="text-xs text-[var(--ruin-grey)] mt-1">
            {alliance.memberCount ?? alliance.members?.length ?? 0} members
          </p>
        </div>
      </div>

      {/* Public member list */}
      {alliance.members && alliance.members.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg mb-3" style={{ fontFamily: 'Cinzel, serif' }}>Members</h3>
          <div className="space-y-1">
            {alliance.members.map((member) => {
              const roleStyle = ROLE_STYLES[member.role] ?? ROLE_STYLES.member;
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[var(--ruin-grey)]/15 bg-[var(--veil-blue)]/30"
                >
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                    style={{ color: roleStyle.color, background: `color-mix(in srgb, ${roleStyle.color} 15%, transparent)` }}
                  >
                    {roleStyle.label}
                  </span>
                  <span className="text-sm text-[var(--parchment)]">{member.username}</span>
                  <span className="text-xs text-[var(--ruin-grey)]">{member.faction}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {canJoin && (
        <button
          onClick={() => onJoin(alliance.id)}
          className="px-4 py-2 rounded text-sm font-medium text-[var(--parchment)] bg-[var(--aether-violet)]/20 border border-[var(--aether-violet)]/50 hover:bg-[var(--aether-violet)]/40 transition-colors"
        >
          Join Alliance
        </button>
      )}
    </>
  );
}
