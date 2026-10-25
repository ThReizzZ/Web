# Cloudflare Steam 中继

当 API 所在主机无法访问 `steamcommunity.com` 时，用这个 Worker 处理**服务端**请求：

- `POST /openid/login`：Steam OpenID `check_authentication`
- `GET /profiles/{steamid64}?xml=1`：Steam 公开资料 XML

浏览器登录仍然直接跳转 `https://steamcommunity.com/openid/login`。**用户浏览器必须能打开 Steam 登录页**；Worker 不代理登录页，也不处理 Steam Guard/CAPTCHA。

> 本项目生产环境使用本方式：Worker `threi-steam-relay` 绑定 `steam.threi.online`。
> 如果 API 主机能直连 Steam 边缘 IP，也可以改用 `.env` 的 `STEAM_COMMUNITY_IP`，不需要 Worker。

## 部署

### 方式 A：Wrangler CLI（推荐）

仓库已带 `wrangler.toml`。在本机安装 Node.js 后：

```bash
cd deploy/cloudflare
export CLOUDFLARE_API_TOKEN=<具有 Workers Scripts:Edit、Workers Routes:Edit、Zone:Read 的令牌>
npx wrangler@latest deploy
```

`wrangler.toml` 会创建 Worker，并把 `steam.threi.online` 绑定为自定义域；Cloudflare 自动创建代理 DNS 记录和证书。

### 方式 B：Cloudflare Dashboard

1. Cloudflare Dashboard → Workers & Pages → Create → Worker，命名 `threi-steam-relay`。
2. 编辑代码，粘贴 [`steam-relay-worker.js`](./steam-relay-worker.js) 的全部内容并 Deploy。
3. Worker → Settings → Domains & Routes → Add → Custom domain，填写 `steam.threi.online`。
   旧界面在 Triggers → Custom Domains。

## 验证

```bash
curl -fsS 'https://steam.threi.online/profiles/76561199125125759?xml=1' | head -c 200
curl -sS -X POST --data 'openid.mode=check_authentication' https://steam.threi.online/openid/login
curl -sS -o /dev/null -w '%{http_code}\n' https://steam.threi.online/
```

预期：第一条返回资料 XML；第二条返回 `is_valid:false`（说明请求到达 Steam）；第三条返回 `404`（只放行两条路径）。

## 切换 API

在服务器 `/home/web/threi/.env` 中设置（并清空 `STEAM_COMMUNITY_IP`）：

```dotenv
STEAM_COMMUNITY_BASE_URL=https://steam.threi.online
STEAM_COMMUNITY_IP=
```

重新创建 API 容器（无需重新构建镜像）：

```bash
cd /home/web/threi
docker compose up -d --no-deps --force-recreate api
```

## 更新 Worker

修改 `steam-relay-worker.js` 后重新执行 `npx wrangler@latest deploy`，或在 Dashboard 编辑并 Deploy。

## 安全边界

- Worker 只放行 `/openid/login` 与 `/profiles/`，不是通用代理。
- OpenID 断言仍由 API 校验 `is_valid:true`；Worker 不改变断言内容。
- 不转发 `Set-Cookie`，Worker 不维护 Steam 登录态。
- 如果 Cloudflare 到 Steam 的连接也不稳定，登录仍可能失败；先看 Worker 的实时日志。
- Wrangler 使用的 API Token 不要提交到仓库或写入日志；部署完成后应删除。
