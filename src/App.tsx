import React, { useState, useEffect } from 'react';
import {
  auth,
  db,
  logoutUser,
  onAuthStateChanged,
  validateFirestoreConnection,
  handleFirestoreError,
} from './firebase';
import { doc, setDoc, deleteDoc, collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { AuthLanding } from './components/AuthLanding';
import { Navbar } from './components/Navbar';
import { JournalList } from './components/JournalList';
import { JournalEditor } from './components/JournalEditor';
import { ThoughtThreadsView } from './components/ThoughtThreadsView';
import { UnfinishedThoughtsView } from './components/UnfinishedThoughtsView';
import { PerspectiveReplayModal } from './components/PerspectiveReplayModal';
import { ActionExperimentsView } from './components/ActionExperimentsView';
import { InsightToActionModal } from './components/InsightToActionModal';
import { MemoryControlCenter } from './components/MemoryControlCenter';
import {
  AuthUserProfile,
  JournalEntry,
  ThoughtThread,
  UnfinishedThought,
  PerspectiveReplay,
  ActionExperiment,
  ActionExperimentStatus,
  OperationType,
  AIMemory,
  AIMemoryStatus,
  UserMemorySettings,
} from './types';
import { sanitizeForFirestore } from './utils/sanitize';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Thought Threads state
  const [threads, setThreads] = useState<ThoughtThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'reflections' | 'threads' | 'unfinished' | 'actions' | 'memory'>('reflections');
  const [isAnalyzingThread, setIsAnalyzingThread] = useState(false);
  const [syncingAllThreads, setSyncingAllThreads] = useState(false);

  // Unfinished Thoughts state
  const [unfinishedThoughts, setUnfinishedThoughts] = useState<UnfinishedThought[]>([]);
  const [unfinishedLoading, setUnfinishedLoading] = useState(false);
  const [scanningThoughts, setScanningThoughts] = useState(false);
  const [activeExploringThoughtId, setActiveExploringThoughtId] = useState<string | null>(null);

  // Perspective Replays state
  const [replays, setReplays] = useState<PerspectiveReplay[]>([]);
  const [replayModalOpen, setReplayModalOpen] = useState(false);
  const [replayTargetEntry, setReplayTargetEntry] = useState<JournalEntry | null>(null);

  // Insight -> Action state
  const [actions, setActions] = useState<ActionExperiment[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionModalThread, setActionModalThread] = useState<ThoughtThread | null>(null);
  const [actionModalEntries, setActionModalEntries] = useState<JournalEntry[]>([]);

  // AI Memory Control Center state
  const [memories, setMemories] = useState<AIMemory[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memorySettings, setMemorySettings] = useState<UserMemorySettings>({
    id: 'global',
    userId: '',
    memoryCreationEnabled: true,
    updatedAt: new Date().toISOString(),
  });
  const [isExtractingMemories, setIsExtractingMemories] = useState(false);

  // Validate Firestore connectivity once on boot
  useEffect(() => {
    validateFirestoreConnection();
  }, []);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        });
      } else {
        setCurrentUser(null);
        setEntries([]);
        setSelectedEntry(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to user's isolated Firestore entries collection
  useEffect(() => {
    if (!currentUser) return;

    setEntriesLoading(true);
    const entriesPath = `users/${currentUser.uid}/entries`;
    const entriesRef = collection(db, 'users', currentUser.uid, 'entries');

    const unsubscribe = onSnapshot(
      entriesRef,
      (snapshot) => {
        const loadedEntries: JournalEntry[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as JournalEntry;
          loadedEntries.push({
            ...data,
            id: docSnap.id,
          });
        });

        // Sort descending by updatedAt or createdAt
        loadedEntries.sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.createdAt).getTime();
          const timeB = new Date(b.updatedAt || b.createdAt).getTime();
          return timeB - timeA;
        });

        setEntries(loadedEntries);
        setEntriesLoading(false);

        // Auto-select first entry if none selected or update active reference
        setSelectedEntry((current) => {
          if (!current && loadedEntries.length > 0) {
            return loadedEntries[0];
          }
          if (current) {
            const fresh = loadedEntries.find((e) => e.id === current.id);
            return fresh || current;
          }
          return null;
        });
      },
      (error) => {
        console.error('Snapshot listener error:', error);
        setEntriesLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, entriesPath);
        } catch (e: any) {
          setSaveError('Failed to synchronize reflections from cloud database.');
        }
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Subscribe to user's isolated Firestore Thought Threads collection
  useEffect(() => {
    if (!currentUser) return;

    setThreadsLoading(true);
    const threadsPath = `users/${currentUser.uid}/threads`;
    const threadsRef = collection(db, 'users', currentUser.uid, 'threads');

    const unsubscribe = onSnapshot(
      threadsRef,
      (snapshot) => {
        const loadedThreads: ThoughtThread[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as ThoughtThread;
          loadedThreads.push({
            ...data,
            id: docSnap.id,
          });
        });

        // Sort descending by latest activity date
        loadedThreads.sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.startedAt).getTime();
          const timeB = new Date(b.updatedAt || b.startedAt).getTime();
          return timeB - timeA;
        });

        setThreads(loadedThreads);
        setThreadsLoading(false);

        // Keep selected thread valid
        setSelectedThreadId((current) => {
          if (current && loadedThreads.some((t) => t.id === current)) {
            return current;
          }
          return loadedThreads.length > 0 ? loadedThreads[0].id : null;
        });
      },
      (error) => {
        console.error('Threads listener error:', error);
        setThreadsLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, threadsPath);
        } catch (e: any) {
          console.warn('Failed to synchronize thought threads:', e);
        }
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Synchronize Unfinished Thoughts from Firestore
  useEffect(() => {
    if (!currentUser) {
      setUnfinishedThoughts([]);
      return;
    }

    setUnfinishedLoading(true);
    const thoughtsPath = `users/${currentUser.uid}/unfinished_thoughts`;
    const thoughtsRef = collection(db, 'users', currentUser.uid, 'unfinished_thoughts');

    const unsubscribe = onSnapshot(
      thoughtsRef,
      (snapshot) => {
        const list: UnfinishedThought[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as UnfinishedThought;
          list.push({
            ...data,
            id: docSnap.id,
          });
        });

        // Sort by dateFirstMentioned descending
        list.sort((a, b) => new Date(b.dateFirstMentioned).getTime() - new Date(a.dateFirstMentioned).getTime());
        setUnfinishedThoughts(list);
        setUnfinishedLoading(false);
      },
      (error) => {
        console.error('Unfinished thoughts listener error:', error);
        setUnfinishedLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, thoughtsPath);
        } catch (e: any) {
          console.warn('Failed to listen to unfinished thoughts:', e);
        }
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Synchronize Perspective Replays from Firestore
  useEffect(() => {
    if (!currentUser) {
      setReplays([]);
      return;
    }

    const replaysPath = `users/${currentUser.uid}/replays`;
    const replaysRef = collection(db, 'users', currentUser.uid, 'replays');

    const unsubscribe = onSnapshot(
      replaysRef,
      (snapshot) => {
        const list: PerspectiveReplay[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as PerspectiveReplay;
          list.push({
            ...data,
            id: docSnap.id,
          });
        });

        // Sort by replayDate descending
        list.sort((a, b) => new Date(b.replayDate).getTime() - new Date(a.replayDate).getTime());
        setReplays(list);
      },
      (error) => {
        console.error('Replays listener error:', error);
        try {
          handleFirestoreError(error, OperationType.LIST, replaysPath);
        } catch (e: any) {
          console.warn('Failed to listen to perspective replays:', e);
        }
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Synchronize Action Experiments from Firestore
  useEffect(() => {
    if (!currentUser) {
      setActions([]);
      return;
    }

    setActionsLoading(true);
    const actionsPath = `users/${currentUser.uid}/actions`;
    const actionsRef = collection(db, 'users', currentUser.uid, 'actions');

    const unsubscribe = onSnapshot(
      actionsRef,
      (snapshot) => {
        const list: ActionExperiment[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as ActionExperiment;
          list.push({
            ...data,
            id: docSnap.id,
          });
        });

        // Sort by createdAt descending
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setActions(list);
        setActionsLoading(false);
      },
      (error) => {
        console.error('Actions listener error:', error);
        setActionsLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, actionsPath);
        } catch (e: any) {
          console.warn('Failed to listen to actions:', e);
        }
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Synchronize AI Memories from Firestore
  useEffect(() => {
    if (!currentUser) {
      setMemories([]);
      return;
    }

    setMemoriesLoading(true);
    const memoriesPath = `users/${currentUser.uid}/ai_memories`;
    const memoriesRef = collection(db, 'users', currentUser.uid, 'ai_memories');

    const unsubscribe = onSnapshot(
      memoriesRef,
      (snapshot) => {
        const list: AIMemory[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as AIMemory;
          list.push({
            ...data,
            id: docSnap.id,
          });
        });

        // Sort descending by createdAt
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setMemories(list);
        setMemoriesLoading(false);
      },
      (error) => {
        console.error('Memories listener error:', error);
        setMemoriesLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, memoriesPath);
        } catch (e: any) {
          console.warn('Failed to listen to ai_memories:', e);
        }
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Synchronize User Memory Settings from Firestore
  useEffect(() => {
    if (!currentUser) {
      setMemorySettings({
        id: 'global',
        userId: '',
        memoryCreationEnabled: true,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const settingsRef = doc(db, 'users', currentUser.uid, 'memory_settings', 'global');
    const unsubscribe = onSnapshot(
      settingsRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setMemorySettings(docSnap.data() as UserMemorySettings);
        } else {
          setMemorySettings({
            id: 'global',
            userId: currentUser.uid,
            memoryCreationEnabled: true,
            updatedAt: new Date().toISOString(),
          });
        }
      },
      (error) => {
        console.warn('Memory settings listener error:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // AI Memory Handlers
  const handleToggleMemoryStatus = async (memoryId: string, newStatus: AIMemoryStatus) => {
    if (!currentUser) return;
    try {
      const memoryDocRef = doc(db, 'users', currentUser.uid, 'ai_memories', memoryId);
      await setDoc(
        memoryDocRef,
        sanitizeForFirestore({
          status: newStatus,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
    } catch (err: any) {
      console.error('Failed to update memory status:', err);
      throw err;
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!currentUser) return;
    try {
      // 1. Delete memory doc from Firestore
      await deleteDoc(doc(db, 'users', currentUser.uid, 'ai_memories', memoryId));

      // 2. Query and delete corresponding embedding records if any exist
      try {
        const embeddingsRef = collection(db, 'users', currentUser.uid, 'memory_embeddings');
        const q = query(embeddingsRef, where('memoryId', '==', memoryId));
        const qSnap = await getDocs(q);
        const deletePromises: Promise<void>[] = [];
        qSnap.forEach((d) => deletePromises.push(deleteDoc(d.ref)));
        await Promise.all(deletePromises);
      } catch (embErr) {
        console.warn('Note: embeddings cleanup encountered:', embErr);
      }
    } catch (err: any) {
      console.error('Failed to delete memory:', err);
      throw err;
    }
  };

  const handleDeleteAllMemories = async () => {
    if (!currentUser) return;
    try {
      const memRef = collection(db, 'users', currentUser.uid, 'ai_memories');
      const memSnap = await getDocs(memRef);
      const deletePromises: Promise<void>[] = [];
      memSnap.forEach((d) => deletePromises.push(deleteDoc(d.ref)));

      const embRef = collection(db, 'users', currentUser.uid, 'memory_embeddings');
      const embSnap = await getDocs(embRef);
      embSnap.forEach((d) => deletePromises.push(deleteDoc(d.ref)));

      await Promise.all(deletePromises);
    } catch (err: any) {
      console.error('Failed to delete all memories:', err);
      throw err;
    }
  };

  const handleToggleMemoryCreation = async (enabled: boolean) => {
    if (!currentUser) return;
    try {
      const settingsRef = doc(db, 'users', currentUser.uid, 'memory_settings', 'global');
      await setDoc(
        settingsRef,
        sanitizeForFirestore({
          id: 'global',
          userId: currentUser.uid,
          memoryCreationEnabled: enabled,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
    } catch (err: any) {
      console.error('Failed to update memory settings:', err);
      throw err;
    }
  };

  const handleToggleEntryAIExclusion = async (entryId: string, excluded: boolean) => {
    if (!currentUser) return;
    try {
      const entryRef = doc(db, 'users', currentUser.uid, 'entries', entryId);
      await setDoc(
        entryRef,
        sanitizeForFirestore({
          excludedFromAI: excluded,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );

      // If excluding an entry, automatically update any associated memories from this entry to 'excluded'
      if (excluded) {
        const associatedMemories = memories.filter((m) => m.sourceId === entryId);
        for (const mem of associatedMemories) {
          if (mem.status !== 'excluded') {
            await handleToggleMemoryStatus(mem.id, 'excluded');
          }
        }
      }

      // Update local selected entry if it matches
      setSelectedEntry((current) => {
        if (current && current.id === entryId) {
          return {
            ...current,
            excludedFromAI: excluded,
            updatedAt: new Date().toISOString(),
          };
        }
        return current;
      });
    } catch (err: any) {
      console.error('Failed to toggle AI exclusion for entry:', err);
      setSaveError('Failed to update AI exclusion preference in Firestore.');
    }
  };

  const handleExtractMemories = async (targetEntry: JournalEntry) => {
    if (!currentUser) return;
    if (!memorySettings.memoryCreationEnabled) {
      alert('AI Memory Creation is currently disabled in your Settings → AI Memory. Please re-enable it to extract new memories.');
      return;
    }
    if (targetEntry.excludedFromAI) {
      alert('This reflection is marked as "Excluded from AI". Remove the exclusion before extracting memories.');
      return;
    }

    setIsExtractingMemories(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const resp = await fetch('/api/memory/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          entryId: targetEntry.id,
          entryTitle: targetEntry.title,
          content: [
            targetEntry.title,
            targetEntry.summary || '',
            ...(targetEntry.messages || []).map((m) => `${m.role}: ${m.content}`),
          ].join('\n\n'),
          category: targetEntry.category,
          threadId: targetEntry.threadId || undefined,
          threadTitle: threads.find((t) => t.id === targetEntry.threadId)?.title || undefined,
          tags: targetEntry.tags || [],
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to extract memories');
      }

      const data = await resp.json();
      const newMemories: any[] = data.memories || [];

      if (newMemories.length === 0) {
        alert('Gemini analyzed this reflection, but found no new distinctive long-term facts or patterns to store.');
        return;
      }

      // Save each extracted memory to Firestore under user isolation
      for (const mem of newMemories) {
        const memId = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const memDoc: AIMemory = {
          id: memId,
          userId: currentUser.uid,
          sourceType: 'journal_entry',
          fact: mem.fact || mem.content || '',
          category: mem.category || 'personal_growth',
          status: 'active',
          sourceId: targetEntry.id,
          sourceTitle: targetEntry.title,
          threadId: targetEntry.threadId || null,
          threadTitle: threads.find((t) => t.id === targetEntry.threadId)?.title || null,
          hasEmbedding: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await setDoc(
          doc(db, 'users', currentUser.uid, 'ai_memories', memId),
          sanitizeForFirestore(memDoc)
        );
      }
    } catch (err: any) {
      console.error('Failed to extract memories:', err);
      alert(`Could not extract memories: ${err.message}`);
    } finally {
      setIsExtractingMemories(false);
    }
  };

  // Save newly created or accepted Action Experiment to Firestore
  const handleSaveAction = async (actionData: Partial<ActionExperiment>) => {
    if (!currentUser) return;

    const actionId = actionData.id || `action-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const actionPath = `users/${currentUser.uid}/actions/${actionId}`;
    const actionRef = doc(db, 'users', currentUser.uid, 'actions', actionId);

    try {
      const fullAction: ActionExperiment = {
        id: actionId,
        userId: currentUser.uid,
        insight: actionData.insight || '',
        experiment: actionData.experiment || '',
        timeframe: actionData.timeframe || 'Next 24 hours',
        notes: actionData.notes || null,
        evidenceQuotes: actionData.evidenceQuotes || [],
        threadId: actionData.threadId || null,
        threadTitle: actionData.threadTitle || null,
        entryIds: actionData.entryIds || actionData.relatedEntryIds || [],
        relatedEntryIds: actionData.relatedEntryIds || actionData.entryIds || [],
        status: actionData.status || 'accepted',
        createdAt: actionData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: actionData.completedAt || null,
        changedExperimentText: actionData.changedExperimentText || null,
      };

      const sanitized = sanitizeForFirestore(fullAction);
      await setDoc(actionRef, sanitized);
    } catch (error) {
      console.error('Error saving action experiment:', error);
      handleFirestoreError(error, OperationType.WRITE, actionPath);
      throw error;
    }
  };

  // Update status of an Action Experiment (completed, changed, abandoned, in_progress)
  const handleUpdateActionStatus = async (
    actionId: string,
    status: ActionExperimentStatus,
    extraUpdates: Partial<ActionExperiment> = {}
  ) => {
    if (!currentUser) return;

    const actionPath = `users/${currentUser.uid}/actions/${actionId}`;
    const actionRef = doc(db, 'users', currentUser.uid, 'actions', actionId);

    try {
      const existing = actions.find((a) => a.id === actionId);
      if (!existing) return;

      const updated: ActionExperiment = {
        ...existing,
        ...extraUpdates,
        status,
        updatedAt: new Date().toISOString(),
      };

      const sanitized = sanitizeForFirestore(updated);
      await setDoc(actionRef, sanitized);
    } catch (error) {
      console.error('Error updating action status:', error);
      handleFirestoreError(error, OperationType.WRITE, actionPath);
      throw error;
    }
  };

  // Delete an Action Experiment
  const handleDeleteAction = async (actionId: string) => {
    if (!currentUser) return;

    const actionPath = `users/${currentUser.uid}/actions/${actionId}`;
    const actionRef = doc(db, 'users', currentUser.uid, 'actions', actionId);

    try {
      await deleteDoc(actionRef);
    } catch (error) {
      console.error('Error deleting action experiment:', error);
      handleFirestoreError(error, OperationType.DELETE, actionPath);
      throw error;
    }
  };

  // Trigger Action Modal for a thread
  const handleOpenActionModal = (thread: ThoughtThread) => {
    setActionModalThread(thread);
    const threadEntries = entries.filter((e) => e.threadId === thread.id);
    setActionModalEntries(threadEntries.length > 0 ? threadEntries : entries);
    setActionModalOpen(true);
  };

  // Save Perspective Replay to Firestore (Never overwriting the original entry)
  const handleSaveReplay = async (replay: PerspectiveReplay, createAsJournalEntry = false) => {
    if (!currentUser) return;

    const replayPath = `users/${currentUser.uid}/replays/${replay.id}`;
    const replayRef = doc(db, 'users', currentUser.uid, 'replays', replay.id);

    try {
      // 1. Sanitize replay payload
      const sanitizedReplay = sanitizeForFirestore({
        ...replay,
        userId: currentUser.uid,
      });

      // 2. Persist to Firestore replay collection
      await setDoc(replayRef, sanitizedReplay);

      // 3. If requested, also create a separate reflection journal entry without modifying original
      if (createAsJournalEntry) {
        const replayEntryId = `entry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const replayEntryRef = doc(db, 'users', currentUser.uid, 'entries', replayEntryId);
        const newEntry: JournalEntry = {
          id: replayEntryId,
          userId: currentUser.uid,
          title: `Perspective Replay: ${replay.originalEntryTitle}`,
          category: 'reflection',
          tags: ['PerspectiveReplay', 'Reflection'],
          createdAt: replay.replayDate,
          updatedAt: replay.replayDate,
          messages: [
            {
              id: `msg-${Date.now()}-assistant`,
              role: 'assistant',
              content: `## 🔄 Perspective Replay\n\n**Replaying Thought from**: ${replay.originalEntryDate} — &ldquo;${replay.originalEntryTitle}&rdquo;\n**Reflection Question**: *${replay.reflectionQuestion}*\n\n---\n\n### 📜 What I Thought Then\n${replay.originalPerspective}\n\n### 🧭 What I Think Now\n${replay.currentPerspective}\n\n---\n\n### ⚖️ Perspective Shift Analysis\n- **What Changed**: ${replay.whatChanged}\n- **What Stayed Consistent**: ${replay.whatStayedConsistent}\n${replay.possibleReasons ? `- **Supported Reasons for Change**: ${replay.possibleReasons}\n` : ''}${replay.newInsight ? `\n> **Emergent Insight**: ${replay.newInsight}\n` : ''}`,
              timestamp: replay.replayDate,
            },
          ],
          summary: `Perspective Replay of "${replay.originalEntryTitle}". Shift: ${replay.whatChanged.slice(0, 160)}... Consistent: ${replay.whatStayedConsistent.slice(0, 120)}...`,
        };

        const sanitizedEntry = sanitizeForFirestore(newEntry);
        await setDoc(replayEntryRef, sanitizedEntry);
      }
    } catch (err: any) {
      console.error('Error saving perspective replay:', err);
      handleFirestoreError(err, OperationType.WRITE, replayPath);
      throw err;
    }
  };

  // Create New Journal Entry
  const handleNewEntry = () => {
    if (!currentUser) return;

    const newId = `entry-${Date.now()}`;
    const newEntry: JournalEntry = {
      id: newId,
      userId: currentUser.uid,
      title: 'New Reflection',
      category: 'reflection',
      messages: [],
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSelectedEntry(newEntry);
  };

  // Save / Update Journal Entry in Firestore
  const handleSaveEntry = async (entryToSave: JournalEntry) => {
    if (!currentUser) return;

    setSaving(true);
    setSaveError(null);

    const docPath = `users/${currentUser.uid}/entries/${entryToSave.id}`;

    try {
      // 1. Strict Undefined-Stripping (Zero-Crash Payload Hygiene)
      const sanitizedPayload = sanitizeForFirestore({
        ...entryToSave,
        userId: currentUser.uid,
        updatedAt: new Date().toISOString(),
      });

      // 2. Guaranteed Transaction Verification
      const entryRef = doc(db, 'users', currentUser.uid, 'entries', entryToSave.id);
      await setDoc(entryRef, sanitizedPayload, { merge: true });

      // Update local state smoothly
      setSelectedEntry(sanitizedPayload as JournalEntry);
    } catch (error: any) {
      console.error('Firestore save failed:', error);
      setSaveError(error?.message || 'Database write failed. Click Retry to re-attempt.');
      try {
        handleFirestoreError(error, OperationType.WRITE, docPath);
      } catch {
        // Handled via state banner
      }
      throw error;
    } finally {
      setSaving(false);
    }
  };

  // Associate Journal Entry with Thought Thread using Gemini
  const handleAssociateWithThread = async (
    entryToClassify: JournalEntry,
    activeThreadsPool?: ThoughtThread[]
  ): Promise<ThoughtThread | null> => {
    if (!currentUser || !auth.currentUser) return null;

    const hasContent =
      (entryToClassify.summary && entryToClassify.summary.trim().length > 0) ||
      (entryToClassify.messages && entryToClassify.messages.length > 0) ||
      (entryToClassify.title && entryToClassify.title.trim().length > 0 && entryToClassify.title !== 'New Reflection');

    if (!hasContent) return null;

    setIsAnalyzingThread(true);
    try {
      // Obtain secure Firebase ID token
      const idToken = await auth.currentUser.getIdToken();

      const currentThreadsList = activeThreadsPool || threads;

      // Prepare existing threads context (strictly for the current user)
      const existingThreadsPayload = currentThreadsList.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        entryIds: t.entryIds,
        sampleSummaries: entries
          .filter((e) => t.entryIds.includes(e.id))
          .map((e) => {
            const txt = e.summary || (e.messages && e.messages[0]?.content) || '';
            return `Title: ${e.title} | Context: ${txt.slice(0, 180)}`;
          })
          .slice(0, 4),
      }));

      // Extract rich representation (summary, or multi-turn messages, or title)
      const contentSnippet = entryToClassify.summary?.trim()
        ? entryToClassify.summary.trim()
        : (entryToClassify.messages || [])
            .map((m) => `${m.role === 'user' ? 'User' : 'Reflection'}: ${m.content}`)
            .join('\n\n')
            .slice(0, 3500) || entryToClassify.title;

      const response = await fetch('/api/gemini/threads/classify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          newEntry: {
            id: entryToClassify.id,
            title: entryToClassify.title || 'Personal Reflection',
            summary: contentSnippet,
            content: contentSnippet,
            date: entryToClassify.updatedAt || entryToClassify.createdAt,
          },
          existingThreads: existingThreadsPayload,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to classify thought thread.');
      }

      const result = await response.json();
      const nowIso = new Date().toISOString();

      if (result.action === 'match' && result.matchedThreadId) {
        // Find existing matched thread
        const matchedThread = currentThreadsList.find((t) => t.id === result.matchedThreadId);
        if (matchedThread) {
          const updatedEntryIds = Array.from(
            new Set([...matchedThread.entryIds, entryToClassify.id])
          );

          const updatedThread: ThoughtThread = {
            ...matchedThread,
            title: result.title || matchedThread.title,
            description: result.description || matchedThread.description,
            entryIds: updatedEntryIds,
            entryCount: updatedEntryIds.length,
            updatedAt: nowIso,
          };

          const threadRef = doc(db, 'users', currentUser.uid, 'threads', matchedThread.id);
          await setDoc(threadRef, sanitizeForFirestore(updatedThread), { merge: true });

          // Update entry reference to point to this thread
          const updatedEntry: JournalEntry = {
            ...entryToClassify,
            threadId: matchedThread.id,
          };
          const entryRef = doc(db, 'users', currentUser.uid, 'entries', entryToClassify.id);
          await setDoc(entryRef, sanitizeForFirestore(updatedEntry), { merge: true });
          if (selectedEntry?.id === entryToClassify.id) {
            setSelectedEntry(updatedEntry);
          }
          return updatedThread;
        }
      }

      // Action is "create" or matched thread not found
      const newThreadId = `thread-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newThread: ThoughtThread = {
        id: newThreadId,
        userId: currentUser.uid,
        title: result.title || entryToClassify.title || 'New Thought Thread',
        description: result.description || 'Evolving reflection thread.',
        entryIds: [entryToClassify.id],
        entryCount: 1,
        startedAt: entryToClassify.createdAt || nowIso,
        updatedAt: nowIso,
      };

      const threadRef = doc(db, 'users', currentUser.uid, 'threads', newThreadId);
      await setDoc(threadRef, sanitizeForFirestore(newThread));

      // Update entry reference
      const updatedEntry: JournalEntry = {
        ...entryToClassify,
        threadId: newThreadId,
      };
      const entryRef = doc(db, 'users', currentUser.uid, 'entries', entryToClassify.id);
      await setDoc(entryRef, sanitizeForFirestore(updatedEntry), { merge: true });
      if (selectedEntry?.id === entryToClassify.id) {
        setSelectedEntry(updatedEntry);
      }
      setSelectedThreadId(newThreadId);
      return newThread;
    } catch (err) {
      console.error('Thought thread classification error:', err);
      return null;
    } finally {
      setIsAnalyzingThread(false);
    }
  };

  // Sync / Re-evaluate all reflections into Thought Threads
  const handleSyncAllThreads = async () => {
    if (!currentUser || syncingAllThreads) return;

    setSyncingAllThreads(true);
    try {
      // Find all reflections with content that are not currently linked to an existing thread
      const unlinkedEntries = entries.filter(
        (e) =>
          ((e.messages && e.messages.length > 0) || (e.summary && e.summary.trim().length > 0) || (e.title && e.title !== 'New Reflection' && e.title !== 'Untitled Reflection')) &&
          (!e.threadId || !threads.some((t) => t.id === e.threadId))
      );

      if (unlinkedEntries.length === 0) {
        return;
      }

      // Maintain in-flight threads list so consecutive items can link together
      const currentThreadsList = [...threads];

      for (const entry of unlinkedEntries) {
        const resultingThread = await handleAssociateWithThread(entry, currentThreadsList);
        if (resultingThread) {
          const existingIdx = currentThreadsList.findIndex((t) => t.id === resultingThread.id);
          if (existingIdx >= 0) {
            currentThreadsList[existingIdx] = resultingThread;
          } else {
            currentThreadsList.push(resultingThread);
          }
        }
      }
    } catch (err) {
      console.error('Error syncing all threads:', err);
    } finally {
      setSyncingAllThreads(false);
    }
  };

  // Delete Thread (Preserves original journal entries intact)
  const handleDeleteThread = async (threadId: string) => {
    if (!currentUser) return;

    const docPath = `users/${currentUser.uid}/threads/${threadId}`;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'threads', threadId));
      if (selectedThreadId === threadId) {
        const remaining = threads.filter((t) => t.id !== threadId);
        setSelectedThreadId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (error: any) {
      console.error('Delete thread error:', error);
      try {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      } catch (err) {
        // error handling
      }
    }
  };

  // Delete Entry
  const handleDeleteEntry = async (entryId: string) => {
    if (!currentUser) return;

    const docPath = `users/${currentUser.uid}/entries/${entryId}`;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'entries', entryId));
      if (selectedEntry?.id === entryId) {
        setSelectedEntry(null);
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      try {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      } catch (err) {
        setSaveError('Failed to delete reflection from Firestore.');
      }
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Mark Unfinished Thought as Resolved
  const handleMarkThoughtResolved = async (thoughtId: string) => {
    if (!currentUser) return;
    const docPath = `users/${currentUser.uid}/unfinished_thoughts/${thoughtId}`;
    try {
      const now = new Date().toISOString();
      const thoughtRef = doc(db, 'users', currentUser.uid, 'unfinished_thoughts', thoughtId);
      await setDoc(
        thoughtRef,
        sanitizeForFirestore({
          status: 'resolved',
          resolvedAt: now,
          updatedAt: now,
        }),
        { merge: true }
      );
    } catch (error: any) {
      console.error('Resolve thought error:', error);
      try {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      } catch (err) {
        setSaveError('Failed to mark thought as resolved in Firestore.');
      }
    }
  };

  // Dismiss Unfinished Thought
  const handleDismissThought = async (thoughtId: string) => {
    if (!currentUser) return;
    const docPath = `users/${currentUser.uid}/unfinished_thoughts/${thoughtId}`;
    try {
      const now = new Date().toISOString();
      const thoughtRef = doc(db, 'users', currentUser.uid, 'unfinished_thoughts', thoughtId);
      await setDoc(
        thoughtRef,
        sanitizeForFirestore({
          status: 'dismissed',
          updatedAt: now,
        }),
        { merge: true }
      );
    } catch (error: any) {
      console.error('Dismiss thought error:', error);
      try {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      } catch (err) {
        setSaveError('Failed to dismiss thought in Firestore.');
      }
    }
  };

  // Snooze / Remind Later for Unfinished Thought
  const handleRemindLater = async (thoughtId: string) => {
    if (!currentUser) return;
    const docPath = `users/${currentUser.uid}/unfinished_thoughts/${thoughtId}`;
    try {
      const now = new Date().toISOString();
      const remindDate = new Date(Date.now() + 7 * 86400000).toISOString();
      const thoughtRef = doc(db, 'users', currentUser.uid, 'unfinished_thoughts', thoughtId);
      await setDoc(
        thoughtRef,
        sanitizeForFirestore({
          status: 'snoozed',
          remindAt: remindDate,
          updatedAt: now,
        }),
        { merge: true }
      );
    } catch (error: any) {
      console.error('Snooze thought error:', error);
      try {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      } catch (err) {
        setSaveError('Failed to snooze thought in Firestore.');
      }
    }
  };

  // Reactivate Unfinished Thought
  const handleReactivateThought = async (thoughtId: string) => {
    if (!currentUser) return;
    const docPath = `users/${currentUser.uid}/unfinished_thoughts/${thoughtId}`;
    try {
      const now = new Date().toISOString();
      const thoughtRef = doc(db, 'users', currentUser.uid, 'unfinished_thoughts', thoughtId);
      await setDoc(
        thoughtRef,
        sanitizeForFirestore({
          status: 'active',
          resolvedAt: null,
          remindAt: null,
          updatedAt: now,
        }),
        { merge: true }
      );
    } catch (error: any) {
      console.error('Reactivate thought error:', error);
      try {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      } catch (err) {
        setSaveError('Failed to reactivate thought in Firestore.');
      }
    }
  };

  // Explore Unfinished Thought in a dedicated Gemini Reflection session
  const handleExploreThought = async (thought: UnfinishedThought) => {
    if (!currentUser) return;
    setActiveExploringThoughtId(thought.id);

    const newId = `entry-${Date.now()}`;
    const explorationPrompt = `I want to revisit and explore this unfinished thought from ${thought.dateFirstMentioned}:\n\n**Topic:** ${thought.title}\n\n**Original Context:** "${thought.originalContext}"\n\n**Context / Open Question:** ${thought.whyUnfinished}\n\nCan you help me explore next steps, evaluate my options, and figure out how to resolve or move forward with this?`;

    const initialMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user' as const,
      content: explorationPrompt,
      timestamp: new Date().toISOString(),
    };

    const newEntry: JournalEntry = {
      id: newId,
      userId: currentUser.uid,
      title: `Exploring: ${thought.title}`,
      category: 'reflection',
      messages: [initialMessage],
      tags: ['unfinished-thought', 'exploration'],
      threadId: thought.threadId || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Immediately save to Firestore
    const entryRef = doc(db, 'users', currentUser.uid, 'entries', newId);
    await setDoc(entryRef, sanitizeForFirestore(newEntry));

    setSelectedEntry(newEntry);
    setActiveView('reflections');

    // 2. Automatically request Gemini's initial deep perspective
    try {
      const response = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: explorationPrompt,
          history: [],
          title: newEntry.title,
          category: newEntry.category,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant' as const,
          content: data.reply,
          timestamp: new Date().toISOString(),
          modelUsed: data.modelUsed,
        };

        const updatedEntryWithReply: JournalEntry = {
          ...newEntry,
          messages: [...newEntry.messages, assistantMessage],
          updatedAt: new Date().toISOString(),
        };

        await setDoc(entryRef, sanitizeForFirestore(updatedEntryWithReply));
        setSelectedEntry(updatedEntryWithReply);
      }
    } catch (genErr) {
      console.warn('Exploration initial response notice:', genErr);
    }
  };

  // Scan & Analyze Unfinished Thoughts via Gemini
  const handleScanUnfinishedThoughts = async () => {
    if (!currentUser || !auth.currentUser || scanningThoughts) return;
    setScanningThoughts(true);

    try {
      const idToken = await auth.currentUser.getIdToken();

      const entriesPayload = entries.map((e) => ({
        id: e.id,
        title: e.title,
        summary: e.summary || (e.messages && e.messages[0]?.content) || '',
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        threadId: e.threadId,
      }));

      const threadsPayload = threads.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        entryCount: t.entryCount,
      }));

      const existingThoughtsPayload = unfinishedThoughts.map((ut) => ({
        id: ut.id,
        title: ut.title,
        status: ut.status,
        entryId: ut.entryId,
      }));

      const response = await fetch('/api/gemini/unfinished-thoughts/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          entries: entriesPayload,
          threads: threadsPayload,
          existingThoughts: existingThoughtsPayload,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to scan for unfinished thoughts.');
      }

      const data = await response.json();
      const detectedItems: any[] = Array.isArray(data.unfinishedThoughts)
        ? data.unfinishedThoughts
        : [];

      const nowIso = new Date().toISOString();

      for (const item of detectedItems) {
        // Prevent duplicate creation
        const existing = unfinishedThoughts.find(
          (ut) => ut.entryId === item.entryId && ut.title.toLowerCase() === item.title.toLowerCase()
        );

        if (!existing) {
          const thoughtId = `thought-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const newThought: UnfinishedThought = {
            id: thoughtId,
            userId: currentUser.uid,
            title: item.title,
            originalContext: item.originalContext,
            dateFirstMentioned: item.dateFirstMentioned || nowIso,
            entryId: item.entryId,
            threadId: item.threadId || null,
            threadTitle: item.threadTitle || null,
            whyUnfinished: item.whyUnfinished,
            status: 'active',
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          const docRef = doc(db, 'users', currentUser.uid, 'unfinished_thoughts', thoughtId);
          await setDoc(docRef, sanitizeForFirestore(newThought));
        }
      }
    } catch (err: any) {
      console.error('Scan unfinished thoughts error:', err);
    } finally {
      setScanningThoughts(false);
    }
  };

  // Initial Auth Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FDFCF8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-[#E5E0D8] border-t-[#7A8D74] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#70665C] font-medium tracking-wide">
            Verifying authentication state...
          </p>
        </div>
      </div>
    );
  }

  // If not logged in, show Auth Landing
  if (!currentUser) {
    return <AuthLanding />;
  }

  const activeConnectedThread = selectedEntry?.threadId
    ? threads.find((t) => t.id === selectedEntry.threadId) || null
    : null;

  const activeRelatedUnfinishedThought = selectedEntry
    ? unfinishedThoughts.find(
        (t) =>
          t.id === activeExploringThoughtId ||
          t.entryId === selectedEntry.id ||
          (selectedEntry.tags && selectedEntry.tags.includes('unfinished-thought') && selectedEntry.title.includes(t.title))
      ) || null
    : null;

  // If logged in, show Private Dashboard
  return (
    <div className="min-h-screen flex flex-col bg-[#FDFCF8] text-[#4A3E3E] font-sans">
      {/* Top Navigation */}
      <Navbar
        user={currentUser}
        onSignOut={handleSignOut}
        onNewEntry={handleNewEntry}
        hasActiveEntry={Boolean(selectedEntry)}
        activeView={activeView}
        onViewChange={setActiveView}
        entryCount={entries.length}
        threadCount={threads.length}
        unfinishedCount={unfinishedThoughts.filter((t) => t.status === 'active').length}
        actionCount={actions.filter((a) => a.status === 'accepted' || a.status === 'in_progress').length}
        memoryCount={memories.length}
      />

      {/* Main Workspace Area: Reflections vs Thought Threads vs Unfinished Thoughts vs Action Experiments vs AI Memory */}
      {activeView === 'memory' ? (
        <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden">
          <MemoryControlCenter
            memories={memories}
            memoriesLoading={memoriesLoading}
            memorySettings={memorySettings}
            entries={entries}
            threads={threads}
            onForgetMemory={(id) => handleToggleMemoryStatus(id, 'forgotten')}
            onExcludeMemory={(id) => handleToggleMemoryStatus(id, 'excluded')}
            onRestoreMemory={(id) => handleToggleMemoryStatus(id, 'active')}
            onDeleteMemoryPermanently={handleDeleteMemory}
            onDeleteAllMemoriesPermanently={handleDeleteAllMemories}
            onToggleMemoryCreation={handleToggleMemoryCreation}
            onSelectEntry={(entry) => {
              setSelectedEntry(entry);
              setActiveView('reflections');
            }}
            onSelectThread={(tId) => {
              setSelectedThreadId(tId);
              setActiveView('threads');
            }}
          />
        </div>
      ) : activeView === 'threads' ? (
        <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden">
          <ThoughtThreadsView
            threads={threads}
            entries={entries}
            selectedThreadId={selectedThreadId}
            onSelectThread={(tId) => setSelectedThreadId(tId)}
            onOpenEntryInJournal={(entry) => {
              setSelectedEntry(entry);
              setActiveView('reflections');
            }}
            onDeleteThread={handleDeleteThread}
            onSyncAllThreads={handleSyncAllThreads}
            syncing={syncingAllThreads}
            actions={actions}
            onDeriveAction={handleOpenActionModal}
            onUpdateActionStatus={handleUpdateActionStatus}
            onNavigateToActions={() => setActiveView('actions')}
          />
        </div>
      ) : activeView === 'unfinished' ? (
        <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden">
          <UnfinishedThoughtsView
            unfinishedThoughts={unfinishedThoughts}
            threads={threads}
            entries={entries}
            loading={unfinishedLoading}
            scanning={scanningThoughts}
            onScanUnfinishedThoughts={handleScanUnfinishedThoughts}
            onExploreThought={handleExploreThought}
            onMarkResolved={handleMarkThoughtResolved}
            onDismiss={handleDismissThought}
            onRemindLater={handleRemindLater}
            onReactivate={handleReactivateThought}
            onViewThread={(tId) => {
              setSelectedThreadId(tId);
              setActiveView('threads');
            }}
            onViewEntry={(entryId) => {
              const target = entries.find((e) => e.id === entryId);
              if (target) {
                setSelectedEntry(target);
                setActiveView('reflections');
              }
            }}
          />
        </div>
      ) : activeView === 'actions' ? (
        <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden">
          <ActionExperimentsView
            actions={actions}
            threads={threads}
            entries={entries}
            onUpdateActionStatus={handleUpdateActionStatus}
            onDeleteAction={handleDeleteAction}
            onOpenThread={(tId) => {
              setSelectedThreadId(tId);
              setActiveView('threads');
            }}
            onOpenEntry={(entry) => {
              setSelectedEntry(entry);
              setActiveView('reflections');
            }}
            onTriggerNewExperiment={() => {
              if (threads.length > 0) {
                handleOpenActionModal(threads[0]);
              }
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden">
          {/* Left: Journal History & Search Panel */}
          <JournalList
            entries={entries}
            selectedEntryId={selectedEntry?.id || null}
            onSelectEntry={(entry) => setSelectedEntry(entry)}
            onDeleteEntry={handleDeleteEntry}
            onNewEntry={handleNewEntry}
            loading={entriesLoading}
          />

          {/* Right: Active Reflection Workspace */}
          {selectedEntry ? (
            <JournalEditor
              key={selectedEntry.id}
              entry={selectedEntry}
              onSaveEntry={handleSaveEntry}
              saving={saving}
              saveError={saveError}
              onClearSaveError={() => setSaveError(null)}
              connectedThread={activeConnectedThread}
              onViewThread={(tId) => {
                setSelectedThreadId(tId);
                setActiveView('threads');
              }}
              onTriggerThreadAnalysis={async (entry) => {
                await handleAssociateWithThread(entry);
              }}
              isAnalyzingThread={isAnalyzingThread}
              relatedUnfinishedThought={activeRelatedUnfinishedThought}
              onMarkThoughtResolved={handleMarkThoughtResolved}
              onOpenPerspectiveReplay={(entry) => {
                setReplayTargetEntry(entry);
                setReplayModalOpen(true);
              }}
              entryReplays={replays.filter((r) => r.originalEntryId === selectedEntry.id)}
              relatedActions={actions.filter(
                (a) =>
                  (selectedEntry.threadId && a.threadId === selectedEntry.threadId) ||
                  (a.entryIds && a.entryIds.includes(selectedEntry.id)) ||
                  (a.relatedEntryIds && a.relatedEntryIds.includes(selectedEntry.id))
              )}
              onUpdateActionStatus={handleUpdateActionStatus}
              onNavigateToActions={() => setActiveView('actions')}
              activeMemories={memories.filter((m) => m.status === 'active')}
              onToggleEntryAIExclusion={handleToggleEntryAIExclusion}
              onExtractMemories={handleExtractMemories}
              isExtractingMemories={isExtractingMemories}
              onOpenMemoryControlCenter={() => setActiveView('memory')}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#FDFCF8]">
              <div className="max-w-sm">
                <h3 className="text-base font-serif italic font-semibold text-[#4A3E3E]">
                  No Reflection Selected
                </h3>
                <p className="text-xs text-[#70665C] mt-1 leading-relaxed">
                  Choose an existing reflection from your history on the left, or create a brand new one to explore with Gemini.
                </p>
                <button
                  onClick={handleNewEntry}
                  className="mt-4 px-5 py-2 bg-[#7A8D74] hover:bg-[#687963] text-white rounded-full text-xs font-semibold transition-colors shadow-xs"
                >
                  Create New Reflection
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Perspective Replay Modal */}
      {replayModalOpen && replayTargetEntry && (
        <PerspectiveReplayModal
          isOpen={replayModalOpen}
          onClose={() => {
            setReplayModalOpen(false);
            setReplayTargetEntry(null);
          }}
          originalEntry={replayTargetEntry}
          connectedThread={threads.find((t) => t.id === replayTargetEntry.threadId)}
          onSaveReplay={handleSaveReplay}
          existingReplays={replays.filter((r) => r.originalEntryId === replayTargetEntry.id)}
        />
      )}

      {/* Insight to Action Modal */}
      {actionModalOpen && actionModalThread && (
        <InsightToActionModal
          isOpen={actionModalOpen}
          onClose={() => {
            setActionModalOpen(false);
            setActionModalThread(null);
            setActionModalEntries([]);
          }}
          thread={actionModalThread}
          entries={actionModalEntries}
          existingActions={actions}
          onSaveAction={handleSaveAction}
        />
      )}
    </div>
  );
}
