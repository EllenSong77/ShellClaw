# ShellClaw MVP

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
- 执行平面：Docker 沙箱（后续接 OpenClaw CLI / agent）
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
- 这样可以先用简单命令打通闭环，再逐步切到真实 OpenClaw CLI 入口，而不用频繁改 runner 协议
- 当前 worker 会把 stdout / stderr / error_text 回写到 task 记录，并通过 Redis Pub/Sub 向 WebSocket 推送任务事件

当前后端新增能力：
- `POST /auth/register`：注册
- `POST /auth/login`：登录并获取 JWT
- `GET /me`：当前用户信息
- `GET /me/usage`：套餐与当日额度
- `POST /me/tasks`：创建任务
- `GET /me/tasks`：最近任务列表
- `GET /tasks/{task_id}`：查询任务结果
- `GET /me/workspace` / `POST /me/workspace/upload` / `GET /me/workspace/download`：工作区文件接口
- `GET /ws?token=...`：订阅任务事件；支持发送 `{"action":"create_task","message":"..."}` 直接入队

数据库初始化：
1. 启动 compose
2. 进入 `backend/`
3. 执行 `alembic -c alembic.ini upgrade head`

说明：
- 不再推荐使用旧的 `bootstrap-db`
- 当前 WebSocket 主要用于任务状态和结果推送；前端不必依赖逐字流式输出
- 联调契约见 `docs/backend-api.md`
