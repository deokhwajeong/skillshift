# Demo script (5 minutes)

Total: 4 minutes 50 seconds, leaving 10 seconds of slack. **Bold** is what to click; quoted text is what to say. Numbers in [brackets] come from the final real run: fill them in after `npm run pipeline` and `npm run eval`.

## Before class

- [ ] Real data run and committed: `npm run pipeline`, `npm run eval`, `npm run live:cache`. The SAMPLE banner is gone.
- [ ] Deployed site open in one tab on **Today** (`/tpm`); a second tab on **Run live** with the form already filled (**Fill with the demo article**) and the passphrase typed.
- [ ] Editor Queue reset: on Today, no "Including N Editor Queue decisions" bar (click **Reset** if it shows).
- [ ] Laptop volume up for **Listen**.
- [ ] Backup screen recording on the desktop. If Wi-Fi fails, Run live still works with **Replay the cached run (no API)**.

## 1. Problem (30 s)

Screen: Today, scrolled to the top.

"Every week there is news about some skill being the next big thing: evals, agents, AI governance. If you are job hunting, you cannot tell which of these employers actually hire for, and which are just noise. News sites summarize; job boards match keywords. Nobody connects the two."

## 2. Persona (20 s)

Point at the **Role** selector (TPM).

"My user is someone like me: a grad student going for TPM roles at Netflix, Google, Apple, Amazon. SkillShift reads the tech news and checks every claim against real TPM job postings."

## 3. Today and the Signal Matrix (60 s)

Screen: the matrix.

"Each dot is a skill. Up means the news is talking about it; right means job postings already ask for it. The dashed lines are fixed thresholds from a config file, so the quadrant is a rule, not the model's opinion."

Point at each quadrant:
- "**Rising**, top right: in the news and in postings. [LLM evaluation] is here."
- "**Emerging**, top left: in the news, not in postings yet. An early-mover opportunity."
- "**Established**, bottom right: postings ask for it, the news does not. Table stakes."
- "And **Fading**: coverage is dropping and nobody is hiring for it. [Web3]."

Scroll to **Today's Brief**. "The brief turns this into three things to do this week: what to learn, a resume angle, an interview question. It is labeled AI-generated, and every sentence cites its source." Click **Listen** for 3 to 4 seconds, then **Stop**. "And you can listen to it on the way to class."

## 4. Skill evidence drill-down (45 s)

Click the **[LLM evaluation]** dot.

"No claim without evidence. Here is how the score was computed, in plain words: [3] verified articles, weighted by recency, source type, and evidence level; [4 of 15] postings require it."

Scroll to the evidence. "Every quote is copied word for word from the source, and code checks that it is really there, so the model cannot invent a quote. On the right, the exact lines from job postings."

If the skill has a **Conflicting claims** box: "When sources disagree, we do not pick a side. The claim waits for an editor."

## 5. Run live (60 s)

Switch to the **Run live** tab (form already filled).

"Here is a fresh article from [this week] that the system has never seen." Click **Run live**.

While the steps stream: "The Filter decides it is relevant. Extraction pulls out the shifts and maps them to skills. Verification checks each one against the article and against what we already know. Then plain code re-scores everything."

When the result appears: "This one was published; this one is held for an editor because [the evidence is weak / it conflicts with an earlier source]. And on the matrix, the dashed circle is where the skill was, the dot is where it is now."

If it fails: "The API is not cooperating, so it falls back to a recorded run, and it tells you so." That is the reliability story; keep going.

Optional, only if time allows: open **Editor Queue**, click **Approve** on one held item, and point at **Effect on the matrix**. "AI does the reading; a human approves what gets published."

## 6. How it works (45 s)

Click **How it works**.

"Seven stages. Five use an LLM, two are plain code. [15] articles in, [13] relevant, [25] shifts, [23] verified and published, [16] skills placed on the matrix." Click **Verification**: "Every box shows a real input and output from this run."

Scroll to **How accurate are the agents?**: "I hand-labeled [20] items. Skill extraction precision is [X] percent, recall [Y] percent." Then the cost log: "[57] LLM calls for the whole run, [N] tokens, with prompt caching."

## 7. Limitations and team expansion (30 s)

Click the **PM** role chip.

"Limits: it is a small curated dataset, the signals describe what is happening now and do not predict anything, and the LLM makes mistakes, which is why I measure them and why a human approves uncertain items."

"The pipeline is role-agnostic. Adding PM is adding data files and a taxonomy entry; no code changes. In a team version, each member owns a role vertical, so the product grows with the team's own career interests."
