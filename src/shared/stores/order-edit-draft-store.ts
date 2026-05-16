import { create } from "zustand";
import { devtools } from "zustand/middleware";

type OrderEditDraftRecord = {
  values: Record<string, unknown>;
  dirty: boolean;
  lastHydratedAt: string | null;
};

type OrderEditDraftState = {
  draftsByOrderId: Record<number, OrderEditDraftRecord>;
  setDraft: (orderId: number, values: Record<string, unknown>, meta?: { dirty?: boolean; hydratedAt?: string | null }) => void;
  mergeDraft: (orderId: number, patch: Partial<Record<string, unknown>>) => void;
  resetDraft: (orderId: number) => void;
  resetAll: () => void;
};

export const useOrderEditDraftStore = create<OrderEditDraftState>()(
  devtools(
    (set) => ({
      draftsByOrderId: {},
      setDraft: (orderId, values, meta) =>
        set(
          (state) => ({
            draftsByOrderId: {
              ...state.draftsByOrderId,
              [orderId]: {
                values,
                dirty: meta?.dirty ?? false,
                lastHydratedAt: meta?.hydratedAt ?? null,
              },
            },
          }),
          false,
          "orderEditDraft/setDraft",
        ),
      mergeDraft: (orderId, patch) =>
        set(
          (state) => {
            const current = state.draftsByOrderId[orderId] ?? {
              values: {},
              dirty: false,
              lastHydratedAt: null,
            };
            return {
              draftsByOrderId: {
                ...state.draftsByOrderId,
                [orderId]: {
                  ...current,
                  values: { ...current.values, ...patch },
                  dirty: true,
                },
              },
            };
          },
          false,
          "orderEditDraft/mergeDraft",
        ),
      resetDraft: (orderId) =>
        set(
          (state) => {
            const next = { ...state.draftsByOrderId };
            delete next[orderId];
            return { draftsByOrderId: next };
          },
          false,
          "orderEditDraft/resetDraft",
        ),
      resetAll: () =>
        set(
          {
            draftsByOrderId: {},
          },
          false,
          "orderEditDraft/resetAll",
        ),
    }),
    { name: "order-edit-draft-store" },
  ),
);
