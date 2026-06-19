import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs'

type PdfBytes = ArrayBuffer | ArrayBufferView

export interface ExtractTextOptions {
  logPasswordErrors?: boolean
}

function toArrayBufferCopy(bytes: PdfBytes): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) return bytes.slice(0)
  const view = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return view.slice().buffer
}

export async function extractTextFromPdf(
  buffer: PdfBytes,
  password?: string,
  options: ExtractTextOptions = {},
): Promise<string> {
  // Ensure we have a non-detached ArrayBuffer by copying it
  let safeBuffer: ArrayBuffer
  try {
    safeBuffer = toArrayBufferCopy(buffer)
  } catch (err) {
    console.error('ERROR: Buffer passed to extractTextFromPdf is detached or invalid')
    throw err
  }
  try {
    const normalizedPassword = password?.trim()
    const pdf = await getDocument({
      data: safeBuffer,
      verbosity: VerbosityLevel.ERRORS,
      ...(normalizedPassword ? { password: normalizedPassword } : {}),
    }).promise
    const pages: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join('\n'))
    }
    return pages.join('\n')
  } catch (error: unknown) {
    if (password && options.logPasswordErrors !== false) {
      console.error(`Error loading PDF with password "${password.trim()}":`, error)
    }
    throw error
  }
}
