# SkillShift

SkillShift reads tech news and maps each shift to real job requirements, showing tech job seekers which skills are **Rising**, **Emerging**, **Established**, or **Fading**, with the evidence behind each.

CMU MSSM individual assignment: Generative AI News Portal.

> Status: Phase 4 (UI: Today, Skill detail, How it works). See docs/STATUS.md. The full README (pipeline, eval, demo, AI usage) is written in Phase 6.

## Setup

Requires Node 22+.

```bash
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app at http://localhost:3000 |
| `npm run check:data` | Validate config and all raw data, print a summary |
| `npm test` | Run unit tests (Vitest) |
| `npm run typecheck` | TypeScript strict check |

## Layout

```
config/        roles.json, taxonomy.json, scoring.json (see config/README.md)
data/raw/      curated news and job descriptions (see data/README.md)
data/generated pipeline outputs read by the UI
src/pipeline/  schemas.ts (data contract), loaders.ts
src/lib/       shared helpers
scripts/       command-line entry points
tests/         Vitest tests
```
