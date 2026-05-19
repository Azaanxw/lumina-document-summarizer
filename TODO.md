# Lumina Project Roadmap
------------------------------------------------

## Phase 1: Infrastructure & Core Setup ✅
- [x] Set up Supabase Project & Auth
- [x] Provision AWS S3 Bucket via Terraform
- [x] Configure AWS CLI & Local Environment
- [x] Project Folder Structure & Git Setup

-------------------------------------------------

## Phase 2: Backend Development & Database ✅
- [x] Create FastAPI PDF Upload Endpoint
- [x] Integrate Boto3 for S3 File Transfer
- [x] Connect FastAPI to Supabase (Database & Auth Secret)
- [x] Create `documents` table with `user_id` foreign keys
- [x] Implement FastAPI JWT Dependency for Auth Guarding
- [x] Implement PDF text extraction logic (PyMuPDF)

------------------------------------------------

## Phase 3: AI Logic & Interactive PDF Engine ✅

### 1. Foundation & API Setup
- [x] Enable pgvector and create tables/RPC in Supabase (1536 dim)
- [x] Install google-genai, openai, and langchain-text-splitters
- [x] Add GEMINI_API_KEY and OPENAI_API_KEY to .env

### 2. Precision RAG & Citations
- [x] Implement page-anchored chunking to prevent page-crossing
- [x] Create embedding_utils.py for OpenAI text-embedding-3-small
- [x] Sync upload flow: Extract → Chunk → Embed → DB Store

### 3. Study Tools (Gemini Flash)
- [x] Mega-prompt for Summary + 10-question multiple choice quiz
- [x] Manual prompt for 10 Flashcards (Q&A format)
- [x] Build /process-document and /generate-cards endpoints
- [x] Cache AI-generated content per document (summary/quiz/flashcards) — skip redundant Gemini calls on revisit

### 4. Interactive Q&A & Dictionary
- [x] Build /ask endpoint using Supabase RPC for retrieval
- [x] Refine Q&A prompt to return Answer + Page Number + Snippet
- [x] Add backend helper for Free Dictionary API proxy (GET /dictionary/{word})
- [x] Standardize JSON payload for frontend PDF "jump-to-page" sync
- [x] Add search_chunks() to db_utils.py to call match_documents RPC
- [x] Add generate_answer() to gemini_utils.py with grounded citation prompt
- [x] Handle graceful 404 when no relevant chunks found for a question

-------------------------------------------------

## Phase 4: Frontend & UI ✅
- [x] Basic React/Next.js dashboard
- [x] File upload drag-and-drop component
- [x] PDF preview with react-pdf (enables text selection + dictionary)
- [x] Split layout — PDF left, study tools right
- [x] Dictionary popup on PDF text selection
- [x] Citation badge click → scroll PDF to page + highlight snippet
- [x] Real-time summary display
- [x] Error boundary / empty-state polish across all views
- [x] Loading skeletons for all async data fetches
- [x] Resizable Q&A panel (drag handle)
- [x] Flashcard deck UI with flip animation

-------------------------------------------------

## Phase 5: Authentication & User Accounts ✅

### Onboarding Flow (Zero Friction Entry)
Zero friction entry. The user gets full value from their first document before ever seeing a login prompt.

1. User lands on `/` → sees upload zone and Lumina branding — no account required
2. User drops a PDF → an anonymous Supabase session is created silently (`signInAnonymously`); upload starts immediately under that session's `user_id`
3. User is redirected to `/document/{id}` — AI analysis runs and results are displayed in full
4. Once analysis is complete, a non-blocking nudge banner appears after 15 seconds with the message:
   - "Enjoying Lumina? Sign in to get **3 more free documents** and save this one to your account."
   - CTA: **Login / Sign Up** button → opens auth modal
   - Banner disappears automatically when user signs in (no manual dismiss)
5. Guest icon in document page header (same position as profile icon) — clicking opens the upgrade modal at any time
6. If the user signs in (Google or email OTP):
   - `linkIdentity` / `updateUser` preserves the same `user_id` — documents are automatically retained, no claim step needed
   - User is redirected to `/dashboard` with a "Signed in successfully!" toast
   - Quota upgrades from 1 (anonymous) to 4 (free tier)
7. If the user never signs in:
   - Document remains accessible in the current browser session via the anonymous Supabase session
   - A pg_cron job deletes anonymous user documents after **30 days**

### Anonymous Auth (Zero Friction Entry)
- [x] Every visitor gets a Supabase anonymous session on landing (`signInAnonymously`) — no localStorage guest tokens
- [x] Anonymous users can upload 1 document immediately with no sign-up prompt
- [x] `is_anonymous` flag on session distinguishes guest vs real users throughout app
- [x] RLS policies scoped via `auth.uid()` — correctly applies to anonymous users
- [x] pg_cron job: clean up anonymous user documents after 30 days

