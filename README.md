# GEC Bidar Attendance Management System

Official, separate, professional Attendance Management Platform for **Government Engineering College, Bidar (Karnataka)**, affiliated with Visvesvaraya Technological University (VTU), Belagavi.

This project is strictly dedicated to **attendance operations**, removing all extraneous college portal modules (such as notices, lost & found, fests, placements, study materials, fees, or visitor tours) and implementing a high-density, secure, biometric-enabled attendance system with genuine FIDO2/WebAuthn platform authentication.

---

## 1. WebAuthn Biometric Implementation & Root Cause Analysis

### What Was Wrong in the Initial Code:
1. **No Server-Side WebAuthn Cryptographic Verification:**
   - In registration (`/api/biometric/register`), the backend was merely persisting incoming strings without validating `clientDataJSON`, `attestationObject`, origin, RP ID, or extracting the credential's real public key using WebAuthn cryptography.
   - In assertion verification (`/api/attendance/biometric-punch`), the endpoint was writing a `present` record upon receiving any request—allowing bypass without checking signatures, authenticator data, challenge, user binding, or counter.
2. **Missing Maintained WebAuthn Library:**
   - Neither `@simplewebauthn/server` nor `@simplewebauthn/browser` was installed. Manual parsing resulted in incorrect ArrayBuffer conversions and failures with base64url padding.
3. **Flawed Challenge Lifecycle:**
   - Challenges lacked cryptographic expiration and one-time single-use enforcement, leaving endpoints susceptible to replay.
4. **Mock Bypass Buttons in UI:**
   - The UI included fallback buttons that bypassed hardware sensors to send fake punches.

### How It Was Fixed:
1. **Installed Official Packages:**
   - `@simplewebauthn/server` (v14.0.3) for backend registration options, assertion options, and cryptographic verification (`verifyRegistrationResponse`, `verifyAuthenticationResponse`).
   - `@simplewebauthn/browser` (v14.0.0) for standard frontend browser interactions (`startRegistration`, `startAuthentication`, `browserSupportsWebAuthn`).
2. **Real Credential Storage:**
   - Schema now stores real public key material: `credentialId`, `publicKey` (base64url representation of `credentialPublicKey`), `counter`, `deviceType`, `backedUp`, `transports`, and `createdAt`.
3. **Strict Assertion Verification on `/api/attendance/biometric-punch`:**
   - Requires valid `AuthenticationResponseJSON` containing `id`, `rawId`, and `response` with `clientDataJSON`, `authenticatorData`, and `signature`.
   - Binds the assertion to the authenticated student's JWT identity (`req.user.id`).
   - Retrieves and consumes the user's one-time challenge with a 5-minute TTL.
   - Cryptographically verifies signature against the user's stored public key using `verifyAuthenticationResponse`.
   - Updates the authenticator counter to detect device cloning.
   - Only after successful verification is attendance marked `PRESENT`.
4. **Clean UI with Accurate Status:**
   - Added the dedicated Biometric Attendance card showing registration status, enrolled platform devices (e.g. MacBook Touch ID), "Mark Attendance", "Register Another Device", and "Remove Device" actions.
   - Removed all fake bypass buttons.

---

## 2. Complete File Structure

