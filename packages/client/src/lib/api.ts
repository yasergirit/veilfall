import { useAuthStore } from '../stores/auth-store.js';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  // Only set Content-Type for requests with a body
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  Object.assign(headers, options.headers);

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.details?.join(', ') || data.error || 'Request failed');
  }

  return data as T;
}

export const api = {
  // Settlements
  getSettlements: () =>
    request<{ settlements: any[] }>('/settlements'),

  buildBuilding: (settlementId: string, buildingType: string) =>
    request<{ message: string; endsAt: number; resources: any; buildQueue: any[] }>(
      `/settlements/${settlementId}/build`,
      { method: 'POST', body: JSON.stringify({ buildingType }) },
    ),

  // Map
  getMapTiles: (centerQ: number, centerR: number, radius = 10) =>
    request<{ tiles: any[] }>(`/map/tiles?centerQ=${centerQ}&centerR=${centerR}&radius=${radius}`),

  upgradeBuilding: (settlementId: string, buildingType: string) =>
    request<{ message: string; endsAt: number; resources: any; buildQueue: any[] }>(
      `/settlements/${settlementId}/upgrade`,
      { method: 'POST', body: JSON.stringify({ buildingType }) },
    ),

  rushBuilding: (settlementId: string, buildingType: string) =>
    request<{ message: string; resources: any; buildings: any[]; buildQueue: any[] }>(
      `/settlements/${settlementId}/rush`,
      { method: 'POST', body: JSON.stringify({ buildingType }) },
    ),

  // Units
  getUnitConfigs: () => request<{ configs: any }>('/units/configs'),

  trainUnits: (settlementId: string, unitType: string, count: number) =>
    request<any>(`/units/${settlementId}/train`, { method: 'POST', body: JSON.stringify({ unitType, count }) }),

  // Marches
  sendMarch: (settlementId: string, units: Record<string, number>, toQ: number, toR: number, type: string, heroId?: string) =>
    request<any>(`/marches/${settlementId}/send`, { method: 'POST', body: JSON.stringify({ units, toQ, toR, type, ...(heroId ? { heroId } : {}) }) }),

  getMarches: (settlementId: string) =>
    request<{ marches: any[] }>(`/marches/${settlementId}`),

  // Heroes
  getHeroes: () =>
    request<{ heroes: any[] }>('/heroes'),

  // Alliance
  createAlliance: (data: { name: string; tag: string; description: string; banner: any }) =>
    request<any>('/alliance/create', { method: 'POST', body: JSON.stringify(data) }),
  getMyAlliance: () => request<any>('/alliance'),
  searchAlliances: (q: string) => request<any>(`/alliance/search?q=${encodeURIComponent(q)}`),
  getAlliance: (id: string) => request<any>(`/alliance/${id}`),
  joinAlliance: (id: string) => request<any>(`/alliance/${id}/join`, { method: 'POST' }),
  leaveAlliance: (id: string) => request<any>(`/alliance/${id}/leave`, { method: 'POST' }),
  kickMember: (allianceId: string, playerId: string) =>
    request<any>(`/alliance/${allianceId}/kick`, { method: 'POST', body: JSON.stringify({ playerId }) }),
  promoteMember: (allianceId: string, playerId: string, role: string) =>
    request<any>(`/alliance/${allianceId}/promote`, { method: 'POST', body: JSON.stringify({ playerId, role }) }),
  proposeDiplomacy: (allianceId: string, targetAllianceId: string, type: string) =>
    request<any>(`/alliance/${allianceId}/diplomacy`, { method: 'POST', body: JSON.stringify({ targetAllianceId, type }) }),
  getDiplomacy: (allianceId: string) => request<any>(`/alliance/${allianceId}/diplomacy`),

  // Chat
  sendChatMessage: (channelType: string, channelId: string, content: string) =>
    request<any>('/chat/send', { method: 'POST', body: JSON.stringify({ channelType, channelId, content }) }),
  getChatMessages: (channelType: string, channelId: string, limit?: number) =>
    request<any>(`/chat/messages?channelType=${channelType}&channelId=${channelId}&limit=${limit ?? 50}`),
  getChatChannels: () => request<any>('/chat/channels'),

  // Chronicle
  getChronicleEvents: (limit?: number, offset?: number, type?: string) =>
    request<any>(`/chronicle/events?limit=${limit ?? 20}&offset=${offset ?? 0}${type ? '&type=' + type : ''}`),
  getChronicleLore: () => request<any>('/chronicle/lore'),

  // Battle Reports
  getBattleReports: (limit?: number, offset?: number) =>
    request<any>(`/reports?limit=${limit ?? 20}&offset=${offset ?? 0}`),
  getBattleReport: (id: string) => request<any>(`/reports/${id}`),

  // Hero Abilities & Equipment
  getHeroAbilities: () => request<any>('/heroes/abilities'),
  getEquipmentItems: () => request<any>('/heroes/items'),
  equipItem: (heroId: string, slot: string, itemId: string) =>
    request<any>(`/heroes/${heroId}/equip`, { method: 'POST', body: JSON.stringify({ slot, itemId }) }),
  unequipItem: (heroId: string, slot: string) =>
    request<any>(`/heroes/${heroId}/unequip`, { method: 'POST', body: JSON.stringify({ slot }) }),

  // Map Visibility (Fog of War)
  getVisibility: () =>
    request<{ visibleTiles: Array<{ q: number; r: number }> }>('/map/visibility'),

  // Map Events
  getMapEvents: (centerQ: number, centerR: number, radius?: number) =>
    request<any>(`/map/events?centerQ=${centerQ}&centerR=${centerR}&radius=${radius ?? 15}`),

  // Marketplace
  createTradeOffer: (data: { settlementId: string; offerResource: string; offerAmount: number; requestResource: string; requestAmount: number }) =>
    request<any>('/marketplace/offer', { method: 'POST', body: JSON.stringify(data) }),
  getTradeOffers: (resource?: string) =>
    request<any>(`/marketplace/offers${resource ? '?resource=' + resource : ''}`),
  acceptTrade: (offerId: string) =>
    request<any>(`/marketplace/accept/${offerId}`, { method: 'POST' }),
  cancelTrade: (offerId: string) =>
    request<any>(`/marketplace/cancel/${offerId}`, { method: 'POST' }),
  getTradeHistory: () => request<any>('/marketplace/history'),

  // Research
  getResearchTree: () => request<any>('/research/tree'),
  getResearchStatus: (settlementId: string) => request<any>(`/research/${settlementId}`),
  startResearch: (settlementId: string, type: string) =>
    request<any>(`/research/${settlementId}/start`, { method: 'POST', body: JSON.stringify({ type }) }),

  // Aether Cycle
  getAetherCycle: () =>
    request<{ phase: string; changedAt: number; nextChangeAt: number; surgeMultiplier: number }>('/map/cycle'),

  // Seasonal Events
  getActiveEvent: () => request<any>('/events'),
  claimEventReward: () => request<any>('/events/claim', { method: 'POST' }),
  getEventHistory: () => request<any>('/events/history'),

  // Leaderboard
  getLeaderboard: (type?: string, limit?: number) =>
    request<any>(`/leaderboard/rankings?type=${type ?? 'power'}&limit=${limit ?? 50}`),
  getMyRank: () => request<any>('/leaderboard/me'),
  getAllianceRankings: () => request<any>('/leaderboard/alliance-rankings'),

  // Spy / Espionage
  sendSpy: (settlementId: string, targetQ: number, targetR: number, type: 'intel' | 'sabotage') =>
    request<any>('/spy/send', { method: 'POST', body: JSON.stringify({ settlementId, targetQ, targetR, type }) }),
  getSpyMissions: () => request<any>('/spy/missions'),
  getSpyReport: (id: string) => request<any>(`/spy/reports/${id}`),

  // Mail
  getInbox: (limit?: number, offset?: number, unreadOnly?: boolean) =>
    request<any>(`/mail/inbox?limit=${limit ?? 20}&offset=${offset ?? 0}${unreadOnly ? '&unreadOnly=true' : ''}`),
  getSentMail: (limit?: number, offset?: number) =>
    request<any>(`/mail/sent?limit=${limit ?? 20}&offset=${offset ?? 0}`),
  sendMail: (toUsername: string, subject: string, body: string) =>
    request<any>('/mail/send', { method: 'POST', body: JSON.stringify({ toUsername, subject, body }) }),
  markMailRead: (id: string) =>
    request<any>(`/mail/read/${id}`, { method: 'POST' }),
  toggleMailStar: (id: string) =>
    request<any>(`/mail/star/${id}`, { method: 'POST' }),
  deleteMail: (id: string) =>
    request<any>(`/mail/delete/${id}`, { method: 'POST' }),
  getUnreadMailCount: () =>
    request<{ count: number }>('/mail/unread-count'),

  // Hero Quests
  getAvailableQuests: () =>
    request<any>('/hero-quests/available'),
  startHeroQuest: (heroId: string, questType: string) =>
    request<any>('/hero-quests/start', { method: 'POST', body: JSON.stringify({ heroId, questType }) }),
  getActiveQuests: () =>
    request<any>('/hero-quests/active'),
  getQuestHistory: () =>
    request<any>('/hero-quests/history'),

  // World Boss
  getWorldBosses: () => request<any>('/world-boss'),
  getWorldBoss: (id: string) => request<any>(`/world-boss/${id}`),
  attackWorldBoss: (bossId: string, settlementId: string, units: Record<string, number>) =>
    request<any>(`/world-boss/${bossId}/attack`, { method: 'POST', body: JSON.stringify({ settlementId, units }) }),

  // Quests (Story/Daily/Milestone)
  getQuests: () =>
    request<{ story: any[]; daily: any[]; milestones: any[] }>('/quests'),
  claimQuestReward: (questId: string) =>
    request<any>(`/quests/${encodeURIComponent(questId)}/claim`, { method: 'POST' }),

  // Daily Login Rewards
  getDailyRewardStatus: () =>
    request<any>('/daily-rewards/status'),
  claimDailyReward: () =>
    request<any>('/daily-rewards/claim', { method: 'POST' }),

  // Admin
  resetGame: () =>
    request<any>('/admin/reset', { method: 'POST' }),
};
