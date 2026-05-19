from unittest.mock import MagicMock, AsyncMock, patch

REAL_USER_ID = "user-test-123"

MINIMAL_PDF = b"%PDF-1.0\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"


def _upload(client, content_type="application/pdf", filename="test.pdf", data=MINIMAL_PDF):
    return client.post(
        "/upload",
        files={"file": (filename, data, content_type)},
    )


def test_upload_requires_auth(client):
    response = _upload(client)
    assert response.status_code == 401


def test_upload_rejects_non_pdf_content_type(authed_client):
    response = _upload(authed_client, content_type="text/plain", filename="test.txt")
    assert response.status_code == 400
    assert response.json()["detail"] == "Only PDF files are allowed"


def test_upload_returns_403_when_anonymous_user_at_quota(anon_client):
    with patch("main.get_user_documents", return_value=[{"id": "existing"}]):
        response = _upload(anon_client)
    assert response.status_code == 403
    assert response.json()["detail"] == "quota_exceeded"


def test_upload_returns_403_when_real_user_at_quota(authed_client):
    docs = [{"id": f"doc-{i}"} for i in range(4)]
    profile = {"document_quota": 4}

    with patch("main.get_user_documents", return_value=docs), \
         patch("main.get_profile", return_value=profile):
        response = _upload(authed_client)

    assert response.status_code == 403
    assert response.json()["detail"] == "quota_exceeded"


def test_upload_succeeds_and_returns_document_id(authed_client):
    chunks = [{"content": "page text", "metadata": {"page_number": 1}}]
    db_record = [{"id": "new-doc-id"}]

    with patch("main.get_user_documents", return_value=[]), \
         patch("main.get_profile", return_value={"document_quota": 4}), \
         patch("main.extract_text_from_pdf", return_value="Extracted text"), \
         patch("main.extract_chunks_from_pdf", return_value=chunks), \
         patch("main.embed_texts", return_value=[[0.1] * 1536]), \
         patch("main.upload_to_s3", new_callable=AsyncMock, return_value="uuid_test.pdf"), \
         patch("main.save_document_metadata", return_value=db_record), \
         patch("main.increment_documents_used", return_value=True), \
         patch("main.save_document_chunks", return_value=True):
        response = _upload(authed_client)

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Success"
    assert data["filename"] == "uuid_test.pdf"
    assert data["chunks_stored"] == 1


def test_upload_increments_documents_used_for_real_user(authed_client):
    db_record = [{"id": "new-doc-id"}]
    mock_increment = MagicMock(return_value=True)

    with patch("main.get_user_documents", return_value=[]), \
         patch("main.get_profile", return_value={"document_quota": 4}), \
         patch("main.extract_text_from_pdf", return_value="text"), \
         patch("main.extract_chunks_from_pdf", return_value=[]), \
         patch("main.embed_texts", return_value=[]), \
         patch("main.upload_to_s3", new_callable=AsyncMock, return_value="file.pdf"), \
         patch("main.save_document_metadata", return_value=db_record), \
         patch("main.increment_documents_used", mock_increment), \
         patch("main.save_document_chunks", return_value=True):
        _upload(authed_client)

    mock_increment.assert_called_once_with(REAL_USER_ID)


def test_upload_does_not_increment_documents_used_for_anonymous(anon_client):
    db_record = [{"id": "new-doc-id"}]
    mock_increment = MagicMock(return_value=True)

    with patch("main.get_user_documents", return_value=[]), \
         patch("main.extract_text_from_pdf", return_value="text"), \
         patch("main.extract_chunks_from_pdf", return_value=[]), \
         patch("main.embed_texts", return_value=[]), \
         patch("main.upload_to_s3", new_callable=AsyncMock, return_value="file.pdf"), \
         patch("main.save_document_metadata", return_value=db_record), \
         patch("main.increment_documents_used", mock_increment), \
         patch("main.save_document_chunks", return_value=True):
        _upload(anon_client)

    mock_increment.assert_not_called()


def test_upload_returns_500_when_s3_upload_fails(authed_client):
    with patch("main.get_user_documents", return_value=[]), \
         patch("main.get_profile", return_value={"document_quota": 4}), \
         patch("main.extract_text_from_pdf", return_value="text"), \
         patch("main.extract_chunks_from_pdf", return_value=[]), \
         patch("main.embed_texts", return_value=[]), \
         patch("main.upload_to_s3", new_callable=AsyncMock, return_value=None):
        response = _upload(authed_client)

    assert response.status_code == 500
    assert "Failed to upload to S3" in response.json()["detail"]


def test_upload_returns_500_when_db_save_fails(authed_client):
    with patch("main.get_user_documents", return_value=[]), \
         patch("main.get_profile", return_value={"document_quota": 4}), \
         patch("main.extract_text_from_pdf", return_value="text"), \
         patch("main.extract_chunks_from_pdf", return_value=[]), \
         patch("main.embed_texts", return_value=[]), \
         patch("main.upload_to_s3", new_callable=AsyncMock, return_value="file.pdf"), \
         patch("main.save_document_metadata", return_value=None):
        response = _upload(authed_client)

    assert response.status_code == 500
    assert "Failed to save to database" in response.json()["detail"]
