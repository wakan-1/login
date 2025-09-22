// Supabase Configuration
const SUPABASE_URL = 'https://fvghcnuaxgrxuyjfbufh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2Z2hjbnVheGdyeHV5amZidWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNTQxMjQsImV4cCI6MjA3MzkzMDEyNH0.fHLlEpX2CzoKX8jTo_Ue85C1yxuaTf5atumepjrp4-0';

// Office Location Configuration (Riyadh coordinates as default)
const OFFICE_LOCATION = {
    latitude: 24.429328,
    longitude: 39.653926,
    radius: 250, // meters
    name: 'المكتب الرئيسي'
};

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
