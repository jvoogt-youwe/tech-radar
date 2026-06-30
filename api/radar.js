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

// Confluence table header (lowercased, trimmed) -> radar blip field.
// NOTE: the Confluence "Status" column (active/candidate) is intentionally NOT
// mapped to the blip `status` field — the radar uses `status` to drive the blip
// movement state (new / moved in / moved out / no change), which is derived from
// the "Moved" column below.
const COLUMN_MAP = {
  technology: 'name',
  quadrant: 'quadrant',
  ring: 'ring',
  owner: 'owner',
  'review date': 'reviewDate',
  'confluence page url': 'confluenceUrl',
  notes: 'description',
  moved: 'moved',
}

// "Moved" column -> radar movement status.
//   2 = new, 1 = moved in (towards the centre/Adopt), -1 = moved out, 0 = no change
const MOVED_TO_STATUS = {
  '2': 'new',
  '1': 'moved in',
  '-1': 'moved out',
  '0': 'no change',
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
    res.status(500).json({ error: `Failed to read Confluence page: ${(error && error.message) || error}` })
  }
}

// Minimal, dependency-free HTML parsing. The Confluence "view" output for a
// table is regular enough that small regexes are more robust on Vercel's
// runtime than an external parser (which pulled in an ESM-only transitive dep).

function decodeEntities(str) {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function stripTags(cellHtml) {
  return decodeEntities(cellHtml.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function getCells(rowHtml) {
  return rowHtml.match(/<t[hd]\b[^>]*>[\s\S]*?<\/t[hd]>/gi) || []
}

function parseTable(html, baseUrl) {
  const tableMatch = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/i)
  if (!tableMatch) return []

  const rows = tableMatch[0].match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []
  if (rows.length < 2) return []

  const headers = getCells(rows[0]).map((cell) => stripTags(cell).toLowerCase())

  const blips = []
  for (let i = 1; i < rows.length; i++) {
    const cells = getCells(rows[i])
    if (cells.length === 0) continue

    const raw = {}
    headers.forEach((header, index) => {
      const field = COLUMN_MAP[header]
      if (!field) return
      const cell = cells[index]
      if (cell == null) {
        raw[field] = ''
        return
      }
      if (field === 'confluenceUrl') {
        const link = cell.match(/href\s*=\s*["']([^"']+)["']/i)
        raw[field] = link ? decodeEntities(link[1]) : stripTags(cell)
      } else {
        raw[field] = stripTags(cell)
      }
    })

    // Skip empty rows (no technology name).
    if (!raw.name) continue

    // "Moved" column -> movement status (drives the New/Moved/No change rendering).
    raw.status = MOVED_TO_STATUS[raw.moved] || ''
    // Keep isNew in sync for the legend/fallback (2 == newly added this cycle).
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
