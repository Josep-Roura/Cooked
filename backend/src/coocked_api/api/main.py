from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

from coocked_api.api.routes.nutrition import router as nutrition_router

app = FastAPI(title="Cooked AI API", version="0.1.0")

logger = logging.getLogger("coocked_api")


@app.on_event("startup")
def _startup_check_supabase():
    supabase_url_set = bool(os.getenv("SUPABASE_URL"))
    svc_key_set = bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    anon_key_set = bool(os.getenv("SUPABASE_ANON_KEY"))
    supabase_enabled = supabase_url_set and (svc_key_set or anon_key_set)
    logger.info(
        "Supabase config: SUPABASE_URL=%s, SERVICE_ROLE_KEY=%s, ANON_KEY=%s, SUPABASE_ENABLED=%s",
        "set" if supabase_url_set else "missing",
        "set" if svc_key_set else "missing",
        "set" if anon_key_set else "missing",
        supabase_enabled,
    )

# Frontend runs on 3000 (keep 5173 for local dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

app.include_router(nutrition_router, prefix="/api/v1")
