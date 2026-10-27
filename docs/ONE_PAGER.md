# SkillShift

**An AI career news portal that traces tech news to real TPM hiring requirements.**
Deokhwa Jeong | 49772 Week 1 Individual Assignment | Agentic AI News Portal
Live app: https://skillshift-xi.vercel.app | Code: https://github.com/deokhwajeong/skillshift

> **The idea in one line:** news tells you what changed, job postings tell you what is hired for. SkillShift connects the two, and lets you click through to the evidence behind every insight.

This is the source text of `one-pager.pdf` at the repo root.

## 1. Problem

Tech job seekers read a constant stream of news but cannot tell which shifts matter for hiring. News portals summarize what happened without saying what it means for a career. Resume tools match keywords to postings without explaining why a skill matters now. Generic chatbot advice ("learn AI evaluation") comes with no evidence the user can check.

## 2. Target User

Graduate students and early-career professionals preparing for Technical Program Manager (TPM) internships and full-time roles, who must decide what to learn, what to highlight on a resume, and what to prepare for interviews, with limited time.

## 3. Solution

SkillShift reads curated tech news, extracts each concrete *shift* (a change in technology, practice, regulation, or market), verifies it against the article, and checks it against what real TPM postings ask for. Every skill lands in a **Signal Matrix**: **Rising** (in the news and in postings), **Emerging** (in the news, not yet in postings: an early-mover chance), **Established** (in postings, not in the news: table stakes), or **Fading**. **News is the starting point; job postings are the evidence that grounds it.**

## 4. Key Features

*Built in this prototype*

- **Signal Matrix:** 20 TPM skills placed by news signal vs job-posting signal; the quadrant is a fixed rule in a config file, not the model's opinion
- **Today's Brief:** What changed / Why it matters for TPMs / What to do this week, every sentence cited; **Listen** reads it aloud
- **News-to-Skill traceability:** click a skill to see how its score was computed, word-for-word article quotes, and the exact posting lines, with AI interpretation labeled separately
- **Editor Queue (human review):** weak, low-confidence, or conflicting findings wait for a person; approving one re-scores the matrix
- **Run live + How it works:** one fresh article streamed through the agents; every stage shows real input and output, cost, and a link to its code

*Future:* more roles (PM, SWE, Data Science), live feeds, resume gap analysis, weekly digest

## 5. AI / Technical Approach

A seven-stage pipeline on the Claude API (Claude Sonnet 5.5), built with Next.js, TypeScript, and Zod, deployed on Vercel. **LLMs read; code decides.**

- **Filter** (LLM): relevance and duplicates; code applies the threshold
- **Shift Extraction** (LLM): each shift with a short quote, skills, confidence
- **Verification** (LLM + code): is the quote really in the article, is it supported, does it conflict with other sources
- **JD Analyzer** (LLM + code): required vs preferred skills per posting
- **Signal Scorer** (code): recency- and source-weighted scores, quadrants
- **Brief Writer** (LLM): the cited briefing

Every LLM output is schema-validated with one retry; anything that fails or is uncertain goes to the Editor Queue, never straight to the page.

**Data:** 14 recent articles (Aug to Oct 2026; company blogs, trade press, independent blogs) and 16 real TPM postings (Anthropic, Stripe, Airbnb, Waymo, and others). **Real run:** 11 articles kept, 49 shifts, 38 published, 11 held for review; 53 LLM calls, about $0.75. Results are precomputed for demo reliability.

## 6. Demo Flow

- Persona: a CMU student preparing for TPM recruiting
- Today: the matrix and the cited brief, read aloud
- Click a skill and trace it to source quotes and postings
- Run live: a fresh article (InfoQ, Oct 24): 2 shifts published, 3 held
- Try a weak input: why a vague article never gets published
- How it works: stage counts, real inputs and outputs, View code

## 7. Limitations

- Small hand-curated dataset: signals describe this set, not the whole market, and are not predictions
- LLMs can misread or over-connect; quote checks, verification, and human review reduce this but do not eliminate it
- An accuracy eval is built, but the real set is not hand-labeled yet, so no accuracy numbers are claimed
- Limited to TPM roles and English-language sources

## 8. Future Direction

As a semester team project, **each member owns a role vertical** (PM, SWE, Data Science), so the product grows with the team's own career interests. Next: larger and live data, trend validation over time, personalized learning paths, and testing with CMU students during recruiting season. **Business model:** licensing to university career centers and bootcamps, plus a free tier for individual job seekers.
