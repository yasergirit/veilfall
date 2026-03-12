-- ============================================================================
-- VEILFALL: Echoes of the Sky Rupture
-- PostgreSQL Database Schema
-- ============================================================================
-- Production-ready schema for a browser-based grand strategy MMO set in the
-- post-apocalyptic world of Aetherra. Uses cube coordinates for hex grid,
-- JSONB for flexible data, enums for type safety, and partitioning for
-- high-volume tables.
--
-- Hex Grid Coordinate System:
--   Cube coordinates (q, r, s) where q + r + s = 0.
--   Neighbor distance = max(|dq|, |dr|, |ds|) or equivalently (|dq|+|dr|+|ds|)/2.
--   We store q and r; s is a generated column (s = -q - r).
-- ============================================================================

BEGIN;

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- GiST indexes for integer ranges/exclusion
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Trigram similarity for text search

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- The four factions of Aetherra, each a different answer to surviving the
-- Sky Rupture. Determines playstyle bonuses, unique buildings, and units.
CREATE TYPE faction_type AS ENUM (
    'ironveil_compact',    -- Engineers/pragmatists: defense, siege, production
    'aetheri_dominion',    -- Scholars/mystics: aether mastery, glass cannons
    'thornwatch_clans',    -- Survivalists/rangers: speed, raids, trade
    'ashen_covenant'       -- Conquerors/historians: relics, ruin exploitation
);

-- Terrain types for the hex map. Each affects movement, combat, and resources.
CREATE TYPE terrain_type AS ENUM (
    'plains',              -- Standard movement, farmable
    'forest',              -- Thornwatch bonus, wood source
    'mountain',            -- Impassable by default, stone/iron
    'hills',               -- Slight defense bonus, mixed resources
    'swamp',               -- Slow movement, ambush terrain
    'desert',              -- Reduced food, fast movement
    'ruins',               -- Explorable, may contain lore/relics
    'aether_field',        -- High aether stone yield, corruption risk
    'wound_zone',          -- Unstable reality, extreme aether, high corruption
    'sovereign_ground',    -- Endgame territory around Sovereign Capitals
    'water',               -- Impassable (lakes, rivers as barriers)
    'volcanic'             -- Rare, high iron, periodic hazard events
);

-- Resource types in the economy. Aether Stone is the premium strategic resource.
CREATE TYPE resource_type AS ENUM (
    'food',
    'wood',
    'stone',
    'iron',
    'aether_stone',
    'veil_crystal'         -- Purest aether form, endgame only
);

-- Map ring zones radiating from the center. Determines danger and reward.
CREATE TYPE map_zone AS ENUM (
    'hearthlands',         -- Ring 1: safe starting zone
    'contested_reaches',   -- Ring 2: first PvP, alliance catalyst
    'fractured_provinces', -- Ring 3: alliance warfare, province capitals
    'wound_zones',         -- Ring 4: high risk/reward, lore revelations
    'sovereign_ring'       -- Ring 5: endgame, Seven Sovereign Capitals
);

-- Building categories within settlements.
CREATE TYPE building_type AS ENUM (
    -- Resource production
    'farm',                -- Food production
    'lumber_mill',         -- Wood production
    'quarry',              -- Stone production
    'iron_mine',           -- Iron production
    'aether_extractor',    -- Aether stone harvesting
    'aether_refinery',     -- Aether stone refinement (Aetheri unique enhanced)
    -- Military
    'barracks',            -- Basic infantry training
    'siege_workshop',      -- Siege equipment production
    'stable',              -- Cavalry training
    'archery_range',       -- Ranged unit training
    'war_forge',           -- Elite unit production
    -- Defense
    'wall',                -- Settlement perimeter defense
    'watchtower',          -- Vision range + early warning
    'gate',                -- Controlled entry point
    'trap_workshop',       -- Thornwatch-favored: trap production
    -- Economy & Utility
    'warehouse',           -- Increases resource storage cap
    'marketplace',         -- Enables trade, improves rates
    'town_center',         -- Core building, settlement level tied to this
    'embassy',             -- Diplomatic functions
    -- Lore & Research
    'archive',             -- Lore decryption, Ashen unique enhanced
    'observatory',         -- Map reveal, event prediction
    'resonance_spire',     -- Aetheri unique: reveals hidden resources/lore
    -- Faction Unique
    'foundry',             -- Ironveil unique: siege without military building
    'rootway',             -- Thornwatch unique: instant unit transfer network
    -- Alliance
    'alliance_hall',       -- Required for alliance membership
    'tribute_office'       -- Collects/pays provincial tribute
);

-- Unit types that compose armies. Each faction has access to shared and unique units.
CREATE TYPE unit_type AS ENUM (
    -- Shared units (all factions)
    'militia',             -- Cheap defense, weak attack
    'scout',               -- Fast, reveals fog of war
    'supply_cart',         -- Carries loot, slow
    -- Ironveil Compact
    'shieldwall_legionnaire',  -- Highest HP basic infantry
    'ironcaster',              -- Ranged siege, bonus vs buildings
    'vaultbreaker',            -- Elite siege, damages sealed structures
    'cogwright_golem',         -- Unique: enormous HP, self-repair
    -- Aetheri Dominion
    'threadweaver',        -- Support: buffs allies, debuffs enemies
    'shardlancer',         -- Strike force: high burst, fragile
    'voidwalker',          -- Infiltrator: bypasses walls
    'aether_colossus',     -- Unique: massive AoE, very expensive
    -- Thornwatch Clans
    'briarrunner',         -- Fastest unit, low carry
    'thornguard',          -- Defense bonus in natural terrain
    'rootbinder',          -- Support/trap: places tile traps
    'great_warden',        -- Unique: mobile fortress, aura defense
    -- Ashen Covenant
    'reclaimant_soldier',  -- Versatile, scales with hero relics
    'ashwalker',           -- Heavy cavalry, strong charge
    'chronicler',          -- Support: increases salvage yield
    'sovereign_guard'      -- Unique: scales with ruin tier
);

-- Hero classes, each with distinct role and skill trees.
CREATE TYPE hero_class AS ENUM (
    'warlord',             -- Military commander, front-line leader
    'sage',                -- Lore researcher, aether specialist
    'shadowblade',         -- Spy, saboteur, scout
    'steward',             -- Economic leader, settlement optimizer
    'herald',              -- Diplomat, alliance coordinator
    'driftwalker'          -- Explorer, wound zone specialist
);

-- Hero status reflects what the hero is currently doing.
CREATE TYPE hero_status AS ENUM (
    'idle',                -- Available for orders
    'leading_army',        -- Attached to an army on the map
    'on_expedition',       -- Solo/small-group exploration mission
    'recovering',          -- Injured, in recovery timer
    'decrypting',          -- Working on lore fragment decryption
    'captured',            -- Held by enemy alliance (ransom mechanic)
    'deserted'             -- Left player service (low loyalty)
);

-- Equipment slot types for heroes.
CREATE TYPE equipment_slot AS ENUM (
    'weapon',
    'armor',
    'trinket',
    'relic_1',
    'relic_2'
);

-- Relic rarity tiers.
CREATE TYPE relic_rarity AS ENUM (
    'common',
    'uncommon',
    'rare',
    'epic',
    'legendary',
    'sovereign'            -- Only from Sovereign Capitals
);

-- Army operational status.
CREATE TYPE army_status AS ENUM (
    'idle',                -- Stationed at settlement or tile
    'marching',            -- Moving between tiles
    'fighting',            -- Engaged in combat
    'sieging',             -- Conducting a siege
    'retreating',          -- Withdrawing from combat
    'garrisoned',          -- Defending a structure
    'disbanded'            -- Soft-deleted
);

-- March order purpose determines combat behavior on arrival.
CREATE TYPE march_type AS ENUM (
    'attack',              -- Engage hostiles at destination
    'reinforce',           -- Join friendly garrison
    'scout',               -- Reveal tile and return
    'raid',                -- Loot resources and return
    'relocate',            -- Move settlement (rare)
    'expedition',          -- Hero-led PvE exploration
    'trade',               -- Supply cart trade run
    'siege'                -- Begin siege of structure
);

-- Battle outcome categories.
CREATE TYPE battle_result AS ENUM (
    'attacker_victory',
    'defender_victory',
    'draw',
    'attacker_retreat',
    'defender_retreat'
);

-- Injury severity for heroes after battle.
CREATE TYPE injury_severity AS ENUM (
    'none',
    'minor',               -- 2h recovery
    'moderate',            -- 8h recovery, -20% stats 24h after
    'severe',              -- 24h recovery, -30% stats 48h after, gains Scar
    'critical'             -- 48h recovery, -50% stats 72h after, gains Permanent Scar
);

-- Alliance member roles with hierarchical permissions.
CREATE TYPE alliance_role AS ENUM (
    'sovereign',           -- Full control (max 1)
    'council',             -- War planning, member mgmt, treasury (max 3-5)
    'warden',              -- Territory management (max 5-10)
    'emissary',            -- Diplomacy, trade (max 2-3)
    'commander',           -- Lead alliance armies
    'member'               -- Basic privileges
);

-- Diplomatic agreement types between alliances.
CREATE TYPE diplomacy_type AS ENUM (
    'non_aggression_pact',
    'trade_alliance',
    'military_coalition',
    'vassalage',
    'shadow_pact',         -- Secret: hidden non-aggression
    'intelligence_sharing',-- Secret: shared scout data
    'staged_battle',       -- Secret: faked conflict
    'rivalry'              -- Formal competitive declaration
);

-- Formal war status tracking.
CREATE TYPE war_status AS ENUM (
    'declared',            -- War bonds posted, 24h preparation
    'active',              -- Combat in progress
    'ceasefire',           -- Negotiated pause
    'attacker_victory',
    'defender_victory',
    'expired',             -- Duration ended without objective met
    'cancelled'            -- Withdrawn before combat
);

-- War objectives that must be declared upfront.
CREATE TYPE war_objective AS ENUM (
    'territory_capture',   -- Claim specific tiles/settlements
    'resource_demand',     -- Force tribute payment
    'rivalry_resolution',  -- Settle a formal rivalry
    'vassalage_demand',    -- Force vassalage
    'liberation',          -- Free a vassal alliance
    'sovereign_siege'      -- Endgame capital siege
);

-- Ruin exploration status.
CREATE TYPE ruin_status AS ENUM (
    'undiscovered',        -- Not yet found by any player
    'discovered',          -- Located but not explored
    'being_explored',      -- Exploration in progress
    'cleared',             -- Fully explored, loot taken
    'sealed',              -- Requires specific keys/conditions
    'collapsed'            -- Destroyed or exhausted
);

-- Ruin tier determines difficulty and rewards.
CREATE TYPE ruin_tier AS ENUM (
    'minor',               -- Solo player, Hearthlands
    'standard',            -- 5+ players or hero, Contested Reaches
    'major',               -- Alliance expedition, Fractured Provinces
    'sealed_vault',        -- Alliance + keys, Wound Zones
    'sovereign'            -- Full alliance siege, Sovereign Ring
);

-- World boss status.
CREATE TYPE boss_status AS ENUM (
    'dormant',             -- Not yet spawned this cycle
    'active',              -- Spawned and attackable
    'engaged',             -- Currently being fought
    'defeated',            -- Killed, loot phase
    'respawning'           -- Cooldown before next spawn
);

-- World event categories.
CREATE TYPE event_type AS ENUM (
    'aether_eclipse',      -- Map-wide aether surge
    'echo_incursion',      -- Echo army marches from Wound Zones
    'aether_geyser',       -- Temporary high-yield resource node
    'wanderer_market',     -- Travelling NPC merchant
    'convergence',         -- New region revealed (every 4-6 weeks)
    'the_reckoning',       -- Mid-season wound zone expansion
    'awakening',           -- Endgame trigger, capitals awaken
    'veil_tear',           -- Rare harvestable veilthread point
    'world_boss_spawn',    -- Boss appearance announcement
    'server_riddle'        -- Cryptic coordinate puzzle
);

