---
id: news-003
title: "Cutting our inference bill by 68% by being obsessive about optimization"
source: Cloudflare Blog
url: https://blog.cloudflare.com/obsessive-inference-optimization/
published_date: 2026-10-19
source_type: primary
---

When we previously blogged about our AI code reviewer in April, an average review cost a palatable $1.19. By the end of August, that figure had shot up to about $2.46. We hadn't made any significant architectural changes: the coordinator was still handing work to the same set of specialist reviewers, and the same risk tiers decided how intensive of a review we gave.

Around mid-September we tasked our agents with working out where those tokens were going and cutting them - aggressively. With code quality at high effort, the average review now costs just $0.77, down 68% from the $2.43 it averaged over our two most expensive weeks before we started. Our main goal was to cut costs, but as part of this work we also managed to optimize the reviewer, so that the median review now takes just 1m 32s instead of the 4m 09s it took before.

About 40% of the savings came from changes and optimizations to the reviewer's code, and the rest from experimenting with which models we use and how much effort they put in.

How a review doubled in cost

The chart below shows the cost of an average review on each weekday since March. It holds the mix of review tiers fixed, so a day with more large reviews doesn't skew the data.

The cost per review steadily rose from $1.22 (March) → $1.44 (June) → $1.74 (July) and finally, to $2.32 (August). A small part of that is that more reviews landed in the most expensive tier (59% of reviews in March and then 65% in August). We believe there’s a simple answer for why: models are getting much better, and much more capable. Naturally, engineers are producing bigger, more complex changes which means more of them fall into our “full review” tier. We found that most of the cost increase actually came from model changes over those months, though.

At the start of August we moved every reviewer onto Anthropic models, which raised the cost per job from $1.38 to $2.03. We made this choice because we found that during our evals, Anthropic models performed better on this specific workload than other models.

Our internal standards reviewer, Codex, ended up on Claude Opus 4.7 due to a mix of performance and reliability. That took it from about $0.25 per review to $0.88 in August, which made it more expensive than the coordinator agent itself.

The cache hit rate also increased, going from 85.7% in April to 97% by September, while the number of tokens per review more than tripled, from 0.91 million to 2.99 million. A high hit rate on three times as many tokens still costs a lot more, even with the low cache read cost.

What else has changed since our last post?

One of the biggest changes is that the reviewer now runs on OpenCode v2, which is a ground-up rewrite from v1. Before switching all reviews over from v1 to v2, we ran every review in every canary repo on both v1 and v2 in a comparative shadow mode. The two agreed on the approval decision in 98% of the merge requests we tested, so we moved everyone over in one go in early October and removed the v1 code. Comparing two days with the same models, full-tier reviews on v2 finish about 13% faster. We’re also currently experimenting with other ways to run our internal AI reviewer, including solely on Durable Objects using pi-durable. We’re hopefully going to have more on this coming soon, so keep an eye out!

So, where were the tokens going?

Right before we started focusing on cost optimization, our AI review spend was split by: output tokens making up about 23%, cache writes cost 43%, and cache reads cost 34%. This means that most of the money was going on context the model had already seen or was about to see again.

That makes complete sense when you look into a single session. The code quality reviewer made 16.6 large language model (LLM) calls per review on average and over those calls it wrote 72k tokens to the cache and read back 1.08m, because each call sends the whole conversation as context. A session's cost grows with both the number of calls and the size of the context, and over the last few months we had slowly increased both.

It’s worth taking a few minutes to read about how Anthropic's prompt cache works. It works by caching parts of the prompt that have already been computed by the large language model (LLM). These are known as prefixes, because they only work on the messages at the start of the conversation, not mid way through or the end. This means that a future request can reuse an earlier prefix, up to the part of the conversation that changes from what’s been cached. In our case, the harness tools, system prompt and messages at the start of our AI reviewer sessions rarely change, so they’re a great candidate for prefix caching. A prefix is only stored where a cache breakpoint ends it. Writing to the cache costs 1.25 times the normal input price and reading costs 0.1 times, and an entry expires after five minutes unless something reads it.
