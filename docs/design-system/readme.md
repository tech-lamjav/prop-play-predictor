# Smart Betting — Design System

Design system for **Smart Betting** (a.k.a. *Prop Play Predictor*), a Brazilian sports-betting **analytics** platform. It surfaces data-driven betting *opportunities* — NBA player props, futebol (soccer) value bets, and a World-Cup **Bolão** (prediction pool) — with a strong "data / professional" identity, in Portuguese (pt-BR).

This is a reference distillation of the product's current visual direction (the **rebrand "Direção A"** — a light theme built on forest green + amber). Link `styles.css` to pick up every token and font; mount the React primitives from `window.SmartBettingDesignSystem_c8cd28`.

## Sources
Built by reading the product codebase directly (nothing is invented):
- **GitHub:** `tech-lamjav/prop-play-predictor` — **branch `develop`** (the requested, most current branch; its design tokens are identical to `main`, with a light-first body default). https://github.com/tech-lamjav/prop-play-predictor
  - Tokens: `tailwind.config.ts`, `src/index.css` (`.theme-rebrand` / `.theme-bolao`)
  - Components: `src/components/ui/*` (shadcn/ui base + rebrand `forest`/`amber` variants), `src/components/nba-home/*` (briefing, hero, games)
  - Rebrand spec: `docs/futebol-rebrand-guia-visual.md`, `REBRAND_NBA.md`
- **Related repos** (data pipeline, explore for deeper product context): `tech-lamjav/data-engineering`, `tech-lamjav/analytics-engineering`.

You can explore these repositories to build more faithful, deeper designs for this product.

---

## Index / manifest

**Root**
- `styles.css` — entry point; `@import`s the token files below (link this one file).
- `thumbnail.html` — homepage tile.
- `SKILL.md` — Agent-Skill wrapper.

**`tokens/`** — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `utilities.css`.

**`components/`** — reusable React primitives (`export function`, driven by CSS vars):
- `core/` — **Button, Badge, Card** (+ CardHeader), **Input, Switch, Tabs**
- `patterns/` (rebrand composites lifted from the app) — **KpiTile, Chip, SectionHeader, StatMetric, PlayerAvatar**

**`ui_kits/`** — full-screen product recreations:
- `nba/index.html` — NBA daily home (briefing → top-pick hero → hot-opportunities + key-injuries rail → games → quick access)
- `nba/game-detail.html` — game detail (3-col matchup header, comparison strip, matchup callout, box score, opps)
- `nba/player-dashboard.html` — player dashboard (header, performance bars vs line, recent games, matchup zones)
- `futebol/index.html` — Futebol value board (day stepper, briefing KPIs, best-value hero, opportunity cards + game rail)
- `bolao/index.html` — Bolão Copa 2026 (countdown hero + dual CTA, my-pools cards, Copa table)

**`templates/`** — starting-point Design Components consuming projects can pick from: `nba-home/` (NBA — Home diária), `futebol-hoje/` (Futebol — Hoje), `bolao-copa/` (Bolão — Copa 2026).

**`guidelines/cards/`** — foundation specimen cards (Colors, Type, Spacing, Brand) shown on the Design System tab.

**`assets/`** — `logo-full.png` (navy+teal, on light), `logo-white.png` (reversed), `logo-mark.png` (hexagon mark), `favicon.svg`, plus product screenshots (`screenshot-nba.png`, `screenshot-betinho.png`, `dashboard.jpeg`) for reference.

### Components at a glance
`Button` · `Badge` · `Card` · `CardHeader` · `Input` · `Switch` · `Tabs` · `KpiTile` · `Chip` · `SectionHeader` · `StatMetric` · `PlayerAvatar`

---

## Content fundamentals

- **Language:** Portuguese (pt-BR), always. UI copy, labels, everything.
- **Voice:** analytical, confident, concise — a sharp analyst, not a hype-man. Copy states *what the data shows*, e.g. *"Reaves rende +34% em pontos quando Doncic fica fora — e é o que deve acontecer hoje contra MIN."* Narrative sentences pair a claim with its driver (the injury "gatilho").
- **Person:** addresses the product's findings impersonally ("oportunidades analisadas", "projeção com filtro"), not "you/we". No slang, no gambling bravado.
- **Casing:** sentence case for headlines and body. UPPERCASE only for micro-labels/eyebrows ("DESTAQUE DO DIA", "HOJE NA NBA", "JOGOS HOJE") with wide letter-spacing.
- **Numbers are the hero:** projections, edges (`+15%`), lines (`24.5`), scores (`87/100`), star ratings (★). Always tabular figures. Deltas carry sign + `%`. A 0–100 "score" ranks opportunities.
- **Domain vocabulary:** *oportunidade* (opportunity/pick), *gatilho* (trigger — usually an injury), *linha* (betting line), *vantagem / edge*, *projeção*, *3★* (confidence), *Bolão*, *Betinho* (the WhatsApp assistant), *B2B* (back-to-back), *lesões* (injuries).
- **Emoji:** not used in-product. (A few appear in repo docs only.) Don't add them.
- **Vibe:** trustworthy sports terminal made warm — precise data presented on a calm, cozy light canvas.

