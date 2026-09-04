import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerImage from 'leaflet/dist/images/marker-icon.png'
import markerRetina from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { ArrowUpRight, LocateFixed, MapPin, Maximize2, Navigation, X } from 'lucide-react'
import { coordinates, directionsURL, type Coordinates } from '../utils/maps'

const markerIcon = L.icon({
  iconUrl: markerImage,
  iconRetinaUrl: markerRetina,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
})

interface MapProps {
  point: Coordinates | null
  onChange?: (point: Coordinates) => void
  label?: string
  showCoordinates?: boolean
  destinationName?: string
}

export function LocationMap(props: MapProps) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <MapPanel {...props} onExpand={() => setExpanded(true)} />
      {expanded && <ExpandedMap {...props} onClose={() => setExpanded(false)} />}
    </>
  )
}

function ExpandedMap({ onClose, ...props }: MapProps & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = overflow
    }
  }, [])
  return createPortal(
    <dialog
      ref={dialog}
      className="map-expanded"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <header className="map-expanded-header">
        <div>
          <small>{props.onChange ? 'เลือกตำแหน่ง' : 'ปลายทางของคุณ'}</small>
          <h2 id={titleId}>{props.destinationName || props.label || 'ตำแหน่งโรงงาน'}</h2>
        </div>
        <button type="button" className="button secondary" onClick={onClose}>
          <X size={18} />
          {props.onChange ? 'กลับไปยืนยันตำแหน่ง' : 'ปิดแผนที่เต็มจอ'}
        </button>
      </header>
      <MapPanel {...props} />
    </dialog>,
    document.body,
  )
}

