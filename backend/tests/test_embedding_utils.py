from unittest.mock import MagicMock, patch
from embedding_utils import embed_texts


def test_embed_texts_returns_list_of_floats():
    mock_client = MagicMock()
    mock_client.embeddings.create.return_value = MagicMock(
        data=[MagicMock(embedding=[0.1] * 1536)]
    )
    with patch("embedding_utils.OpenAI", return_value=mock_client):
        result = embed_texts(["test text"])

    assert len(result) == 1
    assert len(result[0]) == 1536


def test_embed_texts_calls_correct_model():
    mock_client = MagicMock()
    mock_client.embeddings.create.return_value = MagicMock(
        data=[MagicMock(embedding=[0.0] * 1536)]
    )
    with patch("embedding_utils.OpenAI", return_value=mock_client):
        embed_texts(["hello"])

    mock_client.embeddings.create.assert_called_once_with(
        model="text-embedding-3-small",
        input=["hello"],
        timeout=30,
    )


def test_embed_texts_handles_multiple_inputs():
    texts = ["first", "second", "third"]
    mock_client = MagicMock()
    mock_client.embeddings.create.return_value = MagicMock(
        data=[MagicMock(embedding=[float(i)] * 1536) for i in range(3)]
    )
    with patch("embedding_utils.OpenAI", return_value=mock_client):
        result = embed_texts(texts)

    assert len(result) == 3
    mock_client.embeddings.create.assert_called_once_with(
        model="text-embedding-3-small",
        input=texts,
        timeout=30,
    )
