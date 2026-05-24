# Lumina

AI-powered document analysis tool — upload a PDF and get an instant summary, ask questions with cited answers, generate quizzes, and build flashcard decks.

---

## Features

- Summarize long PDFs in seconds (Gemini 2.0 Flash Lite)
- Ask questions about a document and get answers with page citations (RAG via OpenAI embeddings + pgvector)
- Auto-generated multiple-choice quizzes and flashcard decks
- Inline dictionary lookup (double click any text)
- Anonymous-first: no account needed to try it (one free document)
- Per-user quota, rate limiting on uploads and Q&A

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript 5, Tailwind CSS 4, shadcn/ui |
| Backend | FastAPI (Python 3.13), uvicorn |
| Database | Supabase (PostgreSQL + pgvector) |
| Storage | AWS S3 + CloudFront |
| AI | Gemini 2.0 Flash Lite (summaries, quizzes, flashcards), OpenAI text-embedding-3-small (RAG) |
| Auth | Supabase Auth — anonymous session, Google OAuth, Magic Link OTP |
| Infra | Docker, GitHub Actions CI/CD, Vercel (frontend), AWS ECS (backend), Terraform |

---

## Architecture

On upload, the backend extracts text from the PDF, splits it into page-anchored chunks, generates OpenAI embeddings, and stores them in Supabase pgvector. At query time, the user's question is embedded and the top-k most similar chunks are retrieved and passed to Gemini as context, returning an answer with page-number citations.

```
Browser → Next.js → FastAPI → Supabase (auth, metadata, vectors)
                            → AWS S3 / CloudFront (PDF files)
                            → OpenAI (embeddings)
                            → Gemini (text generation)
```

---

## Prerequisites

- Python 3.13+
- Node.js 20+
- A Supabase project (free tier works)
- AWS account with an S3 bucket
- OpenAI API key
- Gemini API key (Google AI Studio — free tier: 500 req/day)

---

## Local Setup

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env` (see [Environment Variables](#environment-variables) below), then:

```bash
uvicorn main:app --reload
# API running at http://localhost:8000
# Interactive docs at http://localhost:8000/docs
```

### 2. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local` (see below), then:

```bash
npm run dev
# App running at http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service role key (bypasses RLS for backend writes) |
| `AWS_ACCESS_KEY_ID` | yes | S3 credentials |
| `AWS_SECRET_ACCESS_KEY` | yes | S3 credentials |
| `AWS_REGION` | yes | e.g. `eu-west-2` |
| `AWS_S3_BUCKET` | yes | Bucket name |
| `OPENAI_API_KEY` | yes | For text-embedding-3-small |
| `GEMINI_API_KEY` | yes | For Gemini 2.0 Flash Lite |
| `CLOUDFRONT_DOMAIN` | no | CDN domain for signed PDF URLs |
| `CLOUDFRONT_KEY_PAIR_ID` | no | CloudFront key pair ID |
| `CLOUDFRONT_PRIVATE_KEY_B64` | no | Base64-encoded RSA private key |
| `SENTRY_DSN` | no | Error monitoring |
| `ENVIRONMENT` | no | `development` (default) or `production` |
| `LOG_LEVEL` | no | `INFO` (default) |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | Backend URL — `http://localhost:8000` locally |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key |
| `NEXT_PUBLIC_SENTRY_DSN` | no | Error monitoring |

---

## Running Tests

```bash
# Backend (pytest + coverage)
cd backend
pytest --cov=. --cov-report=term-missing

# Frontend unit tests (Jest)
cd frontend
npm test

# Frontend end-to-end (Playwright)
cd frontend
npm run test:e2e
```

---

## Project Structure

```
├── backend/          FastAPI app — RAG pipeline, S3/Supabase helpers, rate limiting
├── frontend/         Next.js app — upload, dashboard, study interface
├── infrastructure/   Terraform — S3, CloudFront, ECS task definitions
├── .github/          GitHub Actions — CI, deploy workflows
└── docker-compose.yml
```
