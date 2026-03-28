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
    documents: (id: number) => ["orders", "documents", id] as const,
    statusHistory: (id: number) => ["orders", "status-history", id] as const,
    chatMessages: (id: number) => ["orders", "chat-messages", id] as const,
    certificate: (id: number) => ["orders", "certificate", id] as const,
    clientMessages: (params: unknown) => ["orders", "client-messages", params] as const,
  },
  factories: {
    list: (params: unknown) => ["factories", "list", params] as const,
    detail: (id: number) => ["factories", "detail", id] as const,
    emails: (factoryId: number) => ["factories", "emails", factoryId] as const,
    certificates: (factoryId: number) => ["factories", "certificates", factoryId] as const,
    loadingAddresses: (factoryId: number) => ["factories", "loading-addresses", factoryId] as const,
  },
  clientFactories: {
    list: (params: unknown) => ["client-factories", "list", params] as const,
    detail: (factoryId: number) => ["client-factories", "detail", factoryId] as const,
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
  requests: {
    list: (params: unknown) => ["requests", "list", params] as const,
    detail: (id: number) => ["requests", "detail", id] as const,
    documents: (id: number) => ["requests", "documents", id] as const,
  },
};
