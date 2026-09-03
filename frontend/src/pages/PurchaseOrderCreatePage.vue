<template>
  <section>
    <!-- Page header -->
    <div class="page-header">
      <div class="page-header-left">
        <RouterLink to="/purchase-orders" class="back-btn" title="Back to list">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </RouterLink>
        <div>
          <h2>Create Purchase Order</h2>
          <p class="muted">Create PO from approved PR line items</p>
        </div>
      </div>
    </div>

    <p v-if="loading" class="muted">Loading approved PR lines...</p>
    <p v-if="loadError" class="error">{{ loadError }}</p>
    <p v-if="successMessage" class="success-banner">{{ successMessage }}</p>

    <form @submit.prevent="handleSubmitPo">
      <!-- Reusable PO Header Form component -->
      <PurchaseOrderHeaderForm v-model="form.header" />

      <!-- Reusable PO Line Allocation Table component (Figma node 41:842) -->
      <PoLineAllocationTable :lines="form.lines" @refresh="loadOpenLines" />

      <ul v-if="errors.length" class="error-list">
        <li v-for="(message, index) in errors" :key="index" class="error">{{ message }}</li>
      </ul>

      <!-- Summary panels -->
      <div class="panels-row">
        <div class="card-panel summary-panel">
          <p class="summary-title">Selected Lines</p>
          <p class="summary-value">{{ selectedLinesCount }}</p>
        </div>
        <div class="card-panel summary-panel">
          <p class="summary-title">Estimated Total</p>
          <p class="summary-value">{{ formattedEstimatedTotal }}</p>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="btn-group">
        <button type="button" class="btn btn-outline" :disabled="saving" @click="handleSaveDraft">
          Save As Draft
        </button>
        <button type="submit" class="btn btn-primary" :disabled="saving">Submit PO</button>
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../api';
import PurchaseOrderHeaderForm from '../components/PurchaseOrderHeaderForm.vue';
import PoLineAllocationTable from '../components/PoLineAllocationTable.vue';

const router = useRouter();

const form = reactive({
  header: {
    vendorName: '',
    expectedDeliveryDate: '',
    title: '',
    paymentTerms: '',
    notes: '',
  },
  lines: [],
});

const loading = ref(false);
const saving = ref(false);
const loadError = ref('');
const successMessage = ref('');
const errors = ref([]);

const selectedLines = computed(() => form.lines.filter((line) => line.selected));

const selectedLinesCount = computed(() => selectedLines.value.length);

const estimatedTotal = computed(() =>
  selectedLines.value.reduce((sum, line) => {
    const qty = Number(line.orderQty) || 0;
    const price = Number(line.unitPrice) || 0;
    return sum + qty * price;
  }, 0),
);

const formattedEstimatedTotal = computed(() =>
  new Intl.NumberFormat('en-US').format(estimatedTotal.value),
);

function toAllocationLine(prNumber, line) {
  return {
    prLineId: line.id,
    prNo: prNumber,
    prLine: line.lineNo,
    itemCode: line.itemCode,
    itemName: line.itemName,
    uom: line.uom,
    requestedQty: line.qtyRequested,
    allocatedQty: line.qtyAllocated,
    remainingQty: line.qtyOpenForPo,
    selected: false,
    orderQty: 0,
    siteCode: line.siteCode,
    deliveryAddress: line.siteCode || '',
    deliveryDate: line.requiredDate ? String(line.requiredDate).slice(0, 10) : '',
    unitPrice: line.estUnitPrice,
  };
}

async function loadOpenLines() {
  loading.value = true;
  loadError.value = '';
  errors.value = [];
  try {
    const { items = [] } = await api.listRequisitions();
    const approved = items.filter((pr) => pr.status === 'APPROVED');
    const results = await Promise.all(approved.map((pr) => api.getRequisitionOpenLines(pr.id)));

    form.lines = results.flatMap((result) =>
      (result?.openLines || []).map((line) => toAllocationLine(result.requisition.prNumber, line)),
    );
  } catch (error) {
    loadError.value = error.message;
    form.lines = [];
  } finally {
    loading.value = false;
  }
}

// Client-side mirror of the server rule: allocation qty <= PR line remaining qty.
function validate() {
  const messages = [];

  if (!form.header.vendorName.trim()) {
    messages.push('Vendor Name is required before submitting PO.');
  }

  if (selectedLines.value.length === 0) {
    messages.push('Select at least one approved PR line.');
  }

  selectedLines.value.forEach((line) => {
    const qty = Number(line.orderQty) || 0;
    if (qty <= 0) {
      messages.push(`${line.prNo} line ${line.prLine}: Order QTY must be greater than 0.`);
    } else if (qty > line.remainingQty) {
      messages.push(
        `${line.prNo} line ${line.prLine}: Order QTY ${qty} exceeds remaining ${line.remainingQty}.`,
      );
    }

    if (Number(line.unitPrice) < 0) {
      messages.push(`${line.prNo} line ${line.prLine}: Unit Price cannot be negative.`);
    }
  });

  errors.value = messages;
  return messages.length === 0;
}

function buildPayload() {
  return {
    vendorName: form.header.vendorName.trim(),
    lines: selectedLines.value.map((line) => ({
      prLineId: line.prLineId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      qtyOrdered: Number(line.orderQty),
      unitPrice: Number(line.unitPrice) || 0,
      uom: line.uom,
      siteCode: line.deliveryAddress || line.siteCode,
      requiredDate: line.deliveryDate || form.header.expectedDeliveryDate || null,
    })),
  };
}

async function createPo() {
  successMessage.value = '';
  if (!validate()) {
    return null;
  }

  saving.value = true;
  try {
    return await api.createPurchaseOrder(buildPayload());
  } catch (error) {
    // Server answers rule violations with 422 and a specific message.
    errors.value = [error.message];
    return null;
  } finally {
    saving.value = false;
  }
}

async function handleSaveDraft() {
  const po = await createPo();
  if (!po) return;

  router.push(`/purchase-orders/${po.id}`);
}

async function handleSubmitPo() {
  const po = await createPo();
  if (!po) return;

  saving.value = true;
  try {
    const submitted = await api.submitPurchaseOrder(po.id);
    router.push(`/purchase-orders/${submitted.id}`);
  } catch (error) {
    errors.value = [error.message];
    successMessage.value = `Purchase order ${po.poNumber} was created as DRAFT but could not be submitted.`;
  } finally {
    saving.value = false;
  }
}

onMounted(loadOpenLines);
</script>

<style scoped>
.summary-panel {
  margin-bottom: 24px;
}

.summary-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 12px;
}

.summary-value {
  font-size: 32px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
  letter-spacing: -1px;
}

.error-list {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
}

.success-banner {
  margin: 0 0 16px;
  padding: 12px 16px;
  border: 1px solid var(--primary);
  border-radius: 5px;
  background: var(--white);
  color: var(--text);
  font-size: 13px;
}
</style>