-- Season status.
CREATE TYPE season_status AS ENUM (
    'upcoming',
    'dawn',                -- Week 1: new map, exploration
    'expansion',           -- Weeks 2-3: alliances form
    'consolidation',       -- Weeks 4-5: province capitals contested
    'awakening',           -- Week 6: endgame triggers
    'great_war',           -- Weeks 7-8: capital sieges
    'reckoning',           -- Weeks 9-10: Veil Gate contested
    'resolution',          -- Weeks 10-12: Choice made, epilogue
    'ended'
);

-- The Veil Choice made at season end, shaping next season.
CREATE TYPE veil_choice AS ENUM (
    'restore',             -- Rebuild Veilthread, enhanced aether next season
    'sever',               -- Destroy Veilthread, gritty realism season
    'claim',               -- Seize control, power advantage + resistance
    'release',             -- Wild growth, chaos/transformation season
    'transcend'            -- Hidden Chapter secret ending, cooperative
);

-- Lore codex chapters organizing the narrative.
CREATE TYPE lore_chapter AS ENUM (
    'the_breaking',        -- History of the Sky Rupture
    'the_seven',           -- The Architects and their domains
    'the_bloodlines',      -- Player lineage history
    'the_veilthread',      -- Nature of the world energy
    'the_echoes',          -- Temporal fragments from the Rupture
    'the_return',          -- What comes next
    'the_hidden_chapter'   -- Ultra-rare, unlocks 5th veil choice
);

-- Chat channel types.
CREATE TYPE chat_channel AS ENUM (
    'global',              -- Server-wide
    'alliance_general',    -- Alliance open chat
    'alliance_war_room',   -- Leadership only
    'alliance_intel',      -- Scouting reports
    'alliance_chronicle',  -- Lore discoveries
    'whisper'              -- Direct player-to-player
);

-- Notification categories for the in-game notification queue.
CREATE TYPE notification_type AS ENUM (
    'attack_incoming',
    'attack_result',
    'construction_complete',
    'research_complete',
    'hero_returned',
    'hero_injured',
    'hero_deserted',
    'lore_decrypted',
    'alliance_invite',
    'alliance_war',
    'diplomacy_proposal',
    'diplomacy_broken',
    'world_event',
    'rival_activity',
    'blood_debt',
    'tribute_collected',
    'relic_found',
    'settlement_raided',
    'nemesis_alert'
);

-- Fog of war visibility level per tile per player.
CREATE TYPE visibility_level AS ENUM (
    'hidden',              -- Never seen
    'explored',            -- Seen before but no current vision
    'visible'              -- Currently in vision range
);

-- Great Works alliance mega-construction types.
CREATE TYPE great_work_type AS ENUM (
    'grand_wall',          -- Impassable border wall (4 weeks)
    'aether_refinery',     -- Double aether production (3 weeks)
    'beacon_tower',        -- 50-hex enemy movement reveal (2 weeks)
    'hall_of_echoes',      -- Accelerated lore decryption (3 weeks)
    'war_forge'            -- Unique elite unit unlock (4 weeks)
);


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Hex distance using cube coordinates. Distance = max(|dq|, |dr|, |ds|).
-- Since s = -q - r, we compute it inline.
CREATE OR REPLACE FUNCTION hex_distance(q1 INT, r1 INT, q2 INT, r2 INT)
RETURNS INT
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
    SELECT greatest(
        abs(q1 - q2),
        abs(r1 - r2),
        abs((-q1 - r1) - (-q2 - r2))
    );
$$;

-- Return the 6 neighbor coordinates for a given hex tile.
CREATE OR REPLACE FUNCTION hex_neighbors(q INT, r INT)
RETURNS TABLE(nq INT, nr INT)
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
    VALUES
        (q + 1, r    ),   -- East
        (q - 1, r    ),   -- West
        (q    , r + 1),   -- Southeast
        (q    , r - 1),   -- Northwest
        (q + 1, r - 1),   -- Northeast
        (q - 1, r + 1);   -- Southwest
$$;

-- Tiles within a given radius of a hex (for area queries).
-- Returns all (q, r) pairs within `radius` steps.
CREATE OR REPLACE FUNCTION hex_ring_range(center_q INT, center_r INT, radius INT)
RETURNS TABLE(tile_q INT, tile_r INT)
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
    SELECT cq::INT, cr::INT
    FROM generate_series(center_q - radius, center_q + radius) AS cq,
         generate_series(center_r - radius, center_r + radius) AS cr
    WHERE abs(cq - center_q) + abs(cr - center_r) + abs((-cq - cr) - (-center_q - center_r)) <= 2 * radius;
$$;


-- ============================================================================
-- TABLE 1: SEASONS
-- ============================================================================
-- Season metadata controlling the seasonal cycle. Each server season lasts
-- 10-12 weeks. The veil_choice made at season end shapes the next season's
-- world state.

CREATE TABLE seasons (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_number   INT NOT NULL,
    name            VARCHAR(100) NOT NULL,         -- e.g. "Season 3: The Ember Reckoning"
    status          season_status NOT NULL DEFAULT 'upcoming',
    veil_choice     veil_choice,                   -- NULL until season resolution
    start_date      TIMESTAMPTZ,
    end_date        TIMESTAMPTZ,
    config          JSONB NOT NULL DEFAULT '{}',   -- Season-specific config overrides
    -- Map seed and generation parameters
    map_seed        BIGINT,
    map_width       INT NOT NULL DEFAULT 800,
    map_height      INT NOT NULL DEFAULT 800,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT seasons_dates_check CHECK (end_date IS NULL OR end_date > start_date),
    CONSTRAINT seasons_number_positive CHECK (season_number > 0)
);

CREATE UNIQUE INDEX idx_seasons_number ON seasons (season_number);
CREATE INDEX idx_seasons_status ON seasons (status) WHERE status != 'ended';


-- ============================================================================
-- TABLE 2: PLAYERS
-- ============================================================================
-- Core account table for all players. Faction choice is permanent for a season.
-- Legacy points persist across seasons and buy starting bonuses.

CREATE TABLE players (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(30) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,         -- bcrypt/argon2 hash
    display_name    VARCHAR(50) NOT NULL,
    faction         faction_type,                  -- NULL until faction chosen
    season_id       UUID REFERENCES seasons(id),   -- Current active season
    legacy_points   INT NOT NULL DEFAULT 0,        -- Persistent across seasons
    total_battle_score  BIGINT NOT NULL DEFAULT 0,
    lore_fragments_found INT NOT NULL DEFAULT 0,
    avatar_url      VARCHAR(500),
    is_online       BOOLEAN NOT NULL DEFAULT FALSE,
    is_banned       BOOLEAN NOT NULL DEFAULT FALSE,
    ban_reason      TEXT,
    last_login      TIMESTAMPTZ,
    last_action     TIMESTAMPTZ,                   -- For activity tracking
    -- Newcomer protection: 72-hour aether barrier
    protection_until TIMESTAMPTZ,
    -- Underdog protocol tracking
    total_power     BIGINT NOT NULL DEFAULT 0,     -- Aggregate power score
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,                   -- Soft delete

    CONSTRAINT players_username_unique UNIQUE (username),
    CONSTRAINT players_email_unique UNIQUE (email),
    CONSTRAINT players_legacy_points_non_negative CHECK (legacy_points >= 0),
    CONSTRAINT players_display_name_length CHECK (char_length(display_name) >= 2)
);

CREATE INDEX idx_players_faction ON players (faction) WHERE deleted_at IS NULL;
CREATE INDEX idx_players_season ON players (season_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_players_online ON players (is_online) WHERE is_online = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_players_last_login ON players (last_login DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_players_power ON players (total_power DESC) WHERE deleted_at IS NULL;


-- ============================================================================
-- TABLE 3: SESSIONS
-- ============================================================================
-- JWT refresh token storage for authentication. Access tokens are stateless;
-- refresh tokens are tracked here for revocation and rotation.

CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    refresh_token   VARCHAR(512) NOT NULL,
    user_agent      TEXT,
    ip_address      INET,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,                   -- NULL = active
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT sessions_expiry_future CHECK (expires_at > created_at)
);

CREATE INDEX idx_sessions_player ON sessions (player_id);
CREATE INDEX idx_sessions_token ON sessions (refresh_token) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_expires ON sessions (expires_at) WHERE revoked_at IS NULL;


-- ============================================================================
-- TABLE 4: MAP_TILES
-- ============================================================================
-- The hex grid world map using cube coordinates (q, r, s) where s = -q - r.
-- Each tile has terrain, optional resources, optional owning player/alliance,
-- and optional structures. This is the spatial backbone of the game.
--
-- For an 800x800 map, coordinates range roughly -400 to +400 on each axis.
-- The center (0,0) is the Veil Nexus in the Sovereign Ring.

CREATE TABLE map_tiles (
    q               INT NOT NULL,
    r               INT NOT NULL,
    s               INT GENERATED ALWAYS AS (-q - r) STORED,
    season_id       UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    terrain         terrain_type NOT NULL DEFAULT 'plains',
    zone            map_zone NOT NULL DEFAULT 'hearthlands',
    -- Resource node on this tile (NULL = no harvestable resource)
    resource        resource_type,
    resource_richness INT DEFAULT 0,               -- 0-100, yield multiplier
    -- Ownership
    owner_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    owner_alliance_id UUID,                        -- FK added after alliances table
    -- Structure on tile (settlement, watchtower, trade hub, etc.)
    structure_type  VARCHAR(50),                   -- NULL = empty tile
    structure_level INT DEFAULT 0,
    -- Corruption level in Wound Zones (0-100)
    corruption      INT NOT NULL DEFAULT 0,
    -- Metadata: NPC camps, decorative features, special flags
    metadata        JSONB NOT NULL DEFAULT '{}',
    -- Aether storm currently active on this tile
    has_aether_storm BOOLEAN NOT NULL DEFAULT FALSE,
    -- Timestamps
    claimed_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (q, r, season_id),
    CONSTRAINT map_tiles_cube_constraint CHECK (q + r + s = 0),
    CONSTRAINT map_tiles_corruption_range CHECK (corruption BETWEEN 0 AND 100),
    CONSTRAINT map_tiles_richness_range CHECK (resource_richness BETWEEN 0 AND 100)
);

-- Spatial lookups: find tiles near a coordinate. The composite index on
-- (season_id, q, r) enables efficient range scans for hex_distance queries.
CREATE INDEX idx_map_tiles_coords ON map_tiles (season_id, q, r);

-- Find all tiles owned by a player or alliance.
CREATE INDEX idx_map_tiles_owner_player ON map_tiles (owner_player_id, season_id)
    WHERE owner_player_id IS NOT NULL;
CREATE INDEX idx_map_tiles_owner_alliance ON map_tiles (owner_alliance_id, season_id)
    WHERE owner_alliance_id IS NOT NULL;

-- Filter by terrain or zone for world generation queries.
CREATE INDEX idx_map_tiles_terrain ON map_tiles (season_id, terrain);
CREATE INDEX idx_map_tiles_zone ON map_tiles (season_id, zone);

-- Resource node lookups (e.g., find all aether_stone tiles in a zone).
CREATE INDEX idx_map_tiles_resource ON map_tiles (season_id, resource)
    WHERE resource IS NOT NULL;

-- GiST index using btree_gist for efficient hex range queries.
-- This enables queries like: WHERE season_id = X AND q BETWEEN a AND b AND r BETWEEN c AND d
CREATE INDEX idx_map_tiles_gist ON map_tiles
    USING GIST (season_id, q int4_ops, r int4_ops);


-- ============================================================================
-- TABLE 5: SETTLEMENTS
-- ============================================================================
-- Player settlements placed on the hex map. Each settlement occupies a single
-- tile and contains buildings, armies, and resources. A player may control
-- multiple settlements (3-5 typical by mid-game).

CREATE TABLE settlements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season_id       UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    name            VARCHAR(50) NOT NULL,
    -- Hex position (references map_tiles)
    q               INT NOT NULL,
    r               INT NOT NULL,
    level           INT NOT NULL DEFAULT 1,        -- Town center level (1-20)
    faction         faction_type NOT NULL,
    -- Population and morale
    population      INT NOT NULL DEFAULT 100,
    max_population  INT NOT NULL DEFAULT 500,
    morale          INT NOT NULL DEFAULT 50,       -- 0-100, affects production & loyalty
    -- Storage caps (upgraded via warehouse buildings)
    storage_cap     JSONB NOT NULL DEFAULT '{
        "food": 5000, "wood": 5000, "stone": 5000,
        "iron": 3000, "aether_stone": 1000, "veil_crystal": 100
    }',
    -- Flags
    is_capital      BOOLEAN NOT NULL DEFAULT FALSE, -- Player's primary settlement
    is_ruin_refuge  BOOLEAN NOT NULL DEFAULT FALSE, -- Respawn point after total loss
    -- Under attack / siege state
    under_siege     BOOLEAN NOT NULL DEFAULT FALSE,
    siege_start     TIMESTAMPTZ,
    -- Built on an ancient ruin? (Ashen Covenant bonus)
    built_on_ruin   BOOLEAN NOT NULL DEFAULT FALSE,
    ruin_tier       ruin_tier,                      -- Tier of ruin if built_on_ruin
    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    destroyed_at    TIMESTAMPTZ,                    -- Soft delete on destruction

    CONSTRAINT settlements_level_range CHECK (level BETWEEN 1 AND 20),
    CONSTRAINT settlements_morale_range CHECK (morale BETWEEN 0 AND 100),
    CONSTRAINT settlements_population_positive CHECK (population >= 0),
    CONSTRAINT fk_settlements_tile FOREIGN KEY (q, r, season_id)
        REFERENCES map_tiles (q, r, season_id)
);

