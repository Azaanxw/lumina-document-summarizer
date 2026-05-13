# 🚀 Lumina Project Roadmap
------------------------------------------------

## Phase 1: Infrastructure & Core Setup ✅
- [x] Set up Supabase Project & Auth
- [x] Provision AWS S3 Bucket via Terraform
- [x] Configure AWS CLI & Local Environment
- [x] Project Folder Structure & Git Setup

-------------------------------------------------

## Phase 2: Backend Development & Database 🛠️
- [x] Create FastAPI PDF Upload Endpoint
- [x] Integrate Boto3 for S3 File Transfer
- [x] Connect FastAPI to Supabase (Database & Auth Secret) 
- [x] Create `documents` table with `user_id` foreign keys
- [ ] Implement FastAPI JWT Dependency for Auth Guarding - using mockuserid for now - will do when react frontend is done
- [x] Implement PDF text extraction logic (PyMuPDF)


------------------------------------------------
## Phase 3: AI Logic & Interactive PDF Engine 🧠

### 1. Foundation & API Setup
- [x] Enable pgvector and create tables/RPC in Supabase (1536 dim)
- [x] Install google-genai, openai, and langchain-text-splitters
- [x] Add GEMINI_API_KEY and OPENAI_API_KEY to .env

### 2. Path B: Precision RAG & Citations
- [x] Implement page-anchored chunking to prevent page-crossing.
- [x] Create embedding_utils.py for OpenAI text-embedding-3-small.
- [x] Sync upload flow: Extract -> Chunk -> Embed -> DB Store.

### 3. Path A: Study Tools (Gemini 3.1 Flash Lite)
- [x] Create Mega-Prompt for Summary and 10-Question Quiz. (Summary should summarize the main points and the quizzes should test user knowledge across the whole PDF using multiple choice questions)
- [x] Create Manual-Prompt for 10 Flashcards. (These flashcards contain the most likely questions that can get asked on the PDF and their given respective answers Q:A)
- [x] Build /process-document and /generate-cards endpoints.

### 4. Interactive Q&A & Dictionary Logic
- [x] Build /ask endpoint using Supabase RPC for retrieval.
- [x] Refine Q&A prompt to return Answer + Page Number + Snippet.
- [x] Add backend helper for Free Dictionary API proxy (GET /dictionary/{word}).
- [x] Standardize JSON payload for frontend PDF "jump-to-page" sync.
- [x] Add search_chunks() to db_utils.py to call match_documents RPC.
- [x] Add generate_answer() to gemini_utils.py with grounded citation prompt.
- [x] Handle graceful 404 when no relevant chunks found for a question.

-------------------------------------------------


## Phase 4: Frontend & UI 🎨
- [x] Basic React/Next.js dashboard
- [x] File upload drag-and-drop component
- [x] PDF preview with react-pdf (replaces iframe — enables text selection + dictionary)
- [x] Split layout — PDF left, study tools right
- [x] Dictionary popup on PDF text selection
- [x] Citation badge click → scroll PDF to page + highlight snippet
- [x] Real-time summary display
- [ ] Supabase caching of AI content (summary/quiz/flashcards) per document — avoid re-generation on revisit
- [ ] Error boundary / empty-state polish across all views
- [ ] Loading skeletons for all async data fetches

-------------------------------------------------

## Phase 5: Authentication & User Accounts

### Onboarding Flow (Guest Upload → Deferred Auth)
The user never hits a login wall. They upload first, then are nudged to save.

1. User lands on `/` → sees upload zone, no login required
2. User drops a PDF → upload starts immediately, document created with `user_id = NULL` (guest)
3. User is redirected to `/document/{id}` — AI starts generating in the background
4. A "Save this document" banner/modal appears asking them to sign in or create an account
5. If they log in → frontend calls `POST /documents/{id}/claim` → document assigned to their account
6. If they dismiss → they can still use the document in the current session (not saved)
7. Unclaimed documents (user_id IS NULL, older than 24h) are automatically deleted by a cleanup job

### Database Changes
- [ ] Make `documents.user_id` nullable — allow guest uploads with no user
- [ ] Add Supabase pg_cron job: delete documents where `user_id IS NULL AND created_at < NOW() - INTERVAL '24 hours'`
- [ ] Enable RLS on `documents` and `document_chunks` — users can only access their own rows
- [ ] Write RLS policies: `user_id = auth.uid()` for SELECT/DELETE; allow INSERT with `user_id = NULL`

### Supabase Auth Setup
- [ ] Enable Email/Password auth provider in Supabase dashboard
- [ ] Install `@supabase/supabase-js` + `@supabase/ssr` in frontend
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`
- [ ] Create `lib/supabase.ts` — browser Supabase client via `createBrowserClient`

### Backend Auth
- [ ] Add `POST /documents/{id}/claim` endpoint — reads JWT from `Authorization` header, sets `user_id` where currently NULL
- [ ] Replace `MOCK_USER_ID` with FastAPI JWT dependency — reads + validates Supabase JWT
- [ ] Pass verified `user_id` into `/upload`, `/documents`, `/process-document`, `/generate-cards`, `/ask`
- [ ] Return 401 for protected endpoints when token is missing/invalid
- [ ] `/upload` stays unauthenticated — accepts optional Bearer token; sets `user_id` if present, otherwise NULL

### Frontend Auth
- [ ] Auth modal component with Login / Sign Up tabs (email + password via Supabase)
- [ ] Show auth modal automatically on document page when `user_id` is unclaimed
- [ ] After login, call `/claim`, then dismiss modal and show "Document saved" confirmation
- [ ] `middleware.ts` — redirect unauthenticated users away from `/dashboard`
- [ ] Pass `Authorization: Bearer <token>` in all `lib/api.ts` calls when session exists
- [ ] Dashboard: only show logged-in user's documents (filter out guests)
- [ ] Header: show user email + sign out button when authenticated

### Rate Limiting
- [ ] Per-user rate limit on `/process-document` and `/generate-cards` — max 10 calls/hour
- [ ] Per-user rate limit on `/ask` — max 30 questions/hour
- [ ] Return `429 Too Many Requests` with `Retry-After` header when limit hit
- [ ] Show rate limit error in UI with friendly message + countdown

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
- [ ] Implement FastAPI JWT dependency for auth guarding (replace MOCK_USER_ID)
- [ ] Prompt Engineering to prevent misabuse
- [ ] Configure strict CORS policy — whitelist Vercel frontend domain only
- [ ] Enable Supabase RLS policies for all tables (documents, document_chunks, profiles)
- [ ] Rotate all API keys and move secrets to AWS Secrets Manager

### Reliability
- [ ] Add structured application logging (replace print statements with Python logging)
- [ ] Integrate error tracking (e.g. Sentry) for both frontend and backend
- [ ] Implement rate limiting on all endpoints (prevent API spam/abuse)
- [ ] Add request timeout handling for Gemini and OpenAI calls

### Performance
- [ ] Tune RAG retrieval — test match_threshold and match_count against real queries
- [ ] Add HNSW index to document_chunks.embedding for faster similarity search at scale