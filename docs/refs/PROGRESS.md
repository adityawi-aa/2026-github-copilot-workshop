# Procurement MVP - Project Progress & State

**Last reviewed:** 2026-09-03

## 1. Repository Summary

This repository is a workshop-sized procurement management MVP. Its intended flow is:

1. Create a Purchase Requisition (PR).
2. Submit and approve the PR.
3. Create a Purchase Order (PO) from approved PR lines.
4. Submit the PO.
5. Create a Goods Receipt (GR) from the submitted PO's open lines.
6. Post the GR, which updates PO and PR received quantities.
7. Open the PR detail to see linked PO/GR and quantities.

The codebase uses Fastify and PostgreSQL on the backend, Vue 3 and Vite on the frontend, Jest for backend tests, Vitest for frontend tests, and Playwright for planned end-to-end coverage. PostgreSQL is bootstrapped through Docker using the migration and seed files under `db/`.

The database schema includes PR, PO, allocation, and GR tables. PR and PO were the original workshop baseline/backlog. GR (routes, services, pages, and business logic) has since been implemented as a further-exploration reference on top of that baseline.

## 2. Implemented Features

### Backend

- Fastify application setup with CORS, Swagger UI at `/api-docs`, PostgreSQL plugin, PR routes, PO routes, GR routes, and `/health`.
- PR service and routes for listing, creating, viewing, submitting, approving, and retrieving open PR lines.
- PR detail (`GET /api/requisitions/:id`) includes a `linkedPurchaseOrders` array per line (PO id, PO number, allocated qty), joined via `pr_line_allocations`.
- PO service and routes for listing, creating, viewing, submitting, and retrieving open PO lines.
- PO creation validates the request body, vendor name, line fields, positive quantities, and non-negative unit prices.
- PO allocation only accepts PR lines whose requisition is `APPROVED`.
- PO allocation quantity cannot exceed the PR line's remaining quantity (`qty_requested - qty_allocated`).
- PO creation uses a database transaction and locks referenced PR lines with `SELECT ... FOR UPDATE` before allocation.
- A successful PO starts in `DRAFT`; submission transitions it to `SUBMITTED`.
- Failed PO creation rolls back the transaction and releases the database client.
- PO detail maps line allocations back to their source PR number and line ID.
- PO open lines include only lines where `qtyOrdered - qtyReceived > 0`.
- GR service and routes for listing, creating (`DRAFT`), viewing, and posting (`DRAFT` → `POSTED`).
- GR creation requires the referenced PO to be `SUBMITTED`, validates each line's `poLineId`/`actualSiteCode`/`qtyReceived`, and rejects a receipt qty that exceeds the PO line's currently committed open qty. No quantities are mutated at create time.
- GR posting locks each referenced `po_lines` row with `SELECT ... FOR UPDATE`, re-validates the open qty, updates `po_lines.qty_received`, and cascades the same delta to `pr_lines.qty_received` via `pr_line_allocations` (split proportionally by `allocated_qty` when a PO line has more than one allocation).
- Failed GR create/post rolls back the transaction and releases the database client.

### Frontend

- Dashboard page with PR statistics and recent requisitions.
- PR list, create, and detail pages with the existing PR workflow; PR detail now shows a "QTY Received" column and a "Linked PO" column per line.
- PO list, create, and detail pages, fully wired to the backend PO API (list/create/detail/submit).
- PO create page pulls open lines from approved PRs, allocates quantities with client-side validation mirroring the server rule, and supports "Save as Draft" and "Submit PO".
- PO detail page shows a "Create GR" button when the PO is `SUBMITTED` and has at least one line with open qty for GR.
- GR list, create, and detail pages, fully wired to the backend GR API (list/create/detail/post).
- GR create page accepts a `poId` route query (from the PO detail button) or lets the user pick a `SUBMITTED` PO from a dropdown, loads that PO's open lines via `GET /api/purchase-orders/:id/open-lines`, and supports "Save as Draft" and "Post GR" with client-side qty/site validation mirroring the server rules.
- Navigation includes a top-level "Goods Receipts" link alongside "Purchase Requisitions" and "Purchase Orders".

### Automated Tests

- Backend Jest: 45 tests passing across the PR, PO, and GR service suites (3 suites).
- Frontend Vitest: 36 tests passing across dashboard, PR, PO, and GR pages/components (10 files).
- Playwright E2E: `tests/e2e/po-module.spec.js` covers the PR → PO flow. No GR end-to-end spec exists yet.

## 3. Available API Endpoints

All endpoints use JSON responses. Validation and business-rule failures return `{ "message": "..." }`.

### Purchase Order (`backend/src/routes/purchase-order-routes.js`)

