# Procurement MVP Runbook

## Objective
Build the workshop MVP with the existing PR baseline as fixed context and the Purchase Order backlog as the delivery target. Keep the implementation intentionally narrow, teachable, and aligned with the repo constraints.

## Scope boundaries
- In scope: PR baseline, PO list/create/detail, PO APIs, PO validations, minimal PO UI flow, focused unit/e2e checks.
- Out of scope: GR module implementation, enterprise controls, advanced approval engine, reporting, notifications, SSO, and any broader procurement features beyond the workshop MVP.
- Workshop-first principle: prefer clarity and small modules over production-hardening complexity.

## MVP flow
1. Create and submit a Purchase Requisition.
2. Approve the PR.
3. Create a Purchase Order from approved PR lines.
4. Submit the PO.
5. Inspect PO detail and open lines.
6. Stop before GR work begins.

## Current state (verified against the code)
- Backend PO API + service: DONE — routes (list/create/submit/detail/open-lines) in `backend/src/routes/purchase-order-routes.js` and service logic in `backend/src/services/purchase-order-service.js`, including the over-allocation guard with `FOR UPDATE` row locking and the `DRAFT -> SUBMITTED` transition.
- Backend Jest tests: PRESENT at `backend/tests/services/purchase-order-service.test.js` (run to confirm green).
- Frontend PO pages: PRESENT — PO routes, nav link, pages (list/create/detail), and PO methods in `frontend/src/api.js` are implemented.
- Playwright E2E: MISSING — no `.spec.js` files exist.
- The PR open-lines API (`getRequisitionOpenLines`) already exists and is the allocation source for PO create.

## Strict task sequence and checkpoints
Each checkpoint is a hard gate. Do not proceed while a checkpoint is red.

### CP0) Baseline verification gate
- Start the DB (`docker compose up -d db`) and run backend + frontend; confirm the PR flow works.
- Run backend Jest (`npm test` in `backend/`); confirm PO service tests are green.
- Checkpoint: app boots, PR flow works, existing PO service tests pass. STOP if red.

### CP1) Frontend API client (blocks CP2-CP4)
- Add PO methods to `frontend/src/api.js`: `listPurchaseOrders`, `getPurchaseOrder`, `createPurchaseOrder`, `submitPurchaseOrder`, reusing `apiFetch`.
- Checkpoint: PO methods succeed against the running backend.

### CP2) Routing and navigation (after CP1)
- Add three routes to `frontend/src/router/index.js`: list `/purchase-orders`, create `/purchase-orders/new`, detail `/purchase-orders/:id` (`props: true`).
- Add a "Purchase Orders" RouterLink and `isPurchaseOrders` computed to `frontend/src/App.vue`.
- Checkpoint: nav link renders and routes resolve (blank pages acceptable).

### CP3) PO pages (depends on CP1 + CP2)
- `PurchaseOrderListPage.vue` — mirror `RequisitionListPage.vue`: table (PO number, vendor, status), "+ New PO" link, row link to detail.
- `PurchaseOrderCreatePage.vue` — mirror `RequisitionCreatePage.vue`: pick an APPROVED PR (filter `listRequisitions` where status is APPROVED), load its open lines via `getRequisitionOpenLines`, allocate `qtyOrdered` per line, enter vendor, submit via `createPurchaseOrder`, redirect to detail. Client-side guard: `qtyOrdered <= remaining` (server still enforces 422).
- `PurchaseOrderDetailPage.vue` — mirror `RequisitionDetailPage.vue`: header, status badge, lines table, allocation source (`prNumber`), Submit button shown only for DRAFT via `submitPurchaseOrder`.
- Checkpoint: create a PO from an approved PR line, submit it, and the detail shows SUBMITTED without errors.

### CP4) PO-focused testing (depends on CP0 backend + CP3 frontend)
- Confirm/extend Jest: reject over-allocation, reject invalid status transition (equal-to-remaining allowed; exceeds-remaining rejected).
- Add a Playwright spec under `tests/*.spec.js` (none exist): PR baseline -> PO create -> PO submit -> PO detail assertions. Wire `playwright.config.js` if needed.
- Checkpoint: Jest and Playwright suites pass.

### CP5) Review gate
- Open a PR, run Copilot review, and fix findings.
- Checkpoint: reviewed; no emoji in UI or commits; baseline CSS variables respected.

### Hard stop before GR work
- Stop once the PO backlog is complete and demonstrable.
- Do not start GR implementation or broaden to advanced procurement features in this sprint.
- Checkpoint: team agrees the MVP is complete; remaining items are follow-up backlog.

## Acceptance criteria for the PO backlog
- A PO can be created from approved PR lines.
- A PO cannot exceed the remaining available quantity on the source PR line.
- PO detail correctly shows the linked source PR information and line allocations.
- PO open-lines reflects only quantities still available for GR treatment.
- The PO can be submitted once created.
- The app remains aligned with the baseline PR flows and minimal workshop requirements.

## Files to use as reference
- [docs/plan.md](docs/plan.md)
- [AGENTS.md](AGENTS.md)
- [backend/src/services/purchase-order-service.js](backend/src/services/purchase-order-service.js)
- [backend/tests/services/purchase-order-service.test.js](backend/tests/services/purchase-order-service.test.js)
- [backend/src/routes/purchase-order-routes.js](backend/src/routes/purchase-order-routes.js)

## Exit criteria
The sprint is complete when:
- all PO tests pass,
- the PO API contract is working,
- the minimal PO flow is visible in the UI,
- GR work remains excluded,
- the workshop demo can be run without scope creep.
