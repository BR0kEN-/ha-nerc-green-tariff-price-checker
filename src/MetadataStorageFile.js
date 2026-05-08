import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import { MetadataStorage } from './MetadataStorage.js'

/**
 * @template {Object} T
 * @extends {MetadataStorage<T>}
 */
export class MetadataStorageFile extends MetadataStorage {
  #path

  constructor(path) {
    super()
    this.#path = path
  }

  exists() {
    return existsSync(this.#path)
  }

  load() {
    Object.assign(this, JSON.parse(readFileSync(this.#path, 'utf-8')))
  }

  store(data) {
    try {
      writeFileSync(this.#path, JSON.stringify(data), 'utf-8')
      Object.assign(this, data)
    } catch (error) {
      console.error('Failed to write metadata file', error)
    }
  }
}
