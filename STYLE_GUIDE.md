# DedupeMQ Style Guide

## Framework & Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4** — no custom theme extensions, pure utility classes
- **Lucide React** for all iconography
- No component library — fully bespoke UI

---

## Typography

| Role | Size | Weight | Extras |
|---|---|---|---|
| Labels / Section headers | `text-[9px]`–`text-[10px]` | `font-bold` | `uppercase tracking-widest` / `tracking-[0.2em]`, `text-slate-400` |
| Micro labels | `text-[8px]` | `font-bold` | `uppercase tracking-tighter` |
| Body text | `text-[11px]`–`text-xs` (12px) | `font-medium` | `text-slate-600`–`text-slate-700` |
| Small inputs | `text-xs` | default | — |
| Standard inputs | `text-sm` (14px) | default | — |
| Card values / Names | `text-[14px]`–`text-lg` | `font-bold` | `text-slate-800` |
| Card titles | `text-sm`–`text-xl` | `font-bold` | `text-slate-800` |
| Page title | `text-3xl` | `font-bold` | `text-slate-800` |

Font family: `font-sans` (system default).

---

## Color System

### Base / Neutral (Slate)

| Use | Token |
|---|---|
| Page background | `bg-slate-50/80` |
| Card body | `bg-white/95` |
| Card header | `bg-slate-50/80` |
| Input background | `bg-slate-50` |
| Inner panels | `bg-slate-50/50` / `bg-slate-50/30` |
| Muted text | `text-slate-400` (labels), `text-slate-500` (secondary) |
| Body text | `text-slate-600`–`text-slate-700` |
| Heading text | `text-slate-800` |
| Primary text | `text-slate-900` |
| Borders | `border-slate-200/50`–`border-slate-200/60` |
| Subtle dividers | `border-slate-100` / `border-slate-100/60` |
| Modal overlay | `bg-slate-900/40` |

### Semantic / Accent Colors

| Color | Role | Usage |
|---|---|---|
| **Blue** | Primary action, brand | Buttons (`bg-blue-500`), focus rings (`ring-blue-500/10`), input focus borders (`border-blue-400`), shadows (`shadow-blue-500/20`), link text (`text-blue-500`), tier 2 tight badge |
| **Green / Emerald** | Success, deterministic, enriched | Tier 1 badge (`bg-green-100 text-green-800`), passed status, enriched field indicators (`bg-green-50 text-green-700`), merge result column, existing record icon |
| **Amber** | Warning, near-miss, primary indicator | Near-miss status badge, star (primary) indicator (`text-amber-400 fill-amber-400`), tier 2 loose badge |
| **Orange** | Caution, tier 3, incoming | Tier 3 badge (`bg-orange-100 text-orange-800`), incoming record column (`border-orange-500`), step 1 region, mobile opt-out flag |
| **Red / Rose** | Destructive, danger, opt-out | Delete buttons (`hover:text-red-500`), email opt-out flag (`bg-red-50 text-red-700`), different comparison status (`bg-rose-100`) |
| **Purple / Violet** | Special tags, fuzzy | Low SES flag (`bg-purple-50 text-purple-700`), StudyLink ID, fuzzy comparison status (`bg-violet-100`) |

### Tier Badge Colors

| Tier | Background | Text |
|---|---|---|
| T1 — Deterministic | `bg-green-100` | `text-green-800` |
| T2 — Tight | `bg-blue-100` | `text-blue-800` |
| T2 — Loose | `bg-yellow-100` | `text-yellow-800` |
| T3 — Flag Only | `bg-orange-100` | `text-orange-800` |

---

## Border Radius Scale

- Small tags: `rounded` (4px)
- Badges / small containers: `rounded-lg` (8px)
- Buttons / inputs: `rounded-xl` (12px)
- Cards / panels: `rounded-2xl` (16px)
- Major containers: `rounded-[2rem]` (32px)
- Pills / role badges: `rounded-full`

---

## Shadows & Depth

| Level | Token | Use |
|---|---|---|
| Subtle | `shadow-sm` | Badges, small cards |
| Inner | `shadow-inner` | Inner panels |
| Medium | `shadow-lg` | Match cards, buttons |
| Elevated | `shadow-xl` | Primary cards |
| Modal | `shadow-2xl` | Merge workbench modal |
| Colored | `shadow-blue-500/20`, `shadow-orange-500/20` | CTAs |
| Ring | `ring-1 ring-slate-900/5` | Card depth |
| Focus ring | `ring-2 ring-blue-500/20`, `ring-4 ring-blue-500/10` | Inputs |

---

## Effects

