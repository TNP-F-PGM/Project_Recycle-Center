import { useState, type FormEvent } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import type { Delivery } from '../types'
import { deliveryAccess } from '../utils/deliveryAccess'
import { api, errorText } from '../services/api'
import { ErrorBox, Modal } from './ui'
import { canAssignDriver } from '../utils/drivers'

const reasons: Record<string, string> = {
  breakdown: 'รถเสีย',
  accident: 'อุบัติเหตุ',
  destination_unavailable: 'เข้าโรงงานหรือส่งมอบไม่ได้',
  other: 'ปัญหาอื่น ๆ',
}
const stamp = (s: string) => new Date(s).toLocaleString('th-TH')

export function DeliveryIssues({
  delivery: d,
  onUpdated,
}: {
  delivery: Delivery
  onUpdated: () => void
}) {
  const { data, workspace, employee, refresh, notify } = useApp()
  const access = deliveryAccess(
    workspace,
    d.status,
    d.assignment?.driver_id,
    data.orders.find((o) => o.order_id === d.order_id)?.sales_staff_id,
  )
  const [modal, setModal] = useState<'report' | 'resolve' | null>(null)
  const [mode, setMode] = useState('resume')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const incidents = d.incidents || []
  const open = incidents.find((i) => !i.resolved_at)
  const trucks = data.trucks.filter((t) => t.status === 'available' && !t.request_id)
  const drivers = data.drivers.filter(
    (e) =>
      canAssignDriver(e, d.request_id) &&
      !data.trucks.some(
        (t) => t.driver_id === e.employee_id && t.request_id && t.request_id !== d.request_id,
      ),
  )
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    if (
      (modal === 'report' && !access.report) ||
      (modal === 'resolve' && (!access.resolve || !open))
    )
      return
    const f = new FormData(e.currentTarget)
    const resolving = modal === 'resolve'
    const body = resolving
      ? {
          incident_id: open!.incident_id,
          supervisor_id: employee?.user_id,
          resolution_note: f.get('note'),
          truck_id: mode === 'resume' ? d.assignment?.truck_id : f.get('truck_id'),
          driver_id: mode === 'resume' ? d.assignment?.driver_id : f.get('driver_id'),
        }
      : { driver_id: workspace?.employeeId, reason: f.get('reason'), details: f.get('details') }
    setBusy(true)
    setError('')
    try {
      await api(
        `/delivery-requests/${encodeURIComponent(d.request_id)}/${resolving ? 'assignment' : 'incidents'}`,
        resolving ? 'PATCH' : 'POST',
        body,
      )
      setModal(null)
      notify(resolving ? 'บันทึกการแก้ไขปัญหาแล้ว' : 'แจ้งปัญหาแล้ว งานหยุดรอหัวหน้าขนส่งแก้ไข')
      await refresh()
      onUpdated()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      {(access.report || incidents.length > 0) && (
        <section className="panel form-panel">
          <h2>
            <AlertTriangle size={19} />
            ปัญหาการขนส่ง
          </h2>
          {access.report && (
            <>
              <p className="hint">
                หากขนส่งต่อไม่ได้ ให้แจ้งปัญหา งานจะหยุดรอแก้ไขโดยไม่ยกเลิกคำขอซื้อ
              </p>
              <button
                className="button danger-outline spaced"
                onClick={() => {
                  setError('')
                  setModal('report')
                }}
              >
                แจ้งปัญหาการขนส่ง
              </button>
            </>
          )}
          {open && (
            <div className="incident-banner">
              <strong>{reasons[open.reason] || open.reason} · รอแก้ไข</strong>
              <p className="preserve-lines">{open.details}</p>
              <small>{stamp(open.reported_at)}</small>
              <p>
                {workspace?.role === 'transport'
                  ? 'ตรวจสอบสถานการณ์และประสานคนขับก่อนให้งานดำเนินต่อ'
                  : 'หัวหน้าขนส่งจะตรวจสอบและจัดการงานต่อให้'}
              </p>
              {access.resolve && (
                <button
                  className="button primary spaced"
                  onClick={() => {
                    setMode('resume')
                    setError('')
                    setModal('resolve')
                  }}
                >
                  แก้ไขปัญหา / เปลี่ยนรถ
                </button>
              )}
            </div>
          )}
          {incidents.length > 0 && (
            <details className="coordinate-details">
              <summary>ประวัติปัญหาและการเปลี่ยนรถ ({incidents.length})</summary>
              <ol className="incident-history">
                {incidents.map((i) => (
                  <li key={i.incident_id}>
                    <strong>
                      {reasons[i.reason] || i.reason} ·{' '}
                      {i.resolved_at ? 'ดำเนินการแล้ว' : 'รอแก้ไข'}
                    </strong>
                    <p className="preserve-lines">{i.details}</p>
                    <p>
                      ผู้แจ้ง:{' '}
                      {data.drivers.find((e) => e.employee_id === i.driver_id)?.name || i.driver_id}{' '}
                      · รถ{' '}
                      {data.trucks.find((t) => t.truck_id === i.truck_id)?.license_plate ||
                        i.truck_id}
                    </p>
                    <small>{stamp(i.reported_at)}</small>
                    {i.resolved_at && (
                      <>
                        <p>
                          {i.resolution === 'cancelled'
                            ? 'ยกเลิกการจัดส่ง'
                            : i.resolution === 'reassign'
                              ? 'เปลี่ยนรถ / คนขับ'
                              : 'ใช้รถเดิมดำเนินงานต่อ'}
                          : {i.resolution_note}
                        </p>
                        {i.replacement_truck_id && (
                          <p>
                            รถที่รับงานต่อ:{' '}
                            {data.trucks.find((t) => t.truck_id === i.replacement_truck_id)
                              ?.license_plate || i.replacement_truck_id}{' '}
                            ·{' '}
                            {data.drivers.find((e) => e.employee_id === i.replacement_driver_id)
                              ?.name || i.replacement_driver_id}
                          </p>
                        )}
                        <small>
                          แก้ไขโดย{' '}
                          {data.supervisors.find((e) => e.user_id === i.supervisor_id)?.name ||
                            i.supervisor_id}{' '}
                          · {stamp(i.resolved_at)}
                        </small>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </section>
      )}
      {modal && (
        <Modal
          title={modal === 'report' ? 'แจ้งปัญหาการขนส่ง' : 'แก้ไขปัญหาการขนส่ง'}
          busy={busy}
          onClose={() => setModal(null)}
        >
          <form onSubmit={submit}>
            <fieldset disabled={busy} className="modal-body form-fieldset">
              {modal === 'report' ? (
                <>
                  <label className="field">
                    ประเภทปัญหา
                    <select name="reason" required>
                      {Object.entries(reasons).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    รายละเอียดปัญหา
                    <textarea
                      name="details"
                      required
                      maxLength={2000}
                      rows={4}
                      placeholder="เกิดอะไรขึ้น อยู่บริเวณไหน และวัสดุอยู่ที่ใด"
                    />
                  </label>
                  <p className="hint">
                    เมื่อแจ้งแล้ว จะยืนยันส่งสำเร็จไม่ได้จนกว่าหัวหน้าขนส่งแก้ไขปัญหา
                  </p>
                </>
              ) : (
                <>
                  <label className="field">
                    วิธีแก้ไข
                    <select value={mode} onChange={(e) => setMode(e.target.value)}>
                      <option value="resume">รถเดิมพร้อมแล้ว ดำเนินงานต่อ</option>
                      <option value="replace">เปลี่ยนรถ / มอบหมายคนขับ</option>
                    </select>
                  </label>
                  {mode === 'replace' && (
                    <>
                      <label className="field">
                        รถใหม่ที่พร้อมใช้งาน
                        <select name="truck_id" required defaultValue="">
                          <option value="">เลือกรถ</option>
                          {trucks.map((t) => (
                            <option key={t.truck_id} value={t.truck_id}>
                              {t.license_plate}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        คนขับที่รับงานต่อ
                        <select
                          name="driver_id"
                          required
                          defaultValue={d.assignment?.driver_id || ''}
                        >
                          {drivers.map((e) => (
                            <option key={e.employee_id} value={e.employee_id}>
                              {e.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  <label className="field">
                    รายละเอียดการแก้ไข
                    <textarea
                      name="note"
                      required
                      rows={4}
                      maxLength={2000}
                      placeholder="เช่น ซ่อมรถเรียบร้อย / จุดเปลี่ยนรถและการส่งต่อวัสดุ"
                    />
                  </label>
                  <label className="check-field">
                    <input type="checkbox" required />
                    ยืนยันว่ารถและคนขับพร้อม พร้อมจัดการวัสดุเพื่อดำเนินงานต่อแล้ว
                  </label>
                  <p className="hint">
                    หากออกเดินทางแล้ว งานจะกลับเป็นกำลังขนส่ง
                    รถเดิมที่เสียจะคงสถานะซ่อมบำรุงเมื่อเปลี่ยนไปใช้รถใหม่
                  </p>
                </>
              )}
              <ErrorBox message={error} />
              <div className="modal-actions">
                <button type="button" className="button secondary" onClick={() => setModal(null)}>
                  กลับ
                </button>
                <button className="button primary">
                  {busy
                    ? 'กำลังบันทึก…'
                    : modal === 'report'
                      ? 'ยืนยันแจ้งปัญหา'
                      : 'ยืนยันการแก้ไข'}
                </button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  )
}