<template>
  <!-- Approved PR Lines allocation table (Figma node 41:842) -->
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
            <th>PR No</th>
            <th>PR Line</th>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>UOM</th>
            <th class="num">Requested QTY</th>
            <th class="num">Allocated QTY</th>
            <th class="num">Remaining QTY</th>
            <th>Order QTY</th>
            <th>Delivery Address</th>
            <th>Delivery Date</th>
            <th>Unit Price</th>
            <th class="num">Line Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(line, index) in lines" :key="index">
            <td class="col-select">
              <input v-model="line.selected" type="checkbox" class="alloc-check" />
            </td>
            <td>{{ line.prNo }}</td>
            <td>{{ line.prLine }}</td>
            <td>{{ line.itemCode }}</td>
            <td>{{ line.itemName }}</td>
            <td>{{ line.uom }}</td>
            <td class="num">{{ line.requestedQty }}</td>
            <td class="num">{{ line.allocatedQty }}</td>
            <td class="num">{{ line.remainingQty }}</td>
            <td>
              <input
                v-model.number="line.orderQty"
                type="number"
                min="0"
                step="1"
                class="alloc-input"
                :class="{ 'is-invalid': isOverAllocated(line) }"
                placeholder="0"
              />
              <span v-if="isOverAllocated(line)" class="error">
                Max {{ line.remainingQty }}
              </span>
            </td>
            <td>
              <input
                v-model="line.deliveryAddress"
                type="text"
                class="alloc-input"
                placeholder="Type..."
              />
            </td>
            <td>
              <input
                v-model="line.deliveryDate"
                type="date"
                class="alloc-input"
              />
            </td>
            <td>
              <input
                v-model.number="line.unitPrice"
                type="number"
                min="0"
                step="1"
                class="alloc-input"
                placeholder="0"
              />
            </td>
            <td class="num">{{ formatAmount(line.orderQty * line.unitPrice) }}</td>
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
    default: 'Approved PR Lines',
  },
  // Array of approved PR line objects. Each line is expected to have:
  // prNo, prLine, itemCode, itemName, uom, requestedQty, allocatedQty,
  // remainingQty, selected, orderQty, deliveryAddress, deliveryDate, unitPrice
  lines: {
    type: Array,
    required: false,
    default: () => [],
  },
});

defineEmits(['refresh']);

function isOverAllocated(line) {
  return (Number(line.orderQty) || 0) > Number(line.remainingQty);
}

function formatAmount(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}
</script>

<style scoped>
.alloc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

/* Pink outline pill button (Figma "Refresh Open Lines") */
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

/* In-cell editable fields (Figma: white bg, light-grey border, 5px radius) */
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
