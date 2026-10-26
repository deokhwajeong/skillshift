# Status and decisions

Last updated 2026-10-22. Requirements: [PROJECT_BRIEF.md](PROJECT_BRIEF.md). Demo: Tue 2026-10-27.

## Phases

| Phase | State | Commit |
|---|---|---|
| 1. Scaffold, schemas, loaders, placeholder data, taxonomy | Done, approved | `d9d6d20` |
| 2. Agents 1 to 5, prompts, orchestrator, `npm run pipeline` | Code done, approved. Real API run not done yet (no API key yet) | `c8215e9` |
| 3. Signal Scorer + tests, Brief Writer, SAMPLE data | Done, approved | `2a9b8b4` |
| 4. UI: Today, Skill detail, How it works, design pass | Done, approved | `8be6b3b` |
| 5. Editor Queue, Live mode with streaming, audio brief | Done, approved | `9a02c6d` |
| 6. Eval, cost/latency log, docs, Vercel deploy, ZIP script | Done, awaiting Deka's review | (Phase 6 commit) |

## Decisions (all confirmed by Deka 2026-10-21)

- **Quadrant thresholds:** fixed values in `config/scoring.json` (news strong >= 0.4, JD strong >= 0.35), not relative/median splits.
- **Editor Queue storage:** approve/reject decisions stored in the browser and re-scored there (the scorer is pure TS), plus an "Export decisions" button writing `data/editorial/decisions.json` that the pipeline reads. No hosted database.
- **Live mode protection:** passphrase in env var `LIVE_MODE_PASSPHRASE`, plus a monthly spend cap on the API key.
- **Matrix chart:** hand-built SVG, no chart library.
- **Model:** `ANTHROPIC_MODEL=claude-sonnet-5-5` for all agents; `ANTHROPIC_MODEL_FILTER=claude-haiku-5-5` override for the Filter Agent.
- **Patent guardrail:** taxonomy stays a flat list (no graph relations between skills); Verification stays single-model (no ensemble scoring). Do not add either.
- **GitHub:** private repo `deokhwajeong/skillshift`.
- **Refusal fallback** (server-side `fallbacks`) deliberately left out: incompatible with the Haiku filter model and adds a beta path to explain. A refusal is an AgentFailure: the item is skipped and logged. Revisit in Phase 6 if wanted.
- **Duplicates:** each article is checked against all earlier-dated articles (earliest report wins) so Filter calls run in parallel.
- **Brief Writer** was moved into Phase 3 because it needs the scores.

## UI (Phase 4)

- Routes: `/` redirects to the first full role (`/tpm`). `/<role>` is Today, `/<role>/skills/<skill>` is Skill detail, `/<role>/how-it-works` is the pipeline view. Roles without `data/generated/<role>/` (PM, SWE, DS) show the Team expansion panel.
- All pages are prerendered at build time from `data/generated/<role>/*.json` (`src/lib/data.ts`, Zod-validated). Screen logic lives in pure functions in `src/lib/view.ts` and `src/lib/matrix-layout.ts`, tested in `tests/view.test.ts`.
- Signal Matrix: hand-built SVG (`src/components/signal-matrix.tsx`), x = JD signal, y = News signal, dashed lines = thresholds from `config/scoring.json`. Rising, Emerging, Established have colorblind-checked hues; Fading (ring) and Quiet (small dot) stay neutral.
- AI-generated text carries an "AI-generated" label naming the agent; source excerpts are shown as quotes with links. SAMPLE banner shows whenever `mode` is `"sample"`.
- Dark mode follows the system and has a toggle (saved in localStorage).

## Phase 5

