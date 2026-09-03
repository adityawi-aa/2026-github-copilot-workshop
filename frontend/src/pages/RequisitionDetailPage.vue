<template>
  <section>
    <!-- Page header -->
    <div class="page-header">
      <div class="page-header-left">
        <RouterLink to="/requisitions" class="back-btn" title="Back to list">&#8592;</RouterLink>
        <div>
          <h2>Detail Purchase Requisition</h2>
          <p class="muted">{{ requisition?.prNumber || '-' }} &mdash; Purchase Requisition information detail</p>
        </div>
      </div>
      <div class="btn-group" v-if="requisition">
        <button v-if="requisition.status === 'DRAFT'" class="btn btn-primary" @click="submitRequisition">Submit PR</button>
        <button v-if="requisition.status === 'SUBMITTED'" class="btn btn-primary" @click="approveRequisition">Approve PR</button>
      </div>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <!-- PR Header card -->
    <div class="card-panel" v-if="requisition">
      <p class="form-section-title">PR Header</p>
      <div class="form-row">
        <div class="form-group">
          <label>Requester Name</label>
          <input :value="requisition.requesterName" disabled />
        </div>
        <div class="form-group">
          <label>Department</label>
          <input :value="requisition.departmentName" disabled />
        </div>
        <div class="form-group">
          <label>PR Title</label>
          <input :value="requisition.title" disabled />
        </div>
        <div class="form-group">
          <label>Needed By date</label>
          <input :value="requisition.neededByDate || '-'" disabled />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Status</label>
          <span class="status-badge" :class="requisition.status.toLowerCase()">{{ requisition.status }}</span>
        </div>
      </div>
      <div class="form-group full">
        <label>Notes</label>
        <textarea :value="requisition.notes || '-'" disabled rows="3" />
      </div>
    </div>

    <!-- PR Lines card -->
    <div class="card-panel" v-if="requisition">
      <p class="form-section-title">PR Lines</p>
      <table>
        <thead>
          <tr>
            <th style="width:50px">Line</th>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>QTY</th>
            <th>QTY Received</th>
            <th>Linked PO</th>
            <th>UOM</th>
            <th>Est. Unit Price</th>
            <th>Site</th>
            <th>Required Date</th>
            <th>Budget Center</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in requisition.lines" :key="line.id">
            <td>{{ line.lineNo }}</td>
            <td>{{ line.itemCode }}</td>
            <td>{{ line.itemName }}</td>
            <td>{{ line.qtyRequested }}</td>
            <td>{{ line.qtyReceived }}</td>
            <td>{{ formatLinkedPurchaseOrders(line.linkedPurchaseOrders) }}</td>
            <td>{{ line.uom }}</td>
            <td>{{ line.estUnitPrice }}</td>
            <td>{{ line.siteCode }}</td>
            <td>{{ line.requiredDate || '-' }}</td>
            <td>{{ line.budgetCenter || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '../api';

const route = useRoute();
const requisition = ref(null);
const errorMessage = ref('');

function formatLinkedPurchaseOrders(linkedPurchaseOrders = []) {
  if (linkedPurchaseOrders.length === 0) return '-';
  return linkedPurchaseOrders.map((po) => `${po.poNumber} (${po.allocatedQty})`).join(', ');
}

async function load() {
  errorMessage.value = '';
  try {
    requisition.value = await api.getRequisition(route.params.id);
  } catch (error) {
    errorMessage.value = error.message;
  }
}

async function submitRequisition() {
  try {
    requisition.value = await api.submitRequisition(route.params.id);
  } catch (error) {
    errorMessage.value = error.message;
  }
}

async function approveRequisition() {
  try {
    requisition.value = await api.approveRequisition(route.params.id);
  } catch (error) {
    errorMessage.value = error.message;
  }
}

onMounted(load);
</script>

<style scoped>
.form-group input:disabled,
.form-group textarea:disabled {
  background: var(--white);
  color: var(--text);
  cursor: default;
  opacity: 1;
}
</style>
