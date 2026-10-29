import bcrypt from 'bcryptjs';

export const GENDER_OPTIONS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];

export function validateSignupFields(fields) {
  const data = {
    name: (fields.name || '').trim(),
    email: (fields.email || '').trim().toLowerCase(),
    password: fields.password || '',
    student_id: (fields.student_id || '').trim(),
    phone: (fields.phone || '').trim(),
    department: (fields.department || '').trim(),
    gender: (fields.gender || '').trim(),
  };
  if (!data.name || !data.email || !data.password || !data.student_id || !data.department) {
    return { error: 'Please fill in all required fields including Department.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.edu(?:\.ph)?$/.test(data.email)) {
    return { error: 'Please use a valid university email (e.g. .edu or .edu.ph).' };
  }
  if (data.password.length < 6) return { error: 'Password must be at least 6 characters.' };
  if (bcrypt.truncates(data.password)) return { error: 'Password is too long. Use at most 72 bytes.' };
  if (!GENDER_OPTIONS.includes(data.gender)) return { error: 'Please select your gender.' };
  if (data.phone && !/^\d{11}$/.test(data.phone)) return { error: 'Phone number must be exactly 11 digits.' };
  return { data };
}

export async function hashSignupPassword(password, getRandomBytesAsync) {
  // Supply a native secure salt: React Native has no Node crypto fallback.
  const bytes = await getRandomBytesAsync(16);
  if (!(bytes instanceof Uint8Array) || bytes.length !== 16) throw new Error('Secure password salt unavailable');
  const salt = '$2b$10$' + bcrypt.encodeBase64(bytes, bytes.length);
  return bcrypt.hash(password, salt);
}

export function signupErrorMessage(error) {
  if (/ExpoCrypto|expo-crypto|getRandomBytesAsync|Secure password salt unavailable|Native UUID/i.test(error?.message || '')) {
    return 'Please install the latest app build to create an account.';
  }
  if (error?.code === '23505') {
    return error.details?.includes('student_id')
      ? 'An account with this student ID already exists.'
      : 'An account with this email already exists. Please sign in.';
  }
  if (error?.code === '42501' || error?.status === 401 || error?.status === 403) {
    return 'Account creation is unavailable. Please contact the administrator.';
  }
  if (/network|fetch|connection|timeout/i.test(error?.message || '')) {
    return 'Unable to connect. Check your internet connection and try again.';
  }
  return 'Unable to create your account. Please try again or contact the administrator.';
}

export async function createAccount(client, fields, getRandomBytesAsync) {
  const validation = validateSignupFields(fields);
  if (validation.error) return validation;
  const { data } = validation;
  try {
    const { data: existing, error: lookupError } = await client
      .from('users').select('id').eq('email', data.email).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return { error: 'An account with this email already exists. Please sign in.' };
    const password = await hashSignupPassword(data.password, getRandomBytesAsync);
    // Signup returns to login; do not request a user row or change the session.
    const { error } = await client.from('users').insert({
      ...data, password, role: 'student', status: 'active',
      join_date: new Date().toISOString(), last_active: new Date().toISOString(),
    });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Signup error:', error);
    return { error: signupErrorMessage(error) };
  }
}
