This document outlines the technical trade-offs and rationale behind the DocumentSummarizer (Lumina) architecture.

---

### 1. **Vector Storage & Search**
**Choice:** Supabase (`pgvector` extension)

**Why:** While specialized vector databases like Pinecone are heavily featured in AI tutorials, I chose to use Supabase’s `pgvector` extension to consolidate the architecture. Keeping vector embeddings in the exact same PostgreSQL database as user authentication and document metadata eliminates the "data silo" problem. 

This approach allows for powerful hybrid querying (e.g., performing a Semantic Vector Search strictly filtered by a relational `user_id` foreign key) in a single database call. It also drastically simplifies data lifecycle management—if a user deletes their account or a document, the associated vectors are automatically wiped via cascading deletes, avoiding the need to orchestrate state across multiple third-party APIs. This decision prioritizes data integrity, operational simplicity, and secure Row Level Security (RLS).

2. **Backend Framework**
Choice: FastAPI (Python)

Why: RAG pipelines are heavy on I/O (waiting for OpenAI or database responses). FastAPI handles asynchronous tasks natively, meaning the app stays responsive even when it's processing large PDFs.

3. **Frontend Architecture**
Choice: Next.js 15 (App Router) + TypeScript

Why: I chose Next.js to benefit from Server Components, which keep the heavy lifting off the user's browser. TypeScript was my default for previous projects and prevents errors that aren't detected by Javascript.

4. **Database & Auth**
Choice: Supabase (PostgreSQL)

Why: I’m using Supabase for the database and authentication because it proves I can handle relational data and user privacy using Row Level Security (RLS). This is where I track the document history and user sessions.

5. **File & Object Storage**
Choice: AWS S3 (managed via Terraform) + Boto3

Why: I chose AWS S3 as the object storage solution for saving the original PDF files. To take it a step further, I managed this via Terraform to prove I can use industry-standard cloud services and Infrastructure as Code. Boto3 is used for S3 file transfer

6. **UI & Design System**
Choice: Shadcn/ui + Tailwind CSS

Why: These provide the best minimalistic designs and are currently the industry standard for building modern web apps.

7. **Deployment & DevOps**
Choice: Docker + GitHub Actions + Vercel (frontend) + AWS ECS (backend)

Why: Docker ensures the backend runs identically across local and production environments. GitHub Actions automates CI/CD. Vercel hosts the Next.js frontend with native App Router support and zero-config deploys from GitHub. AWS ECS hosts the FastAPI backend — it extends the existing AWS infrastructure (S3, Terraform) into a complete cloud story on one provider, demonstrating real production deployment patterns (containerisation, IAM, VPC, load balancing) that Render or similar PaaS tools abstract away.

8. **AI Model for Study Tools**
Choice: Gemini 3.1 Flash Lite (`google-genai` SDK)

Why: Chosen for having the highest free-tier quota of all available models (500 RPD, 15 RPM). Gemini 2.0/2.5 Flash were exhausted during development, and Pro models have no free quota. OpenAI is already used for embeddings so Gemini keeps generation on a separate provider. The `google-genai` SDK replaces the deprecated `google-generativeai` package and is required for all Gemini 3.x models.

9. **Dictionary Lookup**
Choice: Free Dictionary API + Datamuse API

Why: No single free API covers everything reliably. Free Dictionary API (`api.dictionaryapi.dev`) handles definitions, phonetics, and examples. Datamuse (`api.datamuse.com`) handles synonyms, as the Free Dictionary API returns none for many common words. Both are keyless with no rate limits. Calls run in parallel via `asyncio.gather()` so there's no added latency.

10. **RAG Retrieval Tuning — match_count**
Choice: `match_count = 6` (reduced from 10)

Why: After running real queries against live documents using `tune_rag.py`, similarity scores showed a consistent drop-off after the 6th chunk. The bottom 4 chunks (positions 7–10) scored between 0.33–0.48 — weakly related content that added noise to the context Gemini receives rather than useful information. Passing fewer, higher-quality chunks to Gemini means the model spends less of its context window on irrelevant text and can produce more precise, grounded answers. It also reduces token usage on every `/ask` request, lowering OpenAI embedding and Gemini generation costs at scale.

11. **RAG Retrieval Tuning — chunk_size**
Choice: `chunk_size = 600` characters (reduced from 800), overlap kept at 100

Why: 800-character chunks often span multiple sub-topics on the same page — a chunk might open with a discussion of hiring trends and end with a note on remote work, diluting the semantic signal of the embedding. When a user asks a specific question, the embedding for that question competes against a mixed-topic chunk rather than a focused one, producing lower cosine similarity scores (observed at 0.37–0.47 for specific questions vs. 0.69 for broad ones). Reducing to 600 characters produces tighter, more semantically coherent chunks, which raises similarity scores for targeted questions and improves retrieval precision. The 100-character overlap is kept to preserve context continuity across chunk boundaries. Existing documents retain their 800-character chunks — only new uploads benefit, since re-embedding the entire corpus was not justified.

12. **PDF Delivery**
Choice: CloudFront signed URLs (with S3 presigned URL fallback)

Why: The original implementation proxied every PDF through the ECS container — the backend would download the file from S3 into memory and stream it back to the browser. This consumed ECS CPU, memory, and network bandwidth for pure file transfer, leaving fewer resources for actual AI workloads. CloudFront sits in front of S3 and serves PDFs directly to the browser from AWS edge locations, bypassing the container entirely. The backend still performs one lightweight operation (ownership check + signing a short-lived URL), but the file transfer itself never touches ECS. CloudFront also caches PDFs at the edge, so repeat views are served from a location geographically close to the user rather than from the S3 bucket in eu-west-2. Access remains private via RSA-signed URLs — CloudFront rejects any request without a valid signature from the backend.