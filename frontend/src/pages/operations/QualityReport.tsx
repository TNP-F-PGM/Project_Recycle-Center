import { useMemo, useState } from 'react'
import { BarChart3, Boxes, ClipboardList, Printer, Scale } from 'lucide-react'
import { Empty, ErrorBox, Loading, PageIntro, RefreshButton, Status } from '../../components/ui'
import { roles } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import type { QualityAssessment } from '../../types'
import { dateLabel, number, today } from '../../utils/format'
import { buildQualityDailyReport } from '../../utils/operations'

export function QualityReport() {
  const assessments = useApiList<QualityAssessment>('/quality-assessments')
  const [date, setDate] = useState(today())
  const report = useMemo(() => buildQualityDailyReport(assessments.data, date), [assessments.data, date])
  const maxMaterial = Math.max(1, ...report.materials.map((row) => row.quantity))
  if (assessments.loading) return <Loading />
  return (
    <div className="operations-workspace quality-report-page">
      <PageIntro eyebrow={roles.quality.english} title="รายงานประจำวัน" description="สรุปผลการคัดแยกตามวันที่ พร้อมรายละเอียดวัสดุและผลประเมิน">
        <label className="compact-date-field">วันที่ <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <RefreshButton onClick={() => void assessments.refresh()} busy={assessments.refreshing} />
        <button className="button primary" onClick={() => window.print()}><Printer size={16} /> พิมพ์รายงาน</button>
      </PageIntro>
      <ErrorBox message={assessments.error} />
      <div className="quality-report-print">
        <header className="report-print-header"><strong>RecycleHub · รายงานผลการคัดแยกประจำวัน</strong><span>{dateLabel(`${date}T12:00:00`)}</span></header>
        <div className="metrics three report-metrics">
          <div className="metric"><span className="metric-icon green"><Scale size={21} /></span><div><p>น้ำหนักรวม</p><strong>{number(report.totalQuantity)} กก.</strong><small>{report.totalItems} รายการ</small></div></div>
          <div className="metric"><span className="metric-icon blue"><ClipboardList size={21} /></span><div><p>ชุดประเมิน</p><strong>{number(report.totalBatches)}</strong><small>ในวันที่เลือก</small></div></div>
          <div className="metric"><span className="metric-icon amber"><Boxes size={21} /></span><div><p>ประเภทวัสดุ</p><strong>{number(report.materials.length)}</strong><small>จากรายการทั้งหมด</small></div></div>
        </div>
        {!report.rows.length ? <section className="panel"><Empty title="ไม่มีผลประเมินในวันนี้" message="เลือกวันที่อื่น หรือเริ่มบันทึกผลประเมิน" /></section> : <>
          <div className="operations-split report-overview">
            <section className="panel"><div className="panel-heading"><div><h2><BarChart3 size={17} /> สัดส่วนผลประเมิน</h2><p>{report.totalItems} รายการ</p></div></div><div className="result-distribution">{[{ label: 'ผ่าน', value: report.passed, className: 'passed' }, { label: 'จัดเก็บพิเศษ', value: report.specialStorage, className: 'special' }, { label: 'ไม่ผ่าน', value: report.rejected, className: 'rejected' }].map((row) => <div key={row.className}><span><strong>{row.label}</strong><b>{row.value} รายการ</b></span><i><em className={row.className} style={{ width: `${report.totalItems ? (row.value / report.totalItems) * 100 : 0}%` }} /></i></div>)}</div></section>
            <section className="panel"><div className="panel-heading"><div><h2><Boxes size={17} /> น้ำหนักตามวัสดุ</h2><p>เรียงจากมากไปน้อย</p></div></div><div className="material-breakdown">{report.materials.map((row) => <div key={row.materialID}><span><strong>{row.materialName}</strong><small>{row.items} รายการ</small></span><i><em style={{ width: `${(row.quantity / maxMaterial) * 100}%` }} /></i><b>{number(row.quantity)} กก.</b></div>)}</div></section>
          </div>
          <section className="panel spaced"><div className="panel-heading"><div><h2>รายละเอียดผลประเมิน</h2><p>{report.totalItems} รายการ</p></div></div><div className="table-scroll"><table><thead><tr><th>เวลา / ล็อต</th><th>วัสดุ</th><th>ผู้ขาย</th><th>น้ำหนัก</th><th>เกรด</th><th>ผล</th><th>รายละเอียด</th></tr></thead><tbody>{report.rows.map((row) => <tr key={row.assessmentID}><td>{dateLabel(row.assessedAt)}<br /><small>{row.assessmentBatchID}</small></td><td>{row.material?.materialName || row.materialID}</td><td>{row.assessmentBatch?.sellerCode || '—'}</td><td>{number(row.assessedQuantity)} กก.</td><td>{row.assessedGrade}</td><td><Status value={row.result} /></td><td>{row.detail || '—'}</td></tr>)}</tbody></table></div></section>
        </>}
      </div>
    </div>
  )
}
