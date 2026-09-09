import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Boxes, Plus, Warehouse as WarehouseIcon } from 'lucide-react'
import { Empty, ErrorBox, Loading, PageIntro, RefreshButton, Status } from '../../components/ui'
import { roles, useApp } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import { api, errorText } from '../../services/api'
import type { InventoryMaterial, StorageZone, Warehouse } from '../../types'
import { number } from '../../utils/format'

export function InventoryWorkspace() {
  const { workspace, notify } = useApp()
  const warehouses = useApiList<Warehouse>('/warehouses')
  const zones = useApiList<StorageZone>('/storage-zones')
  const materials = useApiList<InventoryMaterial>('/inventory/materials')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showCreate, setShowCreate] = useState<'warehouse' | 'zone' | ''>('')
  const warehouseRequestID = useRef(crypto.randomUUID())
  const zoneRequestID = useRef(crypto.randomUUID())
  const canManage = workspace?.role === 'warehouse_manager'
  const refresh = () => Promise.all([warehouses.refresh(), zones.refresh(), materials.refresh()])
  const totalCapacity = warehouses.data.reduce((sum, row) => sum + row.totalCapacity, 0)
  const totalStock = warehouses.data.reduce((sum, row) => sum + row.currentQuantity, 0)
  const grouped = useMemo(
    () =>
      warehouses.data.map((warehouse) => ({
        warehouse,
        zones: zones.data.filter((zone) => zone.warehouseID === warehouse.warehouseID),
      })),
    [warehouses.data, zones.data],
  )

  async function createWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = event.currentTarget
    const form = new FormData(target)
    setBusy(true)
    setError('')
    try {
      await api('/warehouses', 'POST', {
        totalCapacity: Number(form.get('capacity')),
        minStock: Number(form.get('minStock')),
        unit: 'kg',
        requestID: warehouseRequestID.current,
      })
      warehouseRequestID.current = crypto.randomUUID()
      target.reset()
      setShowCreate('')
      await refresh()
      notify('เพิ่มคลังสินค้าแล้ว')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }
  async function createZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = event.currentTarget
    const form = new FormData(target)
    const material = materials.data.find((m) => m.materialID === form.get('materialID'))
    setBusy(true)
    setError('')
    try {
      await api('/storage-zones', 'POST', {
        zoneName: form.get('zoneName'),
        capacity: Number(form.get('capacity')),
        supportedGrade: form.get('grade'),
        stockStatus: 'available',
        warehouseID: form.get('warehouseID'),
        materialTypeID: material?.materialTypeID,
        materialID: material?.materialID,
        requestID: zoneRequestID.current,
      })
      zoneRequestID.current = crypto.randomUUID()
      target.reset()
      setShowCreate('')
      await refresh()
      notify('เพิ่มพื้นที่จัดเก็บแล้ว')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }
  if (warehouses.loading || zones.loading || materials.loading) return <Loading />
  return (
    <>
      <PageIntro
        eyebrow={roles[workspace!.role].english}
        title="คลังวัสดุ"
        description="ดูยอดคงเหลือ ความจุ และตำแหน่งจัดเก็บของวัสดุแต่ละชนิด"
      >
        <RefreshButton
          onClick={() => void refresh()}
          busy={warehouses.refreshing || zones.refreshing || materials.refreshing}
        />
        {canManage && (
          <>
            <button
              className="button secondary"
              onClick={() => setShowCreate(showCreate === 'warehouse' ? '' : 'warehouse')}
            >
              <Plus size={16} /> เพิ่มคลัง
            </button>
            <button
              className="button primary"
              onClick={() => setShowCreate(showCreate === 'zone' ? '' : 'zone')}
            >
              <Plus size={16} /> เพิ่มโซน
            </button>
          </>
        )}
      </PageIntro>
      <ErrorBox message={error || warehouses.error || zones.error || materials.error} />
      {showCreate === 'warehouse' && (
        <section className="panel inline-create">
          <div>
            <h2>เพิ่มคลังสินค้า</h2>
            <p>กำหนดความจุรวมก่อนสร้างโซนภายในคลัง</p>
          </div>
          <form onSubmit={createWarehouse}>
            <label className="field">
              ความจุรวม (กก.)
              <input name="capacity" type="number" min="0" step="0.01" required />
            </label>
            <label className="field">
              จุดแจ้งเตือนขั้นต่ำ (กก.)
              <input name="minStock" type="number" min="0" step="0.01" defaultValue="0" required />
            </label>
            <button className="button primary" disabled={busy}>
              บันทึกคลัง
            </button>
          </form>
        </section>
      )}
      {showCreate === 'zone' && (
        <section className="panel inline-create">
          <div>
            <h2>เพิ่มพื้นที่จัดเก็บ</h2>
            <p>หนึ่งโซนเก็บวัสดุหนึ่งชนิดและหนึ่งเกรด</p>
          </div>
          <form onSubmit={createZone}>
            <label className="field">
              คลัง
              <select name="warehouseID" required>
                {warehouses.data.map((w) => (
                  <option key={w.warehouseID} value={w.warehouseID}>
                    {w.warehouseID}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              ชื่อโซน
              <input name="zoneName" placeholder="เช่น โซน A1" required />
            </label>
            <label className="field">
              วัสดุ
              <select name="materialID" required>
                {materials.data.map((m) => (
                  <option key={m.materialID} value={m.materialID}>
                    {m.materialName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              เกรด
              <select name="grade">
                <option>A</option>
                <option>B</option>
                <option>C</option>
              </select>
            </label>
            <label className="field">
              ความจุ (กก.)
              <input name="capacity" type="number" min="0.01" step="0.01" required />
            </label>
            <button className="button primary" disabled={busy}>
              บันทึกโซน
            </button>
          </form>
        </section>
      )}
      <div className="metrics three">
        <div className="metric">
          <span className="metric-icon green">
            <Boxes size={21} />
          </span>
          <div>
            <p>วัสดุคงเหลือรวม</p>
            <strong>{number(totalStock)} กก.</strong>
            <small>จากทุกคลัง</small>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon blue">
            <WarehouseIcon size={21} />
          </span>
          <div>
            <p>ความจุรวม</p>
            <strong>{number(totalCapacity)} กก.</strong>
            <small>เหลือ {number(Math.max(0, totalCapacity - totalStock))} กก.</small>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon amber">
            <WarehouseIcon size={21} />
          </span>
          <div>
            <p>พื้นที่จัดเก็บ</p>
            <strong>{number(zones.data.length)}</strong>
            <small>
              {zones.data.filter((z) => z.stockStatus === 'available').length} พื้นที่พร้อมใช้
            </small>
          </div>
        </div>
      </div>
      {!grouped.length ? (
        <section className="panel">
          <Empty
            title="ยังไม่มีคลังสินค้า"
            message="หัวหน้าคลังสามารถเพิ่มคลังและพื้นที่จัดเก็บได้จากหน้านี้"
          />
        </section>
      ) : (
        <div className="warehouse-grid">
          {grouped.map(({ warehouse, zones: rows }) => {
            const percent = warehouse.totalCapacity
              ? Math.min(100, (warehouse.currentQuantity / warehouse.totalCapacity) * 100)
              : 0
            return (
              <section className="panel warehouse-card" key={warehouse.warehouseID}>
                <div className="warehouse-card-head">
                  <span className="metric-icon green">
                    <WarehouseIcon size={21} />
                  </span>
                  <div>
                    <h2>{warehouse.warehouseID}</h2>
                    <p>
                      {number(warehouse.currentQuantity)} / {number(warehouse.totalCapacity)}{' '}
                      {warehouse.unit}
                    </p>
                  </div>
                  <strong>{number(percent)}%</strong>
                </div>
                <div className="capacity-bar large">
                  <i style={{ width: `${percent}%` }} />
                </div>
                <div className="zone-list">
                  {rows.map((zone) => (
                    <article key={zone.zoneID}>
                      <span>
                        <strong>{zone.zoneName}</strong>
                        <small>
                          {zone.material?.materialName || zone.materialID} · เกรด{' '}
                          {zone.supportedGrade}
                        </small>
                      </span>
                      <span className="numeric">
                        <strong>
                          {number(zone.quantityOnHand)} / {number(zone.capacity)}
                        </strong>
                        <Status value={zone.stockStatus} />
                      </span>
                    </article>
                  ))}
                  {!rows.length && <p className="list-empty">ยังไม่มีโซนในคลังนี้</p>}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
