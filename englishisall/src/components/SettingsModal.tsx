import React, { useState } from 'react';
import { Key, Eye, EyeOff, ShieldCheck, Trash2, X, ExternalLink, DollarSign, Sparkles } from 'lucide-react';
import { saveApiKey } from '../utils/storage';

interface SettingsModalProps {
  apiKey: string;
  onSaveKey: (key: string) => void;
  stakeAmount: number;
  onUpdateStake: (amount: number) => void;
  onSeedDemoData: () => void;
  onResetAllData: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  apiKey,
  onSaveKey,
  stakeAmount,
  onUpdateStake,
  onSeedDemoData,
  onResetAllData,
  onClose,
}) => {
  const [inputKey, setInputKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [inputStake, setInputStake] = useState(stakeAmount.toString());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveKey(inputKey.trim());
    saveApiKey(inputKey.trim());

    const stakeVal = parseInt(inputStake, 10);
    if (!isNaN(stakeVal) && stakeVal >= 0) {
      onUpdateStake(stakeVal);
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-6 font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 font-mono">
          <div className="flex items-center space-x-2 text-amber-400 font-bold">
            <Key className="w-5 h-5" />
            <span>TERMINAL SETTINGS // CONFIG</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          
          {/* Gemini API Key section */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-zinc-200 flex items-center justify-between">
              <span>GOOGLE GEMINI API KEY:</span>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline text-[11px] flex items-center font-normal"
              >
                Lấy API Key Miễn Phí (Google AI Studio)
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </label>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 pr-10 pl-3 py-2.5 rounded-lg font-mono text-sm focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-[11px] text-zinc-500 font-sans leading-relaxed">
              API Key được lưu an toàn trực tiếp trên trình duyệt của bạn (localStorage). Sử dụng mô hình AI <strong>gemini-2.5-flash</strong> chính thức.
            </p>
          </div>

          {/* Daily Stake Amount */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <label className="text-xs font-mono font-bold text-zinc-200 flex items-center">
              <DollarSign className="w-4 h-4 mr-1 text-emerald-400" />
              DAILY STAKE (VND/NGÀY):
            </label>
            <input
              type="number"
              value={inputStake}
              onChange={(e) => setInputStake(e.target.value)}
              placeholder="50000"
              step={10000}
              min={0}
              className="w-full bg-zinc-950 border border-zinc-800 text-amber-400 font-mono font-bold px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            />
            <p className="text-[11px] text-zinc-500 font-sans">
              Số tiền tự cam kết mỗi ngày. Nếu bỏ lỡ 1 ngày thực hành, số tiền này sẽ cộng vào ô <strong>Burned (Mất)</strong>.
            </p>
          </div>

          {savedSuccess && (
            <div className="p-2.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-mono text-xs text-center flex items-center justify-center space-x-1.5 animate-fadeIn">
              <ShieldCheck className="w-4 h-4" />
              <span>ĐÃ LƯU CẤU HÌNH THÀNH CÔNG!</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono font-bold px-6 py-2.5 rounded-lg text-xs transition-colors shadow-lg"
            >
              LƯU CẤU HÌNH (SAVE)
            </button>
          </div>
        </form>

        {/* Developer / Demo Data Actions */}
        <div className="pt-4 border-t border-zinc-800 space-y-3 font-mono text-xs">
          <span className="text-zinc-500 font-bold uppercase tracking-wider block text-[10px]">
            QUẢN LÝ DỮ LIỆU CÁ NHÂN:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                onSeedDemoData();
                onClose();
              }}
              className="flex items-center justify-center space-x-2 bg-zinc-950 hover:bg-zinc-800 text-cyan-400 border border-zinc-800 p-2.5 rounded-lg transition-colors"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>NẠP DỮ LIỆU DEMO</span>
            </button>

            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center justify-center space-x-2 bg-rose-950/40 hover:bg-rose-950 text-rose-400 border border-rose-900 p-2.5 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>RESET TẤT CẢ DỮ LIỆU</span>
            </button>
          </div>
        </div>

        {/* Reset Confirmation Sub-Modal */}
        {showResetConfirm && (
          <div className="p-4 bg-rose-950/90 border border-rose-800 rounded-xl space-y-3 font-mono text-xs text-rose-200 animate-fadeIn">
            <p className="font-bold text-rose-300">
              ⚠️ XÁC NHẬN RESET TOÀN BỘ DỮ LIỆU?
            </p>
            <p className="font-sans text-[11px] text-rose-300">
              Thao tác này sẽ xóa toàn bộ nhật ký, phiên luyện nói, streak và thẻ SRS Flashcards trên trình duyệt này.
            </p>
            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1 bg-zinc-900 text-zinc-300 rounded hover:bg-zinc-800"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetAllData();
                  setShowResetConfirm(false);
                  onClose();
                }}
                className="px-3 py-1 bg-rose-600 text-white rounded font-bold hover:bg-rose-500"
              >
                Xác nhận Reset
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
