import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  History,
  PackageSearch,
  Plus,
  Search,
  UserRoundCheck,
  XCircle,
} from 'lucide-react'
import { Empty, ErrorBox, Loading, PageIntro, RefreshButton, Status } from '../../components/ui'
import { QualityHistory } from './QualityHistory'
import { roles, useApp } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import { errorText } from '../../services/api'
import { operationsApi } from '../../services/operationsApi'
import type { AssessmentBatch, AssessmentSellerOption } from '../../types'
import { number, today } from '../../utils/format'
import {
  buildQualityDailyReport,
  canOpenAssessmentBatch,
  cleanlinessLabel,
  qualityResultChoices,
  qualityResultLabel,
  validateAssessmentInput,
} from '../../utils/operations'

export function QualityWorkspace({ initialTab = 'form' }: { initialTab?: 'form' | 'history' }) {
  const { data, workspace, notify } = useApp()
  const [activeTab, setActiveTab] = useState<'form' | 'history'>(initialTab)
  const batches = useApiList<AssessmentBatch>('/assessment-batches')
  const [selectedID, setSelectedID] = useState('')
  const [sellerQuery, setSellerQuery] = useState('')
  const [seller, setSeller] = useState<AssessmentSellerOption | null>(null)
  const [sellerOptions, setSellerOptions] = useState<AssessmentSellerOption[]>([])
  const [searching, setSearching] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [result, setResult] = useState('passed')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const createRequestID = useRef(crypto.randomUUID())

  const employeeBatches = useMemo(
    () => batches.data.filter((batch) => batch.employeeID === workspace?.employeeId),
    [batches.data, workspace?.employeeId],
  )
  const openBatches = useMemo(
    () => employeeBatches.filter((batch) => batch.status === 'in_progress'),
    [employeeBatches],
  )
  const employeeAssessments = useMemo(
    () => employeeBatches.flatMap((batch) => batch.assessments || []),
    [employeeBatches],
  )
  const todayReport = useMemo(
    () => buildQualityDailyReport(employeeAssessments, today()),
    [employeeAssessments],
  )
  const recentAssessments = useMemo(
    () => [...employeeAssessments].sort((a, b) => b.assessedAt.localeCompare(a.assessedAt)).slice(0, 4),
    [employeeAssessments],
  )

  useEffect(() => {
    if (!selectedID && openBatches[0]) setSelectedID(openBatches[0].assessmentBatchID)
  }, [openBatches, selectedID])

  useEffect(() => {
    const query = sellerQuery.trim()
    if (seller?.name === sellerQuery || seller?.sellerCode === sellerQuery) return
    setSeller(null)
    if (query.length < 2) {
      setSellerOptions([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const options = await operationsApi.searchAssessmentSellers(query)
        if (!controller.signal.aborted) setSellerOptions(options)
      } catch (cause) {
        if (!controller.signal.aborted) setActionError(errorText(cause))
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 250)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [sellerQuery, seller])

  const selected = employeeBatches.find((batch) => batch.assessmentBatchID === selectedID)

  async function createBatch(event: FormEvent) {
    event.preventDefault()
    if (!seller || !canOpenAssessmentBatch({ sellerCode: seller.sellerCode, employeeID: workspace!.employeeId })) {
      setActionError('กรุณาค้นหาและเลือกผู้ขายจากรายการ')
      return
    }
    setBusy(true)
    setActionError('')
    try {
      const created = await operationsApi.createAssessmentBatch({
        sellerCode: seller.sellerCode,
        employeeID: workspace!.employeeId,
        requestID: createRequestID.current,
      })
      createRequestID.current = crypto.randomUUID()
      await batches.refresh()
      setSelectedID(created.assessmentBatchID)
      setCreateOpen(false)
      setSeller(null)
      setSellerQuery('')
      notify('สร้างชุดประเมินแล้ว')
    } catch (cause) {
      setActionError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  async function addAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = event.currentTarget
    const form = new FormData(target)
    const quantity = Number(form.get('quantity'))
    const detail = String(form.get('detail') || '')
    const validation = validateAssessmentInput({ quantity, result, detail })
    if (validation) {
      setActionError(validation)
      return
    }
    setBusy(true)
    setActionError('')
    try {
      await operationsApi.addAssessment(selectedID, {
        materialID: String(form.get('materialID')),
        assessedQuantity: quantity,
        assessedGrade: String(form.get('grade')),
        cleanlinessLevel: String(form.get('cleanliness')),
        result,
        detail: detail.trim() || null,
      })
      target.reset()
      setResult('passed')
      await batches.refresh()
      notify('บันทึกผลการประเมินแล้ว')
    } catch (cause) {
      setActionError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  async function completeBatch() {
    if (!selected?.assessments?.length) {
      setActionError('ต้องมีผลประเมินอย่างน้อย 1 รายการก่อนจบชุด')
      return
    }
    setBusy(true)
    setActionError('')
    try {
      await operationsApi.completeAssessmentBatch(selectedID)
      await batches.refresh()
      setSelectedID('')
      notify('ยืนยันการประเมินเสร็จแล้ว')
    } catch (cause) {
      setActionError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  if (batches.loading) return <Loading />

  return (
    <div className="operations-workspace quality-entry quality-clean-page">
      <PageIntro
        eyebrow={roles.quality.english}
        title="คัดแยกคุณภาพ"
        description="เลือกชุดประเมิน แล้วบันทึกผลวัสดุทีละรายการ"
      >
        <RefreshButton onClick={() => void batches.refresh()} busy={batches.refreshing} />
      </PageIntro>
      <ErrorBox message={actionError || batches.error} />

      <div className="quality-workspace-tabs" role="tablist" aria-label="งานคัดแยกคุณภาพ">
        <button type="button" role="tab" aria-selected={activeTab === 'form'} className={activeTab === 'form' ? 'active' : ''} onClick={() => setActiveTab('form')}>บันทึกผลประเมิน</button>
        <button type="button" role="tab" aria-selected={activeTab === 'history'} className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>ประวัติการประเมินทั้งหมด</button>
      </div>

      {activeTab === 'history' ? (
        <QualityHistory embedded />
      ) : (
      <div className="quality-clean-grid">
        <section className="panel quality-form-card">
          <div className="quality-batch-picker">
            <div className="quality-section-heading">
              <div>
                <h2><ClipboardCheck size={17} /> ชุดประเมินที่กำลังทำงาน</h2>
                <p>เลือกชุดที่เปิดอยู่ หรือสร้างชุดใหม่เมื่อเริ่มประเมินผู้ขายรายใหม่</p>
              </div>
              {selected && <Status value={selected.status} label="กำลังประเมิน" />}
            </div>

            <div className="quality-batch-row">
              <label className="field quality-batch-select">ชุดประเมิน
                <select value={selectedID} onChange={(event) => { setSelectedID(event.target.value); setActionError('') }}>
                  <option value="">เลือกชุดประเมินที่ยังไม่ปิด</option>
                  {openBatches.map((batch) => (
                    <option key={batch.assessmentBatchID} value={batch.assessmentBatchID}>
                      {batch.assessmentBatchID} · ผู้ขาย {batch.sellerCode}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button secondary quality-create-toggle" type="button" onClick={() => setCreateOpen((value) => !value)}>
                <Plus size={15} /> สร้างชุดใหม่
              </button>
            </div>

            {selected && (
              <div className="quality-batch-meta">
                <span><strong>{selected.sellerCode}</strong><small>ผู้ขาย</small></span>
                <span><strong>{selected.assessments?.length || 0}</strong><small>รายการที่บันทึก</small></span>
                <button className="button secondary compact" type="button" disabled={busy || !selected.assessments?.length} onClick={() => void completeBatch()}>
                  <CheckCircle2 size={14} /> จบชุดประเมิน
                </button>
              </div>
            )}

            {createOpen && (
              <form className="quality-create-panel" onSubmit={createBatch}>
                <div className="quality-create-title"><UserRoundCheck size={16} /> สร้างชุดประเมินใหม่</div>
                <label className="field">ค้นหาผู้ขาย
                  <span className="input-with-icon"><Search size={16} /><input value={sellerQuery} onChange={(event) => setSellerQuery(event.target.value)} placeholder="พิมพ์ชื่อหรือรหัสอย่างน้อย 2 ตัวอักษร" autoComplete="off" /></span>
                </label>
                {searching && <p className="field-hint">กำลังค้นหา…</p>}
                {sellerOptions.length > 0 && !seller && (
                  <div className="quality-seller-options">
                    {sellerOptions.map((option) => (
                      <button type="button" key={option.sellerCode} onClick={() => { setSeller(option); setSellerQuery(option.name); setSellerOptions([]); setActionError('') }}>
                        <span><strong>{option.name}</strong><small>{option.sellerCode}</small></span>
                      </button>
                    ))}
                  </div>
                )}
                {seller && (
                  <div className="quality-selected-seller">
                    <UserRoundCheck size={18} />
                    <span><strong>{seller.name}</strong><small>{seller.sellerCode}</small></span>
                  </div>
                )}
                <div className="quality-create-actions">
                  <button className="button secondary" type="button" onClick={() => { setCreateOpen(false); setSeller(null); setSellerQuery(''); setSellerOptions([]) }}>ยกเลิก</button>
                  <button className="button primary" disabled={busy || !seller}>สร้างชุดประเมิน</button>
                </div>
              </form>
            )}
          </div>

          <div className="quality-form-body">
            <div className="quality-section-heading compact-heading">
              <div><h2>แบบฟอร์มประเมินคุณภาพ</h2><p>{selected ? `กำลังบันทึกใน ${selected.assessmentBatchID}` : 'เลือกชุดประเมินก่อนเริ่มบันทึก'}</p></div>
            </div>

            {selected ? (
              <form key={selected.assessmentBatchID} onSubmit={addAssessment} className="quality-clean-form">
                <label className="field quality-material-field">วัสดุ
                  <select name="materialID" required>
                    <option value="">เลือกวัสดุที่ต้องการประเมิน</option>
                    {data.materials.map((material) => <option key={material.material_id} value={material.material_id}>{material.material_name}</option>)}
                  </select>
                </label>

                <div className="quality-inline-fields">
                  <label className="field">เกรด<select name="grade" defaultValue="A"><option value="A">เกรด A</option><option value="B">เกรด B</option><option value="C">เกรด C</option></select></label>
                  <label className="field">ความสะอาด<select name="cleanliness" defaultValue="clean"><option value="clean">สะอาด</option><option value="slightly_dirty">สกปรกเล็กน้อย</option><option value="dirty">สกปรก</option></select></label>
                  <label className="field">น้ำหนัก (กก.)<input name="quantity" type="number" min="0.01" step="0.01" placeholder="0.00" required /></label>
                </div>

                <fieldset className="quality-result-fieldset">
                  <legend>ผลการประเมิน</legend>
                  <div className="quality-result-grid">
                    {qualityResultChoices.map((choice) => {
                      const Icon = choice.value === 'passed' ? CheckCircle2 : choice.value === 'rejected' ? XCircle : AlertCircle
                      return (
                        <button key={choice.value} type="button" className={`quality-result-card ${choice.value} ${result === choice.value ? 'active' : ''}`} onClick={() => setResult(choice.value)} aria-pressed={result === choice.value}>
                          <Icon size={17} /><span>{choice.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                <label className="field">เหตุผล/รายละเอียดเพิ่มเติม {result !== 'passed' && <span className="required-mark">*</span>}
                  <textarea name="detail" rows={3} required={result !== 'passed'} placeholder={result === 'passed' ? 'ระบุข้อเสนอแนะเพิ่มเติม (ถ้ามี)' : 'กรุณาระบุเหตุผลที่ปฏิเสธหรือแยกเก็บ'} />
                </label>

                <div className="quality-form-footer">
                  <button className="button secondary" type="reset" onClick={() => setResult('passed')}>ล้างข้อมูล</button>
                  <button className="button success" disabled={busy}><Plus size={16} /> บันทึกผลประเมิน</button>
                </div>
              </form>
            ) : <Empty title="ยังไม่ได้เลือกชุดประเมิน" message="เลือกชุดที่กำลังดำเนินการ หรือสร้างชุดใหม่ด้านบน" />}
          </div>

          {selected && (
            <details className="quality-batch-items">
              <summary><span><PackageSearch size={16} /> รายการในชุดนี้ <b>{selected.assessments?.length || 0}</b></span><ChevronDown size={16} /></summary>
              <AssessmentTable rows={selected.assessments || []} />
            </details>
          )}
        </section>

        <aside className="quality-side-column">
          <section className="panel quality-summary-card">
            <div className="quality-side-title"><ClipboardCheck size={17} /> สรุปผลการประเมินวันนี้</div>
            <div className="quality-summary-list">
              <SummaryRow icon={<CheckCircle2 size={17} />} label="ผ่าน" value={todayReport.passed} tone="passed" />
              <SummaryRow icon={<AlertCircle size={17} />} label="แยกเก็บ" value={todayReport.specialStorage} tone="special" />
              <SummaryRow icon={<XCircle size={17} />} label="ปฏิเสธ" value={todayReport.rejected} tone="rejected" />
            </div>
          </section>

          <section className="panel quality-recent-card">
            <div className="quality-side-title"><History size={17} /> รายการประเมินล่าสุด</div>
            {!recentAssessments.length ? <div className="quality-side-empty">ยังไม่มีการประเมินในวันนี้</div> : (
              <div className="quality-recent-list">
                {recentAssessments.map((row) => (
                  <div key={row.assessmentID} className="quality-recent-item">
                    <div><strong>{row.material?.materialName || row.materialID}</strong><small>{number(row.assessedQuantity)} กก. · เกรด {row.assessedGrade}</small></div>
                    <Status value={row.result} label={qualityResultLabel(row.result)} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
      )}
    </div>
  )
}

function SummaryRow({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return <div className={`quality-summary-row ${tone}`}><span>{icon}<b>{label}</b></span><strong>{number(value)}</strong></div>
}

function AssessmentTable({ rows }: { rows: AssessmentBatch['assessments'] }) {
  if (!rows?.length) return <Empty title="ยังไม่มีผลการประเมิน" message="รายการที่บันทึกจะแสดงที่นี่" />
  return <div className="table-scroll"><table><thead><tr><th>#</th><th>วัสดุ</th><th className="numeric">น้ำหนัก</th><th>เกรด</th><th>ความสะอาด</th><th>ผล</th><th>เหตุผล</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.assessmentID}><td>{index + 1}</td><td><strong>{row.material?.materialName || row.materialID}</strong></td><td className="numeric">{number(row.assessedQuantity)} กก.</td><td>{row.assessedGrade}</td><td>{cleanlinessLabel(row.cleanlinessLevel)}</td><td><Status value={row.result} label={qualityResultLabel(row.result)} /></td><td>{row.detail || '—'}</td></tr>)}</tbody></table></div>
}
