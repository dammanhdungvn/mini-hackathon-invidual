import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NewTripForm } from '@/components/plan/NewTripForm'

export default async function NewTripPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-8 max-w-3xl mx-auto min-h-[calc(100vh-64px)] flex flex-col justify-center">
      <div className="mb-8 text-center max-w-xl mx-auto">
        <h1 className="text-4xl font-extrabold text-primary tracking-tight mb-2 bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
          Plan Your Next Adventure
        </h1>
        <p className="text-secondary">
          Enter a prompt or select a quick starter template below to generate a highly optimized travel plan in seconds.
        </p>
      </div>
      
      <div className="glass p-8 rounded-3xl border border-border">
        <NewTripForm />
      </div>
    </div>
  )
}
