// Supabase Configuration
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';

// Office Location Configuration (Riyadh coordinates as default)
const OFFICE_LOCATION = {
    latitude: 24.7136,
    longitude: 46.6753,
    radius: 50, // meters
    name: 'المكتب الرئيسي'
};

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);