CREATE INDEX idx_settlements_player ON settlements (player_id, season_id)
    WHERE destroyed_at IS NULL;
CREATE INDEX idx_settlements_coords ON settlements (season_id, q, r);
CREATE INDEX idx_settlements_level ON settlements (season_id, level DESC)
    WHERE destroyed_at IS NULL;


-- ============================================================================
-- TABLE 6: BUILDINGS
-- ============================================================================
-- Individual buildings within a settlement. Each settlement has a grid of
-- building slots. Buildings produce resources, train units, research, or
-- provide passive bonuses.

CREATE TABLE buildings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id   UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
    building_type   building_type NOT NULL,
    level           INT NOT NULL DEFAULT 1,
    -- Position within the settlement grid (for UI layout)
    slot_position   INT NOT NULL,                  -- 0-based slot index
    -- Current HP for destructible buildings (walls, towers)
    hp_current      INT,
    hp_max          INT,
    -- Production bonus modifiers (from faction, relics, heroes, etc.)
    bonus_modifier  DECIMAL(5,4) NOT NULL DEFAULT 1.0000, -- 1.0 = no bonus
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,  -- Can be disabled during siege
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT buildings_level_range CHECK (level BETWEEN 1 AND 25),
    CONSTRAINT buildings_bonus_positive CHECK (bonus_modifier > 0),
    CONSTRAINT buildings_unique_slot UNIQUE (settlement_id, slot_position)
);

CREATE INDEX idx_buildings_settlement ON buildings (settlement_id);
CREATE INDEX idx_buildings_type ON buildings (settlement_id, building_type);


-- ============================================================================
-- TABLE 7: BUILDING_QUEUE
-- ============================================================================
-- Construction and upgrade queue per settlement. Processes sequentially;
-- start_time of item N+1 = end_time of item N. Supports cancellation.

CREATE TABLE building_queue (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id   UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
    building_id     UUID REFERENCES buildings(id) ON DELETE SET NULL, -- NULL for new construction
    building_type   building_type NOT NULL,
    target_level    INT NOT NULL,                  -- Level being built/upgraded to
    queue_position  INT NOT NULL,                  -- Order in queue (1-based)
    -- Timing
    start_time      TIMESTAMPTZ,                   -- NULL if queued but not started
    end_time        TIMESTAMPTZ,                   -- NULL if queued but not started
    -- Resource cost snapshot at time of queuing
    resource_cost   JSONB NOT NULL DEFAULT '{}',   -- {"food": 500, "wood": 300, ...}
    -- Status
    is_cancelled    BOOLEAN NOT NULL DEFAULT FALSE,
    cancelled_at    TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT building_queue_level_positive CHECK (target_level > 0),
    CONSTRAINT building_queue_timing CHECK (
        end_time IS NULL OR start_time IS NULL OR end_time > start_time
    )
);

CREATE INDEX idx_building_queue_settlement ON building_queue (settlement_id, queue_position)
    WHERE is_cancelled = FALSE AND completed_at IS NULL;
CREATE INDEX idx_building_queue_end_time ON building_queue (end_time)
    WHERE is_cancelled = FALSE AND completed_at IS NULL;


-- ============================================================================
-- TABLE 8: RESOURCES
-- ============================================================================
-- Per-settlement resource stockpiles. Five base resources plus the endgame
-- veil crystal. Updated by production ticks and player actions.

CREATE TABLE resources (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id   UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
    resource        resource_type NOT NULL,
    amount          DECIMAL(18,2) NOT NULL DEFAULT 0,
    -- Protected amount that cannot be raided (Underdog Protocol)
    protected_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT resources_unique UNIQUE (settlement_id, resource),
    CONSTRAINT resources_amount_non_negative CHECK (amount >= 0),
    CONSTRAINT resources_protected_non_negative CHECK (protected_amount >= 0)
);

CREATE INDEX idx_resources_settlement ON resources (settlement_id);


-- ============================================================================
-- TABLE 9: RESOURCE_PRODUCTION
-- ============================================================================
-- Calculated production rates per settlement per resource. Derived from
-- buildings, faction bonuses, hero buffs, and alliance effects. Recalculated
-- when buildings change (via trigger below).

CREATE TABLE resource_production (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id   UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
    resource        resource_type NOT NULL,
    -- Base production from buildings alone
    base_rate       DECIMAL(12,4) NOT NULL DEFAULT 0,  -- Per hour
    -- Multipliers applied on top
    faction_bonus   DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
    hero_bonus      DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
    alliance_bonus  DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
    event_bonus     DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
    -- Effective rate = base_rate * faction_bonus * hero_bonus * alliance_bonus * event_bonus
    effective_rate  DECIMAL(12,4) GENERATED ALWAYS AS (
        base_rate * faction_bonus * hero_bonus * alliance_bonus * event_bonus
    ) STORED,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT resource_production_unique UNIQUE (settlement_id, resource),
    CONSTRAINT resource_production_base_non_negative CHECK (base_rate >= 0)
);

CREATE INDEX idx_resource_production_settlement ON resource_production (settlement_id);
CREATE INDEX idx_resource_production_effective ON resource_production (effective_rate DESC);


-- ============================================================================
-- TABLE 10: ARMIES
-- ============================================================================
-- Army groups on the world map. Each army has a position, status, and optional
-- hero commander. Armies contain units defined in army_units.

CREATE TABLE armies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season_id       UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    name            VARCHAR(50),
    -- Current hex position
    q               INT NOT NULL,
    r               INT NOT NULL,
    status          army_status NOT NULL DEFAULT 'idle',
    -- Stationed at a settlement (NULL if in the field)
    settlement_id   UUID REFERENCES settlements(id) ON DELETE SET NULL,
    -- Commanding hero (NULL if leaderless)
    hero_id         UUID,                          -- FK added after heroes table
    -- Aggregate stats (recalculated when units change)
    total_units     INT NOT NULL DEFAULT 0,
    total_attack    BIGINT NOT NULL DEFAULT 0,
    total_defense   BIGINT NOT NULL DEFAULT 0,
    total_hp        BIGINT NOT NULL DEFAULT 0,
    carry_capacity  BIGINT NOT NULL DEFAULT 0,     -- Max loot capacity
    movement_speed  DECIMAL(6,2) NOT NULL DEFAULT 1.00, -- Tiles per hour
    -- Corruption accumulated from wound zone exposure
    corruption      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    disbanded_at    TIMESTAMPTZ,                   -- Soft delete

    CONSTRAINT armies_corruption_range CHECK (corruption BETWEEN 0 AND 100)
);

CREATE INDEX idx_armies_player ON armies (player_id, season_id) WHERE disbanded_at IS NULL;
CREATE INDEX idx_armies_coords ON armies (season_id, q, r) WHERE disbanded_at IS NULL;
CREATE INDEX idx_armies_status ON armies (status) WHERE disbanded_at IS NULL;
CREATE INDEX idx_armies_settlement ON armies (settlement_id) WHERE settlement_id IS NOT NULL AND disbanded_at IS NULL;
CREATE INDEX idx_armies_hero ON armies (hero_id) WHERE hero_id IS NOT NULL AND disbanded_at IS NULL;


-- ============================================================================
-- TABLE 11: ARMY_UNITS
-- ============================================================================
-- Unit composition within an army. Each row is a unit type and count.
-- Aggregate army stats are derived from this table.

CREATE TABLE army_units (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    army_id         UUID NOT NULL REFERENCES armies(id) ON DELETE CASCADE,
    unit            unit_type NOT NULL,
    count           INT NOT NULL DEFAULT 0,
    -- Per-unit stats at time of training (accounts for faction/building bonuses)
    attack_per_unit INT NOT NULL,
    defense_per_unit INT NOT NULL,
    hp_per_unit     INT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT army_units_unique UNIQUE (army_id, unit),
    CONSTRAINT army_units_count_positive CHECK (count > 0)
);

CREATE INDEX idx_army_units_army ON army_units (army_id);


-- ============================================================================
-- TABLE 12: MARCH_ORDERS
-- ============================================================================
-- Active marches between tiles. Each march has an origin, destination,
-- departure time, and calculated arrival time based on army speed and
-- terrain. The game server processes arrivals.

CREATE TABLE march_orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    army_id         UUID NOT NULL REFERENCES armies(id) ON DELETE CASCADE,
    player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    march_type      march_type NOT NULL,
    -- Origin tile
    origin_q        INT NOT NULL,
    origin_r        INT NOT NULL,
    -- Destination tile
    dest_q          INT NOT NULL,
    dest_r          INT NOT NULL,
    -- Path as ordered array of hex coordinates (for multi-hop routing)
    path            JSONB,                         -- [{"q":1,"r":2}, {"q":2,"r":2}, ...]
    -- Timing
    departure_time  TIMESTAMPTZ NOT NULL,
    arrival_time    TIMESTAMPTZ NOT NULL,
    -- Carried resources (for trade/raid return marches)
    carried_resources JSONB NOT NULL DEFAULT '{}', -- {"food": 100, "iron": 50, ...}
    -- Status
    is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
    is_cancelled    BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT march_orders_timing CHECK (arrival_time > departure_time)
);

CREATE INDEX idx_march_orders_army ON march_orders (army_id)
    WHERE is_completed = FALSE AND is_cancelled = FALSE;
CREATE INDEX idx_march_orders_player ON march_orders (player_id)
    WHERE is_completed = FALSE AND is_cancelled = FALSE;
-- Critical: server tick processes arriving marches by arrival_time
CREATE INDEX idx_march_orders_arrival ON march_orders (arrival_time)
    WHERE is_completed = FALSE AND is_cancelled = FALSE;
CREATE INDEX idx_march_orders_destination ON march_orders (dest_q, dest_r)
    WHERE is_completed = FALSE AND is_cancelled = FALSE;


-- ============================================================================
-- TABLE 13: BATTLES
-- ============================================================================
-- Battle log recording every combat encounter. Stores the outcome and
-- references to participants. Detailed round-by-round data in battle_details.

