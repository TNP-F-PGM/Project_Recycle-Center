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
      { to: '/material-search', label: 'ค้นหาข้อมูลวัสดุ' },
      { to: '/adjustments', label: 'ตรวจนับและปรับยอด' },
      { to: '/stock-history', label: 'ประวัติการเคลื่อนไหว' },
      { to: '/returns', label: 'รับคืนวัสดุ' },
    ])
  })

  it('keeps quality workflows isolated and exposes the daily report', () => {
    const navigation =
      (
        layoutModule as typeof layoutModule & {
          qualityNavigation?: { to: string; label: string }[]
        }
      ).qualityNavigation ?? []

    expect(navigation.map(({ to }) => to)).toEqual([
      '/',
      '/quality',
      '/quality/report',
    ])
    expect(navigation.every(({ to }) => !to.startsWith('/orders'))).toBe(true)
  })

  it('gives warehouse managers zone management without quality routes', () => {
    const navigation =
      (
        layoutModule as typeof layoutModule & {
          warehouseManagerNavigation?: { to: string; label: string }[]
        }
      ).warehouseManagerNavigation ?? []

    expect(navigation.map(({ to }) => to)).toEqual([
      '/',
      '/inventory',
      '/material-search',
      '/adjustments',
      '/stock-history',
    ])
    expect(navigation.every(({ to }) => !to.startsWith('/quality'))).toBe(true)
  })
})
