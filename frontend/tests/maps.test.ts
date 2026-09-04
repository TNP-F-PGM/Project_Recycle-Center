import { describe, expect, it } from 'vitest'
import { coordinates, deliveryCoordinates, directionsURL } from '../src/utils/maps'

describe('saved factory and delivery locations', () => {
  it('rejects missing or invalid coordinates without turning them into zero', () => {
    for (const [lat, lon] of [
      [null, null],
      [undefined, 100],
      [13, NaN],
      [91, 100],
      [13, -181],
      ['', ''],
    ]) {
      expect(coordinates(lat, lon)).toBeNull()
    }
    expect(coordinates(0, 0)).toEqual({ latitude: 0, longitude: 0 })
  })
  it('distinguishes an explicit zero location from a legacy unset location', () => {
    expect(deliveryCoordinates({ destination_latitude: 0, destination_longitude: 0 })).toBeNull()
    expect(
      deliveryCoordinates({
        destination_latitude: 0,
        destination_longitude: 0,
        has_coordinates: true,
      }),
    ).toEqual({ latitude: 0, longitude: 0 })
    expect(deliveryCoordinates({ destination_latitude: 13, destination_longitude: 100 })).toEqual({
      latitude: 13,
      longitude: 100,
    })
  })
  it('opens driving directions to the saved destination without an API key', () => {
    const url = new URL(directionsURL({ latitude: 13.7563, longitude: 100.5018 }))
    expect(url.origin).toBe('https://www.google.com')
    expect(url.pathname).toBe('/maps/dir/')
    expect(url.searchParams.get('destination')).toBe('13.7563,100.5018')
    expect(url.searchParams.get('travelmode')).toBe('driving')
    expect(url.searchParams.has('key')).toBe(false)
  })
})