CREATE TABLE battles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id       UUID NOT NULL REFERENCES seasons(id),
    -- Location
    q               INT NOT NULL,
    r               INT NOT NULL,
    -- Participants
    attacker_player_id UUID NOT NULL REFERENCES players(id),
    defender_player_id UUID REFERENCES players(id),  -- NULL for NPC/world boss
    attacker_army_id   UUID REFERENCES armies(id),
    defender_army_id   UUID REFERENCES armies(id),
    attacker_alliance_id UUID,                       -- FK after alliances table
    defender_alliance_id UUID,
    -- Outcome
    result          battle_result NOT NULL,
    -- Casualty summary
    attacker_units_lost INT NOT NULL DEFAULT 0,
    defender_units_lost INT NOT NULL DEFAULT 0,
    attacker_units_start INT NOT NULL DEFAULT 0,
    defender_units_start INT NOT NULL DEFAULT 0,
    -- Loot captured by victor
    loot            JSONB NOT NULL DEFAULT '{}',
    -- Salvage (Ashen Covenant bonus drops)
    salvage         JSONB NOT NULL DEFAULT '{}',
    -- Hero injuries
    attacker_hero_injury injury_severity NOT NULL DEFAULT 'none',
    defender_hero_injury injury_severity NOT NULL DEFAULT 'none',
    -- Duration of battle in simulated rounds
    rounds          INT NOT NULL DEFAULT 1,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT battles_units_non_negative CHECK (
        attacker_units_lost >= 0 AND defender_units_lost >= 0
    )
);

CREATE INDEX idx_battles_season ON battles (season_id, occurred_at DESC);
CREATE INDEX idx_battles_attacker ON battles (attacker_player_id, occurred_at DESC);
CREATE INDEX idx_battles_defender ON battles (defender_player_id, occurred_at DESC);
CREATE INDEX idx_battles_coords ON battles (season_id, q, r);
CREATE INDEX idx_battles_alliances ON battles (attacker_alliance_id, defender_alliance_id)
    WHERE attacker_alliance_id IS NOT NULL;


-- ============================================================================
-- TABLE 14: BATTLE_DETAILS
-- ============================================================================
-- Detailed round-by-round combat simulation results stored as JSONB. Each
-- round captures unit-level actions, hero abilities, terrain effects, and
-- morale shifts. Kept separate from battles to avoid bloating the summary.

CREATE TABLE battle_details (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    battle_id       UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    round_number    INT NOT NULL,
    -- Full round state as JSONB for flexible replay
    -- Structure: {
    --   "attacker_units": [{"type": "...", "count": N, "hp": N, "actions": [...]}],
    --   "defender_units": [...],
    --   "hero_actions": [...],
    --   "terrain_effects": [...],
    --   "morale": {"attacker": N, "defender": N}
    -- }
    round_data      JSONB NOT NULL,
    -- Summary stats for quick access
    attacker_damage_dealt BIGINT NOT NULL DEFAULT 0,
    defender_damage_dealt BIGINT NOT NULL DEFAULT 0,
    attacker_units_killed INT NOT NULL DEFAULT 0,
    defender_units_killed INT NOT NULL DEFAULT 0,

    CONSTRAINT battle_details_unique_round UNIQUE (battle_id, round_number),
    CONSTRAINT battle_details_round_positive CHECK (round_number > 0)
);

CREATE INDEX idx_battle_details_battle ON battle_details (battle_id, round_number);


-- ============================================================================
-- TABLE 15: HEROES
-- ============================================================================
-- Hero instances belonging to players. Heroes persist across seasons (the
-- primary emotional investment). They have classes, levels, loyalty, scars,
-- personal quests, and equipment. Heroes can desert, be captured, or die.

CREATE TABLE heroes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    name            VARCHAR(50) NOT NULL,
    class           hero_class NOT NULL,
    level           INT NOT NULL DEFAULT 1,
    xp              BIGINT NOT NULL DEFAULT 0,
    xp_to_next_level BIGINT NOT NULL DEFAULT 100,
    -- Available skill points to allocate
    skill_points    INT NOT NULL DEFAULT 0,
    -- Loyalty system (0-100). Below 20 = risk of desertion.
    loyalty         INT NOT NULL DEFAULT 70,
    -- Status
    status          hero_status NOT NULL DEFAULT 'idle',
    -- Current location (hex coords if on map, NULL if in settlement)
    current_q       INT,
    current_r       INT,
    settlement_id   UUID REFERENCES settlements(id) ON DELETE SET NULL,
    -- Combat stats (base + level scaling)
    attack          INT NOT NULL DEFAULT 10,
    defense         INT NOT NULL DEFAULT 10,
    hp_max          INT NOT NULL DEFAULT 100,
    hp_current      INT NOT NULL DEFAULT 100,
    -- Corruption resistance (class-dependent, Driftwalkers highest)
    corruption_resistance INT NOT NULL DEFAULT 10,
    -- Scars (permanent modifiers from severe/critical injuries)
    scars           JSONB NOT NULL DEFAULT '[]',   -- [{"name": "Shattered Shield Arm", "effects": {...}}]
    scar_count      INT GENERATED ALWAYS AS (jsonb_array_length(scars)) STORED,
    -- Injury recovery
    injury          injury_severity NOT NULL DEFAULT 'none',
    recovery_until  TIMESTAMPTZ,
    -- Personality and lore (procedurally generated or handcrafted)
    personality     JSONB NOT NULL DEFAULT '{}',   -- Traits, backstory elements
    portrait_id     VARCHAR(50),                   -- Reference to portrait asset
    -- Hero is persistent across seasons
    origin_season   UUID REFERENCES seasons(id),
    is_dead         BOOLEAN NOT NULL DEFAULT FALSE, -- Permanent death (rare)
    died_at         TIMESTAMPTZ,
    death_cause     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT heroes_level_range CHECK (level BETWEEN 1 AND 30),
    CONSTRAINT heroes_loyalty_range CHECK (loyalty BETWEEN 0 AND 100),
    CONSTRAINT heroes_xp_non_negative CHECK (xp >= 0),
    CONSTRAINT heroes_hp_valid CHECK (hp_current >= 0 AND hp_current <= hp_max)
);

-- Now add the FK from armies to heroes.
ALTER TABLE armies ADD CONSTRAINT fk_armies_hero
    FOREIGN KEY (hero_id) REFERENCES heroes(id) ON DELETE SET NULL;

CREATE INDEX idx_heroes_player ON heroes (player_id) WHERE is_dead = FALSE;
CREATE INDEX idx_heroes_status ON heroes (status) WHERE is_dead = FALSE;
CREATE INDEX idx_heroes_class ON heroes (class) WHERE is_dead = FALSE;
CREATE INDEX idx_heroes_loyalty ON heroes (loyalty) WHERE loyalty < 20 AND is_dead = FALSE;
CREATE INDEX idx_heroes_recovery ON heroes (recovery_until)
    WHERE injury != 'none' AND recovery_until IS NOT NULL;


-- ============================================================================
-- TABLE 16: HERO_EQUIPMENT
-- ============================================================================
-- Items equipped on heroes. Each hero has 5 slots: weapon, armor, trinket,
-- and two relic slots. Equipment provides stat modifiers and special effects.

CREATE TABLE hero_equipment (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hero_id         UUID NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
    slot            equipment_slot NOT NULL,
    item_name       VARCHAR(100) NOT NULL,
    item_rarity     relic_rarity NOT NULL DEFAULT 'common',
    -- Stat bonuses
    attack_bonus    INT NOT NULL DEFAULT 0,
    defense_bonus   INT NOT NULL DEFAULT 0,
    hp_bonus        INT NOT NULL DEFAULT 0,
    -- Special effects stored as JSONB for flexibility
    -- e.g. {"lore_decrypt_speed": 0.3, "corruption_resistance": 15}
    special_effects JSONB NOT NULL DEFAULT '{}',
    -- Reference to relic if this is a relic slot
    relic_id        UUID,                          -- FK added after relics table
    -- Lore flavor text
    description     TEXT,
    equipped_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT hero_equipment_unique_slot UNIQUE (hero_id, slot)
);

CREATE INDEX idx_hero_equipment_hero ON hero_equipment (hero_id);
CREATE INDEX idx_hero_equipment_relic ON hero_equipment (relic_id) WHERE relic_id IS NOT NULL;


-- ============================================================================
-- TABLE 17: HERO_SKILLS
-- ============================================================================
-- Skill point allocation per hero. Each hero class has 3 skill trees,
-- each tree has multiple skills that can be leveled up.

CREATE TABLE hero_skills (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hero_id         UUID NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
    skill_tree      VARCHAR(50) NOT NULL,          -- e.g. 'command', 'siege', 'legacy'
    skill_name      VARCHAR(50) NOT NULL,          -- e.g. 'formation_tactics'
    points_invested INT NOT NULL DEFAULT 0,
    max_points      INT NOT NULL DEFAULT 5,
    -- Computed effects at current level
    effects         JSONB NOT NULL DEFAULT '{}',   -- {"army_size_bonus": 50, "unit_attack_pct": 0.05}
    unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT hero_skills_unique UNIQUE (hero_id, skill_tree, skill_name),
    CONSTRAINT hero_skills_points_valid CHECK (points_invested BETWEEN 0 AND max_points)
);

CREATE INDEX idx_hero_skills_hero ON hero_skills (hero_id);


-- ============================================================================
-- TABLE 18: HERO_QUESTS
-- ============================================================================
-- Personal quest chain progress per hero. Each hero has a 5-8 stage quest
-- that reveals backstory and culminates in a permanent defining choice.

CREATE TABLE hero_quests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hero_id         UUID NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
    quest_chain_id  VARCHAR(50) NOT NULL,          -- Template identifier
    current_stage   INT NOT NULL DEFAULT 1,
    total_stages    INT NOT NULL DEFAULT 5,
    -- Stage-specific objectives and progress
    stage_data      JSONB NOT NULL DEFAULT '{}',   -- {"objective": "...", "progress": 0, "target": 1}
    -- Has the defining choice been made?
    choice_made     BOOLEAN NOT NULL DEFAULT FALSE,
    chosen_option   VARCHAR(50),                   -- e.g. 'rebuild_fortress' or 'seal_memorial'
    -- Reward from choice
    choice_reward   JSONB,                         -- {"attack_bonus_pct": 0.25} or {"ability": "last_stand"}
    is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT hero_quests_stage_valid CHECK (current_stage BETWEEN 1 AND total_stages)
);

CREATE INDEX idx_hero_quests_hero ON hero_quests (hero_id);
CREATE INDEX idx_hero_quests_active ON hero_quests (hero_id)
    WHERE is_completed = FALSE;


-- ============================================================================
-- TABLE 19: FOG_OF_WAR
-- ============================================================================
-- Per-player tile visibility. Tracks which tiles each player has discovered,
-- explored, or currently has vision on. Vision sources include scout towers,
-- hero expeditions, alliance shared vision, and lore reveals.

CREATE TABLE fog_of_war (
    player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season_id       UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    q               INT NOT NULL,
    r               INT NOT NULL,
    visibility      visibility_level NOT NULL DEFAULT 'hidden',
    -- When the tile was first discovered and last seen
    discovered_at   TIMESTAMPTZ,
    last_seen_at    TIMESTAMPTZ,
    -- Vision source (for debugging and game logic)
    vision_source   VARCHAR(50),                   -- 'scout_tower', 'hero_expedition', 'alliance', etc.

    PRIMARY KEY (player_id, season_id, q, r)
);

-- Find all visible tiles for a player (for rendering the map).
CREATE INDEX idx_fow_player_visible ON fog_of_war (player_id, season_id)
    WHERE visibility = 'visible';
-- Tile-centric: who can see a specific tile?
CREATE INDEX idx_fow_tile ON fog_of_war (season_id, q, r)
    WHERE visibility = 'visible';


-- ============================================================================
-- TABLE 20: RUINS
-- ============================================================================
-- Explorable ancient ruins scattered across the map (200+ per season).
-- Tiered from minor (solo) to sovereign (full alliance siege). Contain
-- lore fragments, relics, resources, and narrative revelations.

