/**
 * ThRei_Players — reports server state and enforces ThRei access rules.
 *
 * The plugin uses these authenticated endpoints with a per-server token:
 *   POST /api/v1/plugin/report
 *   GET  /api/v1/plugin/access-snapshot
 *   GET  /api/v1/plugin/actions
 *   POST /api/v1/plugin/ban-report
 *
 * Whitelist and ban enforcement is local: the plugin keeps the latest
 * snapshot in memory and checks players when they finish connecting, so an
 * API outage does not block normal play. Kick/ban commands from the website
 * are consumed from the action queue and acknowledged after execution.
 * Bans executed in game through BanClient are reported back to the website.
 * Website lifts also enqueue an `unban` action that removes the local
 * SourceMod/engine ban created by sm_ban.
 *
 * Requirements:
 *   - SourceMod 1.11+
 *   - SteamWorks extension (HTTP client runs through Steam)
 */

#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <SteamWorks>
#include <adt_array>

#define PLUGIN_VERSION "1.7.2"

#define TOKEN_HEADER "X-ThRei-Plugin-Token"
#define MAX_SERVER_NAME_LENGTH 256
#define MAX_REPORT_PLAYERS 1024
#define BODY_BUFFER_SIZE 131072
#define FRAGMENT_BUFFER_SIZE 2048
#define ERROR_BODY_SIZE 2048
#define ACCESS_BODY_MAX 2097152
#define ACTION_BODY_MAX 262144
#define MAX_ACTION_LINE 1024
#define MAX_REASON_LENGTH 512
#define MAX_ACK_QUEUE 128
#define BAN_REPORT_BODY_SIZE 6144

// The action endpoint supports long polling. The HTTP request stays open for
// up to 20 seconds, so the timeout must be slightly larger; after every
// response the plugin re-polls almost immediately to keep command latency at
// roughly one second.
#define ACTION_LONG_POLL_WAIT "20"
#define ACTION_LONG_POLL_TIMEOUT 25
#define ACTION_REPOLL_DELAY 1.0

public Plugin myinfo = {
    name = "ThRei_Players",
    author = "threi",
    description = "Reports server state and enforces ThRei whitelists and bans",
    version = PLUGIN_VERSION,
    url = "https://github.com/XBDJ504764827/threi",
};

ConVar g_cvEnabled;
ConVar g_cvApiUrl;
ConVar g_cvServerId;
ConVar g_cvToken;
ConVar g_cvInterval;
ConVar g_cvAccessEnabled;
ConVar g_cvAccessFailOpen;
ConVar g_cvAccessInterval;
ConVar g_cvActionsEnabled;
ConVar g_cvActionsInterval;
ConVar g_cvWhitelistKickMessage;
ConVar g_cvBanKickMessage;

Handle g_hTimer;
Handle g_hReportRequest;
Handle g_hAccessRequest;
Handle g_hActionRequest;
Handle g_hAckRequest;
Handle g_hBanReportRequest;
Handle g_hUnbanRequest;
float g_fNextReport;
float g_fNextAccess;
float g_fNextActions;
float g_fNextBanReport;
int g_iSkipUserId;
int g_iAccessFailures;
int g_iActionFailures;
int g_iBanReportFailures;
int g_iUnbanClientUserId;
bool g_bUnbanIsIp;
char g_sUnbanSteamId[32];
char g_sUnbanIp[64];
bool g_bConfigWarned;
bool g_bControlUrlWarned;
bool g_bSteamWorksWarned;
bool g_bAccessLoaded;
bool g_bAccessRequired;

StringMap g_smWhitelist;
StringMap g_smBans;
StringMap g_smBanReasons;
ArrayList g_aAckQueue;
ArrayList g_aBanReportQueue;
ArrayList g_aBanReportKinds;

char g_sBody[BODY_BUFFER_SIZE];
char g_sErrorBody[ERROR_BODY_SIZE + 1];

// Per-instance values loaded from sm_threi_instance lines in the shared
// cfg/sourcemod/threi_players.cfg. Only the entry matching hostport is used.
int g_iHostPort;
bool g_bInstanceEntriesSeen;
bool g_bInstanceMatched;
bool g_bInstanceMatchWarned;
char g_sInstanceServerId[128];
char g_sInstanceToken[256];

public void OnPluginStart() {
    g_cvEnabled = CreateConVar("sm_threi_players_enabled", "1",
        "Enable reporting to the threi API.", FCVAR_NONE, true, 0.0, true, 1.0);
    g_cvApiUrl = CreateConVar("sm_threi_api_url", "",
        "Full report URL, for example https://example.com/api/v1/plugin/report.");
    g_cvServerId = CreateConVar("sm_threi_server_id", "",
        "Server ID configured in the threi admin panel.");
    g_cvToken = CreateConVar("sm_threi_token", "",
        "Per-server plugin token generated in the threi admin panel.",
        FCVAR_PROTECTED | FCVAR_UNLOGGED);
    g_cvInterval = CreateConVar("sm_threi_interval", "30",
        "Seconds between reports. Player joins and map changes also trigger a report.",
        FCVAR_NONE, true, 5.0, true, 600.0);

    g_cvAccessEnabled = CreateConVar("sm_threi_access_enabled", "1",
        "Enable whitelist and ban enforcement.", FCVAR_NONE, true, 0.0, true, 1.0);
    g_cvAccessFailOpen = CreateConVar("sm_threi_access_fail_open", "1",
        "Allow players while the first access snapshot is still loading.",
        FCVAR_NONE, true, 0.0, true, 1.0);
    g_cvAccessInterval = CreateConVar("sm_threi_access_interval", "30",
        "Seconds between access snapshot refreshes.",
        FCVAR_NONE, true, 10.0, true, 600.0);
    g_cvActionsEnabled = CreateConVar("sm_threi_actions_enabled", "1",
        "Enable website kick/ban command polling.", FCVAR_NONE, true, 0.0, true, 1.0);
    g_cvActionsInterval = CreateConVar("sm_threi_actions_interval", "15",
        "Retry/backoff seconds after a failed action long-poll request.",
        FCVAR_NONE, true, 5.0, true, 600.0);
    g_cvWhitelistKickMessage = CreateConVar("sm_threi_whitelist_kick_message",
        "该服务器需要白名单。请在 threi.cn 提交申请后重试。",
        "Message shown when a non-whitelisted player is kicked.", FCVAR_NONE);
    g_cvBanKickMessage = CreateConVar("sm_threi_ban_kick_message",
        "你已被该服务器封禁。",
        "Message shown when a banned player is kicked.", FCVAR_NONE);

    g_smWhitelist = new StringMap();
    g_smBans = new StringMap();
    g_smBanReasons = new StringMap();
    g_aAckQueue = new ArrayList(ByteCountToCells(64));
    g_aBanReportQueue = new ArrayList(ByteCountToCells(BAN_REPORT_BODY_SIZE));
    g_aBanReportKinds = new ArrayList();

    ResolveHostPort();

    // Registered before AutoExecConfig so the per-instance lines in
    // cfg/sourcemod/threi_players.cfg are parsed when the config executes.
    RegServerCmd("sm_threi_instance", Command_Instance,
        "Map this server port to a plugin token: sm_threi_instance <port> <token>");

    AutoExecConfig(true, "threi_players");

    RegAdminCmd("sm_threi_report", Command_Report, ADMFLAG_ROOT,
        "Send a ThRei_Players report immediately.");
    RegAdminCmd("sm_threi_status", Command_Status, ADMFLAG_ROOT,
        "Show ThRei_Players configuration and access-cache status without revealing tokens.");
    RegAdminCmd("sm_threi_ban", Command_Ban, ADMFLAG_BAN,
        "封禁玩家并同步网站：sm_threi_ban <目标|SteamID64> <分钟> [原因]");
    RegAdminCmd("sm_threi_addban", Command_AddBan, ADMFLAG_BAN,
        "按 SteamID64 封禁并同步网站：sm_threi_addban <SteamID64> <分钟> [原因]");
    RegAdminCmd("sm_threi_unban", Command_Unban, ADMFLAG_BAN,
        "解封并同步网站：sm_threi_unban <SteamID64|STEAM_x:y:z|[U:1:account]>");
    RegAdminCmd("sm_threi_banip", Command_BanIp, ADMFLAG_BAN,
        "封禁 IP 并同步网站：sm_threi_banip <IP> <分钟> [原因]");
    RegAdminCmd("sm_threi_unbanip", Command_UnbanIp, ADMFLAG_BAN,
        "解封 IP 并同步网站：sm_threi_unbanip <IP>");

    float now = GetGameTime();
    g_fNextReport = now + 5.0;
    g_fNextAccess = now + 3.0;
    g_fNextActions = now + 8.0;
    g_hTimer = CreateTimer(1.0, Timer_Poll, _, TIMER_REPEAT);
}

public void OnAllPluginsLoaded() {
    if (!SteamWorks_IsLoaded()) {
        LogError("[ThRei_Players] SteamWorks extension is not loaded; HTTP features are unavailable.");
        g_bSteamWorksWarned = true;
    }
}

public void OnConfigsExecuted() {
    QueueReport(2.0);
    ScheduleAccess(2.0);
    ScheduleActions(4.0);
}

public void OnMapStart() {
    QueueReport(5.0);
    ScheduleAccess(3.0);
    ScheduleActions(5.0);
}

public void OnClientPostAdminCheck(int client) {
    CheckClientAccess(client);
    QueueReport(1.0);
}

public void OnClientDisconnect(int client) {
    // Report immediately when the server becomes empty. CS:GO may hibernate
    // as soon as the last player leaves, which would stop all SourceMod timers.
    g_iSkipUserId = GetClientUserId(client);
    g_fNextReport = GetGameTime();
    if (g_hReportRequest == null) {
        SendReport();
    }
}

/**
 * Reports bans executed through `BanClient` (including `sm_ban`) to the
 * website. The local ban is still applied by SourceMod; this forward only
 * adds a website record and an automatic IP ban.
 *
 * Raw console `banid` commands do not fire this forward.
 */
