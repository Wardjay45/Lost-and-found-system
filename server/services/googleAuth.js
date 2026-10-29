import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const profileColumns = 'id,name,email,role,status,student_id,department,phone,avatar,gender,google_subject';
const genders = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

export function createGoogleAuthService({ client, verifyIdToken, clientId, jwtSecret, allowedDomains = ['dnsc.edu.ph'] }) {
  const domains = allowedDomains.map(domain => domain.trim().toLowerCase()).filter(Boolean);

  async function verifyIdentity(idToken) {
    if (!client || !clientId || !jwtSecret || !domains.length) {
      fail(503, 'School Google sign-in is not configured. Please contact the administrator.');
    }
    if (typeof idToken !== 'string' || !idToken || idToken.length > 12000) {
      fail(401, 'Continue with Google to verify your school account.');
    }
    let identity;
    try {
      const ticket = await verifyIdToken({ idToken, audience: clientId });
      identity = ticket.getPayload();
    } catch {
      fail(401, 'Google verification expired or failed. Please continue with Google again.');
    }
    const email = typeof identity?.email === 'string' ? identity.email.trim().toLowerCase() : '';
    const domain = email.split('@');
    if (!identity?.sub || identity.email_verified !== true || domain.length !== 2 || !domain[0] ||
      !domains.includes(domain[1]) || identity.hd?.toLowerCase() !== domain[1]) {
      fail(403, `Use your school Google account (${domains.map(value => '@' + value).join(', ')}). Personal and other school accounts cannot register.`);
    }
    return { email, subject: identity.sub, name: identity.name || '' };
  }

  async function findProfile(email) {
    const { data, error } = await client.from('users').select(profileColumns).eq('email', email).maybeSingle();
    if (error) fail(503, 'Unable to check your school profile. Please contact the administrator.');
    return data;
  }

  function session(profile) {
    const user = Object.fromEntries(Object.entries(profile).filter(([key]) => !['password', 'google_subject'].includes(key)));
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name, auth_method: 'google', google_subject: profile.google_subject }, jwtSecret, { expiresIn: '7d' });
    return { token, user };
  }

  async function continueWithGoogle(fields) {
    const identity = await verifyIdentity(fields?.google_id_token);
    const profile = await findProfile(identity.email);
    if (!profile) return { registrationRequired: true, email: identity.email, name: identity.name };
    if (profile.role !== 'student' || profile.status !== 'active') {
      fail(403, 'This account cannot sign in. Please contact the administrator.');
    }
    if (profile.google_subject !== identity.subject) {
      fail(409, 'An account with this email already exists. Sign in with your existing password; contact the administrator to link Google.');
    }
    return session(profile);
  }

  async function completeSignup(fields) {
    const identity = await verifyIdentity(fields?.google_id_token);
    const text = value => typeof value === 'string' ? value.trim() : '';
    const data = {
      name: text(fields.name), student_id: text(fields.student_id), department: text(fields.department),
      phone: text(fields.phone), gender: text(fields.gender),
    };
    if (!data.name || !data.student_id || !data.department || !genders.includes(data.gender)) {
      fail(400, 'Enter your full name, student ID, department, and gender.');
    }
    if (data.name.length > 150 || data.student_id.length > 100 || data.department.length > 100) {
      fail(400, 'Your name, student ID, or department is too long.');
    }
    if (typeof fields.password !== 'string' || fields.password.length < 6 || Buffer.byteLength(fields.password, 'utf8') > 72) {
      fail(400, 'Password must contain at least 6 characters and at most 72 bytes.');
    }
    if (data.phone && !/^\d{11}$/.test(data.phone)) fail(400, 'Phone number must be exactly 11 digits.');
    if (await findProfile(identity.email)) fail(409, 'An account with this email already exists. Please sign in.');
    const password = await bcrypt.hash(fields.password, 10);
    const { data: profile, error } = await client.from('users').insert({
      ...data, email: identity.email, google_subject: identity.subject, password,
      role: 'student', status: 'active', join_date: new Date().toISOString(), last_active: new Date().toISOString(),
    }).select(profileColumns).single();
    if (error?.code === '23505') fail(409, 'An account with this email, Google account, or student ID already exists. Please sign in.');
    if (error || !profile) fail(503, 'Unable to create your school profile. Please contact the administrator.');
    return session(profile);
  }

  return { continueWithGoogle, completeSignup };
}