CREATE TABLE ruins (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id       UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    q               INT NOT NULL,
    r               INT NOT NULL,
    tier            ruin_tier NOT NULL,
    status          ruin_status NOT NULL DEFAULT 'undiscovered',
    -- Requirements to explore
    min_players     INT NOT NULL DEFAULT 1,        -- Minimum players/army size
    requires_hero   BOOLEAN NOT NULL DEFAULT FALSE,
    required_keys   JSONB NOT NULL DEFAULT '[]',   -- Specific items/conditions needed
    -- Contents (revealed after exploration)
    loot_table      JSONB NOT NULL DEFAULT '{}',   -- Possible rewards
    lore_fragment_ids UUID[],                       -- Lore fragments contained
    -- Exploration progress (for multi-session explorations)
    exploration_progress DECIMAL(5,2) NOT NULL DEFAULT 0, -- 0-100%
    exploring_player_id  UUID REFERENCES players(id),
    exploring_alliance_id UUID,
    -- Guardian NPC (for guarded ruins)
    guardian_data   JSONB,                         -- NPC stats and abilities
    -- Metadata
    description     TEXT,
    discovered_by   UUID REFERENCES players(id),
    discovered_at   TIMESTAMPTZ,
    cleared_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ruins_season_coords ON ruins (season_id, q, r);
CREATE INDEX idx_ruins_status ON ruins (season_id, status);
CREATE INDEX idx_ruins_tier ON ruins (season_id, tier);


-- ============================================================================
-- TABLE 21: WORLD_BOSSES
-- ============================================================================
-- Seven world bosses per season, spawning at zone boundaries on variable
-- timers. Require multiple alliances or one very powerful alliance to defeat.

CREATE TABLE world_bosses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id       UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,          -- e.g. "The Hollow King"
    boss_key        VARCHAR(50) NOT NULL,           -- Identifier: 'hollow_king', 'aethermaw', etc.
    -- Location
    q               INT NOT NULL,
    r               INT NOT NULL,
    -- Status and HP
    status          boss_status NOT NULL DEFAULT 'dormant',
    hp_max          BIGINT NOT NULL,
    hp_current      BIGINT NOT NULL,
    -- Combat stats
    attack          INT NOT NULL,
    defense         INT NOT NULL,
    -- Special abilities and phases
    abilities       JSONB NOT NULL DEFAULT '[]',   -- Phase-based ability list
    -- Loot drops on defeat
    loot_table      JSONB NOT NULL DEFAULT '{}',
    -- Spawn timing
    next_spawn_at   TIMESTAMPTZ,
    last_defeated_at TIMESTAMPTZ,
    defeat_count    INT NOT NULL DEFAULT 0,
    -- Which alliances contributed to the current fight
    damage_contributors JSONB NOT NULL DEFAULT '{}', -- {"alliance_id": damage_dealt}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_world_bosses_season ON world_bosses (season_id);
CREATE INDEX idx_world_bosses_status ON world_bosses (status) WHERE status IN ('active', 'engaged');
CREATE INDEX idx_world_bosses_spawn ON world_bosses (next_spawn_at)
    WHERE status = 'dormant' OR status = 'respawning';


-- ============================================================================
-- TABLE 22: ALLIANCES
-- ============================================================================
-- Alliance organizations. The social backbone of the game. Alliances control
-- territory, wage wars, build Great Works, and make the Veil Choice.

CREATE TABLE alliances (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id       UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    name            VARCHAR(50) NOT NULL,
    tag             VARCHAR(5) NOT NULL,           -- Short tag displayed on map
    description     TEXT,
    -- Visual identity
    banner          JSONB NOT NULL DEFAULT '{}',   -- Color, emblem, pattern config
    -- Leadership
    sovereign_id    UUID REFERENCES players(id),   -- Alliance leader
    -- Treasury
    treasury        JSONB NOT NULL DEFAULT '{
        "food": 0, "wood": 0, "stone": 0,
        "iron": 0, "aether_stone": 0, "veil_crystal": 0
    }',
    -- Tribute rate set on controlled provinces (0-20%)
    tribute_rate    DECIMAL(4,2) NOT NULL DEFAULT 0,
    -- Alliance stats
    member_count    INT NOT NULL DEFAULT 1,
    max_members     INT NOT NULL DEFAULT 50,
    total_territory INT NOT NULL DEFAULT 0,        -- Hex count
    total_power     BIGINT NOT NULL DEFAULT 0,     -- Aggregate member power
    -- Policy direction (from seasonal elections)
    active_policy   VARCHAR(20),                   -- 'expansion', 'fortification', 'diplomacy', 'research'
    policy_expires  TIMESTAMPTZ,
    -- Reputation and flags
    is_oath_breaker BOOLEAN NOT NULL DEFAULT FALSE, -- Betrayed a formal agreement
    oath_breaker_until TIMESTAMPTZ,
    -- Alliance identity persists across seasons (name + banner)
    persistent_id   UUID,                          -- Links same alliance across seasons
    -- Season-end victory tracking
    territory_value BIGINT NOT NULL DEFAULT 0,
    battle_score    BIGINT NOT NULL DEFAULT 0,
    lore_score      BIGINT NOT NULL DEFAULT 0,
    diplomacy_score BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    dissolved_at    TIMESTAMPTZ,                   -- Soft delete

    CONSTRAINT alliances_name_unique UNIQUE (season_id, name),
    CONSTRAINT alliances_tag_unique UNIQUE (season_id, tag),
    CONSTRAINT alliances_tribute_range CHECK (tribute_rate BETWEEN 0 AND 20),
    CONSTRAINT alliances_members_valid CHECK (member_count >= 0 AND member_count <= max_members)
);

-- Now add FKs that referenced alliances.
ALTER TABLE map_tiles ADD CONSTRAINT fk_map_tiles_alliance
    FOREIGN KEY (owner_alliance_id) REFERENCES alliances(id) ON DELETE SET NULL;
ALTER TABLE battles ADD CONSTRAINT fk_battles_attacker_alliance
    FOREIGN KEY (attacker_alliance_id) REFERENCES alliances(id) ON DELETE SET NULL;
ALTER TABLE battles ADD CONSTRAINT fk_battles_defender_alliance
    FOREIGN KEY (defender_alliance_id) REFERENCES alliances(id) ON DELETE SET NULL;

CREATE INDEX idx_alliances_season ON alliances (season_id) WHERE dissolved_at IS NULL;
CREATE INDEX idx_alliances_sovereign ON alliances (sovereign_id);
CREATE INDEX idx_alliances_power ON alliances (season_id, total_power DESC)
    WHERE dissolved_at IS NULL;
CREATE INDEX idx_alliances_persistent ON alliances (persistent_id)
    WHERE persistent_id IS NOT NULL;


-- ============================================================================
-- TABLE 23: ALLIANCE_MEMBERS
-- ============================================================================
-- Membership records linking players to alliances with roles, contribution
-- tracking, and join/leave timestamps.

CREATE TABLE alliance_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alliance_id     UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
    player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    role            alliance_role NOT NULL DEFAULT 'member',
    -- Contribution tracking
    total_resources_donated JSONB NOT NULL DEFAULT '{}',
    total_battles_fought INT NOT NULL DEFAULT 0,
    total_territory_captured INT NOT NULL DEFAULT 0,
    contribution_score BIGINT NOT NULL DEFAULT 0,
    -- Timestamps
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    promoted_at     TIMESTAMPTZ,
    left_at         TIMESTAMPTZ,                   -- NULL = active member
    -- Was this a defection?
    is_defection    BOOLEAN NOT NULL DEFAULT FALSE,
    defected_to     UUID REFERENCES alliances(id),

    CONSTRAINT alliance_members_unique_active UNIQUE (alliance_id, player_id),
    CONSTRAINT alliance_members_no_self_defection CHECK (
        defected_to IS NULL OR defected_to != alliance_id
    )
);

CREATE INDEX idx_alliance_members_alliance ON alliance_members (alliance_id)
    WHERE left_at IS NULL;
CREATE INDEX idx_alliance_members_player ON alliance_members (player_id)
    WHERE left_at IS NULL;
CREATE INDEX idx_alliance_members_role ON alliance_members (alliance_id, role)
    WHERE left_at IS NULL;
CREATE INDEX idx_alliance_members_contribution ON alliance_members (alliance_id, contribution_score DESC)
    WHERE left_at IS NULL;


-- ============================================================================
-- TABLE 24: ALLIANCE_DIPLOMACY
-- ============================================================================
-- Diplomatic agreements between alliances: pacts, trade alliances, coalitions,
-- vassalage, and secret agreements. Secret agreements have is_secret = TRUE
-- and are only visible to the two parties.

CREATE TABLE alliance_diplomacy (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id       UUID NOT NULL REFERENCES seasons(id),
    -- The two parties
    alliance_a_id   UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
    alliance_b_id   UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
    diplomacy_type  diplomacy_type NOT NULL,
    -- Agreement details
    terms           JSONB NOT NULL DEFAULT '{}',   -- Custom terms, tribute %, etc.
    is_secret       BOOLEAN NOT NULL DEFAULT FALSE,
    -- Duration
    start_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
    min_end_date    TIMESTAMPTZ,                   -- Cannot break before this
    actual_end_date TIMESTAMPTZ,
    -- Status
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    broken_by       UUID REFERENCES alliances(id), -- Who broke the agreement
    broken_reason   TEXT,
    -- Vassalage-specific
    is_vassal_a     BOOLEAN NOT NULL DEFAULT FALSE, -- alliance_a is the vassal
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT diplomacy_different_alliances CHECK (alliance_a_id != alliance_b_id)
);

CREATE INDEX idx_alliance_diplomacy_a ON alliance_diplomacy (alliance_a_id)
    WHERE is_active = TRUE;
CREATE INDEX idx_alliance_diplomacy_b ON alliance_diplomacy (alliance_b_id)
    WHERE is_active = TRUE;
CREATE INDEX idx_alliance_diplomacy_type ON alliance_diplomacy (diplomacy_type)
    WHERE is_active = TRUE;
CREATE INDEX idx_alliance_diplomacy_season ON alliance_diplomacy (season_id)
    WHERE is_active = TRUE;


-- ============================================================================
-- TABLE 25: ALLIANCE_WARS
-- ============================================================================
-- Formal war declarations with stated objectives, war bonds, duration, and
-- structured resolution. Wars generate bonus loot, enable permanent territory
-- changes, and record detailed chronicles.

CREATE TABLE alliance_wars (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id       UUID NOT NULL REFERENCES seasons(id),
    -- Belligerents
    attacker_alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
    defender_alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
    -- War parameters (declared upfront)
    objective       war_objective NOT NULL,
    objective_details JSONB NOT NULL DEFAULT '{}', -- Specific targets, demands
    war_bond        JSONB NOT NULL DEFAULT '{}',   -- Resources committed by attacker
    duration_days   INT NOT NULL,                  -- 7, 14, or 28
    -- Status tracking
    status          war_status NOT NULL DEFAULT 'declared',
    declared_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,                   -- Combat begins (24h after declaration)
    ends_at         TIMESTAMPTZ,                   -- Calculated from started_at + duration
    resolved_at     TIMESTAMPTZ,
    -- Score tracking during war
    attacker_war_score BIGINT NOT NULL DEFAULT 0,
    defender_war_score BIGINT NOT NULL DEFAULT 0,
    -- Battle count
    total_battles   INT NOT NULL DEFAULT 0,
    -- Ceasefire negotiation
    ceasefire_proposed_by UUID REFERENCES alliances(id),
    ceasefire_terms JSONB,
    -- Resolution
    victor_alliance_id UUID REFERENCES alliances(id),
    resolution_terms JSONB,                        -- Final settlement
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT wars_different_alliances CHECK (attacker_alliance_id != defender_alliance_id),
    CONSTRAINT wars_duration_valid CHECK (duration_days IN (7, 14, 28))
);

CREATE INDEX idx_alliance_wars_season ON alliance_wars (season_id)
    WHERE status IN ('declared', 'active');
CREATE INDEX idx_alliance_wars_attacker ON alliance_wars (attacker_alliance_id)
    WHERE status IN ('declared', 'active');
CREATE INDEX idx_alliance_wars_defender ON alliance_wars (defender_alliance_id)
    WHERE status IN ('declared', 'active');
CREATE INDEX idx_alliance_wars_status ON alliance_wars (status, ends_at)
    WHERE status = 'active';


