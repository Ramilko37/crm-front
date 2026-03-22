"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import dayjs from "dayjs";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { apiRequest } from "@/shared/lib/api";
import { ROLE_NAMES, type RoleName } from "@/shared/lib/domain-enums";
import { ApiError } from "@/shared/lib/errors";
import { queryKeys } from "@/shared/lib/query-keys";
import { setSearchPatch } from "@/shared/lib/query-string";
import { canManageUsers, canResetUserPassword, normalizeRoleName } from "@/shared/lib/rbac";
import { FilterPanel, PageHeader, PageToolbar } from "@/shared/ui/page-frame";
import type { PaginatedResponse, UserAdmin, UserFilterParams, UserWritePayload } from "@/shared/types/entities";

function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBool(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function getParams(searchParams: URLSearchParams): UserFilterParams {
  return {
    page: parseNumber(searchParams.get("page")) ?? 1,
    page_size: parseNumber(searchParams.get("page_size")) ?? 50,
    sort_by: searchParams.get("sort_by") ?? undefined,
    sort_desc: parseBool(searchParams.get("sort_desc")) ?? false,
    query: searchParams.get("query") ?? undefined,
    company_id: parseNumber(searchParams.get("company_id")),
    role_name: searchParams.get("role_name") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    is_logist: parseBool(searchParams.get("is_logist")),
    has_email: parseBool(searchParams.get("has_email")),
    has_orders: parseBool(searchParams.get("has_orders")),
    last_order_date_from: searchParams.get("last_order_date_from") ?? undefined,
    last_order_date_to: searchParams.get("last_order_date_to") ?? undefined,
  };
}

type UserCreateForm = {
  company_id: number;
  personal_manager_id?: number;
  full_name: string;
  login: string;
  password: string;
  role_name: RoleName | string;
  email?: string;
  phone?: string;
  country?: string;
  city?: string;
  is_active: boolean;
  is_logist: boolean;
};

type UserEditForm = Omit<UserCreateForm, "password" | "company_id"> & {
  company_id: number;
  total_orders?: number;
  last_order_date?: dayjs.Dayjs;
};

function UsersPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const meQuery = useCurrentUser(true);
  const normalizedRole = normalizeRoleName(meQuery.data?.role_name);
  const canWrite = canManageUsers(meQuery.data?.role_name, meQuery.data?.is_superuser);
  const canResetPassword = canResetUserPassword(meQuery.data?.role_name, meQuery.data?.is_superuser);
  const isManagerActor = !meQuery.data?.is_superuser && normalizedRole === "manager";

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<UserAdmin | null>(null);
  const [createForm] = Form.useForm<UserCreateForm>();
  const [editForm] = Form.useForm<UserEditForm>();
  const [passwordForm] = Form.useForm<{ new_password: string }>();
  const [filterForm] = Form.useForm<{
    query?: string;
    company_id?: number;
    role_name?: RoleName | string;
    is_logist?: boolean;
    has_email?: boolean;
    has_orders?: boolean;
  }>();

  const params = useMemo(() => getParams(searchParams), [searchParams]);

  const roleOptions = useMemo(() => {
    const all = ROLE_NAMES.filter((role) => role !== "anonymous");
    if (isManagerActor) {
      return all.filter((role) => role !== "administrator" && role !== "manager");
    }
    return all;
  }, [isManagerActor]);

  const listQuery = useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<UserAdmin>>("/api/users", {
        query: params,
      }),
    enabled: canWrite,
  });

  const createMutation = useMutation({
    mutationFn: (payload: UserWritePayload) =>
      apiRequest<UserAdmin>("/api/users", {
        method: "POST",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Пользователь создан");
      setCreateOpen(false);
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка создания пользователя");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UserWritePayload }) =>
      apiRequest<UserAdmin>(`/api/users/${id}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      message.success("Пользователь обновлен");
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка обновления пользователя");
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, new_password }: { id: number; new_password: string }) =>
      apiRequest<null>(`/api/users/${id}/password`, {
        method: "PATCH",
        body: { new_password },
      }),
    onSuccess: () => {
      message.success("Пароль пользователя обновлен");
      setPasswordOpen(false);
      passwordForm.resetFields();
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.detail : "Ошибка сброса пароля");
    },
  });

  function applySearchPatch(
    patch: Record<string, string | number | boolean | (string | number | boolean)[] | null | undefined>,
  ) {
    const nextSearch = setSearchPatch(searchParams, patch);
    router.replace(`/users${nextSearch ? `?${nextSearch}` : ""}`);
  }

  const sortOrderFor = (field: string) => {
    if (params.sort_by !== field) return null;
    return params.sort_desc ? "descend" : "ascend";
  };

  function handleTableChange(
    pagination: TablePaginationConfig,
    _: unknown,
    sorter: SorterResult<UserAdmin> | SorterResult<UserAdmin>[],
  ) {
    const currentSorter = Array.isArray(sorter)
      ? (sorter[0] as SorterResult<UserAdmin> | undefined)
      : (sorter as SorterResult<UserAdmin>);

    applySearchPatch({
      page: pagination.current ?? 1,
      page_size: pagination.pageSize ?? params.page_size ?? 50,
      sort_by: (currentSorter?.field as string | undefined) || undefined,
      sort_desc: currentSorter?.order === "descend",
    });
  }

  const columns: ColumnsType<UserAdmin> = [
    { title: "ID", dataIndex: "id", key: "id", width: 90, sorter: true, sortOrder: sortOrderFor("id") },
    {
      title: "ФИО",
      dataIndex: "full_name",
      key: "full_name",
      sorter: true,
      sortOrder: sortOrderFor("full_name"),
    },
    { title: "Логин", dataIndex: "login", key: "login" },
    { title: "Компания", dataIndex: "company_id", key: "company_id", width: 110, render: (value) => value ?? "-" },
    {
      title: "Роль",
      dataIndex: "role_name",
      key: "role_name",
      width: 130,
      render: (value) => <Tag>{value}</Tag>,
    },
    { title: "Email", dataIndex: "email", key: "email", render: (value) => value ?? "-" },
    {
      title: "Активен",
      dataIndex: "is_active",
      key: "is_active",
      width: 100,
      render: (value: boolean) => (value ? "Да" : "Нет"),
    },
    {
      title: "Действия",
      key: "actions",
      width: 260,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setSelected(record);
              editForm.setFieldsValue({
                company_id: record.company_id ?? undefined,
                personal_manager_id: record.personal_manager_id ?? undefined,
                full_name: record.full_name,
                login: record.login,
                role_name: record.role_name,
                email: record.email ?? undefined,
                phone: record.phone ?? undefined,
                country: record.country ?? undefined,
                city: record.city ?? undefined,
                is_active: record.is_active,
                is_logist: record.is_logist,
                total_orders: record.total_orders ?? undefined,
                last_order_date: record.last_order_date ? dayjs(record.last_order_date) : undefined,
              });
              setEditOpen(true);
            }}
          >
            Изменить
          </Button>
          {canResetPassword ? (
            <Button
              size="small"
              onClick={() => {
                setSelected(record);
                passwordForm.resetFields();
                setPasswordOpen(true);
              }}
            >
              Сброс пароля
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  const rows = listQuery.data?.items ?? [];
  const currentPage = listQuery.data?.meta.page ?? params.page ?? 1;
  const currentPageSize = listQuery.data?.meta.page_size ?? params.page_size ?? 50;
  const totalRows = listQuery.data?.meta.total ?? 0;

  if (!canWrite) {
    return (
      <Space direction="vertical" size={16} className="crm-page-stack">
        <PageHeader title="Пользователи" subtitle="Раздел доступен только administrator/manager" />
        <Card className="crm-panel">
          <Typography.Text>Недостаточно прав для просмотра этого раздела.</Typography.Text>
        </Card>
      </Space>
    );
  }

  return (
    <Space direction="vertical" size={16} className="crm-page-stack">
      <PageHeader
        title="Пользователи"
        subtitle="Административный CRUD пользователей"
        actions={
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            Новый пользователь
          </Button>
        }
      />

      <PageToolbar
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        toggleLabel="Фильтр"
        search={
          <Input.Search
            key={params.query ?? "users-query"}
            allowClear
            enterButton="Найти"
            placeholder="Поиск по ФИО/логину/email"
            defaultValue={params.query}
            onSearch={(value) => applySearchPatch({ query: value || null, page: 1 })}
          />
        }
      />

      <FilterPanel open={filtersOpen}>
        <Form
          form={filterForm}
          initialValues={{
            query: params.query,
            company_id: params.company_id,
            role_name: params.role_name,
            is_logist: params.is_logist,
            has_email: params.has_email,
            has_orders: params.has_orders,
          }}
          onFinish={(values) => {
            applySearchPatch({
              query: values.query,
              company_id: values.company_id,
              role_name: values.role_name,
              is_logist: values.is_logist,
              has_email: values.has_email,
              has_orders: values.has_orders,
              page: 1,
            });
          }}
        >
          <div className="crm-filter-grid">
            <Form.Item name="query" className="crm-col-4" style={{ marginBottom: 0 }}>
              <Input placeholder="Поиск" allowClear />
            </Form.Item>
            <Form.Item name="company_id" className="crm-col-2" style={{ marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} placeholder="Компания ID" />
            </Form.Item>
            <Form.Item name="role_name" className="crm-col-3" style={{ marginBottom: 0 }}>
              <Select
                allowClear
                placeholder="Роль"
                options={roleOptions.map((role) => ({ label: role, value: role }))}
              />
            </Form.Item>
            <Form.Item name="is_logist" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Select
                allowClear
                placeholder="Логист"
                options={[
                  { label: "Да", value: true },
                  { label: "Нет", value: false },
                ]}
              />
            </Form.Item>
            <Form.Item name="has_email" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Select
                allowClear
                placeholder="С email"
                options={[
                  { label: "Да", value: true },
                  { label: "Нет", value: false },
                ]}
              />
            </Form.Item>
            <Form.Item name="has_orders" className="crm-col-2" style={{ marginBottom: 0 }}>
              <Select
                allowClear
                placeholder="С заказами"
                options={[
                  { label: "Да", value: true },
                  { label: "Нет", value: false },
                ]}
              />
            </Form.Item>
          </div>
          <div className="crm-filter-actions">
            <Button type="primary" htmlType="submit">
              Применить
            </Button>
            <Button
              onClick={() => {
                filterForm.resetFields();
                router.replace("/users");
                setFiltersOpen(false);
              }}
            >
              Сбросить
            </Button>
          </div>
        </Form>
      </FilterPanel>

      <Card className="crm-panel crm-table-card">
        {listQuery.error ? (
          <Typography.Text type="danger">
            {listQuery.error instanceof ApiError ? listQuery.error.detail : "Ошибка загрузки"}
          </Typography.Text>
        ) : null}

        <Table<UserAdmin>
          rowKey="id"
          loading={listQuery.isLoading}
          dataSource={rows}
          columns={columns}
          scroll={{ x: 1460 }}
          pagination={false}
          onChange={handleTableChange}
          locale={{ emptyText: "Нет данных" }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <Pagination
            current={currentPage}
            pageSize={currentPageSize}
            total={totalRows}
            showSizeChanger
            pageSizeOptions={[20, 50, 100, 200]}
            onChange={(page, pageSize) => {
              applySearchPatch({ page, page_size: pageSize });
            }}
          />
        </div>
      </Card>

      <Modal
        title="Новый пользователь"
        open={createOpen}
        destroyOnHidden
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form<UserCreateForm>
          form={createForm}
          layout="vertical"
          initialValues={{ is_active: true, is_logist: false }}
          onFinish={(values) => {
            createMutation.mutate({
              ...values,
              is_active: isManagerActor ? true : values.is_active,
            });
          }}
        >
          <Form.Item name="company_id" label="Компания ID" rules={[{ required: true }]}> 
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="full_name" label="ФИО" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="login" label="Логин" rules={[{ required: true }]}> 
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true }]}> 
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="role_name" label="Роль" rules={[{ required: true }]}> 
            <Select options={roleOptions.map((role) => ({ label: role, value: role }))} />
          </Form.Item>
          <Form.Item name="personal_manager_id" label="Персональный менеджер ID">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input />
          </Form.Item>
          <Form.Item name="country" label="Страна">
            <Input />
          </Form.Item>
          <Form.Item name="city" label="Город">
            <Input />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch disabled={isManagerActor} />
          </Form.Item>
          <Form.Item name="is_logist" label="Логист" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Изменить пользователя #${selected?.id ?? ""}`}
        open={editOpen}
        destroyOnHidden
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form<UserEditForm>
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selected) return;
            updateMutation.mutate({
              id: selected.id,
              payload: {
                company_id: values.company_id,
                personal_manager_id: values.personal_manager_id,
                full_name: values.full_name,
                login: values.login,
                role_name: values.role_name,
                email: values.email,
                phone: values.phone,
                country: values.country,
                city: values.city,
                is_active: isManagerActor ? true : values.is_active,
                is_logist: values.is_logist,
                total_orders: values.total_orders,
                last_order_date: values.last_order_date?.format("YYYY-MM-DD"),
              },
            });
          }}
        >
          <Form.Item name="company_id" label="Компания ID" rules={[{ required: true }]}> 
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="full_name" label="ФИО" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="login" label="Логин" rules={[{ required: true }]}> 
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="role_name" label="Роль" rules={[{ required: true }]}> 
            <Select options={roleOptions.map((role) => ({ label: role, value: role }))} />
          </Form.Item>
          <Form.Item name="personal_manager_id" label="Персональный менеджер ID">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input />
          </Form.Item>
          <Form.Item name="country" label="Страна">
            <Input />
          </Form.Item>
          <Form.Item name="city" label="Город">
            <Input />
          </Form.Item>
          <Form.Item name="total_orders" label="Всего заказов">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="last_order_date" label="Дата последнего заказа">
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch disabled={isManagerActor} />
          </Form.Item>
          <Form.Item name="is_logist" label="Логист" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Сброс пароля для #${selected?.id ?? ""}`}
        open={passwordOpen}
        destroyOnHidden
        onCancel={() => setPasswordOpen(false)}
        onOk={() => passwordForm.submit()}
        confirmLoading={resetPasswordMutation.isPending}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={(values: { new_password: string }) => {
            if (!selected) return;
            resetPasswordMutation.mutate({ id: selected.id, new_password: values.new_password });
          }}
        >
          <Form.Item name="new_password" label="Новый пароль" rules={[{ required: true }]}> 
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<Card loading />}>
      <UsersPageContent />
    </Suspense>
  );
}
