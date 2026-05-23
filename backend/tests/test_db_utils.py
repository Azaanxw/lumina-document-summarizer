import pytest
from unittest.mock import MagicMock, patch
import db_utils


@pytest.fixture
def mock_sb():
    mock = MagicMock()
    with patch("db_utils.get_supabase_client", return_value=mock):
        yield mock


def test_get_supabase_client_raises_when_env_not_set(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    with pytest.raises(ValueError):
        db_utils.get_supabase_client()


def test_save_document_metadata_returns_data_on_success(mock_sb):
    mock_sb.table.return_value.insert.return_value.execute.return_value.data = [{"id": "doc-1"}]
    result = db_utils.save_document_metadata("user-1", "file.pdf", "content")
    assert result == [{"id": "doc-1"}]


def test_save_document_metadata_returns_none_on_exception(mock_sb):
    mock_sb.table.return_value.insert.return_value.execute.side_effect = Exception("DB error")
    result = db_utils.save_document_metadata("user-1", "file.pdf", "content")
    assert result is None


def test_get_profile_returns_dict_on_success(mock_sb):
    profile = {"documents_used": 2, "document_quota": 4}
    mock_sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = profile
    result = db_utils.get_profile("user-1")
    assert result == profile


def test_get_profile_returns_none_on_exception(mock_sb):
    mock_sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("err")
    result = db_utils.get_profile("user-1")
    assert result is None


def test_get_document_content_returns_string(mock_sb):
    mock_sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {"content": "full text"}
    result = db_utils.get_document_content("doc-1")
    assert result == "full text"


def test_search_chunks_returns_list_on_success(mock_sb):
    chunks = [{"content": "text", "metadata": {"page_number": 1}}]
    mock_sb.rpc.return_value.execute.return_value.data = chunks
    result = db_utils.search_chunks("doc-1", [0.1] * 1536)
    assert result == chunks
    mock_sb.rpc.assert_called_once_with("match_documents", {
        "query_embedding": [0.1] * 1536,
        "match_threshold": 0.3,
        "match_count": 6,
        "filter_document_id": "doc-1",
    })


def test_search_chunks_returns_empty_list_on_exception(mock_sb):
    mock_sb.rpc.return_value.execute.side_effect = Exception("RPC error")
    result = db_utils.search_chunks("doc-1", [0.1] * 1536)
    assert result == []


def test_save_document_chunks_inserts_correct_rows(mock_sb):
    chunks = [
        {"content": "chunk text", "metadata": {"page_number": 1}, "embedding": [0.1] * 1536}
    ]
    mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock()
    result = db_utils.save_document_chunks("doc-1", chunks)
    assert result is True
    inserted = mock_sb.table.return_value.insert.call_args[0][0]
    assert len(inserted) == 1
    assert inserted[0]["document_id"] == "doc-1"
    assert inserted[0]["content"] == "chunk text"


def test_get_document_cache_returns_dict(mock_sb):
    cache = {"summary": "s", "quiz": [], "flashcards": None}
    mock_sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = cache
    result = db_utils.get_document_cache("doc-1")
    assert result == cache


def test_save_document_cache_returns_true(mock_sb):
    mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()
    result = db_utils.save_document_cache("doc-1", {"summary": "text"})
    assert result is True


def test_clear_summary_cache_nulls_summary_and_quiz(mock_sb):
    mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()
    result = db_utils.clear_summary_cache("doc-1")
    assert result is True
    update_args = mock_sb.table.return_value.update.call_args[0][0]
    assert update_args["summary"] is None
    assert update_args["quiz"] is None


def test_clear_flashcards_cache_nulls_flashcards(mock_sb):
    mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()
    result = db_utils.clear_flashcards_cache("doc-1")
    assert result is True
    update_args = mock_sb.table.return_value.update.call_args[0][0]
    assert update_args["flashcards"] is None


def test_get_user_document_filenames_returns_string_list(mock_sb):
    mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"filename": "a.pdf"}, {"filename": "b.pdf"}
    ]
    result = db_utils.get_user_document_filenames("user-1")
    assert result == ["a.pdf", "b.pdf"]


def test_increment_documents_used_calls_rpc(mock_sb):
    mock_sb.rpc.return_value.execute.return_value = MagicMock()
    result = db_utils.increment_documents_used("user-1")
    assert result is True
    mock_sb.rpc.assert_called_once_with("increment_documents_used", {"uid": "user-1"})
