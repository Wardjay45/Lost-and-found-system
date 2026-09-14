// Run this script once to set up the admin password properly
// node server/setup-admin.js

import bcrypt from 'bcryptjs';
import supabase from './db.js';

async function setupAdmin() {
  try {
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('email', 'admin@lostandfound.edu')
      .select()
      .single();

    if (error) {
      console.error('Error updating admin password:', error);
      return;
    }

    console.log('✅ Admin account ready!');
    console.log('   Email: admin@lostandfound.edu');
    console.log('   Password: admin123');
    console.log('   Name:', data.name);
    console.log('   Role:', data.role);
  } catch (err) {
    console.error('Setup failed:', err);
  }
}

setupAdmin();