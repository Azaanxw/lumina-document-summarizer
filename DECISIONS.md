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
Choice: Docker + GitHub Actions

Why: I chose Docker to ensure the backend and frontend run exactly the same way in production as they do on my local machine. I paired this with GitHub Actions to handle the CI/CD pipelines, automating the building and testing process.