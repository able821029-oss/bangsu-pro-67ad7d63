import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://stnpepxiysfoblfeqvpu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0bnBlcHhpeXNmb2JsZmVxdnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTQwMTAsImV4cCI6MjA5MTIzMDAxMH0.ipYiFOAbS1XQ1hpTa_kghsdUFDWv8P-OhzIPtSQW1qA";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
