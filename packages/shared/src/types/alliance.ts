export type AllianceRole = 'sovereign' | 'council' | 'warden' | 'emissary' | 'commander' | 'member';

export type DiplomacyType = 'non_aggression' | 'trade_alliance' | 'military_coalition' | 'vassalage' | 'shadow_pact' | 'rivalry';

export type WarStatus = 'declared' | 'active' | 'ceasefire' | 'resolved';

export interface Alliance {
  id: string;
  name: string;
  tag: string;
  bannerConfig: BannerConfig;
  sovereignId: string;
  memberCount: number;
  territoryCount: number;
  treasury: Record<string, number>;
  createdAt: string;
}

export interface BannerConfig {
  backgroundColor: string;
  symbolId: string;
  symbolColor: string;
  borderStyle: string;
}

export interface AllianceWar {
  id: string;
  attackerAllianceId: string;
  defenderAllianceId: string;
  objective: string;
  status: WarStatus;
  startedAt: string;
  endsAt: string;
  attackerScore: number;
  defenderScore: number;
}
