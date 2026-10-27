---
id: news-006
title: "Coordinate product launches with Datadog"
source: Datadog
url: https://www.datadoghq.com/blog/coordinate-product-launches-with-datadog/
published_date: 2026-09-08
source_type: primary
---

Launches are high-stakes moments for product managers (PMs), but understanding how a new product or feature is performing can be difficult. Teams may lack the instrumentation they need to track performance, or they may miss defects that affect specific user segments during QA. When a launch underperforms, PMs can spend days determining whether the problem is the feature itself or how it’s being measured, leaving analysts, engineers, and designers needing to rebuild what should have existed on day one.

Launches in Datadog Product Analytics connects launch planning, instrumentation, experimentation, user experience analysis, and reporting together in a single, connected workflow. Starting with a product brief and the Datadog Feature Flag, teams can define what they need to measure before release and monitor the most important user signals throughout the rollout.

In this post, we’ll show you how you can use Launches to:

- Plan and instrument a launch before it ships

- Catch broken experiences across real user segments

- Validate experiments as you roll out

- Bring launch signals into one place

- Keep measuring after the rollout

Most PMs already know what questions their launch has to answer, but they may not be sure those questions will be answerable on launch day. This happens when the necessary instrumentation to track how users are interacting with the new feature is not in place at rollout.

When you create a launch in Product Analytics, the planning workflow moves through four steps: context, questions, tracking plan, and experiment. Bits AI drafts each step for you to edit, rather than handing you a blank form.

For example, say you’re launching an exclusive cart offer that adds an upsell to an ecommerce cart. In the context step, you paste the brief and connect the feature flag the offer will ship behind. In the questions step, you can draft measurement questions, such as how many eligible users see the offer, how many interact with it, and whether it changes the average order value, or use Bits AI to automatically generate questions based on your launch’s brief. You can then edit, add, or remove these questions to match the decisions your team expects to make.

The tracking plan step derives the events and properties needed to answer each of those questions. This keeps instrumentation tied to the launch’s measurement goals, instead of defining events only around available UI interactions.

Datadog compares that plan against the events you already send and shows you which events and properties are missing to answer your questions. Where a relevant event already exists, Datadog reuses it instead of instrumenting the same thing twice. Once you confirm the tracking plan, Datadog can open a pull request with the required instrumentation. Your team can review the measurement logic and implementation before the rollout starts, rather than discovering gaps after data starts to arrive.

This workflow can also apply to product changes that don’t modify the web UI, such as ranking or recommendation algorithms. Because the tracking plan starts with outcomes rather than clicks, teams can define measurement around the behavior that matters for the launch.

Pre-release QA cannot cover every device, screen size, geography, network condition, and user behavior that a feature will encounter in production. This gap makes it difficult to catch defects that leave a feature technically available but difficult or impossible to use.

In our exclusive cart offer, for example, a quantity selector might render correctly and accept clicks without triggering the expected action. On a mobile screen, the component might also extend past the viewport, putting the Add to Cart button outside the usable page. A test on a developer’s laptop may not expose either problem.

As traffic increases, Launches shows you Session Replay and RUM data from users exposed to the feature flag. Comparing the treatment and control sessions helps you focus an investigation on friction associated with the product change.

Datadog also enables you to break down sessions by dimensions such as device type, screen size, or country. If an issue only affects one segment, you can move from that segment to the relevant issues and example Session Replays to understand what those users experienced.

This context complements experiment metrics, helping you better interpret product data. A conversion decrease can tell you that a treatment is underperforming, while a Session Replay that captures repeated clicks on a nonfunctional quantity selector helps explain why.

With instrumentation in place before launch day, the Datadog Feature Flag you connected to your launch becomes the link between the change and the users who saw it. Launches in Product Analytics runs your rollout through Datadog Experiments, so you can compare product, performance, and business outcomes between treatment and control using statistics your data science team has already approved.

In the experiment step of the launch workflow, experiment metrics will be prefilled based on the launch definition and remain editable before the experiment begins. This lets data science teams establish reusable experiment designs instead of redefining the methodology for every launch.

From here, Datadog Feature Flags controls targeting and progressive exposure. A rollout can begin with employees or a small percentage of traffic, giving teams an opportunity to find experience and configuration problems before increasing exposure. After validating the initial cohort, the team can increase traffic for the experiment.