public Action OnBanClient(int client, int time, int flags, const char[] reason,
        const char[] kick_message, const char[] command, any source) {
    if (!g_cvEnabled.BoolValue || g_aBanReportQueue == null) {
        return Plugin_Continue;
    }
    if (client <= 0 || !IsClientInGame(client) || IsFakeClient(client)
            || IsClientSourceTV(client) || IsClientReplay(client)) {
        return Plugin_Continue;
    }

    char steamId[MAX_AUTHID_LENGTH];
    if (!GetClientAuthId(client, AuthId_SteamID64, steamId, sizeof(steamId), true)
            || strlen(steamId) != 17) {
        return Plugin_Continue;
    }

    char ip[64];
    char ipJson[256];
    ip[0] = '\0';
    GetClientIP(client, ip, sizeof(ip), true);
    JsonEscape(ip, ipJson, sizeof(ipJson));

    char name[MAX_NAME_LENGTH];
    char safeName[MAX_NAME_LENGTH];
    char nameJson[FRAGMENT_BUFFER_SIZE];
    GetClientName(client, name, sizeof(name));
    if (name[0] != '\0' && IsValidUtf8(name)) {
        strcopy(safeName, sizeof(safeName), name);
    } else {
        strcopy(safeName, sizeof(safeName), steamId);
    }
    JsonEscape(safeName, nameJson, sizeof(nameJson));

    char safeReason[MAX_REASON_LENGTH];
    strcopy(safeReason, sizeof(safeReason), reason);
    TrimString(safeReason);
    if (safeReason[0] == '\0' || !IsValidUtf8(safeReason)) {
        strcopy(safeReason, sizeof(safeReason), "服务器封禁");
    }
    char reasonJson[FRAGMENT_BUFFER_SIZE];
    JsonEscape(safeReason, reasonJson, sizeof(reasonJson));

    if (time < 0) {
        time = 0;
    }

    char body[BAN_REPORT_BODY_SIZE];
    Format(body, sizeof(body),
        "{\"steamId64\":\"%s\",\"ipAddress\":\"%s\",\"playerName\":\"%s\","
        ... "\"reason\":\"%s\",\"durationMinutes\":%d}",
        steamId, ipJson, nameJson, reasonJson, time);

    QueueBanReport(1, body);
    return Plugin_Continue;
}

public void OnPluginEnd() {
    if (g_hTimer != null) {
        KillTimer(g_hTimer);
        g_hTimer = null;
    }
    CloseRequest(g_hReportRequest);
    CloseRequest(g_hAccessRequest);
    CloseRequest(g_hActionRequest);
    CloseRequest(g_hAckRequest);
    CloseRequest(g_hBanReportRequest);
    CloseRequest(g_hUnbanRequest);
    g_hReportRequest = null;
    g_hAccessRequest = null;
    g_hActionRequest = null;
    g_hAckRequest = null;
    g_hBanReportRequest = null;
    g_hUnbanRequest = null;

    if (g_smWhitelist != null) {
        delete g_smWhitelist;
        g_smWhitelist = null;
    }
    if (g_smBans != null) {
        delete g_smBans;
        g_smBans = null;
    }
    if (g_smBanReasons != null) {
        delete g_smBanReasons;
        g_smBanReasons = null;
    }
    if (g_aAckQueue != null) {
        delete g_aAckQueue;
        g_aAckQueue = null;
    }
    if (g_aBanReportQueue != null) {
        delete g_aBanReportQueue;
        g_aBanReportQueue = null;
    }
    if (g_aBanReportKinds != null) {
        delete g_aBanReportKinds;
        g_aBanReportKinds = null;
    }
}

public Action Timer_Poll(Handle timer) {
    float now = GetGameTime();

    if (g_cvEnabled.BoolValue && g_hReportRequest == null && now >= g_fNextReport) {
        SendReport();
    }
    if (g_cvAccessEnabled.BoolValue && g_hAccessRequest == null && now >= g_fNextAccess) {
        SendAccessSnapshot();
    }
    if (g_cvActionsEnabled.BoolValue && g_hActionRequest == null && now >= g_fNextActions) {
        SendActions();
    }
    if (g_aAckQueue != null && g_aAckQueue.Length > 0 && g_hAckRequest == null) {
        SendNextAck();
    }
    if (g_aBanReportQueue != null && g_aBanReportQueue.Length > 0
            && g_hBanReportRequest == null && now >= g_fNextBanReport) {
        SendNextBanReport();
    }
    return Plugin_Continue;
}

public Action Command_Report(int client, int args) {
    if (g_hReportRequest != null) {
        ReplyToCommand(client, "[ThRei_Players] A report is already in flight.");
        return Plugin_Handled;
    }
    g_fNextReport = GetGameTime();
    ReplyToCommand(client, "[ThRei_Players] Report queued.");
    return Plugin_Handled;
}

public Action Command_Status(int client, int args) {
    char apiUrl[512];
    char serverId[128];
    char token[256];
    GetConVarString(g_cvApiUrl, apiUrl, sizeof(apiUrl));

    if (g_bInstanceMatched) {
        strcopy(serverId, sizeof(serverId), g_sInstanceServerId);
        strcopy(token, sizeof(token), g_sInstanceToken);
    } else if (!g_bInstanceEntriesSeen) {
        GetConVarString(g_cvServerId, serverId, sizeof(serverId));
        GetConVarString(g_cvToken, token, sizeof(token));
    } else {
        serverId[0] = '\0';
        token[0] = '\0';
    }

    ReplyToCommand(client, "[ThRei_Players] version=%s enabled=%d interval=%d",
        PLUGIN_VERSION, g_cvEnabled.BoolValue, g_cvInterval.IntValue);
    ReplyToCommand(client, "[ThRei_Players] config=cfg/sourcemod/threi_players.cfg");
    ReplyToCommand(client, "[ThRei_Players] hostport=%d instance=%s", g_iHostPort,
        g_bInstanceMatched
            ? "matched"
            : (g_bInstanceEntriesSeen ? "no matching entry" : "not configured"));
    ReplyToCommand(client, "[ThRei_Players] api=%s", apiUrl[0] ? apiUrl : "(not configured)");
    ReplyToCommand(client, "[ThRei_Players] server=%s",
        serverId[0] ? serverId : (g_bInstanceMatched ? "(matched by token)" : "(not configured)"));
    ReplyToCommand(client, "[ThRei_Players] token=%s",
        token[0] ? "configured" : "(not configured)");
    ReplyToCommand(client, "[ThRei_Players] steamworks=%s",
        SteamWorks_IsLoaded() ? "loaded" : "missing");
    ReplyToCommand(client, "[ThRei_Players] access=%s loaded=%s required=%s whitelist=%d bans=%d",
        g_cvAccessEnabled.BoolValue ? "enabled" : "disabled",
        g_bAccessLoaded ? "yes" : "no",
        g_bAccessRequired ? "yes" : "no",
        g_smWhitelist != null ? g_smWhitelist.Size : 0,
        g_smBans != null ? g_smBans.Size : 0);
    ReplyToCommand(client, "[ThRei_Players] actions=%s interval=%d pendingAcks=%d",
        g_cvActionsEnabled.BoolValue ? "enabled" : "disabled",
        g_cvActionsInterval.IntValue,
        g_aAckQueue != null ? g_aAckQueue.Length : 0);
    return Plugin_Handled;
}

public Action Command_Ban(int client, int args) {
    if (args < 2) {
        ReplyToCommand(client,
            "[ThRei] 用法：sm_threi_ban <目标|SteamID64> <分钟> [原因]（0 = 永久）");
        return Plugin_Handled;
    }
    char targetArg[64];
    GetCmdArg(1, targetArg, sizeof(targetArg));
    TrimString(targetArg);

    char normalized[32];
    if (TrySteamIdTo64(targetArg, normalized, sizeof(normalized))) {
        strcopy(targetArg, sizeof(targetArg), normalized);
    }

    int minutes;
    if (!ParseBanMinutes(2, minutes)) {
        ReplyToCommand(client, "[ThRei] 分钟数必须是 0–52560000 的整数。");
        return Plugin_Handled;
    }
    char reason[MAX_REASON_LENGTH];
    ReadBanReason(3, reason, sizeof(reason));

    char steamId[32];
    char name[MAX_NAME_LENGTH];
    char ip[64];
    if (!ResolveBanTarget(client, targetArg, steamId, sizeof(steamId),
            name, sizeof(name), ip, sizeof(ip))) {
        ReplyToCommand(client, "[ThRei] 找不到目标或无法识别 SteamID：%s", targetArg);
        return Plugin_Handled;
    }

    ApplySteamBan(client, steamId, name, ip, minutes, reason);
    return Plugin_Handled;
}

public Action Command_AddBan(int client, int args) {
    if (args < 2) {
        ReplyToCommand(client,
            "[ThRei] 用法：sm_threi_addban <SteamID64|STEAM_x:y:z|[U:1:account]> <分钟> [原因]");
        return Plugin_Handled;
    }
    char input[64];
    GetCmdArg(1, input, sizeof(input));
    TrimString(input);
    char steamId[32];
    if (!TrySteamIdTo64(input, steamId, sizeof(steamId))) {
        ReplyToCommand(client, "[ThRei] 无法识别 SteamID：%s", input);
        return Plugin_Handled;
    }

    int minutes;
    if (!ParseBanMinutes(2, minutes)) {
        ReplyToCommand(client, "[ThRei] 分钟数必须是 0–52560000 的整数。");
        return Plugin_Handled;
    }
    char reason[MAX_REASON_LENGTH];
    ReadBanReason(3, reason, sizeof(reason));

    char name[MAX_NAME_LENGTH];
    char ip[64];
    name[0] = '\0';
    ip[0] = '\0';
    int target = FindClientBySteamId(steamId);
    if (target > 0) {
        GetClientName(target, name, sizeof(name));
        GetClientIP(target, ip, sizeof(ip), true);
    } else {
        strcopy(name, sizeof(name), steamId);
    }

    ApplySteamBan(client, steamId, name, ip, minutes, reason);
    return Plugin_Handled;
}

