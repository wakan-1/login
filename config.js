// Supabase Configuration
// سيتم تحديث هذه القيم تلقائياً عند ربط Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Office Location Configuration (Riyadh coordinates as default)
const OFFICE_LOCATION = {
    latitude: 24.429328,
    longitude: 39.653926,
    radius: 50, // meters - نطاق أصغر للدقة
    name: 'المكتب الرئيسي'
};

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
    }
});
