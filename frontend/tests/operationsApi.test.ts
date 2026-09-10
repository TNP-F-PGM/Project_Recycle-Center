import { afterEach, describe, expect, it, vi } from 'vitest'
import { operationsApi } from '../src/services/operationsApi'

afterEach(() => vi.unstubAllGlobals())

function successfulFetch(data: unknown = {}) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('scoped operations API', () => {
  it('encodes quality seller searches against the current endpoint', async () => {
    const fetch = successfulFetch([{ sellerCode: 'S001', name: 'สมชาย ใจดี' }])
    vi.stubGlobal('fetch', fetch)

    await expect(operationsApi.searchAssessmentSellers(' สมชาย ใจดี ')).resolves.toEqual([
      { sellerCode: 'S001', name: 'สมชาย ใจดี' },
    ])
    expect(fetch).toHaveBeenCalledWith(
      '/api/assessment-sellers?q=%E0%B8%AA%E0%B8%A1%E0%B8%8A%E0%B8%B2%E0%B8%A2%20%E0%B9%83%E0%B8%88%E0%B8%94%E0%B8%B5',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('completes a batch with PATCH and URL-encodes its identifier', async () => {
    const fetch = successfulFetch({ assessmentBatchID: 'LOT 001', status: 'completed' })
    vi.stubGlobal('fetch', fetch)

    await operationsApi.completeAssessmentBatch('LOT 001')

    expect(fetch).toHaveBeenCalledWith(
      '/api/assessment-batches/LOT%20001/complete',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('receives material through the existing pending-item route', async () => {
    const fetch = successfulFetch({ receiveNo: 'RCV-001' })
    vi.stubGlobal('fetch', fetch)
    const input = {
      receiveNo: 'RCV-001',
      zoneID: 'ZONE A/1',
      employeeID: 'EMP-01',
      quantity: 25,
      requestID: 'req-01',
    }

    await operationsApi.receivePendingItem(7, input)

    expect(fetch).toHaveBeenCalledWith(
      '/api/pending-warehouse-items/7/receive',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    )
  })

  it('flattens eligible zones returned in warehouse groups', async () => {
    vi.stubGlobal(
      'fetch',
      successfulFetch([
        {
          warehouseID: 'WH-01',
          currentQuantity: 20,
          totalCapacity: 100,
          unit: 'kg',
          zones: [
            {
              zoneID: 'Z-01',
              zoneName: 'โซน 1',
              capacity: 50,
              quantityOnHand: 20,
              availableCapacity: 30,
              supportedGrade: 'A',
              stockStatus: 'available',
            },
          ],
        },
      ]),
    )

    await expect(operationsApi.listEligibleZones(9)).resolves.toEqual([
      expect.objectContaining({ zoneID: 'Z-01', warehouseID: 'WH-01', availableCapacity: 30 }),
    ])
  })

  it('updates a storage zone without exposing a versioned API', async () => {
    const fetch = successfulFetch({ zoneID: 'ZONE A/1', capacity: 200 })
    vi.stubGlobal('fetch', fetch)

    await operationsApi.updateZone('ZONE A/1', { capacity: 200, zoneName: 'โซน A1' })

    expect(fetch).toHaveBeenCalledWith(
      '/api/storage-zones/ZONE%20A%2F1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ capacity: 200, zoneName: 'โซน A1' }),
      }),
    )
  })

  it('updates a material minimum through the current material route', async () => {
    const fetch = successfulFetch({ materialID: 'MAT/01', minStockLevel: 40 })
    vi.stubGlobal('fetch', fetch)

    await operationsApi.updateMinimumStock('MAT/01', 40)

    expect(fetch).toHaveBeenCalledWith(
      '/api/materials/MAT%2F01/min-stock',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ minStockLevel: 40 }) }),
    )
  })
})
