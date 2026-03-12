import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import { useToastStore } from '../stores/toast-store.js';

const CLASS_INFO: Record<string, { icon: string; title: string; desc: string }> = {
  warlord:     { icon: '\u{2694}',  title: 'Warlord',     desc: 'Military commander. Leads armies from the front.' },
  sage:        { icon: '\u{1F52E}', title: 'Sage',        desc: 'Aether scholar. Accelerates lore and research.' },
  shadowblade: { icon: '\u{1F5E1}', title: 'Shadowblade', desc: 'Scout and saboteur. Unseen, unmatched.' },
  steward:     { icon: '\u{1F4DC}', title: 'Steward',     desc: 'Economic leader. Builds empires from rubble.' },
  herald:      { icon: '\u{1F3BA}', title: 'Herald',      desc: 'Diplomat and unifier. The voice of alliances.' },
  driftwalker: { icon: '\u{1F30C}', title: 'Driftwalker', desc: 'Explorer of the unknown. Walks where others fear.' },
};

const HERO_STATS = [
  { key: 'strength', label: 'Strength', color: '#e05555' },
  { key: 'intellect', label: 'Intellect', color: '#55a0e0' },
  { key: 'agility', label: 'Agility', color: '#55e080' },
  { key: 'endurance', label: 'Endurance', color: '#e0c050' },
];

const EQUIPMENT_SLOTS = [
  { key: 'weapon', label: 'Weapon', icon: '\u{2694}\u{FE0F}' },
  { key: 'armor', label: 'Armor', icon: '\u{1F6E1}\u{FE0F}' },
  { key: 'accessory', label: 'Accessory', icon: '\u{1F48D}' },
  { key: 'relic', label: 'Relic', icon: '\u{1F52E}' },
];

const RARITY_COLORS: Record<string, string> = {
  common: 'var(--ruin-grey)',
  rare: '#4A9EFF',
  epic: 'var(--aether-violet)',
  legendary: 'var(--ember-gold)',
};

const RARITY_BG: Record<string, string> = {
  common: 'rgba(107, 110, 115, 0.15)',
  rare: 'rgba(74, 158, 255, 0.15)',
  epic: 'rgba(123, 79, 191, 0.15)',
  legendary: 'rgba(212, 168, 67, 0.15)',
};

interface Hero {
  id: string;
  name: string;
  heroClass: string;
  level: number;
  xp: number;
  loyalty: number;
  status: string;
  stats?: Record<string, number>;
  equipment?: Record<string, EquipmentItem | null>;
}

interface Ability {
  id: string;
  name: string;
  description: string;
  effect: string;
  heroClass: string;
  levelRequired: number;
  unlocked: boolean;
}

interface EquipmentItem {
  id: string;
  name: string;
  slot: string;
  rarity: string;
  stats: Record<string, number>;
  description?: string;
}

