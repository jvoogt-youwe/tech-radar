const d3 = require('d3')
const { graphConfig, getScale, uiConfig } = require('../config')
const { stickQuadrantOnScroll } = require('./quadrants')
const { removeAllSpaces } = require('../../util/stringUtil')

const RING_DESCRIPTIONS = {
  Adopt: 'We strongly feel that the industry should be adopting these items. We use them when appropriate on our projects.',
  Trial:
    'Worth pursuing. It is important to understand how to build up this capability. Teams can try this technology on a project that can handle the risk.',
  Assess: 'Worth exploring with the goal of understanding how it will affect your projects.',
  Caution: 'Proceed with caution.',
}

const INFO_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`

function fadeOutAllBlips() {
  d3.selectAll('g > a.blip-link').attr('opacity', 0.3)
}

function fadeInSelectedBlip(selectedBlipOnGraph) {
  selectedBlipOnGraph.attr('opacity', 1.0)
}

function highlightBlipInTable(selectedBlip) {
  selectedBlip.classed('highlight', true)
}

function highlightBlipInGraph(blipIdToFocus) {
  fadeOutAllBlips()
  const selectedBlipOnGraph = d3.select(`g > a.blip-link[data-blip-id='${blipIdToFocus}'`)
  fadeInSelectedBlip(selectedBlipOnGraph)
}

function renderBlipDescription(blip, ring, quadrant, tip, groupBlipTooltipText) {
  let blipTableItem = d3.select(`.quadrant-table.${quadrant.order} ul[data-ring-order='${ring.order()}']`)
  if (!groupBlipTooltipText) {
    blipTableItem = blipTableItem.append('li').classed('blip-list__item', true)
    const blipItemDiv = blipTableItem
      .append('div')
      .classed('blip-list__item-container', true)
      .attr('data-blip-id', blip.id())

    if (blip.groupIdInGraph()) {
      blipItemDiv.attr('data-group-id', blip.groupIdInGraph())
    }

    // Title
    blipItemDiv.append('h3').classed('blip-list__item-title', true).text(`${blip.blipText()}. ${blip.name()}`)

    // Determine what meta fields exist
    const confluenceUrl = blip.confluenceUrl()
    const hasValidConfluence =
      confluenceUrl && (confluenceUrl.startsWith('https://') || confluenceUrl.startsWith('http://'))
    const hasMeta = blip.owner() || blip.reviewDate() || hasValidConfluence

    // Description with optional inline toggle
    const description = blip.description() || ''
    if (description || hasMeta) {
      const descDiv = blipItemDiv.append('div').classed('blip-description-text', true)

      if (description) {
        descDiv.append('span').classed('blip-description-body', true).html(description)
      }

      if (hasMeta) {
        // Inline "Show more" / "Show less" toggle
        if (description) {
          descDiv.node().appendChild(document.createTextNode(' '))
        }
        const toggle = descDiv.append('button').classed('blip-show-toggle', true).text('Show more')

        // Meta badges (hidden until "Show more")
        const metaBadges = blipItemDiv.append('div').classed('blip-meta-badges', true)

        if (blip.owner()) {
          metaBadges.append('span').classed('blip-meta-badge', true).text(blip.owner())
        }
        if (blip.reviewDate()) {
          metaBadges.append('span').classed('blip-meta-badge', true).text(blip.reviewDate())
        }
        if (hasValidConfluence) {
          metaBadges
            .append('a')
            .classed('blip-meta-badge blip-meta-badge--link', true)
            .attr('href', confluenceUrl)
            .attr('target', '_blank')
            .attr('rel', 'noopener noreferrer')
            .text('Confluence')
        }

        toggle.on('click', function (e) {
          e.stopPropagation()
          const expanded = metaBadges.classed('visible')
          metaBadges.classed('visible', !expanded)
          toggle.text(expanded ? 'Show more' : 'Show less')
          if (window.innerWidth >= uiConfig.tabletViewWidth) {
            stickQuadrantOnScroll()
          }
        })
      }
    }
  }

  const blipGraphItem = d3.select(`g a#blip-link-${removeAllSpaces(blip.id())}`)
  const mouseOver = function (e) {
    const targetElement = e.target.classList.contains('blip-link') ? e.target : e.target.parentElement
    const isGroupIdInGraph = !targetElement.classList.contains('blip-link') ? true : false
    const blipWrapper = d3.select(targetElement)
    const blipIdToFocus = blip.groupIdInGraph() ? blipWrapper.attr('data-group-id') : blipWrapper.attr('data-blip-id')
    const selectedBlipOnGraph = d3.select(`g > a.blip-link[data-blip-id='${blipIdToFocus}'`)
    highlightBlipInGraph(blipIdToFocus)
    highlightBlipInTable(blipTableItem)

    const isQuadrantView = d3.select('svg#radar-plot').classed('quadrant-view')
    const displayToolTip = blip.isGroup() ? !isQuadrantView : !blip.groupIdInGraph()
    const toolTipText = blip.isGroup() ? groupBlipTooltipText : blip.name()

    if (displayToolTip && !isGroupIdInGraph) {
      tip.show(toolTipText, selectedBlipOnGraph.node())

      const selectedBlipCoords = selectedBlipOnGraph.node().getBoundingClientRect()
      const tipElement = d3.select('div.d3-tip')
      const tipElementCoords = tipElement.node().getBoundingClientRect()

      tipElement
        .style(
          'left',
          `${parseInt(
            selectedBlipCoords.left + window.scrollX - tipElementCoords.width / 2 + selectedBlipCoords.width / 2,
          )}px`,
        )
        .style('top', `${parseInt(selectedBlipCoords.top + window.scrollY - tipElementCoords.height)}px`)
    }
  }

  const mouseOut = function () {
    d3.selectAll('g > a.blip-link').attr('opacity', 1.0)
    blipTableItem.classed('highlight', false)
    tip.hide().style('left', 0).style('top', 0)
  }

  const blipClick = function (e) {
    const isQuadrantView = d3.select('svg#radar-plot').classed('quadrant-view')
    const targetElement = e.target.classList.contains('blip-link') ? e.target : e.target.parentElement
    if (isQuadrantView) {
      e.stopPropagation()
    }

    const blipId = d3.select(targetElement).attr('data-blip-id')
    highlightBlipInGraph(blipId)

    setTimeout(
      () => {
        if (window.innerWidth >= uiConfig.tabletViewWidth) {
          stickQuadrantOnScroll()
        }

        let selectedBlipContainer = d3.select(`.blip-list__item-container[data-blip-id="${blipId}"`)
        const isGroupBlip = isNaN(parseInt(blipId))
        if (isGroupBlip) {
          selectedBlipContainer = d3.select(`.blip-list__item-container[data-group-id="${blipId}"`)
        }
        const elementToFocus = selectedBlipContainer.select('h3.blip-list__item-title')
        elementToFocus.node()?.scrollIntoView({ behavior: 'smooth' })
      },
      isQuadrantView ? 0 : 1500,
    )
  }

  !groupBlipTooltipText &&
    blipTableItem.on('mouseover', mouseOver).on('mouseout', mouseOut).on('focusin', mouseOver).on('focusout', mouseOut)
  blipGraphItem
    .on('mouseover', mouseOver)
    .on('mouseout', mouseOut)
    .on('focusin', mouseOver)
    .on('focusout', mouseOut)
    .on('click', blipClick)
}

