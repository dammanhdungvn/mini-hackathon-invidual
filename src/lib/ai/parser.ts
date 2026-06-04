/**
 * Stage 1 — Intent Parser
 *
 * Extracts structured TravelIntent from a user message.
 * Provider is resolved via lib/ai/provider — never imported directly here.
 * All LLM output is Zod-validated before returning.
 */

import { generateObject } from 'ai'
import { z } from 'zod'
import { getParserModel } from './provider'
import { INTENT_PARSE_PROMPT } from './prompts'
import type { TravelIntent } from '@/lib/types/trip'

const TravelIntentSchema = z.object({
  destination:      z.string().min(1),
  cityCode:         z.string().optional(),
  startDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationDays:     z.number().int().min(1).max(30),
  adults:           z.number().int().min(1).max(10).default(1),
  budgetTier:       z.enum(['budget', 'mid-range', 'luxury']).default('mid-range'),
  travelPace:       z.enum(['slow', 'moderate', 'fast']).default('moderate'),
  interests:        z.array(z.string()).min(1).max(10).default(['sightseeing']),
  avoidCategories:  z.array(z.string()).default([]),
  mustVisit:        z.array(z.string()).default([]),
})

/**
 * Parse a raw user message into a structured TravelIntent.
 * Retries once on validation failure. Throws on second failure.
 */
export async function parseTravelIntent(userMessage: string): Promise<TravelIntent> {
  const today = new Date().toISOString().split('T')[0]
  const prompt = `Today's date: ${today}\n\nUser message: "${userMessage}"`

  try {
    const { object } = await generateObject({
      model: getParserModel(),
      schema: TravelIntentSchema,
      system: INTENT_PARSE_PROMPT,
      prompt,
    })
    return object as TravelIntent
  } catch {
    // Retry once with a clarification hint
    const { object } = await generateObject({
      model: getParserModel(),
      schema: TravelIntentSchema,
      system: INTENT_PARSE_PROMPT,
      prompt: `${prompt}\n\nEnsure all dates are YYYY-MM-DD format.`,
    })
    return object as TravelIntent
  }
}
