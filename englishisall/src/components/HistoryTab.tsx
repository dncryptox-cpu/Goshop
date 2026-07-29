import React, { useState } from 'react';
import type { JournalEntry, SpeakingSession } from '../types';
import { History, Search, BookOpen, Mic } from 'lucide-react';

interface HistoryTabProps {
  journals: JournalEntry[];
  speaking: SpeakingSession[];
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ journals, speaking }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'journal' | 'speaking'>('all');

  const filteredJournals = journals.filter((j) =>
    filterType !== 'speaking' &&
    (j.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
     j.feedback.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredSpeaking = speaking.filter((s) =>
    filterType !== 'journal' &&
    (s.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
     s.transcript.toLowerCase().includes(searchTerm.toLowerCase()) ||
     s.feedback.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalEntries = journals.length + speaking.length;
  const allScores = [...journals.map((j) => j.score), ...speaking.map((s) => s.score)];
  const avgScore = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : '0';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 font-sans">
      
      {/* Header Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 font-mono font-bold text-sm">
            <History className="w-4 h-4" />
            <span>TERMINAL LOGS & HISTORY</span>
          </div>
          <h2 className="text-xl font-extrabold text-zinc-100 mt-1 font-mono">
            Nhật Ký Thực Hành & Phiên Luyện Nói
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Tra cứu lại toàn bộ các bài viết và phiên luyện nói đã gửi lên Gemini AI để theo dõi sự tiến bộ.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center space-x-4 font-mono">
          <div className="bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 text-center">
            <span className="text-[10px] text-zinc-500 block">TỔNG SỐ BÀI</span>
            <span className="text-lg font-bold text-amber-400">{totalEntries}</span>
          </div>
          <div className="bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 text-center">
            <span className="text-[10px] text-zinc-500 block">ĐIỂM TRUNG BÌNH</span>
            <span className="text-lg font-bold text-emerald-400">{avgScore}/10</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 font-mono text-xs">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm từ khóa (trade, trail run, stoploss...)"
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:border-amber-500 font-sans text-xs"
          />
        </div>

        <div className="flex items-center space-x-1 self-start md:self-center">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded transition-colors ${
              filterType === 'all' ? 'bg-amber-500 text-zinc-950 font-bold' : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            TẤT CẢ ({totalEntries})
          </button>
          <button
            onClick={() => setFilterType('journal')}
            className={`px-3 py-1.5 rounded transition-colors ${
              filterType === 'journal' ? 'bg-amber-500 text-zinc-950 font-bold' : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            JOURNAL ({journals.length})
          </button>
          <button
            onClick={() => setFilterType('speaking')}
            className={`px-3 py-1.5 rounded transition-colors ${
              filterType === 'speaking' ? 'bg-amber-500 text-zinc-950 font-bold' : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            SPEAKING ({speaking.length})
          </button>
        </div>
      </div>

      {/* Logs Feed */}
      <div className="space-y-4">
        
        {/* Journal Entries */}
        {filteredJournals.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-mono text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center">
              <BookOpen className="w-4 h-4 mr-1.5" />
              NHẬT KÝ JOURNAL ({filteredJournals.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredJournals.map((j) => (
                <div key={j.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-3 shadow-lg hover:border-zinc-700 transition-colors">
                  <div className="flex items-center justify-between text-xs font-mono border-b border-zinc-800 pb-2">
                    <span className="text-zinc-500">{j.date}</span>
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      j.score >= 8 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      SCORE {j.score}/10
                    </span>
                  </div>

                  <p className="text-sm font-sans text-zinc-200 leading-relaxed">
                    "{j.text}"
                  </p>

                  <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80 text-xs font-sans text-zinc-400 space-y-1">
                    <span className="font-mono font-bold text-amber-400 block text-[10px]">AI TUTOR FEEDBACK:</span>
                    <p>{j.feedback}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Speaking Sessions */}
        {filteredSpeaking.length > 0 && (
          <div className="space-y-3 pt-4">
            <h3 className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center">
              <Mic className="w-4 h-4 mr-1.5" />
              PHIÊN LUYỆN NÓI SPEAKING ({filteredSpeaking.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSpeaking.map((s) => (
                <div key={s.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-3 shadow-lg hover:border-zinc-700 transition-colors">
                  <div className="flex items-center justify-between text-xs font-mono border-b border-zinc-800 pb-2">
                    <span className="text-zinc-500">{s.date}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-cyan-400 font-bold">{s.wpm} WPM</span>
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        s.score >= 8 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        SCORE {s.score}/10
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-mono font-bold text-amber-300">
                    Topic: {s.topic}
                  </p>

                  <p className="text-sm font-sans text-zinc-200 leading-relaxed italic">
                    "{s.transcript}"
                  </p>

                  <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80 text-xs font-sans text-zinc-400 space-y-1">
                    <span className="font-mono font-bold text-cyan-400 block text-[10px]">AI TUTOR FEEDBACK:</span>
                    <p>{s.feedback}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
