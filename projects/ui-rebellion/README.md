# UI组件大叛乱（UI Rebellion）

一个基于 **Compose Multiplatform** 的动作小游戏原型：
- **Android**：Jetpack Compose
- **手机 Web**：Compose for Web/WASM
- **微信小程序**：不作为首发目标（原因见下）

## 技术选型

### 为什么选 Compose Multiplatform
题目要求非常硬：
- 纯 Compose 实现
- 所有实体必须是标准 Compose UI 组件
- MVVM
- 游戏循环在 ViewModel
- 要兼顾 Android / 手机 Web 的可能性

在这些限制下，**Compose Multiplatform** 是最合理的首发方案：
1. **Android 原生支持最好**，最符合“标准 UI 组件当游戏实体”的要求。
2. **Web 可以复用大量 Compose 代码**，满足手机浏览器试玩。
3. 游戏逻辑可以放在 `commonMain`，UI 只做渲染。

### 为什么不首发微信小程序
微信小程序的原生渲染体系不是 Compose，无法在“纯 Compose UI 组件”前提下直接共用同一渲染层。若未来一定要上小程序，建议：
- 保留当前 `commonMain` 中的游戏状态/碰撞/主循环逻辑
- 另做小程序前端壳层去消费同一套状态机设计

也就是说：
- **首发推荐：Android + Web**
- **后续可再做小程序适配层**

## 架构

- `GameViewModel`：主循环、碰撞检测、分数状态、发射逻辑
- `GameUiState`：UI 只读状态
- `GameScreen`：纯渲染层
- `GameComponents`：Button / Switch / Slider / FAB / Checkbox 等标准组件实体

## 性能策略

为满足 60FPS 下频繁坐标更新：
- 用 `Modifier.offset { ... }` / `graphicsLayer { ... }` 做位移
- 将实体状态拆成稳定数据结构，减少无关重组
- 通过 `derivedStateOf` 与细粒度状态读取，避免整屏不必要重组
- UI 不做逻辑计算，逻辑全部留在 ViewModel

## 当前交付内容

本目录提供：
- 可直接继续扩展的 Compose Multiplatform 项目骨架
- 核心游戏状态模型
- ViewModel 主循环与碰撞检测
- Android/Web 共用的 Compose 游戏屏幕

## 目录

- `composeApp/` 主应用模块
- `docs/ARCHITECTURE.md` 设计说明

## 下一步建议

1. 在本机补齐 Gradle Wrapper 并跑起 Android/Web target
2. 针对 Web 调整触控体验
3. 增加关卡、生命值、音效、难度曲线
4. 若必须上微信小程序，再抽离跨端状态协议
