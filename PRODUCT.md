# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Singapore property agents use the authenticated product to organise property-viewing and listing workflows.
- The public `/ai-agent` learning surfaces serve 45–55-year-old property agents who are not highly technical and need to prepare for, then follow, a three-hour one-to-one practical class.
- Assumption for the approved class-day surface: the instructor projects the guide while each learner follows the same short steps on their own computer.

## Product Purpose

The main product supports property-viewing and listing workflows. Its public AI-agent guides help learners get their computer ready and complete three bounded classroom exercises: prepare transaction-related documents from supplied facts, create a synthetic training video, and rehearse a property co-broking workflow without sending real messages.

The class-day guide succeeds when a non-technical learner can see the current step, copy the exact instruction into Codex, recognise a safe result, recover within five minutes, and finish the class without requiring an account on this website.

## Positioning

The teaching experience is a live, follow-along operating guide rather than an explanatory course portal: every lesson pairs one visible action with one exact Codex prompt, one concrete check, and one safe fallback using bundled fictional data.

## Operating Context

- Pre-class preparation happens on Mac or Windows and retains bilingual Chinese/English guidance.
- Class-day use happens on a projected screen and on learners' laptops, with optional phone viewing as a secondary case.
- Learners install exactly three public Skills from `dearvae/agentos-sg-course-skills`: `propnex-forms`, `agent-shot`, and `pg-cobroke`.
- All first-use and classroom rehearsals use bundled fictional data. Real client data, real messages, identity media, and production actions are outside the classroom path.

## Capabilities and Constraints

- Public learning pages require no website login and store checklist progress only in the learner's browser.
- The class page must provide large type, short sequential steps, progress checkboxes, reliable copy controls, Chinese/English switching, keyboard access, and missing-dependency recovery.
- `propnex-forms` may create transaction-related working documents from supplied facts. The LOI is the demo; a later TA request must reuse confirmed facts, identify missing fields, avoid invented terms, and never imply legal approval.
- `agent-shot` uses only synthetic training material and a non-personal standard voice in the required classroom path.
- MiniMax is optional. If a learner chooses it, they use their own account and key, understand that usage is metered, and never share the key with the instructor or commit it to GitHub.
- `pg-cobroke` uses fictional fixtures and produces drafts only during class; it does not log in, control WhatsApp, or send messages.
- The public learner repository includes no company formal forms and no instructor voice, portrait, contact details, profile, credentials, or client records.

## Brand Commitments

The `/ai-agent` learning surfaces are bilingual, reassuring, direct, and written in plain language for learners who do not consider themselves technical. The existing pre-class guide establishes a warm cream, ink, and orange learning-guide identity that the class-day page must inherit rather than replace.

## Evidence on Hand

- Existing pre-class guide: `web/frontend/public/ai-agent/index.html`.
- Approved task definitions and privacy boundaries: AgentOS SG `web-app/PROJECT.md`, COURSE-03 revision 2 through COURSE-05 revision 2.
- Locally validated learner Skill candidate and synthetic fixtures are maintained outside this repository in the approved AgentOS SG teaching workspace.
- There are no approved testimonials, pass-rate claims, learner analytics, or agency-owned forms for these public learning surfaces; future work must not fabricate them.

## Product Principles

1. Make the next safe action obvious before explaining why it works.
2. Keep classroom success independent of optional paid services.
3. Use fictional data first; pause before any real-data, login, identity, or send boundary.
4. Treat AI output as a draft based on supplied facts, never as invented transaction terms or legal approval.
5. Recover quickly with a known fixture or expected output instead of consuming class time on open-ended troubleshooting.

## Accessibility & Inclusion

The public guides must work in Chinese and English, at desktop and mobile widths, with keyboard-only navigation, visible focus, readable contrast, and controls whose status is announced without relying on colour alone. Large type and short instructions are required for the confirmed learner group.