// OSM tiles use ordinary browser caching; there is no offline/bulk download.
function MapPanel({
  point,
  onChange,
  label = 'ตำแหน่งโรงงาน',
  showCoordinates = true,
  destinationName,
  onExpand,
}: MapProps & { onExpand?: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const change = useRef(onChange)
  change.current = onChange
  const initial = useRef(point)
  const editable = Boolean(onChange)
  const [tileError, setTileError] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [locating, setLocating] = useState(false)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = false
    const p = initial.current
    const instance = L.map(host.current!, { scrollWheelZoom: false }).setView(
      p ? [p.latitude, p.longitude] : [13.7563, 100.5018],
      p ? 15 : 6,
    )
    map.current = instance
    instance.zoomControl.setPosition('bottomright')
    const tiles = L.tileLayer(
      import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      },
    ).addTo(instance)
    tiles.on('tileerror', () => setTileError(true))
    tiles.on('tileload', () => setTileError(false))
    if (editable)
      instance.on('click', (e) =>
        change.current?.({
          latitude: Number(e.latlng.lat.toFixed(6)),
          longitude: Number(e.latlng.wrap().lng.toFixed(6)),
        }),
      )
    const observer = new ResizeObserver(() => instance.invalidateSize())
    observer.observe(host.current!)
    return () => {
      mounted.current = false
      observer.disconnect()
      instance.remove()
      map.current = null
      marker.current = null
    }
  }, [editable])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    setLocationError('')
    if (!point) {
      marker.current?.remove()
      marker.current = null
      return
    }
    const position: L.LatLngTuple = [point.latitude, point.longitude]
    if (marker.current) marker.current.setLatLng(position)
    else {
      const pin = L.marker(position, {
        icon: markerIcon,
        draggable: editable,
        title: label,
        alt: label,
      }).addTo(instance)
      pin.on('dragend', () => {
        const p = pin.getLatLng().wrap()
        change.current?.({
          latitude: Number(p.lat.toFixed(6)),
          longitude: Number(p.lng.toFixed(6)),
        })
      })
      marker.current = pin
    }
    instance.setView(position, Math.max(instance.getZoom(), 15), { animate: false })
  }, [point?.latitude, point?.longitude, editable, label])

  function locate() {
    if (!navigator.geolocation) {
      setLocationError('เบราว์เซอร์นี้ไม่รองรับตำแหน่งปัจจุบัน')
      return
    }
    setLocating(true)
    setLocationError('')
    setAccuracy(null)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (!mounted.current) return
        const value = coordinates(p.coords.latitude, p.coords.longitude)
        if (value) change.current?.(value)
        setAccuracy(Math.round(p.coords.accuracy))
        setLocating(false)
      },
      () => {
        if (mounted.current) {
          setLocating(false)
          setLocationError('อ่านตำแหน่งไม่ได้ คุณยังสามารถคลิกบนแผนที่หรือกรอกพิกัดเองได้')
        }
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true },
    )
  }
  return (
    <div className="location-map">
      <div className="map-heading">
        <span className="map-heading-pin">
          <MapPin size={19} />
        </span>
        <div>
          <strong>{destinationName || label}</strong>
          <small>
            {editable ? 'เลือกหมุดให้ตรงจุดที่รถเข้าถึงได้' : 'ตรวจปลายทาง แล้วเปิดนำทางได้เลย'}
          </small>
        </div>
      </div>
      <div className={`map-frame ${!point && !editable ? 'map-unset' : ''}`}>
        <div className="map-canvas" ref={host} role="region" aria-label={label} />
        {!point && !editable && (
          <div className="map-empty">
            <MapPin size={26} />
            <strong>ยังไม่มีพิกัดปลายทาง</strong>
            <span>กรุณาประสานพนักงานขายเพื่อยืนยันตำแหน่ง</span>
          </div>
        )}
        <div className="map-floating-actions">
          {point && (
            <button
              type="button"
              className="map-control"
              onClick={() =>
                map.current?.setView([point.latitude, point.longitude], 16, { animate: false })
              }
            >
              <LocateFixed size={18} />
              <span>กลับมาที่หมุด</span>
            </button>
          )}
          {onExpand && (point || editable) && (
            <button type="button" className="map-control" onClick={onExpand}>
              <Maximize2 size={18} />
              <span>เต็มจอ</span>
            </button>
          )}
        </div>
      </div>
      {tileError && (
        <p className="map-warning" role="status">
          {editable
            ? 'โหลดแผนที่ไม่ได้ ลองตรวจอินเทอร์เน็ต หรือกรอกพิกัดเอง'
            : 'โหลดแผนที่ไม่ได้ หากมีพิกัดแล้ว คุณยังเปิดนำทางได้จากปุ่มด้านล่าง'}
        </p>
      )}
      {editable ? (
        <div className="map-edit-tools">
          <p className="hint">คลิกแผนที่หรือลากหมุดเพื่อเลือกจุดรับ–ส่ง</p>
          <button type="button" className="button secondary" disabled={locating} onClick={locate}>
            <LocateFixed size={15} />
            {locating ? 'กำลังหาตำแหน่ง…' : 'ใช้ตำแหน่งของฉัน'}
          </button>
        </div>
      ) : (
        point && (
          <div className="map-directions">
            <div>
              <strong>พร้อมออกเดินทาง?</strong>
              <p>เปิดเส้นทางใน Google Maps จากตำแหน่งของคุณ</p>
            </div>
            <a
              className="button primary map-navigate"
              href={directionsURL(point)}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation size={19} />
              เริ่มนำทาง
              <ArrowUpRight size={17} />
            </a>
          </div>
        )
      )}
      {point && showCoordinates && (
        <details className="map-coordinate-details">
          <summary>ดูพิกัดปลายทาง</summary>
          <span>
            {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
          </span>
        </details>
      )}
      {accuracy !== null && (
        <p className={accuracy > 100 ? 'map-warning' : 'hint'} role="status">
          ตำแหน่งอุปกรณ์คลาดเคลื่อนประมาณ {accuracy.toLocaleString('th-TH')} เมตร
          โปรดตรวจหมุดให้ตรงโรงงานก่อนยืนยัน
        </p>
      )}
      {locationError && (
        <p role="status" className="map-warning">
          {locationError}
        </p>
      )}
    </div>
  )
}
