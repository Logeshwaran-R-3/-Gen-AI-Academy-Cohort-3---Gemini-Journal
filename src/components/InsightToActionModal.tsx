import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Target,
  CheckCircle2,
  Clock,
  Quote,
  Edit3,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Sliders,
  Check,
  FileText,
} from 'lucide-react';
import { ThoughtThread, JournalEntry, ActionExperiment, ActionExperimentStatus } from '../types';
import { auth } from '../firebase';

interface InsightToActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  thread: ThoughtThread;
  entries: JournalEntry[];
  existingActions: ActionExperiment[];
  onSaveAction: (action: ActionExperiment) => Promise<void>;
}

interface SuggestionResult {
  hasSufficientEvidence: boolean;
  reasonIfInsufficient?: string;
  insight: string;
  experiment: string;
  timeframe: string;
  evidenceQuotes: string[];
  whyThisExperiment: string;
  entryIds: string[];
  threadId: string;
  threadTitle: string;
}

export const InsightToActionModal: React.FC<InsightToActionModalProps> = ({
  isOpen,
  onClose,
  thread,
  entries,
  existingActions,
  onSaveAction,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedInsight, setEditedInsight] = useState('');
  const [editedExperiment, setEditedExperiment] = useState('');
  const [editedTimeframe, setEditedTimeframe] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch or trigger suggestion
  const fetchSuggestion = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('You must be signed in to analyze Thought Threads.');
      }

      // Filter entries belonging to this thread
      const threadEntries = entries.filter((e) => thread.entryIds.includes(e.id));

      const response = await fetch('/api/gemini/actions/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          thread: {
            id: thread.id,
            title: thread.title,
            description: thread.description,
            entryCount: thread.entryCount,
          },
          entries: threadEntries.map((e) => ({
            id: e.id,
            title: e.title,
            createdAt: e.createdAt,
            summary: e.summary,
            content: e.messages?.[0]?.content || '',
          })),
          existingActions: existingActions.filter((a) => a.threadId === thread.id),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to synthesize action experiment.');
      }

      const data: SuggestionResult = await response.json();
      setSuggestion(data);
      setEditedInsight(data.insight || '');
      setEditedExperiment(data.experiment || '');
      setEditedTimeframe(data.timeframe || '');
    } catch (err: any) {
      console.error('Error in fetchSuggestion:', err);
      setError(err.message || 'An unexpected error occurred while analyzing this thread.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsEditing(false);
      setUserNotes('');
      fetchSuggestion();
    } else {
      setSuggestion(null);
      setError(null);
    }
  }, [isOpen, thread.id]);

  if (!isOpen) return null;

  // Handle Accept Action
  const handleAccept = async () => {
    if (!suggestion || saving) return;
    setSaving(true);
    setError(null);

    const actionId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const finalInsight = isEditing ? editedInsight.trim() : suggestion.insight;
    const finalExperiment = isEditing ? editedExperiment.trim() : suggestion.experiment;
    const finalTimeframe = isEditing ? editedTimeframe.trim() : suggestion.timeframe;

    const newAction: ActionExperiment = {
      id: actionId,
      userId: auth.currentUser?.uid || '',
      threadId: thread.id,
      threadTitle: thread.title,
      entryIds: suggestion.entryIds && suggestion.entryIds.length > 0 ? suggestion.entryIds : thread.entryIds,
      insight: finalInsight,
      experiment: finalExperiment,
      timeframe: finalTimeframe || null,
      evidenceQuotes: suggestion.evidenceQuotes || [],
      whyThisExperiment: suggestion.whyThisExperiment || null,
      status: 'accepted',
      notes: userNotes.trim() || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await onSaveAction(newAction);
      onClose();
    } catch (err: any) {
      console.error('Failed to accept action:', err);
      setError(err.message || 'Failed to save action experiment.');
      setSaving(false);
    }
  };

  // Handle Dismiss Action
  const handleDismiss = () => {
    onClose();
  };

  return (
    <div
      id="insight-to-action-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A3E3E]/50 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-[#FDFCF8] border border-[#E5E0D8] rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-[#E5E0D8] bg-[#F5F2ED] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EAE4DB] border border-[#D5CEC2] text-[#4A3E3E] flex items-center justify-center shadow-2xs">
              <Target className="w-5 h-5 text-[#7A8D74]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-serif italic font-semibold text-[#4A3E3E]">
                  Insight → Action
                </h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#EAE4DB] text-[#70665C] px-2 py-0.5 rounded-full border border-[#D5CEC2]">
                  Experiment
                </span>
              </div>
              <p className="text-xs text-[#70665C] mt-0.5">
                Translating recurring thought patterns into small, concrete experiments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#EAE4DB] text-[#70665C] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Thread Banner */}
          <div className="bg-white border border-[#E5E0D8] rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-[#A69D91] shrink-0">Source Thread:</span>
              <span className="font-serif italic font-semibold text-[#4A3E3E] truncate">
                {thread.title}
              </span>
            </div>
            <span className="text-[11px] text-[#70665C] bg-[#F5F2ED] px-2.5 py-0.5 rounded-full shrink-0 border border-[#E5E0D8]">
              {thread.entryCount} {thread.entryCount === 1 ? 'reflection' : 'reflections'}
            </span>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-[#FBF2EF] border border-[#ECD1C8] rounded-2xl flex items-start gap-3 text-xs text-[#9E4738]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">Notice</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="py-14 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full border-3 border-[#7A8D74] border-t-transparent animate-spin" />
              <p className="font-serif italic text-sm font-semibold text-[#4A3E3E]">
                Scanning reflections for recurring patterns...
              </p>
              <p className="text-xs text-[#70665C] max-w-sm">
                Evaluating whether your journal contains sufficient evidence to propose a small, concrete experiment.
              </p>
            </div>
          )}

          {/* Insufficient Evidence State */}
          {!loading && suggestion && !suggestion.hasSufficientEvidence && (
            <div className="p-6 bg-[#F5F2ED] border border-[#E5E0D8] rounded-2xl text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#EAE4DB] text-[#70665C] flex items-center justify-center mx-auto">
                <FileText className="w-5 h-5 text-[#A69D91]" />
              </div>
              <h3 className="font-serif italic font-semibold text-[#4A3E3E] text-base">
                Insufficient Evidence for an Action Experiment
              </h3>
              <p className="text-xs text-[#70665C] max-w-md mx-auto leading-relaxed">
                {suggestion.reasonIfInsufficient ||
                  'Your reflections in this thread do not yet demonstrate a recurring idea, dilemma, or goal that warrants an experiment. Experiments are only proposed when your own writing provides clear, repeated evidence.'}
              </p>
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs font-semibold rounded-full bg-[#7A8D74] text-white hover:bg-[#687963] transition-colors"
                >
                  Close & Continue Journaling
                </button>
              </div>
            </div>
          )}

          {/* Sufficient Evidence: Proposal State */}
          {!loading && suggestion && suggestion.hasSufficientEvidence && (
            <div className="space-y-4">
              {/* Insight Box */}
              <div className="bg-[#F5F2ED] border border-[#E5E0D8] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#7A8D74] flex items-center gap-1.5">
                    <Quote className="w-3.5 h-3.5" />
                    Observed Insight
                  </span>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#70665C] hover:text-[#4A3E3E]"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <label className="text-[11px] text-[#70665C] font-medium block">
                      Edit Insight Description:
                    </label>
                    <textarea
                      value={editedInsight}
                      onChange={(e) => setEditedInsight(e.target.value)}
                      rows={2}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#D5CEC2] bg-white focus:outline-none focus:border-[#7A8D74]"
                    />
                  </div>
                ) : (
                  <p className="text-sm font-serif italic text-[#4A3E3E] leading-relaxed">
                    &ldquo;{suggestion.insight}&rdquo;
                  </p>
                )}
              </div>

              {/* Proposed Concrete Experiment */}
              <div className="bg-white border-2 border-[#7A8D74]/30 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#E5E0D8]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#4A3E3E] flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-[#7A8D74]" />
                    Proposed Small Experiment
                  </span>
                  {suggestion.timeframe && !isEditing && (
                    <span className="text-[11px] font-medium text-[#70665C] bg-[#F5F2ED] px-2.5 py-0.5 rounded-full border border-[#E5E0D8] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#7A8D74]" />
                      {suggestion.timeframe}
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] text-[#70665C] font-medium block mb-1">
                          Concrete Experiment Action:
                        </label>
                        <textarea
                          value={editedExperiment}
                          onChange={(e) => setEditedExperiment(e.target.value)}
                          rows={3}
                          className="w-full text-xs p-2.5 rounded-xl border border-[#D5CEC2] bg-[#FDFCF8] focus:outline-none focus:border-[#7A8D74]"
                          placeholder="What small, realistic test will you try?"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#70665C] font-medium block mb-1">
                          Estimated Timeframe:
                        </label>
                        <input
                          type="text"
                          value={editedTimeframe}
                          onChange={(e) => setEditedTimeframe(e.target.value)}
                          className="w-full text-xs p-2 rounded-xl border border-[#D5CEC2] bg-[#FDFCF8] focus:outline-none focus:border-[#7A8D74]"
                          placeholder="e.g., 20 minutes tomorrow"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-[#4A3E3E] leading-relaxed">
                        {suggestion.experiment}
                      </p>
                      {suggestion.whyThisExperiment && (
                        <p className="text-xs text-[#70665C] mt-2 leading-relaxed italic bg-[#FDFCF8] p-3 rounded-xl border border-[#E5E0D8]">
                          {suggestion.whyThisExperiment}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Evidence Quotes */}
                {suggestion.evidenceQuotes && suggestion.evidenceQuotes.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#E5E0D8]/70">
                    <span className="text-[11px] font-semibold text-[#A69D91] uppercase tracking-wider block mb-2">
                      Evidence from your journal entries:
                    </span>
                    <ul className="space-y-1.5">
                      {suggestion.evidenceQuotes.map((quote, qIdx) => (
                        <li
                          key={qIdx}
                          className="text-xs text-[#70665C] flex items-start gap-2 bg-[#F5F2ED] p-2.5 rounded-xl"
                        >
                          <span className="text-[#7A8D74] font-bold shrink-0">&bull;</span>
                          <span className="italic">&ldquo;{quote}&rdquo;</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Optional User Notes */}
              <div className="space-y-1.5">
                <label className="text-xs text-[#70665C] font-medium block">
                  Personal notes or modifications (optional):
                </label>
                <input
                  type="text"
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="e.g., I will try this during my morning coffee break"
                  className="w-full text-xs p-3 rounded-2xl border border-[#E5E0D8] bg-white focus:outline-none focus:border-[#7A8D74]"
                />
              </div>

              {/* Non-promissory Guardrail Notice */}
              <div className="p-3 bg-[#F5F2ED] border border-[#E5E0D8] rounded-2xl flex items-start gap-2 text-[11px] text-[#70665C]">
                <ShieldCheck className="w-4 h-4 text-[#7A8D74] shrink-0 mt-0.5" />
                <p>
                  <strong>Optional & Empirical:</strong> This experiment is purely an exploratory test for you to try if you wish. It makes no promise to solve problems or guarantee outcomes. You can accept, modify, or dismiss it at any time.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-4 sm:p-6 border-t border-[#E5E0D8] bg-[#F5F2ED] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!loading && suggestion && suggestion.hasSufficientEvidence && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#70665C] hover:text-[#4A3E3E] bg-[#EAE4DB] rounded-full border border-[#D5CEC2] transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Cancel Edit' : 'Edit Experiment'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-xs font-semibold text-[#70665C] hover:bg-[#EAE4DB] rounded-full border border-[#D5CEC2] transition-colors"
            >
              Dismiss
            </button>

            {!loading && suggestion && suggestion.hasSufficientEvidence && (
              <button
                onClick={handleAccept}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-full bg-[#7A8D74] text-white hover:bg-[#687963] disabled:opacity-50 transition-colors shadow-xs"
              >
                {saving ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Experiment...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accept Experiment</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