- **Editor Queue** (`/<role>/editor`): approve or reject each held item. Decisions are stored in the browser (localStorage) and the matrix on Today and the Editor Queue is re-scored in the browser with the same code (`applyDecisions` in `src/pipeline/editorial.ts`, then the Signal Scorer; see `src/lib/rescore.ts`). "Export decisions" downloads `decisions.json`; save it as `data/editorial/decisions.json` and the pipeline applies it. A held shift counts once every item that held it is approved. Decisions are matched by article + excerpt, so a re-run that renumbers shifts keeps them. An article counts once per skill, so approving a second, weaker shift from an already-counted article changes nothing (by design).
- **Live mode** (`/<role>/live`, `POST /api/live`): Filter -> Shift Extraction -> Verification -> re-score for one pasted article (`src/pipeline/live.ts`), streamed as newline-delimited JSON. Before and after are scored as of the same date so only the article explains the difference. Nothing is saved. On any failure (wrong passphrase, no key, timeout after 50 s, API error) the page says why and replays `data/generated/<role>/live-cache.json`. `npm run live:cache` records that file from `data/live/demo-article.md` with the real API; `npm run sample` writes a SAMPLE one with a scripted fake client.
- **Audio brief:** "Listen" on Today reads the brief with the browser's Web Speech API (`src/components/listen-button.tsx`, script in `src/lib/brief-script.ts`), highlights the card being read, and shows a small voice meter as the "anchor". Citation ids are not read aloud. No paid TTS.
- **To do once the API key exists:** replace `data/live/demo-article.md` with a real fresh article, run `npm run pipeline`, then `npm run live:cache`.

## Phase 6

- **Eval:** `npm run eval` grades Shift Extraction and JD Analyzer per (item, skill) pair against `data/eval/<role>.json` (or `<role>.sample.json` while data is SAMPLE) and writes `data/generated/<role>/eval.json`, shown on How it works (flagged stale if older than the latest pipeline run). No API calls. `npm run eval -- --template` writes a labeling file listing every article and JD of the current run. Articles the Filter dropped are reported, not scored.
- **Cost and latency:** per-call log in `run-log.json` (Phase 2), totals on How it works.
- **Docs:** README (full), docs/ARCHITECTURE.md (Mermaid plus raw-article-to-matrix walkthrough), docs/DEMO_SCRIPT.md, docs/ONE_PAGER.md. Numbers in [brackets] are filled in after the real run.
- **ZIP:** `npm run zip` writes `dist/skillshift-submission.zip` from `git archive` on HEAD (so only committed files, plus `one-pager.pdf` if present). It refuses if any `.env*` (except `.env.example`), `node_modules`, `.next`, `.vercel`, or key file is tracked, or if a committed line looks like an Anthropic key.

## Before the demo (Deka)

1. Real data in `data/raw/` (Fri 10/23), API key set, then `npm run pipeline`.
2. Label `data/eval/tpm.json` (Sun 10/25), then `npm run eval`.
3. Fresh article in `data/live/demo-article.md`, then `npm run live:cache`.
4. Fill the [bracketed] numbers in DEMO_SCRIPT.md and ONE_PAGER.md; commit; redeploy; `npm run zip`.

## Data state

- `data/raw/`: 3 placeholder articles, 3 placeholder TPM JDs. Deka's real data (12 to 15 articles, 15 to 20 TPM JDs) is due by Fri 10/23; eval labels by Sun 10/25.
- `data/generated/tpm/`: **SAMPLE data** from `npm run sample` (`mode: "sample"` in `pipeline-summary.json`, titles start with `[SAMPLE]`). The UI must show a SAMPLE banner when mode is "sample". `npm run pipeline` overwrites it with real output.

## API key

Deka does not have an Anthropic API key yet. Locally it goes in `.env.local` (gitignored, copy from `.env.example`). In a cloud session it must be set as an environment variable of the cloud environment, never committed. Until then, everything is tested with fake clients (`tests/pipeline.test.ts`, `tests/brief-writer.test.ts`, `tests/llm.test.ts`).

## Commands

`npm run check:data`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run sample`, `npm run pipeline` (needs the key), `npm run dev`.

## Working rules

- Stop at each phase checkpoint for Deka's review; summary in plain language plus 2 or 3 things to be ready to explain.
- No em dash characters anywhere (code, UI copy, docs, generated text). In code, write `"\u2014"` escapes when checking for them.
- Deka writes casual messages in Korean; reply in Korean. Professional docs stay in English.
- Commit after each phase. Never commit `.env*` files other than `.env.example`.
