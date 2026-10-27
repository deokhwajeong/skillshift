---
id: news-012
title: "Making Your Data Ready for Agentic AI"
source: martinfowler.com
url: https://martinfowler.com/articles/making-data-ready-for-agentic-ai.html
published_date: 2026-08-27
source_type: blog
---

For thirty years we built data systems for human analysts, who supply the context, judgment, and skepticism to work around data that's incomplete or wrong. Autonomous agents supply none of that. They act on whatever they're handed, confidently. For data to be AI-ready we need to build a series of layers: a data foundation that makes data trusted, a context layer to apply proper meaning, and an access layer that supports and controls how agents operate on that data. While doing this we need continuous attention to observability that ensures the data is properly governed and we have an auditable trace of its use in decision-making.

There's a lot of excitement right now about agent frameworks, orchestration patterns, and protocols. All of it matters, but almost none of it delivers value if you skip the data layer. Before any agent framework can produce useful outcomes, your data has to be in a shape that a machine can consume, trust, and act on. In this article, we discuss what your data needs to look like for agentic AI to derive value from it.

We've spent quite a bit of time building data architectures for the human consumer. We're about to hand those architectures to a very different kind of consumer, and most of them aren't ready for it.

The consumers of your data are changing

For over three decades, we've been building data systems for humans. Dashboards, reports, analyst queries, all of it designed around a person sitting in front of a screen. And it worked, because humans bring an enormous amount of implicit context, along with the curiosity to track down whatever they're missing from the people around them.

A human analyst knows what “revenue” means in your particular organization. They know which tables to query and which ones to avoid. They notice when a number looks off, when a total is suspiciously round, when a date falls on a public holiday, or when a price seems too low. That instinct is doing a large amount of invisible context and knowledge work.

A human hesitates at data that looks wrong; an agent acts on it anyway

Agents have none of it. They can't lean on the tribal knowledge and pattern recognition people accumulate over years, so they need context made explicit, access in real time, and quality they can rely on. And the difference that matters most is this: when the data feels wrong, a human double-checks; an agent confidently acts on it. That behavioral gap is what the rest of this discussion is built around.

What “AI-ready” has to mean now

For a human consumer, the data only had to be good enough; the analyst did the rest. The meaning, the sanity check, and the judgment about whether a number could be trusted all lived in a person's head. When the same data is handed to an agent, every bit of that implicit labor has to move into the data itself. That shows up as five attributes, each the flip side of something a human used to do for free.

- Trusted: a person pauses at a number that feels wrong; an agent acts on it. The confidence a human used to supply has to be built in, so the data must be accurate, fresh, and validated before the agent ever sees it.

- Contextual: a person knows your “revenue” figure already has returns taken out, and that your fiscal year starts in February; an agent has to be told both. Meaning that used to live in someone's head has to be made explicit in the data.

- Traceable: when a person decides, they can explain why afterward; when an agent decides in 30 seconds, that reasoning is gone unless you capture it as it happens. You have to be able to reconstruct what the agent did and why.

- Governed: a person's access is bounded by their role and their judgment; an agent's has to be bounded by design. Access must be scoped, controlled, and auditable.

- Operational: a person reads a dashboard and then goes and does something; an agent has to be able to do the something. The data can't just be readable, it has to be actionable.

All five come down to the same idea. Each is a job humans used to do without thinking, now pushed into the data itself. Miss one, and the agent won't degrade gracefully the way a person would. It fails confidently.

None of these attributes builds itself. The rest of the article works through four topics that do, roughly in the order you should tackle them.

- Data Contracts and Quality makes data Trusted. We start here, because a single wrong fact poisons every layer built on top of it.

- Traceability and Governance records why an agent acted and bounds what it can reach, making data Traceable and Governed.

- The context layer encodes what your metrics and entities mean, making data Contextual.

- From Searchable to Actionable lets agents query live systems and write back, making data Operational.

We'll take them one topic at a time, and show what it takes to build each attribute in. Work through all four, and the five attributes stop being abstract goals. They become something you can engineer, turning ordinary data into AI-ready data.
