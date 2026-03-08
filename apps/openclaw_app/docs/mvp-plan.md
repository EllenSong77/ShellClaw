# MVP Plan

## 目标
先把 10-20 人可用的控制平面做出来，不追求一次到位。

## 已落地
- FastAPI 项目骨架
- 用户 / 沙箱 / 任务 / 每日用量数据表
- 免费用户日配额占位逻辑
- Docker Compose 开发环境
- LiteLLM 配置占位

## 下一步
1. 接 Alembic，替换 `bootstrap-db`
2. 实现真正的认证（JWT）
3. 接 Docker SDK：创建 / 启动 / pause / stop 用户沙箱
4. 实现任务队列（Redis 高低优先级）
5. 实现 WebSocket 流式输出
6. 再做前端（建议 React Native 或 Flutter 二选一）

## 当前判断
结合 codex / GLM / Claude / Gemini 四套方案，现阶段最稳的路线是：
- 后端：FastAPI
- 模型网关：LiteLLM
- 沙箱：Docker 单机
- 数据：PostgreSQL + Redis
- 观测：Prometheus / Grafana（第二阶段接）
