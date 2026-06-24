const sanitizeHtml = require('sanitize-html')
const _ = {
  forOwn: require('lodash/forOwn'),
}

const InputSanitizer = function () {
  var relaxedOptions = {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'ul', 'br', 'p', 'u'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
  }

  var restrictedOptions = {
    allowedTags: [],
    allowedAttributes: {},
    textFilter: function (text) {
      return text.replace(/&amp;/, '&')
    },
  }

  function trimWhiteSpaces(blip) {
    var processedBlip = {}
    _.forOwn(blip, function (value, key) {
      processedBlip[key.trim()] = value.trim()
    })
    return processedBlip
  }

  var self = {}
  self.sanitize = function (rawBlip) {
    var blip = trimWhiteSpaces(rawBlip)
    blip.description = sanitizeHtml(blip.description, relaxedOptions)
    blip.name = sanitizeHtml(blip.name, restrictedOptions)
    blip.isNew = sanitizeHtml(blip.isNew, restrictedOptions)
    blip.status = sanitizeHtml(blip.status, restrictedOptions)
    blip.ring = sanitizeHtml(blip.ring, restrictedOptions)
    blip.quadrant = sanitizeHtml(blip.quadrant, restrictedOptions)
    blip.owner = sanitizeHtml(blip.owner, relaxedOptions)
    blip.reviewDate = sanitizeHtml(blip.reviewDate, relaxedOptions)
    blip.confluenceUrl = sanitizeHtml(blip.confluenceUrl, relaxedOptions)

    return blip
  }

  self.sanitizeForProtectedSheet = function (rawBlip, header) {
    var blip = trimWhiteSpaces(rawBlip)

    const descriptionIndex = header.indexOf('description')
    const nameIndex = header.indexOf('name')
    const isNewIndex = header.indexOf('isNew')
    const statusIndex = header.indexOf('status')
    const quadrantIndex = header.indexOf('quadrant')
    const ringIndex = header.indexOf('ring')
    const ownerIndex = header.indexOf('owner')
    const reviewDateIndex = header.indexOf('reviewDate')
    const confluenceUrlIndex = header.indexOf('confluenceUrl')

    const description = descriptionIndex === -1 ? '' : blip[descriptionIndex]
    const name = nameIndex === -1 ? '' : blip[nameIndex]
    const isNew = isNewIndex === -1 ? '' : blip[isNewIndex]
    const status = statusIndex === -1 ? '' : blip[statusIndex]
    const ring = ringIndex === -1 ? '' : blip[ringIndex]
    const quadrant = quadrantIndex === -1 ? '' : blip[quadrantIndex]
    const owner = ownerIndex === -1 ? '' : blip[ownerIndex]
    const reviewDate = reviewDateIndex === -1 ? '' : blip[reviewDateIndex]
    const confluenceUrl = confluenceUrlIndex === -1 ? '' : blip[confluenceUrlIndex]

    blip.description = sanitizeHtml(description, relaxedOptions)
    blip.name = sanitizeHtml(name, restrictedOptions)
    blip.isNew = sanitizeHtml(isNew, restrictedOptions)
    blip.status = sanitizeHtml(status, restrictedOptions)
    blip.ring = sanitizeHtml(ring, restrictedOptions)
    blip.quadrant = sanitizeHtml(quadrant, restrictedOptions)
    blip.owner = sanitizeHtml(owner, relaxedOptions)
    blip.reviewDate = sanitizeHtml(reviewDate, relaxedOptions)
    blip.confluenceUrl = sanitizeHtml(confluenceUrl, relaxedOptions)

    return blip
  }

  return self
}

module.exports = InputSanitizer
