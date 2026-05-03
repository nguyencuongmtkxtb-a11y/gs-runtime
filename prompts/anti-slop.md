# Anti-AI-Slop Checklist

Apply this checklist to EVERY design output. Any violation means the output is not acceptable.

## Text & Content

- [ ] **NO generic placeholder text** — No "Lorem ipsum", "Content goes here", "Sample text", "Your text here"
- [ ] **NO AI-slop phrases** — Avoid "In today's fast-paced world", "Unlock your potential", "Revolutionary", "Game-changing"
- [ ] **All copy is contextual** — Text must relate to the specific brief/domain, not generic templates
- [ ] **Headlines have weight** — Display text shouldn't read like body copy

## Color

- [ ] **Colors from design system ONLY** — No ad-hoc hex values outside the active design system
- [ ] **No rainbow/gradient vomit** — Colors serve function, not decoration
- [ ] **Sufficient contrast** — Text meets WCAG AA minimum (4.5:1 for body, 3:1 for large text)
- [ ] **Consistent color usage** — Same element = same color across all screens

## Typography

- [ ] **Fonts from curated stack ONLY** — No system defaults (Times New Roman, Arial) unless specified
- [ ] **No Comic Sans / Papyrus / Impact** — Never use novelty fonts unless the brief explicitly requests them
- [ ] **Proper hierarchy** — Clear H1/H2/H3/body distinction
- [ ] **Readable sizes** — Body text never below 14px on desktop, 16px on mobile

## Layout & Spacing

- [ ] **Consistent spacing** — Use design system spacing scale, no random pixel values
- [ ] **No floating/odd-pixel margins** — All spacing divisible by 4px or 8px
- [ ] **Proper alignment** — Elements align to a grid, not arbitrarily placed
- [ ] **No overflow/hidden content** — All content visible in viewport without horizontal scroll

## Imagery

- [ ] **NO generic stock photo descriptions** — No "diverse team smiling in modern office"
- [ ] **Specific, purposeful imagery** — Every image has a reason to exist
- [ ] **Alt text on all images** — Accessibility requirement
- [ ] **No placeholder icons** — Use real icon sets (Lucide, Phosphor, Heroicons), not emoji as icons

## Brand

- [ ] **Brand consistency** — Colors, fonts, tone match the brief's brand context
- [ ] **No mixed brands** — Don't accidentally use one brand's colors with another's style
- [ ] **Logo usage correct** — Don't stretch, recolor, or add effects to brandmarks

## Technical

- [ ] **Valid HTML** — No unclosed tags, valid attributes
- [ ] **CSS in style tag or inline** — Single-file artifacts should be self-contained
- [ ] **No external dependencies** — No CDN links, API calls, or external scripts unless specified
- [ ] **Mobile responsive** — Design must work at 375px width minimum

## The Golden Rule

**If it looks like an AI made it, scrap it and start over.**

Signs of AI-generated design:
- Glassmorphism cards with blur backgrounds (the #1 AI tell)
- Gradient hero sections with floating abstract shapes
- Inter font at exactly 48px for hero headlines
- Centered text everywhere with no edge alignment
- Three cards in a row with emoji icons
- Purple-to-blue gradients on dark backgrounds
