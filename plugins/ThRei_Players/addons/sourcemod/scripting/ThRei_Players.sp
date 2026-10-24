/**
 * ThRei_Players — reports Source server status and identified players to threi.
 *
 * The plugin posts a JSON snapshot to POST /api/v1/plugin/report using a
 * per-server token. It replaces A2S/RCON polling: the API never connects to
 * the game server.
 *
 * Requirements:
 *   - SourceMod 1.11+
 *   - SteamWorks extension (HTTP client runs through Steam)
 */

#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <SteamWorks>

#define PLUGIN_VERSION "1.0.0"

#define TOKEN_HEADER "X-ThRei-Plugin-Token"
#define MAX_REPORT_PLAYERS 1024
#define BODY_BUFFER_SIZE 131072
#define FRAGMENT_BUFFER_SIZE 2048
#define ERROR_BODY_SIZE 2048

public Plugin myinfo = {
    name = "ThRei_Players",
    author = "threi",
    description = "Reports server status and identified players to threi",
    version = PLUGIN_VERSION,
    url = "https://github.com/XBDJ504764827/threi",
};

ConVar g_cvEnabled;
ConVar g_cvApiUrl;
ConVar g_cvServerId;
ConVar g_cvToken;
ConVar g_cvInterval;

Handle g_hTimer;
Handle g_hRequest;
float g_fNextReport;
bool g_bConfigWarned;
bool g_bSteamWorksWarned;

char g_sBody[BODY_BUFFER_SIZE];
char g_sErrorBody[ERROR_BODY_SIZE + 1];

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
        "Seconds between reports. Player joins, disconnects, and map changes also trigger a report.",
        FCVAR_NONE, true, 5.0, true, 600.0);

    AutoExecConfig(true, "threi_players");

    RegAdminCmd("sm_threi_report", Command_Report, ADMFLAG_ROOT,
        "Send a ThRei_Players report immediately.");
    RegAdminCmd("sm_threi_status", Command_Status, ADMFLAG_ROOT,
        "Show ThRei_Players configuration status without revealing the token.");

    g_fNextReport = GetGameTime() + 5.0;
    g_hTimer = CreateTimer(1.0, Timer_Poll, _, TIMER_REPEAT);
}

public void OnAllPluginsLoaded() {
    if (!SteamWorks_IsLoaded()) {
        LogError("[ThRei_Players] SteamWorks extension is not loaded; reports cannot be sent.");
        g_bSteamWorksWarned = true;
    }
}

public void OnConfigsExecuted() {
    QueueReport(2.0);
}

public void OnMapStart() {
    QueueReport(5.0);
}

public void OnClientPostAdminCheck(int client) {
    QueueReport(1.0);
}

public void OnClientDisconnect(int client) {
    QueueReport(1.0);
}

public void OnPluginEnd() {
    if (g_hTimer != null) {
        KillTimer(g_hTimer);
        g_hTimer = null;
    }
    if (g_hRequest != null) {
        CloseHandle(g_hRequest);
        g_hRequest = null;
    }
}

public Action Timer_Poll(Handle timer) {
    if (g_hRequest != null || !g_cvEnabled.BoolValue) {
        return Plugin_Continue;
    }
    if (GetGameTime() < g_fNextReport) {
        return Plugin_Continue;
    }
    SendReport();
    return Plugin_Continue;
}