public Action Command_Unban(int client, int args) {
    if (args < 1) {
        ReplyToCommand(client,
            "[ThRei] 用法：sm_threi_unban <SteamID64|STEAM_x:y:z|[U:1:account]>");
        return Plugin_Handled;
    }
    char arg[64];
    GetCmdArg(1, arg, sizeof(arg));
    TrimString(arg);

    char steamId[32];
    if (!TrySteamIdTo64(arg, steamId, sizeof(steamId))) {
        ReplyToCommand(client, "[ThRei] 无法识别 SteamID：%s", arg);
        return Plugin_Handled;
    }

    char ip[64];
    ip[0] = '\0';
    int target = FindClientBySteamId(steamId);
    if (target > 0) {
        GetClientIP(target, ip, sizeof(ip), true);
    }
    SendUnbanRequest(client, steamId, ip);
    return Plugin_Handled;
}

public Action Command_BanIp(int client, int args) {
    if (args < 2) {
        ReplyToCommand(client,
            "[ThRei] 用法：sm_threi_banip <IP> <分钟> [原因]（0 = 永久）");
        return Plugin_Handled;
    }
    char ip[64];
    GetCmdArg(1, ip, sizeof(ip));
    TrimString(ip);
    if (!LooksLikeIp(ip)) {
        ReplyToCommand(client, "[ThRei] IP 地址格式不正确：%s", ip);
        return Plugin_Handled;
    }
    int minutes;
    if (!ParseBanMinutes(2, minutes)) {
        ReplyToCommand(client, "[ThRei] 分钟数必须是 0–52560000 的整数。");
        return Plugin_Handled;
    }
    char reason[MAX_REASON_LENGTH];
    ReadBanReason(3, reason, sizeof(reason));
    if (!IsValidUtf8(reason)) {
        strcopy(reason, sizeof(reason), "管理员封禁");
    }

    if (!BanIdentity(ip, minutes, BANFLAG_IP, reason, "threi_banip", 0)) {
        LogError("[ThRei_Players] Could not write local IP ban for %s.", ip);
    }
    for (int i = 1; i <= MaxClients; i++) {
        if (!IsClientInGame(i) || IsFakeClient(i) || IsClientSourceTV(i)
                || IsClientReplay(i)) {
            continue;
        }
        char clientIp[64];
        if (!GetClientIP(i, clientIp, sizeof(clientIp), true)
                || !StrEqual(clientIp, ip, false)) {
            continue;
        }
        char message[512];
        Format(message, sizeof(message), "你已被服务器封禁。原因：%s", reason);
        KickClient(i, "%s", message);
    }

    char ipJson[256];
    char reasonJson[FRAGMENT_BUFFER_SIZE];
    JsonEscape(ip, ipJson, sizeof(ipJson));
    JsonEscape(reason, reasonJson, sizeof(reasonJson));
    char body[1024];
    Format(body, sizeof(body),
        "{\"ipAddress\":\"%s\",\"reason\":\"%s\",\"durationMinutes\":%d}",
        ipJson, reasonJson, minutes);
    QueueBanReport(2, body);

    if (minutes == 0) {
        ReplyToCommand(client, "[ThRei] 已永久封禁 IP %s，并提交网站同步。", ip);
    } else {
        ReplyToCommand(client, "[ThRei] 已封禁 IP %s %d 分钟，并提交网站同步。", ip, minutes);
    }
    return Plugin_Handled;
}

public Action Command_UnbanIp(int client, int args) {
    if (args < 1) {
        ReplyToCommand(client, "[ThRei] 用法：sm_threi_unbanip <IP>");
        return Plugin_Handled;
    }
    char ip[64];
    GetCmdArg(1, ip, sizeof(ip));
    TrimString(ip);
    if (!LooksLikeIp(ip)) {
        ReplyToCommand(client, "[ThRei] IP 地址格式不正确：%s", ip);
        return Plugin_Handled;
    }
    SendUnbanRequest(client, "", ip);
    return Plugin_Handled;
}

bool ParseBanMinutes(int argIndex, int &minutes) {
    char value[32];
    GetCmdArg(argIndex, value, sizeof(value));
    TrimString(value);
    if (value[0] == '\0') {
        return false;
    }
    for (int i = 0; value[i] != '\0'; i++) {
        if (!IsCharNumeric(value[i])) {
            return false;
        }
    }
    minutes = StringToInt(value);
    return minutes >= 0 && minutes <= 52560000;
}

void ReadBanReason(int firstArg, char[] reason, int maxLength) {
    reason[0] = '\0';
    int args = GetCmdArgs();
    for (int i = firstArg; i <= args; i++) {
        char part[256];
        GetCmdArg(i, part, sizeof(part));
        if (part[0] == '\0') {
            continue;
        }
        if (reason[0] != '\0') {
            StrCat(reason, maxLength, " ");
        }
        StrCat(reason, maxLength, part);
    }
    TrimString(reason);
    if (reason[0] == '\0') {
        strcopy(reason, maxLength, "管理员封禁");
    }
}

bool ResolveBanTarget(int adminClient, const char[] arg, char[] steamId, int steamIdMax,
        char[] name, int nameMax, char[] ip, int ipMax) {
    steamId[0] = '\0';
    name[0] = '\0';
    ip[0] = '\0';

    int target;
    if (IsSteamId64(arg)) {
        strcopy(steamId, steamIdMax, arg);
        target = FindClientBySteamId(steamId);
    } else {
        target = FindTarget(adminClient, arg, true, true);
        if (target <= 0) {
            return false;
        }
        if (!GetClientAuthId(target, AuthId_SteamID64, steamId, steamIdMax, true)
                || !IsSteamId64(steamId)) {
            return false;
        }
    }

    if (target > 0) {
        GetClientName(target, name, nameMax);
        GetClientIP(target, ip, ipMax, true);
    } else {
        strcopy(name, nameMax, steamId);
    }
    return true;
}

void ApplySteamBan(int adminClient, const char[] steamId, const char[] name,
        const char[] ip, int minutes, const char[] reason) {
    char safeName[MAX_NAME_LENGTH];
    char safeReason[MAX_REASON_LENGTH];
    if (name[0] != '\0' && IsValidUtf8(name)) {
        strcopy(safeName, sizeof(safeName), name);
    } else {
        strcopy(safeName, sizeof(safeName), steamId);
    }
    if (reason[0] != '\0' && IsValidUtf8(reason)) {
        strcopy(safeReason, sizeof(safeReason), reason);
    } else {
        strcopy(safeReason, sizeof(safeReason), "管理员封禁");
    }

    int expiresAt = minutes > 0 ? GetTime() + minutes * 60 : 0;
    if (g_smBans != null) {
        g_smBans.SetValue(steamId, expiresAt, true);
        g_smBanReasons.SetString(steamId, safeReason, true);
    }

    char steamId2[64];
    BuildSteamId2From64(steamId, steamId2, sizeof(steamId2));
    if (!BanIdentity(steamId2, minutes, BANFLAG_AUTHID, safeReason, "threi_ban", 0)) {
        LogError("[ThRei_Players] Could not write local ban for %s.", steamId);
    }

    int target = FindClientBySteamId(steamId);
    if (target > 0) {
        char message[512];
        Format(message, sizeof(message), "你已被服务器封禁。原因：%s", safeReason);
        KickClient(target, "%s", message);
    }

    char nameJson[FRAGMENT_BUFFER_SIZE];
    char ipJson[256];
    char reasonJson[FRAGMENT_BUFFER_SIZE];
    JsonEscape(safeName, nameJson, sizeof(nameJson));
    JsonEscape(ip, ipJson, sizeof(ipJson));
    JsonEscape(safeReason, reasonJson, sizeof(reasonJson));

    char body[BAN_REPORT_BODY_SIZE];
    Format(body, sizeof(body),
        "{\"steamId64\":\"%s\",\"ipAddress\":\"%s\",\"playerName\":\"%s\","
        ... "\"reason\":\"%s\",\"durationMinutes\":%d}",
        steamId, ipJson, nameJson, reasonJson, minutes);
    QueueBanReport(1, body);

    if (minutes == 0) {
        ReplyToCommand(adminClient, "[ThRei] 已永久封禁 %s，并提交网站同步。", steamId);
    } else {
        ReplyToCommand(adminClient, "[ThRei] 已封禁 %s %d 分钟，并提交网站同步。",
            steamId, minutes);
    }
}

void SendUnbanRequest(int client, const char[] steamId, const char[] ip) {
    if (g_hUnbanRequest != null) {
        ReplyToCommand(client, "[ThRei] 已有解封请求进行中，请稍后再试。");
        return;
    }
    if (!SteamWorks_IsLoaded()) {
        ReplyToCommand(client, "[ThRei] SteamWorks 未加载，无法同步网站解封。");
        return;
    }

    char reportUrl[512];
    char serverId[128];
    char token[256];
    char apiUrl[512];
    if (!ResolveConfig(reportUrl, sizeof(reportUrl), serverId, sizeof(serverId), token,
            sizeof(token))) {
        ReplyToCommand(client, "[ThRei] 插件配置不完整，无法同步网站解封。");
        return;
    }
    if (!BuildControlUrl(reportUrl, "/plugin/unban-report", apiUrl, sizeof(apiUrl))) {
        ReplyToCommand(client, "[ThRei] 无法推导解封接口地址。");
        return;
    }

    char body[1024];
    if (steamId[0] != '\0') {
        char ipJson[256];
        ipJson[0] = '\0';
        if (ip[0] != '\0') {
            JsonEscape(ip, ipJson, sizeof(ipJson));
        }
        Format(body, sizeof(body),
            "{\"steamId64\":\"%s\",\"ipAddress\":\"%s\",\"reason\":\"游戏内解封\"}",
            steamId, ipJson);
    } else if (ip[0] != '\0') {
        char ipJson[256];
        JsonEscape(ip, ipJson, sizeof(ipJson));
        Format(body, sizeof(body),
            "{\"ipAddress\":\"%s\",\"reason\":\"游戏内解封\"}", ipJson);
    } else {
        ReplyToCommand(client, "[ThRei] 缺少 SteamID 或 IP。");
        return;
    }

    Handle request = SteamWorks_CreateHTTPRequest(k_EHTTPMethodPOST, apiUrl);
    if (!PrepareRequest(request, token)) {
        CloseRequest(request);
        ReplyToCommand(client, "[ThRei] 无法创建解封请求。");
        return;
    }
    if (!SteamWorks_SetHTTPRequestRawPostBody(request, "application/json", body,
            strlen(body))) {
        CloseRequest(request);
        ReplyToCommand(client, "[ThRei] 无法设置解封请求内容。");
        return;
    }
    if (!SteamWorks_SetHTTPCallbacks(request, OnUnbanReportComplete)) {
        CloseRequest(request);
        ReplyToCommand(client, "[ThRei] 无法设置解封回调。");
        return;
    }

    g_hUnbanRequest = request;
    g_bUnbanIsIp = steamId[0] == '\0';
    g_iUnbanClientUserId = client > 0 ? GetClientUserId(client) : 0;
    strcopy(g_sUnbanSteamId, sizeof(g_sUnbanSteamId), steamId);
    strcopy(g_sUnbanIp, sizeof(g_sUnbanIp), ip);

    if (!SteamWorks_SendHTTPRequest(request)) {
        if (g_hUnbanRequest == request) {
            g_hUnbanRequest = null;
            CloseHandle(request);
        }
        g_iUnbanClientUserId = 0;
        g_sUnbanSteamId[0] = '\0';
        g_sUnbanIp[0] = '\0';
        ReplyToCommand(client, "[ThRei] 解封请求发送失败，本地封禁保持不变。");
        return;
    }
    ReplyToCommand(client, "[ThRei] 已提交网站解封请求，等待服务器确认...");
}

