---
name: RFP Manager
description: A quiet, dense desktop workspace for uploading tender documents and reading what MCP agents read.
colors:
  bg: "#fbfbfc"
  bg-sidebar: "#f5f5f7"
  surface: "#ffffff"
  surface-hover: "#f4f4f6"
  surface-active: "#ececf0"
  border: "#e7e7eb"
  border-strong: "#d5d5db"
  text: "#18181b"
  text-2: "#4b4b53"
  text-3: "#6e6e78"
  accent: "#5b5bd6"
  accent-hover: "#4f4fc8"
  accent-soft: "#efeffd"
  accent-text: "#4a4abf"
  danger: "#c2341f"
  warning: "#9a5600"
  success: "#17754b"
  dark-bg: "#101012"
  dark-surface: "#18181b"
  dark-border: "#26262b"
  dark-text: "#ededef"
  dark-accent: "#6d6ae0"
typography:
  page-title: { fontFamily: "Geist", fontSize: "22px", fontWeight: 600, letterSpacing: "-0.02em" }
  detail-title: { fontFamily: "Geist", fontSize: "20px", fontWeight: 600, letterSpacing: "-0.018em" }
  section: { fontFamily: "Geist", fontSize: "14px", fontWeight: 600 }
  body: { fontFamily: "Geist", fontSize: "14px", fontWeight: 400, lineHeight: 1.5 }
  ui-small: { fontFamily: "Geist", fontSize: "13px", fontWeight: 500 }
  meta: { fontFamily: "Geist", fontSize: "12.5px", fontWeight: 400 }
  reading: { fontFamily: "Geist", fontSize: "14.5px", lineHeight: 1.7, maxWidth: "76ch" }
  code: { fontFamily: "Geist Mono", fontSize: "12.5px" }
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "999px"
---

# Design System: RFP Manager

## Overview

A canonical modern-SaaS workspace in the Linear/Notion register: neutral ladder, one indigo accent, Geist throughout, keyboard-first. Desktop only. The whole app is three surfaces: the RFP list, the New RFP form with a document dropzone, and the RFP page whose default tab is a document library beside a Markdown reader.

All tokens live as CSS custom properties in `app/globals.css`. Light is the default; dark follows the OS unless the user picks one (`html[data-theme]`, persisted in `localStorage["rfp-theme"]`).

## Color

- **Restrained strategy.** Neutrals carry 95% of the surface; indigo (`--accent`) marks primary actions, focus rings, the active tab underline, links in reading text and drag-over states. Nothing else is indigo.
- **Semantic hues** are reserved: `--warning` for a closing date within 7 days, `--danger` for destructive actions and errors, `--success` for a finished upload. Each always carries a text label.
- File-type badges tint their three-letter label only (PDF red, DOCX blue, XLSX/CSV green).

## Typography

Geist for everything, Geist Mono for tender codes, RFP IDs and the Markdown editors. Body 14px; metadata 12.5–13px; page titles 22px; the RFP title 20px, clamped to two lines. Converted documents render at 14.5px / 1.7 with a 76ch measure. Numerals in tables and counts use tabular figures.

## Layout

- Fixed 232px sidebar (brand, search trigger, RFPs, New RFP, Tools, upload progress, theme) and a scrolling main column.
- List and form pages: 1180px max width, 40px side padding.
- RFP page: full-height. Header (breadcrumb, title, chips, tabs) above a body that fills the viewport; the Documents tab is a 340px library column and a reader that scroll independently.

## Components

- **Buttons:** 32px (28px small), 6px radius. Primary is indigo with a subtle inner highlight; secondary is white with a strong border; ghost has no chrome until hover. Keyboard hints render as `.kbd` chips inside the button.
- **Inputs:** white with a strong border and a 3px indigo focus ring.
- **Chips:** 26px pills on the RFP header for tender code (click to copy), closing date (amber when soon), and external links.
- **Tabs:** text tabs with a 2px indigo underline; panels stay mounted so unsaved edits survive tab switches.
- **Dropzone:** dashed 1.5px border that turns indigo on hover/drag; the whole Documents tab is also a drop target with a full-page overlay.
- **Feedback:** toasts bottom-right (`aria-live`), a native `<dialog>` for confirmations, no browser `alert`/`confirm`.
- **Command palette:** Ctrl/Cmd+K, searches RFPs by name or tender code plus a few actions.
- **Skeletons:** every dynamic route has a `loading.tsx` shaped like the real layout so navigation paints instantly.

## Motion

Short and functional: 80–150ms colour transitions, a 140ms pop-in for menus, dialogs and the palette, a toast slide-up, and a transform-based upload progress bar. `prefers-reduced-motion` collapses all of it.

## Do / Don't

- **Do** keep converted text as the primary view of a document; originals are a secondary download.
- **Do** keep every screen to one parallel data round trip and load Markdown bodies on demand.
- **Don't** reintroduce pipeline stages, bid decisions or notes into the UI; they are not part of the workflow.
- **Don't** use indigo for status; don't use colour without a text label.