export default function HeroPanel() {
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null);
  const [abilities, setAbilities] = useState<Ability[]>([]);
  const [inventoryItems, setInventoryItems] = useState<EquipmentItem[]>([]);
  const [equipMenuSlot, setEquipMenuSlot] = useState<string | null>(null);
  const addToast = useToastStore((s) => s.addToast);

  const fetchHeroes = useCallback(async () => {
    try {
      const data = await api.getHeroes();
      setHeroes(data.heroes);
      if (data.heroes.length > 0 && !selectedHero) {
        setSelectedHero(data.heroes[0]);
      } else if (selectedHero) {
        const updated = data.heroes.find((h: Hero) => h.id === selectedHero.id);
        if (updated) setSelectedHero(updated);
      }
    } catch {
      // ignore
    }
  }, [selectedHero]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getHeroes(),
      api.getHeroAbilities().catch(() => ({ abilities: [] })),
      api.getEquipmentItems().catch(() => ({ items: [] })),
    ]).then(([heroData, abilityData, itemData]) => {
      setHeroes(heroData.heroes);
      if (heroData.heroes.length > 0) setSelectedHero(heroData.heroes[0]);
      setAbilities(abilityData.abilities ?? []);
      setInventoryItems(itemData.items ?? []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleEquip = async (heroId: string, slot: string, itemId: string) => {
    try {
      await api.equipItem(heroId, slot, itemId);
      addToast({ message: 'Item equipped', type: 'success' });
      setEquipMenuSlot(null);
      // Refresh data
      const [heroData, itemData] = await Promise.all([
        api.getHeroes(),
        api.getEquipmentItems().catch(() => ({ items: [] })),
      ]);
      setHeroes(heroData.heroes);
      setInventoryItems(itemData.items ?? []);
      const updated = heroData.heroes.find((h: Hero) => h.id === heroId);
      if (updated) setSelectedHero(updated);
    } catch (err) {
      addToast({ message: err instanceof Error ? err.message : 'Failed to equip', type: 'error' });
    }
  };

  const handleUnequip = async (heroId: string, slot: string) => {
    try {
      await api.unequipItem(heroId, slot);
      addToast({ message: 'Item unequipped', type: 'success' });
      const [heroData, itemData] = await Promise.all([
        api.getHeroes(),
        api.getEquipmentItems().catch(() => ({ items: [] })),
      ]);
      setHeroes(heroData.heroes);
      setInventoryItems(itemData.items ?? []);
      const updated = heroData.heroes.find((h: Hero) => h.id === heroId);
      if (updated) setSelectedHero(updated);
    } catch (err) {
      addToast({ message: err instanceof Error ? err.message : 'Failed to unequip', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--ruin-grey)]">
        Loading heroes...
      </div>
    );
  }

  if (heroes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--ruin-grey)]">
        <p>No heroes recruited yet. Build a Hero Hall first.</p>
      </div>
    );
  }

  const info = selectedHero ? CLASS_INFO[selectedHero.heroClass] ?? CLASS_INFO.warlord : null;
  const heroAbilities = selectedHero
    ? abilities.filter((a) => a.heroClass === selectedHero.heroClass || a.heroClass === 'universal')
    : [];
  // Server returns equipment as string IDs — resolve them to item objects
  const rawEquipment = selectedHero?.equipment ?? {};
  const heroEquipment: Record<string, EquipmentItem | null> = {};
  for (const slot of ['weapon', 'armor', 'accessory', 'relic']) {
    const val = rawEquipment[slot];
    if (val && typeof val === 'string') {
      heroEquipment[slot] = inventoryItems.find((i) => i.id === val) ?? null;
    } else if (val && typeof val === 'object') {
      heroEquipment[slot] = val as EquipmentItem;
    } else {
      heroEquipment[slot] = null;
    }
  }

  // Derive stats with defaults based on hero level and class
  const getHeroStats = (hero: Hero): Record<string, number> => {
    if (hero.stats) return hero.stats;
    // Generate reasonable defaults based on class and level
    const base = hero.level * 5;
    const classBonus: Record<string, Record<string, number>> = {
      warlord: { strength: 8, endurance: 5, agility: 3, intellect: 2 },
      sage: { intellect: 8, endurance: 3, agility: 3, strength: 2 },
      shadowblade: { agility: 8, strength: 4, intellect: 3, endurance: 2 },
      steward: { intellect: 5, endurance: 5, strength: 3, agility: 3 },
      herald: { intellect: 5, agility: 4, endurance: 4, strength: 3 },
      driftwalker: { agility: 6, intellect: 5, endurance: 4, strength: 3 },
    };
    const bonus = classBonus[hero.heroClass] ?? classBonus.warlord;
    return {
      strength: base + (bonus.strength ?? 3) * hero.level,
      intellect: base + (bonus.intellect ?? 3) * hero.level,
      agility: base + (bonus.agility ?? 3) * hero.level,
      endurance: base + (bonus.endurance ?? 3) * hero.level,
    };
  };

  const stats = selectedHero ? getHeroStats(selectedHero) : {};
  const maxStat = Math.max(...Object.values(stats), 50);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl mb-6" style={{ fontFamily: 'Cinzel, serif' }}>Your Heroes</h2>

        {/* Hero Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {heroes.map((hero) => {
            const hi = CLASS_INFO[hero.heroClass] ?? CLASS_INFO.warlord;
            const isActive = selectedHero?.id === hero.id;
            return (
              <button
                key={hero.id}
                onClick={() => { setSelectedHero(hero); setEquipMenuSlot(null); }}
                className={`p-4 rounded-lg border text-left transition-all ${
                  isActive
                    ? 'border-[var(--ember-gold)]/60 bg-[var(--ember-gold)]/10'
                    : 'border-[var(--ruin-grey)]/30 bg-[var(--veil-blue)]/50 hover:border-[var(--aether-violet)]/40'
                }`}
              >
                <div className="text-2xl mb-2">{hi.icon}</div>
                <div className="text-sm font-semibold text-[var(--parchment)]">{hero.name}</div>
                <div className="text-xs text-[var(--aether-violet)]">{hi.title}</div>
                <div className="text-xs text-[var(--ruin-grey)] mt-1">Level {hero.level}</div>
              </button>
            );
          })}

          {/* Empty slots */}
          {Array.from({ length: Math.max(0, 3 - heroes.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="p-4 rounded-lg border border-dashed border-[var(--ruin-grey)]/20 bg-[var(--veil-blue)]/20 flex items-center justify-center"
            >
              <span className="text-xs text-[var(--ruin-grey)]">Empty Slot</span>
            </div>
          ))}
        </div>

        {/* Selected Hero Detail */}
        {selectedHero && info && (
          <div className="rounded-lg border border-[var(--ruin-grey)]/30 p-6" style={{ background: 'url(/assets/gui/panels/body_base.png) center/cover, rgba(26, 39, 68, 0.6)' }}>
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-16 h-16 rounded-lg flex items-center justify-center text-3xl relative" style={{ background: 'url(/assets/gui/character-frame/player_portrait_frame.png) center/contain no-repeat' }}>
                {info.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-xl" style={{ fontFamily: 'Cinzel, serif', color: 'var(--ember-gold)' }}>
                  {selectedHero.name}
                </h3>
                <p className="text-sm text-[var(--aether-violet)]">{info.title} — Level {selectedHero.level}</p>
                <p className="text-xs text-[var(--ruin-grey)] mt-1">{info.desc}</p>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-1 rounded ${
                  selectedHero.status === 'idle' ? 'bg-green-900/30 text-green-300'
                  : selectedHero.status === 'marching' ? 'bg-blue-900/30 text-blue-300'
                  : selectedHero.status === 'injured' ? 'bg-red-900/30 text-red-300'
                  : 'bg-[var(--ruin-grey)]/20 text-[var(--ruin-grey)]'
                }`}>
                  {selectedHero.status.charAt(0).toUpperCase() + selectedHero.status.slice(1)}
                </span>
              </div>
            </div>

            {/* XP & Loyalty */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--parchment-dim)]">Experience</span>
                  <span className="text-[var(--parchment)]">{selectedHero.xp} / {selectedHero.level * 100}</span>
                </div>
                <div className="rpg-progress rounded-full">
                  <div
                    className="rpg-progress-fill rounded-full"
                    style={{ width: `${Math.min(100, (selectedHero.xp / (selectedHero.level * 100)) * 100)}%` }}
                  />
                  <div className="rpg-progress-gloss" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--parchment-dim)]">Loyalty</span>
                  <span className={`${selectedHero.loyalty >= 70 ? 'text-green-300' : selectedHero.loyalty >= 40 ? 'text-yellow-300' : 'text-red-300'}`}>
                    {selectedHero.loyalty}/100
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--veil-blue-deep)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${selectedHero.loyalty}%`,
                      background: selectedHero.loyalty >= 70 ? '#55e080' : selectedHero.loyalty >= 40 ? '#e0c050' : '#e05555',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Hero Stats - 4 stat bars */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-[var(--parchment-dim)] mb-3" style={{ fontFamily: 'Cinzel, serif' }}>
                Attributes
              </h4>
              <div className="space-y-2.5">
                {HERO_STATS.map(({ key, label, color }) => {
                  const value = stats[key] ?? 0;
                  const pct = maxStat > 0 ? Math.min(100, (value / maxStat) * 100) : 0;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-[var(--parchment-dim)] w-16 shrink-0">{label}</span>
                      <div className="flex-1 h-3 rounded-full bg-[var(--veil-blue-deep)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                      <span className="text-xs font-medium w-8 text-right" style={{ color }}>
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Abilities Section */}
            {heroAbilities.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-[var(--parchment-dim)] mb-3" style={{ fontFamily: 'Cinzel, serif' }}>
                  Abilities
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {heroAbilities.map((ability) => {
                    const isUnlocked = ability.unlocked || selectedHero.level >= ability.levelRequired;
                    return (
                      <div
                        key={ability.id}
                        className={`p-3 rounded-lg border transition-all ${
                          isUnlocked
                            ? 'border-[var(--aether-violet)]/30 bg-[var(--aether-violet)]/10'
                            : 'border-[var(--ruin-grey)]/15 bg-[var(--veil-blue)]/20 opacity-50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-sm">{isUnlocked ? '\u2728' : '\u{1F512}'}</span>
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs font-medium block ${
                              isUnlocked ? 'text-[var(--parchment)]' : 'text-[var(--ruin-grey)]'
                            }`}>
                              {ability.name}
                            </span>
                            {isUnlocked ? (
                              <p className="text-xs text-[var(--parchment-dim)] mt-0.5 leading-relaxed">
                                {ability.effect || ability.description}
                              </p>
                            ) : (
                              <p className="text-xs text-[var(--ruin-grey)] mt-0.5 italic">
                                Unlocks at level {ability.levelRequired}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Equipment Slots - 4 slot grid */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-[var(--parchment-dim)] mb-3" style={{ fontFamily: 'Cinzel, serif' }}>
                Equipment
              </h4>
              <div className="grid grid-cols-4 gap-3">
                {EQUIPMENT_SLOTS.map(({ key: slot, label, icon }) => {
                  const equipped = heroEquipment[slot];
                  const rarityColor = equipped ? RARITY_COLORS[equipped.rarity] ?? RARITY_COLORS.common : 'var(--ruin-grey)';
                  const rarityBg = equipped ? RARITY_BG[equipped.rarity] ?? RARITY_BG.common : 'transparent';

                  if (equipped) {
                    return (
                      <button
                        key={slot}
                        onClick={() => handleUnequip(selectedHero.id, slot)}
                        title={`Unequip ${equipped.name}`}
                        className="p-3 rounded-lg border-2 text-left transition-all hover:opacity-80"
                        style={{ borderColor: rarityColor, background: rarityBg }}
                      >
                        <div className="text-center mb-1">
                          <span className="text-lg">{icon}</span>
                        </div>
                        <div className="text-xs font-medium text-center truncate" style={{ color: rarityColor }}>
                          {equipped.name}
                        </div>
                        <div className="text-center mt-1">
                          {Object.entries(equipped.stats).slice(0, 2).map(([stat, val]) => (
                            <span key={stat} className="text-[9px] text-[var(--parchment-dim)] block">
                              +{val} {stat}
                            </span>
                          ))}
                        </div>
                        <div className="text-[9px] text-[var(--ruin-grey)] text-center mt-1 italic">click to unequip</div>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={slot}
                      onClick={() => setEquipMenuSlot(equipMenuSlot === slot ? null : slot)}
                      className={`p-3 rounded-lg text-center transition-all ${
                        equipMenuSlot === slot
                          ? 'border-2 border-[var(--ember-gold)]/50 bg-[var(--ember-gold)]/5'
                          : 'hover:border-[var(--aether-violet)]/30'
                      }`}
                      style={{ background: equipMenuSlot !== slot ? 'url(/assets/gui/equipment-slots/slot_frame.png) center/contain no-repeat' : undefined }}
                    >
                      <span className="text-lg opacity-30">{icon}</span>
                      <div className="text-[10px] text-[var(--ruin-grey)] mt-1">{label}</div>
                      <div className="text-[9px] text-[var(--ruin-grey)] mt-0.5 italic">empty</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Equip Menu - show inventory filtered by selected slot */}
            {equipMenuSlot && (
              <div className="mb-6 p-4 rounded-lg border border-[var(--ember-gold)]/30 bg-[var(--veil-blue-deep)]/60">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-xs font-semibold text-[var(--ember-gold)]" style={{ fontFamily: 'Cinzel, serif' }}>
                    Select {equipMenuSlot.charAt(0).toUpperCase() + equipMenuSlot.slice(1)}
                  </h5>
                  <button
                    onClick={() => setEquipMenuSlot(null)}
                    className="text-xs text-[var(--ruin-grey)] hover:text-[var(--parchment)]"
                  >
                    Cancel
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {inventoryItems
                    .filter((item) => item.slot === equipMenuSlot)
                    .map((item) => {
                      const color = RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleEquip(selectedHero.id, equipMenuSlot, item.id)}
                          className="w-full p-2 rounded border text-left transition-all hover:bg-[var(--veil-blue)]/40"
                          style={{ borderColor: `${color}40` }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium" style={{ color }}>
                              {item.name}
                            </span>
                            <span className="text-[9px] capitalize" style={{ color }}>
                              {item.rarity}
                            </span>
                          </div>
                          <div className="flex gap-2 mt-1">
                            {Object.entries(item.stats).map(([stat, val]) => (
                              <span key={stat} className="text-[10px] text-[var(--parchment-dim)]">
                                +{val} {stat}
                              </span>
                            ))}
                          </div>
                          {item.description && (
                            <p className="text-[10px] text-[var(--ruin-grey)] italic mt-1">{item.description}</p>
                          )}
                        </button>
                      );
                    })}
                  {inventoryItems.filter((item) => item.slot === equipMenuSlot).length === 0 && (
                    <p className="text-xs text-[var(--ruin-grey)] italic text-center py-4">
                      No items available for this slot
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Equipment Inventory */}
            {inventoryItems.length > 0 && !equipMenuSlot && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-[var(--parchment-dim)] mb-3" style={{ fontFamily: 'Cinzel, serif' }}>
                  Inventory
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {inventoryItems.map((item) => {
                    const color = RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common;
                    return (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg border text-left"
                        style={{ borderColor: `${color}30`, background: RARITY_BG[item.rarity] ?? RARITY_BG.common }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium" style={{ color }}>
                            {item.name}
                          </span>
                          <span className="text-[9px] capitalize px-1.5 py-0.5 rounded" style={{ color, background: `${color}15` }}>
                            {item.rarity}
                          </span>
                        </div>
                        <div className="flex gap-2 mt-1">
                          {Object.entries(item.stats).map(([stat, val]) => (
                            <span key={stat} className="text-[10px] text-[var(--parchment-dim)]">
                              +{val} {stat}
                            </span>
                          ))}
                        </div>
                        <div className="text-[9px] text-[var(--ruin-grey)] mt-1 capitalize">{item.slot}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Flavor text */}
            <div className="p-3 rounded bg-[var(--veil-blue-deep)]/50 border border-[var(--ruin-grey)]/15">
              <p className="text-xs text-[var(--ruin-grey)] italic">
                {selectedHero.heroClass === 'warlord' && `"${selectedHero.name} arrived at your gates scarred and armed. They say they've been walking for weeks, searching for a Bloodline Seat. They fight not for coin, but for something they won't yet name."`}
                {selectedHero.heroClass === 'sage' && `"${selectedHero.name} speaks of the Veilthread as if it were still alive — pulsing, breathing, waiting. Their eyes glow faintly with Aether when they concentrate."`}
                {selectedHero.heroClass === 'shadowblade' && `"${selectedHero.name} appeared without warning. No one saw them approach. They offered their blade and their silence — nothing more."`}
                {selectedHero.heroClass === 'steward' && `"${selectedHero.name} counts coin like others count heartbeats — relentlessly, instinctively. Under their gaze, rubble becomes foundation."`}
                {selectedHero.heroClass === 'herald' && `"${selectedHero.name} speaks with a voice that carries across valleys. Words are their weapon, and alliances their armor."`}
                {selectedHero.heroClass === 'driftwalker' && `"${selectedHero.name} returned from beyond the Veil's edge with eyes that see too much. They walk paths that aren't on any map."`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
