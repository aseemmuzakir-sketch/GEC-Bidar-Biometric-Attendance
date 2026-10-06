/**
 * GEC Bidar Attendance Management System - Database Models
 * Uses Mongoose for MongoDB / MongoDB Atlas with resilient fallback store.
 */

const mongoose = require('mongoose');

// =========================================================================
// MONGOOSE SCHEMAS
// =========================================================================

// Biometric Credential Sub-Schema
const BiometricCredentialSchema = new mongoose.Schema({
  credentialId: { type: String, required: true },
  publicKey: { type: String, required: true },
  counter: { type: Number, default: 0 },
  deviceType: { type: String, default: 'singleDevice' },
  backedUp: { type: Boolean, default: false },
  transports: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

// User Schema (Students & Faculty)
// NOTE ON SCHEMA CHANGE:
// To support the required Parent Notification feature without silent invention,
// we explicitly added 'parentName', 'parentContact', and 'parentEmail' to the Student model.
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  identifier: { type: String, required: true, unique: true, uppercase: true, trim: true }, // USN or Faculty ID
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ['student', 'faculty'], required: true },
  department: { type: String, required: true },
  semester: { type: Number, min: 1, max: 8 }, // Student only
  designation: { type: String }, // Faculty only
  passwordHash: { type: String, required: true },
  
  // Explicit parent contact fields for absence communication:
  parentName: { type: String, trim: true },
  parentContact: { type: String, trim: true }, // Phone / WhatsApp number with country code (e.g. 919876543210)
  parentEmail: { type: String, lowercase: true, trim: true },

  biometricCredentials: [BiometricCredentialSchema],
  createdAt: { type: Date, default: Date.now }
});

// Attendance Session Schema (Classroom Live Scanner)
const AttendanceSessionSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  sessionType: { type: String, enum: ['Lecture', 'Lab', 'Tutorial'], default: 'Lecture' },
  location: { type: String, required: true },
  facultyId: { type: String, required: true },
  facultyName: { type: String, required: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  openedAt: { type: Date, default: Date.now },
  closedAt: { type: Date }
});

// Attendance Record Schema (Individual student punch / manual roll)
const AttendanceRecordSchema = new mongoose.Schema({
  sessionId: { type: String },
  studentId: { type: String, required: true },
  identifier: { type: String, required: true, uppercase: true }, // USN
  studentName: { type: String, required: true },
  subject: { type: String, required: true },
  facultyName: { type: String, required: true },
  location: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  time: { type: String, required: true },
  status: { type: String, enum: ['present', 'absent'], required: true },
  method: { type: String, enum: ['Biometric', 'Manual', 'QR'], default: 'Biometric' },
  verifiedAt: { type: Date },
  parentNotified: { type: Boolean, default: false }
});

// Notification Log Schema (Absence alerts dispatched to parent/guardians)
const NotificationLogSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  identifier: { type: String, required: true },
  studentName: { type: String, required: true },
  parentContact: { type: String, required: true },
  subject: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  channel: { type: String, enum: ['whatsapp', 'sms'], default: 'whatsapp' },
  message: { type: String, required: true },
  dispatchedAt: { type: Date, default: Date.now }
});

// Create Mongoose models if connection is active
let User, AttendanceSession, AttendanceRecord, NotificationLog;
try {
  User = mongoose.model('User', UserSchema);
  AttendanceSession = mongoose.model('AttendanceSession', AttendanceSessionSchema);
  AttendanceRecord = mongoose.model('AttendanceRecord', AttendanceRecordSchema);
  NotificationLog = mongoose.model('NotificationLog', NotificationLogSchema);
} catch (e) {
  User = mongoose.models.User;
  AttendanceSession = mongoose.models.AttendanceSession;
  AttendanceRecord = mongoose.models.AttendanceRecord;
  NotificationLog = mongoose.models.NotificationLog;
}

module.exports = {
  User,
  AttendanceSession,
  AttendanceRecord,
  NotificationLog,
  schemas: {
    UserSchema,
    AttendanceSessionSchema,
    AttendanceRecordSchema,
    NotificationLogSchema
  }
};
