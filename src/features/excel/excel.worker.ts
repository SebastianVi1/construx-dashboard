import type { ExcelRequest } from './excelWorkerProtocol'
import { handleExcelRequest } from './excelWorkerProtocol'

// ExcelJS is only reachable from here, so it stays out of the main bundle and off the main thread.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ExcelRequest>) => void) | null
  postMessage(message: unknown, transfer?: Transferable[]): void
}

scope.onmessage = async (event) => {
  const response = await handleExcelRequest(event.data)
  scope.postMessage(response, response.ok && response.kind === 'export' ? [response.buffer] : [])
}
