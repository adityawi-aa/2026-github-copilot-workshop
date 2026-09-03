import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PurchaseOrderHeaderForm from '../../src/components/PurchaseOrderHeaderForm.vue';

describe('PurchaseOrderHeaderForm Component', () => {
  const initialHeader = {
    vendorName: 'PT Sumber Makmur',
    expectedDeliveryDate: '2026-10-01',
    title: 'PO for Office Supplies',
    paymentTerms: 'Net 30',
    notes: 'Deliver to loading dock 2',
  };

  it('renders all form fields with passed modelValue props', () => {
    const wrapper = mount(PurchaseOrderHeaderForm, {
      props: {
        modelValue: initialHeader,
      },
    });

    const vendorInput = wrapper.find('input[placeholder="Type..."]');
    expect(vendorInput.exists()).toBe(true);
    expect(vendorInput.element.value).toBe('PT Sumber Makmur');

    const textarea = wrapper.find('textarea');
    expect(textarea.element.value).toBe('Deliver to loading dock 2');
  });

  it('emits update:modelValue when vendor name is changed', async () => {
    const wrapper = mount(PurchaseOrderHeaderForm, {
      props: {
        modelValue: initialHeader,
      },
    });

    const vendorInput = wrapper.findAll('input')[0];
    await vendorInput.setValue('New Vendor Corp');

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')[0][0]).toEqual({
      ...initialHeader,
      vendorName: 'New Vendor Corp',
    });
  });

  it('emits update:modelValue when notes are modified', async () => {
    const wrapper = mount(PurchaseOrderHeaderForm, {
      props: {
        modelValue: initialHeader,
      },
    });

    const notesTextarea = wrapper.find('textarea');
    await notesTextarea.setValue('Updated notes');

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')[0][0].notes).toBe('Updated notes');
  });
});
