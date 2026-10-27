import { z } from "zod";

const playerIdentifierPattern =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|STEAM_[01]:[01]:\d+|\d{17}|\[?U:\d+:\d+\]?)$/i;

export const playerIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(playerIdentifierPattern, "玩家标识格式无效");

export const playerSearchParamsSchema = z.object({
  q: z.string().trim().max(80).optional(),
});

export function decodePlayerIdentifier(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
