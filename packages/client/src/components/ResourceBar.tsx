import { useState, useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '../stores/game-store.js';
import { useAuthStore } from '../stores/auth-store.js';
import { useAudioStore } from '../stores/audio-store.js';
import { STARTING_RESOURCES } from '@veilfall/shared';
import NotificationBell from './NotificationBell.js';
import { api } from '../lib/api.js';

const RESOURCE_ORDER = ['food', 'wood', 'stone', 'iron', 'aether_stone'] as const;

const RESOURCE_ICONS: Record<string, string> = {
  food: '\u{1F33E}',
  wood: '\u{1FAB5}',
  stone: '\u{1FAA8}',
  iron: '\u{2699}',
  aether_stone: '\u{1F48E}',
};

const RESOURCE_LABELS: Record<string, string> = {
  food: 'Food',
  wood: 'Wood',
  stone: 'Stone',
  iron: 'Iron',
  aether_stone: 'Aether',
};

const RESOURCE_RATES: Record<string, Record<string, number>> = {
  gathering_post:   { food: 30 },
  woodcutter_lodge: { wood: 25 },
  stone_quarry:     { stone: 20 },
  iron_mine:        { iron: 15 },
  aether_extractor: { aether_stone: 5 },
};

function calculateProductionRates(
  buildings: Array<{ type: string; level: number; position: number }>,
): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const building of buildings) {
    const production = RESOURCE_RATES[building.type];
    if (!production) continue;
    for (const [resource, baseRate] of Object.entries(production)) {
      rates[resource] = (rates[resource] ?? 0) + baseRate * building.level;
    }
  }
  return rates;
}

/** Hook that interpolates resources between server polls using production rates */
function useInterpolatedResources(
  serverResources: Record<string, number>,
  productionRates: Record<string, number>,
): Record<string, number> {
  const [displayed, setDisplayed] = useState(serverResources);
  const baseRef = useRef(serverResources);
  const baseTimeRef = useRef(Date.now());

  // When server data arrives, reset the base
  useEffect(() => {
    baseRef.current = serverResources;
    baseTimeRef.current = Date.now();
    setDisplayed(serverResources);
  }, [serverResources]);

  // Tick every second to interpolate
  useEffect(() => {
    const hasProduction = Object.values(productionRates).some((r) => r > 0);
    if (!hasProduction) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - baseTimeRef.current) / 1000; // seconds
      const interpolated: Record<string, number> = {};
      for (const [key, baseValue] of Object.entries(baseRef.current)) {
        const rate = productionRates[key] ?? 0;
        // rate is per hour, convert to per second
        interpolated[key] = (baseValue as number) + (rate / 3600) * elapsed;
      }
      setDisplayed(interpolated);
    }, 1000);

    return () => clearInterval(interval);
  }, [productionRates]);

  return displayed;
}

