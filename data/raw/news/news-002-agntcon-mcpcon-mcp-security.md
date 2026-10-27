---
id: news-002
title: "AGNTCon + MCPCon 2026: Agentic AI Foundation Adds Four Projects as MCP Turns to Security"
source: InfoQ
url: https://www.infoq.com/news/2026/10/agntcon-mcpcon-2026/
published_date: 2026-10-26
source_type: trade
---

At AGNTCon + MCPCon North America 2026 in San Jose, the Agentic AI Foundation (AAIF) added four projects, taking it from three founding projects to ten in its first year. The October 22-23 event followed PyTorch Conference at the same venue, and much of its program moved from new protocol features to security and identity.

Mazin Gilbert, executive director of the AAIF, opened with the project news and three new governance committees. Alibaba contributed OpenSandbox, a secure sandbox for running agents, and OpenAI contributed Open Responses, an open specification for interoperable LLM interfaces. Anthropic added Agent Skills, and Hugging Face added OpenEnv, a framework for reinforcement learning environments that train and evaluate agents. Manik Surtani, the foundation's CTO, put the milestone this way in the announcement:

A year ago, AAIF launched with three projects and a bet that agentic AI needed a neutral home to thrive. Today we host 10.

In "Who Keeps It Open?", Surtani argued that a license alone does not keep infrastructure open. Surtani contrasted Android, which stayed under one company, with Kubernetes, which Google moved into a neutral foundation. The open problems now sit in identity, attestation, audit, and payments.

Outside coverage was cooler. The New Stack noted that Open Responses already has support from AWS Bedrock, Databricks, Ollama, Nvidia, and vLLM, but that Anthropic still defines its own Messages API and Google its Interactions API. The Register headlined its story "Vendor-affiliated AI agent tech gets adopted by friendly, funded foundation" and closed with a caution:

This enthusiastic (or credulous) embrace of AI agents may be a bit too rapid for some industries.

J.R. Storment, executive director of the 11-week-old Tokenomics Foundation, told the audience to stop counting tokens. Cost per task beats cost per token, and cost per outcome is better still, but the real measure is business value.

David Soria Parra, co-creator of MCP at Anthropic, argued that capable models now need connectivity more than help staying on task. The July 28 specification added stateless servers, which some developers worried would turn MCP into just another API, and some platforms already see about 70% of their traffic in that mode. Soria Parra announced MCP tasks support in Claude Code, letting tool calls run for minutes, hours, or days instead of seconds. Anthropic also donated the Agent Skills standard to the foundation. The project's roadmap names five priority areas, from agent messaging and skills over MCP to identity and an HTTP-native transport.

OpenAI's Thomas Sarlandie shared what the ChatGPT plugin directory reveals about MCP servers in production. There is no practical limit on tool count, but oversized schemas get trimmed, starting with argument descriptions. About three in four tool schemas on published servers are under 1 kB, while the largest reach about 260 kB for a single tool and 1.4 MB for a server. OpenAI rejects submitted servers unless every tool carries annotations, which let ChatGPT fast-track read-only calls and confirm destructive ones. Only 56% of plugins use server instructions, which Sarlandie said can safely run to about 1,000 characters.

Chrome's Sarah Drasner presented WebMCP, a proposed web standard now in origin trial that lets websites expose tools to agents. Agents call declared tools instead of scraping the DOM, and Drasner cited benchmarks showing actions 2.5 to 7.5 times faster. Read-only and untrusted-content hints also help agents resist prompt injection hidden in user comments. WebMCP complements MCP rather than replacing it, Drasner stressed.

Dawn Song, a UC Berkeley professor, argued that frontier AI will help attackers more than defenders in the near term. Song's CyberGym benchmark spans more than 1,500 vulnerabilities in nearly 200 open source projects, and models now find zero-days. On ExploitGym, GPT-5.6 Sol produced about 230 working exploits against 869 targets in two hours, and still more than 80 with standard security mitigations enabled. Because attackers need only one hole, Song called for secure-by-construction systems with AI-generated proofs and pointed to a new observatory that tracks these capabilities.

Anthropic's Den Delimarsky, the protocol's lead maintainer, said cumulative SDK downloads have reached 4.17 billion. The count stood at about 3 billion a month earlier, which Delimarsky said raises the stakes of every security gap. About a third of the 116 conformance scenarios now test security, and enterprise-managed authorization is live in Claude. Delimarsky's auth roadmap marks that feature stable, puts proof-of-possession tokens and workload identity federation in draft, and ends with agents that sign in as themselves.

Block's Bradley Axen, creator of goose, demonstrated Buzz, an open source workspace where people and agents share channels. Each agent gets its own identity plus an attestation naming its owner, and can read channels but not direct messages. Buzz has 80,000 communities and 36,000 GitHub stars, with version 1.0 due in mid-November.

Thomas Dohmke, former GitHub CEO and now CEO of Entire, said agents have turned code review into the bottleneck. Citing industry data, Dohmke noted that teams using coding agents produce about 57 pull requests a week, against roughly 10 for others. Dohmke wants agent session logs stored in Git and linked to commits, so reviewers can check a change against its intent.
