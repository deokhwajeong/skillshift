# SkillShift

**Live app:** https://skillshift-xi.vercel.app  
**GitHub:** https://github.com/deokhwajeong/skillshift

SkillShift reads tech news and maps each shift to real job requirements, showing tech job seekers which skills are **Rising**, **Emerging**, **Established**, or **Fading**, with the evidence behind each.

It is a news portal first. News is the primary object; job descriptions are the evidence layer that grounds each news shift in hiring reality.

CMU MSSM individual assignment: Generative AI News Portal. Demo and pitch: Tuesday, October 27, 2026.

> **Data status:** the committed data is SAMPLE data (made-up articles and postings, labeled `[SAMPLE]`) until the real curated set is run through the pipeline. The app shows a SAMPLE banner whenever `mode` is `"sample"`.

## What it does

- **Today:** a 2x2 Signal Matrix (hand-built SVG) plotting every skill by News signal vs JD signal, plus a three-item Today's Brief (What changed / Why it matters for this role / What to do this week) with numbered source citations and a **Listen** button.
- **Skill detail:** the three scores with a plain-language explanation of how each was computed, the evidence level, every supporting article excerpt and job-posting excerpt, and any conflicting claims.
- **Editor Queue:** items the editorial policy held back (low confidence, weak evidence, conflicts, proposed new skills) wait for a human to approve or reject. Approvals re-score the matrix immediately.
- **Run live:** paste a fresh article and watch it go through Filter, Shift Extraction, and Verification, streamed step by step, then see how the matrix moves.
- **How it works:** the seven pipeline stages with live counts, a real sample input and output for each, agent accuracy from the eval, and the token and latency log.
- **Roles:** TPM has a full dataset. PM, SWE, and Data Science appear as Team expansion editions: the pipeline is role-agnostic, so each would be a team member's vertical.

## Setup

Requires Node 22 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Needed for | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `npm run pipeline`, `npm run live:cache`, Live mode | Never commit it. Locally it goes in `.env.local` (gitignored); on Vercel or a cloud environment, set it as an environment variable. |
| `ANTHROPIC_MODEL` | all LLM agents | Default `claude-sonnet-5-5`. |
| `ANTHROPIC_MODEL_FILTER` | Filter Agent only | Optional cheaper model, e.g. `claude-haiku-5-5`. |
| `LIVE_MODE_PASSPHRASE` | Live mode on a deployment | When empty, Live mode only works on a local dev server. Also set a monthly spend limit on the API key. |

The app itself (everything except Live mode) needs no key: it reads precomputed results.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app at http://localhost:3000 |
| `npm run check:data` | Validate config, raw data, and editor decisions; print a summary |
| `npm run pipeline [-- --role tpm]` | Run all agents on `data/raw/` and write `data/generated/<role>/` (needs the API key) |
| `npm run eval [-- --role tpm]` | Grade Shift Extraction and JD Analyzer against hand labels in `data/eval/`; `-- --template` writes a labeling template |
| `npm run live:cache` | Record a Live mode run of `data/live/demo-article.md` as the offline fallback (needs the API key) |
| `npm run sample` | Regenerate the SAMPLE data, SAMPLE live cache, and SAMPLE eval (no API key) |
| `npm test` | Unit tests (Vitest) |
| `npm run zip` | Package the committed project as `dist/skillshift-submission.zip`, plus `one-pager.pdf` from the repo root (never includes `.env*` secrets, `node_modules`, `.next`, or `.vercel`; refuses if a key-like string is committed) |
| `npm run build` | Production build (all pages prerendered) |
| `npm run build:demo` | Static copy of the site in `out/`, served under `/demos/skillshift` (for the portfolio site). No server, so Live mode replays its recorded run. `BASE_PATH=/other/path` changes the path. |
| `npm run zip` | Package the committed source as `dist/skillshift-source-<date>.zip` (never includes `.env*` secrets or `node_modules`) |

### Refreshing the data for the demo

```bash
npm run check:data        # after adding articles to data/raw/news and JDs to data/raw/jds/tpm
npm run pipeline          # real agents, about 60 LLM calls
npm run eval              # after labeling data/eval/tpm.json
npm run live:cache        # after putting a fresh article in data/live/demo-article.md
git add data && git commit -m "Real pipeline run"
```

## Demo inputs

