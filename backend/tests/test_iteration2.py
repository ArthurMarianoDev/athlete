"""Iteration 2: Personal Records, Weekly Goal, Likes."""
import os
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    envp = Path("/app/frontend/.env")
    if envp.exists():
        for line in envp.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
API = f"{BASE_URL}/api"
SEED_EMAIL = "ana@test.com"
SEED_PASS = "secret123"


@pytest.fixture(scope="module")
def auth():
    r = requests.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASS})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


class TestProfileRecordsAndGoal:
    def test_stats_has_records_and_goal(self, auth):
        r = requests.get(f"{API}/profile/stats", headers=auth)
        assert r.status_code == 200
        d = r.json()
        # records object
        assert "records" in d
        rec = d["records"]
        for k in ("longest_distance_m", "longest_duration_s", "best_pace_s_per_km", "max_speed_kmh"):
            assert k in rec, f"missing {k}"
        # goal
        assert "weekly_goal_km" in d
        assert "week_distance_m" in d
        assert isinstance(d["weekly_goal_km"], (int, float))
        assert isinstance(d["week_distance_m"], (int, float))

    def test_put_goal_persists(self, auth):
        # set to 25
        r = requests.put(f"{API}/profile/goal", json={"weekly_goal_km": 25}, headers=auth)
        assert r.status_code == 200
        assert r.json()["weekly_goal_km"] == 25
        # verify in stats
        r2 = requests.get(f"{API}/profile/stats", headers=auth)
        assert r2.json()["weekly_goal_km"] == 25
        # /auth/me too
        r3 = requests.get(f"{API}/auth/me", headers=auth)
        assert r3.json()["user"]["weekly_goal_km"] == 25
        # revert to 20
        r4 = requests.put(f"{API}/profile/goal", json={"weekly_goal_km": 20}, headers=auth)
        assert r4.status_code == 200

    def test_goal_validation(self, auth):
        r = requests.put(f"{API}/profile/goal", json={"weekly_goal_km": -1}, headers=auth)
        assert r.status_code == 422
        r2 = requests.put(f"{API}/profile/goal", json={"weekly_goal_km": 5000}, headers=auth)
        assert r2.status_code == 422

    def test_records_reflect_activity(self, auth):
        # Create activity with known values
        payload = {
            "type": "run", "distance_m": 8000, "duration_s": 2400,
            "avg_pace_s_per_km": 300.0, "avg_speed_kmh": 12.0, "route": [],
        }
        r = requests.post(f"{API}/activities", json=payload, headers=auth)
        assert r.status_code == 200
        aid = r.json()["activity"]["activity_id"]
        try:
            stats = requests.get(f"{API}/profile/stats", headers=auth).json()
            rec = stats["records"]
            assert rec["longest_distance_m"] >= 8000
            assert rec["longest_duration_s"] >= 2400
            assert rec["max_speed_kmh"] >= 12.0
            # best pace: min so should be <= 300
            assert rec["best_pace_s_per_km"] is not None and rec["best_pace_s_per_km"] <= 300.0
            # week_distance should include our activity
            assert stats["week_distance_m"] >= 8000
        finally:
            requests.delete(f"{API}/activities/{aid}", headers=auth)


class TestLikes:
    @pytest.fixture(scope="class")
    def act_id(self, auth):
        r = requests.post(f"{API}/activities", json={
            "type": "run", "distance_m": 1000, "duration_s": 300,
            "avg_pace_s_per_km": 300.0, "avg_speed_kmh": 12.0, "route": [],
        }, headers=auth)
        aid = r.json()["activity"]["activity_id"]
        yield aid
        requests.delete(f"{API}/activities/{aid}", headers=auth)

    def test_toggle_like_on_and_off(self, auth, act_id):
        # baseline
        base = requests.get(f"{API}/activities/{act_id}", headers=auth).json()["activity"]
        assert "like_count" in base and "liked_by_me" in base
        start_liked = base["liked_by_me"]
        start_count = base["like_count"]

        r = requests.post(f"{API}/activities/{act_id}/like", headers=auth)
        assert r.status_code == 200
        d = r.json()
        assert set(d.keys()) == {"like_count", "liked_by_me"}
        assert d["liked_by_me"] != start_liked
        if not start_liked:
            assert d["like_count"] == start_count + 1

        # verify persisted in GET
        g = requests.get(f"{API}/activities/{act_id}", headers=auth).json()["activity"]
        assert g["liked_by_me"] == d["liked_by_me"]
        assert g["like_count"] == d["like_count"]

        # toggle again
        r2 = requests.post(f"{API}/activities/{act_id}/like", headers=auth)
        d2 = r2.json()
        assert d2["liked_by_me"] == start_liked
        assert d2["like_count"] == start_count

    def test_like_404(self, auth):
        r = requests.post(f"{API}/activities/bogus_id/like", headers=auth)
        assert r.status_code == 404

    def test_like_requires_auth(self):
        r = requests.post(f"{API}/activities/anything/like")
        assert r.status_code == 401

    def test_list_activities_includes_like_fields(self, auth, act_id):
        r = requests.get(f"{API}/activities?scope=me", headers=auth)
        assert r.status_code == 200
        items = r.json()["activities"]
        assert len(items) >= 1
        for a in items:
            assert "like_count" in a and "liked_by_me" in a
            assert "likes" not in a  # raw likes array must not leak
            assert "author_name" in a
