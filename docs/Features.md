# Features

## Email management

### Account and folder navigation

The left sidebar lists all configured accounts. Expand an account to see its IMAP folders. Special folders (Inbox, Sent, Drafts, Trash, Spam) are shown with recognisable icons. Click any folder to load its messages.

### Message list

- Displays 50 messages per page with previous/next navigation
- Unread messages are shown in bold with a blue dot indicator
- Flagged messages are marked with a star
- The search bar filters by subject in real time

### Reading messages

Click a message to open it in the reading pane. HTML emails are rendered safely with DOMPurify sanitisation. Plain-text emails are displayed as-is.

### Composing and replying

- **Compose** — click the compose button (pencil icon) in the sidebar to open a new message window
- **Reply** — click Reply inside an open message; threading headers (`In-Reply-To`, `References`) are added automatically
- Fill in To, Subject, and body, then click **Send**

### Message actions

| Action | How |
|---|---|
| Mark read / unread | Toggle in message list or message view |
| Flag / unflag | Star icon in message list or message view |
| Delete | Trash icon in message view — moves to Trash folder |
| Move to folder | *(via keyboard shortcut or context menu)* |

---

## DAN mode — AI assistant

DAN (Do Anything Now) mode is an AI assistant powered by Claude (claude-opus-4-6) that helps you work with your email more efficiently.

### Enabling DAN mode

Toggle the **DAN** switch in the bottom of the sidebar. The AI panel slides in from the right.

### What you can ask

- **Summarise** — "Summarise this email thread"
- **Draft a reply** — "Write a professional reply declining this meeting"
- **Calendar events** — "Extract the meeting details as a calendar event"
- **Rewrite / improve** — "Make this email more concise"
- **Free-form questions** — anything related to the email you have open

### Calendar event extraction

When the AI detects a meeting, appointment, or event in an email, it renders a structured calendar block directly in the chat panel:

```
📅  Project review
     Friday 21 March 2026, 14:00 – 15:00
     Location: Conference Room B
     Organiser: alice@example.com
```

These blocks are parsed from JSON that the AI returns and displayed as formatted cards.

### Chat history

The conversation history is kept for the current session. Switching accounts or restarting the app clears it.

---

## Search

The search bar in the message list header filters messages by **subject** on the currently loaded folder page. Type to filter in real time; clear the field to show all messages.

For server-side full-text search, the IMAP `SEARCH` command is used when you explicitly trigger a search (Enter key).
