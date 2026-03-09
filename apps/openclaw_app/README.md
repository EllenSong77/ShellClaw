# OpenClaw App MVP

首版目标：先做 10-20 人可用的控制平面 MVP。

当前范围：
- FastAPI 后端骨架
- PostgreSQL 数据模型
- Redis 队列与配额占位
- Docker Compose 本地开发环境
- 沙箱调度接口占位

架构选择（结合 codex / GLM / Claude / Gemini 方案后的统一版）：
- 控制平面：FastAPI
- 数据层：PostgreSQL + Redis
- 模型网关：LiteLLM
- 执行平面：Docker 沙箱（后续接 OpenClaw 容器）
- 观测：Prometheus / Grafana（后续接入）

建议开发顺序：
1. 跑起 compose
2. 创建数据库表
3. 实现注册 / 工作区 / 沙箱记录
4. 接入 Docker SDK 做真实沙箱调度
5. 再接 WebSocket 流式任务

当前执行入口约定（临时版）：
- sandbox runner 优先执行任务里显式传入的 `command`
- 如果任务里未传 `command`，则走 `SANDBOX_COMMAND_TEMPLATE`
- 这样可以先用简单命令打通闭环，再逐步切到真实 OpenClaw / Codex CLI 入口，而不用频繁改 runner 协议
- 已在宿主机验证 `codex exec` 可非交互运行，可作为下一阶段的“真实 CLI 测试入口”候选
- 当前新的工程判断：若要在 sandbox 内直接运行 codex，需要处理 CLI 二进制与 `~/.codex` 认证状态的可用性；否则可先走宿主机代理执行方案
