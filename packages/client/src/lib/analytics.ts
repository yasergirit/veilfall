/**
 * Lightweight analytics event tracker for VEILFALL.
 * Logs events to console in dev mode, ready for integration with
 * any analytics provider (Posthog, Mixpanel, Amplitude, etc.)
 */

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp: number;
}

const IS_DEV = import.meta.env.DEV;
const eventQueue: AnalyticsEvent[] = [];

/**
 * Track a game event for analytics.
 */
export function track(name: string, properties?: Record<string, any>) {
  const event: AnalyticsEvent = {
    name,
    properties: {
      ...properties,
      session_id: getSessionId(),
      url: window.location.pathname,
    },
    timestamp: Date.now(),
  };

  eventQueue.push(event);

  if (IS_DEV) {
    console.log(`[Analytics] ${name}`, properties ?? '');
  }

  // TODO: Send to analytics backend when integrated
  // sendToAnalytics(event);
}

// Session tracking
let sessionId: string | null = null;
let sessionStart: number | null = null;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStart = Date.now();
  }
  return sessionId;
}

export function getSessionDuration(): number {
  return sessionStart ? Date.now() - sessionStart : 0;
}

/**
 * Identify the current user for analytics.
 */
export function identify(userId: string, traits?: Record<string, any>) {
  if (IS_DEV) {
    console.log(`[Analytics] Identify: ${userId}`, traits ?? '');
  }
  // TODO: Send identify to analytics provider
}

// ── Pre-defined Event Helpers ──

export const analytics = {
  // Session events
  sessionStart: () => track('session_start'),
  sessionEnd: () => track('session_end', { duration_ms: getSessionDuration() }),

  // Auth events
  loginStarted: () => track('login_started'),
  loginCompleted: (faction: string) => track('login_completed', { faction }),
  registerStarted: () => track('register_started'),
  registerCompleted: (faction: string) => track('register_completed', { faction }),

  // Tutorial
  tutorialStarted: () => track('tutorial_started'),
  tutorialStepCompleted: (step: number) => track('tutorial_step_completed', { step }),
  tutorialCompleted: () => track('tutorial_completed'),
  tutorialSkipped: (atStep: number) => track('tutorial_skipped', { at_step: atStep }),

  // First actions (milestone tracking)
  firstBuild: (buildingType: string) => track('first_build', { building_type: buildingType }),
  firstTrain: (unitType: string) => track('first_train', { unit_type: unitType }),
  firstMarch: (type: string) => track('first_march', { march_type: type }),

  // Core gameplay
  buildingStarted: (type: string, level: number) => track('building_started', { type, level }),
  buildingCompleted: (type: string, level: number) => track('building_completed', { type, level }),
  unitsTrained: (type: string, count: number) => track('units_trained', { type, count }),
  researchStarted: (type: string) => track('research_started', { type }),
  marchSent: (type: string, unitCount: number) => track('march_sent', { type, unit_count: unitCount }),

  // Rewards & progression
  questCompleted: (questId: string, type: string) => track('quest_completed', { quest_id: questId, type }),
  rewardClaimed: (source: string, rewards: Record<string, number>) => track('reward_claimed', { source, rewards }),
  dailyRewardClaimed: (day: number) => track('daily_reward_claimed', { day }),
  eventRewardClaimed: (eventType: string) => track('event_reward_claimed', { event_type: eventType }),

  // Engagement
  panelOpened: (panel: string) => track('panel_opened', { panel }),
  chatMessageSent: (channel: string) => track('chat_message_sent', { channel }),
  allianceJoined: () => track('alliance_joined'),
  allianceCreated: () => track('alliance_created'),
  tradeCreated: () => track('trade_created'),
  tradeAccepted: () => track('trade_accepted'),

  // Retention signals
  returnSession: (daysSinceFirst: number) => track('return_session', { days_since_first: daysSinceFirst }),
  advisorSuggestionFollowed: (suggestion: string) => track('advisor_suggestion_followed', { suggestion }),
  worldBossAttacked: (bossType: string) => track('world_boss_attacked', { boss_type: bossType }),
};
