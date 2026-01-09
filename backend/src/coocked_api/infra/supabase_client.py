from __future__ import annotations

from supabase import Client, create_client

from coocked_api.config import Settings

_supabase_client: Client | None = None


def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        settings = Settings.from_env()
        _supabase_client = create_client(settings.supabase_url, settings.supabase_key)
    return _supabase_client
