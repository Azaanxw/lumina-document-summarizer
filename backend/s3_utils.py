import boto3
import os
from botocore.exceptions import ClientError

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
        # PROFESSIONAL FIX: Set the Content-Type so it renders in the browser later
        extra_args = {"ContentType": "application/pdf"}
        
        # Use upload_fileobj for memory-efficient streaming
        s3.upload_fileobj(file_obj, bucket_name, filename, ExtraArgs=extra_args)
        
        # We only return the filename so we can save it cleanly in Supabase
        return filename
        
    except ClientError as e:
        print(f"S3 Upload Error: {e}")
        return None

def download_from_s3(filename: str) -> bytes | None:
    """Downloads a file from S3 and returns its raw bytes."""
    s3 = get_s3_client()
    bucket_name = os.getenv("AWS_S3_BUCKET")
    try:
        response = s3.get_object(Bucket=bucket_name, Key=filename)
        return response["Body"].read()
    except ClientError as e:
        print(f"S3 Download Error: {e}")
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
        print(f"Presigned URL Error: {e}")
        return None