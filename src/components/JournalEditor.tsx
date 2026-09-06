import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Sparkles,
  FileText,
  Lightbulb,
  Tag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RotateCw,
  GitBranch,
  ExternalLink,
  HelpCircle,
  History,
  Target,
  FileEdit,
  XCircle,
  Brain,
  Shield,
  ShieldAlert,
} from 'lucide-react';
import {
  JournalEntry,
  JournalMessage,
  JournalCategory,
  ThoughtThread,
  UnfinishedThought,
  PerspectiveReplay,
  ActionExperiment,
  ActionExperimentStatus,
  AIMemory,
} from '../types';
import { ErrorBanner } from './ErrorBanner';

interface JournalEditorProps {
  entry: JournalEntry;
  onSaveEntry: (updatedEntry: JournalEntry) => Promise<void>;
  saving: boolean;
  saveError: string | null;
  onClearSaveError: () => void;
  connectedThread?: ThoughtThread | null;
  onViewThread?: (threadId: string) => void;
  onTriggerThreadAnalysis?: (entry: JournalEntry) => Promise<void>;
  isAnalyzingThread?: boolean;
  relatedUnfinishedThought?: UnfinishedThought | null;
  onMarkThoughtResolved?: (thoughtId: string) => Promise<void>;
  onOpenPerspectiveReplay?: (entry: JournalEntry) => void;
  entryReplays?: PerspectiveReplay[];
  relatedActions?: ActionExperiment[];
  onUpdateActionStatus?: (
    actionId: string,
    status: ActionExperimentStatus,
    extraUpdates?: Partial<ActionExperiment>
  ) => Promise<void>;
  onNavigateToActions?: () => void;
  activeMemories?: AIMemory[];
  onToggleEntryAIExclusion?: (entryId: string, excluded: boolean) => Promise<void>;
  onExtractMemories?: (entry: JournalEntry) => Promise<void>;
  isExtractingMemories?: boolean;
  onOpenMemoryControlCenter?: () => void;
}

const CATEGORY_OPTIONS: { label: string; value: JournalCategory }[] = [
  { label: 'Reflection', value: 'reflection' },
  { label: 'Brainstorm', value: 'brainstorm' },
  { label: 'Gratitude', value: 'gratitude' },
  { label: 'Summary', value: 'summary' },
  { label: 'General', value: 'general' },
];

