# Config

All tuning lives here so it can be changed and explained without touching code.
Every file is validated by a Zod schema in `src/pipeline/schemas.ts`. Unknown keys are rejected, so a typo fails loudly.

## roles.json

The roles in the selector. `status: "full"` means the role has a dataset. `status: "expansion"` shows a "Team expansion" card instead.
To add a role: add an entry here, add its id to the relevant skills in `taxonomy.json`, and put JDs in `data/raw/jds/<role-id>/`.

## taxonomy.json

A flat list of skills. Each skill has an `id` (kebab-case, never shown to users), `name`, `description`, `aliases` (other phrasings the agents should map to this skill), and `roles` it applies to.
The loader rejects duplicate ids, unknown roles, and an alias claimed by two skills.

## scoring.json

| Key | Meaning |
|---|---|
| `asOfDate` | The "today" used for recency. `null` means the newest article date, so the demo does not drift as real time passes. |
| `windows.recentDays` | News momentum compares mentions in the last N days... |
| `windows.earlierDays` | ...against mentions in the N days before that (scaled to the same length). |
| `news.recencyHalfLifeDays` | A mention loses half its weight every N days. |
| `news.saturation` | Weighted mentions needed for a news signal of 1.0. With 3, three fresh, strong, primary-source shifts max out a skill. |
| `news.sourceWeights` | How much a mention counts by source type (primary > trade > blog). |
| `news.evidenceWeights` | How much a mention counts by the Verification Agent's evidence level. |
| `jd.requiredWeight` / `preferredWeight` | A "required" mention counts fully, a "preferred" one counts half. JD signal = weighted mentions / number of JDs. |
| `thresholds.newsStrong` | News signal at or above this is "strong in news". |
| `thresholds.jdStrong` | JD signal at or above this is "strong in JDs" (0.35 is roughly "about a third of postings ask for it"). |
| `thresholds.fadingMomentum` | Momentum at or below this (and weak JDs) means Fading. |
| `thresholds.minEarlierMentionsForFading` | A skill needs at least this many earlier mentions before it can be called Fading (avoids noise). |
| `editorial.filterMinRelevance` | Filter Agent relevance below this drops the article. |
| `editorial.publishMinConfidence` | Shifts below this confidence go to the Editor Queue instead of being published. |
