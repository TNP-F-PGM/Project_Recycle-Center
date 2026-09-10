import type { PendingWarehouseItem, QualityAssessment, StockTransaction } from '../types'

export type AssessmentValidationInput = {
  quantity: number
  result: string
  detail: string
}

export function canOpenAssessmentBatch(input: { sellerCode: string; employeeID: string }) {
  return Boolean(input.sellerCode.trim() && input.employeeID.trim())
}

export const qualityResultChoices = [
  { value: 'passed', label: 'ผ่าน' },
  { value: 'rejected', label: 'ปฏิเสธ' },
  { value: 'special_storage', label: 'แยกเก็บ' },
] as const

export function qualityResultLabel(result: string) {
  return result === 'passed'
    ? 'ผ่าน'
    : result === 'special_storage'
      ? 'แยกเก็บ'
      : result === 'rejected'
        ? 'ปฏิเสธ'
        : result
}

export function cleanlinessLabel(level: string) {
  return level === 'clean'
    ? 'สะอาด'
    : level === 'slightly_dirty'
      ? 'สกปรกเล็กน้อย'
      : level === 'dirty'
        ? 'สกปรก'
        : level
}

export function validateAssessmentInput(input: AssessmentValidationInput) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return 'น้ำหนักต้องมากกว่า 0'
  if (['rejected', 'special_storage'].includes(input.result) && !input.detail.trim()) {
    return 'กรุณาระบุเหตุผลหรือรายละเอียด'
  }
  return ''
}

export function validateReceiptInput(input: {
  quantity: number
  assessedQuantity: number
  availableCapacity: number
}) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return 'น้ำหนักรับจริงต้องมากกว่า 0'
  if (Math.abs(input.quantity - input.assessedQuantity) > 0.001) {
    return 'น้ำหนักรับเข้าต้องเท่ากับน้ำหนักที่รับซื้อ'
  }
  if (input.quantity > input.availableCapacity) return 'พื้นที่จัดเก็บเหลือไม่เพียงพอ'
  return ''
}

export function validateIssueInput(input: {
  quantity: number
  balance: number
  referenceNo: string
  requestingUnit: string
}) {
  if (!input.referenceNo.trim()) return 'กรุณาระบุเลขที่อ้างอิง'
  if (!input.requestingUnit.trim()) return 'กรุณาระบุหน่วยงานที่ขอเบิก'
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return 'จำนวนเบิกต้องมากกว่า 0'
  if (input.quantity > input.balance) return 'จำนวนเบิกต้องไม่เกินยอดคงเหลือ'
  return ''
}

export function validateCountInput(input: { countedQuantity: number; description: string }) {
  if (!Number.isFinite(input.countedQuantity) || input.countedQuantity < 0) {
    return 'ยอดตรวจนับต้องเป็น 0 หรือมากกว่า'
  }
  if (!input.description.trim()) return 'กรุณาระบุสาเหตุหรือรายละเอียดการตรวจนับ'
  return ''
}

export function validateDecision(input: { decision: 'approved' | 'rejected'; reason: string }) {
  return input.decision === 'rejected' && !input.reason.trim()
    ? 'กรุณาระบุเหตุผลที่ไม่อนุมัติ'
    : ''
}

export function validateZoneUpdate(input: { capacity: number; quantityOnHand: number }) {
  if (!Number.isFinite(input.capacity) || input.capacity <= 0) return 'ความจุต้องมากกว่า 0'
  return input.capacity < input.quantityOnHand ? 'ความจุต้องไม่น้อยกว่ายอดคงเหลือ' : ''
}

export function capacityPercent(current: number, capacity: number) {
  if (capacity <= 0) return 0
  return Math.min(100, Math.max(0, (current / capacity) * 100))
}

export function stockDiscrepancy(systemQuantity: number, countedQuantity: number) {
  const amount = countedQuantity - systemQuantity
  const direction = amount < 0 ? 'decrease' : amount > 0 ? 'increase' : 'equal'
  return { amount, direction } as const
}

