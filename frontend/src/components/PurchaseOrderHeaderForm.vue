<template>
  <div class="card-panel">
    <p class="form-section-title">PO Header</p>
    <div class="form-row">
      <div class="form-group">
        <label>Vendor Name</label>
        <input
          :value="modelValue.vendorName"
          @input="updateField('vendorName', $event.target.value)"
          placeholder="Type..."
          name="vendorName"
          required
        />
      </div>
      <div class="form-group">
        <label>Expected Delivery date</label>
        <input
          :value="modelValue.expectedDeliveryDate"
          @input="updateField('expectedDeliveryDate', $event.target.value)"
          type="date"
        />
      </div>
      <div class="form-group">
        <label>PO Title</label>
        <input
          :value="modelValue.title"
          @input="updateField('title', $event.target.value)"
          placeholder="Type..."
        />
      </div>
      <div class="form-group">
        <label>Payment Terms</label>
        <input
          :value="modelValue.paymentTerms"
          @input="updateField('paymentTerms', $event.target.value)"
          placeholder="Type..."
        />
      </div>
    </div>
    <div class="form-group full">
      <label>Notes</label>
      <textarea
        :value="modelValue.notes"
        @input="updateField('notes', $event.target.value)"
        placeholder="Type..."
        rows="3"
      />
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: Object,
    required: false,
    default: () => ({
      vendorName: '',
      expectedDeliveryDate: '',
      title: '',
      paymentTerms: '',
      notes: '',
    }),
  },
});

const emit = defineEmits(['update:modelValue']);

function updateField(key, value) {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: value,
  });
}
</script>
