import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

// Ensure environment variables are defined
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key')
}

// Create a single supabase client instance for server-side use (e.g., API routes)
// Note: For client components or server components needing user auth context,
// you might need different initialization using @supabase/ssr helpers.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)