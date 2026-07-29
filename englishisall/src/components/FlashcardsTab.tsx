import React, { useState } from 'react';
import type { SRSCard } from '../types';
import { handleRemembered, handleForgot, getTodayDateString, BOX_INTERVALS, addDays } from '../utils/srs';
import { saveSRSCards } from '../utils/storage';
import { Layers, Plus, CheckCircle2, RotateCcw, Eye, Sparkles, Brain, Award, Clock } from 'lucide-react';

interface FlashcardsTabProps {
  cards: SRSCard[];
  onUpdateCards: (cards: SRSCard[]) => void;
}

export const FlashcardsTab: React.FC<FlashcardsTabProps> = ({ cards, onUpdateCards }) => {
  const today = getTodayDateString();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Cards due today
  const dueCards = cards.filter((c) => c.nextReview <= today);
  const currentCard = dueCards[currentIndex];

  const handleAction = (isRemembered: boolean) => {
    if (!currentCard) return;

    let updatedCard: SRSCard;
    if (isRemembered) {
      updatedCard = handleRemembered(currentCard);
    } else {
      updatedCard = handleForgot(currentCard);
    }

    const updatedList = cards.map((c) => (c.id === currentCard.id ? updatedCard : c));
    saveSRSCards(updatedList);
    onUpdateCards(updatedList);

    setRevealed(false);
    if (currentIndex >= dueCards.length - 1) {
      setCurrentIndex(0);
    }
  };

  const handleAddCustomCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;

    const newCard: SRSCard = {
      id: `srs_custom_${Date.now()}`,
      front: newFront.trim(),
      back: newBack.trim(),
      box: 0,
      nextReview: addDays(today, 1),
      createdAt: today,
    };

    const updated = [newCard, ...cards];
    saveSRSCards(updated);
    onUpdateCards(updated);

    setNewFront('');
    setNewBack('');
    setShowAddForm(false);
  };

  // Box statistics
  const boxCounts = [0, 1, 2, 3, 4, 5].map((boxNum) => ({
    box: boxNum,
    interval: BOX_INTERVALS[boxNum],
    count: cards.filter((c) => c.box === boxNum).length,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 font-sans">
      
      {/* Header Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 font-mono font-bold text-sm">
            <Layers className="w-4 h-4" />
            <span>LEITNER SRS SYSTEM // SPACED REPETITION</span>
          </div>
          <h2 className="text-xl font-extrabold text-zinc-100 mt-1 font-mono">
            Bộ Thẻ Ôn Tập Thông Minh SRS (Leitner 6 Boxes)
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Thẻ tự động nạp từ lỗi viết/nói. Hệ thống Leitner phân bổ thời gian ôn tập tối ưu để ghi nhớ lâu dài.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow-lg self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>THÊM THẺ THỦ CÔNG</span>
        </button>
      </div>

      {/* Manual Card Form */}
      {showAddForm && (
        <form onSubmit={handleAddCustomCard} className="bg-zinc-900 border border-amber-500/50 p-4 rounded-xl space-y-3 font-mono text-xs animate-fadeIn">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-bold text-amber-400 uppercase tracking-wider flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              TẠO THẺ SRS MỚI
            </span>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              Hủy
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-400">Mặt trước (Original / Phrase with mistake):</label>
              <input
                type="text"
                value={newFront}
                onChange={(e) => setNewFront(e.target.value)}
                placeholder="e.g. I am used to trade without stoploss"
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2.5 rounded text-xs focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-zinc-400">Mặt sau (Corrected / Natural phrase):</label>
              <input
                type="text"
                value={newBack}
                onChange={(e) => setNewBack(e.target.value)}
                placeholder="e.g. I am used to trading with a stop-loss"
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2.5 rounded text-xs focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-5 py-2 rounded font-bold transition-colors"
            >
              Lưu Thẻ Vào Bộ Ôn
            </button>
          </div>
        </form>
      )}

      {/* Main Review Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Card Deck */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-6">
            
            {/* Header Progress */}
            <div className="flex items-center justify-between text-xs font-mono border-b border-zinc-800 pb-3">
              <span className="text-zinc-400 flex items-center">
                <Clock className="w-4 h-4 mr-1 text-cyan-400" />
                THẺ CẦN ÔN HÔM NAY: <strong className="text-cyan-400 ml-1.5 text-sm">{dueCards.length}</strong>
              </span>

              {dueCards.length > 0 && (
                <span className="text-zinc-500">
                  THẺ {currentIndex + 1} / {dueCards.length}
                </span>
              )}
            </div>

            {/* Empty State */}
            {dueCards.length === 0 ? (
              <div className="py-16 text-center space-y-4 font-mono">
                <div className="inline-flex p-4 bg-emerald-950/60 rounded-full text-emerald-400 border border-emerald-800 animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-zinc-100">ĐÃ ÔN HẾT THẺ HÔM NAY!</h3>
                  <p className="text-xs text-zinc-400 font-sans max-w-sm mx-auto">
                    Tất cả các thẻ đến hạn đã được rèn luyện. Hãy quay lại viết Journal hoặc luyện Speaking để tự động nạp thẻ mới!
                  </p>
                </div>
              </div>
            ) : (
              /* Active Card Display */
              <div className="space-y-6">
                
                {/* The Flashcard */}
                <div className={`p-8 rounded-xl border transition-all duration-300 min-h-[220px] flex flex-col justify-between ${
                  revealed
                    ? 'bg-zinc-950 border-amber-500/80 shadow-2xl shadow-amber-500/10'
                    : 'bg-zinc-950 border-zinc-800 shadow-xl'
                }`}>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                      <span className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-amber-400">
                        LEITNER BOX {currentCard.box} ({BOX_INTERVALS[currentCard.box]} ngày)
                      </span>
                      <span>TẠO NGÀY: {currentCard.createdAt}</span>
                    </div>

                    <div className="pt-4">
                      <span className="text-xs font-mono text-rose-400 font-bold uppercase tracking-wider block mb-1">
                        ORIGINAL PHRASE (MẶT TRƯỚC):
                      </span>
                      <p className="text-xl font-bold font-mono text-zinc-100">
                        "{currentCard.front}"
                      </p>
                    </div>
                  </div>

                  {/* Back side revealed */}
                  {revealed ? (
                    <div className="pt-6 border-t border-zinc-800/80 mt-6 space-y-2 animate-fadeIn">
                      <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider block">
                        CORRECTED PHRASE (MẶT SAU):
                      </span>
                      <p className="text-2xl font-extrabold font-mono text-emerald-400">
                        "{currentCard.back}"
                      </p>
                    </div>
                  ) : (
                    <div className="pt-6 text-center">
                      <button
                        onClick={() => setRevealed(true)}
                        className="inline-flex items-center space-x-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 px-6 py-2.5 rounded-lg font-mono text-xs font-bold transition-all hover:scale-105"
                      >
                        <Eye className="w-4 h-4 text-amber-400" />
                        <span>XEM ĐÁP ÁN (SHOW ANSWER)</span>
                      </button>
                    </div>
                  )}

                </div>

                {/* Control Action Buttons */}
                {revealed && (
                  <div className="grid grid-cols-2 gap-4 font-mono animate-fadeIn">
                    
                    {/* Forgot */}
                    <button
                      onClick={() => handleAction(false)}
                      className="flex items-center justify-center space-x-2 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-rose-950/40"
                    >
                      <RotateCcw className="w-4 h-4 text-rose-400" />
                      <div className="text-left">
                        <div>🔴 CHƯA THUỘC (FORGOT)</div>
                        <div className="text-[10px] text-rose-400 font-normal font-sans">Reset về Box 0 (Ôn lại ngày mai)</div>
                      </div>
                    </button>

                    {/* Remembered */}
                    <button
                      onClick={() => handleAction(true)}
                      className="flex items-center justify-center space-x-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-emerald-950/40"
                    >
                      <Award className="w-4 h-4 text-emerald-400" />
                      <div className="text-left">
                        <div>🟢 ĐÃ THUỘC (REMEMBERED)</div>
                        <div className="text-[10px] text-emerald-400 font-normal font-sans">Tăng lên Box {Math.min(5, currentCard.box + 1)} ({BOX_INTERVALS[Math.min(5, currentCard.box + 1)]} ngày nữa)</div>
                      </div>
                    </button>

                  </div>
                )}

              </div>
            )}

          </div>
        </div>

        {/* Right 1 Col: Leitner Box Distribution Stats */}
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl space-y-4 font-mono">
            <div className="border-b border-zinc-800 pb-2">
              <span className="font-bold text-xs text-amber-400 flex items-center">
                <Brain className="w-4 h-4 mr-1.5" />
                PHÂN BỔ LEITNER BOXES ({cards.length} THẺ)
              </span>
            </div>

            <div className="space-y-2.5">
              {boxCounts.map((b) => (
                <div key={b.box} className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-zinc-200">BOX {b.box}</span>
                    <span className="text-[10px] text-zinc-500 font-sans block">Chu kỳ: {b.interval} ngày</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-base font-extrabold text-cyan-400">{b.count}</span>
                    <span className="text-[10px] text-zinc-600">thẻ</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 text-[11px] text-zinc-500 font-sans leading-relaxed border-t border-zinc-800">
              💡 <strong>Quy tắc Leitner:</strong> Mỗi lần trả lời đúng (Remembered), thẻ tiến lên 1 Box và khoảng cách ôn lặp lại dài hơn. Trả lời sai (Forgot) thẻ ngay lập tức lùi về Box 0 để rèn lại!
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
