 import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers' // Import cookies from next/headers
import { Database } from '@/types/database.types'

// Define a function to create a Supabase client for server components, routes, actions
// Assumes middleware is handling session refresh and cookie management primarily.
export function createClient() {
  const cookieStore = cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase URL or Anon Key for server')
  }

  // Use createServerClient, providing the cookie methods implementation
  // This ensures it works correctly even if called directly from Server Components/Actions
  // where middleware might not have run or context is different.
  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        async get(name: string) {
          // Await cookieStore if TS thinks it's a promise
          // Note: This might not be necessary if cookies() is truly sync here.
          // Keeping original optional chaining as get might return undefined.
          return (await cookieStore).get(name)?.value
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
             // Await cookieStore if TS thinks it's a promise
            (await cookieStore).set({ name, value, ...options })
          } catch {
            // Ignore errors in read-only contexts like Server Components
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
             // Await cookieStore if TS thinks it's a promise
            (await cookieStore).set({ name, value: '', ...options })
          } catch {
             // Ignore errors in read-only contexts
          }
        },
      },
    }
  )
}