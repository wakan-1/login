// Supabase Configuration
const SUPABASE_URL = 'https://kenjxushkrzmwtswxcxi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtlbmp4dXNoa3J6bXd0c3d4Y3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNDk5NzcsImV4cCI6MjA3NDcyNTk3N30.dPSruivrj1IVheIYTfTw3Ef07JIuw7l3leLx_POwoCM';

// Office Location Configuration (Riyadh coordinates as default)
const OFFICE_LOCATION = {
    latitude: 24.429328,
    longitude: 39.653926,
    radius: 50, // meters - نطاق أصغر للدقة
    name: 'المكتب الرئيسي'
};

// Initialize Supabase client
let supabase = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (window.supabase && window.supabase.createClient) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false
            }
        });
        console.log('تم تحميل Supabase بنجاح');
    } else {
        console.error('فشل في تحميل مكتبة Supabase');
    }
});
