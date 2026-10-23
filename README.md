# Final Round

A live V-Bucks giveaway quiz with a nighttime city theme, a visual host desk and a double-points final question.

**Website:** https://zevwtf-boop.github.io/final-round/

The host supplies the prize and runs the event. No Epic Games credentials, payments or automatic payouts are collected by this app. Real questions are entered privately at runtime; never commit a real answer bank or host key to this public repository.

## Play

Use the room PIN and personal entry code from the host. Choose a display name, join and wait for approval. Answer once per round before the timer expires. Correct answers earn up to 1,000 points based on server receipt time. The last question offers up to 2,000 points after a separate finale announcement.

## Host

Open **Host a game**. Enter the backend URL and your private host key, choose an event name and generate a room PIN. Build 2–50 questions in the visual editor, mark correct answers and set timers. Open the lobby, generate personal codes and approve entrants. Distribute one code per verified person. Run each round and export the standings after the finale. Exact scoring ties are flagged for review; announce a tie rule before starting.

## Deployment

GitHub Pages publishes `/docs` from `main`. Cloudflare Workers Builds deploys `/backend` using `wrangler.jsonc`. The `ROOMS` binding connects the `QuizRoom` class to SQLite-backed Durable Objects. The public frontend URL is configured in `docs/config.js`; `ALLOWED_ORIGIN` is the exact Pages origin, without the repository path. Configure `HOST_KEY` as a private runtime secret in Cloudflare.

`backend/dashboard-worker.mjs` is the self-contained deployment entry. The downloadable project also includes modular sources and the local test suite.

## Security

Read [SECURITY.md](SECURITY.md) for the threat model, implemented defenses, test evidence and launch checks. Server scoring, single-use entry codes, host approval and locked answers reduce cheating opportunities. No public quiz can prevent outside help, second devices or collusion. Rehearse with the intended attendance and check hosting quotas before awarding a prize.