bool IsValidUtf8(const char[] value) {
    int length = strlen(value);
    int index = 0;
    while (index < length) {
        int first = value[index] & 0xFF;
        if (first < 0x80) {
            index++;
            continue;
        }

        int needed;
        int secondMin = 0x80;
        int secondMax = 0xBF;
        if (first >= 0xC2 && first <= 0xDF) {
            needed = 1;
        } else if (first == 0xE0) {
            needed = 2;
            secondMin = 0xA0;
        } else if (first >= 0xE1 && first <= 0xEC) {
            needed = 2;
        } else if (first == 0xED) {
            needed = 2;
            secondMax = 0x9F;
        } else if (first >= 0xEE && first <= 0xEF) {
            needed = 2;
        } else if (first == 0xF0) {
            needed = 3;
            secondMin = 0x90;
        } else if (first >= 0xF1 && first <= 0xF3) {
            needed = 3;
        } else if (first == 0xF4) {
            needed = 3;
            secondMax = 0x8F;
        } else {
            return false;
        }

        if (index + needed >= length) {
            return false;
        }
        int second = value[index + 1] & 0xFF;
        if (second < secondMin || second > secondMax) {
            return false;
        }
        for (int offset = 2; offset <= needed; offset++) {
            int continuation = value[index + offset] & 0xFF;
            if (continuation < 0x80 || continuation > 0xBF) {
                return false;
            }
        }
        index += needed + 1;
    }
    return true;
}

bool AllDigits(const char[] value) {
    if (value[0] == '\0') {
        return false;
    }
    for (int i = 0; value[i] != '\0'; i++) {
        if (!IsCharNumeric(value[i])) {
            return false;
        }
    }
    return true;
}

bool TrySteamIdTo64(const char[] input, char[] output, int maxLength) {
    if (IsSteamId64(input)) {
        strcopy(output, maxLength, input);
        return true;
    }

    int accountId = -1;
    if (StrContains(input, "STEAM_", false) == 0) {
        char parts[3][32];
        if (ExplodeString(input, ":", parts, 3, sizeof(parts[])) != 3
                || !AllDigits(parts[1]) || !AllDigits(parts[2])) {
            return false;
        }
        int y = StringToInt(parts[1]);
        int z = StringToInt(parts[2]);
        if (y < 0 || y > 1 || z < 0 || z > 1073741823) {
            return false;
        }
        accountId = 2 * z + y;
    } else if (input[0] == '[' || (input[0] == 'U' && input[1] == ':')) {
        char trimmed[64];
        strcopy(trimmed, sizeof(trimmed), input);
        ReplaceString(trimmed, sizeof(trimmed), "[", "", false);
        ReplaceString(trimmed, sizeof(trimmed), "]", "", false);
        char parts[3][32];
        if (ExplodeString(trimmed, ":", parts, 3, sizeof(parts[])) != 3
                || !AllDigits(parts[2])) {
            return false;
        }
        accountId = StringToInt(parts[2]);
    } else {
        return false;
    }

    if (accountId < 0) {
        return false;
    }
    int cells[2];
    cells[0] = accountId;
    cells[1] = 0x1100001;
    return Int64ToString(cells, output, maxLength) > 0;
}

bool LooksLikeIp(const char[] value) {
    if (StrContains(value, ":") != -1) {
        return true;
    }
    char parts[4][4];
    if (ExplodeString(value, ".", parts, 4, sizeof(parts[])) != 4) {
        return false;
    }
    for (int i = 0; i < 4; i++) {
        if (parts[i][0] == '\0') {
            return false;
        }
        for (int j = 0; parts[i][j] != '\0'; j++) {
            if (!IsCharNumeric(parts[i][j])) {
                return false;
            }
        }
        int octet = StringToInt(parts[i]);
        if (octet < 0 || octet > 255) {
            return false;
        }
    }
    return true;
}

void ResolveHostPort() {
    ConVar hostport = FindConVar("hostport");
    g_iHostPort = hostport != null ? hostport.IntValue : 0;
    if (g_iHostPort <= 0) {
        ConVar portCvar = FindConVar("port");
        if (portCvar != null) {
            g_iHostPort = portCvar.IntValue;
        }
    }
    if (g_iHostPort <= 0) {
        LogError("[ThRei_Players] Could not determine hostport; sm_threi_instance entries cannot be matched.");
    }
}

/**
 * Handles one line of the shared config:
 *
 *   sm_threi_instance <port> <token>
 *   sm_threi_instance <port> <server-id> <token>
 *
 * Only the line whose port matches this instance's hostport is kept. The
 * two-argument form lets the API resolve the server by the unique token, so
 * every instance can share one config file without copying server ids.
 */
public Action Command_Instance(int args) {
    if (args < 2 || args > 3) {
        LogError("[ThRei_Players] sm_threi_instance expects <port> <token> "
                 ... "or <port> <server-id> <token>.");
        return Plugin_Handled;
    }

    char portValue[16];
    GetCmdArg(1, portValue, sizeof(portValue));
    int port = StringToInt(portValue);
    if (port <= 0 || port > 65535) {
        LogError("[ThRei_Players] sm_threi_instance has an invalid port: %s.", portValue);
        return Plugin_Handled;
    }

    char serverId[128];
    char token[256];
    if (args == 2) {
        serverId[0] = '\0';
        GetCmdArg(2, token, sizeof(token));
    } else {
        GetCmdArg(2, serverId, sizeof(serverId));
        GetCmdArg(3, token, sizeof(token));
    }
    TrimString(serverId);
    TrimString(token);

    if (token[0] == '\0') {
        LogError("[ThRei_Players] sm_threi_instance for port %d has an empty token.", port);
        return Plugin_Handled;
    }

    g_bInstanceEntriesSeen = true;
    if (port != g_iHostPort) {
        return Plugin_Handled;
    }

    strcopy(g_sInstanceServerId, sizeof(g_sInstanceServerId), serverId);
    strcopy(g_sInstanceToken, sizeof(g_sInstanceToken), token);
    g_bInstanceMatched = true;
    g_bInstanceMatchWarned = false;
    LogMessage("[ThRei_Players] Using sm_threi_instance entry for port %d.", port);
    return Plugin_Handled;
}

void QueueReport(float delay) {
    float due = GetGameTime() + delay;
    if (g_fNextReport <= 0.0 || due < g_fNextReport) {
        g_fNextReport = due;
    }
}

void ScheduleAccess(float delay) {
    g_fNextAccess = GetGameTime() + delay;
}

void ScheduleActions(float delay) {
    g_fNextActions = GetGameTime() + delay;
}

bool ResolveConfig(char[] apiUrl, int apiMax, char[] serverId, int serverIdMax,
        char[] token, int tokenMax) {
    GetConVarString(g_cvApiUrl, apiUrl, apiMax);
    TrimString(apiUrl);

    if (g_bInstanceEntriesSeen) {
        if (!g_bInstanceMatched) {
            if (!g_bInstanceMatchWarned) {
                LogError("[ThRei_Players] No sm_threi_instance entry matches hostport %d; "
                         ... "requests are skipped. Add a matching line to "
                         ... "cfg/sourcemod/threi_players.cfg.", g_iHostPort);
                g_bInstanceMatchWarned = true;
            }
            return false;
        }
        strcopy(serverId, serverIdMax, g_sInstanceServerId);
        strcopy(token, tokenMax, g_sInstanceToken);
    } else {
        GetConVarString(g_cvServerId, serverId, serverIdMax);
        GetConVarString(g_cvToken, token, tokenMax);
        TrimString(serverId);
        TrimString(token);
    }

    if (apiUrl[0] == '\0' || token[0] == '\0') {
        if (!g_bConfigWarned) {
            LogError("[ThRei_Players] Configuration is incomplete. Set sm_threi_api_url and "
                     ... "either sm_threi_instance or sm_threi_token in "
                     ... "cfg/sourcemod/threi_players.cfg.");
            g_bConfigWarned = true;
        }
        return false;
    }
    if (strncmp(apiUrl, "https://", 8, false) != 0 && strncmp(apiUrl, "http://", 7, false) != 0) {
        LogError("[ThRei_Players] sm_threi_api_url must start with http:// or https://.");
        return false;
    }

    g_bConfigWarned = false;
    return true;
}

/**
 * Derives a control endpoint from the configured report URL by replacing
 * "/plugin/report" with the requested suffix. Keeping one base setting makes
 * the existing single-instance and shared-config setups work unchanged.
 */
