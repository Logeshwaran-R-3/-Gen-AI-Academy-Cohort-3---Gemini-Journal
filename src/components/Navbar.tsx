import React from 'react';
import { Sparkles, LogOut, PlusCircle, BookOpen, ShieldCheck, GitBranch, HelpCircle, Target, Brain, Settings } from 'lucide-react';
import { AuthUserProfile } from '../types';

interface NavbarProps {
  user: AuthUserProfile;
  onSignOut: () => void;
  onNewEntry: () => void;
  hasActiveEntry: boolean;
  activeView: 'reflections' | 'threads' | 'unfinished' | 'actions' | 'memory';
  onViewChange: (view: 'reflections' | 'threads' | 'unfinished' | 'actions' | 'memory') => void;
  entryCount: number;
  threadCount: number;
  unfinishedCount: number;
  actionCount: number;
  memoryCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onSignOut,
  onNewEntry,
  hasActiveEntry,
  activeView,
  onViewChange,
  entryCount,
  threadCount,
  unfinishedCount,
  actionCount,
  memoryCount,
}) => {
  return (
    <header
      id="app-navbar"
      className="sticky top-0 z-30 bg-[#FDFCF8]/95 backdrop-blur-md border-b border-[#E5E0D8]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Navigation Tabs */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#7A8D74] flex items-center justify-center text-white shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-semibold text-[#4A3E3E] tracking-tight">
                  Gemini Journal
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-[#EAE4DB] text-[#70665C] px-2.5 py-0.5 rounded-full border border-[#E5E0D8]">
                  <Sparkles className="w-3 h-3 text-[#7A8D74]" />
                  Gemini 3.6 Flash
                </span>
              </div>
              <p className="text-xs text-[#A69D91] hidden md:block">
                Private AI reflections & cloud journal
              </p>
            </div>
          </div>

          {/* Primary View Switcher Tabs */}
          <nav
            id="nav-view-switcher"
            aria-label="Main Navigation"
            className="flex items-center bg-[#F5F2ED] p-1 rounded-full border border-[#E5E0D8] overflow-x-auto"
          >
            <button
              id="tab-view-reflections"
              onClick={() => onViewChange('reflections')}
              className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 shrink-0 ${
                activeView === 'reflections'
                  ? 'bg-white text-[#4A3E3E] shadow-2xs'
                  : 'text-[#70665C] hover:text-[#4A3E3E]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-[#7A8D74]" />
              <span>Reflections</span>
              <span className="ml-0.5 px-1.5 py-0.2 bg-[#EAE4DB] text-[#70665C] rounded-full text-[10px]">
                {entryCount}
              </span>
            </button>

            <button
              id="tab-view-threads"
              onClick={() => onViewChange('threads')}
              className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 shrink-0 ${
                activeView === 'threads'
                  ? 'bg-white text-[#4A3E3E] shadow-2xs'
                  : 'text-[#70665C] hover:text-[#4A3E3E]'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-[#7A8D74]" />
              <span>Thought Threads</span>
              <span className="ml-0.5 px-1.5 py-0.2 bg-[#EAE4DB] text-[#70665C] rounded-full text-[10px]">
                {threadCount}
              </span>
            </button>

            <button
              id="tab-view-unfinished"
              onClick={() => onViewChange('unfinished')}
              className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 shrink-0 ${
                activeView === 'unfinished'
                  ? 'bg-white text-[#4A3E3E] shadow-2xs'
                  : 'text-[#70665C] hover:text-[#4A3E3E]'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#C27D60]" />
              <span>Unfinished Thoughts</span>
              <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                unfinishedCount > 0
                  ? 'bg-[#F9ECE7] text-[#C27D60] font-bold'
                  : 'bg-[#EAE4DB] text-[#70665C]'
              }`}>
                {unfinishedCount}
              </span>
            </button>

            <button
              id="tab-view-actions"
              onClick={() => onViewChange('actions')}
              className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 shrink-0 ${
                activeView === 'actions'
                  ? 'bg-white text-[#4A3E3E] shadow-2xs'
                  : 'text-[#70665C] hover:text-[#4A3E3E]'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-[#7A8D74]" />
              <span>Insight → Action</span>
              <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                actionCount > 0
                  ? 'bg-[#EAF2E8] text-[#55694F] font-bold'
                  : 'bg-[#EAE4DB] text-[#70665C]'
              }`}>
                {actionCount}
              </span>
            </button>

            {/* AI Memory Control Center Tab */}
            <button
              id="tab-view-memory"
              onClick={() => onViewChange('memory')}
              title="Settings → AI Memory Control Center"
              className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 shrink-0 ${
                activeView === 'memory'
                  ? 'bg-white text-[#4A3E3E] shadow-2xs'
                  : 'text-[#70665C] hover:text-[#4A3E3E]'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-[#7A8D74]" />
              <span>AI Memory</span>
              <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                memoryCount > 0
                  ? 'bg-[#EAF2E8] text-[#55694F] font-bold'
                  : 'bg-[#EAE4DB] text-[#70665C]'
              }`}>
                {memoryCount}
              </span>
            </button>
          </nav>
        </div>

        {/* Right: Actions and User profile */}
        <div className="flex items-center gap-3">
          {/* Settings -> AI Memory direct quick button */}
          <button
            id="btn-settings-ai-memory"
            onClick={() => onViewChange('memory')}
            title="Settings → AI Memory"
            className={`p-2 rounded-xl transition-colors ${
              activeView === 'memory'
                ? 'bg-[#EAE4DB] text-[#4A3E3E]'
                : 'text-[#70665C] hover:text-[#4A3E3E] hover:bg-[#EAE4DB]'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            id="btn-new-entry"
            onClick={() => {
              onViewChange('reflections');
              onNewEntry();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-full bg-[#7A8D74] text-white hover:bg-[#687963] transition-colors shadow-xs active:scale-98"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">New Reflection</span>
            <span className="sm:hidden">New</span>
          </button>

          <div className="h-6 w-px bg-[#E5E0D8] mx-1 hidden sm:block" />

          {/* User Badge */}
          <div className="flex items-center gap-2 pl-1">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User profile'}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full border border-[#E5E0D8] object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#A69D91] text-white font-bold text-xs flex items-center justify-center">
                {user.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-[#4A3E3E] truncate max-w-[140px]">
                {user.displayName || 'Authenticated User'}
              </span>
              <span className="text-[10px] text-[#70665C] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#7A8D74]" /> Isolated
              </span>
            </div>
          </div>

          {/* Sign Out */}
          <button
            id="btn-sign-out"
            onClick={onSignOut}
            title="Sign out of your private journal"
            className="p-2 text-[#70665C] hover:text-[#4A3E3E] hover:bg-[#EAE4DB] rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