```text
gec-bidar-attendance/
├── .env.example                       # Root environment variables
├── index.html                         # HTML5 entry with GEC Bidar metadata & Google Fonts
├── metadata.json                      # AI Studio application metadata
├── package.json                       # Dependencies & full-stack scripts
├── server.ts                          # Full-stack server (Port 3000) with @simplewebauthn/server
├── tsconfig.json                      # TypeScript configuration
├── vite.config.ts                     # Vite + Tailwind CSS v4 build setup
│
├── backend/                           # Standalone Express.js + MongoDB Backend (Port 5000)
│   ├── .env.example                   # Standalone backend environment variables
│   ├── package.json                   # Backend dependencies (with @simplewebauthn/server)
│   ├── server.js                      # Express server entry point (Port 5000)
│   ├── models.js                      # Mongoose database models & BiometricCredential schema
│   ├── auth.js                        # JWT authentication & bcrypt password hashing
│   ├── biometric.js                   # SimpleWebAuthn registration, assertion & challenge manager
│   └── attendance.js                  # Biometric punch verification, live sessions, manual roll, parent notices
│
├── src/                               # Frontend (React 19, TypeScript, Tailwind CSS)
│   ├── main.tsx                       # React application bootstrap
│   ├── App.tsx                        # Root layout, role guards & auth routing
│   ├── index.css                      # Tailwind CSS v4 styling & print rules
│   ├── types.ts                       # Shared TypeScript interfaces
│   │
│   ├── context/
│   │   └── AuthContext.tsx            # Session state, JWT token management, role guards
│   │
│   ├── services/
│   │   ├── api.ts                     # Central API helper (GET/POST/PUT/DELETE, Bearer tokens, error handling)
│   │   └── biometric.ts               # @simplewebauthn/browser helper (startRegistration, startAuthentication)
│   │
│   └── components/
│       ├── GecCrest.tsx               # Official SVG emblem for Government Engineering College Bidar
│       ├── Header.tsx                 # Academic top bar contract (Brand, User info, Logout)
│       ├── AuthModal.tsx              # Student & Faculty Login / Registration forms
│       ├── StudentDashboard.tsx       # Student attendance overview, 75% alerts, live punch, device manager
│       ├── FacultyDashboard.tsx       # Faculty profile, live session, manual roll, reports, CSV export
│       ├── BiometricModal.tsx         # Real platform authenticator prompt visualizer
│       └── ParentNotificationModal.tsx# Verified WhatsApp link & SMS gateway parent absence dispatcher
│
└── README.md                          # Complete documentation & test instructions
```

---

## 3. Environment Variables Configuration

### Root / Unified Server (`.env`):
```bash
# Server & App Config
PORT=3000
NODE_ENV=development
JWT_SECRET="gec_bidar_attendance_secure_jwt_secret_2026"
MONGODB_URI="mongodb://localhost:27017/gec_attendance"

# WebAuthn / FIDO2 Configuration
WEBAUTHN_RP_NAME="GEC Bidar Attendance Management System"
WEBAUTHN_RP_ID="localhost"
WEBAUTHN_ORIGIN="http://localhost:3000"

# Optional SMS Gateway Provider API Key
SMS_GATEWAY_API_KEY=""
```

### Standalone Backend (`backend/.env`):
```bash
PORT=5000
NODE_ENV=development
JWT_SECRET="gec_bidar_super_secure_jwt_token_key_2026"
MONGODB_URI="mongodb://localhost:27017/gec_attendance"
FRONTEND_URL="http://localhost:3000"

# WebAuthn / FIDO2 Configuration
WEBAUTHN_RP_NAME="GEC Bidar Attendance Management System"
WEBAUTHN_RP_ID="localhost"
WEBAUTHN_ORIGIN="http://localhost:3000"

# Administrative Faculty Registration Code
FACULTY_REGISTRATION_CODE="GECB-FAC-2026"
```

---

## 4. Installation & Run Commands

### Method A: Unified Full-Stack (Default in this environment)
```bash
# 1. Install dependencies
npm install

# 2. Run the full-stack application on http://localhost:3000
npm run dev

# 3. Build for production
npm run build
```

### Method B: Standalone Express + MongoDB Backend
```bash
# 1. Open backend directory and install dependencies
cd backend
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start standalone backend on http://localhost:5000
npm start
```

---

## 5. Seed Accounts for Testing

| Role | Identifier (USN / ID) | Default Password | Notes |
| :--- | :--- | :--- | :--- |
| **Student** | `3DG24AD406` | `Student@123` | Aseem Muzakir (Artificial Intelligence & Data Science, Sem 5) |
| **Faculty** | `FAC-118` | `Faculty@123` | Dr. Sunita Kulkarni (Associate Professor & HOD, AI & DS) |

