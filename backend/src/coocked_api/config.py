from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str | None
    supabase_anon_key: str | None

    @property
    def supabase_key(self) -> str:
        if self.supabase_service_role_key:
            return self.supabase_service_role_key
        if self.supabase_anon_key:
            return self.supabase_anon_key
        raise ValueError(
            "Missing Supabase key. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY."
        )

    @classmethod
    def from_env(cls) -> "Settings":
        supabase_url = os.getenv("SUPABASE_URL", "").strip()
        if not supabase_url:
            raise ValueError("Missing SUPABASE_URL in environment.")
        return cls(
            supabase_url=supabase_url,
            supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
            supabase_anon_key=os.getenv("SUPABASE_ANON_KEY"),
        )
