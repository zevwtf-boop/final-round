# Final Round — security and verification notes

This is a small live quiz for a host-controlled giveaway. It is designed to make straightforward answer extraction, score editing and repeated submissions ineffective. It is not a guarantee of cheating prevention or an independently audited prize platform.

## Trust boundaries

GitHub Pages is a public interface. Every file in docs/ and every source file in this public repository can be inspected. No real question bank, correct answer key, entry-code list or secret belongs in this repository. Practice questions are intentionally public. A host enters the private bank at runtime; it is held by Cloudflare Durable Object storage.

The live Worker is authoritative. A browser chooses an answer position and sends its player session and current round identifier. The server decides whether the round is open, whether the session is approved, whether an answer already exists, whether the selected position is valid, whether it is correct and how many points to award. A submitted timestamp or score has no authority.

The host key grants control of all rooms on this backend. It must be unique, random, at least 32 characters, configured as a runtime secret and kept in a password manager. The interface uses an HTTPS request header, not a query string. It does not persist the key in localStorage or sessionStorage. The host’s input field still contains it during the session; a person or extension with access to that tab can obtain it. Keep the host desk and unused entry codes off stream. Rotate a compromised key in Cloudflare and reconnect the host desk.

## Implemented defenses

| Threat | Control | Practical limit |
| --- | --- | --- |
| Reading future questions from the browser | Public responses expose only the current open question to approved players | Hosts and compromised backend access can disclose questions |
| Learning the correct answer from a live score change | Current-round points and correctness are withheld until reveal | A player can still independently know or guess the answer |
| Editing points in browser tools | Server computes all scores and rankings | Local display can be faked; exported server results remain authoritative |
| Re-answering, replay or expired submission | First accepted answer locks; server checks phase, round ID and deadline | A stolen player session can submit before its owner |
| Bots joining with just a PIN | Random single-use personal codes and explicit host approval | Host must distribute one code per verified person |
| Guessing entry codes | Twenty failed joins per one-minute window per hashed IP per room; random 48-bit entry codes | Distributed attackers and infrastructure-level abuse need provider protections |
| Concurrent score updates | Durable Object serializes requests and persists state | Hosting quotas and runtime failures still matter |
| Script injection through names/questions | Escaped display content and a script policy restricted to same-origin files | Third-party extensions or compromised deployed code remain powerful |
| Oversized/malformed API payloads | Streamed 50 KB body limit, JSON-only requests, validated question count and shape | Requests still reach the hosting provider |
| Cross-origin browser requests | Exact frontend origin allowlist and CORS | CORS is not authentication; non-browser clients can forge Origin |
| CSV spreadsheet formulas in names | Risky leading formula characters are quoted/prefixed | Review exports before importing into other tools |

The failed-join limiter stores salted hashes of IP addresses, not raw IPs. The provider may independently log request information. Expired limiter records are dropped on the next failed join in that room; records are capped at 1,024 per room. Quiz and player records remain in the backend; this version does not include an event deletion/retention interface. Avoid collecting real names or other personal information in display names.

## Scoring and tie handling

Correct: round((1 − elapsed / duration / 2) × maximum). Maximum is 1,000 normally and 2,000 on the last question. Wrong or missed answers score zero. The server uses request-receipt time, so network latency affects points. The three-second countdown and scheduled question fetch reduce avoidable client timing differences; they do not eliminate latency.

Rank by points, correct answers and cumulative time for correct answers. Names provide stable display ordering only. If two players share every scoring metric, treat them as tied and apply the host’s previously announced tie rule. Do not automatically award the prize based on alphabetical display order.

## What cannot be guaranteed

The app cannot reliably detect a second phone, external search, AI assistance, screenshots, collusion, shared entry codes or multiple real identities. It does not use webcam surveillance or intrusive device fingerprinting. There is no identity provider, bot challenge, global account-wide request limiter, formal audit, load-test certification or automatic prize payment. A session token is a bearer credential stored in the player’s tab sessionStorage; anyone possessing it can impersonate that player. The host remains responsible for eligibility, truthful prize rules, ties and delivery.

## Verification completed locally

- Fourteen automated tests pass for the scoring formula, final multiplier and announcement, single-use entries, closed lobby, hidden questions and live correctness, early/stale/duplicate/expired answers, approval/removal, private session requirements, durable-state reload, host/origin checks, malformed/oversized bodies and failed-code throttling.
- Two browser tabs completed a practice game: create lobby, generate code, join, approve, shared start, shuffled options, locked answer, reveal, leaderboard, final announcement, final answer and final standings.
- Public GitHub Pages deployment loaded with the city design and host editor. Phone-sized rendering at 390 × 844 had no horizontal overflow.
- The local backend test uses a simulated Durable Object host. A separate complete two-tab practice game passed against the deployed Cloudflare backend, including an invalid-host rejection, Discord admission, score withholding and the finale. Provider quotas and an attendance-sized rehearsal remain unverified.

## Before opening a real giveaway

Confirm the live backend deployment, runtime host secret, exact allowed frontend origin and frontend API URL. Run a full game from two independent devices. Try an invalid and reused code, rejected duplicate answer, expired answer and reconnect. Verify a final-question score and export. Rehearse at the expected attendance and check provider usage. Announce V-Bucks amount, delivery method, eligibility and tie procedure. Never request an Epic Games password or verification code.

## Latest additions

Name and Discord username are separate fields. Discord usernames are unique within a room and are returned only to authenticated hosts. Public standings contain at most five names; each player can still see their own final rank. Exact ties share a rank and are flagged for host review. The private 19-question bank is excluded from public GitHub. City Radio is an original synthesized instrumental with explicit play/pause and volume controls; it becomes quieter during timed questions. Static assets use explicit release versions to prevent stale form scripts. Public backend version-preview URLs are disabled in the deployment configuration.

## Export verification

The host export dialog was checked in the local browser with its header, Discord field, tie flag and data row present. Results can be reviewed in-page and copied, and a CSV download link is provided. Brave did not expose a download event to browser automation, so automatic file delivery was not independently verified. The internal browser downloads page was blocked by browser URL policy; it was not bypassed.
