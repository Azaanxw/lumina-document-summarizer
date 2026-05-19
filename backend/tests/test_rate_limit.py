import time
from unittest.mock import patch
import main


def test_rate_limit_allows_up_to_20_requests():
    for _ in range(20):
        allowed, _ = main.check_question_rate_limit("user-1")
        assert allowed is True


def test_rate_limit_blocks_21st_request():
    for _ in range(20):
        main.check_question_rate_limit("user-1")
    allowed, retry_after = main.check_question_rate_limit("user-1")
    assert allowed is False
    assert retry_after > 0


def test_rate_limit_reset_calculates_correct_retry_after():
    fixed_time = 1000.0
    with patch("main.time.time", return_value=fixed_time):
        for _ in range(20):
            main.check_question_rate_limit("user-1")
    with patch("main.time.time", return_value=fixed_time + 10):
        allowed, retry_after = main.check_question_rate_limit("user-1")
    assert allowed is False
    # timestamps[0]=1000, window=3600, now=1010 → reset_in = int(1000+3600-1010)+1 = 3591
    assert retry_after == 3591


def test_rate_limit_window_rolls_so_old_timestamps_expire():
    base_time = 1000.0
    with patch("main.time.time", return_value=base_time):
        for _ in range(20):
            main.check_question_rate_limit("user-1")
    with patch("main.time.time", return_value=base_time + 3601):
        allowed, _ = main.check_question_rate_limit("user-1")
    assert allowed is True


def test_ask_returns_429_with_retry_after_when_rate_limited(client):
    from unittest.mock import patch as upatch
    now = time.time()
    main._question_timestamps["rate-doc"] = [now] * 20

    with upatch("main.embed_texts", return_value=[[0.1] * 1536]), \
         upatch("main.search_chunks", return_value=[]):
        response = client.post("/ask", json={"document_id": "rate-doc", "question": "Q?"})

    assert response.status_code == 429
    detail = response.json()["detail"]
    assert detail["error"] == "rate_limited"
    assert "retry_after" in detail
