/**
 * WebAuthn Biometric Module for GEC Bidar Attendance Management System
 * Uses @simplewebauthn/server for cryptographic registration and assertion verification.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { authenticateToken } = require('./auth');
const { User } = require('./models');

// Unified Challenge Store with Expiration & Single-Use TTL
// Format: userId -> { challenge: string, type: 'registration' | 'authentication', expiresAt: number }
const challengeStore = new Map();

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function saveChallenge(userId, challenge, type) {
  challengeStore.set(userId, {
    challenge,
    type,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
}

function consumeChallenge(userId, expectedType) {
  const entry = challengeStore.get(userId);
  if (!entry) {
    throw new Error('Biometric request expired or invalid challenge. Please try again.');
  }

  // Delete immediately to prevent replay / reuse
  challengeStore.delete(userId);

  if (Date.now() > entry.expiresAt) {
    throw new Error('Biometric request expired. Please try again.');
  }

  if (entry.type !== expectedType) {
    throw new Error(`Challenge type mismatch: expected ${expectedType} but found ${entry.type}.`);
  }

  return entry.challenge;
}

function getExpectedRPID(req) {
  if (process.env.WEBAUTHN_RP_ID) {
    return process.env.WEBAUTHN_RP_ID.trim();
  }
  const raw = req.headers['x-forwarded-host'] || req.headers.host || req.hostname || 'localhost';
  const clean = String(raw).split(':')[0];
  return clean === '127.0.0.1' ? 'localhost' : clean;
}

function getExpectedOrigins(req) {
  const allowed = new Set();
  if (process.env.WEBAUTHN_ORIGIN) {
    process.env.WEBAUTHN_ORIGIN.split(',').map((s) => s.trim()).forEach((o) => allowed.add(o));
  }

  // Standard development origins
  allowed.add('http://localhost:3000');
  allowed.add('http://localhost:5000');
  allowed.add('http://127.0.0.1:3000');

  // Dynamically include request origin / referer if valid
  if (req.headers.origin) {
    allowed.add(req.headers.origin);
  }
  if (req.headers.referer) {
    try {
      const u = new URL(req.headers.referer);
      allowed.add(u.origin);
    } catch {}
  }

  return Array.from(allowed);
}

// GET /api/biometric/status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const creds = (user.biometricCredentials || []).map((c) => ({
      id: c.credentialId,
      deviceType: c.deviceType || 'Platform Authenticator',
      createdAt: c.createdAt || new Date(),
      transports: c.transports || ['internal'],
    }));

    return res.json({
      enrolled: creds.length > 0,
      devices: creds.length,
      credentials: creds,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error checking biometric status' });
  }
});

// POST /api/biometric/register-options
router.post('/register-options', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const rpID = getExpectedRPID(req);
    const rpName = process.env.WEBAUTHN_RP_NAME || 'GEC Bidar Attendance Management System';

    // User ID must be a Uint8Array representation
    const userIdBytes = new Uint8Array(Buffer.from(user._id.toString()));

    // Exclude previously enrolled credentials
    const excludeCredentials = (user.biometricCredentials || []).map((cred) => ({
      id: cred.credentialId,
      transports: cred.transports || ['internal'],
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: userIdBytes,
      userName: user.identifier,
      userDisplayName: `${user.name} (${user.identifier})`,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
        residentKey: 'preferred',
      },
      timeout: 60000,
    });

    saveChallenge(user._id.toString(), options.challenge, 'registration');

    return res.json(options);
  } catch (err) {
    console.error('[WebAuthn] generateRegistrationOptions error:', err);
    return res.status(500).json({
      message: err.message || 'Error generating biometric registration challenge',
    });
  }
});

// POST /api/biometric/register
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const response = req.body;
    if (!response || !response.id) {
      return res.status(400).json({ message: 'Missing WebAuthn registration response payload' });
    }

    let expectedChallenge;
    try {
      expectedChallenge = consumeChallenge(user._id.toString(), 'registration');
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    const expectedRPID = getExpectedRPID(req);
    const expectedOrigin = getExpectedOrigins(req);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ message: 'Cryptographic biometric registration verification failed.' });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const credentialID = credential.id;
    const credentialPublicKey = credential.publicKey;
    const counter = credential.counter;

    // Check if credential ID is already registered for this user
    const existingIndex = (user.biometricCredentials || []).findIndex(
      (c) => c.credentialId === credentialID
    );

    const newCredential = {
      credentialId: credentialID,
      publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
      counter: counter || 0,
      deviceType: credentialDeviceType || 'platform',
      backedUp: !!credentialBackedUp,
      transports: response.response?.transports || ['internal'],
      createdAt: new Date(),
    };

    if (existingIndex >= 0) {
      user.biometricCredentials[existingIndex] = newCredential;
    } else {
      user.biometricCredentials.push(newCredential);
    }

    await user.save();

    return res.json({
      success: true,
      message: 'Biometric device credential cryptographically verified and registered successfully.',
      device: {
        id: credentialID,
        deviceType: newCredential.deviceType,
      },
    });
  } catch (err) {
    console.error('[WebAuthn] verifyRegistrationResponse error:', err);
    return res.status(400).json({
      message: `Biometric registration failed: ${err.message}`,
    });
  }
});

// POST /api/biometric/assert-options
router.post('/assert-options', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.biometricCredentials || user.biometricCredentials.length === 0) {
      return res.status(400).json({
        message: 'No biometric device is registered for this account. Please register your device first.',
      });
    }

    const rpID = getExpectedRPID(req);

    const allowCredentials = user.biometricCredentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports || ['internal'],
    }));

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 60000,
    });

    saveChallenge(user._id.toString(), options.challenge, 'authentication');

    return res.json(options);
  } catch (err) {
    console.error('[WebAuthn] generateAuthenticationOptions error:', err);
    return res.status(500).json({ message: 'Error generating assertion options' });
  }
});

// DELETE /api/biometric/credentials/:id
router.delete('/credentials/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const credId = req.params.id;
    const initialLen = user.biometricCredentials.length;
    user.biometricCredentials = user.biometricCredentials.filter((c) => c.credentialId !== credId);

    if (user.biometricCredentials.length === initialLen) {
      return res.status(404).json({ message: 'Biometric credential not found on your account.' });
    }

    await user.save();

    return res.json({
      success: true,
      message: 'Biometric device removed successfully.',
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error removing biometric credential.' });
  }
});

module.exports = {
  router,
  consumeChallenge,
  getExpectedRPID,
  getExpectedOrigins,
};