bool BuildControlUrl(const char[] reportUrl, const char[] endpoint, char[] output, int maxLength) {
    int index = StrContains(reportUrl, "/plugin/report", false);
    if (index <= 0) {
        if (!g_bControlUrlWarned) {
            LogError("[ThRei_Players] sm_threi_api_url must contain /plugin/report so "
                     ... "access and action endpoints can be derived.");
            g_bControlUrlWarned = true;
        }
        return false;
    }

    int prefixLength = index;
    if (prefixLength + strlen(endpoint) >= maxLength) {
        return false;
    }
    strcopy(output, maxLength, reportUrl);
    output[prefixLength] = '\0';
    StrCat(output, maxLength, endpoint);
    return true;
}

bool PrepareRequest(Handle request, const char[] token, int timeout = 15) {
    if (request == null) {
        return false;
    }
    if (!SteamWorks_SetHTTPRequestHeaderValue(request, TOKEN_HEADER, token)) {
        LogError("[ThRei_Players] Could not set the plugin token header.");
        return false;
    }
    if (!SteamWorks_SetHTTPRequestNetworkActivityTimeout(request, timeout)) {
        LogError("[ThRei_Players] Could not set the HTTP timeout.");
        return false;
    }
    return true;
}

void CloseRequest(Handle request) {
    if (request != null) {
        CloseHandle(request);
    }
}

void SendReport() {
    float interval = float(g_cvInterval.IntValue);
    if (interval < 5.0) {
        interval = 5.0;
    } else if (interval > 600.0) {
        interval = 600.0;
    }
    g_fNextReport = GetGameTime() + interval;

    if (!SteamWorks_IsLoaded()) {
        if (!g_bSteamWorksWarned) {
            LogError("[ThRei_Players] SteamWorks extension is not loaded; skipping report.");
            g_bSteamWorksWarned = true;
        }
        return;
    }
    g_bSteamWorksWarned = false;

    char apiUrl[512];
    char serverId[128];
    char token[256];
    if (!ResolveConfig(apiUrl, sizeof(apiUrl), serverId, sizeof(serverId), token, sizeof(token))) {
        return;
    }

    int skipUserId = g_iSkipUserId;
    g_iSkipUserId = 0;
    if (!BuildBody(serverId, skipUserId)) {
        return;
    }

    Handle request = SteamWorks_CreateHTTPRequest(k_EHTTPMethodPOST, apiUrl);
    if (!PrepareRequest(request, token)) {
        CloseRequest(request);
        return;
    }

    // Steam's HTTP client sets its own User-Agent and rejects the header via
    // SetHTTPRequestHeaderValue, so no custom User-Agent is sent.
    if (!SteamWorks_SetHTTPRequestRawPostBody(request, "application/json", g_sBody,
            strlen(g_sBody))) {
        LogError("[ThRei_Players] Could not set the HTTP request body.");
        CloseRequest(request);
        return;
    }
    if (!SteamWorks_SetHTTPCallbacks(request, OnReportComplete)) {
        LogError("[ThRei_Players] Could not set the HTTP callbacks.");
        CloseRequest(request);
        return;
    }

    g_hReportRequest = request;
    if (!SteamWorks_SendHTTPRequest(request)) {
        LogError("[ThRei_Players] Could not send the HTTP request.");
        if (g_hReportRequest == request) {
            g_hReportRequest = null;
            CloseHandle(request);
        }
    }
}

void SendAccessSnapshot() {
    int interval = g_cvAccessInterval.IntValue;
    if (interval < 10) {
        interval = 10;
    }
    g_fNextAccess = GetGameTime() + float(interval);

    if (!SteamWorks_IsLoaded()) {
        return;
    }

    char apiUrl[512];
    char reportUrl[512];
    char serverId[128];
    char token[256];
    if (!ResolveConfig(reportUrl, sizeof(reportUrl), serverId, sizeof(serverId), token,
            sizeof(token))) {
        return;
    }
    if (!BuildControlUrl(reportUrl, "/plugin/access-snapshot", apiUrl, sizeof(apiUrl))) {
        return;
    }

    Handle request = SteamWorks_CreateHTTPRequest(k_EHTTPMethodGET, apiUrl);
    if (!PrepareRequest(request, token)) {
        CloseRequest(request);
        return;
    }
    if (!SteamWorks_SetHTTPCallbacks(request, OnAccessComplete)) {
        LogError("[ThRei_Players] Could not set access snapshot callbacks.");
        CloseRequest(request);
        return;
    }

    g_hAccessRequest = request;
    if (!SteamWorks_SendHTTPRequest(request)) {
        LogError("[ThRei_Players] Could not send access snapshot request.");
        if (g_hAccessRequest == request) {
            g_hAccessRequest = null;
            CloseHandle(request);
        }
    }
}

void SendActions() {
    int interval = g_cvActionsInterval.IntValue;
    if (interval < 5) {
        interval = 5;
    }
    g_fNextActions = GetGameTime() + float(interval);

    if (!SteamWorks_IsLoaded()) {
        return;
    }

    char reportUrl[512];
    char apiUrl[512];
    char serverId[128];
    char token[256];
    if (!ResolveConfig(reportUrl, sizeof(reportUrl), serverId, sizeof(serverId), token,
            sizeof(token))) {
        return;
    }
    if (!BuildControlUrl(reportUrl, "/plugin/actions", apiUrl, sizeof(apiUrl))) {
        return;
    }
    StrCat(apiUrl, sizeof(apiUrl), "?wait=");
    StrCat(apiUrl, sizeof(apiUrl), ACTION_LONG_POLL_WAIT);

    Handle request = SteamWorks_CreateHTTPRequest(k_EHTTPMethodGET, apiUrl);
    if (!PrepareRequest(request, token, ACTION_LONG_POLL_TIMEOUT)) {
        CloseRequest(request);
        return;
    }
    if (!SteamWorks_SetHTTPCallbacks(request, OnActionsComplete)) {
        LogError("[ThRei_Players] Could not set action poll callbacks.");
        CloseRequest(request);
        return;
    }

    g_hActionRequest = request;
    if (!SteamWorks_SendHTTPRequest(request)) {
        LogError("[ThRei_Players] Could not send action poll request.");
        if (g_hActionRequest == request) {
            g_hActionRequest = null;
            CloseHandle(request);
        }
    }
}

void SendNextAck() {
    if (g_aAckQueue == null || g_aAckQueue.Length == 0) {
        return;
    }

    char reportUrl[512];
    char baseUrl[512];
    char serverId[128];
    char token[256];
    if (!ResolveConfig(reportUrl, sizeof(reportUrl), serverId, sizeof(serverId), token,
            sizeof(token))) {
        g_aAckQueue.Clear();
        return;
    }
    if (!BuildControlUrl(reportUrl, "/plugin/actions", baseUrl, sizeof(baseUrl))) {
        g_aAckQueue.Clear();
        return;
    }

    char id[64];
    g_aAckQueue.GetString(0, id, sizeof(id));
    g_aAckQueue.Erase(0);
    if (id[0] == '\0') {
        return;
    }

    char url[768];
    Format(url, sizeof(url), "%s/%s/ack", baseUrl, id);
    Handle request = SteamWorks_CreateHTTPRequest(k_EHTTPMethodPOST, url);
    if (!PrepareRequest(request, token)) {
        CloseRequest(request);
        return;
    }
    if (!SteamWorks_SetHTTPCallbacks(request, OnAckComplete)) {
        LogError("[ThRei_Players] Could not set action ack callbacks.");
        CloseRequest(request);
        return;
    }

    g_hAckRequest = request;
    if (!SteamWorks_SendHTTPRequest(request)) {
        LogError("[ThRei_Players] Could not send action ack.");
        if (g_hAckRequest == request) {
            g_hAckRequest = null;
            CloseHandle(request);
        }
    }
}

void SendNextBanReport() {
    if (g_hBanReportRequest != null || g_aBanReportQueue == null
            || g_aBanReportQueue.Length == 0 || g_aBanReportKinds == null
            || g_aBanReportKinds.Length == 0) {
        return;
    }
    if (GetGameTime() < g_fNextBanReport) {
        return;
    }
    if (!SteamWorks_IsLoaded()) {
        if (!g_bSteamWorksWarned) {
            LogError("[ThRei_Players] SteamWorks extension is not loaded; ban reports will retry.");
            g_bSteamWorksWarned = true;
        }
        g_fNextBanReport = GetGameTime() + 30.0;
        return;
    }
    g_bSteamWorksWarned = false;

    char reportUrl[512];
    char apiUrl[512];
    char serverId[128];
    char token[256];
    if (!ResolveConfig(reportUrl, sizeof(reportUrl), serverId, sizeof(serverId), token,
            sizeof(token))) {
        g_fNextBanReport = GetGameTime() + 60.0;
        return;
    }

    int kind = g_aBanReportKinds.Get(0);
    char endpoint[32];
    if (kind == 2) {
        strcopy(endpoint, sizeof(endpoint), "/plugin/ip-ban-report");
    } else {
        strcopy(endpoint, sizeof(endpoint), "/plugin/ban-report");
    }
    if (!BuildControlUrl(reportUrl, endpoint, apiUrl, sizeof(apiUrl))) {
        g_fNextBanReport = GetGameTime() + 60.0;
        return;
    }

    char body[BAN_REPORT_BODY_SIZE];
    g_aBanReportQueue.GetString(0, body, sizeof(body));
    if (body[0] == '\0') {
        g_aBanReportQueue.Erase(0);
        g_aBanReportKinds.Erase(0);
        return;
    }

    Handle request = SteamWorks_CreateHTTPRequest(k_EHTTPMethodPOST, apiUrl);
    if (!PrepareRequest(request, token)) {
        CloseRequest(request);
        g_fNextBanReport = GetGameTime() + 15.0;
        return;
    }
    if (!SteamWorks_SetHTTPRequestRawPostBody(request, "application/json", body,
            strlen(body))) {
        LogError("[ThRei_Players] Could not set the ban report body.");
        CloseRequest(request);
        g_fNextBanReport = GetGameTime() + 30.0;
        return;
    }
    if (!SteamWorks_SetHTTPCallbacks(request, OnBanReportComplete)) {
        LogError("[ThRei_Players] Could not set ban report callbacks.");
        CloseRequest(request);
        g_fNextBanReport = GetGameTime() + 30.0;
        return;
    }

    g_hBanReportRequest = request;
    if (!SteamWorks_SendHTTPRequest(request)) {
        LogError("[ThRei_Players] Could not send the ban report; will retry.");
        if (g_hBanReportRequest == request) {
            g_hBanReportRequest = null;
            CloseHandle(request);
        }
        g_fNextBanReport = GetGameTime() + 15.0;
    }
}

