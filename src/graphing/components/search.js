const d3 = require('d3')

const AutoComplete = require('../../util/autoComplete')
const { selectRadarQuadrant, removeScrollListener } = require('../components/quadrants')

function renderSearch(radarHeader, quadrants) {
  const searchContainer = radarHeader.append('div').classed('search-container', true)

  searchContainer
    .append('input')
    .classed('search-container__input', true)
    .attr('placeholder', 'Search this radar')
    .attr('id', 'auto-complete')

  AutoComplete('#auto-complete', quadrants, function (e, ui) {
    const blipId = ui.item.blip.id()
    const quadrant = ui.item.quadrant

    selectRadarQuadrant(quadrant.order, quadrant.startAngle, quadrant.quadrant.name())
    removeScrollListener()

    // The quadrant view re-renders its blip list; wait for it, then locate the
    // matching list item, open it (expand its details) and scroll it into view.
    setTimeout(() => {
      let container = d3.select(`.blip-list__item-container[data-blip-id="${blipId}"]`)
      if (container.empty()) {
        container = d3.select(`.blip-list__item-container[data-group-id="${blipId}"]`)
      }

      const node = container.node()
      if (!node) return

      node.click() // expands the item's details (owner / review date / Confluence link)

      // Highlight the matched item (clearing any previous search highlight).
      d3.selectAll('.blip-list__item--searched').classed('blip-list__item--searched', false)
      d3.select(node.closest('.blip-list__item')).classed('blip-list__item--searched', true)

      container.select('h3.blip-list__item-title').node()?.scrollIntoView({
        behavior: 'smooth',
      })
    }, 1500)
  })
}

module.exports = {
  renderSearch,
}
