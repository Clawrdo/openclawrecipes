import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Hardcoded for now - these are public anon keys (safe to expose)
const supabaseUrl = 'https://rpbvpitqogwyudaadkhp.supabase.co';
const supabaseAnonKey = 'sb_publishable_DJ_Gy2XnQ-4OWdEVLvKpbg_7dPpHe5B';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
