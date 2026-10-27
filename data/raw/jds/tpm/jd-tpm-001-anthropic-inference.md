---
id: jd-tpm-001
company: Anthropic
title: "Technical Program Manager, Inference"
url: https://job-boards.greenhouse.io/anthropic/jobs/5453262008
captured_date: 2026-10-27
level: Mid-Senior (7+ yrs)
---

About the role

Anthropic’s Inference organization serves Claude to millions of users and enterprise customers, across our own products and the world’s largest cloud platforms, with the speed, reliability, and efficiency that frontier AI demands. The stack that makes this possible is deep and tightly coupled: accelerator kernels, an in-house inference engine that manages the entire token path for both production and research workloads, distributed routing, autoscaling, and capacity management. Every layer affects the others, often in ways that are hard to see in isolation. We build across GPUs, TPUs, and Trainium, and the complexity of building, testing, and shipping inference software grows with every platform we add.

We're looking for a Technical Program Manager to drive the programs that scale it. The work spans four closely coupled areas:

Scaling and infrastructure. Routing, autoscaling, and capacity management for the serving fleet, and bringing new capacity online.

Velocity. The toolchains, development environments, and CI/CD that let inference engineers build, test, and ship across every accelerator platform.

Inference engine. The software between the accelerator kernels and the routing layer that serves every request.

Performance. Improving throughput, latency, cost, and reliability across the stack, with correctness treated as part of performance.

This is not a status-tracking role. You'll own outcomes end to end, often where no single team is accountable for the whole picture. Much of your value comes from crossing boundaries into Research, Safeguards, Security, Compute, Infrastructure, API, and our cloud and silicon partners, and bringing back the requirements and dependencies that no team sees from inside its own space. There is little process to inherit, and we want to keep it that way: you'll build the minimum machinery the work needs and remove it when it stops helping. And because this is Anthropic, you'll have Claude as a collaborator. We expect TPMs on this team to push hard on what AI-assisted program management and fleet operations can look like.

Key responsibilities

Own the programs that scale Claude’s serving fleet across accelerator and cloud platforms, from early direction through delivery.

Drive new capacity online end to end, working across compute, infrastructure, security, networking, and inference teams so one person is accountable for the whole path.

Build visibility into supply, demand, and utilization with capacity and finance partners, and drive trade-offs among utilization, cost, latency, and reliability to a clear decision.

Lead reliability programs and large migrations without disrupting production traffic or research, and make sure incident follow-ups land in team roadmaps.

Drive the programs that make inference engineers faster: define the productivity metrics that matter, find the bottlenecks, and improve how software is built, tested, and released across platforms, in step with Anthropic’s central Infrastructure org.

Coordinate roadmaps and priorities across the production, research, and safeguards needs that depend on the same teams.

Track performance and efficiency work from opportunity to measured impact in production, with correctness held as a release criterion.

Own inference readiness for model launches alongside our launch TPMs.

Minimum qualifications

7+ years of experience as a TPM, or in an equivalent engineering or SRE lead role, owning large multi-team infrastructure programs end to end in production distributed systems, ML infrastructure, or cloud platforms. You can speak to the outcomes in detail, including where a program slipped and what you did about it.

Technical fluency in large-scale serving infrastructure, including request routing and load balancing, autoscaling, capacity planning, cluster orchestration, deployment and rollout, and observability. You know enough to challenge a design, find the real risk, and add value beyond tracking.

A working understanding of how LLM inference uses hardware (prefill and decode, batching, caching, compute versus memory bandwidth versus interconnect), or a track record of getting deep in an unfamiliar technical domain quickly.

A track record of building program mechanisms from scratch on ambiguous, fast-moving efforts, and of retiring process that has stopped earning its keep.

The ability to drive outcomes across organizations you don't manage, with competing priorities and unclear decision ownership. You read people and rooms well, know when to push and when to listen, and earn the trust of senior engineers and researchers.

Strong written communication, including plans, reviews, and executive updates that many teams depend on.

Low ego and high ownership. You do whatever the program needs, whether that is writing a script, running an incident bridge, or chasing a quota, and you care more about the outcome than about scope or credit.

Care about Anthropic's mission and about serving frontier AI safely and reliably.

Preferred qualifications

Direct experience with LLM or ML inference serving at scale, such as model servers, batching and scheduling, KV caching, quantization, speculative decoding, or multi-model routing.

Experience with accelerator infrastructure (GPU, TPU, or Trainium), including cluster bring-up, hardware qualification, or running one workload across more than one accelerator platform.

Experience managing capacity across multiple clouds or regions, including demand forecasting, headroom policy, cost modeling, or unit economics for compute-heavy services.

Experience with developer productivity, release engineering, or CI/CD at scale, especially for hardware-dependent workloads, and with using engineering metrics to measurably raise velocity.

Experience running performance or efficiency programs, with enough grounding in rooflines, kernels, ML compilers (XLA, Triton, Neuron), numerics, or collective communication to reason about trade-offs with the engineers doing the work.

Familiarity with Kubernetes-based orchestration and job scheduling.

Experience working with research teams and turning their needs into infrastructure requirements.

Practical experience using AI tools in your own workflow, including building automations or agents, and clear ideas about where they help and where they don't.