### Anonymous → Real User Upgrade
- [x] Google OAuth upgrade: `linkIdentity({ provider: "google" })` — preserves same `user_id`, documents automatically retained
- [x] Email upgrade: `updateUser({ email })` — sends magic link to confirm ownership
- [x] If email already registered: fallback to `signInWithOtp` (sign in to existing account)
- [x] No claim endpoint needed — `user_id` stays the same on upgrade

### Supabase Auth Configuration
- [x] Anonymous sign-ins enabled in Supabase dashboard
- [x] Magic Link / OTP email auth enabled
- [x] Google OAuth configured (Google Cloud Console + Supabase provider)
- [x] Custom SMTP via Resend — emails sent from custom domain, 25/hr limit
- [x] **Magic Link** email template updated to use `{{ .Token }}` (6-digit code)
- [x] **Confirm Signup** email template updated to use `{{ .Token }}` (6-digit code)
- [x] OTP expiry set to 600 seconds (10 minutes) in Supabase dashboard
- [x] Google OAuth authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`

### Auth Modal
- [x] Single modal for both sign-in and upgrade (`mode="signin" | "upgrade"`)
- [x] Google button + email input on same screen; OTP verify on next step
- [x] Upgrade mode uses `updateUser` (magic link); falls back to OTP if email already registered
- [x] New user signup confirmation uses `type: "signup"`; existing user sign-in uses `type: "email"` — both tried automatically
- [x] "Send code" button with Send icon, centered layout
- [x] Google OAuth redirects back to `/` for token processing (avoids middleware collision)

### Frontend Auth Flow
- [x] `ensureAnonymousSession()` called on home page mount before any upload
- [x] `proxy.ts` (Next.js middleware) — redirects unauthenticated + anonymous users away from `/dashboard`
- [x] Guest icon in document page header — clicking opens upgrade modal
- [x] `UserMenu` dropdown for authenticated users — sign out + delete account (with confirmation)
- [x] Nudge banner — appears 15s after analysis completes for anonymous users; disappears on sign-in
- [x] Nudge banner timer pauses correctly when auth modal is open (tab switch fix)
- [x] All `lib/api.ts` calls send `Authorization: Bearer <token>` via Supabase session

### Backend Auth
- [x] `AuthUser` dataclass with `user_id: str` and `is_anonymous: bool`
- [x] `/upload` requires auth (401 if none); anonymous users limited to 1 document
- [x] `/documents` returns `total: 1` for anonymous, profile quota for real users
- [x] `DELETE /account` — deletes S3 files then removes auth user (cascades to DB rows)
- [x] Per-user rate limit on `/ask` — 20 questions/hour rolling window, returns 429

### Notifications & Redirects
- [x] Sonner toast system (`<Toaster position="top-center" richColors />` in layout)
- [x] Toast on: signed in, signed out, account deleted, summary ready, flashcards generated
- [x] URL param (`?msg=`) for cross-page notifications — cleaned from URL immediately after display
- [x] Toasts deduplicated by ID (prevents StrictMode double-firing)
- [x] Sign-in redirects to `/dashboard?msg=signed_in` from all flows

### Branding
- [x] App icon (`/icon.png` + `/icon.svg`) as favicon across all pages
- [x] Lumina logo + name displayed in home page hero, document page header, dashboard header
- [x] "PDF summarizer" subtitle inline with Lumina name in headers

-------------------------------------------------

## Phase 6: Production & Polish 🛡️

### Infrastructure & Deployment
- [ ] Containerize backend using Docker
- [ ] Deploy backend to AWS ECS (Fargate) via Terraform
- [ ] Deploy frontend to Vercel (auto-deploy from GitHub main branch)
- [ ] Configure environment variables in ECS task definition and Vercel project settings

### CI/CD
- [ ] Setup GitHub Actions pipeline — lint, test, build Docker image on PR
- [ ] Auto-deploy to ECS on merge to main via GitHub Actions

### Security & Auth
- [ ] Prompt engineering to prevent misuse
- [ ] Configure strict CORS policy — whitelist Vercel frontend domain only
- [ ] Rotate all API keys and move secrets to AWS Secrets Manager
- [ ] Add global request rate limiting middleware (slowapi) to prevent brute-force

### Reliability
- [ ] Add structured application logging (replace print statements with Python logging)
- [ ] Integrate error tracking (Sentry) for both frontend and backend
- [ ] Add request timeout handling for Gemini and OpenAI calls
- [ ] Add Supabase Edge Function or cron webhook to delete S3 objects for expired anonymous documents

### Performance
- [ ] Tune RAG retrieval — test match_threshold and match_count against real queries
- [ ] Add HNSW index to document_chunks.embedding for faster similarity search at scale
