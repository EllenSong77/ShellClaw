# OpenClaw App Backend API Contract

当前后端以 H5 MVP 联调为目标，重点支持：

- 注册 / 登录
- 当前用户信息与额度
- 创建任务
- 任务状态查询
- WebSocket 任务事件
- workspace 文件列表 / 上传 / 下载

## Base URL

- HTTP: `http://localhost:8000`
- WS: `ws://localhost:8000/ws?token=<JWT>`

## Auth

所有受保护 HTTP 接口使用：

```http
Authorization: Bearer <JWT>
```

## HTTP APIs

### `POST /auth/register`

请求体：

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

响应：

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "plan": "trial",
  "trial_ends_at": "2026-03-17T10:00:00Z",
  "paid_until": null
}
```

### `POST /auth/login`

请求体：

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

响应：

```json
{
  "access_token": "jwt",
  "token_type": "bearer"
}
```

### `GET /me`

响应：当前用户信息。

### `GET /me/usage`

响应示例：

```json
{
  "plan": "trial",
  "trial_ends_at": "2026-03-17T10:00:00Z",
  "paid_until": null,
  "daily_used": 1,
  "daily_limit": null,
  "daily_remaining": null
}
```

### `GET /me/sandbox`

响应：当前用户 sandbox 状态。

### `POST /me/tasks`

请求体：

```json
{
  "message": "帮我列出当前目录文件",
  "command": null,
  "timeout_sec": 120
}
```

响应示例：

```json
{
  "ok": true,
  "task_id": "uuid",
  "queue": "tasks:high",
  "sandbox_status": "running",
  "container_id": "docker-container-id"
}
```

### `GET /me/tasks`

查询最近任务列表。

参数：

- `limit`: 1-100，默认 20

### `GET /tasks/{task_id}`

查询单个任务详情。

响应字段包含：

- `status`
- `stdout_text`
- `stderr_text`
- `error_text`
- `started_at`
- `ended_at`
- `duration_sec`

### `GET /me/workspace`

参数：

- `path`: 可选，相对路径

响应示例：

```json
{
  "base_path": "",
  "entries": [
    {
      "path": "outbox",
      "name": "outbox",
      "is_dir": true,
      "size": 0
    }
  ]
}
```

### `POST /me/workspace/upload`

表单字段：

- `file`

查询参数：

- `dir_path`: 可选，相对目录

### `GET /me/workspace/download?path=<relative_path>`

下载指定文件。

## WebSocket

连接：

```text
ws://localhost:8000/ws?token=<JWT>
```

连接成功后服务端先发：

```json
{
  "type": "connected"
}
```

客户端可以发心跳：

```json
"ping"
```

服务端返回：

```json
{
  "type": "pong"
}
```

客户端也可以直接通过 WS 创建任务：

```json
{
  "action": "create_task",
  "message": "帮我查看 workspace 目录",
  "timeout_sec": 120
}
```

服务端事件类型：

### `task_enqueued`

表示任务已入队。

响应示例：

```json
{
  "type": "task_enqueued",
  "task_id": "uuid",
  "status": "running",
  "queue": "tasks:high"
}
```

### `task_started`

表示 worker 已实际开始执行任务。

### `task_delta`

当前后端会在运行过程中发送增量 stdout/stderr。

响应示例：

```json
{
  "type": "task_delta",
  "task_id": "uuid",
  "stream": "stdout",
  "content": "H"
}
```

说明：

- `stream` 可能为 `stdout` 或 `stderr`
- `content` 是当前增量文本
- 兼容层里也会保留原始 `chunk` 字段

### `task_completed`

响应示例：

```json
{
  "type": "task_completed",
  "task_id": "uuid",
  "status": "completed",
  "stdout_text": "...",
  "stderr_text": "",
  "error_text": "",
  "duration_sec": 12
}
```

### `task_error`

响应示例：

```json
{
  "type": "task_error",
  "task_id": "uuid",
  "status": "error",
  "stdout_text": "",
  "stderr_text": "...",
  "error_text": "...",
  "duration_sec": 3
}
```

## 当前建议

前端 MVP 优先使用：

1. `POST /auth/register`
2. `POST /auth/login`
3. `GET /me`
4. `GET /me/usage`
5. `POST /me/tasks` 或 WebSocket `create_task`
6. `GET /tasks/{task_id}`
7. WebSocket 订阅任务完成事件

不要把 `task_delta` 当成强依赖。当前更稳定的联调方式是：

- 发任务
- 显示 `running`
- 收到 `task_completed` / `task_error`
- 必要时再拉一次 `/tasks/{task_id}`
