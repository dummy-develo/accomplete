"""
Auth-layer tests.

Covers signup (happy / duplicate / weak password), login (happy / wrong password),
the auto-profile DB trigger, and that a Supabase access token authenticates a
request to the Next.js API.

Talks to Supabase via:
  - anon key  → public flows (signup, login) — what a real browser does
  - service-role key → trigger verification + teardown

The Next.js API uses Bearer-token auth (`Authorization: Bearer <access_token>`),
so we use the same token returned by /auth/v1/token to call our own endpoints.
"""

import uuid


# ---------- signup ----------


def test_signup_happy_returns_user(signup):
    """Public signup with valid email + password returns a user id."""
    result = signup()
    assert result["status_code"] == 200, result["body"]
    assert result["user_id"], f"no user id in response: {result['body']}"


def test_signup_creates_profile_row_via_trigger(signup, admin):
    """
    After signup, the on_auth_user_created trigger should insert a bare
    profile row (id only, username null). Read via PostgREST as service-role.
    """
    result = signup()
    assert result["status_code"] == 200, result["body"]
    user_id = result["user_id"]

    resp = admin.get(
        "/rest/v1/profiles",
        params={"id": f"eq.{user_id}", "select": "id,username,display_name"},
    )
    resp.raise_for_status()
    rows = resp.json()
    assert len(rows) == 1, f"expected 1 profile row, got {rows}"
    assert rows[0]["id"] == user_id
    assert rows[0]["username"] is None
    assert rows[0]["display_name"] is None


def test_signup_duplicate_email_is_rejected(signup):
    """Signing up twice with the same email should fail."""
    suffix = uuid.uuid4().hex[:8]
    email = f"test-dup-{suffix}@accomplete.test"
    password = f"TestPass-{suffix}!"

    first = signup(email=email, password=password)
    assert first["status_code"] == 200, first["body"]

    second = signup(email=email, password=password)
    assert second["status_code"] >= 400, (
        f"expected duplicate signup to fail, got {second['status_code']}: {second['body']}"
    )


def test_signup_weak_password_is_rejected(signup):
    """Supabase default minimum is 6 chars — anything shorter should fail."""
    result = signup(password="abc")
    assert result["status_code"] >= 400, (
        f"expected weak password to fail, got {result['status_code']}: {result['body']}"
    )


# ---------- login ----------


def test_login_with_correct_password_returns_token(test_user, anon):
    """Logging in with the right password returns an access_token."""
    resp = anon.post(
        "/auth/v1/token",
        params={"grant_type": "password"},
        json={"email": test_user["email"], "password": test_user["password"]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body.get("access_token"), f"no access_token in response: {body}"
    assert body.get("user", {}).get("id") == test_user["id"]


def test_login_with_wrong_password_is_rejected(test_user, anon):
    resp = anon.post(
        "/auth/v1/token",
        params={"grant_type": "password"},
        json={"email": test_user["email"], "password": "nope-wrong-password"},
    )
    assert resp.status_code >= 400, resp.text


# ---------- token → Next.js API ----------


def test_access_token_authenticates_against_nextjs_api(logged_in_user, http):
    """
    A Supabase access token passed as a Bearer header should authenticate a
    request to /api/profile/me. For a brand-new user with no onboarding done,
    the returned profile should have a null username (just the trigger row).
    """
    resp = http.get(
        "/api/profile/me",
        headers={"Authorization": f"Bearer {logged_in_user['access_token']}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    profile = body.get("profile")
    assert profile is not None, body
    assert profile["id"] == logged_in_user["id"]
    assert profile.get("username") is None
