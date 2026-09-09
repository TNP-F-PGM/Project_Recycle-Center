import { useCallback, useEffect, useRef, useState } from 'react'
import { api, errorText } from '../services/api'

export function useApiList<T>(path: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const requestNumber = useRef(0)

  const refresh = useCallback(async () => {
    const id = ++requestNumber.current
    setRefreshing(true)
    try {
      const next = await api<T[]>(path)
      if (id === requestNumber.current) {
        setData(next)
        setError('')
      }
    } catch (cause) {
      if (id === requestNumber.current) setError(errorText(cause))
    } finally {
      if (id === requestNumber.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [path])

  useEffect(() => {
    void refresh()
    return () => {
      requestNumber.current++
    }
  }, [refresh])

  return { data, loading, refreshing, error, refresh }
}
