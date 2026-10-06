export type Role = 'student' | 'faculty';

export interface User {
  id: string;
  identifier: string; // USN for student, Faculty ID for faculty
  name: string;
  email: string;
  role: Role;
  department: string;
  semester?: number;
  designation?: string;
  parentName?: string;
  parentContact?: string; // Phone / WhatsApp number for absence alerts
  parentEmail?: string;
  biometricEnrolled?: boolean;
}

export interface AttendanceSession {
  id: string;
  subject: string;
  sessionType: 'Lecture' | 'Lab' | 'Tutorial';
  location: string;
  facultyId: string;
  facultyName: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId?: string;
  studentId: string;
  identifier: string; // USN
  studentName: string;
  subject: string;
  facultyName: string;
  location: string;
  date: string;
  time: string;
  status: 'present' | 'absent';
  method: 'Biometric' | 'Manual' | 'QR';
  verifiedAt?: string;
  parentNotified?: boolean;
}

export interface SubjectAttendance {
  name: string;
  code: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
  status: 'Safe' | 'Low Attendance';
}

export interface AttendanceStats {
  overallPercentage: number;
  presentDays: number;
  absentDays: number;
  totalClasses: number;
  subjects: SubjectAttendance[];
}

export interface LivePunch {
  id: string;
  studentId: string;
  identifier: string;
  name: string;
  verifiedAt: string;
  method: 'Biometric' | 'Manual';
  status: 'present';
}

export interface StudentRosterItem {
  id: string;
  studentId: string;
  identifier: string; // USN
  name: string;
  department: string;
  semester: number;
  parentContact: string;
  overallPercentage: number;
  currentStatus: 'present' | 'absent';
}

export interface ParentNotificationPayload {
  studentId: string;
  identifier: string;
  studentName: string;
  parentContact: string;
  subject: string;
  date: string;
  time: string;
  channel: 'whatsapp' | 'sms';
}
