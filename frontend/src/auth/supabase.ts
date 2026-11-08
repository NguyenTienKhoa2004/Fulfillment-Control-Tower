import { createClient } from '@supabase/supabase-js';

export const isMock = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API === 'true';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Do not create a client in mock mode or when configuration is missing.
export const supabase = !isMock && url && key ? createClient(url, key) : null;
