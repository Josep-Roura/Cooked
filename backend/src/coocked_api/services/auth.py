from __future__ import annotations

import base64
import json
from typing import Any

from fastapi import HTTPException


def _b64url_decode(input_str: str) -> bytes:
    rem = len(input_str) % 4
    if rem:
        input_str += "=" * (4 - rem)
    return base64.urlsafe_b64decode(input_str.encode("utf-8"))


def decode_jwt_no_verify(token: str) -> dict[str, Any]:
    """Minimal JWT decode without signature verification.

    This extracts the payload claims from a JWT. For MVP we validate
    presence of expected claims but do not verify signatures. This is
    acceptable only for development/testing; in production use a proper
    JWKS verification flow.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid JWT format")
        payload_b64 = parts[1]
        payload_bytes = _b64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


def get_user_id_from_authorization(auth_header: str | None) -> str:
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization header")

    token = auth_header.split(" ", 1)[1].strip()
    payload = decode_jwt_no_verify(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing sub claim")
    return user_id
