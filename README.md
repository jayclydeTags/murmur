# Murmur

Murmur is a real-time messaging app for teams and small communities. It is built on Laravel 13 with Inertia v3, React 19, TypeScript and Tailwind CSS 4. [Laravel Reverb](https://reverb.laravel.com) is the WebSocket server, and Laravel Echo runs on the frontend. Messages, typing indicators, presence and read receipts update instantly, with no page refreshes.

## Features

- **Conversations:** one-on-one direct messages, named group chats, public channels anyone can join, and invite-only private channels.
- **Real-time:** live messages, edits, deletes, reactions and pins; typing indicators (client whispers); online, away and offline presence; read receipts; and unread counts in the sidebar.
- **Messaging:** threads, emoji reactions, file and image attachments, @mentions with notifications, and link previews.
- **Organization:** search, pinned messages, mute and archive, and infinite scroll back through history (cursor pagination).
- **Notifications:** in-app toasts, browser notifications when the tab is in the background, and an optional daily email digest.
- **Moderation:** owner, admin and member roles per conversation; removing members; renaming; read-only channels; message reports; and admin delete.

## Requirements

| Tool     | Version              |
| -------- | -------------------- |
| PHP      | 8.4 (8.3 minimum)    |
| Composer | 2.x                  |
| Node.js  | 22                   |
| npm      | 10+                  |
| SQLite   | 3 (default database) |

[Laravel Herd](https://herd.laravel.com) is the easiest way to get PHP, Composer and Node on macOS or Windows. Herd serves the app at `http://murmur.test`.

## Getting started

### 1. Install dependencies and create the database

```bash
composer setup
```

This one command:

- installs Composer and npm dependencies
- copies `.env.example` to `.env` and generates `APP_KEY`
- runs the migrations on `database/database.sqlite`
- builds the frontend

### 2. Configure Reverb

`.env.example` lists the Reverb keys with blank values. Generate local credentials:

```bash
php -r 'echo "REVERB_APP_ID=".random_int(100000, 999999)."\nREVERB_APP_KEY=".bin2hex(random_bytes(10))."\nREVERB_APP_SECRET=".bin2hex(random_bytes(10))."\n";'
```

Paste the output over the blank `REVERB_APP_ID`, `REVERB_APP_KEY` and `REVERB_APP_SECRET` lines in `.env`. Leave the rest of the defaults as they are:

```dotenv
BROADCAST_CONNECTION=reverb
REVERB_HOST="localhost"
REVERB_PORT=8080
REVERB_SCHEME=http

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"
```

The `VITE_` values are baked into the frontend build. Rebuild (`npm run build`) or restart Vite after you change them.

### 3. Set the app URL

If you use Herd, set:

```dotenv
APP_URL=http://murmur.test
```

Without Herd, keep the default and use the server that `composer run dev` starts at `http://127.0.0.1:8000`.

### 4. Link storage and seed demo data

```bash
php artisan storage:link
php artisan db:seed
```

`storage:link` makes uploaded group avatars publicly reachable. Message attachments are private and are served through an authorized route.

The seeder creates channels, a group chat, a direct message and these accounts. Every password is `password`.

| Name         | Email               |
| ------------ | ------------------- |
| Test User    | `test@example.com`  |
| Ana Reyes    | `ana@example.com`   |
| Ben Cruz     | `ben@example.com`   |
| Carla Santos | `carla@example.com` |
| Dev Patel    | `dev@example.com`   |

To see real-time updates between two people, log in as two different users, one of them in a private window.

### 5. Run the app

```bash
composer run dev
```

This starts everything Murmur needs in one terminal:

| Process  | What it does                                                                    |
| -------- | ------------------------------------------------------------------------------- |
| `reverb` | WebSocket server on port 8080                                                   |
| `server` | `php artisan serve` on port 8000 (not needed if Herd serves the site)           |
| `queue`  | queue worker that delivers broadcasts, notifications, link previews and digests |
| `logs`   | Laravel Pail log tail                                                           |
| `vite`   | Vite dev server with hot reload                                                 |

Broadcast events are queued (`ShouldBroadcast`), so nothing updates live unless both **Reverb and the queue worker** are running.

Run only one `composer run dev` at a time. A second copy fails to start Reverb because port 8080 is already in use, and it adds a duplicate queue worker and Vite server.

## Background work

| Work                                                   | How it runs                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Broadcast events, mention notifications, link previews | Database queue (`QUEUE_CONNECTION=database`), processed by the `queue` process |
| Daily unread-message digest                            | `murmur:send-unread-digests`, scheduled daily at 08:00 in `routes/console.php` |

The scheduler isn't part of `composer run dev`. To try the digest locally, run it directly or start the scheduler:

```bash
php artisan murmur:send-unread-digests
```

```bash
php artisan schedule:work
```

Mail uses the `log` mailer by default, so the digest is written to `storage/logs/laravel.log`. Herd users can switch to Herd's mail viewer instead.

## Testing and code quality

Run the test suite:

```bash
php artisan test --compact
```

Run only the chat tests:

```bash
php artisan test --compact tests/Feature/Chat
```

Format the PHP code:

```bash
vendor/bin/pint
```

Run static analysis:

```bash
composer types:check
```

Lint and format the frontend:

```bash
npm run check:fix
```

Type-check the frontend:

```bash
npm run types:check
```

Run everything CI runs:

```bash
composer ci:check
```

Tests use an in-memory SQLite database, the `null` broadcaster and the `sync` queue (see `phpunit.xml`). Reverb doesn't need to be running for them.

## Project layout

| Path                                  | Contents                                                                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/Models`                          | `Conversation`, `ConversationMember` (pivot with role, read position, mute and archive), `Message`, `MessageAttachment`, `MessageReaction`, `MessageReport` |
| `app/Enums`                           | `ConversationType` (direct, group, channel), `ConversationRole` (owner, admin, member)                                                                      |
| `app/Events`                          | broadcast events: `MessageSent`, `MessageUpdated`, `MessageDeleted`, `MessageRead`, `ConversationUpdated`, `ConversationActivity`                           |
| `app/Policies`                        | `ConversationPolicy` and `MessagePolicy`, which hold all permission rules                                                                                   |
| `app/Actions/Chat`                    | `SendMessage` (attachments, mentions, fan-out) and `OpenDirectConversation`                                                                                 |
| `app/Http/Controllers/Chat`           | conversation, message, reaction, pin, read, report, search and attachment endpoints                                                                         |
| `app/Jobs`                            | `FetchLinkPreview` and `SendUnreadMessagesDigest`                                                                                                           |
| `routes/channels.php`                 | authorization for broadcast channels                                                                                                                        |
| `resources/js/pages`                  | Inertia pages: `dashboard`, `conversations/show`, `channels/index`, `search`, `settings/notifications`                                                      |
| `resources/js/components/chat`        | chat UI: sidebar navigation, message list items, composer, thread panel, details sheet                                                                      |
| `resources/js/hooks/use-presence.tsx` | joins the `online` presence channel and tracks away status                                                                                                  |

### Broadcast channels

| Channel                | Type     | Who can join                                                            |
| ---------------------- | -------- | ----------------------------------------------------------------------- |
| `conversation.{id}`    | private  | members of the conversation; carries message events and typing whispers |
| `App.Models.User.{id}` | private  | that user only; carries sidebar activity and mention notifications      |
| `online`               | presence | any signed-in user; used for online and away status                     |

### Routes in TypeScript

Frontend code calls backend routes through functions generated by [Wayfinder](https://github.com/laravel/wayfinder) (`@/actions/...` and `@/routes/...`). Vite regenerates them automatically. If you change routes while Vite isn't running, regenerate them by hand:

```bash
php artisan wayfinder:generate --with-form
```

## Troubleshooting

| Problem                                                      | Fix                                                                                                                                                               |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Messages only appear after a refresh                         | Make sure the `reverb` and `queue` processes are both running. Check that the `REVERB_*` keys in `.env` aren't blank, then rebuild or restart Vite.               |
| Reverb fails with `Failed to listen on "tcp://0.0.0.0:8080"` | Another process holds port 8080 (often a second `composer run dev`). Find it with `lsof -nP -iTCP:8080 -sTCP:LISTEN` and stop it.                                 |
| `Unable to locate file in Vite manifest`                     | Run `npm run build`, or start `composer run dev`.                                                                                                                 |
| Page shows 419 "Page Expired"                                | The page's JavaScript didn't load, so forms fell back to plain posts. Make sure the Vite dev server is reachable, or delete `public/hot` and run `npm run build`. |
| Uploaded avatars don't show                                  | Run `php artisan storage:link`.                                                                                                                                   |

## Scaling beyond one server

Reverb runs as a single process by default. To run several Reverb servers behind a load balancer, set `REVERB_SCALING_ENABLED=true` and point every server at the same Redis instance (`REDIS_HOST`, `REDIS_PORT`). See the [Reverb scaling docs](https://laravel.com/docs/reverb#scaling).
