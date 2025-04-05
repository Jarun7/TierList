'use client' // This component interacts with browser APIs (e.g., redirects)

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase/client' // Import client-side client creator
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

export default function AuthUIComponent() {
  const supabase = createClient() // Create client-side instance
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    // Check initial session state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for auth changes (login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    // Cleanup listener on component unmount
    return () => subscription.unsubscribe()
  }, [supabase])

  // Determine the redirect URL after login/signup
  // Ensure this matches the Supabase Auth settings (e.g., Site URL, Additional Redirect URLs)
  const redirectUri = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback';


  if (!session) {
    return (
      <div className="w-full max-w-md mx-auto mt-8 p-6 bg-white dark:bg-gray-800 rounded shadow">
         <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800 dark:text-gray-200">Login / Sign Up</h2>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="dark" // Or "light" or remove for default based on system
          providers={['google', 'github']} // Add providers as configured in Supabase
          redirectTo={redirectUri}
          // onlyThirdPartyProviders // Uncomment if you only want social logins
        />
      </div>
    )
  }

  // If session exists, render nothing or a logout button, etc.
  // The parent component will likely handle showing the main app content.
  return null; // Or <button onClick={() => supabase.auth.signOut()}>Logout</button>
}