# ThRei_Players

`ThRei_Players` 是 threi 的 SourceMod 上报插件，用来替代 A2S / RCON 轮询。

插件从游戏服务器主动向 threi API 发送 HTTP POST，上报：

- 当前地图
- 最大人类玩家数
- 已通过 Steam 认证的在线玩家名单（SteamID64、昵称、已连接秒数）

API 不主动连接游戏服务器，因此不需要开放查询端口，也不需要 RCON 密码。

## 依赖

- SourceMod 1.11 或更高版本
- [SteamWorks 扩展](https://github.com/Julien-Marchand/SteamWorks)（插件通过 Steam 的 HTTP 客户端发送请求）

插件使用 SteamWorks 的 HTTP API。只安装 SourceMod 而没有 SteamWorks 时，插件会加载失败或无法上报。

## 安装

已编译的插件位于：

```text
addons/sourcemod/plugins/ThRei_Players.smx
```

将 `addons` 目录复制到游戏服务器对应的游戏目录（例如 CS:GO 的 `csgo/`、CS:S 的 `cstrike/`），然后重启服务器或执行：

```text
sm plugins load ThRei_Players
```

如果插件已经在运行：

```text
sm plugins reload ThRei_Players
```

## 获取服务器令牌

1. 登录 threi 管理后台，进入「服务器管理」。
2. 添加服务器，或找到已有服务器。
3. 点击「插件配置」。
4. 点击「生成令牌」。令牌只在该对话框中显示给管理员。
5. 复制生成的配置片段。

每个服务器使用独立令牌。重新生成会让旧令牌立即失效；撤销令牌会同时清空该服务器的在线名单并标记离线（维护中状态会保留）。

令牌不会出现在服务器列表接口、公开接口或 API 日志中。

## 配置

首次加载插件时会自动生成 `cfg/sourcemod/threi_players.cfg`。编辑该文件：

```cfg
// 是否启用上报
sm_threi_players_enabled "1"

// 完整的 API 上报地址，必须包含 /api/v1/plugin/report
sm_threi_api_url "https://example.com/api/v1/plugin/report"

// 管理后台里的服务器 ID
sm_threi_server_id "kz-beginner"

// 管理后台生成的服务器令牌，不要泄露
sm_threi_token "把这里替换成插件令牌"

// 上报间隔，单位秒，范围 5–600
sm_threi_interval "30"
```

也可以参考仓库里的示例：`cfg/sourcemod/threi_players.cfg.example`。

修改后执行：

```text
sm_threi_status
sm plugins reload ThRei_Players
```

`sm_threi_status` 只显示令牌是否已配置，不会输出令牌内容。

## 上报时机

- 每 `sm_threi_interval` 秒定时上报一次（默认 30 秒）
- 地图开始时
- 玩家通过 Steam 认证进入后
- 玩家断开后
- 管理员执行 `sm_threi_report`

API 在超过 90 秒没有收到上报时，会把服务器标记为离线、把人数清零并删除在线名单。服务器关闭、插件卸载或网络中断后，网站会自动显示离线。

只上报满足以下条件的玩家：

- 在游戏中
- 不是 bot、SourceTV 或 Replay
- `GetClientAuthId(client, AuthId_SteamID64, ...)` 验证成功
- SteamID64 为 17 位数字

未通过 Steam 认证的玩家不会出现在名单里。

## 管理命令

| 命令 | 说明 |
| --- | --- |
| `sm_threi_report` | 立即发送一次上报 |
| `sm_threi_status` | 显示配置状态（隐藏令牌） |

两个命令都需要 `ADMFLAG_ROOT`。

## API 协议

请求：

```http
POST /api/v1/plugin/report
Content-Type: application/json
X-ThRei-Plugin-Token: <每服务器令牌>
User-Agent: ThRei_Players/1.0.0

{
  "serverId": "kz-beginner",
  "map": "kz_beginner",
  "maxPlayers": 32,
  "players": [
    {
      "steamId64": "76561199125125759",
      "name": "玩家昵称",
      "connectedSeconds": 120
    }
  ]
}
```

成功响应：

```json
{
  "serverId": "kz-beginner",
  "playerCount": 1,
  "skipped": 0,
  "reportedAt": "2026-10-25T04:15:00Z"
}
```

令牌错误、服务器 ID 不存在或两者不匹配时统一返回 `401`，不会泄露服务器是否存在。

上报会事务性替换该服务器的在线名单：不在本次名单中的旧玩家会被删除，仍在线的玩家保留原来的 `connected_at`。

## 安全

- 使用 HTTPS：令牌在 HTTP 头中传输，明文 HTTP 会让令牌暴露在网络中。
- 令牌只写入游戏服务器的 `cfg/sourcemod/threi_players.cfg`，不要提交到 Git。
- 令牌使用 `FCVAR_PROTECTED`，不会下发给游戏客户端。
- 定期在后台重新生成令牌，尤其是在管理员变动或配置文件泄露后。
- 游戏服务器只需要能访问 threi 的 API 地址，不需要对外开放 A2S/RCON。

## 编译

使用 SourceMod 1.11 编译器，并确保 `SteamWorks.inc` 在 include 路径中：

```bash
spcomp64 -E \
  -i /path/to/sourcemod/scripting/include \
  -i /path/to/SteamWorks.inc/directory \
  -o addons/sourcemod/plugins/ThRei_Players \
  addons/sourcemod/scripting/ThRei_Players.sp
```

当前仓库内的 `.smx` 使用 SourcePawn Compiler 1.11.0.6970 编译。

## 排错

**插件没有加载**

- 确认 SourceMod 版本不低于 1.11。
- 确认 SteamWorks 扩展已安装并在 `sm exts list` 中显示为运行中。
- 查看 `addons/sourcemod/logs/` 下的错误日志。

**后台显示「等待插件上报」**

- 执行 `sm_threi_status`，确认四个配置项都已填写。
- 执行 `sm_threi_report` 立即触发一次。
- 确认游戏服务器可以访问 `sm_threi_api_url`；必要时在服务器上使用 curl 测试。
- 确认 URL 包含 `/api/v1/plugin/report`，并且协议为 `http://` 或 `https://`。

**API 返回 401**

- 令牌错误、服务器 ID 错误，或令牌已被重新生成/撤销。
- 在后台重新复制配置，更新 `cfg/sourcemod/threi_players.cfg` 后重新加载插件。

**API 返回 422**

- 地图名超过 128 字符、最大玩家数不在 1–1024 之间，或上报内容不是合法 JSON。
- 查看 `addons/sourcemod/logs/` 中记录的响应内容。

**服务器显示离线但玩家在线**

- API 只根据最近 90 秒的上报判断在线状态。
- 检查插件是否仍在运行、SteamWorks 是否正常、网络是否可达，并查看日志。

## 说明

当前插件只负责状态与玩家上报。管理后台的「踢出」「封禁」操作会写入待执行队列，但插件尚不轮询/执行这些指令；网站界面会明确提示游戏内执行尚未接入。
