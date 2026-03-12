export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  orders: {
    list: (params: unknown) => ["orders", "list", params] as const,
    detail: (id: number) => ["orders", "detail", id] as const,
  },
  factories: {
    list: (params: unknown) => ["factories", "list", params] as const,
    detail: (id: number) => ["factories", "detail", id] as const,
  },
  trips: {
    list: (params: unknown) => ["trips", "list", params] as const,
    detail: (id: number) => ["trips", "detail", id] as const,
  },
};
