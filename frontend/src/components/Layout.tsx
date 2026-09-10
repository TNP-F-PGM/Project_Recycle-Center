import { useState } from 'react'
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Factory,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Boxes,
  ClipboardCheck,
  History,
  MessageSquareWarning,
  PackagePlus,
  PackageMinus,
  ScanLine,
  SlidersHorizontal,
  ScrollText,
  Truck,
  UserRound,
  Search,
  UserPlus,
  X,
} from 'lucide-react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { roles, useApp } from '../context/AppContext'
import { ErrorBox, Loading } from './ui'
import { shortId } from '../utils/format'
import { Brand } from './Brand'

export const warehouseNavigation = [
  { to: '/', label: 'ภาพรวม', icon: LayoutDashboard },
  { to: '/receipts', label: 'รับวัสดุเข้าคลัง', icon: PackagePlus },
  { to: '/issues', label: 'เบิกจ่ายวัสดุ', icon: PackageMinus },
  { to: '/inventory', label: 'คลังวัสดุ', icon: Boxes },
  { to: '/adjustments', label: 'ตรวจนับและปรับยอด', icon: SlidersHorizontal },
  { to: '/stock-history', label: 'ประวัติการเคลื่อนไหว', icon: History },
  { to: '/returns', label: 'รับคืนวัสดุ', icon: ClipboardCheck },
]

