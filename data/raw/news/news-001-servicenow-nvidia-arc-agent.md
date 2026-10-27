---
id: news-001
title: "ServiceNow and Nvidia launch Arc, a new AI agent for enterprise"
source: ZDNET
url: https://www.zdnet.com/innovation/exclusive-servicenow-and-nvidia-launch-arc-a-new-ai-agent-for-enterprise/
published_date: 2026-10-21
source_type: trade
---

ZDNET’s key takeaways

- Arc, originally announced in May, is now generally available.

- The agent is built for Nvidia’s new RTX Spark devices.

- Multi-level security infrastructure around Arc aims to give businesses peace of mind.

One of the main roadblocks to adopting more autonomous AI systems for companies is adequate security controls, especially after a summer of agent-led breaches. Software company ServiceNow has partnered with Nvidia to address that need by combining AI capabilities with security-first guardrails.

Arc, which ServiceNow and Nvidia call “a personal long-running AI agent that can take on everyday work,” is generally available as of Wednesday. The companies originally released the idea for the agent back in May. Arc is available now on Mac, but Windows support is still on the way.

What Arc can do

Like many agents built for enterprise use, Arc is designed for daily tasks that rely on productivity tools such as email and Microsoft Teams. Designed to run efficiently on Nvidia’s new RTX Spark devices, it can run locally on an employee’s desktop or within Nvidia OpenShell on its own device. Similar to other agents that work off of accumulated context, ServiceNow and Nvidia said Arc builds memory and skills over time so that its performance continually improves.

The companies also said Arc is efficient, handing more complex tasks off to frontier models only when necessary and keeping data as local as possible otherwise. ServiceNow and Nvidia also said that Arc “proactively surfaces work and action items” by scanning an employee’s inbox and meeting notes.

But more than any new or highly competitive capabilities overall, what sets Arc apart, according to the companies, is the multi-level security framework surrounding it. ServiceNow and Nvidia said their approach offers more reliable security by “moving enforcement beyond the software layer into the runtime and hardware layers.”

Essentially, while the Arc agent is working on tasks, ServiceNow’s Super Intelligence Control Tower enforces company policies, while Nvidia OpenShell restricts the agent’s behavior where necessary.

“IT defines policies in the Super Intelligence Control Tower and NVIDIA OpenShell can be directed to enforce them at runtime,” the announcement explained. “Users obtain granular control over which systems AI agents can access, APIs they can call, and data they can read.”

AI Passport

AI Passport is another layer of agent security that the two companies announced last week. It holds an enterprise’s set of rules, which the Control Tower sets, about risk tolerance and the services Arc and other agents are allowed to access. That lets Nvidia’s features like OpenShell intervene efficiently if an AI agent takes action it’s not supposed to, the companies explained.

With the other pieces of ServiceNow and Nvidia’s security puzzle, AI Passport functions like a bridge between ServiceNow infrastructure and Nvidia’s checkpoints. The entire system is designed to continuously monitor an agent’s actions and permissions to prevent breaches, unsanctioned actions, and other fallout from using agents.

If the Control Tower tells OpenShell an agent’s passport has been revoked, OpenShell will keep the task the agent was trying to execute contained within a sandbox, where reviewers can audit it later. That interruption is also task-specific, meaning other, approved agent actions can continue without restarting.

“When a passport is revoked in the Super Intelligence Control Tower, Nvidia BlueField can enforce that revocation at machine speed before the AI agent can proceed,” the companies said. “This creates enforcement in silicon designed to prevent overrides from compromised software.”