- **Backdrop blur**: `backdrop-blur-sm` (banners), `backdrop-blur-md` (headers), `backdrop-blur-xl` (modal overlay)
- **Opacity variants**: Widespread use of `/50`, `/60`, `/70`, `/80`, `/90`, `/95` on backgrounds and borders
- **Text selection**: `selection:bg-blue-200`
- **Transitions**: `transition-all`, `transition-colors` — default durations (150ms)

---

## Animation Patterns

- **Enter**: `animate-in fade-in slide-in-from-top-2`, `animate-in fade-in slide-in-from-left-2`, `animate-in fade-in zoom-in-95`
- **Button press**: `active:scale-95`, `active:scale-[0.98]`
- **Merge animation**: `transition-all duration-500 ease-out` + `opacity-0 scale-95` (master), `opacity-0 translate-x-32` (slave), `scale-[1.02]` (result)
- **Staggered delays**: `duration-700 delay-75`, `duration-700 delay-150` for cascading contact point animations

---

## Component Patterns

### Cards

```
bg-white/95 rounded-[2rem] shadow-xl border border-slate-200/50 overflow-hidden ring-1 ring-slate-900/5
```

- Header: `bg-slate-50/80 backdrop-blur-md px-6 py-4 border-b border-slate-200/60`
- Icon + bold title in header
- Body: `p-6 space-y-5`

### Primary Button

```
bg-blue-500 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-500/20
hover:bg-blue-600 active:scale-[0.98] disabled:opacity-40 transition-all
```

### Secondary Button

```
bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl font-bold text-slate-500
shadow-sm transition-all active:scale-95
```

### Tertiary / Ghost Button

```
text-slate-500 hover:bg-slate-200/50 transition-colors active:scale-95
```

### Text Input

```
w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl
focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none text-sm transition-all
```

- With icon: `relative group` wrapper + `absolute left-3.5 top-3 text-slate-400 group-focus-within:text-blue-500`

### Labels

```
text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1
```

### Status Badges

```
text-[9px] uppercase font-bold px-2.5 py-1 rounded-lg border shadow-sm
bg-{color}-100 text-{color}-700 border-{color}-200
```

### Modal / Dialog

```
// Overlay
fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-4 lg:p-8 z-50

// Content
bg-white/95 w-full max-w-7xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]
animate-in fade-in zoom-in-95 duration-300 ease-out ring-1 ring-slate-900/5
```

### Table

```
w-full text-left border-collapse
// Header: bg-slate-50/90 backdrop-blur-md sticky top-0
// Rows: hover:bg-slate-50/60 transition-colors
// Dividers: divide-y divide-slate-100/60
```

### Tree / Contact List

```
relative pl-4 border-l border-slate-200/60 space-y-2 py-2 ml-1
// Horizontal connectors: absolute -left-[17px] top-1/2 w-3 border-t border-slate-200/60
```

### Empty State

```
bg-white/50 rounded-2xl p-8 border border-dashed border-slate-200 flex flex-col items-center justify-center
```

---

## Layout Patterns

- **Page**: `min-h-screen bg-slate-50/80 p-8`
- **Main grid**: `grid grid-cols-1 lg:grid-cols-12 gap-8` — sidebar 4 cols, main 8 cols
- **Header**: `mb-6 flex flex-col xl:flex-row xl:items-end justify-between gap-4`
- **Responsive breakpoint**: `lg` (1024px) for grid switch, `xl` for header layout, `md` for modal columns, `sm` for visibility toggles

---

## UX / UI Principles

1. **Progressive disclosure** — Collapsible rule waterfall, expandable deep-compare cards, preview-on-selection in workbench
2. **Guided workflows** — Numbered steps (Step 1 → Step 2 → Step 3) with color-coded regions
3. **Real-time feedback** — Duplicate detection triggers live as the user types
4. **Status-at-a-glance** — Color-coded tier badges, risk level indicators, evidence chips
5. **Transparency** — 3-way diff view in merge workbench, detailed impact reports post-merge
6. **Safety & compliance** — Privacy notice banner, preserved flags highlighted in green, destructive action confirmation
7. **Micro-interactions** — Button press scale (`active:scale-95`), hover transitions, merge animation with staggered contact point exits
8. **High information density** — Compact `text-[9px]`–`text-[11px]` labels with tree structures and indented contact lists
9. **Subtle glassmorphism** — `backdrop-blur` + semi-transparent backgrounds (`/80`, `/90`, `/95`) for depth layering
10. **Consistent icon pairing** — Every section header and data row pairs a Lucide icon (`size={12}`–`size={20}`, `text-slate-400`) with text for quick scanning
