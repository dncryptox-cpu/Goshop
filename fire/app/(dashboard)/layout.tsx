import Link from "next/link";
import { Target, Home, PieChart, Map, Calculator, BookOpen, BrainCircuit, Settings, LogOut, Bell } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-black/20 backdrop-blur-xl flex flex-col h-full hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">FIRE OS</span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          <p className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-4">Overview</p>
          <NavItem href="/dashboard" icon={<Home className="w-4 h-4" />} label="Dashboard" active />
          <NavItem href="/portfolio" icon={<PieChart className="w-4 h-4" />} label="Portfolio" />
          <NavItem href="/roadmap" icon={<Map className="w-4 h-4" />} label="Wealth Map" />
          
          <p className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Tools</p>
          <NavItem href="/simulator" icon={<Calculator className="w-4 h-4" />} label="Simulator" />
          <NavItem href="/journal" icon={<BookOpen className="w-4 h-4" />} label="Journal" />
          <NavItem href="/advisor" icon={<BrainCircuit className="w-4 h-4" />} label="AI Advisor" />
        </div>

        <div className="p-4 border-t border-white/5 space-y-1">
          <NavItem href="/settings" icon={<Settings className="w-4 h-4" />} label="Settings" />
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
        
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-background/50 backdrop-blur-md z-10">
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-colors relative">
              <Bell className="w-5 h-5 text-slate-300" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border border-white/10 cursor-pointer overflow-hidden">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Avatar" className="w-full h-full object-cover" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8 z-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ href, icon, label, active = false }: { href: string, icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <Link 
      href={href} 
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active 
          ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" 
          : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
