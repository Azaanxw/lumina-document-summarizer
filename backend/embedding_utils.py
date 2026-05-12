from openai import OpenAI

def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch-embeds a list of strings using OpenAI text-embedding-3-small (1536 dims)."""
    client = OpenAI()
    response = client.embeddings.create(model="text-embedding-3-small", input=texts)
    return [item.embedding for item in response.data]
