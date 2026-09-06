import React, { useState, useMemo } from 'react';
import {
  GitBranch,
  Calendar,
  Layers,
  ArrowRight,
  Search,
  BookOpen,
  Clock,
  Sparkles,
  Trash2,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Info,
  Target,
  Check,
  FileEdit,
  XCircle,
} from 'lucide-react';
import { ThoughtThread, JournalEntry, ActionExperiment, ActionExperimentStatus } from '../types';

interface ThoughtThreadsViewProps {
  threads: ThoughtThread[];
  entries: JournalEntry[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onOpenEntryInJournal: (entry: JournalEntry) => void;
  onDeleteThread: (threadId: string) => void;
  onSyncAllThreads?: () => Promise<void>;
  syncing?: boolean;
  actions?: ActionExperiment[];
  onDeriveAction?: (thread: ThoughtThread) => void;
  onUpdateActionStatus?: (actionId: string, status: ActionExperimentStatus) => Promise<void>;
  onNavigateToActions?: () => void;
}

export const ThoughtThreadsView: React.FC<ThoughtThreadsViewProps> = ({
  threads,
  entries,
  selectedThreadId,
  onSelectThread,
  onOpenEntryInJournal,
  onDeleteThread,
  onSyncAllThreads,
  syncing = false,
  actions = [],
  onDeriveAction,
  onUpdateActionStatus,
  onNavigateToActions,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'chronological' | 'reverse'>('chronological');

  // Filtered threads list
  const filteredThreads = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }, [threads, searchQuery]);

  // Current selected thread object
  const activeThread = useMemo(() => {
    if (!selectedThreadId && filteredThreads.length > 0) {
      return filteredThreads[0];
    }
    return threads.find((t) => t.id === selectedThreadId) || null;
  }, [threads, selectedThreadId, filteredThreads]);

