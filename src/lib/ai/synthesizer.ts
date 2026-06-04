/**
 * Stage 4 — Narrative Synthesizer
 *
 * Annotates a locked schedule with ai_tip per activity.
 * Provider is resolved via lib/ai/provider — never imported directly here.
 * The LLM CANNOT add, remove, or rename places — only annotate.
 */

import { generateObject } from 'ai'
import { z } from 'zod'
import { getSynthesisModel } from './provider'
import { NARRATIVE_SYNTHESIS_PROMPT } from './prompts'
import type { ScheduledItem } from '@/lib/types/trip'

const SynthesisResponseSchema = z.object({
  items: z.array(z.object({
    placeId: z.string(),
    aiTip:   z.string().max(300),
  })),
})

/**
 * Annotate a locked schedule with ai_tip for each activity.
 * The schedule structure is immutable — only ai_tip is populated.
 * Returns the same items with ai_tip filled in. Never fails hard.
 */
export async function synthesizeNarrative(
  lockedSchedule: ScheduledItem[]
): Promise<ScheduledItem[]> {
  if (lockedSchedule.length === 0) return []

  const compact = lockedSchedule.map(item => ({
    placeId:   item.placeId,
    placeName: item.placeName,
    category:  item.category,
    day:       item.dayNumber,
    time:      `${item.startTime}–${item.endTime}`,
  }))

  try {
    const { object } = await generateObject({
      model: getSynthesisModel(),
      schema: SynthesisResponseSchema,
      system: NARRATIVE_SYNTHESIS_PROMPT,
      prompt: `Write an engaging ai_tip for each activity:\n\n${JSON.stringify(compact, null, 2)}`,
    })

    const tipMap = new Map(object.items.map(i => [i.placeId, i.aiTip]))
    return lockedSchedule.map(item => ({ ...item, aiTip: tipMap.get(item.placeId) }))
  } catch (err) {
    // Synthesis is non-critical — return schedule without tips
    console.error('[synthesizer] Failed:', err)
    return lockedSchedule
  }
}