export function filterPendingItems(
  items: PendingWarehouseItem[],
  filters: { status: string; query: string },
) {
  const query = filters.query.trim().toLocaleLowerCase('th')
  return items.filter((item) => {
    if (filters.status && filters.status !== 'all' && item.receivingStatus !== filters.status) {
      return false
    }
    if (!query) return true
    const text = [
      item.purchaseID,
      item.materialID,
      item.material?.materialName,
      item.assessedGrade,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('th')
    return text.includes(query)
  })
}

export type AssessmentBatchGroup = {
  batchID: string
  sellerCode: string
  employeeID: string
  assessedAt: string
  totalQuantity: number
  passed: number
  specialStorage: number
  rejected: number
  items: QualityAssessment[]
}

export function groupAssessmentsByBatch(rows: QualityAssessment[]) {
  const groups = new Map<string, AssessmentBatchGroup>()
  for (const row of rows) {
    const current = groups.get(row.assessmentBatchID) || {
      batchID: row.assessmentBatchID,
      sellerCode: row.assessmentBatch?.sellerCode || '-',
      employeeID: row.assessmentBatch?.employeeID || '-',
      assessedAt: row.assessedAt,
      totalQuantity: 0,
      passed: 0,
      specialStorage: 0,
      rejected: 0,
      items: [],
    }
    current.items.push(row)
    current.totalQuantity += row.assessedQuantity
    current.passed += row.result === 'passed' ? 1 : 0
    current.specialStorage += row.result === 'special_storage' ? 1 : 0
    current.rejected += row.result === 'rejected' ? 1 : 0
    if (row.assessedAt > current.assessedAt) current.assessedAt = row.assessedAt
    groups.set(row.assessmentBatchID, current)
  }
  return [...groups.values()].sort((a, b) => b.assessedAt.localeCompare(a.assessedAt))
}

export function localDateKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export function buildQualityDailyReport(rows: QualityAssessment[], date: string) {
  const selected = rows.filter((row) => localDateKey(row.assessedAt) === date)
  const materials = new Map<string, { materialID: string; materialName: string; quantity: number; items: number }>()
  for (const row of selected) {
    const current = materials.get(row.materialID) || {
      materialID: row.materialID,
      materialName: row.material?.materialName || row.materialID,
      quantity: 0,
      items: 0,
    }
    current.quantity += row.assessedQuantity
    current.items += 1
    materials.set(row.materialID, current)
  }
  return {
    date,
    rows: selected,
    totalBatches: new Set(selected.map((row) => row.assessmentBatchID)).size,
    totalItems: selected.length,
    totalQuantity: selected.reduce((sum, row) => sum + row.assessedQuantity, 0),
    passed: selected.filter((row) => row.result === 'passed').length,
    specialStorage: selected.filter((row) => row.result === 'special_storage').length,
    rejected: selected.filter((row) => row.result === 'rejected').length,
    materials: [...materials.values()].sort((a, b) => b.quantity - a.quantity),
  }
}

export function filterTransactions(
  rows: StockTransaction[],
  filters: { type: string; query: string; date: string },
) {
  const query = filters.query.trim().toLocaleLowerCase('th')
  return rows.filter((row) => {
    const type = row.receiveTransaction ? 'receive' : row.issueTransaction ? 'issue' : 'adjustment'
    if (filters.type !== 'all' && filters.type !== type) return false
    if (filters.date && localDateKey(row.transactionDate) !== filters.date) return false
    if (!query) return true
    return [
      row.zoneID,
      row.zone?.zoneName,
      row.zone?.material?.materialName,
      row.receiveTransaction?.receiveNo,
      row.issueTransaction?.issueNo,
      row.issueTransaction?.referenceNo,
      row.issueTransaction?.requestingUnit,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('th')
      .includes(query)
  })
}
