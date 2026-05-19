import io
import pytest
from unittest.mock import patch, MagicMock
from botocore.exceptions import ClientError
import s3_utils


@pytest.fixture
def mock_s3_client():
    mock = MagicMock()
    with patch("s3_utils.boto3.client", return_value=mock):
        yield mock


async def test_upload_to_s3_returns_filename_on_success(mock_s3_client):
    result = await s3_utils.upload_to_s3(io.BytesIO(b"data"), "test.pdf")
    assert result == "test.pdf"
    mock_s3_client.upload_fileobj.assert_called_once()


async def test_upload_to_s3_returns_none_on_client_error(mock_s3_client):
    mock_s3_client.upload_fileobj.side_effect = ClientError(
        {"Error": {"Code": "NoSuchBucket", "Message": ""}}, "upload_fileobj"
    )
    result = await s3_utils.upload_to_s3(io.BytesIO(b"data"), "test.pdf")
    assert result is None


def test_download_from_s3_returns_bytes_on_success(mock_s3_client):
    mock_s3_client.get_object.return_value = {"Body": MagicMock(read=lambda: b"pdf bytes")}
    result = s3_utils.download_from_s3("test.pdf")
    assert result == b"pdf bytes"


def test_download_from_s3_returns_none_on_client_error(mock_s3_client):
    mock_s3_client.get_object.side_effect = ClientError(
        {"Error": {"Code": "NoSuchKey", "Message": ""}}, "get_object"
    )
    result = s3_utils.download_from_s3("missing.pdf")
    assert result is None


def test_create_presigned_url_returns_url_string(mock_s3_client):
    mock_s3_client.generate_presigned_url.return_value = "https://s3.example.com/test.pdf?sig=abc"
    result = s3_utils.create_presigned_url("test.pdf")
    assert result == "https://s3.example.com/test.pdf?sig=abc"


def test_create_presigned_url_returns_none_on_client_error(mock_s3_client):
    mock_s3_client.generate_presigned_url.side_effect = ClientError(
        {"Error": {"Code": "AccessDenied", "Message": ""}}, "generate_presigned_url"
    )
    result = s3_utils.create_presigned_url("test.pdf")
    assert result is None


def test_delete_from_s3_returns_true_on_success(mock_s3_client):
    result = s3_utils.delete_from_s3("test.pdf")
    assert result is True
    mock_s3_client.delete_object.assert_called_once()


def test_delete_from_s3_returns_false_on_client_error(mock_s3_client):
    mock_s3_client.delete_object.side_effect = ClientError(
        {"Error": {"Code": "NoSuchKey", "Message": ""}}, "delete_object"
    )
    result = s3_utils.delete_from_s3("missing.pdf")
    assert result is False
