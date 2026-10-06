import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tqrvcomujqktgrizmnfz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxcnZjb211anFrdGdyaXptbmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNDUxMzQsImV4cCI6MjA4MTgyMTEzNH0.mjRWYDIaoHI3tRmJ31nVp3n68cIR2wcrvrk-6Iv3XNA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
