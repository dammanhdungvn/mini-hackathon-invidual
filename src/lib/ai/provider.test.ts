import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getParserModel } from './provider'

describe('AI Provider strict validation', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    // Clone process.env to restore it later
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('throws an error for an invalid AI_PROVIDER value', () => {
    process.env.AI_PROVIDER = 'invalid-provider'
    expect(() => getParserModel()).toThrowError(/Invalid AI_PROVIDER/)
  })

  it('throws an error if gemini is selected but GOOGLE_GENERATIVE_AI_API_KEY is missing', () => {
    process.env.AI_PROVIDER = 'gemini'
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    expect(() => getParserModel()).toThrowError(/Missing required environment variable GOOGLE_GENERATIVE_AI_API_KEY/)
  })

  it('throws an error if openai is selected but OPENAI_API_KEY is missing', () => {
    process.env.AI_PROVIDER = 'openai'
    delete process.env.OPENAI_API_KEY
    expect(() => getParserModel()).toThrowError(/Missing required environment variable OPENAI_API_KEY/)
  })

  it('throws an error if qwen is selected but QWEN_API_KEY is missing', () => {
    process.env.AI_PROVIDER = 'qwen'
    delete process.env.QWEN_API_KEY
    expect(() => getParserModel()).toThrowError(/Missing required environment variable QWEN_API_KEY/)
  })

  it('returns a model instance when config is valid for gemini', () => {
    process.env.AI_PROVIDER = 'gemini'
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'mock-key'
    const model = getParserModel()
    expect(model).toBeDefined()
  })
})
