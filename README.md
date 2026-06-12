# Bhabii — Online Card Game

A real-time multiplayer card game based on **Thulla** (also known as Bhabii), built with a NestJS WebSocket backend and a Next.js frontend. Play against friends in private rooms or sharpen your skills against CPU bots.

---

## Table of Contents

- [How the Game Works](#how-the-game-works)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [WebSocket Events](#websocket-events)
- [REST API](#rest-api)
- [Environment Variables](#environment-variables)
- [Running from Scratch](#running-from-scratch)
- [Deploying to Render](#deploying-to-render)

---

## How the Game Works

### Objective

Be the first to get rid of all your cards. The **last player** holding cards loses and receives the "Thulla" (the penalty).

### Rules

1. **Dealing** — A standard 52-card deck is shuffled and dealt equally among all players (3–6 players).
2. **Starting** — The player holding the **Ace of Spades** must play it first to open the game.
3. **Following Suit** — Once a lead suit is established for a trick, all other players **must follow that suit** if they have it.
4. **Thulla** — If a player cannot follow suit and plays a different suit, **Thulla is triggered**:
   - The trick immediately ends.
   - The player who played the **highest card of the lead suit** picks up all the cards from the trick.
5. **Winning a Trick** — When all active players have played and all followed suit, the player with the **highest card of the lead suit** wins the trick and leads the next one.
6. **Going Safe** — A player who empties their hand is marked **Safe** and exits the active rotation.
7. **Game Over** — The last player remaining with cards in hand is the **loser** (receives the Thulla penalty).

### ELO / Rewards

After each game, stats are updated in the database:

| Outcome       | Coins | XP   | ELO Rank |
| ------------- | ----- | ---- | -------- |
| Winner        | +100  | +250 | +25      |
| Participation | +10   | +50  | +5       |
| Loser         | -50   | +10  | -15      |

### Bot AI Strategy

CPU players use a simple heuristic:

- If they can follow suit → play the **lowest card** of that suit (conservative).
- If they cannot follow suit → dump the **lowest card** from another suit.
- Always plays the lowest valid card to minimise penalty risk.

---

## Tech Stack

### Backend

| Technology           | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| **NestJS**           | Server framework with dependency injection and decorators |
| **Socket.IO**        | Real-time WebSocket communication for game events         |
| **Prisma ORM**       | Type-safe database access and schema management           |
| **PostgreSQL**       | Persistent storage for users, matches, and leaderboard    |
| **TypeScript**       | Full type safety across the game engine                   |
| `@nestjs/config`     | Environment variable management                           |
| `@prisma/adapter-pg` | Native `pg` adapter for Prisma v7                         |

### Frontend

| Technology                  | Purpose                                     |
| --------------------------- | ------------------------------------------- |
| **Next.js 16** (App Router) | React framework with SSR/client rendering   |
| **React 19**                | UI component model                          |
| **Socket.IO Client**        | Connects to the NestJS WebSocket server     |
| **Tailwind CSS v4**         | Utility-first styling                       |
| **Framer Motion**           | Card animations and transitions             |
| **Lucide React**            | Icon set                                    |
| **DiceBear API**            | Auto-generated robot avatars from usernames |

---

## Project Structure

```
/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma         # Database models
│   ├── src/
│   │   ├── game/
│   │   │   ├── game.types.ts     # Card, Player, GameState type definitions
│   │   │   ├── game.engine.ts    # Core game logic (deal, validate, resolve tricks)
│   │   │   └── bot.ai.ts         # CPU player card selection logic
│   │   ├── socket/
│   │   │   └── game.gateway.ts   # WebSocket gateway — all real-time game events
│   │   ├── users/
│   │   │   └── users.controller.ts # REST endpoints (leaderboard, user profile)
│   │   ├── app.module.ts         # NestJS root module
│   │   ├── main.ts               # App bootstrap, CORS, port config
│   │   └── prisma.service.ts     # Prisma client singleton service
│   ├── .env                      # Environment variables
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Main game UI (lobby, game table, leaderboard)
│   │   │   ├── layout.tsx        # Root layout with global styles
│   │   │   └── globals.css       # Global CSS and Tailwind config
│   │   ├── components/
│   │   │   ├── PlayingCard.tsx   # Animated playing card component
│   │   │   ├── BrandLogo.tsx     # Site logo component
│   │   │   └── SiteFooter.tsx    # Footer component
│   │   ├── hooks/
│   │   │   └── useSocket.ts      # Socket.IO connection and all event handlers
│   │   └── types/
│   │       └── game.ts           # Shared TypeScript types mirroring backend
│   └── package.json
│
└── package.json                  # Root package with build/start scripts
```

---

## Database Schema

### User

Stores all registered guest and player profiles.

```
id, username (unique), avatar, coins, xp, wins, losses, rank (ELO), createdAt, updatedAt
```

### Match

Records each completed game session.

```
id, roomCode, status (COMPLETED | ABANDONED), duration, createdAt
```

### MatchPlayer

Junction table linking users to matches with their individual outcomes.

```
id, matchId, userId, isWinner, xpEarned, coinsChange, rankChange
```

### Friend

Tracks friend requests between users.

```
id, senderId, receiverId, status (PENDING | ACCEPTED | BLOCKED), createdAt
```

### ChatMessage

Persists chat messages tied to rooms (for history, optional).

```
id, userId, username, message, roomCode, createdAt
```

---

## WebSocket Events

All game communication happens over Socket.IO. The client connects to the backend URL and emits/listens to these events.

### Client → Server (emit)

| Event           | Payload                                | Description                               |
| --------------- | -------------------------------------- | ----------------------------------------- |
| `registerGuest` | `{ username: string }`                 | Register or fetch a user by username      |
| `joinRoom`      | `{ roomId: string, username: string }` | Join or create a room by code             |
| `leaveRoom`     | `roomId: string`                       | Leave the current room                    |
| `toggleReady`   | —                                      | Toggle your ready status in the lobby     |
| `startGame`     | —                                      | Start the game (requires 3+ players)      |
| `startBotGame`  | `{ totalPlayers: number }`             | Start a solo game vs CPU bots (3–6 total) |
| `playCard`      | `Card` object                          | Play a card from your hand                |
| `sendMessage`   | `text: string`                         | Send a chat message to the room           |
| `emojiReaction` | `emoji: string`                        | Broadcast an emoji reaction               |

### Server → Client (listen)

| Event         | Payload                    | Description                                      |
| ------------- | -------------------------- | ------------------------------------------------ |
| `registered`  | `User` object              | Confirms registration, returns user data         |
| `roomUpdated` | `GameState` object         | Full room/game state after any change            |
| `chatMessage` | `{ sender, text }`         | A new chat or system message                     |
| `reaction`    | `{ playerId, emoji }`      | An emoji reaction from a player                  |
| `gameOver`    | `{ winnerOrder, loserId }` | Game ended, final results                        |
| `error`       | `string`                   | Validation error (e.g. invalid play, wrong turn) |

---

## REST API

Base URL: `http://localhost:3001`

| Method | Endpoint                 | Description                          |
| ------ | ------------------------ | ------------------------------------ |
| `GET`  | `/api/users/leaderboard` | Top 100 players sorted by ELO rank   |
| `GET`  | `/api/users/:username`   | Profile + last 10 matches for a user |

---

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL="postgres://user:password@host:port/dbname"
PORT=3001
```

### Frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

---

## Running Locally

### Prerequisites

Make sure you have the following installed before you begin:

- **Node.js** v18 or higher — [download](https://nodejs.org)
- **npm** v9 or higher (comes with Node.js)
- **PostgreSQL** v14 or higher — [download](https://www.postgresql.org/download/) — or use a free hosted DB (see tip below)
- **Git** — [download](https://git-scm.com)

> **No local PostgreSQL?** You can use a free hosted database instead:
>
> - [Neon](https://neon.tech) — free serverless PostgreSQL, takes 2 minutes to set up
> - [Supabase](https://supabase.com) — free tier with a PostgreSQL instance
> - [Render](https://render.com) — free PostgreSQL database service
>
> Just grab the connection string they provide and use it as your `DATABASE_URL`.

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/TheGamerstag/Card-game.git
cd Card-game
```

---

### Step 2 — Create a PostgreSQL database

If you're running PostgreSQL locally, create a database for the app:

```bash
# Connect to PostgreSQL
psql -U postgres

# Inside psql, create the database
CREATE DATABASE bhabii;
\q
```

Your local connection string will look like:

```
postgres://postgres:yourpassword@localhost:5432/bhabii
```

---

### Step 3 — Set up the Backend

Navigate into the backend folder and install dependencies:

```bash
cd backend
npm install
```

Create the environment file by copying the example below into `backend/.env`:

```env
DATABASE_URL="postgres://postgres:yourpassword@localhost:5432/bhabii"
PORT=3001
```

> Replace `yourpassword` with your actual PostgreSQL password. If using a hosted DB, paste the full connection string provided by the service.

Run Prisma migrations to create all the database tables:

```bash
npx prisma migrate dev --name init
```

Generate the Prisma client (required to query the DB):

```bash
npx prisma generate
```

Start the backend in development mode (auto-reloads on file changes):

```bash
npm run start:dev
```

You should see:

```
Application is running on: http://localhost:3001
```

---

### Step 4 — Set up the Frontend

Open a **new terminal window** (keep the backend running) and navigate to the frontend:

```bash
cd frontend
npm install
```

Create the frontend environment file `frontend/.env.local`:

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

Start the frontend dev server:

```bash
npm run dev
```

You should see:

```
▲ Next.js 16
- Local: http://localhost:3000
```

---

### Step 5 — Open the app

Go to **http://localhost:3000** in your browser.

1. Enter any username and click **Enter Bhabii**
2. To play solo, click **Start Bot Game** and choose 3–6 players
3. To play with friends on the same network, click **Create Private Room**, share the room code, and have friends open the same URL and join with that code

---

### Running Both Servers at Once (optional)

If you want a single command to start everything from the project root, you can install a helper:

```bash
# From the repo root
npm install --save-dev concurrently
```

Then add this to the root `package.json` scripts:

```json
"dev": "concurrently \"cd backend && npm run start:dev\" \"cd frontend && npm run dev\""
```

Then just run:

```bash
npm run dev
```

---

### Available Scripts

#### Backend (`cd backend`)

| Command                  | Description                                |
| ------------------------ | ------------------------------------------ |
| `npm run start:dev`      | Start with hot-reload (development)        |
| `npm run start:prod`     | Build and start production server          |
| `npm run build`          | Compile TypeScript to `dist/`              |
| `npm run lint`           | Run ESLint                                 |
| `npx prisma studio`      | Open a visual DB browser at localhost:5555 |
| `npx prisma migrate dev` | Apply schema changes and run migrations    |

#### Frontend (`cd frontend`)

| Command         | Description                                |
| --------------- | ------------------------------------------ |
| `npm run dev`   | Start Next.js dev server at localhost:3000 |
| `npm run build` | Build for production                       |
| `npm run start` | Start production build                     |
| `npm run lint`  | Run ESLint                                 |

---

### Troubleshooting

**`Cannot find module 'dist/main'`**
The TypeScript hasn't been compiled yet. Run `npm run build` inside the `backend/` folder first.

**`Error: connect ECONNREFUSED 127.0.0.1:5432`**
PostgreSQL isn't running. Start it with `brew services start postgresql` (macOS) or `sudo service postgresql start` (Linux), or check the Windows Services panel.

**`PrismaClientInitializationError`**
Your `DATABASE_URL` is wrong or the database doesn't exist yet. Double-check the credentials and make sure you created the database in Step 2.

**Frontend shows "Offline" / can't connect**
Make sure the backend is running on port 3001 and your `frontend/.env.local` has `NEXT_PUBLIC_SOCKET_URL=http://localhost:3001`. Restart the frontend dev server after changing `.env.local`.

**Port 3001 already in use**
Change `PORT=3002` in `backend/.env` and update `NEXT_PUBLIC_SOCKET_URL` in `frontend/.env.local` to match.

---

## Deploying to Render

The backend is deployed as a **Web Service** on [Render](https://render.com).

### Backend Service Settings

| Setting            | Value                |
| ------------------ | -------------------- |
| **Root Directory** | `backend`            |
| **Build Command**  | `npm install`        |
| **Start Command**  | `npm run start:prod` |

`start:prod` runs `nest build && node dist/main`, compiling TypeScript on each deploy before starting the server.

### Required Environment Variables on Render

Set these in the Render dashboard under **Environment**:

```
DATABASE_URL   →  your PostgreSQL connection string
PORT           →  (Render sets this automatically, no need to set manually)
```

### Frontend Deployment (Vercel / Render Static Site)

When deploying the frontend, set the environment variable:

```
NEXT_PUBLIC_SOCKET_URL=https://your-backend-service.onrender.com
```

---

## Key Design Decisions

- **In-memory game state** — All active room and game state lives in the NestJS server memory (`rooms` map in `GameGateway`). This keeps latency minimal and avoids DB round-trips during gameplay. Only final results are persisted.
- **Server-authoritative** — All game logic runs on the server (`game.engine.ts`). The client only sends card choices; the server validates and resolves every play.
- **Guest-first** — No passwords or accounts needed. A username is all that's required to play. User records are upserted on first login.
- **Bot turns** — CPU players run asynchronously on the server with a 700ms delay between moves to feel natural, with no client involvement.
