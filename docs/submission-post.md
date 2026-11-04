# Audit Me: a portfolio that is a cloud account with something wrong in it

Paste this into the "Your project" tab of the hackathon. Replace the three bracketed items, attach the
screenshots named in docs/writeup-kit.md, and delete this first paragraph.

- [LIVE URL]: your Amplify URL
- [GITHUB REPO]: https://github.com/malikabdulhayee/portfolio
- [LEAD SENTENCE ABOUT LEADERBOARD]: keep the Layer 2 section only if you deployed it (see the note in section 3)

---

## The idea

I am a cloud and DevOps engineer, and the first thing I do on any account is look for what is exposed. So
my portfolio opens like a normal, fast portfolio (About, Skills, Projects, Contact) with one red button:
**Audit my infrastructure**. Press it and you are inside a simulated cloud console with real
misconfigurations to fix. My story is "classified" until you fix them.

Live site: [LIVE URL]
Source: [GITHUB REPO]

## The creative feature

Three findings, one bonus. Each one is a mistake I have seen in real environments:

| Finding | The right fix | What it unlocks on the page |
| --- | --- | --- |
| Public S3 bucket | Block Public Access and default encryption | My DevSecOps pipeline project |
| Admin role on a small API | A least-privilege policy | The numbers from my Snack Out role |
| SSH open to the internet | Close port 22, use Session Manager | My Kubernetes project |
| Bonus: no audit logging | Multi-region CloudTrail with log validation | My superpower and a fun fact |

Wrong answers are not dead ends. Each one explains why it does not work ("obscurity is not access control",
"a deny list blocks one action and leaves everything else allowed") and costs 25 points, so you learn the
reason while you play. Faster audits earn a time bonus, and finishing gives you a rank and a shareable result line.

The page itself changes while you play. The case file on the About section declassifies one row per fix, and the
simulated threat feed on the home screen flips each line from "exposed" to "blocked". When the last finding is fixed,
the whole site re-skins from alert red to secure green, and the hint button becomes "Audit passed. Run it again".
Nothing depends on the game. All content is plain HTML and
navigation works with the game closed, with JavaScript off, and on a 360 px phone.

Screenshots: 01 to 08.

## How it is built on AWS

**Layer 1, the site and game, runs on AWS Amplify Hosting.** Amplify builds from GitHub on every push and serves the
site over HTTPS with a strict Content Security Policy, HSTS and no framing. The build runs a guard script first
(`scripts/check-site.js`): it fails the deploy if a section is missing, a link is broken, the hint button is gone, an
inline script sneaks in, or game content is invalid. A broken page cannot go live.

**Layer 2, the leaderboard, is a small serverless backend (optional by design).**

| AWS service | Role |
| --- | --- |
| Amplify Hosting | Builds from GitHub, serves the site, applies security headers |
| API Gateway (HTTP API) | `POST /score` and `GET /leaderboard`, throttled to 5 requests per second, CORS limited to the site |
| Lambda (Python 3.12, arm64) | Validates every request, reads and writes the table. 128 MB, reserved concurrency 5 |
| DynamoDB (on demand) | Leaderboard entries that expire after 60 days with TTL |
| CloudWatch | Function logs with 14-day retention and an alarm on errors |
| AWS Budgets | A 5 USD monthly guard with alerts at 50, 80 and 100 percent |
| IAM | One function role that can only `PutItem` and `Query` the one table |

Everything is defined as code (`infra/template.yaml`, `infra/budget.yaml`) so anyone can redeploy it.
If the API is down or not configured, the game works the same and the leaderboard says it is offline.

Screenshots: 09 to 16 and 18.

> Note for you, delete before posting: only keep the Layer 2 table if the stack is deployed and the live site
> posts a score. The judges check that your AWS usage is real.

## Security and cost decisions

- The game is a simulation. It never touches real resources.
- No inline scripts or styles, no third-party requests, and game text is written to the page as plain text, never as HTML.
- The leaderboard stores only a nickname, a score and a time. No IP address, no account, no cookies, no analytics.
- The browser computes the score, so the server only checks that it is possible for this game. The leaderboard is a fun extra, not proof of anything.
- Throttling, reserved concurrency and a budget alarm keep a public endpoint from turning into a bill.
- Secret scanning runs in CI and no credentials are stored in the repository.

## What broke and what I learned

1. **A display font with a wide axis broke my layout.** The "Projects" heading ran into the paragraph next to it. I found it in a screenshot review at 1280 px. A width-axis font needs its column sized for the widest word, not the average one.
2. **My architecture diagrams were unreadable at their real size.** Text rendered at about 7 px. I stacked each diagram under its text, raised the font sizes and put the diagram in a keyboard-focusable scroll box on phones. Lesson: judge a diagram at the size people see it, not the size you drew it.
3. **A strict Content Security Policy forbids inline scripts and styles.** I planned for it before writing code and proved it by running the browser test against a server that sends the production headers. Lesson: adopt security headers before the first line of markup, not after.
4. **A browser test failed and the product was fine.** The test read the wrong status line. When a test fails, check whether the test or the product is wrong before changing the product.

## Results

- Lighthouse on mobile, run locally with the production headers: Performance 95, Accessibility 100, Best Practices 100, SEO 100. Largest contentful paint 1.0 s, layout shift 0, 208 KiB transferred. [Re-run on the live URL and update these numbers. Screenshot 17.]
- 13 unit tests for the game logic, 12 for the Lambda, and a browser test that plays the full game on desktop and a 360 px phone, with the leaderboard mocked, offline and with storage blocked.
- Spend so far: [read it from AWS Billing and write it here].

## What I would do next

- More findings, grouped into levels (identity, network, data), written from incidents I have handled.
- A "fix it for real" mode that shows the exact CLI command or Terraform diff for each correct answer.
- Per-finding timing so the leaderboard can rank by speed on a single finding.
