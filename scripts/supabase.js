// scripts/supabase.js
const SUPABASE_URL = "https://kbxlukbvhlxponcentyp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtieGx1a2J2aGx4cG9uY2VudHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjkzNDcsImV4cCI6MjA3MTM0NTM0N30.5MaOYEUaE4VPQHhDPW1MiJTYUsEQ4mR03Efri-iUHk4";

export const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
