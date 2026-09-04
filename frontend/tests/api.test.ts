import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../src/services/api'
import { csvCell, today } from '../src/utils/format'

afterEach(() => vi.unstubAllGlobals())
describe('API transport', () => {
  it('sends a PATCH to the same-origin proxy with JSON and keeps the resource id', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ status: 'assigned' }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const input = { truck_id: 'TR002', driver_id: 'D001', supervisor_id: 'USER-SUP' }
    expect(await api('/delivery-requests/DR001/assignment', 'PATCH', input)).toEqual({
      status: 'assigned',
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/delivery-requests/DR001/assignment',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    )
  })
  it('does not report success when the server rejects a double booking', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'truck already has an active delivery' }), {
          status: 409,
        }),
      ),
    )
    await expect(api('/delivery-requests/DR001/assignment', 'PATCH', {})).rejects.toMatchObject({
      status: 409,
      message: 'truck already has an active delivery',
    })
  })
  it('handles an unavailable proxy even when the response is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 })))
    await expect(api('/trucks')).rejects.toBeInstanceOf(ApiError)
  })
})
describe('export and date values', () => {
  it('escapes user text and prevents spreadsheet formulas in exported cells', () => {
    expect(csvCell('ACME "Factory", Ltd')).toBe('"ACME ""Factory"", Ltd"')
    expect(csvCell('=HYPERLINK("https://example.com")')).toBe(
      '"\'=HYPERLINK(""https://example.com"")"',
    )
    expect(csvCell('  +1')).toBe('"\'  +1"')
  })
  it('formats dates using the local calendar rather than UTC', () => {
    const d = new Date()
    expect(today()).toBe(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    )
  })
})
