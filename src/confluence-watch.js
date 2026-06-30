const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL
const CONFLUENCE_PAGE_ID = process.env.CONFLUENCE_PAGE_ID
const CONFLUENCE_PAGE_URL = `${CONFLUENCE_BASE_URL}/spaces/SER/pages/${CONFLUENCE_PAGE_ID}`

function showToast(message, type) {
  const existing = document.getElementById('radar-toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.id = 'radar-toast'
  toast.className = `radar-toast radar-toast--${type}`
  toast.innerHTML = message
  document.body.appendChild(toast)

  requestAnimationFrame(() => toast.classList.add('radar-toast--visible'))

  setTimeout(() => {
    toast.classList.remove('radar-toast--visible')
    toast.addEventListener('transitionend', () => toast.remove(), { once: true })
  }, 7000)
}

// The button is rendered dynamically once the radar data has loaded, so it does
// not exist at DOMContentLoaded. Use event delegation so the handler works no
// matter when the button appears.
document.addEventListener('click', async function (event) {
  const btn = event.target.closest('#keep-me-posted-btn')
  if (!btn) return

  {
    if (!CONFLUENCE_BASE_URL || !CONFLUENCE_PAGE_ID) {
      showToast('Confluence is not configured yet.', 'error')
      return
    }

    btn.textContent = 'Subscribing…'
    btn.disabled = true

    try {
      const res = await fetch(`${CONFLUENCE_BASE_URL}/rest/api/user/watch/content/${CONFLUENCE_PAGE_ID}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.ok || res.status === 204) {
        btn.textContent = "You're watching!"
        showToast('You are now watching this page. Confluence will notify you of any changes.', 'success')
      } else {
        btn.textContent = 'Keep me posted'
        btn.disabled = false
        showToast(`Could not subscribe (${res.status}). Make sure you are logged in to Confluence.`, 'error')
      }
    } catch (_corsErr) {
      // CORS blocks direct API calls — open the Confluence page so the user can watch it there
      btn.textContent = 'Keep me posted'
      btn.disabled = false
      window.open(CONFLUENCE_PAGE_URL, '_blank')
      showToast(
        'Opened Confluence in a new tab — click the <strong>Watch</strong> button (🔔) at the top of the page to subscribe to updates.',
        'info',
      )
    }
  }
})
