import React from 'react';
import type { GeminiEvaluation } from '../types';
import { CheckCircle2, AlertCircle, Sparkles, Layers, ArrowRight } from 'lucide-react';

interface AssessmentResultProps {
  evaluation: GeminiEvaluation;
  onGoToSRS?: () => void;
}

export const AssessmentResult: React.FC<AssessmentResultProps> = ({ evaluation, onGoToSRS }) => {
  const isPassed = evaluation.is_english && evaluation.score >= 6;

  return (
    <div className={`mt-6 p-5 rounded-xl border font-mono transition-all animate-fadeIn ${
      isPassed
        ? 'bg-emerald-950/20 border-emerald-800/80 text-emerald-100 shadow-lg shadow-emerald-950/20'
        : 'bg-rose-950/20 border-rose-800/80 text-rose-100 shadow-lg shadow-rose-950/20'
    }`}>
      {/* Header Badge & Score */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div className="flex items-center space-x-3">
          {isPassed ? (
            <div className="p-2 rounded-lg bg-emerald-900/60 border border-emerald-700 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-rose-900/60 border border-rose-700 text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-bold tracking-wider px-2 py-0.5 rounded border ${
                isPassed
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : 'bg-rose-950 text-rose-400 border-rose-800'
              }`}>
                {isPassed ? '[PASS - STAKE PRESERVED]' : '[RETRY - NEED SCORE ≥ 6]'}
              </span>
              {!evaluation.is_english && (
                <span className="text-xs bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded">
                  Chưa phát hiện tiếng Anh rõ ràng
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1 font-sans">
              {isPassed
                ? 'Chúc mừng! Bài tập của bạn đã đạt tiêu chuẩn và ngày hôm nay đã được bảo toàn.'
                : 'Bài tập chưa đạt tiêu chuẩn để tính streak. Hãy chỉnh sửa và gửi lại!'}
            </p>
          </div>
        </div>

        {/* Score Gauge */}
        <div className="flex items-center space-x-2 bg-zinc-900/90 border border-zinc-800 px-4 py-2 rounded-lg">
          <span className="text-xs text-zinc-500 uppercase tracking-widest">SCORE</span>
          <span className={`text-3xl font-extrabold ${isPassed ? 'text-emerald-400' : 'text-rose-400'}`}>
            {evaluation.score}
          </span>
          <span className="text-xs text-zinc-500 font-bold">/10</span>
        </div>
      </div>

      {/* Feedback in Vietnamese */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center space-x-1.5 text-xs text-amber-400 font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>ĐÁNH GIÁ CỦA AI TUTOR</span>
        </div>
        <p className="text-sm font-sans text-zinc-200 bg-zinc-950/80 p-3 rounded-lg border border-zinc-800/80 leading-relaxed">
          {evaluation.feedback}
        </p>
      </div>

      {/* Corrections list */}
      {evaluation.corrections.length > 0 && (
        <div className="mt-5 space-y-3 border-t border-zinc-800/80 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider flex items-center">
              <Layers className="w-3.5 h-3.5 mr-1" />
              SỬA LỖI & NẠP THẺ SRS FLASHCARD ({evaluation.corrections.length})
            </span>
            {onGoToSRS && (
              <button
                onClick={onGoToSRS}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 font-mono underline"
              >
                <span>Xem bộ thẻ SRS</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="space-y-2">
            {evaluation.corrections.map((corr, idx) => (
              <div key={idx} className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-rose-400">
                    <span className="text-[10px] bg-rose-950 px-1.5 py-0.5 rounded border border-rose-900 font-bold">LỖI:</span>
                    <span className="line-through decoration-rose-500 font-mono">{corr.original}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <span className="text-[10px] bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-900 font-bold">ĐÚNG:</span>
                    <span className="font-bold font-mono">{corr.corrected}</span>
                  </div>
                </div>
                <div className="self-start sm:self-center">
                  <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded font-mono flex items-center">
                    + Đã tạo SRS Flashcard
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
