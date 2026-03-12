/**
 * Simple event bus for triggering reward celebrations from any component.
 * GamePage listens and shows the RewardCelebration modal.
 */

type RewardEventHandler = (data: { title: string; subtitle?: string; rewards: Record<string, number> }) => void;

let handler: RewardEventHandler | null = null;

export function onRewardCelebration(fn: RewardEventHandler) {
  handler = fn;
  return () => { handler = null; };
}

export function triggerRewardCelebration(title: string, rewards: Record<string, number>, subtitle?: string) {
  handler?.({ title, subtitle, rewards });
}
