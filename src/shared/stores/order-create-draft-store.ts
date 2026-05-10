import { create } from "zustand";
import { devtools } from "zustand/middleware";

type OrderCreateDraftState = {
  draft: Record<string, unknown>;
  setDraft: (next: Record<string, unknown>) => void;
  mergeDraft: (patch: Partial<Record<string, unknown>>) => void;
  resetDraft: () => void;
};

export const CREATE_ORDER_DRAFT_DEFAULTS: Record<string, unknown> = {
  order_type: "delivery",
  factory_mode: "existing",
  client_goods_value_currency: "EUR",
  documents: [],
  goods_lines: [],
};

export const useOrderCreateDraftStore = create<OrderCreateDraftState>()(
  devtools(
    (set) => ({
      draft: { ...CREATE_ORDER_DRAFT_DEFAULTS },
      setDraft: (next) => set({ draft: next }, false, "orderCreateDraft/setDraft"),
      mergeDraft: (patch) =>
        set(
          (state) => ({ draft: { ...state.draft, ...patch } }),
          false,
          "orderCreateDraft/mergeDraft",
        ),
      resetDraft: () =>
        set({ draft: { ...CREATE_ORDER_DRAFT_DEFAULTS } }, false, "orderCreateDraft/resetDraft"),
    }),
    { name: "order-create-draft-store" },
  ),
);
