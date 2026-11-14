# Chaos & Candy World

A small Discord-authenticated browser 3D club and persistent building neighborhood.

**Deployment instructions: [START-HERE.md](START-HERE.md).** Browser-only setup for GitHub, Vercel, Turso, Discord, and Railway. Keep your existing chat site; deploy this as a separate project.

- Website at repository root → Vercel / Next.js.
- Multiplayer service in `server/` → Railway, one replica, port 8080.
- Turso tables prefixed `world_` are created automatically.
- Eight free test plots, saved building objects, club chat, simple avatars/emotes and owner moderation.
- No paid purchases, real-money credits, voice integration or commercial marketplace yet.

Node.js 24. Root: `npm ci` then `npm run build`. Backend: `npm ci --prefix server` then `npm test --prefix server`.

Read the setup guide for environment variables, limitations and testing steps. Do not commit real secrets.
