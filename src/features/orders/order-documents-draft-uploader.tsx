"use client";

import { DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import { App, Button, Card, Checkbox, Form, Input, Select, Space, Tag, Typography, Upload } from "antd";
import type { FormInstance } from "antd";
import type { UploadFile, RcFile } from "antd/es/upload/interface";
import { useMemo, useState } from "react";

type DocumentDraft = {
  client_uid?: string;
  document_type?: string;
  display_name?: string;
  comment?: string;
  file_list?: UploadFile[];
};

type SelectOption = {
  label: string;
  value: string;
};

type OrderDocumentsDraftUploaderProps = {
  accept?: string;
  disabled?: boolean;
  documentTypeOptions: SelectOption[];
  form: FormInstance;
  maxCount?: number;
  name?: string;
  onDocumentsChange?: (documents: DocumentDraft[]) => void;
};

const DEFAULT_MAX_COUNT = 10;

const MIN_DOCUMENT_TYPE_OPTIONS: SelectOption[] = [
  { label: "Invoice", value: "invoice" },
  { label: "Packing List", value: "packing_list" },
  { label: "Proforma Invoice", value: "proforma_invoice" },
  { label: "CMR", value: "cmr" },
  { label: "Export Declaration", value: "export_declaration" },
  { label: "Customs Declaration", value: "customs_declaration" },
  { label: "Certificate of Origin", value: "certificate_of_origin" },
  { label: "Transport Document", value: "transport_document" },
  { label: "Contract", value: "contract" },
  { label: "Specification", value: "specification" },
  { label: "Photo", value: "photo" },
  { label: "Other", value: "other" },
];

function formatFileSize(size?: number) {
  if (!size) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getUploadFile(document?: DocumentDraft) {
  return document?.file_list?.[0];
}

function getFileSignature(file?: UploadFile) {
  if (!file) return "";
  const origin = file.originFileObj;
  const size = file.size ?? origin?.size ?? 0;
  const lastModified = origin instanceof File ? origin.lastModified : 0;
  return [file.name, size, lastModified].join("::");
}

function createUploadFile(file: RcFile): UploadFile {
  return {
    uid: file.uid,
    name: file.name,
    size: file.size,
    type: file.type,
    originFileObj: file,
    status: "done",
  };
}

function mergeDocumentTypeOptions(options: SelectOption[]) {
  const byValue = new Map<string, SelectOption>();
  [...options, ...MIN_DOCUMENT_TYPE_OPTIONS].forEach((option) => {
    if (!byValue.has(option.value)) {
      byValue.set(option.value, option);
    }
  });
  return Array.from(byValue.values());
}

export function OrderDocumentsDraftUploader({
  accept,
  disabled = false,
  documentTypeOptions,
  form,
  maxCount = DEFAULT_MAX_COUNT,
  name = "documents",
  onDocumentsChange,
}: OrderDocumentsDraftUploaderProps) {
  const { message } = App.useApp();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDocumentType, setBulkDocumentType] = useState<string>();

  const options = useMemo(() => mergeDocumentTypeOptions(documentTypeOptions), [documentTypeOptions]);

  function getDocuments() {
    return ((form.getFieldValue(name) as DocumentDraft[] | undefined) ?? []).filter(Boolean);
  }

  function setDocuments(documents: DocumentDraft[]) {
    form.setFieldValue(name, documents);
    onDocumentsChange?.(documents);
  }

  function getDuplicateCounts(documents: DocumentDraft[]) {
    return documents.reduce((acc, document) => {
      const signature = getFileSignature(getUploadFile(document));
      if (!signature) return acc;
      acc.set(signature, (acc.get(signature) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
  }

  function addFile(file: RcFile) {
    const documents = getDocuments();
    if (documents.length >= maxCount) {
      message.warning(`Можно загрузить максимум ${maxCount} документов`);
      return Upload.LIST_IGNORE;
    }

    const uploadFile = createUploadFile(file);
    const signature = getFileSignature(uploadFile);
    const duplicates = getDuplicateCounts(documents);
    if (signature && duplicates.has(signature)) {
      message.warning(`Файл "${file.name}" уже есть в списке`);
    }

    setDocuments([
      ...documents,
      {
        client_uid: uploadFile.uid,
        display_name: file.name,
        file_list: [uploadFile],
      },
    ]);

    return Upload.LIST_IGNORE;
  }

  function removeDocument(index: number) {
    const documents = getDocuments();
    const document = documents[index];
    const next = documents.filter((_, currentIndex) => currentIndex !== index);
    setDocuments(next);
    if (document?.client_uid) {
      setSelectedIds((current) => current.filter((id) => id !== document.client_uid));
    }
  }

  function toggleSelected(clientUid: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) return Array.from(new Set([...current, clientUid]));
      return current.filter((id) => id !== clientUid);
    });
  }

  function assignBulkDocumentType() {
    if (!bulkDocumentType || selectedIds.length === 0) return;
    const selected = new Set(selectedIds);
    const next = getDocuments().map((document) =>
      document.client_uid && selected.has(document.client_uid)
        ? { ...document, document_type: bulkDocumentType }
        : document,
    );
    setDocuments(next);
  }

  return (
    <Form.List name={name}>
      {(fields) => {
        const documents = getDocuments();
        const duplicateCounts = getDuplicateCounts(documents);
        const selectedCount = selectedIds.length;

        return (
          <Space orientation="vertical" style={{ width: "100%" }} size={12}>
            <Upload.Dragger
              accept={accept}
              beforeUpload={(file) => addFile(file)}
              disabled={disabled || documents.length >= maxCount}
              fileList={[]}
              multiple
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Перетащите файлы сюда или выберите несколько файлов</p>
              <p className="ant-upload-hint">Файлы попадут в черновик и будут загружены при сохранении заказа.</p>
            </Upload.Dragger>

            <div className="crm-document-bulk-bar">
              <Checkbox
                checked={documents.length > 0 && selectedIds.length === documents.length}
                disabled={disabled || documents.length === 0}
                indeterminate={selectedIds.length > 0 && selectedIds.length < documents.length}
                onChange={(event) => {
                  setSelectedIds(event.target.checked ? documents.map((document, index) => document.client_uid ?? String(index)) : []);
                }}
              >
                Выбрано: {selectedCount}
              </Checkbox>
              <Select
                allowClear
                disabled={disabled || selectedCount === 0}
                onChange={setBulkDocumentType}
                options={options}
                placeholder="Тип для выбранных"
                style={{ minWidth: 240 }}
                value={bulkDocumentType}
              />
              <Button disabled={disabled || selectedCount === 0 || !bulkDocumentType} onClick={assignBulkDocumentType}>
                Назначить тип
              </Button>
              <Typography.Text type="secondary">
                {documents.length}/{maxCount} файлов
              </Typography.Text>
            </div>

            {fields.map((field, index) => {
              const document = documents[field.name] ?? {};
              const uploadFile = getUploadFile(document);
              const signature = getFileSignature(uploadFile);
              const isDuplicate = Boolean(signature && (duplicateCounts.get(signature) ?? 0) > 1);
              const clientUid = document.client_uid ?? String(field.key);
              const fileSize = uploadFile?.size ?? uploadFile?.originFileObj?.size;

              return (
                <Card
                  className={isDuplicate ? "crm-document-draft-card crm-document-draft-card-duplicate" : "crm-document-draft-card"}
                  key={field.key}
                  size="small"
                  title={
                    <Space size={8} wrap>
                      <Checkbox
                        checked={selectedIds.includes(clientUid)}
                        disabled={disabled}
                        onChange={(event) => toggleSelected(clientUid, event.target.checked)}
                      />
                      <span>{document.display_name || uploadFile?.name || `Документ #${index + 1}`}</span>
                      <Tag color={isDuplicate ? "warning" : "processing"}>
                        {isDuplicate ? "Дубликат" : "В черновике"}
                      </Tag>
                    </Space>
                  }
                  extra={
                    <Button
                      danger
                      disabled={disabled}
                      icon={<DeleteOutlined />}
                      onClick={() => removeDocument(field.name)}
                      size="small"
                      title="Удалить"
                    />
                  }
                >
                  <div className="crm-document-draft-meta">
                    <span>{uploadFile?.name ?? "Файл не выбран"}</span>
                    <span>{formatFileSize(fileSize)}</span>
                    <span>Будет загружен при сохранении</span>
                  </div>
                  <div className="crm-order-create-grid">
                    <Form.Item name={[field.name, "client_uid"]} hidden>
                      <Input />
                    </Form.Item>
                    <Form.Item
                      className="crm-order-create-col"
                      label="Тип документа"
                      name={[field.name, "document_type"]}
                      rules={[{ required: true, message: "Укажите тип документа" }]}
                    >
                      <Select
                        allowClear
                        disabled={disabled}
                        options={options}
                        placeholder="Выберите тип"
                      />
                    </Form.Item>
                    <Form.Item
                      className="crm-order-create-col"
                      label="Название файла"
                      name={[field.name, "display_name"]}
                      rules={[{ required: true, message: "Укажите название файла" }]}
                    >
                      <Input disabled={disabled} placeholder="Название для отображения" />
                    </Form.Item>
                    <Form.Item className="crm-order-create-col" label="Комментарий" name={[field.name, "comment"]}>
                      <Input.TextArea disabled={disabled} placeholder="Комментарий хранится в черновике до поддержки backend" rows={2} />
                    </Form.Item>
                    <Form.Item
                      className="crm-order-create-col"
                      getValueFromEvent={(event) => event?.fileList}
                      label="Файл"
                      name={[field.name, "file_list"]}
                      rules={[{ required: true, message: "Выберите файл" }]}
                      valuePropName="fileList"
                    >
                      <Upload
                        accept={accept}
                        beforeUpload={() => false}
                        disabled={disabled}
                        maxCount={1}
                      >
                        <Button disabled={disabled}>Заменить файл</Button>
                      </Upload>
                    </Form.Item>
                  </div>
                </Card>
              );
            })}
          </Space>
        );
      }}
    </Form.List>
  );
}
