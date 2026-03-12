import { useGameStore } from '../stores/game-store.js';

type PanelId = 'settlement' | 'map' | 'heroes' | 'alliance' | 'chronicle' | 'research' | 'marketplace' | 'leaderboard' | 'events' | 'profile' | 'spy' | 'worldboss' | 'mail' | 'heroQuests' | null;

interface NavItem {
  id: PanelId;
  label: string;
  icon: string;
  shortcut?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'settlement', label: 'Settlement', icon: '\u{1F3F0}', shortcut: '1' },
  { id: 'map', label: 'World Map', icon: '\u{1F5FA}', shortcut: '2' },
  { id: 'heroes', label: 'Heroes', icon: '\u{2694}\u{FE0F}', shortcut: '3' },
  { id: 'research', label: 'Research', icon: '\u{1F4DA}', shortcut: '4' },
  { id: 'marketplace', label: 'Marketplace', icon: '\u{1F3EA}', shortcut: '5' },
  { id: 'alliance', label: 'Alliance', icon: '\u{1F6E1}\u{FE0F}', shortcut: '6' },
  { id: 'chronicle', label: 'Chronicle', icon: '\u{1F4DC}', shortcut: '7' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '\u{1F3C6}', shortcut: '8' },
  { id: 'events', label: 'Events', icon: '\u{2B50}', shortcut: '9' },
  { id: 'profile', label: 'Profile', icon: '\u{1F451}', shortcut: '0' },
  { id: 'spy', label: 'Spy', icon: '\u{1F5E1}', shortcut: 'S' },
  { id: 'worldboss', label: 'World Boss', icon: '\u{1F409}', shortcut: 'B' },
  { id: 'mail', label: 'Mail', icon: '\u{1F4E8}', shortcut: 'M' },
  { id: 'heroQuests', label: 'Hero Quests', icon: '\u{1F9ED}', shortcut: 'Q' },
];

export default function Sidebar() {
  const activePanel = useGameStore((s) => s.activePanel);
  const setActivePanel = useGameStore((s) => s.setActivePanel);

  return (
    <div
      className="w-48 flex flex-col py-2 gap-0.5 border-r border-[var(--ruin-grey)]/20 overflow-y-auto overflow-x-hidden"
      style={{ background: 'rgba(26, 39, 68, 0.95)' }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activePanel === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActivePanel(item.id)}
            title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
            className={`flex items-center gap-2.5 py-2 px-3 mx-1 rounded-lg transition-all shrink-0 ${
              isActive
                ? 'bg-[var(--aether-violet)]/20 border border-[var(--aether-violet)]/50'
                : 'hover:bg-[var(--veil-blue)] border border-transparent'
            }`}
          >
            <span className="text-lg leading-none shrink-0">{item.icon}</span>
            <span
              className={`text-xs font-medium truncate ${
                isActive ? 'text-[var(--aether-violet)]' : 'text-[var(--parchment-dim)]'
              }`}
            >
              {item.label}
            </span>
            {item.shortcut && (
              <span className="ml-auto text-[10px] text-[var(--ruin-grey)]/50 tabular-nums shrink-0">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
