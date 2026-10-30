# Problem log

Keep adding to this as you build. It is the raw material for the "challenges and what I learned"
part of the Builder Center post (25% of the score is communication). Each entry: what broke, how
it was found, what fixed it, what you would do differently.

## From the first build session (Oct 29)

| What broke | How it was found | Fix | Lesson |
| --- | --- | --- | --- |
| The extra-wide "Projects" heading ran into the paragraph next to it | Screenshot review at 1280 px | Widened the heading column from 11 rem to 14 rem and trimmed the heading size | A width-axis display font needs its column sized for the widest word, not the average one |
| Architecture diagrams were unreadable at their on-page size (text rendered at about 7 px) | Screenshot review of the Projects section | Stacked each diagram under its text at a larger size, raised the diagram font sizes, and put diagrams in a keyboard-focusable scroll box on phones | Judge a diagram at the size people see it, not the size you drew it |
| Lighthouse flagged the logo link: its accessible name did not match its visible text | Lighthouse run against the local site | Made the label start with the visible text ("AH Abdul Hayee, back to top") | Speech-control users say what they see, so labels must contain the visible words |
| A strict Content Security Policy forbids inline scripts and styles | Planned before writing code, then proved by running the full browser test against a server that sends the real headers | Built all styling with classes and set no inline `style` attributes or event handlers; a build-time check enforces it | Security headers are easiest to adopt before the first line of markup, not after |
| A browser test failed on the leaderboard form | Test run | The test read the wrong status line (there are two on the report). The page was correct; the selector was ambiguous | When a test fails, check whether the test or the product is wrong before changing the product |

## Add your own below

| What broke | How it was found | Fix | Lesson |
| --- | --- | --- | --- |
| | | | |
