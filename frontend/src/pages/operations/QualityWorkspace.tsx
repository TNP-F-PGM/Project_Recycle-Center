import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, ClipboardPlus, Plus, ScanLine } from 'lucide-react'
import { Empty, ErrorBox, Loading, PageIntro, RefreshButton, Status } from '../../components/ui'
import { roles, useApp } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import { api, errorText } from '../../services/api'
import type { AssessmentBatch, QualityAssessment } from '../../types'
import { dateLabel, number } from '../../utils/format'

export function QualityWorkspace({ historyOnly = false }: { historyOnly?: boolean }) {
  const { data, workspace, notify } = useApp()
  const batches = useApiList<AssessmentBatch>('/assessment-batches')
  const assessments = useApiList<QualityAssessment>('/quality-assessments')
  const [selectedID, setSelectedID] = useState('')
  const [sellerCode, setSellerCode] = useState('DEMO-SELLER-001')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const createRequestID = useRef(crypto.randomUUID())
  const openBatches = useMemo(
    () => batches.data.filter((b) => b.status === 'in_progress'),
    [batches.data],
  )
  useEffect(() => {
    if (!selectedID && openBatches[0]) setSelectedID(openBatches[0].assessmentBatchID)
  }, [openBatches, selectedID])
  const selected = batches.data.find((b) => b.assessmentBatchID === selectedID)

  async function createBatch(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setActionError('')
    try {
      const created = await api<AssessmentBatch>('/assessment-batches', 'POST', {
        sellerCode,
        employeeID: workspace!.employeeId,
        requestID: createRequestID.current,
      })
      createRequestID.current = crypto.randomUUID()
      await batches.refresh()
      setSelectedID(created.assessmentBatchID)
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
    setBusy(true)
    setActionError('')
    try {
      await api(`/assessment-batches/${encodeURIComponent(selectedID)}/assessments`, 'POST', {
        materialID: form.get('materialID'),
        assessedQuantity: Number(form.get('quantity')),
        assessedGrade: form.get('grade'),
        cleanlinessLevel: form.get('cleanliness'),
        result: form.get('result'),
        detail: form.get('detail') || null,
      })
      target.reset()
      await Promise.all([batches.refresh(), assessments.refresh()])
      notify('บันทึกผลการประเมินแล้ว')
    } catch (cause) {
      setActionError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  async function completeBatch() {
    setBusy(true)
    setActionError('')
    try {
      await api(`/assessment-batches/${encodeURIComponent(selectedID)}/complete`, 'PATCH')
      await batches.refresh()
      setSelectedID('')
      notify('ยืนยันการประเมินเสร็จแล้ว')
    } catch (cause) {
      setActionError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  if (batches.loading || assessments.loading) return <Loading />
  const pageError = actionError || batches.error || assessments.error
  if (historyOnly)
    return (
      <AssessmentHistory
        rows={assessments.data}
        error={pageError}
        refresh={() => Promise.all([batches.refresh(), assessments.refresh()])}
        busy={batches.refreshing || assessments.refreshing}
      />
    )

  return (
    <>
      <PageIntro
        eyebrow={roles.quality.english}
        title="คัดแยกและประเมินคุณภาพ"
        description="เปิดชุดประเมิน บันทึกผลทีละวัสดุ และยืนยันเมื่อครบ"
      >
        <RefreshButton
          onClick={() => void Promise.all([batches.refresh(), assessments.refresh()])}
          busy={batches.refreshing || assessments.refreshing}
        />
      </PageIntro>
      <ErrorBox message={pageError} />
      <div className="operations-split">
        <section className="panel operation-form-panel">
          <div className="panel-heading">
            <div>
              <h2>
                <ClipboardPlus size={17} /> ชุดประเมิน
              </h2>
              <p>หนึ่งชุดใช้กับผู้ขายหนึ่งราย</p>
            </div>
          </div>
          <form className="operation-form" onSubmit={createBatch}>
            <label className="field">
              รหัสผู้ขาย
              <input
                value={sellerCode}
                onChange={(e) => setSellerCode(e.target.value)}
                placeholder="เช่น DEMO-SELLER-001"
                required
              />
            </label>
            <button className="button primary" disabled={busy || !sellerCode.trim()}>
              <Plus size={16} /> เปิดชุดประเมินใหม่
            </button>
          </form>
          <div className="operation-list-label">ชุดที่กำลังประเมิน</div>
          <div className="selection-list">
            {openBatches.map((batch) => (
              <button
                key={batch.assessmentBatchID}
                className={selectedID === batch.assessmentBatchID ? 'selected' : ''}
                aria-pressed={selectedID === batch.assessmentBatchID}
                onClick={() => setSelectedID(batch.assessmentBatchID)}
              >
                <span>
                  <strong>{batch.assessmentBatchID}</strong>
                  <small>
                    {batch.sellerCode} · {batch.assessments?.length || 0} รายการ
                  </small>
                </span>
                <Status value={batch.status} />
              </button>
            ))}
            {!openBatches.length && <p className="list-empty">ยังไม่มีชุดที่กำลังประเมิน</p>}
          </div>
        </section>
        <section className="panel operation-form-panel">
          <div className="panel-heading">
            <div>
              <h2>
                <ScanLine size={17} /> บันทึกผลคัดแยก
              </h2>
              <p>
                {selected
                  ? `ชุด ${selected.assessmentBatchID} · ${selected.sellerCode}`
                  : 'เลือกหรือเปิดชุดประเมินก่อน'}
              </p>
            </div>
          </div>
          {selected ? (
            <form
              key={selected.assessmentBatchID}
              className="operation-form"
              onSubmit={addAssessment}
            >
              <div className="form-grid">
                <label className="field">
                  วัสดุ
                  <select name="materialID" required>
                    {data.materials.map((m) => (
                      <option key={m.material_id} value={m.material_id}>
                        {m.material_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  น้ำหนัก (กก.)
                  <input name="quantity" type="number" min="0.01" step="0.01" required />
                </label>
                <label className="field">
                  เกรด
                  <select name="grade" defaultValue="A">
                    <option>A</option>
                    <option>B</option>
                    <option>C</option>
                  </select>
                </label>
                <label className="field">
                  ความสะอาด
                  <select name="cleanliness" defaultValue="clean">
                    <option value="clean">สะอาด</option>
                    <option value="minor_contamination">ปนเปื้อนเล็กน้อย</option>
                    <option value="contaminated">ปนเปื้อน</option>
                  </select>
                </label>
                <label className="field">
                  ผลประเมิน
                  <select name="result" defaultValue="passed">
                    <option value="passed">ผ่านเกณฑ์</option>
                    <option value="special_storage">จัดเก็บพิเศษ</option>
                    <option value="rejected">ไม่ผ่าน</option>
                  </select>
                </label>
              </div>
              <label className="field">
                รายละเอียดเพิ่มเติม
                <textarea
                  name="detail"
                  rows={3}
                  placeholder="ระบุสิ่งปนเปื้อนหรือข้อสังเกต (ถ้ามี)"
                />
              </label>
              <div className="form-actions">
                <button className="button primary" disabled={busy}>
                  <Plus size={16} /> เพิ่มผลประเมิน
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy || !selected.assessments?.length}
                  onClick={() => void completeBatch()}
                >
                  <CheckCircle2 size={16} /> ยืนยันเสร็จ
                </button>
              </div>
            </form>
          ) : (
            <Empty
              title="เลือกชุดประเมิน"
              message="สร้างชุดใหม่หรือเลือกชุดที่กำลังทำจากด้านซ้าย"
            />
          )}
        </section>
      </div>
      {selected && (
        <section className="panel spaced">
          <div className="panel-heading">
            <div>
              <h2>รายการในชุดนี้</h2>
              <p>{selected.assessments?.length || 0} รายการ</p>
            </div>
          </div>
          <AssessmentTable rows={selected.assessments || []} />
        </section>
      )}
    </>
  )
}

function AssessmentHistory({
  rows,
  error,
  refresh,
  busy,
}: {
  rows: QualityAssessment[]
  error: string
  refresh: () => Promise<unknown>
  busy: boolean
}) {
  return (
    <>
      <PageIntro
        eyebrow={roles.quality.english}
        title="ประวัติการประเมิน"
        description="ผลคัดแยกวัสดุทั้งหมดที่บันทึกไว้"
      >
        <RefreshButton onClick={() => void refresh()} busy={busy} />
      </PageIntro>
      <ErrorBox message={error} />
      <section className="panel">
        <AssessmentTable rows={rows} />
      </section>
    </>
  )
}

function AssessmentTable({ rows }: { rows: QualityAssessment[] }) {
  if (!rows.length)
    return <Empty title="ยังไม่มีผลการประเมิน" message="ผลที่บันทึกแล้วจะแสดงที่นี่" />
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>รหัส / วัสดุ</th>
            <th>น้ำหนัก</th>
            <th>เกรด</th>
            <th>ความสะอาด</th>
            <th>วันที่</th>
            <th>ผล</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.assessmentID}>
              <td>
                <strong>QA-{row.assessmentID}</strong>
                <br />
                <small>{row.material?.materialName || row.materialID}</small>
              </td>
              <td>{number(row.assessedQuantity)} กก.</td>
              <td>{row.assessedGrade}</td>
              <td>{row.cleanlinessLevel}</td>
              <td>{dateLabel(row.assessedAt)}</td>
              <td>
                <Status value={row.result} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
