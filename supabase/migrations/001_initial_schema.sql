-- VEILFALL: Echoes of the Sky Rupture - Supabase Schema
-- Run this in the Supabase SQL Editor

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE faction_type AS ENUM ('ironveil', 'aetheri', 'thornwatch', 'ashen');
CREATE TYPE march_type AS ENUM ('attack', 'scout', 'reinforce');
CREATE TYPE march_status AS ENUM ('marching', 'arrived', 'returning');
CREATE TYPE alliance_role AS ENUM ('leader', 'officer', 'member');
CREATE TYPE diplomacy_type AS ENUM ('alliance', 'nap', 'war');
CREATE TYPE diplomacy_status AS ENUM ('pending', 'active', 'rejected');
CREATE TYPE battle_winner AS ENUM ('attacker', 'defender', 'draw');
CREATE TYPE map_event_type AS ENUM ('ruin', 'resource_node', 'npc_camp', 'aether_surge');
CREATE TYPE map_event_status AS ENUM ('active', 'claimed', 'expired');
CREATE TYPE chat_channel_type AS ENUM ('global', 'alliance', 'whisper');
CREATE TYPE chronicle_event_type AS ENUM ('building_complete', 'building_upgrade', 'unit_trained', 'march_sent', 'march_returned', 'combat', 'alliance_joined', 'quest_complete', 'lore_discovered');
CREATE TYPE trade_status AS ENUM ('open', 'completed', 'cancelled');
CREATE TYPE spy_mission_type AS ENUM ('intel', 'sabotage');
CREATE TYPE spy_mission_status AS ENUM ('infiltrating', 'active', 'completed', 'failed', 'caught');
CREATE TYPE seasonal_event_type AS ENUM ('harvest_moon', 'aether_storm', 'ironclad_tournament');
CREATE TYPE seasonal_event_status AS ENUM ('active', 'completed', 'expired');
CREATE TYPE hero_class_type AS ENUM ('warlord', 'sage', 'shadowblade', 'steward', 'herald', 'driftwalker');
CREATE TYPE hero_status_type AS ENUM ('idle', 'marching', 'expedition', 'injured', 'recovering', 'garrisoned', 'questing');
CREATE TYPE hero_quest_type AS ENUM ('exploration', 'training', 'relic_hunt', 'veil_expedition');
CREATE TYPE hero_quest_status AS ENUM ('active', 'completed', 'failed');
CREATE TYPE world_boss_type AS ENUM ('veil_titan', 'aether_wyrm', 'shadow_colossus');
CREATE TYPE world_boss_status AS ENUM ('active', 'defeated', 'despawned');

-- ============================================================
-- 1. PLAYERS
-- ============================================================
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  faction faction_type NOT NULL,
  alliance_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_email ON players(email);
CREATE INDEX idx_players_username ON players(username);
CREATE INDEX idx_players_alliance ON players(alliance_id);

-- ============================================================
-- 2. SETTLEMENTS
-- ============================================================
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  q INTEGER NOT NULL,
  r INTEGER NOT NULL,
  s INTEGER NOT NULL,
  resources JSONB NOT NULL DEFAULT '{"food":500,"wood":500,"stone":300,"iron":200,"aether_stone":50}',
  buildings JSONB NOT NULL DEFAULT '[{"type":"town_center","level":1,"position":0}]',
  build_queue JSONB NOT NULL DEFAULT '[]',
  units JSONB NOT NULL DEFAULT '{}',
  train_queue JSONB NOT NULL DEFAULT '[]',
  researched JSONB NOT NULL DEFAULT '{}',
  research_queue JSONB DEFAULT NULL,
  UNIQUE(q, r, s)
);

CREATE INDEX idx_settlements_player ON settlements(player_id);
CREATE INDEX idx_settlements_coords ON settlements(q, r);

-- ============================================================
-- 3. HEROES
-- ============================================================
CREATE TABLE heroes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hero_class hero_class_type NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  loyalty INTEGER NOT NULL DEFAULT 80,
  status hero_status_type NOT NULL DEFAULT 'idle',
  abilities JSONB NOT NULL DEFAULT '[]',
  equipment JSONB NOT NULL DEFAULT '{"weapon":null,"armor":null,"accessory":null,"relic":null}',
  stats JSONB NOT NULL DEFAULT '{"strength":10,"intellect":10,"agility":10,"endurance":10}'
);

