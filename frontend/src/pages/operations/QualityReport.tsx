import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, PackageCheck, XCircle } from 'lucide-react'
import { Empty, ErrorBox, Loading, PageIntro, Status } from '../../components/ui'
import { roles } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import type { QualityAssessment } from '../../types'
import { number, today } from '../../utils/format'
import { buildQualityDailyReport, cleanlinessLabel, qualityResultLabel } from '../../utils/operations'

const REPORT_PAGE_SIZE = 10

export function QualityReport() {
  const assessments = useApiList<QualityAssessment>('/quality-assessments')
  const [date, setDate] = useState(today())
  const [passedPage, setPassedPage] = useState(1)
  const [specialPage, setSpecialPage] = useState(1)
  const [rejectedPage, setRejectedPage] = useState(1)
  const report = useMemo(() => buildQualityDailyReport(assessments.data, date), [assessments.data, date])
  const rows = useMemo(
    () => [...report.rows].sort((a, b) => b.assessedAt.localeCompare(a.assessedAt) || b.assessmentID - a.assessmentID),
    [report.rows],
  )
  const passed = useMemo(() => rows.filter((row) => row.result === 'passed'), [rows])
  const specialStorage = useMemo(() => rows.filter((row) => row.result === 'special_storage'), [rows])
  const rejected = useMemo(() => rows.filter((row) => row.result === 'rejected'), [rows])

  useEffect(() => {
    setPassedPage(1)
    setSpecialPage(1)
    setRejectedPage(1)
  }, [date])

  if (assessments.loading) return <Loading />

  return (
    <div className="operations-workspace quality-report-page">
      <PageIntro
        eyebrow={roles.quality.english}
        title="รายงานประจำวัน"
        description="สรุปผลการคัดแยกประจำวัน แยกรายการผ่าน แยกเก็บ และปฏิเสธจากข้อมูลประเมินจริง"
      >
        <label className="quality-report-date-field">
          <span>วันที่</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </PageIntro>

      <ErrorBox message={assessments.error} />

      <div className="quality-report-metrics">
        <ReportMetric
          icon={<CheckCircle2 size={20} />}
          tone="passed"
          label="ผ่านการคัดแยก"
          value={`${number(passed.length)} รายการ`}
          detail={quantitySummary(passed)}
        />
        <ReportMetric
          icon={<XCircle size={20} />}
          tone="rejected"
          label="ปฏิเสธ"
          value={`${number(rejected.length)} รายการ`}
          detail={rejected.length ? 'ส่งคืน/ทำลาย' : 'ไม่มีรายการ'}
        />
        <ReportMetric
          icon={<AlertTriangle size={20} />}
          tone="special"
          label="แยกเก็บ"
          value={`${number(specialStorage.length)} รายการ`}
          detail={specialStorage.length ? 'รอการจัดการ' : 'ไม่มีรายการ'}
        />
        <ReportMetric
          icon={<PackageCheck size={20} />}
          tone="total"
          label="ปริมาณที่ประเมินรวม"
          value={quantitySummary(rows)}
          detail={`${number(rows.length)} รายการทั้งหมด`}
        />
      </div>

      {!rows.length ? (
        <section className="panel quality-report-empty">
          <Empty title="ไม่มีผลประเมินในวันที่เลือก" message="เลือกวันที่อื่น หรือตรวจสอบว่ามีการบันทึกผลประเมินแล้ว" />
        </section>
      ) : (
        <div className="quality-report-sections">
          <ReportSection title="วัสดุผ่านการประเมิน" tone="passed" count={passed.length}>
            {passed.length ? (
              <>
                <div className="table-scroll quality-report-table-scroll-paginated">
                  <table className="quality-report-table">
                    <thead><tr><th>ลำดับ</th><th>เลขที่อ้างอิง</th><th>รหัส/ชื่อวัสดุ</th><th>เกรด</th><th>ความสะอาด</th><th>จำนวน</th><th>เวลาประเมิน</th><th>สถานะ</th></tr></thead>
                    <tbody>{paginateRows(passed, passedPage).map((row, index) => (
                      <tr key={row.assessmentID}>
                        <td>{(passedPage - 1) * REPORT_PAGE_SIZE + index + 1}</td>
                        <td><strong>{row.assessmentBatchID}</strong></td>
                        <td><strong>{row.material?.materialName || row.materialID}</strong><small>{row.materialID}</small></td>
                        <td>{row.assessedGrade}</td>
                        <td>{cleanlinessLabel(row.cleanlinessLevel)}</td>
                        <td><strong>{quantityLabel(row)}</strong></td>
                        <td>{timeLabel(row.assessedAt)}</td>
                        <td><Status value="passed" label="ผ่าน" /></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <ReportPagination total={passed.length} page={passedPage} onPageChange={setPassedPage} />
              </>
            ) : <SectionEmpty text="ไม่มีวัสดุที่ผ่านการประเมินในวันที่เลือก" />}
          </ReportSection>

          <ReportSection title="รายการต้องแยกเก็บ" tone="special" count={specialStorage.length}>
            {specialStorage.length ? (
              <>
                <div className="table-scroll quality-report-table-scroll-paginated">
                  <table className="quality-report-table quality-report-table-action">
                    <thead><tr><th>ลำดับ</th><th>เลขที่อ้างอิง</th><th>รหัส/ชื่อวัสดุ</th><th>จำนวน</th><th>สถานะ</th><th>เหตุผล/ข้อแนะนำการจัดเก็บ</th><th>เวลาประเมิน</th></tr></thead>
                    <tbody>{paginateRows(specialStorage, specialPage).map((row, index) => (
                      <tr key={row.assessmentID}>
                        <td>{(specialPage - 1) * REPORT_PAGE_SIZE + index + 1}</td>
                        <td><strong>{row.assessmentBatchID}</strong></td>
                        <td><strong>{row.material?.materialName || row.materialID}</strong><small>{row.materialID}</small></td>
                        <td><strong>{quantityLabel(row)}</strong></td>
                        <td><Status value="special_storage" label="แยกเก็บ" /></td>
                        <td>{row.detail || '—'}</td>
                        <td>{timeLabel(row.assessedAt)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <ReportPagination total={specialStorage.length} page={specialPage} onPageChange={setSpecialPage} />
              </>
            ) : <SectionEmpty text="ไม่มีรายการที่ต้องแยกเก็บในวันที่เลือก" />}
          </ReportSection>

          <ReportSection title="รายการที่ปฏิเสธ" tone="rejected" count={rejected.length}>
            {rejected.length ? (
              <>
                <div className="table-scroll quality-report-table-scroll-paginated">
                  <table className="quality-report-table quality-report-table-action">
                    <thead><tr><th>ลำดับ</th><th>เลขที่อ้างอิง</th><th>รหัส/ชื่อวัสดุ</th><th>จำนวน</th><th>สถานะ</th><th>เหตุผลที่ไม่ผ่านการประเมิน</th><th>เวลาประเมิน</th></tr></thead>
                    <tbody>{paginateRows(rejected, rejectedPage).map((row, index) => (
                      <tr key={row.assessmentID}>
                        <td>{(rejectedPage - 1) * REPORT_PAGE_SIZE + index + 1}</td>
                        <td><strong>{row.assessmentBatchID}</strong></td>
                        <td><strong>{row.material?.materialName || row.materialID}</strong><small>{row.materialID}</small></td>
                        <td><strong>{quantityLabel(row)}</strong></td>
                        <td><Status value="rejected" label={qualityResultLabel(row.result)} /></td>
                        <td>{row.detail || '—'}</td>
                        <td>{timeLabel(row.assessedAt)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <ReportPagination total={rejected.length} page={rejectedPage} onPageChange={setRejectedPage} />
              </>
            ) : <SectionEmpty text="ไม่มีรายการที่ปฏิเสธในวันที่เลือก" />}
          </ReportSection>
        </div>
      )}
    </div>
  )
}

function ReportMetric({ icon, tone, label, value, detail }: { icon: React.ReactNode; tone: string; label: string; value: string; detail: string }) {
  return (
    <section className={`quality-report-metric quality-report-metric-${tone}`}>
      <span className="quality-report-metric-icon">{icon}</span>
      <div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div>
    </section>
  )
}

function ReportSection({ title, tone, count, children }: { title: string; tone: string; count: number; children: React.ReactNode }) {
  return (
    <section className={`panel quality-report-section quality-report-section-${tone}`}>
      <header><div><span className="quality-report-section-mark" /><h2>{title}</h2></div><small>{number(count)} รายการ</small></header>
      {children}
    </section>
  )
}

function ReportPagination({ total, page, onPageChange }: { total: number; page: number; onPageChange: (page: number) => void }) {
  const maxPage = Math.max(1, Math.ceil(total / REPORT_PAGE_SIZE))
  if (maxPage <= 1) return null

  return (
    <div className="table-footer quality-report-pagination">
      <span>แสดง {(page - 1) * REPORT_PAGE_SIZE + 1}-{Math.min(page * REPORT_PAGE_SIZE, total)} จาก {number(total)} รายการ</span>
      <div>
        <button disabled={page === 1} onClick={() => onPageChange(page - 1)}>ก่อนหน้า</button>
        <span>{page} / {maxPage}</span>
        <button disabled={page === maxPage} onClick={() => onPageChange(page + 1)}>ถัดไป</button>
      </div>
    </div>
  )
}

function SectionEmpty({ text }: { text: string }) {
  return <div className="quality-report-section-empty">{text}</div>
}

function paginateRows<T>(rows: T[], page: number) {
  return rows.slice((page - 1) * REPORT_PAGE_SIZE, page * REPORT_PAGE_SIZE)
}

function quantityLabel(row: QualityAssessment) {
  return `${number(row.assessedQuantity)} ${row.material?.unit || 'กก.'}`
}

function quantitySummary(rows: QualityAssessment[]) {
  if (!rows.length) return '0 กก.'
  const totals = new Map<string, number>()
  rows.forEach((row) => {
    const unit = row.material?.unit || 'กก.'
    totals.set(unit, (totals.get(unit) || 0) + row.assessedQuantity)
  })
  return [...totals.entries()].map(([unit, quantity]) => `${number(quantity)} ${unit}`).join(' / ')
}

function timeLabel(value: string) {
  return new Date(value).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
