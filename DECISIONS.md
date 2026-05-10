This document outlines the technical trade-offs and rationale behind the DocumentSummarizer (Lumina) architecture.

---

### 1. Vector Storage
**Choice:** `Pinecone (Serverless)`  
**Why:** I needed a database that handles high-dimensional vector data without the headache of managing a local server. While ChromaDB is great for local testing, **Pinecone** allows Lumina to be truly "cloud-native" from day one and scales automatically.

### 2. Backend Framework
**Choice:** `FastAPI (Python)`  
**Why:** RAG pipelines are heavy on I/O (waiting for OpenAI or database responses). **FastAPI** handles asynchronous tasks natively, meaning the app stays responsive even when it's processing large PDFs.

### 3. Frontend Architecture
**Choice:** `Next.js 15 (App Router) + TypeScript`  
**Why:** I chose **Next.js** to benefit from Server Components, which keep the heavy lifting off the user's browser. **TypeScript** was my default for previous projects and prevents errors that aren't detected by Javascript.

### 4. UI & Design System
**Choice:** `Shadcn/ui + Tailwind CSS`  
**Why:** Best minimilistic designs and is industry standard.

### 5. Deployment & DevOps
**Choice:** `Docker + GitHub Actions`  
**Why:** I chose **Docker** to ensure the backend and frontend run the same as on my local machine. Pairing this with Github Actions to handle the CI/CD pipelines.