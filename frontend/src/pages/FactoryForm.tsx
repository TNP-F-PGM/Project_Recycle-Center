import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Building2, MapPin, Save, CheckCircle2 } from 'lucide-react'
import { ErrorBox, Loading, PageIntro } from '../components/ui'
import { LocationMap } from '../components/LocationMap'
import { PlaceSearch } from '../components/PlaceSearch'
import { useApp } from '../context/AppContext'
import { useRecord } from '../hooks/useRecord'
import { api, errorText } from '../services/api'
import { coordinates } from '../utils/maps'
import type { Factory } from '../types'

export function FactoryFormPage() {
  const { id } = useParams()
  const { workspace } = useApp()
  if (workspace?.role !== 'sales') return <Navigate to="/factories" replace />
  return id ? <EditFactory id={id} /> : <FactoryForm />
}
function EditFactory({ id }: { id: string }) {
  const record = useRecord<Factory>(`/factories/${encodeURIComponent(id)}`)
  if (record.loading) return <Loading />
  if (!record.data) return <ErrorBox message={record.error} retry={record.reload} />
  return <FactoryForm key={id} factory={record.data} />
}
function FactoryForm({ factory }: { factory?: Factory }) {
  const navigate = useNavigate()
  const { refresh, notify } = useApp()
  const [latitude, setLatitude] = useState(
    factory?.latitude == null ? '' : String(factory.latitude),
  )
  const [longitude, setLongitude] = useState(
    factory?.longitude == null ? '' : String(factory.longitude),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pasted, setPasted] = useState('')
  const [confirmed, setConfirmed] = useState(
    Boolean(coordinates(factory?.latitude, factory?.longitude)),
  )
  const [selectedName, setSelectedName] = useState('')
  const point =
    latitude.trim() && longitude.trim() ? coordinates(Number(latitude), Number(longitude)) : null
  function pasteCoordinates() {
    const values = pasted.split(',').map((s) => s.trim())
    const p =
      values.length === 2 && values.every(Boolean)
        ? coordinates(Number(values[0]), Number(values[1]))
        : null
    if (!p) {
      setError('กรุณาวางพิกัดรูปแบบละติจูด, ลองจิจูด เช่น 13.7563, 100.5018')
      return
    }
    setLatitude(String(p.latitude))
    setLongitude(String(p.longitude))
    setConfirmed(false)
    setSelectedName('พิกัดที่กรอกเอง')
    setError('')
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (!point) {
      setError('กรุณาปักหมุดหรือกรอกพิกัดโรงงานให้ครบและอยู่ในช่วงที่ถูกต้อง')
      return
    }
    if (!confirmed) {
      setError('กรุณาตรวจหมุดบนแผนที่ แล้วกดยืนยันตำแหน่งนี้ก่อนบันทึก')
      return
    }
    const fields = new FormData(event.currentTarget)
    const payload = {
      company_name: String(fields.get('company_name')).trim(),
      contact_person: String(fields.get('contact_person')).trim(),
      phone: String(fields.get('phone')).trim(),
      address: String(fields.get('address')).trim(),
      ...point,
    }
    if (!payload.company_name || !payload.contact_person || !payload.phone || !payload.address) {
      setError('กรุณากรอกชื่อโรงงาน ผู้ติดต่อ เบอร์โทรศัพท์ และที่อยู่ให้ครบ')
      return
    }
    setError('')
    setBusy(true)
    try {
      await api(
        factory ? `/factories/${encodeURIComponent(factory.factory_id)}` : '/factories',
        factory ? 'PATCH' : 'POST',
        payload,
      )
      await refresh()
      notify(factory ? 'บันทึกข้อมูลและพิกัดโรงงานแล้ว' : 'เพิ่มโรงงานพร้อมพิกัดแล้ว')
      navigate('/factories')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageIntro
        eyebrow="FACTORY"
        title={factory ? 'แก้ไขโรงงาน' : 'เพิ่มโรงงานใหม่'}
        description="บันทึกที่อยู่และพิกัดครั้งเดียว เพื่อใช้กับคำขอซื้อครั้งต่อไป"
        back="/factories"
      />
      <form onSubmit={save}>
        <fieldset className="form-fieldset" disabled={busy}>
          <div className="factory-form-layout">
            <section className="panel form-panel">
              <h2>
                <Building2 size={19} />
                ข้อมูลโรงงาน
              </h2>
              <label className="field">
                ชื่อโรงงาน / บริษัท *
                <input
                  name="company_name"
                  required
                  maxLength={250}
                  defaultValue={factory?.company_name || ''}
                />
              </label>
              <div className="form-grid">
                <label className="field">
                  ผู้ติดต่อ *
                  <input
                    name="contact_person"
                    required
                    maxLength={150}
                    defaultValue={factory?.contact_person || ''}
                  />
                </label>
                <label className="field">
                  เบอร์โทรศัพท์ *
                  <input
                    name="phone"
                    type="tel"
                    required
                    maxLength={50}
                    defaultValue={factory?.phone || ''}
                  />
                </label>
              </div>
              <label className="field spaced">
                ที่อยู่โรงงาน *
                <textarea
                  name="address"
                  required
                  rows={4}
                  maxLength={1500}
                  defaultValue={factory?.address || ''}
                />
              </label>
              {factory && (
                <div className="summary-note">
                  การแก้โรงงานจะใช้กับคำขอใหม่ คำขอจัดส่งที่สร้างไว้แล้วจะเก็บที่อยู่และพิกัดเดิม
                </div>
              )}
              <ErrorBox message={error} />
              <div className="factory-form-actions">
                <button className="button primary" disabled={busy || !point || !confirmed}>
                  <Save size={16} />
                  {busy ? 'กำลังบันทึก…' : 'บันทึกโรงงาน'}
                </button>
                <Link
                  className="button secondary"
                  to="/factories"
                  onClick={(e) => {
                    if (busy) e.preventDefault()
                  }}
                >
                  กลับ
                </Link>
              </div>
              {!confirmed && <p className="hint">เลือกและยืนยันตำแหน่งโรงงานก่อนบันทึก</p>}
            </section>
            <section className="panel form-panel">
              <h2>
                <MapPin size={19} />
                พิกัดโรงงาน *
              </h2>
              <PlaceSearch
                onSelect={(place) => {
                  setLatitude(String(place.latitude))
                  setLongitude(String(place.longitude))
                  setSelectedName(place.name)
                  setConfirmed(false)
                  setError('')
                }}
              />
              <h3 className="spaced">2. ตรวจหมุดให้ตรงทางเข้าโรงงาน</h3>
              {selectedName && <p className="hint">สถานที่ที่เลือก: {selectedName}</p>}
              <LocationMap
                point={point}
                showCoordinates={false}
                onChange={(p) => {
                  setLatitude(String(p.latitude))
                  setLongitude(String(p.longitude))
                  setConfirmed(false)
                }}
              />
              <div className={`location-confirm ${confirmed ? 'confirmed' : ''}`}>
                <p>
                  {confirmed
                    ? 'ยืนยันตำแหน่งแล้ว พร้อมบันทึกโรงงาน'
                    : point
                      ? 'ลากหมุดให้ตรงจุดที่รถเข้ารับ–ส่งวัสดุ แล้วกดยืนยัน'
                      : 'ค้นหาสถานที่ด้านบน หรือคลิกแผนที่เพื่อเลือกตำแหน่ง'}
                </p>
                <button
                  type="button"
                  className={`button ${confirmed ? 'secondary' : 'primary'}`}
                  disabled={!point || confirmed}
                  onClick={() => {
                    setConfirmed(true)
                    setError('')
                  }}
                >
                  <CheckCircle2 size={17} />
                  {confirmed ? 'ยืนยันตำแหน่งแล้ว' : '3. ยืนยันตำแหน่งนี้'}
                </button>
              </div>
              <details className="coordinate-details">
                <summary>กรอกพิกัดเอง / วางพิกัดที่คัดลอกมา</summary>
                <div className="form-grid spaced">
                  <label className="field">
                    ละติจูด *
                    <input
                      aria-label="ละติจูดโรงงาน"
                      type="number"
                      min="-90"
                      max="90"
                      step="any"
                      value={latitude}
                      onChange={(e) => {
                        setLatitude(e.target.value)
                        setConfirmed(false)
                      }}
                      placeholder="13.7563"
                    />
                  </label>
                  <label className="field">
                    ลองจิจูด *
                    <input
                      aria-label="ลองจิจูดโรงงาน"
                      type="number"
                      min="-180"
                      max="180"
                      step="any"
                      value={longitude}
                      onChange={(e) => {
                        setLongitude(e.target.value)
                        setConfirmed(false)
                      }}
                      placeholder="100.5018"
                    />
                  </label>
                </div>
                <label className="field spaced">
                  ละติจูด, ลองจิจูด
                  <input
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    placeholder="13.7563, 100.5018"
                  />
                </label>
                <button className="button secondary" type="button" onClick={pasteCoordinates}>
                  ใช้พิกัดนี้
                </button>
              </details>
            </section>
          </div>
        </fieldset>
      </form>
    </>
  )
}
