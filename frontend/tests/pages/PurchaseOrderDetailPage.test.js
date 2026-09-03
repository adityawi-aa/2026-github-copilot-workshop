import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import PurchaseOrderDetailPage from '../../src/pages/PurchaseOrderDetailPage.vue';
import { api } from '../../src/api';

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRoute: () => ({ params: { id: 'po-1' } }),
}));

vi.mock('../../src/api', () => ({
  api: {
    getPurchaseOrder: vi.fn(),
    submitPurchaseOrder: vi.fn(),
  },
}));

function draftPo() {
  return {
    id: 'po-1',
    poNumber: 'PO-2026-0001',
    vendorName: 'PT Supplier Jaya',
    status: 'DRAFT',
    createdAt: '2026-09-01T10:00:00.000Z',
    lines: [
      {
        id: 'po-line-1',
        lineNo: 1,
        itemCode: 'ITM-001',
        itemName: 'Ergonomic Chair',
        qtyOrdered: 6,
        qtyReceived: 0,
        qtyOpenForGr: 6,
        uom: 'PCS',
        unitPrice: 250000,
        siteCode: 'WH-01',
        requiredDate: '2026-09-15',
        allocations: [{ prLineId: 'pr-line-1', prNumber: 'PR-2026-0001', allocatedQty: 6 }],
      },
    ],
  };
}

async function mountPage() {
  const wrapper = mount(PurchaseOrderDetailPage);
  await flushPromises();
  return wrapper;
}

describe('PurchaseOrderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getPurchaseOrder.mockResolvedValue(draftPo());
  });

  it('renders header, lines, and the source PR allocation', async () => {
    const wrapper = await mountPage();

    expect(api.getPurchaseOrder).toHaveBeenCalledWith('po-1');
    expect(wrapper.text()).toContain('PO-2026-0001');
    expect(wrapper.find('.status-badge.draft').text()).toBe('DRAFT');

    const row = wrapper.find('tbody tr');
    expect(row.text()).toContain('ITM-001');
    expect(row.text()).toContain('PR-2026-0001 (6)');
  });

  it('submits a DRAFT PO and shows the new status', async () => {
    api.submitPurchaseOrder.mockResolvedValue({ ...draftPo(), status: 'SUBMITTED' });

    const wrapper = await mountPage();
    await wrapper.find('.btn-primary').trigger('click');
    await flushPromises();

    expect(api.submitPurchaseOrder).toHaveBeenCalledWith('po-1');
    expect(wrapper.find('.status-badge.submitted').text()).toBe('SUBMITTED');
    expect(wrapper.find('.btn-primary').exists()).toBe(false);
  });

  it('shows the server message when submit is rejected', async () => {
    api.submitPurchaseOrder.mockRejectedValue(new Error('Only DRAFT purchase order can be submitted'));

    const wrapper = await mountPage();
    await wrapper.find('.btn-primary').trigger('click');
    await flushPromises();

    expect(wrapper.find('.error').text()).toBe('Only DRAFT purchase order can be submitted');
  });
});
