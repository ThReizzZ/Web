import { z } from "zod";

export const categorySlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "分类标识只能使用小写字母、数字和连字符");

export const topicIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "帖子标识格式无效");

export const forumSearchParamsSchema = z.object({
  q: z.string().trim().max(120).optional(),
});
