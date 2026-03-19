// ===== SUPABASE CONFIGURATION =====
// Make variables globally accessible
window.SUPABASE_URL = "https://tqrvcomujqktgrizmnfz.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxcnZjb211anFrdGdyaXptbmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNDUxMzQsImV4cCI6MjA4MTgyMTEzNH0.mjRWYDIaoHI3tRmJ31nVp3n68cIR2wcrvrk-6Iv3XNA";

// Table name for student grades
window.GRADES_TABLE = "student_grades";

// Validate Supabase configuration before creating client
if (typeof window.supabase === 'undefined') {
  console.error("Supabase library failed to load from CDN");
  window.supabaseClient = null;
} else if (window.SUPABASE_URL.includes("YOUR_") || window.SUPABASE_ANON_KEY.includes("YOUR_")) {
  console.warn("Supabase not configured - using placeholder values");
  window.supabaseClient = null;
} else {
  // Initialize Supabase client (avoid name conflict with global 'supabase' library)
  window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
}
