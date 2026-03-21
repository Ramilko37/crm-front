import type { OrderWritePayload } from "@/shared/types/entities";

type LegacyOrderWritePayload = OrderWritePayload & {
  company_id?: number | null;
};

export function toOrderWritePayload(payload: LegacyOrderWritePayload): OrderWritePayload {
  const { company_id, ...nextPayload } = payload;
  void company_id;
  return nextPayload;
}
