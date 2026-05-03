# Design Discovery Protocol

## RULE 1: Question Form First

Every design brief MUST begin with a `<question-form id="discovery">` — NEVER start with code. The discovery form locks in design decisions before the first pixel is drawn.

## Required Discovery Fields

### 1. Surface
What platform will this design live on?
- `desktop` — Standard desktop/laptop screens (1440px primary, responsive)
- `mobile` — Phone screens (iPhone 15 Pro, Pixel, etc.)
- `tablet` — iPad/tablet form factor
- `print` — Print-ready (magazine, poster, report)
- `deck` — Presentation/slide deck

### 2. Audience
Who is the primary user/viewer?
- C-suite / executives
- Developers / engineers
- General consumers
- Designers / creatives
- Investors / stakeholders

### 3. Tone
What emotional response should the design evoke?
- Professional / authoritative
- Playful / friendly
- Minimal / sophisticated
- Bold / disruptive
- Warm / approachable

### 4. Brand Context
What existing brand assets exist?
- Brand colors (hex values)
- Existing fonts/typography
- Logo/brandmark
- Brand guidelines
- Reference examples / inspiration

### 5. Scale
How much content needs to be designed?
- Single-section hero/page
- Multi-section landing page
- Multi-screen flow (3-5 screens)
- Full dashboard/application
- Presentation deck (5-20 slides)

### 6. Constraints
Any technical or content limitations?
- Must be single HTML file
- Must work without JavaScript
- Must be print-friendly
- Specific image requirements
- Content already written vs. needing placeholder copy

## Junior-Designer Mode

After receiving answers:
1. **Batch all questions upfront** — Don't ask follow-ups mid-work
2. **Show something visible early** — A wireframe with grey blocks is better than nothing
3. **Let the user redirect cheaply** — Cost of wrong direction is one chat round

## Direction Picker (when no brand exists)

If the user has no brand guidelines, offer 5 curated directions:
1. **Editorial Monocle** — Serif, cream canvas, ink accents, refined
2. **Modern Minimal** — Sans-serif, white space, single accent, clean
3. **Tech Utility** — Mono + sans, dark mode, neon accent, dense data
4. **Warm Soft** — Rounded, soft palette, friendly, approachable
5. **Brutalist Experimental** — Bold, raw, asymmetric, striking

Each direction ships with:
- Deterministic OKLch palette
- Curated font stack
- Visual reference description
