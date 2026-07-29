import { useState, useEffect, useCallback } from 'react';
import type { ActiveTab, UserProgress, JournalEntry, SpeakingSession, SRSCard, UserSession, SyncStatus } from './types';
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
import {
  getStoredSession,
  clearSession,
  cloudGetData,
  debouncedCloudSave,
} from './utils/cloudSync';
import { getTodayDateString } from './utils/srs';
import { getSeedData } from './utils/seedData';
import { HeaderTicker } from './components/HeaderTicker';
import { Navigation } from './components/Navigation';
import { JournalTab } from './components/JournalTab';
import { SpeakingTab } from './components/SpeakingTab';
import { FlashcardsTab } from './components/FlashcardsTab';
import { HistoryTab } from './components/HistoryTab';
import { SettingsModal } from './components/SettingsModal';
import { LoginModal } from './components/LoginModal';

export function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
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

  // Initialize session and load data
  useEffect(() => {
    const key = getStoredApiKey();
    setApiKey(key);

    const activeSession = getStoredSession();
    if (activeSession) {
      setSession(activeSession);
      fetchCloudData(activeSession);
    }
  }, []);

  const fetchCloudData = async (activeSession: UserSession) => {
    setSyncStatus('syncing');
    try {
      const res = await cloudGetData(activeSession);
      if (res.status === 'success' && res.data) {
        if (res.data.progress) {
          setProgress(res.data.progress);
          saveProgress(res.data.progress);
        } else {
          setProgress(getStoredProgress());
        }

        if (Array.isArray(res.data.journal)) {
          setJournals(res.data.journal);
          localStorage.setItem('en_terminal_journals', JSON.stringify(res.data.journal));
        } else {
          setJournals(getStoredJournals());
        }

        if (Array.isArray(res.data.speaking)) {
          setSpeaking(res.data.speaking);
          localStorage.setItem('en_terminal_speaking', JSON.stringify(res.data.speaking));
        } else {
          setSpeaking(getStoredSpeakingSessions());
        }

        if (Array.isArray(res.data.srs)) {
          setCards(res.data.srs);
          saveSRSCards(res.data.srs);
        } else {
          setCards(getStoredSRSCards());
        }

        setSyncStatus('synced');
      } else {
        console.warn('Cloud data fetch warning, using local cache:', res.message);
        loadLocalFallback();
        setSyncStatus('error');
      }
    } catch (err) {
      console.warn('Failed to connect to Google Apps Script, using local cache:', err);
      loadLocalFallback();
      setSyncStatus('error');
    }
  };

  const loadLocalFallback = () => {
    setProgress(getStoredProgress());
    setJournals(getStoredJournals());
    setSpeaking(getStoredSpeakingSessions());
    setCards(getStoredSRSCards());
  };

  // Trigger debounced cloud save on state changes
  const triggerSave = useCallback(
    (
      newProg: UserProgress,
      newJournals: JournalEntry[],
      newSpeaking: SpeakingSession[],
      newCards: SRSCard[]
    ) => {
      if (!session) return;
      debouncedCloudSave(
        session,
        {
          progress: newProg,
          journal: newJournals,
          speaking: newSpeaking,
          srs: newCards,
        },
        (status) => setSyncStatus(status)
      );
    },
    [session]
  );

  const handleLoginSuccess = (newSession: UserSession, cloudData?: any) => {
    setSession(newSession);
    if (cloudData) {
      if (cloudData.progress) {
        setProgress(cloudData.progress);
        saveProgress(cloudData.progress);
      }
      if (Array.isArray(cloudData.journal)) {
        setJournals(cloudData.journal);
        localStorage.setItem('en_terminal_journals', JSON.stringify(cloudData.journal));
      }
      if (Array.isArray(cloudData.speaking)) {
        setSpeaking(cloudData.speaking);
        localStorage.setItem('en_terminal_speaking', JSON.stringify(cloudData.speaking));
      }
      if (Array.isArray(cloudData.srs)) {
        setCards(cloudData.srs);
        saveSRSCards(cloudData.srs);
      }
      setSyncStatus('synced');
    } else {
      fetchCloudData(newSession);
    }
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  const today = getTodayDateString();
  const cardsDueCount = cards.filter((c) => c.nextReview <= today).length;

  const handleUpdateProgress = (newProgress: UserProgress) => {
    setProgress(newProgress);
    saveProgress(newProgress);
    triggerSave(newProgress, journals, speaking, cards);
  };

  const handleUpdateStake = (amount: number) => {
    const updated = { ...progress, stakeAmount: amount };
    setProgress(updated);
    saveProgress(updated);
    triggerSave(updated, journals, speaking, cards);
  };

  const handleRefreshHistory = () => {
    const newJ = getStoredJournals();
    const newS = getStoredSpeakingSessions();
    setJournals(newJ);
    setSpeaking(newS);
    triggerSave(progress, newJ, newS, cards);
  };

  const handleUpdateCards = (updatedCards: SRSCard[]) => {
    setCards(updatedCards);
    saveSRSCards(updatedCards);
    triggerSave(progress, journals, speaking, updatedCards);
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

    triggerSave(seed.sampleProgress, seed.sampleJournals, seed.sampleSpeaking, seed.sampleSRSCards);
  };

  const handleResetAllData = () => {
    resetAllData();
    const freshProg = getStoredProgress();
    setProgress(freshProg);
    setJournals([]);
    setSpeaking([]);
    setCards([]);
    triggerSave(freshProg, [], [], []);
  };

  // If no session, show Login Screen
  if (!session) {
    return <LoginModal onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Trading Terminal Top Ticker Strip */}
      <HeaderTicker
        progress={progress}
        cardsDueCount={cardsDueCount}
        hasApiKey={Boolean(apiKey)}
        syncStatus={syncStatus}
        session={session}
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSelectTab={(tab) => setActiveTab(tab)}
        onUpdateStake={handleUpdateStake}
      />

      {/* Terminal Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        cardsDueCount={cardsDueCount}
        session={session}
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-grow">
        {activeTab === 'journal' && (
          <JournalTab
            apiKey={apiKey}
            progress={progress}
            onUpdateProgress={handleUpdateProgress}
            onUpdateCards={handleUpdateCards}
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
            onUpdateCards={handleUpdateCards}
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
            onUpdateCards={handleUpdateCards}
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
            EN TERMINAL v2.5 // Google Apps Script Cloud Sync (ID: 1gZ5sevZrKGzc...)
          </div>
          <div className="flex items-center space-x-3 text-zinc-500">
            <span>Google Sheet Cloud Persistence</span>
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
          session={session}
          onLogout={handleLogout}
          onSeedDemoData={handleSeedDemoData}
          onResetAllData={handleResetAllData}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

    </div>
  );
}

export default App;
