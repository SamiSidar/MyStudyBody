"""
Backend tests for MyStudyBody - Exam feature, image upload, auth
Tests: POST /api/errors, GET /api/images/{id}, GET /api/exam/questions, POST /api/exam/results, auth
"""
import pytest
import requests
import os
import base64
import uuid

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
TEST_USER_ID = "16990051-49d1-49f1-91d7-6ace94b9a74f"
TEST_EMAIL = f"TEST_exam_{uuid.uuid4().hex[:8]}@test.com"
TEST_PASSWORD = "TestPass123!"
TEST_USERNAME = f"TEST_user_{uuid.uuid4().hex[:6]}"

created_error_id = None
created_user_id = None

# Minimal 1x1 red JPEG in base64
TINY_JPEG_B64 = (
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U"
    "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN"
    "DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy"
    "MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA"
    "AAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/"
    "aAAwDAQACEQMRAD8AJQAB/9k="
)


@pytest.fixture(scope="module")
def api():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def user_headers():
    return {"X-User-ID": TEST_USER_ID, "Content-Type": "application/json"}


# ── Auth ──────────────────────────────────────────────────────────────

class TestAuth:
    """Auth endpoints: register and login"""

    def test_register_new_user(self, api):
        resp = api.post(f"{BASE_URL}/api/auth/register", json={
            "username": TEST_USERNAME,
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert resp.status_code == 200, f"Register failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data["email"] == TEST_EMAIL
        global created_user_id
        created_user_id = data["id"]
        print(f"PASS: register user id={created_user_id}")

    def test_register_duplicate_email(self, api):
        resp = api.post(f"{BASE_URL}/api/auth/register", json={
            "username": TEST_USERNAME + "_2",
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert resp.status_code == 400
        print("PASS: duplicate email rejected")

    def test_login_success(self, api):
        resp = api.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        print(f"PASS: login id={data['id']}")

    def test_login_wrong_password(self, api):
        resp = api.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": "wrongpass"
        })
        assert resp.status_code == 401
        print("PASS: wrong password rejected")


# ── POST /api/errors with image ───────────────────────────────────────

class TestErrorWithImage:
    """Image upload via POST /api/errors"""

    def test_post_error_with_image(self, api, user_headers):
        resp = api.post(f"{BASE_URL}/api/errors", headers=user_headers, json={
            "subject": "Math",
            "topic": "Türevler",
            "notes": "TEST_exam question image test",
            "image_base64": TINY_JPEG_B64
        })
        assert resp.status_code == 200, f"POST /api/errors failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data["image_base64"].startswith("/api/images/"), \
            f"Expected URL in image_base64, got: {data['image_base64']}"
        global created_error_id
        created_error_id = data["id"]
        print(f"PASS: error created id={created_error_id}, image_url={data['image_base64']}")

    def test_post_error_without_image(self, api, user_headers):
        resp = api.post(f"{BASE_URL}/api/errors", headers=user_headers, json={
            "subject": "Physics",
            "topic": "Kuvvet",
            "notes": "TEST_no image"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["image_base64"] == ""
        print("PASS: error without image created")

    def test_post_error_no_auth(self, api):
        resp = api.post(f"{BASE_URL}/api/errors", json={
            "subject": "Math",
            "topic": "Test",
            "notes": "no auth"
        })
        assert resp.status_code == 401
        print("PASS: 401 without auth")


# ── GET /api/images/{image_id} ────────────────────────────────────────

class TestServeImage:
    """Image serving endpoint"""

    def test_serve_image_ok(self, api):
        global created_error_id
        if not created_error_id:
            pytest.skip("No error with image created")
        image_id = f"{created_error_id}.jpg"
        resp = api.get(f"{BASE_URL}/api/images/{image_id}")
        assert resp.status_code == 200, f"GET /api/images/{image_id} failed: {resp.status_code}"
        assert "image" in resp.headers.get("content-type", ""), \
            f"Expected image content-type, got: {resp.headers.get('content-type')}"
        print(f"PASS: image served, size={len(resp.content)} bytes")

    def test_serve_image_not_found(self, api):
        resp = api.get(f"{BASE_URL}/api/images/nonexistent_image.jpg")
        assert resp.status_code == 404
        print("PASS: 404 for missing image")


# ── GET /api/exam/questions ───────────────────────────────────────────

class TestExamQuestions:
    """Exam questions endpoint"""

    def test_get_questions_month_all(self, api, user_headers):
        resp = api.get(f"{BASE_URL}/api/exam/questions?time_filter=month&subject=all",
                       headers=user_headers)
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"PASS: got {len(data)} questions")

    def test_get_questions_image_url_format(self, api, user_headers):
        """Questions with images should have /api/images/ URL"""
        resp = api.get(f"{BASE_URL}/api/exam/questions?time_filter=month&subject=all",
                       headers=user_headers)
        assert resp.status_code == 200
        data = resp.json()
        for q in data:
            if q.get("image_base64"):
                assert q["image_base64"].startswith("/api/images/") or q["image_base64"] == "", \
                    f"Bad image_base64 value: {q['image_base64'][:50]}"
        print("PASS: all image fields are URLs or empty")

    def test_get_questions_week_filter(self, api, user_headers):
        resp = api.get(f"{BASE_URL}/api/exam/questions?time_filter=week&subject=all",
                       headers=user_headers)
        assert resp.status_code == 200
        print(f"PASS: week filter returned {len(resp.json())} questions")

    def test_get_questions_no_auth(self, api):
        resp = api.get(f"{BASE_URL}/api/exam/questions?time_filter=month&subject=all")
        assert resp.status_code == 401
        print("PASS: 401 without auth")


# ── POST /api/exam/results ────────────────────────────────────────────

class TestExamResults:
    """Exam results submission"""

    def test_post_exam_results(self, api, user_headers):
        global created_error_id
        if not created_error_id:
            pytest.skip("No error created")
        resp = api.post(f"{BASE_URL}/api/exam/results", headers=user_headers, json={
            "results": [
                {"question_id": created_error_id, "understood": True}
            ]
        })
        assert resp.status_code == 200, f"POST /api/exam/results failed: {resp.text}"
        data = resp.json()
        assert data.get("success") is True
        assert data.get("count") == 1
        print("PASS: exam results saved")

    def test_post_exam_results_no_auth(self, api):
        resp = api.post(f"{BASE_URL}/api/exam/results", json={
            "results": [{"question_id": "some-id", "understood": False}]
        })
        assert resp.status_code == 401
        print("PASS: 401 without auth for exam results")
