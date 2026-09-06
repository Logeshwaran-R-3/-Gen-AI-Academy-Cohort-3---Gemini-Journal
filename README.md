# Gemini Journal & Reflections

A secure, user-authenticated journaling web application that pairs Google Gemini with Cloud Firestore. Every user enjoys private, isolated document storage for multi-turn reflections, brainstorming sessions, and automated thematic summaries.

---

## Architectural Overview

- **User Identity**: Firebase Authentication with Google Sign-In (federated identity; no storage of custom passwords).
- **Backend Database**: Cloud Firestore with strict user-bound path isolation (`/users/{userId}/entries/{entryId}`).
- **AI Processing Engine**: Gemini 3.6 Flash API with an automated server-side model fallback ladder (`gemini-3.6-flash` &rarr; `gemini-3.1-flash-lite` &rarr; `gemini-flash-latest` &rarr; `gemini-3.7-flash`).
- **Secret Management**: Google Cloud Secret Manager / Server-side environment variables (`GEMINI_API_KEY`) with zero browser exposure.

---

## 1. Environment & Prerequisites

1. **Install Google Cloud SDK (`gcloud`) & Firebase CLI**:
   ```bash
   # Install gcloud CLI and initialize
   gcloud init
   gcloud auth application-default login

   # Install Firebase CLI
   npm install -g firebase-tools
   firebase login
   ```

2. **Enable Required Google Cloud APIs**:
   ```bash
   gcloud services enable \
     run.googleapis.com \
     secretmanager.googleapis.com \
     firestore.googleapis.com \
     cloudbuild.googleapis.com
   ```

---

## 2. Firestore Security Rules Configuration

