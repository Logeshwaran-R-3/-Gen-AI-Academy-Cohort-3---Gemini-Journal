import React, { useState, useMemo } from 'react';
import {
  HelpCircle,
  Calendar,
  GitBranch,
  Search,
  Sparkles,
  CheckCircle2,
  EyeOff,
  Clock,
  RefreshCw,
  Info,
  ArrowRight,
  ExternalLink,
  Filter,
  Check,
  RotateCcw,
} from 'lucide-react';
import { UnfinishedThought, UnfinishedThoughtStatus, ThoughtThread, JournalEntry } from '../types';

interface UnfinishedThoughtsViewProps {
  unfinishedThoughts: UnfinishedThought[];
  threads: ThoughtThread[];
  entries: JournalEntry[];
  onExploreThought: (thought: UnfinishedThought) => void;
  onMarkResolved: (thoughtId: string) => Promise<void>;
  onDismiss: (thoughtId: string) => Promise<void>;
  onRemindLater: (thoughtId: string) => Promise<void>;
  onReactivate?: (thoughtId: string) => Promise<void>;
  onScanUnfinishedThoughts: () => Promise<void>;
  onViewThread?: (threadId: string) => void;
  onViewEntry?: (entryId: string) => void;
  scanning?: boolean;
  loading?: boolean;
}

