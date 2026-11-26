import axios, {
  AxiosError,
  type AxiosProgressEvent,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { configureHttp } from '../../lib/http'

/** One presigned transfer the fake storage received. */
export type StorageCall = {
  method: string
  url: string
  headers: Record<string, unknown>
  withCredentials: boolean | undefined
  data: unknown
}

/**
 * Fake S3 on axios's own `adapter` hook, so the real request path runs: every
 * transfer is recorded, an upload reports half its bytes through
 * `onUploadProgress` like the browser adapter does, and storage answers with
 * `status` (a non-2xx answer rejects with an AxiosError, as axios does).
 */
export function fakeStorage(status: number, body = 'file-bytes'): StorageCall[] {
  const calls: StorageCall[] = []
  const adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    calls.push({
      method: config.method ?? '',
      url: config.url ?? '',
      headers: config.headers.toJSON(),
      withCredentials: config.withCredentials,
      data: config.data,
    })
    if (config.method === 'put') config.onUploadProgress?.({ loaded: 1, total: 2 } as AxiosProgressEvent)
    const response: AxiosResponse = {
      data: config.responseType === 'blob' ? new Blob([body]) : body,
      status,
      statusText: '',
      headers: {},
      config,
    }
    if (status < 200 || status >= 300) {
      throw new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_RESPONSE, config, undefined, response)
    }
    return response
  }
  configureHttp({ storageClient: axios.create({ adapter, withCredentials: false }) })
  return calls
}
