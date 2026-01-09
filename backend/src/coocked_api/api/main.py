from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from coocked_api.api.routes.nutrition import router as nutrition_router

app = FastAPI(title="Cooked AI API", version="0.1.0")

# Frontend runs on 5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
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
