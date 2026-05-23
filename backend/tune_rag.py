"""
RAG retrieval tuning script.

Usage (from backend/ with venv activated):
    python tune_rag.py <doc_index> "question 1" "question 2" ...

Example:
    python tune_rag.py 0 "What are the key recruitment trends?" "What skills are in demand?"

doc_index refers to the position in the 5 most recent documents (0 = newest).
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

from supabase import create_client
from openai import OpenAI


def get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    return create_client(url, key)


def embed(text: str) -> list[float]:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    resp = client.embeddings.create(model="text-embedding-3-small", input=[text])
    return resp.data[0].embedding


def run_query(supabase, document_id: str, embedding: list[float], threshold: float, count: int) -> list[dict]:
    resp = supabase.rpc("match_documents", {
        "query_embedding": embedding,
        "match_threshold": threshold,
        "match_count": count,
        "filter_document_id": document_id,
    }).execute()
    return resp.data or []


def main():
    sb = get_supabase()

    docs = sb.table("documents").select("id, filename, created_at").order("created_at", desc=True).limit(5).execute().data or []
    if not docs:
        sys.exit("No documents found in the database.")

    print("\n=== Available documents ===")
    for i, d in enumerate(docs):
        name = str(d["filename"]).split("_", 1)[-1] if "_" in str(d["filename"]) else str(d["filename"])
        print(f"  [{i}] {name[:60]}  (id: {str(d['id'])[:8]}...)")

    if len(sys.argv) < 3:
        sys.exit("\nUsage: python tune_rag.py <doc_index> \"question 1\" \"question 2\" ...")

    doc_index = int(sys.argv[1])
    questions = sys.argv[2:]
    doc = docs[doc_index]
    doc_id = str(doc["id"])
    print(f"\nUsing: {str(doc['filename'])[:70]}\n")

    thresholds = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7]
    all_recommendations: list[tuple[float, int]] = []

    for question in questions:
        print(f"Q: {question}")
        print(f"   Embedding...")
        vec = embed(question)

        print(f"\n   {'Threshold':<12} {'Chunks':<10} {'Similarity scores'}")
        print(f"   {'-'*55}")

        best_threshold = None
        for t in thresholds:
            chunks = run_query(sb, doc_id, vec, threshold=t, count=10)
            scores = []
            for c in chunks:
                score = c.get("similarity") or c.get("score")
                if score is not None:
                    scores.append(round(float(score), 3))

            score_str = "  ".join(str(s) for s in scores) if scores else "(no similarity column)"
            print(f"   {t:<12} {len(chunks):<10} {score_str}")

            if best_threshold is None and len(chunks) >= 2:
                best_threshold = t

        print()
        if best_threshold is not None:
            rec_threshold = round(min(best_threshold + 0.1, 0.6), 1)
            chunks_at_rec = run_query(sb, doc_id, vec, threshold=rec_threshold, count=10)
            rec_count = max(3, min(len(chunks_at_rec), 6))
            all_recommendations.append((rec_threshold, rec_count))
            print(f"   -> Recommended: threshold={rec_threshold}, count={rec_count} ({len(chunks_at_rec)} chunks available)")
        else:
            print(f"   -> No chunks found above 0.2 — document may have no stored chunks.")
        print()

    if all_recommendations:
        avg_threshold = round(sum(r[0] for r in all_recommendations) / len(all_recommendations), 2)
        avg_count = round(sum(r[1] for r in all_recommendations) / len(all_recommendations))
        print("=" * 60)
        print(f"OVERALL RECOMMENDATION (averaged across {len(questions)} questions):")
        print(f"  match_threshold = {avg_threshold}")
        print(f"  match_count     = {avg_count}")
        print("=" * 60)


if __name__ == "__main__":
    main()
