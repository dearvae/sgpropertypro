---
name: AI Agent Learning Guides
description: A calm, bilingual workshop guide for practical classroom actions.
colors:
  learning-orange: "#e8890c"
  action-orange: "#b85e00"
  classroom-ink: "#1a1a1a"
  paper-cream: "#faf6ee"
  warm-margin: "#f3ecdd"
  chalk-white: "#ffffff"
  soft-note: "#55504a"
  divider: "#e6ddc9"
  gold-marker: "#b8963e"
  success-green: "#287b3b"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, Segoe UI, sans-serif"
    fontSize: "clamp(2.25rem, 5.6vw, 4.9rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "0.02em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, Segoe UI, sans-serif"
    fontSize: "1.3125rem"
    fontWeight: 800
    lineHeight: 1.4
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, Segoe UI, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.85
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
rounded:
  control: "999px"
  compact: "14px"
  surface: "18px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "20px"
  lg: "28px"
  section: "44px"
components:
  button-copy:
    backgroundColor: "{colors.action-orange}"
    textColor: "{colors.chalk-white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 22px"
  toggle-active:
    backgroundColor: "{colors.classroom-ink}"
    textColor: "{colors.chalk-white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 26px"
  guide-card:
    backgroundColor: "{colors.chalk-white}"
    textColor: "{colors.classroom-ink}"
    rounded: "{rounded.surface}"
    padding: "24px 26px"
---

# Design System: AI Agent Learning Guides

## Overview

**Creative North Star: "The Calm Workshop Guide"**

The public learning surfaces feel like a patient instructor has already prepared the desk: warm paper, dark ink, one unmistakable orange action, and enough space to read from across a table. The system is practical and reassuring rather than promotional. It uses large labels, plain-language demonstrations, and visible state changes so a learner never needs to infer what a control did.

The visual identity is intentionally contained to the `/ai-agent` learning surfaces. It may borrow the confidence and single-decision clarity of public wayfinding, but it stays recognisably the same warm guide as the incumbent pre-class page.

**Key Characteristics:**

- Warm paper ground with white work surfaces.
- High-contrast ink for instructions and a single orange action colour.
- Rounded, generous controls that remain easy to target.
- Short, sequential demonstrations with obvious success states.
- Chinese and English share the same hierarchy and component geometry.

## Colors

The palette resembles printed workshop notes marked with one confident orange pen.

### Primary

- **Learning Orange:** Marks the current route stop, highlighted words, and the optional-course accent.
- **Action Orange:** The deeper orange used for copy controls, links, and the route-to-class call to action.

### Secondary

- **Gold Marker:** Supports dashed prompt boundaries and secondary guidance; it never competes with the current orange action.
- **Success Green:** Confirms completed checks and copied states with accompanying text or an icon.

### Neutral

- **Classroom Ink:** Primary text and the strongest active control state.
- **Paper Cream:** The page ground and broad quiet regions.
- **Warm Margin:** Secondary page ground and inactive control wells.
- **Chalk White:** Work surfaces, result bubbles, and text on dark controls.
- **Soft Note:** Explanations and secondary metadata; not used below accessible contrast at body size.
- **Divider:** Subtle rules and surface boundaries.

### Named Rules

**The One Orange Action Rule.** At any decision point, orange identifies the next action; surrounding controls stay ink, white, or warm neutral.

**The Meaning Beyond Colour Rule.** Success, warning, optional, and active states always carry words or a distinct shape in addition to colour.

## Typography

**Display Font:** Native UI sans stack with Chinese system fallbacks
**Body Font:** Native UI sans stack with Chinese system fallbacks

**Character:** Familiar operating-system typography reduces setup friction and remains legible in mixed Chinese/English copy. Hierarchy comes from decisive weight and scale, not ornamental type.

### Hierarchy

