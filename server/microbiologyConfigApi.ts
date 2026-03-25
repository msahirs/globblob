import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { open, type Database } from 'sqlite'
import sqlite3 from 'sqlite3'
import type { GrowthExpressionConfig } from '../src/features/microbiology/types'
import {
  DEFAULT_GROWTH_CONFIG_NAME,
  DEFAULT_GROWTH_EXPRESSION,
} from '../src/features/microbiology/defaults'

type ConfigMutation = {
  name: string
  expression: string
}

type JsonObject = Record<string, unknown>

const DB_FILE_PATH = resolve(process.cwd(), 'local-debug', 'microbiology-configs.sqlite')

let databasePromise: Promise<Database> | null = null

function toConfig(row: Record<string, unknown>): GrowthExpressionConfig {
  return {
    id: Number(row.id),
    name: String(row.name),
    expression: String(row.expression),
    isActive: Number(row.is_active) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = createDatabase()
  }
  return databasePromise
}

async function createDatabase() {
  await mkdir(dirname(DB_FILE_PATH), { recursive: true })

  const db = await open({
    filename: DB_FILE_PATH,
    driver: sqlite3.Database,
  })

  await db.exec(`
    CREATE TABLE IF NOT EXISTS configurations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      expression TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  const row = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM configurations')
  if (!row || row.count === 0) {
    const now = new Date().toISOString()
    await db.run(
      `
        INSERT INTO configurations (name, expression, is_active, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?)
      `,
      DEFAULT_GROWTH_CONFIG_NAME,
      DEFAULT_GROWTH_EXPRESSION,
      now,
      now,
    )
  }

  return db
}

function normalizeMutation(input: ConfigMutation) {
  const name = input.name.trim()
  const expression = input.expression.trim()

  if (!name) {
    throw new Error('Configuration name is required')
  }
  if (!expression) {
    throw new Error('Expression is required')
  }

  return { name, expression }
}

async function listConfigurations() {
  const db = await getDatabase()
  const rows = await db.all<Record<string, unknown>[]>(`
    SELECT id, name, expression, is_active, created_at, updated_at
    FROM configurations
    ORDER BY is_active DESC, updated_at DESC, id DESC
  `)
  return rows.map((row) => toConfig(row))
}

async function getConfigurationById(id: number) {
  const db = await getDatabase()
  const row = await db.get<Record<string, unknown>>(
    `
      SELECT id, name, expression, is_active, created_at, updated_at
      FROM configurations
      WHERE id = ?
    `,
    id,
  )

  if (!row) {
    throw new Error('Configuration not found')
  }
  return toConfig(row)
}

async function createConfiguration(input: ConfigMutation, makeActive = false) {
  const db = await getDatabase()
  const { name, expression } = normalizeMutation(input)
  const now = new Date().toISOString()

  await db.exec('BEGIN')
  try {
    if (makeActive) {
      await db.run('UPDATE configurations SET is_active = 0')
    }

    const result = await db.run(
      `
        INSERT INTO configurations (name, expression, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      name,
      expression,
      makeActive ? 1 : 0,
      now,
      now,
    )

    await db.exec('COMMIT')
    return getConfigurationById(Number(result.lastID))
  } catch (error) {
    await db.exec('ROLLBACK')
    throw error
  }
}

async function updateConfiguration(id: number, input: ConfigMutation) {
  const db = await getDatabase()
  const { name, expression } = normalizeMutation(input)

  await db.run(
    `
      UPDATE configurations
      SET name = ?, expression = ?, updated_at = ?
      WHERE id = ?
    `,
    name,
    expression,
    new Date().toISOString(),
    id,
  )

  return getConfigurationById(id)
}

async function activateConfiguration(id: number) {
  const db = await getDatabase()

  await db.exec('BEGIN')
  try {
    await db.run('UPDATE configurations SET is_active = 0')
    await db.run(
      'UPDATE configurations SET is_active = 1, updated_at = ? WHERE id = ?',
      new Date().toISOString(),
      id,
    )
    await db.exec('COMMIT')
  } catch (error) {
    await db.exec('ROLLBACK')
    throw error
  }
}

