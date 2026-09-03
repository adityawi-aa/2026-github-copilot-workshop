import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import GrLineReceivingTable from '../../src/components/GrLineReceivingTable.vue';

describe('GrLineReceivingTable Component', () => {
  function createLines() {
    return [
      {
        poLineId: 'po-line-1',
        itemCode: 'ITM-001',
        itemName: 'Ergonomic Chair',
        uom: 'PCS',
        qtyOrdered: 6,
        qtyReceived: 0,
        qtyOpenForGr: 6,
        selected: false,
        qtyToReceive: 0,
        actualSiteCode: '',
      },
      {
        poLineId: 'po-line-2',
        itemCode: 'ITM-002',
        itemName: 'Wireless Mouse',
        uom: 'PCS',
        qtyOrdered: 10,
        qtyReceived: 2,
        qtyOpenForGr: 8,
        selected: true,
        qtyToReceive: 4,
        actualSiteCode: 'WH-02',
      },
    ];
  }

  it('renders one row per PO open line', () => {
    const wrapper = mount(GrLineReceivingTable, { props: { lines: createLines() } });

    const rows = wrapper.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('ITM-001');
    expect(rows[1].text()).toContain('ITM-002');
  });

  it('emits refresh when clicking Refresh Open Lines', async () => {
    const wrapper = mount(GrLineReceivingTable, { props: { lines: createLines() } });

    await wrapper.find('.refresh-btn').trigger('click');
    expect(wrapper.emitted('refresh')).toHaveLength(1);
  });

  it('flags a line when qty to receive exceeds the open qty', () => {
    const lines = createLines();
    lines[0].qtyToReceive = 7;

    const wrapper = mount(GrLineReceivingTable, { props: { lines } });

    const firstRow = wrapper.findAll('tbody tr')[0];
    expect(firstRow.find('.alloc-input.is-invalid').exists()).toBe(true);
    expect(firstRow.find('.error').text()).toBe('Max 6');
  });

  it('does not flag a line when qty to receive equals the open qty', () => {
    const lines = createLines();
    lines[0].qtyToReceive = 6;

    const wrapper = mount(GrLineReceivingTable, { props: { lines } });

    expect(wrapper.find('.alloc-input.is-invalid').exists()).toBe(false);
  });
});
