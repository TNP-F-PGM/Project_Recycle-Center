import { useState } from 'react'
import { ArrowRight, ClipboardList, Download, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Empty, PageIntro, RefreshButton, SearchBox, Status } from '../components/ui'
import { dateLabel, downloadCSV, shortId, statusLabels } from '../utils/format'

export function Orders() {
  const { data, workspace, refresh, refreshing } = useApp()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const factoryName = (id: string) =>
    data.factories.find((f) => f.factory_id === id)?.company_name || id
  const rows = data.orders.filter(
    (o) =>
      (workspace?.role !== 'sales' || o.sales_staff_id === workspace.employeeId) &&
      (!status || o.status === status) &&
      `${o.order_id} ${factoryName(o.factory_id)}`.toLowerCase().includes(query.toLowerCase()),
  )
  const max = Math.max(1, Math.ceil(rows.length / 10))
  const current = Math.min(page, max)
  return (
    <>
      <PageIntro
        eyebrow="SALES OFFICER"
        title="คำขอซื้อ"
        description="เลือกโรงงานและวัสดุ พร้อมส่งต่อให้ฝ่ายขนส่ง"
      >
        <RefreshButton onClick={() => void refresh()} busy={refreshing} />
        {workspace?.role === 'sales' && (
          <Link className="button primary" to="/orders/new">
            <Plus size={17} />
            สร้างคำขอซื้อ
          </Link>
        )}
      </PageIntro>
      <div className="section-label">
        <ClipboardList size={18} />
        รายการคำขอซื้อ<span>{rows.length} รายการ</span>
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <SearchBox
            value={query}
            onChange={(v) => {
              setQuery(v)
              setPage(1)
            }}
          />
          <select
            aria-label="กรองสถานะคำขอซื้อ"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            <option value="">ทุกสถานะ</option>
            {['created', 'completed', 'cancelled'].map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
          <button
            className="button secondary export-button"
            onClick={() =>
              downloadCSV('purchase-orders', [
                ['รหัสคำขอซื้อ', 'โรงงาน', 'วันที่สร้าง', 'สถานะ', 'รหัสคำขอจัดส่ง'],
                ...rows.map((o) => [
                  o.order_id,
                  factoryName(o.factory_id),
                  o.order_date,
                  statusLabels[o.status] || o.status,
                  o.request_id,
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
            title={query || status ? 'ไม่พบคำขอที่ตรงกับตัวกรอง' : 'ยังไม่มีคำขอซื้อ'}
            message={
              query || status ? 'ลองเปลี่ยนคำค้นหาหรือสถานะ' : 'กดสร้างคำขอซื้อเพื่อเริ่มรายการใหม่'
            }
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>คำขอซื้อ / โรงงาน</th>
                  <th>วันที่สร้าง</th>
                  <th>สถานะ</th>
                  <th>คำขอจัดส่ง</th>
                  <th>ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice((current - 1) * 10, current * 10).map((o) => (
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
                          <small>{factoryName(o.factory_id)}</small>
                        </span>
                      </Link>
                    </td>
                    <td>{dateLabel(o.order_date)}</td>
                    <td>
                      <Status value={o.status} />
                    </td>
                    <td>
                      {o.request_id ? (
                        <Link
                          className="text-link"
                          to={`/deliveries/${encodeURIComponent(o.request_id)}`}
                        >
                          ติดตามการจัดส่ง
                          <ArrowRight size={13} />
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <Link
                        className="button small soft"
                        to={`/orders/${encodeURIComponent(o.order_id)}`}
                      >
                        ดูรายละเอียด
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
