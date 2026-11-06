import type { UserProgress, JournalEntry, SpeakingSession, SRSCard } from '../types';
import { getTodayDateString } from './srs';

const STORAGE_KEYS = {
  API_KEY: 'en_terminal_api_key',
  PROGRESS: 'en_terminal_progress',
  JOURNALS: 'en_terminal_journals',
  SPEAKING: 'en_terminal_speaking',
  SRS: 'en_terminal_srs',
};

export function getDaysBetween(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1 + 'T00:00:00');
  const d2 = new Date(dateStr2 + 'T00:00:00');
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function getStoredApiKey(): string {
  return localStorage.getItem(STORAGE_KEYS.API_KEY) || '';
}

export function saveApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEYS.API_KEY, key.trim());
}

export function getStoredProgress(): UserProgress {
  const today = getTodayDateString();
  const raw = localStorage.getItem(STORAGE_KEYS.PROGRESS);
  
  const defaultProgress: UserProgress = {
    lastCompletedDate: null,
    lastCheckDate: today,
    streak: 0,
    stakeAmount: 50000,
    totalBurned: 0,
    totalPreserved: 0,
  };

  if (!raw) {
    saveProgress(defaultProgress);
    return defaultProgress;
  }

  try {
    const progress: UserProgress = JSON.parse(raw);
    return reconcileProgressOnLoad(progress, today);
  } catch (e) {
    console.error('Failed to parse progress from localStorage:', e);
    return defaultProgress;
  }
}

function reconcileProgressOnLoad(progress: UserProgress, today: string): UserProgress {
  let updated = { ...progress };

  // Check if lastCheckDate is before today
  if (updated.lastCheckDate !== today) {
    if (updated.lastCompletedDate) {
      const gap = getDaysBetween(updated.lastCompletedDate, today);
      if (gap > 1) {
        // Compute uncalculated missed days between lastCheckDate (or lastCompletedDate+1) and today
        const startMissedDate = updated.lastCheckDate > updated.lastCompletedDate 
          ? updated.lastCheckDate 
          : updated.lastCompletedDate;
        
        const newlyMissedDays = Math.max(0, getDaysBetween(startMissedDate, today) - (startMissedDate === updated.lastCompletedDate ? 1 : 0));
        
        if (newlyMissedDays > 0) {
          updated.totalBurned += newlyMissedDays * updated.stakeAmount;
          updated.streak = 0;
        }
      }
    }
    updated.lastCheckDate = today;
    saveProgress(updated);
  }

  return updated;
}

export function saveProgress(progress: UserProgress): void {
  localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
}

export function markTaskCompletedToday(progress: UserProgress): UserProgress {
  const today = getTodayDateString();
  
  if (progress.lastCompletedDate === today) {
    return progress; // Already completed today
  }

  let newStreak = 1;
  if (progress.lastCompletedDate) {
    const gap = getDaysBetween(progress.lastCompletedDate, today);
    if (gap === 1) {
      newStreak = progress.streak + 1;
    } else {
      newStreak = 1;
    }
  }

  const updated: UserProgress = {
    ...progress,
    streak: newStreak,
    totalPreserved: progress.totalPreserved + progress.stakeAmount,
    lastCompletedDate: today,
    lastCheckDate: today,
  };

  saveProgress(updated);
  return updated;
}

// Journals
export function getStoredJournals(): JournalEntry[] {
  const raw = localStorage.getItem(STORAGE_KEYS.JOURNALS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveJournalEntry(entry: JournalEntry): JournalEntry[] {
  const list = getStoredJournals();
  const updated = [entry, ...list];
  localStorage.setItem(STORAGE_KEYS.JOURNALS, JSON.stringify(updated));
  return updated;
}

// Speaking Sessions
export function getStoredSpeakingSessions(): SpeakingSession[] {
  const raw = localStorage.getItem(STORAGE_KEYS.SPEAKING);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSpeakingSession(session: SpeakingSession): SpeakingSession[] {
  const list = getStoredSpeakingSessions();
  const updated = [session, ...list];
  localStorage.setItem(STORAGE_KEYS.SPEAKING, JSON.stringify(updated));
  return updated;
}

// SRS Cards
export function getStoredSRSCards(): SRSCard[] {
  const raw = localStorage.getItem(STORAGE_KEYS.SRS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSRSCards(cards: SRSCard[]): void {
  localStorage.setItem(STORAGE_KEYS.SRS, JSON.stringify(cards));
}

// Clear all data
export function resetAllData(): void {
  localStorage.removeItem(STORAGE_KEYS.PROGRESS);
  localStorage.removeItem(STORAGE_KEYS.JOURNALS);
  localStorage.removeItem(STORAGE_KEYS.SPEAKING);
  localStorage.removeItem(STORAGE_KEYS.SRS);
  // Keep API key or remove? Keep API key so user doesn't have to re-enter it when resetting progress.
}
