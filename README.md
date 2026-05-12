# LLM Gateway

Anthropic 格式纯透传路由网关。接收 CC Switch 的请求，根据模型名精确匹配，转发到对应后端（DeepSeek / LM Studio）。

## 架构

```
Claude Code → CC Switch → Gateway (:3456) → DeepSeek / LM Studio
                              ├─ 管理面板 (http://localhost:3456)
                              ├─ API 端点 (/v1/messages)
                              └─ 系统托盘 (start-tray.vbs)
```

## 链路

| 层 | 组件 | 职责 |
|----|------|------|
| 1 | Claude Code | 发送请求，模型名由 settings.json 控制 |
| 2 | CC Switch | 拦截请求，替换模型名，发到网关 |
| 3 | Gateway | 精确匹配模型名 → 转发到对应 Provider |
| 4 | DeepSeek / LM Studio | 实际处理请求 |

## 启动

**托盘模式（推荐）:** 双击 `start-tray.vbs`
- 网关在后台运行，右下角托盘出现 Node.js 图标
- 双击图标 → 打开管理面板
- 右键 → Exit → 关闭网关

**前台模式（调试用）:** 双击 `start.bat`

## 管理面板

访问 http://localhost:3456

### Gateway 设置
- **Port** — 监听端口（默认 3456）
- **API Key** — 访问网关的凭证，CC Switch 的 `ANTHROPIC_AUTH_TOKEN` 填这个

### Providers（供应商）
每条记录对应一个后端服务：
- **ID** — 唯一标识，路由规则用这个来引用
- **Name** — 显示名称
- **Base URL** — API 地址（不用带 `/v1/messages`，网关自动拼接）
- **API Key** — 该供应商的密钥（LM Studio 留空即可）
- **Enabled** — 是否启用

### Routes（路由规则）
每条规则是 **精确模型名 → 目标供应商** 的一对一映射：

| 模型名（CC Switch 发来的） | → | 目标供应商 |
|---|---|---|
| `DeepSeek-V4-Pro[1m]` | → | DeepSeek |
| `qwen/qwen3-4b` | → | LM Studio |

模型名必须**完全一致**才能匹配，没有模糊搜索，没有 fallback。

### 测试按钮
每条路由后面的 **test** 按钮会：
1. 自动保存当前配置
2. 用该路由的模型名发真实请求走完整链路
3. 显示真实结果（200 通过 / 错误信息）

**状态灯**只显示服务器是否在线（TCP 连通），路由是否能跑通看 test 结果。

## CC Switch 配置

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:3456/v1",
    "ANTHROPIC_AUTH_TOKEN": "<网关管理面板的 API Key>",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "DeepSeek-V4-Pro[1m]",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "DeepSeek-V4-Flash[1m]",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "DeepSeek-V4-Flash[1m]"
  }
}
```

模型名必须跟 Routes 里的精确匹配。

## 文件结构

```
llm-gateway/
├── index.js              # 网关程序
├── admin.html            # 管理面板页面
├── start-tray.vbs        # 托盘模式启动（双击）
├── start-tray.ps1        # PowerShell 托盘脚本
├── start.bat             # 前台模式启动（备用）
├── gateway-config.json   # 配置文件（管理面板保存）
├── package.json
└── README.md
```
