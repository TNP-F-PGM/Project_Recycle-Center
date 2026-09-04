import { useState, type FormEvent } from 'react'
import { ArrowRight, Leaf, Truck, ShoppingBag, Route } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { ErrorBox, Loading } from '../components/ui'
import { employeesFor, roles, useApp } from '../context/AppContext'
import type { Role } from '../types'

export function Welcome() {
  const { data, loading, error, refresh, workspace, setWorkspace } = useApp()
  const [role, setRole] = useState<Role>(workspace?.role || 'transport')
  const [employeeId, setEmployeeId] = useState(workspace?.employeeId || '')
  const navigate = useNavigate()
  const employees = employeesFor(data, role)
  const selected = employees.some((e) => e.employee_id === employeeId)
    ? employeeId
    : employees[0]?.employee_id || ''
  function enter(event: FormEvent) {
    event.preventDefault()
    if (!selected || error) return
    setWorkspace({ role, employeeId: selected })
    navigate('/')
  }
  return (
    <div className="welcome">
      <section className="welcome-brand">
        <Brand />
        <div className="welcome-story">
          <span className="welcome-kicker">
            <Leaf size={16} />
            BETTER MATERIALS. BETTER TOMORROW.
          </span>
          <h1>
            เปลี่ยนวัสดุเหลือใช้
            <br />
            <em>
              ให้กลายเป็นคุณค่า
              <br />
              ที่ยั่งยืน
            </em>
          </h1>
          <p>
            เชื่อมทุกคำขอซื้อ กับทุกการเดินทาง
            <br />
            ให้การจัดการวัสดุเป็นเรื่องง่ายในที่เดียว
          </p>
          <div className="welcome-note">
            <span className="note-dot" />
            <div>
              <strong>ทุกขั้นตอน เชื่อมถึงกัน</strong>
              <small>คำขอซื้อ · จัดรถ · ขนส่ง · ส่งมอบ</small>
            </div>
          </div>
        </div>
        <small className="welcome-copyright">RECYCLEHUB / OPERATIONS PORTAL</small>
      </section>
      <section className="welcome-form">
        <div className="welcome-form-inner">
          <span className="welcome-icon">
            <Leaf size={23} />
          </span>
          <h2>ยินดีต้อนรับกลับ</h2>
          <p className="muted">เลือกพื้นที่ทำงานเพื่อเริ่มจัดการงานของคุณ</p>
          <ErrorBox message={error} retry={() => void refresh()} />
          {loading ? (
            <Loading />
          ) : (
            <form onSubmit={enter}>
              <div className="role-options">
                {(
                  [
                    { value: 'transport', icon: Truck },
                    { value: 'sales', icon: ShoppingBag },
                    { value: 'driver', icon: Route },
                  ] as const
                ).map(({ value, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    className={role === value ? 'selected' : ''}
                    aria-pressed={role === value}
                    onClick={() => {
                      setRole(value)
                      setEmployeeId('')
                    }}
                  >
                    <Icon size={22} />
                    <span>{roles[value].title}</span>
                  </button>
                ))}
              </div>
              <label className="field">
                ผู้ใช้งาน
                <select
                  value={selected}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                  aria-label="ผู้ใช้งาน"
                >
                  {!employees.length && <option value="">ยังไม่มีพนักงานในบทบาทนี้</option>}
                  {employees.map((e) => (
                    <option key={e.employee_id} value={e.employee_id}>
                      {e.name} · {e.employee_id}
                    </option>
                  ))}
                </select>
              </label>
              {!employees.length && !error && (
                <p className="hint">กรุณาเพิ่มข้อมูลพนักงานในระบบก่อนเข้าใช้งาน</p>
              )}
              <button className="button primary full" disabled={!selected || !!error}>
                เข้าสู่พื้นที่ทำงาน
                <ArrowRight size={17} />
              </button>
              <p className="workspace-notice">
                เวอร์ชันทดลอง: เลือกผู้ใช้งานเพื่อทดสอบขั้นตอนทำงาน
                <br />
                ยังไม่มีการตรวจสอบรหัสผ่าน
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
