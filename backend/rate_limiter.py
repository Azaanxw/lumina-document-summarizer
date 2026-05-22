import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


class DBRateLimiter:
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window_seconds = window_seconds

    def check(self, user_id: str, endpoint: str) -> tuple[bool, int]:
        from db_utils import get_supabase_client
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(seconds=self.window_seconds)

        try:
            supabase = get_supabase_client()
        except Exception as e:
            logger.error(f"Rate limit: could not get supabase client: {e}")
            return True, 0

        # Cleanup expired entries — isolated so a 204/parse error doesn't abort the insert
        try:
            supabase.table("rate_limits").delete()\
                .eq("user_id", user_id)\
                .eq("endpoint", endpoint)\
                .lt("created_at", window_start.isoformat())\
                .execute()
        except Exception as e:
            logger.warning(f"Rate limit cleanup failed (non-fatal): {e}")

        try:
            result = supabase.table("rate_limits")\
                .select("created_at")\
                .eq("user_id", user_id)\
                .eq("endpoint", endpoint)\
                .order("created_at")\
                .execute()
            rows: list[dict] = result.data or []  # type: ignore[union-attr]
            count = len(rows)

            if count >= self.limit:
                if rows:
                    oldest_ts_str = str(rows[0]["created_at"])
                    oldest_ts = datetime.fromisoformat(oldest_ts_str)
                    if oldest_ts.tzinfo is None:
                        oldest_ts = oldest_ts.replace(tzinfo=timezone.utc)
                    retry_after = int((oldest_ts + timedelta(seconds=self.window_seconds) - now).total_seconds()) + 1
                    return False, max(retry_after, 1)
                return False, self.window_seconds

            supabase.table("rate_limits")\
                .insert({"user_id": user_id, "endpoint": endpoint})\
                .execute()
            logger.debug(f"Rate limit recorded: user={user_id[:8]}… endpoint={endpoint} count={count + 1}/{self.limit}")
            return True, 0

        except Exception as e:
            logger.error(f"Rate limit check error: {e}")
            return True, 0
