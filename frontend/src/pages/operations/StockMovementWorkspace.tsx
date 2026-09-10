import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Filter, PackageCheck, Search, SlidersHorizontal } from 'lucide-react'
import { Empty, ErrorBox, Loading, PageIntro, RefreshButton, Status } from '../../components/ui'
import { roles, useApp } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import { errorText } from '../../services/api'
import { operationsApi } from '../../services/operationsApi'
import type { EligibleStorageZone, PendingWarehouseItem, StockTransaction, StorageZone } from '../../types'
import { dateLabel, number, today } from '../../utils/format'
import { filterPendingItems, filterTransactions, validateIssueInput, validateReceiptInput } from '../../utils/operations'

type View = 'receipts' | 'issues' | 'history'

export function StockMovementWorkspace({ view }: { view: View }) {
  const { workspace, employee, notify } = useApp()
  const pending = useApiList<PendingWarehouseItem>('/pending-warehouse-items')
  const zones = useApiList<StorageZone>('/storage-zones')
  const transactions = useApiList<StockTransaction>('/stock-transactions?limit=100')
  const [selectedPending, setSelectedPending] = useState<number | null>(null)
  const [selectedZone, setSelectedZone] = useState('')
  const [receiveZoneID, setReceiveZoneID] = useState('')
  const [eligibleZones, setEligibleZones] = useState<EligibleStorageZone[]>([])
  const [loadingZones, setLoadingZones] = useState(false)
  const [receiptQuery, setReceiptQuery] = useState('')
  const [receiptStatus, setReceiptStatus] = useState('waiting_receipt')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const receiveRequestID = useRef(crypto.randomUUID())
  const issueRequestID = useRef(crypto.randomUUID())
  const refresh = () => Promise.all([pending.refresh(), zones.refresh(), transactions.refresh()])
  const receiptRows = useMemo(
    () => filterPendingItems(pending.data, { status: receiptStatus, query: receiptQuery }),
    [pending.data, receiptQuery, receiptStatus],
  )
  const item = receiptRows.find((row) => row.pendingID === selectedPending) || receiptRows[0]
  const receiveZone = eligibleZones.find((row) => row.zoneID === receiveZoneID) || eligibleZones[0]
  const zone = zones.data.find((row) => row.zoneID === selectedZone) || zones.data.find((row) => row.quantityOnHand > 0)

  useEffect(() => {
    if (!item || item.receivingStatus !== 'waiting_receipt') {
      setEligibleZones([])
      setReceiveZoneID('')
      return
    }
    let active = true
    setLoadingZones(true)
    operationsApi.listEligibleZones(item.pendingID)
      .then((rows) => {
        if (!active) return
        const zonesWithEnoughCapacity = rows.filter((row) => row.availableCapacity + 0.001 >= item.quantity)
        setEligibleZones(zonesWithEnoughCapacity)
        setReceiveZoneID((current) => zonesWithEnoughCapacity.some((row) => row.zoneID === current) ? current : zonesWithEnoughCapacity[0]?.zoneID || '')
      })
      .catch((cause) => {
        if (active) setError(errorText(cause))
      })
      .finally(() => {
        if (active) setLoadingZones(false)
      })
    return () => {
      active = false
    }
  }, [item?.pendingID, item?.receivingStatus])

  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (!item) return
    const quantity = Number(form.get('quantity'))
    const validation = validateReceiptInput({
      quantity,
      assessedQuantity: item.quantity,
      availableCapacity: receiveZone?.availableCapacity || 0,
    })
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    setError('')
    try {
      await operationsApi.receivePendingItem(item.pendingID, {
        receiveNo: '',
        zoneID: String(form.get('zoneID')),
        employeeID: employee?.user_id || workspace!.employeeId,
        quantity,
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
    const input = {
      quantity: Number(form.get('quantity')),
      balance: zone.quantityOnHand,
      referenceNo: String(form.get('referenceNo')),
      requestingUnit: String(form.get('requestingUnit')),
    }
    const validation = validateIssueInput(input)
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    setError('')
    try {
      await operationsApi.issueFromZone(zone.zoneID, {
        issueNo: '',
        referenceNo: input.referenceNo,
        requestingUnit: input.requestingUnit,
        employeeID: employee?.user_id || workspace!.employeeId,
        quantity: input.quantity,
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
    <div className="operations-workspace stock-movement-page">
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
                <p>{receiptRows.length} รายการตามตัวกรอง</p>
              </div>
            </div>
            <div className="movement-filters">
              <label className="input-with-icon">
                <Search size={15} />
                <input value={receiptQuery} onChange={(event) => setReceiptQuery(event.target.value)} placeholder="ค้นหาเลขรับซื้อหรือวัสดุ" />
              </label>
              <label>
                <Filter size={15} />
                <select value={receiptStatus} onChange={(event) => { setReceiptStatus(event.target.value); setSelectedPending(null) }}>
                  <option value="waiting_receipt">รอรับเข้า</option>
                  <option value="received">รับเข้าแล้ว</option>
                  <option value="all">ทั้งหมด</option>
                </select>
              </label>
            </div>
            <div className="selection-list roomy">
              {receiptRows.map((row) => (
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
                  <span className="receipt-row-tail"><b>{number(row.quantity)} กก.</b><Status value={row.receivingStatus} /></span>
                </button>
              ))}
              {!receiptRows.length && (
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
            {item && item.receivingStatus === 'waiting_receipt' ? (
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
                        {z.zoneName} · {z.warehouseID} · เหลือ {number(z.availableCapacity)} กก.
                      </option>
                    ))}
                  </select>
                </label>
                {loadingZones && <p className="field-hint">กำลังตรวจสอบพื้นที่ที่รองรับ…</p>}
                {!loadingZones && !eligibleZones.length && (
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
                      receiveZone?.availableCapacity || 0,
                    )}
                    step="0.01"
                    defaultValue={item.quantity}
                    required
                  />
                </label>
                {receiveZone && <div className="zone-capacity-preview"><span>ความจุคงเหลือของ {receiveZone.zoneName}</span><strong>{number(receiveZone.availableCapacity)} กก.</strong></div>}
                <button className="button primary" disabled={busy || loadingZones || !eligibleZones.length}>
                  <ArrowDownToLine size={16} /> ยืนยันรับเข้าคลัง
                </button>
              </form>
            ) : (
              <Empty title={item ? 'รายการนี้รับเข้าแล้ว' : 'ยังไม่มีงานรับเข้า'} message={item ? `จัดเก็บที่ ${item.receivedZoneID || 'พื้นที่ที่บันทึกไว้'}` : 'เมื่อมีวัสดุผ่านการประเมิน ระบบจะแสดงรายการที่นี่'} />
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
    </div>
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

  const [type, setType] = useState('all')
  const [query, setQuery] = useState('')
  const [date, setDate] = useState('')
  const filtered = useMemo(() => filterTransactions(rows, { type, query, date }), [rows, type, query, date])

  return (
    <div className="operations-workspace stock-history-page">
      <PageIntro
        eyebrow={roles[workspace!.role].english}
        title="ประวัติการเคลื่อนไหว"
        description="ตรวจสอบการรับเข้า เบิกจ่าย และปรับยอดย้อนหลัง"
      >
        <RefreshButton onClick={() => void refresh()} busy={refreshing} />
      </PageIntro>
      <ErrorBox message={error} />
      <section className="panel operation-toolbar transaction-toolbar">
        <label className="field search-field">ค้นหารายการ พื้นที่ หรือเลขอ้างอิง<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="เช่น TX-1 หรือ โซน A1" /></label>
        <label className="field">ประเภท<select value={type} onChange={(event) => setType(event.target.value)}><option value="all">ทั้งหมด</option><option value="receive">รับเข้า</option><option value="issue">เบิกจ่าย</option><option value="adjustment">ปรับยอด</option></select></label>
        <label className="field">วันที่<input type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value)} /></label>
        {(query || date || type !== 'all') && <button className="button secondary" onClick={() => { setQuery(''); setDate(''); setType('all') }}>ล้างตัวกรอง</button>}
      </section>
      <section className="panel">
        {!filtered.length ? (
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
                {filtered.map((row) => {
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
    </div>
  )
}
