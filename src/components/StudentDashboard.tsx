import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AttendanceStats, AttendanceSession, AttendanceRecord } from '../types';
import { api } from '../services/api';
import {
  isWebAuthnSupported,
  checkBiometricStatus,
  removeBiometricDevice,
  BiometricStatusResponse,
} from '../services/biometric';
import { BiometricModal } from './BiometricModal';
import {
  Fingerprint,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  MapPin,
  User,
  Filter,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Biometric modal state
  const [biometricModal, setBiometricModal] = useState<{
    open: boolean;
    mode: 'enroll' | 'punch';
    sessionId?: string;
    subjectTitle?: string;
  }>({ open: false, mode: 'punch' });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatusResponse>({
    enrolled: false,
    devices: 0,
    credentials: [],
  });

  const fetchStudentData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, sessionsRes, historyRes, bioRes] = await Promise.all([
        api.get<AttendanceStats>('/attendance/stats/me'),
        api.get<{ sessions: AttendanceSession[] }>('/attendance/sessions'),
        api.get<{ history: AttendanceRecord[] }>('/attendance/history/me'),
        checkBiometricStatus(),
      ]);

      setStats(statsRes);
      setSessions(sessionsRes.sessions || []);
      setHistory(historyRes.history || []);
      setBiometricStatus(bioRes);
    } catch (err: any) {
      console.error('Error fetching student attendance data:', err);
      setError(err.message || 'Unable to load attendance records.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDevice = async (id: string) => {
    try {
      await removeBiometricDevice(id);
      showToast('Biometric device removed.');
      const bioRes = await checkBiometricStatus();
      setBiometricStatus(bioRes);
    } catch (err: any) {
      showToast(err.message || 'Failed to remove device.');
    }
  };

  useEffect(() => {
    fetchStudentData();
    // Poll active sessions every 15 seconds so live sessions open by faculty appear promptly
    const interval = setInterval(() => {
      api.get<{ sessions: AttendanceSession[] }>('/attendance/sessions')
        .then((res) => setSessions(res.sessions || []))
        .catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const openLiveSessions = sessions.filter((s) => s.status === 'open');

  // Filter history records
  const filteredHistory = history.filter((rec) => {
    if (filterSubject !== 'all' && rec.subject !== filterSubject) return false;
    if (filterStatus !== 'all' && rec.status !== filterStatus) return false;
    return true;
  });

  // Calculate subjects below 75%
  const lowAttendanceSubjects = stats?.subjects.filter((s) => s.percentage < 75) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0F2A4A] text-white px-4 py-3 rounded-xl shadow-lg border border-amber-400/40 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Critical Attendance Alert Banner if any subject < 75% */}
      {lowAttendanceSubjects.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-900">
                VTU Mandatory 75% Attendance Warning
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                {lowAttendanceSubjects.map((s) => (
                  <span key={s.name} className="font-semibold mr-2">
                    Your attendance in {s.name} is {s.percentage}%. Please attend upcoming classes to avoid exam shortage.
                  </span>
                ))}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded bg-amber-200 text-amber-900">
            Attendance Below 75%
          </span>
        </div>
      )}

      {/* SECTION 1: Overall Attendance Stats Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-serif font-bold text-slate-900">Overall Attendance Status</h2>
            <div className="text-xs text-slate-500">
              Department of {user?.department} · Semester {user?.semester || 5}
            </div>
          </div>
          <button
            onClick={fetchStudentData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Overall % */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Overall Percentage
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl sm:text-4xl font-serif font-bold tabular-nums ${
                  (stats?.overallPercentage || 0) >= 75 ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {stats?.overallPercentage ?? 82}%
              </span>
              <span className="text-xs font-medium text-slate-500">
                {(stats?.overallPercentage || 0) >= 75 ? 'Criterion Met' : 'Shortage'}
              </span>
            </div>
            <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (stats?.overallPercentage || 0) >= 75 ? 'bg-emerald-600' : 'bg-red-500'
                }`}
                style={{ width: `${stats?.overallPercentage || 82}%` }}
              />
            </div>
          </div>

          {/* Card 2: Total Classes */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Total Conducted Classes
            </div>
            <div className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 tabular-nums">
              {stats?.totalClasses ?? 142}
            </div>
            <div className="mt-2 text-xs text-slate-500">Across all registered subjects</div>
          </div>

          {/* Card 3: Present Days */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Attended Sessions
            </div>
            <div className="text-3xl sm:text-4xl font-serif font-bold text-emerald-600 tabular-nums">
              {stats?.presentDays ?? 117}
            </div>
            <div className="mt-2 text-xs text-slate-500">Marked Present (Biometric / Manual)</div>
          </div>

          {/* Card 4: Absent Days */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Absent Sessions
            </div>
            <div className="text-3xl sm:text-4xl font-serif font-bold text-red-600 tabular-nums">
              {stats?.absentDays ?? 25}
            </div>
            <div className="mt-2 text-xs text-slate-500">Parent notifications recorded</div>
          </div>
        </div>
      </section>

      {/* DEDICATED BIOMETRIC ATTENDANCE STATUS CARD */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#0F2A4A]/5 border border-[#0F2A4A]/10 flex items-center justify-center">
              <Fingerprint className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-slate-900 flex items-center gap-2">
                <span>🔐 Biometric Attendance</span>
              </h3>
              <p className="text-xs text-slate-500">
                GEC Bidar FIDO2/WebAuthn platform biometric authentication (Touch ID, Windows Hello, Android)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            {biometricStatus.enrolled ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Registered</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Not Registered</span>
              </span>
            )}
          </div>
        </div>

        <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            {biometricStatus.enrolled ? (
              <div>
                <div className="text-xs font-bold text-slate-700 mb-1">
                  Enrolled Authenticator Devices ({biometricStatus.devices}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {biometricStatus.credentials.map((cred, idx) => (
                    <div
                      key={cred.id}
                      className="inline-flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      <span className="font-semibold text-slate-700">
                        Device {idx + 1}: {cred.deviceType || 'MacBook Touch ID / Platform Authenticator'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDevice(cred.id)}
                        className="text-slate-400 hover:text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
                        title="Remove this device authenticator"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed">
                No biometric device registered yet. Register your MacBook Touch ID, Windows Hello, Face ID, or Android device sensor below to securely mark your attendance.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {openLiveSessions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (!biometricStatus.enrolled) {
                    setBiometricModal({ open: true, mode: 'enroll' });
                  } else {
                    setBiometricModal({
                      open: true,
                      mode: 'punch',
                      sessionId: openLiveSessions[0].id,
                      subjectTitle: `${openLiveSessions[0].subject} (${openLiveSessions[0].location})`,
                    });
                  }
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-2"
              >
                <Fingerprint className="w-4 h-4 text-emerald-200" />
                <span>Mark Attendance</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setBiometricModal({ open: true, mode: 'enroll' })}
              className="px-4 py-2.5 bg-[#0F2A4A] hover:bg-[#1E4976] text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-2"
            >
              <Fingerprint className="w-4 h-4 text-amber-400" />
              <span>{biometricStatus.enrolled ? 'Register Another Device' : 'Register Biometric'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 2: Active Live Sessions for Immediate Punch-In */}
      <section className="p-6 rounded-2xl bg-gradient-to-r from-[#0F2A4A] to-[#1E4976] text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-amber-400/20 text-amber-300 text-xs font-bold uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Live Attendance Radar</span>
            </div>
            <h3 className="text-lg font-serif font-bold">Classroom Biometric Sessions</h3>
          </div>
          <button
            onClick={() => setBiometricModal({ open: true, mode: 'enroll' })}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors"
          >
            <Fingerprint className="w-4 h-4 text-amber-400" />
            <span>Manage Device Sensor</span>
          </button>
        </div>

        {openLiveSessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {openLiveSessions.map((sess) => (
              <div
                key={sess.id}
                className="p-4 bg-white/10 rounded-xl border border-white/15 backdrop-blur-sm flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-base font-semibold text-white">{sess.subject}</div>
                  <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-amber-300" />
                      {sess.facultyName}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-300" />
                      {sess.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-300" />
                      {sess.sessionType}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() =>
                    setBiometricModal({
                      open: true,
                      mode: 'punch',
                      sessionId: sess.id,
                      subjectTitle: `${sess.subject} (${sess.location})`,
                    })
                  }
                  className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#0F2A4A] font-bold text-xs rounded-lg shadow transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>Punch In</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-slate-300 text-xs">
            No live biometric session currently open by faculty. When your professor opens the attendance scanner in class, it will appear here instantly.
          </div>
        )}
      </section>

      {/* SECTION 3: Subject-wise Attendance Table */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-serif font-bold text-slate-900">Subject-wise Attendance</h3>
            <div className="text-xs text-slate-500">VTU 75% criterion evaluation across individual course subjects</div>
          </div>
          <span className="text-xs text-slate-400">Semester 5</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4 text-center">Present</th>
                <th className="py-3 px-4 text-center">Absent</th>
                <th className="py-3 px-4 text-center">Total</th>
                <th className="py-3 px-4">Attendance %</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats?.subjects.map((subj) => {
                const isBelow = subj.percentage < 75;
                return (
                  <tr key={subj.name} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{subj.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{subj.code || '21AI51'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono tabular-nums text-emerald-700 font-semibold">
                      {subj.present}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono tabular-nums text-red-600 font-semibold">
                      {subj.absent}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono tabular-nums text-slate-700 font-semibold">
                      {subj.total}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold tabular-nums w-10 ${
                            isBelow ? 'text-red-600' : 'text-slate-800'
                          }`}
                        >
                          {subj.percentage}%
                        </span>
                        <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isBelow ? 'bg-red-500' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${subj.percentage}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {isBelow ? (
                        <span className="inline-flex items-center gap-1 font-bold text-[11px] text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                          Attendance Below 75%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Safe
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 4: Attendance History Log */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-serif font-bold text-slate-900">Attendance History</h3>
            <div className="text-xs text-slate-500">Verified session log of your biometric and manual punches</div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">All Subjects</option>
              {stats?.subjects.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="present">Present Only</option>
              <option value="absent">Absent Only</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Faculty</th>
                <th className="py-3 px-4">Room</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {rec.date}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{rec.subject}</td>
                    <td className="py-3 px-4 text-slate-600">{rec.facultyName}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{rec.location}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {rec.time}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                        {rec.method === 'Biometric' && <Fingerprint className="w-3 h-3 text-amber-600" />}
                        {rec.method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {rec.status === 'present' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          Present
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                          Absent
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No attendance records match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Biometric Action Modal */}
      {biometricModal.open && (
        <BiometricModal
          mode={biometricModal.mode}
          sessionId={biometricModal.sessionId}
          subjectTitle={biometricModal.subjectTitle}
          onClose={() => setBiometricModal({ open: false, mode: 'punch' })}
          onSuccess={(msg) => {
            showToast(msg);
            fetchStudentData();
          }}
        />
      )}
    </div>
  );
};
