import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Users, CheckCircle2, Truck } from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  Empty,
  ErrorBox,
  Metric,
  Modal,
  PageIntro,
  RefreshButton,
  SearchBox,
} from '../components/ui'
import { api, errorText } from '../services/api'
import type { Driver } from '../types'
import { driverStatuses, validDriverLicense } from '../utils/drivers'
import { dateLabel, shortId } from '../utils/format'

export function Drivers() {
  const { data, workspace, employee, refresh, refreshing, notify } = useApp()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [edit, setEdit] = useState<Driver | 'new' | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const current = edit && edit !== 'new' ? edit : null
  if (workspace?.role !== 'transport')
    return (
      <Empty
        title="หน้านี้สำหรับหัวหน้าการขนส่ง"
        message="กลับไปพื้นที่ทำงานของคุณเพื่อดูงานที่ได้รับมอบหมาย"
        action={
          <Link to="/" className="button primary">
            กลับหน้าหลัก
          </Link>
        }
      />
    )
  const rows = data.drivers.filter(
    (d) =>
      `${d.name} ${d.employee_id} ${d.phone} ${d.license_number || ''}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!filter || d.status === filter),
  )
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy || workspace?.role !== 'transport') return
    const f = new FormData(e.currentTarget)
    const body = { supervisor_id: employee?.user_id, ...Object.fromEntries(f.entries()) }
    setBusy(true)
    setError('')
    try {
      await api(
        current ? `/drivers/${encodeURIComponent(current.employee_id)}` : '/drivers',
        current ? 'PATCH' : 'POST',
        body,
      )
      setEdit(null)
      notify(current ? 'บันทึกข้อมูลคนขับแล้ว' : 'เพิ่มพนักงานขับรถแล้ว')
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
        title="พนักงานขับรถ"
        description="จัดการข้อมูลพนักงาน ใบขับขี่ และความพร้อมก่อนมอบหมายงาน"
      >
        <RefreshButton onClick={() => void refresh()} busy={refreshing} />
        <button
          className="button primary"
          onClick={() => {
            setError('')
            setEdit('new')
          }}
        >
          <Plus size={17} />
          เพิ่มคนขับ
        </button>
      </PageIntro>
      <div className="metrics three">
        <Metric
          label="คนขับทั้งหมด"
          value={data.drivers.length}
          detail="รวมประวัติพนักงานเดิม"
          icon={Users}
        />
        <Metric
          label="พร้อมรับงาน"
          value={data.drivers.filter((d) => d.eligible).length}
          detail="ใบขับขี่ครบและไม่ติดงาน"
          icon={CheckCircle2}
          tone="blue"
        />
        <Metric
          label="กำลังปฏิบัติงาน"
          value={data.drivers.filter((d) => d.active_request_id).length}
          detail="รวมงานที่หยุดรอแก้ไข"
          icon={Truck}
          tone="amber"
        />
      </div>
      <div className="fleet-toolbar">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="ค้นหาชื่อ เบอร์โทร หรือเลขใบขับขี่"
        />
        <select
          aria-label="กรองสถานะพนักงาน"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">ทุกสถานะ</option>
          {Object.entries(driverStatuses).map(([v, t]) => (
            <option value={v} key={v}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <section className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>พนักงาน / ติดต่อ</th>
                <th>ใบขับขี่</th>
                <th>สถานะพนักงาน</th>
                <th>งานปัจจุบัน</th>
                <th>ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.employee_id}>
                  <td>
                    <strong>{d.name}</strong>
                    <div className="hint">{d.position}</div>
                    <a href={`tel:${d.phone}`}>{d.phone}</a>
                  </td>
                  <td>
                    {d.license_number || 'ยังไม่ระบุ'}
                    <div className="hint">
                      {d.license_expiry
                        ? `หมดอายุ ${dateLabel(d.license_expiry)}`
                        : 'ยังไม่ระบุวันหมดอายุ'}
                    </div>
                    {!validDriverLicense(d) && (
                      <span className="status status-on_hold">
                        {d.license_number && d.license_expiry
                          ? 'ใบขับขี่หมดอายุ'
                          : 'ข้อมูลใบขับขี่ไม่ครบ'}
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`status ${d.status === 'active' ? 'status-available' : 'status-cancelled'}`}
                    >
                      {driverStatuses[d.status]}
                    </span>
                  </td>
                  <td>
                    {d.active_request_id ? (
                      <Link
                        className="text-link"
                        to={`/deliveries/${encodeURIComponent(d.active_request_id)}`}
                      >
                        {shortId(d.active_request_id)}
                      </Link>
                    ) : d.eligible ? (
                      'พร้อมรับงาน'
                    ) : (
                      'ยังรับงานไม่ได้'
                    )}
                  </td>
                  <td>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setError('')
                        setEdit(d)
                      }}
                    >
                      <Pencil size={15} />
                      แก้ไข
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty title="ไม่พบพนักงานขับรถ" message="เพิ่มคนขับใหม่ หรือลองเปลี่ยนคำค้นและตัวกรอง" />
        )}
      </section>
      {edit && (
        <Modal
          title={current ? 'แก้ไขข้อมูลคนขับ' : 'เพิ่มพนักงานขับรถ'}
          busy={busy}
          onClose={() => setEdit(null)}
        >
          <form onSubmit={save}>
            <fieldset disabled={busy} className="modal-body form-fieldset">
              <div className="form-grid">
                <label className="field">
                  ชื่อ–นามสกุล
                  <input name="name" required maxLength={150} defaultValue={current?.name || ''} />
                </label>
                <label className="field">
                  เบอร์โทรศัพท์
                  <input
                    name="phone"
                    type="tel"
                    required
                    maxLength={25}
                    defaultValue={current?.phone || ''}
                  />
                </label>
                <label className="field">
                  อีเมล
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    defaultValue={current?.email || ''}
                  />
                </label>
                <label className="field">
                  ตำแหน่ง
                  <input
                    name="position"
                    required
                    maxLength={100}
                    defaultValue={current?.position || 'พนักงานขับรถ'}
                  />
                </label>
                <label className="field">
                  วันที่เริ่มงาน
                  <input
                    name="hire_date"
                    type="date"
                    required
                    defaultValue={
                      current?.hire_date.slice(0, 10) || new Date().toLocaleDateString('en-CA')
                    }
                  />
                </label>
                <label className="field">
                  สถานะพนักงาน
                  <select name="status" defaultValue={current?.status || 'active'}>
                    {Object.entries(driverStatuses).map(([v, t]) => (
                      <option
                        value={v}
                        key={v}
                        disabled={!!current?.active_request_id && v !== 'active'}
                      >
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  เลขใบขับขี่
                  <input
                    name="license_number"
                    required
                    maxLength={50}
                    defaultValue={current?.license_number || ''}
                  />
                </label>
                <label className="field">
                  วันหมดอายุใบขับขี่
                  <input
                    name="license_expiry"
                    type="date"
                    required
                    defaultValue={current?.license_expiry || ''}
                  />
                </label>
              </div>
              {current?.active_request_id && (
                <p className="hint">
                  คนขับมีงานอยู่ ต้องเปลี่ยนผู้รับงานหรือจบงานก่อนตั้งเป็นพักงานหรือลาออก
                </p>
              )}
              <p className="hint">
                เก็บประวัติไว้เมื่อพักงานหรือลาออก คนขับที่ใบขับขี่หมดอายุจะรับงานใหม่ไม่ได้
              </p>
              {!current && (
                <p className="hint">
                  บันทึกข้อมูลพนักงานสำหรับมอบหมายงาน ยังไม่ได้ตั้งรหัสผ่านเข้าสู่ระบบ
                </p>
              )}
              <ErrorBox message={error} />
              <div className="modal-actions">
                <button type="button" className="button secondary" onClick={() => setEdit(null)}>
                  กลับ
                </button>
                <button className="button primary">
                  {busy ? 'กำลังบันทึก…' : current ? 'บันทึกการแก้ไข' : 'บันทึกคนขับ'}
                </button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  )
}