function renderQuadrantTables(quadrants, rings) {
  const radarContainer = d3.select('#radar')

  const quadrantTablesContainer = radarContainer.append('div').classed('quadrant-table__container', true)
  quadrants.forEach(function (quadrant) {
    const scale = getScale()
    let quadrantContainer
    if (window.innerWidth < uiConfig.tabletViewWidth && window.innerWidth >= uiConfig.mobileViewWidth) {
      quadrantContainer = quadrantTablesContainer
        .append('div')
        .classed('quadrant-table', true)
        .classed(quadrant.order, true)
        .style(
          'margin',
          `${
            graphConfig.quadrantHeight * scale +
            graphConfig.quadrantsGap * scale +
            graphConfig.quadrantsGap * 2 +
            uiConfig.legendsHeight
          }px auto 0px`,
        )
        .style('left', '0')
        .style('right', 0)
    } else {
      quadrantContainer = quadrantTablesContainer
        .append('div')
        .classed('quadrant-table', true)
        .classed(quadrant.order, true)
    }

    const ringNames = Array.from(
      new Set(
        quadrant.quadrant
          .blips()
          .map((blip) => blip.ring())
          .map((ring) => ring.name()),
      ),
    )
    ringNames.forEach(function (ringName) {
      const ringHeader = quadrantContainer.append('div').classed('quadrant-table__ring-header', true)
      ringHeader.append('h2').classed('quadrant-table__ring-name', true).attr('data-ring-name', ringName).text(ringName)

      const tooltipWrapper = ringHeader.append('span').classed('quadrant-table__ring-tooltip', true)
      tooltipWrapper
        .append('button')
        .classed('quadrant-table__ring-tooltip-btn', true)
        .attr('aria-label', `What does ${ringName} mean?`)
        .html(INFO_ICON_SVG)
      tooltipWrapper
        .append('div')
        .classed('quadrant-table__ring-tooltip-text', true)
        .text(RING_DESCRIPTIONS[ringName] || '')

      quadrantContainer
        .append('ul')
        .classed('blip-list', true)
        .attr('data-ring-order', rings.filter((ring) => ring.name() === ringName)[0].order())
    })
  })
}

module.exports = {
  renderQuadrantTables,
  renderBlipDescription,
}
