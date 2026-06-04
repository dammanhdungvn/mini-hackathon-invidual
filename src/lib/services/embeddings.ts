/**
 * Text Embedding Service
 *
 * Used to embed user interests for pgvector similarity search.
 * Provider is resolved via lib/ai/provider — never imported directly here.
 */

import { embed } from 'ai'
import { getEmbeddingModel } from '@/lib/ai/provider'

/** Embed a text string and return a numeric vector. */
export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: getEmbeddingModel(), value: text })
  return embedding
}

/** Embed user interests joined into a single string for pgvector matching. */
export async function embedInterests(interests: string[]): Promise<number[]> {
  return embedText(interests.join(', '))
}
