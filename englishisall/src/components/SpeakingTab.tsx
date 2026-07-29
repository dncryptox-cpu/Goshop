import React, { useState, useEffect, useRef } from 'react';
import type { GeminiEvaluation, SpeakingSession, UserProgress, SRSCard } from '../types';
import { evaluateEnglishText } from '../utils/gemini';
import { markTaskCompletedToday, saveSpeakingSession, saveSRSCards, getStoredSRSCards } from '../utils/storage';
import { addCorrectionCards, getTodayDateString } from '../utils/srs';
import { AssessmentResult } from './AssessmentResult';
import { Mic, Shuffle, Loader2, Play, Square, AlertTriangle, Key, Activity, Volume2, Edit3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface SpeakingTabProps {
  apiKey: string;
  progress: UserProgress;
  onUpdateProgress: (newProgress: UserProgress) => void;
  onUpdateCards: (newCards: SRSCard[]) => void;
  onOpenSettings: () => void;
  onSelectTab: (tab: 'journal' | 'speaking' | 'flashcards') => void;
  speakingHistory: SpeakingSession[];
  onRefreshHistory: () => void;
}

const SPEAKING_TOPICS = [
  '📈 Trading: Explain your risk management rule when a trade hits stop-loss.',
  '🏃 Ultra Trail: Describe your pacing strategy and nutrition plan for a 100km mountain ultra trail.',
  '📈 Trading: How do macro trends and FOMO affect your trade execution discipline?',
  '🏃 Ultra Trail: What mental techniques do you use during night runs when facing extreme fatigue?',
  '🤖 AI & Tech: How do you leverage AI tools to optimize your trading research and workflow?',
  '🧘 Meditation: How does mindfulness and breathwork help maintain calm during high market volatility?',
  '📈 Trading: Analyze a recent losing trade and what lesson you took from it.',
  '🏃 Ultra Trail: What equipment and gear are non-negotiable for 100km alpine races?',
];

export const SpeakingTab: React.FC<SpeakingTabProps> = ({
  apiKey,
  progress,
  onUpdateProgress,
  onUpdateCards,
  onOpenSettings,
  onSelectTab,
  speakingHistory,
  onRefreshHistory,
}) => {
  const [topicIndex, setTopicIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualSeconds, setManualSeconds] = useState('60');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentEval, setCurrentEval] = useState<GeminiEvaluation | null>(null);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  const currentTopic = SPEAKING_TOPICS[topicIndex];
  const wordsCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  
  const activeDuration = isManualMode ? (parseInt(manualSeconds, 10) || 1) : Math.max(1, seconds);
  const wpm = activeDuration > 0 ? Math.round((wordsCount / activeDuration) * 60) : 0;

  // Check Web Speech API support
  const speechSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!speechSupported) {
      setIsManualMode(true);
    }
  }, [speechSupported]);

  // Handle timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const handleShuffleTopic = () => {
    setTopicIndex((prev) => (prev + 1) % SPEAKING_TOPICS.length);
  };

  const startRecording = () => {
    setErrorMsg(null);
    setCurrentEval(null);
    setTranscript('');
    setSeconds(0);

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setIsManualMode(true);
      setErrorMsg('Trình duyệt không hỗ trợ Web Speech API. Đã tự động chuyển sang chế độ Nhập Thủ Công (Manual Mode).');
      return;
    }

    try {
      const rec = new SpeechRecognitionClass();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsRecording(true);
      };

      rec.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript + ' ';
        }
        setTranscript(currentTranscript.trim());
      };

      rec.onerror = (event: any) => {
        console.error('Speech Recognition Error:', event.error);
        setIsRecording(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsManualMode(true);
          setErrorMsg('Quyền truy cập micro bị từ chối. Đã chuyển sang chế độ Nhập Thủ Công (Manual Mode).');
        } else {
          setErrorMsg(`Lỗi ghi âm: ${event.error}. Bạn có thể chuyển sang Chế độ Nhập Thủ Công.`);
        }
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e: any) {
      console.error('Failed to start speech recognition:', e);
      setIsManualMode(true);
      setErrorMsg('Không thể khởi tạo micro. Đã chuyển sang chế độ Nhập Thủ Công.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    setIsRecording(false);
  };

  const handleSubmitTranscript = async () => {
    if (!apiKey) {
      setErrorMsg('Chưa cấu hình API Key Gemini. Vui lòng bấm vào "Nhập API Key" để kích hoạt.');
      return;
    }

    if (wordsCount < 5) {
      setErrorMsg('Vui lòng nói/nhập ít nhất 5 từ tiếng Anh để Gemini AI đánh giá.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setCurrentEval(null);

    try {
      const evaluation = await evaluateEnglishText(
        `[SPEAKING PRACTICE - TOPIC: ${currentTopic}]\nTranscript: ${transcript}`,
        apiKey
      );
      setCurrentEval(evaluation);

      if (evaluation.is_english && evaluation.score >= 6) {
        const newSession: SpeakingSession = {
          id: `s_${Date.now()}`,
          date: `${getTodayDateString()} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
          topic: currentTopic,
          transcript: transcript.trim(),
          score: evaluation.score,
          feedback: evaluation.feedback,
          wpm: wpm,
          corrections: evaluation.corrections,
        };
        saveSpeakingSession(newSession);
        onRefreshHistory();

        // Mark day completed in progress
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

  // Format Recharts data (last 10 sessions)
  const chartData = [...speakingHistory].reverse().slice(-10).map((s) => ({
    date: s.date.split(' ')[0],
    score: s.score,
    wpm: s.wpm,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 font-sans">
      
      {/* Header Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 font-mono font-bold text-sm">
            <Mic className="w-4 h-4" />
            <span>SPEAKING LAB // SPEECH-TO-TEXT AI</span>
          </div>
          <h2 className="text-xl font-extrabold text-zinc-100 mt-1 font-mono">
            Luyện Nói Tiếng Anh Phản Xạ (WPM & Gemini AI)
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Ghi âm phát âm tiếng Anh trực tiếp qua micro, tính tốc độ WPM & chấm điểm tự động. Hỗ trợ fallback gõ thủ công.
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Main Topic & Recorder */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Topic Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center">
                <Volume2 className="w-4 h-4 mr-1.5" />
                CHỦ ĐỀ SPEAKING HÔM NAY #{topicIndex + 1}
              </span>
              <button
                onClick={handleShuffleTopic}
                className="flex items-center space-x-1 text-xs font-mono text-zinc-400 hover:text-amber-400 bg-zinc-950 hover:bg-zinc-800 px-2.5 py-1 rounded border border-zinc-800 transition-colors"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Đổi chủ đề</span>
              </button>
            </div>

            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-zinc-100 font-mono text-base font-bold leading-relaxed">
              "{currentTopic}"
            </div>
          </div>

          {/* Recorder Panel */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl space-y-4">
            
            {/* Mode Switch & Live Metrics Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3 text-xs font-mono">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => { setIsManualMode(false); setErrorMsg(null); }}
                  className={`px-3 py-1 rounded font-bold transition-colors ${
                    !isManualMode
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  🎙️ Direct Speech Recognition
                </button>
                <button
                  onClick={() => { setIsManualMode(true); setErrorMsg(null); }}
                  className={`px-3 py-1 rounded font-bold transition-colors ${
                    isManualMode
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  ⌨️ Manual Input Mode
                </button>
              </div>

              {/* Real-time metrics */}
              <div className="flex items-center space-x-3 text-zinc-300 bg-zinc-950 px-3 py-1 rounded border border-zinc-800">
                <span>TIME: <strong className="text-amber-400">{activeDuration}s</strong></span>
                <span>WPM: <strong className="text-cyan-400">{wpm}</strong></span>
              </div>
            </div>

            {/* Micro Controls (Voice Mode) */}
            {!isManualMode ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-6 bg-zinc-950 rounded-xl border border-zinc-800 space-y-3 relative overflow-hidden">
                  
                  {isRecording && (
                    <div className="absolute inset-0 bg-rose-950/20 pointer-events-none flex items-center justify-center">
                      <div className="w-32 h-32 bg-rose-500/10 rounded-full animate-ping"></div>
                    </div>
                  )}

                  <div className="z-10 flex items-center space-x-4">
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-6 py-3 rounded-full font-mono font-extrabold text-base shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                      >
                        <Play className="w-5 h-5 fill-current" />
                        <span>BẮT ĐẦU NÓI (START RECORDING)</span>
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="flex items-center space-x-2 bg-rose-500 hover:bg-rose-400 text-zinc-950 px-6 py-3 rounded-full font-mono font-extrabold text-base shadow-lg shadow-rose-500/20 active:scale-95 animate-pulse transition-all"
                      >
                        <Square className="w-5 h-5 fill-current" />
                        <span>DỪNG GHI ÂM (STOP)</span>
                      </button>
                    )}
                  </div>

                  <p className="text-xs font-mono text-zinc-400 z-10">
                    {isRecording ? '🔴 Đang ghi âm & nhận diện lời nói...' : 'Bấm nút để bắt đầu nói tiếng Anh'}
                  </p>
                </div>

                {/* Transcript Live Display */}
                <div className="space-y-1">
                  <label className="text-xs font-mono text-zinc-400 flex items-center justify-between">
                    <span>TRANSCRIPT GHI ÂM (TỰ ĐỘNG CHUYỂN THÀNH VĂN BẢN):</span>
                    <span className="text-[10px] text-zinc-500">{wordsCount} từ</span>
                  </label>
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Văn bản nhận diện giọng nói sẽ xuất hiện ở đây... (Bạn cũng có thể tự do chỉnh sửa lỗi phát âm gõ nhầm)."
                    rows={5}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg p-3 text-sm font-sans focus:outline-none focus:border-amber-500 leading-relaxed"
                  />
                </div>
              </div>
            ) : (
              /* Manual Input Fallback Mode */
              <div className="space-y-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                <div className="flex items-center justify-between text-xs font-mono text-amber-400">
                  <span className="flex items-center font-bold">
                    <Edit3 className="w-4 h-4 mr-1" />
                    CHẾ ĐỘ GÕ THỦ CÔNG (MANUAL FALLBACK)
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-zinc-400">Dán hoặc gõ bài nói tiếng Anh của bạn:</label>
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Paste or type your spoken transcript here..."
                    rows={6}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg p-3 text-sm font-sans focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center space-x-3 text-xs font-mono">
                  <label className="text-zinc-400">Thời gian ước tính đã nói (giây):</label>
                  <input
                    type="number"
                    value={manualSeconds}
                    onChange={(e) => setManualSeconds(e.target.value)}
                    className="w-20 bg-zinc-900 border border-zinc-700 text-amber-400 font-bold px-2 py-1 rounded text-center"
                    min={1}
                  />
                </div>
              </div>
            )}

            {/* Error Banner */}
            {errorMsg && (
              <div className="bg-rose-950/60 border border-rose-800 p-3 rounded-lg flex items-start space-x-2 text-xs font-mono text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">LỖI:</p>
                  <p className="font-sans text-rose-200">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSubmitTranscript}
                disabled={isLoading || !transcript.trim()}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg font-mono font-bold text-sm shadow-lg transition-all ${
                  isLoading || !transcript.trim()
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                    : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/10 active:scale-98'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>GEMINI ĐANG ĐÁNH GIÁ PHÁT ÂM...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4 text-zinc-950" />
                    <span>GỬI BÀI NÓI (GEMINI EVAL)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Assessment Result */}
          {currentEval && (
            <AssessmentResult
              evaluation={currentEval}
              onGoToSRS={() => onSelectTab('flashcards')}
            />
          )}

        </div>

        {/* Right 1 Col: Score Trend Chart & Past Speaking Logs */}
        <div className="space-y-4">
          
          {/* Recharts Score & WPM Trend */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-mono font-bold text-xs text-amber-400 flex items-center">
                <Activity className="w-4 h-4 mr-1.5" />
                ĐỒ THỊ ĐIỂM SPEAKING (10 SESSIONS)
              </span>
            </div>

            {chartData.length < 2 ? (
              <div className="py-12 text-center text-xs font-mono text-zinc-500">
                Chưa đủ dữ liệu đồ thị (Cần ít nhất 2 phiên nói).
              </div>
            ) : (
              <div className="h-48 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10, fill: '#71717a' }} />
                    <YAxis domain={[0, 10]} stroke="#71717a" tick={{ fontSize: 10, fill: '#71717a' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#f59e0b' }}
                    />
                    <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} name="Score (1-10)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Past Sessions List */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-mono font-bold text-xs text-zinc-300 flex items-center">
                <Mic className="w-4 h-4 mr-1.5 text-cyan-400" />
                LỊCH SỬ NÓI ({speakingHistory.length})
              </span>
            </div>

            {speakingHistory.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500 font-mono">
                Chưa có phiên nói nào.
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {speakingHistory.map((s) => (
                  <div
                    key={s.id}
                    className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 space-y-2 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-500 text-[10px]">{s.date}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-cyan-400 font-bold">{s.wpm} WPM</span>
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          s.score >= 8
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}>
                          SCORE {s.score}/10
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-amber-300 font-mono font-bold line-clamp-1">
                      {s.topic}
                    </p>

                    <p className="text-xs text-zinc-400 font-sans line-clamp-2">
                      "{s.transcript}"
                    </p>
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
