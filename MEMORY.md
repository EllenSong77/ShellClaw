# MEMORY.md

## User

- User's name is Ellen.
- Default language for communication with Ellen is Chinese.
- Timezone: Asia/Shanghai.

## Working Style

- For OpenClaw App collaboration:
  - Prefer Claude Code for frontend work and add-to-cart related implementation.
  - Prefer Codex CLI for code review.
- Ellen is comfortable with me progressing quietly and reporting back at key milestones.
- If a new task appears, it is okay to interrupt current OpenClaw App work and switch priorities when needed.

## Projects / Interests

- Active project: OpenClaw App.
- Side projects or topics to keep in mind:
  - OpenClaw + robot
  - Gemini + nail art
  - Gemini + 3D printing (requires Ultra membership)
  - Mom's planner/journal
  - Taking time off to experience life

## OpenClaw App - Stable Technical Direction

After comparing the early consultation materials from Codex / Claude / GLM / Gemini, the stable shared direction is:

- Start with an MVP for 10-20 users, and avoid overengineering.
- Backend/control plane: FastAPI.
- Data layer: PostgreSQL + Redis.
- Model gateway: LiteLLM (or equivalent unified gateway) so API keys stay server-side and model routing/cost control stay centralized.
- Execution plane: per-user Docker sandbox with lifecycle management (create/start/pause/stop) instead of permanent always-on sandboxes.
- Streaming interaction is important; WebSocket is part of the intended core path.
- Observability should include at least usage/cost, queue depth, sandbox resource usage, and task success/failure; Prometheus/Grafana remain the expected second-stage path.
- Initial rollout should prioritize a controllable MVP and real usage data before locking in pricing or a more complex paid-plan system.

## OpenClaw App - Current Implementation Snapshot

As of 2026-03-08/09, the MVP implementation already has:

- FastAPI backend skeleton.
- Core database models.
- Docker sandbox lifecycle management scaffold.
- Redis-based task queue placeholder.
- Worker stub and sandbox runner stub.

The next critical steps are:

- replace the placeholder sandbox runner with the real OpenClaw execution entry,
- implement WebSocket streaming output,
- add proper authentication / production-ready schema migration / stronger worker state handling.
