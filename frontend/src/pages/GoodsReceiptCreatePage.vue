<template>
  <section>
    <!-- Page header -->
    <div class="page-header">
      <div class="page-header-left">
        <RouterLink to="/goods-receipts" class="back-btn" title="Back to list">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </RouterLink>
        <div>
          <h2>Create Goods Receipt</h2>
          <p class="muted">Receive items against submitted PO lines</p>
        </div>
      </div>
    </div>

    <p v-if="loading" class="muted">Loading PO open lines...</p>
    <p v-if="loadError" class="error">{{ loadError }}</p>
    <p v-if="successMessage" class="success-banner">{{ successMessage }}</p>

    <form @submit.prevent="handlePostGr">
      <!-- GR Header -->
      <div class="card-panel">
        <p class="form-section-title">GR Header</p>
        <div class="form-row">
          <div class="form-group">
            <label>Purchase Order</label>
            <select v-model="selectedPoId" :disabled="!!fixedPoId" @change="loadOpenLines">
              <option value="" disabled>Select a submitted PO...</option>
              <option v-for="po in submittedPurchaseOrders" :key="po.id" :value="po.id">
                {{ po.poNumber }} &mdash; {{ po.vendorName }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Receipt Date</label>
            <input v-model="form.header.receiptDate" type="date" />
          </div>
        </div>
        <div class="form-group full">
          <label>Notes</label>
          <textarea v-model="form.header.notes" placeholder="Type..." rows="3" />
        </div>
      </div>

      <!-- Reusable GR Line Receiving Table component -->
      <GrLineReceivingTable :lines="form.lines" @refresh="loadOpenLines" />

      <ul v-if="errors.length" class="error-list">
        <li v-for="(message, index) in errors" :key="index" class="error">{{ message }}</li>
      </ul>

      <!-- Summary panel -->
      <div class="panels-row">
        <div class="card-panel summary-panel">
          <p class="summary-title">Selected Lines</p>
          <p class="summary-value">{{ selectedLinesCount }}</p>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="btn-group">
        <button type="button" class="btn btn-outline" :disabled="saving" @click="handleSaveDraft">
          Save As Draft
        </button>
        <button type="submit" class="btn btn-primary" :disabled="saving">Post GR</button>
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import GrLineReceivingTable from '../components/GrLineReceivingTable.vue';

const route = useRoute();
const router = useRouter();

const fixedPoId = route.query.poId || '';
const selectedPoId = ref(fixedPoId);
const submittedPurchaseOrders = ref([]);

const form = reactive({
  header: {
    receiptDate: '',
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

function toReceivingLine(line) {
  return {
    poLineId: line.id,
    itemCode: line.itemCode,
    itemName: line.itemName,
    uom: line.uom,
    qtyOrdered: line.qtyOrdered,
    qtyReceived: line.qtyReceived,
    qtyOpenForGr: line.qtyOpenForGr,
    selected: false,
    qtyToReceive: 0,
    actualSiteCode: line.siteCode || '',
  };
}

async function loadSubmittedPurchaseOrders() {
  const { items = [] } = await api.listPurchaseOrders();
  submittedPurchaseOrders.value = items.filter((po) => po.status === 'SUBMITTED');
}

async function loadOpenLines() {
  if (!selectedPoId.value) {
    form.lines = [];
    return;
  }

  loading.value = true;
  loadError.value = '';
  errors.value = [];
  try {
    const result = await api.getPurchaseOrderOpenLines(selectedPoId.value);
    form.lines = (result?.openLines || []).map(toReceivingLine);
  } catch (error) {
    loadError.value = error.message;
    form.lines = [];
  } finally {
    loading.value = false;
  }
}

// Client-side mirror of the server rule: qty to receive <= PO line open qty.
function validate() {
  const messages = [];

  if (!selectedPoId.value) {
    messages.push('Select a submitted purchase order first.');
  }

  if (selectedLines.value.length === 0) {
    messages.push('Select at least one PO open line.');
  }

  selectedLines.value.forEach((line) => {
    const qty = Number(line.qtyToReceive) || 0;
    if (qty <= 0) {
      messages.push(`${line.itemCode}: Qty to Receive must be greater than 0.`);
    } else if (qty > line.qtyOpenForGr) {
      messages.push(`${line.itemCode}: Qty to Receive ${qty} exceeds open qty ${line.qtyOpenForGr}.`);
    }

    if (!line.actualSiteCode) {
      messages.push(`${line.itemCode}: Actual Site Code is required.`);
    }
  });

  errors.value = messages;
  return messages.length === 0;
}

function buildPayload() {
  return {
    poId: selectedPoId.value,
    receiptDate: form.header.receiptDate || null,
    notes: form.header.notes || null,
    lines: selectedLines.value.map((line) => ({
      poLineId: line.poLineId,
      qtyReceived: Number(line.qtyToReceive),
      actualSiteCode: line.actualSiteCode,
    })),
  };
}

async function createGr() {
  successMessage.value = '';
  if (!validate()) {
    return null;
  }

  saving.value = true;
  try {
    return await api.createGoodsReceipt(buildPayload());
  } catch (error) {
    // Server answers rule violations with 422 and a specific message.
    errors.value = [error.message];
    return null;
  } finally {
    saving.value = false;
  }
}

async function handleSaveDraft() {
  const gr = await createGr();
  if (!gr) return;

  router.push(`/goods-receipts/${gr.id}`);
}

async function handlePostGr() {
  const gr = await createGr();
  if (!gr) return;

  saving.value = true;
  try {
    const posted = await api.postGoodsReceipt(gr.id);
    router.push(`/goods-receipts/${posted.id}`);
  } catch (error) {
    errors.value = [error.message];
    successMessage.value = `Goods receipt ${gr.grNumber} was created as DRAFT but could not be posted.`;
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  loading.value = true;
  loadError.value = '';
  try {
    await loadSubmittedPurchaseOrders();
    await loadOpenLines();
  } catch (error) {
    loadError.value = error.message;
  } finally {
    loading.value = false;
  }
});
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
  padding: 0;
  margin: 0 0 16px;
}
</style>
