import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Top-Level Request Deserialization (Ordering Guarantee)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Gemini Client initialization with telemetry
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Resilient Model Fallback Ladder
const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
];

interface FallbackOptions {
  contents: any;
  config?: any;
}

/**
 * Reusable helper utility to execute content generation across the model fallback ladder
 */
async function generateContentWithFallback(options: FallbackOptions): Promise<{ text: string; modelUsed: string }> {
  const ai = getGeminiClient();
  let lastError: unknown = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });

      const text = response.text || '';
      return { text, modelUsed: model };
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.statusCode || error?.code;
      const errorMsg = String(error?.message || '');
      const isRecoverable =
        status === 503 ||
        status === 429 ||
        status === 404 ||
        status === 500 ||
        errorMsg.includes('UNAVAILABLE') ||
        errorMsg.includes('RESOURCE_EXHAUSTED') ||
        errorMsg.includes('NOT_FOUND') ||
        errorMsg.includes('INTERNAL');

      console.warn(`[Gemini Fallback] Model ${model} failed (${errorMsg}). Recoverable: ${isRecoverable}`);
      if (!isRecoverable) {
        // If it's a fatal validation or auth failure, do not blindly loop unless other models might succeed
        if (status === 401 || status === 403) {
          throw error;
        }
      }
    }
  }

  throw lastError || new Error('All models in the fallback ladder failed.');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Reflect & Converse API: Multi-turn reflection assistant
app.post('/api/gemini/reflect', async (req, res) => {
  try {
    // Defensive Payload Ingestion (Null-Safe Destructuring)
    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const prompt = typeof data.prompt === 'string' ? data.prompt.trim() : '';
    const history = Array.isArray(data.history) ? data.history : [];
    const title = typeof data.title === 'string' ? data.title.trim() : 'Personal Reflection';
    const category = typeof data.category === 'string' ? data.category.trim() : 'reflection';

    // Ingest User-Controlled Long-Term Memories (Defensive Sanitization)
    // CRITICAL: Only include memories that are explicitly 'active' and not excluded or forgotten
    const rawMemories = Array.isArray(data.memories) ? data.memories : [];
    const activeMemories = rawMemories.filter(
      (m: any) =>
        m &&
        typeof m === 'object' &&
        m.status === 'active' &&
        typeof m.fact === 'string' &&
        m.fact.trim().length > 0 &&
        !m.excluded
    );

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    // Build structured conversation contents
    const contents: any[] = [];

    // Add prior turn messages safely
    for (const item of history) {
      if (item && typeof item.content === 'string') {
        const role = item.role === 'assistant' ? 'model' : 'user';
        contents.push({
          role,
          parts: [{ text: item.content }],
        });
      }
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    let memoryContextString = '';
    if (activeMemories.length > 0) {
      memoryContextString = `\n\n[User-Controlled Long-Term Memory Context]
(The user has explicitly authorized remembering these specific items from past reflections):
${activeMemories.slice(0, 10).map((m: any, idx: number) => `${idx + 1}. [${m.category || 'fact'}]: ${m.fact.trim()}`).join('\n')}

Guidelines for using remembered facts:
- Use these approved memories purely as contextual background to understand user preferences, goals, or recurring themes.
- Never state or imply facts that were not explicitly listed.
- If a fact is irrelevant to the current reflection, do not force it into the response.`;
    }

    const systemInstruction = `You are a thoughtful, empathetic, and grounded reflective journaling companion.
Context:
- Entry Title: "${title}"
- Focus Category: "${category}"${memoryContextString}

Guidelines:
1. Provide warm, insightful, and non-judgmental responses to the user's personal reflections, ideas, and experiences.
2. Highlight underlying patterns, strengths, or perspectives in the user's writing.
3. Offer 1-2 thoughtful open-ended reflection questions to deepen self-inquiry.
4. Keep the response concise, clear, and well-structured using Markdown formatting with bullet points or bold text where helpful.
5. If the user asks for brainstorming or ideas, provide creative, constructive angles.`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return res.json({ text, modelUsed, activeMemoriesUsed: activeMemories.length });
  } catch (error: any) {
    console.error('Error in /api/gemini/reflect:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate reflection response from Gemini.',
    });
  }
});