export function Layout() {
  const { workspace, employee, data, error, refresh, loading, toast, setWorkspace } = useApp()
  const [mobile, setMobile] = useState(false)
  const [notifications, setNotifications] = useState(false)
  const location = useLocation()
  if (!workspace) return <Navigate to="/welcome" replace state={{ from: location.pathname }} />
  if (!loading && !error && !employee) return <Navigate to="/welcome" replace />
  const role = workspace.role
  const pending = data.deliveries.filter((d) =>
    !['sales', 'transport', 'driver'].includes(role)
      ? false
      : role === 'driver'
        ? d.driver_id === workspace.employeeId && d.status === 'assigned'
        : ['pending', 'on_hold'].includes(d.status) &&
          (role !== 'sales' ||
            data.orders.some(
              (o) => o.order_id === d.order_id && o.sales_staff_id === workspace.employeeId,
            )),
  )
  const nav =
    role === 'sales'
      ? [
          { to: '/', label: 'ภาพรวม', icon: LayoutDashboard },
          { to: '/orders', label: 'คำขอซื้อ', icon: ClipboardList },
          { to: '/contracts', label: 'สัญญาซื้อขาย', icon: ScrollText },
          { to: '/deliveries', label: 'ติดตามการขนส่ง', icon: Truck },
          { to: '/materials', label: 'รายการวัสดุ', icon: Package },
          { to: '/factories', label: 'โรงงาน', icon: Factory },
        ]
      : role === 'driver'
        ? [
            { to: '/', label: 'งานของฉัน', icon: LayoutDashboard },
            { to: '/deliveries', label: 'ประวัติการขนส่ง', icon: ClipboardList },
          ]
        : role === 'quality'
          ? [
              { to: '/', label: 'ภาพรวม', icon: LayoutDashboard },
              { to: '/quality', label: 'คัดแยกคุณภาพ', icon: ScanLine },
              { to: '/quality/history', label: 'ประวัติการประเมิน', icon: History },
            ]
          : role === 'customer_service'
            ? [
                { to: '/', label: 'ภาพรวมงานบริการ', icon: LayoutDashboard },
                { to: '/complaints', label: 'คำร้องเรียน', icon: MessageSquareWarning },
                { to: '/returns', label: 'ติดตามการรับคืน', icon: ClipboardCheck },
              ]
            : role === 'purchasing'
              ? [
                  { to: '/', label: 'ภาพรวมงานรับซื้อ', icon: LayoutDashboard },
                  { to: '/sellers', label: 'ค้นหาผู้ขาย', icon: Search },
                  { to: '/sellers/new', label: 'ลงทะเบียนผู้ขาย', icon: UserPlus },
                  { to: '/purchases', label: 'รายการรับซื้อ', icon: PackagePlus },
                ]
              : role === 'manager'
                ? [
                    { to: '/', label: 'ภาพรวมสำหรับผู้จัดการ', icon: LayoutDashboard },
                    { to: '/sellers', label: 'ตรวจสอบผู้ขาย', icon: ClipboardCheck },
                  ]
                : role === 'warehouse'
                  ? warehouseNavigation
                  : role === 'warehouse_manager'
                    ? [
                        { to: '/', label: 'ภาพรวม', icon: LayoutDashboard },
                        { to: '/inventory', label: 'คลังวัสดุ', icon: Boxes },
                        { to: '/adjustments', label: 'อนุมัติปรับยอด', icon: ClipboardCheck },
                        { to: '/stock-history', label: 'ประวัติการเคลื่อนไหว', icon: History },
                      ]
                    : [
                        { to: '/', label: 'ภาพรวม', icon: LayoutDashboard },
                        { to: '/deliveries', label: 'คำขอรับ–ส่งวัสดุ', icon: ClipboardList },
                        { to: '/trucks', label: 'รถขนส่ง', icon: Truck },
                        { to: '/drivers', label: 'พนักงานขับรถ', icon: UserRound },
                      ]
  return (
    <div className="app-shell">
      {mobile && (
        <button className="sidebar-shade" aria-label="ปิดเมนู" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? 'is-open' : ''}`}>
        <Brand />
        <button
          className="mobile-close icon-button"
          aria-label="ปิดเมนู"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace-label">
          <small>พื้นที่ทำงาน</small>
          <strong>{roles[role].title}</strong>
        </div>
        <nav aria-label="เมนูหลัก">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/' || to === '/quality' || to === '/sellers'}
              onClick={() => setMobile(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {to === '/deliveries' && pending.length > 0 && (
                <b className="nav-count">{pending.length}</b>
              )}
            </NavLink>
          ))}
          <NavLink to="/help" onClick={() => setMobile(false)}>
            <CircleHelp size={18} />
            <span>ศูนย์ช่วยเหลือ</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <span className="connection">
            <i className={error ? 'offline' : ''} />
            {error ? 'ขาดการเชื่อมต่อ' : 'เชื่อมต่อระบบแล้ว'}
          </span>
          <Link to="/welcome" onClick={() => setMobile(false)}>
            <UserRound size={17} />
            เปลี่ยนพื้นที่ทำงาน
          </Link>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button menu-toggle"
            aria-label="เปิดเมนู"
            onClick={() => setMobile(true)}
          >
            <Menu size={22} />
          </button>
          <div className="topbar-title">
            <small>
              {new Date().toLocaleDateString('th-TH', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </small>
            <strong>
              {
                (
                  {
                    transport: 'ศูนย์ควบคุมการขนส่ง',
                    sales: 'ศูนย์บริหารงานขาย',
                    driver: 'งานขนส่งของฉัน',
                    customer_service: 'ศูนย์จัดการคำร้องเรียน',
                    purchasing: 'ศูนย์ปฏิบัติการรับซื้อ',
                    manager: 'ศูนย์บริหารและอนุมัติ',
                    quality: 'ศูนย์ประเมินคุณภาพวัสดุ',
                    warehouse: 'ศูนย์ปฏิบัติการคลังสินค้า',
                    warehouse_manager: 'ศูนย์ควบคุมคลังสินค้า',
                  } as Record<typeof role, string>
                )[role]
              }
            </strong>
          </div>
          <div className="header-actions">
            <div className="notification-wrap">
              <button
                className="icon-button notification-button"
                aria-label="ดูงานที่รอดำเนินการ"
                aria-expanded={notifications}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={18} />
                {pending.length > 0 && <i />}
              </button>
              {notifications && (
                <div className="notification-popover">
                  <h3>งานที่รอดำเนินการ ({pending.length})</h3>
                  {pending.slice(0, 5).map((d) => (
                    <Link
                      to={`/deliveries/${encodeURIComponent(d.request_id)}`}
                      key={d.request_id}
                      onClick={() => setNotifications(false)}
                    >
                      <div>
                        <strong>{d.customer_name}</strong>
                        <small>{shortId(d.request_id)}</small>
                      </div>
                      <ChevronRight size={15} />
                    </Link>
                  ))}
                  {!pending.length && <p>ไม่มีงานที่รอดำเนินการ</p>}
                </div>
              )}
            </div>
            <Link className="user-profile" to="/welcome" aria-label="เปลี่ยนผู้ใช้งาน">
              <span className="avatar">{employee?.name?.slice(0, 1) || 'R'}</span>
              <div>
                <small>{roles[role].english}</small>
                <strong>{employee?.name || 'กำลังโหลด…'}</strong>
              </div>
            </Link>
            <button
              className="icon-button"
              aria-label="ออกจากพื้นที่ทำงาน"
              onClick={() => setWorkspace(null)}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main id="main-content">
          <ErrorBox message={error} retry={() => void refresh()} />
          {loading ? <Loading /> : <Outlet />}
        </main>
        <footer className="app-footer">
          <span>RecycleHub · Operations Portal</span>
          <span>จัดการวัสดุอย่างมีคุณค่า</span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={20} />
          {toast}
        </div>
      )}
    </div>
  )
}
