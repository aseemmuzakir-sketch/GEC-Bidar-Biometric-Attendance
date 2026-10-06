import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  AttendanceSession,
  LivePunch,
  StudentRosterItem,
  AttendanceRecord,
} from '../types';
import { api } from '../services/api';
import { BiometricModal } from './BiometricModal';
import { ParentNotificationModal } from './ParentNotificationModal';
import {
  Play,
  Square,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Fingerprint,
  FileSpreadsheet,
  AlertTriangle,
  Send,
  Download,
  Filter,
  Search,
  Printer,
  Sparkles,
  ShieldCheck,
  Building,
} from 'lucide-react';

export const FacultyDashboard: React.FC = () => {
  const { user } = useAuth();

  // Active view tab: 'live_session' | 'manual_attendance' | 'parent_notifications' | 'reports'
  const [activeTab, setActiveTab] = useState<
    'live_session' | 'manual_attendance' | 'parent_notifications' | 'reports'
  >('live_session');

  // Live session state
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [livePunches, setLivePunches] = useState<LivePunch[]>([]);
  const [allSessions, setAllSessions] = useState<AttendanceSession[]>([]);

  // Start Session Form Fields
  const [subject, setSubject] = useState<string>('Machine Learning');
  const [sessionType, setSessionType] = useState<'Lecture' | 'Lab' | 'Tutorial'>('Lecture');
  const [room, setRoom] = useState<string>('Room 301');
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sessionTime, setSessionTime] = useState<string>('10:00 AM');

  // Manual roll call roster state
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [manualSubject, setManualSubject] = useState<string>('Machine Learning');
  const [manualSemester, setManualSemester] = useState<number>(5);
  const [confirmSubmitModal, setConfirmSubmitModal] = useState<boolean>(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState<boolean>(false);

  // Parent notification modal
  const [selectedAbsentStudent, setSelectedAbsentStudent] = useState<{
    student: {
      studentId: string;
      identifier: string;
      name: string;
      parentContact?: string;
    };
    subject: string;
    date: string;
    time: string;
  } | null>(null);

  // Biometric modal for faculty campus attendance or device enrollment
  const [biometricModal, setBiometricModal] = useState<{
    open: boolean;
    mode: 'enroll' | 'punch';
    kind?: 'class' | 'campus';
  }>({ open: false, mode: 'punch', kind: 'campus' });

  // Reports & Analytics state
  const [reportFilter, setReportFilter] = useState<{
    period: 'daily' | 'weekly' | 'monthly' | 'subject';
    subject: string;
    searchTerm: string;
  }>({ period: 'daily', subject: 'all', searchTerm: '' });

  const [reportRecords, setReportRecords] = useState<AttendanceRecord[]>([]);

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch initial faculty data and active sessions
  const loadFacultyData = async () => {
    try {
      const [sessionsRes, rosterRes, reportsRes] = await Promise.all([
        api.get<{ sessions: AttendanceSession[] }>('/attendance/sessions'),
        api.get<{ students: StudentRosterItem[] }>('/attendance/students', {
          params: { semester: manualSemester, department: user?.department },
        }),
        api.get<{ records: AttendanceRecord[] }>('/attendance/reports', {
          params: { department: user?.department },
        }),
      ]);

      setAllSessions(sessionsRes.sessions || []);
      const currentOpen = (sessionsRes.sessions || []).find((s) => s.status === 'open');
      setActiveSession(currentOpen || null);

      if (currentOpen) {
        loadSessionPunches(currentOpen.id);
      }

      setRoster(rosterRes.students || []);
      setReportRecords(reportsRes.records || []);
    } catch (err: any) {
      console.error('Failed to load faculty portal data:', err);
    }
  };

  const loadSessionPunches = async (sessionId: string) => {
    try {
      const res = await api.get<{ punches: LivePunch[] }>(`/attendance/sessions/${sessionId}/punches`);
      setLivePunches(res.punches || []);
    } catch (err) {
      console.warn('Could not fetch live session punches:', err);
    }
  };

  useEffect(() => {
    loadFacultyData();
  }, [manualSemester]);

  // Polling for live session punch updates every 5 seconds when session is open
  useEffect(() => {
    if (!activeSession) return;
    const timer = setInterval(() => {
      loadSessionPunches(activeSession.id);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeSession]);

  // 1. Start Attendance Session
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newSession = await api.post<AttendanceSession>('/attendance/sessions', {
        subject,
        sessionType,
        location: room,
        date: sessionDate,
        time: sessionTime,
      });

      setActiveSession(newSession);
      setLivePunches([]);
      showToast(`Live attendance session started for ${subject} (${room}). Students can now punch in.`);
      loadFacultyData();
    } catch (err: any) {
      showToast(err.message || 'Failed to start session', 'error');
    }
  };

  // 2. Close Attendance Session
  const handleCloseSession = async () => {
    if (!activeSession) return;
    try {
      await api.post(`/attendance/sessions/${activeSession.id}/close`);
      showToast(`Session closed. ${livePunches.length} students verified present.`);
      setActiveSession(null);
      loadFacultyData();
    } catch (err: any) {
      showToast(err.message || 'Failed to close session', 'error');
    }
  };

  // 3. Manual Attendance Roll Toggling
  const handleToggleRoll = (studentId: string, status: 'present' | 'absent') => {
    setRoster((prev) =>
      prev.map((item) => (item.studentId === studentId ? { ...item, currentStatus: status } : item))
    );
  };

  const handleMarkAll = (status: 'present' | 'absent') => {
    setRoster((prev) => prev.map((item) => ({ ...item, currentStatus: status })));
  };

  // 4. Submit Manual Attendance Batch
  const handleSubmitManualAttendance = async () => {
    setIsSubmittingManual(true);
    try {
      await api.post('/attendance/manual-submit', {
        subject: manualSubject,
        semester: manualSemester,
        room,
        date: sessionDate,
        records: roster.map((s) => ({
          studentId: s.studentId,
          identifier: s.identifier,
          name: s.name,
          status: s.currentStatus,
          parentContact: s.parentContact,
        })),
      });

      setConfirmSubmitModal(false);
      showToast(`Attendance submitted successfully for ${roster.length} students.`);
      loadFacultyData();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit manual attendance', 'error');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  // 5. Export Attendance Report to CSV
  const handleExportCSV = () => {
    if (!reportRecords.length) {
      showToast('No records to export.', 'info');
      return;
    }

    const headers = ['Date', 'Time', 'USN', 'Student Name', 'Subject', 'Status', 'Method', 'Faculty', 'Room'];
    const rows = reportRecords.map((r) => [
      `"${r.date}"`,
      `"${r.time}"`,
      `"${r.identifier}"`,
      `"${r.studentName}"`,
      `"${r.subject}"`,
      `"${r.status}"`,
      `"${r.method}"`,
      `"${r.facultyName}"`,
      `"${r.location}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GEC_Bidar_Attendance_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Attendance records exported to CSV.');
  };

  // At-Risk Defaulters (below 75%)
  const defaulterStudents = roster.filter((s) => s.overallPercentage < 75);

  // Absent students in current manual roster
  const absentStudentsInRoster = roster.filter((s) => s.currentStatus === 'absent');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs flex items-center gap-2 animate-fade-in ${
            toast.type === 'error'
              ? 'bg-red-900 text-white border-red-500'
              : 'bg-[#0F2A4A] text-white border-amber-400/40'
          }`}
        >
          {toast.type === 'error' ? (
            <XCircle className="w-4 h-4 text-red-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* SECTION 1: Faculty Profile & Academic Header */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#0F2A4A] text-amber-300 flex items-center justify-center font-serif text-2xl font-bold shadow-inner border border-amber-400/30">
            {user?.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-serif font-bold text-slate-900">{user?.name}</h2>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 tabular-nums">
                {user?.identifier}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
              <span>{user?.designation || 'Associate Professor'}</span>
              <span className="text-slate-400">·</span>
              <span>Department of {user?.department}</span>
              <span className="text-slate-400">·</span>
              <span>GEC Bidar Campus</span>
            </div>
          </div>
        </div>

        {/* Quick Actions (Faculty Campus Punch & Sensor Setup) */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => setBiometricModal({ open: true, mode: 'punch', kind: 'campus' })}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors border border-slate-300"
            title="Mark faculty daily campus attendance"
          >
            <Building className="w-3.5 h-3.5 text-[#0F2A4A]" />
            <span>Mark Campus Attendance</span>
          </button>
          <button
            onClick={() => setBiometricModal({ open: true, mode: 'enroll' })}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold rounded-lg transition-colors border border-amber-300"
            title="Register fingerprint or face ID on this device"
          >
            <Fingerprint className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Enroll Sensor</span>
          </button>
        </div>
      </section>

      {/* SECTION 2: Defaulter Students Alert Banner (< 75%) */}
      {defaulterStudents.length > 0 && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-red-900">
                VTU Academic Attendance Shortage Alert
              </div>
              <p className="text-xs text-red-800 mt-0.5">
                <span className="font-bold">{defaulterStudents.length} students</span> in this department are currently below the mandatory 75% attendance threshold.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab('manual_attendance');
              showToast('Reviewing students with attendance shortages below.');
            }}
            className="text-[11px] font-bold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition-colors whitespace-nowrap"
          >
            Inspect Defaulter Roster →
          </button>
        </div>
      )}

      {/* NAVIGATION TABS: Live Session / Manual Roll / Parent Notifications / Reports */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-1 no-print">
        <button
          onClick={() => setActiveTab('live_session')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'live_session'
              ? 'bg-white border-t-2 border-[#0F2A4A] text-[#0F2A4A] shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Play className="w-3.5 h-3.5 text-amber-500" />
          <span>Live Biometric Session</span>
          {activeSession && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" />}
        </button>

        <button
          onClick={() => setActiveTab('manual_attendance')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'manual_attendance'
              ? 'bg-white border-t-2 border-[#0F2A4A] text-[#0F2A4A] shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-amber-500" />
          <span>Manual Roll Call</span>
        </button>

        <button
          onClick={() => setActiveTab('parent_notifications')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'parent_notifications'
              ? 'bg-white border-t-2 border-[#0F2A4A] text-[#0F2A4A] shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Send className="w-3.5 h-3.5 text-amber-500" />
          <span>Parent Absence Notifications</span>
          {absentStudentsInRoster.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 font-mono ml-1">
              {absentStudentsInRoster.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'reports'
              ? 'bg-white border-t-2 border-[#0F2A4A] text-[#0F2A4A] shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" />
          <span>Attendance Reports & CSV</span>
        </button>
      </div>

      {/* TAB 1: Live Biometric Session */}
      {activeTab === 'live_session' && (
        <div className="space-y-6">
          {activeSession ? (
            /* Live Session Active Panel */
            <div className="bg-white rounded-2xl border-2 border-emerald-500/30 p-6 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Live Attendance Session Open</span>
                  </div>
                  <h3 className="text-xl font-serif font-bold text-slate-900">{activeSession.subject}</h3>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {activeSession.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Opened at {new Date(activeSession.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>Type: {activeSession.sessionType}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCloseSession}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow transition-colors flex items-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Close Attendance Session</span>
                  </button>
                </div>
              </div>

              {/* Real-time Session Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <div className="text-xs text-slate-500 font-semibold uppercase">Total Batch</div>
                  <div className="text-2xl font-serif font-bold text-slate-800 mt-1 tabular-nums">
                    {roster.length || 42}
                  </div>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <div className="text-xs text-emerald-700 font-semibold uppercase">Punched Present</div>
                  <div className="text-2xl font-serif font-bold text-emerald-700 mt-1 tabular-nums">
                    {livePunches.length}
                  </div>
                </div>
                <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-center">
                  <div className="text-xs text-red-700 font-semibold uppercase">Unmarked / Absent</div>
                  <div className="text-2xl font-serif font-bold text-red-600 mt-1 tabular-nums">
                    {Math.max(0, (roster.length || 42) - livePunches.length)}
                  </div>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
                  <div className="text-xs text-amber-800 font-semibold uppercase">Current Turnout</div>
                  <div className="text-2xl font-serif font-bold text-amber-900 mt-1 tabular-nums">
                    {roster.length
                      ? Math.round((livePunches.length / roster.length) * 100)
                      : 0}
                    %
                  </div>
                </div>
              </div>

              {/* Real-time Live Punch Stream */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-amber-500" />
                    <span>Live Biometric Punch Feed</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">Auto-refreshing stream</span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Student Name</th>
                        <th className="py-2.5 px-4">USN</th>
                        <th className="py-2.5 px-4">Verification Time</th>
                        <th className="py-2.5 px-4">Method</th>
                        <th className="py-2.5 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {livePunches.length > 0 ? (
                        livePunches.map((punch) => (
                          <tr key={punch.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-4 font-semibold text-slate-900">{punch.name}</td>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700">
                              {punch.identifier}
                            </td>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500">
                              {new Date(punch.verifiedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                                <Fingerprint className="w-3 h-3 text-amber-600" />
                                {punch.method}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Present
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            Waiting for students to scan device biometric credentials in classroom...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* Start New Session Form */
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="mb-5">
                <h3 className="text-lg font-serif font-bold text-slate-900">Start Classroom Attendance Session</h3>
                <p className="text-xs text-slate-500">
                  Opening an attendance session enables enrolled student devices to verify and punch in via WebAuthn platform authenticator.
                </p>
              </div>

              <form onSubmit={handleStartSession} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Machine Learning"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Session Type</label>
                  <select
                    value={sessionType}
                    onChange={(e) => setSessionType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="Lecture">Lecture</option>
                    <option value="Lab">Lab Practical</option>
                    <option value="Tutorial">Tutorial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Classroom / Laboratory</label>
                  <input
                    type="text"
                    required
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="e.g. Room 301 / AI Lab"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Session Date</label>
                  <input
                    type="date"
                    required
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Session Time</label>
                  <input
                    type="text"
                    required
                    value={sessionTime}
                    onChange={(e) => setSessionTime(e.target.value)}
                    placeholder="e.g. 10:00 AM"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 px-4 bg-[#0F2A4A] hover:bg-[#1E4976] text-white text-xs font-bold rounded-lg shadow transition-colors flex items-center justify-center gap-1.5 h-[38px]"
                  >
                    <Play className="w-3.5 h-3.5 text-amber-400" />
                    <span>Start Attendance</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Manual Roll Call */}
      {activeTab === 'manual_attendance' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-serif font-bold text-slate-900">Manual Attendance Roster</h3>
              <p className="text-xs text-slate-500">
                Mark student presence/absence manually for classroom lectures or lab sessions.
              </p>
            </div>

            {/* Quick Bulk Shortcuts */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleMarkAll('present')}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
              >
                Mark All Present
              </button>
              <button
                onClick={() => handleMarkAll('absent')}
                className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
              >
                Mark All Absent
              </button>
            </div>
          </div>

          {/* Roster Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                value={manualSubject}
                onChange={(e) => setManualSubject(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Semester</label>
              <select
                value={manualSemester}
                onChange={(e) => setManualSemester(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
              />
            </div>
          </div>

          {/* Student Roll Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">USN</th>
                  <th className="py-3 px-4">Term %</th>
                  <th className="py-3 px-4">Parent Phone</th>
                  <th className="py-3 px-4 text-center">Status Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.map((student) => {
                  const isPresent = student.currentStatus === 'present';
                  const isBelow = student.overallPercentage < 75;

                  return (
                    <tr key={student.studentId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div>{student.name}</div>
                        {isBelow && (
                          <span className="text-[10px] text-red-600 font-normal">
                            Below 75% attendance criterion
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700">{student.identifier}</td>
                      <td className="py-3 px-4 font-mono tabular-nums">
                        <span className={`font-semibold ${isBelow ? 'text-red-600' : 'text-slate-700'}`}>
                          {student.overallPercentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                        {student.parentContact || 'Not Registered'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleToggleRoll(student.studentId, 'present')}
                            className={`px-3 py-1 text-[11px] font-bold rounded-md transition-colors ${
                              isPresent
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            PRESENT
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleRoll(student.studentId, 'absent')}
                            className={`px-3 py-1 text-[11px] font-bold rounded-md transition-colors ${
                              !isPresent
                                ? 'bg-red-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            ABSENT
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Submit Attendance Button & Summary */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              Marked:{' '}
              <span className="font-semibold text-emerald-700">
                {roster.filter((s) => s.currentStatus === 'present').length} Present
              </span>{' '}
              ·{' '}
              <span className="font-semibold text-red-600">
                {roster.filter((s) => s.currentStatus === 'absent').length} Absent
              </span>{' '}
              out of {roster.length} students.
            </div>

            <button
              onClick={() => setConfirmSubmitModal(true)}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#0F2A4A] hover:bg-[#1E4976] text-white text-xs font-bold rounded-lg shadow transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Submit Attendance ({roster.length} Students)</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Parent Notifications for Absent Students */}
      {activeTab === 'parent_notifications' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-serif font-bold text-slate-900">Absent Student Parent Notifications</h3>
              <p className="text-xs text-slate-500">
                Official absence communication to parent/guardians via verified WhatsApp or College SMS gateway.
              </p>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Subject: <span className="font-bold text-slate-800">{manualSubject}</span>
            </div>
          </div>

          {absentStudentsInRoster.length > 0 ? (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">USN</th>
                    <th className="py-3 px-4">Parent Contact</th>
                    <th className="py-3 px-4">Absent Subject</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {absentStudentsInRoster.map((student) => (
                    <tr key={student.studentId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">{student.name}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700">{student.identifier}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                        {student.parentContact || (
                          <span className="text-red-500 italic">Missing — enter during notify</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-amber-900">{manualSubject}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                        {sessionDate} · {sessionTime}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() =>
                            setSelectedAbsentStudent({
                              student: {
                                studentId: student.studentId,
                                identifier: student.identifier,
                                name: student.name,
                                parentContact: student.parentContact,
                              },
                              subject: manualSubject,
                              date: sessionDate,
                              time: sessionTime,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#0F2A4A] hover:bg-[#1E4976] rounded-lg shadow-sm transition-colors"
                        >
                          <Send className="w-3.5 h-3.5 text-amber-400" />
                          <span>Notify Parent</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              No students are currently marked absent in the active roster. Mark students absent in the Manual Roll Call tab to trigger parent notifications.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Reports & Analytics */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-serif font-bold text-slate-900">Attendance Reports & Historical Audit</h3>
              <p className="text-xs text-slate-500">
                Daily, weekly, monthly, and subject-wise attendance logs with CSV export.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Report</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0F2A4A] hover:bg-[#1E4976] rounded-lg shadow transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by student name or USN..."
                value={reportFilter.searchTerm}
                onChange={(e) => setReportFilter({ ...reportFilter, searchTerm: e.target.value })}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <select
                value={reportFilter.period}
                onChange={(e) => setReportFilter({ ...reportFilter, period: e.target.value as any })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none bg-white"
              >
                <option value="daily">Daily Attendance</option>
                <option value="weekly">Weekly Attendance</option>
                <option value="monthly">Monthly Attendance</option>
                <option value="subject">Subject-wise Aggregates</option>
              </select>
            </div>

            <div>
              <select
                value={reportFilter.subject}
                onChange={(e) => setReportFilter({ ...reportFilter, subject: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none bg-white"
              >
                <option value="all">All Course Subjects</option>
                <option value="Machine Learning">Machine Learning</option>
                <option value="DBMS">DBMS</option>
                <option value="Data Structures">Data Structures</option>
                <option value="Computer Networks">Computer Networks</option>
              </select>
            </div>
          </div>

          {/* Report Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl print-content">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">USN</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Faculty</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportRecords
                  .filter((r) => {
                    if (reportFilter.subject !== 'all' && r.subject !== reportFilter.subject) return false;
                    if (
                      reportFilter.searchTerm &&
                      !r.studentName.toLowerCase().includes(reportFilter.searchTerm.toLowerCase()) &&
                      !r.identifier.toLowerCase().includes(reportFilter.searchTerm.toLowerCase())
                    ) {
                      return false;
                    }
                    return true;
                  })
                  .slice(0, 50)
                  .map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {rec.date}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-800 font-semibold">
                        {rec.identifier}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{rec.studentName}</td>
                      <td className="py-3 px-4 text-slate-700">{rec.subject}</td>
                      <td className="py-3 px-4 text-slate-600">{rec.facultyName}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{rec.location}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {rec.method}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {rec.status === 'present' ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            Present
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                            Absent
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Manual Attendance Submission */}
      {confirmSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F2A4A]/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-[#0F2A4A] mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-base text-slate-900">Confirm Attendance Submission</h4>
              <p className="text-xs text-slate-600 mt-1">
                Submit attendance for <span className="font-bold">{roster.length} students</span> for{' '}
                <span className="font-bold text-[#0F2A4A]">{manualSubject}</span>?
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setConfirmSubmitModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Review Roll
              </button>
              <button
                type="button"
                onClick={handleSubmitManualAttendance}
                disabled={isSubmittingManual}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#0F2A4A] hover:bg-[#1E4976] rounded-lg shadow transition-colors disabled:opacity-50"
              >
                {isSubmittingManual ? 'Recording...' : 'Yes, Submit Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parent Notification Modal */}
      {selectedAbsentStudent && (
        <ParentNotificationModal
          student={selectedAbsentStudent.student}
          subject={selectedAbsentStudent.subject}
          date={selectedAbsentStudent.date}
          time={selectedAbsentStudent.time}
          onClose={() => setSelectedAbsentStudent(null)}
          onSent={() => {
            showToast('Parent absence notice dispatched.');
            setSelectedAbsentStudent(null);
          }}
        />
      )}

      {/* Biometric Action Modal */}
      {biometricModal.open && (
        <BiometricModal
          mode={biometricModal.mode}
          kind={biometricModal.kind}
          onClose={() => setBiometricModal({ open: false, mode: 'punch' })}
          onSuccess={(msg) => {
            showToast(msg);
            loadFacultyData();
          }}
        />
      )}
    </div>
  );
};