CREATE INDEX idx_heroes_player ON heroes(player_id);

-- ============================================================
-- 4. MARCHES
-- ============================================================
CREATE TABLE marches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  units JSONB NOT NULL DEFAULT '{}',
  from_q INTEGER NOT NULL,
  from_r INTEGER NOT NULL,
  to_q INTEGER NOT NULL,
  to_r INTEGER NOT NULL,
  type march_type NOT NULL,
  started_at BIGINT NOT NULL,
  arrived_at BIGINT NOT NULL,
  status march_status NOT NULL DEFAULT 'marching',
  hero_id UUID REFERENCES heroes(id) ON DELETE SET NULL
);

CREATE INDEX idx_marches_player ON marches(player_id);
CREATE INDEX idx_marches_settlement ON marches(settlement_id);
CREATE INDEX idx_marches_status ON marches(status);

-- ============================================================
-- 5. ALLIANCES
-- ============================================================
CREATE TABLE alliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  tag TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  leader_id UUID NOT NULL REFERENCES players(id),
  members JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  banner JSONB NOT NULL DEFAULT '{"primaryColor":"#4A6670","secondaryColor":"#1A2744","icon":"shield"}'
);

CREATE INDEX idx_alliances_tag ON alliances(tag);
CREATE INDEX idx_alliances_leader ON alliances(leader_id);

-- Add FK from players to alliances (deferred because of circular reference)
ALTER TABLE players ADD CONSTRAINT fk_players_alliance FOREIGN KEY (alliance_id) REFERENCES alliances(id) ON DELETE SET NULL;

-- ============================================================
-- 6. DIPLOMACY
-- ============================================================
CREATE TABLE diplomacy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  to_alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  type diplomacy_type NOT NULL,
  status diplomacy_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diplomacy_from ON diplomacy(from_alliance_id);
CREATE INDEX idx_diplomacy_to ON diplomacy(to_alliance_id);

-- ============================================================
-- 7. BATTLE REPORTS
-- ============================================================
CREATE TABLE battle_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  defender_id UUID REFERENCES players(id) ON DELETE SET NULL,
  location JSONB NOT NULL DEFAULT '{"q":0,"r":0}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  attacker_units JSONB NOT NULL DEFAULT '{}',
  defender_units JSONB NOT NULL DEFAULT '{}',
  attacker_losses JSONB NOT NULL DEFAULT '{}',
  defender_losses JSONB NOT NULL DEFAULT '{}',
  winner battle_winner NOT NULL,
  loot JSONB NOT NULL DEFAULT '{}',
  hero_involved JSONB DEFAULT NULL
);

CREATE INDEX idx_battle_reports_attacker ON battle_reports(attacker_id);
CREATE INDEX idx_battle_reports_defender ON battle_reports(defender_id);
CREATE INDEX idx_battle_reports_timestamp ON battle_reports(timestamp DESC);

-- ============================================================
-- 8. MAP EVENTS
-- ============================================================
CREATE TABLE map_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type map_event_type NOT NULL,
  q INTEGER NOT NULL,
  r INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rewards JSONB NOT NULL DEFAULT '{}',
  guardians JSONB DEFAULT NULL,
  discovered_by UUID REFERENCES players(id) ON DELETE SET NULL,
  status map_event_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_map_events_coords ON map_events(q, r);
CREATE INDEX idx_map_events_status ON map_events(status);
CREATE UNIQUE INDEX idx_map_events_active_hex ON map_events(q, r) WHERE status = 'active';

-- ============================================================
-- 9. MESSAGES (Chat)
-- ============================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type chat_channel_type NOT NULL,
  channel_id TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_channel ON messages(channel_type, channel_id, timestamp DESC);

-- ============================================================
-- 10. CHRONICLE EVENTS
-- ============================================================
CREATE TABLE chronicle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type chronicle_event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  data JSONB DEFAULT NULL
);

CREATE INDEX idx_chronicle_player_time ON chronicle_events(player_id, timestamp DESC);