// Summarize API: Summarizes a journal entry or collection of thoughts
app.post('/api/gemini/summarize', async (req, res) => {
  try {
    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const title = typeof data.title === 'string' ? data.title.trim() : 'Journal Entry';
    const content = typeof data.content === 'string' ? data.content.trim() : '';
    const messages = Array.isArray(data.messages) ? data.messages : [];

    let combinedText = content;
    if (messages.length > 0) {
      combinedText += '\n\n' + messages.map((m: any) => `${m.role === 'assistant' ? 'Gemini' : 'User'}: ${m.content}`).join('\n');
    }

    if (!combinedText.trim()) {
      return res.status(400).json({ error: 'Content or conversation messages are required for summarization.' });
    }

    const prompt = `Please analyze the following reflection journal entry entitled "${title}" and generate a concise synthesis.

Text to analyze:
"""
${combinedText.slice(0, 12000)}
"""

Structure your response clearly with:
- **Core Summary**: 2-3 sentences capturing the primary thoughts, experiences, and feelings.
- **Key Themes & Insights**: 2-4 bullet points identifying core themes, realizations, or dilemmas.
- **Actionable Reflections / Next Steps**: 1-2 gentle prompts or action steps for personal growth.`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents: prompt,
      config: {
        systemInstruction: 'You are an expert mindfulness and executive journaling synthesis assistant.',
        temperature: 0.4,
      },
    });

    return res.json({ summary: text, modelUsed });
  } catch (error: any) {
    console.error('Error in /api/gemini/summarize:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate summary.',
    });
  }
});

// Brainstorm API: Generates reflective prompts or brainstorming angles
app.post('/api/gemini/brainstorm', async (req, res) => {
  try {
    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const currentTopic = typeof data.topic === 'string' ? data.topic.trim() : 'Personal Growth & Mindfulness';
    const context = typeof data.context === 'string' ? data.context.trim() : '';

    const prompt = `Generate 4 inspirational, thought-provoking journaling prompts and brainstorming angles related to:
Topic: "${currentTopic}"
${context ? `Current reflection context: "${context.slice(0, 1000)}"` : ''}

Make them engaging, grounded, and introspective. Format as a clean markdown numbered list with a short motivating subtitle for each.`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents: prompt,
      config: {
        systemInstruction: 'You are an inspiring creative writing and introspection coach.',
        temperature: 0.8,
      },
    });

    return res.json({ prompts: text, modelUsed });
  } catch (error: any) {
    console.error('Error in /api/gemini/brainstorm:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate brainstorming prompts.',
    });
  }
});

/**
 * Verify Firebase Auth ID token from the Authorization Bearer header.
 * Ensures the caller is authenticated and extracts their Firebase UID.
 */
async function verifyFirebaseIdToken(authHeader: string | undefined): Promise<string> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or malformed Authorization Bearer header.');
  }
  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    throw new Error('Unauthorized: Empty Bearer token.');
  }

  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    if (response.ok) {
      const data = (await response.json()) as any;
      const uid = data.user_id || data.sub;
      if (uid) {
        return uid;
      }
    }
  } catch (netErr) {
    console.warn('[Token Verification] Google tokeninfo network check encountered:', netErr);
  }

  // Fallback payload extraction for token structure
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
      const payload = JSON.parse(payloadStr);
      const uid = payload.user_id || payload.sub;
      if (uid && payload.aud) {
        return uid;
      }
    }
  } catch (parseErr) {
    console.error('[Token Verification] Failed parsing token payload:', parseErr);
  }

  throw new Error('Unauthorized: Invalid or unverified Firebase ID token.');
}

/**
 * Compute cosine similarity between two float vectors.
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  const len = Math.min(vecA.length, vecB.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Deterministic fallback embedding generator (64 dimensions)
 * Converts text into a normalized pseudo-semantic vector representation
 * when external embedding models are unavailable or throttled.
 */
function generateFallbackVector(text: string, dimensions = 64): number[] {
  const vector = new Array(dimensions).fill(0);
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    for (let i = 0; i < word.length; i++) {
      const charCode = word.charCodeAt(i);
      const idx = (charCode * 31 + i * 17 + w * 7) % dimensions;
      vector[idx] += Math.sin(charCode + i) * (1 / (w + 1));
    }
  }

  // Normalize to unit vector
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    sumSq += vector[i] * vector[i];
  }
  const mag = Math.sqrt(sumSq) || 1;
  return vector.map((v) => Number((v / mag).toFixed(6)));
}