-- ============================================================================
-- TABLE 26: ALLIANCE_GREAT_WORKS
-- ============================================================================
-- Mega-construction projects that take 2-4 weeks and require contributions
-- from many alliance members. Provide powerful alliance-wide bonuses.

CREATE TABLE alliance_great_works (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alliance_id     UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
    season_id       UUID NOT NULL REFERENCES seasons(id),
    work_type       great_work_type NOT NULL,
    name            VARCHAR(100),                  -- Custom name (e.g. "The Iron Reach Wall")
    -- Location on map (for positional works like walls and towers)
    q               INT,
    r               INT,
    -- Progress tracking
    total_cost      JSONB NOT NULL,                -- {"food": 50000, "stone": 80000, ...}
    contributed     JSONB NOT NULL DEFAULT '{}',   -- Current contributions
    progress_pct    DECIMAL(5,2) NOT NULL DEFAULT 0,
    -- Per-member contribution log
    member_contributions JSONB NOT NULL DEFAULT '{}', -- {"player_id": {"food": 1000, ...}}
    -- Timing
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    estimated_completion TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    -- Status
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
    is_cancelled    BOOLEAN NOT NULL DEFAULT FALSE,
    -- Effects when completed
    effects         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_great_works_alliance ON alliance_great_works (alliance_id)
    WHERE is_active = TRUE;
CREATE INDEX idx_great_works_season ON alliance_great_works (season_id)
    WHERE is_completed = TRUE;


-- ============================================================================
-- TABLE 27: LORE_FRAGMENTS
-- ============================================================================
-- Individual lore pieces forming the narrative of Aetherra. Organized into
-- codex chapters (The Breaking, The Seven, etc.). Each fragment has content,
-- a decryption difficulty, and a location where it can be found.

CREATE TABLE lore_fragments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter         lore_chapter NOT NULL,
    fragment_number INT NOT NULL,                  -- Order within chapter
    title           VARCHAR(100) NOT NULL,
    content         TEXT NOT NULL,                  -- The actual lore text
    -- Decryption difficulty determines how long it takes to decode
    decrypt_difficulty INT NOT NULL DEFAULT 1,     -- 1-10 scale
    -- Where this fragment can be found
    found_in        VARCHAR(100),                  -- 'minor_ruin', 'wound_zone_echo', etc.
    -- Season-specific (NULL = available every season)
    season_specific BOOLEAN NOT NULL DEFAULT FALSE,
    season_id       UUID REFERENCES seasons(id),
    -- Rarity
    is_rare         BOOLEAN NOT NULL DEFAULT FALSE,
    -- Metadata for conditional availability
    conditions      JSONB NOT NULL DEFAULT '{}',   -- {"requires_event": "convergence", "min_zone": "wound_zones"}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT lore_fragments_unique UNIQUE (chapter, fragment_number)
);

CREATE INDEX idx_lore_fragments_chapter ON lore_fragments (chapter);
CREATE INDEX idx_lore_fragments_rare ON lore_fragments (is_rare) WHERE is_rare = TRUE;


-- ============================================================================
-- TABLE 28: PLAYER_LORE
-- ============================================================================
-- Tracks which lore fragments each player has discovered and/or decrypted.
-- The Chronicle is assembled from decrypted fragments.

CREATE TABLE player_lore (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    fragment_id     UUID NOT NULL REFERENCES lore_fragments(id) ON DELETE CASCADE,
    -- Discovery state
    is_discovered   BOOLEAN NOT NULL DEFAULT TRUE, -- Found but not yet decrypted
    is_decrypted    BOOLEAN NOT NULL DEFAULT FALSE, -- Fully readable
    -- Where and when found
    discovered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    decrypted_at    TIMESTAMPTZ,
    discovered_location VARCHAR(100),              -- Description of where found
    -- Which hero helped discover/decrypt it
    hero_id         UUID REFERENCES heroes(id),

    CONSTRAINT player_lore_unique UNIQUE (player_id, fragment_id)
);

CREATE INDEX idx_player_lore_player ON player_lore (player_id);
CREATE INDEX idx_player_lore_undecrypted ON player_lore (player_id)
    WHERE is_discovered = TRUE AND is_decrypted = FALSE;


-- ============================================================================
-- TABLE 29: LORE_DECRYPT_QUEUE
-- ============================================================================
-- Active decryption timers. When a player assigns a hero to decrypt a
-- lore fragment, a timer starts. Duration depends on fragment difficulty
-- and hero/building bonuses.

CREATE TABLE lore_decrypt_queue (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    player_lore_id  UUID NOT NULL REFERENCES player_lore(id) ON DELETE CASCADE,
    hero_id         UUID REFERENCES heroes(id),    -- Hero assigned to decryption
    settlement_id   UUID REFERENCES settlements(id), -- Where decryption happens
    -- Timing
    start_time      TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time        TIMESTAMPTZ NOT NULL,
    -- Speed modifiers applied
    speed_modifier  DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
    -- Status
    is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
    is_cancelled    BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT decrypt_timing CHECK (end_time > start_time)
);

CREATE INDEX idx_decrypt_queue_player ON lore_decrypt_queue (player_id)
    WHERE is_completed = FALSE AND is_cancelled = FALSE;
CREATE INDEX idx_decrypt_queue_end ON lore_decrypt_queue (end_time)
    WHERE is_completed = FALSE AND is_cancelled = FALSE;


-- ============================================================================
-- TABLE 30: RELICS
-- ============================================================================
-- Relic item definitions. Relics are the most powerful equipment, found in
-- ruins, crafted from fragments, or earned from world events. Each has a
-- name, lore, and unique effects.

