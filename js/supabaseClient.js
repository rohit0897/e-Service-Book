const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co"; // Yahan Data API se copy kiya URL paste karein
const SUPABASE_ANON_KEY = "eyJh...";                       // Yahan API Keys se copy ki hui key paste karein

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);