public Action Command_Report(int client, int args) {
    if (g_hRequest != null) {
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
    GetConVarString(g_cvServerId, serverId, sizeof(serverId));
    GetConVarString(g_cvToken, token, sizeof(token));

    ReplyToCommand(client, "[ThRei_Players] enabled=%d interval=%d",
        g_cvEnabled.BoolValue, g_cvInterval.IntValue);
    ReplyToCommand(client, "[ThRei_Players] api=%s", apiUrl[0] ? apiUrl : "(not configured)");
    ReplyToCommand(client, "[ThRei_Players] server=%s", serverId[0] ? serverId : "(not configured)");
    ReplyToCommand(client, "[ThRei_Players] token=%s", token[0] ? "configured" : "(not configured)");
    ReplyToCommand(client, "[ThRei_Players] steamworks=%s",
        SteamWorks_IsLoaded() ? "loaded" : "missing");
    return Plugin_Handled;
}

void QueueReport(float delay) {
    float due = GetGameTime() + delay;
    if (g_fNextReport <= 0.0 || due < g_fNextReport) {
        g_fNextReport = due;
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
    GetConVarString(g_cvApiUrl, apiUrl, sizeof(apiUrl));
    GetConVarString(g_cvServerId, serverId, sizeof(serverId));
    GetConVarString(g_cvToken, token, sizeof(token));
    TrimString(apiUrl);
    TrimString(serverId);
    TrimString(token);

    if (apiUrl[0] == '\0' || serverId[0] == '\0' || token[0] == '\0') {
        if (!g_bConfigWarned) {
            LogError("[ThRei_Players] Configuration is incomplete. Set sm_threi_api_url, "
                     ... "sm_threi_server_id and sm_threi_token in cfg/sourcemod/threi_players.cfg.");
            g_bConfigWarned = true;
        }
        return;
    }
    g_bConfigWarned = false;

    if (strncmp(apiUrl, "https://", 8, false) != 0 && strncmp(apiUrl, "http://", 7, false) != 0) {
        LogError("[ThRei_Players] sm_threi_api_url must start with http:// or https://.");
        return;
    }

    if (!BuildBody(serverId)) {
        return;
    }

    Handle request = SteamWorks_CreateHTTPRequest(k_EHTTPMethodPOST, apiUrl);
    if (request == null) {
        LogError("[ThRei_Players] Could not create an HTTP request; is Steam connected?");
        return;
    }

    bool configured = SteamWorks_SetHTTPRequestHeaderValue(request, TOKEN_HEADER, token)
        && SteamWorks_SetHTTPRequestHeaderValue(request, "User-Agent", "ThRei_Players/" ... PLUGIN_VERSION)
        && SteamWorks_SetHTTPRequestNetworkActivityTimeout(request, 15)
        && SteamWorks_SetHTTPRequestRawPostBody(request, "application/json", g_sBody, strlen(g_sBody))
        && SteamWorks_SetHTTPCallbacks(request, OnReportComplete);

    if (!configured) {
        LogError("[ThRei_Players] Could not configure the HTTP request.");
        CloseHandle(request);
        return;
    }

    g_hRequest = request;
    if (!SteamWorks_SendHTTPRequest(request)) {
        LogError("[ThRei_Players] Could not send the HTTP request.");
        if (g_hRequest == request) {
            g_hRequest = null;
            CloseHandle(request);
        }
    }
}

bool BuildBody(const char[] serverId) {
    char serverIdJson[512];
    char map[MAX_NAME_LENGTH];
    char mapJson[1024];

    JsonEscape(serverId, serverIdJson, sizeof(serverIdJson));
    GetCurrentMap(map, sizeof(map));
    JsonEscape(map, mapJson, sizeof(mapJson));

    int maxPlayers = GetMaxHumanPlayers();
    if (maxPlayers < 1) {
        maxPlayers = MaxClients;
    }
    if (maxPlayers < 1) {
        maxPlayers = 1;
    } else if (maxPlayers > MAX_REPORT_PLAYERS) {
        maxPlayers = MAX_REPORT_PLAYERS;
    }

    Format(g_sBody, sizeof(g_sBody),
        "{\"serverId\":\"%s\",\"map\":\"%s\",\"maxPlayers\":%d,\"players\":[",
        serverIdJson, mapJson, maxPlayers);

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

        char steamId[MAX_AUTHID_LENGTH];
        if (!GetClientAuthId(client, AuthId_SteamID64, steamId, sizeof(steamId), true)) {
            continue;
        }
        if (strlen(steamId) != 17) {
            continue;
        }

        char name[MAX_NAME_LENGTH];
        char nameJson[FRAGMENT_BUFFER_SIZE];
        char fragment[FRAGMENT_BUFFER_SIZE];
        GetClientName(client, name, sizeof(name));
        JsonEscape(name, nameJson, sizeof(nameJson));

        int connectedSeconds = RoundToFloor(GetClientTime(client));
        if (connectedSeconds < 0) {
            connectedSeconds = 0;
        }

        Format(fragment, sizeof(fragment),
            "%s{\"steamId64\":\"%s\",\"name\":\"%s\",\"connectedSeconds\":%d}",
            reported > 0 ? "," : "", steamId, nameJson, connectedSeconds);
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
    if (g_hRequest == request) {
        g_hRequest = null;
    }

    if (failure || !requestSuccessful) {
        LogError("[ThRei_Players] Report failed: network error or timeout.");
    } else if (statusCode != k_EHTTPStatusCode200OK) {
        int size = 0;
        if (SteamWorks_GetHTTPResponseBodySize(request, size) && size > 0 && size <= ERROR_BODY_SIZE) {
            if (SteamWorks_GetHTTPResponseBodyData(request, g_sErrorBody, size)) {
                g_sErrorBody[size] = '\0';
                ReplaceString(g_sErrorBody, sizeof(g_sErrorBody), "\n", " ");
                LogError("[ThRei_Players] API returned HTTP %d: %s", statusCode, g_sErrorBody);
            } else {
                LogError("[ThRei_Players] API returned HTTP %d.", statusCode);
            }
        } else {
            LogError("[ThRei_Players] API returned HTTP %d.", statusCode);
        }
    }

    CloseHandle(request);
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
            Format(output[position], maxLength - position, "\\u%04x", character);
            position += 6;
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
