#!/usr/bin/env python3
"""Simple smoke test for the backend API.

Usage: python scripts/smoke_test.py

It will call /health and POST a small CSV to /api/v1/plan/nutrition
and print PASS/FAIL with details.
"""
from __future__ import annotations

import os
import sys
import json
import mimetypes
import urllib.request
import urllib.error


def encode_multipart_formdata(fields: dict, files: dict, boundary: str | None = None):
    # fields: name->value (str), files: name->(filename, bytes)
    if boundary is None:
        boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    lines: list[bytes] = []
    crlf = b"\r\n"
    for name, value in fields.items():
        lines.append(b"--" + boundary.encode())
        lines.append(f'Content-Disposition: form-data; name="{name}"'.encode())
        lines.append(b"")
        if isinstance(value, str):
            lines.append(value.encode())
        else:
            lines.append(str(value).encode())

    for name, (filename, data) in files.items():
        lines.append(b"--" + boundary.encode())
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        lines.append(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"'.encode())
        lines.append(f"Content-Type: {content_type}".encode())
        lines.append(b"")
        if isinstance(data, str):
            lines.append(data.encode())
        else:
            lines.append(data)

    lines.append(b"--" + boundary.encode() + b"--")
    lines.append(b"")
    body = crlf.join(lines)
    content_type = f"multipart/form-data; boundary={boundary}"
    return content_type, body

API_BASE = os.environ.get("API_BASE", "http://localhost:8000")

def check_health():
    url = f"{API_BASE}/health"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            body = resp.read()
            j = json.loads(body.decode())
            if resp.status == 200 and j.get("ok"):
                print("health: PASS")
                return True
            print(f"health: FAIL - status={resp.status} body={body}")
            return False
    except urllib.error.HTTPError as e:
        print(f"health: FAIL - HTTPError: {e.code} {e.reason}")
        return False
    except Exception as e:
        print(f"health: FAIL - exception: {e}")
        return False

def post_plan(csv_path: str):
    url = f"{API_BASE}/api/v1/plan/nutrition"
    headers = {"x-device-id": "smoke-device-1"}
    with open(csv_path, "rb") as fh:
        content = fh.read()
    content_type, body = encode_multipart_formdata({"weight_kg": "70"}, {"file": (os.path.basename(csv_path), content)})
    req = urllib.request.Request(url, data=body)
    req.add_header("Content-Type", content_type)
    req.add_header("x-device-id", "smoke-device-1")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp_body = resp.read()
            if resp.status != 200:
                print(f"post_plan: FAIL - status={resp.status} body={resp_body}")
                return False
            try:
                j = json.loads(resp_body.decode())
            except Exception as e:
                print(f"post_plan: FAIL - invalid json: {e} body={resp_body}")
                return False
            if not isinstance(j.get("rows"), list):
                print(f"post_plan: FAIL - missing rows in response: {j}")
                return False
            print(f"post_plan: PASS - rows={len(j.get('rows'))} saved={j.get('saved')} plan_id={j.get('plan_id')}")
            return True
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode()
        except Exception:
            body = ""
        print(f"post_plan: FAIL - HTTPError {e.code} {e.reason} body={body}")
        return False
    except Exception as e:
        print(f"post_plan: FAIL - exception: {e}")
        return False

def main():
    ok = True
    print(f"Using API_BASE={API_BASE}")
    ok = check_health() and ok

    # locate a sample csv
    default = os.path.join(os.path.dirname(__file__), "..", "sample_plan.csv")
    sample = os.path.abspath(default)
    if not os.path.exists(sample):
        # try repo-level path
        alt = os.path.join(os.path.dirname(__file__), "..", "..", "data", "tp.csv")
        if os.path.exists(alt):
            sample = os.path.abspath(alt)

    if not os.path.exists(sample):
        print("post_plan: SKIP - no sample CSV found at sample_plan.csv or data/tp.csv")
        ok = ok and False
    else:
        ok = post_plan(sample) and ok

    print("\nSMOKE TEST RESULT:")
    if ok:
        print("ALL CHECKS PASS")
        sys.exit(0)
    else:
        print("ONE OR MORE CHECKS FAILED")
        sys.exit(2)

if __name__ == '__main__':
    main()
