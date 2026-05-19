import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
import main


def test_get_current_user_returns_none_when_no_header():
    result = main.get_current_user(credentials=None)
    assert result is None


def test_get_current_user_returns_none_when_supabase_raises():
    mock_sb = MagicMock()
    mock_sb.auth.get_user.side_effect = Exception("connection error")
    mock_creds = MagicMock()
    mock_creds.credentials = "bad-token"

    with patch("main.get_supabase_client", return_value=mock_sb):
        result = main.get_current_user(credentials=mock_creds)

    assert result is None


def test_get_current_user_returns_none_when_result_user_is_none():
    mock_sb = MagicMock()
    mock_sb.auth.get_user.return_value = MagicMock(user=None)
    mock_creds = MagicMock()
    mock_creds.credentials = "token"

    with patch("main.get_supabase_client", return_value=mock_sb):
        result = main.get_current_user(credentials=mock_creds)

    assert result is None


def test_get_current_user_returns_auth_user_for_valid_token():
    mock_user = MagicMock()
    mock_user.id = "user-abc"
    mock_user.is_anonymous = False

    mock_sb = MagicMock()
    mock_sb.auth.get_user.return_value = MagicMock(user=mock_user)

    mock_creds = MagicMock()
    mock_creds.credentials = "valid-token"

    with patch("main.get_supabase_client", return_value=mock_sb):
        result = main.get_current_user(credentials=mock_creds)

    assert result is not None
    assert result.user_id == "user-abc"
    assert result.is_anonymous is False


def test_get_current_user_marks_anonymous_user_correctly():
    mock_user = MagicMock()
    mock_user.id = "anon-xyz"
    mock_user.is_anonymous = True

    mock_sb = MagicMock()
    mock_sb.auth.get_user.return_value = MagicMock(user=mock_user)

    mock_creds = MagicMock()
    mock_creds.credentials = "anon-token"

    with patch("main.get_supabase_client", return_value=mock_sb):
        result = main.get_current_user(credentials=mock_creds)

    assert result is not None
    assert result.is_anonymous is True


def test_require_auth_raises_401_when_user_is_none():
    with pytest.raises(HTTPException) as exc_info:
        main.require_auth(auth=None)
    assert exc_info.value.status_code == 401


def test_require_auth_passes_through_valid_user():
    user = main.AuthUser(user_id="u1", is_anonymous=False)
    result = main.require_auth(auth=user)
    assert result is user
