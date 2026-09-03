import { v4 as uuidv4 } from 'uuid';

// ── Mappers ──────────────────────────────────────────────

function mapHeader(row) {
  return {
    id: row.id,
    grNumber: row.gr_number,
    poId: row.po_id,
    poNumber: row.po_number,
    status: row.status,
    receiptDate: row.receipt_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLine(row) {
  return {
    id: row.id,
    lineNo: row.line_no,
    poLineId: row.po_line_id,
    itemCode: row.item_code,
    itemName: row.item_name,
    qtyReceived: Number(row.qty_received),
    actualSiteCode: row.actual_site_code,
  };
}

function createGrNumber(count) {
  const next = String(Number(count) + 1).padStart(4, '0');
  return `GR-2026-${next}`;
}

// ── Validation ───────────────────────────────────────────

function validateCreatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Body is required';
  }

  if (!payload.poId || typeof payload.poId !== 'string') {
    return 'poId is required';
  }

  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    return 'lines must contain at least one item';
  }

  for (let i = 0; i < payload.lines.length; i++) {
    const line = payload.lines[i];

    if (!line.poLineId) {
      return `lines[${i}].poLineId is required`;
    }

    if (!line.actualSiteCode) {
      return `lines[${i}].actualSiteCode is required`;
    }

    if (!Number(line.qtyReceived) || Number(line.qtyReceived) <= 0) {
      return `lines[${i}].qtyReceived must be greater than 0`;
    }
  }

  return null;
}

// ── Queries ──────────────────────────────────────────────

export async function listGoodsReceipts(db) {
  const { rows } = await db.query(
    `SELECT gr.id, gr.gr_number, gr.po_id, po.po_number, gr.status, gr.receipt_date, gr.created_at, gr.updated_at
     FROM goods_receipts gr
     JOIN purchase_orders po ON po.id = gr.po_id
     ORDER BY gr.created_at DESC`
  );

  return rows.map(mapHeader);
}

export async function getGoodsReceiptById(db, id) {
  const headerResult = await db.query(
    `SELECT gr.*, po.po_number
     FROM goods_receipts gr
     JOIN purchase_orders po ON po.id = gr.po_id
     WHERE gr.id = $1`,
    [id]
  );

  if (headerResult.rowCount === 0) {
    return null;
  }

  const linesResult = await db.query(
    `SELECT gl.*, pl.item_code, pl.item_name
     FROM gr_lines gl
     JOIN po_lines pl ON pl.id = gl.po_line_id
     WHERE gl.gr_id = $1
     ORDER BY gl.line_no ASC`,
    [id]
  );

  return {
    ...mapHeader(headerResult.rows[0]),
    lines: linesResult.rows.map(mapLine),
  };
}

// ── Create GR (DRAFT, no quantity mutation yet) ──────────

export async function createGoodsReceipt(db, payload) {
  const validationError = validateCreatePayload(payload);
  if (validationError) {
    const err = new Error(validationError);
    err.statusCode = 422;
    throw err;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const poResult = await client.query(
      `SELECT id, status FROM purchase_orders WHERE id = $1 FOR UPDATE`,
      [payload.poId]
    );

    if (poResult.rowCount === 0) {
      const err = new Error('poId: purchase order not found');
      err.statusCode = 422;
      throw err;
    }

    if (poResult.rows[0].status !== 'SUBMITTED') {
      const err = new Error('Purchase order must be SUBMITTED before receiving');
      err.statusCode = 422;
      throw err;
    }

    // Validate every referenced PO line against its currently committed open qty.
    for (let i = 0; i < payload.lines.length; i++) {
      const line = payload.lines[i];

      const poLineResult = await client.query(
        `SELECT id, qty_ordered, qty_received FROM po_lines WHERE id = $1 AND po_id = $2`,
        [line.poLineId, payload.poId]
      );

      if (poLineResult.rowCount === 0) {
        const err = new Error(`lines[${i}]: PO line not found`);
        err.statusCode = 422;
        throw err;
      }

      const poLine = poLineResult.rows[0];
      const open = Number(poLine.qty_ordered) - Number(poLine.qty_received);
      if (Number(line.qtyReceived) > open) {
        const err = new Error(
          `lines[${i}]: receipt qty ${line.qtyReceived} exceeds open qty ${open}`
        );
        err.statusCode = 422;
        throw err;
      }
    }

    const countResult = await client.query(`SELECT COUNT(*)::int AS total FROM goods_receipts`);
    const grNumber = createGrNumber(countResult.rows[0].total);
    const grId = uuidv4();

    await client.query(
      `INSERT INTO goods_receipts (id, gr_number, po_id, status, receipt_date, notes)
       VALUES ($1, $2, $3, 'DRAFT', $4, $5)`,
      [grId, grNumber, payload.poId, payload.receiptDate || null, payload.notes || null]
    );

    for (let i = 0; i < payload.lines.length; i++) {
      const line = payload.lines[i];

      await client.query(
        `INSERT INTO gr_lines (id, gr_id, po_line_id, line_no, qty_received, actual_site_code)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), grId, line.poLineId, i + 1, Number(line.qtyReceived), line.actualSiteCode]
      );
    }

    await client.query('COMMIT');

    return getGoodsReceiptById(db, grId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ── Post GR (DRAFT → POSTED, cascades qty to PO/PR lines) ─

export async function postGoodsReceipt(db, id) {
  const currentResult = await db.query(
    `SELECT id, status FROM goods_receipts WHERE id = $1`,
    [id]
  );

  if (currentResult.rowCount === 0) {
    return null;
  }

  if (currentResult.rows[0].status !== 'DRAFT') {
    const err = new Error('Only DRAFT goods receipt can be posted');
    err.statusCode = 422;
    throw err;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const linesResult = await client.query(
      `SELECT po_line_id, qty_received FROM gr_lines WHERE gr_id = $1`,
      [id]
    );

    for (const line of linesResult.rows) {
      // Lock the PO line to prevent concurrent over-receipt
      const poLineResult = await client.query(
        `SELECT id, qty_ordered, qty_received FROM po_lines WHERE id = $1 FOR UPDATE`,
        [line.po_line_id]
      );
      const poLine = poLineResult.rows[0];
      const open = Number(poLine.qty_ordered) - Number(poLine.qty_received);

      if (Number(line.qty_received) > open) {
        const err = new Error(
          `PO line ${line.po_line_id}: receipt qty ${line.qty_received} exceeds open qty ${open}`
        );
        err.statusCode = 422;
        throw err;
      }

      await client.query(
        `UPDATE po_lines SET qty_received = qty_received + $1, updated_at = NOW() WHERE id = $2`,
        [Number(line.qty_received), line.po_line_id]
      );

      // Cascade to pr_lines via allocations, split proportionally by allocated_qty share.
      const allocResult = await client.query(
        `SELECT pr_line_id, allocated_qty FROM pr_line_allocations WHERE po_line_id = $1`,
        [line.po_line_id]
      );
      const totalAllocated = allocResult.rows.reduce((sum, a) => sum + Number(a.allocated_qty), 0);

      for (const alloc of allocResult.rows) {
        const share = totalAllocated > 0 ? Number(alloc.allocated_qty) / totalAllocated : 0;
        const delta = Number(line.qty_received) * share;

        await client.query(
          `UPDATE pr_lines SET qty_received = qty_received + $1, updated_at = NOW() WHERE id = $2`,
          [delta, alloc.pr_line_id]
        );
      }
    }

    await client.query(
      `UPDATE goods_receipts SET status = 'POSTED', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return getGoodsReceiptById(db, id);
}
