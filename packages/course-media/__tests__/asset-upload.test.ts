import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetUploadController } from '../src/controllers/asset-upload'
import type { CourseApiContext } from '../src/context'

/**
 * The namespace-scoped asset uploader (TASK-013's engine): validation,
 * measurement, the mint → PUT → complete pipeline, and — the part the
 * creative editor depends on — `takeLocalUrl`, which transfers blob
 * ownership so a claimed preview survives the controller's cleanup.
 */

function ctx(): CourseApiContext {
  return {
    apiBaseUrl: 'http://media.test',
    getToken: async () => 'test-token',
    getTenantId: () => 'tenant-1',
  }
}

function jpegFile(): File {
  return new File(['pretend-bytes'], 'a.jpg', { type: 'image/jpeg' })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/v1/assets') && init?.method === 'POST') {
        expect(init.headers).toHaveProperty('Idempotency-Key')
        return jsonResponse(
          {
            asset_id: 'asset_1',
            upload_id: 'upload_1',
            upload_url: 'http://media.test/put/1',
            expires_at: '2026-01-01T00:00:00Z',
          },
          201,
        )
      }
      if (url === 'http://media.test/put/1') {
        return new Response(null, { status: 200 })
      }
      if (url.endsWith('/complete')) {
        return jsonResponse({ id: 'asset_1', status: 'ready', progress_percent: 100, version: 1 })
      }
      return jsonResponse({})
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AssetUploadController', () => {
  it('refuses unsupported and empty files without touching the network', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AssetUploadController(ctx())
    const states: string[] = []
    controller.state.subscribe((state) => states.push(state.phase))

    controller.start(new File(['x'], 'a.bmp', { type: 'image/bmp' }))
    expect(states.at(-1)).toBe('failed')
    controller.reset()
    controller.start(new File([], 'empty.png', { type: 'image/png' }))
    expect(states.at(-1)).toBe('failed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('runs the upload pipeline and reports the measured dimensions', async () => {
    const controller = new AssetUploadController(ctx(), {
      measureImage: async (file) => ({
        url: `blob:${file.name}`,
        width: 640,
        height: 480,
      }),
    })
    const states: unknown[] = []
    controller.state.subscribe((state) => states.push({ ...state }))

    controller.start(jpegFile())
    await flush()
    await flush()
    await flush()

    const last = states.at(-1) as { phase: string; assetId: string; width: number }
    expect(last).toMatchObject({ phase: 'ready', assetId: 'asset_1', width: 640 })
    expect((states[1] as { phase: string }).phase).toBe('uploading')
  })

  it('takeLocalUrl transfers blob ownership so reset keeps the preview alive', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    const controller = new AssetUploadController(ctx(), {
      measureImage: async () => ({ url: 'blob:claimed', width: 10, height: 10 }),
    })
    controller.start(jpegFile())
    await flush()
    await flush()
    await flush()

    const claimed = controller.takeLocalUrl()
    expect(claimed).toBe('blob:claimed')
    controller.reset()
    expect(revokeSpy).not.toHaveBeenCalledWith('blob:claimed')
    revokeSpy.mockRestore()
  })
})
