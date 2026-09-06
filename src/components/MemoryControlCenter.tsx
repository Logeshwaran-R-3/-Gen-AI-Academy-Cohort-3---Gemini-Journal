import React, { useState, useMemo } from 'react';
import {
  Brain,
  Trash2,
  EyeOff,
  Shield,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Search,
  Layers,
  Sparkles,
  Clock,
  ExternalLink,
  RotateCcw,
  BookOpen,
  GitBranch,
  X,
  Filter,
  Check,
  Power,
  Info,
} from 'lucide-react';
import { AIMemory, JournalEntry, ThoughtThread, UserMemorySettings } from '../types';

interface MemoryControlCenterProps {
  memories: AIMemory[];
  memoriesLoading: boolean;
  memorySettings: UserMemorySettings;
  entries: JournalEntry[];
  threads: ThoughtThread[];
  onForgetMemory: (memoryId: string) => Promise<void>;
  onExcludeMemory: (memoryId: string) => Promise<void>;
  onRestoreMemory: (memoryId: string) => Promise<void>;
  onDeleteMemoryPermanently: (memoryId: string) => Promise<void>;
  onDeleteAllMemoriesPermanently: () => Promise<void>;
  onToggleMemoryCreation: (enabled: boolean) => Promise<void>;
  onSelectEntry: (entry: JournalEntry) => void;
  onSelectThread: (threadId: string) => void;
}

