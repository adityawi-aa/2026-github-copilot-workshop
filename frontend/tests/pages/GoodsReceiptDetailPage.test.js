import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import GoodsReceiptDetailPage from '../../src/pages/GoodsReceiptDetailPage.vue';
import { api } from '../../src/api';

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRoute: () => ({ params: { id: 'gr-1' } }),
}));

vi.mock('../../src/api', () => ({
  api: {
    getGoodsReceipt: vi.fn(),
    postGoodsReceipt: vi.fn(),
  },
}));

function draftGr() {
  return {
    id: 'gr-1',
    grNumber: 'GR-2026-0001',
    poId: 'po-1',
    poNumber: 'PO-2026-0001',
    status: 'DRAFT',
    receiptDate: '2026-09-10',
    notes: 'Partial delivery',
    createdAt: '2026-09-10T10:00:00.000Z',
    lines: [
      {
        id: 'gr-line-1',
        lineNo: 1,
        itemCode: 'ITM-001',
        itemName: 'Ergonomic Chair',
        qtyReceived: 6,
        actualSiteCode: 'WH-01',
      },
    ],
  };
}

async function mountPage() {
  const wrapper = mount(GoodsReceiptDetailPage);
  await flushPromises();
  return wrapper;
}

describe('GoodsReceiptDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getGoodsReceipt.mockResolvedValue(draftGr());
  });

  it('renders header and lines', async () => {
    const wrapper = await mountPage();

    expect(api.getGoodsReceipt).toHaveBeenCalledWith('gr-1');
    expect(wrapper.text()).toContain('GR-2026-0001');
    expect(wrapper.find('.status-badge.draft').text()).toBe('DRAFT');

    const row = wrapper.find('tbody tr');
    expect(row.text()).toContain('ITM-001');
    expect(row.text()).toContain('WH-01');
  });

  it('posts a DRAFT GR and shows the new status', async () => {
    api.postGoodsReceipt.mockResolvedValue({ ...draftGr(), status: 'POSTED' });

    const wrapper = await mountPage();
    await wrapper.find('.btn-primary').trigger('click');
    await flushPromises();

    expect(api.postGoodsReceipt).toHaveBeenCalledWith('gr-1');
    expect(wrapper.find('.status-badge.posted').text()).toBe('POSTED');
    expect(wrapper.find('.btn-primary').exists()).toBe(false);
  });

  it('shows the server message when post is rejected', async () => {
    api.postGoodsReceipt.mockRejectedValue(new Error('Only DRAFT goods receipt can be posted'));

    const wrapper = await mountPage();
    await wrapper.find('.btn-primary').trigger('click');
    await flushPromises();

    expect(wrapper.find('.error').text()).toBe('Only DRAFT goods receipt can be posted');
  });
});
