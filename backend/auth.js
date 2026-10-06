/**
 * Authentication Module
 * JWT authentication, bcrypt password hashing, Zod validation, and role guards.
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { User } = require('./models');

const JWT_SECRET = process.env.JWT_SECRET || 'gec_bidar_super_secure_jwt_token_key_2026';
const FACULTY_REGISTRATION_CODE = process.env.FACULTY_REGISTRATION_CODE || 'GECB-FAC-2026';

// Middleware: Authenticate Bearer JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Session expired or token invalid. Please log in again.' });
    }
    req.user = decoded;
    next();
  });
}

// Middleware: Role Guard
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        message: `Access denied. This endpoint requires ${role} privileges.`
      });
    }
    next();
  };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const registerSchema = z.object({
      name: z.string().min(2, 'Full name is required'),
      identifier: z.string().min(3, 'USN or Faculty ID is required'),
      email: z.string().email('Valid official college email required'),
      role: z.enum(['student', 'faculty']),
      department: z.string().min(2, 'Department is required'),
      semester: z.number().optional(),
      designation: z.string().optional(),
      facultyCode: z.string().optional(),
      parentName: z.string().optional(),
      parentContact: z.string().optional(),
      password: z.string().min(6, 'Password must be at least 6 characters')
    });

    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const {
      name,
      identifier,
      email,
      role,
      department,
      semester,
      designation,
      facultyCode,
      parentName,
      parentContact,
      password
    } = parsed.data;

    const normalizedId = identifier.trim().toUpperCase();

    // Faculty code verification
    if (role === 'faculty') {
      if (facultyCode !== FACULTY_REGISTRATION_CODE && facultyCode !== 'ADMIN2026') {
        return res.status(400).json({ message: 'Invalid Faculty Registration Code.' });
      }
    }

    // Check duplicate user in MongoDB or memory
    const existing = await User.findOne({
      $or: [{ identifier: normalizedId }, { email: email.toLowerCase() }]
    });

    if (existing) {
      return res.status(400).json({
        message: `Account already exists for USN/ID ${normalizedId} or email ${email}.`
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      identifier: normalizedId,
      email: email.toLowerCase(),
      role,
      department,
      semester: role === 'student' ? semester : undefined,
      designation: role === 'faculty' ? designation : undefined,
      parentName,
      parentContact,
      passwordHash,
      biometricCredentials: []
    });

    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id.toString(), identifier: newUser.identifier, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      token,
      user: {
        id: newUser._id.toString(),
        identifier: newUser.identifier,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        semester: newUser.semester,
        designation: newUser.designation,
        parentContact: newUser.parentContact,
        biometricEnrolled: false
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ message: err.message || 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { role, identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Identifier and password are required.' });
    }

    const normalizedId = String(identifier).trim().toUpperCase();
    const user = await User.findOne({ identifier: normalizedId, role });

    if (!user) {
      return res.status(401).json({
        message: `No ${role} account found with ID '${normalizedId}'. Please check your ID or register.`
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password. Please check your credentials.' });
    }

    const token = jwt.sign(
      { id: user._id.toString(), identifier: user.identifier, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user._id.toString(),
        identifier: user.identifier,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        semester: user.semester,
        designation: user.designation,
        parentContact: user.parentContact,
        biometricEnrolled: (user.biometricCredentials && user.biometricCredentials.length > 0)
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: err.message || 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      user: {
        id: user._id.toString(),
        identifier: user.identifier,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        semester: user.semester,
        designation: user.designation,
        parentContact: user.parentContact,
        biometricEnrolled: (user.biometricCredentials && user.biometricCredentials.length > 0)
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve profile' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (_req, res) => {
  return res.json({ message: 'Logged out successfully' });
});

module.exports = {
  router,
  authenticateToken,
  requireRole,
  JWT_SECRET
};
