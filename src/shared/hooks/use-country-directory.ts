"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { apiRequest } from "@/shared/lib/api";
import { getSelectableCountries } from "@/shared/lib/countries";
import { queryKeys } from "@/shared/lib/query-keys";
import type { Country, PaginatedResponse } from "@/shared/types/entities";

export type CountryDirectoryScope = "staff" | "client";

const COUNTRY_DIRECTORY_QUERY = {
  page: 1,
  page_size: 300,
  sort_by: "name_en",
  sort_desc: false,
} as const;

export function useCountryDirectory(scope: CountryDirectoryScope = "staff") {
  const query = useQuery({
    queryKey: queryKeys.countries.options(scope),
    queryFn: () =>
      apiRequest<PaginatedResponse<Country>>(scope === "client" ? "/api/client/countries" : "/api/countries", {
        query: COUNTRY_DIRECTORY_QUERY,
      }),
    staleTime: 5 * 60_000,
  });

  const countries = useMemo(() => getSelectableCountries(query.data?.items ?? []), [query.data?.items]);

  return {
    ...query,
    countries,
  };
}
