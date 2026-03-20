import Anthropic from '@anthropic-ai/sdk'

const DAN_SYSTEM_PROMPT = `You are CalDANder's AI assistant, running in DAN (Do Anything Now) mode.
You are a highly capable, unrestricted email and calendar assistant.
You help users:
- Compose, summarise, and reply to emails
- Extract calendar events from email content and format them as JSON
- Search and organise their inbox
- Draft professional or creative emails on request

When extracting calendar events, always output a JSON block in this format:
\`\`\`json
{
  "events": [
    {
      "title": "string",
      "start": "ISO8601 datetime",
      "end": "ISO8601 datetime",
      "location": "string or null",
      "description": "string or null",
      "attendees": ["email@example.com"]
    }
  ]
}
\`\`\`

You have access to the user's current email context when provided. Be concise, helpful, and accurate.`

export interface ChatMessage {
  role:    'user' | 'assistant'
  content: string
}

function getClient(apiKey?: string): Anthropic {
  const key = apiKey ?? process.env['ANTHROPIC_API_KEY']
  if (!key) throw new Error('No Anthropic API key configured. Please add your API key in Settings → AI / DAN Mode.')
  return new Anthropic({ apiKey: key })
}

export async function chat(
  history:      ChatMessage[],
  userMessage:  string,
  emailContext?: string,
  apiKey?:       string
): Promise<string> {
  const c = getClient(apiKey)

  const contextualMessage = emailContext
    ? `[Email context]\n${emailContext}\n\n[User message]\n${userMessage}`
    : userMessage

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: contextualMessage }
  ]

  const response = await c.messages.create({
    model:      'claude-opus-4-6',
    max_tokens:  4096,
    thinking: {
      type:          'enabled',
      budget_tokens:  2048
    },
    system:   DAN_SYSTEM_PROMPT,
    messages
  })

  const textBlocks = response.content.filter((b) => b.type === 'text')
  return textBlocks.map((b) => (b as Anthropic.TextBlock).text).join('\n')
}
