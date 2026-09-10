import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardList,
  PackageCheck,
  Plus,
  Truck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp, roles } from '../context/AppContext'
import { Empty, Metric, PageIntro, RefreshButton, Status } from '../components/ui'
import { dateLabel, number, shortId, today, activeDelivery } from '../utils/format'
import { DriverJobs } from './DriverJobs'
import { OperationsDashboard } from './operations/OperationsDashboard'

export function Dashboard() {
  const { data, workspace, refresh, refreshing } = useApp()
  if (workspace?.role === 'driver') return <DriverJobs />
  if (
    workspace &&
    [
      'customer_service',
      'purchasing',
      'manager',
      'quality',
      'warehouse',
      'warehouse_manager',
    ].includes(workspace.role)
  )
    return <OperationsDashboard />
  const sales = workspace?.role === 'sales'
  const orders = data.orders.filter((o) => !sales || o.sales_staff_id === workspace?.employeeId)
  const deliveries = data.deliveries.filter(
    (d) => !sales || orders.some((o) => o.order_id === d.order_id),
  )
  const pending = deliveries.filter((d) => d.status === 'pending').length
  const inTransit = deliveries.filter((d) => d.status === 'in_transit').length
  const done = deliveries.filter((d) => d.status === 'delivered').length
  const stats = [
    {
      label: sales ? 'คำขอซื้อทั้งหมด' : 'งานวันนี้',
      value: sales ? orders.length : deliveries.filter((d) => d.request_date === today()).length,
      detail: sales ? 'คำขอที่คุณสร้าง' : 'ตามวันนัดจัดส่ง',
      icon: sales ? ClipboardList : CalendarDays,
      tone: 'green',
    },
    {
      label: 'กำลังขนส่ง',
      value: inTransit,
      detail: 'งานที่ออกเดินทางแล้ว',
      icon: Truck,
      tone: 'blue',
    },
    { label: 'รอมอบหมาย', value: pending, detail: 'รอจัดรถและคนขับ', icon: Clock3, tone: 'amber' },
    {
      label: 'จัดส่งสำเร็จ',
      value: done,
      detail: 'งานที่ส่งมอบเรียบร้อย',
      icon: CheckCircle2,
      tone: 'purple',
    },
  ]
  const fleet = [
    {
      label: 'พร้อมใช้งาน',
      count: data.trucks.filter((t) => t.status === 'available' && !t.request_id).length,
      color: '#399979',
    },
    {
      label: 'กำลังปฏิบัติงาน',
      count: data.trucks.filter((t) => activeDelivery(t.status)).length,
      color: '#6c9bbd',
    },
    {
      label: 'ไม่พร้อมใช้งาน',
      count: data.trucks.filter(
        (t) => !['available', 'assigned', 'in_transit', 'on_hold'].includes(t.status),
      ).length,
      color: '#e0b658',
    },
  ]
  const total = data.trucks.length
  let position = 0
  const gradient = fleet
    .map((s) => {
      const start = position
      position += total ? (s.count / total) * 100 : 0
      return `${s.color} ${start}% ${position}%`
    })
    .join(',')
  return (
    <>
      <PageIntro
        eyebrow={roles[sales ? 'sales' : 'transport'].english}
        title={sales ? 'ภาพรวมคำขอซื้อ' : 'ภาพรวมคำขอจัดส่ง'}
        description="ข้อมูลล่าสุดของคุณ พร้อมเริ่มต้นวันทำงาน"
      >
        <RefreshButton onClick={() => void refresh()} busy={refreshing} />
        {sales && (
          <Link to="/orders/new" className="button primary">
            <Plus size={17} />
            สร้างคำขอซื้อ
          </Link>
        )}
      </PageIntro>
      {deliveries.some((d) => d.status === 'on_hold') && (
        <Link className="incident-banner" to="/deliveries?status=on_hold">
          มีงานหยุดชั่วคราว / รอแก้ไข {deliveries.filter((d) => d.status === 'on_hold').length}{' '}
          รายการ — ดูรายละเอียด
        </Link>
      )}
      <div className="metrics">
        {stats.map((s) => (
          <Metric key={s.label} {...s} value={number(s.value)} />
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{sales ? 'คำขอซื้อล่าสุด' : 'คำขอรับ–ส่งล่าสุด'}</h2>
              <p>ติดตามความคืบหน้าของแต่ละรายการ</p>
            </div>
            <Link className="text-link" to={sales ? '/orders' : '/deliveries'}>
              ดูทั้งหมด
              <ArrowRight size={14} />
            </Link>
          </div>
          {!(sales ? orders.length : deliveries.length) ? (
            <Empty
              title={sales ? 'เริ่มต้นด้วยคำขอซื้อใบแรก' : 'ยังไม่มีคำขอจัดส่ง'}
              message={
                sales
                  ? 'เลือกโรงงานและวัสดุที่ต้องการ ระบบจะส่งงานให้ฝ่ายขนส่ง'
                  : 'คำขอจัดส่งจะปรากฏเมื่อพนักงานขายสร้างคำขอซื้อ'
              }
              action={
                sales && (
                  <Link className="button primary" to="/orders/new">
                    <Plus size={16} />
                    สร้างคำขอซื้อ
                  </Link>
                )
              }
            />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>รหัสงาน / โรงงาน</th>
                    <th>{sales ? 'วันที่สร้าง' : 'วันนัดจัดส่ง'}</th>
                    <th>สถานะ</th>
                    <th>
                      <span className="sr-only">รายละเอียด</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sales
                    ? orders.slice(0, 6).map((o) => (
                        <tr key={o.order_id}>
                          <td>
                            <Link
                              className="row-identity"
                              to={`/orders/${encodeURIComponent(o.order_id)}`}
                            >
                              <span className="row-avatar">
                                <ClipboardList size={17} />
                              </span>
                              <span>
                                <strong title={o.order_id}>{shortId(o.order_id)}</strong>
                                <small>
                                  {data.factories.find((f) => f.factory_id === o.factory_id)
                                    ?.company_name || o.factory_id}
                                </small>
                              </span>
                            </Link>
                          </td>
                          <td>{dateLabel(o.order_date)}</td>
                          <td>
                            <Status value={o.status} />
                          </td>
                          <td>
                            <Link
                              className="icon-link"
                              aria-label={`ดู ${o.order_id}`}
                              to={`/orders/${encodeURIComponent(o.order_id)}`}
                            >
                              <ArrowRight size={16} />
                            </Link>
                          </td>
                        </tr>
                      ))
                    : deliveries.slice(0, 6).map((d) => (
                        <tr key={d.request_id}>
                          <td>
                            <Link
                              className="row-identity"
                              to={`/deliveries/${encodeURIComponent(d.request_id)}`}
                            >
                              <span className="row-avatar">{d.customer_name.slice(0, 1)}</span>
                              <span>
                                <strong title={d.request_id}>{shortId(d.request_id)}</strong>
                                <small>{d.customer_name}</small>
                              </span>
                            </Link>
                          </td>
                          <td>{dateLabel(d.request_date)}</td>
                          <td>
                            <Status value={d.status} />
                          </td>
                          <td>
                            <Link
                              className="icon-link"
                              aria-label={`ดู ${d.request_id}`}
                              to={`/deliveries/${encodeURIComponent(d.request_id)}`}
                            >
                              <ArrowRight size={16} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <div className="dashboard-aside">
          <section className="panel fleet-summary">
            <div className="panel-heading">
              <div>
                <h2>{sales ? 'สถานะคำขอของคุณ' : 'สถานะรถขนส่ง'}</h2>
                <p>{sales ? 'เชื่อมต่อกับฝ่ายขนส่ง' : 'ความพร้อมของรถทั้งหมด'}</p>
              </div>
              {!sales && (
                <Link className="text-link" to="/trucks">
                  จัดการ
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
            {sales ? (
              <div className="summary-list">
                <div>
                  <span>คำขอที่อยู่ระหว่างดำเนินการ</span>
                  <b>{number(orders.filter((o) => o.status === 'created').length)}</b>
                </div>
                <div>
                  <span>ดำเนินการเสร็จสิ้น</span>
                  <b>{number(orders.filter((o) => o.status === 'completed').length)}</b>
                </div>
                <div>
                  <span>ยกเลิกแล้ว</span>
                  <b>{number(orders.filter((o) => o.status === 'cancelled').length)}</b>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="fleet-donut"
                  style={{ background: total ? `conic-gradient(${gradient})` : '#edf1ee' }}
                >
                  <div>
                    <strong>{number(total)}</strong>
                    <small>คันทั้งหมด</small>
                  </div>
                </div>
                <div className="legend">
                  {fleet.map((s) => (
                    <div key={s.label}>
                      <span>
                        <i style={{ background: s.color }} />
                        {s.label}
                      </span>
                      <b>
                        {s.count} <small>คัน</small>
                      </b>
                    </div>
                  ))}
                </div>
              </>
            )}
            {pending > 0 && (
              <Link className="pending-note" to={sales ? '/orders' : '/deliveries?status=pending'}>
                <Clock3 size={17} />
                <span>มี {pending} คำขอรอจัดรถ</span>
                <ArrowRight size={14} />
              </Link>
            )}
          </section>
          <div className="green-note">
            <PackageCheck size={24} />
            <h3>ทุกคำขอ เชื่อมถึงการจัดส่ง</h3>
            <p>คำขอซื้อหนึ่งใบ มีคำขอจัดส่งหนึ่งใบ ติดตามได้ตลอดขั้นตอนทำงาน</p>
          </div>
        </div>
      </div>
    </>
  )
}
