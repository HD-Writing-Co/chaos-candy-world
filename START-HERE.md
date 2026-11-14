# Chaos & Candy — 3D World MVP

A browser-based club for your Discord community, with a small persistent neighborhood.

**You do not need VS Code or a terminal for deployment.** You can also open `START-HERE.html` directly in your browser. Use GitHub, Vercel, Turso, Discord Developer Portal, and Railway in your browser. Follow these sections in order.

## What you are getting

- A stylized 3D club with a dance floor, DJ booth, lounge seating, and eight surrounding plots.
- Discord login: server membership required; server nickname, or Discord display name/username, shown above the avatar. Ownership is tied to the permanent Discord user ID, so a name change does not lose land.
- Shared multiplayer movement, club text chat, online member list, five avatar colors, dance/wave/sit actions, and touch movement controls.
- Eight **free test plots**, one per member. Seven building pieces: wall, floor tile, chair, table, lamp, tree, booth. Rotate in 90-degree steps and remove pieces. One item per square, up to 60 objects per plot; no vertical stacking yet.
- Saved plot names, ownership, objects, avatar colors, and world bans in Turso.
- Owner moderation: your configured Discord ID can remove/ban an online member from the world.

This is a small playable foundation, not a complete Second Life/Minecraft replacement. Purchases, paid land, credit balances, seller stores, building bundles, uploads, crafting, games, proximity voice, Discord chat mirroring, and general moderator role assignment are **not included**. Use your existing Discord voice channels separately. The DJ booth is decorative; it does not stream music. Avatars are simple geometric characters. Buildings are decorative and do not yet block walking. There is one shared world with a 24-player cap; that is a configured limit, not a measured device/network performance guarantee.

## What stays and what is new

| Service | What to do |
| --- | --- |
| Existing website | Keep it running unchanged while testing this world. |
| GitHub | Create a separate repository named `chaos-candy-world`. |
| Vercel | Create a separate project from that repository. |
| Turso | You can reuse your existing `chaos-candy` database. No deletion or reset required. |
| Discord | Create a Developer Portal application for login. Your Discord server stays as it is. |
| Railway | Add one always-running Node service for the shared world. It may require a paid plan/usage charges; check its current pricing before enabling service. |
| Resend | Not used by this new world. Keep it for the original site. |

Vercel serves the website; Railway keeps the live connections and movement running; Turso saves ownership and building data. **Vercel alone will not run this multiplayer server.**

## 1. Extract and upload to GitHub

