import type { Metadata } from "next";

import { ForumModerationManager } from "@/features/admin/components/forum-moderation-manager";
import { getServerApiClient } from "@/lib/api/server";
import {
  fetchAdminForumReplies,
  fetchAdminForumTopics,
  fetchAdminForumUsers,
  fetchForumCategories,
} from "@/services/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "论坛管理",
  robots: { index: false, follow: false },
};

export default async function AdminForumPage() {
  const client = await getServerApiClient();
  const [topics, replies, users, categories] = await Promise.all([
    fetchAdminForumTopics(client),
    fetchAdminForumReplies(client),
    fetchAdminForumUsers(client),
    fetchForumCategories(client),
  ]);
  return (
    <ForumModerationManager
      topics={topics}
      replies={replies}
      users={users}
      categories={categories}
    />
  );
}
