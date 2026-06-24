import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://inmdoaxzomujtsstnifg.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWRvYXh6b211anRzc3RuaWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTM4OTgsImV4cCI6MjA4NzY2OTg5OH0.mhXwsNsqxEk_liJMUkIm3kn7FfikS0aIZZ8kAY_v04o';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
