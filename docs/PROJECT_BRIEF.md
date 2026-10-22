# Project: SkillShift (CMU individual assignment, Generative AI News Portal)

> Deka's original brief, kept in the repo so any session (local or cloud) has the full requirements. Current progress and decisions: [STATUS.md](STATUS.md).

## Context about me and the goal
I'm a CMU MSSM student (Senior TPM background, 10+ years at LG Electronics owning OTT platform integration and privacy compliance). This is a 1-week individual assignment: "Generative AI News Portal." Graded on creativity, design, and coding understanding. Production-readiness is NOT required. I will do a live demo and pitch in class on Tuesday 10/27, and submit a source ZIP plus a one-page write-up.

My goal is to win the class. The best ideas get selected as semester team projects with the author as project lead, so the product must also be clearly extensible to a team.

What the professor emphasized:
- Pick a narrow niche with a clear user and problem
- Go beyond summarization: detect trends, compare conflicting claims, show evidence and source credibility, explain impact and "so what"
- Design the AI vs human editor balance deliberately (fully automated vs human-approved)
- Multi-agent architecture (agents that collect, verify, analyze, edit)
- Multimedia formats are encouraged (audio, avatar, short video)
- Clearly separate AI-generated content from source material

I must be able to explain every part of the code in the demo. Optimize for clarity and explainability over cleverness.

## Product
**One-liner:** SkillShift reads tech news and maps each shift to real job requirements, showing tech job seekers which skills are Rising, Emerging, Established, or Fading, with the evidence behind each.

**Positioning:** It is a NEWS portal first. News is the primary object; job descriptions are the evidence layer that grounds news in hiring reality. Do not let it turn into a resume matcher (Teal, Jobscan, LinkedIn already do that).

**Target user:** Tech job seekers, especially grad students heading into internship and full-time recruiting. Default persona for the demo: a TPM candidate preparing for Netflix, Google, Apple, Amazon applications.

**Role selector (important):** Role is a selectable dimension, not the product identity. Options: TPM, PM, SWE, Data Science. For this individual version only TPM has a full dataset. Other roles appear in the selector with a "Team expansion" state (small sample or locked card explaining that each team member would own a role vertical). The data model and pipeline must be role-agnostic so adding a role is just adding data files plus a taxonomy entry.

## Core concept: the Signal Matrix
For each skill in the taxonomy, compute two strengths plus momentum:
- **News signal:** how strongly and how recently the skill appears in news shifts (weighted by recency and source credibility)
- **JD signal:** share of job descriptions that require or prefer the skill (required weighted higher than preferred)
- **News momentum:** recent window vs earlier window of news mentions

Classification (deterministic code, NOT an LLM, so I can explain it and unit test it; thresholds in a config file):
- **Rising:** strong in news AND strong in JDs
- **Emerging:** strong in news, weak in JDs (early mover opportunity)
- **Established:** weak in news, strong in JDs (table stakes)
- **Fading:** negative news momentum AND weak in JDs
- Everything else: not shown or shown as "Quiet"

Every skill card must link back to its evidence: the specific articles (title, source, date, link, a short excerpt under 15 words) and the specific JD excerpts that support it. No claim without evidence.

## Multi-agent pipeline (implement these as separate, clearly named modules)
Each agent module must start with a header comment: purpose, input schema, output schema, whether it uses an LLM, and failure behavior.

1. **Ingest Agent (no LLM):** loads curated articles and JDs from `data/raw/`. Normalizes metadata. Stub an RSS adapter interface for the future but don't depend on it.
2. **Filter Agent (LLM):** scores each article for relevance to tech hiring and skills for the selected role; removes duplicates and off-topic items. Outputs keep/drop with a one-line reason.
3. **Shift Extraction Agent (LLM):** from each kept article, extracts "shifts" (a technology, practice, regulation, or market change), maps each to taxonomy skills, includes a short supporting excerpt and a confidence score. May propose NEW skills not in the taxonomy, marked as `candidate` for human review.
4. **JD Analyzer Agent (LLM):** extracts required vs preferred skills from each JD, mapped to the taxonomy, with excerpts.
5. **Verification Agent (LLM):** checks extracted shifts against the source text (does the excerpt actually support the claim?), flags conflicting claims across articles, assigns an evidence level (Strong / Moderate / Weak). Low-confidence items go to the Editor Queue instead of publishing.
6. **Signal Scorer (no LLM, pure TypeScript):** computes News signal, JD signal, momentum, and the quadrant. Fully unit tested.
7. **Brief Writer Agent (LLM):** writes the "Today's Brief" for the selected role using only verified items. Structure per item: **What changed / Why it matters for this role / What to do this week** (concrete: something to learn, a resume bullet angle, an interview question to prepare). Every sentence that makes a factual claim cites a source ID.

Human in the loop: an **Editor Queue** where items below a confidence threshold, conflicting claims, and candidate skills wait for approve/reject. Approved items flow into the matrix and brief. This is a deliberate product decision I'll pitch: AI does the reading, humans approve what gets published.

