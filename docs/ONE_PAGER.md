# SkillShift: tech news, checked against what job postings actually ask for

**Deokhwa (Deka) Jeong, CMU MSSM. Generative AI News Portal, individual assignment.**

## Problem

Tech job seekers are flooded with "the next big skill" headlines, but nothing tells them which shifts employers actually hire for. News portals summarize; job boards and resume matchers (Teal, Jobscan, LinkedIn) match keywords. No one connects a news shift to hiring evidence, and AI summaries rarely show where a claim came from.

## Target user

Tech job seekers, especially grad students heading into internship and full-time recruiting. Demo persona: a Technical Program Manager candidate preparing for Netflix, Google, Apple, and Amazon applications.

## Solution

A news portal that reads tech news, extracts each concrete shift, and grounds it in real job postings. Every skill lands in a Signal Matrix: **Rising** (in the news and in postings), **Emerging** (in the news, not yet in postings: an early-mover opportunity), **Established** (in postings, not in the news: table stakes), or **Fading** (coverage dropping, few postings). Every claim links to its evidence.

## Key features

| Built | Future |
|---|---|
| Signal Matrix (hand-built SVG) with fixed, explainable thresholds | Live news feeds (an RSS adapter interface is stubbed) |
| Today's Brief: What changed / Why it matters / What to do this week, every sentence cited | Weekly email digest |
| Skill detail with score explanations, quoted evidence, conflicts, evidence level | User resume gap analysis against the matrix |
| Editor Queue: a human approves held items; the matrix re-scores instantly | Team role verticals: PM, SWE, Data Science |
| Run live: one fresh article through the agents, streamed step by step | Shared editor accounts and an audit log |
| How it works: stage counts, real inputs and outputs, accuracy, cost log | |
| Listen: the brief read aloud (browser speech) | |

## AI and technical approach

- **Multi-agent pipeline**, one module per agent: Ingest (code), Filter (LLM), Shift Extraction (LLM), Verification (LLM plus code checks), JD Analyzer (LLM plus code checks), Signal Scorer (pure TypeScript), Brief Writer (LLM plus citation checks).
- **LLMs read; code decides.** Every LLM output is validated against a Zod schema with one retry. Keep or drop, publish or hold, and the quadrant are deterministic code with thresholds in `config/scoring.json`, and the scorer is unit tested.
- **No claim without evidence.** Quotes must appear word for word in the source (checked by code). Every brief sentence must cite a source the writer was given.
- **Human in the loop by design.** Low confidence, weak evidence, conflicting sources, and proposed new skills wait in the Editor Queue. AI does the reading; a human approves what gets published.
- **Clear AI labeling.** AI-written text carries an "AI-generated" label naming the agent; source material is shown as quotes with links.
- **Measured quality.** `npm run eval` reports precision and recall of skill extraction and JD analysis against [20] hand-labeled items: extraction precision [X]%, recall [Y]%.
- **Demo reliability.** Results are precomputed and committed; Live mode streams a real run and falls back to a recorded run if the API fails.
- **Stack:** Next.js (App Router), TypeScript strict, Tailwind CSS, Zod, Anthropic SDK (Claude Sonnet 5.5, Haiku 5.5 for filtering), Vitest. Deployed on Vercel.

## Demo flow

Problem, persona, the Today matrix and brief (with Listen), a skill's evidence drill-down, Run live with a fresh article, How it works with stage counts and accuracy, then limitations and the team expansion pitch.

## Limitations

- Small curated dataset (about 15 articles, 15 to 20 TPM postings): signals describe this set, not the whole market.
- Signals are not causal predictions; they describe what is in the news and in postings now.
- LLM extraction errors happen; they are measured by the eval and contained by the Editor Queue.
- Editor decisions are stored per browser until exported; there are no user accounts.

## Future direction

Team role verticals (each member owns PM, SWE, or Data Science: postings, taxonomy additions, eval labels), live feeds, user resume gap analysis against the matrix, and a weekly email digest. In a team version, each member owns a role vertical, so the product grows with the team's own career interests.
