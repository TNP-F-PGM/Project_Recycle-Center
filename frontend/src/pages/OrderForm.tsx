import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Building2,
  ClipboardList,
  MapPin,
  Package,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { ErrorBox, Info, Loading, PageIntro } from '../components/ui'
import { api, errorText } from '../services/api'
import { useRecord } from '../hooks/useRecord'
import { number, today } from '../utils/format'
import type { Delivery, Order } from '../types'
import { LocationMap } from '../components/LocationMap'
import { coordinates } from '../utils/maps'

export function OrderFormPage() {
  const { id } = useParams()
  const { workspace } = useApp()
  if (workspace?.role !== 'sales') return <Navigate to="/orders" replace />
  return id ? <EditOrder id={id} /> : <OrderForm />
}
function EditOrder({ id }: { id: string }) {
  const record = useRecord<Order>(`/purchase-orders/${encodeURIComponent(id)}`)
  if (record.loading) return <Loading />
  if (!record.data) return <ErrorBox message={record.error} retry={record.reload} />
  return <EditOrderReady order={record.data} />
}
function EditOrderReady({ order }: { order: Order }) {
  const delivery = useRecord<Delivery>(
    `/delivery-requests/${encodeURIComponent(order.request_id || '')}`,
  )
  const { workspace } = useApp()
  if (delivery.loading) return <Loading />
  if (!delivery.data) return <ErrorBox message={delivery.error} retry={delivery.reload} />
  if (
    order.status !== 'created' ||
    delivery.data.status !== 'pending' ||
    order.sales_staff_id !== workspace?.employeeId
  )
    return (
      <>
        <ErrorBox message="รายการนี้ไม่สามารถแก้ไขได้ อาจมีการจัดรถแล้วหรือสร้างโดยผู้ใช้งานคนอื่น" />
        <Link className="button secondary" to={`/orders/${encodeURIComponent(order.order_id)}`}>
          กลับไปดูคำขอซื้อ
        </Link>
      </>
    )
  return <OrderForm order={order} deliveryDate={delivery.data.request_date} />
}
function OrderForm({ order, deliveryDate }: { order?: Order; deliveryDate?: string }) {
  const { data, workspace, refresh, notify } = useApp()
  const navigate = useNavigate()
  const [factoryId, setFactoryId] = useState(order?.factory_id || '')
  const [orderDate, setOrderDate] = useState(order?.order_date || today())
  const [requestDate, setRequestDate] = useState(deliveryDate || today())
  const [contact, setContact] = useState({ customer_name: '', address: '', phone_number: '' })
  const [lines, setLines] = useState(
    order?.materials.map((m) => ({
      material_id: m.material_id,
      requested_quantity: String(m.requested_quantity),
    })) || [{ material_id: '', requested_quantity: '1' }],
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const factory = data.factories.find((f) => f.factory_id === factoryId)
  const factoryPoint = coordinates(factory?.latitude, factory?.longitude)
  const needsFactoryPoint = !order || factoryId !== order.factory_id
  function chooseFactory(id: string) {
    setFactoryId(id)
    const f = data.factories.find((v) => v.factory_id === id)
    setContact({
      customer_name: f?.company_name || '',
      address: f?.address || '',
      phone_number: f?.phone || '',
    })
  }
  function changeLine(index: number, field: 'material_id' | 'requested_quantity', value: string) {
    setLines((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (
      !factoryId ||
      !lines.length ||
      lines.some(
        (l) =>
          !l.material_id ||
          !Number.isSafeInteger(Number(l.requested_quantity)) ||
          Number(l.requested_quantity) <= 0,
      )
    )
      return setError('กรุณาเลือกโรงงาน วัสดุ และระบุจำนวนเป็นจำนวนเต็มมากกว่า 0')
    if (new Set(lines.map((l) => l.material_id)).size !== lines.length)
      return setError('กรุณาเลือกวัสดุแต่ละชนิดเพียงครั้งเดียว')
    if (requestDate < orderDate) return setError('วันนัดจัดส่งต้องไม่อยู่ก่อนวันที่สร้างคำขอซื้อ')
    if (needsFactoryPoint && !factoryPoint)
      return setError('กรุณาบันทึกพิกัดที่หน้าโรงงานก่อนสร้างคำขอซื้อ')
    setBusy(true)
    try {
      const base = {
        factory_id: factoryId,
        order_date: orderDate,
        materials: lines.map((l) => ({
          material_id: l.material_id,
          requested_quantity: Number(l.requested_quantity),
        })),
      }
      const result = await api<Order>(
        order ? `/purchase-orders/${encodeURIComponent(order.order_id)}` : '/purchase-orders',
        order ? 'PATCH' : 'POST',
        order
          ? base
          : {
              ...base,
              sales_staff_id: workspace!.employeeId,
              delivery: {
                ...contact,
                request_date: requestDate,
              },
            },
      )
      await refresh()
      notify(order ? 'บันทึกคำขอซื้อแล้ว' : 'สร้างคำขอซื้อและคำขอจัดส่งเรียบร้อยแล้ว')
      navigate(`/orders/${encodeURIComponent(result.order_id)}`)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageIntro
        eyebrow="PURCHASE ORDER"
        title={order ? 'แก้ไขคำขอซื้อ' : 'สร้างคำขอซื้อ'}
        description="คำขอซื้อหนึ่งใบ สำหรับโรงงานหนึ่งแห่ง"
        back={order ? `/orders/${encodeURIComponent(order.order_id)}` : '/orders'}
      />
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="form-fieldset">
          <div className="form-layout">
            <div className="form-sections">
              <section className="panel form-panel">
                <h2>
                  <Building2 size={19} />
                  ข้อมูลโรงงาน
                </h2>
                <div className="form-grid">
                  <label className="field">
                    โรงงาน <span className="required">*</span>
                    <select
                      required
                      value={factoryId}
                      onChange={(e) => chooseFactory(e.target.value)}
                    >
                      <option value="">เลือกโรงงาน</option>
                      {data.factories.map((f) => (
                        <option key={f.factory_id} value={f.factory_id}>
                          {f.company_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    วันที่สร้างคำขอซื้อ <span className="required">*</span>
                    <input
                      type="date"
                      required
                      value={orderDate}
                      max={order ? deliveryDate : undefined}
                      onChange={(e) => {
                        setOrderDate(e.target.value)
                        if (!order && requestDate < e.target.value) setRequestDate(e.target.value)
                      }}
                    />
                  </label>
                </div>
                {factory && (
                  <dl className="factory-preview">
                    <Info label="ผู้ติดต่อ">{factory.contact_person}</Info>
                    <Info label="เบอร์โทรศัพท์">{factory.phone}</Info>
                    <Info label="ที่อยู่">{factory.address}</Info>
                  </dl>
                )}
                {order && (
                  <p className="hint">
                    เปลี่ยนโรงงานแล้ว ระบบจะเปลี่ยนข้อมูลติดต่อและที่อยู่จัดส่งตามโรงงานใหม่
                  </p>
                )}
                <Link className="text-link spaced" to="/factories/new">
                  <Plus size={15} />
                  เพิ่มโรงงานใหม่
                </Link>
                {factory && (
                  <div className="spaced">
                    {factoryPoint ? (
                      <>
                        <LocationMap point={factoryPoint} />
                        <p className="hint">
                          คำขอใหม่จะใช้พิกัดโรงงานนี้อัตโนมัติ
                          {order && ' ส่วนคำขอเดิมจะคงพิกัดไว้หากไม่ได้เปลี่ยนโรงงาน'}
                        </p>
                      </>
                    ) : (
                      <div className="summary-note">
                        โรงงานนี้ยังไม่มีพิกัด กรุณา{' '}
                        <Link
                          className="text-link"
                          to={`/factories/${encodeURIComponent(factoryId)}/edit`}
                        >
                          แก้ไขโรงงานและปักหมุด
                        </Link>{' '}
                        ก่อนสร้างคำขอใหม่
                      </div>
                    )}
                  </div>
                )}
              </section>
              <section className="panel form-panel">
                <div className="section-heading">
                  <h2>
                    <Package size={19} />
                    รายการวัสดุ
                  </h2>
                  <span className="muted">{lines.length} รายการ</span>
                </div>
                <div className="material-lines">
                  {lines.map((line, index) => (
                    <div className="material-line" key={index}>
                      <span className="line-number">{String(index + 1).padStart(2, '0')}</span>
                      <label className="field">
                        วัสดุ
                        <select
                          required
                          aria-label={`วัสดุรายการที่ ${index + 1}`}
                          value={line.material_id}
                          onChange={(e) => changeLine(index, 'material_id', e.target.value)}
                        >
                          <option value="">เลือกวัสดุ</option>
                          {data.materials.map((m) => (
                            <option
                              disabled={lines.some(
                                (l, i) => i !== index && l.material_id === m.material_id,
                              )}
                              key={m.material_id}
                              value={m.material_id}
                            >
                              {m.material_name} · {m.unit}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        จำนวน
                        <input
                          type="number"
                          required
                          min="1"
                          step="1"
                          aria-label={`จำนวนรายการที่ ${index + 1}`}
                          value={line.requested_quantity}
                          onChange={(e) => changeLine(index, 'requested_quantity', e.target.value)}
                        />
                      </label>
                      <span className="unit">
                        {data.materials.find((m) => m.material_id === line.material_id)?.unit ||
                          'หน่วย'}
                      </span>
                      <button
                        type="button"
                        className="icon-button danger-text"
                        aria-label={`ลบวัสดุรายการที่ ${index + 1}`}
                        disabled={lines.length === 1}
                        onClick={() => setLines(lines.filter((_, i) => i !== index))}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="button soft"
                  disabled={lines.length >= data.materials.length}
                  onClick={() => setLines([...lines, { material_id: '', requested_quantity: '1' }])}
                >
                  <Plus size={16} />
                  เพิ่มวัสดุ
                </button>
                <p className="hint">
                  จำนวนใช้หน่วยตามวัสดุแต่ละรายการ และต้องเป็นจำนวนเต็มมากกว่า 0
                </p>
              </section>
              {!order && (
                <section className="panel form-panel">
                  <h2>
                    <MapPin size={19} />
                    ข้อมูลจัดส่ง
                  </h2>
                  <div className="form-grid">
                    <label className="field">
                      ชื่อผู้รับ / โรงงาน
                      <input
                        required
                        value={contact.customer_name}
                        onChange={(e) => setContact({ ...contact, customer_name: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      เบอร์โทรศัพท์
                      <input
                        type="tel"
                        value={contact.phone_number}
                        onChange={(e) => setContact({ ...contact, phone_number: e.target.value })}
                      />
                    </label>
                    <label className="field span-2">
                      ที่อยู่จัดส่ง
                      <textarea
                        required
                        rows={3}
                        value={contact.address}
                        onChange={(e) => setContact({ ...contact, address: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      วันนัดจัดส่ง
                      <input
                        type="date"
                        required
                        min={orderDate}
                        value={requestDate}
                        onChange={(e) => setRequestDate(e.target.value)}
                      />
                    </label>
                  </div>
                  <p className="hint">
                    พิกัดปลายทางใช้จากโรงงานที่เลือก ไม่ต้องกรอกซ้ำ หากต้องเปลี่ยนจุดส่งเฉพาะเที่ยว
                    สามารถแก้ไขในรายละเอียดคำขอจัดส่งก่อนจัดรถ
                  </p>
                </section>
              )}
            </div>
            <aside className="panel order-summary">
              <span className="summary-icon">
                <ClipboardList size={24} />
              </span>
              <h2>สรุปคำขอซื้อ</h2>
              <dl>
                <Info label="โรงงาน">{factory?.company_name || 'ยังไม่ได้เลือก'}</Info>
                <Info label="วัสดุ">
                  {number(lines.filter((l) => l.material_id).length)} รายการ
                </Info>
              </dl>
              <div className="summary-note">
                {order
                  ? 'การแก้ไขวัสดุจะอัปเดตรายการในคำขอจัดส่งด้วย'
                  : 'เมื่อบันทึก ระบบจะสร้างคำขอจัดส่งให้ฝ่ายขนส่งโดยอัตโนมัติ'}
              </div>
              <ErrorBox message={error} />
              <button
                className="button primary full"
                disabled={
                  busy ||
                  !data.factories.length ||
                  !data.materials.length ||
                  (needsFactoryPoint && !factoryPoint)
                }
              >
                {busy ? 'กำลังบันทึก…' : order ? 'บันทึกการแก้ไข' : 'สร้างคำขอซื้อ'}
                {order ? <Save size={16} /> : <ArrowRight size={16} />}
              </button>
              <Link
                className="button secondary full"
                to={order ? `/orders/${encodeURIComponent(order.order_id)}` : '/orders'}
                aria-disabled={busy}
                onClick={(e) => {
                  if (busy) e.preventDefault()
                }}
              >
                ยกเลิก
              </Link>
            </aside>
          </div>
        </fieldset>
      </form>
    </>
  )
}
