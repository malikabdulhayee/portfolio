# Write-up kit for the Builder Center project post

The post is 25% of the score and must contain: the creative feature described, screenshots of the
portfolio and the AWS setup, the AWS services used, and what you learned and the challenges you hit.
Capture evidence while you build, not on the last day.

## Screenshot shot list

Name files exactly like this so the post is quick to assemble.

| File name | What to capture | When |
| --- | --- | --- |
| 01-hero-desktop.png | Home page on desktop, hint button visible | After first deploy |
| 02-hero-mobile.png | Same on a real phone | After first deploy |
| 03-game-finding.png | A finding with the resource card and four fixes | Layer 1 |
| 04-game-wrong-hint.png | A wrong pick with its hint | Layer 1 |
| 05-game-unlock.png | An unlock card | Layer 1 |
| 06-casefile-before.png / 07-casefile-after.png | The About case file redacted, then declassified | Layer 1 |
| 08-report.png | The audit report | Layer 1 |
| 09-amplify-app.png | Amplify console: app, connected branch, successful build | First deploy |
| 10-amplify-build-log.png | Build log showing `check-site: OK` | First deploy |
| 11-headers.png | `curl -I` of the live URL showing the security headers | After deploy |
| 12-api-gateway.png | API Gateway routes and throttling | Layer 2 |
| 13-lambda.png | Lambda function and its least-privilege role | Layer 2 |
| 14-dynamodb.png | DynamoDB table with a few scores and TTL enabled | Layer 2 |
| 15-cloudwatch.png | Log group with 14-day retention and the error alarm | Layer 2 |
| 16-budget.png | AWS Budget with its alert thresholds | First deploy |
| 17-lighthouse.png | Lighthouse mobile scores for the live URL | Nov 3 or 4 |
| 18-architecture.png | The diagram from the README (draw.io or the SVG) | Layer 2 |

## Post outline (headings mirror the four judging criteria)

1. **The idea.** Why a security game: "my portfolio is a cloud account with three things misconfigured".
2. **The creative feature.** What visitors do, what they unlock, and how the page itself changes (the case file). Screenshots 03 to 08. Say how the hint works and that navigation never depends on the game.
3. **How it is built on AWS.** Amplify Hosting from GitHub, the build guard (`check-site`), security headers, and the optional serverless leaderboard (API Gateway, Lambda, DynamoDB, CloudWatch, Budgets). Screenshots 09 to 16 and the architecture diagram. List every service and what it does.
4. **Security and cost decisions.** Least-privilege role, throttling, no personal data stored, 60-day TTL, 5 USD budget, game works with the backend switched off.
5. **What broke and what I learned.** Use docs/problem-log.md. Pick the three best stories.
6. **Results.** Lighthouse scores, load time, spend so far, test counts.
7. **What I would do next.**

## 60-second demo script (screen recording)

1. 0-5 s: open the live URL on a phone-sized window. Point at the red hint button.
2. 5-15 s: scroll the page once: About, Skills, Projects, to show it stands alone.
3. 15-25 s: press the hint. Pick a wrong fix on the S3 finding, read the hint.
4. 25-40 s: pick the right fix. Show the unlock card. Do the other two quickly.
5. 40-50 s: show the audit report, then close it and show the case file declassified.
6. 50-60 s: show the Amplify console and the live leaderboard entry.

## Final submission checklist

- [ ] Live Amplify URL loads on desktop and on a real phone, from a private window
- [ ] About, Skills and Projects sections complete and read well
- [ ] The hint is visible on first load and the game works end to end
- [ ] Public GitHub repository with README, architecture diagram and credits
- [ ] No phone numbers or private data on the site
- [ ] Certification list matches your credentials (and CEH version confirmed)
- [ ] Builder Center project created under the hackathon with the feature description
- [ ] Screenshots of the portfolio and the AWS setup attached
- [ ] AWS services documented, with lessons and challenges
- [ ] Budget alarm active and spend checked
- [ ] Every link on the site and in the post clicked once
- [ ] Submitted by the evening of Nov 5, Lahore time (deadline is 11:59 PM PST on Nov 6)
