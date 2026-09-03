import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PoLineAllocationTable from '../../src/components/PoLineAllocationTable.vue';

describe('PoLineAllocationTable Component', () => {
  function createLines() {
    return [
      {
        prLineId: 'pr-line-1',
        prNo: 'PR-2026-0001',
        prLine: 1,
        itemCode: 'ITM-001',
        itemName: 'Ergonomic Chair',
        uom: 'PCS',
        requestedQty: 10,
        allocatedQty: 4,
        remainingQty: 6,
        selected: false,
        orderQty: 0,
        deliveryAddress: 'WH-01',
        deliveryDate: '2026-09-15',
        unitPrice: 250000,
      },
      {
        prLineId: 'pr-line-2',
        prNo: 'PR-2026-0001',
        prLine: 2,
        itemCode: 'ITM-002',
        itemName: 'Wireless Mouse',
        uom: 'PCS',
        requestedQty: 10,
        allocatedQty: 0,
        remainingQty: 10,
        selected: true,
        orderQty: 2,
        deliveryAddress: 'WH-02',
        deliveryDate: '2026-09-20',
        unitPrice: 50000,
      },
    ];
  }

  it('renders one row per approved PR line', () => {
    const wrapper = mount(PoLineAllocationTable, { props: { lines: createLines() } });

    const rows = wrapper.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('ITM-001');
    expect(rows[0].text()).toContain('PR-2026-0001');
  });

  it('shows the computed line amount', () => {
    const wrapper = mount(PoLineAllocationTable, { props: { lines: createLines() } });

    const cells = wrapper.findAll('tbody tr')[1].findAll('td');
    expect(cells[cells.length - 1].text()).toBe('100,000');
  });

  it('emits refresh when clicking Refresh Open Lines', async () => {
    const wrapper = mount(PoLineAllocationTable, { props: { lines: createLines() } });

    await wrapper.find('.refresh-btn').trigger('click');
    expect(wrapper.emitted('refresh')).toHaveLength(1);
  });

  it('flags a line when order qty exceeds the PR remaining qty', () => {
    const lines = createLines();
    lines[0].orderQty = 7;

    const wrapper = mount(PoLineAllocationTable, { props: { lines } });

    const firstRow = wrapper.findAll('tbody tr')[0];
    expect(firstRow.find('.alloc-input.is-invalid').exists()).toBe(true);
    expect(firstRow.find('.error').text()).toBe('Max 6');
  });

  it('does not flag a line when order qty equals the remaining qty', () => {
    const lines = createLines();
    lines[0].orderQty = 6;

    const wrapper = mount(PoLineAllocationTable, { props: { lines } });

    expect(wrapper.find('.alloc-input.is-invalid').exists()).toBe(false);
  });
});
