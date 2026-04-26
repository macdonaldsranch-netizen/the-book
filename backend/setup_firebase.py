"""
One-time setup script:
  1. Creates the Firestore (default) database in us-central1
  2. Creates an admin user (email/password you provide)
  3. Sets the admin custom claim on that user

Usage:
  .\venv\Scripts\python.exe setup_firebase.py <email> <password>
"""
import json
import sys
import os

import firebase_admin
from firebase_admin import credentials, auth

import google.auth.transport.requests
import google.oauth2.service_account

KEY_FILE = "serviceAccountKey.json"
PROJECT_ID = "the-book-mcd"
DB_LOCATION = "us-central1"

# ── 1. Load service account key ─────────────────────────────────────────────
if len(sys.argv) != 3:
    print("Usage: python setup_firebase.py <admin_email> <admin_password>")
    sys.exit(1)

email, password = sys.argv[1], sys.argv[2]

if not os.path.exists(KEY_FILE):
    print(f"ERROR: {KEY_FILE} not found in {os.getcwd()}")
    sys.exit(1)

with open(KEY_FILE) as f:
    sa_info = json.load(f)

# ── 2. Create Firestore (default) database via REST ──────────────────────────
print("\n[1/3] Creating Firestore database...")

scoped_creds = google.oauth2.service_account.Credentials.from_service_account_info(
    sa_info,
    scopes=["https://www.googleapis.com/auth/cloud-platform"],
)
transport = google.auth.transport.requests.Request()
scoped_creds.refresh(transport)
token = scoped_creds.token

import urllib.request, urllib.error

url = (
    f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases"
    f"?databaseId=(default)"
)
payload = json.dumps({
    "type": "FIRESTORE_NATIVE",
    "locationId": DB_LOCATION,
}).encode()

req = urllib.request.Request(
    url,
    data=payload,
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    },
    method="POST",
)

try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
        print(f"  ✓ Database creation started: {result.get('name', 'ok')}")
        print("    (It may take ~30 seconds to become ready)")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    if "already exists" in body.lower() or e.code == 409:
        print("  ✓ Database already exists — skipping")
    else:
        print(f"  ✗ Error {e.code}: {body}")
        print("    You may need to create the database manually in the Firebase Console.")

# ── 3. Init Firebase Admin ────────────────────────────────────────────────────
cred = credentials.Certificate(KEY_FILE)
firebase_admin.initialize_app(cred)

# ── 4. Create admin user ──────────────────────────────────────────────────────
print("\n[2/3] Creating admin user...")

try:
    user = auth.create_user(email=email, password=password, email_verified=True)
    print(f"  ✓ User created — UID: {user.uid}")
except auth.EmailAlreadyExistsError:
    user = auth.get_user_by_email(email)
    print(f"  ✓ User already exists — UID: {user.uid}")

# ── 5. Set admin custom claim ─────────────────────────────────────────────────
print("\n[3/3] Setting admin role claim...")
auth.set_custom_user_claims(user.uid, {"role": "admin"})
print(f"  ✓ Custom claim set: role=admin")

print("\n✅  Setup complete!")
print(f"   Email:    {email}")
print(f"   UID:      {user.uid}")
print(f"   Project:  {PROJECT_ID}")
print("\n   You can now start the backend and frontend.\n")
