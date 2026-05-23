import base64
import datetime
import logging
import os

import boto3
from botocore.exceptions import ClientError
from botocore.signers import CloudFrontSigner

logger = logging.getLogger(__name__)


def get_s3_client():
    """Returns an authenticated S3 client."""
    return boto3.client(
        's3',
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=os.getenv("AWS_REGION")
    )

async def upload_to_s3(file_obj, filename: str):
    """Uploads a file to the S3 bucket and returns the S3 Key (filename)."""
    s3 = get_s3_client()
    bucket_name = os.getenv("AWS_S3_BUCKET")
    try:
        extra_args = {"ContentType": "application/pdf"}
        s3.upload_fileobj(file_obj, bucket_name, filename, ExtraArgs=extra_args)
        return filename
    except ClientError as e:
        logger.error(f"S3 Upload Error: {e}")
        return None

def download_from_s3(filename: str) -> bytes | None:
    """Downloads a file from S3 and returns its raw bytes."""
    s3 = get_s3_client()
    bucket_name = os.getenv("AWS_S3_BUCKET")
    try:
        response = s3.get_object(Bucket=bucket_name, Key=filename)
        return response["Body"].read()
    except ClientError as e:
        logger.error(f"S3 Download Error: {e}")
        return None

def create_presigned_url(filename: str, expiration: int = 3600):
    """Generates a temporary, secure URL to view a private PDF (Valid for 1 hour)."""
    s3 = get_s3_client()
    bucket_name = os.getenv("AWS_S3_BUCKET")
    try:
        url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': filename},
            ExpiresIn=expiration
        )
        return url
    except ClientError as e:
        logger.error(f"Presigned URL Error: {e}")
        return None

def create_signed_cloudfront_url(filename: str, expiration_seconds: int = 3600) -> str | None:
    """Generates a signed CloudFront URL for a private S3 object. Returns None if CF is not configured."""
    domain = os.getenv("CLOUDFRONT_DOMAIN")
    key_id = os.getenv("CLOUDFRONT_KEY_PAIR_ID")
    private_key_b64 = os.getenv("CLOUDFRONT_PRIVATE_KEY_B64")

    if not all([domain, key_id, private_key_b64]):
        return None

    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding as asym_padding

        private_key_pem = base64.b64decode(private_key_b64).decode()  # type: ignore[arg-type]
        private_key = serialization.load_pem_private_key(private_key_pem.encode(), password=None)

        def rsa_signer(message: bytes) -> bytes:
            return private_key.sign(message, asym_padding.PKCS1v15(), hashes.SHA1())  # type: ignore[arg-type]

        signer = CloudFrontSigner(key_id, rsa_signer)
        expire_date = datetime.datetime.utcnow() + datetime.timedelta(seconds=expiration_seconds)
        return signer.generate_presigned_url(f"https://{domain}/{filename}", date_less_than=expire_date)
    except Exception as e:
        logger.error(f"CloudFront Signed URL Error: {e}")
        return None

def delete_from_s3(filename: str) -> bool:
    """Deletes a single object from S3 by key."""
    s3 = get_s3_client()
    bucket_name = os.getenv("AWS_S3_BUCKET")
    try:
        s3.delete_object(Bucket=bucket_name, Key=filename)
        return True
    except ClientError as e:
        logger.error(f"S3 Delete Error: {e}")
        return False
