
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException

from coocked_api.api.schemas.profile import UserProfile
from coocked_api.services.auth import get_user_id_from_authorization
from coocked_api.infra.supabase_client import get_supabase


router = APIRouter(prefix="/profile", tags=["profile"])


def _supabase_enabled() -> bool:
    import os

    return bool(os.getenv("SUPABASE_URL")) and bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY"))


@router.get("/me", summary="Current user profile")
def get_my_profile():
    # Minimal placeholder response for now
    return {"ok": True}


@router.post("/", summary="Save or update current user profile")
def save_my_profile(
    profile: UserProfile,
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    """Accept the onboarding payload from the frontend and persist it to Supabase.

    For MVP we upsert the `profiles` table with `id`, `email` and `full_name`.
    """
    if not _supabase_enabled():
        raise HTTPException(status_code=503, detail="Supabase not configured")

    user_id = get_user_id_from_authorization(authorization)

    # Minimal validation is handled by Pydantic; extract values
    email = profile.email
    full_name = profile.full_name

    supabase = get_supabase()

    try:
        upsert_payload = {"id": user_id, "email": email, "full_name": full_name, "meta": profile.dict()}
        result = supabase.table("profiles").upsert(upsert_payload).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save profile: {e}")

    # Basic check for supabase response
    if not getattr(result, "data", None):
        raise HTTPException(status_code=500, detail="Failed to save profile (no response)")

    return {"success": True}
