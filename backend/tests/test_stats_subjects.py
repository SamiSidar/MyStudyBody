"""Tests for GET /api/stats/subjects and POST /api/sessions endpoints"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
USER_ID = "16990051-49d1-49f1-91d7-6ace94b9a74f"
HEADERS = {"X-User-ID": USER_ID, "Content-Type": "application/json"}


class TestPostSessions:
    """POST /api/sessions - saves subject+duration"""

    def test_create_session_success(self):
        response = requests.post(f"{BASE_URL}/api/sessions", json={"subject": "TEST_Subject", "duration_minutes": 30}, headers=HEADERS)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["subject"] == "TEST_Subject"
        assert data["duration_minutes"] == 30
        assert data["user_id"] == USER_ID
        assert "id" in data
        print(f"PASS: create_session_success - id={data['id']}")

    def test_create_session_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/sessions", json={"subject": "Math", "duration_minutes": 25})
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: create_session_requires_auth")

    def test_create_session_stored_in_sessions_list(self):
        # Create a session then verify it appears in GET /sessions
        resp = requests.post(f"{BASE_URL}/api/sessions", json={"subject": "TEST_StoreCheck", "duration_minutes": 15}, headers=HEADERS)
        assert resp.status_code == 200
        session_id = resp.json()["id"]

        list_resp = requests.get(f"{BASE_URL}/api/sessions", headers=HEADERS)
        assert list_resp.status_code == 200
        ids = [s["id"] for s in list_resp.json()]
        assert session_id in ids
        print("PASS: create_session_stored_in_sessions_list")


class TestGetSubjectStats:
    """GET /api/stats/subjects - aggregates study time per subject"""

    def test_subjects_endpoint_returns_200(self):
        response = requests.get(f"{BASE_URL}/api/stats/subjects", headers=HEADERS)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: subjects_endpoint_returns_200")

    def test_subjects_response_structure(self):
        response = requests.get(f"{BASE_URL}/api/stats/subjects", headers=HEADERS)
        data = response.json()
        assert "subjects" in data, "Missing 'subjects' key"
        assert "total_minutes" in data, "Missing 'total_minutes' key"
        assert "total_hours" in data, "Missing 'total_hours' key"
        assert "session_count" in data, "Missing 'session_count' key"
        print(f"PASS: subjects_response_structure - {data}")

    def test_subjects_list_item_structure(self):
        response = requests.get(f"{BASE_URL}/api/stats/subjects", headers=HEADERS)
        data = response.json()
        assert len(data["subjects"]) > 0, "No subjects returned"
        first = data["subjects"][0]
        assert "subject" in first
        assert "total_minutes" in first
        assert "total_hours" in first
        print(f"PASS: subjects_list_item_structure - first={first}")

    def test_subjects_aggregates_correctly(self):
        """Verify known seed data: Math=210, Physics=75, History=60, Chemistry=45, Biology=30 => total=420mins=7.0hrs, sessions>=6"""
        response = requests.get(f"{BASE_URL}/api/stats/subjects", headers=HEADERS)
        data = response.json()
        subjects_map = {s["subject"]: s for s in data["subjects"]}

        # Check known seed subjects exist
        for subj in ["Math", "Physics", "History", "Chemistry", "Biology"]:
            assert subj in subjects_map, f"Expected subject '{subj}' not found in {list(subjects_map.keys())}"

        assert subjects_map["Math"]["total_minutes"] >= 210
        assert subjects_map["Physics"]["total_minutes"] >= 75
        assert subjects_map["History"]["total_minutes"] >= 60
        print(f"PASS: subjects_aggregates_correctly")

    def test_total_hours_calculation(self):
        response = requests.get(f"{BASE_URL}/api/stats/subjects", headers=HEADERS)
        data = response.json()
        expected_hours = round(data["total_minutes"] / 60, 1)
        assert data["total_hours"] == expected_hours, f"total_hours mismatch: {data['total_hours']} != {expected_hours}"
        print(f"PASS: total_hours_calculation - {data['total_minutes']}min = {data['total_hours']}hrs")

    def test_seed_data_totals(self):
        """Seed: 420 total minutes = 7.0 hours, 6 sessions"""
        response = requests.get(f"{BASE_URL}/api/stats/subjects", headers=HEADERS)
        data = response.json()
        # Allow for extra TEST_ sessions created during this test run
        assert data["total_minutes"] >= 420, f"Expected >=420 mins, got {data['total_minutes']}"
        assert data["total_hours"] >= 7.0, f"Expected >=7.0 hours, got {data['total_hours']}"
        assert data["session_count"] >= 6, f"Expected >=6 sessions, got {data['session_count']}"
        print(f"PASS: seed_data_totals - total_minutes={data['total_minutes']}, total_hours={data['total_hours']}, session_count={data['session_count']}")

    def test_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/stats/subjects")
        assert response.status_code == 401
        print("PASS: requires_auth")

    def test_subjects_sorted_by_time_desc(self):
        response = requests.get(f"{BASE_URL}/api/stats/subjects", headers=HEADERS)
        data = response.json()
        subjects = data["subjects"]
        minutes = [s["total_minutes"] for s in subjects]
        assert minutes == sorted(minutes, reverse=True), f"Subjects not sorted desc: {minutes}"
        print(f"PASS: subjects_sorted_by_time_desc")
