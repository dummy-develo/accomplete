"""
Smoke tests — verify the test harness is wired up correctly.

These do NOT test app behavior in depth; they just confirm:
- The dev server is reachable.
- An unauthenticated request to a protected endpoint is rejected.
- Service-role admin can create + delete a test user.
"""


def test_server_is_up(http):
    """Dev server responds on /login (a public page)."""
    resp = http.get("/login")
    assert resp.status_code == 200


def test_unauthenticated_profile_me_is_rejected(http):
    """GET /api/profile/me without auth should return 401."""
    resp = http.get("/api/profile/me")
    assert resp.status_code == 401


def test_admin_can_create_and_delete_user(test_user, admin):
    """The test_user fixture round-trips: create, expose, delete."""
    assert test_user["id"]
    assert test_user["email"].startswith("test-")
    # If we got here, signup worked. Teardown will delete.
