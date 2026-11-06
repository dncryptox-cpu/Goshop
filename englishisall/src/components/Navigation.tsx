import React from 'react';
import type { ActiveTab, UserSession } from '../types';
import { BookOpen, Mic, Layers, History, Settings, LogOut, User } from 'lucide-react';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  cardsDueCount: number;
  session: UserSession | null;
  onLogout: () => void;
  onOpenSettings: () => void;
}

interface TabItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  subtext: string;
  badge?: number | null;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  cardsDueCount,
  session,
  onLogout,
  onOpenSettings,
}) => {
  const tabs: TabItem[] = [
    { id: 'journal', label: '[1] JOURNAL', icon: BookOpen, subtext: 'Nhật ký Tiếng Anh' },
    { id: 'speaking', label: '[2] SPEAKING', icon: Mic, subtext: 'Luyện nói Speech AI' },
    { id: 'flashcards', label: '[3] FLASHCARDS', icon: Layers, subtext: 'SRS Leitner Deck', badge: cardsDueCount > 0 ? cardsDueCount : null },
    { id: 'history', label: '[4] LOGS & CHARTS', icon: History, subtext: 'Lịch sử & Đồ thị' },
  ];

  return (
    <nav className="bg-zinc-950 border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between overflow-x-auto no-scrollbar">
        <div className="flex space-x-1 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-mono text-sm transition-all relative ${
                  isActive
                    ? 'bg-zinc-900 text-amber-400 border border-zinc-700 shadow-lg'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-zinc-500'}`} />
                <div className="flex flex-col items-start text-left">
                  <span className="font-bold tracking-wider">{tab.label}</span>
                  <span className="text-[10px] text-zinc-500 font-sans hidden sm:inline">{tab.subtext}</span>
                </div>

                {tab.badge !== undefined && tab.badge !== null && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold font-mono rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="py-2 pl-2 flex items-center space-x-2">
          {session && (
            <div className="hidden sm:flex items-center space-x-1 text-xs font-mono text-zinc-400 bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-zinc-800">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-zinc-200 font-bold">{session.username}</span>
            </div>
          )}

          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-1.5 px-3 py-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-900 rounded-lg border border-transparent hover:border-zinc-800 font-mono text-xs transition-colors"
            title="Cài đặt API Key & Dữ liệu"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden md:inline">CÀI ĐẶT</span>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 rounded-lg border border-rose-900/60 font-mono text-xs font-bold transition-colors"
            title="Đăng xuất khỏi tài khoản để xem lại màn hình Login"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>ĐĂNG XUẤT</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