CREATE TABLE relics (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT NOT NULL,
    lore_text       TEXT,                          -- Flavor text with history
    rarity          relic_rarity NOT NULL,
    -- Stat bonuses
    attack_bonus    INT NOT NULL DEFAULT 0,
    defense_bonus   INT NOT NULL DEFAULT 0,
    hp_bonus        INT NOT NULL DEFAULT 0,
    -- Special effects (flexible JSONB for arbitrary game mechanics)
    effects         JSONB NOT NULL DEFAULT '{}',
    -- e.g. {"lore_decrypt_speed": 0.30, "reveal_hidden_ruins": true, "corruption_resistance": 15}
    -- Where this relic can be found
    source          VARCHAR(100),                  -- 'sealed_vault', 'world_boss_hollow_king', etc.
    -- Can only be used by specific faction or class?
    faction_restriction faction_type,
    class_restriction   hero_class,
    -- Visual
    icon_id         VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_relics_rarity ON relics (rarity);
CREATE INDEX idx_relics_source ON relics (source) WHERE source IS NOT NULL;


-- ============================================================================
-- TABLE 31: PLAYER_RELICS
-- ============================================================================
-- Relic inventory per player. Relics can be equipped on heroes, stored in
-- settlement vaults, or carried over between seasons (up to 5).

CREATE TABLE player_relics (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    relic_id        UUID NOT NULL REFERENCES relics(id) ON DELETE CASCADE,
    -- Where is this relic?
    is_equipped     BOOLEAN NOT NULL DEFAULT FALSE,
    equipped_hero_id UUID REFERENCES heroes(id),
    stored_settlement_id UUID REFERENCES settlements(id),
    -- Carry-over flag for seasonal persistence
    carry_over      BOOLEAN NOT NULL DEFAULT FALSE,
    -- How it was obtained
    obtained_from   VARCHAR(100),                  -- 'ruin:sealed_vault_alpha', 'boss:aethermaw', etc.
    obtained_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Was it lost (dropped on hero death, stolen in raid)?
    is_lost         BOOLEAN NOT NULL DEFAULT FALSE,
    lost_at         TIMESTAMPTZ,
    lost_reason     VARCHAR(100),

    CONSTRAINT player_relics_equip_check CHECK (
        (is_equipped = FALSE) OR (is_equipped = TRUE AND equipped_hero_id IS NOT NULL)
    )
);

-- Now add the FK from hero_equipment to relics.
ALTER TABLE hero_equipment ADD CONSTRAINT fk_hero_equipment_relic
    FOREIGN KEY (relic_id) REFERENCES relics(id) ON DELETE SET NULL;

CREATE INDEX idx_player_relics_player ON player_relics (player_id)
    WHERE is_lost = FALSE;
CREATE INDEX idx_player_relics_hero ON player_relics (equipped_hero_id)
    WHERE is_equipped = TRUE;
CREATE INDEX idx_player_relics_carry ON player_relics (player_id)
    WHERE carry_over = TRUE AND is_lost = FALSE;


-- ============================================================================
-- TABLE 32: WORLD_EVENTS
-- ============================================================================
-- Server-wide events that shape the game world. Includes aether eclipses,
-- echo incursions, convergences, geysers, and the endgame awakening.

CREATE TABLE world_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id       UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    event_type      event_type NOT NULL,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    -- Location (NULL for map-wide events)
    q               INT,
    r               INT,
    affected_radius INT,                           -- Hex radius of effect
    -- Timing
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ,
    -- Event-specific configuration
    config          JSONB NOT NULL DEFAULT '{}',
    -- e.g. for aether_geyser: {"resource": "aether_stone", "yield_per_hour": 500}
    -- e.g. for echo_incursion: {"army_power": 50000, "path": [...]}
    -- Resolution
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,
    resolution_data JSONB,                         -- Outcome, winners, rewards
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_world_events_season ON world_events (season_id, starts_at);
CREATE INDEX idx_world_events_active ON world_events (season_id)
    WHERE is_active = TRUE;
CREATE INDEX idx_world_events_type ON world_events (season_id, event_type);
CREATE INDEX idx_world_events_upcoming ON world_events (starts_at)
    WHERE is_active = FALSE AND is_resolved = FALSE;


-- ============================================================================
-- TABLE 33: BATTLE_HISTORY (Partitioned)
-- ============================================================================
-- Permanent war record for the alliance chronicle and the Eternal Chronicle
-- that persists across seasons. Partitioned by month for efficient querying
-- and maintenance.

CREATE TABLE battle_history (
    id              UUID NOT NULL DEFAULT uuid_generate_v4(),
    season_id       UUID NOT NULL,
    battle_id       UUID NOT NULL,                 -- Reference to original battle
    -- Summary for chronicle display
    title           VARCHAR(200) NOT NULL,         -- Auto-generated: "Battle of the Iron Pass"
    -- Participants
    attacker_player_id UUID NOT NULL,
    attacker_player_name VARCHAR(50) NOT NULL,
    attacker_alliance_id UUID,
    attacker_alliance_name VARCHAR(50),
    defender_player_id UUID,
    defender_player_name VARCHAR(50),
    defender_alliance_id UUID,
    defender_alliance_name VARCHAR(50),
    -- Location
    q               INT NOT NULL,
    r               INT NOT NULL,
    zone            map_zone,
    -- Outcome summary
    result          battle_result NOT NULL,
    attacker_units  INT NOT NULL,
    defender_units  INT NOT NULL,
    casualties      INT NOT NULL,
    -- Notable events (hero injuries, relic drops, etc.)
    notable_events  JSONB NOT NULL DEFAULT '[]',
    -- War context
    war_id          UUID,                          -- If part of a formal war
    -- Denormalized for fast reads
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Create partitions for the next 12 months (extend as needed).
-- In production, use pg_partman for automatic partition management.
CREATE TABLE battle_history_2026_01 PARTITION OF battle_history
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE battle_history_2026_02 PARTITION OF battle_history
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE battle_history_2026_03 PARTITION OF battle_history
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE battle_history_2026_04 PARTITION OF battle_history
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE battle_history_2026_05 PARTITION OF battle_history
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE battle_history_2026_06 PARTITION OF battle_history
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE battle_history_2026_07 PARTITION OF battle_history
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE battle_history_2026_08 PARTITION OF battle_history
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE battle_history_2026_09 PARTITION OF battle_history
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE battle_history_2026_10 PARTITION OF battle_history
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE battle_history_2026_11 PARTITION OF battle_history
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE battle_history_2026_12 PARTITION OF battle_history
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE INDEX idx_battle_history_season ON battle_history (season_id, occurred_at DESC);
CREATE INDEX idx_battle_history_attacker ON battle_history (attacker_alliance_id, occurred_at DESC);
CREATE INDEX idx_battle_history_defender ON battle_history (defender_alliance_id, occurred_at DESC);
CREATE INDEX idx_battle_history_war ON battle_history (war_id, occurred_at DESC)
    WHERE war_id IS NOT NULL;


-- ============================================================================
-- TABLE 34: PLAYER_NOTIFICATIONS
-- ============================================================================
-- In-game notification queue. Notifications are created by game events and
-- consumed by the client. Supports priority levels and read/dismiss tracking.

CREATE TABLE player_notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    notification_type notification_type NOT NULL,
    title           VARCHAR(200) NOT NULL,
    message         TEXT NOT NULL,
    -- Contextual data for client-side actions (e.g. "go to battle report")
    action_data     JSONB NOT NULL DEFAULT '{}',   -- {"battle_id": "...", "settlement_id": "..."}
    -- Priority
    is_urgent       BOOLEAN NOT NULL DEFAULT FALSE,
    -- Read/dismiss state
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    is_dismissed    BOOLEAN NOT NULL DEFAULT FALSE,
    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ                    -- Auto-cleanup for old notifications
);

CREATE INDEX idx_notifications_player ON player_notifications (player_id, created_at DESC)
    WHERE is_dismissed = FALSE;
CREATE INDEX idx_notifications_unread ON player_notifications (player_id)
    WHERE is_read = FALSE AND is_dismissed = FALSE;
CREATE INDEX idx_notifications_urgent ON player_notifications (player_id)
    WHERE is_urgent = TRUE AND is_read = FALSE;
CREATE INDEX idx_notifications_expires ON player_notifications (expires_at)
    WHERE expires_at IS NOT NULL AND is_dismissed = FALSE;


-- ============================================================================
-- TABLE 35: CHAT_MESSAGES (Partitioned)
-- ============================================================================
-- Alliance and global chat. Partitioned by week for efficient cleanup of
-- old messages and fast recent-message queries.

CREATE TABLE chat_messages (
    id              UUID NOT NULL DEFAULT uuid_generate_v4(),
    channel         chat_channel NOT NULL,
    -- Sender
    sender_id       UUID NOT NULL,                 -- Player ID (no FK for partition compat)
    sender_name     VARCHAR(50) NOT NULL,          -- Denormalized for fast reads
    sender_faction  faction_type,
    -- Alliance context (NULL for global/whisper)
    alliance_id     UUID,
    -- Whisper target (NULL for non-whisper)
    recipient_id    UUID,
    -- Message content
    content         TEXT NOT NULL,
    -- Metadata
    is_system       BOOLEAN NOT NULL DEFAULT FALSE, -- System announcement
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE, -- Moderator removed
    -- Attachments (lore shares, battle reports, coordinates)
    attachments     JSONB NOT NULL DEFAULT '[]',
    -- Timestamp is the partition key
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (id, sent_at),
    CONSTRAINT chat_content_length CHECK (char_length(content) BETWEEN 1 AND 2000)
) PARTITION BY RANGE (sent_at);

-- Weekly partitions for the next 3 months (use pg_partman in production).
CREATE TABLE chat_messages_2026_w10 PARTITION OF chat_messages
    FOR VALUES FROM ('2026-03-02') TO ('2026-03-09');
CREATE TABLE chat_messages_2026_w11 PARTITION OF chat_messages
    FOR VALUES FROM ('2026-03-09') TO ('2026-03-16');
CREATE TABLE chat_messages_2026_w12 PARTITION OF chat_messages
    FOR VALUES FROM ('2026-03-16') TO ('2026-03-23');
CREATE TABLE chat_messages_2026_w13 PARTITION OF chat_messages
    FOR VALUES FROM ('2026-03-23') TO ('2026-03-30');
CREATE TABLE chat_messages_2026_w14 PARTITION OF chat_messages
    FOR VALUES FROM ('2026-03-30') TO ('2026-04-06');
CREATE TABLE chat_messages_2026_w15 PARTITION OF chat_messages
    FOR VALUES FROM ('2026-04-06') TO ('2026-04-13');
CREATE TABLE chat_messages_2026_w16 PARTITION OF chat_messages
    FOR VALUES FROM ('2026-04-13') TO ('2026-04-20');
CREATE TABLE chat_messages_2026_w17 PARTITION OF chat_messages
    FOR VALUES FROM ('2026-04-20') TO ('2026-04-27');
CREATE TABLE chat_messages_2026_w18 PARTITION OF chat_messages
    FOR VALUES FROM ('2026-04-27') TO ('2026-05-04');
CREATE TABLE chat_messages_2026_w19 PARTITION OF chat_messages
    FOR VALUES FROM ('2026-05-04') TO ('2026-05-11');
CREATE TABLE chat_messages_2026_w20 PARTITION OF chat_messages
    FOR VALUES FROM ('2026-05-11') TO ('2026-05-18');
CREATE TABLE chat_messages_2026_w21 PARTITION OF chat_messages
    FOR VALUES FROM ('2026-05-18') TO ('2026-05-25');

CREATE INDEX idx_chat_channel ON chat_messages (channel, sent_at DESC);
CREATE INDEX idx_chat_alliance ON chat_messages (alliance_id, sent_at DESC)
    WHERE alliance_id IS NOT NULL;
CREATE INDEX idx_chat_sender ON chat_messages (sender_id, sent_at DESC);
CREATE INDEX idx_chat_whisper ON chat_messages (recipient_id, sent_at DESC)
    WHERE recipient_id IS NOT NULL;


-- ============================================================================
-- TABLE 36: LEGACY_REWARDS
-- ============================================================================
-- End-of-season rewards per player. Calculated during season resolution
-- and redeemable in the next season.

CREATE TABLE legacy_rewards (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season_id       UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    -- Points earned and breakdown
    legacy_points_earned INT NOT NULL DEFAULT 0,
    breakdown       JSONB NOT NULL DEFAULT '{}',
    -- {"battles_won": 50, "territory_held": 30, "lore_collected": 20, "alliance_rank": 100}
    -- Victory titles earned
    titles          TEXT[] NOT NULL DEFAULT '{}',   -- ['The Unconquered', 'Keeper of Memory']
    -- Relics carried over (up to 5)
    carried_relics  UUID[] NOT NULL DEFAULT '{}',
    -- Heroes carried over (all survive)
    carried_heroes  UUID[] NOT NULL DEFAULT '{}',
    -- Was this claimed/redeemed in the next season?
    is_claimed      BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_at      TIMESTAMPTZ,
    -- Season epilogue personalized narrative
    epilogue_text   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT legacy_rewards_unique UNIQUE (player_id, season_id),
    CONSTRAINT legacy_rewards_points_non_negative CHECK (legacy_points_earned >= 0),
    CONSTRAINT legacy_rewards_relics_limit CHECK (array_length(carried_relics, 1) IS NULL
        OR array_length(carried_relics, 1) <= 5)
);

CREATE INDEX idx_legacy_rewards_player ON legacy_rewards (player_id);
CREATE INDEX idx_legacy_rewards_season ON legacy_rewards (season_id);
CREATE INDEX idx_legacy_rewards_unclaimed ON legacy_rewards (player_id)
    WHERE is_claimed = FALSE;


-- ============================================================================
-- TRIGGER: Auto-update resource_production when buildings change
-- ============================================================================
-- When a building is created, updated, or deleted, recalculate the base
-- production rates for that settlement. This keeps resource_production
-- in sync without requiring application-level coordination.

-- Production rates per building type per level (simplified lookup).
-- In production, this would be a reference table or config, but for the
-- trigger logic we use a helper function.

CREATE OR REPLACE FUNCTION get_building_production(
    p_building_type building_type,
    p_level INT
) RETURNS TABLE(resource resource_type, rate DECIMAL(12,4))
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
    -- Returns hourly production rate for a given building type and level.
    -- Each level multiplies base rate by 1.0 + (level - 1) * 0.25.
    RETURN QUERY
    SELECT res, (base * (1.0 + (p_level - 1) * 0.25))::DECIMAL(12,4)
    FROM (VALUES
        ('farm'::building_type,            'food'::resource_type,         50.0),
        ('lumber_mill'::building_type,     'wood'::resource_type,         40.0),
        ('quarry'::building_type,          'stone'::resource_type,        35.0),
        ('iron_mine'::building_type,       'iron'::resource_type,         25.0),
        ('aether_extractor'::building_type,'aether_stone'::resource_type, 10.0),
        ('aether_refinery'::building_type, 'aether_stone'::resource_type, 15.0)
    ) AS t(btype, res, base)
    WHERE btype = p_building_type;
END;
$$;

CREATE OR REPLACE FUNCTION recalculate_resource_production()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_settlement_id UUID;
    v_resource resource_type;
    v_total_rate DECIMAL(12,4);
BEGIN
    -- Determine which settlement was affected.
    IF TG_OP = 'DELETE' THEN
        v_settlement_id := OLD.settlement_id;
    ELSE
        v_settlement_id := NEW.settlement_id;
    END IF;

    -- Recalculate base rates for all resource types for this settlement.
    FOR v_resource IN SELECT unnest(enum_range(NULL::resource_type))
    LOOP
        SELECT COALESCE(SUM(bp.rate * b.bonus_modifier), 0)
        INTO v_total_rate
        FROM buildings b
        CROSS JOIN LATERAL get_building_production(b.building_type, b.level) bp
        WHERE b.settlement_id = v_settlement_id
          AND b.is_active = TRUE
          AND bp.resource = v_resource;

        INSERT INTO resource_production (settlement_id, resource, base_rate)
        VALUES (v_settlement_id, v_resource, v_total_rate)
        ON CONFLICT (settlement_id, resource)
        DO UPDATE SET
            base_rate = v_total_rate,
            updated_at = now();
    END LOOP;

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_buildings_production_update
    AFTER INSERT OR UPDATE OR DELETE ON buildings
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_resource_production();

COMMENT ON FUNCTION recalculate_resource_production() IS
    'Recalculates base resource production rates for a settlement whenever '
    'its buildings are created, modified, or destroyed. Ensures resource_production '
    'table stays consistent with the actual building state.';


-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Apply to all tables with updated_at columns.
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'updated_at'
          AND table_schema = 'public'
          AND table_name NOT IN ('chat_messages', 'battle_history') -- partitioned tables
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW
             EXECUTE FUNCTION update_timestamp()',
            tbl, tbl
        );
    END LOOP;
END;
$$;


-- ============================================================================
-- TRIGGER: Enforce alliance role limits
-- ============================================================================
-- Ensures only 1 sovereign, max 5 council, max 10 wardens, max 3 emissaries
-- per alliance.

CREATE OR REPLACE FUNCTION check_alliance_role_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INT;
    v_max INT;
BEGIN
    IF NEW.left_at IS NOT NULL THEN
        RETURN NEW;  -- Leaving members skip checks
    END IF;

    CASE NEW.role
        WHEN 'sovereign' THEN v_max := 1;
        WHEN 'council' THEN v_max := 5;
        WHEN 'warden' THEN v_max := 10;
        WHEN 'emissary' THEN v_max := 3;
        ELSE RETURN NEW;  -- No limit on commander/member
    END CASE;

    SELECT COUNT(*) INTO v_count
    FROM alliance_members
    WHERE alliance_id = NEW.alliance_id
      AND role = NEW.role
      AND left_at IS NULL
      AND id != COALESCE(NEW.id, uuid_generate_v4());

    IF v_count >= v_max THEN
        RAISE EXCEPTION 'Alliance role % limit reached (max %)', NEW.role, v_max;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_alliance_role_limits
    BEFORE INSERT OR UPDATE ON alliance_members
    FOR EACH ROW
    EXECUTE FUNCTION check_alliance_role_limits();


-- ============================================================================
-- TRIGGER: Update alliance member count
-- ============================================================================

