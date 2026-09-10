import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const reportSource = readFileSync(new URL('../src/pages/operations/QualityReport.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

describe('quality daily report UI', () => {
  it('matches the reference report structure and keeps canonical quality statuses', () => {
    expect(reportSource).toContain('ผ่านการคัดแยก')
    expect(reportSource).toContain('ปฏิเสธ')
    expect(reportSource).toContain('แยกเก็บ')
    expect(reportSource).toContain('ปริมาณที่ประเมินรวม')
    expect(reportSource).toContain('วัสดุผ่านการประเมิน')
    expect(reportSource).toContain('รายการต้องแยกเก็บ')
    expect(reportSource).toContain('รายการที่ปฏิเสธ')
    expect(reportSource).not.toContain('RefreshButton')
    expect(reportSource).not.toContain('สัดส่วนผลประเมิน')
    expect(reportSource).not.toContain('น้ำหนักตามวัสดุ')
  })

  it('paginates each report table independently at 10 rows per page', () => {
    expect(reportSource).toContain('const REPORT_PAGE_SIZE = 10')
    expect(reportSource).toContain('passedPage')
    expect(reportSource).toContain('specialPage')
    expect(reportSource).toContain('rejectedPage')
    expect(reportSource).toContain('slice((page - 1) * REPORT_PAGE_SIZE, page * REPORT_PAGE_SIZE)')
    expect(reportSource).toContain('ก่อนหน้า')
    expect(reportSource).toContain('ถัดไป')
  })

  it('resets every report table to page one when the selected date changes', () => {
    expect(reportSource).toContain('useEffect(() => {')
    expect(reportSource).toContain('setPassedPage(1)')
    expect(reportSource).toContain('setSpecialPage(1)')
    expect(reportSource).toContain('setRejectedPage(1)')
  })

  it('keeps every non-empty report table at the visual height of ten rows', () => {
    expect(reportSource.match(/className="table-scroll quality-report-table-scroll-paginated"/g)?.length).toBe(3)
    expect(reportSource).not.toContain('> REPORT_PAGE_SIZE ?')
    expect(styles).toContain('.quality-report-page .quality-report-table-scroll-paginated')
    expect(styles).toContain('min-height: 590px;')
  })
})
