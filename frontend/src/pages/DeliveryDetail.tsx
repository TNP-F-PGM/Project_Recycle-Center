import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  Package,
  Pencil,
  Phone,
  Play,
  Truck,
  UserRound,
  XCircle,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ErrorBox, Info, Loading, Modal, PageIntro, Status, Stepper } from '../components/ui'
import { useApp } from '../context/AppContext'
import { useRecord } from '../hooks/useRecord'
import { api, errorText } from '../services/api'
import { dateLabel, number } from '../utils/format'
import type { Delivery } from '../types'
import { LocationMap } from '../components/LocationMap'
import { deliveryCoordinates } from '../utils/maps'
import { deliveryAccess } from '../utils/deliveryAccess'
import { DeliveryIssues } from '../components/DeliveryIssues'
import { canAssignDriver } from '../utils/drivers'

type Action = 'assign' | 'edit' | 'cancel' | 'depart' | 'complete' | null
export function DeliveryDetail() {
  const { id } = useParams()
  const record = useRecord<Delivery>(`/delivery-requests/${encodeURIComponent(id!)}`)
  const { data, workspace, employee, refresh, notify } = useApp()
  const [action, setAction] = useState<Action>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [materialsSecured, setMaterialsSecured] = useState(false)
  if (record.loading) return <Loading />
  if (!record.data) return <ErrorBox message={record.error} retry={record.reload} />
  const d = record.data
  const driver = data.drivers.find((e) => e.employee_id === d.assignment?.driver_id)
  const truck = data.trucks.find((t) => t.truck_id === d.assignment?.truck_id)
  const access = deliveryAccess(
    workspace,
    d.status,
    d.assignment?.driver_id,
    data.orders.find((o) => o.order_id === d.order_id)?.sales_staff_id,
  )
  if (!access.view)
    return (
      <>
        <ErrorBox message="รายการนี้ไม่ได้อยู่ในงานของผู้ใช้งานที่เลือก" />
        <Link className="button secondary" to="/deliveries">
          กลับไปงานของฉัน
        </Link>
      </>
    )
  const open = (value: Action) => {
    if (value && !access[value]) return
    setError('')
    setCancelReason('')
    setMaterialsSecured(false)
    setAction(value)
  }
  async function mutate(path: string, method: string, payload: unknown, message: string) {
    if (busy) return
    const permitted =
      path === '/status'
        ? action === 'depart'
          ? access.depart
          : action === 'complete' && access.complete
        : path === '/assignment'
          ? access.assign
          : path === '/cancellation'
            ? access.cancel
            : access.edit
    if (!permitted) {
      setAction(null)
      setError('บทบาทหรือสถานะงานนี้ไม่อนุญาตให้ดำเนินการ')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api(`/delivery-requests/${encodeURIComponent(d.request_id)}${path}`, method, payload)
      setAction(null)
      notify(message)
      await refresh()
      record.reload()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const availableTrucks = data.trucks.filter(
    (t) => (t.status === 'available' && !t.request_id) || t.request_id === d.request_id,
  )
  const availableDrivers = data.drivers.filter(
    (e) =>
      canAssignDriver(e, d.request_id) &&
      !data.trucks.some(
        (t) => t.driver_id === e.employee_id && t.request_id && t.request_id !== d.request_id,
      ),
  )
  return (
    <>
      <PageIntro
        eyebrow={
          workspace?.role === 'sales'
            ? 'SALES OFFICER'
            : workspace?.role === 'driver'
              ? 'DRIVER'
              : 'TRANSPORT MANAGER'
        }
        title={workspace?.role === 'sales' ? 'ติดตามการขนส่ง' : 'รายละเอียดคำขอจัดส่ง'}
        back="/deliveries"
      >
        <Status value={d.status} />
        {access.edit && (
          <button className="button secondary" onClick={() => open('edit')}>
            <Pencil size={15} />
            แก้ไขข้อมูลจัดส่ง
          </button>
        )}
      </PageIntro>
      <div className="record-id">{d.request_id}</div>
      <section className="panel progress-panel">
        <Stepper status={d.status} />
      </section>
      <DeliveryIssues key={d.request_id} delivery={d} onUpdated={record.reload} />
      <div className="detail-grid">
        <div>
          <section className="panel form-panel">
            <h2>
              <MapPin size={19} />
              ข้อมูลปลายทาง
            </h2>
            <h3 className="customer-heading">{d.customer_name}</h3>
            <p className="address-text">{d.address}</p>
            <dl className="info-grid">
              <Info label="วันนัดจัดส่ง">{dateLabel(d.request_date)}</Info>
              <Info label="เบอร์โทรศัพท์">
                {d.phone_number ? (
                  <a className="text-link" href={`tel:${d.phone_number}`}>
                    <Phone size={14} />
                    {d.phone_number}
                  </a>
                ) : (
                  '—'
                )}
              </Info>
              <Info label="คำขอซื้อที่เกี่ยวข้อง">
                {workspace?.role === 'driver' ? (
                  <span className="break-id">{d.order_id}</span>
                ) : (
                  <Link className="text-link" to={`/orders/${encodeURIComponent(d.order_id)}`}>
                    ดูคำขอซื้อ
                    <ArrowRight size={14} />
                  </Link>
                )}
              </Info>
              <Info label="หัวหน้าขนส่ง">
                {data.supervisors.find((e) => e.user_id === d.supervisor_id)?.name ||
                  'ยังไม่ได้มอบหมาย'}
              </Info>
            </dl>
            {deliveryCoordinates(d) ? (
              <LocationMap
                point={deliveryCoordinates(d)}
                label="ปลายทางจัดส่ง"
                destinationName={d.customer_name}
              />
            ) : (
              <p className="hint">
                รายการนี้ยังไม่มีพิกัดปลายทาง กรุณาติดต่อพนักงานขายหรือหัวหน้าขนส่ง
              </p>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>
                <Package size={18} />
                วัสดุที่ต้องจัดส่ง
              </h2>
              <span className="muted">{d.materials.length} รายการ</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>วัสดุ</th>
                    <th className="numeric">จำนวน</th>
                    <th>หน่วย</th>
                  </tr>
                </thead>
                <tbody>
                  {d.materials.map((m) => (
                    <tr key={m.material_id}>
                      <td>
                        <div className="stacked">
                          <strong>{m.material_name}</strong>
                          <small>{m.material_id}</small>
                        </div>
                      </td>
                      <td className="numeric">{number(m.delivery_quantity)}</td>
                      <td>{m.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <aside>
          <section className="panel form-panel">
            <h2>
              <Truck size={19} />
              รถและพนักงานขับรถ
            </h2>
            {d.assignment ? (
              <>
                <div className="assignment-card">
                  <span className="metric-icon green">
                    <Truck size={23} />
                  </span>
                  <div>
                    <strong>{truck?.license_plate || d.assignment.truck_id}</strong>
                    <small>
                      {truck ? `ความจุ ${number(truck.capacity)} กก.` : d.assignment.truck_id}
                    </small>
                  </div>
                </div>
                <div className="assignment-driver">
                  <UserRound size={18} />
                  <span>{driver?.name || d.assignment.driver_id}</span>
                </div>
                <p className="hint">มอบหมายเมื่อ {dateLabel(d.assignment.assigned_at)}</p>
                {['delivered', 'cancelled'].includes(d.status) && (
                  <div className="summary-note">
                    รถถูกปล่อยให้รับงานใหม่แล้ว ข้อมูลนี้เป็นประวัติการมอบหมาย
                  </div>
                )}
              </>
            ) : (
              <p className="muted spaced">
                {d.status === 'cancelled'
                  ? 'คำขอนี้ถูกยกเลิกก่อนมอบหมายรถ'
                  : 'รอหัวหน้าขนส่งเลือกรถและคนขับสำหรับงานนี้'}
              </p>
            )}
            {access.assign && (
              <button className="button primary full" onClick={() => open('assign')}>
                <Truck size={16} />
                {d.assignment ? 'เปลี่ยนรถ / คนขับ' : 'มอบหมายรถและคนขับ'}
              </button>
            )}
          </section>
          {(access.depart || access.complete) && (
            <section className="panel form-panel">
              <h2>ดำเนินการขนส่ง</h2>
              <p className="muted">
                {d.status === 'assigned'
                  ? 'ตรวจสอบรถและวัสดุให้พร้อมก่อนออกเดินทาง'
                  : 'ตรวจสอบการส่งมอบให้ครบถ้วนก่อนยืนยันสำเร็จ'}
              </p>
              <button
                className="button primary full spaced"
                onClick={() => open(d.status === 'assigned' ? 'depart' : 'complete')}
              >
                {d.status === 'assigned' ? <Play size={16} /> : <CheckCircle2 size={16} />}
                {d.status === 'assigned' ? 'เริ่มออกเดินทาง' : 'ยืนยันจัดส่งสำเร็จ'}
              </button>
            </section>
          )}
          {access.cancel && (
            <button className="button danger-outline full" onClick={() => open('cancel')}>
              <XCircle size={16} />
              ยกเลิกคำขอจัดส่ง
            </button>
          )}
          {d.cancellation && (
            <section className="panel form-panel">
              <h2>ข้อมูลการยกเลิก</h2>
              <dl>
                <Info label="วันที่ยกเลิก">{dateLabel(d.cancellation.cancel_date)}</Info>
                <Info label="เหตุผล">
                  {d.cancellation.reason || 'ไม่ได้บันทึกเหตุผลในข้อมูลเดิม'}
                </Info>
                <Info label="เลขที่การยกเลิก">
                  <span className="break-id">{d.cancellation.cancel_id}</span>
                </Info>
              </dl>
              <p className="hint">
                การยกเลิกจัดส่งไม่ยกเลิกคำขอซื้อโดยอัตโนมัติ
                ให้ประสานฝ่ายขายเพื่อดำเนินการคำขอซื้อต่อ
              </p>
            </section>
          )}
        </aside>
      </div>
      {action === 'assign' && access.assign && (
        <Modal title="มอบหมายรถและคนขับ" busy={busy} onClose={() => setAction(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              void mutate(
                '/assignment',
                'PATCH',
                {
                  truck_id: f.get('truck_id'),
                  driver_id: f.get('driver_id'),
                  supervisor_id: employee?.user_id,
                },
                'มอบหมายงานเรียบร้อยแล้ว',
              )
            }}
          >
            <fieldset disabled={busy} className="modal-body form-fieldset">
              <p className="muted">คำขอจัดส่งหนึ่งใบ ใช้รถหนึ่งคัน พร้อมคนขับหนึ่งคน</p>
              <label className="field">
                รถที่พร้อมใช้งาน
                <select required name="truck_id" defaultValue={d.assignment?.truck_id || ''}>
                  <option value="">เลือกรถ</option>
                  {availableTrucks.map((t) => (
                    <option value={t.truck_id} key={t.truck_id}>
                      {t.license_plate} · {number(t.capacity)} กก.
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                พนักงานขับรถ
                <select required name="driver_id" defaultValue={d.assignment?.driver_id || ''}>
                  <option value="">เลือกคนขับ</option>
                  {availableDrivers.map((e) => (
                    <option value={e.employee_id} key={e.employee_id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              {(!availableTrucks.length || !availableDrivers.length) && (
                <p className="hint">
                  ยังไม่มีรถหรือคนขับที่ว่าง กรุณาตรวจสอบรายการรถและงานที่กำลังดำเนินการ
                </p>
              )}
              <ErrorBox message={error} />
              <div className="modal-actions">
                <button type="button" className="button secondary" onClick={() => setAction(null)}>
                  กลับ
                </button>
                <button
                  className="button primary"
                  disabled={!availableTrucks.length || !availableDrivers.length}
                >
                  {busy ? 'กำลังบันทึก…' : 'ยืนยันมอบหมายงาน'}
                </button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
      {action === 'edit' && access.edit && (
        <DeliveryEdit
          delivery={d}
          busy={busy}
          error={error}
          onClose={() => setAction(null)}
          onSave={(payload) => void mutate('', 'PATCH', payload, 'บันทึกข้อมูลจัดส่งแล้ว')}
        />
      )}
      {action && ['cancel', 'depart', 'complete'].includes(action) && access[action] && (
        <Modal
          title={
            action === 'cancel'
              ? 'ยืนยันยกเลิกคำขอจัดส่ง?'
              : action === 'depart'
                ? 'พร้อมออกเดินทางแล้วใช่ไหม?'
                : 'ยืนยันส่งมอบวัสดุครบแล้ว?'
          }
          busy={busy}
          onClose={() => setAction(null)}
        >
          <div className="modal-body">
            <p>
              {action === 'cancel'
                ? 'ยกเลิกเฉพาะการจัดส่งนี้ คำขอซื้อยังคงอยู่ รถที่เสียจะยังอยู่ในสถานะซ่อมบำรุง'
                : action === 'depart'
                  ? 'หากเกิดปัญหาระหว่างทาง ให้แจ้งปัญหาเพื่อให้หัวหน้าขนส่งจัดการก่อนดำเนินงานต่อ'
                  : 'ระบบจะปิดคำขอซื้อและปล่อยรถให้พร้อมรับงานถัดไป'}
            </p>
            <div className="confirmation-target">
              <strong>{d.customer_name}</strong>
              <small>{d.request_id}</small>
            </div>
            {action === 'cancel' && (
              <>
                <label className="field">
                  เหตุผลที่ยกเลิก
                  <textarea
                    required
                    maxLength={2000}
                    rows={3}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                </label>
                {d.status === 'on_hold' && (
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={materialsSecured}
                      onChange={(e) => setMaterialsSecured(e.target.checked)}
                    />
                    ประสานฝ่ายขายและจัดการวัสดุที่ค้างอยู่เรียบร้อยแล้ว
                  </label>
                )}
              </>
            )}
            <ErrorBox message={error} />
            <div className="modal-actions">
              <button className="button secondary" disabled={busy} onClick={() => setAction(null)}>
                กลับ
              </button>
              <button
                disabled={
                  busy ||
                  (action === 'cancel' &&
                    (!cancelReason.trim() || (d.status === 'on_hold' && !materialsSecured)))
                }
                className={`button ${action === 'cancel' ? 'danger' : 'primary'}`}
                onClick={() =>
                  void (action === 'cancel'
                    ? mutate(
                        '/cancellation',
                        'POST',
                        {
                          supervisor_id: employee?.user_id,
                          reason: cancelReason.trim(),
                          materials_secured: materialsSecured,
                        },
                        'ยกเลิกการจัดส่งแล้ว คำขอซื้อยังคงอยู่',
                      )
                    : mutate(
                        '/status',
                        'PATCH',
                        {
                          status: action === 'depart' ? 'in_transit' : 'delivered',
                          driver_id: workspace?.employeeId,
                        },
                        action === 'depart' ? 'เริ่มการขนส่งแล้ว' : 'ยืนยันจัดส่งสำเร็จแล้ว',
                      ))
                }
              >
                {busy
                  ? 'กำลังบันทึก…'
                  : action === 'cancel'
                    ? 'ยืนยันยกเลิก'
                    : action === 'depart'
                      ? 'ยืนยันออกเดินทาง'
                      : 'ยืนยันส่งมอบสำเร็จ'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
function DeliveryEdit({
  delivery,
  busy,
  error,
  onClose,
  onSave,
}: {
  delivery: Delivery
  busy: boolean
  error: string
  onClose: () => void
  onSave: (payload: unknown) => void
}) {
  const { data } = useApp()
  const [coordsError, setCoordsError] = useState('')
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const lat = String(f.get('lat'))
    const lng = String(f.get('lng'))
    if ((lat === '') !== (lng === ''))
      return setCoordsError('กรุณาระบุพิกัดทั้งสองช่อง หรือเว้นว่างทั้งคู่')
    setCoordsError('')
    onSave({
      customer_name: f.get('customer_name'),
      address: f.get('address'),
      phone_number: f.get('phone_number'),
      request_date: f.get('request_date'),
      ...(lat === ''
        ? { clear_coordinates: true }
        : { destination_latitude: Number(lat), destination_longitude: Number(lng) }),
    })
  }
  return (
    <Modal title="แก้ไขข้อมูลจัดส่ง" onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="modal-body form-fieldset">
          <label className="field">
            ชื่อผู้รับ / โรงงาน
            <input required name="customer_name" defaultValue={delivery.customer_name} />
          </label>
          <label className="field">
            ที่อยู่จัดส่ง
            <textarea required name="address" rows={3} defaultValue={delivery.address} />
          </label>
          <div className="form-grid">
            <label className="field">
              เบอร์โทรศัพท์
              <input type="tel" name="phone_number" defaultValue={delivery.phone_number} />
            </label>
            <label className="field">
              วันนัดจัดส่ง
              <input
                required
                type="date"
                name="request_date"
                min={data.orders.find((o) => o.order_id === delivery.order_id)?.order_date}
                defaultValue={delivery.request_date}
              />
            </label>
            <label className="field">
              ละติจูด
              <input
                type="number"
                name="lat"
                min="-90"
                max="90"
                step="any"
                defaultValue={deliveryCoordinates(delivery) ? delivery.destination_latitude : ''}
              />
            </label>
            <label className="field">
              ลองจิจูด
              <input
                type="number"
                name="lng"
                min="-180"
                max="180"
                step="any"
                defaultValue={deliveryCoordinates(delivery) ? delivery.destination_longitude : ''}
              />
            </label>
          </div>
          <p className="hint">เว้นพิกัดทั้งสองช่องว่าง เพื่อลบพิกัดปลายทาง</p>
          <ErrorBox message={coordsError || error} />
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              กลับ
            </button>
            <button className="button primary">
              {busy ? 'กำลังบันทึก…' : 'บันทึกข้อมูลจัดส่ง'}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}
