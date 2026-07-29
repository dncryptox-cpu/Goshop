import React, { useState } from 'react';
import type { GeminiEvaluation, JournalEntry, UserProgress, SRSCard } from '../types';
import { evaluateEnglishText } from '../utils/gemini';
import { markTaskCompletedToday, saveJournalEntry, saveSRSCards, getStoredSRSCards } from '../utils/storage';
import { addCorrectionCards, getTodayDateString } from '../utils/srs';
import { AssessmentResult } from './AssessmentResult';
import { Terminal, Send, Loader2, Sparkles, BookOpen, AlertTriangle, Key } from 'lucide-react';

interface JournalTabProps {
  apiKey: string;
  progress: UserProgress;
  onUpdateProgress: (newProgress: UserProgress) => void;
  onUpdateCards: (newCards: SRSCard[]) => void;
  onOpenSettings: () => void;
  onSelectTab: (tab: 'journal' | 'speaking' | 'flashcards') => void;
  journalHistory: JournalEntry[];
  onRefreshHistory: () => void;
}

const QUICK_PROMPTS = [
  '📈 Trading Log: Market setup, Risk/Reward ratio, stop-loss execution, and emotional discipline.',
  '🏃 Trail Running: 30km Ham Luan mountain run, altitude gain, hydration & gel strategy.',
  '🤖 AI & Tech Workflow: How I use LLMs to analyze trading algorithms and automate daily research.',
  '🧘 Mindset & Recovery: Diaphragmatic breathing and meditation during high market volatility.',
];

