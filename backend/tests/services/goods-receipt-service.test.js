import { jest, describe, test, expect } from '@jest/globals';
import {
  createGoodsReceipt,
  getGoodsReceiptById,
  listGoodsReceipts,
  postGoodsReceipt,
} from '../../src/services/goods-receipt-service.js';

// ── Helpers ──────────────────────────────────────────────

function validPayload(overrides = {}) {
  return {
    poId: 'po-1',
    receiptDate: '2026-09-10',
    notes: null,
    lines: [
      {
        poLineId: 'po-line-1',
        qtyReceived: 5,
        actualSiteCode: 'WH-JKT',
      },
    ],
    ...overrides,
  };
}

function mockClient(queryResponses) {
  return {
    query: jest.fn((sql, params) => queryResponses(sql, params)),
    release: jest.fn(),
  };
}

function mockDb(client, queryFn) {
  return {
    pool: { connect: jest.fn(() => Promise.resolve(client)) },
    query: jest.fn(queryFn || (() => ({ rows: [], rowCount: 0 }))),
  };
}

function detailQueryResponses(status = 'DRAFT') {
  return (sql) => {
    if (sql.includes('FROM goods_receipts gr')) {
      return {
        rows: [{
          id: 'gr-id', gr_number: 'GR-2026-0001', po_id: 'po-1', po_number: 'PO-2026-0001',
          status, receipt_date: '2026-09-10', notes: null,
          created_at: new Date(), updated_at: new Date(),
        }],
        rowCount: 1,
      };
    }
    if (sql.includes('FROM gr_lines')) {
      return {
        rows: [{
          id: 'gr-line-1', line_no: 1, po_line_id: 'po-line-1',
          item_code: 'BRG-001', item_name: 'Safety Helmet', qty_received: 5, actual_site_code: 'WH-JKT',
        }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };
}

function happyPathClientResponses() {
  return (sql) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('FROM purchase_orders WHERE id')) {
      return { rows: [{ id: 'po-1', status: 'SUBMITTED' }], rowCount: 1 };
    }
    if (sql.includes('FROM po_lines WHERE id') && sql.includes('AND po_id')) {
      return { rows: [{ id: 'po-line-1', qty_ordered: 10, qty_received: 2 }], rowCount: 1 };
    }
    if (sql.includes('COUNT(*)')) {
      return { rows: [{ total: 0 }], rowCount: 1 };
    }
    if (sql.startsWith('INSERT')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
}

// ─────────────────────────────────────────────────────────
// Payload Validation (via createGoodsReceipt)
// ─────────────────────────────────────────────────────────

describe('createGoodsReceipt – payload validation', () => {
  test('rejects when body is null', async () => {
    const db = mockDb(null);
    await expect(createGoodsReceipt(db, null))
      .rejects.toMatchObject({ message: 'Body is required', statusCode: 422 });
  });

  test('rejects when poId is missing', async () => {
    const db = mockDb(null);
    await expect(createGoodsReceipt(db, { lines: [{}] }))
      .rejects.toMatchObject({ message: 'poId is required', statusCode: 422 });
  });

  test('rejects when lines is empty array', async () => {
    const db = mockDb(null);
    await expect(createGoodsReceipt(db, { poId: 'po-1', lines: [] }))
      .rejects.toMatchObject({ message: 'lines must contain at least one item', statusCode: 422 });
  });

  test('rejects when poLineId is missing', async () => {
    const db = mockDb(null);
    const payload = validPayload({ lines: [{ qtyReceived: 5, actualSiteCode: 'WH' }] });
    await expect(createGoodsReceipt(db, payload))
      .rejects.toMatchObject({ message: 'lines[0].poLineId is required', statusCode: 422 });
  });

  test('rejects when actualSiteCode is missing', async () => {
    const db = mockDb(null);
    const payload = validPayload({ lines: [{ poLineId: 'po-line-1', qtyReceived: 5 }] });
    await expect(createGoodsReceipt(db, payload))
      .rejects.toMatchObject({ message: 'lines[0].actualSiteCode is required', statusCode: 422 });
  });

  test('rejects when qtyReceived is zero', async () => {
    const db = mockDb(null);
    const payload = validPayload({
      lines: [{ poLineId: 'po-line-1', qtyReceived: 0, actualSiteCode: 'WH' }],
    });
    await expect(createGoodsReceipt(db, payload))
      .rejects.toMatchObject({ message: 'lines[0].qtyReceived must be greater than 0', statusCode: 422 });
  });
});

// ─────────────────────────────────────────────────────────
// PO existence / status checks
// ─────────────────────────────────────────────────────────

describe('createGoodsReceipt – PO status and existence checks', () => {
  test('rejects when PO does not exist', async () => {
    const client = mockClient((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('FROM purchase_orders WHERE id')) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });
    const db = mockDb(client);

    await expect(createGoodsReceipt(db, validPayload()))
      .rejects.toMatchObject({ message: 'poId: purchase order not found', statusCode: 422 });

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('rejects when PO is not SUBMITTED', async () => {
    const client = mockClient((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('FROM purchase_orders WHERE id')) {
        return { rows: [{ id: 'po-1', status: 'DRAFT' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const db = mockDb(client);

    await expect(createGoodsReceipt(db, validPayload()))
      .rejects.toMatchObject({
        message: 'Purchase order must be SUBMITTED before receiving',
        statusCode: 422,
      });
  });
});

// ─────────────────────────────────────────────────────────
// Over-receipt Guard (create time)
// ─────────────────────────────────────────────────────────

describe('createGoodsReceipt – over-receipt guard', () => {
  test('rejects when receipt qty exceeds PO line open qty', async () => {
    const client = mockClient((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('FROM purchase_orders WHERE id')) {
        return { rows: [{ id: 'po-1', status: 'SUBMITTED' }], rowCount: 1 };
      }
      if (sql.includes('FROM po_lines WHERE id')) {
        return { rows: [{ id: 'po-line-1', qty_ordered: 10, qty_received: 8 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const db = mockDb(client);

    const payload = validPayload({ lines: [{ poLineId: 'po-line-1', qtyReceived: 5, actualSiteCode: 'WH' }] });

    await expect(createGoodsReceipt(db, payload))
      .rejects.toMatchObject({
        message: 'lines[0]: receipt qty 5 exceeds open qty 2',
        statusCode: 422,
      });

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('rejects when PO line does not exist', async () => {
    const client = mockClient((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('FROM purchase_orders WHERE id')) {
        return { rows: [{ id: 'po-1', status: 'SUBMITTED' }], rowCount: 1 };
      }
      if (sql.includes('FROM po_lines WHERE id')) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });
    const db = mockDb(client);

    await expect(createGoodsReceipt(db, validPayload()))
      .rejects.toMatchObject({ message: 'lines[0]: PO line not found', statusCode: 422 });
  });
});

// ─────────────────────────────────────────────────────────
// Successful GR Creation
// ─────────────────────────────────────────────────────────

describe('createGoodsReceipt – success path', () => {
  test('creates GR and returns detail with DRAFT status', async () => {
    const client = mockClient(happyPathClientResponses());
    const db = mockDb(client, detailQueryResponses());

    const result = await createGoodsReceipt(db, validPayload());

    expect(result.grNumber).toBe('GR-2026-0001');
    expect(result.status).toBe('DRAFT');
    expect(result.lines).toHaveLength(1);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  test('rolls back and releases client on unexpected error', async () => {
    const client = mockClient((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('FROM purchase_orders WHERE id')) {
        return { rows: [{ id: 'po-1', status: 'SUBMITTED' }], rowCount: 1 };
      }
      if (sql.includes('FROM po_lines WHERE id')) {
        return { rows: [{ id: 'po-line-1', qty_ordered: 10, qty_received: 0 }], rowCount: 1 };
      }
      if (sql.includes('COUNT(*)')) {
        throw new Error('DB connection lost');
      }
      return { rows: [], rowCount: 0 };
    });
    const db = mockDb(client);

    await expect(createGoodsReceipt(db, validPayload())).rejects.toThrow('DB connection lost');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────
// Post GR – Status Transition & Qty Cascade
// ─────────────────────────────────────────────────────────

describe('postGoodsReceipt – status transition', () => {
  test('returns null when GR does not exist', async () => {
    const db = mockDb(null, () => ({ rows: [], rowCount: 0 }));

    const result = await postGoodsReceipt(db, 'non-existent-id');
    expect(result).toBeNull();
  });

  test('rejects when GR is already POSTED', async () => {
    const db = mockDb(null, (sql) => {
      if (sql.includes('SELECT id, status FROM goods_receipts')) {
        return { rows: [{ id: 'gr-1', status: 'POSTED' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(postGoodsReceipt(db, 'gr-1'))
      .rejects.toMatchObject({ message: 'Only DRAFT goods receipt can be posted', statusCode: 422 });
  });

  test('rejects and rolls back when receipt qty exceeds PO line open qty', async () => {
    const client = mockClient((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('FROM gr_lines WHERE gr_id')) {
        return { rows: [{ po_line_id: 'po-line-1', qty_received: 5 }], rowCount: 1 };
      }
      if (sql.includes('FROM po_lines WHERE id') && sql.includes('FOR UPDATE')) {
        return { rows: [{ id: 'po-line-1', qty_ordered: 10, qty_received: 8 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const db = mockDb(client, (sql) => {
      if (sql.includes('SELECT id, status FROM goods_receipts')) {
        return { rows: [{ id: 'gr-1', status: 'DRAFT' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(postGoodsReceipt(db, 'gr-1'))
      .rejects.toMatchObject({
        message: 'PO line po-line-1: receipt qty 5 exceeds open qty 2',
        statusCode: 422,
      });

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('posts a DRAFT GR and cascades received qty to PO line and PR line', async () => {
    const client = mockClient((sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('FROM gr_lines WHERE gr_id')) {
        return { rows: [{ po_line_id: 'po-line-1', qty_received: 5 }], rowCount: 1 };
      }
      if (sql.includes('FROM po_lines WHERE id') && sql.includes('FOR UPDATE')) {
        return { rows: [{ id: 'po-line-1', qty_ordered: 10, qty_received: 0 }], rowCount: 1 };
      }
      if (sql.startsWith('UPDATE po_lines')) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('FROM pr_line_allocations WHERE po_line_id')) {
        return { rows: [{ pr_line_id: 'pr-line-1', allocated_qty: 5 }], rowCount: 1 };
      }
      if (sql.startsWith('UPDATE pr_lines')) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('UPDATE goods_receipts')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const db = mockDb(client, (sql) => {
      if (sql.includes('SELECT id, status FROM goods_receipts')) {
        return { rows: [{ id: 'gr-1', status: 'DRAFT' }], rowCount: 1 };
      }
      return detailQueryResponses('POSTED')(sql);
    });

    const result = await postGoodsReceipt(db, 'gr-1');

    expect(result.status).toBe('POSTED');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE po_lines'),
      [5, 'po-line-1'],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE pr_lines'),
      [5, 'pr-line-1'],
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });
});

// ─────────────────────────────────────────────────────────
// Listing / Detail Mapping
// ─────────────────────────────────────────────────────────

describe('listGoodsReceipts / getGoodsReceiptById', () => {
  test('lists goods receipts mapped from rows', async () => {
    const db = mockDb(null, () => ({
      rows: [{
        id: 'gr-1', gr_number: 'GR-2026-0001', po_id: 'po-1', po_number: 'PO-2026-0001',
        status: 'DRAFT', receipt_date: '2026-09-10', created_at: new Date(), updated_at: new Date(),
      }],
      rowCount: 1,
    }));

    const items = await listGoodsReceipts(db);
    expect(items).toHaveLength(1);
    expect(items[0].grNumber).toBe('GR-2026-0001');
    expect(items[0].poNumber).toBe('PO-2026-0001');
  });

  test('returns null when GR is not found', async () => {
    const db = mockDb(null, () => ({ rows: [], rowCount: 0 }));

    const result = await getGoodsReceiptById(db, 'missing-id');
    expect(result).toBeNull();
  });
});