To enforce strict user data isolation, deploy the following security rules so that authenticated users can only access their own private reflections and interactions:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Global fallback default deny
    match /{document=**} {
      allow read, write: if false;
    }

    // Health / connectivity test document
    match /test/{testId} {
      allow read: if true;
      allow write: if false;
    }

    // Isolated user-bound journal entries
    match /users/{userId}/entries/{entryId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Isolated user interactions
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Isolated user thought threads
    match /users/{userId}/threads/{threadId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Isolated user unfinished thoughts
    match /users/{userId}/unfinished_thoughts/{thoughtId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Isolated user perspective replays
    match /users/{userId}/replays/{replayId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Isolated user action experiments (Insight -> Action)
    match /users/{userId}/actions/{actionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Deploy the rules via Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 3. Secret Management Setup

Store your Gemini API key securely in Google Cloud Secret Manager and grant the Cloud Run runtime service account access:

```bash
# Set your project configuration
PROJECT_ID="YOUR_PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# Create and populate the secret in Secret Manager
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant the Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   Ensure `.env` contains:
   ```env
   GEMINI_API_KEY="your-gemini-api-key"
   ```

3. Run the full-stack application:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.

---

## 5. Cloud Run Deployment Flow

Deploy the containerized full-stack application to Cloud Run with automatic secret mounting:

```bash
SERVICE_NAME="gemini-journal-reflections"
REGION="us-central1"

# Build and deploy directly to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port=3000
```

---

## 6. Required Campaign Verification Binding

Apply the mandatory challenge verification label to register the Cloud Run service:

```bash
gcloud run services update $SERVICE_NAME \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=$REGION
```

---

## 7. Agentic Threat Modeling (5 Threat Zones)

| Threat Zone | Identified Risk | Countermeasure Implemented |
| :--- | :--- | :--- |
| **1. Input Surfaces** | Malicious injection or oversized input in reflection prompts or thought analysis payloads | Defensive payload ingestion in Express, string length trimming (`slice(0, 3500)`), and schema validation. |
| **2. Planning & Reasoning** | Hallucinating psychological states or falsely labeling routine statements as unfinished | Conservative evidence criteria; model prompted strictly to identify unresolved decisions/questions with concrete textual evidence, never speculating on emotional states. |
| **3. Tool Execution / API** | Unauthorized classification or scanning requests and SSRF | Strict Bearer token verification via Google OAuth2 tokeninfo endpoint; rejection of unauthenticated requests (`401 Unauthorized`). |
| **4. Memory & State** | Cross-user data leakage or unauthorized thread / thought access | Strict user isolation in Firestore security rules (`/users/{userId}/threads/{threadId}` and `/users/{userId}/unfinished_thoughts/{thoughtId}`). Client UID is never trusted without token verification. |
| **5. Inter-System Communication** | Secret exposure or credential leakage in client code | Zero client-side API keys; `GEMINI_API_KEY` is strictly server-side and dynamically accessed from environment variables or Google Secret Manager. |

---

## 8. Functional Stability & User Walkthrough

### Test Case 1: Google Sign-In & User Isolation
- Click "Continue with Google" to authenticate via Firebase Authentication.
- Confirm dashboard loads with authenticated user avatar and "Isolated" security badge.

### Test Case 2: Multi-Turn Reflection & Gemini Response
- Click "New Reflection" and enter an initial thought (e.g., *"I want to build an AI project for students."*).
- Click "Reflect" or press Enter. Confirm Gemini provides empathetic, structured reflection questions.
- Reply with a follow-up thought (e.g., *"I think the AI should work offline."*).
- Confirm conversation history persists to Firestore under `/users/{userId}/entries/{entryId}`.

### Test Case 3: Summary Synthesis & Thought Thread Generation
- Click "Summarize Entry".
- Gemini synthesizes a structured reflection summary.
- The system automatically triggers Thought Thread classification via `/api/gemini/threads/classify`.
- A new Thought Thread (e.g., *"Offline AI Student Assistant"*) is created in Firestore under `/users/{userId}/threads/{threadId}`.
- The summary card displays the badge: `Associated Thought Thread: "Offline AI Student Assistant"`.

### Test Case 4: Consecutive Reflection & Semantic Thread Association
- Create a second reflection entry: *"I experimented with Gemma today for offline models."*
- Click "Summarize Entry".
- Gemini recognizes the strong semantic relationship with the ongoing "Offline AI Student Assistant" thread and associates the entry with it.
- The thread entry count increments to 2, and latest activity date is updated.

### Test Case 5: Thought Threads Evolution View
- Click the "Thought Threads" tab in the top navigation bar.
- Confirm the thread appears in the directory with entry count, first activity date, and latest activity date.
- Select the thread to view the chronological progression timeline ("Stage 1", "Stage 2").
- Click "Open in Journal" on any entry in the timeline to jump directly to that reflection in the editor.
- Confirm original journal entries remain intact and are never modified or rewritten.

### Test Case 6: Scan for Unfinished Thoughts (Conservative Evidence Criteria)
- Switch to the "Unfinished Thoughts" tab via the navigation bar.
- Click "Scan for Unfinished Thoughts".
- Gemini evaluates previous reflection summaries and existing threads using strict evidence criteria.
- Only genuinely unresolved questions, incomplete decisions, or abandoned ideas are surfaced (e.g., *"Evaluating Gemma vs alternative local models"*).
- The dashboard populates cards displaying:
  - Concise title
  - Original context quote
  - Date first mentioned
  - Associated Thought Thread badge (if linked)
  - Clear explanation of why the thought appears unfinished

### Test Case 7: Unfinished Thoughts Lifecycle (Snooze, Dismiss, Reactivate)
- Click "Remind Later" on an active card: status updates to Snoozed (`remindAt` set to +7 days in Firestore).
- Switch filter to "Snoozed" to view snoozed items. Click "Reactivate" to return it to Active.
- Click "Dismiss" on an active card: status updates to Dismissed (`status: 'dismissed'` in Firestore).
- Switch filter to "Dismissed" to verify dismissal history.

### Test Case 8: "Explore Now" Deep Dive Session
- Click "Explore Now" on an active unfinished thought card.
- The system opens a dedicated reflection session in the Journal Editor with only the minimum relevant historical summary context (not the user's entire journal history).
- Gemini automatically greets the user with focused options, questions, and actionable next steps to move the thought forward.
- The active reflection displays an exploration banner: `Exploring Unfinished Thought: "[Title]"`.

### Test Case 9: In-Editor Resolution & Status Sync
- While exploring an unfinished thought in the Journal Editor, click the "Mark as Resolved" button on the banner.
- The status instantly updates in Firestore (`status: 'resolved'`, with timestamp).
- Return to the "Unfinished Thoughts" tab and filter by "Resolved" to confirm the thought is archived as completed.

### Test Case 10: Perspective Replay (Then vs Now Comparison)
- Select an older journal reflection entry in the Journal Editor.
- Click the "Replay this thought" action button in the editor toolbar or the callout card.
- Confirm the Perspective Replay modal displays:
  - Original perspective ("What I thought then") with title, recording date, and content summary.
  - Reflection question selector with preset options (*"Do you still think this way?"*, *"What has changed since then?"*, *"Would you make the same decision today?"*) and custom input field.
- Type in your current thoughts in the response area, or use the conversational exploratory chat to probe deeper with Gemini.
- Click "Compare Perspectives".
- Confirm Gemini returns a structured comparison containing:
  - Original perspective summary
  - Current perspective summary
  - What changed (differences in stance)
  - What stayed consistent (persistent values/principles)
  - Possible reasons for the change (strictly supported by explicit evidence from the user's reflection; no invented facts)
  - Emergent realization/insight (non-clinical, grounded)

### Test Case 11: Perspective Replay Storage & Isolation (Preserving Original Entry)
- After reviewing the comparison, click "Save as New Reflection" or "Save to Replay History".
- Verify the replay record is stored in Firestore under `/users/{userId}/replays/{replayId}`.
- If saved as a new reflection, verify a distinct entry titled `Perspective Replay: [Original Title]` appears in the Reflections list.
- Verify the original journal entry is completely intact and never modified or overwritten.
- Switch to the "Past Replays" tab in the modal to review historical comparisons linked to that entry.

### Test Case 12: Insight → Action Experiment Synthesis
- In the "Thought Threads" view, select any thread that has recurring reflections or goals.
- Click the "Derive Action Experiment" button on the thread detail card.
- Confirm the `InsightToActionModal` opens:
  - If sufficient evidence exists across entries in the thread, Gemini generates:
    - **Insight**: A factual, non-hype observation of the recurring pattern (e.g., *"You have repeatedly returned to learning machine learning."*).
    - **Concrete Experiment**: A small, specific, realistic, optional experiment (e.g., *"Spend 20 minutes tomorrow completing one beginner ML lesson."*).
    - **Timeframe**: A tangible scope (e.g., *"Next 24 hours"* or *"This weekend"*).
    - **Evidence Quotes**: Direct verbatim citations from the user's journal entries supporting the insight.
  - Confirm the tone is calm, restrained, and free of generic motivational cheerleader fluff.
  - Test editing the experiment text and timeframe directly in the proposal modal.
  - Click "Accept Experiment" to store it in Firestore under `/users/{userId}/actions/{actionId}`.
  - Alternatively, click "Dismiss" to close without saving.

### Test Case 13: Action Experiment Tracking & Manual User Authority
- Click the "Insight → Action" tab in the top navigation bar.
- Verify the full list of action experiments is displayed with status tabs: *All*, *In Progress*, *Completed*, *Changed*, *Abandoned*.
- Verify each action retains references to its source Thought Thread, evidence quotes, and created date.
- Test changing status:
  - Click "Mark Completed": Enter an optional reflection note on what was learned and confirm. The status updates to `Completed` with a timestamp.
  - Click "Mark Changed": Enter how the experiment was modified (e.g., changed 20 minutes to 10 minutes) and confirm. The card displays the modified experiment and `Changed` badge.
  - Click "Mark Abandoned": Enter an optional reason why the experiment was set aside.
  - Click "Reopen": Returns the status to `In Progress`.
- Open a journal reflection that belongs to the same Thought Thread.
  - Verify the editor displays the "Insight → Action Status for this Topic" callout banner showing all linked experiments.
  - Verify you can update the experiment's status directly from within the journal reflection while journaling about the topic.
  - Verify the system NEVER automatically marks an experiment as completed by AI inference—the user always retains full manual authority.


