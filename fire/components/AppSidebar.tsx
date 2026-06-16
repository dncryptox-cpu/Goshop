"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, TrendingUp, Map, BookOpen, Settings, Flame } from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Transactions", href: "/transactions", icon: Wallet },
  { name: "Profit", href: "/profit", icon: TrendingUp },
  { name: "Roadmap", href: "/roadmap", icon: Map },
  { name: "Journal", href: "/journal", icon: BookOpen },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 border-r border-white/5 bg-black/40 h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
          <Flame className="w-5 h-5 text-white" />
        </div>
        <span className="font-semibold text-lg tracking-tight text-white">FIRE Tracker</span>
      </div>

      <nav className="flex-1 px-4 flex flex-col gap-2 mt-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-white/5">
        <div className="text-xs text-slate-500 text-center">
          FIRE Tracker OS &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
