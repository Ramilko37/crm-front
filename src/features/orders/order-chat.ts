type OrderChatMessageLike = {
  id: number;
  created_at: string | null;
};

const UNREAD_STAFF_ROLES = new Set(["administrator", "manager", "logist"]);

export function canMarkOrderChatRead({
  roleName,
  isSuperuser,
  unreadCount,
}: {
  roleName: string;
  isSuperuser: boolean;
  unreadCount: number;
}) {
  return unreadCount > 0 && !isSuperuser && UNREAD_STAFF_ROLES.has(roleName);
}

export function getOrderChatLastPage(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function mergeOrderChatMessages<T extends OrderChatMessageLike>(
  current: T[],
  incoming: T[],
) {
  const byId = new Map<number, T>();
  [...current, ...incoming].forEach((message) => byId.set(message.id, message));

  return [...byId.values()].sort((left, right) => {
    const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
    const rightTime = right.created_at ? Date.parse(right.created_at) : 0;
    return leftTime - rightTime || left.id - right.id;
  });
}
