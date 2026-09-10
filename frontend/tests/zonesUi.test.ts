import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../src/pages/operations/ZoneWorkspace.tsx', import.meta.url), 'utf8')

describe('zone workspace UI parity with UI-design-SA', () => {
  it('keeps the exact reference page sections and actions', () => {
    expect(source).toContain('zone-reference-exact')
    expect(source).toContain('โซนจัดเก็บวัสดุ')
    expect(source).toContain('เพิ่มคลังสินค้า')
    expect(source).toContain('เพิ่มโซนจัดเก็บ')
    expect(source).toContain('กรองตามคลัง:')
    expect(source).toContain('มุมมองการจัดกลุ่ม:')
    expect(source).toContain('ตามเกรดคุณภาพ')
    expect(source).toContain('โซนทั้งหมด')
    expect(source).toContain('โซนสำหรับวัสดุเกรด')
    expect(source).toContain('ความจุรวม')
    expect(source).toContain('ใช้ไปแล้ว')
    expect(source).toContain('ว่างคงเหลือ')
    expect(source).toContain('แก้ไขโซน')
    expect(source).toContain('ยังแบ่งได้')
    expect(source).toContain('ความจุโซนต้องไม่เกิน')
    expect(source).toContain('max={remainingZoneCapacity || undefined}')
  })
})