void QueueBanReport(int kind, const char[] body) {
    if (g_aBanReportQueue == null || g_aBanReportKinds == null) {
        return;
    }
    if (g_aBanReportQueue.Length >= MAX_ACK_QUEUE) {
        LogError("[ThRei_Players] Ban report queue is full; dropping report.");
        return;
    }
    g_aBanReportQueue.PushString(body);
    g_aBanReportKinds.Push(kind);
    g_fNextBanReport = 0.0;
    LogMessage("[ThRei_Players] Queued ban report (kind=%d, pending=%d).", kind,
        g_aBanReportQueue.Length);
    if (g_hBanReportRequest == null) {
        SendNextBanReport();
    }
}

bool BuildBody(const char[] serverId, int skipUserId) {
    char map[MAX_NAME_LENGTH];
    char mapJson[1024];
    char serverName[MAX_SERVER_NAME_LENGTH];
    char serverNameJson[FRAGMENT_BUFFER_SIZE];

    GetCurrentMap(map, sizeof(map));
    JsonEscape(map, mapJson, sizeof(mapJson));

    ConVar hostname = FindConVar("hostname");
    if (hostname != null) {
        GetConVarString(hostname, serverName, sizeof(serverName));
    } else {
        serverName[0] = '\0';
    }
    TrimString(serverName);
    JsonEscape(serverName, serverNameJson, sizeof(serverNameJson));

    int maxPlayers = GetMaxHumanPlayers();
    if (maxPlayers < 1) {
        maxPlayers = MaxClients;
    }
    if (maxPlayers < 1) {
        maxPlayers = 1;
    } else if (maxPlayers > MAX_REPORT_PLAYERS) {
        maxPlayers = MAX_REPORT_PLAYERS;
    }

    if (serverId[0] != '\0') {
        char serverIdJson[512];
        JsonEscape(serverId, serverIdJson, sizeof(serverIdJson));
        Format(g_sBody, sizeof(g_sBody),
            "{\"serverId\":\"%s\",\"name\":\"%s\",\"map\":\"%s\",\"maxPlayers\":%d,\"players\":[",
            serverIdJson, serverNameJson, mapJson, maxPlayers);
    } else {
        // Without serverId the API resolves the server from the unique token.
        Format(g_sBody, sizeof(g_sBody),
            "{\"name\":\"%s\",\"map\":\"%s\",\"maxPlayers\":%d,\"players\":[",
            serverNameJson, mapJson, maxPlayers);
    }

    int reported = 0;
    int maxClients = MaxClients;
    if (maxClients > MAX_REPORT_PLAYERS) {
        maxClients = MAX_REPORT_PLAYERS;
    }

    for (int client = 1; client <= maxClients; client++) {
        if (!IsClientInGame(client) || IsFakeClient(client)
                || IsClientSourceTV(client) || IsClientReplay(client)) {
            continue;
        }
        if (skipUserId > 0 && GetClientUserId(client) == skipUserId) {
            continue;
        }

        char steamId[MAX_AUTHID_LENGTH];
        if (!GetClientAuthId(client, AuthId_SteamID64, steamId, sizeof(steamId), true)) {
            continue;
        }
        if (strlen(steamId) != 17) {
            continue;
        }

        char name[MAX_NAME_LENGTH];
        char nameJson[FRAGMENT_BUFFER_SIZE];
        char ip[64];
        char ipJson[256];
        char fragment[FRAGMENT_BUFFER_SIZE];
        GetClientName(client, name, sizeof(name));
        JsonEscape(name, nameJson, sizeof(nameJson));
        ip[0] = '\0';
        GetClientIP(client, ip, sizeof(ip), true);
        JsonEscape(ip, ipJson, sizeof(ipJson));

        int connectedSeconds = RoundToFloor(GetClientTime(client));
        if (connectedSeconds < 0) {
            connectedSeconds = 0;
        }

        Format(fragment, sizeof(fragment),
            "%s{\"steamId64\":\"%s\",\"name\":\"%s\",\"ipAddress\":\"%s\","
            ... "\"connectedSeconds\":%d}",
            reported > 0 ? "," : "", steamId, nameJson, ipJson, connectedSeconds);
        if (!AppendText(g_sBody, sizeof(g_sBody), fragment)) {
            LogError("[ThRei_Players] Report body is too large; aborting report.");
            return false;
        }
        reported++;
    }

    if (!AppendText(g_sBody, sizeof(g_sBody), "]}")) {
        LogError("[ThRei_Players] Report body is too large; aborting report.");
        return false;
    }
    return true;
}

public void OnReportComplete(Handle request, bool failure, bool requestSuccessful,
        EHTTPStatusCode statusCode) {
    if (g_hReportRequest == request) {
        g_hReportRequest = null;
    }

    if (failure || !requestSuccessful) {
        LogError("[ThRei_Players] Report failed: network error or timeout.");
    } else if (statusCode != k_EHTTPStatusCode200OK) {
        LogHttpStatus("report", request, statusCode);
    }

    CloseHandle(request);
}

public void OnBanReportComplete(Handle request, bool failure, bool requestSuccessful,
        EHTTPStatusCode statusCode) {
    if (g_hBanReportRequest == request) {
        g_hBanReportRequest = null;
    }

    bool success = !failure && requestSuccessful
        && (statusCode == k_EHTTPStatusCode204NoContent
            || statusCode == k_EHTTPStatusCode200OK);
    if (success) {
        if (g_aBanReportQueue != null && g_aBanReportQueue.Length > 0) {
            g_aBanReportQueue.Erase(0);
        }
        if (g_aBanReportKinds != null && g_aBanReportKinds.Length > 0) {
            g_aBanReportKinds.Erase(0);
        }
        g_iBanReportFailures = 0;
        g_fNextBanReport = 0.0;
    } else {
        int code = view_as<int>(statusCode);
        bool permanent = code >= 400 && code < 500
            && code != 408 && code != 429;
        if (permanent) {
            // A malformed payload / bad token / unknown route cannot succeed
            // by retrying; drop it so later reports are not blocked. The
            // local SourceMod ban is already in effect.
            LogHttpStatus("ban report", request, statusCode);
            LogError("[ThRei_Players] Ban report rejected with HTTP %d; dropping it.",
                code);
            if (g_aBanReportQueue != null && g_aBanReportQueue.Length > 0) {
                g_aBanReportQueue.Erase(0);
            }
            if (g_aBanReportKinds != null && g_aBanReportKinds.Length > 0) {
                g_aBanReportKinds.Erase(0);
            }
            g_iBanReportFailures = 0;
            g_fNextBanReport = 0.0;
        } else {
            g_iBanReportFailures++;
            g_fNextBanReport = GetGameTime()
                + BackoffDelay(15, g_iBanReportFailures);
            if (failure || !requestSuccessful) {
                LogError("[ThRei_Players] Ban report failed; will retry.");
            } else {
                LogHttpStatus("ban report", request, statusCode);
            }
        }
    }

    CloseHandle(request);

    if (g_aBanReportQueue != null && g_aBanReportQueue.Length > 0) {
        SendNextBanReport();
    }
}

public void OnUnbanReportComplete(Handle request, bool failure, bool requestSuccessful,
        EHTTPStatusCode statusCode) {
    if (g_hUnbanRequest == request) {
        g_hUnbanRequest = null;
    }
    int client = g_iUnbanClientUserId > 0 ? GetClientOfUserId(g_iUnbanClientUserId) : 0;

    bool success = !failure && requestSuccessful
        && (statusCode == k_EHTTPStatusCode204NoContent
            || statusCode == k_EHTTPStatusCode200OK);
    if (success) {
        if (g_bUnbanIsIp) {
            if (!RemoveBan(g_sUnbanIp, BANFLAG_IP, "threi_unbanip", 0)) {
                LogError("[ThRei_Players] Could not remove local IP ban for %s.",
                    g_sUnbanIp);
            }
        } else {
            g_smBans.Remove(g_sUnbanSteamId);
            g_smBanReasons.Remove(g_sUnbanSteamId);
            char steamId2[64];
            BuildSteamId2From64(g_sUnbanSteamId, steamId2, sizeof(steamId2));
            if (!RemoveBan(steamId2, BANFLAG_AUTHID, "threi_unban", 0)) {
                LogError("[ThRei_Players] Could not remove local ban for %s.",
                    g_sUnbanSteamId);
            }
        }
        ReplyToCommand(client, "[ThRei] 已解封并同步网站。");
        if (g_bUnbanIsIp) {
            LogMessage("[ThRei_Players] Website unban synced for IP %s.", g_sUnbanIp);
        } else {
            LogMessage("[ThRei_Players] Website unban synced for %s.", g_sUnbanSteamId);
        }
    } else if (statusCode == k_EHTTPStatusCode409Conflict) {
        ReplyToCommand(client, "[ThRei] 网站仍存在管理员封禁，未在本地解封。");
        LogMessage("[ThRei_Players] Unban refused: an administrator ban is still active.");
    } else if (failure || !requestSuccessful) {
        ReplyToCommand(client, "[ThRei] 网站解封失败，本地封禁保持不变。");
        LogError("[ThRei_Players] Unban report failed: network error or timeout.");
    } else {
        ReplyToCommand(client, "[ThRei] 网站解封失败，本地封禁保持不变。");
        LogHttpStatus("unban report", request, statusCode);
    }

    CloseHandle(request);
    g_iUnbanClientUserId = 0;
    g_bUnbanIsIp = false;
    g_sUnbanSteamId[0] = '\0';
    g_sUnbanIp[0] = '\0';
}

