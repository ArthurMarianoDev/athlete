"""ZoneTrack backend API tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to reading frontend .env if not exported
    from pathlib import Path
    envp = Path("/app/frontend/.env")
    if envp.exists():
        for line in envp.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
API = f"{BASE_URL}/api"

SEED_EMAIL = "ana@test.com"
SEED_PASS = "secret123"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def token(s):
    r = s.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASS})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- Auth ----------------
class TestAuth:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("message") == "ZoneTrack API"

    def test_login_seed(self, s):
        r = s.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASS})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and data["user"]["email"] == SEED_EMAIL

    def test_login_wrong_pw(self, s):
        r = s.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_no_token(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token(self, s):
        r = s.get(f"{API}/auth/me", headers={"Authorization": "Bearer nonsense"})
        assert r.status_code == 401

    def test_me_valid(self, s, auth):
        r = s.get(f"{API}/auth/me", headers=auth)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == SEED_EMAIL

    def test_register_and_duplicate(self, s):
        email = f"TEST_{uuid.uuid4().hex[:8]}@test.com"
        r = s.post(f"{API}/auth/register", json={"name": "Test User", "email": email, "password": "abc123"})
        assert r.status_code == 200
        j = r.json()
        # backend lowercases emails
        assert j["user"]["email"] == email.lower() and j["token"]
        # duplicate
        r2 = s.post(f"{API}/auth/register", json={"name": "X", "email": email, "password": "abc123"})
        assert r2.status_code == 400


# ---------------- Zones ----------------
class TestZones:
    def test_list_zones_seeded(self, s, auth):
        r = s.get(f"{API}/zones?lat=-23.5874&lng=-46.6576", headers=auth)
        assert r.status_code == 200
        zones = r.json()["zones"]
        assert len(zones) >= 5, "expected 5 seeded predefined zones"
        # first should be closest (Ibirapuera)
        assert zones[0]["name"] == "Parque Ibirapuera"
        assert zones[0]["distance_m"] is not None and zones[0]["distance_m"] < 5000
        assert "participant_count" in zones[0] and "activity_count" in zones[0]

    def test_list_zones_no_coords(self, s, auth):
        r = s.get(f"{API}/zones", headers=auth)
        assert r.status_code == 200
        assert len(r.json()["zones"]) >= 5

    def test_list_zones_requires_auth(self, s):
        r = s.get(f"{API}/zones")
        assert r.status_code == 401

    def test_create_and_get_zone(self, s, auth):
        payload = {"name": f"TEST_zone_{uuid.uuid4().hex[:6]}", "latitude": -23.5, "longitude": -46.6, "radius_m": 3000}
        r = s.post(f"{API}/zones", json=payload, headers=auth)
        assert r.status_code == 200
        z = r.json()["zone"]
        assert z["type"] == "auto" and z["name"] == payload["name"]
        zid = z["zone_id"]
        # GET verify
        r2 = s.get(f"{API}/zones/{zid}", headers=auth)
        assert r2.status_code == 200
        assert r2.json()["zone"]["zone_id"] == zid
        # 404
        r3 = s.get(f"{API}/zones/bogus_id", headers=auth)
        assert r3.status_code == 404


# ---------------- Activities ----------------
class TestActivities:
    @pytest.fixture(scope="class")
    def zone_id(self, s, auth):
        r = s.get(f"{API}/zones", headers=auth)
        return r.json()["zones"][0]["zone_id"]

    def test_create_activity_and_persist(self, s, auth, zone_id):
        payload = {
            "type": "run",
            "zone_id": zone_id,
            "distance_m": 2500,
            "duration_s": 900,
            "avg_pace_s_per_km": 360.0,
            "avg_speed_kmh": 10.0,
            "calories": 200,
            "route": [{"latitude": -23.5, "longitude": -46.6, "t": 0},
                      {"latitude": -23.501, "longitude": -46.601, "t": 60000}],
            "started_at": "2026-01-01T10:00:00+00:00",
        }
        r = s.post(f"{API}/activities", json=payload, headers=auth)
        assert r.status_code == 200
        a = r.json()["activity"]
        assert a["distance_m"] == 2500 and a["duration_s"] == 900
        aid = a["activity_id"]
        # GET individual
        r2 = s.get(f"{API}/activities/{aid}", headers=auth)
        assert r2.status_code == 200
        assert r2.json()["activity"]["activity_id"] == aid
        # list scope=me
        r3 = s.get(f"{API}/activities?scope=me", headers=auth)
        assert r3.status_code == 200
        ids = [x["activity_id"] for x in r3.json()["activities"]]
        assert aid in ids
        # cleanup: soft delete
        r4 = s.delete(f"{API}/activities/{aid}", headers=auth)
        assert r4.status_code == 200 and r4.json().get("ok") is True
        # after delete returns 404 on GET
        r5 = s.get(f"{API}/activities/{aid}", headers=auth)
        assert r5.status_code == 404


# ---------------- Leaderboard ----------------
class TestLeaderboard:
    def test_leaderboard_distance_and_pace(self, s, auth):
        # pick a zone and create an activity to guarantee data
        zones = s.get(f"{API}/zones", headers=auth).json()["zones"]
        zid = zones[0]["zone_id"]
        act = s.post(
            f"{API}/activities",
            json={
                "type": "run", "zone_id": zid,
                "distance_m": 3200, "duration_s": 1200,
                "avg_pace_s_per_km": 375.0, "avg_speed_kmh": 9.6,
                "route": []
            }, headers=auth,
        )
        assert act.status_code == 200
        aid = act.json()["activity"]["activity_id"]

        try:
            r = s.get(f"{API}/zones/{zid}/leaderboard?metric=distance", headers=auth)
            assert r.status_code == 200
            body = r.json()
            assert body["metric"] == "distance"
            assert isinstance(body["entries"], list) and len(body["entries"]) >= 1
            assert all("rank" in e and "total_distance_m" in e for e in body["entries"])
            # sorted desc by distance
            dists = [e["total_distance_m"] for e in body["entries"]]
            assert dists == sorted(dists, reverse=True)

            r2 = s.get(f"{API}/zones/{zid}/leaderboard?metric=pace&type=run", headers=auth)
            assert r2.status_code == 200
            b2 = r2.json()
            assert b2["metric"] == "pace"
            # pace ascending
            paces = [e["best_pace_s_per_km"] for e in b2["entries"] if e["best_pace_s_per_km"] is not None]
            assert paces == sorted(paces)
        finally:
            s.delete(f"{API}/activities/{aid}", headers=auth)


# ---------------- Profile ----------------
class TestProfile:
    def test_profile_stats(self, s, auth):
        r = s.get(f"{API}/profile/stats", headers=auth)
        assert r.status_code == 200
        data = r.json()
        assert "user" in data and "total_distance_m" in data
        assert isinstance(data["by_type"], dict)
        assert data["user"]["email"] == SEED_EMAIL
