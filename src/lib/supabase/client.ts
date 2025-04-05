import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'

// Define a function to create a Supabase client for client components
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase URL or Anon Key for client')
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}