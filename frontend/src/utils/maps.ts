export interface Coordinates {
  latitude: number
  longitude: number
}

export function coordinates(latitude: unknown, longitude: unknown): Coordinates | null {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null
  return { latitude, longitude }
}

export function directionsURL(point: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${point.latitude},${point.longitude}`)}&travelmode=driving&dir_action=navigate`
}
export function deliveryCoordinates(delivery: {
  destination_latitude?: number
  destination_longitude?: number
  has_coordinates?: boolean
}): Coordinates | null {
  if (delivery.has_coordinates === false) return null
  if (
    delivery.has_coordinates !== true &&
    !delivery.destination_latitude &&
    !delivery.destination_longitude
  )
    return null
  return coordinates(delivery.destination_latitude, delivery.destination_longitude)
}
