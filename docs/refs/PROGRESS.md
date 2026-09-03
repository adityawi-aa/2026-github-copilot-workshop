# Procurement MVP - Project Progress & State

**Last reviewed:** 2026-09-03

## 1. Repository Summary

This repository is a workshop-sized procurement management MVP. Its intended flow is:

1. Create a Purchase Requisition (PR).
2. Submit and approve the PR.
3. Create a Purchase Order (PO) from approved PR lines.
4. Submit the PO.
5. Use PO open lines as the source for future Goods Receipt (GR) work.

The codebase uses Fastify and PostgreSQL on the backend, Vue 3 and Vite on the frontend, Jest for backend tests, Vitest for frontend tests, and Playwright for planned end-to-end coverage. PostgreSQL is bootstrapped through Docker using the migration and seed files under `db/`.

The database schema includes PR, PO, allocation, and GR tables. GR tables exist in the schema, but GR routes, services, pages, and business logic are not implemented in this workshop sprint.

## 2. Implemented Features

### Backend

- Fastify application setup with CORS, Swagger UI at `/api-docs`, PostgreSQL plugin, PR routes, PO routes, and `/health`.
- PR service and routes for listing, creating, viewing, submitting, approving, and retrieving open PR lines.
- PO service and routes for listing, creating, viewing, submitting, and retrieving open PO lines.
- PO creation validates the request body, vendor name, line fields, positive quantities, and non-negative unit prices.
- PO allocation only accepts PR lines whose requisition is `APPROVED`.
- PO allocation quantity cannot exceed the PR line's remaining quantity (`qty_requested - qty_allocated`).
- PO creation uses a database transaction and locks referenced PR lines with `SELECT ... FOR UPDATE` before allocation.
- A successful PO starts in `DRAFT`; submission transitions it to `SUBMITTED`.
- Failed PO creation rolls back the transaction and releases the database client.
- PO detail maps line allocations back to their source PR number and line ID.
- PO open lines include only lines where `qtyOrdered - qtyReceived > 0`.

### Frontend

- Dashboard page with PR statistics and recent requisitions.
- PR list, create, and detail pages with the existing PR workflow.
- PO navigation link and `/purchase-orders/new` route.
- PO create page with reusable header and line-allocation components.
- PO create UI supports adding/removing lines, selected-line counting, estimated-total calculation, vendor validation, and local placeholder messages for draft/save and submit actions.

The PO create page is currently presentation-only: it does not call the backend PO API and does not yet load approved PR open lines.

### Automated Tests

- Backend Jest: 27 tests passing across the PR and PO service suites.
- Frontend Vitest: 13 tests passing across the dashboard, PO create page, PO header form, and PO line allocation table.
- Playwright E2E specs are not present yet.

## 3. Available PO API Endpoints

All endpoints are registered by `backend/src/routes/purchase-order-routes.js` and use JSON responses. Validation and business-rule failures return `{ "message": "..." }`.

| Method | Endpoint | Purpose | Success response | Error responses |
| --- | --- | --- | --- | --- |
| `GET` | `/api/purchase-orders` | List all POs, newest first | `200`: `{ items: [...] }` with header fields `id`, `poNumber`, `status`, `vendorName`, `createdAt`, and `updatedAt` | Backend error handling applies |
| `POST` | `/api/purchase-orders` | Create a PO and allocate quantities against approved PR lines | `201`: PO detail object; newly created PO has `DRAFT` status | `422`: invalid body, missing fields, missing PR line, non-approved PR, or over-allocation |
| `GET` | `/api/purchase-orders/:id` | Return a PO header, lines, and source PR allocations | `200`: PO detail object; each line includes `qtyOpenForGr` and `allocations` | `404`: `{ message: "Purchase order not found" }` |
| `POST` | `/api/purchase-orders/:id/submit` | Transition a PO from `DRAFT` to `SUBMITTED` | `200`: updated PO detail object | `404`: PO not found; `422`: PO is not `DRAFT` |
| `GET` | `/api/purchase-orders/:id/open-lines` | Return PO lines still available for GR | `200`: `{ purchaseOrder: { id, poNumber, status }, openLines: [...] }` | `404`: `{ message: "Purchase order not found" }` |

### PO Create Request Body

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

### PO Detail Shape

PO detail responses contain header fields plus `lines`. A line contains `id`, `lineNo`, `itemCode`, `itemName`, `qtyOrdered`, `qtyReceived`, `qtyOpenForGr`, `uom`, `unitPrice`, `siteCode`, `requiredDate`, and `allocations`. Each allocation contains `prLineId`, `prNumber`, and `allocatedQty`.

## 4. Current Gaps and Next Work

The backend PO module is implemented and covered by service tests. The remaining PO backlog is primarily frontend integration:

1. Add `listPurchaseOrders`, `getPurchaseOrder`, `createPurchaseOrder`, and `submitPurchaseOrder` to `frontend/src/api.js`.
2. Connect the PO create page to approved PR listing/open-lines data and the create endpoint.
3. Add PO list and PO detail pages and register their routes.
4. Replace the PO page's local placeholder actions with API calls and navigation.
5. Add a Playwright flow covering PR creation/approval through PO creation, submission, and detail verification.

GR implementation remains outside the current workshop scope. Advanced approval workflows, reporting, notifications, SSO, and enterprise compliance features are also out of scope.

## 5. Verification

The following command was run from the repository root on 2026-09-03:

```text
npm test
```

Result: backend Jest passed with 2 suites and 27 tests; frontend Vitest passed with 4 files and 13 tests. No Playwright E2E suite was run because no E2E spec files are currently present.
