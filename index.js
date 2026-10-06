// noinspection ExceptionCaughtLocallyJS

import express from 'express'
import puppeteer from 'puppeteer'
import { Logger } from './src/Logger.js'
import { Metadata } from './src/Metadata.js'
import { findGreenTariffByDate } from './src/parser.js'

const logger = new Logger()
const metadata = new Metadata({ error: null, tariff: null, decree: null })
const targetUrl = 'https://www.nerc.gov.ua'
const searchUrl = `${targetUrl}/api/search`
const decreeTitle = 'Про встановлення «зелених» тарифів на електричну енергію, вироблену генеруючими установками приватних домогосподарств'
const blockedResourceTypes = ['image', 'stylesheet', 'media', 'font']

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
      if (blockedResourceTypes.includes(r.resourceType())) {
        await r.abort('blockedbyclient')
      } else {
        await r.continue()
      }
    })
    logger.info('Page configured')

    const waitForSearchResponse = async (action) => {
      const [r] = await Promise.all([
        page.waitForResponse((r) => r.url().startsWith(searchUrl)),
        action(),
      ])

      return r
    }

    let currentDecree
    let currentPage = -1
    let response = await waitForSearchResponse(
      () => page.goto(`${targetUrl}/npasearch?&key=${encodeURIComponent(decreeTitle)}`),
    )

    searching: while (true) {
      let { data, current_page, next_page_url } = await response.json()
      logger.info(`Searching on page ${current_page}...`)

      if (current_page === currentPage) {
        throw new Error('Navigation did not happen!')
      }

      for (const item of data) {
        if (item.title === decreeTitle) {
          currentDecree = item
          break searching
        }
      }

      if (!next_page_url) {
        break
      }

      response = waitForSearchResponse(
        // Scrolling to the bottom triggers next page autoloading.
        () => page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)),
      )

      currentPage = current_page
    }

    if (!currentDecree) {
      throw new Error('Cannot find a decree!')
    }

    if (
      !currentDecree?.no
      || !currentDecree?.url
      || !currentDecree?.html_content
      || !currentDecree?.published_at
    ) {
      throw new Error('Unexpected response!')
    }

    metadata.store({
      error: null,
      tariff: findGreenTariffByDate(currentDecree.html_content, targetTimestamp),
      decree: {
        id: currentDecree.no,
        url: currentDecree.url,
        publishedAt: currentDecree.published_at,
      },
    })

    logger.info(metadata.tariff, 'on', new Date(targetTimestamp).toISOString())
  } catch (error) {
    logger.error(error)
    metadata.store({
      error: error.stack || error.message,
      tariff: metadata.tariff,
      decree: metadata.decree,
    })
  } finally {
    await browser?.close()
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
