"""Backend API tests for MyStudyBody app"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

# Health / root
class TestRoot:
    def test_api_root(self, client):
        res = client.get(f"{BASE_URL}/api/")
        assert res.status_code == 200
        assert "message" in res.json()

# Sessions
class TestSessions:
    created_id = None

    def test_create_session(self, client):
        res = client.post(f"{BASE_URL}/api/sessions", json={"subject": "TEST_Math", "duration_minutes": 25})
        assert res.status_code == 200
        data = res.json()
        assert data["subject"] == "TEST_Math"
        assert data["duration_minutes"] == 25
        assert "id" in data
        TestSessions.created_id = data["id"]

    def test_get_sessions(self, client):
        res = client.get(f"{BASE_URL}/api/sessions")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_weekly_stats(self, client):
        res = client.get(f"{BASE_URL}/api/stats/weekly")
        assert res.status_code == 200
        data = res.json()
        assert "daily_hours" in data
        assert len(data["daily_hours"]) == 7
        assert "total_hours" in data

# Errors / Scans
class TestErrors:
    def test_create_error(self, client):
        res = client.post(f"{BASE_URL}/api/errors", json={"subject": "TEST_Physics", "topic": "Kinematics", "notes": "test note"})
        assert res.status_code == 200
        data = res.json()
        assert data["subject"] == "TEST_Physics"
        assert data["topic"] == "Kinematics"
        assert "id" in data

    def test_get_errors(self, client):
        res = client.get(f"{BASE_URL}/api/errors")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_error_stats(self, client):
        res = client.get(f"{BASE_URL}/api/stats/errors")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        # Should have our TEST_Physics entry
        subjects = [d["subject"] for d in data]
        assert "TEST_Physics" in subjects
        # Verify structure
        for item in data:
            assert "subject" in item
            assert "errors" in item
            assert "topics" in item
