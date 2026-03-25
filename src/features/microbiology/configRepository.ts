import type { GrowthExpressionConfig } from './types'

type ConfigMutation = {
  name: string
  expression: string
}

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as T | { message?: string }
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String(payload.message ?? 'Request failed')
        : 'Request failed'
    throw new Error(message)
  }
  return payload as T
}

class MicrobiologyConfigRepository {
  private async request<T>(input: RequestInfo | URL, init?: RequestInit) {
    const response = await fetch(input, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    })
    return readJson<T>(response)
  }

  async listConfigurations() {
    return this.request<GrowthExpressionConfig[]>('/api/microbiology/configs')
  }

  async createConfiguration(input: ConfigMutation, makeActive = false) {
    return this.request<GrowthExpressionConfig>('/api/microbiology/configs', {
      method: 'POST',
      body: JSON.stringify({ ...input, makeActive }),
    })
  }

  async updateConfiguration(id: number, input: ConfigMutation) {
    return this.request<GrowthExpressionConfig>(`/api/microbiology/configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  }

  async setActiveConfiguration(id: number) {
    await this.request<{ ok: boolean }>(`/api/microbiology/configs/${id}/activate`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async deleteConfiguration(id: number) {
    await this.request<{ ok: boolean }>(`/api/microbiology/configs/${id}`, {
      method: 'DELETE',
    })
  }
}

export const microbiologyConfigRepository = new MicrobiologyConfigRepository()
