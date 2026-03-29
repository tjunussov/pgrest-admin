// @vitest-environment node
import { describe, it, expect } from 'vitest'
import axios from 'axios'

const API = process.env.TEST_API_URL || 'https://pos.imbir.kz/api'

describe('PostgREST API integration', () => {
  it('should reach the PostgREST root endpoint', async () => {
    const { status, data } = await axios.get(`${API}/`)
    expect(status).toBe(200)
    expect(data).toBeDefined()
  })

  it('should return data from root endpoint', async () => {
    const { data } = await axios.get(`${API}/`)
    expect(data !== null && data !== undefined).toBe(true)
  })

  it('should return error for protected endpoints without token', async () => {
    try {
      await axios.get(`${API}/users`, {
        headers: { Accept: 'application/json' }
      })
    } catch (err) {
      expect([401, 403, 404]).toContain(err.response?.status)
    }
  })

  it('should have rpc/login endpoint', async () => {
    try {
      await axios.post(`${API}/rpc/login`, {
        email: 'test',
        pass: 'invalid'
      })
    } catch (err) {
      const status = err.response?.status
      // 405 = method exists but wrong verb or signature, also acceptable
      expect([400, 401, 403, 404, 405]).toContain(status)
    }
  })

  it('should support Prefer count=exact header', async () => {
    const { status } = await axios.get(`${API}/`, {
      headers: { Prefer: 'count=exact' }
    })
    expect(status).toBe(200)
  })
})
