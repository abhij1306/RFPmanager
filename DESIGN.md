---
name: RFP Manager
description: A calm, compact workspace for bid and proposal teams.
colors:
  canvas: "#f7f7f8"
  surface-muted: "#f1f1f3"
  surface-panel: "#fff"
  surface-recessed: "#e9e9ed"
  border: "#e7e7e9"
  border-strong: "#d9d9dc"
  text-primary: "#18181b"
  text-secondary: "#3f3f46"
  text-muted: "#5f6168"
  text-placeholder: "#5f6168"
  indigo: "#5e6ad2"
  indigo-hover: "#4f58c4"
  indigo-soft: "#f0f1fc"
  indigo-border: "#ccd1f6"
  success: "#0b6b4a"
  success-soft: "#eff8f3"
  warning: "#92580d"
  warning-soft: "#fdf6ea"
  danger: "#b42318"
  danger-soft: "#fef2f2"
  dark-canvas: "#0e0e0e"
  dark-surface-muted: "#151515"
  dark-surface-panel: "#1a1a1a"
  dark-surface-recessed: "#282828"
  dark-border: "#272727"
  dark-text-primary: "#eee"
  dark-text-secondary: "#bdbdbd"
  dark-text-muted: "#a3a3a3"
  dark-text-placeholder: "#858585"
typography:
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 650
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "12px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.indigo}"
    textColor: "#fff"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.indigo-hover}"
  button-ghost:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 14px"
  input:
    backgroundColor: "{colors.surface-recessed}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    height: "36px"
  panel:
    backgroundColor: "{colors.surface-panel}"
    rounded: "{rounded.md}"
  filter-active:
    backgroundColor: "{colors.indigo-soft}"
    textColor: "{colors.indigo-hover}"
---

# Design System: RFP Manager

## Overview

**Creative North Star: "The Calm Workbench"**

The application is a compact working surface for reviewing opportunities, source documents, bid decisions, and response drafts. Its visual language comes from CrawlerAI Design System v4: Geist type, restrained indigo, neutral surface steps, and a 4px spacing rhythm. Information is dense enough for daily work but separated into legible panels and clear next actions.

**Key Characteristics:**

- Neutral canvas and white panels in light mode; charcoal surfaces in dark mode.
- Indigo marks actions, selected navigation, and focused controls.
- Semantic status colors communicate decisions and dates with text as well as color.

## Colors

The palette pairs a quiet neutral ladder with one indigo accent. The frontmatter records the implemented light and dark colors; `html[data-theme="dark"]` in `app/design-system.css` switches the corresponding CSS variables at runtime.

### Primary

- **Workbench Indigo** (`--brand-accent`): Primary actions and the focus outline. Its hover token colors hovered actions and links; its soft and border tokens mark selected items.

### Neutral

- **Canvas / Panel / Well** (`--bg-base`, `--bg-panel`, `--bg-well`): Page background, card surface, and recessed form control surface.
- **Muted Surface** (`--bg-alt`): Headers and selected navigation.
- **Ink Tiers** (`--text-primary`, `--text-secondary`, `--text-muted`): Hierarchy for titles, supporting content, and metadata. `--text-subtle` is reserved for placeholders.
- **Rules** (`--border-subtle`, `--border`, `--border-strong`): Dividers and control edges.

### Semantic States

- **Success, Warning, Danger:** Decision labels, date urgency, and status summaries use `--success-*`, `--warning-*`, and `--danger-*` text and soft background pairs. Each state has a readable label; color never carries the meaning alone.

**The One Accent Rule.** Use indigo for interaction and selection; reserve semantic hues for their corresponding status meanings.

## Typography

**Display and body font:** Geist with system sans-serif fallbacks. **Code font:** Geist Mono with monospace fallback.

The interface uses a compact ladder. Page headings are 24px on desktop and 21px on narrow screens; section headings are 20px or 16px; the standard body and controls use 14px at 1.5 line height. Small metadata uses 13px. Uppercase navigation and table labels use 12px, 600 weight, and 0.06em tracking. Long reading content uses up to 75ch per paragraph and 1.7 line height.

