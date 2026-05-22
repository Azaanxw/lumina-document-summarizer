import logging
from openai import OpenAI

logger = logging.getLogger(__name__)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch-embeds a list of strings using OpenAI text-embedding-3-small (1536 dims)."""
    client = OpenAI()
    try:
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=texts,
            timeout=30,
        )
        return [item.embedding for item in response.data]
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        raise
