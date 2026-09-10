import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, FileText, Printer, Search } from 'lucide-react'
import { Empty, ErrorBox, Loading, PageIntro, Status } from '../../components/ui'
import { roles } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import type { AssessmentBatch, QualityAssessment } from '../../types'
import { dateLabel, number, today } from '../../utils/format'
import { cleanlinessLabel, groupAssessmentsByBatch, localDateKey, qualityResultLabel } from '../../utils/operations'

export function QualityHistory({ embedded = false }: { embedded?: boolean }) {
  const assessments = useApiList<QualityAssessment>('/quality-assessments')
  const batches = useApiList<AssessmentBatch>('/assessment-batches?status=completed')
  const completedBatchIDs = useMemo(
    () => new Set(batches.data.filter((batch) => batch.status === 'completed').map((batch) => batch.assessmentBatchID)),
    [batches.data],
  )
  const [query, setQuery] = useState('')
  const [date, setDate] = useState(today())
  const [expanded, setExpanded] = useState('')
  const [printBatch, setPrintBatch] = useState('')
  const groups = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('th')
    return groupAssessmentsByBatch(assessments.data).filter((group) => {
      if (!completedBatchIDs.has(group.batchID)) return false
      if (!needle && localDateKey(group.assessedAt) !== date) return false
      if (!needle) return true
      return [group.batchID, group.sellerCode, group.employeeID, ...group.items.map((item) => item.material?.materialName || item.materialID)]
        .join(' ')
        .toLocaleLowerCase('th')
        .includes(needle)
    })
  }, [assessments.data, completedBatchIDs, date, query])

  function print(groupID: string) {
    setPrintBatch(groupID)
    window.setTimeout(() => window.print(), 0)
  }

  if (assessments.loading || batches.loading) return <Loading />
  return (
    <div className={`operations-workspace quality-history-page ${embedded ? 'quality-history-embedded' : ''}`}>
      {!embedded && (
        <PageIntro eyebrow={roles.quality.english} title="ประวัติการประเมิน" description="ค้นหาใบประเมิน ตรวจผลแบบรายชุด และพิมพ์เอกสาร" />
      )}
      {embedded && <div className="quality-history-inline-head"><div><strong>ประวัติการประเมินทั้งหมด</strong><span>ค้นหาและเปิดดูใบประเมินแบบรายชุด</span></div></div>}
      <ErrorBox message={assessments.error || batches.error} />

      <section className="panel quality-history-toolbar">
        <label className="field quality-history-search">ค้นหาเลขใบประเมิน
          <span className="input-with-icon"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="เช่น BATCH-20260904-000003" /></span>
        </label>
        <label className="field quality-history-date">วันที่<input type="date" value={date} disabled={Boolean(query.trim())} onChange={(event) => setDate(event.target.value)} /></label>
      </section>

      <p className="quality-history-count">{groups.length} ใบผลประเมิน · {groups.reduce((sum, group) => sum + group.items.length, 0)} รายการวัสดุ{query.trim() ? ' · ค้นหาจากทุกวัน' : ''}</p>

      {!groups.length ? (
        <section className="panel"><Empty title="ไม่พบประวัติการประเมิน" message="ลองเปลี่ยนเลขใบประเมินหรือวันที่" /></section>
      ) : (
        <div className="quality-history-list">
          {groups.map((group) => {
            const open = expanded === group.batchID
            const firstAssessedAt = [...group.items].sort((a, b) => a.assessedAt.localeCompare(b.assessedAt))[0]?.assessedAt || group.assessedAt
            return (
              <section className="panel quality-history-card" key={group.batchID}>
                <div className="quality-history-card-head">
                  <div className="quality-history-title-block">
                    <div className="quality-history-title-line"><FileText size={17} /><strong>ใบผลประเมิน</strong><Status value="completed" label="ประเมินแล้ว" /></div>
                    <h2>{group.batchID}</h2>
                    <div className="quality-history-meta">
                      <span><small>ผู้ขาย / รหัสผู้ขาย</small><strong>{group.sellerCode}</strong></span>
                      <span><small>ผู้ประเมิน</small><strong>{group.employeeID}</strong></span>
                      <span><small>เริ่มประเมิน</small><strong>{dateLabel(firstAssessedAt)}</strong></span>
                      <span><small>ประเมินล่าสุด</small><strong>{dateLabel(group.assessedAt)}</strong></span>
                    </div>
                  </div>
                  <button className="button secondary quality-print-button" onClick={() => print(group.batchID)}><Printer size={15} /> พิมพ์ใบประเมิน</button>
                </div>

                <div className="quality-history-results">
                  <ResultSummary value="passed" label="ผ่าน" count={group.passed} quantity={group.items.filter((item) => item.result === 'passed').reduce((sum, item) => sum + item.assessedQuantity, 0)} />
                  <ResultSummary value="rejected" label="ปฏิเสธ" count={group.rejected} quantity={group.items.filter((item) => item.result === 'rejected').reduce((sum, item) => sum + item.assessedQuantity, 0)} />
                  <ResultSummary value="special_storage" label="แยกเก็บ" count={group.specialStorage} quantity={group.items.filter((item) => item.result === 'special_storage').reduce((sum, item) => sum + item.assessedQuantity, 0)} />
                </div>

                <button className="quality-history-expand" onClick={() => setExpanded(open ? '' : group.batchID)} aria-expanded={open}>
                  <span>ดูรายการวัสดุ {group.items.length} รายการ</span>{open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                </button>

                {open && <div className="table-scroll batch-detail-table"><table><thead><tr><th>วัสดุ</th><th>น้ำหนัก</th><th>เกรด</th><th>ความสะอาด</th><th>ผล</th><th>รายละเอียด</th></tr></thead><tbody>{group.items.map((item) => <tr key={item.assessmentID}><td>{item.material?.materialName || item.materialID}</td><td>{number(item.assessedQuantity)} กก.</td><td>{item.assessedGrade}</td><td>{cleanlinessLabel(item.cleanlinessLevel)}</td><td><Status value={item.result} label={qualityResultLabel(item.result)} /></td><td>{item.detail || '—'}</td></tr>)}</tbody></table></div>}

                <article className={`assessment-print-sheet ${printBatch === group.batchID ? 'print-selected' : ''}`}>
                  <header><strong>RecycleHub</strong><span>ใบสรุปผลการประเมินคุณภาพวัสดุ</span></header>
                  <h1>{group.batchID}</h1>
                  <dl><div><dt>รหัสผู้ขาย</dt><dd>{group.sellerCode}</dd></div><div><dt>ผู้ประเมิน</dt><dd>{group.employeeID}</dd></div><div><dt>วันที่ประเมิน</dt><dd>{dateLabel(group.assessedAt)}</dd></div><div><dt>น้ำหนักรวม</dt><dd>{number(group.totalQuantity)} กก.</dd></div></dl>
                  <table><thead><tr><th>วัสดุ</th><th>น้ำหนัก</th><th>เกรด</th><th>ผล</th><th>รายละเอียด</th></tr></thead><tbody>{group.items.map((item) => <tr key={item.assessmentID}><td>{item.material?.materialName || item.materialID}</td><td>{number(item.assessedQuantity)} กก.</td><td>{item.assessedGrade}</td><td>{qualityResultLabel(item.result)}</td><td>{item.detail || '—'}</td></tr>)}</tbody></table>
                  <footer>พิมพ์จากระบบ RecycleHub Operations Portal</footer>
                </article>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ResultSummary({ value, label, count, quantity }: { value: string; label: string; count: number; quantity: number }) {
  return <div className={`quality-history-result quality-history-result-${value}`}><div><Status value={value} label={label} /><span>{count} รายการ</span></div><strong>{quantity > 0 ? `${number(quantity)} กก.` : '—'}</strong></div>
}