async function deleteConfiguration(id: number) {
  const db = await getDatabase()
  const config = await getConfigurationById(id)

  await db.exec('BEGIN')
  try {
    await db.run('DELETE FROM configurations WHERE id = ?', id)
    const row = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM configurations')
    const remaining = row?.count ?? 0

    if (remaining === 0) {
      const now = new Date().toISOString()
      await db.run(
        `
          INSERT INTO configurations (name, expression, is_active, created_at, updated_at)
          VALUES (?, ?, 1, ?, ?)
        `,
        DEFAULT_GROWTH_CONFIG_NAME,
        DEFAULT_GROWTH_EXPRESSION,
        now,
        now,
      )
    } else if (config.isActive) {
      await db.run(
        `
          UPDATE configurations
          SET is_active = 1, updated_at = ?
          WHERE id = (
            SELECT id FROM configurations ORDER BY updated_at DESC, id DESC LIMIT 1
          )
        `,
        new Date().toISOString(),
      )
    }

    await db.exec('COMMIT')
  } catch (error) {
    await db.exec('ROLLBACK')
    throw error
  }
}

function sendJson(
  res: {
    statusCode: number
    setHeader(name: string, value: string): void
    end(chunk?: string): void
  },
  statusCode: number,
  payload: JsonObject | JsonObject[],
) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

async function readBody(req: { on(event: string, listener: (...args: unknown[]) => void): void }) {
  const chunks: Buffer[] = []
  await new Promise<void>((resolvePromise, rejectPromise) => {
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
    })
    req.on('end', () => resolvePromise())
    req.on('error', (error) => rejectPromise(error))
  })

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  return JSON.parse(raw) as JsonObject
}

function parseId(pathname: string) {
  const match = pathname.match(/^\/api\/microbiology\/configs\/(\d+)$/)
  return match ? Number(match[1]) : null
}

function parseActivationId(pathname: string) {
  const match = pathname.match(/^\/api\/microbiology\/configs\/(\d+)\/activate$/)
  return match ? Number(match[1]) : null
}

function toStatusCode(error: unknown) {
  if (!(error instanceof Error)) return 500
  if (error.message === 'Configuration not found') return 404
  if (
    error.message === 'Configuration name is required' ||
    error.message === 'Expression is required'
  ) {
    return 400
  }
  if ('code' in error && error.code === 'SQLITE_CONSTRAINT') {
    return 409
  }
  return 500
}

export function createMicrobiologyConfigApiMiddleware() {
  return async (
    req: {
      method?: string
      url?: string
      on(event: string, listener: (...args: unknown[]) => void): void
    },
    res: {
      statusCode: number
      setHeader(name: string, value: string): void
      end(chunk?: string): void
    },
    next: () => void,
  ) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const { pathname } = url

    if (!pathname.startsWith('/api/microbiology/configs')) {
      next()
      return
    }

    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {})
      return
    }

    try {
      if (req.method === 'GET' && pathname === '/api/microbiology/configs') {
        sendJson(res, 200, await listConfigurations())
        return
      }

      if (req.method === 'POST' && pathname === '/api/microbiology/configs') {
        const body = (await readBody(req)) as JsonObject
        const created = await createConfiguration(
          {
            name: String(body.name ?? ''),
            expression: String(body.expression ?? ''),
          },
          Boolean(body.makeActive),
        )
        sendJson(res, 201, created)
        return
      }

      const activationId = parseActivationId(pathname)
      if (req.method === 'POST' && activationId !== null) {
        await activateConfiguration(activationId)
        sendJson(res, 200, { ok: true })
        return
      }

      const id = parseId(pathname)
      if (id !== null && req.method === 'PUT') {
        const body = (await readBody(req)) as JsonObject
        const updated = await updateConfiguration(id, {
          name: String(body.name ?? ''),
          expression: String(body.expression ?? ''),
        })
        sendJson(res, 200, updated)
        return
      }

      if (id !== null && req.method === 'DELETE') {
        await deleteConfiguration(id)
        sendJson(res, 200, { ok: true })
        return
      }

      sendJson(res, 404, { message: 'Endpoint not found' })
    } catch (error) {
      sendJson(res, toStatusCode(error), {
        message: error instanceof Error ? error.message : 'Unexpected server error',
      })
    }
  }
}
