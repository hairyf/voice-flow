import { describe, expect, it } from 'vitest'
import { createVoice } from '../src/index'

describe('package smoke', () => {
  it('exports createVoice', () => {
    expect(typeof createVoice).toBe('function')
  })
})