const SUGGESTED_TAGS = ['Mindfulness', 'Career', 'Personal Growth', 'Decision Making', 'Gratitude', 'Creativity'];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  entry,
  onSaveEntry,
  saving,
  saveError,
  onClearSaveError,
  connectedThread,
  onViewThread,
  onTriggerThreadAnalysis,
  isAnalyzingThread = false,
  relatedUnfinishedThought,
  onMarkThoughtResolved,
  onOpenPerspectiveReplay,
  entryReplays = [],
  relatedActions = [],
  onUpdateActionStatus,
  onNavigateToActions,
  activeMemories = [],
  onToggleEntryAIExclusion,
  onExtractMemories,
  isExtractingMemories = false,
  onOpenMemoryControlCenter,
}) => {
  const [title, setTitle] = useState(entry.title);
  const [category, setCategory] = useState<JournalCategory>(entry.category);
  const [tags, setTags] = useState<string[]>(entry.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Sync state if entry changes
  useEffect(() => {
    setTitle(entry.title);
    setCategory(entry.category);
    setTags(entry.tags || []);
    setGenerationError(null);
  }, [entry.id]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entry.messages, generating]);

  // Handle Title change & blur auto-save
  const handleTitleBlur = async () => {
    const trimmed = title.trim() || 'Untitled Reflection';
    if (trimmed !== entry.title) {
      await onSaveEntry({
        ...entry,
        title: trimmed,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Handle Category change
  const handleCategoryChange = async (newCategory: JournalCategory) => {
    setCategory(newCategory);
    await onSaveEntry({
      ...entry,
      category: newCategory,
      updatedAt: new Date().toISOString(),
    });
  };

  // Add / Remove Tag
  const handleAddTag = async (tagToAdd: string) => {
    const cleanTag = tagToAdd.trim();
    if (!cleanTag || tags.includes(cleanTag)) return;
    const updatedTags = [...tags, cleanTag].slice(0, 10);
    setTags(updatedTags);
    setNewTagInput('');
    await onSaveEntry({
      ...entry,
      tags: updatedTags,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedTags = tags.filter((t) => t !== tagToRemove);
    setTags(updatedTags);
    await onSaveEntry({
      ...entry,
      tags: updatedTags,
      updatedAt: new Date().toISOString(),
    });
  };

  // Send turn to Gemini: multi-turn reflection
  const handleSendPrompt = async () => {
    const trimmedPrompt = promptInput.trim();
    if (!trimmedPrompt || generating) return;

    setGenerating(true);
    setGenerationError(null);

    const userMessage: JournalMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: trimmedPrompt,
      timestamp: new Date().toISOString(),
    };

    // Keep backup in case save or generation fails
    const originalInput = trimmedPrompt;

    try {
      // Call server endpoint
      const response = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          history: entry.messages,
          title: title.trim() || 'Personal Reflection',
          category,
          memories: entry.excludedFromAI ? [] : activeMemories,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage: JournalMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: data.text,
        timestamp: new Date().toISOString(),
        modelUsed: data.modelUsed,
      };

      const updatedMessages = [...(entry.messages || []), userMessage, assistantMessage];

      // Auto-derive title if currently untitled
      let updatedTitle = title;
      if (!title || title === 'Untitled Reflection' || title === 'New Reflection') {
        updatedTitle = trimmedPrompt.slice(0, 45).replace(/\n/g, ' ') + (trimmedPrompt.length > 45 ? '...' : '');
        setTitle(updatedTitle);
      }

      const updatedEntryToSave: JournalEntry = {
        ...entry,
        title: updatedTitle,
        category,
        tags,
        messages: updatedMessages,
        updatedAt: new Date().toISOString(),
      };

      // Save complete transaction to Firestore
      await onSaveEntry(updatedEntryToSave);

      // Clear input only upon successful completion
      setPromptInput('');

      // Auto-analyze thought thread in background if not already connected
      if (!entry.threadId && onTriggerThreadAnalysis) {
        onTriggerThreadAnalysis(updatedEntryToSave).catch((err) => {
          console.warn('Auto-thread analysis notice:', err);
        });
      }
    } catch (err: any) {
      console.error('Error in reflection generation or persistence:', err);
      setGenerationError(err.message || 'Failed to complete reflection turn. Your input was retained.');
      // Keep promptInput as is so user doesn't lose thoughts!
    } finally {
      setGenerating(false);
    }
  };

  // Summarize Entry action
  const handleGenerateSummary = async () => {
    if ((!entry.messages || entry.messages.length === 0) && !promptInput.trim()) {
      setGenerationError('Please write an entry or converse with Gemini before requesting a summary.');
      return;
    }

    setGenerating(true);
    setGenerationError(null);

    try {
      const response = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Reflection Entry',
          content: promptInput,
          messages: entry.messages || [],
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate summary.');
      }

      const data = await response.json();
      const updatedEntry: JournalEntry = {
        ...entry,
        summary: data.summary,
        updatedAt: new Date().toISOString(),
      };
      await onSaveEntry(updatedEntry);

      // Automatically determine Thought Thread relationship
      if (onTriggerThreadAnalysis) {
        onTriggerThreadAnalysis(updatedEntry).catch((err) => {
          console.warn('Auto-thread analysis notice:', err);
        });
      }
    } catch (err: any) {
      console.error('Summary error:', err);
      setGenerationError(err.message || 'Failed to generate summary.');
    } finally {
      setGenerating(false);
    }
  };

  // Brainstorm Prompts action
  const handleBrainstormPrompts = async () => {
    setGenerating(true);
    setGenerationError(null);

    try {
      const response = await fetch('/api/gemini/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: category,
          context: title + (entry.messages?.length ? `\nLast thought: ${entry.messages[entry.messages.length - 1].content}` : ''),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate prompts.');
      }

      const data = await response.json();
      const assistantMessage: JournalMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: `### 💡 Thoughtful Brainstorming Angles\n\n${data.prompts}`,
        timestamp: new Date().toISOString(),
        modelUsed: data.modelUsed,
      };

      await onSaveEntry({
        ...entry,
        messages: [...(entry.messages || []), assistantMessage],
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Brainstorm error:', err);
      setGenerationError(err.message || 'Failed to generate brainstorming angles.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopySummary = () => {
    if (!entry.summary) return;
    navigator.clipboard.writeText(entry.summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <main
      id="journal-editor-panel"
      className="flex-1 flex flex-col h-full bg-[#FDFCF8] overflow-hidden relative"
    >
      {/* Top Header Bar */}
      <div className="bg-white border-b border-[#E5E0D8] px-6 py-4 space-y-3 shrink-0">
        {/* Title & Save status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <input
            id="input-entry-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Reflection Title..."
            className="text-lg sm:text-xl font-serif italic font-medium text-[#4A3E3E] bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-[#A69D91] w-full"
          />

          {/* Persistence status */}
          <div className="flex items-center gap-2 shrink-0 text-xs">
            {saving ? (
              <span className="flex items-center gap-1.5 text-[#70665C]">
                <RotateCw className="w-3.5 h-3.5 animate-spin text-[#7A8D74]" />
                Saving to Firestore...
              </span>
            ) : saveError ? (
              <span className="flex items-center gap-1 text-rose-700 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Save Failed
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[#55694F]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#7A8D74]" />
                Saved in Firestore
              </span>
            )}
          </div>
        </div>

        {/* Categories and Tags Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          {/* Category Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[#70665C] font-medium">Category:</span>
            <select
              id="select-entry-category"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as JournalCategory)}
              className="bg-[#F5F2ED] hover:bg-[#EAE4DB] border border-[#E5E0D8] rounded-xl px-3 py-1 text-xs font-medium text-[#4A3E3E] focus:outline-none focus:ring-1 focus:ring-[#7A8D74] cursor-pointer transition-colors capitalize shadow-2xs"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action quick-buttons: Summarize, Brainstorm, & Replay */}
          <div className="flex items-center gap-2">
            {onOpenPerspectiveReplay && (
              <button
                id="btn-replay-thought-header"
                onClick={() => onOpenPerspectiveReplay(entry)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D2DCBE] bg-[#F2F7EF] hover:bg-[#E8F0E4] text-[#55694F] font-semibold text-xs shadow-2xs transition-colors"
                title="Revisit this reflection from your current perspective"
              >
                <History className="w-3.5 h-3.5 text-[#7A8D74]" />
                <span>Replay this thought</span>
                {entryReplays.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 bg-[#D2DCBE] text-[#55694F] rounded-full text-[10px] font-bold">
                    {entryReplays.length}
                  </span>
                )}
              </button>
            )}

            {/* Thought Thread Association Status / Trigger */}
            {connectedThread ? (
              <button
                id="btn-view-connected-thread"
                onClick={() => onViewThread && onViewThread(connectedThread.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D5CDC2] bg-[#F5F2ED] hover:bg-[#EAE4DB] text-[#4A3E3E] font-medium text-xs shadow-2xs transition-colors"
                title="View this reflection's Thought Thread timeline"
              >
                <GitBranch className="w-3.5 h-3.5 text-[#7A8D74]" />
                <span className="max-w-[130px] truncate">Thread: {connectedThread.title}</span>
                <ExternalLink className="w-3 h-3 text-[#A69D91]" />
              </button>
            ) : (
              <button
                id="btn-map-entry-thread"
                onClick={() => onTriggerThreadAnalysis && onTriggerThreadAnalysis(entry)}
                disabled={isAnalyzingThread || saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D5CDC2] bg-white hover:bg-[#F5F2ED] text-[#70665C] hover:text-[#4A3E3E] font-medium text-xs shadow-2xs transition-colors disabled:opacity-50"
                title="Analyze and map this reflection to an existing or new Thought Thread"
              >
                <GitBranch className={`w-3.5 h-3.5 text-[#7A8D74] ${isAnalyzingThread ? 'animate-spin' : ''}`} />
                <span>{isAnalyzingThread ? 'Mapping Thread...' : 'Map to Thought Thread'}</span>
              </button>
            )}

            <button
              id="btn-summarize-entry"
              onClick={handleGenerateSummary}
              disabled={generating}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#E5E0D8] bg-white hover:bg-[#F5F2ED] text-[#4A3E3E] font-medium text-xs shadow-2xs transition-colors disabled:opacity-50"
              title="Generate summary and key takeaways"
            >
              <FileText className="w-3.5 h-3.5 text-[#7A8D74]" />
              <span>Summarize Entry</span>
            </button>

            <button
              id="btn-brainstorm-prompts"
              onClick={handleBrainstormPrompts}
              disabled={generating}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#E5E0D8] bg-white hover:bg-[#F5F2ED] text-[#4A3E3E] font-medium text-xs shadow-2xs transition-colors disabled:opacity-50"
              title="Generate fresh brainstorming angles"
            >
              <Lightbulb className="w-3.5 h-3.5 text-[#7A8D74]" />
              <span>Brainstorm Angles</span>
            </button>

            {/* AI Memory Extraction Button */}
            {onExtractMemories && !entry.excludedFromAI && (
              <button
                id="btn-extract-memories"
                onClick={() => onExtractMemories(entry)}
                disabled={isExtractingMemories || generating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D5E2D3] bg-[#F4F7F3] hover:bg-[#EAF2E8] text-[#55694F] font-semibold text-xs shadow-2xs transition-colors disabled:opacity-50"
                title="Extract and store key facts from this reflection into AI Memory"
              >
                <Brain className="w-3.5 h-3.5 text-[#7A8D74]" />
                <span>{isExtractingMemories ? 'Extracting Memory...' : 'Extract Memory'}</span>
              </button>
            )}

            {/* Exclude from AI Memory Toggle Button */}
            {onToggleEntryAIExclusion && (
              <button
                id="btn-toggle-ai-exclusion"
                onClick={() => onToggleEntryAIExclusion(entry.id, !entry.excludedFromAI)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-2xs transition-colors border ${
                  entry.excludedFromAI
                    ? 'border-[#F2D0C3] bg-[#FDF0EE] hover:bg-[#F9DFDC] text-[#C27D60]'
                    : 'border-[#E5E0D8] bg-white hover:bg-[#FAF8F5] text-[#70665C] hover:text-[#C27D60]'
                }`}
                title={
                  entry.excludedFromAI
                    ? 'This entry is excluded from AI memory. Click to re-allow AI memory.'
                    : 'Exclude this entry from AI memory extraction and retrieval'
                }
              >
                {entry.excludedFromAI ? (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-[#C27D60]" />
                    <span>Excluded from AI</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-3.5 h-3.5 text-[#7A8D74]" />
                    <span>Exclude from AI</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tags bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <Tag className="w-3 h-3 text-[#A69D91] mr-1" />
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 bg-[#F5F2ED] text-[#70665C] px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-[#E5E0D8]"
            >
              #{tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="text-[#A69D91] hover:text-[#4A3E3E] ml-0.5"
              >
                &times;
              </button>
            </span>
          ))}

          {tags.length < 5 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddTag(newTagInput);
              }}
              className="inline-flex items-center"
            >
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="+ tag"
                className="w-16 px-1.5 py-0.5 text-[11px] bg-transparent border-b border-dashed border-[#E5E0D8] focus:outline-none focus:border-[#7A8D74] text-[#4A3E3E] placeholder:text-[#A69D91]"
              />
            </form>
          )}

          {tags.length === 0 && (
            <div className="flex items-center gap-1 text-[11px] text-[#A69D91]">
              Suggested:
              {SUGGESTED_TAGS.slice(0, 3).map((st) => (
                <button
                  key={st}
                  onClick={() => handleAddTag(st)}
                  className="hover:text-[#7A8D74] underline decoration-dotted ml-1"
                >
                  +{st}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error Banners */}
      {(saveError || generationError) && (
        <div className="px-6 pt-3">
          {saveError && (
            <ErrorBanner
              id="save-error-banner"
              title="Database Persistence Error"
              message={saveError}
              onRetry={() => onSaveEntry(entry)}
              onDismiss={onClearSaveError}
            />
          )}
          {generationError && (
            <ErrorBanner
              id="gen-error-banner"
              title="Gemini Reflection Notice"
              message={generationError}
              onDismiss={() => setGenerationError(null)}
            />
          )}
        </div>
      )}

      {/* Main Conversation & Reflection Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Unfinished Thought Context Banner (if exploring an unresolved thought) */}
        {relatedUnfinishedThought && (
          <div
            id="unfinished-thought-active-banner"
            className="bg-[#FAF8F5] border border-[#ECD1C8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#F9ECE7] text-[#C27D60] flex items-center justify-center shrink-0 mt-0.5">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#C27D60]">
                    Exploring Unfinished Thought
                  </span>
                  <span className="font-serif italic font-semibold text-[#4A3E3E] text-sm">
                    {relatedUnfinishedThought.title}
                  </span>
                </div>
                <p className="text-[#70665C] mt-1 leading-relaxed">
                  {relatedUnfinishedThought.whyUnfinished}
                </p>
              </div>
            </div>
            {onMarkThoughtResolved && relatedUnfinishedThought.status !== 'resolved' && (
              <button
                id="btn-resolve-current-thought"
                onClick={() => onMarkThoughtResolved(relatedUnfinishedThought.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-[#55694F] border border-[#D2DCBE] hover:bg-[#F2F7EF] font-semibold text-xs transition-colors shrink-0 shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#7A8D74]" />
                <span>Mark as Resolved</span>
              </button>
            )}
          </div>
        )}

        {/* Gemini Summary Box (if generated) */}
        {entry.summary && (
          <div
            id="entry-summary-card"
            className="bg-white border border-[#E5E0D8] rounded-2xl p-5 sm:p-6 shadow-xs transition-all relative group"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D8]/80 mb-3">
              <div className="flex items-center gap-2 text-[#7A8D74] font-serif italic font-semibold text-xs tracking-wide uppercase">
                <Sparkles className="w-4 h-4 text-[#7A8D74]" />
                <span>Gemini Reflection Synthesis</span>
              </div>
              <button
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1 text-xs text-[#70665C] hover:text-[#4A3E3E] p-1 rounded-md transition-colors"
                title="Copy summary"
              >
                {copiedSummary ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#7A8D74]" />
                    <span className="text-[11px] text-[#7A8D74]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="prose prose-sm prose-stone max-w-none text-[#5C5248] text-xs sm:text-sm leading-relaxed">
              <ReactMarkdown>{entry.summary}</ReactMarkdown>
            </div>

            {/* Thought Thread Integration Status */}
            <div className="mt-4 pt-3 border-t border-[#E5E0D8]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              {connectedThread ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[#70665C]">Associated Thought Thread:</span>
                    <span className="font-serif italic font-semibold text-[#4A3E3E] bg-[#F5F2ED] px-2.5 py-0.5 rounded-full border border-[#E5E0D8]">
                      {connectedThread.title}
                    </span>
                  </div>
                  {onViewThread && (
                    <button
                      onClick={() => onViewThread(connectedThread.id)}
                      className="inline-flex items-center gap-1 text-[#7A8D74] hover:text-[#55694F] font-semibold text-xs transition-colors"
                    >
                      <span>View Thread Evolution ({connectedThread.entryCount} {connectedThread.entryCount === 1 ? 'entry' : 'entries'})</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-[#A69D91]">
                    <GitBranch className="w-3.5 h-3.5 text-[#7A8D74]" />
                    <span>Thought Thread: Unlinked</span>
                  </div>
                  {onTriggerThreadAnalysis && (
                    <button
                      onClick={() => onTriggerThreadAnalysis(entry)}
                      disabled={isAnalyzingThread}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#7A8D74] hover:underline disabled:opacity-50"
                    >
                      <RotateCw className={`w-3 h-3 ${isAnalyzingThread ? 'animate-spin' : ''}`} />
                      <span>{isAnalyzingThread ? 'Classifying Thread...' : 'Connect to Thought Thread'}</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Perspective Replay Callout */}
        {onOpenPerspectiveReplay && (
          <div
            id="replay-thought-callout"
            className="bg-white border border-[#E5E0D8] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#F2F7EF] text-[#7A8D74] flex items-center justify-center shrink-0">
                <History className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif italic font-semibold text-[#4A3E3E] text-xs">
                    Perspective Replay
                  </span>
                  {entryReplays.length > 0 && (
                    <span className="text-[10px] text-[#55694F] bg-[#F2F7EF] px-2 py-0.5 rounded-full font-medium border border-[#D2DCBE]">
                      {entryReplays.length} past {entryReplays.length === 1 ? 'replay' : 'replays'}
                    </span>
                  )}
                </div>
                <p className="text-[#70665C] text-xs mt-0.5">
                  Revisit this reflection to compare what you thought then with what you think now.
                </p>
              </div>
            </div>
            <button
              id="btn-replay-thought-callout"
              onClick={() => onOpenPerspectiveReplay(entry)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#7A8D74] text-white hover:bg-[#687963] font-semibold text-xs transition-colors shadow-2xs shrink-0"
            >
              <History className="w-3.5 h-3.5" />
              <span>Replay this thought</span>
            </button>
          </div>
        )}

        {/* Action Experiment Status Callout (When journaling on the same topic) */}
        {relatedActions.length > 0 && (
          <div
            id="related-actions-callout"
            className="bg-white border border-[#E5E0D8] rounded-2xl p-4 shadow-2xs space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E5E0D8]/60">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#EAF2E8] text-[#7A8D74] flex items-center justify-center shrink-0">
                  <Target className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif italic font-semibold text-[#4A3E3E] text-xs">
                      Insight → Action Status for this Topic
                    </span>
                    <span className="text-[10px] font-semibold bg-[#EAF2E8] text-[#55694F] px-2 py-0.5 rounded-full border border-[#D5E3D1]">
                      {relatedActions.length} {relatedActions.length === 1 ? 'experiment' : 'experiments'}
                    </span>
                  </div>
                  <p className="text-[#70665C] text-[11px] mt-0.5">
                    Manual progress control: AI never automatically marks actions completed based on inference.
                  </p>
                </div>
              </div>

              {onNavigateToActions && (
                <button
                  onClick={onNavigateToActions}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#7A8D74] hover:text-[#55694F] shrink-0"
                >
                  <span>View All Actions</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* List of related actions with quick status buttons */}
            <div className="space-y-2.5">
              {relatedActions.map((act) => (
                <div
                  key={act.id}
                  className="p-3 bg-[#FDFCF8] rounded-xl border border-[#E5E0D8] text-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold text-[#4A3E3E]">
                      Experiment: {act.changedExperimentText || act.experiment}
                    </span>
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
                      {act.status === 'completed' && <Check className="w-2.5 h-2.5" />}
                      {act.status === 'changed' && <FileEdit className="w-2.5 h-2.5" />}
                      {act.status === 'abandoned' && <XCircle className="w-2.5 h-2.5" />}
                      <span className="capitalize">{act.status.replace('_', ' ')}</span>
                    </span>
                  </div>

                  <p className="text-[#70665C] italic text-[11px]">
                    Insight: &ldquo;{act.insight}&rdquo;
                  </p>

                  {/* Manual Status Buttons */}
                  {onUpdateActionStatus && (
                    <div className="pt-1.5 flex items-center gap-1.5 flex-wrap text-[11px]">
                      <span className="text-[#A69D91]">Update experiment outcome:</span>
                      {act.status !== 'completed' && (
                        <button
                          onClick={() => onUpdateActionStatus(act.id, 'completed', { completedAt: new Date().toISOString() })}
                          className="px-2 py-0.5 rounded-full bg-[#EBF3FA] text-[#3D688D] hover:bg-[#D0E2F2] font-semibold border border-[#D0E2F2] transition-colors"
                        >
                          Mark Completed
                        </button>
                      )}
                      {act.status !== 'changed' && (
                        <button
                          onClick={() => {
                            const newText = window.prompt('How did you modify this experiment?', act.changedExperimentText || act.experiment);
                            if (newText && newText.trim()) {
                              onUpdateActionStatus(act.id, 'changed', { changedExperimentText: newText.trim() });
                            }
                          }}
                          className="px-2 py-0.5 rounded-full bg-[#FDF6E2] text-[#916E28] hover:bg-[#F5E6B8] font-semibold border border-[#F5E6B8] transition-colors"
                        >
                          Mark Changed
                        </button>
                      )}
                      {act.status !== 'abandoned' && (
                        <button
                          onClick={() => {
                            const reason = window.prompt('Why was this experiment set aside/abandoned? (optional)');
                            onUpdateActionStatus(act.id, 'abandoned', reason ? { notes: (act.notes ? act.notes + '\n' : '') + `Abandoned: ${reason}` } : undefined);
                          }}
                          className="px-2 py-0.5 rounded-full bg-[#F5F2ED] text-[#70665C] hover:bg-[#EAE4DB] font-medium border border-[#E5E0D8] transition-colors"
                        >
                          Mark Abandoned
                        </button>
                      )}
                      {(act.status === 'completed' || act.status === 'abandoned' || act.status === 'changed') && (
                        <button
                          onClick={() => onUpdateActionStatus(act.id, 'in_progress')}
                          className="px-2 py-0.5 rounded-full bg-[#EAF2E8] text-[#55694F] hover:bg-[#D5E3D1] font-medium border border-[#D5E3D1] transition-colors"
                        >
                          Reopen (In Progress)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state when no conversation turns exist */}
        {(!entry.messages || entry.messages.length === 0) && (
          <div className="text-center py-12 px-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#EAE4DB] text-[#7A8D74] flex items-center justify-center mx-auto mb-4 shadow-2xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-serif italic font-semibold text-[#4A3E3E]">
              Start your reflective journey
            </h3>
            <p className="text-xs text-[#70665C] mt-2 leading-relaxed">
              Pour out what's on your mind today—a breakthrough, a lingering tension, or an unresolved decision. Gemini will listen and provide constructive perspective.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setPromptInput('Today I was reflecting on what truly energizes me...')}
                className="text-xs text-[#70665C] bg-white hover:bg-[#F5F2ED] border border-[#E5E0D8] px-3.5 py-2 rounded-xl transition-colors text-left shadow-2xs"
              >
                "What truly energizes me..."
              </button>
              <button
                onClick={() => setPromptInput('I need to make a difficult decision regarding...')}
                className="text-xs text-[#70665C] bg-white hover:bg-[#F5F2ED] border border-[#E5E0D8] px-3.5 py-2 rounded-xl transition-colors text-left shadow-2xs"
              >
                "A difficult decision regarding..."
              </button>
            </div>
          </div>
        )}

        {/* Conversation Dialogue */}
        {entry.messages?.map((message) => {
          const isUser = message.role === 'user';

          return (
            <div
              key={message.id}
              className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {/* Gemini Avatar */}
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-[#7A8D74] text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}

              {/* Message Content Bubble */}
              <div
                className={`max-w-2xl rounded-t-[24px] p-5 shadow-xs ${
                  isUser
                    ? 'bg-[#E8DCCA] text-[#4A3E3E] rounded-bl-[24px]'
                    : 'bg-white border border-[#E5E0D8] text-[#5C5248] rounded-br-[24px]'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2 text-[11px]">
                  <span
                    className={`font-semibold ${
                      isUser ? 'text-[#70665C]' : 'font-serif italic text-[#7A8D74] text-xs'
                    }`}
                  >
                    {isUser ? 'You' : 'Gemini Reflection'}
                  </span>

                  <div className="flex items-center gap-2 opacity-80 text-[10px]">
                    {message.modelUsed && !isUser && (
                      <span className="bg-[#EAF0E8] text-[#55694F] border border-[#D5E0D2] px-2 py-0.5 rounded-full text-[10px] font-medium">
                        {message.modelUsed}
                      </span>
                    )}
                    <span className="text-[#A69D91]">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div
                  className={`text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'whitespace-pre-wrap text-[#4A3E3E]'
                      : 'prose prose-sm prose-stone max-w-none text-[#5C5248]'
                  }`}
                >
                  {isUser ? (
                    message.content
                  ) : (
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  )}
                </div>
              </div>

              {/* User Avatar Placeholder */}
              {isUser && (
                <div className="w-8 h-8 rounded-full bg-[#A69D91] text-white flex items-center justify-center shrink-0 mt-1 text-xs font-semibold shadow-xs">
                  Y
                </div>
              )}
            </div>
          );
        })}

        {/* In-flight loading animation */}
        {generating && (
          <div className="flex gap-3 sm:gap-4 justify-start">
            <div className="w-8 h-8 rounded-full bg-[#7A8D74] text-white flex items-center justify-center shrink-0 mt-1 animate-pulse shadow-xs">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-[#E5E0D8] rounded-t-[24px] rounded-br-[24px] p-4 shadow-xs flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-[#7A8D74] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[#70665C] font-medium">
                Gemini is contemplating your thoughts...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Prompt Input Dock */}
      <div className="p-4 sm:p-6 bg-[#FDFCF8] border-t border-[#E5E0D8] shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col gap-2.5">
          {/* AI Memory Exclusion or Context Status Notice */}
          {entry.excludedFromAI ? (
            <div
              id="notice-entry-ai-excluded"
              className="flex items-center justify-between text-xs text-[#C27D60] bg-[#FDF0EE] border border-[#F2D0C3] rounded-2xl px-4 py-2 shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Excluded from AI Memory:</strong> Gemini is blocked from accessing long-term context or remembering this reflection.
                </span>
              </div>
              {onToggleEntryAIExclusion && (
                <button
                  onClick={() => onToggleEntryAIExclusion(entry.id, false)}
                  className="font-semibold underline hover:text-[#A84835] shrink-0 text-xs"
                >
                  Re-include in AI
                </button>
              )}
            </div>
          ) : (
            activeMemories.length > 0 && (
              <div
                id="notice-entry-ai-memories-active"
                className="flex items-center justify-between text-xs text-[#55694F] bg-[#F4F7F3] border border-[#D5E2D3] rounded-2xl px-4 py-2 shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[#7A8D74] shrink-0" />
                  <span>
                    Reflection context informed by <strong>{activeMemories.length}</strong> user-approved long-term memories.
                  </span>
                </div>
                {onOpenMemoryControlCenter && (
                  <button
                    onClick={onOpenMemoryControlCenter}
                    className="font-semibold text-[#7A8D74] hover:text-[#55694F] underline shrink-0 text-xs"
                  >
                    Memory Center →
                  </button>
                )}
              </div>
            )
          )}

          <div className="relative bg-white border border-[#E5E0D8] rounded-[28px] p-3.5 sm:p-4 focus-within:ring-2 focus-within:ring-[#7A8D74] focus-within:border-[#7A8D74] shadow-2xs transition-all">
            <textarea
              id="textarea-reflection-input"
              rows={3}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSendPrompt();
                }
              }}
              placeholder="Write your reflection, emotion, or question... (Press Cmd+Enter to send)"
              className="w-full bg-transparent resize-none border-none text-xs sm:text-sm text-[#4A3E3E] placeholder:text-[#A69D91] focus:outline-none focus:ring-0"
            />

            <div className="flex items-center justify-between pt-2 border-t border-[#E5E0D8]/60 mt-1">
              <span className="text-[11px] text-[#A69D91]">
                Shift + Enter for new line • Protected by user Firestore isolation
              </span>

              <button
                id="btn-send-reflection"
                onClick={handleSendPrompt}
                disabled={generating || !promptInput.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#4A3E3E] hover:bg-[#332B2B] text-white font-medium text-xs shadow-xs active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{generating ? 'Reflecting...' : 'Reflect with Gemini'}</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
