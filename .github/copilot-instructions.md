# Repository Workflow Instructions

This workspace uses a human-approved, sequential SDLC controlled only by `.github/agents/orchestrator.agent.md`. Start and resume work through the `sdlc-orchestrator` agent or the `/start-sdlc` prompt. Specialists are stage-scoped subagents; they must not self-approve, update shared status, or advance stages.

Treat `.github/sdlc-status.md` as the persisted workflow record. Verify status claims against the actual artifacts, Git state, and executed command output. Distinguish proposed, approved, implemented, and verified work. Never mark an artifact approved without explicit user approval or a check passed without executing it successfully.

Do not infer project requirements from this scaffold. Read `.github/input/userstory.md` and actual source documents before requirements work. Ask focused questions when essential product details are absent. Do not create product code until requirements, architecture, resolved design review, and implementation plan have each passed their approval gate.

Preserve unrelated files and local changes. Do not initialize Git, commit, push, create a remote pull request, or merge without the user's explicit approval for that exact action. Report unavailable tools, services, tests, and external permissions honestly.

Use VS Code custom agents in `.github/agents/*.agent.md`, prompt files in `.github/prompts/*.prompt.md`, and this supported repository-level Copilot instruction file. Prompt files are Local-harness-specific. Subagent execution depends on the selected harness and enabled tools; if unavailable, disclose and use a sequential fallback without pretending delegation occurred. No MCP server is configured. Skills are not added because the stage procedures are already owned by role-specific agents. Hooks are not configured: VS Code hook behavior is harness-specific/preview in some runtimes and is not a substitute for explicit human approval.
