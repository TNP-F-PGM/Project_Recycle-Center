import { useState } from 'react'
import { ClipboardList, Download } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Empty, PageIntro, RefreshButton, SearchBox, Status } from '../components/ui'
import { dateLabel, downloadCSV, shortId, statusLabels } from '../utils/format'

export function Deliveries() {
  const { data, workspace, refresh, refreshing } = useApp()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''
  const status = params.get('status') || ''
  const [page, setPage] = useState(1)
  const rows = data.deliveries.filter(
    (d) =>
      (workspace?.role !== 'driver' || d.driver_id === workspace.employeeId) &&
      (workspace?.role !== 'sales' ||
        data.orders.some(
          (o) => o.order_id === d.order_id && o.sales_staff_id === workspace.employeeId,
        )) &&
      (!status || d.status === status) &&
      `${d.request_id} ${d.customer_name} ${d.order_id}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params)
    value ? next.set(key, value) : next.delete(key)
    setParams(next, { replace: true })
    setPage(1)
  }
  const max = Math.max(1, Math.ceil(rows.length / 10))
  const current = Math.min(page, max)
  const driver = workspace?.role === 'driver'
  const sales = workspace?.role === 'sales'
  return (
    <>
      <PageIntro
        eyebrow={driver ? 'DRIVER' : sales ? 'SALES OFFICER' : 'TRANSPORT MANAGER'}
        title={driver ? 'ประวัติการขนส่ง' : sales ? 'ติดตามการขนส่ง' : 'คำขอรับ–ส่งวัสดุ'}
        description={
          driver
            ? 'งานทั้งหมดที่ได้รับมอบหมายให้คุณ'
            : sales
              ? 'ติดตามสถานะการจัดส่งจากคำขอซื้อที่คุณสร้าง'
              : 'จัดรถและติดตามคำขอจัดส่งที่มาจากพนักงานขาย'
        }
      >
        <RefreshButton onClick={() => void refresh()} busy={refreshing} />
      </PageIntro>
      <div className="section-label">
        <ClipboardList size={18} />
        รายการคำขอจัดส่ง<span>{rows.length} รายการ</span>
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <SearchBox value={query} onChange={(v) => filter('q', v)} />
          <select
            aria-label="กรองสถานะจัดส่ง"
            value={status}
            onChange={(e) => filter('status', e.target.value)}
          >
            <option value="">ทุกสถานะ</option>
            {['pending', 'assigned', 'in_transit', 'on_hold', 'delivered', 'cancelled'].map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
          <button
            className="button secondary export-button"
            onClick={() =>
              downloadCSV('delivery-requests', [
                ['รหัสจัดส่ง', 'รหัสคำขอซื้อ', 'ปลายทาง', 'วันที่', 'สถานะ', 'รหัสรถ', 'รหัสคนขับ'],
                ...rows.map((d) => [
                  d.request_id,
                  d.order_id,
                  d.customer_name,
                  d.request_date,
                  statusLabels[d.status] || d.status,
                  d.truck_id,
                  d.driver_id,
                ]),
              ])
            }
          >
            <Download size={15} />
            ส่งออก
          </button>
        </div>
        {!rows.length ? (
          <Empty
            title={query || status ? 'ไม่พบงานที่ตรงกับตัวกรอง' : 'ยังไม่มีคำขอจัดส่ง'}
            message={
              query || status
                ? 'ลองเปลี่ยนคำค้นหาหรือสถานะ'
                : driver
                  ? 'งานจะปรากฏเมื่อหัวหน้าขนส่งมอบหมายให้คุณ'
                  : 'คำขอจัดส่งจะถูกสร้างพร้อมคำขอซื้อ'
            }
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>รหัสงาน / โรงงาน</th>
                  <th>วันนัดจัดส่ง</th>
                  <th>รถ / คนขับ</th>
                  <th>สถานะ</th>
                  <th>{sales ? 'ติดตามงาน' : 'ดำเนินการ'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice((current - 1) * 10, current * 10).map((d) => (
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
                      <div className="stacked">
                        <strong>
                          {data.trucks.find((t) => t.truck_id === d.truck_id)?.license_plate ||
                            'ยังไม่ได้จัดรถ'}
                        </strong>
                        <small>
                          {data.drivers.find((e) => e.employee_id === d.driver_id)?.name || '—'}
                        </small>
                      </div>
                    </td>
                    <td>
                      <Status value={d.status} />
                    </td>
                    <td>
                      <Link
                        className="button small soft"
                        to={`/deliveries/${encodeURIComponent(d.request_id)}`}
                      >
                        {d.status === 'pending' && workspace?.role === 'transport'
                          ? 'มอบหมายรถ'
                          : 'ดูรายละเอียด'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>ทั้งหมด {rows.length} รายการ</span>
          <div>
            <button disabled={current === 1} onClick={() => setPage(current - 1)}>
              ก่อนหน้า
            </button>
            <span>
              {current} / {max}
            </span>
            <button disabled={current === max} onClick={() => setPage(current + 1)}>
              ถัดไป
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
