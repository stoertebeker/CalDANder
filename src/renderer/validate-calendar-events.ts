/** Maximum number of events to render from a single JSON block */
export const MAX_EVENTS = 100

export interface CalendarEvent {
  title:        string
  start:        string
  end:          string
  location?:    string
  description?: string
}

/** Validate and sanitise a single calendar event object. Returns null if invalid. */
export function validateEvent(raw: unknown): CalendarEvent | null {
  if (raw == null || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  if (typeof obj.title !== 'string' || obj.title.length === 0) return null

  if (typeof obj.start !== 'string' || typeof obj.end !== 'string') return null
  const start = new Date(obj.start)
  const end   = new Date(obj.end)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null

  const ev: CalendarEvent = {
    title: obj.title,
    start: obj.start,
    end:   obj.end,
  }
  if (typeof obj.location    === 'string' && obj.location.length    > 0) ev.location    = obj.location
  if (typeof obj.description === 'string' && obj.description.length > 0) ev.description = obj.description
  return ev
}

/**
 * Parse and validate calendar events from a JSON string.
 * Returns validated events array, or null if the JSON is not a valid events structure.
 * Throws an error string if the events array exceeds MAX_EVENTS.
 */
export function parseCalendarEvents(json: string): { events: CalendarEvent[]; tooMany?: false } | { events: []; tooMany: true; count: number } | null {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }

  if (data == null || typeof data !== 'object' || !('events' in data)) return null

  const rawEvents = (data as Record<string, unknown>).events
  if (!Array.isArray(rawEvents)) return null

  if (rawEvents.length > MAX_EVENTS) {
    return { events: [], tooMany: true, count: rawEvents.length }
  }

  const validEvents = rawEvents
    .map(validateEvent)
    .filter((e): e is CalendarEvent => e !== null)

  if (validEvents.length === 0) return null

  return { events: validEvents }
}