- **Display** (800, responsive 42–78px, 1.02–1.15): One short class thesis; the larger ceiling is reserved for the class-day first viewport.
- **Title** (800, 21px, 1.4): Major guide steps and working states.
- **Body** (400, 17px desktop and 16px mobile, 1.7–1.85): Instructions with a preferred maximum measure of 70 characters.
- **Label** (700, 14px): Buttons, toggles, duration, and compact state names.

### Named Rules

**The Across-The-Table Rule.** Anything a learner must act on is readable at a glance and never depends on note-sized text.

## Layout

The incumbent guide uses a centred reading column around 680px wide with 20px side padding. Major sections are separated by roughly 44px; related elements stay tight inside white work surfaces. The class-day page may widen the shell for a projected station map, but instructions remain within a readable 65–75 character measure.

The class-day desktop layout pairs five connected route stops with a sticky progress rail and the active work area. Below 860px, the route becomes a connected vertical stack; every instruction and work bench resolves to one column without horizontal scrolling. Fixed or sticky controls must leave content unobscured at 200% zoom.

## Elevation & Depth

Most separation comes from tonal layering and fine warm dividers. Sticky selectors use a soft ambient shadow (`0 4px 14px rgba(0,0,0,.08)`); screenshots or demonstrative media may use a wider soft shadow (`0 6px 20px rgba(30,25,15,.10)`). Work surfaces remain flat at rest.

**The Quiet Surface Rule.** Use elevation to keep a control available during scrolling, not to make every container float.

## Shapes

Work surfaces use generous 18px corners. Compact demonstrations use 14–16px corners. Small status markers may be circular, while language, platform, and copy controls use full pill geometry because they are short actions. Borders are warm and fine; avoid mixing a border with a large shadow on the same card.

## Components

### Buttons

- **Shape:** Full pill for short actions; minimum 44px touch target on the class page.
- **Primary:** Action Orange with Chalk White text and bold labels; Learning Orange is reserved for the active route outline and marker accents.
- **Hover / Focus:** Darken the orange slightly on hover; use a visible dark outline with offset for keyboard focus.
- **Success:** Switch to Success Green and replace the label with a written confirmation.

### Cards / Containers

- **Corner Style:** Generous curves (18px) for main work surfaces; 14–16px for nested demonstrations.
- **Background:** Chalk White on the cream paper ground.
- **Shadow Strategy:** Flat by default; rely on the warm divider.
- **Border:** One fine Divider stroke.
- **Internal Padding:** About 24–26px on desktop, reduced but never cramped on mobile.

### Navigation

Language and platform selectors sit in a Warm Margin pill. The selected item is Classroom Ink with white text. The class route names five connected stops—Setup, Documents LOI → TA, Video, Co-broke, and Finish—and pairs numbered icons with written progress states. The current stop uses an orange outline, completed stops become ink, and the sticky rail keeps the saved count and next action visible. Only the current station is expanded; later stations remain compact open rows.

### Copy Prompt

Prompt text sits on the lighter paper surface behind a dashed Gold Marker boundary. The copy action is attached to the prompt but never overlaps text. Copy success is announced visually and to assistive technology.

### Success Check

A result sample uses a white or light warm surface with a written success phrase in Success Green. Failure and missing dependency states name the problem and the exact recovery prompt.

## Do's and Don'ts

### Do:

- **Do** keep one clear current action visible from a projected screen.
- **Do** pair every copy action with a concrete expected result.
- **Do** preserve the same information hierarchy in Chinese and English.
- **Do** use the shipped short orange outline pulse only when the route advances, with the reduced-motion fallback collapsing it to an effectively instant state change.

### Don't:

- **Don't** make the learning pages resemble the authenticated product dashboard.
- **Don't** use decorative gradients, glass, or dense icon grids as substitutes for instructions.
- **Don't** rely on colour, hover, or small helper text to explain a required step.
- **Don't** introduce instructor identity, personal media, client data, or unapproved company assets into the public visual system.
