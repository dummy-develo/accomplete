"""
Shared pytest fixtures for Accomplete API tests.

- Loads apps/web/.env.local so we get NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
- `http` fixture: httpx client pointed at the running dev server (localhost:3000).
- `admin` fixture: httpx client pointed at Supabase, authenticated with the
  service-role key. Used for state setup and user teardown — bypasses RLS.
- `test_user` fixture: signs up a fresh user via the admin API, deletes it after
  the test.

We talk to Supabase directly via HTTP (admin auth endpoints + PostgREST) rather
than via the supabase-py SDK — the SDK pulls a heavy storage dep we don't need.
"""

import os
import uuid
from pathlib import Path

import httpx
import pytest
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = REPO_ROOT / "apps" / "web" / ".env.local"

load_dotenv(ENV_PATH)

BASE_URL = os.environ.get("ACCOMPLETE_BASE_URL", "http://localhost:3000")
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANON_KEY = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE_URL


@pytest.fixture(scope="session")
def admin() -> httpx.Client:
    """
    Supabase admin client (service-role). Bypasses RLS.

    Use for:
    - Creating/deleting test users (admin auth API)
    - Direct table reads/writes for state injection (PostgREST)
    """
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    }
    with httpx.Client(base_url=SUPABASE_URL, headers=headers, timeout=10.0) as client:
        yield client


@pytest.fixture
def http() -> httpx.Client:
    """Fresh httpx client per test, pointed at the Next.js dev server."""
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        yield client


@pytest.fixture
def anon() -> httpx.Client:
    """
    Supabase client with the anon key — same identity the browser uses.
    Use for public-flow tests (signup, login) where we want to exercise
    the same path a real user takes.
    """
    headers = {"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}"}
    with httpx.Client(base_url=SUPABASE_URL, headers=headers, timeout=10.0) as client:
        yield client


@pytest.fixture
def test_user(admin: httpx.Client):
    """
    Creates a fresh test user via Supabase admin auth API and yields its
    credentials. Deletes the user after the test runs.
    """
    suffix = uuid.uuid4().hex[:8]
    email = f"test-{suffix}@accomplete.test"
    password = f"TestPass-{suffix}!"

    resp = admin.post(
        "/auth/v1/admin/users",
        json={"email": email, "password": password, "email_confirm": True},
    )
    resp.raise_for_status()
    user_id = resp.json()["id"]

    try:
        yield {"id": user_id, "email": email, "password": password}
    finally:
        try:
            admin.delete(f"/auth/v1/admin/users/{user_id}")
        except Exception as e:
            print(f"[teardown] failed to delete user {user_id}: {e}")


@pytest.fixture
def signup(admin: httpx.Client, anon: httpx.Client):
    """
    Factory fixture for public-flow signups. Each call hits Supabase's
    /auth/v1/signup just like a real user. Any user successfully created
    is deleted at the end of the test via the admin API.

    Returns a function: signup(email=None, password=None) -> response dict
    (the raw JSON from Supabase, plus a "status_code" key for assertion).
    """
    created_ids: list[str] = []

    def _signup(email: str | None = None, password: str | None = None):
        suffix = uuid.uuid4().hex[:8]
        if email is None:
            email = f"test-{suffix}@accomplete.test"
        if password is None:
            password = f"TestPass-{suffix}!"

        resp = anon.post(
            "/auth/v1/signup",
            json={"email": email, "password": password},
        )
        body = {}
        try:
            body = resp.json()
        except Exception:
            pass

        user_id = (body.get("user") or {}).get("id") or body.get("id")
        if user_id:
            created_ids.append(user_id)

        return {
            "status_code": resp.status_code,
            "body": body,
            "email": email,
            "password": password,
            "user_id": user_id,
        }

    try:
        yield _signup
    finally:
        for uid in created_ids:
            try:
                admin.delete(f"/auth/v1/admin/users/{uid}")
            except Exception as e:
                print(f"[teardown] failed to delete user {uid}: {e}")


@pytest.fixture
def logged_in_user(test_user, anon: httpx.Client):
    """
    Like `test_user`, but also logs in via the public token endpoint and
    yields the access_token alongside the credentials. Use this when a
    test needs to call the Next.js API as an authenticated user.
    """
    resp = anon.post(
        "/auth/v1/token",
        params={"grant_type": "password"},
        json={"email": test_user["email"], "password": test_user["password"]},
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]
    yield {**test_user, "access_token": token}
