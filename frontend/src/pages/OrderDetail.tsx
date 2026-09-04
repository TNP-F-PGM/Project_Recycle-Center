import { ArrowRight, Building2, Package, Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useRecord } from '../hooks/useRecord'
import { useApp } from '../context/AppContext'
import { ErrorBox, Info, Loading, PageIntro, Status } from '../components/ui'
import { dateLabel, number } from '../utils/format'
import type { Order } from '../types'

export function OrderDetail() {
  const { id } = useParams()
  const { data, workspace } = useApp()
  const record = useRecord<Order>(`/purchase-orders/${encodeURIComponent(id!)}`)
  if (record.loading) return <Loading />
  if (!record.data) return <ErrorBox message={record.error} retry={record.reload} />
  const order = record.data
  const delivery = data.deliveries.find((d) => d.request_id === order.request_id)
  const canEdit =
    order.status === 'created' &&
    delivery?.status === 'pending' &&
    workspace?.role === 'sales' &&
    workspace.employeeId === order.sales_staff_id
  return (
    <>
      <PageIntro eyebrow="PURCHASE ORDER" title="รายละเอียดคำขอซื้อ" back="/orders">
        <Status value={order.status} />
        {canEdit && (
          <Link
            className="button secondary"
            to={`/orders/${encodeURIComponent(order.order_id)}/edit`}
          >
            <Pencil size={15} />
            แก้ไขคำขอซื้อ
          </Link>
        )}
      </PageIntro>
      {delivery?.status === 'cancelled' && order.status !== 'cancelled' && (
        <div className="incident-banner">
          การจัดส่งถูกยกเลิก แต่คำขอซื้อนี้ยังไม่ถูกยกเลิก
          กรุณาประสานหัวหน้าขนส่งเพื่อวางแผนดำเนินการต่อ
        </div>
      )}
      <div className="record-id">{order.order_id}</div>
      <div className="detail-grid">
        <div>
          <section className="panel form-panel">
            <h2>
              <Building2 size={19} />
              ข้อมูลคำขอซื้อ
            </h2>
            <dl className="info-grid">
              <Info label="โรงงาน">{order.factory?.company_name || order.factory_id}</Info>
              <Info label="วันที่สร้าง">{dateLabel(order.order_date)}</Info>
              <Info label="พนักงานขาย">
                {data.sales.find((e) => e.employee_id === order.sales_staff_id)?.name ||
                  order.sales_staff_id}
              </Info>
              <Info label="ผู้ติดต่อ">{order.factory?.contact_person}</Info>
              <Info label="โทรศัพท์">{order.factory?.phone}</Info>
              <Info label="ที่อยู่โรงงาน">{order.factory?.address}</Info>
            </dl>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>
                <Package size={18} />
                รายการวัสดุ
              </h2>
              <span className="muted">{order.materials.length} รายการ</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>วัสดุ</th>
                    <th>รหัสวัสดุ</th>
                    <th className="numeric">จำนวน</th>
                    <th>หน่วย</th>
                  </tr>
                </thead>
                <tbody>
                  {order.materials.map((m) => (
                    <tr key={m.material_id}>
                      <td>
                        <strong>{m.material_name}</strong>
                      </td>
                      <td>{m.material_id}</td>
                      <td className="numeric">{number(m.requested_quantity)}</td>
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
            <h2>การจัดส่งที่เชื่อมกัน</h2>
            {order.request_id ? (
              <>
                <p className="break-id">{order.request_id}</p>
                {delivery && (
                  <>
                    <Status value={delivery.status} />
                    <dl className="spaced">
                      <Info label="วันนัดจัดส่ง">{dateLabel(delivery.request_date)}</Info>
                      <Info label="ปลายทาง">{delivery.customer_name}</Info>
                    </dl>
                  </>
                )}
                <Link
                  className="button primary full"
                  to={`/deliveries/${encodeURIComponent(order.request_id)}`}
                >
                  ดูคำขอจัดส่ง
                  <ArrowRight size={15} />
                </Link>
              </>
            ) : (
              <p className="muted">ยังไม่มีคำขอจัดส่งเชื่อมกับรายการนี้</p>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}
