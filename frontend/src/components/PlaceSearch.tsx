import { useEffect, useRef, useState } from 'react'
import { MapPin, Search } from 'lucide-react'
import { api, errorText } from '../services/api'
import type { Coordinates } from '../utils/maps'
interface Place extends Coordinates {
  name: string
  address: string
}

export function PlaceSearch({ onSelect }: { onSelect: (place: Place) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  useEffect(
    () => () => {
      sequence.current++
      request.current?.abort()
    },
    [],
  )
  function edit(value: string) {
    sequence.current++
    request.current?.abort()
    setBusy(false)
    setQuery(value)
    setResults([])
    setSearched(false)
    setError('')
  }
  async function search() {
    if (busy) return
    const value = query.trim()
    if ([...value].length < 3) {
      setError('พิมพ์ชื่อโรงงาน ถนน หรือตำบล อย่างน้อย 3 ตัวอักษร')
      return
    }
    const version = ++sequence.current
    const abort = new AbortController()
    request.current = abort
    setBusy(true)
    setError('')
    setResults([])
    setSearched(false)
    try {
      const data = await api<Place[]>('/locations/search', 'POST', { query: value }, abort.signal)
      if (version === sequence.current) {
        setResults(data)
        setSearched(true)
      }
    } catch (e) {
      if (!abort.signal.aborted && version === sequence.current) setError(errorText(e))
    } finally {
      if (version === sequence.current) setBusy(false)
    }
  }
  return (
    <div className="place-search">
      <label className="field" htmlFor="factory-place-search">
        1. ค้นหาชื่อโรงงานหรือที่อยู่
      </label>
      <div className="place-search-input">
        <input
          id="factory-place-search"
          value={query}
          maxLength={200}
          placeholder="เช่น นวนคร ปทุมธานี หรือชื่อถนน / ตำบล"
          onChange={(e) => edit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void search()
            }
          }}
        />
        <button
          type="button"
          className="button primary"
          disabled={busy}
          onClick={() => void search()}
        >
          <Search size={16} />
          {busy ? 'กำลังค้นหา…' : 'ค้นหา'}
        </button>
      </div>
      <div aria-live="polite">
        {error && <p className="map-warning">{error}</p>}
        {searched && !results.length && (
          <p className="summary-note">
            ไม่พบสถานที่นี้ ลองค้นหาชื่อถนน ตำบล หรือจังหวัดใกล้เคียง แล้วเลื่อนหมุดให้ตรงโรงงาน
            หรือใช้เมนูกรอกพิกัดเองด้านล่าง
          </p>
        )}
      </div>
      {!!results.length && (
        <ul className="place-results" aria-label="ผลค้นหาสถานที่">
          {results.map((place, i) => (
            <li key={`${place.latitude},${place.longitude},${i}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect(place)
                  setResults([])
                  setSearched(false)
                }}
              >
                <MapPin size={18} />
                <span>
                  <strong>{place.name}</strong>
                  <small>{place.address || 'เลือกเพื่อดูตำแหน่งบนแผนที่'}</small>
                </span>
                <span className="text-link">เลือก</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">
        ค้นหาสถานที่ในประเทศไทย · ข้อมูล{' '}
        <a
          className="text-link"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>{' '}
        ผ่าน Photon
      </p>
    </div>
  )
}
