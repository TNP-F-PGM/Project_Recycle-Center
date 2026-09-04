import { useState } from 'react'
import { Building2, Package, Plus, Pencil, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LocationMap } from '../components/LocationMap'
import { coordinates } from '../utils/maps'
import type { Factory } from '../types'
import { useApp } from '../context/AppContext'
import { Empty, Modal, PageIntro, RefreshButton, SearchBox, Status } from '../components/ui'

export function ReferenceData({ kind }: { kind: 'factories' | 'materials' }) {
  const { data, refresh, refreshing, workspace } = useApp()
  const [selected, setSelected] = useState<Factory | null>(null)
  const canEdit = workspace?.role === 'sales'
  const [query, setQuery] = useState('')
  const factories = data.factories.filter((f) =>
    `${f.company_name} ${f.factory_id} ${f.contact_person}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  const materials = data.materials.filter((m) =>
    `${m.material_name} ${m.material_id} ${m.type_name}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  const isFactory = kind === 'factories'
  return (
    <>
      <PageIntro
        eyebrow="REFERENCE DATA"
        title={isFactory ? 'โรงงาน' : 'รายการวัสดุ'}
        description="ข้อมูลที่ใช้เลือกในคำขอซื้อ"
      >
        <RefreshButton onClick={() => void refresh()} busy={refreshing} />
        {isFactory && canEdit && (
          <Link className="button primary" to="/factories/new">
            <Plus size={16} />
            เพิ่มโรงงาน
          </Link>
        )}
      </PageIntro>
      <section className="panel">
        <div className="table-toolbar">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder={isFactory ? 'ค้นหาโรงงานหรือผู้ติดต่อ' : 'ค้นหาชื่อหรือรหัสวัสดุ'}
          />
        </div>
        {!(isFactory ? factories.length : materials.length) ? (
          <Empty
            title="ไม่พบข้อมูล"
            message={query ? 'ลองเปลี่ยนคำค้นหา' : 'ข้อมูลจะแสดงเมื่อมีการเพิ่มรายการในระบบ'}
          />
        ) : (
          <div className="table-scroll">
            {isFactory ? (
              <table>
                <thead>
                  <tr>
                    <th>โรงงาน</th>
                    <th>ผู้ติดต่อ</th>
                    <th>เบอร์โทรศัพท์</th>
                    <th>ที่อยู่</th>
                    <th>พิกัดโรงงาน</th>
                    {canEdit && <th>จัดการ</th>}
                  </tr>
                </thead>
                <tbody>
                  {factories.map((f) => (
                    <tr key={f.factory_id}>
                      <td>
                        <div className="row-identity">
                          <span className="row-avatar">
                            <Building2 size={18} />
                          </span>
                          <div className="stacked">
                            <strong>{f.company_name}</strong>
                            <small>{f.factory_id}</small>
                          </div>
                        </div>
                      </td>
                      <td>{f.contact_person || '—'}</td>
                      <td>{f.phone || '—'}</td>
                      <td className="address-cell">{f.address || '—'}</td>
                      <td>
                        {coordinates(f.latitude, f.longitude) ? (
                          <button className="button secondary" onClick={() => setSelected(f)}>
                            <MapPin size={15} />
                            ดูแผนที่
                          </button>
                        ) : (
                          <span className="muted">ยังไม่ได้ปักหมุด</span>
                        )}
                      </td>
                      {canEdit && (
                        <td>
                          <Link
                            className="button secondary"
                            to={`/factories/${encodeURIComponent(f.factory_id)}/edit`}
                          >
                            <Pencil size={15} />
                            แก้ไข
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>วัสดุ</th>
                    <th>ประเภท</th>
                    <th>หน่วย</th>
                    <th>เกรด</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.material_id}>
                      <td>
                        <div className="row-identity">
                          <span className="row-avatar">
                            <Package size={18} />
                          </span>
                          <div className="stacked">
                            <strong>{m.material_name}</strong>
                            <small>{m.material_id}</small>
                          </div>
                        </div>
                      </td>
                      <td>{m.type_name || '—'}</td>
                      <td>{m.unit}</td>
                      <td>{m.grade || '—'}</td>
                      <td>
                        <Status value={m.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
      {isFactory && selected && (
        <Modal title={selected.company_name} onClose={() => setSelected(null)} wide>
          <div className="modal-body">
            <p>{selected.address}</p>
            <LocationMap
              point={coordinates(selected.latitude, selected.longitude)}
              destinationName={selected.company_name}
            />
          </div>
        </Modal>
      )}
    </>
  )
}