---

## Visual foundations

The current direction is **light-first** ("Direção A"). *(A legacy dark "terminal" theme — blue/grey, JetBrains Mono — still exists for some data-dense NBA screens; treat it as legacy. Build new work in the light rebrand.)*

- **Color:** off-white canvas `#f6f7f5` with **forest green `#0a3d2e`** as primary (actions, links, positive outcomes) and **amber `#d4a017`** (and brighter `#fbbf24` on dark) as the single accent — KPI values, hero CTAs, highlight chips. Warm, restrained status colors. Text is near-black ink `#1a1d1a` → muted `#5a625a` → hint `#9aa097`. **Max one accent** — resist adding more hues. Note the *brand-logo* palette is teal `#46c1ac` + navy `#223244` (the hexagon mark); the app UI deliberately shifted to forest for the product surfaces, so use forest for UI and teal/navy only around the logo itself.
- **Type:** **Inter** for everything — UI and display alike. Headlines are semibold (600) with tight tracking (`-0.02em`); the rebrand explicitly *dropped Fraunces* to keep the "data/professional" identity. **JetBrains Mono** only on legacy terminal screens. All figures use `tabular-nums`. Micro-labels are uppercase 9–11px with `0.14–0.2em` tracking.
- **Backgrounds:** flat off-white; no busy patterns. The one signature flourish is the **hero**: a forest gradient `linear-gradient(135deg,#0a3d2e,#08321f 60%,#051f12)` with an **amber radial glow** in a corner and a faint dot pattern. No stock photography as background; player photos sit in rounded tiles with a forest-gradient fallback.
- **Cards:** white surface, **1px hairline border (`#e3e6e0`)**, **20px radius** (the signature `rounded-xl`), generous `p-5`/`p-6` padding. Hierarchy comes from **border + background color, not shadow.**
- **Shadows:** used sparingly. Default = border only. Dropdowns/search get a soft pop (`0 10px 30px -10px rgba(0,0,0,.15)`); dramatic elevation (`0 12px 32px rgba(0,0,0,.12)`) is a rare exception.
- **Radii:** 6 / 10 / 14 / 20 / 24px. Buttons 10px; cards 20px; hero 24px; pills full.
- **Borders:** 1px hairlines everywhere (`--line #e3e6e0`, stronger `--line-2 #d4d8d0`). Table headers sit on `--canvas-2`.
- **Spacing:** 4px grid; the "aconchego" (coziness) rule = roomy padding (20/24) and `gap-5/6` between sections.
- **Motion:** understated. 0.15s color/background transitions on hover; entrance eases use `cubic-bezier(0.16,1,0.3,1)`; celebratory moments use a bounce `cubic-bezier(0.34,1.56,0.64,1)`. Respects `prefers-reduced-motion`.
- **Hover:** links darken (forest → `#1f5640`); buttons shift to the `-2` shade; cards gain a faint shadow + green-tinted border; ghost/secondary fill with `canvas-2`.
- **Press / active:** color deepening (no scale-shrink in the app).
- **Transparency / blur:** minimal. On the dark hero, chips use `rgba(255,255,255,.1)`; the amber glow is a low-opacity radial. No glassmorphism on light surfaces.
- **Imagery tone:** player/team photos are full-color, top-cropped in rounded tiles; missing images fall back to initials on a neutral or forest-gradient chip. No filters/grain.
- **Positive vs negative:** the app codes **good outcomes green (forest)**, not the usual green/red split — red/danger is reserved for injuries/errors.

---

## Iconography

- **Library:** **[Lucide](https://lucide.dev)** (`lucide-react` in the app) — thin, rounded-stroke line icons. This IS the icon system; use Lucide for everything. The UI kit loads it from CDN (`unpkg.com/lucide@0.462.0`). Common glyphs: `Search`, `ChevronRight`, `ArrowRight`, `Star`, `FileText`, `LayoutGrid`, `AlertTriangle`, `Crown`.
- **Star ratings:** the confidence rating uses the Unicode **★** glyph (amber), not an SVG, sized inline with the text — keep that convention.
- **Logos / brand mark:** the hexagon-with-bar-chart mark in `assets/` (`logo-full.png`, `logo-white.png`, `logo-mark.png`) and `favicon.svg` (emerald bar-chart glyph). **Use these files — do not redraw the mark.**
- **Team / player imagery:** loaded as remote photos in the app (ESPN/NBA CDNs) with initials fallback; in static mocks prefer the initials fallback (`PlayerAvatar`) so nothing depends on the network.
- **Emoji:** not used as icons. Avoid.

---

## Caveats / substitutions
- **Fonts:** the app ships `@fontsource-variable/inter`; this system loads **Inter from Google Fonts** (closest hosted match) plus **JetBrains Mono**. If you have the exact variable webfont files, drop them in and I'll wire `@font-face` (the compiler currently reports 0 self-hosted fonts because they're loaded via Google's `@import`). **Fraunces was intentionally excluded** (dropped by the rebrand).
- **Icons** are linked from the Lucide CDN rather than vendored.
