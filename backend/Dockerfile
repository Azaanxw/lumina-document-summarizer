FROM python:3.13-slim

WORKDIR /app

# Lambda Web Adapter — lets this unmodified uvicorn app run behind a Lambda Function URL
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 /lambda-adapter /opt/extensions/lambda-adapter
ENV PORT=8000
ENV AWS_LWA_READINESS_CHECK_PATH=/health

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
