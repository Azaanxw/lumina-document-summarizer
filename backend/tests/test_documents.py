from unittest.mock import MagicMock, patch

REAL_USER_ID = "user-test-123"


def test_list_documents_requires_auth(client):
    response = client.get("/documents")
    assert response.status_code == 401


def test_list_documents_returns_docs_and_quota_for_real_user(authed_client):
    docs = [{"id": "doc-1", "filename": "a.pdf", "created_at": "2026-01-01T00:00:00"}]
    profile = {"documents_used": 1, "document_quota": 4}

    with patch("main.get_user_documents", return_value=docs), \
         patch("main.get_profile", return_value=profile):
        response = authed_client.get("/documents")

    assert response.status_code == 200
    data = response.json()
    assert data["documents"] == docs
    assert data["quota"] == {"used": 1, "total": 4}


def test_list_documents_quota_is_1_for_anonymous_user(anon_client):
    with patch("main.get_user_documents", return_value=[]), \
         patch("main.get_profile", return_value=None):
        response = anon_client.get("/documents")

    assert response.status_code == 200
    assert response.json()["quota"]["total"] == 1


def test_list_documents_quota_defaults_to_4_when_profile_is_none(authed_client):
    with patch("main.get_user_documents", return_value=[]), \
         patch("main.get_profile", return_value=None):
        response = authed_client.get("/documents")

    assert response.status_code == 200
    assert response.json()["quota"]["total"] == 4


def test_delete_account_requires_auth(client):
    response = client.delete("/account")
    assert response.status_code == 401


def test_delete_account_deletes_s3_files_then_supabase_user(authed_client):
    filenames = ["file1.pdf", "file2.pdf"]
    mock_delete_s3 = MagicMock(return_value=True)
    mock_sb = MagicMock()

    with patch("main.get_user_document_filenames", return_value=filenames), \
         patch("main.delete_from_s3", mock_delete_s3), \
         patch("main.get_supabase_client", return_value=mock_sb):
        response = authed_client.delete("/account")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert mock_delete_s3.call_count == 2
    mock_sb.auth.admin.delete_user.assert_called_once_with(REAL_USER_ID)


def test_delete_account_succeeds_with_no_documents(authed_client):
    mock_sb = MagicMock()

    with patch("main.get_user_document_filenames", return_value=[]), \
         patch("main.delete_from_s3") as mock_delete_s3, \
         patch("main.get_supabase_client", return_value=mock_sb):
        response = authed_client.delete("/account")

    assert response.status_code == 200
    mock_delete_s3.assert_not_called()
    mock_sb.auth.admin.delete_user.assert_called_once_with(REAL_USER_ID)
