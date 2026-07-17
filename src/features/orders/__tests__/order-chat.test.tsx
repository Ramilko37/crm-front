import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { canMarkOrderChatRead, getOrderChatLastPage, mergeOrderChatMessages } from "@/features/orders/order-chat";
import { OrderChatPanel } from "@/features/orders/order-chat-panel";
import { apiRequest } from "@/shared/lib/api";

vi.mock("@/shared/lib/api", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

function renderChatPanel({ unreadCount = 0 }: { unreadCount?: number } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <OrderChatPanel
        orderId={77}
        active
        documents={[]}
        currentUser={{ id: 12, role_name: "manager", is_superuser: false }}
        unreadCount={unreadCount}
      />
    </QueryClientProvider>,
  );
}

describe("order chat helpers", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("calculates the last page without returning zero", () => {
    expect(getOrderChatLastPage(0, 50)).toBe(1);
    expect(getOrderChatLastPage(50, 50)).toBe(1);
    expect(getOrderChatLastPage(51, 50)).toBe(2);
  });

  it("deduplicates messages by id and keeps chronological order", () => {
    const merged = mergeOrderChatMessages(
      [
        { id: 2, created_at: "2026-07-14T10:01:00Z" },
        { id: 3, created_at: "2026-07-14T10:02:00Z" },
      ],
      [
        { id: 1, created_at: "2026-07-14T10:00:00Z" },
        { id: 2, created_at: "2026-07-14T10:01:00Z" },
      ],
    );

    expect(merged.map((message) => message.id)).toEqual([1, 2, 3]);
  });

  it("allows mark-as-read only for unread backoffice staff", () => {
    expect(canMarkOrderChatRead({ roleName: "manager", isSuperuser: false, unreadCount: 1 })).toBe(true);
    expect(canMarkOrderChatRead({ roleName: "client", isSuperuser: false, unreadCount: 1 })).toBe(false);
    expect(canMarkOrderChatRead({ roleName: "manager", isSuperuser: true, unreadCount: 1 })).toBe(false);
    expect(canMarkOrderChatRead({ roleName: "logist", isSuperuser: false, unreadCount: 0 })).toBe(false);
  });

  it("sends the trimmed composer text to the order chat endpoint", async () => {
    apiRequestMock
      .mockResolvedValueOnce({ items: [], meta: { page: 1, page_size: 50, total: 0, total_pages: 1 } })
      .mockResolvedValueOnce({
        id: 501,
        order_id: 77,
        author_user_id: 12,
        author_full_name: "Jane Smith",
        author_role_name: "manager",
        is_from_client: false,
        message: "Please confirm the pickup date",
        documents: [],
        created_at: "2026-07-14T10:35:00Z",
      });

    renderChatPanel();

    fireEvent.change(await screen.findByLabelText("Сообщение"), {
      target: { value: "  Please confirm the pickup date  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/api/orders/77/chat-messages", {
        method: "POST",
        body: { message: "Please confirm the pickup date" },
      });
    });
  });

  it("marks staff unread messages as read when the chat is visible", async () => {
    apiRequestMock
      .mockResolvedValueOnce({ items: [], meta: { page: 1, page_size: 50, total: 0, total_pages: 1 } })
      .mockResolvedValueOnce(null);

    renderChatPanel({ unreadCount: 2 });

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/api/orders/77/chat-messages/read", { method: "POST" });
    });
  });
});
