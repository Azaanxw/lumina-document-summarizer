# 🚀 Lumina Project Roadmap

## Phase 1: Infrastructure & Core Setup ✅
- [x] Set up Supabase Project & Auth
- [x] Provision AWS S3 Bucket via Terraform
- [x] Configure AWS CLI & Local Environment
- [x] Project Folder Structure & Git Setup

## Phase 2: Backend Development & Database 🛠️
- [x] Create FastAPI PDF Upload Endpoint
- [x] Integrate Boto3 for S3 File Transfer
- [ ] Connect FastAPI to Supabase (Database & Auth Secret) 
- [ ] Create `documents` table with `user_id` foreign keys
- [ ] Implement FastAPI JWT Dependency for Auth Guarding
- [ ] Implement PDF text extraction logic

## Phase 3: AI & RAG Logic 🧠
- [ ] Integrate OpenAI/Anthropic API
- [ ] Setup Vector database for document search
- [ ] Create Summarization prompt engineering

## Phase 4: Frontend & UI 🎨
- [ ] Basic React/Next.js dashboard
- [ ] File upload drag-and-drop component
- [ ] Real-time summary display

## Phase 5: Production & Polish 🛡️
- [ ] Implement Rate Limiting (prevent API spam/abuse)
- [ ] Configure strict CORS policies for frontend communication
- [ ] Add Application Logging & Error Tracking
- [ ] Setup GitHub Actions for CI/CD (Automated testing/deployment)
- [ ] Final deployment (e.g., Vercel for Frontend, Render/AWS for Backend)