-- ============================================================
-- 11. MAIL
-- ============================================================
CREATE TABLE mail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  from_username TEXT NOT NULL,
  to_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  to_username TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  starred BOOLEAN NOT NULL DEFAULT false,
  deleted_by_sender BOOLEAN NOT NULL DEFAULT false,
  deleted_by_recipient BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mail_to ON mail(to_player_id, sent_at DESC);
CREATE INDEX idx_mail_from ON mail(from_player_id, sent_at DESC);

-- ============================================================
-- 12. TRADE OFFERS
-- ============================================================
CREATE TABLE trade_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  offer_resource TEXT NOT NULL,
  offer_amount INTEGER NOT NULL,
  request_resource TEXT NOT NULL,
  request_amount INTEGER NOT NULL,
  status trade_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_by UUID REFERENCES players(id) ON DELETE SET NULL
);

CREATE INDEX idx_trade_status ON trade_offers(status);
CREATE INDEX idx_trade_seller ON trade_offers(seller_id);

-- ============================================================
-- 13. SPY MISSIONS
-- ============================================================
CREATE TABLE spy_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  target_settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  target_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type spy_mission_type NOT NULL,
  status spy_mission_status NOT NULL DEFAULT 'infiltrating',
  started_at BIGINT NOT NULL,
  arrived_at BIGINT NOT NULL,
  completed_at BIGINT DEFAULT NULL,
  result JSONB DEFAULT NULL
);

CREATE INDEX idx_spy_player ON spy_missions(player_id);
CREATE INDEX idx_spy_target ON spy_missions(target_player_id);
CREATE INDEX idx_spy_status ON spy_missions(status);

-- ============================================================
-- 14. SEASONAL EVENTS
-- ============================================================
CREATE TABLE seasonal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type seasonal_event_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  status seasonal_event_status NOT NULL DEFAULT 'active',
  objectives JSONB NOT NULL DEFAULT '{"description":"","target":0}',
  rewards JSONB NOT NULL DEFAULT '{}',
  bonus_description TEXT NOT NULL DEFAULT ''
);

-- ============================================================
-- 15. EVENT PROGRESS
-- ============================================================
CREATE TABLE event_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES seasonal_events(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  claimed_reward BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(player_id, event_id)
);

CREATE INDEX idx_event_progress_event ON event_progress(event_id);

-- ============================================================
-- 16. HERO QUESTS
-- ============================================================
CREATE TABLE hero_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  hero_id UUID NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  quest_type hero_quest_type NOT NULL,
  status hero_quest_status NOT NULL DEFAULT 'active',
  started_at BIGINT NOT NULL,
  ends_at BIGINT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 1,
  rewards JSONB DEFAULT NULL
);

CREATE INDEX idx_hero_quests_player ON hero_quests(player_id, status);
CREATE INDEX idx_hero_quests_hero ON hero_quests(hero_id, status);

-- ============================================================
-- 17. WORLD BOSSES
-- ============================================================
CREATE TABLE world_bosses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  type world_boss_type NOT NULL,
  q INTEGER NOT NULL,
  r INTEGER NOT NULL,
  health INTEGER NOT NULL,
  max_health INTEGER NOT NULL,
  attack INTEGER NOT NULL,
  defense INTEGER NOT NULL,
  rewards JSONB NOT NULL DEFAULT '{}',
  status world_boss_status NOT NULL DEFAULT 'active',
  spawned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  attackers JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_world_bosses_status ON world_bosses(status);

-- ============================================================
-- 18. NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_player ON notifications(player_id, created_at DESC);

-- ============================================================
-- RLS POLICIES (Row Level Security)
-- ============================================================
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE heroes ENABLE ROW LEVEL SECURITY;
ALTER TABLE marches ENABLE ROW LEVEL SECURITY;
ALTER TABLE alliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE diplomacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chronicle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE spy_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_bosses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- For now, allow full access via service role (server-side)
-- The game server authenticates via JWT and handles authorization itself
CREATE POLICY "Allow all for service role" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON settlements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON heroes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON marches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON alliances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON diplomacy FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON battle_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON map_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON chronicle_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON mail FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON trade_offers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON spy_missions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON seasonal_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON event_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON hero_quests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON world_bosses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON notifications FOR ALL USING (true) WITH CHECK (true);
