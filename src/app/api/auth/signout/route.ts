// Sign-out API route.
// Required: Sidebar form posts here. Without this, sign-out is broken.

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()

  const response = NextResponse.redirect(
    new URL('/login', process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:3000')
  )
  // Clear auth cookies
  response.cookies.delete('sb-access-token')
  response.cookies.delete('sb-refresh-token')

  return NextResponse.redirect('/login', { status: 302 })
}