public void OnAccessComplete(Handle request, bool failure, bool requestSuccessful,
        EHTTPStatusCode statusCode) {
    if (g_hAccessRequest == request) {
        g_hAccessRequest = null;
    }

    if (failure || !requestSuccessful || statusCode != k_EHTTPStatusCode200OK) {
        g_iAccessFailures++;
        g_fNextAccess = GetGameTime() + BackoffDelay(g_cvAccessInterval.IntValue,
            g_iAccessFailures);
        if (failure || !requestSuccessful) {
            LogError("[ThRei_Players] Access snapshot failed: network error or timeout.");
        } else {
            LogHttpStatus("access snapshot", request, statusCode);
        }
        CloseHandle(request);
        return;
    }

    int size = 0;
    if (!SteamWorks_GetHTTPResponseBodySize(request, size) || size <= 0
            || size > ACCESS_BODY_MAX) {
        LogError("[ThRei_Players] Access snapshot body is missing or too large.");
        g_iAccessFailures++;
        g_fNextAccess = GetGameTime() + BackoffDelay(g_cvAccessInterval.IntValue,
            g_iAccessFailures);
        CloseHandle(request);
        return;
    }

    char[] body = new char[size + 1];
    bool read = SteamWorks_GetHTTPResponseBodyData(request, body, size);
    if (!read) {
        LogError("[ThRei_Players] Could not read access snapshot body.");
        g_iAccessFailures++;
        g_fNextAccess = GetGameTime() + BackoffDelay(g_cvAccessInterval.IntValue,
            g_iAccessFailures);
        CloseHandle(request);
        return;
    }
    body[size] = '\0';

    bool loaded = ParseAccessSnapshot(body);
    if (!loaded) {
        LogError("[ThRei_Players] Access snapshot format was not recognized.");
        g_iAccessFailures++;
        g_fNextAccess = GetGameTime() + BackoffDelay(g_cvAccessInterval.IntValue,
            g_iAccessFailures);
        CloseHandle(request);
        return;
    }

    bool firstLoad = !g_bAccessLoaded;
    g_bAccessLoaded = true;
    g_iAccessFailures = 0;
    g_fNextAccess = GetGameTime() + float(g_cvAccessInterval.IntValue);
    if (firstLoad) {
        LogMessage("[ThRei_Players] Access snapshot loaded: whitelist=%d bans=%d required=%d.",
            g_smWhitelist.Size, g_smBans.Size, g_bAccessRequired);
    }

    for (int client = 1; client <= MaxClients; client++) {
        if (IsClientInGame(client) && !IsFakeClient(client) && IsClientAuthorized(client)) {
            CheckClientAccess(client);
        }
    }
    CloseHandle(request);
}

public void OnActionsComplete(Handle request, bool failure, bool requestSuccessful,
        EHTTPStatusCode statusCode) {
    if (g_hActionRequest == request) {
        g_hActionRequest = null;
    }

    if (failure || !requestSuccessful || statusCode != k_EHTTPStatusCode200OK) {
        g_iActionFailures++;
        g_fNextActions = GetGameTime() + BackoffDelay(g_cvActionsInterval.IntValue,
            g_iActionFailures);
        if (failure || !requestSuccessful) {
            LogError("[ThRei_Players] Action poll failed: network error or timeout.");
        } else {
            LogHttpStatus("action poll", request, statusCode);
        }
        CloseHandle(request);
        return;
    }

    int size = 0;
    if (!SteamWorks_GetHTTPResponseBodySize(request, size) || size <= 0
            || size > ACTION_BODY_MAX) {
        g_iActionFailures++;
        g_fNextActions = GetGameTime() + BackoffDelay(g_cvActionsInterval.IntValue,
            g_iActionFailures);
        CloseHandle(request);
        return;
    }

    char[] body = new char[size + 1];
    if (!SteamWorks_GetHTTPResponseBodyData(request, body, size)) {
        LogError("[ThRei_Players] Could not read action poll body.");
        CloseHandle(request);
        return;
    }
    body[size] = '\0';

    ParseAndExecuteActions(body);
    g_iActionFailures = 0;
    g_fNextActions = GetGameTime() + ACTION_REPOLL_DELAY;
    CloseHandle(request);
}

public void OnAckComplete(Handle request, bool failure, bool requestSuccessful,
        EHTTPStatusCode statusCode) {
    if (g_hAckRequest == request) {
        g_hAckRequest = null;
    }
    if (failure || !requestSuccessful) {
        LogError("[ThRei_Players] Action ack failed: network error or timeout.");
    } else if (statusCode != k_EHTTPStatusCode204NoContent
            && statusCode != k_EHTTPStatusCode200OK) {
        LogHttpStatus("action ack", request, statusCode);
    }
    CloseHandle(request);
}

void LogHttpStatus(const char[] label, Handle request, EHTTPStatusCode statusCode) {
    int size = 0;
    if (SteamWorks_GetHTTPResponseBodySize(request, size) && size > 0
            && size <= ERROR_BODY_SIZE) {
        if (SteamWorks_GetHTTPResponseBodyData(request, g_sErrorBody, size)) {
            g_sErrorBody[size] = '\0';
            ReplaceString(g_sErrorBody, sizeof(g_sErrorBody), "\n", " ");
            LogError("[ThRei_Players] %s returned HTTP %d: %s", label, statusCode,
                g_sErrorBody);
            return;
        }
    }
    LogError("[ThRei_Players] %s returned HTTP %d.", label, statusCode);
}

float BackoffDelay(int baseSeconds, int failures) {
    if (baseSeconds < 1) {
        baseSeconds = 1;
    }
    if (failures < 1) {
        failures = 1;
    }
    int delay = baseSeconds * (failures + 1);
    if (delay > 300) {
        delay = 300;
    }
    return float(delay);
}

bool ParseAccessSnapshot(const char[] body) {
    if (StrContains(body, "# ThRei access snapshot v1") == -1) {
        return false;
    }

    StringMap whitelist = new StringMap();
    StringMap bans = new StringMap();
    StringMap banReasons = new StringMap();
    bool sawRequirements = false;
    bool requiresWhitelist = false;

    char line[MAX_ACTION_LINE];
    int position = 0;
    int bodyLength = strlen(body);
    while (ReadLine(body, bodyLength, position, line, sizeof(line))) {
        TrimString(line);
        if (line[0] == '\0' || line[0] == '#') {
            continue;
        }

        if (StartsWith(line, "requires_whitelist ")) {
            char value[8];
            strcopy(value, sizeof(value), line[19]);
            TrimString(value);
            requiresWhitelist = StringToInt(value) != 0;
            sawRequirements = true;
            continue;
        }
        if (StartsWith(line, "whitelist ")) {
            char steamId[32];
            strcopy(steamId, sizeof(steamId), line[10]);
            TrimString(steamId);
            if (IsSteamId64(steamId)) {
                whitelist.SetValue(steamId, 1, true);
            }
            continue;
        }
        if (StartsWith(line, "ban ")) {
            ParseBanLine(line, bans, banReasons);
        }
    }

    if (!sawRequirements) {
        delete whitelist;
        delete bans;
        delete banReasons;
        return false;
    }

    if (g_smWhitelist != null) {
        delete g_smWhitelist;
    }
    if (g_smBans != null) {
        delete g_smBans;
    }
    if (g_smBanReasons != null) {
        delete g_smBanReasons;
    }
    g_smWhitelist = whitelist;
    g_smBans = bans;
    g_smBanReasons = banReasons;
    g_bAccessRequired = requiresWhitelist;
    return true;
}

void ParseBanLine(const char[] line, StringMap bans, StringMap banReasons) {
    char rest[MAX_ACTION_LINE];
    strcopy(rest, sizeof(rest), line[4]);

    int position = 0;
    char steamId[32];
    char expiryText[32];
    if (!NextToken(rest, position, steamId, sizeof(steamId))) {
        return;
    }
    if (!NextToken(rest, position, expiryText, sizeof(expiryText))) {
        return;
    }
    if (!IsSteamId64(steamId)) {
        return;
    }

    char reason[MAX_REASON_LENGTH];
    CopyRest(rest, position, reason, sizeof(reason));
    int expiresAt = StringToInt(expiryText);
    if (expiresAt > 0 && expiresAt <= GetTime()) {
        return;
    }

    bans.SetValue(steamId, expiresAt, true);
    banReasons.SetString(steamId, reason, true);
}

void ParseAndExecuteActions(const char[] body) {
    if (StrContains(body, "# ThRei actions v1") == -1) {
        return;
    }

    int executed = 0;
    char line[MAX_ACTION_LINE];
    int position = 0;
    int bodyLength = strlen(body);
    while (ReadLine(body, bodyLength, position, line, sizeof(line))) {
        TrimString(line);
        if (!StartsWith(line, "action ")) {
            continue;
        }

        char rest[MAX_ACTION_LINE];
        strcopy(rest, sizeof(rest), line[7]);
        int cursor = 0;
        char id[64];
        char action[16];
        char steamId[32];
        if (!NextToken(rest, cursor, id, sizeof(id))
                || !NextToken(rest, cursor, action, sizeof(action))
                || !NextToken(rest, cursor, steamId, sizeof(steamId))) {
            continue;
        }
        if (id[0] == '\0' || !IsSteamId64(steamId)) {
            continue;
        }

        char reason[MAX_REASON_LENGTH];
        if (StrEqual(action, "kick")) {
            CopyRest(rest, cursor, reason, sizeof(reason));
            ExecuteKickAction(steamId, reason);
        } else if (StrEqual(action, "ban")) {
            char expiryText[32];
            if (!NextToken(rest, cursor, expiryText, sizeof(expiryText))) {
                continue;
            }
            CopyRest(rest, cursor, reason, sizeof(reason));
            ExecuteBanAction(steamId, StringToInt(expiryText), reason);
        } else if (StrEqual(action, "unban")) {
            CopyRest(rest, cursor, reason, sizeof(reason));
            ExecuteUnbanAction(steamId, reason);
        } else {
            // Acknowledge unsupported actions so a newer API action cannot
            // remain at the head of the queue forever.
            if (g_aAckQueue.Length < MAX_ACK_QUEUE) {
                g_aAckQueue.PushString(id);
            }
            continue;
        }

        // Expired bans are still acknowledged: the plugin checked the database
        // expiry and there is nothing left to do.
        if (g_aAckQueue.Length < MAX_ACK_QUEUE) {
            g_aAckQueue.PushString(id);
        }
        executed++;
    }

    if (executed > 0) {
        LogMessage("[ThRei_Players] Processed %d website action(s).", executed);
    }
}

