import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Add these to .env.local:
// NEXT_PUBLIC_SUPABASE_URL=your-project-url
// NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Create client (will use placeholders during build if env vars not set)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