export const MemoryControlCenter: React.FC<MemoryControlCenterProps> = ({
  memories,
  memoriesLoading,
  memorySettings,
  entries,
  threads,
  onForgetMemory,
  onExcludeMemory,
  onRestoreMemory,
  onDeleteMemoryPermanently,
  onDeleteAllMemoriesPermanently,
  onToggleMemoryCreation,
  onSelectEntry,
  onSelectThread,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'forgotten' | 'excluded'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  // Destructive Confirmation States
  const [memoryToDelete, setMemoryToDelete] = useState<AIMemory | null>(null);
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
  const [confirmPhraseInput, setConfirmPhraseInput] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Status counts
  const totalCount = memories.length;
  const activeCount = useMemo(() => memories.filter((m) => m.status === 'active').length, [memories]);
  const forgottenCount = useMemo(() => memories.filter((m) => m.status === 'forgotten').length, [memories]);
  const excludedCount = useMemo(() => memories.filter((m) => m.status === 'excluded').length, [memories]);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    memories.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set).sort();
  }, [memories]);

  // Filtered list
  const filteredMemories = useMemo(() => {
    return memories
      .filter((mem) => {
        if (statusFilter !== 'all' && mem.status !== statusFilter) return false;
        if (categoryFilter !== 'all' && mem.category !== categoryFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchFact = mem.fact.toLowerCase().includes(q);
          const matchCat = mem.category?.toLowerCase().includes(q);
          const matchSource = mem.sourceTitle?.toLowerCase().includes(q);
          const matchThread = mem.threadTitle?.toLowerCase().includes(q);
          if (!matchFact && !matchCat && !matchSource && !matchThread) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [memories, statusFilter, categoryFilter, searchQuery]);

  const handleForget = async (id: string) => {
    try {
      setIsProcessingId(id);
      await onForgetMemory(id);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleExclude = async (id: string) => {
    try {
      setIsProcessingId(id);
      await onExcludeMemory(id);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      setIsProcessingId(id);
      await onRestoreMemory(id);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleExecuteDelete = async () => {
    if (!memoryToDelete) return;
    try {
      setIsProcessingId(memoryToDelete.id);
      await onDeleteMemoryPermanently(memoryToDelete.id);
      setMemoryToDelete(null);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleExecuteDeleteAll = async () => {
    if (confirmPhraseInput.trim().toLowerCase() !== 'delete all memories') return;
    try {
      setIsDeletingAll(true);
      await onDeleteAllMemoriesPermanently();
      setConfirmDeleteAllOpen(false);
      setConfirmPhraseInput('');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const formatDateTime = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div id="memory-control-center" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header & Breadcrumb */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#70665C]">
          <span>Settings</span>
          <span>/</span>
          <span className="text-[#7A8D74] flex items-center gap-1">
            <Brain className="w-3.5 h-3.5" /> AI Memory Control Center
          </span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#4A3E3E] tracking-tight flex items-center gap-2.5">
              <Brain className="w-7 h-7 text-[#7A8D74]" />
              Memory Control Center
            </h1>
            <p className="text-sm text-[#70665C] mt-1 max-w-2xl leading-relaxed">
              Inspect and control what Gemini is permitted to remember as long-term context across your reflections.
              Deleting a memory permanently removes it and its vector embedding while leaving your original journal entries untouched.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-delete-all-memories"
              onClick={() => {
                setConfirmPhraseInput('');
                setConfirmDeleteAllOpen(true);
              }}
              disabled={memories.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#FDF0EE] text-[#C25E4A] hover:bg-[#F9DFDC] border border-[#F3C5BD] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete All AI Memories</span>
            </button>
          </div>
        </div>
      </div>

      {/* Memory Architecture & Governance Banner */}
      <div className="bg-[#F8F6F1] border border-[#E5E0D8] rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E0D8]">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl mt-0.5 ${memorySettings.memoryCreationEnabled ? 'bg-[#EAF2E8] text-[#55694F]' : 'bg-[#F9ECE7] text-[#C27D60]'}`}>
              <Power className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#4A3E3E]">
                  Future Memory Creation:
                </span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  memorySettings.memoryCreationEnabled
                    ? 'bg-[#EAF2E8] text-[#55694F] border border-[#CDE0C8]'
                    : 'bg-[#F9ECE7] text-[#C27D60] border border-[#F2D0C3]'
                }`}>
                  {memorySettings.memoryCreationEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-[#70665C] mt-0.5">
                {memorySettings.memoryCreationEnabled
                  ? 'Gemini can distill and remember enduring facts or recurring goals from future reflections.'
                  : 'Memory creation is locked. Gemini will not extract or store new facts from reflections.'}
              </p>
            </div>
          </div>

          <button
            id="toggle-memory-creation"
            onClick={() => onToggleMemoryCreation(!memorySettings.memoryCreationEnabled)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors border shadow-2xs ${
              memorySettings.memoryCreationEnabled
                ? 'bg-white text-[#70665C] hover:text-[#4A3E3E] border-[#E5E0D8] hover:bg-[#F2EFE9]'
                : 'bg-[#7A8D74] text-white hover:bg-[#687963] border-transparent'
            }`}
          >
            {memorySettings.memoryCreationEnabled ? (
              <>
                <ShieldAlert className="w-4 h-4 text-[#C27D60]" />
                <span>Disable Future Memory Creation</span>
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                <span>Enable Future Memory Creation</span>
              </>
            )}
          </button>
        </div>

        {/* 5-Tier Memory Separation Explanation */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          <div className="bg-white/80 border border-[#E5E0D8] rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A69D91] block">Tier 1</span>
            <div className="text-xs font-semibold text-[#4A3E3E] mt-1 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#7A8D74]" /> Journal Content
            </div>
            <p className="text-[11px] text-[#70665C] mt-1">
              Your raw journal text. Never modified or deleted by memory actions.
            </p>
          </div>

          <div className="bg-white/80 border border-[#E5E0D8] rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A69D91] block">Tier 2</span>
            <div className="text-xs font-semibold text-[#4A3E3E] mt-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#5B7898]" /> Summaries
            </div>
            <p className="text-[11px] text-[#70665C] mt-1">
              High-level overviews generated on demand for long reflection threads.
            </p>
          </div>

          <div className="bg-[#FAF8F5] border-2 border-[#7A8D74] rounded-xl p-3 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A8D74] block">Tier 3 (Managed Here)</span>
            <div className="text-xs font-semibold text-[#4A3E3E] mt-1 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-[#7A8D74]" /> Semantic Memories
            </div>
            <p className="text-[11px] text-[#70665C] mt-1">
              Distilled facts and vector embeddings used for long-term AI context.
            </p>
          </div>

          <div className="bg-white/80 border border-[#E5E0D8] rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A69D91] block">Tier 4</span>
            <div className="text-xs font-semibold text-[#4A3E3E] mt-1 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-[#7A8D74]" /> Thought Threads
            </div>
            <p className="text-[11px] text-[#70665C] mt-1">
              Semantic clusters connecting related reflections over time.
            </p>
          </div>

          <div className="bg-white/80 border border-[#E5E0D8] rounded-xl p-3 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A69D91] block">Tier 5</span>
            <div className="text-xs font-semibold text-[#4A3E3E] mt-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C27D60]" /> AI Insights
            </div>
            <p className="text-[11px] text-[#70665C] mt-1">
              Concrete action experiments & perspective replays suggested by AI.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5E0D8] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#70665C] text-xs font-medium">
            <span>Total Memories</span>
            <Brain className="w-4 h-4 text-[#7A8D74]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#4A3E3E] mt-1">
            {totalCount}
          </div>
          <span className="text-[11px] text-[#A69D91] mt-0.5 block">Stored in Firestore</span>
        </div>

        <div className="bg-white border border-[#E5E0D8] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#70665C] text-xs font-medium">
            <span>Active in AI Context</span>
            <CheckCircle2 className="w-4 h-4 text-[#7A8D74]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#55694F] mt-1">
            {activeCount}
          </div>
          <span className="text-[11px] text-[#7A8D74] mt-0.5 block">Accessible by Gemini</span>
        </div>

        <div className="bg-white border border-[#E5E0D8] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#70665C] text-xs font-medium">
            <span>Forgotten / Muted</span>
            <EyeOff className="w-4 h-4 text-[#A69D91]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#70665C] mt-1">
            {forgottenCount}
          </div>
          <span className="text-[11px] text-[#A69D91] mt-0.5 block">Excluded from prompt context</span>
        </div>

        <div className="bg-white border border-[#E5E0D8] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#70665C] text-xs font-medium">
            <span>Excluded from AI</span>
            <ShieldAlert className="w-4 h-4 text-[#C27D60]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#C27D60] mt-1">
            {excludedCount}
          </div>
          <span className="text-[11px] text-[#C27D60] mt-0.5 block">Hard-blocked from retrieval</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-[#E5E0D8] rounded-2xl p-4 space-y-3 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A69D91]" />
            <input
              id="search-memories-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories, facts, categories, or reflection titles..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-[#FAF8F5] border border-[#E5E0D8] text-[#4A3E3E] placeholder-[#A69D91] focus:outline-none focus:ring-1 focus:ring-[#7A8D74] focus:border-[#7A8D74]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A69D91] hover:text-[#4A3E3E]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <Filter className="w-3.5 h-3.5 text-[#A69D91]" />
              <select
                id="select-memory-category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter memories by category"
                className="text-xs bg-[#FAF8F5] border border-[#E5E0D8] text-[#4A3E3E] rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#7A8D74]"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#F2EFE9] overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors shrink-0 ${
              statusFilter === 'all'
                ? 'bg-[#7A8D74] text-white'
                : 'bg-[#F5F2ED] text-[#70665C] hover:text-[#4A3E3E]'
            }`}
          >
            All Memories ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors shrink-0 ${
              statusFilter === 'active'
                ? 'bg-[#7A8D74] text-white'
                : 'bg-[#F5F2ED] text-[#70665C] hover:text-[#4A3E3E]'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('forgotten')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors shrink-0 ${
              statusFilter === 'forgotten'
                ? 'bg-[#7A8D74] text-white'
                : 'bg-[#F5F2ED] text-[#70665C] hover:text-[#4A3E3E]'
            }`}
          >
            Forgotten ({forgottenCount})
          </button>
          <button
            onClick={() => setStatusFilter('excluded')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors shrink-0 ${
              statusFilter === 'excluded'
                ? 'bg-[#7A8D74] text-white'
                : 'bg-[#F5F2ED] text-[#70665C] hover:text-[#4A3E3E]'
            }`}
          >
            Excluded ({excludedCount})
          </button>
        </div>
      </div>

      {/* Memory List */}
      <div className="space-y-4">
        {memoriesLoading ? (
          <div className="bg-white border border-[#E5E0D8] rounded-2xl p-12 text-center text-[#70665C] text-sm">
            <div className="w-8 h-8 border-2 border-[#7A8D74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading your stored memories...
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="bg-white border border-[#E5E0D8] rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#FAF8F5] text-[#A69D91] flex items-center justify-center mx-auto border border-[#E5E0D8]">
              <Brain className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-[#4A3E3E]">
              {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'No matching memories found'
                : 'No stored AI memories yet'}
            </h3>
            <p className="text-xs text-[#70665C] max-w-md mx-auto leading-relaxed">
              {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'Try adjusting your search query or status filter.'
                : 'As you reflect in your journal, Gemini can extract key facts, goals, and habits into this control center. You can also trigger memory extraction directly from any journal entry.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredMemories.map((mem) => {
              const isProcessing = isProcessingId === mem.id;
              const sourceEntry = entries.find((e) => e.id === mem.sourceId);
              const relatedThread = threads.find((t) => t.id === mem.threadId);

              return (
                <div
                  key={mem.id}
                  id={`memory-card-${mem.id}`}
                  className={`bg-white border rounded-2xl p-5 transition-all shadow-2xs space-y-4 ${
                    mem.status === 'active'
                      ? 'border-[#E5E0D8] hover:border-[#CAD7C7]'
                      : mem.status === 'excluded'
                      ? 'border-[#F2D0C3] bg-[#FDF9F8]'
                      : 'border-[#E5E0D8] opacity-80 bg-[#FAFAF9]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      {/* Status and Category badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        {mem.status === 'active' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-[#EAF2E8] text-[#55694F] px-2.5 py-0.5 rounded-full border border-[#CDE0C8]">
                            <CheckCircle2 className="w-3 h-3" /> Active in Context
                          </span>
                        )}
                        {mem.status === 'forgotten' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-[#F5F2ED] text-[#70665C] px-2.5 py-0.5 rounded-full border border-[#E5E0D8]">
                            <EyeOff className="w-3 h-3" /> Forgotten (Muted)
                          </span>
                        )}
                        {mem.status === 'excluded' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-[#F9ECE7] text-[#C27D60] px-2.5 py-0.5 rounded-full border border-[#F2D0C3]">
                            <ShieldAlert className="w-3 h-3" /> Excluded from AI
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#70665C] bg-[#FAF8F5] px-2 py-0.5 rounded-md border border-[#E5E0D8] capitalize">
                          {mem.category || 'General'}
                        </span>

                        {mem.hasEmbedding && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#7A8D74] bg-[#F4F7F3] px-2 py-0.5 rounded-md border border-[#D5E2D3]">
                            Vector Indexed
                          </span>
                        )}
                      </div>

                      {/* Fact statement */}
                      <p className="text-sm font-semibold text-[#4A3E3E] leading-relaxed pt-1">
                        "{mem.fact}"
                      </p>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                      {mem.status === 'active' ? (
                        <>
                          <button
                            id={`btn-forget-${mem.id}`}
                            onClick={() => handleForget(mem.id)}
                            disabled={isProcessing}
                            title="Mute this memory so Gemini will not retrieve it"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#FAF8F5] text-[#70665C] hover:text-[#4A3E3E] hover:bg-[#F2EFE9] border border-[#E5E0D8] transition-colors disabled:opacity-50"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Forget</span>
                          </button>

                          <button
                            id={`btn-exclude-${mem.id}`}
                            onClick={() => handleExclude(mem.id)}
                            disabled={isProcessing}
                            title="Exclude permanently from AI memory"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#FDF0EE] text-[#C27D60] hover:bg-[#F9DFDC] border border-[#F2D0C3] transition-colors disabled:opacity-50"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Exclude from AI</span>
                          </button>
                        </>
                      ) : (
                        <button
                          id={`btn-restore-${mem.id}`}
                          onClick={() => handleRestore(mem.id)}
                          disabled={isProcessing}
                          title="Restore memory to active context"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#EAF2E8] text-[#55694F] hover:bg-[#DCEAD9] border border-[#CDE0C8] transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore to Active</span>
                        </button>
                      )}

                      <button
                        id={`btn-delete-${mem.id}`}
                        onClick={() => setMemoryToDelete(mem)}
                        disabled={isProcessing}
                        title="Delete this memory and its embedding vector permanently"
                        className="p-2 text-[#A69D91] hover:text-[#C25E4A] hover:bg-[#FDF0EE] rounded-xl transition-colors border border-transparent hover:border-[#F3C5BD] disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Metadata: Source, Date, Thought Thread */}
                  <div className="flex flex-wrap items-center gap-y-2 gap-x-4 pt-3 border-t border-[#F2EFE9] text-xs text-[#70665C]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#A69D91]" />
                      <span>{formatDateTime(mem.createdAt)}</span>
                    </div>

                    {mem.sourceTitle && (
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[#7A8D74]" />
                        <span>Source:</span>
                        {sourceEntry ? (
                          <button
                            onClick={() => onSelectEntry(sourceEntry)}
                            className="font-medium text-[#4A3E3E] hover:text-[#7A8D74] underline flex items-center gap-1 max-w-[200px] truncate"
                          >
                            <span>{mem.sourceTitle}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="font-medium text-[#4A3E3E] max-w-[200px] truncate">
                            {mem.sourceTitle}
                          </span>
                        )}
                      </div>
                    )}

                    {(mem.threadTitle || relatedThread) && (
                      <div className="flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-[#7A8D74]" />
                        <span>Thread:</span>
                        {mem.threadId ? (
                          <button
                            onClick={() => onSelectThread(mem.threadId!)}
                            className="font-medium text-[#4A3E3E] hover:text-[#7A8D74] underline flex items-center gap-1 max-w-[200px] truncate"
                          >
                            <span>{mem.threadTitle || relatedThread?.title || 'Thought Thread'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="font-medium text-[#4A3E3E] max-w-[200px] truncate">
                            {mem.threadTitle}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal: Delete Individual Memory */}
      {memoryToDelete && (
        <div
          id="modal-delete-memory"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white rounded-2xl border border-[#E5E0D8] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FDF0EE] text-[#C25E4A] flex items-center justify-center shrink-0 border border-[#F3C5BD]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#4A3E3E]">
                  Delete Memory Permanently?
                </h3>
                <p className="text-xs text-[#70665C] leading-relaxed">
                  This memory and its semantic vector embedding will be permanently erased.
                </p>
              </div>
            </div>

            <div className="bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl p-3 text-xs text-[#4A3E3E] italic">
              "{memoryToDelete.fact}"
            </div>

            <div className="bg-[#F8FBF8] border border-[#D5E2D3] rounded-xl p-3 text-xs text-[#55694F] flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#7A8D74]" />
              <span>
                <strong>Zero Journal Loss Guarantee:</strong> Your original journal entry (
                <span className="font-semibold">{memoryToDelete.sourceTitle}</span>) will remain completely intact.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setMemoryToDelete(null)}
                disabled={Boolean(isProcessingId)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-[#70665C] hover:text-[#4A3E3E] hover:bg-[#FAF8F5] transition-colors"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-memory"
                onClick={handleExecuteDelete}
                disabled={Boolean(isProcessingId)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#C25E4A] text-white hover:bg-[#AF523F] transition-colors shadow-2xs disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete ALL Memories */}
      {confirmDeleteAllOpen && (
        <div
          id="modal-delete-all-memories"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white rounded-2xl border border-[#E5E0D8] max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FDF0EE] text-[#C25E4A] flex items-center justify-center shrink-0 border border-[#F3C5BD]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#4A3E3E]">
                  Delete All AI Memories?
                </h3>
                <p className="text-xs text-[#70665C] leading-relaxed">
                  This action will permanently purge all <span className="font-bold text-[#4A3E3E]">{memories.length}</span> stored memories and their associated embedding records for your account.
                </p>
              </div>
            </div>

            <div className="bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl p-3 text-xs text-[#70665C] space-y-2">
              <p className="font-semibold text-[#4A3E3E]">
                What happens when you confirm:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>All semantic memories will be permanently deleted from Firestore.</li>
                <li>All corresponding vector embedding records will be purged.</li>
                <li>Gemini will have zero long-term factual recall of past reflections.</li>
                <li className="font-bold text-[#55694F]">All your original journal entries and Thought Threads remain safe and unaffected.</li>
              </ul>
            </div>

            <div className="space-y-2 pt-1">
              <label htmlFor="delete-all-confirm-phrase" className="text-xs font-semibold text-[#4A3E3E] block">
                Type <span className="font-mono text-[#C25E4A] bg-[#FDF0EE] px-1 py-0.5 rounded">delete all memories</span> to confirm:
              </label>
              <input
                id="delete-all-confirm-phrase"
                type="text"
                value={confirmPhraseInput}
                onChange={(e) => setConfirmPhraseInput(e.target.value)}
                placeholder="delete all memories"
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF8F5] border border-[#E5E0D8] text-[#4A3E3E] focus:outline-none focus:ring-1 focus:ring-[#C25E4A] focus:border-[#C25E4A]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setConfirmDeleteAllOpen(false);
                  setConfirmPhraseInput('');
                }}
                disabled={isDeletingAll}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-[#70665C] hover:text-[#4A3E3E] hover:bg-[#FAF8F5] transition-colors"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-all-memories"
                onClick={handleExecuteDeleteAll}
                disabled={confirmPhraseInput.trim().toLowerCase() !== 'delete all memories' || isDeletingAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#C25E4A] text-white hover:bg-[#AF523F] transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingAll ? 'Deleting...' : 'Permanently Delete All'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
