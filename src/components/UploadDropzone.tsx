'use client'

import { useState, useCallback } from 'react'
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface UploadResult {
  filename: string
  source: string
  parsed: number
  inserted: number
  error?: string
}

const SOURCE_LABELS: Record<string, string> = {
  icici_bank: 'ICICI Bank Account',
  icici_amazon_cc: 'ICICI Amazon Pay CC',
  icici_epm_cc: 'ICICI Emeralde CC',
}

export function UploadDropzone({ onComplete }: { onComplete?: () => void }) {
  const [dragging, setDragging] = useState(false)
  const [results, setResults] = useState<UploadResult[]>([])
  const [uploading, setUploading] = useState(false)

  const processFiles = useCallback(async (files: File[]) => {
    const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (!pdfs.length) return

    setUploading(true)
    const newResults: UploadResult[] = []

    for (const file of pdfs) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch('/api/parse', { method: 'POST', body: fd })
        const data = await res.json()
        newResults.push({
          filename: file.name,
          source: data.source ?? 'unknown',
          parsed: data.parsed ?? 0,
          inserted: data.inserted ?? 0,
          error: data.error,
        })
      } catch {
        newResults.push({ filename: file.name, source: '', parsed: 0, inserted: 0, error: 'Upload failed' })
      }
    }

    setResults(prev => [...newResults, ...prev])
    setUploading(false)
    onComplete?.()
  }, [onComplete])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    processFiles(Array.from(e.dataTransfer.files))
  }, [processFiles])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files))
  }, [processFiles])

  return (
    <div className="space-y-4">
      <label
        className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
          dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input type="file" multiple accept=".pdf" className="hidden" onChange={onInputChange} />
        {uploading ? (
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        ) : (
          <>
            <Upload className="h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">Drop bank / credit card PDFs here</p>
            <p className="text-xs text-gray-400 mt-1">ICICI Bank, Amazon Pay CC, Emeralde CC</p>
          </>
        )}
      </label>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg text-sm ${r.error ? 'bg-red-50' : 'bg-green-50'}`}>
              {r.error
                ? <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                : <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              }
              <div>
                <p className="font-medium text-gray-800">{r.filename}</p>
                {r.error
                  ? <p className="text-red-600">{r.error}</p>
                  : <p className="text-gray-600">
                      {SOURCE_LABELS[r.source] ?? r.source} — {r.parsed} transactions parsed, {r.inserted} new
                    </p>
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