void ExecuteKickAction(const char[] steamId, const char[] reason) {
    int target = FindClientBySteamId(steamId);
    if (target <= 0) {
        return;
    }

    char message[256];
    if (reason[0] != '\0') {
        Format(message, sizeof(message), "管理员踢出：%s", reason);
    } else {
        strcopy(message, sizeof(message), "管理员踢出。");
    }
    KickClient(target, "%s", message);
}

void ExecuteBanAction(const char[] steamId, int expiresAt, const char[] reason) {
    // The action may race with an unban or a short ban expiring before this
    // poll. A zero expiry means permanent.
    if (expiresAt > 0 && expiresAt <= GetTime()) {
        return;
    }

    // Persist website-issued bans in the local SourceMod ban list too. This
    // keeps them effective across plugin reloads and API outages; the website
    // unban action removes the same identity.
    int minutes = 0;
    if (expiresAt > 0) {
        int remaining = expiresAt - GetTime();
        minutes = (remaining + 59) / 60;
        if (minutes < 1) {
            minutes = 1;
        }
    }
    char steamId2[64];
    BuildSteamId2From64(steamId, steamId2, sizeof(steamId2));
    if (!BanIdentity(steamId2, minutes, BANFLAG_AUTHID, reason, "threi_website_ban", 0)) {
        LogError("[ThRei_Players] Could not write local ban for website action %s.", steamId);
    }

    // Cache the ban immediately so a reconnect cannot slip through before the
    // next access snapshot arrives. The snapshot will replace this entry with
    // the authoritative expiry/reason from the database.
    g_smBans.SetValue(steamId, expiresAt, true);
    g_smBanReasons.SetString(steamId, reason, true);

    int target = FindClientBySteamId(steamId);
    if (target > 0) {
        KickForBan(target, steamId, reason);
    }
}

void ExecuteUnbanAction(const char[] steamId, const char[] reason) {
    // Drop the website-enforced cache immediately so a reconnect cannot be
    // blocked before the next access snapshot arrives.
    g_smBans.Remove(steamId);
    g_smBanReasons.Remove(steamId);

    // RemoveBan(BANFLAG_AUTHID) issues the engine `removeid` command. Convert
    // SteamID64 to SteamID2 because basebans' numeric-argument handling treats
    // a raw SteamID64 as an IP address.
    char steamId2[64];
    BuildSteamId2From64(steamId, steamId2, sizeof(steamId2));
    if (!RemoveBan(steamId2, BANFLAG_AUTHID, "threi_unban", 0)) {
        LogError("[ThRei_Players] Could not remove the local ban for %s.", steamId);
        return;
    }

    if (reason[0] != '\0') {
        LogMessage("[ThRei_Players] Removed local ban for %s (%s).", steamId, reason);
    } else {
        LogMessage("[ThRei_Players] Removed local ban for %s.", steamId);
    }
}

/**
 * Converts an individual SteamID64 (7656119...) to STEAM_1:Y:Z so the engine's
 * `removeid` command can match its stored ban identity.
 */
void BuildSteamId2From64(const char[] steamId64, char[] output, int maxLength) {
    int parts[2];
    if (StringToInt64(steamId64, parts) == 17
            && parts[1] == 0x1100001
            && parts[0] >= 0) {
        Format(output, maxLength, "STEAM_1:%d:%d", parts[0] & 1, parts[0] / 2);
        return;
    }
    strcopy(output, maxLength, steamId64);
}

int FindClientBySteamId(const char[] steamId) {
    for (int client = 1; client <= MaxClients; client++) {
        if (!IsClientInGame(client) || IsFakeClient(client)
                || IsClientSourceTV(client) || IsClientReplay(client)) {
            continue;
        }
        char current[32];
        if (GetClientAuthId(client, AuthId_SteamID64, current, sizeof(current), true)
                && StrEqual(current, steamId)) {
            return client;
        }
    }
    return 0;
}

void CheckClientAccess(int client) {
    if (!g_cvAccessEnabled.BoolValue || IsFakeClient(client)
            || IsClientSourceTV(client) || IsClientReplay(client)) {
        return;
    }
    if (!IsClientInGame(client) || !IsClientAuthorized(client)) {
        return;
    }

    char steamId[32];
    if (!GetClientAuthId(client, AuthId_SteamID64, steamId, sizeof(steamId), true)
            || !IsSteamId64(steamId)) {
        return;
    }

    if (!g_bAccessLoaded) {
        if (!g_cvAccessFailOpen.BoolValue) {
            KickForWhitelist(client, true);
        }
        return;
    }

    int expiresAt = 0;
    if (g_smBans.GetValue(steamId, expiresAt) && (expiresAt == 0 || expiresAt > GetTime())) {
        KickForBan(client, steamId, "");
        return;
    }

    if (!g_bAccessRequired) {
        return;
    }

    int listed = 0;
    if (!g_smWhitelist.GetValue(steamId, listed)) {
        KickForWhitelist(client, false);
    }
}

void KickForWhitelist(int client, bool unavailable) {
    char message[256];
    GetConVarString(g_cvWhitelistKickMessage, message, sizeof(message));
    if (unavailable && message[0] == '\0') {
        strcopy(message, sizeof(message), "白名单数据尚未加载，请稍后重试。");
    }
    KickClient(client, "%s", message);
}

void KickForBan(int client, const char[] steamId, const char[] actionReason) {
    char reason[MAX_REASON_LENGTH];
    reason[0] = '\0';
    if (actionReason[0] != '\0') {
        strcopy(reason, sizeof(reason), actionReason);
    } else if (g_smBanReasons != null) {
        g_smBanReasons.GetString(steamId, reason, sizeof(reason));
    }

    char base[256];
    GetConVarString(g_cvBanKickMessage, base, sizeof(base));
    if (base[0] == '\0') {
        strcopy(base, sizeof(base), "你已被该服务器封禁。");
    }

    char message[512];
    if (reason[0] != '\0') {
        Format(message, sizeof(message), "%s（%s）", base, reason);
    } else {
        strcopy(message, sizeof(message), base);
    }
    KickClient(client, "%s", message);
}

bool IsSteamId64(const char[] value) {
    if (strlen(value) != 17) {
        return false;
    }
    for (int index = 0; index < 17; index++) {
        if (value[index] < '0' || value[index] > '9') {
            return false;
        }
    }
    return true;
}

bool StartsWith(const char[] value, const char[] prefix) {
    int prefixLength = strlen(prefix);
    return strncmp(value, prefix, prefixLength, false) == 0;
}

bool ReadLine(const char[] text, int length, int &position, char[] output, int maxLength) {
    if (position >= length) {
        return false;
    }

    int start = position;
    while (position < length && text[position] != '\n') {
        position++;
    }
    int end = position;
    if (position < length) {
        position++;
    }
    if (end > start && text[end - 1] == '\r') {
        end--;
    }

    int outputLength = end - start;
    if (outputLength >= maxLength) {
        outputLength = maxLength - 1;
    }
    for (int index = 0; index < outputLength; index++) {
        output[index] = text[start + index];
    }
    output[outputLength] = '\0';
    return true;
}

bool NextToken(const char[] input, int &position, char[] output, int maxLength) {
    int length = strlen(input);
    while (position < length && (input[position] == ' ' || input[position] == '\t')) {
        position++;
    }
    if (position >= length) {
        output[0] = '\0';
        return false;
    }

    int start = position;
    while (position < length && input[position] != ' ' && input[position] != '\t') {
        position++;
    }
    int outputLength = position - start;
    if (outputLength >= maxLength) {
        outputLength = maxLength - 1;
    }
    for (int index = 0; index < outputLength; index++) {
        output[index] = input[start + index];
    }
    output[outputLength] = '\0';
    return true;
}

void CopyRest(const char[] input, int position, char[] output, int maxLength) {
    int length = strlen(input);
    while (position < length && (input[position] == ' ' || input[position] == '\t')) {
        position++;
    }

    int outputLength = length - position;
    if (outputLength < 0) {
        outputLength = 0;
    }
    if (outputLength >= maxLength) {
        outputLength = maxLength - 1;
    }
    for (int index = 0; index < outputLength; index++) {
        output[index] = input[position + index];
    }
    output[outputLength] = '\0';
    TrimString(output);
}

void JsonEscape(const char[] input, char[] output, int maxLength) {
    int length = strlen(input);
    int position = 0;

    for (int index = 0; index < length; index++) {
        // SourcePawn chars are signed; mask so UTF-8 bytes stay above 0x1F.
        int character = input[index] & 0xFF;
        if (character == '"' || character == '\\') {
            if (position + 2 >= maxLength) {
                break;
            }
            output[position++] = '\\';
            output[position++] = view_as<char>(character);
        } else if (character == '\n') {
            if (position + 2 >= maxLength) {
                break;
            }
            output[position++] = '\\';
            output[position++] = 'n';
        } else if (character == '\r') {
            if (position + 2 >= maxLength) {
                break;
            }
            output[position++] = '\\';
            output[position++] = 'r';
        } else if (character == '\t') {
            if (position + 2 >= maxLength) {
                break;
            }
            output[position++] = '\\';
            output[position++] = 't';
        } else if (character < 0x20 || character == 0x7F) {
            if (position + 6 >= maxLength) {
                break;
            }
            static const char hex[] = "0123456789abcdef";
            output[position++] = '\\';
            output[position++] = 'u';
            output[position++] = '0';
            output[position++] = '0';
            output[position++] = hex[(character >> 4) & 0xF];
            output[position++] = hex[character & 0xF];
        } else {
            if (position + 1 >= maxLength) {
                break;
            }
            output[position++] = view_as<char>(character);
        }
    }
    output[position] = '\0';
}

bool AppendText(char[] buffer, int maxLength, const char[] text) {
    int used = strlen(buffer);
    int needed = strlen(text);
    if (used + needed >= maxLength) {
        return false;
    }
    StrCat(buffer, maxLength, text);
    return true;
}