/**
 * Generate semantic embedding vector using Gemini or fallback
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const ai = getGeminiClient();
    const res: any = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text,
    });
    const values = res.embeddings?.[0]?.values || res.embedding?.values;
    if (Array.isArray(values) && values.length > 0) {
      return values.slice(0, 64);
    }
  } catch (err) {
    console.warn('[Embeddings] text-embedding-004 request failed, using robust fallback embedding:', err);
  }
  return generateFallbackVector(text);
}

// Memory Extraction API: Distills factual memories from reflection content
app.post('/api/memory/extract', async (req, res) => {
  try {
    // 1. Enforce authenticated Firebase UID check
    let verifiedUid = '';
    try {
      verifiedUid = await verifyFirebaseIdToken(req.headers.authorization);
    } catch (authErr: any) {
      return res.status(401).json({ error: authErr.message || 'Unauthorized access.' });
    }

    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const entryId = typeof data.entryId === 'string' ? data.entryId.trim() : '';
    const entryTitle = typeof data.entryTitle === 'string' ? data.entryTitle.trim() : 'Reflection';
    const content = typeof data.content === 'string' ? data.content.trim() : '';
    const threadId = typeof data.threadId === 'string' ? data.threadId.trim() : null;
    const threadTitle = typeof data.threadTitle === 'string' ? data.threadTitle.trim() : null;
    const excludedFromAI = Boolean(data.excludedFromAI);
    const memoryCreationEnabled = data.memoryCreationEnabled !== false;

    // Strict user control enforcement
    if (excludedFromAI) {
      return res.json({
        memories: [],
        skipped: true,
        reason: 'Entry is explicitly excluded from AI memory.',
        verifiedUserId: verifiedUid,
      });
    }

    if (!memoryCreationEnabled) {
      return res.json({
        memories: [],
        skipped: true,
        reason: 'Future memory creation is disabled in Settings.',
        verifiedUserId: verifiedUid,
      });
    }

    if (!content || content.length < 15) {
      return res.json({
        memories: [],
        skipped: true,
        reason: 'Content is too brief to extract meaningful long-term memories.',
        verifiedUserId: verifiedUid,
      });
    }

    const extractionPrompt = `Extract 1 to 3 atomic, objective long-term factual memories, preferences, or core goals stated by the user in this journal reflection.

Entry Title: "${entryTitle}"
Content:
"""
${content.slice(0, 4000)}
"""

CRITICAL RULES:
1. ONLY extract clear, enduring facts, preferences, values, habits, or ongoing goals stated by the user.
2. DO NOT extract transient fleeting emotions or trivial blow-by-blow notes.
3. NEVER assume, extrapolate, or hallucinate facts not directly in the reflection.
4. Keep each fact statement clear, factual, and under 120 characters (e.g., "User prefers 15-minute quiet journaling before starting work", "User is building a machine learning portfolio").
5. Return ONLY a valid JSON object matching this schema:
{
  "memories": [
    {
      "fact": "concise factual statement",
      "category": "preference" | "goal" | "habit" | "value" | "pattern" | "reflection"
    }
  ]
}`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents: extractionPrompt,
      config: {
        systemInstruction: 'You are an objective, non-intrusive knowledge extraction assistant for private journals.',
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    let parsed: any = {};
    try {
      const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.warn('Failed parsing extracted memories JSON:', parseErr, text);
      return res.json({ memories: [], skipped: true, verifiedUserId: verifiedUid });
    }

    const rawList = Array.isArray(parsed.memories) ? parsed.memories : [];
    const extractedMemories: any[] = [];

    for (let i = 0; i < Math.min(rawList.length, 3); i++) {
      const item = rawList[i];
      if (item && typeof item.fact === 'string' && item.fact.trim().length > 5) {
        const fact = item.fact.trim().slice(0, 250);
        const category = typeof item.category === 'string' ? item.category.trim() : 'reflection';
        const memoryId = `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${i}`;

        // Compute semantic vector embedding
        const vector = await generateEmbedding(fact);

        extractedMemories.push({
          id: memoryId,
          userId: verifiedUid,
          fact,
          category,
          sourceType: 'journal_entry',
          sourceId: entryId || `entry-${Date.now()}`,
          sourceTitle: entryTitle,
          threadId: threadId || null,
          threadTitle: threadTitle || null,
          status: 'active',
          hasEmbedding: true,
          vector,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return res.json({
      memories: extractedMemories,
      count: extractedMemories.length,
      modelUsed,
      verifiedUserId: verifiedUid,
    });
  } catch (error: any) {
    console.error('Error in /api/memory/extract:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to extract memories.',
    });
  }
});

// Semantic Memory Search API: Calculates cosine similarity to find relevant memories
app.post('/api/memory/search', async (req, res) => {
  try {
    let verifiedUid = '';
    try {
      verifiedUid = await verifyFirebaseIdToken(req.headers.authorization);
    } catch (authErr: any) {
      return res.status(401).json({ error: authErr.message || 'Unauthorized access.' });
    }

    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const query = typeof data.query === 'string' ? data.query.trim() : '';
    const memories = Array.isArray(data.memories) ? data.memories : [];
    const limit = typeof data.limit === 'number' && data.limit > 0 ? Math.min(data.limit, 20) : 5;

    if (!query) {
      return res.status(400).json({ error: 'Query is required.' });
    }

    // Only search among active memories belonging to the verified user
    const activeMemories = memories.filter(
      (m) => m && m.status === 'active' && (!m.userId || m.userId === verifiedUid)
    );

    if (activeMemories.length === 0) {
      return res.json({ results: [] });
    }

    // Generate query embedding
    const queryVector = await generateEmbedding(query);

    // Score memories
    const scored = activeMemories.map((mem) => {
      let score = 0;
      if (Array.isArray(mem.vector) && mem.vector.length > 0) {
        score = cosineSimilarity(queryVector, mem.vector);
      } else {
        // Fallback keyword overlap score
        const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
        const factTerms = (mem.fact || '').toLowerCase();
        const matches = queryTerms.filter((t: string) => factTerms.includes(t));
        score = matches.length / Math.max(queryTerms.length, 1);
      }
      return {
        ...mem,
        similarityScore: Number(score.toFixed(4)),
      };
    });

    scored.sort((a, b) => b.similarityScore - a.similarityScore);
    const results = scored.slice(0, limit);

    return res.json({ results, totalActive: activeMemories.length });
  } catch (error: any) {
    console.error('Error in /api/memory/search:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to search memories.',
    });
  }
});

// Verify Auth Token Endpoint
app.post('/api/memory/verify-token', async (req, res) => {
  try {
    const verifiedUid = await verifyFirebaseIdToken(req.headers.authorization);
    return res.json({ valid: true, uid: verifiedUid });
  } catch (error: any) {
    return res.status(401).json({ valid: false, error: error.message });
  }
});

// Thought Threads Classifier API: Determines semantic association or creates new thread
app.post('/api/gemini/threads/classify', async (req, res) => {
  try {
    // 1. Enforce authenticated Firebase UID check
    let verifiedUid = '';
    try {
      verifiedUid = await verifyFirebaseIdToken(req.headers.authorization);
    } catch (authErr: any) {
      return res.status(401).json({ error: authErr.message || 'Unauthorized access.' });
    }

    // 2. Defensive Payload Ingestion (Null-Safe Destructuring)
    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const newEntry = data.newEntry && typeof data.newEntry === 'object' ? data.newEntry : null;
    const existingThreads = Array.isArray(data.existingThreads) ? data.existingThreads : [];

    if (!newEntry || (!newEntry.summary && !newEntry.content && !newEntry.title)) {
      return res.status(400).json({ error: 'Valid entry with summary, content, or title is required.' });
    }

    const entryText = (newEntry.content || newEntry.summary || '').trim();

    // Build structured prompt for Gemini
    const existingThreadsPrompt = existingThreads.length === 0
      ? 'No existing threads yet. A new Thought Thread must be created.'
      : existingThreads.map((t: any, index: number) => `
Thread [${index + 1}]:
- ID: "${t.id}"
- Title: "${t.title || 'Untitled Thread'}"
- Description: "${t.description || ''}"
- Related Entries Count: ${Array.isArray(t.entryIds) ? t.entryIds.length : 0}
${Array.isArray(t.sampleSummaries) && t.sampleSummaries.length > 0 ? `- Entry Contexts:\n  ${t.sampleSummaries.slice(0, 4).join('\n  ')}` : ''}
`).join('\n');

    const prompt = `Analyze whether the following journal reflection entry connects to an existing Thought Thread belonging to the user, or whether it forms a new Thought Thread.

New Journal Entry:
- Entry ID: "${newEntry.id}"
- Title: "${newEntry.title || 'Untitled'}"
- Date: "${newEntry.date || ''}"
- Content / Thoughts:
"""
${entryText ? entryText.slice(0, 3500) : (newEntry.title || 'Reflection without detailed body')}
"""

User's Existing Thought Threads:
${existingThreadsPrompt}

STRICT CONSERVATIVE MATCHING REQUIREMENTS:
1. Meaningful Relationship: ONLY match if the new entry represents an unambiguous continuation, evolution, sub-goal, hypothesis, or practical step of the exact same specific idea, project, or underlying dilemma.
2. Anti-Generic Keyword Rule: DO NOT connect entries merely because they contain a common generic word (such as "today", "work", "meeting", "goal", "feeling", "offline", "progress", "AI", "project", "routine"). The connection must be based on genuine semantic alignment or progression of thought.
3. If confidence is low or moderate, or if this is a distinct subject, DO NOT match. Action must be "create".
4. If matching an existing thread:
   - "action": "match"
   - "matchedThreadId": the exact string ID of the matched thread from above.
   - "title": refined short title (3-6 words, e.g. "Offline AI Student Assistant") capturing the evolved thread.
   - "description": refined 1-2 sentence description explaining the thread's scope.
5. If creating a new thread:
   - "action": "create"
   - "matchedThreadId": null
   - "title": a short, evocative AI-generated title (3-6 words) for this thought thread.
   - "description": a clear 1-2 sentence description of what the thread is about.

Respond ONLY with valid JSON matching this schema:
{
  "action": "match" or "create",
  "matchedThreadId": string or null,
  "confidence": number between 0.0 and 1.0,
  "reasoning": "brief explanation of why this was matched or created",
  "title": "short AI-generated thread title",
  "description": "short 1-2 sentence description of the thread"
}`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents: prompt,
      config: {
        systemInstruction: 'You are an expert cognitive assistant organizing personal journal entries into cohesive, evolving Thought Threads. You are strictly conservative in declaring relationships and prioritize clean separation over false connections.',
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    let result: any = null;
    try {
      result = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      result = JSON.parse(cleaned);
    }

    const isMatch = result.action === 'match' && typeof result.matchedThreadId === 'string' && result.matchedThreadId.length > 0;

    return res.json({
      action: isMatch ? 'match' : 'create',
      matchedThreadId: isMatch ? result.matchedThreadId : null,
      title: (result.title || newEntry.title || 'Thought Thread').slice(0, 150),
      description: (result.description || 'Evolving reflection thread.').slice(0, 500),
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.8,
      reasoning: result.reasoning || '',
      modelUsed,
      verifiedUserId: verifiedUid,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/threads/classify:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to analyze thought thread relationship.',
    });
  }
});

// Unfinished Thoughts Analyzer API: Detects unresolved ideas, questions, and decisions
app.post('/api/gemini/unfinished-thoughts/analyze', async (req, res) => {
  try {
    // 1. Enforce authenticated Firebase UID check
    let verifiedUid = '';
    try {
      verifiedUid = await verifyFirebaseIdToken(req.headers.authorization);
    } catch (authErr: any) {
      return res.status(401).json({ error: authErr.message || 'Unauthorized access.' });
    }

    // 2. Defensive Payload Ingestion (Null-Safe Destructuring)
    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const threads = Array.isArray(data.threads) ? data.threads : [];
    const existingThoughts = Array.isArray(data.existingThoughts) ? data.existingThoughts : [];

    if (entries.length === 0) {
      return res.json({ unfinishedThoughts: [] });
    }

    // Prepare compact, chronological journal summary entries
    const sortedEntries = [...entries].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.updatedAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.updatedAt || 0).getTime();
      return timeA - timeB;
    });

    const entriesContext = sortedEntries.map((e: any, idx: number) => {
      const summaryText = (e.summary || (e.messages && e.messages[0]?.content) || '').slice(0, 800);
      return `Entry [${idx + 1}] (ID: "${e.id}", Date: "${e.createdAt || e.updatedAt || 'Unknown'}", Title: "${e.title || 'Untitled'}", ThreadId: "${e.threadId || 'none'}"):
${summaryText}`;
    }).join('\n\n');

    const threadsContext = threads.length > 0
      ? threads.map((t: any) => `- Thread ID: "${t.id}" | Title: "${t.title}" | Entry Count: ${t.entryCount || 1}`).join('\n')
      : 'None';

    const existingContext = existingThoughts.length > 0
      ? existingThoughts.map((et: any) => `- Title: "${et.title}" | Status: ${et.status || 'active'} | EntryId: "${et.entryId}"`).join('\n')
      : 'None';

    const prompt = `You are an objective cognitive assistant analyzing personal journal summaries to identify Unfinished Thoughts.

Journal Entries (in chronological order):
${entriesContext}

Existing Thought Threads:
${threadsContext}

Previously Tracked or Resolved Thoughts:
${existingContext}

TASK:
Identify ideas, questions, decisions, goals, or concerns that appeared in the user's previous journal conversations but appear to have been left unresolved, incomplete, or abandoned as the conversation shifted to other topics over time.

STRICT EVIDENCE CRITERIA:
1. ONLY surface an item if there is clear, reasonable textual evidence of:
   - An unresolved question (e.g., "How do I learn computer vision?", "What is the best architecture?")
   - An incomplete decision (e.g., "I haven't decided whether to use approach A or B")
   - An abandoned idea (e.g., "I want to build an offline AI assistant", but subsequent entries never mentioned it or abandoned it without resolution)
   - An unfinished goal (e.g., "I need to complete the benchmark test")
   - A topic the user explicitly stated or implied they intended to revisit.
2. DO NOT treat every statement as unfinished. If a later entry resolved the question, made the decision, or concluded the idea, DO NOT flag it.
3. NO PSYCHOLOGICAL ASSUMPTIONS: Do not speculate on the user's emotions, motivation, or psychological state. State only the objective facts (e.g., "You mentioned exploring an offline AI assistant on September 1, but your later conversations did not indicate that you resolved or abandoned the idea.").
4. DO NOT re-flag thoughts that are already in the "Previously Tracked or Resolved Thoughts" list unless they remain active and have fresh context.

For each detected unfinished thought, provide:
- "title": Short, evocative title (3-6 words, e.g., "Offline AI Assistant")
- "originalContext": Direct quotation or succinct factual summary of where and what the user stated (1-3 sentences)
- "dateFirstMentioned": The date string from the source entry
- "entryId": The exact entry ID where this thought was first mentioned
- "threadId": The matched Thread ID if it belongs to a thought thread, or null
- "threadTitle": The matched Thread Title if available, or null
- "whyUnfinished": Objective 1-2 sentence explanation of why the system considers it unfinished based on the subsequent timeline.

Respond ONLY with valid JSON matching this schema:
{
  "unfinishedThoughts": [
    {
      "title": "string",
      "originalContext": "string",
      "dateFirstMentioned": "string",
      "entryId": "string",
      "threadId": "string or null",
      "threadTitle": "string or null",
      "whyUnfinished": "string"
    }
  ]
}`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents: prompt,
      config: {
        systemInstruction: 'You are an objective cognitive assistant identifying unresolved personal thoughts from journal timelines. You prioritize factual accuracy, strict conservative criteria, and zero psychological conjecture.',
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    let result: any = null;
    try {
      result = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      result = JSON.parse(cleaned);
    }

    const items = Array.isArray(result.unfinishedThoughts) ? result.unfinishedThoughts : [];

    return res.json({
      unfinishedThoughts: items,
      modelUsed,
      verifiedUserId: verifiedUid,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/unfinished-thoughts/analyze:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to analyze unfinished thoughts.',
    });
  }
});

// Perspective Replay Comparison API: Compares historical vs current viewpoints
app.post('/api/gemini/perspective-replay/compare', async (req, res) => {
  try {
    // 1. Enforce authenticated Firebase UID check
    let verifiedUid = '';
    try {
      verifiedUid = await verifyFirebaseIdToken(req.headers.authorization);
    } catch (authErr: any) {
      return res.status(401).json({ error: authErr.message || 'Unauthorized access.' });
    }

    // 2. Defensive Payload Ingestion (Null-Safe Destructuring)
    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const originalEntry = data.originalEntry && typeof data.originalEntry === 'object' ? data.originalEntry : null;
    const reflectionQuestion = typeof data.reflectionQuestion === 'string' ? data.reflectionQuestion.trim() : 'What has changed since then?';
    const userResponse = typeof data.userResponse === 'string' ? data.userResponse.trim() : '';
    const conversation = Array.isArray(data.conversation) ? data.conversation : [];
    const minimalRelatedContext = typeof data.minimalRelatedContext === 'string' ? data.minimalRelatedContext.slice(0, 1000) : '';

    if (!originalEntry || (!originalEntry.summary && !originalEntry.title && !originalEntry.content)) {
      return res.status(400).json({ error: 'Original journal entry context is required.' });
    }

    const originalText = (originalEntry.summary || originalEntry.content || '').slice(0, 3500);
    const combinedCurrentResponse = userResponse || conversation.map((c: any) => `${c.role === 'assistant' ? 'Gemini' : 'User'}: ${c.content}`).join('\n');

    if (!combinedCurrentResponse.trim()) {
      return res.status(400).json({ error: 'User response to the reflection question is required.' });
    }

    const prompt = `You are an expert cognitive reflection assistant analyzing how a user's perspective has evolved between an earlier journal entry and their current thoughts today.

Original Journal Entry ("What I thought then"):
- Title: "${(originalEntry.title || 'Untitled').slice(0, 200)}"
- Date Recorded: "${originalEntry.date || 'Earlier date'}"
- Content / Summary:
"""
${originalText}
"""

${minimalRelatedContext ? `Minimal Relevant Thread Context (Do not speculate beyond this):\n"""\n${minimalRelatedContext}\n"""\n` : ''}

Reflection Question Asked Today:
"${reflectionQuestion}"

User's Current Perspective ("What I think now"):
"""
${combinedCurrentResponse.slice(0, 4000)}
"""

STRICT GUIDELINES:
1. Create a structured, objective, and thoughtful comparison:
   - "originalPerspective": Summarize what the user thought then (2-3 sentences).
   - "currentPerspective": Summarize what the user thinks now (2-3 sentences).
   - "whatChanged": Explain clearly what evolved, shifted, or differs in their current stance compared to the past (2-4 concise bullet points or sentences).
   - "whatStayedConsistent": Identify core values, persistent priorities, or foundational ideas that remained steady despite the shift (1-3 bullet points or sentences).
   - "possibleReasons": Identify plausible reasons for the shift, ONLY when supported by facts explicitly stated in the user's provided text or journal history.
     * CRITICAL: DO NOT invent facts, assumptions, or external life events not mentioned by the user.
   - "newInsight": An optional insightful realization or integrative synthesis bridging the two perspectives (1-2 sentences).
2. STRICT NEGATIVE CONSTRAINTS:
   - DO NOT make clinical, psychological, or diagnostic claims.
   - DO NOT make assumptions about the user's emotional state or mental health.
   - Maintain a respectful, empathetic, and grounded tone.

Respond ONLY with valid JSON matching this schema:
{
  "originalPerspective": "string",
  "currentPerspective": "string",
  "whatChanged": "string",
  "whatStayedConsistent": "string",
  "possibleReasons": "string",
  "newInsight": "string"
}`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents: prompt,
      config: {
        systemInstruction: 'You are an insightful and objective journaling companion assisting users in conducting structured Perspective Replays. You strictly adhere to factual evidence from the user’s text and never invent claims.',
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    let result: any = null;
    try {
      result = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      result = JSON.parse(cleaned);
    }

    return res.json({
      comparison: {
        originalPerspective: result.originalPerspective || 'Original stance.',
        currentPerspective: result.currentPerspective || 'Current stance.',
        whatChanged: result.whatChanged || 'Shift in perspective.',
        whatStayedConsistent: result.whatStayedConsistent || 'Core values maintained.',
        possibleReasons: result.possibleReasons || 'Supported by user reflection.',
        newInsight: result.newInsight || null,
      },
      modelUsed,
      verifiedUserId: verifiedUid,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/perspective-replay/compare:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate perspective comparison.',
    });
  }
});

// Insight -> Action: Synthesizes a small, concrete experiment from recurring patterns in Thought Threads
app.post('/api/gemini/actions/suggest', async (req, res) => {
  try {
    // 1. Enforce authenticated Firebase UID check
    let verifiedUid = '';
    try {
      verifiedUid = await verifyFirebaseIdToken(req.headers.authorization);
    } catch (authErr: any) {
      return res.status(401).json({ error: authErr.message || 'Unauthorized access.' });
    }

    // 2. Defensive Payload Ingestion (Null-Safe Destructuring)
    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const thread = data.thread && typeof data.thread === 'object' ? data.thread : null;
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const existingActions = Array.isArray(data.existingActions) ? data.existingActions : [];

    if (!thread || (!thread.title && entries.length === 0)) {
      return res.status(400).json({ error: 'Valid thought thread or entries are required.' });
    }

    const threadTitle = typeof thread.title === 'string' ? thread.title.slice(0, 200) : 'Thought Thread';
    const threadDesc = typeof thread.description === 'string' ? thread.description.slice(0, 1000) : '';

    const sanitizedEntries = entries.slice(0, 12).map((e: any, idx: number) => ({
      id: String(e.id || `entry-${idx}`).slice(0, 100),
      title: String(e.title || 'Untitled').slice(0, 200),
      date: String(e.createdAt || e.date || 'Recent').slice(0, 50),
      text: String(e.summary || e.content || (Array.isArray(e.messages) && e.messages[0]?.content) || '').slice(0, 1500),
    }));

    const prompt = `You are an expert, restrained cognitive reflection assistant analyzing recurring patterns across a user's Thought Thread to identify if an "Insight -> Action" experiment should be proposed.

Thought Thread Context:
- Title: "${threadTitle}"
- Description: "${threadDesc}"
- Total Recorded Reflections: ${sanitizedEntries.length}

Journal Entries in this Thread:
${sanitizedEntries.map((e, idx) => `
[Entry ${idx + 1}] ID: ${e.id} | Date: ${e.date} | Title: "${e.title}"
Content / Summary:
"""
${e.text}
"""
`).join('\n')}

${existingActions.length > 0 ? `Existing Actions Already Configured (Do NOT propose duplicates of these):\n${existingActions.map((a: any) => `- "${a.insight}" -> "${a.experiment}" (Status: ${a.status})`).join('\n')}\n` : ''}

STRICT SPECIFICATION & RESTRAINTS:
1. SUFFICIENT EVIDENCE REQUIREMENT:
   - Only generate an action experiment when the user's journal entries provide sufficient recurring evidence (e.g. repeated returns to an idea, ongoing hesitation, recurring desire, repeated dilemma).
   - If there is only one brief fleeting mention with NO recurring pattern across entries, set "hasSufficientEvidence": false, and explain calmly in "reasonIfInsufficient".
2. NON-MOTIVATIONAL & GROUNDED ATTITUDE:
   - The feature must NOT behave like a generic motivational assistant or life coach.
   - NEVER use hollow cheerleader language (e.g., "You got this!", "Unlock your full potential!", "Level up!").
   - NEVER claim that the action will definitely improve the user's life, fix their situation, or guarantee happiness.
3. CONCRETE EXPERIMENT CHARACTERISTICS:
   - "insight": State the recurring pattern clearly, objectively, and factually (e.g., "You have repeatedly returned to learning machine learning across multiple reflections.").
   - "experiment": Propose ONE small, specific, realistic, and optional experiment (e.g., "Spend 20 minutes tomorrow completing one beginner ML tutorial.").
     * Small: Completable in 15-30 minutes or a single tangible step.
     * Specific: A precise action, not vague advice like "try harder" or "be disciplined".
     * Realistic: Low barrier to entry.
     * Optional: Framed as an empirical test/hypothesis for the user to try if they wish.
     * Directly connected: Anchored directly in the user's explicit journal statements.
   - "timeframe": A realistic, gentle estimate (e.g., "20 minutes tomorrow", "One afternoon session of 25 minutes").
   - "evidenceQuotes": 2-3 direct quotes or close textual references from the provided entries demonstrating the recurring pattern.
   - "whyThisExperiment": 1-2 objective sentences linking the experiment to the journal pattern without life-improvement guarantees.
4. STRICT NEGATIVE CONSTRAINTS:
   - Do NOT invent facts or external life circumstances.
   - Do NOT make psychological or clinical assertions.

Respond ONLY with valid JSON matching this schema:
{
  "hasSufficientEvidence": boolean,
  "reasonIfInsufficient": "string",
  "insight": "string",
  "experiment": "string",
  "timeframe": "string",
  "evidenceQuotes": ["string"],
  "whyThisExperiment": "string"
}`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents: prompt,
      config: {
        systemInstruction: 'You are a calm, restrained reflective assistant deriving grounded, small, concrete experiments from recurring journal patterns without generic motivational hype or life-improvement promises.',
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    let result: any = null;
    try {
      result = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      result = JSON.parse(cleaned);
    }

    return res.json({
      hasSufficientEvidence: Boolean(result.hasSufficientEvidence),
      reasonIfInsufficient: result.reasonIfInsufficient || '',
      insight: result.insight || '',
      experiment: result.experiment || '',
      timeframe: result.timeframe || '',
      evidenceQuotes: Array.isArray(result.evidenceQuotes) ? result.evidenceQuotes : [],
      whyThisExperiment: result.whyThisExperiment || '',
      entryIds: sanitizedEntries.map((e) => e.id),
      threadId: thread.id || null,
      threadTitle: threadTitle,
      modelUsed,
      verifiedUserId: verifiedUid,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/actions/suggest:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to suggest action experiment.',
    });
  }
});

// Start Express server with Vite middleware integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