CREATE OR REPLACE FUNCTION update_alliance_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_alliance_id UUID;
BEGIN
    v_alliance_id := COALESCE(NEW.alliance_id, OLD.alliance_id);

    UPDATE alliances
    SET member_count = (
        SELECT COUNT(*) FROM alliance_members
        WHERE alliance_id = v_alliance_id AND left_at IS NULL
    )
    WHERE id = v_alliance_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_alliance_member_count
    AFTER INSERT OR UPDATE OR DELETE ON alliance_members
    FOR EACH ROW
    EXECUTE FUNCTION update_alliance_member_count();


-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active marches with computed progress percentage.
CREATE VIEW v_active_marches AS
SELECT
    mo.*,
    CASE
        WHEN mo.arrival_time <= now() THEN 100.0
        ELSE ROUND(
            EXTRACT(EPOCH FROM (now() - mo.departure_time)) /
            NULLIF(EXTRACT(EPOCH FROM (mo.arrival_time - mo.departure_time)), 0) * 100,
            2
        )
    END AS progress_pct,
    hex_distance(mo.origin_q, mo.origin_r, mo.dest_q, mo.dest_r) AS hex_distance
FROM march_orders mo
WHERE mo.is_completed = FALSE AND mo.is_cancelled = FALSE;

COMMENT ON VIEW v_active_marches IS
    'Active march orders with computed progress percentage and hex distance.';

-- Settlement overview with resource totals and production rates.
CREATE VIEW v_settlement_overview AS
SELECT
    s.id AS settlement_id,
    s.name,
    s.player_id,
    s.q, s.r,
    s.level,
    s.faction,
    s.population,
    s.morale,
    jsonb_object_agg(r.resource, r.amount) AS resource_stockpile,
    jsonb_object_agg(rp.resource, rp.effective_rate) AS production_rates
FROM settlements s
LEFT JOIN resources r ON r.settlement_id = s.id
LEFT JOIN resource_production rp ON rp.settlement_id = s.id
WHERE s.destroyed_at IS NULL
GROUP BY s.id;

COMMENT ON VIEW v_settlement_overview IS
    'Combines settlement info with current resource stockpiles and production rates.';

-- Alliance leaderboard.
CREATE VIEW v_alliance_leaderboard AS
SELECT
    a.id,
    a.name,
    a.tag,
    a.member_count,
    a.total_power,
    a.total_territory,
    a.battle_score,
    a.territory_value,
    a.lore_score,
    a.active_policy,
    a.is_oath_breaker,
    RANK() OVER (ORDER BY a.total_power DESC) AS power_rank,
    RANK() OVER (ORDER BY a.territory_value DESC) AS territory_rank,
    RANK() OVER (ORDER BY a.battle_score DESC) AS battle_rank
FROM alliances a
WHERE a.dissolved_at IS NULL;

COMMENT ON VIEW v_alliance_leaderboard IS
    'Alliance rankings by power, territory value, and battle score.';

-- Hero roster with equipment summary.
CREATE VIEW v_hero_roster AS
SELECT
    h.id AS hero_id,
    h.name,
    h.class,
    h.level,
    h.loyalty,
    h.status,
    h.injury,
    h.scar_count,
    h.player_id,
    COALESCE(
        jsonb_agg(
            jsonb_build_object('slot', he.slot, 'item', he.item_name, 'rarity', he.item_rarity)
        ) FILTER (WHERE he.id IS NOT NULL),
        '[]'::jsonb
    ) AS equipment
FROM heroes h
LEFT JOIN hero_equipment he ON he.hero_id = h.id
WHERE h.is_dead = FALSE
GROUP BY h.id;

COMMENT ON VIEW v_hero_roster IS
    'Hero listing with equipped items aggregated into a JSONB array.';


-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE seasons IS
    'Season metadata controlling the 10-12 week seasonal cycle. '
    'The veil_choice made at season end shapes the next season world state.';

COMMENT ON TABLE players IS
    'Core player accounts. Faction choice is per-season. Legacy points and '
    'heroes persist across seasons as the primary long-term progression.';

COMMENT ON TABLE sessions IS
    'JWT refresh token tracking for authentication. Enables token rotation '
    'and revocation without invalidating all sessions.';

COMMENT ON TABLE map_tiles IS
    'Hex grid world map using cube coordinates (q, r, s where s = -q-r). '
    'Each tile has terrain, zone, optional resources, and ownership. '
    'The center (0,0) is the Veil Nexus in the Sovereign Ring.';

COMMENT ON TABLE settlements IS
    'Player settlements occupying hex tiles. Contains buildings, armies, '
    'and resources. Players may control 1-5+ settlements.';

COMMENT ON TABLE buildings IS
    'Individual buildings within a settlement. Type and level determine '
    'resource production, military training, defense, and special abilities.';

COMMENT ON TABLE building_queue IS
    'Construction and upgrade queue per settlement. Items process sequentially. '
    'Resource costs are captured at queue time for consistency.';

COMMENT ON TABLE resources IS
    'Per-settlement resource stockpiles for the six resource types. '
    'Protected amounts cannot be raided (Underdog Protocol mechanic).';

COMMENT ON TABLE resource_production IS
    'Calculated production rates per settlement. Base rate derived from buildings '
    'via trigger; multipliers from faction, hero, alliance, and events. '
    'Effective rate is a generated column: base * all multipliers.';

COMMENT ON TABLE armies IS
    'Army groups on the world map with position, status, and optional hero '
    'commander. Aggregate stats are recalculated when army_units change.';

COMMENT ON TABLE army_units IS
    'Unit composition within an army. Each row is a unit type with count '
    'and per-unit stats frozen at training time for reproducible combat.';

COMMENT ON TABLE march_orders IS
    'Active marches between hex tiles. Server tick processes arrivals by '
    'scanning march_orders.arrival_time. Supports multi-hop path routing.';

COMMENT ON TABLE battles IS
    'Battle log recording every combat encounter with outcome, casualties, '
    'loot, and hero injuries. Referenced by battle_details for round data.';

COMMENT ON TABLE battle_details IS
    'Round-by-round combat simulation stored as JSONB. Enables battle replay '
    'in the client and detailed combat analysis.';

COMMENT ON TABLE heroes IS
    'Hero instances persisting across seasons. The primary emotional investment. '
    'Heroes have classes, levels, loyalty, scars, and personal quest arcs. '
    'Can desert (low loyalty), be captured, or permanently die (rare).';

COMMENT ON TABLE hero_equipment IS
    'Equipment slots per hero: weapon, armor, trinket, and two relic slots. '
    'Each item provides stat bonuses and JSONB special effects.';

COMMENT ON TABLE hero_skills IS
    'Skill point allocation across three class-specific skill trees. '
    'Points earned on level-up, effects computed per skill level.';

COMMENT ON TABLE hero_quests IS
    'Personal quest chains per hero (5-8 stages). Reveals backstory and '
    'culminates in a permanent defining choice that shapes hero abilities.';

COMMENT ON TABLE fog_of_war IS
    'Per-player hex tile visibility tracking. Three states: hidden, explored '
    '(seen before but no current vision), visible (active vision source).';

COMMENT ON TABLE ruins IS
    'Explorable ancient ruins (200+ per season) across the map. Tiered from '
    'minor (solo) to sovereign (full alliance siege). Contain lore and relics.';

COMMENT ON TABLE world_bosses IS
    'Seven world bosses per season at zone boundaries. Variable spawn timers, '
    'require multi-alliance effort. Track damage contributors for loot split.';

COMMENT ON TABLE alliances IS
    'Alliance organizations: the social backbone. Control territory, wage wars, '
    'build Great Works, set policy, and ultimately make the Veil Choice.';

COMMENT ON TABLE alliance_members IS
    'Membership linking players to alliances with roles, contribution tracking, '
    'and defection history. Role limits enforced by trigger.';

COMMENT ON TABLE alliance_diplomacy IS
    'Diplomatic agreements between alliances. Supports both public treaties '
    'and secret agreements (shadow pacts, intelligence sharing, staged battles).';

COMMENT ON TABLE alliance_wars IS
    'Formal war declarations with objectives, war bonds, duration, and '
    'structured resolution. Wars generate bonus loot and permanent territory changes.';

COMMENT ON TABLE alliance_great_works IS
    'Alliance mega-construction projects (2-4 weeks). Grand Wall, Aether Refinery, '
    'Beacon Tower, Hall of Echoes, War Forge. Tracks per-member contributions.';

COMMENT ON TABLE lore_fragments IS
    'Narrative lore pieces organized into codex chapters. Each has decryption '
    'difficulty and location constraints. The Hidden Chapter unlocks the 5th veil choice.';

COMMENT ON TABLE player_lore IS
    'Per-player lore fragment discovery and decryption status. The Chronicle '
    'is assembled from decrypted fragments on the client side.';

COMMENT ON TABLE lore_decrypt_queue IS
    'Active decryption timers. Heroes and Archive buildings accelerate decryption. '
    'Duration = base_time / decrypt_difficulty * speed_modifier.';

COMMENT ON TABLE relics IS
    'Relic item definitions: the most powerful equipment in the game. Found in '
    'ruins, crafted from fragments, or earned from world events and bosses.';

COMMENT ON TABLE player_relics IS
    'Per-player relic inventory. Relics can be equipped on heroes, stored, or '
    'carried over between seasons (max 5). Can be lost on hero death or raid.';

COMMENT ON TABLE world_events IS
    'Server-wide events: aether eclipses, echo incursions, convergences, geysers, '
    'the wanderer market, and the endgame awakening. Drive emergent PvP/PvE.';

COMMENT ON TABLE battle_history IS
    'Permanent war chronicle partitioned by month. Denormalized from battles '
    'for fast reads. Persists in the Eternal Chronicle across seasons.';

COMMENT ON TABLE player_notifications IS
    'In-game notification queue with priority, read state, and contextual action '
    'data. Supports attack alerts, construction completion, hero events, etc.';

COMMENT ON TABLE chat_messages IS
    'Chat messages partitioned by week. Supports global, alliance (general/war room/'
    'intel/chronicle), and whisper channels. Old partitions are dropped for cleanup.';

COMMENT ON TABLE legacy_rewards IS
    'End-of-season rewards: legacy points, titles, carried relics and heroes, '
    'and personalized epilogue narrative. Redeemable in the next season.';


-- ============================================================================
-- USAGE EXAMPLES (as comments)
-- ============================================================================

-- Find all tiles within 5 hexes of a position (e.g., for settlement vision):
--
--   SELECT * FROM map_tiles
--   WHERE season_id = $1
--     AND hex_distance(q, r, $2, $3) <= 5;
--
-- Using the GiST index for a bounding box pre-filter:
--
--   SELECT * FROM map_tiles
--   WHERE season_id = $1
--     AND q BETWEEN ($2 - 5) AND ($2 + 5)
--     AND r BETWEEN ($3 - 5) AND ($3 + 5)
--     AND hex_distance(q, r, $2, $3) <= 5;

-- Find the 6 direct neighbors of a hex tile:
--
--   SELECT mt.* FROM hex_neighbors($1, $2) hn
--   JOIN map_tiles mt ON mt.q = hn.nq AND mt.r = hn.nr AND mt.season_id = $3;

-- Get all armies marching toward a tile (incoming attack detection):
--
--   SELECT * FROM v_active_marches
--   WHERE dest_q = $1 AND dest_r = $2 AND march_type IN ('attack', 'siege');

-- Settlement resource tick (run every N minutes by game server):
--
--   UPDATE resources r
--   SET amount = LEAST(
--       r.amount + (rp.effective_rate * $interval_hours),
--       (s.storage_cap->>r.resource::text)::decimal
--   ),
--   updated_at = now()
--   FROM resource_production rp
--   JOIN settlements s ON s.id = rp.settlement_id
--   WHERE r.settlement_id = rp.settlement_id
--     AND r.resource = rp.resource
--     AND s.destroyed_at IS NULL;

-- ============================================================================
-- DAILY REWARDS
-- ============================================================================

CREATE TABLE daily_rewards (
    player_id       UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    current_day     INT NOT NULL DEFAULT 1 CHECK (current_day BETWEEN 1 AND 7),
    streak          INT NOT NULL DEFAULT 0,
    last_claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_claimed   INT NOT NULL DEFAULT 0
);

COMMIT;
