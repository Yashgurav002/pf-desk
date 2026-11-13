# PF Desk — design guide

**Who uses it:** an Indian PF consultant (often 50–65, not techy, works from a small office, reads English but thinks in Hindi/Marathi), and the factory workers he serves (phone only). **What they need:** see what to do today, fix a claim before EPFO rejects it, tell the worker, track the money.

**Design language — "the PF office register".** PF work lives in registers, challans and stamped forms. Borrow that: warm paper background, ink-blue, ruled ledger tables with aligned numbers, IDs in a typewriter face, and statuses as small rubber stamps. Calm, competent, a bit dense where the work is dense. It should look like a tool a senior developer built for one trade, not a template.

## Do not (the "AI-generated" tells)
- No gradients (except the skeleton shimmer), no glassmorphism, no glow, no purple/violet, no neon.
- No emoji in UI. Icons are Lucide (`lucide-react`), 16–20px, stroke 1.75–2, muted (`text-ink-3`) unless active.
- No "hero + three identical feature cards with icons in circles". No centered-everything. No giant rounded-3xl cards. No drop shadows bigger than `--shadow-card` except popovers (`--shadow-pop`).
- No marketing filler ("Revolutionize", "Seamlessly", "Unlock", "AI-powered" as a headline). Write like a consultant talks: concrete nouns, numbers, verbs.
- No walls of equal boxes. One primary action per screen region; everything else secondary/ghost.
- No exposing internals in the main line (model names, rule ids, "n=13"). Put them behind `<Why>` or in small `text-ink-3` meta.

## Tokens (Tailwind utilities from `app/globals.css` `@theme`)
- Surfaces: `bg-paper` (page) · `bg-sheet` (cards/tables) · `bg-sunk` (table header, hover, inset) · borders `border-line` / `border-line-strong`.
- Text: `text-ink` · `text-ink-2` (secondary) · `text-ink-3` (meta).
- Brand: `bg-brand` / `text-brand` / `bg-brand-tint` — primary actions, links, active nav, current step. Use sparingly.
- Status: `danger` / `warn` / `ok` (+ `-tint`). Always paired with a word or icon, never colour alone.
- Type: IBM Plex Sans (+ Plex Sans Devanagari for हिं/मरा), IBM Plex Mono for IDs, money, dates in tables, counts, kickers. Base 16.5px. Page title `text-[1.65rem] font-semibold`; section `text-[1.05rem] font-semibold`; meta `text-sm text-ink-3`.
- Radius: `rounded-md` (controls), `rounded-lg` (cards). Nothing rounder except pills/avatars.
- Spacing: 4px grid. Card padding `p-4`/`p-5`. Page sections `space-y-8`.

## Components — `lib/ui.tsx` (use these; add new primitives there, not in pages)
`Button` (primary/secondary/ghost/danger; sm/md/lg; `busy`, `icon`) · `LinkButton` · `Card` · `PageHeader` (kicker, title, description, actions) · `SectionTitle` (count, action) · `Stamp` / `StatusStamp` · `Chip` · `RiskMeter` · `Mono` · `Stat` (tile with tone bar, optional href) · `EmptyState` · `Skeleton` / `SkeletonRows` · `Loading` · `ErrorBox` · `Notice` · `Field` / `Input` / `Select` / `Textarea` · `CopyButton` · `Why` (disclosure for technical detail) · `Steps` (journey tracker) · `cx`.

**Ledger table** (lists of claims, workers, rules): plain `<table className="w-full text-[0.95rem]">` inside `Card` with `overflow-x-auto`; `<thead className="bg-sunk text-left font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">`, `th/td` `px-4 py-2.5`, rows `border-t border-line hover:bg-[#fcfbf8]`, numbers right-aligned in `num font-mono`. Whole row clickable via a link in the first cell + `cursor-pointer`. On phones, switch to stacked list rows (`md:hidden` / `hidden md:table`).

## Layout & flow
- Shell (`app/shell.tsx`): grouped sidebar (Work: Today, Claims · Clients: Companies & workers, Monthly cycle · Tools: Decode a remark, Rule Book, Import · Settings), top bar with search (`/search?q=`), **+ New claim** (`/claims/new`), language, help (`window.dispatchEvent(new Event("pfd:tour"))`). Phone: bottom tabs + drawer.
- Bare pages (own chrome): `/` landing, `/login`, `/help/[token]`.
- Every page: `PageHeader` first. Lead with the answer (counts, the one thing to do), detail below.
- Loading: skeletons shaped like the content, not spinners, for page loads; `Loading` / `busy` buttons for actions. Model calls can take 5–40 s: say what's happening ("Reading the remark…").
- Empty states say what the area is for and give the next action.
- Forms: labels above fields, one column, primary button bottom-left aligned with fields.

## Words
- Plain English, short. "Fix before filing", "Ask the worker for…", "Likely paid by 29 Oct". Hindi/Marathi through `t()` only; every new string goes in your area file in `lib/strings/` (en + hi + mr). Everyday Hindi/Marathi, not Sanskritised; keep PF terms people say (Claim, UAN, KYC, Form 19, PF, Pre-check, WhatsApp).
- Numbers: Indian format (`toLocaleString("en-IN")`), ₹ before amounts, dates `15 Oct 2026`.

## Accessibility
Focus rings visible (global), touch targets ≥ 40px on phone, colour never the only signal, `aria-current` on active nav/steps, images/SVG decorative `aria-hidden`.
