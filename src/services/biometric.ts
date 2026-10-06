/**
 * WebAuthn Biometric Service for GEC Bidar Attendance Management System
 * Uses @simplewebauthn/browser for standard FIDO2/WebAuthn interactions
 * (Touch ID, Windows Hello, Face ID, Android Biometrics).
 */

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import { api } from './api';

export function isWebAuthnSupported(): boolean {
  return browserSupportsWebAuthn();
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

export interface BiometricDeviceRecord {
  id: string;
  deviceType: string;
  createdAt: string;
  transports?: string[];
}

export interface BiometricStatusResponse {
  enrolled: boolean;
  devices: number;
  credentials: BiometricDeviceRecord[];
}

/**
 * Check enrollment status and list of registered authenticators for current user
 */
export async function checkBiometricStatus(): Promise<BiometricStatusResponse> {
  try {
    const res = await api.get('/biometric/status');
    return {
      enrolled: !!res.enrolled,
      devices: res.devices || 0,
      credentials: res.credentials || [],
    };
  } catch (err) {
    return { enrolled: false, devices: 0, credentials: [] };
  }
}

/**
 * Remove an enrolled device credential
 */
export async function removeBiometricDevice(
  credentialId: string
): Promise<{ success: boolean; message: string }> {
  return await api.delete(`/biometric/credentials/${encodeURIComponent(credentialId)}`);
}

/**
 * Step 1: Enroll Device Biometric using WebAuthn Platform Authenticator
 */
export async function enrollDeviceBiometric(): Promise<{
  success: boolean;
  message: string;
  device?: { id: string; deviceType: string };
}> {
  if (!browserSupportsWebAuthn()) {
    throw new Error(
      'This browser or device does not support WebAuthn biometrics. Please use Chrome, Safari, Edge, or Firefox on HTTPS or localhost.'
    );
  }

  // 1. Fetch challenge & creation options from backend
  const options = await api.post('/biometric/register-options');

  let regResponse;
  try {
    // 2. Invoke real platform authenticator (Touch ID, Windows Hello, Android, etc.)
    regResponse = await startRegistration({ optionsJSON: options });
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.message?.includes('cancelled')) {
      throw new Error('Biometric registration was cancelled or timed out. Please tap your biometric sensor.');
    }
    if (err.name === 'InvalidStateError') {
      throw new Error('This biometric device is already registered for your account.');
    }
    throw new Error(err.message || 'Biometric hardware sensor error during registration.');
  }

  // 3. Send verified attestation to backend
  return await api.post('/biometric/register', regResponse);
}

/**
 * Step 2: Biometric Punch-In (Verify device credential & mark attendance)
 */
export async function punchBiometricAttendance(params: {
  sessionId?: string;
  kind: 'class' | 'campus';
}): Promise<{ success: boolean; message: string; record?: any }> {
  if (!browserSupportsWebAuthn()) {
    throw new Error('This device or browser does not support WebAuthn platform authentication.');
  }

  // 1. Get assertion options from backend
  const options = await api.post('/biometric/assert-options');

  let authResponse;
  try {
    // 2. Prompt real platform authenticator
    authResponse = await startAuthentication({ optionsJSON: options });
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.message?.includes('cancelled')) {
      throw new Error('Biometric verification was cancelled. Please tap your fingerprint or face scanner.');
    }
    throw new Error(err.message || 'Biometric authentication failed on device.');
  }

  // 3. Send full cryptographic assertion payload to backend for server-side verification
  const payload = {
    ...authResponse,
    sessionId: params.sessionId,
    kind: params.kind,
  };

  return await api.post('/attendance/biometric-punch', payload);
}
