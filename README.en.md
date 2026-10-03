# study-abroad-planner

[![ci](https://github.com/caijimiao345/study-abroad-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/caijimiao345/study-abroad-planner/actions/workflows/ci.yml)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](LICENSE)

[简体中文](README.md) | **English**

**Live demo**: [interactive](https://caijimiao345.github.io/study-abroad-planner/examples/uae-transportation/demo.html) (filtering / sorting) · [static snapshot](https://caijimiao345.github.io/study-abroad-planner/examples/uae-transportation/result-static.html) (for environments without JS). Demo data reflects the generation date (2026-10-02) — always re-verify against official sites before real use.

A **university-search and presentation skill for AI agents**: given a student profile (GPA / undergraduate background / language scores / budget / target regions and majors), it **exhaustively searches** degree programmes, verifies every figure against official university pages, estimates course-match and budget feasibility, and finally produces a filterable, self-contained HTML comparison page plus a Notion board.

- **Any country or region** — no allow-list; official course directories are enumerated region by region
- **Multi-country search plan**: the plan comes first (hard constraints → shortlisted countries → shown to the user, **no waiting for confirmation**), then each country is searched exhaustively; delivery includes a "country coverage table" — quotas apply **per country**, never averaged across countries, never one or two countries searched deeply with the rest waved through
- **English and all non-English-taught programmes** (German / French / Spanish / Italian / Dutch / Japanese / Korean …), filterable to English-taught only
- **24 mandatory fields / 14 dimensions**: entry requirements, documents, admission criteria, timeline, **course match (itemised explanation + undergraduate calibration)**, **credit conversion (Chinese credits ↔ ECTS thresholds)**, student visa (China-specific), graduate outcomes and salaries, post-study work rights, permanent residency, citizenship, tuition and living costs, part-time work limits, scholarships, **work-experience requirements**, **official admissions-office contact details**
- **Three-part verdict**: **four admission tiers** (safe / target / reach / high-risk) + **prerequisite-risk flags** + **four budget bands** (feasible / via part-time work / part-time + scholarship / over budget) — the page states prominently that these are mechanical AI estimates and that final eligibility must be confirmed with the admissions office
- **Every number carries its source**: official link + verification date; anything unverified is honestly marked "unverified"
- **Optional add-on · QQ group reminders (deployable source included)**: push your shortlist conclusions to your phone instead of leaving them in a browser tab — deploy to Cloudflare (Workers + Pages + D1 + KV, all within the free tier, zero server cost), set reminders in the front end (type / target date / N days ahead / daily · weekly · monthly), and get a "today's to-dos" digest pushed to a QQ group every day at 08:00 Beijing time. Wired to three scheduled monitors, university deadlines and visa-policy changes also land in the group automatically. See `references/qq-reminder.md` and `assets/qq-reminder/`

## Installation

```bash
# WorkBuddy: copy into the user skills directory
cp -r study-abroad-planner ~/.workbuddy/skills/
# CodeBuddy: use ~/.codebuddy/skills/ instead
```

Once installed, just say "given my GPA / major / budget, find me programmes in <country> for <field>".

## Quick start (build your own comparison page)

```bash
# 1) Write the data (single source of truth); see assets/data.json for the shape
#    assets/data.json        meta + profile + data[] + schoolLinks + regionLinks
#    assets/exclusions.json  structured exclusion list (school/program/reason/source/checkedDate)
# 2) Build (includes upfront self-checks: empty data / missing fields / no verification date / link gaps → hard fail)
node scripts/build.js my-comparison.html assets/data.json
# 3) Audit and rule verification
node scripts/audit_dataset.js assets/data.json
node scripts/verify_rules.js assets/data.json
# 4) Generate Notion CSVs (programmes / documents / timeline / policy library)
node scripts/generate_notion_csv.js assets/data.json notion_templates
```

## Repository layout

```
SKILL.md                       Main skill file (5-step workflow + optional step 6: QQ reminders)
CHANGELOG.md                   Changelog (v1.2.3: privacy cleanup — sample data no longer reuses a real
                               applicant's credit figures; empty-table cron note;
                               v1.2.2: unified outgoing-message prefix for QQ reminders;
                               v1.2.1: removed the "wait for confirmation" gate on search plans;
                               v1.2.0: QQ reminder system merged into the skill;
                               v1.1.0: multi-country search plan / 24 fields / anti-laziness gate /
                               undergraduate calibration / credit conversion)
references/
  finding-schools.md           ★ Search handbook: official exhaustive entry points, 24 fields, verification
                               discipline, pitfall list, hard quotas, country checklist, non-English search rules
  parallel-search.md           Parallel-search sharding template (regions × majors → multiple agents)
  data-schema.md              Data dictionary (four-tier / four-band algorithms, non-English fields)
  course-matching.md           Course-match algorithm (60% core + 25% bonus + 15% grades, with prerequisite risk)
  visa-work-rights.md          Official entry points and structural templates for visa / work rights / PR / citizenship / part-time work
  notion-template.md           Notion board design and scheduled-monitor wiring
  automations.md               Scheduled-task templates (university deadlines / APS & language tests / visa policy)
                               + the fixed "push to QQ group" closing step
  qq-reminder.md               Optional add-on: QQ reminder integration guide (8 deployment steps / gateway wiring /
                               9-item acceptance checklist / privacy boundary)
assets/
  template.html                ★ Pure template (no data by default; populated via payload)
  qq-reminder/                 Deployable QQ reminder system template (Worker source + Pages proxy + D1 schema +
                               front end + CI; wrangler.toml contains placeholders)
  data.json                    Sample dataset (72 records × 32 regions × 22 majors, includes non-English examples)
scripts/
  build.js                     ★ The single build entry point (injection + upfront self-checks)
  audit_dataset.js             Dataset audit
  verify_rules.js              Offline verification of verdict rules
  generate_notion_csv.js       Notion CSV generation
  snapshot_static.js           Static snapshot generator (the actual deliverable; the interactive HTML is intermediate)
  render_check.js              Headless render verification
examples/
  uae-transportation/          Reference case (UAE × transportation planning: data + exclusions + static snapshot + Notion CSV)
```

## Data and privacy

- The data in this repository is **sample data** (a sample profile) and contains no real personal information
- `profile` in `assets/data.json` holds sample values — replace it with your own profile
- When you generate your own comparison page, the resulting HTML contains the profile you entered → **do not share profile-bearing HTML publicly**

## Optional add-on: QQ group reminders (Cloudflare, source included)

A shortlist report shouldn't end as an HTML file — it should stop you from **missing a deadline**. The skill ships a deployable reminder system (`assets/qq-reminder/`):

```
Three scheduled monitors ──brief──▶ POST /api/push (Bearer token)
                                          │
CF Pages front end (set reminders) ──▶ /api/reminders ─▶ Worker ─▶ D1
                                          │
CF Workers Cron (daily 00:00 UTC) ──▶ today's to-do digest ──▶ QQ group
```

- **Cost**: Workers + Pages + D1 + KV all sit inside Cloudflare's free tier; no server, no public IP, no ICP filing
- **Every day at 08:00**: application milestones inside their "N days ahead" window are collected into a single "today's to-dos" message; sent at most once per day
- **Report on change**: three kinds of digest — university deadlines (Mondays), APS and language-test slots (Tuesdays), visa policy (5th of each month) — are forwarded into the same group
- **Architecture note**: the front end does not call the Worker directly; it goes through a Pages Functions reverse proxy on `/api/*` — `*.workers.dev` is frequently DNS-poisoned and unreachable from mainland China while `*.pages.dev` is reachable, so the proxy solves reachability as a side effect
- **Deployment**: `references/qq-reminder.md` (8 steps + 9-item acceptance checklist + 8 common failures); template source in `assets/qq-reminder/`
- **Security**: the template contains only `<REPLACE_*>` placeholders. `AppSecret`, page password, gateway token, group `openid` and D1/KV resource IDs all live in Cloudflare Secrets or in a gitignored local config — **never in the repository**

## Design notes (why it is written this way)

1. **Exhaustive beats sampled**: official course directories (Discover Uni / CRICOS / Hochschulkompass / studyinnl / Universitaly / Mon Master / RUCT / QQI / CSPE / MQA …) are enumerated region by region, backed by hard quotas (≥8 pages per "region × major", ≥60 candidates overall, ≥30 fully verified records); multi-country tasks produce a search plan first and then go country by country, with quotas counted per country (finding-schools.md §8.0)
2. **Accuracy beats completeness**: every record carries `verified` / `verifiedDate` / `policyYear`; anything uncertain is marked unverified — **numbers are never invented**
3. **Traceability**: exclusions are recorded structurally (why school X was left out is one query away); key figures carry a "source" badge linking straight to the official page
4. **Data and presentation are separate**: data lives in JSON, presentation is injected via a template, so changing the template cannot break the scripts
5. **Decidability**: four admission tiers + prerequisite risk + four budget bands, each with its formula and stated basis

## License

[CC BY-NC-SA 4.0](LICENSE) — free to copy, modify and redistribute, but **commercial use is prohibited**, and derivative works must be shared under the same terms with attribution. Always defer to official university pages for programme data. Pull requests that improve the search rules or add new country/language data are welcome.

## Reference case and self-check scripts

- `examples/uae-transportation/` — a **complete, actually-run case for a randomly drawn "UAE × transportation planning" task**: data, exclusion list, finished page, JS-free static snapshot, Notion CSVs, reproduction commands. New tasks can copy its directory structure directly.
- `scripts/render_check.js <page.html>` — headless render self-check (a DOM stub really executes the page JS and counts rendered cards).
- `scripts/snapshot_static.js <page.html> <snapshot.html>` — generates a **JS-free static snapshot**: use it when the recipient's environment does not run scripts (some previewers, email attachments) — content visible, interactivity unavailable.
- All generation flows go through `scripts/build.js` (upfront data self-checks + a **finished-page JS syntax gate**; nothing is emitted if it fails).
