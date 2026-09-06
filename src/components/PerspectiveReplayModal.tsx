import React, { useState } from 'react';
import {
  History,
  X,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Send,
  Calendar,
  HelpCircle,
  RotateCw,
  BookOpen,
  ChevronRight,
  Scale,
  Compass,
} from 'lucide-react';
import { JournalEntry, JournalMessage, PerspectiveReplay, ThoughtThread } from '../types';
import { auth } from '../firebase';

interface PerspectiveReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalEntry: JournalEntry;
  connectedThread?: ThoughtThread | null;
  onSaveReplay: (replay: PerspectiveReplay, createAsJournalEntry?: boolean) => Promise<void>;
  existingReplays?: PerspectiveReplay[];
}

const DEFAULT_QUESTIONS = [
  'Do you still think this way?',
  'What has changed since then?',
  'Would you make the same decision today?',
];

export const PerspectiveReplayModal: React.FC<PerspectiveReplayModalProps> = ({
  isOpen,
  onClose,
  originalEntry,
  connectedThread,
  onSaveReplay,
  existingReplays = [],
}) => {
  if (!isOpen) return null;

  const [selectedQuestion, setSelectedQuestion] = useState(DEFAULT_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [userResponse, setUserResponse] = useState('');
  const [messages, setMessages] = useState<JournalMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isConversing, setIsConversing] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<{
    originalPerspective: string;
    currentPerspective: string;
    whatChanged: string;
    whatStayedConsistent: string;
    possibleReasons: string;
    newInsight?: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

  const activeQuestion = customQuestion.trim() || selectedQuestion;
  const originalSummaryText =
    originalEntry.summary ||
    (originalEntry.messages?.length > 0 ? originalEntry.messages[0].content : 'No summary available.');

  const formattedDate = new Date(originalEntry.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Natural chat turn with Gemini during replay
  const handleSendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || isConversing) return;

    const userMsg: JournalMessage = {
      id: `replay-msg-${Date.now()}-user`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setChatInput('');
    setIsConversing(true);
    setError(null);

    // Keep response updated
    setUserResponse((prev) => (prev ? `${prev}\n\n${text}` : text));

    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: `Perspective Replay: ${originalEntry.title}`,
          category: 'reflection',
          prompt: text,
          history: [
            {
              role: 'assistant',
              content: `Original thought from ${formattedDate}: "${originalSummaryText.slice(0, 500)}". Question: "${activeQuestion}"`,
            },
            ...newHistory,
          ],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get reflection response from Gemini.');
      }

      const data = await response.json();
      const assistantMsg: JournalMessage = {
        id: `replay-msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: data.text,
        timestamp: new Date().toISOString(),
        modelUsed: data.modelUsed,
      };

      setMessages([...newHistory, assistantMsg]);
    } catch (err: any) {
      console.error('Replay chat error:', err);
      setError(err.message || 'Failed to converse with Gemini.');
    } finally {
      setIsConversing(false);
    }
  };

  // Compare perspectives with Gemini
  const handleGenerateComparison = async () => {
    const combinedResponse = userResponse.trim() || messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    if (!combinedResponse) {
      setError('Please share your current thoughts before generating a comparison.');
      return;
    }

    setIsComparing(true);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const minimalContext = connectedThread
        ? `Linked Thread: "${connectedThread.title}". Scope: ${connectedThread.description}`
        : '';

      const response = await fetch('/api/gemini/perspective-replay/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          originalEntry: {
            id: originalEntry.id,
            title: originalEntry.title,
            date: formattedDate,
            summary: originalSummaryText,
            content: originalEntry.messages?.map((m) => m.content).join('\n').slice(0, 2000),
          },
          reflectionQuestion: activeQuestion,
          userResponse: combinedResponse,
          conversation: messages,
          minimalRelatedContext: minimalContext,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to compare perspectives.');
      }

      const data = await response.json();
      setComparisonResult(data.comparison);
    } catch (err: any) {
      console.error('Comparison error:', err);
      setError(err.message || 'Failed to generate comparison.');
    } finally {
      setIsComparing(false);
    }
  };

  // Save the replay reflection
  const handleSaveReplay = async (createAsJournalEntry: boolean) => {
    if (!comparisonResult || !auth.currentUser) return;

    setIsSaving(true);
    setError(null);

    const replayId = `replay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const replayDoc: PerspectiveReplay = {
      id: replayId,
      userId: auth.currentUser.uid,
      originalEntryId: originalEntry.id,
      originalEntryTitle: originalEntry.title,
      originalEntryDate: formattedDate,
      reflectionQuestion: activeQuestion,
      originalPerspective: comparisonResult.originalPerspective,
      currentPerspective: comparisonResult.currentPerspective,
      whatChanged: comparisonResult.whatChanged,
      whatStayedConsistent: comparisonResult.whatStayedConsistent,
      possibleReasons: comparisonResult.possibleReasons,
      newInsight: comparisonResult.newInsight || null,
      replayDate: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      await onSaveReplay(replayDoc, createAsJournalEntry);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Save replay error:', err);
      setError(err.message || 'Failed to persist replay reflection.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="perspective-replay-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/40 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-[#FDFCF8] border border-[#E5E0D8] w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="bg-white px-6 py-4 border-b border-[#E5E0D8] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#EAE4DB] text-[#7A8D74] flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-serif italic font-semibold text-[#4A3E3E]">
                  Perspective Replay
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#F5F2ED] text-[#70665C] px-2 py-0.5 rounded-full border border-[#E5E0D8]">
                  Then vs Now
                </span>
              </div>
              <p className="text-xs text-[#70665C]">
                Revisit an older reflection from your current viewpoint without modifying the original.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {existingReplays.length > 0 && (
              <div className="flex bg-[#F5F2ED] p-0.5 rounded-full border border-[#E5E0D8] text-xs mr-2">
                <button
                  id="tab-replay-new"
                  onClick={() => setActiveTab('new')}
                  className={`px-3 py-1 rounded-full font-medium transition-colors ${
                    activeTab === 'new' ? 'bg-white text-[#4A3E3E] shadow-2xs' : 'text-[#70665C]'
                  }`}
                >
                  New Replay
                </button>
                <button
                  id="tab-replay-history"
                  onClick={() => setActiveTab('history')}
                  className={`px-3 py-1 rounded-full font-medium transition-colors ${
                    activeTab === 'history' ? 'bg-white text-[#4A3E3E] shadow-2xs' : 'text-[#70665C]'
                  }`}
                >
                  Past Replays ({existingReplays.length})
                </button>
              </div>
            )}

            <button
              id="btn-close-replay-modal"
              onClick={onClose}
              className="p-1.5 rounded-full text-[#70665C] hover:text-[#4A3E3E] hover:bg-[#F5F2ED] transition-colors"
              title="Close Replay"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 ml-2 font-bold">
                &times;
              </button>
            </div>
          )}

          {activeTab === 'history' ? (
            /* Historical Replays for this Entry */
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#70665C]">
                Saved Perspective Comparisons for &ldquo;{originalEntry.title}&rdquo;
              </h3>
              {existingReplays.map((rep, idx) => (
                <div
                  key={rep.id || idx}
                  className="bg-white border border-[#E5E0D8] rounded-2xl p-5 space-y-4 shadow-2xs"
                >
                  <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3 text-xs">
                    <span className="font-semibold text-[#4A3E3E] flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-[#7A8D74]" />
                      Replayed on {new Date(rep.replayDate).toLocaleDateString()}
                    </span>
                    <span className="text-[#A69D91] italic">
                      Question: &ldquo;{rep.reflectionQuestion}&rdquo;
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E5E0D8]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#70665C] block mb-1">
                        What I Thought Then ({rep.originalEntryDate})
                      </span>
                      <p className="text-[#4A3E3E] leading-relaxed">{rep.originalPerspective}</p>
                    </div>
                    <div className="bg-[#F2F7EF] p-3.5 rounded-xl border border-[#D2DCBE]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#55694F] block mb-1">
                        What I Think Now
                      </span>
                      <p className="text-[#4A3E3E] leading-relaxed">{rep.currentPerspective}</p>
                    </div>
                  </div>

                  <div className="text-xs space-y-2 pt-1 border-t border-[#E5E0D8]/60">
                    <div>
                      <strong className="text-[#4A3E3E]">What Changed:</strong>{' '}
                      <span className="text-[#70665C]">{rep.whatChanged}</span>
                    </div>
                    <div>
                      <strong className="text-[#4A3E3E]">What Stayed Consistent:</strong>{' '}
                      <span className="text-[#70665C]">{rep.whatStayedConsistent}</span>
                    </div>
                    {rep.possibleReasons && (
                      <div>
                        <strong className="text-[#4A3E3E]">Supported Reasons:</strong>{' '}
                        <span className="text-[#70665C]">{rep.possibleReasons}</span>
                      </div>
                    )}
                    {rep.newInsight && (
                      <div className="bg-[#FAF8F5] p-2.5 rounded-lg border border-[#E5E0D8] text-[#55694F] italic">
                        <strong>New Insight:</strong> {rep.newInsight}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* New Replay Creation Flow */
            <>
              {/* Top: The Original Perspective ("What I thought then") */}
              <div
                id="original-perspective-card"
                className="bg-white border border-[#E5E0D8] rounded-2xl p-5 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#70665C]">
                    <BookOpen className="w-3.5 h-3.5 text-[#7A8D74]" />
                    <span>What I thought then</span>
                  </div>
                  <span className="text-xs text-[#A69D91] flex items-center gap-1 font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    {formattedDate}
                  </span>
                </div>

                <h3 className="font-serif italic font-semibold text-[#4A3E3E] text-base">
                  &ldquo;{originalEntry.title}&rdquo;
                </h3>

                <div className="bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl p-3.5 text-xs text-[#70665C] leading-relaxed max-h-32 overflow-y-auto">
                  {originalSummaryText}
                </div>
              </div>

              {/* Reflection Starter Question Picker */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#70665C] block">
                  Select a Reflection Starter:
                </label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setSelectedQuestion(q);
                        setCustomQuestion('');
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selectedQuestion === q && !customQuestion
                          ? 'bg-[#7A8D74] text-white border-[#7A8D74] shadow-xs'
                          : 'bg-white text-[#70665C] border-[#E5E0D8] hover:bg-[#F5F2ED]'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="Or ask a custom question..."
                  className="w-full text-xs bg-white border border-[#E5E0D8] rounded-xl px-3 py-2 text-[#4A3E3E] focus:outline-none focus:ring-1 focus:ring-[#7A8D74]"
                />
              </div>

              {/* User Current Response / Natural Conversation */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#70665C] flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-[#7A8D74]" />
                    <span>What I think now: Your Current Reflection</span>
                  </label>
                  <span className="text-[11px] text-[#A69D91]">
                    Respond freely; Gemini will compare both stances
                  </span>
                </div>

                <textarea
                  id="textarea-current-response"
                  rows={4}
                  value={userResponse}
                  onChange={(e) => setUserResponse(e.target.value)}
                  placeholder={`Reflect on "${activeQuestion}"... How have your priorities, knowledge, or feelings shifted since ${formattedDate}?`}
                  className="w-full text-xs bg-white border border-[#E5E0D8] rounded-2xl p-4 text-[#4A3E3E] focus:outline-none focus:ring-1 focus:ring-[#7A8D74] leading-relaxed shadow-2xs"
                />

                {/* Optional Conversational Multi-turn Dialogue Area */}
                {messages.length > 0 && (
                  <div className="bg-[#FAF8F5] border border-[#E5E0D8] rounded-2xl p-4 space-y-3 max-h-48 overflow-y-auto text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#70665C] block">
                      Conversation with Gemini on this replay:
                    </span>
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${
                            m.role === 'user'
                              ? 'bg-[#7A8D74] text-white'
                              : 'bg-white text-[#4A3E3E] border border-[#E5E0D8]'
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Chat input for bouncing ideas before finalizing */}
                <div className="flex items-center gap-2">
                  <input
                    id="input-replay-chat"
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSendChatMessage();
                      }
                    }}
                    placeholder="Ask Gemini to probe deeper into this shift before comparing..."
                    className="flex-1 text-xs bg-white border border-[#E5E0D8] rounded-xl px-3.5 py-2 text-[#4A3E3E] focus:outline-none focus:ring-1 focus:ring-[#7A8D74]"
                  />
                  <button
                    id="btn-send-replay-chat"
                    onClick={handleSendChatMessage}
                    disabled={!chatInput.trim() || isConversing}
                    className="px-3 py-2 bg-[#F5F2ED] text-[#4A3E3E] hover:bg-[#EAE4DB] rounded-xl border border-[#E5E0D8] text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-40"
                  >
                    {isConversing ? (
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Explore</span>
                  </button>
                </div>
              </div>

              {/* Generate Comparison Button */}
              <div className="pt-2 flex justify-center">
                <button
                  id="btn-generate-comparison"
                  onClick={handleGenerateComparison}
                  disabled={isComparing || (!userResponse.trim() && messages.length === 0)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#7A8D74] text-white text-xs font-semibold hover:bg-[#687963] transition-all shadow-sm active:scale-98 disabled:opacity-50"
                >
                  {isComparing ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Synthesizing Perspective Shift...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Compare Perspectives</span>
                    </>
                  )}
                </button>
              </div>

              {/* Structured Comparison Output */}
              {comparisonResult && (
                <div
                  id="perspective-comparison-result"
                  className="bg-white border-2 border-[#D2DCBE] rounded-3xl p-5 sm:p-6 shadow-xs space-y-5 transition-all"
                >
                  <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
                    <div className="flex items-center gap-2">
                      <Scale className="w-5 h-5 text-[#7A8D74]" />
                      <h3 className="font-serif italic font-semibold text-[#4A3E3E] text-base">
                        Structured Perspective Comparison
                      </h3>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#55694F] bg-[#F2F7EF] px-2.5 py-0.5 rounded-full border border-[#D2DCBE]">
                      Grounded in Evidence
                    </span>
                  </div>

                  {/* Two Column Stance: Then vs Now */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E5E0D8] space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#70665C] block">
                        What I Thought Then ({formattedDate})
                      </span>
                      <p className="text-[#4A3E3E] leading-relaxed">
                        {comparisonResult.originalPerspective}
                      </p>
                    </div>

                    <div className="bg-[#F2F7EF] p-4 rounded-2xl border border-[#D2DCBE] space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#55694F] block">
                        What I Think Now (Today)
                      </span>
                      <p className="text-[#4A3E3E] leading-relaxed">
                        {comparisonResult.currentPerspective}
                      </p>
                    </div>
                  </div>

                  {/* Differences & Continuity */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-[#E5E0D8]">
                      <strong className="text-[#4A3E3E] block font-semibold">
                        What Changed:
                      </strong>
                      <p className="text-[#70665C] leading-relaxed whitespace-pre-wrap">
                        {comparisonResult.whatChanged}
                      </p>
                    </div>

                    <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-[#E5E0D8]">
                      <strong className="text-[#4A3E3E] block font-semibold">
                        What Stayed Consistent:
                      </strong>
                      <p className="text-[#70665C] leading-relaxed whitespace-pre-wrap">
                        {comparisonResult.whatStayedConsistent}
                      </p>
                    </div>
                  </div>

                  {/* Supported Reasons for Change */}
                  {comparisonResult.possibleReasons && (
                    <div className="text-xs bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E5E0D8] space-y-1">
                      <strong className="text-[#4A3E3E] block font-semibold">
                        Supported Reasons for the Shift:
                      </strong>
                      <p className="text-[#70665C] leading-relaxed">
                        {comparisonResult.possibleReasons}
                      </p>
                    </div>
                  )}

                  {/* Optional New Insight */}
                  {comparisonResult.newInsight && (
                    <div className="text-xs bg-[#F2F7EF] p-3.5 rounded-xl border border-[#D2DCBE] space-y-1">
                      <div className="flex items-center gap-1.5 text-[#55694F] font-bold text-[11px] uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Emergent Realization / Insight</span>
                      </div>
                      <p className="text-[#4A3E3E] italic leading-relaxed">
                        {comparisonResult.newInsight}
                      </p>
                    </div>
                  )}

                  {/* Save Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5E0D8]">
                    <div className="text-[11px] text-[#A69D91]">
                      Preserves original journal entry; creates a linked replay record.
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        id="btn-save-replay-only"
                        onClick={() => handleSaveReplay(false)}
                        disabled={isSaving || saveSuccess}
                        className="px-3.5 py-1.5 rounded-xl border border-[#E5E0D8] bg-white hover:bg-[#F5F2ED] text-[#4A3E3E] text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save to Replay History'}
                      </button>

                      <button
                        id="btn-save-and-create-entry"
                        onClick={() => handleSaveReplay(true)}
                        disabled={isSaving || saveSuccess}
                        className="px-4 py-1.5 rounded-xl bg-[#7A8D74] text-white hover:bg-[#687963] text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                      >
                        {saveSuccess ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            <span>Saved Replay!</span>
                          </>
                        ) : (
                          <>
                            <Compass className="w-3.5 h-3.5" />
                            <span>Save as New Reflection</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
