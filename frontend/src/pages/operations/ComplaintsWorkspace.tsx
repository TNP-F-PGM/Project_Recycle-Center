import { useRef, useState, type FormEvent } from 'react'
import { Check, ClipboardCheck, MessageSquareWarning, PackageCheck, Plus, X } from 'lucide-react'
import { Empty, ErrorBox, Loading, PageIntro, RefreshButton, Status } from '../../components/ui'
import { roles, useApp } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import { api, errorText } from '../../services/api'
import type { Complaint, ReturnRecord, Warehouse } from '../../types'
import { dateLabel, number } from '../../utils/format'

export function ComplaintsWorkspace() {
  const { workspace, data: appData, notify } = useApp()
  const complaints = useApiList<Complaint>('/complaints')
  const [selectedID, setSelectedID] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const nextComplaintID = useRef(`CMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`)
  const complaintOrders = appData.orders
  const visibleComplaints = complaints.data
  const selected =
    visibleComplaints.find((row) => row.complaint_id === selectedID) ||
    visibleComplaints.find((row) => row.status === 'pending')

  async function createComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = event.currentTarget
    const form = new FormData(target)
    setBusy(true)
    setError('')
    try {
      await api('/complaints', 'POST', {
        complaintID: nextComplaintID.current,
        orderID: form.get('orderID'),
        problemDescription: form.get('description'),
        evidenceFile: form.get('evidenceFile'),
      })
      nextComplaintID.current = `CMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
      target.reset()
      await complaints.refresh()
      notify('บันทึกคำร้องเรียนจากลูกค้าแล้ว')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }
  async function review(decision: 'approved' | 'rejected', form: HTMLFormElement) {
    if (!selected) return
    const data = new FormData(form)
    setError('')
    const reason = String(data.get('reason') || '').trim()
    if (decision === 'rejected' && !reason) {
      setError('กรุณาระบุเหตุผลที่ไม่อนุมัติ')
      return
    }
    setBusy(true)
    try {
      await api(`/complaints/${encodeURIComponent(selected.complaint_id)}/review`, 'PATCH', {
        status: decision,
        result: data.get('result'),
        rejectionReason: decision === 'rejected' ? reason : '',
        reviewedBy: workspace!.employeeId,
      })
      await complaints.refresh()
      setSelectedID('')
      notify(decision === 'approved' ? 'อนุมัติคำร้องเรียนแล้ว' : 'ไม่อนุมัติคำร้องเรียนแล้ว')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }
  if (complaints.loading) return <Loading />
  return (
    <>
      <PageIntro
        eyebrow={roles.customer_service.english}
        title="จัดการคำร้องเรียน"
        description="รับเรื่อง ตรวจสอบหลักฐาน และประสานการรับคืนวัสดุกับคลังสินค้า"
      >
        <RefreshButton onClick={() => void complaints.refresh()} busy={complaints.refreshing} />
      </PageIntro>
      <ErrorBox message={error || complaints.error} />
      <section className="panel inline-create complaint-create">
        <div>
          <span className="metric-icon amber">
            <MessageSquareWarning size={21} />
          </span>
          <div>
            <h2>บันทึกเรื่องจากลูกค้า</h2>
            <p>ใช้เมื่อได้รับแจ้งทางโทรศัพท์ อีเมล หรือช่องทางภายนอก</p>
          </div>
        </div>
        <form onSubmit={createComplaint}>
          <label className="field">
            คำสั่งซื้อ
            <select name="orderID" required>
              {complaintOrders.map((order) => (
                <option key={order.order_id} value={order.order_id}>
                  {order.order_id}
                </option>
              ))}
            </select>
          </label>
          <label className="field wide-field">
            รายละเอียดปัญหา
            <input name="description" required placeholder="สรุปปัญหาที่ลูกค้าแจ้ง" />
          </label>
          <label className="field">
            ลิงก์หรือชื่อไฟล์หลักฐาน
            <input name="evidenceFile" placeholder="ถ้ามี" />
          </label>
          <button className="button primary" disabled={busy || !complaintOrders.length}>
            <Plus size={16} /> บันทึกคำร้อง
          </button>
        </form>
      </section>
      <div className="operations-split complaint-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                <MessageSquareWarning size={17} /> รายการคำร้อง
              </h2>
              <p>{complaints.data.filter((c) => c.status === 'pending').length} รายการรอพิจารณา</p>
            </div>
          </div>
          <div className="selection-list roomy">
            {complaints.data.map((row) => (
              <button
                key={row.complaint_id}
                className={selected?.complaint_id === row.complaint_id ? 'selected' : ''}
                aria-pressed={selected?.complaint_id === row.complaint_id}
                onClick={() => setSelectedID(row.complaint_id)}
              >
                <span>
                  <strong>{row.complaint_id}</strong>
                  <small>
                    {row.order_id} · {dateLabel(row.complaint_date)}
                  </small>
                </span>
                <Status
                  value={row.status}
                  label={row.status === 'pending' ? 'รอพิจารณา' : undefined}
                />
              </button>
            ))}
            {!complaints.data.length && (
              <Empty title="ยังไม่มีคำร้องเรียน" message="คำร้องจากคู่ค้าจะแสดงที่นี่" />
            )}
          </div>
        </section>
        <section className="panel operation-form-panel">
          <div className="panel-heading">
            <div>
              <h2>
                <ClipboardCheck size={17} /> รายละเอียดและผลพิจารณา
              </h2>
              <p>{selected?.complaint_id || 'เลือกคำร้องจากด้านซ้าย'}</p>
            </div>
          </div>
          {selected ? (
            <div key={selected.complaint_id} className="operation-form">
              <dl className="complaint-detail">
                <div>
                  <dt>คำสั่งซื้อ</dt>
                  <dd>{selected.order_id}</dd>
                </div>
                <div>
                  <dt>วันที่แจ้ง</dt>
                  <dd>{dateLabel(selected.complaint_date)}</dd>
                </div>
                <div className="full-row">
                  <dt>รายละเอียดปัญหา</dt>
                  <dd>{selected.problem_description}</dd>
                </div>
                <div className="full-row">
                  <dt>หลักฐาน</dt>
                  <dd className="break-id">
                    {safeEvidenceURL(selected.evidence_file) ? (
                      <a
                        className="text-link"
                        href={safeEvidenceURL(selected.evidence_file)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        เปิดหลักฐาน
                      </a>
                    ) : (
                      selected.evidence_file || 'ไม่ได้แนบหลักฐาน'
                    )}
                  </dd>
                </div>
              </dl>
              {selected.status === 'pending' ? (
                <form onSubmit={(e) => e.preventDefault()}>
                  <label className="field">
                    ผลการตรวจสอบ
                    <textarea name="result" rows={3} placeholder="สรุปสิ่งที่ตรวจพบ" />
                  </label>
                  <label className="field">
                    เหตุผลเมื่อไม่อนุมัติ
                    <textarea name="reason" rows={2} placeholder="กรอกเมื่อต้องการปฏิเสธคำร้อง" />
                  </label>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="button primary"
                      disabled={busy}
                      onClick={(e) => void review('approved', e.currentTarget.form!)}
                    >
                      <Check size={16} /> อนุมัติรับคืน
                    </button>
                    <button
                      type="button"
                      className="button danger"
                      disabled={busy}
                      onClick={(e) => void review('rejected', e.currentTarget.form!)}
                    >
                      <X size={16} /> ไม่อนุมัติ
                    </button>
                  </div>
                </form>
              ) : (
                <div className="decision-result">
                  <Status
                    value={selected.status}
                    label={selected.status === 'pending' ? 'รอพิจารณา' : undefined}
                  />
                  {selected.result && (
                    <p>
                      <strong>ผลตรวจ:</strong> {selected.result}
                    </p>
                  )}
                  {selected.rejection_reason && (
                    <p>
                      <strong>เหตุผลที่ไม่อนุมัติ:</strong> {selected.rejection_reason}
                    </p>
                  )}
                  {!selected.result && !selected.rejection_reason && <p>ดำเนินการพิจารณาแล้ว</p>}
                </div>
              )}
            </div>
          ) : (
            <Empty title="เลือกคำร้องเรียน" message="รายละเอียดจะปรากฏในส่วนนี้" />
          )}
        </section>
      </div>
    </>
  )
}

function safeEvidenceURL(value: string) {
  const trimmed = value.trim()
  return /^(https?:\/\/|\/)/i.test(trimmed) ? trimmed : ''
}

function ComplaintTable({ rows }: { rows: Complaint[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>ประวัติคำร้องเรียน</h2>
          <p>{rows.length} รายการ</p>
        </div>
      </div>
      {!rows.length ? (
        <Empty title="ยังไม่มีคำร้องเรียน" message="คำร้องที่ส่งแล้วจะแสดงที่นี่" />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>เลขคำร้อง</th>
                <th>คำสั่งซื้อ</th>
                <th>วันที่แจ้ง</th>
                <th>รายละเอียด</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.complaint_id}>
                  <td>
                    <strong>{row.complaint_id}</strong>
                  </td>
                  <td>{row.order_id}</td>
                  <td>{dateLabel(row.complaint_date)}</td>
                  <td>{row.problem_description}</td>
                  <td>
                    <Status
                      value={row.status}
                      label={row.status === 'pending' ? 'รอพิจารณา' : undefined}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function ReturnsWorkspace() {
  const { workspace, notify } = useApp()
  const returns = useApiList<ReturnRecord>('/return-records')
  const complaints = useApiList<Complaint>('/complaints')
  const warehouses = useApiList<Warehouse>('/warehouses')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canReceive = workspace?.role === 'warehouse'
  const eligible = complaints.data.filter(
    (c) => c.status === 'approved' && !returns.data.some((r) => r.complaint_id === c.complaint_id),
  )
  const refresh = () => Promise.all([returns.refresh(), complaints.refresh(), warehouses.refresh()])
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = event.currentTarget
    const form = new FormData(target)
    setBusy(true)
    setError('')
    try {
      await api('/return-records', 'POST', {
        returnQuantity: Number(form.get('quantity')),
        processedBy: workspace!.employeeId,
        warehouseID: form.get('warehouseID'),
        complaintID: form.get('complaintID'),
      })
      target.reset()
      await refresh()
      notify('บันทึกรับคืนวัสดุแล้ว')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }
  if (returns.loading || complaints.loading || warehouses.loading) return <Loading />
  return (
    <>
      <PageIntro
        eyebrow={roles[workspace!.role].english}
        title="รายการรับคืนวัสดุ"
        description={
          canReceive
            ? 'รับคืนได้เฉพาะคำร้องที่พนักงานบริการอนุมัติแล้ว'
            : 'ติดตามคำร้องที่คลังรับวัสดุคืนเรียบร้อยแล้ว'
        }
      >
        <RefreshButton
          onClick={() => void refresh()}
          busy={returns.refreshing || complaints.refreshing || warehouses.refreshing}
        />
      </PageIntro>
      <ErrorBox message={error || returns.error || complaints.error || warehouses.error} />
      {canReceive && (
        <section className="panel inline-create return-create">
          <div>
            <span className="metric-icon blue">
              <PackageCheck size={21} />
            </span>
            <div>
              <h2>บันทึกรับคืน</h2>
              <p>{eligible.length} คำร้องที่อนุมัติและยังไม่รับคืน</p>
            </div>
          </div>
          <form onSubmit={create}>
            <label className="field">
              คำร้องเรียน
              <select name="complaintID" required>
                {eligible.map((c) => (
                  <option key={c.complaint_id} value={c.complaint_id}>
                    {c.complaint_id} · {c.order_id}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              คลังที่รับคืน
              <select name="warehouseID" required>
                {warehouses.data.map((w) => (
                  <option key={w.warehouseID} value={w.warehouseID}>
                    {w.warehouseID}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              จำนวนรับคืน (กก.)
              <input name="quantity" type="number" min="0.01" step="0.01" required />
            </label>
            <button className="button primary" disabled={busy || !eligible.length}>
              ยืนยันรับคืน
            </button>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>ประวัติการรับคืน</h2>
            <p>{returns.data.length} รายการ</p>
          </div>
        </div>
        {!returns.data.length ? (
          <Empty
            title="ยังไม่มีรายการรับคืน"
            message="เมื่อคลังรับคืนวัสดุแล้ว รายการจะแสดงที่นี่"
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>เลขรับคืน</th>
                  <th>คำร้องเรียน</th>
                  <th>วันที่</th>
                  <th>คลัง</th>
                  <th>ผู้ดำเนินการ</th>
                  <th className="numeric">จำนวน</th>
                </tr>
              </thead>
              <tbody>
                {returns.data.map((row) => (
                  <tr key={row.return_id}>
                    <td>
                      <strong>{row.return_id}</strong>
                    </td>
                    <td>{row.complaint_id}</td>
                    <td>{dateLabel(row.return_date)}</td>
                    <td>{row.warehouse_id}</td>
                    <td>{row.processed_by}</td>
                    <td className="numeric">
                      <strong>{number(row.return_quantity)} กก.</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}