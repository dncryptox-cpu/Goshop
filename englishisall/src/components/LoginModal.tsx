import React, { useState } from 'react';
import type { UserSession, AppsScriptResponse } from '../types';
import { cloudLogin, cloudRegister, saveSession, getStoredAppsScriptUrl, saveAppsScriptUrl } from '../utils/cloudSync';
import { Terminal, KeyRound, UserPlus, LogIn, Loader2, AlertTriangle, ShieldCheck, ExternalLink, Settings } from 'lucide-react';

interface LoginModalProps {
  onLoginSuccess: (session: UserSession, cloudData?: any) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [scriptUrl, setScriptUrl] = useState(getStoredAppsScriptUrl());
  const [showUrlConfig, setShowUrlConfig] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.');
      return;
    }

    if (!scriptUrl.trim()) {
      setErrorMsg('Vui lòng nhập URL Google Apps Script Web App (/exec URL).');
      return;
    }

    setIsLoading(true);
    saveAppsScriptUrl(scriptUrl.trim());

    const session: UserSession = {
      username: username.trim(),
      password: password.trim(),
    };

    try {
      let res: AppsScriptResponse;
      if (isRegisterMode) {
        res = await cloudRegister(session, scriptUrl.trim());
      } else {
        res = await cloudLogin(session, scriptUrl.trim());
      }

      if (res.status === 'success') {
        saveSession(session);
        setSuccessMsg(res.message || (isRegisterMode ? 'Đăng ký thành công!' : 'Đăng nhập thành công!'));
        setTimeout(() => {
          onLoginSuccess(session, res.data);
        }, 800);
      } else {
        setErrorMsg(res.message || 'Đăng nhập thất bại.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể kết nối với Google Apps Script.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 font-sans">
        
        {/* Terminal Header */}
        <div className="text-center space-y-2 font-mono border-b border-zinc-800 pb-4">
          <div className="inline-flex items-center space-x-2 text-amber-400 font-extrabold text-lg">
            <Terminal className="w-6 h-6 animate-pulse" />
            <span>EN TERMINAL v2.5</span>
          </div>
          <p className="text-xs text-zinc-400 font-sans">
            Đăng nhập để đồng bộ dữ liệu trực tiếp lên <strong>Google Sheet</strong> cá nhân của bạn.
          </p>
        </div>

        {/* Toggle Mode Tabs */}
        <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 font-mono text-xs">
          <button
            type="button"
            onClick={() => { setIsRegisterMode(false); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 rounded-lg font-bold transition-all flex items-center justify-center space-x-1.5 ${
              !isRegisterMode ? 'bg-amber-500 text-zinc-950 shadow-lg' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>ĐĂNG NHẬP</span>
          </button>

          <button
            type="button"
            onClick={() => { setIsRegisterMode(true); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 rounded-lg font-bold transition-all flex items-center justify-center space-x-1.5 ${
              isRegisterMode ? 'bg-amber-500 text-zinc-950 shadow-lg' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>ĐĂNG KÝ TÀI KHOẢN</span>
          </button>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4 font-mono">
          
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-bold">TÊN ĐĂNG NHẬP (USERNAME):</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. trader_runner_99"
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:border-amber-500 font-sans"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-bold">MẬT KHẨU (PASSWORD):</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:border-amber-500 font-sans"
                required
              />
              <KeyRound className="w-4 h-4 text-zinc-600 absolute right-3.5 top-3" />
            </div>
          </div>

          {/* Config Apps Script URL section */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowUrlConfig(!showUrlConfig)}
              className="text-[11px] text-cyan-400 hover:underline flex items-center space-x-1 font-sans"
            >
              <Settings className="w-3 h-3" />
              <span>{showUrlConfig ? 'Ẩn cấu hình Google Apps Script URL' : 'Cấu hình URL Google Apps Script Web App (/exec)'}</span>
            </button>

            {showUrlConfig && (
              <div className="mt-2 space-y-1.5 bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs font-sans animate-fadeIn">
                <label className="text-[11px] text-zinc-400 font-mono block">GOOGLE APPS SCRIPT WEB APP URL:</label>
                <input
                  type="url"
                  value={scriptUrl}
                  onChange={(e) => setScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 p-2 rounded text-xs font-mono focus:outline-none"
                />
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  URL triển khai dạng Web App (kết thúc bằng <code>/exec</code>) liên kết với Google Sheet <strong>1gZ5sevZrKGzcL7ap0IBdyO3NdymkovwjDOQfC9xQf4o</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Success message */}
          {successMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-400 rounded-xl text-xs flex items-center space-x-2 animate-fadeIn font-sans">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Inline error message */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-start space-x-2 animate-fadeIn font-sans">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-xl font-bold text-sm shadow-xl transition-all flex items-center justify-center space-x-2 ${
              isLoading
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/10 active:scale-98'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                <span>ĐANG ĐỒNG BỘ GOOGLE SHEET...</span>
              </>
            ) : (
              <>
                {isRegisterMode ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                <span>{isRegisterMode ? 'ĐĂNG KÝ VÀ VÀO PHÒNG HỌC' : 'ĐĂNG NHẬP VÀ ĐỒNG BỘ'}</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="text-center text-[11px] text-zinc-500 font-sans border-t border-zinc-800/80 pt-3">
          Liên kết trực tiếp tới Google Sheet ID:
          <a
            href="https://docs.google.com/spreadsheets/d/1gZ5sevZrKGzcL7ap0IBdyO3NdymkovwjDOQfC9xQf4o/edit#gid=537818933"
            target="_blank"
            rel="noreferrer"
            className="text-cyan-400 hover:underline inline-flex items-center ml-1 font-mono"
          >
            1gZ5sevZrKGzcL... <ExternalLink className="w-3 h-3 ml-0.5" />
          </a>
        </div>

      </div>
    </div>
  );
};
