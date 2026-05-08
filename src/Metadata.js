import { MetadataStorageFile } from './MetadataStorageFile.js'

export class Metadata extends MetadataStorageFile {
  constructor() {
    super(`${process.env.PUPPETEER_EXECUTABLE_PATH ? '/share' : '.'}/green-tariff.json`)

    if (this.exists()) {
      this.load()
    } else {
      this.store({
        error: null,
        tariff: null,
        version: 16,
      })
    }
  }
}
