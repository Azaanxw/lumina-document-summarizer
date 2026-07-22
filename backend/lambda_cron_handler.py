import asyncio

from main import cleanup_anonymous_documents


def handler(event, context):
    asyncio.run(cleanup_anonymous_documents())
    return {"status": "ok"}
