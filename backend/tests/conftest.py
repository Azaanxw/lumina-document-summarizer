import pytest
from unittest.mock import MagicMock, patch
from starlette.testclient import TestClient
import main

REAL_USER_ID = "user-test-123"
ANON_USER_ID = "anon-test-456"


def _real_user():
    return main.AuthUser(user_id=REAL_USER_ID, is_anonymous=False)


def _anon_user():
    return main.AuthUser(user_id=ANON_USER_ID, is_anonymous=True)


@pytest.fixture
def client():
    main.app.dependency_overrides.clear()
    return TestClient(main.app)


@pytest.fixture
def authed_client():
    user = _real_user()
    main.app.dependency_overrides[main.get_current_user] = lambda: user
    main.app.dependency_overrides[main.require_auth] = lambda: user
    try:
        yield TestClient(main.app)
    finally:
        main.app.dependency_overrides.clear()


@pytest.fixture
def anon_client():
    user = _anon_user()
    main.app.dependency_overrides[main.get_current_user] = lambda: user
    main.app.dependency_overrides[main.require_auth] = lambda: user
    try:
        yield TestClient(main.app)
    finally:
        main.app.dependency_overrides.clear()


@pytest.fixture
def mock_supabase():
    mock = MagicMock()
    with patch("db_utils.create_client", return_value=mock):
        yield mock


@pytest.fixture
def mock_s3():
    mock = MagicMock()
    with patch("s3_utils.boto3.client", return_value=mock):
        yield mock


@pytest.fixture
def mock_openai_embed():
    mock_client = MagicMock()
    mock_client.embeddings.create.return_value = MagicMock(
        data=[MagicMock(embedding=[0.1] * 1536)]
    )
    with patch("embedding_utils.OpenAI", return_value=mock_client):
        yield mock_client


@pytest.fixture
def mock_gemini():
    mock_client = MagicMock()
    with patch("gemini_utils.genai.Client", return_value=mock_client):
        yield mock_client


@pytest.fixture
def mock_openai_generate():
    mock_client = MagicMock()
    with patch("gemini_utils.OpenAI", return_value=mock_client):
        yield mock_client


@pytest.fixture(autouse=True)
def mock_rate_limiter():
    """Allow all requests through the rate limiter by default."""
    with patch.object(main, "db_rate_limiter") as mock_limiter:
        mock_limiter.check.return_value = (True, 0)
        yield mock_limiter
