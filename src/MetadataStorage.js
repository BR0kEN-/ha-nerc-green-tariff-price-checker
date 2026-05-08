/**
 * @abstract
 * @template {Object} T
 */
export class MetadataStorage {
  /**
   * @return {boolean}
   */
  exists() {
    throw new Error('Not implemented')
  }

  /**
   * @return {void}
   */
  load() {
    throw new Error('Not implemented')
  }

  /**
   * @param {T} data
   * @return {void}
   */
  store(data) {
    throw new Error('Not implemented')
  }
}
