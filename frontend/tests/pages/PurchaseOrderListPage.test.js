import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import PurchaseOrderListPage from '../../src/pages/PurchaseOrderListPage.vue';
import { api } from '../../src/api';

vi.mock('../../src/api', () => ({
  api: { listPurchaseOrders: vi.fn() },
}));

const globalStubs = {
  RouterLink: { template: '<a><slot /></a>' },
};

describe('PurchaseOrderListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders one row per purchase order', async () => {
    api.listPurchaseOrders.mockResolvedValue({
      items: [
        {
          id: 'po-1',
          poNumber: 'PO-2026-0001',
          vendorName: 'PT Supplier Jaya',
          status: 'DRAFT',
          createdAt: '2026-09-01T10:00:00.000Z',
        },
        {
          id: 'po-2',
          poNumber: 'PO-2026-0002',
          vendorName: 'PT Mitra Abadi',
          status: 'SUBMITTED',
          createdAt: '2026-09-02T10:00:00.000Z',
        },
      ],
    });

    const wrapper = mount(PurchaseOrderListPage, { global: { stubs: globalStubs } });
    await flushPromises();

    const rows = wrapper.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('PO-2026-0001');
    expect(rows[0].text()).toContain('PT Supplier Jaya');
    expect(rows[0].text()).toContain('2026-09-01');
    expect(rows[1].find('.status-badge.submitted').exists()).toBe(true);
  });

  it('shows the API error message', async () => {
    api.listPurchaseOrders.mockRejectedValue(new Error('Request failed: 500'));

    const wrapper = mount(PurchaseOrderListPage, { global: { stubs: globalStubs } });
    await flushPromises();

    expect(wrapper.find('.error').text()).toBe('Request failed: 500');
    expect(wrapper.findAll('tbody tr')).toHaveLength(0);
  });
});
