import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import PurchaseOrderCreatePage from '../../src/pages/PurchaseOrderCreatePage.vue';
import { api } from '../../src/api';

const push = vi.fn();

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRouter: () => ({ push }),
}));

vi.mock('../../src/api', () => ({
  api: {
    listRequisitions: vi.fn(),
    getRequisitionOpenLines: vi.fn(),
    createPurchaseOrder: vi.fn(),
    submitPurchaseOrder: vi.fn(),
  },
}));

const globalStubs = {
  RouterLink: { template: '<a><slot /></a>' },
};

function mockApprovedPrLines() {
  api.listRequisitions.mockResolvedValue({
    items: [
      { id: 'pr-1', prNumber: 'PR-2026-0001', status: 'APPROVED' },
      { id: 'pr-2', prNumber: 'PR-2026-0002', status: 'DRAFT' },
    ],
  });

  api.getRequisitionOpenLines.mockResolvedValue({
    requisition: { id: 'pr-1', prNumber: 'PR-2026-0001', status: 'APPROVED' },
    openLines: [
      {
        id: 'pr-line-1',
        lineNo: 1,
        itemCode: 'ITM-001',
        itemName: 'Ergonomic Chair',
        qtyRequested: 10,
        qtyAllocated: 4,
        qtyOpenForPo: 6,
        uom: 'PCS',
        estUnitPrice: 250000,
        siteCode: 'WH-01',
        requiredDate: '2026-09-15',
      },
    ],
  });
}

async function mountPage() {
  const wrapper = mount(PurchaseOrderCreatePage, { global: { stubs: globalStubs } });
  await flushPromises();
  return wrapper;
}

async function fillValidForm(wrapper, orderQty) {
  await wrapper.find('input[name="vendorName"]').setValue('PT Supplier Jaya');
  await wrapper.find('.alloc-check').setValue(true);
  await wrapper.findAll('.alloc-input')[0].setValue(orderQty);
}

describe('PurchaseOrderCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApprovedPrLines();
  });

  it('loads open lines from approved requisitions only', async () => {
    const wrapper = await mountPage();

    expect(api.getRequisitionOpenLines).toHaveBeenCalledTimes(1);
    expect(api.getRequisitionOpenLines).toHaveBeenCalledWith('pr-1');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.text()).toContain('PR-2026-0001');
  });

  it('blocks submit when vendor name and line selection are missing', async () => {
    const wrapper = await mountPage();

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const messages = wrapper.findAll('.error-list .error').map((node) => node.text());
    expect(messages).toContain('Vendor Name is required before submitting PO.');
    expect(messages).toContain('Select at least one approved PR line.');
    expect(api.createPurchaseOrder).not.toHaveBeenCalled();
  });

  it('blocks submit when order qty exceeds the PR remaining qty', async () => {
    const wrapper = await mountPage();
    await fillValidForm(wrapper, 7);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const messages = wrapper.findAll('.error-list .error').map((node) => node.text());
    expect(messages).toContain('PR-2026-0001 line 1: Order QTY 7 exceeds remaining 6.');
    expect(api.createPurchaseOrder).not.toHaveBeenCalled();
  });

  it('creates and submits the PO with the selected allocation', async () => {
    api.createPurchaseOrder.mockResolvedValue({ id: 'po-1', poNumber: 'PO-2026-0001', status: 'DRAFT' });
    api.submitPurchaseOrder.mockResolvedValue({ id: 'po-1', poNumber: 'PO-2026-0001', status: 'SUBMITTED' });

    const wrapper = await mountPage();
    await fillValidForm(wrapper, 6);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(api.createPurchaseOrder).toHaveBeenCalledWith({
      vendorName: 'PT Supplier Jaya',
      lines: [
        {
          prLineId: 'pr-line-1',
          itemCode: 'ITM-001',
          itemName: 'Ergonomic Chair',
          qtyOrdered: 6,
          unitPrice: 250000,
          uom: 'PCS',
          siteCode: 'WH-01',
          requiredDate: '2026-09-15',
        },
      ],
    });
    expect(api.submitPurchaseOrder).toHaveBeenCalledWith('po-1');
    expect(push).toHaveBeenCalledWith('/purchase-orders/po-1');
  });

  it('creates a DRAFT PO when saving as draft', async () => {
    api.createPurchaseOrder.mockResolvedValue({ id: 'po-2', poNumber: 'PO-2026-0002', status: 'DRAFT' });

    const wrapper = await mountPage();
    await fillValidForm(wrapper, 3);

    await wrapper.find('.btn-group button.btn-outline').trigger('click');
    await flushPromises();

    expect(api.submitPurchaseOrder).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/purchase-orders/po-2');
  });

  it('shows the server 422 rule-violation message', async () => {
    api.createPurchaseOrder.mockRejectedValue(
      new Error('lines[0]: allocation qty 6 exceeds remaining 3'),
    );

    const wrapper = await mountPage();
    await fillValidForm(wrapper, 6);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('.error-list .error').text()).toBe(
      'lines[0]: allocation qty 6 exceeds remaining 3',
    );
  });
});