| Method | Endpoint | Purpose | Success response | Error responses |
| --- | --- | --- | --- | --- |
| `GET` | `/api/purchase-orders` | List all POs, newest first | `200`: `{ items: [...] }` with header fields `id`, `poNumber`, `status`, `vendorName`, `createdAt`, and `updatedAt` | Backend error handling applies |
| `POST` | `/api/purchase-orders` | Create a PO and allocate quantities against approved PR lines | `201`: PO detail object; newly created PO has `DRAFT` status | `422`: invalid body, missing fields, missing PR line, non-approved PR, or over-allocation |
| `GET` | `/api/purchase-orders/:id` | Return a PO header, lines, and source PR allocations | `200`: PO detail object; each line includes `qtyOpenForGr` and `allocations` | `404`: `{ message: "Purchase order not found" }` |
| `POST` | `/api/purchase-orders/:id/submit` | Transition a PO from `DRAFT` to `SUBMITTED` | `200`: updated PO detail object | `404`: PO not found; `422`: PO is not `DRAFT` |
| `GET` | `/api/purchase-orders/:id/open-lines` | Return PO lines still available for GR | `200`: `{ purchaseOrder: { id, poNumber, status }, openLines: [...] }` | `404`: `{ message: "Purchase order not found" }` |

#### PO Create Request Body

```json
{
  "vendorName": "PT Supplier Jaya",
  "lines": [
    {
      "prLineId": "approved-pr-line-uuid",
      "itemCode": "BRG-001",
      "itemName": "Safety Helmet",
      "qtyOrdered": 5,
      "unitPrice": 150000,
      "uom": "PCS",
      "siteCode": "WH-JKT",
      "requiredDate": "2026-09-30"
    }
  ]
}
```

`requiredDate` is optional. Each line must include `prLineId`, `itemCode`, `itemName`, `uom`, and `siteCode`; `qtyOrdered` must be greater than zero and `unitPrice` must be zero or greater.

#### PO Detail Shape

PO detail responses contain header fields plus `lines`. A line contains `id`, `lineNo`, `itemCode`, `itemName`, `qtyOrdered`, `qtyReceived`, `qtyOpenForGr`, `uom`, `unitPrice`, `siteCode`, `requiredDate`, and `allocations`. Each allocation contains `prLineId`, `prNumber`, and `allocatedQty`.

### Goods Receipt (`backend/src/routes/goods-receipt-routes.js`)

| Method | Endpoint | Purpose | Success response | Error responses |
| --- | --- | --- | --- | --- |
| `GET` | `/api/goods-receipts` | List all GRs, newest first | `200`: `{ items: [...] }` with header fields `id`, `grNumber`, `poId`, `poNumber`, `status`, `receiptDate`, `createdAt`, and `updatedAt` | Backend error handling applies |
| `POST` | `/api/goods-receipts` | Create a GR (`DRAFT`) against a `SUBMITTED` PO's open lines | `201`: GR detail object; newly created GR has `DRAFT` status | `422`: invalid body, missing fields, PO not found, PO not `SUBMITTED`, PO line not found, or receipt qty exceeds open qty |
| `GET` | `/api/goods-receipts/:id` | Return a GR header and lines | `200`: GR detail object | `404`: `{ message: "Goods receipt not found" }` |
| `POST` | `/api/goods-receipts/:id/post` | Transition a GR from `DRAFT` to `POSTED`, cascading received qty to PO/PR lines | `200`: updated GR detail object | `404`: GR not found; `422`: GR is not `DRAFT`, or receipt qty exceeds the PO line's currently open qty |

#### GR Create Request Body

```json
{
  "poId": "submitted-po-uuid",
  "receiptDate": "2026-09-10",
  "notes": "Partial delivery",
  "lines": [
    {
      "poLineId": "po-line-uuid",
      "qtyReceived": 5,
      "actualSiteCode": "WH-JKT"
    }
  ]
}
```

`receiptDate` and `notes` are optional. Each line must include `poLineId` and `actualSiteCode`; `qtyReceived` must be greater than zero and must not exceed the PO line's open qty (`qtyOrdered - qtyReceived`) at the time of creation.

#### GR Detail Shape

GR detail responses contain header fields (`id`, `grNumber`, `poId`, `poNumber`, `status`, `receiptDate`, `notes`, `createdAt`, `updatedAt`) plus `lines`. A line contains `id`, `lineNo`, `poLineId`, `itemCode`, `itemName`, `qtyReceived`, and `actualSiteCode`.

## 4. Current Gaps and Next Work

The PO and GR modules are both implemented end-to-end (backend services/routes + frontend pages) and covered by service-level and component/page tests. Remaining work:

1. Add a Playwright e2e flow covering PR approval → PO create/submit → GR create/post → PR/PO detail quantity assertions.
2. Consider list-page filters for GR (e.g., by PO number or status) if the workshop wants to explore that further.
3. Bookmark feature (`PR`/`PO`/`GR`) remains a post-backlog optional exercise, intended to be driven via GitHub Issue-based development.

Advanced approval workflows, reporting, notifications, SSO, and enterprise compliance features remain out of scope by design (see [docs/plan.md](../plan.md)).

## 5. Verification

The following commands were run from the `backend` and `frontend` directories on 2026-09-03:

```text
cd backend && npm test
cd frontend && npx vitest run
```

Result: backend Jest passed with 3 suites and 45 tests (PR, PO, GR services); frontend Vitest passed with 10 files and 36 tests (dashboard, PR, PO, GR pages/components). No Playwright E2E run was performed in this pass; the existing `tests/e2e/po-module.spec.js` spec covers the PR → PO flow only.
