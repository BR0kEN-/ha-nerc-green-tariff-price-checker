export class Logger {
  info(...args) {
    this.#log('info', ...args)
  }

  /**
   * @param {Error} error
   * @param {*} args
   */
  error(error, ...args) {
    this.#log('error', error, ...args)
  }

  #log(type, ...args) {
    console[type](new Date().toISOString(), '@', ...args)
  }
}
