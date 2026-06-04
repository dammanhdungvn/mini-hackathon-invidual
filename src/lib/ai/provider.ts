/**
 * AI Provider Abstraction Layer
 *
 * This is the ONLY file that imports from a specific AI SDK provider.
 * All other code must import from this module — never from @ai-sdk/google,
 * @ai-sdk/openai, or any other provider package directly.
 *
 * Provider/model selection is controlled entirely by environment variables:
 *
 *   AI_PROVIDER=gemini        # 'gemini' (default) | 'openai' | 'qwen'
 *   GEMINI_PRO_MODEL=gemini-2.5-pro-preview-05-06
 *   GEMINI_FLASH_MODEL=gemini-2.5-flash-preview-05-20
 *   GEMINI_EMBEDDING_MODEL=text-embedding-004
 *
 * To switch providers: update AI_PROVIDER in .env.local.
 * No business logic files need to change.
 *
 * @module lib/ai/provider
 */

import type { LanguageModel, EmbeddingModel } from 'ai'

// ─── Supported providers ─────────────────────────────────────────────────────

type SupportedProvider = 'gemini' | 'openai' | 'qwen'

function getProvider(): SupportedProvider {
  const p = (process.env.AI_PROVIDER ?? 'gemini').toLowerCase()
  if (p === 'openai' || p === 'qwen' || p === 'gemini') return p
  console.warn(`[ai/provider] Unknown AI_PROVIDER "${p}" — falling back to "gemini"`)
  return 'gemini'
}

// ─── Model factory ────────────────────────────────────────────────────────────

/**
 * Returns the language model to use for intent parsing (high-quality/Pro tier).
 * Controlled by: AI_PROVIDER + GEMINI_PRO_MODEL (or equivalent).
 */
export function getParserModel(): LanguageModel {
  const provider = getProvider()
  if (provider === 'gemini') {
    // Lazy import — only the active provider bundle is loaded
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { google } = require('@ai-sdk/google')
    return google(process.env.GEMINI_PRO_MODEL ?? 'gemini-2.5-pro-preview-05-06')
  }
  if (provider === 'openai') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { openai } = require('@ai-sdk/openai')
    return openai(process.env.OPENAI_PRO_MODEL ?? 'gpt-4o')
  }
  if (provider === 'qwen') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createOpenAI } = require('@ai-sdk/openai')
    const qwen = createOpenAI({
      apiKey: process.env.QWEN_API_KEY ?? '',
      baseURL: process.env.QWEN_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    })
    return qwen(process.env.QWEN_MODEL ?? 'qwen3.5-flash')
  }
  throw new Error(`[ai/provider] Unhandled provider: ${provider}`)
}

/**
 * Returns the language model to use for narrative synthesis (fast/Flash tier).
 * Controlled by: AI_PROVIDER + GEMINI_FLASH_MODEL (or equivalent).
 */
export function getSynthesisModel(): LanguageModel {
  const provider = getProvider()
  if (provider === 'gemini') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { google } = require('@ai-sdk/google')
    return google(process.env.GEMINI_FLASH_MODEL ?? 'gemini-2.5-flash-preview-05-20')
  }
  if (provider === 'openai') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { openai } = require('@ai-sdk/openai')
    return openai(process.env.OPENAI_FLASH_MODEL ?? 'gpt-4o-mini')
  }
  if (provider === 'qwen') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createOpenAI } = require('@ai-sdk/openai')
    const qwen = createOpenAI({
      apiKey: process.env.QWEN_API_KEY ?? '',
      baseURL: process.env.QWEN_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    })
    return qwen(process.env.QWEN_FLASH_MODEL ?? 'qwen-turbo')
  }
  throw new Error(`[ai/provider] Unhandled provider: ${provider}`)
}

/**
 * Returns the language model to use for streaming chat.
 * Uses the synthesis (fast) model tier — lower cost for interactive chat.
 */
export function getChatModel(): LanguageModel {
  return getSynthesisModel()
}

/**
 * Returns the embedding model for pgvector similarity search.
 * NOTE: Not all providers support text embeddings.
 * Controlled by: AI_PROVIDER + GEMINI_EMBEDDING_MODEL (or equivalent).
 */
export function getEmbeddingModel(): EmbeddingModel {
  const provider = getProvider()
  if (provider === 'gemini') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { google } = require('@ai-sdk/google')
    return google.textEmbeddingModel(
      process.env.GEMINI_EMBEDDING_MODEL ?? 'text-embedding-004'
    )
  }
  if (provider === 'openai') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { openai } = require('@ai-sdk/openai')
    return openai.embedding(process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small')
  }
  if (provider === 'qwen') {
    // Qwen embedding via OpenAI-compatible endpoint
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createOpenAI } = require('@ai-sdk/openai')
    const qwen = createOpenAI({
      apiKey: process.env.QWEN_API_KEY ?? '',
      baseURL: process.env.QWEN_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    })
    return qwen.embedding(process.env.QWEN_EMBEDDING_MODEL ?? 'text-embedding-v3')
  }
  throw new Error(`[ai/provider] Unhandled provider for embeddings: ${provider}`)
}
