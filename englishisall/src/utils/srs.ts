import type { SRSCard, Correction } from '../types';

export const BOX_INTERVALS = [1, 2, 4, 7, 14, 30]; // Days for boxes 0 to 5

export function getTodayDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return getTodayDateString(d);
}

export function getNextReviewDate(box: number, fromDateStr: string = getTodayDateString()): string {
  const safeBox = Math.max(0, Math.min(5, box));
  const interval = BOX_INTERVALS[safeBox] || 1;
  return addDays(fromDateStr, interval);
}

export function handleRemembered(card: SRSCard): SRSCard {
  const newBox = Math.min(5, card.box + 1);
  const today = getTodayDateString();
  return {
    ...card,
    box: newBox,
    nextReview: getNextReviewDate(newBox, today),
    lastReviewedAt: today,
  };
}

export function handleForgot(card: SRSCard): SRSCard {
  const today = getTodayDateString();
  return {
    ...card,
    box: 0,
    nextReview: addDays(today, 1),
    lastReviewedAt: today,
  };
}

export function addCorrectionCards(
  existingCards: SRSCard[],
  corrections: Correction[]
): { updatedCards: SRSCard[]; addedCount: number } {
  const today = getTodayDateString();
  const existingFronts = new Set(existingCards.map(c => c.front.trim().toLowerCase()));
  let addedCount = 0;
  const newCards: SRSCard[] = [];

  for (const corr of corrections) {
    const cleanFront = corr.original.trim();
    const cleanBack = corr.corrected.trim();
    if (!cleanFront || !cleanBack) continue;

    if (!existingFronts.has(cleanFront.toLowerCase())) {
      existingFronts.add(cleanFront.toLowerCase());
      addedCount++;
      newCards.push({
        id: `srs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        front: cleanFront,
        back: cleanBack,
        box: 0,
        nextReview: addDays(today, 1),
        createdAt: today,
      });
    }
  }

  return {
    updatedCards: [...newCards, ...existingCards],
    addedCount,
  };
}
