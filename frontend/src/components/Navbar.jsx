import React from 'react';
import { Calendar, Search, Ticket, Settings, Sparkles, LogIn, LogOut } from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  currentUser, 
  setCurrentUser, 
  onOpenSettings,
  onOpenAuth 
}) {
  const isDirectCognitoUser = currentUser?.token;

  return (
    <header className="sticky top-0 z-40 w-full glass-card border-b border-white/10 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo & Platform Title */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('events')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                Nexus
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                AWS Serverless
              </span>
            </div>
            <p className="text-xs text-slate-400 -mt-0.5">Events & AI Lost and Found</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('events')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'events'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Campus Events
          </button>

          <button
            onClick={() => setActiveTab('lostfound')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'lostfound'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Search className="w-4 h-4" />
            Lost & Found
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/30 text-purple-300 border border-purple-500/40 font-bold">
              AI Vision
            </span>
          </button>

          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'bookings'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Ticket className="w-4 h-4" />
            My Bookings
          </button>
        </nav>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2.5">
          
          {isDirectCognitoUser ? (
            /* Logged in directly via Cognito */
            <div className="flex items-center gap-2 bg-slate-900/80 rounded-xl border border-emerald-500/30 px-3 py-1.5 text-xs">
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {currentUser.name}
                <span className="text-[10px] text-slate-400 capitalize">{currentUser.role}</span>
              </span>
              <button
                onClick={() => setCurrentUser(null)}
                title="Sign Out"
                className="text-slate-400 hover:text-rose-400 ml-1 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            title="Configure AWS Endpoints"
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900/60 hover:bg-white/10 border border-white/5 transition-all"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex border-t border-white/5 bg-slate-950/80 px-2 py-1.5 justify-around">
        <button
          onClick={() => setActiveTab('events')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
            activeTab === 'events' ? 'bg-indigo-600 text-white' : 'text-slate-400'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Events
        </button>
        <button
          onClick={() => setActiveTab('lostfound')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
            activeTab === 'lostfound' ? 'bg-indigo-600 text-white' : 'text-slate-400'
          }`}
        >
          <Search className="w-3.5 h-3.5" /> Lost & Found
        </button>
        <button
          onClick={() => setActiveTab('bookings')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
            activeTab === 'bookings' ? 'bg-indigo-600 text-white' : 'text-slate-400'
          }`}
        >
          <Ticket className="w-3.5 h-3.5" /> My Bookings
        </button>
      </div>
    </header>
  );
}
