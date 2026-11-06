import React, { useState } from 'react';
import type { SRSCard } from '../types';
import { handleRemembered, handleForgot, getTodayDateString, BOX_INTERVALS } from '../utils/srs';
import { saveSRSCards } from '../utils/storage';
import { generateMindsetFlashcards } from '../utils/gemini';
import {
  Layers, Plus, CheckCircle2, RotateCcw, Eye, Sparkles, Brain, Award,
  Loader2, AlertTriangle, Key, Compass, Volume2, Type, Mic, Play, Square, Send
} from 'lucide-react';

interface FlashcardsTabProps {
  apiKey: string;
  cards: SRSCard[];
  onUpdateCards: (cards: SRSCard[]) => void;
  onOpenSettings: () => void;
}

type StudyMode = 'flip' | 'typing' | 'speaking';

export const FlashcardsTab: React.FC<FlashcardsTabProps> = ({
  apiKey,
  cards,
  onUpdateCards,
  onOpenSettings,
}) => {
  const today = getTodayDateString();

  // Navigation & Generator states
  const [studyMode, setStudyMode] = useState<StudyMode>('flip');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Trading' | 'Meditation' | 'Psychology' | 'Ultra Running'>('All');
  const [customPromptInput, setCustomPromptInput] = useState('');
  
  // Custom Card Form states
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  
  // AI Gen states
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null);

  // Deck Review states
  const [revealed, setRevealed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Mode 2: Typing practice state
  const [userTypedAnswer, setUserTypedAnswer] = useState('');
  const [typingResult, setTypingResult] = useState<{ checked: boolean; matchPercent: number } | null>(null);

  // Mode 3: Speaking practice state
  const [isRecordingCard, setIsRecordingCard] = useState(false);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [speakingResult, setSpeakingResult] = useState<{ checked: boolean; matchPercent: number } | null>(null);

  // Cards due today (or filter by category if needed)
  const dueCards = cards.filter((c) => c.nextReview <= today);
  const currentCard = dueCards[currentIndex];

  // Text-To-Speech (TTS Audio Read Out Loud)
  const handleSpeakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // stop previous speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9; // natural speed
      window.speechSynthesis.speak(utterance);
    }
  };

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

    resetCardSubstates();
    if (currentIndex >= dueCards.length - 1) {
      setCurrentIndex(0);
    }
  };

  const resetCardSubstates = () => {
    setRevealed(false);
    setUserTypedAnswer('');
    setTypingResult(null);
    setSpokenTranscript('');
    setSpeakingResult(null);
    setIsRecordingCard(false);
  };

  const handleAddCustomCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;

    const newCard: SRSCard = {
      id: `srs_custom_${Date.now()}`,
      category: 'Psychology',
      front: newFront.trim(),
      back: newBack.trim(),
      box: 0,
      nextReview: today, // Review immediately today
      createdAt: today,
    };

    const updated = [newCard, ...cards];
    saveSRSCards(updated);
    onUpdateCards(updated);

    setNewFront('');
    setNewBack('');
    setShowAddForm(false);
  };

  const handleGenerateAIMindsetCards = async (promptOverride?: string) => {
    if (!apiKey) {
      setAiErrorMsg('Chưa cấu hình API Key Gemini. Vui lòng bấm vào "Cài Đặt Key" để nhập API Key từ Google AI Studio.');
      return;
    }

    setIsGeneratingAI(true);
    setAiErrorMsg(null);

    const activePrompt = promptOverride || customPromptInput;

    try {
      const generated = await generateMindsetFlashcards(apiKey, selectedCategory, activePrompt);
      
      const newSRSCards: SRSCard[] = generated.map((g, idx) => ({
        id: `srs_ai_gen_${Date.now()}_${idx}`,
        category: g.category,
        front: g.front,
        back: g.back,
        box: 0,
        nextReview: today, // Due today for immediate study
        createdAt: today,
      }));

      const updated = [...newSRSCards, ...cards];
      saveSRSCards(updated);
      onUpdateCards(updated);
      setCurrentIndex(0);
      resetCardSubstates();
      setCustomPromptInput('');
    } catch (err: any) {
      setAiErrorMsg(err.message || 'Đã xảy ra lỗi khi gọi AI tạo thẻ thông điệp.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Helper: compute string similarity
  const computeMatchScore = (input: string, target: string): number => {
    const cleanIn = input.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTar = target.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanTar) return 0;
    if (cleanIn === cleanTar) return 100;
    
    // Check key word coverage
    const wordsTar = target.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    let matchedWords = 0;
    wordsTar.forEach(w => {
      if (cleanIn.includes(w.replace(/[^a-z0-9]/g, ''))) matchedWords++;
    });

    const percent = Math.round((matchedWords / Math.max(1, wordsTar.length)) * 100);
    return Math.min(100, Math.max(10, percent));
  };

  // Typing practice check
  const handleCheckTyping = () => {
    if (!currentCard || !userTypedAnswer.trim()) return;
    const score = computeMatchScore(userTypedAnswer, currentCard.back);
    setTypingResult({ checked: true, matchPercent: score });
    setRevealed(true);
  };

  // Speaking practice mic handle
  const handleStartSpeakingCard = () => {
    setSpokenTranscript('');
    setSpeakingResult(null);

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      alert('Trình duyệt của bạn không hỗ trợ Web Speech Recognition.');
      return;
    }

    try {
      const rec = new SpeechRecognitionClass();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => setIsRecordingCard(true);
      rec.onresult = (event: any) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        setSpokenTranscript(text);
      };
      rec.onend = () => {
        setIsRecordingCard(false);
      };

      rec.start();
    } catch (e) {
      console.error(e);
      setIsRecordingCard(false);
    }
  };

  const handleCheckSpeakingCard = () => {
    if (!currentCard || !spokenTranscript.trim()) return;
    const score = computeMatchScore(spokenTranscript, currentCard.front + ' ' + currentCard.back);
    setSpeakingResult({ checked: true, matchPercent: score });
    setRevealed(true);
  };

  // Box statistics
  const boxCounts = [0, 1, 2, 3, 4, 5].map((boxNum) => ({
    box: boxNum,
    interval: BOX_INTERVALS[boxNum],
    count: cards.filter((c) => c.box === boxNum).length,
  }));

  const getCategoryBadgeStyle = (cat?: string) => {
    switch (cat) {
      case 'Trading': return 'bg-amber-950/80 text-amber-400 border-amber-800';
      case 'Meditation': return 'bg-emerald-950/80 text-emerald-400 border-emerald-800';
      case 'Psychology': return 'bg-cyan-950/80 text-cyan-400 border-cyan-800';
      case 'Ultra Running': return 'bg-rose-950/80 text-rose-400 border-rose-800';
      default: return 'bg-zinc-900 text-zinc-400 border-zinc-800';
    }
  };

  const PRESET_PROMPTS = [
    '🧘 Thiền tĩnh tâm khi thị trường sụt giảm mạnh',
    '📈 Kỷ luật cắt lỗ 2% & không di chuyển stoploss',
    '🏃 Vượt qua cơn đau kiệt sức km 70 trong giải 100km',
    '🧠 Kiểm soát tâm lý FOMO và kiên nhẫn chờ setup',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 font-sans">
      
      {/* Header Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 font-mono font-bold text-sm">
            <Layers className="w-4 h-4" />
            <span>AI MINDSET FLASHCARDS // INTELLIGENT STUDY LAB</span>
          </div>
          <h2 className="text-xl font-extrabold text-zinc-100 mt-1 font-mono">
            Học & Rèn Luyện Thẻ Thông Điệp AI (Thiền / Trading / Tâm Lý)
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Dùng AI tạo bộ thẻ thông điệp châm ngôn, kết hợp tính năng **Đọc phát âm (TTS)**, **Gõ kiểm tra từ ghi nhớ** và **Luyện phát âm trực tiếp**.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono">
          <button
            onClick={() => setShowAIGenerator(!showAIGenerator)}
            className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow-lg"
          >
            <Sparkles className="w-4 h-4 text-zinc-950" />
            <span>TẠO BỘ THẺ AI MỚI</span>
          </button>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center space-x-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-700 transition-colors"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Tạo thủ công</span>
          </button>
        </div>
      </div>

      {/* AI Prompt Generator Interactive Panel */}
      {showAIGenerator && (
        <div className="bg-zinc-900 border border-amber-500/40 p-5 rounded-xl space-y-4 font-mono shadow-2xl animate-fadeIn">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 text-xs">
            <span className="font-bold text-amber-400 uppercase tracking-wider flex items-center">
              <Sparkles className="w-4 h-4 mr-1.5 text-amber-400" />
              BỘ TẠO THẺ THÔNG ĐIỆP BẰNG GEMINI AI (PROMPT TÙY CHỌN)
            </span>
            <span className="text-zinc-500 text-[11px]">Model: gemini-2.5-flash</span>
          </div>

          {/* Quick Preset Prompts */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-zinc-400 flex items-center">
              <Compass className="w-3.5 h-3.5 mr-1 text-cyan-400" />
              Chọn gợi ý chủ đề có sẵn:
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESET_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleGenerateAIMindsetCards(p)}
                  disabled={isGeneratingAI}
                  className="text-xs font-sans bg-zinc-950 hover:bg-zinc-800 text-zinc-300 hover:text-amber-300 px-3 py-1.5 rounded border border-zinc-800 transition-colors text-left"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Prompt Input & Category Selector */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
            <div className="md:col-span-3 space-y-1">
              <label className="text-[11px] text-zinc-400">Hoặc gõ yêu cầu chủ đề riêng của bạn cho AI:</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={customPromptInput}
                  onChange={(e) => setCustomPromptInput(e.target.value)}
                  placeholder="Ví dụ: Tạo cho tôi 4 câu châm ngôn Tiếng Anh về kiên nhẫn chờ điểm vào lệnh..."
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2.5 rounded-lg text-xs font-sans focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={() => handleGenerateAIMindsetCards()}
                  disabled={isGeneratingAI || !customPromptInput.trim()}
                  className={`flex items-center space-x-1.5 px-5 py-2.5 rounded-lg font-bold text-xs shadow-lg transition-all flex-shrink-0 ${
                    isGeneratingAI || !customPromptInput.trim()
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                      : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                  }`}
                >
                  {isGeneratingAI ? (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  ) : (
                    <Send className="w-4 h-4 text-zinc-950" />
                  )}
                  <span>TẠO BỘ THẺ</span>
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">Lọc danh mục AI:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 text-amber-400 p-2.5 rounded-lg text-xs font-mono focus:outline-none"
              >
                <option value="All">🌐 Tất Cả Chủ Đề</option>
                <option value="Trading">📈 Trading Discipline</option>
                <option value="Meditation">🧘 Thiền Định (Meditation)</option>
                <option value="Psychology">🧠 Tâm Lý Học (Psychology)</option>
                <option value="Ultra Running">🏃 Ultra Running</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* AI Error Alert */}
      {aiErrorMsg && (
        <div className="bg-rose-950/60 border border-rose-800 p-3 rounded-lg flex items-center justify-between text-xs font-mono text-rose-300">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{aiErrorMsg}</span>
          </div>
          {!apiKey && (
            <button
              onClick={onOpenSettings}
              className="flex items-center space-x-1 bg-rose-900 hover:bg-rose-800 text-rose-200 px-2.5 py-1 rounded text-[11px] font-bold"
            >
              <Key className="w-3.5 h-3.5 mr-1" />
              Cài Đặt Key
            </button>
          )}
        </div>
      )}

      {/* Custom Card Manual Form */}
      {showAddForm && (
        <form onSubmit={handleAddCustomCard} className="bg-zinc-900 border border-amber-500/50 p-4 rounded-xl space-y-3 font-mono text-xs animate-fadeIn">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-bold text-amber-400 uppercase tracking-wider flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              TẠO THẺ THỦ CÔNG MỚI
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
              <label className="text-zinc-400">Mặt trước (Original Phrase / Mindset Question):</label>
              <input
                type="text"
                value={newFront}
                onChange={(e) => setNewFront(e.target.value)}
                placeholder="e.g. Rule #1 when trade hits stop-loss?"
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2.5 rounded text-xs focus:outline-none focus:border-amber-500 font-sans"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-zinc-400">Mặt sau (Corrected Phrase / Wisdom Mantra + VN):</label>
              <input
                type="text"
                value={newBack}
                onChange={(e) => setNewBack(e.target.value)}
                placeholder="e.g. Exit immediately without ego. (Cắt lỗ lập tức không để cái tôi chi phối)."
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2.5 rounded text-xs focus:outline-none focus:border-amber-500 font-sans"
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

      {/* Main Review & Interactive Learning Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Interactive Card Arena */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-6">
            
            {/* Top Bar: Interactive Study Mode Switcher & Card Counters */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3 font-mono text-xs">
              
              {/* Study Mode Selector */}
              <div className="flex items-center space-x-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                <button
                  onClick={() => { setStudyMode('flip'); resetCardSubstates(); }}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded transition-colors font-bold ${
                    studyMode === 'flip' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>🎴 Lật Thẻ</span>
                </button>

                <button
                  onClick={() => { setStudyMode('typing'); resetCardSubstates(); }}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded transition-colors font-bold ${
                    studyMode === 'typing' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>✍️ Gõ Luyện Nhớ</span>
                </button>

                <button
                  onClick={() => { setStudyMode('speaking'); resetCardSubstates(); }}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded transition-colors font-bold ${
                    studyMode === 'speaking' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>🎙️ Luyện Phát Âm</span>
                </button>
              </div>

              {/* Progress counter */}
              <div className="text-zinc-400">
                THẺ ĐẾN HẠN: <strong className="text-cyan-400 ml-1 text-sm">{dueCards.length}</strong>
                {dueCards.length > 0 && <span className="ml-2 text-zinc-500">({currentIndex + 1}/{dueCards.length})</span>}
              </div>
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
                    Tất cả các thẻ đến hạn đã được rèn luyện. Bấm nút <strong>"🤖 TẠO BỘ THẺ AI MỚI"</strong> ở trên để AI tạo thêm bộ thẻ Thiền / Trading mới học ngay!
                  </p>
                </div>
              </div>
            ) : (
              /* Active Card Display with Selected Interactive Mode */
              <div className="space-y-6">
                
                {/* The Interactive Flashcard */}
                <div className={`p-8 rounded-xl border transition-all duration-300 min-h-[250px] flex flex-col justify-between ${
                  revealed
                    ? 'bg-zinc-950 border-amber-500/80 shadow-2xl shadow-amber-500/10'
                    : 'bg-zinc-950 border-zinc-800 shadow-xl'
                }`}>
                  
                  <div className="space-y-3">
                    
                    {/* Card Top Metadata & TTS Audio Button */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                      <div className="flex items-center space-x-2">
                        <span className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-amber-400 font-bold">
                          BOX {currentCard.box} ({BOX_INTERVALS[currentCard.box]} ngày)
                        </span>
                        {currentCard.category && (
                          <span className={`px-2 py-0.5 rounded font-bold border ${getCategoryBadgeStyle(currentCard.category)}`}>
                            {currentCard.category.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Text-To-Speech Audio Speaker Button */}
                      <button
                        onClick={() => handleSpeakText(currentCard.front + '. ' + currentCard.back)}
                        className="flex items-center space-x-1 bg-zinc-900 hover:bg-zinc-800 text-cyan-400 px-2.5 py-1 rounded border border-zinc-800 transition-colors"
                        title="Nghe phát âm tiếng Anh giọng chuẩn (TTS)"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Nghe Tiếng Anh (TTS)</span>
                      </button>
                    </div>

                    {/* Front side Question / Prompt */}
                    <div className="pt-2">
                      <span className="text-xs font-mono text-rose-400 font-bold uppercase tracking-wider block mb-1">
                        MẶT TRƯỚC (QUESTION / PRINCIPLE):
                      </span>
                      <p className="text-xl font-bold font-mono text-zinc-100 leading-relaxed">
                        "{currentCard.front}"
                      </p>
                    </div>
                  </div>

                  {/* Mode 1: STANDARD FLIP MODE */}
                  {studyMode === 'flip' && (
                    <>
                      {revealed ? (
                        <div className="pt-6 border-t border-zinc-800/80 mt-6 space-y-2 animate-fadeIn">
                          <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider block">
                            MẶT SAU (WISDOM MANTRA & GIẢI THÍCH):
                          </span>
                          <p className="text-lg font-bold font-sans text-emerald-400 leading-relaxed">
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
                    </>
                  )}

                  {/* Mode 2: TYPING PRACTICE MODE */}
                  {studyMode === 'typing' && (
                    <div className="pt-4 space-y-3 font-mono">
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400">Gõ lại từ nhớ/câu đáp án Tiếng Anh của bạn:</label>
                        <input
                          type="text"
                          value={userTypedAnswer}
                          onChange={(e) => setUserTypedAnswer(e.target.value)}
                          placeholder="Type your English answer here to test recall..."
                          className="w-full bg-zinc-900 border border-zinc-700 text-amber-300 p-2.5 rounded-lg text-sm focus:outline-none focus:border-amber-500 font-sans"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={handleCheckTyping}
                          disabled={!userTypedAnswer.trim()}
                          className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-1.5 rounded font-bold text-xs"
                        >
                          Kiểm Tra Kết Quả
                        </button>
                      </div>

                      {typingResult && (
                        <div className="pt-3 border-t border-zinc-800 space-y-2 animate-fadeIn">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-400">ĐỘ CHÍNH XÁC:</span>
                            <span className={`font-extrabold text-sm ${
                              typingResult.matchPercent >= 70 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {typingResult.matchPercent}%
                            </span>
                          </div>

                          <div className="bg-zinc-900 p-3 rounded border border-zinc-800 text-xs font-sans space-y-1">
                            <span className="text-zinc-500 font-mono text-[10px] block">ĐÁP ÁN CHUẨN:</span>
                            <p className="text-emerald-400 font-bold font-mono">"{currentCard.back}"</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode 3: SPEAKING PRACTICE MODE */}
                  {studyMode === 'speaking' && (
                    <div className="pt-4 space-y-3 font-mono">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">Bấm micro và đọc to phát âm thẻ Tiếng Anh này:</span>
                        {!isRecordingCard ? (
                          <button
                            onClick={handleStartSpeakingCard}
                            className="flex items-center space-x-1.5 bg-emerald-500 text-zinc-950 px-3 py-1.5 rounded font-bold"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Bắt Đầu Nói</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setIsRecordingCard(false)}
                            className="flex items-center space-x-1.5 bg-rose-500 text-zinc-950 px-3 py-1.5 rounded font-bold animate-pulse"
                          >
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Dừng Ghi Âm</span>
                          </button>
                        )}
                      </div>

                      {spokenTranscript && (
                        <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800 text-xs text-amber-300 font-sans">
                          "Transcript: {spokenTranscript}"
                        </div>
                      )}

                      {spokenTranscript && (
                        <div className="flex justify-end">
                          <button
                            onClick={handleCheckSpeakingCard}
                            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-1.5 rounded font-bold text-xs"
                          >
                            Chấm Điểm Phát Âm
                          </button>
                        </div>
                      )}

                      {speakingResult && (
                        <div className="pt-3 border-t border-zinc-800 space-y-2 animate-fadeIn">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-400">ĐỘ PHÁT ÂM CHUẨN:</span>
                            <span className="font-extrabold text-emerald-400 text-sm">{speakingResult.matchPercent}%</span>
                          </div>
                          <p className="text-xs text-emerald-400 font-sans font-bold bg-zinc-900 p-2 rounded">
                            "{currentCard.back}"
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* Control Action Buttons (Remembered / Forgot) */}
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
