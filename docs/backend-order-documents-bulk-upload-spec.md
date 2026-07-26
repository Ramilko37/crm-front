# ORD-DOC-01 Backend Spec

## Goal

Support bulk order document upload, per-file classification, metadata editing, and partial success reporting for the CRM order create/edit flows.

The frontend can already keep a rich local draft, but persistent behavior needs the backend contract below.

## Document Types

The order metadata endpoint must return at least these document type options:

- `invoice` - Invoice
- `packing_list` - Packing List
- `proforma_invoice` - Proforma Invoice
- `cmr` - CMR
- `export_declaration` - Export Declaration
- `customs_declaration` - Customs Declaration
- `certificate_of_origin` - Certificate of Origin
- `transport_document` - Transport Document
- `contract` - Contract
- `specification` - Specification
- `photo` - Photo
- `other` - Other

Existing endpoints:

- `GET /api/v1/orders/create-metadata`
- `GET /api/v1/client/orders/create-metadata`

Expected response field:

```json
{
  "document_type_options": [
    { "code": "invoice", "label": "Invoice" }
  ]
}
```

Admin-managed document type CRUD is explicitly out of scope for the current frontend task.

## Upload Payload

Current frontend sends order create/update as multipart:

- `payload`: JSON
- file parts named by `documents[].file_slot`

Extend `documents[]` to accept optional metadata:

```json
{
  "document_type": "invoice",
  "file_slot": "doc_1",
  "display_name": "Invoice 123.pdf",
  "comment": "Original from client portal",
  "client_uid": "front-generated-id"
}
```

Required:

- `document_type`
- `file_slot`

Optional:

- `display_name`
- `comment`
- `client_uid`

The backend should store `display_name` and `comment`. `client_uid` is only for correlating per-file results with the frontend draft.

## Partial Success

For create/update requests with documents, one invalid file must not discard all other successfully uploaded files.

Recommended response shape:

```json
{
  "order": { "id": 123 },
  "documents": [
    {
      "client_uid": "a",
      "status": "uploaded",
      "document": {
        "id": 10,
        "document_type": "invoice",
        "file_name": "invoice.pdf",
        "display_name": "Invoice 123.pdf",
        "comment": "Original from client portal",
        "file_size": 204800,
        "uploaded_at": "2026-07-26T10:30:00Z",
        "uploaded_by_user_id": 7,
        "uploaded_by_name": "Manager User"
      }
    },
    {
      "client_uid": "b",
      "status": "failed",
      "error": "Unsupported file type"
    }
  ]
}
```

If the order itself cannot be created/updated, return the existing validation error and do not upload documents.

## Document Read Model

Extend `OrderDocument` responses from:

- `GET /api/v1/orders/{order_id}/documents`
- order detail payloads that embed `documents`

Required fields:

```json
{
  "id": 10,
  "order_id": 123,
  "document_type": "invoice",
  "file_name": "invoice.pdf",
  "display_name": "Invoice 123.pdf",
  "comment": "Original from client portal",
  "file_size": 204800,
  "uploaded_at": "2026-07-26T10:30:00Z",
  "uploaded_by_user_id": 7,
  "uploaded_by_name": "Manager User"
}
```

## Edit Saved Document Metadata

Add endpoint:

```http
PATCH /api/v1/orders/{order_id}/documents/{document_id}
Content-Type: application/json
```

Request:

```json
{
  "document_type": "packing_list",
  "display_name": "Packing List revised.pdf",
  "comment": "Updated after client correction"
}
```

Response:

```json
{
  "id": 10,
  "order_id": 123,
  "document_type": "packing_list",
  "file_name": "invoice.pdf",
  "display_name": "Packing List revised.pdf",
  "comment": "Updated after client correction",
  "file_size": 204800,
  "uploaded_at": "2026-07-26T10:30:00Z",
  "uploaded_by_user_id": 7,
  "uploaded_by_name": "Manager User"
}
```

Validation:

- `document_type` must be one of metadata options.
- Empty `display_name` falls back to original `file_name`.
- `comment` can be `null` or an empty string to clear it.

## Optional Dedicated Upload Endpoint

For real per-file progress and independent retries, add:

```http
POST /api/v1/orders/{order_id}/documents
Content-Type: multipart/form-data
```

Fields:

- `file`
- `document_type`
- `display_name`
- `comment`
- `client_uid`

Response should match one item from the partial success response.

This endpoint lets the frontend upload files one by one after order creation and show actual progress per file.
