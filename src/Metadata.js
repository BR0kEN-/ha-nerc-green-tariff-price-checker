import { MetadataStorageFile } from './MetadataStorageFile.js'

/**
 * @template {Object} T
 * @extends {MetadataStorageFile<T>}
 */
export class Metadata extends MetadataStorageFile {
  /**
   * @param {T} initial
   */
  constructor(initial) {
    super(`${process.env.PUPPETEER_EXECUTABLE_PATH ? '/share' : '.'}/green-tariff.json`)

    if (this.exists()) {
      this.load()
    } else {
      this.store(initial)
    }
  }
}
