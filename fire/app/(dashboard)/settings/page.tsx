import { Settings, User, Bell, Lock, CreditCard } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-2">
          <Settings className="w-8 h-8 text-slate-400" /> Settings
        </h1>
        <p className="text-slate-400">Manage your profile, preferences, and subscription.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Settings Navigation */}
        <div className="md:col-span-1 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-sm font-medium transition-colors text-left">
            <User className="w-4 h-4" /> Profile
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl text-sm font-medium transition-colors text-left">
            <Lock className="w-4 h-4" /> Security
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl text-sm font-medium transition-colors text-left">
            <Bell className="w-4 h-4" /> Notifications
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl text-sm font-medium transition-colors text-left">
            <CreditCard className="w-4 h-4" /> Billing
          </button>
        </div>

        {/* Settings Content */}
        <div className="md:col-span-3 space-y-6">
          <div className="glass-card p-8 rounded-2xl border border-white/10">
            <h2 className="text-xl font-semibold mb-6">Profile Information</h2>
            
            <div className="flex items-center gap-6 mb-8">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-3xl font-bold border-4 border-black shadow-xl">
                D
              </div>
              <div>
                <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors mb-2 block">
                  Change Avatar
                </button>
                <p className="text-xs text-slate-400">JPG, GIF or PNG. Max size of 800K</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">First Name</label>
                  <input type="text" defaultValue="DNC" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Last Name</label>
                  <input type="text" defaultValue="Nguyen" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Email Address</label>
                <input type="email" defaultValue="dnc@example.com" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none" />
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors">
                Save Changes
              </button>
            </div>
          </div>
          
          <div className="glass-card p-8 rounded-2xl border border-red-500/20 bg-red-500/5">
            <h2 className="text-xl font-semibold mb-2 text-red-400">Danger Zone</h2>
            <p className="text-sm text-slate-400 mb-6">Permanently delete your account and all of your data.</p>
            <button className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium transition-colors">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
