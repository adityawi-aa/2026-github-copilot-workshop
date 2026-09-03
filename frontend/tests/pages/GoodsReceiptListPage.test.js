import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import GoodsReceiptListPage from '../../src/pages/GoodsReceiptListPage.vue';
import { api } from '../../src/api';

vi.mock('../../src/api', () => ({
  api: { listGoodsReceipts: vi.fn() },
}));

const globalStubs = {
  RouterLink: { template: '<a><slot /></a>' },
};

describe('GoodsReceiptListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders one row per goods receipt', async () => {
    api.listGoodsReceipts.mockResolvedValue({
      items: [
        {
          id: 'gr-1',
          grNumber: 'GR-2026-0001',
          poNumber: 'PO-2026-0001',
          status: 'DRAFT',
          receiptDate: '2026-09-10',
          createdAt: '2026-09-10T10:00:00.000Z',
        },
        {
          id: 'gr-2',
          grNumber: 'GR-2026-0002',
          poNumber: 'PO-2026-0002',
          status: 'POSTED',
          receiptDate: '2026-09-11',
          createdAt: '2026-09-11T10:00:00.000Z',
        },
      ],
    });

    const wrapper = mount(GoodsReceiptListPage, { global: { stubs: globalStubs } });
    await flushPromises();

    const rows = wrapper.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('GR-2026-0001');
    expect(rows[0].text()).toContain('PO-2026-0001');
    expect(rows[1].find('.status-badge.posted').exists()).toBe(true);
  });

  it('shows the API error message', async () => {
    api.listGoodsReceipts.mockRejectedValue(new Error('Request failed: 500'));

    const wrapper = mount(GoodsReceiptListPage, { global: { stubs: globalStubs } });
    await flushPromises();

    expect(wrapper.find('.error').text()).toBe('Request failed: 500');
    expect(wrapper.findAll('tbody tr')).toHaveLength(0);
  });
});
