export interface Correction {
  original: string;
  corrected: string;
}

export interface GeminiEvaluation {
  is_english: boolean;
  score: number; // 1 to 10
  feedback: string; // Max 2 sentences in Vietnamese
  corrections: Correction[];
}

export interface UserProgress {
  lastCompletedDate: string | null; // YYYY-MM-DD
  lastCheckDate: string; // YYYY-MM-DD
  streak: number;
  stakeAmount: number; // VND per day, default 50,000
  totalBurned: number; // VND lost from missed days
  totalPreserved: number; // VND kept from completed days
}

export interface JournalEntry {
  id: string;
  date: string; // ISO or YYYY-MM-DD HH:mm
  text: string;
  score: number;
  feedback: string;
  corrections: Correction[];
}

export interface SpeakingSession {
  id: string;
  date: string;
  topic: string;
  transcript: string;
  score: number;
  feedback: string;
  wpm: number;
  corrections: Correction[];
}

export interface SRSCard {
  id: string;
  front: string; // Original phrase or Mindset Question
  back: string;  // Corrected phrase or Wisdom Mantra + VN explanation
  box: number;   // 0 to 5
  nextReview: string; // YYYY-MM-DD
  createdAt: string;
  lastReviewedAt?: string;
  category?: 'Trading' | 'Meditation' | 'Psychology' | 'Ultra Running' | 'Grammar' | string;
}

export type ActiveTab = 'journal' | 'speaking' | 'flashcards' | 'history';
