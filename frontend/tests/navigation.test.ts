import { describe, expect, it } from 'vitest'
import * as layoutModule from '../src/components/Layout'

describe('warehouse navigation', () => {
  it('places inventory fourth, immediately after material issues', () => {
    const navigation =
      (
        layoutModule as typeof layoutModule & {
          warehouseNavigation?: { to: string; label: string }[]
        }
      ).warehouseNavigation ?? []

    expect(navigation.map(({ to, label }) => ({ to, label }))).toEqual([
      { to: '/', label: 'ภาพรวม' },
      { to: '/receipts', label: 'รับวัสดุเข้าคลัง' },
      { to: '/issues', label: 'เบิกจ่ายวัสดุ' },
      { to: '/inventory', label: 'คลังวัสดุ' },
      { to: '/adjustments', label: 'ตรวจนับและปรับยอด' },
      { to: '/stock-history', label: 'ประวัติการเคลื่อนไหว' },
      { to: '/returns', label: 'รับคืนวัสดุ' },
    ])
  })
})