export const JournalTab: React.FC<JournalTabProps> = ({
  apiKey,
  progress,
  onUpdateProgress,
  onUpdateCards,
  onOpenSettings,
  onSelectTab,
  journalHistory,
  onRefreshHistory,
}) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentEval, setCurrentEval] = useState<GeminiEvaluation | null>(null);

  const wordsCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charsCount = text.length;

  const handleSubmit = async () => {
    if (!apiKey) {
      setErrorMsg('Chưa cấu hình API Key Gemini. Vui lòng bấm vào "Nhập API Key" để kích hoạt.');
      return;
    }

    if (wordsCount < 5) {
      setErrorMsg('Hãy viết ít nhất 5 từ tiếng Anh để Gemini AI có thể đánh giá bài của bạn.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setCurrentEval(null);

    try {
      const evaluation = await evaluateEnglishText(text, apiKey);
      setCurrentEval(evaluation);

      if (evaluation.is_english && evaluation.score >= 6) {
        // Save to journal history
        const newEntry: JournalEntry = {
          id: `j_${Date.now()}`,
          date: `${getTodayDateString()} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
          text: text.trim(),
          score: evaluation.score,
          feedback: evaluation.feedback,
          corrections: evaluation.corrections,
        };
        saveJournalEntry(newEntry);
        onRefreshHistory();

        // Mark day completed in streak & preserved VND
        const updatedProgress = markTaskCompletedToday(progress);
        onUpdateProgress(updatedProgress);

        // Feed corrections into SRS deck
        if (evaluation.corrections.length > 0) {
          const currentCards = getStoredSRSCards();
          const { updatedCards } = addCorrectionCards(currentCards, evaluation.corrections);
          saveSRSCards(updatedCards);
          onUpdateCards(updatedCards);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Đã xảy ra lỗi khi gửi bài lên Gemini API.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInsertPrompt = (promptText: string) => {
    if (text) {
      setText((prev) => prev + '\n\n' + promptText);
    } else {
      setText(promptText);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 font-sans">
      
      {/* Tab Header Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 font-mono font-bold text-sm">
            <Terminal className="w-4 h-4" />
            <span>DAILY JOURNAL TERMINAL</span>
          </div>
          <h2 className="text-xl font-extrabold text-zinc-100 mt-1 font-mono">
            Viết Nhật Ký Tiếng Anh Hàng Ngày
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Ghi chép về trading log, kế hoạch chạy ultra 100km, nghiên cứu AI hoặc đời sống. Nhận phản hồi từ Gemini 2.5 Flash & tự động nạp thẻ SRS.
          </p>
        </div>

        {!apiKey && (
          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 px-4 py-2 rounded-lg text-xs font-mono font-bold animate-pulse transition-colors"
          >
            <Key className="w-4 h-4" />
            <span>NHẬP GEMINI API KEY</span>
          </button>
        )}
      </div>

      {/* Editor Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Textarea & Controls */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl space-y-3">
            
            {/* Terminal Header Bar */}
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400 border-b border-zinc-800 pb-2">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
                <span className="text-zinc-300 ml-2 font-bold">journal_editor.txt</span>
              </div>
              <div className="flex items-center space-x-3 text-[11px] text-zinc-500">
                <span>WORDS: <strong className="text-amber-400">{wordsCount}</strong></span>
                <span>CHARS: <strong className="text-zinc-300">{charsCount}</strong></span>
              </div>
            </div>

            {/* Quick Inspiration Pills */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-mono text-zinc-500 flex items-center">
                <Sparkles className="w-3 h-3 mr-1 text-amber-400" />
                Gợi ý chủ đề nhanh:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleInsertPrompt(prompt)}
                    className="text-[11px] bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-amber-300 px-2.5 py-1 rounded border border-zinc-800 transition-colors text-left font-sans"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Textarea */}
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write your daily English journal entry here... (e.g. 'Today I managed my BTC trade risk with strict 1:2 R:R ratio, then ran 20km long run in mountain trail...')"
                rows={10}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg p-3.5 text-sm font-sans focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 leading-relaxed resize-y placeholder:text-zinc-600"
              />
              <div className="absolute bottom-3 right-3 text-[10px] font-mono text-zinc-600">
                UTF-8 | EN-US
              </div>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="bg-rose-950/60 border border-rose-800 p-3 rounded-lg flex items-start space-x-2 text-xs font-mono text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">LỖI THỰC THI:</p>
                  <p className="font-sans text-rose-200">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => { setText(''); setCurrentEval(null); setErrorMsg(null); }}
                className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
                disabled={isLoading}
              >
                Xóa nội dung
              </button>

              <button
                onClick={handleSubmit}
                disabled={isLoading || !text.trim()}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg font-mono font-bold text-sm shadow-lg transition-all ${
                  isLoading || !text.trim()
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                    : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/10 active:scale-98'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>GEMINI ĐANG ĐÁNH GIÁ...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-zinc-950" />
                    <span>GỬI BÀI (GEMINI AI EVAL)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Assessment Result Box */}
          {currentEval && (
            <AssessmentResult
              evaluation={currentEval}
              onGoToSRS={() => onSelectTab('flashcards')}
            />
          )}
        </div>

        {/* Right Column: Journal History */}
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-mono font-bold text-xs text-zinc-300 flex items-center">
                <BookOpen className="w-4 h-4 mr-1.5 text-amber-400" />
                LỊCH SỬ NHẬT KÝ ({journalHistory.length})
              </span>
              <span className="text-[10px] font-mono text-zinc-500">Mới nhất</span>
            </div>

            {journalHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500 font-mono space-y-1">
                <p>Chưa có bài nhật ký nào được lưu.</p>
                <p className="text-[11px] text-zinc-600">Hãy viết bài đầu tiên để đạt điểm ≥ 6!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {journalHistory.map((item) => (
                  <div
                    key={item.id}
                    className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 space-y-2 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-500 text-[10px]">{item.date}</span>
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        item.score >= 8
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : item.score >= 6
                          ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}>
                        SCORE {item.score}/10
                      </span>
                    </div>

                    <p className="text-xs text-zinc-300 font-sans line-clamp-3 leading-relaxed">
                      "{item.text}"
                    </p>

                    {item.corrections && item.corrections.length > 0 && (
                      <div className="text-[10px] font-mono text-cyan-400 bg-zinc-900 p-1.5 rounded border border-zinc-800">
                        {item.corrections.length} lỗi đã nạp thẻ SRS Flashcards
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
