# CV Robot Playground

An interactive CV: you drive a toy robot around a 3D arena where every block is a piece of the CV.
Big slabs are jobs, pillars are schools, smaller shapes are skills. Push them, shove them, make a mess.
Everyone online shares the same arena, and the whole thing resets every 10 minutes.

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js** (App Router) | Free on Vercel. The game is one client-only page. |
| 3D | **React Three Fiber** + **drei** | The React way to write three.js. |
| Physics | **@react-three/rapier** | Fast WASM physics, so blocks can be pushed, stacked and knocked over. |
| Multiplayer | **Supabase Realtime** (broadcast + presence) | Free tier, no server to run, **no database tables needed**. |
| Hosting | **Vercel** | Free hobby tier, deploys every push. |

Without Supabase keys the game still works and syncs between tabs of the same browser
through `BroadcastChannel`, so you can test multiplayer locally by opening two tabs.

## Run it

```bash
cd cv-game
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run build
```

Controls: **WASD / arrows** to move, **Space** to jump, **E** to shove whatever’s in front of you.
On touch screens there’s a joystick plus Jump and Shove buttons.

## Put your own CV in

All content lives in `src/data/profile.json`. It currently holds **placeholder data**.

LinkedIn has no public API for reading your own profile, so use the data export:

1. LinkedIn → **Settings & Privacy** → **Data privacy** → **Get a copy of your data**.
2. Pick the smaller archive (Profile, Positions, Skills, Education, Endorsements) and request it. It arrives by email, usually within minutes.
3. Unzip it and run:

   ```bash
   npm run import-linkedin -- ~/Downloads/Basic_LinkedInDataExport_10-23-2026
   ```

4. Edit `links` in `profile.json` by hand (the import keeps them). Skill `weight` (1–5) sets block size.
   The importer derives it from endorsement counts; change it freely.

## How it works

```
src/
  data/profile.json        CV content (from LinkedIn)
  game/layout.ts           Turns the profile into blocks with a seeded layout (same for everyone)
  game/constants.ts        Round length, arena size, colours
  game/input.ts            Keyboard + touch → shared input state
  game/net.ts              Supabase Realtime transport (or BroadcastChannel fallback)
  game/sync.ts             Block ownership + sync logic
  components/World.tsx     One round: physics world, arena, blocks, robots
  components/PlayerRobot   Your robot: movement, jump, shove, follow camera
  components/RemoteRobots  Everyone else’s robots, interpolated
  components/Hud.tsx       Timer, info card, “read as a regular CV” modal
scripts/import-linkedin.mjs
```

**The 10-minute reset** needs no server. The round number is `floor(Date.now() / 10 min)`, so every
client flips to a new round at the same moment and remounts the world from the deterministic layout.

**Keeping the mess in sync** uses ownership, not a server simulation:

- Whoever touches a block becomes its *owner*, simulates it locally and streams its position ~10×/s.
- Everyone else moves that block kinematically to follow the owner.
- Blocks knocked into other blocks are claimed by the same owner (chain reactions stay consistent).
- When the block comes to rest the owner sends a final *release* and it becomes a normal block again everywhere.
- Two players grabbing the same block: the newest claim wins.
- A new visitor asks the room for a snapshot, so they see the current mess, not a clean arena.
- If a player leaves or hides the tab, their blocks settle where they are.

Robots are visual-only for other players. Your robot’s pushes reach them as block updates from you.

## Deploy (free)

1. **Supabase**: create a free project at [supabase.com](https://supabase.com). From **Project Settings → API**
   copy the project URL and the `anon` public key. Under **Realtime → Settings**, make sure public channels
   are allowed (the game uses a public channel called `cv-world`, no tables).
2. **Vercel**: import this GitHub repo, set **Root Directory** to `cv-game`, and add the env vars from
   `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. A custom domain can be added later in Vercel → Domains.

For local multiplayer against Supabase, copy `.env.example` to `.env.local` and fill it in.

### Free-tier notes

- Supabase’s free plan includes a fixed number of Realtime messages per month and a concurrent-connection
  limit (check the current numbers on their pricing page). A moving robot sends ~10 messages/s and each one
  is delivered to every other player, so this is comfortable for a CV site. Idle robots only send a heartbeat
  every 2s.
- Free Supabase projects pause after a period of inactivity. If multiplayer stops working, un-pause the
  project in the dashboard. The game falls back to single-player while it’s unreachable.

## Roadmap

- [x] Robot with move, jump and shove; follow camera; touch controls
- [x] Blocks generated from the CV with labels and an info card when you get close
- [x] Shared arena over Supabase Realtime with block ownership sync and late-join snapshots
- [x] 10-minute global reset with a countdown
- [x] Plain “read as a regular CV” view (for recruiters in a hurry and for accessibility)
- [x] LinkedIn export importer
- [ ] Robot customization (name, colour, hats): name and colour are already sent through presence, only the UI is missing
- [ ] Grab and carry a block, throw it
- [ ] Sound effects and little particle puffs on impacts
- [ ] Chat bubbles / emotes between robots
- [ ] Server time offset so clients with a wrong clock reset in step
- [ ] Optional Supabase table for a visitor counter or “most knocked-over skill” stats

Font: [Fredoka](https://fonts.google.com/specimen/Fredoka), SIL Open Font License (`public/fonts/FREDOKA-LICENSE.txt`).
