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
- [x] Install google-generativeai, openai, and langchain-text-splitters
- [x] Add GEMINI_API_KEY and OPENAI_API_KEY to .env

### 2. Path B: Precision RAG & Citations
- [ ] Implement page-anchored chunking to prevent page-crossing.
- [ ] Create embedding_utils.py for OpenAI text-embedding-3-small.
- [ ] Sync upload flow: Extract -> Chunk -> Embed -> DB Store.

### 3. Path A: Study Tools (Gemini 1.5 Flash)
- [ ] Create Mega-Prompt for Summary and 10-Question Quiz.
- [ ] Create Manual-Prompt for 10 Flashcards.
- [ ] Build /process-document and /generate-cards endpoints.

### 4. Interactive Q&A & Dictionary Logic
- [ ] Build /ask endpoint using Supabase RPC for retrieval.
- [ ] Refine Q&A prompt to return Answer + Page Number + Snippet.
- [ ] Add backend helper for Free Dictionary API proxy.
- [ ] Standardize JSON payload for frontend PDF "jump-to-page" sync.

-------------------------------------------------


## Phase 4: Frontend & UI 🎨
- [ ] Basic React/Next.js dashboard
- [ ] File upload drag-and-drop component
- [ ] Real-time summary display

-------------------------------------------------

## Phase 5: Production & Polish 🛡️
- [ ] Containerize Backend & Frontend using Docker
- [ ] Implement Rate Limiting (prevent API spam/abuse)
- [ ] Configure strict CORS policies for frontend communication
- [ ] Add Application Logging & Error Tracking
- [ ] Setup GitHub Actions for CI/CD (Automated testing/deployment)
- [ ] Final deployment (e.g., Vercel for Frontend, Render/AWS for Backend)