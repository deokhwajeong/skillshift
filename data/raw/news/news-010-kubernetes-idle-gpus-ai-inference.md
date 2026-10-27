---
id: news-010
title: "AI jobs are waiting while GPUs sit idle. Kubernetes has a new plan."
source: The New Stack
url: https://thenewstack.io/kubernetes-agentic-ai-inference/
published_date: 2026-10-23
source_type: trade
---

Welcome to another edition of Road to KubeCon! We’re tracking movements in the Kubernetes and cloud-native ecosystem as we count down to KubeCon + CloudNativeCon North America 2026 November 9-12 in Salt Lake City.

Half of our column this week focuses on untangling Kubernetes as we add the demands of agentic AI: automating pod-restart troubleshooting, syncing communication between the scheduler and autoscaler, and maturing how we distribute inference across a cloud-native stack.

The other half goes deeper into what we need to look at closely in Kubernetes environments: What context’s missing, what slips through the gaps in metrics, and whether the AI agents you already use are really worth their salt as SREs.

Let’s get into it.

HPE on automating pod restarts in AI development

As more enterprises turn to Kubernetes for large-scale AI and machine learning jobs, they’re hitting a common obstacle: pod restarts. This is something that HPE has noticed as customers utilize its HPE Private Cloud AI (PCAI) to host long-running AI/ML workloads on inherently ephemeral container-based infrastructure like Kubernetes.

According to HPE system software engineer Guoping Jia, Kubernetes provides some troubleshooting commands out of the box, but it still requires extensive manual investigation. “This operational workflow does not scale effectively in PCAI’s large-cluster environment,” writes Jia on the HPE blog.

His solution involves smarter automation for troubleshooting, using an open-source Kubernetes troubleshooting tool, k8s-pod-restart-info-collector, to automatically gather details and send diagnostic information straight to a Slack channel. It’s one helpful strategy to improve usability for Kubernetes operators.

Will the scheduler and autoscaler unite?

There’s been a lot of talk recently about how Kubernetes is evolving to meet AI’s new demands. This week, AWS senior software development managers Sajjan Gundapuneedi and Neelendra Bhandari weighed in with this blog post on how AI is reshaping Kubernetes autoscaling.

The core problem they highlight is friction between the scheduler, which places pods on existing nodes, and the autoscaler, which adds new ones, when managing GPU accelerators on Kubernetes. Often the two sides aren’t on the same page, leaving pods pending and pricey GPUs sitting idle. Capacity reservations, device topology, and GPU sharing complicate things further.

“A scarce accelerator is only as useful as the agreement between the loop that schedules it and the loop that provisions it,” the authors write. “Inference is what makes this pressing rather than academic, since bursty serving and agentic workloads have no patience for a cold node.”

To them, solutions are already taking shape: dynamic resource allocation (DRA)-aware autoscalers, workload-aware scheduling, and a companion mechanism, provisioning requests, to bridge the two sides. Still, they expect the autoscaler to grow into “a more scheduler-aware partner.”

Deeper integration is underway, too. A public proposal in the SIG-Autoscaling group sketches APIs that would let the two loops talk directly, so the scheduler could see capacity that could be provisioned, express placement preferences across it, and request it explicitly.

Distributed AI inference grows up with llm-d v1.0 release

On Tuesday, at PyTorch Conference North America, the CNCF sandbox project llm-d reached v1.0. The project now bridges AI application developers in the PyTorch ecosystem and the production cloud-native stack.

Carlos Costa, co-founder and lead maintainer of llm-d, and a distinguished engineer on IBM’s hybrid cloud platform for AI, says the v1.0 release signals maturity.

“This is the moment open source AI serving crosses from experimental projects into dependable infrastructure you can build on,” Costa tells The New Stack. Whereas earlier versions focused on proving state-of-the-art performance, v1.0 is about sustaining that performance in production, he adds.

llm-d has already seen plenty of use at Tesla, AWS, Oracle, Google, and beyond. Costa adds that a recent IBM Research demonstration found that an agent factory exploring quantum error correction hardware ran at 11.5x lower inference cost on open models with llm-d than on an all-proprietary configuration.

“This demonstration shows where llm-d really shines: agentic workloads,” he says, adding that it absorbs bursty agentic traffic and, in IBM’s test, pushed cache reuse to about 98%.
