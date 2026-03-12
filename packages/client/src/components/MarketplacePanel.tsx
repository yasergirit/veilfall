import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../stores/game-store.js';
import { useAuthStore } from '../stores/auth-store.js';
import { api } from '../lib/api.js';
import { useToastStore } from '../stores/toast-store.js';

const RESOURCES = ['food', 'wood', 'stone', 'iron', 'aether_stone'] as const;

const RESOURCE_LABELS: Record<string, string> = {
  food: 'Food',
  wood: 'Wood',
  stone: 'Stone',
  iron: 'Iron',
  aether_stone: 'Aether Stone',
};

const RESOURCE_ICONS: Record<string, string> = {
  food: '\u{1F33E}',
  wood: '\u{1FAB5}',
  stone: '\u{1FAA8}',
  iron: '\u{2699}',
  aether_stone: '\u{1F48E}',
};

interface TradeOffer {
  id: string;
  sellerId: string;
  sellerName: string;
  offerResource: string;
  offerAmount: number;
  requestResource: string;
  requestAmount: number;
  createdAt: number;
}

interface TradeRecord {
  id: string;
  offerResource: string;
  offerAmount: number;
  requestResource: string;
  requestAmount: number;
  otherPlayerName: string;
  completedAt: number;
}

type Tab = 'create' | 'browse';

