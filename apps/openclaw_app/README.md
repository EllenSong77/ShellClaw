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
