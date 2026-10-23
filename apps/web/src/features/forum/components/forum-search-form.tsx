"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({
  q: z.string().trim().max(120, "关键词不能超过 120 个字符"),
});

type SearchValues = z.infer<typeof searchSchema>;

export function ForumSearchForm({ defaultQuery = "" }: { defaultQuery?: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SearchValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: { q: defaultQuery },
  });

  function onSubmit(values: SearchValues) {
    const params = new URLSearchParams();
    if (values.q) {
      params.set("q", values.q);
    }
    router.push(params.size > 0 ? `/forum?${params.toString()}` : "/forum");
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      noValidate
    >
      <div className="flex-1 space-y-2">
        <Label htmlFor="forum-search">搜索主题</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="forum-search"
            type="search"
            placeholder="输入标题关键词"
            className="pl-9"
            aria-invalid={errors.q ? true : undefined}
            aria-describedby={errors.q ? "forum-search-error" : undefined}
            {...register("q")}
          />
        </div>
        {errors.q ? (
          <p id="forum-search-error" className="text-sm text-destructive">
            {errors.q.message}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="submit">
          <Search aria-hidden="true" />
          搜索
        </Button>
        {defaultQuery ? (
          <Button asChild variant="ghost">
            <Link href="/forum" aria-label="清除搜索条件">
              <X aria-hidden="true" />
              清除
            </Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
