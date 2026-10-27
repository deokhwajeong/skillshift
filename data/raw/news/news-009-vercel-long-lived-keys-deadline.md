---
id: news-009
title: "Vercel sets a deadline for vendors to move beyond long-lived keys"
source: The New Stack
url: https://thenewstack.io/vercel-oidc-static-credentials/
published_date: 2026-10-23
source_type: trade
---

Vercel wants to eliminate long-lived API keys from its ecosystem. It is giving Marketplace vendors until January 2027 to offer more secure authentication or risk being delisted.

The push comes as credential-stealing supply chain attacks - including a recent npm worm that scraped tokens straight out of CI pipelines - keep proving how much damage a single leaked secret can do.

In an October 22 announcement, Vercel CTO Malte Ubl said the company surveyed more than 1,000 SaaS vendors and found that only 8.4% supported what Vercel considers secure authentication methods. Vercel is pushing OpenID Connect (OIDC) and short-lived, identity-based tokens as alternatives to static API keys that can stay valid indefinitely.

Vercel CEO Guillermo Rauch amplified the message on X, writing that it is “time to kill ‘static credentials.’” Attacks and breaches can still happen, he argued, but stolen credentials should behave more like “self-destructing keys,” limiting how long an attacker can use them.

The first deadline arrives November 30, 2026, when Marketplace vendors that still rely on long-lived secrets without supporting OIDC authentication will receive a “Not secure” warning on their listings. Vendors that do not offer secure authentication by January 2027 will be delisted. Vercel says it is holding its own API and native integrations to the same standard.

The announcement does not include the survey methodology, identify the surveyed companies, or say how many existing Marketplace partners need to change their authentication systems.

Vercel’s OIDC rollout for deployments

That transition is still underway for customers deploying to Vercel through GitHub Actions. Vercel’s deployment guide still tells them to authenticate with a VERCEL_TOKEN secret.

On October 23, Yordis Prieto, a senior software engineer at Fanatics, asked Vercel to remove that requirement, saying he still needed “a long-lived access token” in his CI pipeline. He also criticized the dashboard’s non-expiring token option.

Vercel had already addressed deployment authentication in its October 22 announcement, saying it was extending OIDC support across its API and CLI. Replying to Prieto on October 23, Ubl said the company was “mid rollout” and would also allow finer control over which actions a credential can perform. His reply did not give a completion date.

An earlier step came on September 25, when Vercel added GitHub OIDC authentication for its Container Registry. That lets customers push container images without storing long-lived registry credentials. The GitHub Actions workflow documented for deploying applications to Vercel still uses VERCEL_TOKEN.

Short-lived tokens for agents

As AI agents gain access to more external services, credential management is becoming a greater consideration for agent harnesses. One way to reduce the risks of persistent access keys is to use short-lived, just-in-time credentials that expire rather than leaving agents with ongoing access.

Vercel’s Connect service addresses part of that problem by letting applications and agents use their deployment identity to request provider credentials at runtime rather than storing them in application environments. For supported OAuth services, Connect handles token exchange and renewal.

Earlier, on October 15, Vercel added enterprise-managed authorization to Connect in public beta, allowing administrators to control access to supported services through identity providers such as Okta.

Connect still allows static keys

Connect also supports services that authenticate with static API keys. Its documentation describes storing a key centrally and retrieving it when an application needs it. That changes where the key is stored and how applications access it; it does not, by itself, make the underlying key short-lived.

OIDC across Vercel’s own tooling

For developers, the practical question is which parts of their workflow can already run without a long-lived secret. Vercel offers that option for pushing container images and accessing supported services. Customers following its documented GitHub Actions deployment guide still need a VERCEL_TOKEN, with the company saying a replacement is underway.

Correction, October 25, 2026: An earlier version of this article described a documented GitHub Actions workflow for Vercel customers as Vercel’s own workflow and characterized its token requirement as a “double standard.” Vercel’s October 22 announcement said it was extending OIDC support to deployments and holding its own API and native integrations to the same authentication standard as Marketplace vendors. CTO Malte Ubl said on October 23 that OIDC authentication for deployments was in rollout. We have revised the headline and article to clarify this context and added his response.
