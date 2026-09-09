import { useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, PackageCheck, SlidersHorizontal } from 'lucide-react'
import { Empty, ErrorBox, Loading, PageIntro, RefreshButton, Status } from '../../components/ui'
import { roles, useApp } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import { api, errorText } from '../../services/api'
import type { PendingWarehouseItem, StockTransaction, StorageZone } from '../../types'
import { dateLabel, number } from '../../utils/format'

type View = 'receipts' | 'issues' | 'history'

export function StockMovementWorkspace({ view }: { view: View }) {
  const { workspace, employee, notify } = useApp()
  const pending = useApiList<PendingWarehouseItem>('/pending-warehouse-items')
  const zones = useApiList<StorageZone>('/storage-zones')
  const transactions = useApiList<StockTransaction>('/stock-transactions?limit=100')
  const [selectedPending, setSelectedPending] = useState<number | null>(null)
  const [selectedZone, setSelectedZone] = useState('')
  const [receiveZoneID, setReceiveZoneID] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const receiveRequestID = useRef(crypto.randomUUID())
  const issueRequestID = useRef(crypto.randomUUID())
  const refresh = () => Promise.all([pending.refresh(), zones.refresh(), transactions.refresh()])
  const waiting = pending.data.filter((item) => item.receivingStatus === 'waiting_receipt')
  const item = waiting.find((row) => row.pendingID === selectedPending) || waiting[0]
  const eligibleZones = useMemo(
    () =>
      item
        ? zones.data.filter(
            (zone) =>
              zone.materialID === item.materialID &&
              zone.supportedGrade === item.assessedGrade &&
              zone.stockStatus === 'available' &&
              zone.capacity > zone.quantityOnHand,
          )
        : [],
    [item, zones.data],
  )
  const receiveZone = eligibleZones.find((row) => row.zoneID === receiveZoneID) || eligibleZones[0]
  const zone = zones.data.find((row) => row.zoneID === selectedZone) || zones.data[0]

  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (!item) return
    setBusy(true)
    setError('')
    try {
      await api(`/pending-warehouse-items/${item.pendingID}/receive`, 'POST', {
        zoneID: form.get('zoneID'),
        employeeID: employee?.user_id || workspace!.employeeId,
        quantity: Number(form.get('quantity')),
        requestID: receiveRequestID.current,
      })
      receiveRequestID.current = crypto.randomUUID()
      await refresh()
      setSelectedPending(null)
      notify('รับวัสดุเข้าคลังแล้ว')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }
  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = event.currentTarget
    const form = new FormData(target)
    if (!zone) return
    setBusy(true)
    setError('')
    try {
      await api(`/storage-zones/${encodeURIComponent(zone.zoneID)}/issues`, 'POST', {
        referenceNo: form.get('referenceNo'),
        requestingUnit: form.get('requestingUnit'),
        employeeID: employee?.user_id || workspace!.employeeId,
        quantity: Number(form.get('quantity')),
        requestID: issueRequestID.current,
      })
      issueRequestID.current = crypto.randomUUID()
      target.reset()
      await refresh()
      notify('บันทึกการเบิกจ่ายแล้ว')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }
  if (pending.loading || zones.loading || transactions.loading) return <Loading />
  if (view === 'history')
    return (
      <StockHistory
        rows={transactions.data}
        error={error || transactions.error}
        refreshing={transactions.refreshing}
        refresh={refresh}
      />
    )
  const receipt = view === 'receipts'
  return (
    <>
      <PageIntro
        eyebrow={roles.warehouse.english}
        title={receipt ? 'รับวัสดุเข้าคลัง' : 'เบิกจ่ายวัสดุ'}
        description={
          receipt
            ? 'ตรวจรายการที่ผ่านการประเมิน เลือกพื้นที่จัดเก็บ และยืนยันน้ำหนักจริง'
            : 'เลือกพื้นที่ ระบุหน่วยงานผู้ขอ และตัดยอดวัสดุออกจากคลัง'
        }
      >
        <RefreshButton
          onClick={() => void refresh()}
          busy={pending.refreshing || zones.refreshing || transactions.refreshing}
        />
      </PageIntro>
      <ErrorBox message={error || pending.error || zones.error} />
      {receipt ? (
        <div className="operations-split movement-layout">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  <ArrowDownToLine size={17} /> รายการรอรับเข้า
                </h2>
                <p>{waiting.length} รายการที่พร้อมจัดเก็บ</p>
              </div>
            </div>
            <div className="selection-list roomy">
              {waiting.map((row) => (
                <button
                  key={row.pendingID}
                  className={item?.pendingID === row.pendingID ? 'selected' : ''}
                  aria-pressed={item?.pendingID === row.pendingID}
                  onClick={() => setSelectedPending(row.pendingID)}
                >
                  <span>
                    <strong>{row.material?.materialName || row.materialID}</strong>
                    <small>
                      {row.purchaseID} · เกรด {row.assessedGrade}
                    </small>
                  </span>
                  <b>{number(row.quantity)} กก.</b>
                </button>
              ))}
              {!waiting.length && (
                <Empty
                  title="ไม่มีรายการรอรับเข้า"
                  message="รายการที่ฝ่ายคัดแยกส่งมาจะปรากฏที่นี่"
                />
              )}
            </div>
          </section>
          <section className="panel operation-form-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  <PackageCheck size={17} /> ยืนยันการรับเข้า
                </h2>
                <p>
                  {item
                    ? `${item.material?.materialName || item.materialID} · ไม่เกิน ${number(item.quantity)} กก.`
                    : 'เลือกรายการด้านซ้าย'}
                </p>
              </div>
            </div>
            {item ? (
              <form key={item.pendingID} className="operation-form" onSubmit={receive}>
                <label className="field">
                  พื้นที่จัดเก็บ
                  <select
                    name="zoneID"
                    value={receiveZone?.zoneID || ''}
                    onChange={(event) => setReceiveZoneID(event.target.value)}
                    required
                  >
                    {eligibleZones.map((z) => (
                      <option key={z.zoneID} value={z.zoneID}>
                        {z.zoneName} · เหลือ {number(z.capacity - z.quantityOnHand)} กก.
                      </option>
                    ))}
                  </select>
                </label>
                {!eligibleZones.length && (
                  <div className="warning-note">
                    ยังไม่มีพื้นที่ที่รองรับวัสดุและเกรดนี้ กรุณาให้หัวหน้าคลังเพิ่มโซนก่อน
                  </div>
                )}
                <label className="field">
                  น้ำหนักรับเข้าจริง (กก.)
                  <input
                    name="quantity"
                    type="number"
                    min="0.01"
                    max={Math.min(
                      item.quantity,
                      receiveZone?.capacity ? receiveZone.capacity - receiveZone.quantityOnHand : 0,
                    )}
                    step="0.01"
                    defaultValue={item.quantity}
                    required
                  />
                </label>
                <button className="button primary" disabled={busy || !eligibleZones.length}>
                  <ArrowDownToLine size={16} /> ยืนยันรับเข้าคลัง
                </button>
              </form>
            ) : (
              <Empty
                title="ยังไม่มีงานรับเข้า"
                message="เมื่อมีวัสดุผ่านการประเมิน ระบบจะแสดงรายการที่นี่"
              />
            )}
          </section>
        </div>
      ) : (
        <div className="operations-split movement-layout">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  <ArrowUpFromLine size={17} /> เลือกพื้นที่เบิกจ่าย
                </h2>
                <p>เลือกจากพื้นที่ที่มียอดคงเหลือ</p>
              </div>
            </div>
            <div className="selection-list roomy">
              {zones.data
                .filter((z) => z.quantityOnHand > 0)
                .map((row) => (
                  <button
                    key={row.zoneID}
                    className={zone?.zoneID === row.zoneID ? 'selected' : ''}
                    aria-pressed={zone?.zoneID === row.zoneID}
                    onClick={() => setSelectedZone(row.zoneID)}
                  >
                    <span>
                      <strong>{row.zoneName}</strong>
                      <small>
                        {row.material?.materialName || row.materialID} · {row.warehouseID}
                      </small>
                    </span>
                    <b>{number(row.quantityOnHand)} กก.</b>
                  </button>
                ))}
              {!zones.data.some((z) => z.quantityOnHand > 0) && (
                <Empty title="ยังไม่มีวัสดุในคลัง" message="รับวัสดุเข้าคลังก่อนเริ่มเบิกจ่าย" />
              )}
            </div>
          </section>
          <section className="panel operation-form-panel">
            <div className="panel-heading">
              <div>
                <h2>รายละเอียดการเบิก</h2>
                <p>
                  {zone
                    ? `${zone.zoneName} · คงเหลือ ${number(zone.quantityOnHand)} กก.`
                    : 'เลือกพื้นที่ด้านซ้าย'}
                </p>
              </div>
            </div>
            {zone && zone.quantityOnHand > 0 ? (
              <form key={zone.zoneID} className="operation-form" onSubmit={issue}>
                <label className="field">
                  เลขอ้างอิง
                  <input name="referenceNo" placeholder="เช่น SO-2026-001" required />
                </label>
                <label className="field">
                  หน่วยงานผู้ขอ
                  <input name="requestingUnit" placeholder="เช่น ฝ่ายขาย" required />
                </label>
                <label className="field">
                  จำนวนเบิก (กก.)
                  <input
                    name="quantity"
                    type="number"
                    min="0.01"
                    max={zone.quantityOnHand}
                    step="0.01"
                    required
                  />
                </label>
                <button className="button primary" disabled={busy}>
                  <ArrowUpFromLine size={16} /> ยืนยันเบิกจ่าย
                </button>
              </form>
            ) : (
              <Empty title="เลือกพื้นที่จัดเก็บ" message="เลือกโซนที่มียอดวัสดุจากรายการด้านซ้าย" />
            )}
          </section>
        </div>
      )}
    </>
  )
}

