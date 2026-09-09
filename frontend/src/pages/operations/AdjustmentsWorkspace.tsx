import { useState, type FormEvent } from 'react'
import { Check, ClipboardCheck, Scale, X } from 'lucide-react'
import { Empty, ErrorBox, Loading, PageIntro, RefreshButton, Status } from '../../components/ui'
import { roles, useApp } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import { api, errorText } from '../../services/api'
import type { StockAdjustment, StorageZone } from '../../types'
import { dateLabel, number } from '../../utils/format'

export function AdjustmentsWorkspace() {
  const { workspace, employee, notify } = useApp()
  const adjustments = useApiList<StockAdjustment>('/stock-adjustments?limit=100')
  const zones = useApiList<StorageZone>('/storage-zones')
  const [selected, setSelected] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const manager = workspace?.role === 'warehouse_manager'
  const row =
    adjustments.data.find((item) => item.requestNo === selected) ||
    adjustments.data.find((item) => item.status === 'pending')
  const refresh = () => Promise.all([adjustments.refresh(), zones.refresh()])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = event.currentTarget
    const form = new FormData(target)
    const zoneID = String(form.get('zoneID'))
    setBusy(true)
    setError('')
    try {
      await api(`/storage-zones/${encodeURIComponent(zoneID)}/adjustments`, 'POST', {
        countedQuantity: Number(form.get('countedQuantity')),
        description: form.get('description'),
        employeeID: employee?.user_id || workspace!.employeeId,
      })
      target.reset()
      await refresh()
      notify('ส่งคำขอปรับยอดให้หัวหน้าคลังแล้ว')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }
  async function decide(decision: 'approved' | 'rejected', form: HTMLFormElement) {
    if (!row) return
    const data = new FormData(form)
    setError('')
    const approvedText = String(data.get('approvedQuantity') || '').trim()
    const reason = String(data.get('reason') || '').trim()
    if (decision === 'approved' && (approvedText === '' || Number(approvedText) < 0)) {
      setError('กรุณาระบุยอดที่อนุมัติให้ถูกต้อง')
      return
    }
    if (decision === 'rejected' && !reason) {
      setError('กรุณาระบุเหตุผลที่ไม่อนุมัติ')
      return
    }
    setBusy(true)
    try {
      await api(`/stock-adjustments/${row.requestNo}/decision`, 'POST', {
        employeeID: employee?.user_id || workspace!.employeeId,
        decision,
        approvedQuantity: decision === 'approved' ? Number(approvedText) : undefined,
        decisionReason: reason || null,
      })
      await refresh()
      setSelected(null)
      notify(decision === 'approved' ? 'อนุมัติและปรับยอดแล้ว' : 'ปฏิเสธคำขอแล้ว')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }
  if (adjustments.loading || zones.loading) return <Loading />
  return (
    <>
      <PageIntro
        eyebrow={roles[workspace!.role].english}
        title={manager ? 'อนุมัติการปรับยอด' : 'ตรวจนับและปรับยอด'}
        description={
          manager
            ? 'ตรวจผลต่าง เหตุผล และกำหนดยอดที่อนุมัติก่อนแก้ไขสต็อก'
            : 'เมื่อยอดนับจริงไม่ตรงกับระบบ ให้ส่งคำขอพร้อมเหตุผลเพื่อรออนุมัติ'
        }
      >
        <RefreshButton
          onClick={() => void refresh()}
          busy={adjustments.refreshing || zones.refreshing}
        />
      </PageIntro>
      <ErrorBox message={error || adjustments.error || zones.error} />
      {!manager && (
        <section className="panel inline-create adjustment-create">
          <div>
            <span className="metric-icon amber">
              <Scale size={21} />
            </span>
            <div>
              <h2>สร้างคำขอจากผลตรวจนับ</h2>
              <p>ระบบจะเก็บยอดเดิมไว้เพื่อให้หัวหน้าคลังตรวจสอบ</p>
            </div>
          </div>
          <form onSubmit={create}>
            <label className="field">
              พื้นที่จัดเก็บ
              <select name="zoneID" required>
                {zones.data.map((z) => (
                  <option key={z.zoneID} value={z.zoneID}>
                    {z.zoneName} · ในระบบ {number(z.quantityOnHand)} กก.
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              ยอดนับจริง (กก.)
              <input name="countedQuantity" type="number" min="0" step="0.01" required />
            </label>
            <label className="field wide-field">
              สาเหตุที่ยอดไม่ตรง
              <input name="description" placeholder="เช่น ตรวจนับประจำเดือนพบยอดขาด" required />
            </label>
            <button className="button primary" disabled={busy}>
              ส่งคำขอ
            </button>
          </form>
        </section>
      )}
      <div className={manager ? 'operations-split adjustment-layout' : ''}>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                <ClipboardCheck size={17} /> รายการปรับยอด
              </h2>
              <p>
                {adjustments.data.filter((item) => item.status === 'pending').length}{' '}
                รายการรอดำเนินการ
              </p>
            </div>
          </div>
          {!adjustments.data.length ? (
            <Empty title="ยังไม่มีคำขอปรับยอด" message="คำขอจากพนักงานคลังจะแสดงที่นี่" />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>เลขที่ / พื้นที่</th>
                    <th>วันที่</th>
                    <th className="numeric">ยอดระบบ</th>
                    <th className="numeric">ยอดนับจริง</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.data.map((item) => (
                    <tr
                      key={item.requestNo}
                      className={row?.requestNo === item.requestNo ? 'selected-row' : ''}
                    >
                      <td>
                        {manager ? (
                          <button
                            type="button"
                            className="table-record-button"
                            aria-pressed={row?.requestNo === item.requestNo}
                            onClick={() => setSelected(item.requestNo)}
                          >
                            <strong>ADJ-{item.requestNo}</strong>
                            <small>{item.zone?.zoneName || item.zoneID}</small>
                          </button>
                        ) : (
                          <>
                            <strong>ADJ-{item.requestNo}</strong>
                            <br />
                            <small>{item.zone?.zoneName || item.zoneID}</small>
                          </>
                        )}
                      </td>
                      <td>{dateLabel(item.requestDate)}</td>
                      <td className="numeric">{number(item.systemQuantity)}</td>
                      <td className="numeric">
                        <strong>{number(item.countedQuantity)}</strong>
                      </td>
                      <td>
                        <Status
                          value={item.status}
                          label={item.status === 'pending' ? 'รออนุมัติ' : undefined}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {manager && (
          <section className="panel operation-form-panel decision-panel">
            <div className="panel-heading">
              <div>
                <h2>ผลการพิจารณา</h2>
                <p>{row ? `คำขอ ADJ-${row.requestNo}` : 'เลือกคำขอจากตาราง'}</p>
              </div>
            </div>
            {row && row.status === 'pending' ? (
              <form
                key={row.requestNo}
                className="operation-form"
                onSubmit={(e) => e.preventDefault()}
              >
                <div className="comparison-box">
                  <div>
                    <small>ยอดในระบบ</small>
                    <strong>{number(row.systemQuantity)} กก.</strong>
                  </div>
                  <div>
                    <small>ยอดนับจริง</small>
                    <strong>{number(row.countedQuantity)} กก.</strong>
                  </div>
                  <div>
                    <small>ผลต่าง</small>
                    <strong
                      className={
                        row.countedQuantity - row.systemQuantity < 0 ? 'negative' : 'positive'
                      }
                    >
                      {number(row.countedQuantity - row.systemQuantity)} กก.
                    </strong>
                  </div>
                </div>
                <p className="reason-box">{row.description}</p>
                <label className="field">
                  ยอดที่อนุมัติ (กก.)
                  <input
                    name="approvedQuantity"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={row.countedQuantity}
                  />
                </label>
                <label className="field">
                  หมายเหตุการพิจารณา
                  <textarea name="reason" rows={3} />
                </label>
                <div className="form-actions">
                  <button
                    className="button primary"
                    type="button"
                    disabled={busy}
                    onClick={(e) => void decide('approved', e.currentTarget.form!)}
                  >
                    <Check size={16} /> อนุมัติ
                  </button>
                  <button
                    className="button danger"
                    type="button"
                    disabled={busy}
                    onClick={(e) => void decide('rejected', e.currentTarget.form!)}
                  >
                    <X size={16} /> ไม่อนุมัติ
                  </button>
                </div>
              </form>
            ) : (
              <Empty
                title={row ? 'รายการนี้พิจารณาแล้ว' : 'เลือกคำขอ'}
                message={
                  row ? 'ดูสถานะได้จากตารางด้านซ้าย' : 'คลิกคำขอที่รออนุมัติเพื่อดูรายละเอียด'
                }
              />
            )}
          </section>
        )}
      </div>
    </>
  )
}
