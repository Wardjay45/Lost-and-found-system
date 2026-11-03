import { initApiUrl } from './api';
import { createAuthenticatedDataFetch } from '../services/dataSession.mjs';
// Keep the existing query API, but send table operations through the authenticated server.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vrivphwriqyngotyeiih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyaXZwaHdyaXF5bmdvdHllaWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDU4OTgsImV4cCI6MjA5ODk4MTg5OH0.njWhuaz7np2ocMTFfWIkjn3QOOUCk9QXvetsDZjQXiA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { fetch: createAuthenticatedDataFetch({ getApiUrl: initApiUrl }) } });

export default supabase;
