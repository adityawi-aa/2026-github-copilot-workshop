// Requires the stack already running: `docker compose up -d db`, `npm run dev` (backend :3000 + frontend :5173).
const { test, expect } = require('@playwright/test');

function uniqueItemCode(tag) {
  return `E2E-${tag}-${Date.now()}`;
}

// .form-group wraps exactly one <label> + one input/textarea, so filtering
// by the label's text scopes to a single, stable field regardless of DOM order.
async function fillFormGroup(page, label, value) {
  await page.locator('.form-group', { hasText: label }).locator('input, textarea').first().fill(value);
}

// Creates a one-line PR, submits it, and approves it so its line is open for PO allocation.
async function createApprovedRequisition(page, { itemCode, itemName, qty, unitPrice, siteCode }) {
  await page.goto('/requisitions/new');

  await fillFormGroup(page, 'Requester Name', 'E2E Tester');
  await fillFormGroup(page, 'Department', 'QA');
  await fillFormGroup(page, 'PR Title', `E2E PR ${itemCode}`);

  const line = page.locator('table tbody tr').first();
  await line.locator('input').nth(0).fill(itemCode); // Item Code
  await line.locator('input').nth(1).fill(itemName); // Item Name
  await line.locator('input').nth(2).fill(String(qty)); // QTY
  await line.locator('input').nth(3).fill('PCS'); // UOM
  await line.locator('input').nth(4).fill(String(unitPrice)); // Est. Unit Price
  await line.locator('input').nth(5).fill(siteCode); // Site

  await page.getByRole('button', { name: 'Save As Draft' }).click();
  await expect(page).toHaveURL(/\/requisitions\/[\w-]+$/);

  const headerText = await page.locator('.page-header-left .muted').innerText();
  const prNumber = headerText.split(' ')[0];

  await page.getByRole('button', { name: 'Submit PR' }).click();
  await expect(page.locator('.status-badge')).toHaveText('SUBMITTED');

  await page.getByRole('button', { name: 'Approve PR' }).click();
  await expect(page.locator('.status-badge')).toHaveText('APPROVED');

  return { prNumber };
}

test.describe('PO module', () => {
  test('creates a PO from an approved PR line and submits it', async ({ page }) => {
    const itemCode = uniqueItemCode('HAPPY');
    const { prNumber } = await createApprovedRequisition(page, {
      itemCode,
      itemName: 'Ergonomic Chair',
      qty: 10,
      unitPrice: 250000,
      siteCode: 'WH-E2E',
    });

    await page.goto('/purchase-orders/new');

    const allocRow = page.locator('tbody tr', { hasText: itemCode });
    await expect(allocRow).toBeVisible();

    await allocRow.locator('input[type="checkbox"]').check();
    await allocRow.locator('input[type="number"]').nth(0).fill('10'); // Order QTY == remaining

    await page.locator('input[name="vendorName"]').fill('PT E2E Supplier Jaya');

    await page.getByRole('button', { name: 'Submit PO' }).click();

    await expect(page).toHaveURL(/\/purchase-orders\/[\w-]+$/);
    await expect(page.locator('.status-badge')).toHaveText('SUBMITTED');
    await expect(page.locator('.card-panel')).toContainText('PT E2E Supplier Jaya');

    const poLine = page.locator('tbody tr', { hasText: itemCode });
    await expect(poLine).toContainText('10');
    await expect(poLine).toContainText(`${prNumber} (10)`);
  });

  test('blocks the PO when the order qty exceeds the PR remaining qty', async ({ page }) => {
    const itemCode = uniqueItemCode('OVERALLOC');
    const { prNumber } = await createApprovedRequisition(page, {
      itemCode,
      itemName: 'Over Allocation Item',
      qty: 5,
      unitPrice: 10000,
      siteCode: 'WH-E2E',
    });

    await page.goto('/purchase-orders/new');

    const allocRow = page.locator('tbody tr', { hasText: itemCode });
    await expect(allocRow).toBeVisible();

    await allocRow.locator('input[type="checkbox"]').check();
    await allocRow.locator('input[type="number"]').nth(0).fill('999'); // exceeds remaining (5)

    await page.locator('input[name="vendorName"]').fill('PT Over Allocation Blocked');

    await page.getByRole('button', { name: 'Submit PO' }).click();

    // Inline field-level feedback on the allocation row.
    await expect(allocRow.locator('input.is-invalid')).toBeVisible();
    await expect(allocRow.locator('.error')).toHaveText('Max 5');

    // Blocking summary message and no navigation away from the create page.
    await expect(page).toHaveURL(/\/purchase-orders\/new$/);
    await expect(page.locator('.error-list .error')).toHaveText(
      `${prNumber} line 1: Order QTY 999 exceeds remaining 5.`,
    );

    // The rejected PO must never have been created.
    await page.goto('/purchase-orders');
    await expect(page.locator('table tbody')).not.toContainText('PT Over Allocation Blocked');
  });
});
