"use client";

import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "@/shared/lib/api";
import { queryKeys } from "@/shared/lib/query-keys";
import type { AuthUser } from "@/shared/types/entities";

export function useCurrentUser(enabled = true) {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => apiRequest<AuthUser>("/api/auth/me"),
    enabled,
  });
}
