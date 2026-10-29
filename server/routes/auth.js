import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import supabase from '../db.js';

export function createAuthRouter({ client = supabase, jwtSecret = () => process.env.JWT_SECRET } = {}) {
const router = Router();
const secretForRequest = () => typeof jwtSecret === 'function' ? jwtSecret() : jwtSecret;

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    if (!secretForRequest()) return res.status(503).json({ error: 'Server sessions are not configured.' });
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: user, error } = await client
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

    // Use the account's actual password; no universal development password.
    const validPassword = await bcrypt.compare(password, user.password || '');
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last active
    await client
      .from('users')
      .update({ last_active: new Date().toISOString() })
      .eq('id', user.id);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      secretForRequest(),
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
        phone: user.phone,
        gender: user.gender,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed', message: err.message });
  }
});

// GET /api/auth/me - Get current user from token
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, secretForRequest(), { algorithms: ['HS256'] });

    const { data: user, error } = await client
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

return router;
}
export default createAuthRouter();
