import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../src/pages/operations/InventoryWorkspace.tsx', import.meta.url), 'utf8')

describe('material search reference parity', () => {
  it('includes minimum-stock warning and management flow', () => {
    expect(source).toContain('วัสดุ')
    expect(source).toContain('ชนิดยังไม่กำหนดเกณฑ์ขั้นต่ำ')
    expect(source).toContain('จัดการเกณฑ์ขั้นต่ำ')
    expect(source).toContain('กรอกจำนวนแล้วกดบันทึกทีละวัสดุ เกณฑ์เดียวกันใช้กับทุกเกรด')
    expect(source).toContain('updateMinimumStock')
    expect(source).toContain('ยังไม่กำหนด (')
    expect(source).toContain('วัสดุทั้งหมด (')
    expect(source).toContain('ค้นหาวัสดุเพื่อกำหนดเกณฑ์')
    expect(source).toContain('เกณฑ์ปัจจุบัน')
    expect(source).toContain('กรุณากำหนดเกณฑ์ขั้นต่ำ')
    expect(source).toContain('เกณฑ์ขั้นต่ำต้องมากกว่า 0')
    expect(source).toContain('กำหนดเกณฑ์ครบทุกวัสดุแล้ว')
    expect(source).toContain('ไม่มีวัสดุที่ยังไม่กำหนด')
  })

  it('keeps the reference filters and seven-column inventory table', () => {
    expect(source).toContain('ค้นหาชื่อวัสดุหรือรหัส...')
    expect(source).toContain('ทุกประเภท')
    expect(source).toContain('ทุกเกรด')
    expect(source).toContain('ทุกสถานะ')
    expect(source).toContain('รหัสวัสดุ')
    expect(source).toContain('ชื่อวัสดุ')
    expect(source).toContain('ประเภท')
    expect(source).toContain('เกรด')
    expect(source).toContain('ยอดคงเหลือ')
    expect(source).toContain('เกณฑ์ขั้นต่ำ')
    expect(source).toContain('สถานะ')
  })

  it('paginates material search at ten rows per page and exposes page controls', () => {
    expect(source).toContain('const MATERIAL_PAGE_SIZE = 10')
    expect(source).toContain('slice((materialPage - 1) * MATERIAL_PAGE_SIZE, materialPage * MATERIAL_PAGE_SIZE)')
    expect(source).toContain('ก่อนหน้า')
    expect(source).toContain('ถัดไป')
    expect(source).toContain('setMaterialPage(1)')
  })
})
