// POST /api/ai/chat — streaming conversational AI
// Provider is resolved via lib/ai/provider — never imported directly here.

import { streamText } from 'ai'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getChatModel } from '@/lib/ai/provider'
import { CHAT_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { z } from 'zod'

const RequestSchema = z.object({
  messages: z.array(z.object({
    role:    z.enum(['user', 'assistant']),
    content: z.string(),
  })).min(1),
})

export async function POST(request: Request) {
  // Auth check
  const supabase = createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return Response.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'messages array required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const result = streamText({
    model:    getChatModel(),
    system:   CHAT_SYSTEM_PROMPT,
    messages: parsed.data.messages,
  })

  return result.toTextStreamResponse()
}
