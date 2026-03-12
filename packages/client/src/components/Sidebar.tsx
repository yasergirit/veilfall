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
  { id: 'heroes', label: 'Heroes', icon: '\u{2694}', shortcut: '3' },
  { id: 'research', label: 'Research', icon: '\u{1F4DA}', shortcut: '4' },
  { id: 'marketplace', label: 'Marketplace', icon: '\u{1F3EA}', shortcut: '5' },
  { id: 'alliance', label: 'Alliance', icon: '\u{1F6E1}', shortcut: '6' },
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
      className="w-16 flex flex-col items-center py-2 gap-0.5 border-r border-[var(--ruin-grey)]/20 overflow-y-auto overflow-x-hidden"
      style={{ background: 'rgba(26, 39, 68, 0.95)' }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activePanel === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActivePanel(item.id)}
            title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
            className={`w-14 flex flex-col items-center gap-0 py-1.5 px-1 rounded-lg transition-all shrink-0 ${
              isActive
                ? 'bg-[var(--aether-violet)]/20 border border-[var(--aether-violet)]/50'
                : 'hover:bg-[var(--veil-blue)] border border-transparent'
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span
              className={`text-[8px] leading-tight mt-0.5 truncate w-full text-center ${
                isActive ? 'text-[var(--aether-violet)]' : 'text-[var(--ruin-grey)]'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
