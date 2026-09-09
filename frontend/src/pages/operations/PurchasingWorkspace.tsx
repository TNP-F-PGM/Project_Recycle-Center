import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  BadgeDollarSign,
  Calculator,
  ClipboardCheck,
  PackageCheck,
  Scale,
} from 'lucide-react'
import {
  Empty,
  ErrorBox,
  Loading,
  Metric,
  PageIntro,
  RefreshButton,
  Status,
} from '../../components/ui'
import { roles, useApp } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import { api, errorText } from '../../services/api'
import type { PendingWarehouseItem, QualityAssessment, ScrapPurchase } from '../../types'
import { dateLabel, number, today } from '../../utils/format'

export function PurchasingWorkspace() {
  const { workspace, notify } = useApp()
  const assessments = useApiList<QualityAssessment>('/quality-assessments')
  const purchases = useApiList<ScrapPurchase>('/scrap-purchases')
  const pending = useApiList<PendingWarehouseItem>('/pending-warehouse-items')
  const [selectedID, setSelectedID] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const eligible = assessments.data.filter(
    (row) => ['passed', 'special_storage'].includes(row.result) && !row.scrapPurchaseItem,
  )
  const selected = eligible.find((row) => row.assessmentID === selectedID) || eligible[0]
  const refresh = () => Promise.all([assessments.refresh(), purchases.refresh(), pending.refresh()])

  async function createPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const price = Number(unitPrice)
    setBusy(true)
    setError('')
    try {
      await api(`/quality-assessments/${selected.assessmentID}/purchases`, 'POST', {
        purchaseID: `PUR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        purchaseDate: today(),
        sellerCode: selected.assessmentBatch?.sellerCode,
        wasteType: selected.material?.materialName || selected.materialID,
        weight: selected.assessedQuantity,
        pricePerKg: price,
        totalAmount: selected.assessedQuantity * price,
        employeeID: workspace!.employeeId,
        materialID: selected.materialID,
      })
      await refresh()
      setSelectedID(null)
      setUnitPrice('')
      notify('สร้างรายการรับซื้อแล้ว')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  async function transfer(row: ScrapPurchase) {
    setBusy(true)
    setError('')
    try {
      await api(`/scrap-purchases/${encodeURIComponent(row.purchaseID)}/transfer`, 'POST', {
        quantity: row.weight,
        assessedBy: workspace!.employeeId,
        stockRouteType: row.assessmentID ? 'quality_assessment' : 'manual',
        materialID: row.materialID,
      })
      await refresh()
      notify('ส่งรายการไปรอรับเข้าคลังแล้ว')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  if (assessments.loading || purchases.loading || pending.loading) return <Loading />
  return (
    <div className="purchasing-page">
      <PageIntro
        eyebrow={roles.purchasing.english}
        title="รายการรับซื้อวัสดุ"
        description="สร้างรายการรับซื้อจากผลประเมินที่ผ่าน แล้วส่งต่อให้พนักงานคลังรับเข้า"
      >
        <RefreshButton
          onClick={() => void refresh()}
          busy={assessments.refreshing || purchases.refreshing}
        />
      </PageIntro>
      <ErrorBox message={error || assessments.error || purchases.error || pending.error} />
      <div className="workflow-strip purchasing-flow" aria-label="ขั้นตอนรับซื้อวัสดุ">
        <div className="done">
          <span>1</span>
          <div>
            <strong>ตรวจสอบผู้ขาย</strong>
            <small>ยืนยันสถานะผู้ขาย</small>
          </div>
        </div>
        <ArrowRight size={16} />
        <div className="active">
          <span>2</span>
          <div>
            <strong>กำหนดราคารับซื้อ</strong>
            <small>อ้างอิงผลประเมินคุณภาพ</small>
          </div>
        </div>
        <ArrowRight size={16} />
        <div>
          <span>3</span>
          <div>
            <strong>ส่งเข้าคลัง</strong>
            <small>รอพนักงานคลังรับเข้า</small>
          </div>
        </div>
      </div>
      <div className="purchase-metrics metrics">
        <Metric
          label="พร้อมรับซื้อ"
          value={number(eligible.length)}
          detail="ผลประเมินที่ผ่านเกณฑ์"
          icon={ClipboardCheck}
          tone="amber"
        />
        <Metric
          label="รายการรับซื้อ"
          value={number(purchases.data.length)}
          detail="รายการที่บันทึกแล้ว"
          icon={PackageCheck}
        />
        <Metric
          label="รอรับเข้าคลัง"
          value={number(
            pending.data.filter((row) => row.receivingStatus === 'waiting_receipt').length,
          )}
          detail="ส่งต่อให้คลังแล้ว"
          icon={Scale}
          tone="blue"
        />
        <Metric
          label="มูลค่ารวม"
          value={`฿${number(purchases.data.reduce((sum, row) => sum + row.totalAmount, 0))}`}
          detail="รวมรายการรับซื้อ"
          icon={BadgeDollarSign}
          tone="purple"
        />
      </div>
      <div className="operations-split purchase-workspace-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                <PackageCheck size={17} /> ผลประเมินที่พร้อมรับซื้อ
              </h2>
              <p>{eligible.length} รายการ</p>
            </div>
          </div>
          <div className="selection-list roomy">
            {eligible.map((row) => (
              <button
                key={row.assessmentID}
                className={selected?.assessmentID === row.assessmentID ? 'selected' : ''}
                aria-pressed={selected?.assessmentID === row.assessmentID}
                onClick={() => {
                  setSelectedID(row.assessmentID)
                  setUnitPrice('')
                }}
              >
                <span>
                  <strong>{row.material?.materialName || row.materialID}</strong>
                  <small>
                    QA-{row.assessmentID} · {row.assessmentBatch?.sellerCode || 'ไม่พบรหัสผู้ขาย'}
                  </small>
                </span>
                <b>{number(row.assessedQuantity)} กก.</b>
              </button>
            ))}
            {!eligible.length && (
              <Empty
                title="ไม่มีผลประเมินที่รอรับซื้อ"
                message="ผลที่ผ่านเกณฑ์และยังไม่สร้างรายการซื้อจะแสดงที่นี่"
              />
            )}
          </div>
        </section>
        <section className="panel operation-form-panel">
          <div className="panel-heading">
            <div>
              <h2>
                <BadgeDollarSign size={17} /> กำหนดราคารับซื้อ
              </h2>
              <p>
                {selected
                  ? `${selected.material?.materialName || selected.materialID} · ${number(selected.assessedQuantity)} กก.`
                  : 'เลือกผลประเมินด้านซ้าย'}
              </p>
            </div>
          </div>
          {selected ? (
            <form key={selected.assessmentID} className="operation-form" onSubmit={createPurchase}>
              <dl className="complaint-detail">
                <div>
                  <dt>ผู้ขาย</dt>
                  <dd>{selected.assessmentBatch?.sellerCode || '—'}</dd>
                </div>
                <div>
                  <dt>ผลประเมิน</dt>
                  <dd>
                    <Status value={selected.result} />
                  </dd>
                </div>
                <div>
                  <dt>เกรด</dt>
                  <dd>{selected.assessedGrade}</dd>
                </div>
                <div>
                  <dt>น้ำหนัก</dt>
                  <dd>{number(selected.assessedQuantity)} กก.</dd>
                </div>
              </dl>
              <label className="field">
                ราคาต่อกิโลกรัม (บาท)
                <input
                  name="pricePerKg"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <div className="purchase-total-preview">
                <span>
                  <Calculator size={17} /> ยอดรับซื้อโดยประมาณ
                </span>
                <strong>฿{number(selected.assessedQuantity * Number(unitPrice || 0))}</strong>
                <small>
                  {number(selected.assessedQuantity)} กก. × ฿{number(Number(unitPrice || 0))}
                </small>
              </div>
              <button
                className="button primary"
                disabled={busy || !selected.assessmentBatch?.sellerCode || Number(unitPrice) <= 0}
              >
                <BadgeDollarSign size={16} /> สร้างรายการรับซื้อ
              </button>
            </form>
          ) : (
            <Empty
              title="เลือกผลประเมิน"
              message="รายการที่เลือกจะแสดงรายละเอียดและช่องกำหนดราคา"
            />
          )}
        </section>
      </div>
      <section className="panel spaced purchase-history-panel">
        <div className="panel-heading">
          <div>
            <h2>รายการรับซื้อล่าสุด</h2>
            <p>ส่งเข้าคลังได้หนึ่งครั้งต่อรายการ</p>
          </div>
        </div>
        {!purchases.data.length ? (
          <Empty title="ยังไม่มีรายการรับซื้อ" message="สร้างรายการจากผลประเมินด้านบน" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>เลขรายการ / วัสดุ</th>
                  <th>วันที่</th>
                  <th>ผู้ขาย</th>
                  <th className="numeric">น้ำหนัก</th>
                  <th className="numeric">ยอดรวม</th>
                  <th>ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {purchases.data.map((row) => (
                  <tr key={row.purchaseID}>
                    <td>
                      <strong>{row.purchaseID}</strong>
                      <br />
                      <small>{row.material?.materialName || row.materialID}</small>
                    </td>
                    <td>{dateLabel(row.purchaseDate)}</td>
                    <td>{row.sellerCode}</td>
                    <td className="numeric">{number(row.weight)} กก.</td>
                    <td className="numeric">฿{number(row.totalAmount)}</td>
                    <td>
                      {pending.data.some((item) => item.purchaseID === row.purchaseID) ? (
                        <Status value="waiting_receipt" label="ส่งเข้าคลังแล้ว" />
                      ) : (
                        <button
                          className="button soft compact"
                          disabled={busy}
                          onClick={() => void transfer(row)}
                        >
                          ส่งเข้าคลัง <ArrowRight size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
