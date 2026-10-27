-- Website lifts of server bans now enqueue an explicit unban action so the
-- game server can remove the local SourceMod/engine ban created by sm_ban.
ALTER TABLE server_actions DROP CONSTRAINT IF EXISTS server_actions_action_check;
ALTER TABLE server_actions ADD CONSTRAINT server_actions_action_check
    CHECK (action IN ('kick', 'ban', 'unban'));