- **Curated news:** `data/raw/news/*.md`, one article per file with front matter (`id`, `title`, `source`, `url`, `published_date`, `source_type`). See `data/README.md`.
- **Job postings:** `data/raw/jds/tpm/*.md`, saved manually (no scraping).
- **Live mode demo article:** `data/live/demo-article.md`. Use a fresh article that is not in the curated set. The "Fill with the demo article" button loads it, and "Replay the cached run" works without network.
- **Eval labels:** `data/eval/tpm.json` (`npm run eval -- --template` writes a starting file).
- **Script:** [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## Project layout

```
config/            roles.json, taxonomy.json (flat skill list), scoring.json (thresholds and weights)
data/raw/          curated articles and job postings
data/generated/    pipeline output read by the app (committed)
data/editorial/    decisions.json exported from the Editor Queue
data/eval/         hand labels for npm run eval
data/live/         the Live mode demo article
src/agents/        one module per agent; prompts in src/agents/prompts/
src/scoring/       Signal Scorer (pure TypeScript)
src/pipeline/      schemas (the data contract), loaders, orchestrator, editorial policy, Live mode
src/eval/          precision and recall
src/lib/           LLM wrapper, data access, view helpers
src/app/           Next.js pages and the /api/live route
src/components/    UI components (Signal Matrix, Editor Queue, Live mode, Listen)
scripts/           command-line entry points
tests/             Vitest tests
docs/              ARCHITECTURE.md, DEMO_SCRIPT.md, ONE_PAGER.md, STATUS.md, PROJECT_BRIEF.md
```

How the pieces fit: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## External APIs and data sources

- **Anthropic Messages API** (`@anthropic-ai/sdk`): the five LLM agents (Filter, Shift Extraction, Verification, JD Analyzer, Brief Writer). Structured JSON outputs, validated with Zod. Called only by `npm run pipeline`, `npm run live:cache`, and the Live mode route.
- **Web Speech API** (built into the browser): the Listen button. No paid text-to-speech.
- **Google Fonts** via `next/font` (Newsreader, Geist, Geist Mono), downloaded at build time and served by the app.
- **News articles and job postings:** 14 articles from company blogs, trade press, and independent blogs (Aug to Oct 2026), and 16 TPM postings from public Greenhouse job boards, saved for private class use. The UI only shows short excerpts (under 15 words) and links to the original.
- **Vercel:** hosting.

## Known limitations

- **Small curated dataset.** 14 articles and 16 TPM postings. The signals describe this set, not the whole market.
- **Signals are not predictions.** A Rising skill is one that is in the news and in postings now; nothing here claims causation or forecasts hiring.
- **LLM extraction makes mistakes.** They are measured, not hidden: see the eval on How it works. The editorial policy holds uncertain items for a human.
- **One article moves the News signal by at most about 0.33** (saturation is 3), so a single live article rarely changes a quadrant. That is intended: one story should not redraw the market.
- **"Today" is the newest article's date**, so the matrix does not drift as real time passes.
- **Editor decisions live in the browser** until exported to `data/editorial/decisions.json` and the pipeline is re-run. The brief only updates on a pipeline run.
- **Live mode does not save anything**, and it needs the API key plus the passphrase. Without them it replays a recorded run and says so.
- **Read-aloud voice** depends on the browser and operating system.
- English only.

## AI usage

I used Claude Code (Anthropic) as a coding assistant. This is the honest split.

**What I designed:**
- The product concept: a news portal that grounds tech news in job-posting evidence, for job seekers, with role as a dimension rather than the product.
- The Signal Matrix logic: News signal, JD signal, momentum, the four quadrants plus Quiet, and the rule that classification is deterministic code with thresholds in a config file.
- The skill taxonomy and its role tags.
- The agent roles and their order (Ingest, Filter, Shift Extraction, Verification, JD Analyzer, Signal Scorer, Brief Writer).
- The human-in-the-loop policy: AI does the reading, a human approves what gets published; what goes to the Editor Queue and why.
- Product decisions made along the way: fixed thresholds, browser-stored editor decisions with export, passphrase-protected Live mode, the hand-built SVG matrix, the model choices, keeping the taxonomy a flat list and verification single-model.
- The data criteria: the date window, the spread of topics and source types, one deliberately off-topic article as a control, and the mix of TPM domains and levels.

**What was generated with Claude Code and then reviewed by me** at each phase checkpoint: the TypeScript implementation (schemas, loaders, agents, prompts, LLM wrapper, scorer, orchestrator, UI, API route, scripts), the unit tests, the SAMPLE data used before real data existed, the collection of the 14 articles and 16 postings from public pages to my criteria, and drafts of these docs. Eval labels for the real set are not written yet.
