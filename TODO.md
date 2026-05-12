# 🚀 Lumina Project Roadmap

## Phase 1: Infrastructure & Core Setup ✅
- [x] Set up Supabase Project & Auth
- [x] Provision AWS S3 Bucket via Terraform
- [x] Configure AWS CLI & Local Environment
- [x] Project Folder Structure & Git Setup

## Phase 2: Backend Development & Database 🛠️
- [x] Create FastAPI PDF Upload Endpoint
- [x] Integrate Boto3 for S3 File Transfer
- [x] Connect FastAPI to Supabase (Database & Auth Secret) 
- [x] Create `documents` table with `user_id` foreign keys
- [ ] Implement FastAPI JWT Dependency for Auth Guarding - using mockuserid for now - will do when react frontend is done
- [ ] Implement PDF text extraction logic

## Phase 3: AI & RAG Logic 🧠
- [ ] Implement text extraction (PyMuPDF) and Recursive Character Chunking (LangChain)
- [ ] Set up Supabase `pgvector` extension for storing embeddings
- [ ] Integrate OpenAI `text-embedding-3-small` API for chunk vectorization
- [ ] Implement Hybrid Search (Cosine Similarity + Keyword) in Supabase RPC
- [ ] Create Prompt Engineering pipeline for the final LLM response

## Phase 4: Frontend & UI 🎨
- [ ] Basic React/Next.js dashboard
- [ ] File upload drag-and-drop component
- [ ] Real-time summary display

## Phase 5: Production & Polish 🛡️
- [ ] Containerize Backend & Frontend using Docker
- [ ] Implement Rate Limiting (prevent API spam/abuse)
- [ ] Configure strict CORS policies for frontend communication
- [ ] Add Application Logging & Error Tracking
- [ ] Setup GitHub Actions for CI/CD (Automated testing/deployment)
- [ ] Final deployment (e.g., Vercel for Frontend, Render/AWS for Backend)