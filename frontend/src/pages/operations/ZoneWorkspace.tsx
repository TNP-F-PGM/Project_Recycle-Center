import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Grid2x2, Layers, Pencil, Plus, Trash2, Warehouse as WarehouseIcon } from 'lucide-react'
import { Empty, ErrorBox, Loading, Modal, PageIntro, RefreshButton, Status } from '../../components/ui'
import { roles, useApp } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import { errorText } from '../../services/api'
import { operationsApi } from '../../services/operationsApi'
import type { InventoryMaterial, StorageZone, Warehouse } from '../../types'
import { number } from '../../utils/format'
import { capacityPercent, validateZoneUpdate } from '../../utils/operations'

type GroupMode = 'grade' | 'all'

export function ZoneWorkspace() {
  const { workspace, notify } = useApp()
  const warehouses = useApiList<Warehouse>('/warehouses')
  const zones = useApiList<StorageZone>('/storage-zones')
  const materials = useApiList<InventoryMaterial>('/inventory/materials')
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [groupMode, setGroupMode] = useState<GroupMode>('grade')
  const [showWarehouseModal, setShowWarehouseModal] = useState(false)
  const [showZoneModal, setShowZoneModal] = useState(false)
  const [editing, setEditing] = useState<StorageZone | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const warehouseRequestID = useRef(crypto.randomUUID())
  const zoneRequestID = useRef(crypto.randomUUID())

  const refresh = () => Promise.all([warehouses.refresh(), zones.refresh(), materials.refresh()])
  const filteredZones = useMemo(
    () => zones.data.filter((zone) => warehouseFilter === 'all' || zone.warehouseID === warehouseFilter),
    [warehouseFilter, zones.data],
  )
  const zonesByGrade = useMemo(
    () => ({
      A: filteredZones.filter((zone) => zone.supportedGrade === 'A'),
      B: filteredZones.filter((zone) => zone.supportedGrade === 'B'),
      C: filteredZones.filter((zone) => zone.supportedGrade === 'C'),
    }),
    [filteredZones],
  )
  const zonesByWarehouse = useMemo(
    () => warehouses.data
      .map((warehouse) => ({ warehouse, rows: filteredZones.filter((zone) => zone.warehouseID === warehouse.warehouseID) }))
      .filter(({ rows }) => rows.length),
    [filteredZones, warehouses.data],
  )

  async function createWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = event.currentTarget
    const form = new FormData(target)
    const totalCapacity = Number(form.get('totalCapacity'))
    const unit = String(form.get('unit') || 'kg').trim()
    if (!Number.isFinite(totalCapacity) || totalCapacity <= 0 || !unit) {
      setError('กรุณาระบุความจุและหน่วยให้ถูกต้อง')
      return
    }
    setBusy(true)
    setError('')
    try {
      await operationsApi.createWarehouse({
        totalCapacity,
        minStock: 0,
        unit,
        requestID: warehouseRequestID.current,
      })
      warehouseRequestID.current = crypto.randomUUID()
      target.reset()
      setShowWarehouseModal(false)
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
    const material = materials.data.find((row) => row.materialID === form.get('materialID'))
    const capacity = Number(form.get('capacity'))
    if (!material || !Number.isFinite(capacity) || capacity <= 0) {
      setError('กรุณาเลือกวัสดุและระบุความจุให้ถูกต้อง')
      return
    }
    setBusy(true)
    setError('')
    try {
      await operationsApi.createZone({
        zoneName: String(form.get('zoneName')).trim(),
        capacity,
        supportedGrade: String(form.get('grade')),
        stockStatus: 'available',
        warehouseID: String(form.get('warehouseID')),
        materialTypeID: material.materialTypeID,
        materialID: material.materialID,
        requestID: zoneRequestID.current,
      })
      zoneRequestID.current = crypto.randomUUID()
      target.reset()
      setShowZoneModal(false)
      await refresh()
      notify('เพิ่มโซนจัดเก็บแล้ว')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  async function updateZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const form = new FormData(event.currentTarget)
    const capacity = Number(form.get('capacity'))
    const validation = validateZoneUpdate({ capacity, quantityOnHand: editing.quantityOnHand })
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    setError('')
    try {
      await operationsApi.updateZone(editing.zoneID, {
        zoneName: String(form.get('zoneName')).trim(),
        capacity,
        supportedGrade: String(form.get('grade')),
        stockStatus: String(form.get('stockStatus')),
      })
      setEditing(null)
      await refresh()
      notify('แก้ไขโซนสำเร็จ')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  async function removeZone(zone: StorageZone) {
    if (zone.quantityOnHand > 0) {
      setError('ลบพื้นที่ที่ยังมียอดวัสดุไม่ได้')
      return
    }
    if (!window.confirm(`ยืนยันลบ ${zone.zoneName} (${zone.zoneID})?`)) return
    setBusy(true)
    setError('')
    try {
      await operationsApi.deleteZone(zone.zoneID)
      await refresh()
      notify('ลบโซนจัดเก็บแล้ว')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  if (warehouses.loading || zones.loading || materials.loading) return <Loading />

  return (
    <div className="operations-workspace zone-workspace zone-reference-exact">
      <PageIntro
        eyebrow={roles[workspace!.role].english}
        title="โซนจัดเก็บวัสดุ"
        description="ตรวจสอบพื้นที่ว่าง จัดการคลังสินค้า และเพิ่มโซนจัดเก็บจำแนกตามเกรดและประเภทวัสดุ"
      >
        <RefreshButton onClick={() => void refresh()} busy={warehouses.refreshing || zones.refreshing || materials.refreshing} />
        <button className="button secondary" onClick={() => { setShowWarehouseModal(true); setEditing(null); setError('') }}>
          <WarehouseIcon size={16} /> เพิ่มคลังสินค้า
        </button>
        <button className="button primary" onClick={() => { setShowZoneModal(true); setEditing(null); setError('') }}>
          <Plus size={16} /> เพิ่มโซนจัดเก็บ
        </button>
      </PageIntro>

      <ErrorBox message={error || warehouses.error || zones.error || materials.error} />

      <section className="panel zone-reference-filter-card">
        <div className="zone-reference-filter-left">
          <span>กรองตามคลัง:</span>
          <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)}>
            <option value="all">ทุกคลังสินค้า</option>
            {warehouses.data.map((warehouse) => (
              <option key={warehouse.warehouseID} value={warehouse.warehouseID}>{warehouse.warehouseID}</option>
            ))}
          </select>
        </div>
        <div className="zone-reference-filter-right">
          <span>มุมมองการจัดกลุ่ม:</span>
          <button className={`button small ${groupMode === 'grade' ? 'primary' : 'secondary'}`} onClick={() => setGroupMode('grade')}>
            <Layers size={14} /> ตามเกรดคุณภาพ
          </button>
          <button className={`button small ${groupMode === 'all' ? 'primary' : 'secondary'}`} onClick={() => setGroupMode('all')}>
            <Grid2x2 size={14} /> โซนทั้งหมด
          </button>
        </div>
      </section>

      {!filteredZones.length ? (
        <section className="panel"><Empty title="ไม่พบโซนจัดเก็บในคลังที่เลือก" message="เพิ่มโซนใหม่หรือเปลี่ยนตัวกรองคลัง" /></section>
      ) : groupMode === 'grade' ? (
        <div className="zone-reference-groups">
          {(['A', 'B', 'C'] as const).map((grade) => {
            const rows = zonesByGrade[grade]
            if (!rows.length) return null
            return (
              <section className="zone-reference-grade-section" key={grade}>
                <div className="zone-reference-section-heading">
                  <span className={`zone-reference-grade-badge grade-${grade.toLowerCase()}`}>เกรด {grade}</span>
                  <h2>โซนสำหรับวัสดุเกรด {grade}</h2>
                  <span className="zone-reference-count">{rows.length} โซน</span>
                </div>
                <div className="zone-reference-card-grid">{rows.map((zone) => <ZoneCard key={zone.zoneID} zone={zone} busy={busy} onEdit={setEditing} onRemove={removeZone} />)}</div>
              </section>
            )
          })}
        </div>
      ) : (
        <div className="zone-reference-groups">
          {zonesByWarehouse.map(({ warehouse, rows }) => {
            const percent = capacityPercent(warehouse.currentQuantity, warehouse.totalCapacity)
            return (
              <section className="zone-reference-warehouse-section" key={warehouse.warehouseID}>
                <div className="zone-reference-warehouse-heading">
                  <span className="zone-reference-warehouse-icon"><WarehouseIcon size={20} /></span>
                  <div>
                    <h2>คลังสินค้า {warehouse.warehouseID}</h2>
                    <p>ความจุรวม {number(warehouse.totalCapacity)} {warehouse.unit} · ใช้ไปแล้ว {number(warehouse.currentQuantity)} {warehouse.unit} ({number(percent)}%)</p>
                  </div>
                  <span className="zone-reference-count">{rows.length} โซนจัดเก็บ</span>
                </div>
                <div className="zone-reference-card-grid">{rows.map((zone) => <ZoneCard key={zone.zoneID} zone={zone} busy={busy} onEdit={setEditing} onRemove={removeZone} />)}</div>
              </section>
            )
          })}
        </div>
      )}

      {showWarehouseModal && (
        <Modal title="เพิ่มคลังสินค้าใหม่" onClose={() => setShowWarehouseModal(false)} busy={busy}>
          <form className="modal-body zone-reference-modal-form" onSubmit={createWarehouse}>
            <p>ระบุความจุและหน่วย ระบบจะสร้างรหัสคลังสินค้าตาม backend เดิมของระบบ</p>
            <label className="field">ความจุรวมของคลัง<input name="totalCapacity" type="number" min="0.01" step="0.01" placeholder="เช่น 5000" required /></label>
            <label className="field">หน่วย<input name="unit" defaultValue="kg" required /></label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setShowWarehouseModal(false)}>ยกเลิก</button>
              <button className="button primary" disabled={busy}>บันทึกคลังสินค้า</button>
            </div>
          </form>
        </Modal>
      )}

      {showZoneModal && (
        <Modal title="เพิ่มโซนจัดเก็บใหม่" onClose={() => setShowZoneModal(false)} busy={busy} wide>
          <form className="modal-body zone-reference-modal-form" onSubmit={createZone}>
            <p>สร้างโซนใหม่ พร้อมกำหนดสังกัดคลัง เกรดวัสดุ ประเภท และความจุสูงสุด</p>
            <div className="form-grid">
              <label className="field">สังกัดคลังสินค้า<select name="warehouseID" required>{warehouses.data.map((warehouse) => <option key={warehouse.warehouseID} value={warehouse.warehouseID}>{warehouse.warehouseID}</option>)}</select></label>
              <label className="field">ชื่อโซนจัดเก็บ<input name="zoneName" placeholder="เช่น โซน A3 (เกรด A)" required /></label>
              <label className="field">เกรดวัสดุที่รองรับ<select name="grade" defaultValue="A"><option>A</option><option>B</option><option>C</option></select></label>
              <label className="field">วัสดุประจำโซน<select name="materialID" required>{materials.data.map((material) => <option key={material.materialID} value={material.materialID}>{material.materialID} · {material.materialName} ({material.unit})</option>)}</select></label>
              <label className="field span-2">ความจุสูงสุด (กก.)<input name="capacity" type="number" min="0.01" step="0.01" placeholder="เช่น 5000" required /></label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setShowZoneModal(false)}>ยกเลิก</button>
              <button className="button primary" disabled={busy}>บันทึกโซนจัดเก็บ</button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title="แก้ไขโซนจัดเก็บ" onClose={() => setEditing(null)} busy={busy} wide>
          <form className="modal-body zone-reference-modal-form" onSubmit={updateZone}>
            <p>{editing.zoneID} · {editing.warehouseID} · วัสดุ {editing.material?.materialName || editing.materialID}</p>
            <div className="form-grid">
              <label className="field">ชื่อโซนจัดเก็บ<input name="zoneName" defaultValue={editing.zoneName} required /></label>
              <label className="field">เกรดวัสดุที่รองรับ<select name="grade" defaultValue={editing.supportedGrade}><option>A</option><option>B</option><option>C</option></select></label>
              <label className="field">ความจุสูงสุด (กก.)<input name="capacity" type="number" min={editing.quantityOnHand || 0.01} step="0.01" defaultValue={editing.capacity} required /></label>
              <label className="field">สถานะ<select name="stockStatus" defaultValue={editing.stockStatus}><option value="available">พร้อมใช้งาน</option><option value="inactive">ปิดใช้งาน</option><option value="maintenance">ปรับปรุง</option></select></label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setEditing(null)}>ยกเลิก</button>
              <button className="button primary" disabled={busy}>บันทึกการแก้ไข</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function ZoneCard({
  zone,
  busy,
  onEdit,
  onRemove,
}: {
  zone: StorageZone
  busy: boolean
  onEdit: (zone: StorageZone) => void
  onRemove: (zone: StorageZone) => Promise<void>
}) {
  const percent = capacityPercent(zone.quantityOnHand, zone.capacity)
  const available = Math.max(0, zone.capacity - zone.quantityOnHand)
  const tone = percent >= 85 ? 'danger' : percent >= 65 ? 'warning' : 'safe'
  return (
    <article className="zone-reference-card">
      <div className="zone-reference-card-header">
        <div>
          <h3>{zone.zoneName}</h3>
          <div className="zone-reference-card-meta"><span>{zone.warehouseID}</span><small>{zone.zoneID}</small></div>
        </div>
        <span className={`zone-reference-percent ${tone}`}>{number(percent)}%</span>
      </div>

      <dl className="zone-reference-material-info">
        <div><dt>วัสดุที่จัดเก็บ</dt><dd>{zone.material?.materialName || zone.materialID}{zone.material?.materialName ? <small> ({zone.materialID})</small> : null}</dd></div>
        <div><dt>ประเภทวัสดุ</dt><dd>{zone.material?.materialType?.typeName || `ประเภท ${zone.materialTypeID}`}</dd></div>
      </dl>

      <div className={`zone-reference-progress ${tone}`}><i style={{ width: `${percent}%` }} /></div>

      <div className="zone-reference-capacity-stats">
        <div><p>ความจุรวม</p><strong>{number(zone.capacity)}</strong><small>กก.</small></div>
        <div><p>ใช้ไปแล้ว</p><strong>{number(zone.quantityOnHand)}</strong><small>กก.</small></div>
        <div><p>ว่างคงเหลือ</p><strong>{number(available)}</strong><small>กก.</small></div>
      </div>

      <div className="zone-reference-card-footer">
        <div><span className={`zone-reference-grade-badge grade-${zone.supportedGrade.toLowerCase()}`}>เกรด {zone.supportedGrade}</span><Status value={zone.stockStatus} /></div>
        <div className="zone-reference-card-actions">
          <button className="button secondary small" onClick={() => onEdit(zone)}><Pencil size={13} /> แก้ไขโซน</button>
          <button className="button danger-outline small" disabled={busy || zone.quantityOnHand > 0} onClick={() => void onRemove(zone)} title={zone.quantityOnHand > 0 ? 'ย้ายวัสดุออกก่อนลบโซน' : undefined}><Trash2 size={13} /> ลบ</button>
        </div>
      </div>
    </article>
  )
}
