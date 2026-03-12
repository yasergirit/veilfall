# VEILFALL: Echoes of the Sky Rupture — Game Rules & Mechanics

> Complete reference document for all game systems, formulas, and constants.

---

## Table of Contents

1. [Factions](#1-factions)
2. [Resources](#2-resources)
3. [Buildings](#3-buildings)
4. [Units](#4-units)
5. [Research](#5-research)
6. [Heroes](#6-heroes)
7. [Combat](#7-combat)
8. [World Boss](#8-world-boss)
9. [Marches](#9-marches)
10. [Map & Terrain](#10-map--terrain)
11. [Alliances](#11-alliances)
12. [Seasonal Events](#12-seasonal-events)
13. [Quests](#13-quests)
14. [Hero Quests](#14-hero-quests)
15. [Spy System](#15-spy-system)
16. [Marketplace & Trade](#16-marketplace--trade)
17. [Daily Rewards](#17-daily-rewards)
18. [Leaderboard & Power Score](#18-leaderboard--power-score)
19. [New Player Protection](#19-new-player-protection)
20. [Game Loop Tick Rates](#20-game-loop-tick-rates)

---

## 1. Factions

Four playable factions, chosen at character creation. Each has unique bonuses, a starter hero, and a faction-exclusive building.

### The Ironveil Compact (`ironveil`)

- **Theme**: Engineers and pragmatists. Heavy defense, siege mastery, fast builders.
- **Color**: #4A6670 / Accent: #B8622A
- **Starter Hero**: Thorne (Warlord)
- **Unique Building**: Ironveil Foundry

| Bonus | Multiplier |
|---|---|
| Defense | 1.25x |
| Offense | 0.90x |
| March Speed | 0.85x |
| Build Speed | 1.20x |
| Aether Yield | 1.0x |
| Resource Gather | 1.0x |

### The Aetheri Dominion (`aetheri`)

- **Theme**: Scholars and mystics. Aether mastery, powerful offense, glass cannon.
- **Color**: #9B6ED4 / Accent: #C0E0FF
- **Starter Hero**: Lyris (Sage)
- **Unique Building**: Aetheri Resonance Spire

| Bonus | Multiplier |
|---|---|
| Defense | 0.85x |
| Offense | 1.25x |
| March Speed | 1.0x |
| Build Speed | 1.0x |
| Aether Yield | 1.30x |
| Resource Gather | 0.9x |
| Ruin Exploration | 1.10x |
| Lore Decrypt | 1.10x |

### The Thornwatch Clans (`thornwatch`)

- **Theme**: Survivalists and rangers. Speed, raiding, trade superiority.
- **Color**: #3A6B35 / Accent: #8B1A1A
- **Starter Hero**: Ashka (Shadowblade)
- **Unique Building**: Thornwatch Rootway

| Bonus | Multiplier |
|---|---|
| Defense | 1.0x |
| Offense | 1.0x |
| March Speed | 1.20x |
| Resource Gather | 1.15x |
| Trade Speed | 1.30x |
| Ruin Exploration | 1.15x |

### The Ashen Covenant (`ashen`)

- **Theme**: Conquerors and historians. Relic mastery, ruin exploitation, lore power.
- **Color**: #2C2C2C / Accent: #E87D20
- **Starter Hero**: Kael (Warlord)
- **Unique Building**: Ashen Reliquary

| Bonus | Multiplier |
|---|---|
| Offense | 1.10x |
| Build Speed | 0.95x |
| Ruin Exploration | 1.25x |
| Lore Decrypt | 1.50x |

---

## 2. Resources

Five resource types drive the economy:

| Resource | Icon | Starting Amount |
|---|---|---|
| Food | :ear_of_rice: | 500 |
| Wood | :wood: | 500 |
| Stone | :rock: | 300 |
| Iron | :gear: | 200 |
| Aether Stone | :gem: | 50 |

### Production Rates

Each resource building produces per hour per building level:

| Building | Resource | Rate/hr/Level |
|---|---|---|
| Gathering Post | Food | 30 |
| Woodcutter Lodge | Wood | 25 |
| Stone Quarry | Stone | 20 |
| Iron Mine | Iron | 15 |
| Aether Extractor | Aether Stone | 5 |

**Production Formula** (per tick):
```
produced = (rate * building.level * gatherMultiplier * aetherMultiplier * harvestMoonMultiplier) / 360
```

### Aether Harvest Cycle

A server-wide cycle affecting Aether Stone production:

| Phase | Duration | Aether Multiplier |
|---|---|---|
| Dormant | 5 minutes | 1.0x |
| Surge | 2 minutes | 3.0x |

All players are notified when the phase transitions.

---

## 3. Buildings

- **Max Building Level**: 20
- **Max Build Queue Slots**: 2

### Building Costs (Level 1)

| Building | Food | Wood | Stone | Iron | Aether | Time (s) | Requires |
|---|---|---|---|---|---|---|---|
| Gathering Post | 50 | 80 | - | - | - | 30 | - |
| Woodcutter Lodge | 50 | 40 | 30 | - | - | 30 | - |
| Stone Quarry | 40 | 60 | - | 20 | - | 45 | TC 2 |
| Iron Mine | 60 | 80 | 40 | - | - | 60 | TC 2 |
| Aether Extractor | - | 100 | 80 | 60 | - | 90 | TC 3 |
| Militia Barracks | 80 | 120 | 60 | - | - | 60 | TC 2 |
| Palisade Wall | - | 150 | 50 | - | - | 45 | - |
| Scout Tower | - | 80 | 60 | - | - | 40 | TC 2 |
| Hero Hall | 100 | 150 | 100 | - | - | 90 | TC 3 |
| Warehouse | - | 100 | 80 | - | - | 40 | TC 2 |
| Marketplace | - | 120 | 80 | 40 | - | 60 | TC 3 |
| Spy Guild | - | 100 | 100 | 80 | - | 90 | TC 3 |

### Faction-Unique Buildings (TC 3 Required)

| Building | Faction | Food | Wood | Stone | Iron | Aether | Time (s) |
|---|---|---|---|---|---|---|---|
| Ironveil Foundry | Ironveil | - | 100 | 150 | 200 | - | 120 |
| Aetheri Resonance | Aetheri | - | - | 80 | 100 | 150 | 120 |
| Thornwatch Rootway | Thornwatch | 150 | 200 | 80 | - | - | 120 |
| Ashen Reliquary | Ashen | - | - | 200 | 100 | 50 | 120 |

### Upgrade Formulas

- **Cost**: `baseCost[resource] * nextLevel`
- **Time**: `baseTime * nextLevel * 0.8`

### Town Center Upgrade Costs

| Level | Food | Wood | Stone | Iron | Aether | Time (s) |
|---|---|---|---|---|---|---|
| 2 | 200 | 300 | 200 | - | - | 120 |
| 3 | 500 | 600 | 400 | 200 | - | 300 |
| 4 | 1,000 | 1,200 | 800 | 400 | 100 | 600 |
| 5 | 2,000 | 2,400 | 1,600 | 800 | 300 | 1,200 |

### Town Center Level Requirements

| TC Level | Unlocks |
|---|---|
| 1 | Gathering Post, Woodcutter Lodge, Palisade Wall |
| 2 | Stone Quarry, Iron Mine, Militia Barracks, Scout Tower, Warehouse |
| 3 | Aether Extractor, Hero Hall, Marketplace, Spy Guild, Faction buildings |

### Founding Additional Settlements

- **Requires**: TC level 3+ in existing settlement
- **Cost**: Food 1,000 / Wood 1,000 / Stone 500 / Iron 300
- **Max Settlements**: 3 per player
- New settlement starts with half starting resources

---

## 4. Units

### Unit Stats & Training

| Unit | ATK | DEF | Speed | Carry | Train (s/unit) | Food | Wood | Iron | Stone | Requires |
|---|---|---|---|---|---|---|---|---|---|---|
| Militia | 10 | 15 | 8 | 20 | 15 | 30 | 20 | - | - | Militia Barracks |
| Archer | 18 | 8 | 9 | 15 | 20 | 40 | 30 | 10 | - | Militia Barracks |
| Shieldbearer | 8 | 25 | 6 | 10 | 25 | 50 | 20 | 30 | - | Militia Barracks |
| Scout | 3 | 3 | 18 | 5 | 10 | 20 | 10 | - | - | Scout Tower |
| Siege Ram | 40 | 5 | 3 | 0 | 60 | - | 100 | 60 | 40 | Militia Barracks |

- **Training Time**: `timePerUnit * count`
- **Max Train Queue Slots**: 2

---

## 5. Research

- **Research Queue**: 1 slot per settlement
- **Cost Scaling**: `baseCost[resource] * nextLevel`
- **Time Scaling**: `baseTime * nextLevel`

### Research Tree

| Tech | Name | Max Lvl | Base Cost | Base Time | Requires | Effect |
|---|---|---|---|---|---|---|
| agriculture | Agriculture | 10 | Food 100, Wood 50 | 60s | - | +10% food/hr per level |
| forestry | Forestry | 10 | Food 50, Wood 100 | 60s | - | +10% wood/hr per level |
| masonry | Masonry | 10 | Wood 100, Stone 80 | 75s | - | +10% stone/hr per level |
| metallurgy | Metallurgy | 10 | Wood 80, Iron 100 | 90s | - | +10% iron/hr per level |
| aether_studies | Aether Studies | 10 | Aether 30, Iron 50 | 120s | - | +10% aether/hr per level |
| fortification | Fortification | 10 | Stone 150, Iron 80 | 90s | - | +5% defense per level |
| tactics | Tactics | 10 | Food 100, Iron 60 | 90s | Militia Barracks | +5% attack per level |
| logistics | Logistics | 10 | Food 80, Wood 80 | 75s | - | +5% speed, +10% carry per level |
| cartography | Cartography | 5 | Wood 60, Aether 20 | 90s | Scout Tower | +2 tile vision per level |
| aether_mastery | Aether Mastery | 5 | Aether 80, Iron 60 | 180s | Aether Extractor | Unlock aether abilities |

**Example**: Researching Agriculture to level 3 costs Food 300, Wood 150 and takes 180 seconds.

---

## 6. Heroes

- **Max Level**: 30
- **Max Heroes**: 6 per player
- **Starting Loyalty**: 80 (range 0-100)
- **Desertion Threshold**: Loyalty < 19

### Hero Classes

| Class | Icon | Description |
|---|---|---|
| Warlord | :crossed_swords: | Military commander. Leads armies from the front. |
| Sage | :crystal_ball: | Aether scholar. Accelerates lore and research. |
| Shadowblade | :dagger: | Scout and saboteur. Unseen, unmatched. |
| Steward | :scroll: | Economic leader. Builds empires from rubble. |
| Herald | :trumpet: | Diplomat and unifier. The voice of alliances. |
| Driftwalker | :milky_way: | Explorer of the unknown. Walks where others fear. |

### Starting Stats by Class

| Class | Strength | Intellect | Agility | Endurance |
|---|---|---|---|---|
| Warlord | 8 | 3 | 4 | 7 |
| Sage | 3 | 8 | 4 | 5 |
| Shadowblade | 5 | 4 | 8 | 3 |
| Steward | 4 | 6 | 4 | 6 |

### Leveling

- **XP per level**: `currentLevel * 100 XP`
- **On level-up**: +1 to a random stat
- **XP from combat**: 50 XP (win), 20 XP (loss)
- **XP from map event claim**: 25 XP

### Abilities

| Ability | Class | Level Req | Effect |
|---|---|---|---|
| Rally Cry | Warlord | 1 | +10% attack for 1 battle |
| Shield Wall | Warlord | 3 | +20% defense for 1 battle |
| Aether Bolt | Sage | 1 | Deals 50 damage to target |
| Mana Shield | Sage | 3 | Absorbs 100 damage |
| Shadow Strike | Shadowblade | 1 | +30% first attack damage |
| Vanish | Shadowblade | 3 | Avoid 1 combat round |
| Inspire | Steward | 1 | -10% build time |
| Trade Mastery | Steward | 3 | +20% trade value |

### Equipment

**Slots**: Weapon, Armor, Accessory, Relic

| Item | Slot | Rarity | Stats |
|---|---|---|---|
| Rusty Sword | Weapon | Common | STR +2 |
| Iron Blade | Weapon | Rare | STR +5 |
| Aether Staff | Weapon | Rare | INT +5 |
| Leather Armor | Armor | Common | END +3 |
| Chainmail | Armor | Rare | END +6 |
| Scout Cloak | Accessory | Common | AGI +3 |
| Aether Pendant | Accessory | Rare | INT +3, END +2 |
| Elder's Idol | Relic | Legendary | STR +3, INT +3, AGI +3, END +3 |

All new heroes start with **Rusty Sword** and **Leather Armor** equipped.

### Hero Combat Bonus

```
attackBonus  = 1.0 + (hero.level * 0.02) + floor(strength / 2) * 0.01
defenseBonus = 1.0 + (hero.level * 0.02) + floor(endurance / 2) * 0.01
```

Additional ability bonuses: Rally Cry +0.10 ATK, Shield Wall +0.10 DEF, Shadow Strike +0.08 ATK, Aether Bolt +0.12 ATK.

---

## 7. Combat

### Combat Resolution

**Step 1 - Calculate Attack Power:**
```
totalAttack = SUM(unitCount * unitATK * attackerBonus)
```

**Step 2 - Calculate Defense Power:**
```
totalDefense = SUM(unitCount * unitDEF * defenderBonus)
```

**Step 3 - Battle Ratio:**
```
ratio = totalAttack / (totalAttack + totalDefense)
```

**Step 4 - Determine Winner:**
- ratio > 0.5 -> Attacker wins
- ratio < 0.5 -> Defender wins
- ratio = 0.5 -> Draw

**Step 5 - Calculate Losses:**

| Outcome | Attacker Losses | Defender Losses |
|---|---|---|
| Attacker wins | count * ratio * 0.30 | count * (1 - ratio) * 0.70 |
| Defender wins | count * (1 - ratio) * 0.70 | count * ratio * 0.30 |
| Draw | count * 0.25 | count * 0.25 |

**Step 6 - Loot** (attacker wins only):
- Food: 50-200
- Wood: 30-150
- Stone: 20-100

### NPC Garrisons

Unoccupied tiles have NPC defenders: 3-5 Militia + 1-2 Archers.

---

## 8. World Boss

- One active boss at a time
- Checked every 60 seconds, spawns immediately if no active boss
- Despawns after **15 minutes** if not defeated
- Random position: q, r in range [-12, 12]

### Boss Types

| Boss | Title | HP | ATK | DEF | Rewards |
|---|---|---|---|---|---|
| Veil Titan | Guardian of the Rift | 5,000 | 200 | 100 | Food 5K, Wood 5K, Stone 3K, Iron 2K, Aether 1K |
| Aether Wyrm | Devourer of Leylines | 3,000 | 350 | 80 | Aether 3K, Food 2K, Wood 2K |
| Shadow Colossus | The Unbound | 2,000 | 500 | 200 | Iron 5K, Stone 5K, Aether 500 |

### Damage Formula

```
playerAttackPower = SUM(unitCount * unitATK)
bossDefenseFactor = boss.DEF / (boss.DEF + playerAttackPower)
damageDealt = FLOOR(playerAttackPower * (1 - bossDefenseFactor))
```

### Boss Retaliation (Unit Losses)

```
playerDefensePower = SUM(unitCount * unitDEF)
bossAttackRatio = boss.ATK / (boss.ATK + playerDefensePower)
unitsLost[type] = FLOOR(bossAttackRatio * 0.4 * unitCount)
```

Surviving units return to settlement after the attack.

### Reward Distribution

Proportional to damage dealt by each attacker:
```
playerReward[resource] = FLOOR(totalReward[resource] * (playerDamage / totalDamage))
```

---

## 9. Marches

### March Types

| Type | Description |
|---|---|
| Attack | Engage in combat at destination. Survivors return. |
| Scout | Travel to destination and immediately return. No combat. |
| Reinforce | Travel to destination and stay. |

### Travel Time

```
travelTime = hexDistance(from, to) * 30 seconds
```

**Hex Distance** (cube coordinates):
```
distance = MAX(|q1-q2|, |r1-r2|, |s1-s2|)
```

---

## 10. Map & Terrain

- **Grid**: 800 x 800 hexagonal, cube coordinates (q + r + s = 0)
- **New players spawn**: q, r in range [-10, 10]

### Terrain Types

Generated deterministically by coordinates:

| Terrain | Probability |
|---|---|
| Plains | 50% |
| Forest | 20% |
| Mountain | 10% |
| Ruins | 10% |
| Desert | 10% |

Ruin tiles contain Aether Stone deposits (richness 1-5).

### Map Zones (by distance from center)

| Zone | Distance Range | Description |
|---|---|---|
| Sovereign Ring | 0-15% | Center of the map, highest danger |
| Wound Zones | 15-35% | Corrupted territory |
| Fractured Provinces | 35-60% | Mid-tier contested areas |
| Contested Reaches | 60-80% | Active PvP zones |
| Hearthlands | 80-100% | Outer edges, safest |

### Map Vision

```
visionRadius = 3 (base) + scoutTowerLevel * 2 + cartographyLevel * 1
```

Marching armies provide +1 hex vision around their current position.

### Map Events

- **Max active events**: 20
- **Spawn rate**: 1-3 events per minute
- **Lifetime**: 30 minutes

| Event Type | Probability | Guardians | Rewards |
|---|---|---|---|
| Ruin | 40% | 3-5 Militia | Food 100-500, Wood 100-300, Stone 50-200 |
| Resource Node | 30% | None | 1 random resource: 200-800 |
| NPC Camp | 20% | 5-8 Militia, 2-4 Archers | Food 200-600, Wood 150-400, Iron 50-200 |
| Aether Surge | 10% | None (auto-claim) | Aether Stone 50-200 |

---

## 11. Alliances

- **Max Members**: 50
- **Name Length**: 3-30 characters
- **Tag Length**: 2-5 characters

### Roles

| Role | Permissions |
|---|---|
| Leader | All permissions, transfer leadership, disband |
| Officer | Invite, kick members, manage diplomacy |
| Member | Basic participation |

### Diplomacy Types

| Type | Description |
|---|---|
| Alliance | Full military cooperation |
| NAP (Non-Aggression Pact) | No attacks between members |
| War | Active hostilities |

**Diplomacy flow**: Pending -> Active / Rejected

### Alliance Power

```
power = SUM(memberPowerScores)
```

---

## 12. Seasonal Events

Three events rotate continuously. Each lasts **10 minutes**, and the next begins immediately after.

### Harvest Moon Festival

- **Bonus**: +50% resource production (1.5x multiplier)
- **Objective**: Gather 2,000 total resources
- **Reward**: Aether Stone 500

### Aether Storm

- **Bonus**: Research time halved (0.5x multiplier)
- **Objective**: Build or upgrade 3 buildings
- **Reward**: Food 1,000 / Wood 1,000 / Stone 500

### Ironclad Tournament

- **Bonus**: Training costs -25% (0.75x multiplier)
- **Objective**: Train 30 military units
- **Reward**: Aether Stone 300 + 150 XP to first hero

---

## 13. Quests

### Story Quests (15 sequential)

| # | Title | Phase | Objective | Key Rewards |
|---|---|---|---|---|
| 1 | A Full Stomach | 1 | Build Gathering Post | Food 100, Wood 50 |
| 2 | Walls of Hope | 1 | Build Palisade Wall | Wood 100, Stone 80 |
| 3 | Timber and Stone | 1 | Build Woodcutter Lodge | Food 80, Wood 120 |
| 4 | Strengthen the Core | 2 | Town Center level 2 | Food 200, Wood 200, Stone 150 |
| 5 | Deep Foundations | 2 | Build Stone Quarry | Stone 150, Iron 50 |
| 6 | Iron Will | 2 | Build Iron Mine | Iron 150, Food 100 |
| 7 | Idle Hands | 2 | Build Militia Barracks | Food 150, Wood 100, Iron 80 |
| 8 | First Swords | 2 | Train 5 Militia | Food 200, Iron 100 |
| 9 | Eyes on the Horizon | 3 | Build Scout Tower | Wood 150, Stone 100 |
| 10 | The Blue Glow | 3 | Build Aether Extractor | Aether 50, Iron 100 |
| 11 | The Stranger's Oath | 3 | Build Hero Hall | Food 200, Wood 200, Stone 150, +100 XP |
| 12 | Knowledge is Power | 3 | Research Agriculture | Food 300, Wood 150 |
| 13 | The Heart of Command | 4 | Town Center level 3 | Food 500, Wood 500, Stone 300, Iron 200, Aether 50 |
| 14 | A Standing Army | 4 | Have 20 total units | Food 400, Iron 200, +150 XP |
| 15 | The Elder's Secret | 4 | Town Center level 4 | Food 1K, Wood 1K, Stone 500, Iron 300, Aether 100, +300 XP |

### Milestone Quests (Achievements)

| Title | Objective | Key Rewards |
|---|---|---|
| Fledgling Town | 5 different buildings | Food 200, Wood 200 |
| Growing Settlement | 10 different buildings | Food 500, Wood 500, Stone 300 |
| Small Warband | 10 garrisoned units | Food 200, Iron 100 |
| Standing Army | 50 garrisoned units | Food 500, Iron 300, Aether 30 |
| Military Power | 100 garrisoned units | Food 1K, Iron 500, Aether 80, +200 XP |
| Resourceful | 5,000 total resources | Food 300, Wood 300 |
| Prosperous | 25,000 total resources | Food 800, Wood 800, Stone 500, Iron 300 |
| Overflowing Coffers | 100,000 total resources | Food 2K, Wood 2K, Stone 1K, Iron 500, Aether 200, +500 XP |
| Established Power | TC level 3 | Aether 50, Iron 200 |
| Capital City | TC level 5 | Food 3K, Wood 3K, Stone 2K, Iron 1K, Aether 500, +1000 XP |
| First March | Send first army | Food 150, Iron 80, +50 XP |
| Explorer | Send first scout | Wood 150, Stone 100 |
| Scholar | Complete 3 researches | Aether 30, Iron 150, +100 XP |

### Daily Quests

- 3 quests per day, regenerated at UTC midnight
- Scale with Town Center level: `scaleFactor = 1 + (tcLevel - 1) * 0.4`
- Types: Gather resources, Train units, Upgrade buildings, Research
- TC level 3+: Bonus XP reward

---

## 14. Hero Quests

Heroes can be sent on solo quests while idle.

| Quest Type | Duration | Difficulty | XP Range | Rewards | Special |
|---|---|---|---|---|---|
| Exploration | 60s | 1 | 30-80 XP | Food 20-80, Wood 10-50 | - |
| Training | 90s | 2 | 60-120 XP | Iron 10-40 | - |
| Relic Hunt | 120s | 3 | 100-200 XP | Stone 30-80, Iron 20-60 | 20% equipment drop |
| Veil Expedition | 180s | 3 | 150-300 XP | Aether 20-80 | 30% lore fragment |

### Success Chance

```
successChance = MIN(0.60 + hero.level * 0.03 + hero.agility * 0.01 - difficulty * 0.10, 0.95)
```

On failure, the hero returns idle with no rewards.

### Lore Fragments (from Veil Expeditions)

8 collectible fragments revealing the world's backstory:

1. *"...and the world shattered into six, each shard a kingdom unto itself..."*
2. *"The Veil is not a barrier. It is a wound."*
3. *"Those who drink deeply of the aether shall see beyond the veil, but never return whole."*
4. *"Day 47. The towers still hum. I hear voices in the stones."*
5. *"When the six factions unite, the Veil shall mend - or consume all."*
6. *"The Aether Wyrm sleeps beneath the convergence. Do not wake it."*
7. *"Before the Veilfall, there was one world. One people. One song."*
8. *"The shadow colossus rises when hope fades. Feed it despair and it grows."*

---

## 15. Spy System

**Requires**: Spy Guild building

### Mission Types

| Type | Base Success | Per Attacker Spy Lvl | Cap | Per Defender Spy Lvl | Cost |
|---|---|---|---|---|---|
| Intel | 70% | +5% | 95% | -10% | Food 100, Iron 50 |
| Sabotage | 50% | +5% | 80% | -10% | Food 100, Iron 50 |

**Travel Time**: `hexDistance * 15 seconds`

### Intel Success

Returns full snapshot: target's resources, buildings (type + level), and units.

### Sabotage Success

Reduces a random building's level by 1 (minimum level 1).

### Caught

Mission fails. Defender receives notification: *"An enemy spy was caught."*

---

## 16. Marketplace & Trade

**Requires**: Marketplace building in both seller and buyer settlements.

### Mechanics

1. **List Offer**: Specify resource to sell, amount, resource requested, amount requested. Sold resources are escrowed immediately.
2. **Accept Offer**: Buyer pays requested resources, receives offered resources. Seller gets buyer's payment.
3. **Cancel Offer**: Escrowed resources returned to seller.
4. Cannot trade a resource for itself.

---

## 17. Daily Rewards

7-day reward cycle. Missing a day resets the streak to Day 1.

| Day | Rewards |
|---|---|
| 1 | Food 200, Wood 200 |
| 2 | Stone 300, Iron 200 |
| 3 | Food 500, Wood 500, Stone 300 |
| 4 | Aether Stone 100 |
| 5 | Food 800, Wood 800, Stone 500, Iron 300 |
| 6 | Aether Stone 200 |
| 7 | Food 1,000, Wood 1,000, Stone 800, Iron 500, Aether 300 |

After Day 7, the cycle resets to Day 1. Rewards are deposited to the player's first settlement.

---

## 18. Leaderboard & Power Score

### Individual Power

```
power = (totalSettlementLevels * 100)
      + (totalBuildingCount * 50)
      + (totalUnits * 10)
      + FLOOR(totalResources / 100)
```

### Ranking Categories

- **Power** (overall score)
- **Settlements** (count)
- **Military** (unit count)
- **Buildings** (count)

### Alliance Power

Sum of all member power scores.

---

## 19. New Player Protection

- **Shield Duration**: 72 hours after account creation
- During shield: Cannot be attacked by other players

---

## 20. Game Loop Tick Rates

| System | Interval |
|---|---|
| Economy (resource production) | 10 seconds |
| Building queue | 2 seconds |
| Training queue | 2 seconds |
| Research queue | 2 seconds |
| March / combat | 5 seconds |
| Spy missions | 5 seconds |
| Aether cycle | 5 seconds |
| Map event spawner | 60 seconds |
| World boss check | 60 seconds |
| Seasonal event rotation | 15 seconds |
| Hero quest check | 5 seconds |

---

*VEILFALL: Echoes of the Sky Rupture - The Veil is not a barrier. It is a wound.*
