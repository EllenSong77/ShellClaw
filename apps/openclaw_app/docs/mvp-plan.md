# MVP Plan

## 目标
先把 10-20 人可用的控制平面做出来，不追求一次到位。

## 已落地
- FastAPI 项目骨架
- 用户 / 沙箱 / 任务 / 每日用量数据表
- 免费用户日配额逻辑
- Docker Compose 开发环境
- LiteLLM 配置占位
- Docker 沙箱调度器（创建 / 启动 / pause / stop）
- 任务入队接口（高低优先级队列占位）

## 下一步
1. 接 Alembic，替换 `bootstrap-db`
2. 实现真正的认证（JWT）
3. 实现 worker，真正消费 Redis 队列并驱动沙箱执行
4. 实现 WebSocket 流式输出
5. 补沙箱镜像与 OpenClaw 进程入口
6. 再做前端（建议 React Native 或 Flutter 二选一）

## 当前判断
结合 codex / GLM / Claude / Gemini 四套方案，现阶段最稳的路线是：
- 后端：FastAPI
- 模型网关：LiteLLM
- 沙箱：Docker 单机
- 数据：PostgreSQL + Redis
- 观测：Prometheus / Grafana（第二阶段接）
