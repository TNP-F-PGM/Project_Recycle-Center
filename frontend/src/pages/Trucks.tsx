import { useState, type FormEvent } from 'react'
import { CheckCircle2, Pencil, Plus, Truck as TruckIcon, UserRound, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  Empty,
  ErrorBox,
  Metric,
  Modal,
  PageIntro,
  RefreshButton,
  SearchBox,
  Status,
} from '../components/ui'
import { api, errorText } from '../services/api'
import { activeDelivery, number } from '../utils/format'
import type { Truck } from '../types'

export function Trucks() {
  const { data, workspace, refresh, refreshing, notify } = useApp()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [edit, setEdit] = useState<Truck | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const manage = workspace?.role === 'transport'
  const rows = data.trucks.filter(
    (t) =>
      `${t.truck_id} ${t.license_plate}`.toLowerCase().includes(query.toLowerCase()) &&
      (!status || t.status === status),
  )
  const current = edit && edit !== 'new' ? edit : null
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    const f = new FormData(e.currentTarget)
    setError('')
    setBusy(true)
    try {
      const body = {
        license_plate: String(f.get('license_plate')).trim(),
        capacity: Number(f.get('capacity')),
        ...(!current?.request_id ? { status: f.get('status') } : {}),
        ...(current ? {} : { truck_id: String(f.get('truck_id')).trim() }),
      }
      await api(
        current ? `/trucks/${encodeURIComponent(current.truck_id)}` : '/trucks',
        current ? 'PATCH' : 'POST',
        body,
      )
      setEdit(null)
      notify(current ? 'บันทึกข้อมูลรถแล้ว' : 'เพิ่มรถขนส่งแล้ว')
      await refresh()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageIntro
        eyebrow="TRANSPORT MANAGER"
        title="รถขนส่ง"
        description="จัดการรถและตรวจสอบความพร้อมก่อนมอบหมายงาน"
      >
        <RefreshButton onClick={() => void refresh()} busy={refreshing} />
        {manage && (
          <button
            className="button primary"
            onClick={() => {
              setError('')
              setEdit('new')
            }}
          >
            <Plus size={17} />
            เพิ่มรถขนส่ง
          </button>
        )}
      </PageIntro>
      <div className="metrics three">
        <Metric label="รถทั้งหมด" value={data.trucks.length} detail="คันในระบบ" icon={TruckIcon} />
        <Metric
          label="พร้อมใช้งาน"
          value={data.trucks.filter((t) => t.status === 'available' && !t.request_id).length}
          detail="พร้อมรับงานขนส่ง"
          icon={CheckCircle2}
          tone="blue"
        />
        <Metric
          label="กำลังปฏิบัติงาน"
          value={data.trucks.filter((t) => activeDelivery(t.status)).length}
          detail="มอบหมายแล้วและกำลังขนส่ง"
          icon={Wrench}
          tone="amber"
        />
      </div>
      <div className="fleet-toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="ค้นหารหัสรถหรือทะเบียน" />
        <select aria-label="กรองสถานะรถ" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="available">พร้อมใช้งาน</option>
          <option value="assigned">มอบหมายแล้ว</option>
          <option value="in_transit">กำลังขนส่ง</option>
          <option value="on_hold">หยุดชั่วคราว</option>
          <option value="maintenance">ซ่อมบำรุง</option>
          <option value="inactive">ไม่พร้อมใช้งาน</option>
        </select>
        <span className="muted">{rows.length} คัน</span>
      </div>
      {!rows.length ? (
        <section className="panel">
          <Empty
            title={query || status ? 'ไม่พบรถที่ตรงกับตัวกรอง' : 'ยังไม่มีรถขนส่ง'}
            message={
              query || status ? 'ลองเปลี่ยนคำค้นหาหรือสถานะ' : 'เพิ่มรถคันแรกเพื่อเตรียมพร้อมรับงาน'
            }
          />
        </section>
      ) : (
        <div className="truck-grid">
          {rows.map((t) => (
            <article className="panel truck-card" key={t.truck_id}>
              <div className="truck-card-top">
                <span className="metric-icon green">
                  <TruckIcon size={23} />
                </span>
                <Status value={t.status} />
              </div>
              <h2>{t.license_plate}</h2>
              <p className="muted">{t.truck_id}</p>
              <div className="truck-meta">
                <UserRound size={15} />
                <span>
                  {data.drivers.find((e) => e.employee_id === t.driver_id)?.name ||
                    'ยังไม่ได้ระบุคนขับ'}
                </span>
              </div>
              <div className="truck-capacity">
                <span>ความจุบรรทุก</span>
                <strong>
                  {number(t.capacity)} <small>กก.</small>
                </strong>
              </div>
              <div className="truck-card-bottom">
                {t.request_id ? (
                  <Link
                    className="text-link"
                    to={`/deliveries/${encodeURIComponent(t.request_id)}`}
                  >
                    ดูงานที่รับอยู่
                  </Link>
                ) : (
                  <span className="muted">ไม่มีงานที่รับอยู่</span>
                )}
                {manage && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setError('')
                      setEdit(t)
                    }}
                  >
                    <Pencil size={14} />
                    แก้ไข
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {edit && (
        <Modal
          title={current ? 'แก้ไขข้อมูลรถขนส่ง' : 'เพิ่มรถขนส่ง'}
          busy={busy}
          onClose={() => setEdit(null)}
        >
          <form onSubmit={save}>
            <fieldset disabled={busy} className="modal-body form-fieldset">
              {!current && (
                <label className="field">
                  รหัสรถ
                  <input name="truck_id" required placeholder="เช่น TR002" maxLength={100} />
                </label>
              )}
              <label className="field">
                ทะเบียนรถ
                <input
                  name="license_plate"
                  required
                  defaultValue={current?.license_plate || ''}
                  placeholder="เช่น 70-1234"
                  maxLength={100}
                />
              </label>
              <label className="field">
                ความจุบรรทุก (กก.)
                <input
                  name="capacity"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={current?.capacity || ''}
                />
              </label>
              {!current?.request_id ? (
                <label className="field">
                  สถานะรถ
                  <select name="status" defaultValue={current?.status || 'available'}>
                    <option value="available">พร้อมใช้งาน</option>
                    <option value="maintenance">ซ่อมบำรุง</option>
                    <option value="inactive">ไม่พร้อมใช้งาน</option>
                    {current &&
                      !['available', 'maintenance', 'inactive'].includes(current.status) && (
                        <option value={current.status}>{current.status}</option>
                      )}
                  </select>
                </label>
              ) : (
                <p className="hint">รถกำลังรับงานอยู่ เปลี่ยนสถานะผ่านหน้าคำขอจัดส่ง</p>
              )}
              <ErrorBox message={error} />
              <div className="modal-actions">
                <button className="button secondary" type="button" onClick={() => setEdit(null)}>
                  กลับ
                </button>
                <button className="button primary">
                  {busy ? 'กำลังบันทึก…' : current ? 'บันทึกข้อมูลรถ' : 'เพิ่มรถขนส่ง'}
                </button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  )
}
