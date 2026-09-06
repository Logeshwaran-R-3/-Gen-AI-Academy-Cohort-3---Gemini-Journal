export type JournalCategory = 'reflection' | 'brainstorm' | 'gratitude' | 'general' | 'summary';

export interface JournalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  category: JournalCategory;
  initialPrompt?: string;
  messages: JournalMessage[];
  summary?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  threadId?: string;
  excludedFromAI?: boolean;
}

export interface ThoughtThread {
  id: string;
  userId: string;
  title: string;
  description: string;
  entryIds: string[];
  startedAt: string;
  updatedAt: string;
  entryCount: number;
}

export type UnfinishedThoughtStatus = 'active' | 'resolved' | 'dismissed' | 'snoozed';

export interface UnfinishedThought {
  id: string;
  userId: string;
  title: string;
  originalContext: string;
  dateFirstMentioned: string;
  entryId: string;
  threadId?: string | null;
  threadTitle?: string | null;
  whyUnfinished: string;
  status: UnfinishedThoughtStatus;
  resolvedAt?: string | null;
  remindAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PerspectiveReplay {
  id: string;
  userId: string;
  originalEntryId: string;
  originalEntryTitle: string;
  originalEntryDate: string;
  reflectionQuestion: string;
  originalPerspective: string;
  currentPerspective: string;
  whatChanged: string;
  whatStayedConsistent: string;
  possibleReasons: string;
  newInsight?: string | null;
  replayDate: string;
  createdAt: string;
  updatedAt: string;
}

export type ActionExperimentStatus =
  | 'suggested'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'changed'
  | 'abandoned'
  | 'dismissed';

export interface ActionExperiment {
  id: string;
  userId: string;
  threadId?: string | null;
  threadTitle?: string | null;
  entryIds: string[];
  relatedEntryIds?: string[];
  insight: string;
  experiment: string;
  timeframe?: string | null;
  evidenceQuotes?: string[];
  whyThisExperiment?: string | null;
  status: ActionExperimentStatus;
  notes?: string | null;
  changedExperimentText?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AIMemoryStatus = 'active' | 'forgotten' | 'excluded';
export type AIMemorySourceType = 'journal_entry' | 'conversation_turn' | 'summary' | 'manual';

export interface AIMemory {
  id: string;
  userId: string;
  fact: string;
  category: string;
  sourceType: AIMemorySourceType;
  sourceId: string;
  sourceTitle: string;
  threadId?: string | null;
  threadTitle?: string | null;
  status: AIMemoryStatus;
  hasEmbedding: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIMemoryEmbedding {
  id: string;
  userId: string;
  memoryId: string;
  vector: number[];
  createdAt: string;
}

export interface UserMemorySettings {
  id: string;
  userId: string;
  memoryCreationEnabled: boolean;
  updatedAt: string;
}

export interface AuthUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}
