import React, { useState } from 'react';
import type { UserProgress, SyncStatus, UserSession } from '../types';
import { Flame, TrendingUp, TrendingDown, Clock, ShieldCheck, AlertTriangle, Key, HelpCircle, X, DollarSign, CloudCheck, RefreshCw, LogOut, User } from 'lucide-react';
import { getTodayDateString } from '../utils/srs';

interface HeaderTickerProps {
  progress: UserProgress;
  cardsDueCount: number;
  hasApiKey: boolean;
  syncStatus: SyncStatus;
  session: UserSession | null;
  onLogout: () => void;
  onOpenSettings: () => void;
  onSelectTab: (tab: 'journal' | 'speaking' | 'flashcards') => void;
  onUpdateStake: (amount: number) => void;
}

export const HeaderTicker: React.FC<HeaderTickerProps> = ({
  progress,
  cardsDueCount,
  hasApiKey,
  syncStatus,
  session,
  onLogout,
  onOpenSettings,
  onSelectTab,
  onUpdateStake,
}) => {
  const [showSymbolicInfo, setShowSymbolicInfo] = useState(false);
  const [isEditingStake, setIsEditingStake] = useState(false);
  const [stakeInput, setStakeInput] = useState(progress.stakeAmount.toString());

  const today = getTodayDateString();
  const isCompletedToday = progress.lastCompletedDate === today;

  const handleSaveStake = () => {
    const val = parseInt(stakeInput, 10);
    if (!isNaN(val) && val >= 0) {
      onUpdateStake(val);
    }
    setIsEditingStake(false);
  };

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  };

  return (
    <header className="bg-zinc-950 border-b border-zinc-800 text-zinc-200 font-sans">
      {/* Top Branding & Sync Status Line */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between text-xs border-b border-zinc-900 gap-2">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 font-mono font-bold text-amber-400">
            <span className="inline-block w-2.5 h-2.5 bg-amber-400 rounded-full animate-terminal-pulse"></span>
            <span className="tracking-wider">EN TERMINAL</span>
            <span className="text-zinc-600 font-normal">v2.5</span>
          </div>
          <span className="text-zinc-700">|</span>
          <span className="font-mono text-zinc-400 hidden sm:inline">godnc.com/englishisall</span>
        </div>

        {/* Sync Status & User Session Badge */}
        <div className="flex flex-wrap items-center space-x-3 font-mono text-[11px]">
          
          {/* Small Cloud Sync Indicator */}
          <div className="flex items-center space-x-1">
            {syncStatus === 'syncing' && (
              <span className="flex items-center text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/80 animate-pulse">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin text-amber-400" />
                <span>Đang đồng bộ...</span>
              </span>
            )}

            {syncStatus === 'synced' && (
              <span className="flex items-center text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                <CloudCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                <span>Đã đồng bộ Google Sheet</span>
              </span>
            )}

            {syncStatus === 'error' && (
              <span className="flex items-center text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800" title="Dữ liệu hiện được lưu tạm trên trình duyệt này">
                <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-400 flex-shrink-0" />
                <span className="truncate max-w-[200px] sm:max-w-none">Không đồng bộ được lên Google Sheet, dữ liệu tạm lưu trên máy này</span>
              </span>
            )}
          </div>

          {/* User badge & Logout */}
          {session && (
            <div className="flex items-center space-x-1.5 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-300">
              <User className="w-3 h-3 text-cyan-400" />
              <span className="font-bold text-zinc-200">{session.username}</span>
              <button
                onClick={onLogout}
                className="text-zinc-500 hover:text-rose-400 ml-1 transition-colors flex items-center"
                title="Đăng xuất khỏi tài khoản"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          )}

          {hasApiKey ? (
            <span className="hidden md:flex items-center text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              GEMINI READY
            </span>
          ) : (
            <button
              onClick={onOpenSettings}
              className="flex items-center text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800 animate-pulse hover:bg-rose-900 transition-colors"
            >
              <Key className="w-3.5 h-3.5 mr-1" />
              NHẬP API KEY
            </button>
          )}

          <button
            onClick={() => setShowSymbolicInfo(true)}
            className="flex items-center text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Giải thích quy tắc P&L Stake"
          >
            <HelpCircle className="w-3.5 h-3.5 mr-1" />
            <span className="hidden lg:inline">Cam kết Stake</span>
          </button>
        </div>
      </div>

      {/* Main Trading Terminal Stat Ticker Strip */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono">
          
          {/* STREAK */}
          <div className="bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-lg flex flex-col justify-between hover:border-amber-500/50 transition-colors">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span className="tracking-wider">STREAK</span>
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-400">{progress.streak}</span>
              <span className="text-xs text-zinc-500">ngày liên tiếp</span>
            </div>
          </div>

          {/* DAILY STAKE */}
          <div className="bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-lg flex flex-col justify-between hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span className="tracking-wider">DAILY STAKE</span>
              <DollarSign className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              {isEditingStake ? (
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    value={stakeInput}
                    onChange={(e) => setStakeInput(e.target.value)}
                    className="w-24 bg-zinc-950 border border-zinc-700 text-zinc-100 px-1 py-0.5 text-sm rounded font-mono"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveStake}
                    className="text-xs bg-amber-500 text-zinc-950 px-1.5 py-0.5 rounded font-bold hover:bg-amber-400"
                  >
                    Lưu
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-lg font-bold text-zinc-200">{formatVND(progress.stakeAmount)}</span>
                  <button
                    onClick={() => setIsEditingStake(true)}
                    className="text-[10px] text-zinc-500 hover:text-amber-400 underline ml-1"
                  >
                    Sửa
                  </button>
                </>
              )}
            </div>
          </div>

          {/* TOTAL PRESERVED */}
          <div className="bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-lg flex flex-col justify-between hover:border-emerald-500/50 transition-colors">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span className="tracking-wider">PRESERVED (BẢO TOÀN)</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold text-emerald-400">+{formatVND(progress.totalPreserved)}</span>
              <span className="text-xs text-emerald-600 font-bold">PROFIT</span>
            </div>
          </div>

          {/* TOTAL BURNED */}
          <div className="bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-lg flex flex-col justify-between hover:border-rose-500/50 transition-colors">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span className="tracking-wider">BURNED (MẤT)</span>
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold text-rose-400">-{formatVND(progress.totalBurned)}</span>
              <span className="text-xs text-rose-600 font-bold">LOSS</span>
            </div>
          </div>

          {/* SRS DUE TODAY */}
          <div className="col-span-2 md:col-span-1 bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-lg flex flex-col justify-between hover:border-cyan-500/50 transition-colors">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span className="tracking-wider">CARDS DUE TODAY</span>
              <Clock className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-cyan-400">{cardsDueCount}</span>
              <button
                onClick={() => onSelectTab('flashcards')}
                className="text-xs text-cyan-400 hover:underline font-mono"
              >
                Ôn thẻ &rarr;
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Daily Status CTA Banner */}
      <div className="max-w-7xl mx-auto px-4 pb-3">
        {isCompletedToday ? (
          <div className="bg-emerald-950/40 border border-emerald-800/60 p-2.5 rounded-lg flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-2 text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>🎯 ĐÃ HOÀN THÀNH MỤC TIÊU HÔM NAY: Bạn đã bảo toàn <strong>{formatVND(progress.stakeAmount)}</strong> stake & duy trì streak {progress.streak} ngày!</span>
            </div>
            <span className="text-emerald-500 font-bold hidden sm:inline">[P&L STABLE]</span>
          </div>
        ) : (
          <div className="bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center space-x-2 text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
              <span>⚠️ HÔM NAY CHƯA HOÀN THÀNH: Thực hiện 1 bài Journal hoặc Speaking để bảo toàn <strong>{formatVND(progress.stakeAmount)}</strong>!</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onSelectTab('journal')}
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-2.5 py-1 rounded font-bold transition-colors"
              >
                Viết Journal
              </button>
              <button
                onClick={() => onSelectTab('speaking')}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded transition-colors"
              >
                Luyện Speaking
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Symbolic Stake Explanation Modal */}
      {showSymbolicInfo && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 font-mono">
              <h3 className="font-bold text-amber-400 text-lg flex items-center">
                <DollarSign className="w-5 h-5 mr-1" />
                Cơ chế Stake & P&L Kỷ Luật
              </h3>
              <button
                onClick={() => setShowSymbolicInfo(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-zinc-300 space-y-3 leading-relaxed">
              <p>
                <strong>EN Terminal</strong> áp dụng tư duy <strong>Trading Risk & Reward</strong> vào việc luyện tiếng Anh mỗi ngày:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-zinc-400">
                <li>
                  <strong className="text-amber-400">Daily Stake:</strong> Số tiền bạn tự cam kết cho mỗi ngày (Mặc định 50.000 ₫).
                </li>
                <li>
                  <strong className="text-emerald-400">Preserved (Bảo toàn):</strong> Mỗi ngày bạn đạt bài viết/nói tiếng Anh điểm ≥ 6, tiền stake sẽ được bảo toàn.
                </li>
                <li>
                  <strong className="text-rose-400">Burned (Mất):</strong> Nếu lỡ mất 1 ngày không thực hành, số tiền stake tương ứng sẽ bị tính là Burned và streak reset về 0.
                </li>
              </ul>
              <div className="bg-zinc-950 p-3 rounded border border-zinc-800 text-xs font-mono text-amber-300">
                💡 <em>Ghi chú:</em> Ứng dụng không tự động trừ tiền thật. Khi chỉ số Burned tăng lên, hãy chủ động chuyển khoản số tiền đó cho bạn bè hoặc quỹ từ thiện để giữ đúng tính kỷ luật của người trader & ultra runner!
              </div>
            </div>

            <button
              onClick={() => setShowSymbolicInfo(false)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2 rounded-lg font-mono text-sm transition-colors"
            >
              Đã hiểu & Đóng
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
