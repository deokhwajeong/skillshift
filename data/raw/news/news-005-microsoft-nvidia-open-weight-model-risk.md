---
id: news-005
title: "Managing open-weight model risk in enterprise deployments"
source: Microsoft Azure Blog
url: https://azure.microsoft.com/en-us/blog/managing-open-weight-model-risk-in-enterprise-deployments/
published_date: 2026-10-16
source_type: primary
---

The growing AI landscape is giving enterprises more choice in how they build, customize, and deploy increasingly capable models. Open-weight models are an important part of that landscape. They give enterprises access to model weights and greater flexibility to inspect, evaluate, modify, and run models within their own environments.

While that flexibility can be valuable, it also affects how enterprises evaluate models, where they implement safeguards, and who is responsible for maintaining those safeguards over time.

As enterprises choose which models to deploy, the relevant question is broader than whether a model is open-weight or closed-weight. Enterprises need to understand what they are using the model for, what could go wrong in that context, and what evidence and controls they need to manage risks.

Today, Microsoft and NVIDIA are publishing Risk Management for Open-Weight Models in Enterprise, the first in a planned series of joint resources intended to help enterprises address those questions. The paper introduces a shared risk taxonomy and an approach to managing model risks grounded in established standards and frameworks, including International Organization for Standardization (ISO) standards and the National Institute of Standards and Technology (NIST) AI Risk Management Framework.

The paper reflects a core idea: weight openness alone does not determine an AI system’s risk. Risk depends on the model, use case, deployment, and safeguards.

Understanding risk in the deployment context

Open- and closed-weight models can share many of the same underlying risks, but how those risks materialize depends on the deployment. A model used to help an employee draft a document presents different considerations than the same model used in a customer-facing workflow, just as a standalone inference endpoint differs from a system connected to external data or tools.

The architecture matters too. A risk may originate in the model, while the most effective control may sit in the inference environment, application, or surrounding operational processes. The joint guidance looks beyond the model label to factors including provenance, intended use, users, deployment conditions, and surrounding controls. This first paper focuses primarily on model-layer risks. Evaluating a model alone does not establish the safety of an agent or application: teams must also assess its permissions, data access, tools, runtime, and operational controls.

Establishing a common language

Managing these risks consistently also requires a common vocabulary across engineering, security, legal, safety, and business teams.

The initial Microsoft and NVIDIA taxonomy organizes risks into five broad categories: Cybersecurity, Data Protection, Content, Human-AI Interaction, and Bias. It is not a policy or deployment checklist, but instead it should be used by enterprises to adapt it to their own systems, use cases, and risk criteria, then connect relevant risks to evaluations, mitigations, and accountable owners.

Using evaluations as risk evidence

Evaluations help turn the taxonomy into something enterprises can use. The paper maps evaluations to a selection of risks across the five categories, giving teams a way to start with a risk that matters for their deployment and identify evaluations that can produce relevant evidence about it.

Microsoft Foundry helps enterprises assess quality, groundedness, and safety with built-in and custom evaluations and automated red teaming. Its configurable content-safety controls help detect and mitigate harmful inputs and outputs and prompt attacks. Teams should validate control availability for their model and deployment, including preview status, and combine these capabilities with application-specific testing, monitoring, and human oversight.

Evaluations still need to be interpreted in the context of a particular deployment and the goal is to make it easier for teams to connect the risks they identify with useful evidence, while building a broader set of evaluation resources that can evolve alongside models, deployment patterns, and emerging risks. Microsoft and NVIDIA plan to use the joint repository to share additional evaluations and point to existing resources that can help enterprises assess specific risks.

Accounting for changes in control and responsibility

Open-weight access gives enterprises greater control over how a model is evaluated, modified, and deployed. Model access and deployment are separate choices: open-weight models can also be used through managed platforms. Responsibility for safeguards depends on the service and deployment configuration; enterprises that operate their own model deployments may take on controls otherwise provided by a managed service.

Those safeguards can operate at different layers, and (depending on the risk) enterprises might use model changes, access controls, input and output filtering, monitoring, or human review. The important step is connecting each identified risk to controls that can effectively address it within the deployed system. Those decisions need to be revisited as models and deployments change.

Building on this work

Risk Management for Open-Weight Models in Enterprise focuses primarily on the model layer. Future work from Microsoft and NVIDIA is intended to extend this approach across the runtime, harness, and application layers, with additional technical guidance on evaluation and mitigation.

We also expect the resources supporting this work to evolve as new models, evaluations, and deployment patterns emerge. The joint repository will provide a place to share additional evaluation resources, including contributions from the broader community.

For enterprises deploying open-weight models today, the paper provides guidance they can begin applying to their own use cases. We encourage developers, security practitioners, researchers, and others working in this space to read the paper, explore the evaluations, and contribute evaluations that can help strengthen this shared body of work.