  // Entries related to active thread in chronological order
  const relatedEntries = useMemo(() => {
    if (!activeThread) return [];
    const matched = entries.filter((e) => activeThread.entryIds.includes(e.id));

    // Sort chronologically (oldest first) so user sees evolution of thought
    matched.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.updatedAt).getTime();
      const timeB = new Date(b.createdAt || b.updatedAt).getTime();
      return sortOrder === 'chronological' ? timeA - timeB : timeB - timeA;
    });

    return matched;
  }, [activeThread, entries, sortOrder]);

  // Actions linked to the active thread
  const threadActions = useMemo(() => {
    if (!activeThread) return [];
    return actions.filter((a) => a.threadId === activeThread.id);
  }, [actions, activeThread]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      id="thought-threads-container"
      className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-[#FDFCF8]"
    >
      {/* Left Sidebar: Threads Directory */}
      <aside
        id="threads-list-panel"
        className="w-full lg:w-96 border-r border-[#E5E0D8] bg-[#F5F2ED] flex flex-col shrink-0 h-auto lg:h-full overflow-hidden"
      >
        {/* Header and Search */}
        <div className="p-4 border-b border-[#E5E0D8] bg-[#F5F2ED]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#EAE4DB] text-[#7A8D74] flex items-center justify-center shadow-2xs">
                <GitBranch className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-serif italic font-semibold text-[#4A3E3E]">
                  Thought Threads
                </h2>
                <p className="text-[11px] text-[#70665C]">
                  {threads.length} {threads.length === 1 ? 'evolving thread' : 'evolving threads'}
                </p>
              </div>
            </div>

            {onSyncAllThreads && (
              <button
                id="btn-sync-threads"
                onClick={onSyncAllThreads}
                disabled={syncing}
                title="Re-analyze and correlate reflections into thought threads"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[#EAE4DB] hover:bg-[#E0D8CD] text-[#70665C] transition-colors border border-[#E5E0D8] disabled:opacity-60"
              >
                <RefreshCw className={`w-3 h-3 text-[#7A8D74] ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Analyzing...' : 'Refresh'}</span>
              </button>
            )}
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#A69D91]" />
            <input
              id="input-search-threads"
              type="text"
              placeholder="Search thought threads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#E5E0D8] rounded-full text-[#4A3E3E] placeholder-[#A69D91] focus:outline-none focus:ring-1 focus:ring-[#7A8D74]"
            />
          </div>
        </div>

        {/* Threads List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredThreads.length === 0 ? (
            <div className="p-6 text-center text-[#70665C]">
              <GitBranch className="w-8 h-8 text-[#A69D91] mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-[#4A3E3E]">
                {searchQuery ? 'No threads matching query' : 'No Thought Threads Yet'}
              </p>
              <p className="text-[11px] text-[#A69D91] mt-1 leading-relaxed">
                {searchQuery
                  ? 'Try searching with different keywords.'
                  : entries.length > 0
                  ? `You have ${entries.length} ${entries.length === 1 ? 'reflection' : 'reflections'} ready to be correlated into evolving threads.`
                  : 'As reflections emerge over time, they are automatically correlated into evolving Thought Threads.'}
              </p>
              {!searchQuery && entries.length > 0 && onSyncAllThreads && (
                <button
                  id="btn-sidebar-sync-threads"
                  onClick={onSyncAllThreads}
                  disabled={syncing}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-[#7A8D74] hover:bg-[#687963] text-white transition-colors shadow-2xs disabled:opacity-60"
                >
                  <Sparkles className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Mapping Threads...' : 'Map Reflections'}</span>
                </button>
              )}
            </div>
          ) : (
            filteredThreads.map((thread) => {
              const isSelected = activeThread?.id === thread.id;
              return (
                <div
                  key={thread.id}
                  id={`thread-card-${thread.id}`}
                  onClick={() => onSelectThread(thread.id)}
                  role="button"
                  tabIndex={0}
                  className={`group relative p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer text-left ${
                    isSelected
                      ? 'bg-white border-[#7A8D74] shadow-xs'
                      : 'bg-[#FDFCF8] border-[#E5E0D8] hover:border-[#D5CDC2] hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className={`text-sm font-serif italic font-semibold line-clamp-1 ${
                        isSelected ? 'text-[#4A3E3E]' : 'text-[#4A3E3E]'
                      }`}
                    >
                      {thread.title}
                    </h3>
                    <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#EAE4DB] text-[#70665C]">
                      <Layers className="w-2.5 h-2.5 text-[#7A8D74]" />
                      {thread.entryCount || thread.entryIds?.length || 1}{' '}
                      {thread.entryCount === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>

                  <p className="text-xs text-[#70665C] mt-1 line-clamp-2 leading-relaxed">
                    {thread.description}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-[10px] text-[#A69D91] pt-2 border-t border-[#E5E0D8]/60">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Started {formatDate(thread.startedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Updated {formatDate(thread.updatedAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Main Panel: Thread Detail & Chronological Evolution Timeline */}
      <main
        id="thread-detail-workspace"
        className="flex-1 flex flex-col h-full overflow-y-auto bg-[#FDFCF8]"
      >
        {activeThread ? (
          <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Thread Header Card */}
            <div
              id="thread-header-card"
              className="bg-white p-6 rounded-3xl border border-[#E5E0D8] shadow-xs relative overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E0D8]">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider bg-[#EAE4DB] text-[#70665C] px-3 py-1 rounded-full border border-[#E5E0D8]">
                      <Sparkles className="w-3 h-3 text-[#7A8D74]" />
                      Thought Thread
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#F5F2ED] text-[#70665C] px-3 py-1 rounded-full border border-[#E5E0D8]">
                      <Layers className="w-3 h-3 text-[#7A8D74]" />
                      {activeThread.entryCount || activeThread.entryIds.length} Connected Reflections
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-serif italic font-semibold text-[#4A3E3E] tracking-tight">
                    {activeThread.title}
                  </h1>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    id="btn-delete-thread"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete thread "${activeThread.title}"? Your original journal entries will NOT be deleted.`
                        )
                      ) {
                        onDeleteThread(activeThread.id);
                      }
                    }}
                    title="Delete this thought thread (keeps original journal entries intact)"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#9E4738] hover:bg-[#FBF2EF] border border-[#ECD1C8] rounded-full transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Thread</span>
                  </button>
                </div>
              </div>

              {/* Description & Metadata */}
              <p className="mt-4 text-sm text-[#70665C] leading-relaxed">
                {activeThread.description}
              </p>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-[#E5E0D8]/70 text-xs text-[#70665C]">
                <div className="flex items-center gap-2">
                  <span className="text-[#A69D91]">First activity date:</span>
                  <span className="font-semibold text-[#4A3E3E]">
                    {formatDate(activeThread.startedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#A69D91]">Latest activity date:</span>
                  <span className="font-semibold text-[#4A3E3E]">
                    {formatDate(activeThread.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Insight -> Action Experiments Section */}
            <div id="thread-actions-section" className="bg-white border border-[#E5E0D8] rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E5E0D8]/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#EAF2E8] text-[#7A8D74] flex items-center justify-center">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-serif italic font-semibold text-[#4A3E3E]">
                      Insight → Action Experiments
                    </h2>
                    <p className="text-[11px] text-[#70665C]">
                      Small, concrete, optional experiments derived from recurring patterns in this thread
                    </p>
                  </div>
                </div>

                {onDeriveAction && (
                  <button
                    id="btn-derive-action"
                    onClick={() => onDeriveAction(activeThread)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full bg-[#7A8D74] text-white hover:bg-[#687963] transition-colors shadow-2xs self-start sm:self-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{threadActions.length > 0 ? 'Derive Another Experiment' : 'Derive Action Experiment'}</span>
                  </button>
                )}
              </div>

              {threadActions.length === 0 ? (
                <div className="p-4 bg-[#FDFCF8] border border-[#E5E0D8]/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#70665C]">
                  <div>
                    <p className="font-medium text-[#4A3E3E]">
                      No experiments generated for this thread yet.
                    </p>
                    <p className="text-[11px] text-[#A69D91] mt-0.5">
                      If this thought thread reflects recurring dilemmas, goals, or patterns, turn them into an empirical test.
                    </p>
                  </div>
                  {onDeriveAction && (
                    <button
                      onClick={() => onDeriveAction(activeThread)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#7A8D74] hover:text-[#55694F] shrink-0"
                    >
                      <span>Analyze Thread</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {threadActions.map((act) => (
                    <div
                      key={act.id}
                      className="p-3.5 bg-[#FDFCF8] border border-[#E5E0D8] rounded-2xl space-y-2 hover:border-[#7A8D74] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              act.status === 'completed'
                                ? 'bg-[#EBF3FA] text-[#3D688D] border-[#D0E2F2]'
                                : act.status === 'changed'
                                ? 'bg-[#FDF6E2] text-[#916E28] border-[#F5E6B8]'
                                : act.status === 'abandoned'
                                ? 'bg-[#F5F2ED] text-[#70665C] border-[#E5E0D8]'
                                : 'bg-[#EAF2E8] text-[#55694F] border-[#D5E3D1]'
                            }`}
                          >
                            {act.status === 'completed' && <Check className="w-3 h-3" />}
                            {act.status === 'changed' && <FileEdit className="w-3 h-3" />}
                            {act.status === 'abandoned' && <XCircle className="w-3 h-3" />}
                            <span className="capitalize">{act.status.replace('_', ' ')}</span>
                          </span>
                          {act.timeframe && (
                            <span className="text-[11px] text-[#A69D91] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {act.timeframe}
                            </span>
                          )}
                        </div>

                        {onNavigateToActions && (
                          <button
                            onClick={onNavigateToActions}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#7A8D74] hover:underline"
                          >
                            <span>Manage in Actions Tab</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-[#4A3E3E]">
                        Experiment: {act.changedExperimentText || act.experiment}
                      </p>

                      <p className="text-[11px] text-[#70665C] italic">
                        Insight: &ldquo;{act.insight}&rdquo;
                      </p>

                      {/* Quick Status Toggle */}
                      {onUpdateActionStatus && (
                        <div className="pt-2 border-t border-[#E5E0D8]/60 flex items-center gap-2 flex-wrap text-[11px]">
                          <span className="text-[#A69D91]">Update:</span>
                          {act.status !== 'completed' && (
                            <button
                              onClick={() => onUpdateActionStatus(act.id, 'completed')}
                              className="px-2 py-0.5 rounded-full bg-[#EBF3FA] text-[#3D688D] hover:bg-[#D0E2F2] font-medium border border-[#D0E2F2]"
                            >
                              Mark Completed
                            </button>
                          )}
                          {act.status !== 'changed' && (
                            <button
                              onClick={() => onUpdateActionStatus(act.id, 'changed')}
                              className="px-2 py-0.5 rounded-full bg-[#FDF6E2] text-[#916E28] hover:bg-[#F5E6B8] font-medium border border-[#F5E6B8]"
                            >
                              Mark Changed
                            </button>
                          )}
                          {act.status !== 'abandoned' && (
                            <button
                              onClick={() => onUpdateActionStatus(act.id, 'abandoned')}
                              className="px-2 py-0.5 rounded-full bg-[#F5F2ED] text-[#70665C] hover:bg-[#EAE4DB] font-medium border border-[#E5E0D8]"
                            >
                              Mark Abandoned
                            </button>
                          )}
                          {(act.status === 'completed' || act.status === 'abandoned' || act.status === 'changed') && (
                            <button
                              onClick={() => onUpdateActionStatus(act.id, 'in_progress')}
                              className="px-2 py-0.5 rounded-full bg-[#EAF2E8] text-[#55694F] hover:bg-[#D5E3D1] font-medium border border-[#D5E3D1]"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chronological Evolution Section */}
            <div id="thread-evolution-timeline" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-serif italic font-semibold text-[#4A3E3E]">
                    Evolution of Thinking
                  </h2>
                  <p className="text-xs text-[#70665C]">
                    Chronological progression of your ideas and reflections over time.
                  </p>
                </div>

                {/* Sort toggle */}
                <button
                  id="btn-toggle-sort-order"
                  onClick={() =>
                    setSortOrder((prev) =>
                      prev === 'chronological' ? 'reverse' : 'chronological'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-[#EAE4DB] hover:bg-[#E0D8CD] text-[#70665C] transition-colors border border-[#E5E0D8]"
                >
                  <Clock className="w-3.5 h-3.5 text-[#7A8D74]" />
                  <span>
                    {sortOrder === 'chronological'
                      ? 'Oldest to Newest'
                      : 'Newest to Oldest'}
                  </span>
                </button>
              </div>

              {/* Informative Note */}
              <div className="p-3.5 bg-[#F5F2ED] border border-[#E5E0D8] rounded-2xl flex items-start gap-2.5 text-xs text-[#70665C]">
                <Info className="w-4 h-4 text-[#7A8D74] shrink-0 mt-0.5" />
                <p>
                  Gemini identified that each of these reflection entries builds upon this common idea.
                  Click <strong>Open in Journal</strong> on any entry to view the full multi-turn conversation and continue reflecting.
                </p>
              </div>

              {/* Timeline Items */}
              {relatedEntries.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl border border-[#E5E0D8] text-center text-[#70665C]">
                  <BookOpen className="w-8 h-8 text-[#A69D91] mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-semibold text-[#4A3E3E]">No entries loaded</p>
                  <p className="text-xs text-[#A69D91] mt-1">
                    The entries associated with this thread may have been archived or removed.
                  </p>
                </div>
              ) : (
                <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#E5E0D8]">
                  {relatedEntries.map((entry, index) => {
                    const stepNumber =
                      sortOrder === 'chronological'
                        ? index + 1
                        : relatedEntries.length - index;

                    return (
                      <div
                        key={entry.id}
                        id={`timeline-entry-${entry.id}`}
                        className="relative group"
                      >
                        {/* Timeline Step Dot */}
                        <div className="absolute -left-6 sm:-left-8 top-4 w-6 h-6 rounded-full bg-[#EAE4DB] border-2 border-[#7A8D74] text-[#4A3E3E] text-[10px] font-bold flex items-center justify-center shadow-2xs">
                          {stepNumber}
                        </div>

                        {/* Entry Card */}
                        <div className="bg-white p-5 rounded-2xl border border-[#E5E0D8] shadow-xs hover:border-[#7A8D74] transition-all duration-150">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E5E0D8]/60">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-[#7A8D74]">
                                  Stage {stepNumber}
                                </span>
                                <span className="text-[10px] font-medium bg-[#F5F2ED] text-[#70665C] px-2 py-0.5 rounded-full capitalize">
                                  {entry.category || 'reflection'}
                                </span>
                              </div>
                              <h3 className="text-base font-serif italic font-semibold text-[#4A3E3E] mt-0.5">
                                {entry.title || 'Untitled Entry'}
                              </h3>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#A69D91] flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDate(entry.createdAt)}
                              </span>
                              <button
                                id={`btn-open-entry-${entry.id}`}
                                onClick={() => onOpenEntryInJournal(entry)}
                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-[#7A8D74] text-white hover:bg-[#687963] transition-colors shadow-2xs"
                              >
                                <span>Open in Journal</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Summary or Content Preview */}
                          <div className="mt-3">
                            {entry.summary ? (
                              <div className="text-xs text-[#70665C] leading-relaxed bg-[#FDFCF8] p-3.5 rounded-xl border border-[#E5E0D8]/70">
                                <span className="font-semibold text-[#4A3E3E] block mb-1">
                                  Reflection Synthesis:
                                </span>
                                <p className="line-clamp-4 whitespace-pre-line">
                                  {entry.summary}
                                </p>
                              </div>
                            ) : (
                              <div className="text-xs text-[#70665C] leading-relaxed bg-[#FDFCF8] p-3.5 rounded-xl border border-[#E5E0D8]/70">
                                <span className="font-semibold text-[#4A3E3E] block mb-1">
                                  Initial Reflection:
                                </span>
                                <p className="line-clamp-3 italic">
                                  {entry.messages && entry.messages.length > 0
                                    ? entry.messages[0].content
                                    : 'No conversation text recorded yet.'}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Conversation message count */}
                          <div className="mt-3 flex items-center justify-between text-[11px] text-[#A69D91]">
                            <span>
                              {entry.messages?.length || 0}{' '}
                              {entry.messages?.length === 1 ? 'message' : 'messages'} in reflection
                            </span>
                            {entry.tags && entry.tags.length > 0 && (
                              <div className="flex items-center gap-1">
                                {entry.tags.slice(0, 3).map((tag, tIdx) => (
                                  <span
                                    key={tIdx}
                                    className="px-2 py-0.5 rounded-md bg-[#EAE4DB] text-[#70665C] text-[10px]"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-[#EAE4DB] text-[#7A8D74] flex items-center justify-center mx-auto mb-4 shadow-2xs">
              <GitBranch className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-serif italic font-semibold text-[#4A3E3E]">
              {threads.length === 0 ? 'Map Your Thought Threads' : 'No Thought Thread Selected'}
            </h3>
            <p className="text-xs text-[#70665C] mt-2 leading-relaxed">
              {threads.length === 0
                ? 'Thought Threads correlate your ongoing reflections over time, tracing how specific ideas, dilemmas, and goals evolve without losing their original chronological context.'
                : 'Select an existing Thought Thread from the sidebar to inspect the chronological development of your thinking.'}
            </p>

            {threads.length === 0 && entries.length > 0 && (
              <div className="mt-6 p-5 rounded-2xl bg-white border border-[#E5E0D8] shadow-xs w-full text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#4A3E3E]">
                    Reflections Ready to Correlate ({entries.length})
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#7A8D74] font-medium">
                    <Sparkles className="w-3 h-3" />
                    Gemini Analysis
                  </span>
                </div>
                <p className="text-[11px] text-[#70665C] leading-relaxed">
                  Gemini will analyze the thoughts and conversations in your reflections and group recurring themes into dedicated thought threads.
                </p>
                {onSyncAllThreads && (
                  <button
                    id="btn-map-all-reflections-cta"
                    onClick={onSyncAllThreads}
                    disabled={syncing}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#7A8D74] hover:bg-[#687963] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-60 cursor-pointer"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>{syncing ? 'Analyzing and Mapping Reflections...' : 'Map Reflections into Thought Threads'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
