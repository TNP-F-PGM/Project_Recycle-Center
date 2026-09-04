import { ArrowRight, CalendarDays, CheckCircle2, MapPin, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Empty, Metric, PageIntro, RefreshButton, Status } from '../components/ui'
import { activeDelivery, dateLabel, shortId } from '../utils/format'
import { LocationMap } from '../components/LocationMap'
import { deliveryCoordinates } from '../utils/maps'

export function DriverJobs() {
  const { data, workspace, employee, refresh, refreshing } = useApp()
  const mine = data.deliveries.filter((d) => d.driver_id === workspace?.employeeId)
  const active = mine.filter((d) => activeDelivery(d.status))
  const currentTruck = data.trucks.find(
    (t) => t.driver_id === workspace?.employeeId && t.request_id,
  )
  return (
    <>
      <PageIntro
        eyebrow="READY FOR WORK"
        title={`สวัสดี ${employee?.name || ''}`}
        description="ตรวจสอบงานที่ได้รับมอบหมาย และเตรียมพร้อมก่อนออกเดินทาง"
      >
        <RefreshButton onClick={() => void refresh()} busy={refreshing} />
      </PageIntro>
      <div className="metrics three">
        <Metric
          label="งานที่กำลังดำเนินการ"
          value={active.length}
          detail="งานที่ได้รับมอบหมาย"
          icon={CalendarDays}
        />
        <Metric
          label="รถที่รับผิดชอบ"
          value={<span className="metric-plate">{currentTruck?.license_plate || '—'}</span>}
          detail={currentTruck ? currentTruck.truck_id : 'ยังไม่มีงานที่ใช้รถ'}
          icon={Truck}
          tone="blue"
        />
        <Metric
          label="ส่งมอบสำเร็จ"
          value={mine.filter((d) => d.status === 'delivered').length}
          detail="งานทั้งหมดของคุณ"
          icon={CheckCircle2}
          tone="amber"
        />
      </div>
      <div className="driver-layout">
        <div>
          {!active.length ? (
            <section className="panel">
              <Empty
                title="ยังไม่มีงานที่ต้องดำเนินการ"
                message="เมื่อหัวหน้าขนส่งจัดรถและมอบหมายงานให้คุณ งานจะแสดงที่นี่"
                action={
                  <Link className="button secondary" to="/deliveries">
                    ดูประวัติการขนส่ง
                    <ArrowRight size={15} />
                  </Link>
                }
              />
            </section>
          ) : (
            active.map((d) => (
              <section className="panel job-card" key={d.request_id}>
                <div className="job-heading">
                  <div>
                    <small>งานที่ได้รับมอบหมาย</small>
                    <h2>{d.customer_name}</h2>
                    <p title={d.request_id}>{shortId(d.request_id)}</p>
                  </div>
                  <Status value={d.status} />
                </div>
                <div className="job-body">
                  <div className="destination">
                    <span>
                      <MapPin size={22} />
                    </span>
                    <div>
                      <small>ปลายทางจัดส่ง</small>
                      <h3>{d.customer_name}</h3>
                      <p>{d.address}</p>
                    </div>
                  </div>
                  <div className="job-facts">
                    <div>
                      <small>วันนัดจัดส่ง</small>
                      <strong>{dateLabel(d.request_date)}</strong>
                    </div>
                    <div>
                      <small>ทะเบียนรถ</small>
                      <strong>
                        {data.trucks.find((t) => t.truck_id === d.truck_id)?.license_plate ||
                          d.truck_id}
                      </strong>
                    </div>
                  </div>
                  {deliveryCoordinates(d) ? (
                    <LocationMap
                      point={deliveryCoordinates(d)}
                      label="ปลายทางจัดส่ง"
                      destinationName={d.customer_name}
                    />
                  ) : (
                    <p className="hint">
                      ยังไม่มีพิกัดปลายทาง กรุณาติดต่อพนักงานขายหรือหัวหน้าขนส่ง
                    </p>
                  )}
                  <Link
                    className="button primary"
                    to={`/deliveries/${encodeURIComponent(d.request_id)}`}
                  >
                    ดูรายละเอียดและดำเนินการ
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </section>
            ))
          )}
        </div>
        <aside>
          <div className="green-note">
            <Truck size={26} />
            <h3>พร้อมก่อนออกเดินทาง</h3>
            <p>ตรวจสอบทะเบียนรถ รายการวัสดุ และที่อยู่ปลายทางในคำขอจัดส่งทุกครั้ง</p>
          </div>
          <section className="panel form-panel">
            <h2>ขั้นตอนงานของคุณ</h2>
            <ol className="simple-steps">
              <li>ตรวจสอบรายละเอียดงาน</li>
              <li>กดเริ่มออกเดินทาง</li>
              <li>ขนส่งและส่งมอบวัสดุ</li>
              <li>ยืนยันจัดส่งสำเร็จ</li>
            </ol>
          </section>
        </aside>
      </div>
    </>
  )
}
