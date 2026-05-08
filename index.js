import express from 'express'
import puppeteer from 'puppeteer'
import { Logger } from './src/Logger.js'
import { Metadata } from './src/Metadata.js'
import { findGreenTariffByDate } from './src/parser.js'

const logger = new Logger()
const metadata = new Metadata()
const config = {
  slug: '/acts/pro-vstanovlennya-zelenih-tarifiv-na-elektrichnu-energiyu-viroblenu-generuyuchimi-ustanovkami-privatnih-domogospodarstv-',
  version: metadata.version,
}

function dateToTimestamp(date) {
  if (!date || typeof date !== 'string') {
    throw new Error('Invalid date')
  }

  // The `Y-m-d`.
  const [y, m, d] = date.split('-').map(Number)
  const timestamp = Date.UTC(y, m - 1, d)

  if (isNaN(timestamp)) {
    throw new Error('Invalid date: use the "Y-m-d" format')
  }

  return timestamp
}

async function check(date) {
  logger.info('Checking Tariff price')

  let browser

  try {
    const targetTimestamp = dateToTimestamp(date)

    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    })
    logger.info('Browser started')

    const page = (await browser.pages())[0]
    page.setDefaultNavigationTimeout(5000)
    await page.setRequestInterception(true)
    await page.on('request', async (r) => {
      if (r.resourceType() === 'document') {
        await r.continue()
      } else {
        await r.abort('blockedbyclient')
      }
    })
    logger.info('Page configured')

    await page.goto(`https://www.nerc.gov.ua${config.slug}${config.version}`, { waitUntil: 'domcontentloaded' })
    logger.info('Opened act version', config.version)

    while (true) {
      const { version: currentVersion } = config

      config.version = await page.evaluate(
        (_config) => {
          for (const link of document.querySelectorAll(`a[href*="${_config.slug}"]`)) {
            const version = Number(link.pathname.replace(_config.slug, ''))

            if (version > _config.version) {
              link.click()
              return version
            }
          }

          return _config.version
        },
        config,
      )

      if (currentVersion === config.version) {
        logger.info('Navigation completed')
        break
      }

      await page.waitForNavigation({ waitUntil: 'domcontentloaded' })
      logger.info('Opened act version', config.version)
    }

    metadata.store({
      error: null,
      tariff: findGreenTariffByDate(
        await page.$$eval(
          'main .editor-content',
          (n) => n.reduce((a, b) => a + b.innerText, ''),
        ),
        targetTimestamp,
      ),
      version: config.version,
    })

    logger.info(metadata.tariff, 'on', new Date(targetTimestamp).toISOString())
  } catch (error) {
    logger.error(error)
    metadata.store({
      error: error.stack || error.message,
      tariff: metadata.tariff,
      version: config.version,
    })
  } finally {
    await browser.close()
  }
}

async function main() {
  const app = express()

  app.get('/nerc/green-tariff-price', async (request, response) => {
    await check(request.query.date)

    response.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    })
    response.send(JSON.stringify(metadata))
  })

  app.listen(8085, '0.0.0.0')
  logger.info('Server started')
}

if (import.meta.main || process.argv[1] === import.meta.filename) {
  main()
}
