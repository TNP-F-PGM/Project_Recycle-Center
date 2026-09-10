import { useState, type FormEvent } from 'react'
import { ArrowRight, Building2, CalendarClock, Check, ExternalLink, FileCheck2, FilePenLine, Package, Pencil, ScrollText } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ErrorBox, Info, Loading, Modal, PageIntro, Status } from '../components/ui'
import { useApp } from '../context/AppContext'
import { useRecord } from '../hooks/useRecord'
import { api, errorText } from '../services/api'
import { dateLabel, number, statusLabels } from '../utils/format'
import type { ContractRevision, SalesContract } from '../types'

const revisionLabels: Record<string, string> = {
  renewal: 'ต่ออายุสัญญา',
  price_change: 'ปรับราคา',
  discount_change: 'ปรับส่วนลด',
  terms_change: 'แก้ไขเงื่อนไข',
  mixed: 'แก้ไขหลายรายการ',
}

export function ContractDetail() {
  const { id } = useParams()
  const { data, workspace, notify } = useApp()
  const record = useRecord<SalesContract>(`/sales-contracts/${encodeURIComponent(id!)}`)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [signatureOpen, setSignatureOpen] = useState(false)
  if (workspace?.role !== 'sales') return <Navigate to="/" replace />
  if (record.loading) return <Loading />
  if (!record.data) return <ErrorBox message={record.error} retry={record.reload} />
  const contract = record.data
  if (contract.sales_staff_id !== workspace.employeeId)
    return <ErrorBox message="คุณเปิดดูได้เฉพาะสัญญาที่ตนเองรับผิดชอบ" />
  const factory = data.factories.find((item) => item.factory_id === contract.factory_id) || contract.factory
  const canEdit = ['draft', 'pending_approval'].includes(contract.status)
  const unfinishedRevision = contract.revisions?.find((item) => ['pending_review', 'pending_signature'].includes(item.request_status))

  async function updateStatus(status: SalesContract['status'], documentUrl?: string) {
    setBusy(true)
    setActionError('')
    try {
      await api(`/sales-contracts/${encodeURIComponent(contract.contract_id)}`, 'PATCH', {
        status,
        ...(documentUrl !== undefined ? { document_url: documentUrl } : {}),
      })
      notify(status === 'pending_approval' ? 'ส่งสัญญาเพื่อขออนุมัติแล้ว' : 'เปิดใช้งานสัญญาแล้ว')
      setSignatureOpen(false)
      record.reload()
    } catch (reason) {
      setActionError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageIntro eyebrow="SALES CONTRACT" title="รายละเอียดสัญญาซื้อขาย" back="/contracts">
        <Status value={contract.status} />
        {canEdit && <Link className="button secondary" to={`/contracts/${encodeURIComponent(contract.contract_id)}/edit`}><Pencil size={15} />แก้ไขสัญญา</Link>}
      </PageIntro>
      <div className="record-id">{contract.contract_id}</div>
      <ContractProgress status={contract.status} />
      <ErrorBox message={actionError} />
      <div className="detail-grid contract-detail-grid">
        <div>
          <section className="panel form-panel">
            <h2><Building2 size={19} />ข้อมูลคู่สัญญา</h2>
            <dl className="info-grid">
              <Info label="โรงงาน / คู่ค้า">{factory?.company_name || contract.factory_id}</Info>
              <Info label="พนักงานขาย">{data.sales.find((item) => item.employee_id === contract.sales_staff_id)?.name || contract.sales_staff_id}</Info>
              <Info label="ผู้ติดต่อ">{factory?.contact_person}</Info>
              <Info label="โทรศัพท์">{factory?.phone}</Info>
              <Info label="ที่อยู่โรงงาน">{factory?.address}</Info>
              <Info label="วันที่ทำสัญญา">{dateLabel(contract.contract_date)}</Info>
            </dl>
          </section>
          <section className="panel">
            <div className="panel-heading"><h2><Package size={18} />วัสดุและราคาตามสัญญา</h2><span className="muted">{contract.materials.length} รายการ</span></div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>วัสดุ</th><th className="numeric">จำนวน</th><th className="numeric">ราคาต่อหน่วย</th><th className="numeric">ส่วนลด</th><th className="numeric">มูลค่าหลังส่วนลด</th></tr></thead>
                <tbody>
                  {contract.materials.map((line) => {
                    const material = data.materials.find((item) => item.material_id === line.material_id)
                    const total = line.contract_quantity * line.unit_price * (1 - line.volume_discount_percent / 100)
                    return <tr key={line.material_id}>
                      <td><strong>{material?.material_name || line.material_id}</strong><small className="table-subtitle">{line.material_id}</small></td>
                      <td className="numeric">{number(line.contract_quantity)} {material?.unit || ''}</td>
                      <td className="numeric">{number(line.unit_price)} บาท</td>
                      <td className="numeric">{number(line.volume_discount_percent)}%</td>
                      <td className="numeric"><strong>{number(total)} บาท</strong></td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel form-panel contract-terms">
            <h2><ScrollText size={19} />เงื่อนไขการซื้อขาย</h2>
            <p>{contract.terms}</p>
          </section>
          <RevisionSection revisions={contract.revisions || []} />
        </div>
        <aside>
          <section className="panel form-panel">
            <h2><CalendarClock size={19} />อายุสัญญา</h2>
            <dl>
              <Info label="วันที่เริ่มมีผล">{dateLabel(contract.valid_from)}</Info>
              <Info label="วันหมดอายุ">{dateLabel(contract.valid_to)}</Info>
              <Info label="เอกสารสัญญา"><DocumentValue value={contract.document_url} /></Info>
            </dl>
          </section>
          <section className="panel form-panel contract-action-card">
            <h2><FileCheck2 size={19} />ขั้นตอนถัดไป</h2>
            {contract.status === 'draft' && <><p>ตรวจข้อมูลให้ครบ แล้วส่งให้ผู้มีอำนาจตรวจสอบและอนุมัติ</p><button className="button primary full" disabled={busy} onClick={() => void updateStatus('pending_approval')}>ส่งขออนุมัติ<ArrowRight size={15} /></button></>}
            {contract.status === 'pending_approval' && <div className="summary-note">ส่งคำขอแล้ว กำลังรอผู้มีอำนาจอนุมัติสัญญา ฝ่ายขายยังแก้ไขรายละเอียดได้หากได้รับข้อมูลกลับมา</div>}
            {contract.status === 'pending_signature' && <><p>สัญญาผ่านการอนุมัติแล้ว บันทึกเอกสารที่ลงนามเพื่อเปิดใช้งาน</p><button className="button primary full" onClick={() => setSignatureOpen(true)}>บันทึกการลงนาม</button></>}
            {['active', 'expired'].includes(contract.status) && <><p>{unfinishedRevision ? 'มีคำขอแก้ไขที่กำลังดำเนินการอยู่' : 'ขอต่ออายุ ปรับราคา ส่วนลด หรือเงื่อนไขได้โดยไม่เขียนทับสัญญาเดิม'}</p><button className="button secondary full" disabled={Boolean(unfinishedRevision)} onClick={() => setRevisionOpen(true)}><FilePenLine size={15} />ขอแก้ไขสัญญา</button></>}
            {contract.status === 'cancelled' && <p className="muted">สัญญานี้ถูกยกเลิกและไม่สามารถนำไปใช้อ้างอิงรายการขายได้</p>}
          </section>
        </aside>
      </div>
      {signatureOpen && <SignatureModal busy={busy} defaultValue={contract.document_url || ''} onClose={() => setSignatureOpen(false)} onSubmit={(value) => updateStatus('active', value)} />}
      {revisionOpen && <RevisionModal contract={contract} busy={busy} onClose={() => setRevisionOpen(false)} onSaved={() => { setRevisionOpen(false); record.reload(); notify('ส่งคำขอแก้ไขสัญญาแล้ว') }} setBusy={setBusy} setError={setActionError} />}
    </>
  )
}

function ContractProgress({ status }: { status: SalesContract['status'] }) {
  const steps = ['draft', 'pending_approval', 'pending_signature', 'active']
  const index = steps.indexOf(status)
  if (status === 'cancelled') return <div className="cancelled-note panel progress-panel">สัญญานี้ถูกยกเลิกแล้ว</div>
  return <section className="panel progress-panel"><ol className="stepper contract-stepper">{steps.map((step, stepIndex) => <li className={stepIndex <= index || status === 'expired' ? 'done' : ''} key={step}><span>{stepIndex < index || status === 'expired' ? <Check size={14} /> : stepIndex + 1}</span><small>{statusLabels[step]}</small></li>)}</ol></section>
}

function DocumentValue({ value }: { value: string | null }) {
  if (!value) return <>ยังไม่มีเอกสาร</>
  if (/^https?:\/\//i.test(value)) return <a className="text-link" href={value} target="_blank" rel="noreferrer">เปิดเอกสาร<ExternalLink size={13} /></a>
  return <span className="break-id">{value}</span>
}

function RevisionSection({ revisions }: { revisions: ContractRevision[] }) {
  return <section className="panel contract-revisions">
    <div className="panel-heading"><div><h2><FilePenLine size={18} />ประวัติการขอแก้ไขสัญญา</h2><p>เก็บข้อมูลเดิมและข้อมูลใหม่ไว้ตรวจสอบย้อนหลัง</p></div><span className="muted">{revisions.length} รายการ</span></div>
    {!revisions.length ? <div className="compact-empty">ยังไม่มีคำขอแก้ไขสัญญา</div> : <div className="revision-list">{revisions.map((revision) => <article key={revision.revision_id} className="revision-card">
      <div className="revision-heading"><div><strong>{revisionLabels[revision.request_type]}</strong><small>{revision.revision_id} · ขอเมื่อ {dateLabel(revision.requested_at)}</small></div><Status value={revision.request_status} /></div>
      <p className="revision-reason">เหตุผล: {revision.reason}</p>
      <div className="contract-comparison">
        <div><small>ข้อมูลเดิม</small><b>หมดอายุ {dateLabel(revision.original_valid_to)}</b><p>{revision.original_terms}</p></div>
        <ArrowRight size={17} />
        <div className="proposed"><small>ข้อตกลงใหม่ (ที่ขออนุมัติ)</small><b>{revision.new_valid_to ? `หมดอายุ ${dateLabel(revision.new_valid_to)}` : 'วันหมดอายุเดิม'}</b><p>{revision.new_terms || revision.original_terms}</p>{revision.price_adjustment_percent !== null && <em>ปรับราคา {revision.price_adjustment_percent > 0 ? '+' : ''}{number(revision.price_adjustment_percent)}%</em>}{revision.new_volume_discount_percent !== null && <em>ส่วนลดใหม่ {number(revision.new_volume_discount_percent)}%</em>}</div>
      </div>
      {revision.review_note && <p className="review-note">หมายเหตุผู้ตรวจสอบ: {revision.review_note}</p>}
    </article>)}</div>}
  </section>
}

function SignatureModal({ busy, defaultValue, onClose, onSubmit }: { busy: boolean; defaultValue: string; onClose: () => void; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState('')
  function submit(event: FormEvent) { event.preventDefault(); if (!value.trim()) return setError('กรุณาระบุลิงก์หรือที่อยู่ไฟล์สัญญาที่ลงนามแล้ว'); onSubmit(value.trim()) }
  return <Modal title="บันทึกสัญญาที่ลงนามแล้ว" onClose={onClose} busy={busy}><form className="modal-body" onSubmit={submit}><p>เมื่อบันทึกแล้ว สัญญาจะเปลี่ยนเป็นสถานะใช้งานอยู่</p><label className="field">ลิงก์หรือที่อยู่ไฟล์ฉบับลงนาม <span className="required">*</span><input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://... หรือชื่อไฟล์ PDF" /></label><ErrorBox message={error} /><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>ยกเลิก</button><button className="button primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'เปิดใช้งานสัญญา'}</button></div></form></Modal>
}

function RevisionModal({ contract, busy, onClose, onSaved, setBusy, setError }: { contract: SalesContract; busy: boolean; onClose: () => void; onSaved: () => void; setBusy: (value: boolean) => void; setError: (value: string) => void }) {
  const { workspace } = useApp()
  const [requestType, setRequestType] = useState('renewal')
  const [reason, setReason] = useState('')
  const [newValidTo, setNewValidTo] = useState('')
  const [newTerms, setNewTerms] = useState('')
  const [priceAdjustment, setPriceAdjustment] = useState('')
  const [discount, setDiscount] = useState('')
  const [draftDocument, setDraftDocument] = useState('')
  const [localError, setLocalError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!reason.trim()) return setLocalError('กรุณาระบุเหตุผลที่ขอแก้ไข')
    if (!newValidTo && !newTerms.trim() && priceAdjustment === '' && discount === '') return setLocalError('กรุณาระบุข้อมูลใหม่อย่างน้อยหนึ่งรายการ')
    setBusy(true); setLocalError(''); setError('')
    try {
      await api(`/sales-contracts/${encodeURIComponent(contract.contract_id)}/revisions`, 'POST', {
        request_type: requestType,
        reason: reason.trim(),
        new_valid_to: newValidTo || null,
        new_terms: newTerms.trim() || null,
        price_adjustment_percent: priceAdjustment === '' ? null : Number(priceAdjustment),
        new_volume_discount_percent: discount === '' ? null : Number(discount),
        draft_document: draftDocument.trim() || null,
        requested_by: workspace!.employeeId,
      })
      onSaved()
    } catch (reasonValue) { setLocalError(errorText(reasonValue)) } finally { setBusy(false) }
  }
  return <Modal title="ขอแก้ไขหรือต่ออายุสัญญา" onClose={onClose} busy={busy} wide><form className="modal-body" onSubmit={submit}><p>ระบบจะเก็บข้อมูลเดิมไว้ และสร้างรายการใหม่เพื่อส่งตรวจสอบ</p><div className="form-grid"><label className="field">ประเภทคำขอ<select value={requestType} onChange={(event) => setRequestType(event.target.value)}><option value="renewal">ต่ออายุสัญญา</option><option value="price_change">ปรับราคา</option><option value="discount_change">ปรับส่วนลด</option><option value="terms_change">แก้ไขเงื่อนไข</option><option value="mixed">แก้ไขหลายรายการ</option></select></label><label className="field">วันหมดอายุใหม่<input type="date" min={contract.valid_from.slice(0, 10)} value={newValidTo} onChange={(event) => setNewValidTo(event.target.value)} /></label><label className="field">ปรับราคา (%)<input type="number" min="-99.99" step="0.01" placeholder="เช่น 5 หรือ -2" value={priceAdjustment} onChange={(event) => setPriceAdjustment(event.target.value)} /></label><label className="field">ส่วนลดใหม่ (%)<input type="number" min="0" max="100" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label><label className="field span-2">เงื่อนไขใหม่<textarea rows={4} value={newTerms} onChange={(event) => setNewTerms(event.target.value)} /></label><label className="field span-2">เหตุผล <span className="required">*</span><textarea required rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label><label className="field span-2">เอกสารร่างฉบับแก้ไข<input value={draftDocument} onChange={(event) => setDraftDocument(event.target.value)} placeholder="https://... หรือชื่อไฟล์ PDF" /></label></div><ErrorBox message={localError} /><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>ยกเลิก</button><button className="button primary" disabled={busy}>{busy ? 'กำลังส่ง…' : 'ส่งคำขอแก้ไข'}</button></div></form></Modal>
}
