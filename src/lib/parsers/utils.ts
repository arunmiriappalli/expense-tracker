export function pa(s: string): number {
  return parseFloat(s.replace(/,/g, ''))
}

export function toIsoDate(d: string, sep = '/'): string {
  const [dd, mm, yyyy] = d.split(sep)
  return `${yyyy}-${mm}-${dd}`
}
