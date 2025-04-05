import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
// Use the server client creator that accepts the cookie store
import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    // const cookieStore = cookies() // No longer needed to pass explicitly
    const supabase = createClient() // Call with 0 arguments, relies on middleware context

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth Callback Error:', error.message)
      // Handle error, maybe redirect to an error page or login page with error message
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`) // Redirect to a login page or home with error
    }
  } else {
     console.warn('Auth Callback: No code found in URL.')
     // Handle case where no code is present, maybe redirect to login
     return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  // Redirect user back to the home page after successful login/exchange
  return NextResponse.redirect(origin)
}