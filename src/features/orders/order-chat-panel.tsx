"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Empty, Input, Select, Space, Spin, Typography } from "antd";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";

import { canMarkOrderChatRead, mergeOrderChatMessages, getOrderChatLastPage } from "@/features/orders/order-chat";
import { apiRequest } from "@/shared/lib/api";
import { ApiError } from "@/shared/lib/errors";
import { downloadFileWithCredentials, getFileOperationErrorMessage } from "@/shared/lib/file-operations";
import { queryKeys } from "@/shared/lib/query-keys";
import type { AuthUser, OrderChatMessage, OrderDocument, PaginatedResponse } from "@/shared/types/entities";

const CHAT_PAGE_SIZE = 50;
type OrderChatPanelProps = {
  orderId: number;
  active: boolean;
  documents: OrderDocument[];
  currentUser: Pick<AuthUser, "id" | "role_name" | "is_superuser">;
  unreadCount?: number;
  onUnreadCleared?: () => void;
};

type ChatFeed = {
  items: OrderChatMessage[];
  lastPage: number;
};

function getMessageError(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.detail : fallback;
}

function formatMessageDate(value: string | null) {
  return value ? dayjs(value).format("DD.MM.YYYY HH:mm") : "—";
}

export function OrderChatPanel({
  orderId,
  active,
  documents,
  currentUser,
  unreadCount = 0,
  onUnreadCleared,
}: OrderChatPanelProps) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<OrderChatMessage[]>([]);
  const [earliestPage, setEarliestPage] = useState(1);
  const [messageText, setMessageText] = useState("");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadEarlierError, setLoadEarlierError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const initializedOrderRef = useRef<number | null>(null);
  const markedUnreadCountRef = useRef(0);
  const latestClientMessageIdRef = useRef<number | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const latestMessageIdRef = useRef<number | null>(null);
  const isNearBottomRef = useRef(true);

  const latestFeedQuery = useQuery({
    queryKey: queryKeys.orders.chatMessages(orderId, "latest"),
    queryFn: async (): Promise<ChatFeed> => {
      const firstPage = await apiRequest<PaginatedResponse<OrderChatMessage>>(
        `/api/orders/${orderId}/chat-messages`,
        { query: { page: 1, page_size: CHAT_PAGE_SIZE } },
      );
      const lastPage = getOrderChatLastPage(firstPage.meta.total, CHAT_PAGE_SIZE);
      if (lastPage === 1) {
        return { items: firstPage.items, lastPage };
      }
      const latestPage = await apiRequest<PaginatedResponse<OrderChatMessage>>(
        `/api/orders/${orderId}/chat-messages`,
        { query: { page: lastPage, page_size: CHAT_PAGE_SIZE } },
      );
      return { items: latestPage.items, lastPage };
    },
    enabled: active,
    refetchInterval: active ? 15_000 : false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    setMessages([]);
    setEarliestPage(1);
    setHasNewMessages(false);
    initializedOrderRef.current = null;
    latestMessageIdRef.current = null;
    latestClientMessageIdRef.current = null;
    isNearBottomRef.current = true;
  }, [orderId]);

  useEffect(() => {
    const feed = latestFeedQuery.data;
    if (!feed) return;

    if (initializedOrderRef.current !== orderId) {
      initializedOrderRef.current = orderId;
      setMessages(feed.items);
      setEarliestPage(feed.lastPage);
      return;
    }

    setMessages((current) => mergeOrderChatMessages(current, feed.items));
  }, [latestFeedQuery.data, orderId]);

  useEffect(() => {
    const latestMessageId = messages.at(-1)?.id ?? null;
    if (latestMessageId === latestMessageIdRef.current) return;
    latestMessageIdRef.current = latestMessageId;

    const feed = feedRef.current;
    if (!feed || latestMessageId === null) return;
    if (!isNearBottomRef.current && messages.length > 1) {
      setHasNewMessages(true);
      return;
    }

    requestAnimationFrame(() => {
      feed.scrollTop = feed.scrollHeight;
      setHasNewMessages(false);
    });
  }, [messages]);

  const markReadMutation = useMutation({
    mutationFn: () => apiRequest<void>(`/api/orders/${orderId}/chat-messages/read`, { method: "POST" }),
    onSuccess: () => onUnreadCleared?.(),
  });

  useEffect(() => {
    const canMarkRead = active && canMarkOrderChatRead({
      roleName: currentUser.role_name,
      isSuperuser: currentUser.is_superuser,
      unreadCount,
    });
    if (!canMarkRead) {
      markedUnreadCountRef.current = 0;
      return;
    }
    if (markedUnreadCountRef.current === unreadCount || markReadMutation.isPending) return;

    markedUnreadCountRef.current = unreadCount;
    markReadMutation.mutate();
  }, [active, currentUser.is_superuser, currentUser.role_name, markReadMutation, unreadCount]);

  useEffect(() => {
    const latestClientMessage = messages.filter((message) => message.is_from_client).at(-1);
    if (!latestClientMessage) return;
    if (latestClientMessageIdRef.current === null) {
      latestClientMessageIdRef.current = latestClientMessage.id;
      return;
    }
    if (latestClientMessageIdRef.current === latestClientMessage.id || !active) return;

    latestClientMessageIdRef.current = latestClientMessage.id;
    if (!canMarkOrderChatRead({
      roleName: currentUser.role_name,
      isSuperuser: currentUser.is_superuser,
      unreadCount: 1,
    })) {
      return;
    }

    markedUnreadCountRef.current = 0;
    markReadMutation.mutate();
  }, [active, currentUser.is_superuser, currentUser.role_name, markReadMutation, messages]);

  const sendMessageMutation = useMutation({
    mutationFn: (payload: { message: string; document_ids?: number[] }) =>
      apiRequest<OrderChatMessage>(`/api/orders/${orderId}/chat-messages`, {
        method: "POST",
        body: payload,
      }),
    onSuccess: (created) => {
      setMessages((current) => mergeOrderChatMessages(current, [created]));
      setMessageText("");
      setSelectedDocumentIds([]);
      setSendError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.chatMessages(orderId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
    },
    onError: (error) => setSendError(getMessageError(error, "Не удалось отправить сообщение")),
  });

  const canLoadEarlier = earliestPage > 1;

  async function loadEarlier() {
    const page = earliestPage - 1;
    if (page < 1 || isLoadingEarlier) return;
    setLoadEarlierError(null);
    setIsLoadingEarlier(true);
    try {
      const response = await queryClient.fetchQuery({
        queryKey: queryKeys.orders.chatMessages(orderId, page),
        queryFn: () =>
          apiRequest<PaginatedResponse<OrderChatMessage>>(`/api/orders/${orderId}/chat-messages`, {
            query: { page, page_size: CHAT_PAGE_SIZE },
          }),
      });
      setMessages((current) => mergeOrderChatMessages(response.items, current));
      setEarliestPage(page);
    } catch (error) {
      setLoadEarlierError(getMessageError(error, "Не удалось загрузить предыдущие сообщения"));
    } finally {
      setIsLoadingEarlier(false);
    }
  }

  function scrollToLatestMessage() {
    const feed = feedRef.current;
    if (!feed) return;
    feed.scrollTop = feed.scrollHeight;
    isNearBottomRef.current = true;
    setHasNewMessages(false);
  }

  function sendMessage() {
    const message = messageText.trim();
    if (!message || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate({
      message,
      ...(selectedDocumentIds.length ? { document_ids: selectedDocumentIds } : {}),
    });
  }

  async function downloadDocument(document: OrderChatMessage["documents"][number]) {
    setDownloadError(null);
    try {
      await downloadFileWithCredentials(
        `/api/orders/${orderId}/documents/${document.id}/download`,
        document.file_name,
      );
    } catch (error) {
      setDownloadError(getFileOperationErrorMessage(error, "Не удалось скачать документ"));
    }
  }

  return (
    <div className="crm-order-chat">
      {latestFeedQuery.isLoading && !messages.length ? <Spin aria-label="Загрузка сообщений" /> : null}
      {latestFeedQuery.isError ? (
        <Alert
          type="error"
          showIcon
          title={getMessageError(latestFeedQuery.error, "Не удалось загрузить сообщения")}
          action={<Button size="small" onClick={() => void latestFeedQuery.refetch()}>Повторить</Button>}
        />
      ) : null}
      {loadEarlierError ? <Alert type="warning" showIcon title={loadEarlierError} /> : null}
      {downloadError ? <Alert type="warning" showIcon title={downloadError} /> : null}

      {hasNewMessages ? (
        <Button size="small" onClick={scrollToLatestMessage}>
          Новые сообщения
        </Button>
      ) : null}
      <div
        ref={feedRef}
        className="crm-order-chat-feed"
        role="log"
        aria-live="polite"
        onScroll={(event) => {
          const target = event.currentTarget;
          isNearBottomRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < 24;
          if (isNearBottomRef.current) setHasNewMessages(false);
        }}
      >
        {canLoadEarlier ? (
          <Button block size="small" loading={isLoadingEarlier} onClick={() => void loadEarlier()}>
            Показать предыдущие
          </Button>
        ) : null}

        {!latestFeedQuery.isLoading && !messages.length ? <Empty description="Сообщений пока нет" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}

        {messages.map((chatMessage) => {
          const ownMessage = chatMessage.author_user_id !== null && chatMessage.author_user_id === currentUser.id;
          return (
            <div
              className={`crm-order-chat-message${ownMessage ? " crm-order-chat-message-own" : ""}`}
              key={chatMessage.id}
            >
              <Typography.Text strong>{chatMessage.author_full_name || "Пользователь"}</Typography.Text>
              <Typography.Paragraph style={{ margin: "4px 0 0" }}>{chatMessage.message}</Typography.Paragraph>
              {chatMessage.documents.length ? (
                <Space direction="vertical" size={0} style={{ width: "100%" }}>
                  {chatMessage.documents.map((document) => (
                    <Button
                      key={document.id}
                      type="link"
                      size="small"
                      style={{ paddingInline: 0, textAlign: "left" }}
                      onClick={() => void downloadDocument(document)}
                    >
                      {document.file_name}
                    </Button>
                  ))}
                </Space>
              ) : null}
              <Typography.Text type="secondary" className="crm-order-chat-message-meta">
                {[chatMessage.author_role_name, formatMessageDate(chatMessage.created_at)].filter(Boolean).join(" · ")}
              </Typography.Text>
            </div>
          );
        })}
      </div>

      <div className="crm-order-chat-composer">
        <label htmlFor={`order-chat-message-${orderId}`}>Сообщение</label>
        <Input.TextArea
          id={`order-chat-message-${orderId}`}
          value={messageText}
          maxLength={2000}
          autoSize={{ minRows: 3, maxRows: 6 }}
          placeholder="Напишите сообщение"
          onChange={(event) => setMessageText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              sendMessage();
            }
          }}
        />
        <Select
          aria-label="Вложения"
          mode="multiple"
          allowClear
          placeholder="Прикрепить документы заказа"
          value={selectedDocumentIds}
          options={documents.map((document) => ({
            value: document.id,
            label: document.file_name ?? document.display_name ?? document.file_path ?? `Документ #${document.id}`,
          }))}
          onChange={setSelectedDocumentIds}
        />
        {sendError ? <Alert type="error" showIcon title={sendError} /> : null}
        <Button
          type="primary"
          loading={sendMessageMutation.isPending}
          disabled={!messageText.trim()}
          onClick={sendMessage}
        >
          Отправить
        </Button>
      </div>
    </div>
  );
}
