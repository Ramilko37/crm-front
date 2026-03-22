export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  users: {
    me: ["users", "me"] as const,
    list: (params: unknown) => ["users", "list", params] as const,
    detail: (id: number) => ["users", "detail", id] as const,
  },
  orders: {
    list: (params: unknown) => ["orders", "list", params] as const,
    detail: (id: number) => ["orders", "detail", id] as const,
  },
  factories: {
    list: (params: unknown) => ["factories", "list", params] as const,
    detail: (id: number) => ["factories", "detail", id] as const,
    emails: (factoryId: number) => ["factories", "emails", factoryId] as const,
    certificates: (factoryId: number) => ["factories", "certificates", factoryId] as const,
  },
  trips: {
    list: (params: unknown) => ["trips", "list", params] as const,
    detail: (id: number) => ["trips", "detail", id] as const,
  },
  pathPoints: {
    list: (params: unknown) => ["path-points", "list", params] as const,
    detail: (id: number) => ["path-points", "detail", id] as const,
  },
  countries: {
    list: (params: unknown) => ["countries", "list", params] as const,
    detail: (id: number) => ["countries", "detail", id] as const,
  },
  normativeDocuments: {
    list: (params: unknown) => ["normative-documents", "list", params] as const,
    detail: (id: number) => ["normative-documents", "detail", id] as const,
  },
  emailTemplates: {
    list: (params: unknown) => ["email-templates", "list", params] as const,
    detail: (id: number) => ["email-templates", "detail", id] as const,
  },
};