export default function ResourceBar() {
  const player = useAuthStore((s) => s.player);
  const settlements = useGameStore((s) => s.settlements);
  const activeSettlementId = useGameStore((s) => s.activeSettlementId);
  const setActiveSettlement = useGameStore((s) => s.setActiveSettlement);
  const setActivePanel = useGameStore((s) => s.setActivePanel);
  const [showSettlementDropdown, setShowSettlementDropdown] = useState(false);
  const settlementDropdownRef = useRef<HTMLDivElement>(null);

  const handleSettlementSwitch = useCallback(
    (id: string) => {
      setActiveSettlement(id);
      setShowSettlementDropdown(false);
    },
    [setActiveSettlement],
  );

  // Close settlement dropdown on outside click
  useEffect(() => {
    if (!showSettlementDropdown) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        settlementDropdownRef.current &&
        !settlementDropdownRef.current.contains(e.target as Node)
      ) {
        setShowSettlementDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettlementDropdown]);
  const musicEnabled = useAudioStore((s) => s.musicEnabled);
  const toggleMusic = useAudioStore((s) => s.toggleMusic);

  // Aether cycle state
  const [aetherCycle, setAetherCycle] = useState<{ phase: string; nextChangeAt: number } | null>(null);
  const [aetherCountdown, setAetherCountdown] = useState('');

  useEffect(() => {
    const fetchCycle = () => {
      api.getAetherCycle().then(setAetherCycle).catch(() => {});
    };
    fetchCycle();
    const interval = setInterval(fetchCycle, 15_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!aetherCycle) return;
    const tick = () => {
      const remaining = Math.max(0, aetherCycle.nextChangeAt - Date.now());
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setAetherCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [aetherCycle]);

  const activeSettlement = settlements.find((s) => s.id === activeSettlementId);
  const serverResources = activeSettlement?.resources ?? STARTING_RESOURCES;
  const productionRates = activeSettlement
    ? calculateProductionRates(activeSettlement.buildings)
    : {};

  // Interpolate resources in real-time between server polls
  const resources = useInterpolatedResources(serverResources, productionRates);

  return (
    <div
      data-tutorial="resource-bar"
      className="flex items-center justify-between px-4 py-2 border-b border-[var(--ruin-grey)]/20"
      style={{ background: 'rgba(26, 39, 68, 0.95)' }}
    >
      {/* Resources */}
      <div className="flex gap-5">
        {RESOURCE_ORDER.map((key) => {
          const value = resources[key] ?? 0;
          const rate = productionRates[key] ?? 0;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className="text-sm">{RESOURCE_ICONS[key]}</span>
              <span className="text-xs text-[var(--parchment-dim)]">{RESOURCE_LABELS[key]}</span>
              <span className="text-sm font-semibold text-[var(--parchment)] tabular-nums">
                {Math.floor(value as number).toLocaleString()}
              </span>
              {rate > 0 && (
                <span className="text-xs text-green-400/80 tabular-nums">
                  +{rate}/hr
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Aether Cycle Indicator */}
      {aetherCycle && (
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs ${
            aetherCycle.phase === 'surge'
              ? 'border-[#63B3ED]/50 bg-[#63B3ED]/10'
              : 'border-[var(--ruin-grey)]/20 bg-[var(--veil-blue)]/30'
          }`}
          title={aetherCycle.phase === 'surge' ? 'Aether Surge active! 3x aether production' : 'Aether dormant - next surge coming'}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              aetherCycle.phase === 'surge' ? 'bg-[#63B3ED]' : 'bg-[var(--ruin-grey)]/40'
            }`}
            style={aetherCycle.phase === 'surge' ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}}
          />
          <span className={aetherCycle.phase === 'surge' ? 'text-[#63B3ED] font-semibold' : 'text-[var(--parchment-dim)]'}>
            {aetherCycle.phase === 'surge' ? 'SURGE' : 'Dormant'}
          </span>
          <span className="text-[var(--parchment-dim)]/60 tabular-nums">{aetherCountdown}</span>
        </div>
      )}

      {/* Player Info + Stats */}
      <div className="flex items-center gap-3">
        {/* Audio toggle */}
        <button
          onClick={toggleMusic}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            musicEnabled
              ? 'bg-[var(--veil-blue)]/50 border-[var(--ruin-grey)]/20 text-[var(--parchment-dim)] hover:text-[var(--parchment)]'
              : 'bg-red-900/20 border-red-700/30 text-red-400 hover:text-red-300'
          }`}
          title={musicEnabled ? 'Mute Music' : 'Unmute Music'}
        >
          {musicEnabled ? '\u{1F50A}' : '\u{1F507}'}
        </button>

        {/* Notification bell */}
        <NotificationBell />

        {/* Stats / Profile button */}
        <button
          onClick={() => setActivePanel('profile')}
          className="text-xs px-2 py-1 rounded border transition-colors bg-[var(--veil-blue)]/50 border-[var(--ruin-grey)]/20 text-[var(--parchment-dim)] hover:text-[var(--ember-gold)] hover:border-[var(--ember-gold)]/30"
          title="Player Profile"
        >
          {'\u{1F4CA}'}
        </button>

        {/* Settlement switcher dropdown */}
        <div className="relative" ref={settlementDropdownRef}>
          <button
            onClick={() => {
              if (settlements.length > 1) setShowSettlementDropdown((v) => !v);
            }}
            className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded border transition-colors ${
              showSettlementDropdown
                ? 'bg-[var(--ember-gold)]/15 border-[var(--ember-gold)]/40 text-[var(--ember-gold)]'
                : settlements.length > 1
                  ? 'bg-[var(--veil-blue)]/50 border-[var(--ruin-grey)]/20 text-[var(--parchment-dim)] hover:text-[var(--ember-gold)] hover:border-[var(--ember-gold)]/30'
                  : 'bg-transparent border-transparent text-[var(--parchment-dim)] cursor-default'
            }`}
            style={{ fontFamily: 'Cinzel, serif' }}
            title={settlements.length > 1 ? 'Switch Settlement' : undefined}
          >
            <span>{activeSettlement?.name ?? 'No Settlement'}</span>
            {activeSettlement && (
              <span className="text-[10px] text-[var(--ember-gold)]/70 ml-0.5">
                Lv.{activeSettlement.level ?? 1}
              </span>
            )}
            {settlements.length > 1 && (
              <span
                className="text-[10px] ml-1 transition-transform"
                style={{
                  display: 'inline-block',
                  transform: showSettlementDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                ▼
              </span>
            )}
          </button>

          {showSettlementDropdown && settlements.length > 1 && (
            <div
              className="absolute top-full right-0 mt-2 w-64 rounded-lg border border-[var(--ruin-grey)]/30 bg-[var(--veil-blue)]/95 backdrop-blur-sm z-50 overflow-hidden"
              style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)' }}
            >
              <div
                className="px-3 py-2 border-b border-[var(--ruin-grey)]/15"
              >
                <span
                  className="text-[10px] font-semibold text-[var(--ember-gold)] uppercase tracking-wider"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  Your Settlements
                </span>
              </div>
              {settlements.map((s) => {
                const isActive = s.id === activeSettlementId;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSettlementSwitch(s.id)}
                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors ${
                      isActive
                        ? 'bg-[var(--ember-gold)]/10 border-l-2 border-l-[var(--ember-gold)]'
                        : 'border-l-2 border-l-transparent hover:bg-[var(--aether-violet)]/10 hover:border-l-[var(--aether-violet)]'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span
                        className={`text-sm ${
                          isActive
                            ? 'text-[var(--ember-gold)] font-semibold'
                            : 'text-[var(--parchment-dim)]'
                        }`}
                        style={{ fontFamily: 'Cinzel, serif' }}
                      >
                        {s.name}
                      </span>
                      <span className="text-[10px] text-[var(--ruin-grey)]">
                        ({s.coordinates.q}, {s.coordinates.r})
                      </span>
                    </div>
                    <span
                      className={`text-xs tabular-nums ${
                        isActive
                          ? 'text-[var(--ember-gold)]/80'
                          : 'text-[var(--parchment-dim)]/60'
                      }`}
                    >
                      Lv.{s.level ?? 1}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-[var(--aether-violet)]/20 text-[var(--aether-violet)]">
          {player?.faction}
        </span>
        <span className="text-sm font-medium">{player?.username}</span>
      </div>
    </div>
  );
}
