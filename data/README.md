# Data

```
data/
├── raw/
│   ├── news/          one article per .md file (copy news/_TEMPLATE.md)
│   └── jds/<role>/    one job description per .md file (copy jds/tpm/_TEMPLATE.md)
├── generated/         pipeline outputs, committed so the demo never waits on an API
└── eval/              hand-labeled items for `npm run eval` (Phase 6)
```

## Rules

- File names: anything ending in `.md`. Files starting with `_` are skipped (templates, notes).
- Ids must be unique within news and within each role's JDs.
- Dates are `YYYY-MM-DD`.
- Placeholder files have `placeholder: true` and `[PLACEHOLDER]` in the title. Delete them once real data is in.
- Run `npm run check:data` after adding files. It lists every problem at once.

## Usage note

Articles and job postings are saved for private class use. The UI only shows short excerpts (under 15 words) and links to the original.
