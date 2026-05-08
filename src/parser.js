const regexps = {
  solarBlock: /\s+Установити\s+.+\s+тариф\s+на\s+електричну\s+енергію,\s+вироблену\s+з\s+енергії\s+сонячного\s+випромінювання[\s\S]*?(?=2\.|$)/i,
  dateRange: /з\s+(\d{2})\s+([а-яіїє]+)\s+(\d{4})\s+року\s+по\s+(\d{2})\s+([а-яіїє]+)\s+(\d{4})\s+року/i,
  price: /([\d,.]+)\s*коп\/квт/i,
}
const months = {
  'січня': 0, 'лютого': 1, 'березня': 2, 'квітня': 3,
  'травня': 4, 'червня': 5, 'липня': 6, 'серпня': 7,
  'вересня': 8, 'жовтня': 9, 'листопада': 10, 'грудня': 11,
}

export function findGreenTariffByDate(rawText, targetTimestamp) {
  const solarBlock = rawText.match(regexps.solarBlock)

  if (!solarBlock) {
    throw new Error('Solar energy block not found')
  }

  for (let line of solarBlock[0].split('\n')) {
    const match = line.match(regexps.dateRange)

    if (match) {
      const [, d1, m1, y1, d2, m2, y2] = match
      // 2. Construct boundary timestamps in UTC
      const startTimestamp = Date.UTC(Number(y1), months[m1.toLowerCase()], Number(d1))
      const endTimestamp = Date.UTC(Number(y2), months[m2.toLowerCase()], Number(d2))

      // 3. Direct numeric comparison
      if (targetTimestamp >= startTimestamp && targetTimestamp <= endTimestamp) {
        const valueMatch = line.match(regexps.price)

        if (!valueMatch) {
          throw new Error('Tariff value not found in the matching line')
        }

        return Number(valueMatch[1].replace(',', '.')) / 100
      }
    }
  }

  throw new Error('No matching date range found')
}
