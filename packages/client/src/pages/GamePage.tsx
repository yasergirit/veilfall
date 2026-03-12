import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/auth-store.js';
import { useGameStore } from '../stores/game-store.js';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';
import HexMap from '../components/HexMap.js';
import SettlementPanel from '../components/SettlementPanel.js';
import HeroPanel from '../components/HeroPanel.js';
import ResourceBar from '../components/ResourceBar.js';
import Sidebar from '../components/Sidebar.js';
import QuestTracker from '../components/QuestTracker.js';
import AlliancePanel from '../components/AlliancePanel.js';
import ChatPanel from '../components/ChatPanel.js';
import ChroniclePanel from '../components/ChroniclePanel.js';
import ResearchPanel from '../components/ResearchPanel.js';
import MarketplacePanel from '../components/MarketplacePanel.js';
import LeaderboardPanel from '../components/LeaderboardPanel.js';
import EventsPanel from '../components/EventsPanel.js';
import ProfilePanel from '../components/ProfilePanel.js';
import SpyPanel from '../components/SpyPanel.js';
import WorldBossPanel from '../components/WorldBossPanel.js';
import MailPanel from '../components/MailPanel.js';
import HeroQuestPanel from '../components/HeroQuestPanel.js';
import ToastContainer from '../components/ToastContainer.js';
import TutorialOverlay, { isTutorialComplete } from '../components/TutorialOverlay.js';

const KEY_TO_PANEL: Record<string, GameState['activePanel']> = {
  '1': 'settlement',
  '2': 'map',
  '3': 'heroes',
  '4': 'research',
  '5': 'marketplace',
  '6': 'alliance',
  '7': 'chronicle',
  '8': 'leaderboard',
  '9': 'events',
  '0': 'profile',
  's': 'spy',
  'b': 'worldboss',
  'm': 'mail',
  'q': 'heroQuests',
};

type GameState = ReturnType<typeof useGameStore.getState>;

export default function GamePage() {
  const player = useAuthStore((s) => s.player);
  const activePanel = useGameStore((s) => s.activePanel);
  const setActivePanel = useGameStore((s) => s.setActivePanel);
  const setSettlements = useGameStore((s) => s.setSettlements);
  const [showTutorial, setShowTutorial] = useState(() => !isTutorialComplete());

  // Fetch settlements on mount
  useEffect(() => {
    api.getSettlements().then((data) => {
      setSettlements(data.settlements);
    }).catch(console.error);
  }, [setSettlements]);

  // Listen for real-time resource updates via WebSocket
  const updateResources = useGameStore((s) => s.updateResources);
  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;

    const handler = (data: { settlementId: string; resources: Record<string, number> }) => {
      updateResources(data.settlementId, data.resources as any);
    };
    sock.on('resources:update', handler);
    return () => { sock.off('resources:update', handler); };
  }, [updateResources]);

  // Fallback poll for resource updates every 30s (in case WS is down)
  useEffect(() => {
    const interval = setInterval(() => {
      api.getSettlements().then((data) => {
        setSettlements(data.settlements);
      }).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, [setSettlements]);

  // Keyboard shortcuts for panel navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip when typing in an input or textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'Escape') {
        setActivePanel(null);
        return;
      }

      const key = e.key.toLowerCase();
      const panel = KEY_TO_PANEL[key];
      if (panel) {
        e.preventDefault();
        setActivePanel(panel);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActivePanel]);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: 'var(--veil-blue-deep)' }}>
      <ResourceBar />
      <ToastContainer />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 relative">
          {/* Panel content layer */}
          <div className="absolute inset-0">
            {activePanel === 'map' && <HexMap />}
            {activePanel === 'settlement' && <SettlementPanel />}
            {activePanel === 'heroes' && <HeroPanel />}
            {activePanel === 'alliance' && <AlliancePanel />}
            {activePanel === 'chronicle' && <ChroniclePanel />}
            {activePanel === 'research' && <ResearchPanel />}
            {activePanel === 'marketplace' && <MarketplacePanel />}
            {activePanel === 'leaderboard' && <LeaderboardPanel />}
            {activePanel === 'events' && <EventsPanel />}
            {activePanel === 'profile' && <ProfilePanel />}
            {activePanel === 'spy' && <SpyPanel />}
            {activePanel === 'worldboss' && <WorldBossPanel />}
            {activePanel === 'mail' && <MailPanel />}
            {activePanel === 'heroQuests' && <HeroQuestPanel />}
          </div>
          {/* Overlay layer - pointer-events-none so panels underneath remain clickable */}
          <div className="absolute inset-0 pointer-events-none z-20">
            <QuestTracker />
            <ChatPanel />
          </div>
        </div>
      </div>
      {showTutorial && <TutorialOverlay onComplete={() => setShowTutorial(false)} username={player?.username} />}
    </div>
  );
}
