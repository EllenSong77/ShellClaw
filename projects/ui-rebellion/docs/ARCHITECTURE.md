# UI Rebellion 架构说明

## 1. 目标

这个项目不是传统 Canvas 游戏，而是“让标准 Compose 组件直接成为游戏实体”。

对应关系：
- Button = 敌人目标
- Switch = 陷阱
- Slider = 玩家横向控制器
- FloatingActionButton = 炮台
- Checkbox = 子弹

## 2. MVVM 分层

### ViewModel 层
`GameViewModel`
- 持有 `GameUiState`
- 启动 game loop
- 执行位移更新
- 执行碰撞检测
- 更新分数
- 响应 slider 输入与开火事件

### UI 层
`GameScreen`
- 订阅 `uiState`
- 将实体映射为 Compose 标准组件
- 通过 `Modifier.offset { IntOffset(...) }` 渲染位置
- 不包含碰撞逻辑和游戏状态推进逻辑

## 3. 主循环

为贴近题目要求，ViewModel 使用：
- 协程
- `BroadcastFrameClock`
- `withFrameNanos`

逻辑流程：
1. frame clock 推送帧
2. ViewModel 在帧时钟上下文中等待 `withFrameNanos`
3. 计算 `dt`
4. 更新 enemy / bullet 坐标
5. 执行 AABB 碰撞检测
6. 刷新 `uiState`

## 4. 性能策略

### 避免整屏无意义重组
虽然 `uiState` 整体会更新，但渲染层做了几件事来降低成本：
- 每类实体拆分为独立 composable
- 使用 `remember + derivedStateOf` 只生成位置偏移值
- 用 `Modifier.offset { IntOffset(...) }` 而不是在 composable 树里做额外布局运算
- 游戏逻辑不进 UI 层，避免 UI 参与每帧计算

### 后续极限优化方向
如果后面实体数明显增加，可进一步：
- 将 bullets / enemies / traps 拆为更细颗粒状态容器
- 引入 `graphicsLayer(translationX, translationY)` 做更轻量位移
- 对命中销毁改为对象池而非 list 复制
- 将 HUD 和战场区域拆成更明确的稳定边界

## 5. 首发平台策略

### Android
最符合题意，优先级最高。

### 手机 Web
可作为试玩版或分享版，适合快速验证玩法。

### 微信小程序
不建议作为第一阶段目标，因为：
- Compose 不能直接渲染到小程序原生组件树
- 题目要求又禁止退回到别的 UI 体系

如果必须支持小程序，应当把当前游戏规则层抽象成“跨端状态机协议”，然后单独实现小程序壳层。