## Screens
1. **Today (home):** role selector, date, 3-item Today's Brief, the Signal Matrix as a 2x2 visual (skills plotted by News signal vs JD signal, colored by quadrant), clear labels marking AI-generated text.
2. **Skill detail:** quadrant, scores with plain-language explanation of how they were computed, evidence trail (news cards and JD excerpts), conflicting claims if any, evidence level.
3. **How it works (pipeline view):** visual of the agent pipeline with live counts at each stage (e.g. 14 articles -> 11 relevant -> 37 shifts -> 31 verified -> 18 skills scored). Clicking a stage shows a sample input and output. This screen is critical for the "coding understanding" part of my demo.
4. **Editor Queue:** pending items with approve/reject, reason shown.
5. **Audio brief:** a "Listen" button that reads Today's Brief aloud using the browser Web Speech API (no paid TTS). Optional stretch: a simple animated anchor avatar while speaking.

## Design direction
I want this to look distinctive, not like a generic AI dashboard or a default template. Direction: modern editorial newspaper meets data visualization. Strong typographic hierarchy (a serif for headlines, clean sans for UI), restrained palette with one accent color per quadrant, generous whitespace, dark mode supported, works at phone width. The 2x2 matrix is the hero visual and should be memorable. Never use em dashes (the U+2014 character) anywhere in UI copy, generated text, or docs. Instruct the Brief Writer prompt to avoid them too.

## Demo reliability (non-negotiable)
- **Precomputed mode (default):** run the full pipeline offline via `npm run pipeline`, write results to `data/generated/*.json`, commit them. The UI reads these, so the demo never waits on an API.
- **Live mode:** a "Run live" panel where I paste one new article (text plus title, source, date, URL). It runs Filter -> Shift Extraction -> Verification -> re-score, streaming each step's status to the UI, then shows how the matrix changed. If the API call fails or times out, fall back gracefully with a clear message and the cached result.
- Deploy to Vercel. I'll also record a backup screen recording.

## Tech stack
- Next.js (App Router) + TypeScript (strict), Tailwind CSS
- Anthropic SDK (`@anthropic-ai/sdk`), model from env var `ANTHROPIC_MODEL`, API key from `ANTHROPIC_API_KEY`
- Zod schemas for every agent's input and output; LLM output must be validated, with one retry on parse failure
- Pipeline scripts in TypeScript (same modules used by the offline pipeline and the live API route)
- Vitest for tests
- One language end to end so the codebase stays explainable

## Data (I will provide; you build the formats and loaders)
- `data/raw/news/*.md`: one article per file with YAML front matter (id, title, source, url, published_date, source_type: primary|trade|blog) and body text. I'll curate 12 to 15 recent articles. These are for private class use; the UI only shows short excerpts and links to the original.
- `data/raw/jds/tpm/*.md`: one JD per file with front matter (id, company, title, url, captured_date, level) and body text. I'll save 15 to 20 TPM postings manually (no scraping).
- `config/taxonomy.json`: role-agnostic skill taxonomy (about 20 skills). Each skill: id, name, description, aliases, roles.
- `config/scoring.json`: thresholds and weights.
- 3 placeholder articles and 3 placeholder JDs so the pipeline runs end to end before real data arrives, clearly marked as placeholders.

## Quality and credibility (this is how we win)
- **Evaluation script:** `npm run eval` compares Shift Extraction and JD Analyzer output against a small hand-labeled set in `data/eval/` (I'll label ~20 items). Report precision and recall per agent. I want to say in the pitch: "skill extraction precision X on a hand-labeled set" instead of hand-waving.
- **Cost and latency log:** record tokens and time per agent per run; show totals on the How it works screen.
- **Prompt files:** keep each agent's prompt in its own file under `src/agents/prompts/` so I can show and explain them.
- Unit tests for the Signal Scorer and loaders.

## Documentation deliverables
- **README.md:** overview, setup, how to run pipeline / eval / app, env vars, demo inputs, external APIs and data sources, known limitations, and an "AI usage" section that honestly separates what I designed (product concept, signal matrix logic, taxonomy, agent roles, human-in-the-loop policy) from what was generated with Claude Code and then reviewed by me.
- **docs/ARCHITECTURE.md:** Mermaid diagram plus a plain-language walkthrough of data flow from raw article to matrix cell.
- **docs/DEMO_SCRIPT.md:** a 5-minute demo script: problem (30s), persona (20s), Today view and matrix (60s), skill evidence drill-down (45s), Run live with a fresh article (60s), How it works pipeline view (45s), limitations and team expansion pitch (30s). End with: "In a team version, each member owns a role vertical, so the product grows with the team's own career interests."
- **docs/ONE_PAGER.md:** Problem, Target User, Solution, Key Features (built vs future), AI/Technical Approach, Demo Flow, Limitations (small curated dataset, signals not causal predictions, LLM extraction errors measured by eval), Future Direction (team role verticals, live feeds, user resume gap analysis, weekly email digest).

## How I want you to work
1. Build in phases and STOP at each checkpoint for my review:
   - Phase 1: scaffold, schemas, loaders, placeholder data, taxonomy draft
   - Phase 2: agents 1 to 5 with prompts, orchestrator, `npm run pipeline` working end to end on placeholder data
   - Phase 3: Signal Scorer with tests, generated JSON
   - Phase 4: UI (Today, Skill detail, How it works), design pass
   - Phase 5: Editor Queue, Live mode with streaming steps, audio brief
   - Phase 6: eval script, cost/latency log, docs, Vercel deploy, ZIP packaging script that excludes `.env*` and `node_modules`
2. After each phase, explain in plain language what you built, how data flows through it, and the 2 or 3 things I should be ready to explain if the professor asks. Keep this short.
3. Commit after each phase with clear messages.
4. Never commit secrets. Ask before installing anything unusual.
5. If a design decision has real tradeoffs, give me 2 options with a recommendation instead of silently choosing.