1. Download `chaos-candy-world-mvp.zip` and choose **Extract All** in Windows.
2. Open the extracted `chaos-candy-world` folder. You should see `app`, `server`, `scripts`, `package.json`, and this guide.
3. On [GitHub](https://github.com/new), create a new repository called `chaos-candy-world`. Private is fine. Do not replace your old repository.
4. Open the repository and choose **uploading an existing file** (or **Add file → Upload files**).
5. Drag the **contents inside** the extracted folder into GitHub. Do not upload the ZIP or add an extra outer folder.
6. Commit the uploaded files to `main`.
7. Verify `package.json` is visible at the repository's top level and `server/package.json` is inside `server`.

The example environment files contain placeholders only. Never put real tokens, passwords, or client secrets in GitHub. There are no node_modules or generated build folders in this ZIP; hosting installs dependencies automatically.

## 2. Create the Vercel website

1. Open [Vercel](https://vercel.com/new) and import the new `chaos-candy-world` GitHub repository.
2. Framework preset: **Next.js**. Root directory: **./** (the repository root).
3. Keep the normal Next.js build/output settings. The package requests Node.js 24.
4. Deploy without environment variables for this first pass.
5. Copy the project's stable production URL, such as `https://your-project.vercel.app`. Use the project domain, not a temporary commit/preview URL.

The 3D page can load now, but login will show a setup message. That is expected until steps 3–6 are finished. Keep the URL handy; below it is called **YOUR_VERCEL_URL**. Do not include a trailing slash.

## 3. Collect the Turso connection details

1. Open [Turso](https://app.turso.tech) and select your existing **chaos-candy** database.
2. Open its **Overview** or connection-details area, rather than Edit Data.
3. Copy the database URL beginning `libsql://`. This becomes `TURSO_DATABASE_URL`.
4. Use its database token/connection controls to generate an authentication token with read/write access. This becomes `TURSO_AUTH_TOKEN`. Dashboard labels can vary; use the database's connection/token section.
5. Save both privately for Railway. Do not send the token in screenshots.

If you prefer isolation, you can instead create a new Turso database named `chaos-candy-world` and use that database's URL and token. That is optional.

**There is no SQL statement you must run for initial setup.** The world server creates these new tables automatically when it starts successfully:

- `world_users`
- `world_sessions`
- `world_plots`
- `world_objects`

It also creates eight available plots. It does not modify your old `accounts`, `profiles`, `rooms`, or other chat tables. Existing email accounts do not migrate or merge into Discord accounts; the world creates a separate Discord identity on first login.

## 4. Set up Discord login

1. Open [Discord Developer Portal](https://discord.com/developers/applications).
2. Choose **New Application**, name it **Chaos & Candy World**, and create it.
3. Open **OAuth2**. Copy the **Client ID**. Reveal/reset and copy the **Client Secret**. These are two different values. A bot token is not the client secret.
4. Under **Redirects**, add this exact URL, replacing the example domain with your Vercel production domain:

   `https://your-project.vercel.app/api/auth/callback`

5. Save the redirect. Do not add a slash after `callback`. You do not need to create an OAuth invite URL manually; the website handles it.
6. In the normal Discord app, open **User Settings → Advanced → Developer Mode** and turn it on.
7. Right-click your Discord server icon and choose **Copy Server ID**. Save this as `DISCORD_GUILD_ID`.
8. Right-click your own Discord profile/user and choose **Copy User ID**. Save this as `DISCORD_OWNER_ID`. This must be your numeric user ID, not your name or server ID.

No Discord bot is required. Login requests `identify` and `guilds.members.read`, allowing the site to identify the user and check membership in your server. It does not read Discord messages or automatically join voice. Membership/nickname are checked at login; sessions last 24 hours. Removing someone from Discord does not instantly kick an already signed-in world session; use the world's owner moderation to remove them immediately.

## 5. Create the Railway multiplayer server

1. Open [Railway](https://railway.com), create a project, and select **Deploy from GitHub repo**.
2. Select the new `chaos-candy-world` repository. Allow the GitHub integration access to this repository if needed.
3. Open the created service's **Settings**. Set its **Root Directory** to `/server`.
4. Set **Start Command** to `npm start`. A custom build command is not needed; Railway installs the Node dependencies. An initial failed deployment before you finish configuration is expected.
5. Keep **one replica**. Disable sleeping/serverless mode if that option is enabled. Multiple replicas would create separate worlds in this MVP.
6. Open the service's **Variables** and add all values below. Enter values without quotation marks.

| Variable | Value |
| --- | --- |
| `APP_URL` | YOUR_VERCEL_URL, starting `https://`, no trailing slash |
| `API_PROXY_SECRET` | A new random secret, at least 32 characters; use the included `SECRET-GENERATOR.html` locally, or a password manager |
| `TURSO_DATABASE_URL` | Your `libsql://...` database URL |
| `TURSO_AUTH_TOKEN` | The database read/write token |
| `DISCORD_CLIENT_ID` | Discord OAuth Client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth Client Secret |
| `DISCORD_GUILD_ID` | Your Discord server's numeric ID |
| `DISCORD_OWNER_ID` | Your own numeric Discord user ID |
| `PORT` | `8080` |

7. Apply/deploy the changes. Wait for the service log to say **World server ready.**
8. Under **Settings → Networking → Public Networking**, choose **Generate Domain**. If asked for target port, use **8080**.
9. Copy the generated domain, such as `your-world.up.railway.app`.
10. Open `https://your-world.up.railway.app/health` in your browser, using your actual generated domain. You should see `{"ok":true,"players":0}` (the number changes when people join).

If startup fails, check the Turso URL/token and that Railway's root is `/server`. Do not reset the database. Keep the same `API_PROXY_SECRET` for the next step. It is a server-to-server secret, not a Discord key or the old site's SESSION_SECRET.

## 6. Connect Vercel to Railway

1. Return to the new Vercel project → **Settings → Environment Variables**.
2. Add these three variables to **Production**:

| Variable | Example — replace with your own values |
| --- | --- |
| `WORLD_SERVER_URL` | `https://your-world.up.railway.app` |
| `NEXT_PUBLIC_WORLD_WS_URL` | `wss://your-world.up.railway.app` |
| `API_PROXY_SECRET` | Exactly the same secret entered in Railway |

3. Do not append `/live` to the WebSocket value; the app adds it. Do not put Turso or Discord secrets in any `NEXT_PUBLIC_` variable.
4. Open **Deployments**, open the menu for the latest production deployment, and choose **Redeploy**. Environment changes require a new deployment. The public WebSocket URL is embedded at build time.
5. Visit the stable Vercel production URL. Choose **Enter with Discord**, authorize the application, and return to the world.

Do not test with a Vercel preview URL: this configuration intentionally accepts only the production origin. If you later change domain, update Railway `APP_URL`, Discord's exact redirect URI, and redeploy the affected services.

## 7. Test with a friend

1. Log in as yourself. You should see your Discord server nickname and a colored avatar.
2. On desktop, use WASD/arrows to walk. Drag the scene to turn the camera; scroll to zoom. On a phone, use the lower-left movement pad and drag the scene to look. The side panel can collapse to leave more room.
3. Ask one member of your Discord server to open the same production URL. Use a different Discord account, not two tabs of the same account: the newer tab replaces the older session.
4. Confirm both avatars move and club chat messages appear to both users.
5. Open **Build / My space**, choose an available plot, **View plot**, then **Claim this test plot**.
6. Choose an item, tap/click an empty square inside the plot, choose a rotation, and press **Place**. Tap an existing item and choose **Remove selected object** to delete it. To reposition an object, remove and place it again.
7. Name your plot and save. Refresh the website, sign in again if needed, and check the plot and objects remain.
8. Your friend should be able to claim a different plot but not edit yours.
9. In **People**, your owner profile has a **Remove** action beside other online users. This is a world ban, not just a temporary kick. Use it only when intended. It does not ban the person from Discord.
10. Try the site on a real phone. Touch controls and responsive layouts are included; device performance still needs your community's testing.

A server restart disconnects everyone; press **Reconnect** to return. Plot data stays saved. Chat history is intentionally temporary (last 60 messages, cleared on server restart). Positions and emotes reset on reconnect. There is no offline chat delivery.

## Troubleshooting

| What you see | Check |
| --- | --- |
| World server setup is incomplete | Add the three Vercel variables, then redeploy. |
| World server unavailable | Open Railway `/health`; check deployment logs and Turso credentials. |
| Access denied from API | `API_PROXY_SECRET` must be identical on Vercel and Railway. |
| Invalid OAuth redirect | Discord redirect must exactly equal Railway `APP_URL` plus `/api/auth/callback`. |
| Join the Discord server | Confirm the user is in your server and `DISCORD_GUILD_ID` is the correct server ID. |
| Login returns a general error | Check Client ID and Client Secret (not bot token), redirect URI, and Railway outbound connectivity. |
| Login works but world will not connect | `NEXT_PUBLIC_WORLD_WS_URL` must start `wss://`; Railway domain must target port 8080; `APP_URL` must match the address bar origin. Redeploy Vercel after changing public variables. |
| No owner moderation button | `DISCORD_OWNER_ID` must be your user ID; sign out/in after configuration changes. |
| No free plots | All eight are claimed. This small world intentionally does not sell or automatically add more plots. |
| All avatars vanish after deployment | The single live server restarted. Reconnect. Saved buildings remain in Turso. |
| Blank scene / graphics error | Update the browser and enable graphics acceleration. WebGL support is required. |

To verify database setup from Turso **Edit Data**, run this read-only statement:

```sql
SELECT name FROM sqlite_master
WHERE type = 'table' AND name GLOB 'world_*'
ORDER BY name;
```

To undo a world ban, first look up the correct Discord ID in `world_users`. Then run this single statement, replacing the placeholder inside the quotes with that exact ID:

```sql
UPDATE world_users SET banned = 0 WHERE id = 'PASTE_DISCORD_USER_ID';
```

The member must sign in again. Do not delete your old tables or run the old site's setup SQL for this new world.

## What has been verified

The production frontend build and backend automated tests pass. The preview browser displayed the page layout but reported WebGL unavailable, so the 3D render and real-phone behavior could not be visually verified here. Tests cover session/proxy access, OAuth state rejection, movement limits, simultaneous plot claims, owner-only building/removal, persistence after restart, chat delivery, and owner-only moderation. These tests use isolated local database data; they do not use your accounts or touch your existing database. Live Discord authorization and your Vercel/Railway/Turso connection require the setup above. This is not a payment-ready release or a load-tested commercial launch.

## Developer notes (optional)

Node.js 24. Frontend: Next.js/React/Babylon.js. Live backend: Express + WebSocket with movement validated on the server. Database: libSQL/Turso. There is no Colyseus dependency.

Local development: install root and server dependencies separately (`npm ci` and `npm ci --prefix server`). Copy example environment files to local files, configure Discord's localhost callback, and run `node --env-file=.env index.mjs` from `server`, plus `npm run dev` from the repository root. The server can use a local `file:` database URL for testing. `npm test --prefix server` runs integration checks. `npm run build` builds the website. No demo authentication bypass is shipped.

Keep one backend instance. Identity and ownership checks are enforced by the backend, not only hidden UI. Never calculate paid balances in browser code. Before charging for land, add payment-provider webhooks, an idempotent transaction ledger, refund handling, backups, audit trails, expanded moderation and a production security review.

## Official setup references

- [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2)
- [Vercel environment variables and redeployment](https://vercel.com/docs/environment-variables/managing-environment-variables)
- [Railway monorepo root directories](https://docs.railway.com/deployments/monorepo)
- [Railway public networking](https://docs.railway.com/networking/public-networking)
