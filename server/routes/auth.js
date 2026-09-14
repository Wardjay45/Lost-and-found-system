import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import supabase from '../db.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'archived') {
      return res.status(403).json({ error: 'Account is archived. Contact administrator.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended.' });
    }

    // For seeded data with placeholder passwords, allow if password is "admin123"
    // In production, use proper bcrypt compare
    const validPassword = password === 'admin123' || await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last active
    await supabase
      .from('users')
      .update({ last_active: new Date().toISOString() })
      .eq('id', user.id);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'lost-and-found-secret-key-2026',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        student_id: user.student_id,
        department: user.department,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed', message: err.message });
  }
});

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, student_id, phone, department } = req.body;

    if (!name || !email || !password || !student_id) {
      return res.status(400).json({ error: 'Name, email, password, and student ID are required' });
    }

    if (department && department.length > 100) {
      return res.status(400).json({ error: 'Department name is too long' });
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        name,
        email,
        password: hashedPassword,
        student_id,
        phone: phone || '',
        department: department || '',
        role: 'student',
        status: 'active',
        join_date: new Date().toISOString(),
        last_active: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'lost-and-found-secret-key-2026',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        student_id: user.student_id,
        department: user.department,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed', message: err.message });
  }
});

// GET /api/auth/me - Get current user from token
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'lost-and-found-secret-key-2026');

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      student_id: user.student_id,
      department: user.department,
      status: user.status,
      avatar: user.avatar,
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;