export default function MarketplacePanel() {
  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const settlements = useGameStore((s) => s.settlements);
  const activeSettlementId = useGameStore((s) => s.activeSettlementId);
  const activeSettlement = settlements.find((s) => s.id === activeSettlementId);
  const player = useAuthStore((s) => s.player);

  const hasMarketplace = activeSettlement?.buildings.some(
    (b) => b.type === 'marketplace',
  );

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl mb-1" style={{ fontFamily: 'Cinzel, serif' }}>
            {'\u{1F3EA}'} Marketplace
          </h2>
          <p className="text-[var(--parchment-dim)] text-sm">
            Trade resources with other settlements across the realm.
          </p>
        </div>

        {/* Marketplace not built warning */}
        {!hasMarketplace && (
          <div className="mb-6 p-4 rounded-lg border border-[var(--ember-gold)]/30 bg-[var(--ember-gold)]/5">
            <p className="text-sm text-[var(--parchment)] italic leading-relaxed">
              "You must build a Marketplace in your settlement before you can trade with others.
              The merchants will come once they see a place to set up their stalls."
            </p>
            <p className="text-xs text-[var(--ember-gold)] mt-2">
              -- Build a Marketplace first to unlock trading.
            </p>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 mb-6 p-1 rounded-lg bg-[var(--veil-blue)]/50 border border-[var(--ruin-grey)]/20 w-fit">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'create'
                ? 'bg-[var(--aether-violet)]/25 text-[var(--parchment)] border border-[var(--aether-violet)]/40'
                : 'text-[var(--parchment-dim)] hover:text-[var(--parchment)] border border-transparent'
            }`}
          >
            Create Offer
          </button>
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'browse'
                ? 'bg-[var(--aether-violet)]/25 text-[var(--parchment)] border border-[var(--aether-violet)]/40'
                : 'text-[var(--parchment-dim)] hover:text-[var(--parchment)] border border-transparent'
            }`}
          >
            Browse Offers
          </button>
        </div>

        {activeTab === 'create' && (
          <CreateOfferTab
            hasMarketplace={!!hasMarketplace}
            settlements={settlements}
            activeSettlementId={activeSettlementId}
          />
        )}
        {activeTab === 'browse' && (
          <BrowseOffersTab
            hasMarketplace={!!hasMarketplace}
            playerId={player?.id ?? ''}
          />
        )}

        {/* Trade History */}
        <TradeHistory />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Offer Tab                                                   */
/* ------------------------------------------------------------------ */

function CreateOfferTab({
  hasMarketplace,
  settlements,
  activeSettlementId,
}: {
  hasMarketplace: boolean;
  settlements: Array<{ id: string; name: string; resources: Record<string, number> }>;
  activeSettlementId: string | null;
}) {
  const addToast = useToastStore((s) => s.addToast);
  const setSettlements = useGameStore((s) => s.setSettlements);

  const [selectedSettlementId, setSelectedSettlementId] = useState(activeSettlementId ?? '');
  const [offerResource, setOfferResource] = useState<string>(RESOURCES[0]);
  const [offerAmount, setOfferAmount] = useState<number>(0);
  const [requestResource, setRequestResource] = useState<string>(RESOURCES[1]);
  const [requestAmount, setRequestAmount] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  const selectedSettlement = settlements.find((s) => s.id === selectedSettlementId);

  // Ensure request resource differs from offer resource
  useEffect(() => {
    if (requestResource === offerResource) {
      const next = RESOURCES.find((r) => r !== offerResource);
      if (next) setRequestResource(next);
    }
  }, [offerResource, requestResource]);

  const exchangeRate =
    offerAmount > 0 && requestAmount > 0
      ? (requestAmount / offerAmount).toFixed(2)
      : null;

  const canAfford =
    selectedSettlement &&
    offerAmount > 0 &&
    ((selectedSettlement.resources as Record<string, number>)[offerResource] ?? 0) >= offerAmount;

  const handleSubmit = async () => {
    if (!hasMarketplace || !canAfford || submitting || offerAmount <= 0 || requestAmount <= 0) return;
    setSubmitting(true);
    try {
      const result = await api.createTradeOffer({
        settlementId: selectedSettlementId,
        offerResource,
        offerAmount,
        requestResource,
        requestAmount,
      });
      addToast({ message: result.message ?? 'Trade offer posted!', type: 'success' });
      setOfferAmount(0);
      setRequestAmount(0);
      // Refresh settlements
      const data = await api.getSettlements();
      setSettlements(data.settlements);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to post offer';
      addToast({ message: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Settlement selector */}
      <div>
        <label className="block text-xs text-[var(--parchment-dim)] mb-1">Settlement</label>
        <select
          value={selectedSettlementId}
          onChange={(e) => setSelectedSettlementId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--veil-blue)]/60 border border-[var(--ruin-grey)]/30 text-[var(--parchment)] focus:outline-none focus:border-[var(--aether-violet)]/50"
        >
          {settlements.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Offer section */}
      <div className="p-4 rounded-lg border border-[var(--ruin-grey)]/20 bg-[var(--veil-blue)]/30">
        <h4 className="text-xs font-semibold text-[var(--ember-gold)] mb-3 uppercase tracking-wide">
          You Offer
        </h4>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-[var(--parchment-dim)] mb-1">Resource</label>
            <select
              value={offerResource}
              onChange={(e) => setOfferResource(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm bg-[var(--veil-blue)]/60 border border-[var(--ruin-grey)]/30 text-[var(--parchment)] focus:outline-none focus:border-[var(--aether-violet)]/50"
            >
              {RESOURCES.map((r) => (
                <option key={r} value={r}>
                  {RESOURCE_ICONS[r]} {RESOURCE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-[var(--parchment-dim)] mb-1">Amount</label>
            <input
              type="number"
              min={0}
              value={offerAmount || ''}
              onChange={(e) => setOfferAmount(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0"
              className="w-full px-3 py-2 rounded text-sm bg-[var(--veil-blue)]/60 border border-[var(--ruin-grey)]/30 text-[var(--parchment)] focus:outline-none focus:border-[var(--aether-violet)]/50"
            />
            {selectedSettlement && (
              <p className="text-[10px] text-[var(--ruin-grey)] mt-1">
                Available: {Math.floor((selectedSettlement.resources as Record<string, number>)[offerResource] ?? 0).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Exchange arrow */}
      <div className="flex items-center justify-center">
        <div className="text-[var(--ruin-grey)] text-lg">{'\u{2195}'}</div>
        {exchangeRate && (
          <span className="ml-3 text-xs text-[var(--aether-violet)]">
            1 {RESOURCE_LABELS[offerResource]} = {exchangeRate} {RESOURCE_LABELS[requestResource]}
          </span>
        )}
      </div>

      {/* Request section */}
      <div className="p-4 rounded-lg border border-[var(--ruin-grey)]/20 bg-[var(--veil-blue)]/30">
        <h4 className="text-xs font-semibold text-[var(--ember-gold)] mb-3 uppercase tracking-wide">
          You Want
        </h4>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-[var(--parchment-dim)] mb-1">Resource</label>
            <select
              value={requestResource}
              onChange={(e) => setRequestResource(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm bg-[var(--veil-blue)]/60 border border-[var(--ruin-grey)]/30 text-[var(--parchment)] focus:outline-none focus:border-[var(--aether-violet)]/50"
            >
              {RESOURCES.filter((r) => r !== offerResource).map((r) => (
                <option key={r} value={r}>
                  {RESOURCE_ICONS[r]} {RESOURCE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-[var(--parchment-dim)] mb-1">Amount</label>
            <input
              type="number"
              min={0}
              value={requestAmount || ''}
              onChange={(e) => setRequestAmount(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0"
              className="w-full px-3 py-2 rounded text-sm bg-[var(--veil-blue)]/60 border border-[var(--ruin-grey)]/30 text-[var(--parchment)] focus:outline-none focus:border-[var(--aether-violet)]/50"
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        disabled={!hasMarketplace || !canAfford || submitting || offerAmount <= 0 || requestAmount <= 0}
        onClick={handleSubmit}
        className={`w-full py-3 rounded-lg text-sm font-medium transition-colors ${
          hasMarketplace && canAfford && offerAmount > 0 && requestAmount > 0 && !submitting
            ? 'bg-[var(--aether-violet)]/30 border border-[var(--aether-violet)]/50 text-[var(--parchment)] hover:bg-[var(--aether-violet)]/50'
            : 'bg-[var(--ruin-grey)]/20 border border-[var(--ruin-grey)]/20 text-[var(--ruin-grey)] cursor-not-allowed'
        }`}
      >
        {submitting ? 'Posting...' : 'Post Offer'}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Browse Offers Tab                                                  */
/* ------------------------------------------------------------------ */

function BrowseOffersTab({
  hasMarketplace,
  playerId,
}: {
  hasMarketplace: boolean;
  playerId: string;
}) {
  const addToast = useToastStore((s) => s.addToast);
  const setSettlements = useGameStore((s) => s.setSettlements);
  const settlements = useGameStore((s) => s.settlements);
  const activeSettlementId = useGameStore((s) => s.activeSettlementId);
  const activeSettlement = settlements.find((s) => s.id === activeSettlementId);

  const [filter, setFilter] = useState<string>('');
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTradeOffers(filter || undefined);
      setOffers(data.offers ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const handleAccept = async (offerId: string) => {
    if (!hasMarketplace || actionId) return;
    setActionId(offerId);
    try {
      const result = await api.acceptTrade(offerId);
      addToast({ message: result.message ?? 'Trade accepted!', type: 'success' });
      fetchOffers();
      const data = await api.getSettlements();
      setSettlements(data.settlements);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to accept trade';
      addToast({ message: msg, type: 'error' });
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (offerId: string) => {
    if (actionId) return;
    setActionId(offerId);
    try {
      const result = await api.cancelTrade(offerId);
      addToast({ message: result.message ?? 'Offer cancelled.', type: 'info' });
      fetchOffers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel offer';
      addToast({ message: msg, type: 'error' });
    } finally {
      setActionId(null);
    }
  };

  const canAffordOffer = (offer: TradeOffer): boolean => {
    if (!activeSettlement) return false;
    return (
      ((activeSettlement.resources as Record<string, number>)[offer.requestResource] ?? 0) >=
      offer.requestAmount
    );
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-[var(--parchment-dim)]">Filter by:</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 rounded text-sm bg-[var(--veil-blue)]/60 border border-[var(--ruin-grey)]/30 text-[var(--parchment)] focus:outline-none focus:border-[var(--aether-violet)]/50"
        >
          <option value="">All Resources</option>
          {RESOURCES.map((r) => (
            <option key={r} value={r}>
              {RESOURCE_LABELS[r]}
            </option>
          ))}
        </select>
        <button
          onClick={fetchOffers}
          className="px-3 py-1.5 rounded text-xs bg-[var(--veil-blue)]/60 border border-[var(--ruin-grey)]/30 text-[var(--parchment-dim)] hover:text-[var(--parchment)] transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Offers list */}
      {loading ? (
        <div className="text-center py-8 text-[var(--ruin-grey)] text-sm">
          Loading offers...
        </div>
      ) : offers.length === 0 ? (
        <div className="text-center py-8 text-[var(--ruin-grey)] text-sm">
          No trade offers available. Be the first to post one!
        </div>
      ) : (
        <div className="space-y-2">
          {offers.map((offer) => {
            const isOwn = offer.sellerId === playerId;
            const affordable = canAffordOffer(offer);
            const ratio = offer.offerAmount > 0
              ? (offer.requestAmount / offer.offerAmount).toFixed(2)
              : '---';

            return (
              <div
                key={offer.id}
                className={`p-4 rounded-lg border transition-colors ${
                  isOwn
                    ? 'border-[var(--ember-gold)]/30 bg-[var(--ember-gold)]/5'
                    : 'border-[var(--ruin-grey)]/20 bg-[var(--veil-blue)]/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-[var(--parchment-dim)]">
                        {isOwn ? 'Your offer' : offer.sellerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[var(--parchment)]">
                        {RESOURCE_ICONS[offer.offerResource]} {offer.offerAmount.toLocaleString()} {RESOURCE_LABELS[offer.offerResource]}
                      </span>
                      <span className="text-[var(--ruin-grey)]">{'\u{2192}'}</span>
                      <span className="text-[var(--parchment)]">
                        {RESOURCE_ICONS[offer.requestResource]} {offer.requestAmount.toLocaleString()} {RESOURCE_LABELS[offer.requestResource]}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--ruin-grey)] mt-1 block">
                      Rate: 1 {RESOURCE_LABELS[offer.offerResource]} = {ratio} {RESOURCE_LABELS[offer.requestResource]}
                    </span>
                  </div>

                  <div>
                    {isOwn ? (
                      <button
                        disabled={actionId === offer.id}
                        onClick={() => handleCancel(offer.id)}
                        className="px-3 py-1.5 rounded text-xs font-medium bg-red-900/30 border border-red-700/40 text-red-300 hover:bg-red-900/50 transition-colors disabled:opacity-50"
                      >
                        {actionId === offer.id ? '...' : 'Cancel'}
                      </button>
                    ) : (
                      <button
                        disabled={!hasMarketplace || !affordable || actionId === offer.id}
                        onClick={() => handleAccept(offer.id)}
                        title={
                          !hasMarketplace
                            ? 'Build a Marketplace first'
                            : !affordable
                            ? 'Not enough resources'
                            : 'Accept this trade'
                        }
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                          hasMarketplace && affordable
                            ? 'bg-[var(--aether-violet)]/30 border border-[var(--aether-violet)]/50 text-[var(--parchment)] hover:bg-[var(--aether-violet)]/50'
                            : 'bg-[var(--ruin-grey)]/20 border border-[var(--ruin-grey)]/20 text-[var(--ruin-grey)] cursor-not-allowed'
                        }`}
                      >
                        {actionId === offer.id ? '...' : 'Accept'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Trade History                                                      */
/* ------------------------------------------------------------------ */

function TradeHistory() {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<TradeRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (expanded && !loaded) {
      api
        .getTradeHistory()
        .then((data) => {
          setHistory(data.trades ?? []);
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    }
  }, [expanded, loaded]);

  return (
    <div className="mt-8 border-t border-[var(--ruin-grey)]/20 pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-[var(--parchment-dim)] hover:text-[var(--parchment)] transition-colors w-full text-left"
      >
        <span
          className="text-xs transition-transform inline-block"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          {'\u{25B6}'}
        </span>
        Trade History
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {history.length === 0 ? (
            <p className="text-xs text-[var(--ruin-grey)] py-2">No trade history yet.</p>
          ) : (
            history.slice(0, 10).map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between p-3 rounded bg-[var(--veil-blue)]/30 border border-[var(--ruin-grey)]/15"
              >
                <div className="text-xs text-[var(--parchment)]">
                  {RESOURCE_ICONS[trade.offerResource]} {trade.offerAmount.toLocaleString()} {RESOURCE_LABELS[trade.offerResource]}
                  <span className="text-[var(--ruin-grey)] mx-2">{'\u{2194}'}</span>
                  {RESOURCE_ICONS[trade.requestResource]} {trade.requestAmount.toLocaleString()} {RESOURCE_LABELS[trade.requestResource]}
                  <span className="ml-2 text-[var(--parchment-dim)]">with {trade.otherPlayerName}</span>
                </div>
                <span className="text-[10px] text-[var(--ruin-grey)] tabular-nums">
                  {new Date(trade.completedAt).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
