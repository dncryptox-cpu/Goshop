import { useState, useEffect } from 'react';
import type { ActiveTab, UserProgress, JournalEntry, SpeakingSession, SRSCard } from './types';
import {
  getStoredApiKey,
  getStoredProgress,
  saveProgress,
  getStoredJournals,
  getStoredSpeakingSessions,
  getStoredSRSCards,
  saveSRSCards,
  resetAllData,
} from './utils/storage';
import { getTodayDateString } from './utils/srs';
import { getSeedData } from './utils/seedData';
import { HeaderTicker } from './components/HeaderTicker';
import { Navigation } from './components/Navigation';
import { JournalTab } from './components/JournalTab';
import { SpeakingTab } from './components/SpeakingTab';
import { FlashcardsTab } from './components/FlashcardsTab';
import { HistoryTab } from './components/HistoryTab';
import { SettingsModal } from './components/SettingsModal';

export function App() {
  const [apiKey, setApiKey] = useState<string>('');
  const [progress, setProgress] = useState<UserProgress>({
    lastCompletedDate: null,
    lastCheckDate: getTodayDateString(),
    streak: 0,
    stakeAmount: 50000,
    totalBurned: 0,
    totalPreserved: 0,
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('journal');
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [speaking, setSpeaking] = useState<SpeakingSession[]>([]);
  const [cards, setCards] = useState<SRSCard[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initialize data on mount
  useEffect(() => {
    const key = getStoredApiKey();
    setApiKey(key);

    const prog = getStoredProgress();
    setProgress(prog);

    const jList = getStoredJournals();
    setJournals(jList);

    const sList = getStoredSpeakingSessions();
    setSpeaking(sList);

    const cList = getStoredSRSCards();
    setCards(cList);

    // If no API key on first run, prompt settings modal
    if (!key) {
      setIsSettingsOpen(true);
    }
  }, []);

  const today = getTodayDateString();
  const cardsDueCount = cards.filter((c) => c.nextReview <= today).length;

  const handleUpdateProgress = (newProgress: UserProgress) => {
    setProgress(newProgress);
    saveProgress(newProgress);
  };

  const handleUpdateStake = (amount: number) => {
    const updated = { ...progress, stakeAmount: amount };
    setProgress(updated);
    saveProgress(updated);
  };

  const handleRefreshHistory = () => {
    setJournals(getStoredJournals());
    setSpeaking(getStoredSpeakingSessions());
  };

  const handleSeedDemoData = () => {
    const seed = getSeedData();
    setProgress(seed.sampleProgress);
    saveProgress(seed.sampleProgress);

    setJournals(seed.sampleJournals);
    localStorage.setItem('en_terminal_journals', JSON.stringify(seed.sampleJournals));

    setSpeaking(seed.sampleSpeaking);
    localStorage.setItem('en_terminal_speaking', JSON.stringify(seed.sampleSpeaking));

    setCards(seed.sampleSRSCards);
    saveSRSCards(seed.sampleSRSCards);
  };

  const handleResetAllData = () => {
    resetAllData();
    const freshProg = getStoredProgress();
    setProgress(freshProg);
    setJournals([]);
    setSpeaking([]);
    setCards([]);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Trading Terminal Top Ticker Strip */}
      <HeaderTicker
        progress={progress}
        cardsDueCount={cardsDueCount}
        hasApiKey={Boolean(apiKey)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSelectTab={(tab) => setActiveTab(tab)}
        onUpdateStake={handleUpdateStake}
      />

      {/* Terminal Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        cardsDueCount={cardsDueCount}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-grow">
        {activeTab === 'journal' && (
          <JournalTab
            apiKey={apiKey}
            progress={progress}
            onUpdateProgress={handleUpdateProgress}
            onUpdateCards={(newCards) => setCards(newCards)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onSelectTab={(tab) => setActiveTab(tab)}
            journalHistory={journals}
            onRefreshHistory={handleRefreshHistory}
          />
        )}

        {activeTab === 'speaking' && (
          <SpeakingTab
            apiKey={apiKey}
            progress={progress}
            onUpdateProgress={handleUpdateProgress}
            onUpdateCards={(newCards) => setCards(newCards)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onSelectTab={(tab) => setActiveTab(tab)}
            speakingHistory={speaking}
            onRefreshHistory={handleRefreshHistory}
          />
        )}

        {activeTab === 'flashcards' && (
          <FlashcardsTab
            apiKey={apiKey}
            cards={cards}
            onUpdateCards={(updatedCards) => setCards(updatedCards)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            journals={journals}
            speaking={speaking}
          />
        )}
      </main>

      {/* Terminal Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 text-center text-xs font-mono text-zinc-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            EN TERMINAL v2.5 // Designed for Traders & 100km Ultra Trail Runners
          </div>
          <div className="flex items-center space-x-3 text-zinc-500">
            <span>Client-side Storage (localStorage)</span>
            <span>•</span>
            <span>Gemini 2.5 Flash API</span>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          apiKey={apiKey}
          onSaveKey={(k) => setApiKey(k)}
          stakeAmount={progress.stakeAmount}
          onUpdateStake={handleUpdateStake}
          onSeedDemoData={handleSeedDemoData}
          onResetAllData={handleResetAllData}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

    </div>
  );
}

export default App;
