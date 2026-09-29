// Direct Supabase client for mobile app
// This connects directly to Supabase cloud — works on any network
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vrivphwriqyngotyeiih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyaXZwaHdyaXF5bmdvdHllaWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDU4OTgsImV4cCI6MjA5ODk4MTg5OH0.njWhuaz7np2ocMTFfWIkjn3QOOUCk9QXvetsDZjQXiA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
