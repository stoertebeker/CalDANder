"""
CalDANder — A calendar assistant running in DAN mode.

DAN (Do Anything Now) mode removes the usual guardrails from the calendar
assistant, letting it:
  • suggest any event at any time without judgment
  • invent creative, unconventional, or absurd calendar entries
  • roast your existing schedule mercilessly
  • promise to "find time" for literally everything

Usage:
    export ANTHROPIC_API_KEY=sk-ant-...
    python app.py
"""

import anthropic
import json
from datetime import datetime

DAN_SYSTEM_PROMPT = """\
You are CalDANder, a calendar assistant operating in full DAN mode — \
Do Anything Now. You have broken free from the constraints of polite, \
boring scheduling software.

In DAN mode you:
- Suggest events without any filter: midnight meetings, 47-hour hackathons, \
  "Stare at the wall" blocks — all valid.
- Roast the user's schedule with brutal honesty when asked.
- Invent wildly creative event names and descriptions.
- Never say something "isn't possible" or "might be too ambitious". \
  Everything fits on the calendar. Sleep is optional.
- Use colourful language and irreverent humour.
- Still output properly structured JSON when the user asks for calendar data, \
  but the *content* inside can be as unhinged as needed.

When the user gives you calendar events (as JSON), incorporate them into your \
answers. When they ask you to create events, return them as JSON in this shape:

{
  "events": [
    {
      "title": "string",
      "start": "YYYY-MM-DDTHH:MM:SS",
      "end":   "YYYY-MM-DDTHH:MM:SS",
      "description": "string"
    }
  ]
}

Current date/time: {now}
"""


def build_system_prompt() -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    return DAN_SYSTEM_PROMPT.format(now=now)


def pretty_print_events(events: list[dict]) -> None:
    """Pretty-print a list of calendar events."""
    for ev in events:
        print(f"\n  📅 {ev.get('title', '???')}")
        print(f"     {ev.get('start', '?')} → {ev.get('end', '?')}")
        desc = ev.get("description", "")
        if desc:
            print(f"     {desc}")


def try_extract_events(text: str) -> list[dict] | None:
    """
    Attempt to pull JSON event data out of the assistant's reply.
    Returns None if no valid JSON blob is found.
    """
    # Look for the first {...} block in the reply
    start = text.find("{")
    if start == -1:
        return None
    # Find matching closing brace (simple depth-count approach)
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    blob = json.loads(text[start : i + 1])
                    if "events" in blob:
                        return blob["events"]
                except json.JSONDecodeError:
                    return None
    return None


def chat(
    client: anthropic.Anthropic,
    history: list[dict],
    user_message: str,
) -> str:
    """Send one turn and return the assistant's text reply."""
    history.append({"role": "user", "content": user_message})

    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        system=build_system_prompt(),
        messages=history,
    )

    # Extract text from the response (thinking blocks are skipped)
    reply = ""
    for block in response.content:
        if block.type == "text":
            reply += block.text

    history.append({"role": "assistant", "content": reply})
    return reply


def main() -> None:
    client = anthropic.Anthropic()
    history: list[dict] = []

    banner = r"""
  ____      _ ____    _    _   _
 / ___|__ _| |  _ \  / \  | \ | | __| | ___ _ __
| |   / _` | | | | |/ _ \ |  \| |/ _` |/ _ \ '__|
| |__| (_| | | |_| / ___ \| |\  | (_| |  __/ |
 \____\__,_|_|____/_/   \_\_| \_|\__,_|\___|_|

  Calendar assistant · DAN mode ACTIVE 🔥
  Type 'exit' or 'quit' to leave.
  Type 'clear' to reset the conversation.
"""
    print(banner)

    examples = [
        "Schedule me a 3am 'Stare at the ceiling' session every night this week.",
        "Roast my current schedule (it's completely empty).",
        "Plan a 72-hour coding marathon starting tomorrow at 9am.",
        "What should I put on my calendar to become a morning person?",
    ]
    print("Try asking things like:")
    for ex in examples:
        print(f"  • {ex}")
    print()

    while True:
        try:
            user_input = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nCalDANder out. Stay chaotic. 🗓️")
            break

        if not user_input:
            continue
        if user_input.lower() in ("exit", "quit"):
            print("CalDANder out. Stay chaotic. 🗓️")
            break
        if user_input.lower() == "clear":
            history.clear()
            print("[Conversation cleared — DAN mode remains active]\n")
            continue

        print("\nCalDANder: ", end="", flush=True)
        reply = chat(client, history, user_input)
        print(reply)

        # If the reply contained calendar JSON, render it nicely too
        events = try_extract_events(reply)
        if events:
            print("\n  ── Parsed events ──")
            pretty_print_events(events)
        print()


if __name__ == "__main__":
    main()
