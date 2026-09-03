<template>
  <!-- Open PO Lines receiving table (mirrors PoLineAllocationTable) -->
  <div class="card-panel">
    <div class="alloc-header">
      <p class="form-section-title" style="margin: 0">{{ title }}</p>
      <button type="button" class="btn refresh-btn" @click="$emit('refresh')">
        Refresh Open Lines
      </button>
    </div>

    <div class="table-container">
      <table class="alloc-table">
        <thead>
          <tr>
            <th class="col-select">Select</th>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>UOM</th>
            <th class="num">Qty Ordered</th>
            <th class="num">Qty Received</th>
            <th class="num">Qty Open</th>
            <th>Qty to Receive</th>
            <th>Actual Site Code</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(line, index) in lines" :key="index">
            <td class="col-select">
              <input v-model="line.selected" type="checkbox" class="alloc-check" />
            </td>
            <td>{{ line.itemCode }}</td>
            <td>{{ line.itemName }}</td>
            <td>{{ line.uom }}</td>
            <td class="num">{{ line.qtyOrdered }}</td>
            <td class="num">{{ line.qtyReceived }}</td>
            <td class="num">{{ line.qtyOpenForGr }}</td>
            <td>
              <input
                v-model.number="line.qtyToReceive"
                type="number"
                min="0"
                step="1"
                class="alloc-input"
                :class="{ 'is-invalid': isOverReceived(line) }"
                placeholder="0"
              />
              <span v-if="isOverReceived(line)" class="error">
                Max {{ line.qtyOpenForGr }}
              </span>
            </td>
            <td>
              <input
                v-model="line.actualSiteCode"
                type="text"
                class="alloc-input"
                placeholder="Type..."
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: 'PO Open Lines',
  },
  // Array of PO open line objects. Each line is expected to have:
  // poLineId, itemCode, itemName, uom, qtyOrdered, qtyReceived, qtyOpenForGr,
  // selected, qtyToReceive, actualSiteCode
  lines: {
    type: Array,
    required: false,
    default: () => [],
  },
});

defineEmits(['refresh']);

function isOverReceived(line) {
  return (Number(line.qtyToReceive) || 0) > Number(line.qtyOpenForGr);
}
</script>

<style scoped>
.alloc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.refresh-btn {
  background: var(--white);
  color: var(--text);
  border: 1px solid var(--primary);
  border-radius: 30px;
  padding: 14px 24px;
  height: 45px;
}

.table-container {
  overflow-x: auto;
}

.alloc-table th,
.alloc-table td {
  white-space: nowrap;
}

.alloc-table .num {
  text-align: right;
}

.col-select {
  width: 57px;
  text-align: center;
}

.alloc-check {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
  cursor: pointer;
}

.alloc-input {
  width: 100%;
  min-width: 78px;
  height: 45px;
  padding: 10px 10px 10px 16px;
  font-family: inherit;
  font-size: 13px;
  border: 1px solid var(--light-grey);
  border-radius: 5px;
  background: var(--white);
  color: var(--text);
  outline: none;
}

.alloc-input:focus {
  border-color: var(--primary);
}

.alloc-input.is-invalid {
  border-color: #c62828;
}
</style>
