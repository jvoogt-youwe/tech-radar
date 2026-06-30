/**
 * Vercel serverless function: proxy that reads the Confluence "Tech Radar - Source Table"
 * page and returns it as JSON blips for the radar frontend.
 *
 * The browser loads this endpoint via the existing JSON loader (see factory.js).
 * The Confluence Personal Access Token never leaves the server.
 *
 * Required env vars (set in the Vercel project, server-side only):
 *   CONFLUENCE_BASE_URL  e.g. https://confluence.youweagency.com
 *   CONFLUENCE_PAGE_ID   e.g. 495943981
 *   CONFLUENCE_TOKEN     a read-only Confluence Personal Access Token (PAT)
 */

// Confluence table header (lowercased, trimmed) -> radar blip field
const COLUMN_MAP = {
  technology: 'name',
  quadrant: 'quadrant',
  ring: 'ring',
  status: 'status',
  owner: 'owner',
  'review date': 'reviewDate',
  'confluence page url': 'confluenceUrl',
  notes: 'description',
  moved: 'moved',
}

// Every blip must expose these keys as strings: the frontend's InputSanitizer
// trims and sanitizes each one and will throw on undefined values.
const BLIP_FIELDS = ['name', 'ring', 'quadrant', 'status', 'isNew', 'description', 'owner', 'reviewDate', 'confluenceUrl']

module.exports = async function handler(req, res) {
  const baseUrl = (process.env.CONFLUENCE_BASE_URL || '').replace(/\/$/, '')
  const pageId = process.env.CONFLUENCE_PAGE_ID
  const token = process.env.CONFLUENCE_TOKEN

  if (!baseUrl || !pageId || !token) {
    res.status(500).json({
      error: 'Missing Confluence configuration. Set CONFLUENCE_BASE_URL, CONFLUENCE_PAGE_ID and CONFLUENCE_TOKEN.',
    })
    return
  }

  try {
    const url = `${baseUrl}/rest/api/content/${pageId}?expand=body.view`
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      res.status(response.status).json({ error: `Confluence responded with ${response.status}` })
      return
    }

    const data = await response.json()
    const html = (data && data.body && data.body.view && data.body.view.value) || ''
    const blips = parseTable(html, baseUrl)

    // Cache at the edge so Confluence is not hit on every page load.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json(blips)
  } catch (error) {
    res.status(500).json({
      error: `Failed to read Confluence page: ${(error && error.message) || error}`,
      stack: error && error.stack,
    })
  }
}

function parseTable(html, baseUrl) {
  const { parse } = require('node-html-parser')
  const root = parse(html)
  const table = root.querySelector('table')
  if (!table) return []

  const rows = table.querySelectorAll('tr')
  if (rows.length < 2) return []

  const headers = rows[0].querySelectorAll('th, td').map((cell) => cell.text.trim().toLowerCase())

  const blips = []
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll('td')
    if (cells.length === 0) continue

    const raw = {}
    headers.forEach((header, index) => {
      const field = COLUMN_MAP[header]
      if (!field) return
      const cell = cells[index]
      if (!cell) {
        raw[field] = ''
        return
      }
      if (field === 'confluenceUrl') {
        const link = cell.querySelector('a')
        raw[field] = link ? link.getAttribute('href') || '' : cell.text.trim()
      } else {
        raw[field] = cell.text.trim()
      }
    })

    // Skip empty rows (no technology name).
    if (!raw.name) continue

    // "Moved" column (0/1/2) -> isNew flag. 2 == newly added this cycle.
    raw.isNew = raw.moved === '2' ? 'TRUE' : 'FALSE'
    delete raw.moved

    raw.confluenceUrl = resolveUrl(raw.confluenceUrl, baseUrl)

    // Guarantee every expected field exists as a string.
    BLIP_FIELDS.forEach((field) => {
      if (typeof raw[field] !== 'string') raw[field] = ''
    })
    // ContentValidator requires a non-empty description header; fall back to the name.
    if (!raw.description) raw.description = raw.name

    blips.push(raw)
  }

  return blips
}

function resolveUrl(href, baseUrl) {
  if (!href) return ''
  if (/^https?:\/\//i.test(href)) return href
  return baseUrl + (href.startsWith('/') ? href : `/${href}`)
}

// Exported for unit testing.
module.exports.parseTable = parseTable
