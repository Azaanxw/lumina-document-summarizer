from unittest.mock import MagicMock, patch
from rate_limiter import DBRateLimiter


def _make_sb_mock(rows: list[dict]):
    """Build a supabase mock where select().eq().eq().order().execute() returns rows."""
    mock_sb = MagicMock()

    # delete chain
    (mock_sb.table.return_value
        .delete.return_value
        .eq.return_value
        .eq.return_value
        .lt.return_value
        .execute.return_value) = MagicMock()

    # select chain: .select().eq().eq().order().execute()
    result = MagicMock()
    result.data = rows
    (mock_sb.table.return_value
        .select.return_value
        .eq.return_value
        .eq.return_value
        .order.return_value
        .execute.return_value) = result

    # insert chain
    (mock_sb.table.return_value
        .insert.return_value
        .execute.return_value) = MagicMock()

    return mock_sb


def test_db_rate_limiter_allows_under_limit():
    rows = [{"created_at": "2024-01-01T12:00:00+00:00"}] * 5
    mock_sb = _make_sb_mock(rows)
    with patch("db_utils.get_supabase_client", return_value=mock_sb):
        limiter = DBRateLimiter(limit=20, window_seconds=3600)
        allowed, retry_after = limiter.check("user-1", "ask")
    assert allowed is True
    assert retry_after == 0


def test_db_rate_limiter_allows_at_limit_minus_one():
    rows = [{"created_at": "2024-01-01T12:00:00+00:00"}] * 19
    mock_sb = _make_sb_mock(rows)
    with patch("db_utils.get_supabase_client", return_value=mock_sb):
        limiter = DBRateLimiter(limit=20, window_seconds=3600)
        allowed, _ = limiter.check("user-1", "ask")
    assert allowed is True


def test_db_rate_limiter_blocks_at_limit():
    rows = [{"created_at": "2024-01-01T12:00:00+00:00"}] * 20
    mock_sb = _make_sb_mock(rows)
    with patch("db_utils.get_supabase_client", return_value=mock_sb):
        limiter = DBRateLimiter(limit=20, window_seconds=3600)
        allowed, retry_after = limiter.check("user-1", "ask")
    assert allowed is False
    assert retry_after > 0


def test_db_rate_limiter_fails_open_on_db_error():
    with patch("db_utils.get_supabase_client", side_effect=Exception("DB down")):
        limiter = DBRateLimiter(limit=20, window_seconds=3600)
        allowed, retry_after = limiter.check("user-1", "ask")
    assert allowed is True
    assert retry_after == 0


def test_ask_returns_429_with_retry_after_when_rate_limited(authed_client, mock_rate_limiter):
    mock_rate_limiter.check.return_value = (False, 30)
    with patch("main.verify_document_owner", return_value=True):
        response = authed_client.post("/ask", json={"document_id": "rate-doc", "question": "Q?"})
    assert response.status_code == 429
    detail = response.json()["detail"]
    assert detail["error"] == "rate_limited"
    assert detail["retry_after"] == 30
