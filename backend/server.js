/**
 * GEC Bidar Attendance Management System - Standalone Backend Server
 * Runs on: http://localhost:5000
 * Framework: Express.js, MongoDB (Mongoose), JWT, Bcrypt, WebAuthn, Helmet, CORS, Rate Limit
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const authModule = require('./auth');
const biometricModule = require('./biometric');
const attendanceModule = require('./attendance');
const { User } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gec_attendance';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// 1. Security & Middleware
app.use(helmet());
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { message: 'Too many requests from this IP address, please try again in 15 minutes.' }
});
app.use('/api/', limiter);

// 2. Route Mounts
app.use('/api/auth', authModule.router);
app.use('/api/biometric', biometricModule.router);
app.use('/api/attendance', attendanceModule.router);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    college: 'Government Engineering College, Bidar',
    module: 'Attendance Management System',
    timestamp: new Date().toISOString()
  });
});

// Seed default users if collection is empty
async function seedDefaultUsers() {
  try {
    const count = await User.countDocuments();
    if (count === 0) {
      console.log('[Database] Seeding initial student and faculty accounts...');
      const studentPwd = await bcrypt.hash('Student@123', 10);
      const facultyPwd = await bcrypt.hash('Faculty@123', 10);

      await User.create([
        {
          name: 'Aseem Muzakir',
          identifier: '3DG24AD406',
          email: '3dg24ad406@gecbidar.ac.in',
          role: 'student',
          department: 'Artificial Intelligence & Data Science',
          semester: 5,
          passwordHash: studentPwd,
          parentName: 'Muzakir',
          parentContact: '919845012345',
          biometricCredentials: []
        },
        {
          name: 'Dr. Sunita Kulkarni',
          identifier: 'FAC-118',
          email: 'sunita.k@gecbidar.ac.in',
          role: 'faculty',
          department: 'Artificial Intelligence & Data Science',
          designation: 'Associate Professor & HOD',
          passwordHash: facultyPwd,
          biometricCredentials: []
        },
        {
          name: 'Chetan Kulkarni',
          identifier: '3DG24AD403',
          email: '3dg24ad403@gecbidar.ac.in',
          role: 'student',
          department: 'Artificial Intelligence & Data Science',
          semester: 5,
          passwordHash: studentPwd,
          parentName: 'R. Kulkarni',
          parentContact: '919845111003',
          biometricCredentials: []
        }
      ]);
      console.log('[Database] Seeded student (3DG24AD406) and faculty (FAC-118).');
    }
  } catch (err) {
    console.warn('[Database] Seed check warning:', err.message);
  }
}

// 3. Connect to Database & Start Server
async function startServer() {
  try {
    console.log(`[Database] Connecting to MongoDB: ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('[Database] Connected successfully to MongoDB.');
    await seedDefaultUsers();
  } catch (err) {
    console.warn('[Database] MongoDB connection was not established (or not running locally).');
    console.warn('[Database] The server will still serve APIs. Ensure MongoDB is running on port 27017 for persistent storage.');
  }

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`GEC BIDAR ATTENDANCE MANAGEMENT BACKEND`);
    console.log(`Server running on: http://localhost:${PORT}`);
    console.log(`API base route:    http://localhost:${PORT}/api`);
    console.log(`CORS allowed for:  ${FRONTEND_URL}`);
    console.log(`====================================================`);
  });
}

startServer();