export const UnfinishedThoughtsView: React.FC<UnfinishedThoughtsViewProps> = ({
  unfinishedThoughts,
  threads,
  entries,
  onExploreThought,
  onMarkResolved,
  onDismiss,
  onRemindLater,
  onReactivate,
  onScanUnfinishedThoughts,
  onViewThread,
  onViewEntry,
  scanning = false,
  loading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<UnfinishedThoughtStatus | 'all'>('active');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Filter thoughts
  const filteredThoughts = useMemo(() => {
    let list = [...unfinishedThoughts];

    // Status filter
    if (filterStatus !== 'all') {
      list = list.filter((t) => t.status === filterStatus);
    }

    // Search query
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.originalContext.toLowerCase().includes(q) ||
          t.whyUnfinished.toLowerCase().includes(q) ||
          (t.threadTitle && t.threadTitle.toLowerCase().includes(q))
      );
    }

    // Sort: active first, then chronological (oldest first or newest first)
    list.sort((a, b) => {
      const timeA = new Date(a.dateFirstMentioned || a.createdAt).getTime();
      const timeB = new Date(b.dateFirstMentioned || b.createdAt).getTime();
      return timeB - timeA;
    });

    return list;
  }, [unfinishedThoughts, filterStatus, searchQuery]);

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      active: unfinishedThoughts.filter((t) => t.status === 'active').length,
      resolved: unfinishedThoughts.filter((t) => t.status === 'resolved').length,
      dismissed: unfinishedThoughts.filter((t) => t.status === 'dismissed').length,
      snoozed: unfinishedThoughts.filter((t) => t.status === 'snoozed').length,
      total: unfinishedThoughts.length,
    };
  }, [unfinishedThoughts]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Earlier entry';
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

  const handleAction = async (actionFn: () => Promise<void>, id: string) => {
    setProcessingId(id);
    try {
      await actionFn();
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div
      id="unfinished-thoughts-container"
      className="flex-1 flex flex-col h-full overflow-y-auto bg-[#FDFCF8]"
    >
      <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Banner */}
        <div
          id="unfinished-thoughts-header"
          className="bg-white p-6 sm:p-7 rounded-3xl border border-[#E5E0D8] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider bg-[#F9ECE7] text-[#C27D60] px-3 py-1 rounded-full border border-[#ECD1C8]">
                <HelpCircle className="w-3.5 h-3.5 text-[#C27D60]" />
                Cognitive Continuity
              </span>
              <span className="text-xs font-semibold bg-[#F5F2ED] text-[#70665C] px-2.5 py-0.5 rounded-full border border-[#E5E0D8]">
                {counts.active} Unresolved
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif italic font-semibold text-[#4A3E3E] tracking-tight">
              Unfinished Thoughts
            </h1>
            <p className="text-xs sm:text-sm text-[#70665C] mt-1 max-w-2xl leading-relaxed">
              Ideas, questions, decisions, and goals mentioned in past reflections that appear unresolved or set aside as your journaling shifted to other topics.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-scan-unfinished-thoughts"
              onClick={onScanUnfinishedThoughts}
              disabled={scanning}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full bg-[#7A8D74] text-white hover:bg-[#687963] transition-colors shadow-xs disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Analyzing Reflections...' : 'Scan for Unfinished Thoughts'}</span>
            </button>
          </div>
        </div>

        {/* Informational Guidelines Card */}
        <div className="p-4 bg-[#F5F2ED] border border-[#E5E0D8] rounded-2xl flex items-start gap-3 text-xs text-[#70665C] leading-relaxed">
          <Info className="w-4 h-4 text-[#7A8D74] shrink-0 mt-0.5" />
          <p>
            <strong>Conservative Detection Protocol:</strong> Gemini surfaces thoughts only with textual evidence of an open question, pending decision, unexecuted plan, or explicitly stated intent to revisit. No psychological assumptions are made about your emotional state.
          </p>
        </div>

        {/* Filter Tabs and Search Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              id="filter-active"
              onClick={() => setFilterStatus('active')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                filterStatus === 'active'
                  ? 'bg-[#4A3E3E] text-white'
                  : 'bg-[#F5F2ED] text-[#70665C] hover:bg-[#EAE4DB]'
              }`}
            >
              <span>Active Unfinished</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  filterStatus === 'active'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#E5E0D8] text-[#70665C]'
                }`}
              >
                {counts.active}
              </span>
            </button>

            <button
              id="filter-resolved"
              onClick={() => setFilterStatus('resolved')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                filterStatus === 'resolved'
                  ? 'bg-[#7A8D74] text-white'
                  : 'bg-[#F5F2ED] text-[#70665C] hover:bg-[#EAE4DB]'
              }`}
            >
              <span>Resolved</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  filterStatus === 'resolved'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#E5E0D8] text-[#70665C]'
                }`}
              >
                {counts.resolved}
              </span>
            </button>

            <button
              id="filter-snoozed"
              onClick={() => setFilterStatus('snoozed')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                filterStatus === 'snoozed'
                  ? 'bg-[#A69D91] text-white'
                  : 'bg-[#F5F2ED] text-[#70665C] hover:bg-[#EAE4DB]'
              }`}
            >
              <span>Snoozed</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  filterStatus === 'snoozed'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#E5E0D8] text-[#70665C]'
                }`}
              >
                {counts.snoozed}
              </span>
            </button>

            <button
              id="filter-all"
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                filterStatus === 'all'
                  ? 'bg-[#4A3E3E] text-white'
                  : 'bg-[#F5F2ED] text-[#70665C] hover:bg-[#EAE4DB]'
              }`}
            >
              <span>All</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  filterStatus === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#E5E0D8] text-[#70665C]'
                }`}
              >
                {counts.total}
              </span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#A69D91]" />
            <input
              id="search-unfinished-thoughts"
              type="text"
              placeholder="Search thoughts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#E5E0D8] rounded-full text-[#4A3E3E] placeholder-[#A69D91] focus:outline-none focus:ring-1 focus:ring-[#7A8D74]"
            />
          </div>
        </div>

        {/* Thought Cards Grid / List */}
        {filteredThoughts.length === 0 ? (
          <div
            id="empty-unfinished-thoughts"
            className="bg-white p-12 rounded-3xl border border-[#E5E0D8] text-center max-w-lg mx-auto my-6"
          >
            <div className="w-12 h-12 rounded-full bg-[#F5F2ED] text-[#7A8D74] flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-serif italic font-semibold text-[#4A3E3E]">
              {searchQuery
                ? 'No matching unfinished thoughts'
                : filterStatus === 'active'
                ? 'No active unfinished thoughts'
                : 'No thoughts in this category'}
            </h3>
            <p className="text-xs text-[#70665C] mt-2 leading-relaxed">
              {searchQuery
                ? 'Try a different search term.'
                : entries.length === 0
                ? 'Start journaling your thoughts and ideas. Gemini will identify open questions or abandoned goals that you may wish to revisit later.'
                : 'Click "Scan for Unfinished Thoughts" above to let Gemini analyze your reflections and identify items left unresolved.'}
            </p>
            {!searchQuery && entries.length > 0 && (
              <button
                onClick={onScanUnfinishedThoughts}
                disabled={scanning}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#7A8D74] hover:bg-[#687963] text-white rounded-full text-xs font-semibold transition-colors shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                <span>Scan Reflections Now</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {filteredThoughts.map((thought) => {
              const isProcessing = processingId === thought.id;
              const isResolved = thought.status === 'resolved';
              const isSnoozed = thought.status === 'snoozed';
              const isDismissed = thought.status === 'dismissed';

              // Find associated thread title if threadId exists
              const matchedThread = thought.threadId
                ? threads.find((t) => t.id === thought.threadId)
                : null;
              const threadTitleDisplay =
                thought.threadTitle || matchedThread?.title;

              return (
                <article
                  key={thought.id}
                  id={`thought-card-${thought.id}`}
                  className={`bg-white p-5 sm:p-6 rounded-3xl border transition-all duration-150 relative ${
                    isResolved
                      ? 'border-[#D2DCBE] bg-[#FAFCF8]'
                      : isDismissed || isSnoozed
                      ? 'border-[#E5E0D8] bg-[#FAF8F5] opacity-80'
                      : 'border-[#E5E0D8] shadow-xs hover:border-[#C27D60]/50'
                  }`}
                >
                  {/* Top Bar: Title, Date, Status badge */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-[#E5E0D8]/70">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-[#E8EFE3] text-[#55694F] border border-[#D2DCBE]">
                            <CheckCircle2 className="w-3 h-3" />
                            Resolved
                          </span>
                        ) : isSnoozed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-[#F5F2ED] text-[#70665C] border border-[#E5E0D8]">
                            <Clock className="w-3 h-3 text-[#A69D91]" />
                            Snoozed
                          </span>
                        ) : isDismissed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-[#F5F2ED] text-[#A69D91] border border-[#E5E0D8]">
                            <EyeOff className="w-3 h-3" />
                            Not Relevant
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-[#F9ECE7] text-[#C27D60] border border-[#ECD1C8]">
                            <HelpCircle className="w-3 h-3" />
                            Unfinished
                          </span>
                        )}

                        {/* First mentioned date */}
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#70665C]">
                          <Calendar className="w-3 h-3 text-[#A69D91]" />
                          First mentioned {formatDate(thought.dateFirstMentioned)}
                        </span>

                        {/* Associated Thought Thread Badge if present */}
                        {thought.threadId && threadTitleDisplay && (
                          <button
                            onClick={() => onViewThread && onViewThread(thought.threadId!)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#EAE4DB] hover:bg-[#E0D8CD] text-[#70665C] transition-colors border border-[#E5E0D8]"
                            title="Click to view full Thought Thread"
                          >
                            <GitBranch className="w-3 h-3 text-[#7A8D74]" />
                            <span>Thread: {threadTitleDisplay}</span>
                            <ExternalLink className="w-2.5 h-2.5 ml-0.5 text-[#A69D91]" />
                          </button>
                        )}
                      </div>

                      <h2 className="text-lg sm:text-xl font-serif italic font-semibold text-[#4A3E3E] tracking-tight pt-1">
                        {thought.title}
                      </h2>
                    </div>

                    {/* Source entry jump */}
                    {onViewEntry && thought.entryId && (
                      <button
                        onClick={() => onViewEntry(thought.entryId)}
                        className="inline-flex items-center gap-1 text-xs text-[#7A8D74] hover:underline shrink-0"
                        title="View the original journal reflection"
                      >
                        <span>View Source Entry</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="py-3.5 space-y-3 text-xs">
                    {/* Original Context Quote */}
                    <div className="p-3.5 bg-[#FDFCF8] rounded-2xl border border-[#E5E0D8]/80 text-[#5C5248]">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A69D91] block mb-1">
                        Original Context
                      </span>
                      <p className="italic leading-relaxed">
                        "{thought.originalContext}"
                      </p>
                    </div>

                    {/* Why Considered Unfinished Explanation */}
                    <div className="p-3.5 bg-[#FBF9F5] rounded-2xl border border-[#EAE4DB] text-[#70665C] flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-[#C27D60] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C27D60] block mb-0.5">
                          Why System Considers It Unfinished
                        </span>
                        <p className="leading-relaxed">
                          {thought.whyUnfinished}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="pt-3 border-t border-[#E5E0D8]/70 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 1. Explore Now */}
                      <button
                        id={`btn-explore-${thought.id}`}
                        onClick={() => onExploreThought(thought)}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full bg-[#7A8D74] text-white hover:bg-[#687963] transition-colors shadow-2xs disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Explore Now with Gemini</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      {/* 2. Mark as Resolved */}
                      {!isResolved ? (
                        <button
                          id={`btn-resolve-${thought.id}`}
                          onClick={() => handleAction(() => onMarkResolved(thought.id), thought.id)}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-white text-[#55694F] hover:bg-[#F2F7EF] border border-[#D2DCBE] transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#7A8D74]" />
                          <span>Mark as resolved</span>
                        </button>
                      ) : (
                        onReactivate && (
                          <button
                            id={`btn-reactivate-${thought.id}`}
                            onClick={() => handleAction(() => onReactivate(thought.id), thought.id)}
                            disabled={isProcessing}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full bg-white text-[#70665C] hover:bg-[#F5F2ED] border border-[#E5E0D8] transition-colors"
                          >
                            <RotateCcw className="w-3 h-3 text-[#A69D91]" />
                            <span>Reopen as unfinished</span>
                          </button>
                        )
                      )}

                      {/* 3. Not Relevant */}
                      {!isDismissed && (
                        <button
                          id={`btn-dismiss-${thought.id}`}
                          onClick={() => handleAction(() => onDismiss(thought.id), thought.id)}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-white text-[#70665C] hover:bg-[#F5F2ED] border border-[#E5E0D8] transition-colors disabled:opacity-50"
                        >
                          <EyeOff className="w-3.5 h-3.5 text-[#A69D91]" />
                          <span>Not relevant</span>
                        </button>
                      )}

                      {/* 4. Remind Me Later */}
                      {!isSnoozed && !isResolved && (
                        <button
                          id={`btn-remind-${thought.id}`}
                          onClick={() => handleAction(() => onRemindLater(thought.id), thought.id)}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-white text-[#70665C] hover:bg-[#F5F2ED] border border-[#E5E0D8] transition-colors disabled:opacity-50"
                        >
                          <Clock className="w-3.5 h-3.5 text-[#A69D91]" />
                          <span>Remind me later</span>
                        </button>
                      )}
                    </div>

                    {isResolved && thought.resolvedAt && (
                      <span className="text-[11px] text-[#7A8D74] font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Resolved on {formatDate(thought.resolvedAt)}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
