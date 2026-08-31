"""Backend tests for TeleInject app - auth, clients CRUD, inject flow, admin guards."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sender-msg-relay.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@teleinject.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["email"] == ADMIN_EMAIL
    return data["token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def test_client_key():
    return f"TEST_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="session")
def created_client(auth_headers, test_client_key):
    payload = {"key": test_client_key, "name": "TEST Clinkit", "bot_token": "123456:FAKE", "chat_id": "-1001", "active": True}
    r = requests.post(f"{API}/admin/clients", json=payload, headers=auth_headers)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["key"] == test_client_key
    assert doc["name"] == "TEST Clinkit"
    assert "id" in doc
    yield doc
    # cleanup
    requests.delete(f"{API}/admin/clients/{doc['id']}", headers=auth_headers)


# ---- Auth ----
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_valid_token(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ---- Admin guards ----
class TestAdminGuards:
    @pytest.mark.parametrize("method,path", [
        ("get", "/admin/clients"),
        ("post", "/admin/clients"),
        ("get", "/admin/logs"),
        ("get", "/admin/stats"),
    ])
    def test_admin_endpoints_require_auth(self, method, path):
        r = requests.request(method, f"{API}{path}", json={})
        assert r.status_code == 401


# ---- Clients CRUD ----
class TestClientsCRUD:
    def test_create_client_and_persist(self, created_client, auth_headers):
        cid = created_client["id"]
        r = requests.get(f"{API}/admin/clients", headers=auth_headers)
        assert r.status_code == 200
        assert any(c["id"] == cid for c in r.json())

    def test_duplicate_key_rejected(self, auth_headers, created_client):
        payload = {"key": created_client["key"], "name": "dup", "bot_token": "x", "chat_id": "y"}
        r = requests.post(f"{API}/admin/clients", json=payload, headers=auth_headers)
        assert r.status_code == 400
        assert "pehle se maujood" in r.json().get("detail", "")

    def test_update_client(self, auth_headers, created_client):
        cid = created_client["id"]
        r = requests.put(f"{API}/admin/clients/{cid}", json={"name": "TEST Updated"}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST Updated"

    def test_public_clients_hides_secrets(self, created_client):
        r = requests.get(f"{API}/clients/public")
        assert r.status_code == 200
        clients = r.json()
        matching = [c for c in clients if c["key"] == created_client["key"]]
        assert matching, "created active client should appear in public list"
        c = matching[0]
        assert "bot_token" not in c
        assert "chat_id" not in c
        assert "key" in c and "name" in c

    def test_inactive_client_hidden_from_public(self, auth_headers, created_client):
        cid = created_client["id"]
        requests.put(f"{API}/admin/clients/{cid}", json={"active": False}, headers=auth_headers)
        r = requests.get(f"{API}/clients/public")
        assert not any(c["key"] == created_client["key"] for c in r.json())
        # reactivate for later tests
        requests.put(f"{API}/admin/clients/{cid}", json={"active": True}, headers=auth_headers)


# ---- Inject flow ----
class TestInject:
    def test_inject_with_fake_token_fails_gracefully(self, auth_headers, created_client):
        payload = {"client_key": created_client["key"], "sender_id": "HDFC", "body": "Test OTP 123456"}
        r = requests.post(f"{API}/inject", json=payload)
        # expected: 5xx (fake token -> Telegram Unauthorized). NOTE: ingress may mangle 502 body to HTML.
        assert r.status_code in (502, 400, 500), f"unexpected status {r.status_code}: {r.text[:200]}"

        # verify FAILED log written
        logs = requests.get(f"{API}/admin/logs", headers=auth_headers).json()
        matching = [l for l in logs if l["client_key"] == created_client["key"]]
        assert matching, "expected a log for the injected key"
        assert matching[0]["status"] == "failed"
        assert matching[0]["sender_id"] == "HDFC"

    def test_inject_unknown_key_404(self):
        r = requests.post(f"{API}/inject", json={"client_key": "NOPE_" + uuid.uuid4().hex, "sender_id": "X", "body": "y"})
        assert r.status_code == 404

    def test_inject_case_insensitive_key(self, created_client):
        # should still match via regex
        r = requests.post(f"{API}/inject", json={"client_key": created_client["key"].lower(), "sender_id": "X", "body": "y"})
        # Either 502 (telegram fail) or 200. Should NOT be 404.
        assert r.status_code != 404


# ---- Stats ----
class TestStats:
    def test_stats_returns_counts(self, auth_headers):
        r = requests.get(f"{API}/admin/stats", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_clients", "active_clients", "total_sent", "delivered", "failed", "success_rate"]:
            assert k in d
