import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import GoodsReceiptCreatePage from '../../src/pages/GoodsReceiptCreatePage.vue';
import { api } from '../../src/api';

const push = vi.fn();
let routeQuery = {};

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRoute: () => ({ query: routeQuery }),
  useRouter: () => ({ push }),
}));

vi.mock('../../src/api', () => ({
  api: {
    listPurchaseOrders: vi.fn(),
    getPurchaseOrderOpenLines: vi.fn(),
    createGoodsReceipt: vi.fn(),
    postGoodsReceipt: vi.fn(),
  },
}));

function mockOpenLines() {
  api.getPurchaseOrderOpenLines.mockResolvedValue({
    purchaseOrder: { id: 'po-1', poNumber: 'PO-2026-0001', status: 'SUBMITTED' },
    openLines: [
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
      },
    ],
  });
}

async function mountPage() {
  const wrapper = mount(GoodsReceiptCreatePage);
  await flushPromises();
  return wrapper;
}

async function fillValidForm(wrapper, qty) {
  await wrapper.find('.alloc-check').setValue(true);
  await wrapper.findAll('.alloc-input')[0].setValue(qty);
  await wrapper.findAll('.alloc-input')[1].setValue('WH-01');
}

describe('GoodsReceiptCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeQuery = { poId: 'po-1' };
    api.listPurchaseOrders.mockResolvedValue({ items: [] });
    mockOpenLines();
  });

  it('loads PO open lines when poId is provided via query', async () => {
    const wrapper = await mountPage();

    expect(api.getPurchaseOrderOpenLines).toHaveBeenCalledWith('po-1');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.text()).toContain('ITM-001');
  });

  it('lets user pick a submitted PO from the dropdown when no poId is given', async () => {
    routeQuery = {};
    api.listPurchaseOrders.mockResolvedValue({
      items: [
        { id: 'po-1', poNumber: 'PO-2026-0001', vendorName: 'PT Supplier Jaya', status: 'SUBMITTED' },
        { id: 'po-2', poNumber: 'PO-2026-0002', vendorName: 'PT Mitra Abadi', status: 'DRAFT' },
      ],
    });

    const wrapper = await mountPage();
    expect(api.getPurchaseOrderOpenLines).not.toHaveBeenCalled();

    await wrapper.find('select').setValue('po-1');
    await flushPromises();

    expect(api.getPurchaseOrderOpenLines).toHaveBeenCalledWith('po-1');
  });

  it('blocks submit when no line is selected', async () => {
    const wrapper = await mountPage();

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const messages = wrapper.findAll('.error-list .error').map((node) => node.text());
    expect(messages).toContain('Select at least one PO open line.');
    expect(api.createGoodsReceipt).not.toHaveBeenCalled();
  });

  it('blocks submit when qty to receive exceeds the PO open qty', async () => {
    const wrapper = await mountPage();
    await fillValidForm(wrapper, 7);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const messages = wrapper.findAll('.error-list .error').map((node) => node.text());
    expect(messages).toContain('ITM-001: Qty to Receive 7 exceeds open qty 6.');
    expect(api.createGoodsReceipt).not.toHaveBeenCalled();
  });

  it('creates and posts the GR with the selected lines', async () => {
    api.createGoodsReceipt.mockResolvedValue({ id: 'gr-1', grNumber: 'GR-2026-0001', status: 'DRAFT' });
    api.postGoodsReceipt.mockResolvedValue({ id: 'gr-1', grNumber: 'GR-2026-0001', status: 'POSTED' });

    const wrapper = await mountPage();
    await fillValidForm(wrapper, 6);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(api.createGoodsReceipt).toHaveBeenCalledWith({
      poId: 'po-1',
      receiptDate: null,
      notes: null,
      lines: [{ poLineId: 'po-line-1', qtyReceived: 6, actualSiteCode: 'WH-01' }],
    });
    expect(api.postGoodsReceipt).toHaveBeenCalledWith('gr-1');
    expect(push).toHaveBeenCalledWith('/goods-receipts/gr-1');
  });

  it('creates a DRAFT GR when saving as draft', async () => {
    api.createGoodsReceipt.mockResolvedValue({ id: 'gr-2', grNumber: 'GR-2026-0002', status: 'DRAFT' });

    const wrapper = await mountPage();
    await fillValidForm(wrapper, 3);

    await wrapper.find('.btn-group button.btn-outline').trigger('click');
    await flushPromises();

    expect(api.postGoodsReceipt).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/goods-receipts/gr-2');
  });

  it('shows the server 422 rule-violation message', async () => {
    api.createGoodsReceipt.mockRejectedValue(new Error('lines[0]: receipt qty 6 exceeds open qty 3'));

    const wrapper = await mountPage();
    await fillValidForm(wrapper, 6);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('.error-list .error').text()).toBe(
      'lines[0]: receipt qty 6 exceeds open qty 3',
    );
  });
});