function StockHistory({
  rows,
  error,
  refreshing,
  refresh,
}: {
  rows: StockTransaction[]
  error: string
  refreshing: boolean
  refresh: () => Promise<unknown>
}) {
  const { workspace } = useApp()

  return (
    <>
      <PageIntro
        eyebrow={roles[workspace!.role].english}
        title="ประวัติการเคลื่อนไหว"
        description="ตรวจสอบการรับเข้า เบิกจ่าย และปรับยอดย้อนหลัง"
      >
        <RefreshButton onClick={() => void refresh()} busy={refreshing} />
      </PageIntro>
      <ErrorBox message={error} />
      <section className="panel">
        {!rows.length ? (
          <Empty title="ยังไม่มีการเคลื่อนไหว" message="รายการรับเข้าและเบิกจ่ายจะแสดงที่นี่" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>รายการ</th>
                  <th>วันที่</th>
                  <th>พื้นที่</th>
                  <th>ประเภท</th>
                  <th className="numeric">จำนวน</th>
                  <th className="numeric">ยอดหลังรายการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const issue = !!row.issueTransaction
                  const adjustment = !issue && !row.receiveTransaction
                  const outbound = row.quantity < 0
                  return (
                    <tr key={row.transactionID}>
                      <td>
                        <strong>TX-{row.transactionID}</strong>
                        <br />
                        <small>{row.employeeID}</small>
                      </td>
                      <td>{dateLabel(row.transactionDate)}</td>
                      <td>{row.zone?.zoneName || row.zoneID}</td>
                      <td>
                        <span className={`movement-type ${outbound ? 'out' : 'in'}`}>
                          {adjustment ? (
                            <SlidersHorizontal size={14} />
                          ) : outbound ? (
                            <ArrowUpFromLine size={14} />
                          ) : (
                            <ArrowDownToLine size={14} />
                          )}{' '}
                          {adjustment ? 'ปรับยอด' : issue ? 'เบิกจ่าย' : 'รับเข้า'}
                        </span>
                      </td>
                      <td className="numeric">
                        {outbound ? '-' : '+'}
                        {number(Math.abs(row.quantity))} กก.
                      </td>
                      <td className="numeric">
                        <strong>{number(row.balanceAfter)} กก.</strong>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