---

## 6. Exact Step-by-Step Testing Guide

### Test 1: Student Login & Initial Biometric Status
1. Navigate to `http://localhost:3000`.
2. Login with USN: `3DG24AD406`, Password: `Student@123`.
3. In the Student Dashboard, observe the **🔐 Biometric Attendance** card:
   - Status displays: **Not Registered** (amber badge).
   - "Register Biometric" button is visible.

### Test 2: Enroll Platform Biometric (MacBook Touch ID / Windows Hello / Android)
1. Click **Register Biometric** in the Biometric Attendance card.
2. The modal appears showing *"Waiting for device authentication... (Touch ID / Face ID / Windows Hello)"*.
3. Tap your fingerprint sensor or verify with Windows Hello / Touch ID.
4. The sensor response is sent to `POST /api/biometric/register` where the server cryptographically verifies the attestation.
5. The modal displays: *"Biometric verified ✓"*, followed by *"Device registered ✓"*.
6. The dashboard updates to:
   - Status: **Registered** (green badge).
   - Device: `Device 1: platform (MacBook Touch ID / Platform Authenticator)`.
   - "Register Another Device" and "Remove" options are available.

### Test 3: Faculty Starts Live Attendance Session
1. Log out or open a private window.
2. Login as Faculty using ID: `FAC-118`, Password: `Faculty@123`.
3. Under **Start Attendance Session**:
   - Subject: `Machine Learning`
   - Session Type: `Lecture`
   - Room: `Room 301`
4. Click **Start Attendance**.
5. Live session activates with status `OPEN` and live student punch radar listening.

### Test 4: Student Marks Attendance with Biometric
1. Switch back to Student account (`3DG24AD406`).
2. The Live Attendance Radar shows the active `Machine Learning` session in `Room 301`.
3. Click **Mark Attendance** or **Punch In**.
4. The real biometric prompt appears on your device.
5. Tap your fingerprint/Face ID sensor.
6. The cryptographic assertion is sent to `POST /api/attendance/biometric-punch`.
7. Server validates:
   - Challenge match & single-use consumption.
   - RP ID & Origin match.
   - Public key signature verification via `@simplewebauthn/server`.
   - Sign count counter increment.
   - Session open status check.
   - Duplicate punch check.
8. Dashboard shows: *"Attendance marked PRESENT ✓"*.
9. Refreshing or checking the faculty radar shows `Aseem Muzakir (3DG24AD406)` in the Live Punches list marked as **Biometric / Present**.

### Test 5: Rejection of Duplicate Punch in Same Session
1. Try clicking **Punch In** again for the same open session.
2. Notice the immediate rejection: *"You are already marked PRESENT for Machine Learning"*.

### Test 6: Rejection of Fake / Unverified Calls
1. Running `curl -X POST http://localhost:3000/api/attendance/biometric-punch` with arbitrary JSON is rejected with HTTP 400:
   `"Cryptographic WebAuthn assertion payload is required. Attendance cannot be recorded without genuine biometric verification."`
2. Sending a tampered signature or invalid credential ID is rejected cryptographically by `@simplewebauthn/server`.

### Test 7: Parent Notification Delivery Check
1. On the Faculty Dashboard under **Manual Roll Call** or **Parent Notifications**, select an absent student.
2. Click **Notify Parent**.
3. Selecting **WhatsApp** opens a pre-formatted chat with the student's absence details.
4. Selecting **SMS Gateway** checks `SMS_GATEWAY_API_KEY`. If unconfigured, the system accurately informs the user:
   `"Notification integration is not configured. Please configure SMS_GATEWAY_API_KEY in the environment or use WhatsApp dispatch."`
   No false "sent successfully" message is displayed.
