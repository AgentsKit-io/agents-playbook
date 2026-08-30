import { createHash } from 'node:crypto'

export const sha256 = (value: string | NodeJS.ArrayBufferView): string => createHash('sha256').update(value).digest('hex')
export const hashJson = (value: unknown): string => sha256(JSON.stringify(value))
