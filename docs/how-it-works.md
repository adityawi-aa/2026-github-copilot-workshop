# How the Application Works

Procurement MVP covering Purchase Requisition (PR) and Purchase Order (PO). Goods Receipt (GR) is out of scope for this build (data model exists, no API/UI).

## Stack
- Frontend: Vue 3 + Vite (`frontend/`) calling REST API via `frontend/src/api.js`
- Backend: Fastify REST API (`backend/src/`)
- Database: PostgreSQL (Docker), schema in `db/migrations/001_init_procurement_mvp.sql`

## Modules & Status Lifecycles
- **PR**: `DRAFT -> SUBMITTED -> APPROVED`
- **PO**: `DRAFT -> SUBMITTED`

## Implemented API Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/requisitions` | List PRs |
| POST | `/api/requisitions` | Create PR (header + lines) |
| POST | `/api/requisitions/:id/submit` | DRAFT -> SUBMITTED |
| POST | `/api/requisitions/:id/approve` | SUBMITTED -> APPROVED |
| GET | `/api/requisitions/:id` | PR detail with lines |
| GET | `/api/requisitions/:id/open-lines` | PR lines with remaining qty > 0 |
| GET | `/api/purchase-orders` | List POs |
| POST | `/api/purchase-orders` | Create PO from approved PR lines |
| POST | `/api/purchase-orders/:id/submit` | DRAFT -> SUBMITTED |
| GET | `/api/purchase-orders/:id` | PO detail with lines + PR allocation source |
| GET | `/api/purchase-orders/:id/open-lines` | PO lines not fully received |

## Key Business Rule
When creating a PO, each line references a `prLineId`. The service (`purchase-order-service.js`):
1. Locks the PR line row (`FOR UPDATE`).
2. Requires the parent PR status to be `APPROVED`.
3. Requires `qtyOrdered <= (pr_line.qty_requested - pr_line.qty_allocated)`.
4. Inserts the PO + PO lines + a `pr_line_allocations` bridge row, and increments `pr_lines.qty_allocated`, all inside one transaction.

If any line fails validation, the whole PO creation is rejected (422) and nothing is written.

## Pages & Navigation

```mermaid
flowchart TD
  HOME[Home / Dashboard]
  PRL[PR List]
  PRC[PR Create]
  PRD[PR Detail]
  POL[PO List]
  POC[PO Create]
  POD[PO Detail]

  HOME --> PRL
  HOME --> POL
  PRL --> PRC
  PRL --> PRD
  PRC --> PRD
  POL --> POC
  POL --> POD
  POC --> POD
```

## End-to-End User Flow

```mermaid
flowchart LR
  A[Create PR draft with lines] --> B[Submit PR]
  B --> C[Approve PR]
  C --> D[Open PR to view open lines]
  D --> E[Create PO: pick approved PR open lines + allocate qty]
  E --> F{Allocation valid?}
  F -- No: exceeds remaining qty or PR not approved --> D
  F -- Yes --> G[PO saved as DRAFT, PR qty_allocated updated]
  G --> H[Submit PO]
  H --> I[PO status SUBMITTED]
```

## Sequence: Create Purchase Requisition

```mermaid
sequenceDiagram
    actor User
    participant FE as Vue Frontend
    participant API as Fastify API
    participant SVC as requisition-service
    participant DB as PostgreSQL

    User->>FE: Fill PR header + lines, click Save
    FE->>API: POST /api/requisitions
    API->>SVC: createRequisition(payload)
    SVC->>SVC: validateCreatePayload()
    alt invalid payload
        SVC-->>API: throw 422 error
        API-->>FE: 422 { message }
        FE-->>User: Show validation error
    else valid payload
        SVC->>DB: BEGIN
        SVC->>DB: INSERT purchase_requisitions (status=DRAFT)
        SVC->>DB: INSERT pr_lines (per line)
        SVC->>DB: COMMIT
        SVC->>DB: SELECT PR + lines
        DB-->>SVC: PR row + lines
        SVC-->>API: PR object
        API-->>FE: 201 PR object
        FE-->>User: Redirect to PR Detail
    end
```

## Sequence: Create Purchase Order from Approved PR Lines

```mermaid
sequenceDiagram
    actor User
    participant FE as Vue Frontend
    participant API as Fastify API
    participant SVC as purchase-order-service
    participant DB as PostgreSQL

    User->>FE: Open PO Create, pick PR + open lines, enter allocations
    FE->>API: GET /api/requisitions/:id/open-lines
    API-->>FE: PR open lines (qtyOpenForPo > 0)
    User->>FE: Set vendor + qtyOrdered per line, click Save
    FE->>API: POST /api/purchase-orders
    API->>SVC: createPurchaseOrder(payload)
    SVC->>SVC: validateCreatePayload()
    alt invalid payload shape
        SVC-->>API: throw 422
        API-->>FE: 422 { message }
    else payload shape ok
        SVC->>DB: BEGIN
        loop each line
            SVC->>DB: SELECT pr_lines ... FOR UPDATE
            DB-->>SVC: qty_requested, qty_allocated, pr.status
            SVC->>SVC: check pr.status == APPROVED
            SVC->>SVC: check qtyOrdered <= remaining
            alt rule violated
                SVC->>DB: ROLLBACK
                SVC-->>API: throw 422 (not approved / over-allocation)
                API-->>FE: 422 { message }
                FE-->>User: Show error, no PO created
            end
        end
        SVC->>DB: INSERT purchase_orders (status=DRAFT)
        loop each line
            SVC->>DB: INSERT po_lines
            SVC->>DB: INSERT pr_line_allocations
            SVC->>DB: UPDATE pr_lines SET qty_allocated += allocated_qty
        end
        SVC->>DB: COMMIT
        SVC-->>API: PO object
        API-->>FE: 201 PO object
        FE-->>User: Redirect to PO Detail
    end
```

## Sequence: Submit Purchase Order

```mermaid
sequenceDiagram
    actor User
    participant FE as Vue Frontend
    participant API as Fastify API
    participant SVC as purchase-order-service
    participant DB as PostgreSQL

    User->>FE: Click Submit on PO Detail
    FE->>API: POST /api/purchase-orders/:id/submit
    API->>SVC: submitPurchaseOrder(id)
    SVC->>DB: SELECT status WHERE id
    alt not found
        SVC-->>API: null
        API-->>FE: 404
    else status != DRAFT
        SVC-->>API: throw 422 "Only DRAFT purchase order can be submitted"
        API-->>FE: 422 { message }
    else status == DRAFT
        SVC->>DB: UPDATE status = SUBMITTED
        SVC->>DB: SELECT PO + lines + allocations
        SVC-->>API: PO object
        API-->>FE: 200 PO object
        FE-->>User: Show SUBMITTED status
    end
```
