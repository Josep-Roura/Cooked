from __future__ import annotations

from supabase import Client, create_client

from coocked_api.config import Settings


def get_supabase_client(settings: Settings) -> Client:
    return create_client(settings.supabase_url, settings.supabase_key)
