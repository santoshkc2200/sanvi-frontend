import { deflateSync } from 'node:zlib'
import type { Page } from '@playwright/test'

/**
 * Media-service mocks for the TASK-013 creative specs: the namespace-scoped
 * `/v1/assets` upload surface (mint → PUT → complete) answered in-process,
 * plus a real PNG encoder so the browser's own image measurement sees an
 * asset of a chosen size — the placement spec checks run on measured
 * dimensions, so a 1×1 upload must measure 1×1.
 */

// --- Minimal PNG encoding (RGBA, no interlace) ------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) {
    c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

/** A solid-color RGBA PNG of the given dimensions, for browser-side measurement. */
export function makePng(width: number, height: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const row = Buffer.alloc(1 + width * 4)
  const raw = Buffer.alloc((1 + width * 4) * height)
  for (let y = 0; y < height; y += 1) {
    row[0] = 0 // filter: none
    raw.set(row, y * (1 + width * 4))
  }
  const idat = deflateSync(raw)
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array()),
  ])
}

// --- Media backend -----------------------------------------------------------

export function mockMediaBackend(page: Page): void {
  let assetCounter = 0

  void page.route('**/v1/assets', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') {
      await route.fulfill({ json: {} })
      return
    }
    if (!request.headers()['idempotency-key']) {
      await route.fulfill({ status: 400, json: { code: 'invalid_input' } })
      return
    }
    assetCounter += 1
    const body = request.postDataJSON() as { kind?: string }
    void body
    await route.fulfill({
      status: 201,
      json: {
        asset_id: `asset_${assetCounter}`,
        upload_id: `upload_${assetCounter}`,
        // Root-relative: the browser resolves it against the page origin,
        // keeping the whole upload same-origin (and the route mockable)
        // the same way a same-site media gateway would.
        upload_url: `/put/${assetCounter}`,
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      },
    })
  })

  void page.route('**/put/*', async (route) => {
    await route.fulfill({ status: 200 })
  })

  void page.route('**/v1/assets/*/complete', async (route) => {
    const body = route.request().postDataJSON() as { width?: number } | null
    void body
    const id = new URL(route.request().url()).pathname.split('/')[3] ?? ''
    await route.fulfill({
      json: {
        id,
        status: 'ready',
        progress_percent: 100,
        version: 1,
      },
    })
  })
}
