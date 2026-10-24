# Cloudflare Steam 中继

当 API 所在主机无法访问 `steamcommunity.com` 时，用这个 Worker 处理**服务端**请求：

- `POST /openid/login`：Steam OpenID `check_authentication`
- `GET /profiles/{steamid64}?xml=1`：Steam 公开资料 XML

浏览器登录仍然直接跳转 `https://steamcommunity.com/openid/login`。**用户浏览器必须能打开 Steam 登录页**；Worker 不代理登录页，也不处理 Steam Guard/CAPTCHA。

## 部署

1. Cloudflare Dashboard → Workers & Pages → Create → Worker。
2. 将 [`steam-relay-worker.js`](./steam-relay-worker.js) 的内容粘贴进去并 Deploy。
3. Worker → Settings → Domains & Routes → Add custom domain，填写
   `steam.threi.online`。Cloudflare 会自动创建代理 DNS 记录。
4. 在服务器上验证：

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' https://steam.threi.online/openid/login
curl -fsS 'https://steam.threi.online/profiles/76561199125125759?xml=1' | head -c 300
```

第一个请求返回 `200`/`400`/`405` 都说明 Worker 已连通（`405` 表示只接受 GET/POST 的路径检查生效）；第二个请求应返回 Steam 资料 XML。

5. 在服务器 `/home/web/threi/.env` 中设置：

```dotenv
STEAM_COMMUNITY_BASE_URL=https://steam.threi.online
```

6. 重新创建 API 容器：

```bash
cd /home/web/threi
docker compose up -d --no-deps --force-recreate api
```

7. 用能打开 Steam 的浏览器完成一次登录，确认回调不再返回 `steam_login_failed`，并且 API 日志中没有 Steam 连接超时。

## 安全边界

- Worker 只放行 `/openid/login` 与 `/profiles/`，不是通用代理。
- OpenID 断言仍由 API 校验 `is_valid:true`；Worker 不改变断言内容。
- 不转发 `Set-Cookie`，Worker 不维护 Steam 登录态。
- 如果 Cloudflare 到 Steam 的连接也不稳定，登录仍可能失败；先看 Worker 的实时日志。
