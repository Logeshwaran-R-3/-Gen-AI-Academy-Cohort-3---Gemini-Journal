import React, { useState } from 'react';
import {
  Search,
  BookMarked,
  Tag,
  Trash2,
  Clock,
  Sparkles,
  MessageSquare,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { JournalEntry, JournalCategory } from '../types';

interface JournalListProps {
  entries: JournalEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  onNewEntry: () => void;
  loading: boolean;
}

const CATEGORIES: { label: string; value: JournalCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Reflections', value: 'reflection' },
  { label: 'Brainstorms', value: 'brainstorm' },
  { label: 'Gratitude', value: 'gratitude' },
  { label: 'Summaries', value: 'summary' },
  { label: 'General', value: 'general' },
];

export const JournalList: React.FC<JournalListProps> = ({
  entries,
  selectedEntryId,
  onSelectEntry,
  onDeleteEntry,
  onNewEntry,
  loading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<JournalCategory | 'all'>('all');

  // Filter entries based on search and category
  const filteredEntries = entries.filter((entry) => {
    const matchesCategory =
      selectedCategory === 'all' || entry.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesCategory;

    const matchesTitle = entry.title?.toLowerCase().includes(query);
    const matchesTags = entry.tags?.some((t) => t.toLowerCase().includes(query));
    const matchesSummary = entry.summary?.toLowerCase().includes(query);
    const matchesMessages = entry.messages?.some((m) =>
      m.content?.toLowerCase().includes(query)
    );

    return matchesCategory && (matchesTitle || matchesTags || matchesSummary || matchesMessages);
  });

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Recently';
    }
  };

  const getCategoryColor = (cat: JournalCategory) => {
    switch (cat) {
      case 'reflection':
        return 'bg-[#F5EFE6] text-[#7A6451] border-[#E5DACD]';
      case 'brainstorm':
        return 'bg-[#EAF0E8] text-[#55694F] border-[#D5E0D2]';
      case 'gratitude':
        return 'bg-[#F7EFE8] text-[#8C6B4B] border-[#E8DDD2]';
      case 'summary':
        return 'bg-[#EAE4DB] text-[#5C5248] border-[#DCD5C9]';
      default:
        return 'bg-[#F5F2ED] text-[#70665C] border-[#E5E0D8]';
    }
  };

  return (
    <aside
      id="journal-history-panel"
      className="w-full lg:w-84 xl:w-96 flex flex-col bg-[#F5F2ED] border-r border-[#E5E0D8] h-full shrink-0"
    >
      {/* Header & Search */}
      <div className="p-4 border-b border-[#E5E0D8] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#4A3E3E]">
            <BookMarked className="w-4 h-4 text-[#7A8D74]" />
            <h2 className="text-[11px] uppercase tracking-[0.15em] text-[#A69D91] font-bold">
              Reflections
            </h2>
          </div>
          <span className="text-[10px] uppercase font-semibold bg-[#EAE4DB] text-[#70665C] px-2 py-0.5 rounded-full border border-[#E5E0D8]">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A69D91]" />
          <input
            id="input-search-entries"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reflections, tags, dialogue..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E0D8] rounded-xl text-xs placeholder:text-[#A69D91] text-[#4A3E3E] focus:outline-none focus:ring-1 focus:ring-[#7A8D74] focus:border-[#7A8D74] transition-all shadow-2xs"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.value
                  ? 'bg-[#4A3E3E] text-white shadow-2xs'
                  : 'bg-[#EAE4DB] text-[#70665C] hover:bg-[#DFD8CD]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#E5E0D8]/40 p-2.5 space-y-1.5">
        {loading && (
          <div className="p-6 text-center text-xs text-[#A69D91]">
            <div className="w-5 h-5 border-2 border-[#E5E0D8] border-t-[#7A8D74] rounded-full animate-spin mx-auto mb-2" />
            Loading your reflections...
          </div>
        )}

        {!loading && filteredEntries.length === 0 && (
          <div className="p-8 text-center">
            <div className="w-10 h-10 rounded-full bg-[#EAE4DB] text-[#70665C] flex items-center justify-center mx-auto mb-3">
              <BookMarked className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-[#4A3E3E]">No reflections found</p>
            <p className="text-[11px] text-[#A69D91] mt-1 max-w-[180px] mx-auto">
              {searchQuery
                ? 'Try adjusting your search query or category filter'
                : 'Start your reflective conversation with Gemini'}
            </p>
            {!searchQuery && (
              <button
                onClick={onNewEntry}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#7A8D74] hover:bg-[#687963] px-3.5 py-1.5 rounded-full shadow-xs transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Write First Reflection
              </button>
            )}
          </div>
        )}

        {filteredEntries.map((entry) => {
          const isSelected = entry.id === selectedEntryId;
          const msgCount = entry.messages?.length || 0;
          const lastMsg = entry.messages?.[entry.messages.length - 1];

          return (
            <div
              key={entry.id}
              id={`entry-item-${entry.id}`}
              onClick={() => onSelectEntry(entry)}
              className={`group relative p-3 rounded-xl cursor-pointer transition-all ${
                isSelected
                  ? 'bg-white border border-[#E5E0D8] shadow-sm'
                  : 'hover:bg-[#EAE4DB] border border-transparent text-[#70665C]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3
                  className={`text-xs ${
                    isSelected
                      ? 'text-[#4A3E3E] font-semibold'
                      : 'text-[#4A3E3E] font-medium'
                  } line-clamp-1`}
                >
                  {entry.title || 'Untitled Reflection'}
                </h3>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Delete this reflection entry permanently?')) {
                      onDeleteEntry(entry.id);
                    }
                  }}
                  title="Delete entry"
                  className="opacity-0 group-hover:opacity-100 text-[#A69D91] hover:text-rose-700 transition-opacity p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Snippet / preview */}
              <p className="text-[11px] text-[#70665C] line-clamp-2 mt-1 leading-normal">
                {entry.summary || lastMsg?.content || 'No conversation logged yet.'}
              </p>

              {/* Metadata row */}
              <div className="flex items-center justify-between mt-2 pt-1.5 text-[10px] text-[#A69D91] border-t border-[#E5E0D8]/60">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-medium capitalize ${getCategoryColor(
                      entry.category
                    )}`}
                  >
                    {entry.category}
                  </span>
                  {entry.excludedFromAI && (
                    <span
                      title="Excluded from AI memory"
                      className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-[#C27D60] bg-[#FDF0EE] px-1.5 py-0.2 rounded border border-[#F2D0C3]"
                    >
                      <ShieldAlert className="w-2.5 h-2.5" />
                      AI Muted
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {msgCount > 0 && (
                    <span className="flex items-center gap-1 text-[#70665C]">
                      <MessageSquare className="w-3 h-3" />
                      {msgCount}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[#A69D91]">
                    <Clock className="w-3 h-3" />
                    {formatDate(entry.updatedAt || entry.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