**The Reading Rule.** Keep documents in the Geist reading style with comfortable line spacing; use Geist Mono for code and raw data only.

## Layout

The desktop frame uses a 232px sticky sidebar and a flexible main column. A 60px top bar sits above content. The main shell is capped at 1510px with 32px side gutters and 32px top padding. The 4px spacing rhythm produces 4, 8, 12, 16, 20, 24, and 32px steps. Panels and work areas use these steps for gaps and internal padding.

The desktop pipeline table has an 840px minimum width and scrolls within its panel on intermediate widths. Workspace tabs scroll horizontally. At 900px and below, navigation moves to a two-column strip above content, the shell uses 20px gutters, and overview columns stack. At 600px and below, the pipeline switches to stacked list items that expose closing date and bid decision immediately; gutters become 16px, the top bar is 48px, controls can fill the available width, and facts stack. The document navigator and reader stack at 720px and below.

## Elevation & Depth

Surface fill and borders establish most depth. Panels carry a restrained `--shadow` (`0 1px 2px rgba(24,24,27,.06)` in light mode). Menus and dialogs can use the stronger `--shadow-md` and `--shadow-modal`. Dark mode increases shadow opacity while relying on distinct charcoal fills.

**The Quiet Surface Rule.** Use the light shadow for resting work panels; save stronger elevation for content that floats above the page.

## Shapes

Controls and navigation links use gently curved 6px corners. Cards and workspace panels use 10px corners; small icons and inline code use 4px. Pills use a fully rounded shape. Borders are thin and neutral, with indigo border color for selected or interactive states.

## Components

### Buttons

Primary buttons use the indigo fill, white text, 36px minimum height, 14px horizontal padding, and 6px corners. Hover shifts to the indigo hover token. Ghost buttons use the panel fill and strong neutral border. Compact variants use a 32px minimum height. Disabled buttons lower opacity and show a disabled cursor.

### Inputs / Fields

Inputs, selects, and textareas sit on the recessed well with a transparent border and 6px corners. Focus brings the surface to panel white, turns the border indigo, and adds the theme's soft focus ring. Placeholders use the subtle text tier. Validation and status messages use semantic colors.

### Navigation

Sidebar links are 36px high with 6px corners. Hover uses the muted fill; the active link uses the recessed fill and `aria-current="page"`. The top bar contains the theme toggle. At narrow widths, the sidebar becomes a horizontal page section with a two-column navigation grid.

### Cards / Containers

Panels use the panel surface, a neutral 1px border, 10px corners, and the light resting shadow. Board items use 8px corners, 14px padding, and a subtle hover border. Overview actions keep their title, explanation, and next step in one bounded row.

### Pipeline Filters and Status

Filters use compact 13px labels; the active filter receives indigo text on an indigo soft fill. Table headers use uppercase 12px labels; text columns align with their headers, while closing dates and source counts are centered. Rows retain 14px content and a muted hover fill. Decision labels pair a colored dot with explicit text.

### Document Workspace

Tabbed work areas keep 48px high tabs and an indigo underline for the active tab. Document navigation and reading surfaces are distinct panels; long content scrolls within the reader. Markdown headings, lists, quotes, code, and tables have reading-specific styles, with tables able to scroll horizontally.

All interactive controls use the global 2px indigo `:focus-visible` outline with 2px offset and a soft ring. Motion is short (0.1–0.15s); reduced-motion preferences shorten transitions and animations.

## Do's and Don'ts

### Do:

- **Do** use the CSS custom properties in `app/design-system.css` so both themes follow the same component rules.
- **Do** express status with clear words beside semantic color.
- **Do** maintain the 4px spacing rhythm and the compact Geist type ladder.
- **Do** preserve visible keyboard focus and scroll access to wide tables and tab sets.

### Don't:

- **Don't** use the warm green visual styling from the workflow prototype as the product identity.
- **Don't** use indigo to imply a bid decision or a closing-date warning.
- **Don't** flatten document text into tiny, tightly packed UI labels.
