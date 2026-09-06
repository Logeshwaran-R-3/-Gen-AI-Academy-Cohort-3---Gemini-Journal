import React, { useState, useMemo } from 'react';
import {
  Target,
  CheckCircle2,
  Clock,
  Check,
  RotateCcw,
  XCircle,
  Edit3,
  Trash2,
  ExternalLink,
  Search,
  Filter,
  AlertCircle,
  GitBranch,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileEdit,
} from 'lucide-react';
import { ActionExperiment, ActionExperimentStatus, ThoughtThread, JournalEntry } from '../types';

interface ActionExperimentsViewProps {
  actions: ActionExperiment[];
  threads: ThoughtThread[];
  entries: JournalEntry[];
  onUpdateActionStatus: (
    actionId: string,
    status: ActionExperimentStatus,
    extraUpdates?: Partial<ActionExperiment>
  ) => Promise<void>;
  onDeleteAction: (actionId: string) => Promise<void>;
  onOpenThread: (threadId: string) => void;
  onOpenEntry: (entry: JournalEntry) => void;
  onTriggerNewExperiment?: () => void;
}

export const ActionExperimentsView: React.FC<ActionExperimentsViewProps> = ({
  actions,
  threads,
  entries,
  onUpdateActionStatus,
  onDeleteAction,
  onOpenThread,
  onOpenEntry,
  onTriggerNewExperiment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'changed' | 'abandoned'>('all');
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editExperimentText, setEditExperimentText] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Status Change Dialog state
  const [statusModalAction, setStatusModalAction] = useState<ActionExperiment | null>(null);
  const [targetStatus, setTargetStatus] = useState<ActionExperimentStatus | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [changedExperimentInput, setChangedExperimentInput] = useState('');

  // Filtered actions list
  const filteredActions = useMemo(() => {
    return actions.filter((action) => {
      // Status filter
      if (statusFilter === 'active') {
        if (action.status !== 'accepted' && action.status !== 'in_progress') return false;
      } else if (statusFilter === 'completed') {
        if (action.status !== 'completed') return false;
      } else if (statusFilter === 'changed') {
        if (action.status !== 'changed') return false;
      } else if (statusFilter === 'abandoned') {
        if (action.status !== 'abandoned') return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesInsight = action.insight.toLowerCase().includes(q);
        const matchesExp = action.experiment.toLowerCase().includes(q);
        const matchesThread = action.threadTitle?.toLowerCase().includes(q) || false;
        const matchesNotes = action.notes?.toLowerCase().includes(q) || false;
        return matchesInsight || matchesExp || matchesThread || matchesNotes;
      }

      return true;
    });
  }, [actions, statusFilter, searchQuery]);

  // Counts by status
  const counts = useMemo(() => {
    return {
      all: actions.length,
      active: actions.filter((a) => a.status === 'accepted' || a.status === 'in_progress').length,
      completed: actions.filter((a) => a.status === 'completed').length,
      changed: actions.filter((a) => a.status === 'changed').length,
      abandoned: actions.filter((a) => a.status === 'abandoned').length,
    };
  }, [actions]);

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'N/A';
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

  // Open status change modal
  const openStatusChange = (action: ActionExperiment, nextStatus: ActionExperimentStatus) => {
    setStatusModalAction(action);
    setTargetStatus(nextStatus);
    setStatusNote('');
    setChangedExperimentInput(action.changedExperimentText || action.experiment);
  };

  // Confirm status change
  const confirmStatusChange = async () => {
    if (!statusModalAction || !targetStatus) return;
    setUpdatingId(statusModalAction.id);

    try {
      const updates: Partial<ActionExperiment> = {
        updatedAt: new Date().toISOString(),
      };

      if (targetStatus === 'completed') {
        updates.completedAt = new Date().toISOString();
        if (statusNote.trim()) {
          updates.notes = (statusModalAction.notes ? `${statusModalAction.notes}\n` : '') + `Completed note: ${statusNote.trim()}`;
        }
      } else if (targetStatus === 'changed') {
        updates.changedExperimentText = changedExperimentInput.trim() || statusModalAction.experiment;
        if (statusNote.trim()) {
          updates.notes = (statusModalAction.notes ? `${statusModalAction.notes}\n` : '') + `Modification note: ${statusNote.trim()}`;
        }
      } else if (targetStatus === 'abandoned') {
        if (statusNote.trim()) {
          updates.notes = (statusModalAction.notes ? `${statusModalAction.notes}\n` : '') + `Reason abandoned: ${statusNote.trim()}`;
        }
      }

      await onUpdateActionStatus(statusModalAction.id, targetStatus, updates);
      setStatusModalAction(null);
      setTargetStatus(null);
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Save inline edit
  const handleSaveEdit = async (action: ActionExperiment) => {
    setUpdatingId(action.id);
    try {
      await onUpdateActionStatus(action.id, action.status, {
        experiment: editExperimentText.trim() || action.experiment,
        notes: editNotes.trim() || null,
        updatedAt: new Date().toISOString(),
      });
      setEditingActionId(null);
    } catch (err) {
      console.error('Failed to edit action:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: ActionExperimentStatus) => {
    switch (status) {
      case 'accepted':
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#EAF2E8] text-[#55694F] px-2.5 py-0.5 rounded-full border border-[#D5E3D1]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7A8D74]" />
            In Progress
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#EBF3FA] text-[#3D688D] px-2.5 py-0.5 rounded-full border border-[#D0E2F2]">
            <Check className="w-3 h-3 text-[#3D688D]" />
            Completed
          </span>
        );
      case 'changed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#FDF6E2] text-[#916E28] px-2.5 py-0.5 rounded-full border border-[#F5E6B8]">
            <FileEdit className="w-3 h-3 text-[#916E28]" />
            Changed
          </span>
        );
      case 'abandoned':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#F5F2ED] text-[#70665C] px-2.5 py-0.5 rounded-full border border-[#E5E0D8]">
            <XCircle className="w-3 h-3 text-[#A69D91]" />
            Abandoned
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#F5F2ED] text-[#70665C] px-2.5 py-0.5 rounded-full border border-[#E5E0D8]">
            {status}
          </span>
        );
    }
  };

  return (
    <div
      id="action-experiments-container"
      className="flex-1 flex flex-col h-full overflow-hidden bg-[#FDFCF8]"
    >
      {/* Top Header Bar */}
      <div className="p-6 pb-4 border-b border-[#E5E0D8] bg-[#F5F2ED]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#EAE4DB] border border-[#D5CEC2] text-[#4A3E3E] flex items-center justify-center shadow-2xs">
              <Target className="w-6 h-6 text-[#7A8D74]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-serif italic font-semibold text-[#4A3E3E]">
                  Insight → Action
                </h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#EAE4DB] text-[#70665C] px-2.5 py-0.5 rounded-full border border-[#D5CEC2]">
                  {actions.length} {actions.length === 1 ? 'Experiment' : 'Experiments'}
                </span>
              </div>
              <p className="text-xs text-[#70665C] mt-0.5">
                Concrete, small experiments derived from recurring patterns in your reflections
              </p>
            </div>
          </div>

          {/* Quick Action to Trigger New Experiment */}
          {onTriggerNewExperiment && threads.length > 0 && (
            <button
              onClick={onTriggerNewExperiment}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full bg-[#7A8D74] text-white hover:bg-[#687963] transition-colors shadow-2xs self-start md:self-auto"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Synthesize from Threads</span>
            </button>
          )}
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 bg-[#EAE4DB] p-1 rounded-full border border-[#D5CEC2] overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-white text-[#4A3E3E] font-semibold shadow-2xs'
                  : 'text-[#70665C] hover:text-[#4A3E3E]'
              }`}
            >
              All ({counts.all})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors shrink-0 ${
                statusFilter === 'active'
                  ? 'bg-white text-[#4A3E3E] font-semibold shadow-2xs'
                  : 'text-[#70665C] hover:text-[#4A3E3E]'
              }`}
            >
              In Progress ({counts.active})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors shrink-0 ${
                statusFilter === 'completed'
                  ? 'bg-white text-[#4A3E3E] font-semibold shadow-2xs'
                  : 'text-[#70665C] hover:text-[#4A3E3E]'
              }`}
            >
              Completed ({counts.completed})
            </button>
            <button
              onClick={() => setStatusFilter('changed')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors shrink-0 ${
                statusFilter === 'changed'
                  ? 'bg-white text-[#4A3E3E] font-semibold shadow-2xs'
                  : 'text-[#70665C] hover:text-[#4A3E3E]'
              }`}
            >
              Changed ({counts.changed})
            </button>
            <button
              onClick={() => setStatusFilter('abandoned')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors shrink-0 ${
                statusFilter === 'abandoned'
                  ? 'bg-white text-[#4A3E3E] font-semibold shadow-2xs'
                  : 'text-[#70665C] hover:text-[#4A3E3E]'
              }`}
            >
              Abandoned ({counts.abandoned})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#A69D91] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search experiments or insights..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-full border border-[#D5CEC2] bg-white text-[#4A3E3E] placeholder-[#A69D91] focus:outline-none focus:border-[#7A8D74]"
            />
          </div>
        </div>
      </div>

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* User Authoritative Control Callout */}
        <div className="p-3.5 bg-[#F5F2ED] border border-[#E5E0D8] rounded-2xl flex items-center justify-between text-xs text-[#70665C]">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#7A8D74] shrink-0" />
            <span>
              <strong>Manual User Authority:</strong> Actions are never automatically marked as completed by AI. You retain full control to mark an experiment as completed, changed, or abandoned.
            </span>
          </div>
        </div>

        {/* Empty State */}
        {filteredActions.length === 0 ? (
          <div className="bg-white border border-[#E5E0D8] rounded-3xl p-12 text-center max-w-lg mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] text-[#7A8D74] flex items-center justify-center mx-auto mb-4 shadow-2xs">
              <Target className="w-7 h-7" />
            </div>
            <h3 className="text-base font-serif italic font-semibold text-[#4A3E3E]">
              {actions.length === 0 ? 'No Action Experiments Yet' : 'No Matching Experiments'}
            </h3>
            <p className="text-xs text-[#70665C] mt-2 leading-relaxed">
              {actions.length === 0
                ? 'When recurring patterns or goals emerge across your Thought Threads, you can turn them into small, concrete experiments to test in your daily routine.'
                : 'Try adjusting your search query or status filter.'}
            </p>
            {actions.length === 0 && onTriggerNewExperiment && threads.length > 0 && (
              <button
                onClick={onTriggerNewExperiment}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-full bg-[#7A8D74] text-white hover:bg-[#687963] transition-colors shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Explore Thought Threads</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredActions.map((action) => {
              const isEditing = editingActionId === action.id;

              return (
                <div
                  key={action.id}
                  id={`action-experiment-${action.id}`}
                  className="bg-white border border-[#E5E0D8] rounded-2xl p-5 shadow-xs hover:border-[#7A8D74] transition-all duration-150"
                >
                  {/* Top Bar: Status and Thread Info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E5E0D8]/60">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(action.status)}

                      {action.threadTitle && (
                        <span className="text-xs text-[#70665C] flex items-center gap-1 bg-[#F5F2ED] px-2.5 py-0.5 rounded-full border border-[#E5E0D8]">
                          <GitBranch className="w-3 h-3 text-[#7A8D74]" />
                          <span>{action.threadTitle}</span>
                        </span>
                      )}

                      {action.timeframe && (
                        <span className="text-xs text-[#A69D91] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{action.timeframe}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#A69D91]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Created {formatDate(action.createdAt)}</span>
                      </span>
                      {action.completedAt && (
                        <span className="text-[#3D688D] font-medium">
                          &bull; Completed {formatDate(action.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Insight and Experiment Content */}
                  <div className="mt-4 space-y-3">
                    {/* Insight */}
                    <div className="text-xs text-[#70665C] bg-[#FDFCF8] p-3 rounded-xl border border-[#E5E0D8]/70">
                      <span className="font-semibold text-[#4A3E3E] uppercase text-[10px] tracking-wider block mb-1">
                        Observed Recurring Pattern:
                      </span>
                      <p className="font-serif italic text-sm text-[#4A3E3E]">
                        &ldquo;{action.insight}&rdquo;
                      </p>
                    </div>

                    {/* Concrete Experiment */}
                    {isEditing ? (
                      <div className="p-3 bg-[#F5F2ED] rounded-xl border border-[#D5CEC2] space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-[#4A3E3E] block mb-1">
                            Concrete Experiment:
                          </label>
                          <textarea
                            value={editExperimentText}
                            onChange={(e) => setEditExperimentText(e.target.value)}
                            rows={2}
                            className="w-full text-xs p-2.5 rounded-lg border border-[#D5CEC2] bg-white focus:outline-none focus:border-[#7A8D74]"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[#70665C] block mb-1">
                            Notes / Follow-up:
                          </label>
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="w-full text-xs p-2 rounded-lg border border-[#D5CEC2] bg-white focus:outline-none focus:border-[#7A8D74]"
                          />
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setEditingActionId(null)}
                            className="px-3 py-1 text-xs text-[#70665C] hover:bg-[#EAE4DB] rounded-full"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(action)}
                            disabled={updatingId === action.id}
                            className="px-3 py-1 text-xs font-semibold bg-[#7A8D74] text-white rounded-full hover:bg-[#687963]"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-white border-2 border-[#7A8D74]/20 rounded-xl">
                        <span className="font-semibold text-[#4A3E3E] uppercase text-[10px] tracking-wider block mb-1">
                          Concrete Experiment to Test:
                        </span>
                        <p className="text-sm font-semibold text-[#4A3E3E] leading-relaxed">
                          {action.changedExperimentText || action.experiment}
                        </p>
                        {action.changedExperimentText && (
                          <span className="inline-block mt-1 text-[10px] text-[#916E28] bg-[#FDF6E2] px-2 py-0.5 rounded-full">
                            Modified from original proposal
                          </span>
                        )}
                      </div>
                    )}

                    {/* Notes & Evidence */}
                    {action.notes && !isEditing && (
                      <div className="text-xs text-[#70665C] bg-[#F5F2ED] p-2.5 rounded-lg border border-[#E5E0D8]/60">
                        <span className="font-semibold text-[#4A3E3E] block mb-0.5">Notes:</span>
                        <p className="whitespace-pre-line">{action.notes}</p>
                      </div>
                    )}

                    {/* Evidence Quotes */}
                    {action.evidenceQuotes && action.evidenceQuotes.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A69D91] block mb-1.5">
                          Evidence from Reflections:
                        </span>
                        <div className="space-y-1">
                          {action.evidenceQuotes.map((q, idx) => (
                            <p
                              key={idx}
                              className="text-xs text-[#70665C] italic bg-[#FDFCF8] p-2 rounded-lg border border-[#E5E0D8]/60"
                            >
                              &bull; &ldquo;{q}&rdquo;
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions & Status Controls */}
                  <div className="mt-4 pt-3 border-t border-[#E5E0D8]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Status Toggle Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-[#A69D91] mr-1">Status:</span>

                      {action.status !== 'completed' && (
                        <button
                          onClick={() => openStatusChange(action, 'completed')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[#EBF3FA] text-[#3D688D] hover:bg-[#D0E2F2] border border-[#D0E2F2] transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          <span>Mark Completed</span>
                        </button>
                      )}

                      {action.status !== 'changed' && (
                        <button
                          onClick={() => openStatusChange(action, 'changed')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[#FDF6E2] text-[#916E28] hover:bg-[#F5E6B8] border border-[#F5E6B8] transition-colors"
                        >
                          <FileEdit className="w-3 h-3" />
                          <span>Mark Changed</span>
                        </button>
                      )}

                      {action.status !== 'abandoned' && (
                        <button
                          onClick={() => openStatusChange(action, 'abandoned')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-[#F5F2ED] text-[#70665C] hover:bg-[#EAE4DB] border border-[#E5E0D8] transition-colors"
                        >
                          <XCircle className="w-3 h-3 text-[#A69D91]" />
                          <span>Mark Abandoned</span>
                        </button>
                      )}

                      {(action.status === 'completed' || action.status === 'abandoned' || action.status === 'changed') && (
                        <button
                          onClick={() => onUpdateActionStatus(action.id, 'in_progress', { updatedAt: new Date().toISOString() })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-[#EAF2E8] text-[#55694F] hover:bg-[#D5E3D1] border border-[#D5E3D1] transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reopen (In Progress)</span>
                        </button>
                      )}
                    </div>

                    {/* Meta Controls: Edit, Open Thread, Delete */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {action.threadId && (
                        <button
                          onClick={() => onOpenThread(action.threadId!)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[#7A8D74] hover:bg-[#EAF2E8] rounded-full transition-colors font-medium"
                          title="View associated Thought Thread"
                        >
                          <span>View Thread</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}

                      {!isEditing && (
                        <button
                          onClick={() => {
                            setEditingActionId(action.id);
                            setEditExperimentText(action.changedExperimentText || action.experiment);
                            setEditNotes(action.notes || '');
                          }}
                          className="p-1.5 text-[#70665C] hover:text-[#4A3E3E] hover:bg-[#F5F2ED] rounded-lg transition-colors"
                          title="Edit experiment text"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (window.confirm('Delete this action experiment? Your original journal entries and thought threads will remain completely intact.')) {
                            onDeleteAction(action.id);
                          }
                        }}
                        className="p-1.5 text-[#9E4738] hover:bg-[#FBF2EF] rounded-lg transition-colors"
                        title="Delete experiment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status Change Confirmation Modal */}
      {statusModalAction && targetStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A3E3E]/50 backdrop-blur-xs">
          <div className="bg-[#FDFCF8] border border-[#E5E0D8] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E0D8]">
              <h3 className="font-serif italic font-semibold text-base text-[#4A3E3E]">
                {targetStatus === 'completed' && 'Complete Action Experiment'}
                {targetStatus === 'changed' && 'Modify Action Experiment'}
                {targetStatus === 'abandoned' && 'Set Aside Experiment'}
              </h3>
              <button
                onClick={() => {
                  setStatusModalAction(null);
                  setTargetStatus(null);
                }}
                className="text-[#70665C] hover:text-[#4A3E3E]"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#70665C]">
              Experiment: <strong>{statusModalAction.changedExperimentText || statusModalAction.experiment}</strong>
            </p>

            {targetStatus === 'changed' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#4A3E3E] block">
                  How did you modify this experiment?
                </label>
                <textarea
                  value={changedExperimentInput}
                  onChange={(e) => setChangedExperimentInput(e.target.value)}
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#D5CEC2] bg-white focus:outline-none focus:border-[#7A8D74]"
                  placeholder="Describe your adapted or updated experiment..."
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#4A3E3E] block">
                {targetStatus === 'completed' && 'What did you discover or observe? (optional)'}
                {targetStatus === 'changed' && 'Why was it changed? (optional)'}
                {targetStatus === 'abandoned' && 'Why are you setting this aside? (optional)'}
              </label>
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl border border-[#D5CEC2] bg-white focus:outline-none focus:border-[#7A8D74]"
                placeholder="Add your reflections here..."
              />
            </div>

            <div className="flex items-center gap-2 justify-end pt-2">
              <button
                onClick={() => {
                  setStatusModalAction(null);
                  setTargetStatus(null);
                }}
                className="px-4 py-1.5 text-xs text-[#70665C] hover:bg-[#EAE4DB] rounded-full"
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={updatingId === statusModalAction.id}
                className="px-4 py-1.5 text-xs font-semibold rounded-full bg-[#7A8D74] text-white hover:bg-[#687963] transition-colors"
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
