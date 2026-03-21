import { describe, it, expect } from 'vitest'
import { validateEvent, parseCalendarEvents, MAX_EVENTS } from './validate-calendar-events'

describe('validateEvent', () => {
  const validInput = {
    title: 'Meeting',
    start: '2026-03-21T10:00:00Z',
    end:   '2026-03-21T11:00:00Z',
  }

  it('accepts a valid event with required fields', () => {
    const result = validateEvent(validInput)
    expect(result).toEqual(validInput)
  })

  it('accepts optional location and description', () => {
    const input = { ...validInput, location: 'Room 1', description: 'Weekly sync' }
    const result = validateEvent(input)
    expect(result).toEqual(input)
  })

  it('rejects null', () => {
    expect(validateEvent(null)).toBeNull()
  })

  it('rejects undefined', () => {
    expect(validateEvent(undefined)).toBeNull()
  })

  it('rejects a string', () => {
    expect(validateEvent('not an object')).toBeNull()
  })

  it('rejects a number', () => {
    expect(validateEvent(42)).toBeNull()
  })

  it('rejects missing title', () => {
    expect(validateEvent({ start: validInput.start, end: validInput.end })).toBeNull()
  })

  it('rejects empty title', () => {
    expect(validateEvent({ ...validInput, title: '' })).toBeNull()
  })

  it('rejects non-string title', () => {
    expect(validateEvent({ ...validInput, title: 123 })).toBeNull()
  })

  it('rejects missing start', () => {
    expect(validateEvent({ title: 'Meeting', end: validInput.end })).toBeNull()
  })

  it('rejects missing end', () => {
    expect(validateEvent({ title: 'Meeting', start: validInput.start })).toBeNull()
  })

  it('rejects invalid start date', () => {
    expect(validateEvent({ ...validInput, start: 'not-a-date' })).toBeNull()
  })

  it('rejects invalid end date', () => {
    expect(validateEvent({ ...validInput, end: 'garbage' })).toBeNull()
  })

  it('ignores non-string location', () => {
    const result = validateEvent({ ...validInput, location: 42 })
    expect(result).toBeDefined()
    expect(result!.location).toBeUndefined()
  })

  it('ignores empty location', () => {
    const result = validateEvent({ ...validInput, location: '' })
    expect(result).toBeDefined()
    expect(result!.location).toBeUndefined()
  })

  it('ignores non-string description', () => {
    const result = validateEvent({ ...validInput, description: { nested: true } })
    expect(result).toBeDefined()
    expect(result!.description).toBeUndefined()
  })
})

describe('parseCalendarEvents', () => {
  const validEvent = {
    title: 'Meeting',
    start: '2026-03-21T10:00:00Z',
    end:   '2026-03-21T11:00:00Z',
  }

  it('parses valid JSON with events', () => {
    const json = JSON.stringify({ events: [validEvent] })
    const result = parseCalendarEvents(json)
    expect(result).not.toBeNull()
    expect(result!.tooMany).toBeFalsy()
    expect(result!.events).toHaveLength(1)
    expect(result!.events[0].title).toBe('Meeting')
  })

  it('returns null for invalid JSON', () => {
    expect(parseCalendarEvents('not json')).toBeNull()
  })

  it('returns null for JSON without events key', () => {
    expect(parseCalendarEvents('{"data": []}')).toBeNull()
  })

  it('returns null for non-array events', () => {
    expect(parseCalendarEvents('{"events": "not an array"}')).toBeNull()
  })

  it('returns null for JSON null', () => {
    expect(parseCalendarEvents('null')).toBeNull()
  })

  it('returns null if all events are invalid', () => {
    const json = JSON.stringify({ events: [{ bad: true }, null, 42] })
    expect(parseCalendarEvents(json)).toBeNull()
  })

  it('filters out invalid events and keeps valid ones', () => {
    const json = JSON.stringify({ events: [validEvent, { bad: true }, validEvent] })
    const result = parseCalendarEvents(json)
    expect(result).not.toBeNull()
    expect(result!.events).toHaveLength(2)
  })

  it('returns tooMany when events exceed MAX_EVENTS', () => {
    const events = Array.from({ length: MAX_EVENTS + 1 }, () => validEvent)
    const json = JSON.stringify({ events })
    const result = parseCalendarEvents(json)
    expect(result).not.toBeNull()
    expect(result!.tooMany).toBe(true)
    if (result!.tooMany) {
      expect(result!.count).toBe(MAX_EVENTS + 1)
      expect(result!.events).toHaveLength(0)
    }
  })

  it('accepts exactly MAX_EVENTS events', () => {
    const events = Array.from({ length: MAX_EVENTS }, () => validEvent)
    const json = JSON.stringify({ events })
    const result = parseCalendarEvents(json)
    expect(result).not.toBeNull()
    expect(result!.tooMany).toBeFalsy()
    expect(result!.events).toHaveLength(MAX_EVENTS)
  })
})
