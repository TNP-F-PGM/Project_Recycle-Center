import { describe, expect, it } from 'vitest'
import {
  buildQualityDailyReport,
  capacityPercent,
  filterPendingItems,
  groupAssessmentsByBatch,
  qualityResultChoices,
  qualityResultLabel,
  stockDiscrepancy,
  validateAssessmentInput,
  validateDecision,
  validateIssueInput,
  validateReceiptInput,
  validateZoneUpdate,
} from '../src/utils/operations'
import type { PendingWarehouseItem, QualityAssessment } from '../src/types'

const assessmentBase: QualityAssessment = {
  assessmentID: 1,
  assessedGrade: 'A',
  cleanlinessLevel: 'clean',
  result: 'passed',
  detail: null,
  assessedQuantity: 10,
  assessedAt: '2026-09-10T08:00:00+07:00',
  assessmentBatchID: 'LOT-001',
  materialID: 'MAT-01',
  material: {
    materialID: 'MAT-01',
    materialName: 'เหล็ก',
    unit: 'kg',
    status: 'active',
    grade: 'A',
    currentQuantity: 0,
    minStockLevel: 0,
    minimumStockConfigured: false,
    belowMin: false,
    materialTypeID: 1,
    warehouseStocks: [],
  },
  assessmentBatch: { assessmentBatchID: 'LOT-001', sellerCode: 'S001', employeeID: 'Q001' },
}

describe('operation validation', () => {
  it('requires a reason for rejected or special-storage assessments', () => {
    expect(validateAssessmentInput({ quantity: 5, result: 'rejected', detail: '' })).toBe(
      'กรุณาระบุเหตุผลหรือรายละเอียด',
    )
    expect(
      validateAssessmentInput({ quantity: 5, result: 'special_storage', detail: 'แยกพื้นที่' }),
    ).toBe('')
  })

  it('requires receiving the exact assessed quantity and enough zone capacity', () => {
    expect(validateReceiptInput({ quantity: 11, assessedQuantity: 10, availableCapacity: 20 })).toBe(
      'น้ำหนักรับเข้าต้องเท่ากับน้ำหนักที่รับซื้อ',
    )
    expect(validateReceiptInput({ quantity: 9, assessedQuantity: 10, availableCapacity: 20 })).toBe(
      'น้ำหนักรับเข้าต้องเท่ากับน้ำหนักที่รับซื้อ',
    )
    expect(validateReceiptInput({ quantity: 10, assessedQuantity: 10, availableCapacity: 5 })).toBe(
      'พื้นที่จัดเก็บเหลือไม่เพียงพอ',
    )
  })

  it('requires valid issue references and available stock', () => {
    expect(
      validateIssueInput({ quantity: 6, balance: 5, referenceNo: 'REQ-1', requestingUnit: 'ผลิต' }),
    ).toBe('จำนวนเบิกต้องไม่เกินยอดคงเหลือ')
    expect(
      validateIssueInput({ quantity: 1, balance: 5, referenceNo: '', requestingUnit: 'ผลิต' }),
    ).toBe('กรุณาระบุเลขที่อ้างอิง')
  })

  it('guards zone capacity and rejection decisions', () => {
    expect(validateZoneUpdate({ capacity: 9, quantityOnHand: 10 })).toBe(
      'ความจุต้องไม่น้อยกว่ายอดคงเหลือ',
    )
    expect(validateDecision({ decision: 'rejected', reason: '' })).toBe(
      'กรุณาระบุเหตุผลที่ไม่อนุมัติ',
    )
  })

  it('uses the same three quality labels everywhere', () => {
    expect(qualityResultLabel('passed')).toBe('ผ่าน')
    expect(qualityResultLabel('special_storage')).toBe('แยกเก็บ')
    expect(qualityResultLabel('rejected')).toBe('ปฏิเสธ')
  })

  it('offers the compact assessment result choices in workflow order', () => {
    expect(qualityResultChoices).toEqual([
      { value: 'passed', label: 'ผ่าน' },
      { value: 'rejected', label: 'ปฏิเสธ' },
      { value: 'special_storage', label: 'แยกเก็บ' },
    ])
  })
})

describe('operation summaries', () => {
  it('groups assessment items by batch and totals a local day', () => {
    const rows: QualityAssessment[] = [
      assessmentBase,
      {
        ...assessmentBase,
        assessmentID: 2,
        result: 'special_storage',
        assessedQuantity: 15,
        materialID: 'MAT-02',
        material: { ...assessmentBase.material!, materialID: 'MAT-02', materialName: 'ทองแดง' },
      },
      {
        ...assessmentBase,
        assessmentID: 3,
        assessmentBatchID: 'LOT-002',
        assessedAt: '2026-09-11T00:01:00+07:00',
      },
    ]

    expect(groupAssessmentsByBatch(rows)[0]).toMatchObject({
      batchID: 'LOT-002',
      totalQuantity: 10,
    })
    expect(groupAssessmentsByBatch(rows)[1].items).toHaveLength(2)
    expect(buildQualityDailyReport(rows, '2026-09-10')).toMatchObject({
      totalItems: 2,
      totalQuantity: 25,
      passed: 1,
      specialStorage: 1,
      rejected: 0,
    })
  })

  it('filters pending receipts by status and material text', () => {
    const items: PendingWarehouseItem[] = [
      {
        pendingID: 1,
        quantity: 10,
        assessedGrade: 'A',
        assessedBy: 'Q1',
        transferredDate: '2026-09-10',
        stockRouteType: 'normal',
        purchaseID: 'PUR-1',
        receivingStatus: 'waiting_receipt',
        materialID: 'MAT-1',
        material: { ...assessmentBase.material!, materialName: 'ทองแดง' },
      },
      {
        pendingID: 2,
        quantity: 8,
        assessedGrade: 'B',
        assessedBy: 'Q1',
        transferredDate: '2026-09-09',
        stockRouteType: 'normal',
        purchaseID: 'PUR-2',
        receivingStatus: 'received',
        materialID: 'MAT-2',
        material: { ...assessmentBase.material!, materialName: 'เหล็ก' },
      },
    ]

    expect(filterPendingItems(items, { status: 'waiting_receipt', query: 'ทองแดง' })).toHaveLength(1)
  })

  it('calculates bounded capacity and signed stock discrepancy', () => {
    expect(capacityPercent(25, 100)).toBe(25)
    expect(capacityPercent(5, 0)).toBe(0)
    expect(capacityPercent(120, 100)).toBe(100)
    expect(stockDiscrepancy(10, 8)).toEqual({ amount: -2, direction: 'decrease' })
    expect(stockDiscrepancy(10, 10)).toEqual({ amount: 0, direction: 'equal' })
  })
})
