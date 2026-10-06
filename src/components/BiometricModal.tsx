import React, { useState, useEffect } from 'react';
import { Fingerprint, X, CheckCircle2, AlertCircle, Shield, RefreshCw, ExternalLink, Smartphone } from 'lucide-react';
import {
  enrollDeviceBiometric,
  punchBiometricAttendance,
  isWebAuthnSupported,
} from '../services/biometric';

interface BiometricModalProps {
  mode: 'enroll' | 'punch';
  sessionId?: string;
  kind?: 'class' | 'campus';
  subjectTitle?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const BiometricModal: React.FC<BiometricModalProps> = ({
  mode,
  sessionId,
  kind = 'class',
  subjectTitle,
  onClose,
  onSuccess,
}) => {
  const [status, setStatus] = useState<'idle' | 'prompting' | 'verifying' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Ready to initiate biometric authentication.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState<boolean>(false);
  const [scanPulse, setScanPulse] = useState<number>(0);

  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch {
      setIsIframe(true);
    }

    const interval = setInterval(() => {
      setScanPulse((p) => (p + 1) % 100);
    }, 40);

    return () => clearInterval(interval);
  }, []);

  const startBiometricAction = async () => {
    setErrorMessage(null);

    if (!isWebAuthnSupported()) {
      setStatus('error');
      setStatusMessage('This device or browser does not support WebAuthn platform authentication.');
      setErrorMessage(
        'Platform biometric sensors (Touch ID, Windows Hello, Face ID) require Chrome, Safari, Edge, or Firefox on HTTPS or localhost.'
      );
      return;
    }

    setStatus('prompting');
    setStatusMessage('Waiting for device authentication... (Touch ID / Face ID / Windows Hello)');

    try {
      if (mode === 'enroll') {
        const res = await enrollDeviceBiometric();
        setStatus('verifying');
        setStatusMessage('Biometric verified ✓');

        setTimeout(() => {
          setStatus('success');
          setStatusMessage('Device registered ✓');
          setTimeout(() => {
            onSuccess(res.message || 'Device registered successfully.');
            onClose();
          }, 1200);
        }, 600);
      } else {
        const res = await punchBiometricAttendance({
          sessionId,
          kind: kind || 'class',
        });
        setStatus('verifying');
        setStatusMessage('Biometric verified ✓');

        setTimeout(() => {
          setStatus('success');
          setStatusMessage('Attendance marked PRESENT ✓');
          setTimeout(() => {
            onSuccess(res.message || 'Attendance marked PRESENT ✓');
            onClose();
          }, 1200);
        }, 600);
      }
    } catch (err: any) {
      console.error('[WebAuthn Sensor Error]:', err);
      setStatus('error');
      const msg = err.message || '';

      if (msg.includes('cancelled') || msg.includes('NotAllowedError') || msg.includes('timed out')) {
        setStatusMessage('Biometric verification was cancelled.');
        setErrorMessage('The sensor prompt was dismissed or timed out. Please click "Retry Sensor" and authenticate.');
      } else if (msg.includes('already registered')) {
        setStatusMessage('This biometric device is already registered.');
        setErrorMessage('Your account already has this device authenticator enrolled.');
      } else if (msg.includes('No biometric device is registered') || msg.includes('register your device first')) {
        setStatusMessage('No biometric device is registered. Please register your device first.');
        setErrorMessage('Click "Enroll Biometric" on your dashboard before marking attendance with biometrics.');
      } else if (msg.includes('closed')) {
        setStatusMessage('Attendance session is closed.');
        setErrorMessage('The faculty member has closed this session. No further punches are accepted.');
      } else if (msg.includes('already marked PRESENT') || msg.includes('already marked present')) {
        setStatusMessage('You are already marked PRESENT for this session.');
        setErrorMessage('Your attendance has already been recorded in the database.');
      } else if (isIframe && (msg.includes('origin') || msg.includes('SecurityError') || msg.includes('not allowed'))) {
        setStatusMessage('Browser iframe security policy restricted direct hardware sensor access.');
        setErrorMessage(
          'Notice: WebAuthn hardware authenticators are restricted inside third-party preview iframes by browser security policies. Please click "Open in New Window" to authenticate directly.'
        );
      } else {
        setStatusMessage(msg || 'Biometric verification failed.');
        setErrorMessage(err.data?.message || msg || 'The cryptographic signature could not be verified by the server.');
      }
    }
  };

  const handleOpenNewWindow = () => {
    try {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F2A4A]/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0F2A4A] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Fingerprint className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-serif font-bold text-sm tracking-tight">
                {mode === 'enroll' ? 'Enroll Device Biometric' : 'Biometric Attendance Verification'}
              </h3>
              {subjectTitle && (
                <p className="text-[11px] text-slate-300 truncate max-w-[240px]">{subjectTitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          {/* Animated Scanner Visualizer */}
          <div className="relative mx-auto w-40 h-40 mb-4 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F2A4A] to-[#081B30] border-2 border-amber-400/40 flex items-center justify-center shadow-inner">
            {/* Animated Laser Scan Beam */}
            {(status === 'prompting' || status === 'verifying') && (
              <div
                className="absolute left-0 right-0 h-1 bg-amber-400 shadow-[0_0_12px_#E8A33D] z-10 transition-all duration-75"
                style={{
                  top: `${(Math.sin(scanPulse * 0.1) * 0.5 + 0.5) * 85 + 5}%`,
                }}
              />
            )}

            {/* Concentric Sensor Rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-32 h-32 rounded-full border border-amber-400/20 animate-ping opacity-25" />
              <div className="w-24 h-24 rounded-full border border-amber-400/40" />
            </div>

            {/* Central Icon */}
            <div
              className={`relative z-20 w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                status === 'success'
                  ? 'border-2 border-emerald-400 bg-emerald-500/20'
                  : status === 'error'
                  ? 'border-2 border-red-400 bg-red-500/20'
                  : status === 'verifying'
                  ? 'border-2 border-amber-400 bg-amber-400/20'
                  : 'border-2 border-amber-400 bg-amber-400/10'
              }`}
            >
              {status === 'success' ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              ) : status === 'error' ? (
                <AlertCircle className="w-10 h-10 text-red-400" />
              ) : (
                <Fingerprint
                  className={`w-10 h-10 ${
                    status === 'prompting' || status === 'verifying'
                      ? 'text-amber-400 animate-pulse'
                      : 'text-amber-300'
                  }`}
                />
              )}
            </div>
          </div>

          {/* Status Message Box */}
          <div
            className={`text-xs font-semibold py-2.5 px-3 rounded-lg mb-4 text-center leading-relaxed ${
              status === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : status === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : status === 'verifying'
                ? 'bg-amber-50 text-amber-900 border border-amber-300 font-bold'
                : 'bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            {statusMessage}
          </div>

          {/* Error Details */}
          {errorMessage && (
            <div className="p-3 bg-red-50/70 border border-red-200/90 rounded-xl text-left mb-4 text-[11px] text-red-800 leading-relaxed space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-red-900">
                <Shield className="w-3.5 h-3.5 text-red-700" />
                <span>Security Diagnostic</span>
              </div>
              <p>{errorMessage}</p>
            </div>
          )}

          {/* Instructions */}
          {status === 'prompting' && (
            <p className="text-[11px] text-slate-500 mb-4 flex items-center justify-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
              <span>Use Touch ID, Face ID, Windows Hello, or Android Biometric prompt</span>
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {(status === 'idle' || status === 'error') && (
                <button
                  type="button"
                  onClick={startBiometricAction}
                  className="px-3 py-1.5 text-xs font-bold text-[#0F2A4A] bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {status === 'error' ? (
                    <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <Fingerprint className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <span>{status === 'error' ? 'Retry Sensor' : mode === 'enroll' ? 'Start Biometric Enrollment' : 'Start Biometric'}</span>
                </button>
              )}

              {isIframe && (
                <button
                  type="button"
                  onClick={handleOpenNewWindow}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors flex items-center gap-1"
                  title="Open top-level window for direct device sensor access"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Full Window</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
