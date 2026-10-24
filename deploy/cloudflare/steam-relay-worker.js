// Cloudflare Worker: server-side Steam Community relay.
//
// The API uses this relay for OpenID `check_authentication` and public profile
// XML when the API host cannot reach steamcommunity.com. Browser login still
// redirects to steamcommunity.com directly, so users must be able to open
// Steam's login page themselves.
//
// Bind it to a hostname such as `steam.threi.online` (Workers & Pages ->
// your Worker -> Settings -> Domains & Routes -> Add custom domain), then set
// STEAM_COMMUNITY_BASE_URL=https://steam.threi.online in the API environment.
//
// Only the two server-side paths are proxied; this is not a general proxy.

const STEAM_ORIGIN = "https://steamcommunity.com";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const allowed =
      url.pathname === "/openid/login" ||
      url.pathname.startsWith("/profiles/");

    if (!allowed) {
      return new Response("Not found", { status: 404 });
    }

    if (request.method !== "GET" && request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: "GET, POST" },
      });
    }

    const target = new URL(url.pathname + url.search, STEAM_ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("host", "steamcommunity.com");
    for (const name of [
      "cf-connecting-ip",
      "cf-ipcountry",
      "cf-ray",
      "cf-visitor",
      "x-forwarded-for",
      "x-forwarded-proto",
      "x-real-ip",
    ]) {
      headers.delete(name);
    }

    const init = {
      method: request.method,
      headers,
      redirect: "follow",
    };
    if (request.method === "POST") {
      init.body = request.body;
    }

    const upstream = await fetch(target, init);
    const responseHeaders = new Headers(upstream.headers);
    // The API never needs Steam cookies, and forwarding them would make the
    // relay look like a shared browser session.
    responseHeaders.delete("set-cookie");
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  },
};
