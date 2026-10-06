// js/supabaseClient.js
const SUPABASE_URL = "https://ouytchaokxqaajbtzuoh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KRpxfBt-LHVYinugaJZZHA_Nf6bMrCB";

// window par bind karein taaki har file isko access kar sake
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
