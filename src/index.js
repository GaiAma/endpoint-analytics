import { URL } from 'url'
import { router, get } from 'microrouter'
import microCors from 'micro-cors'
import noSniff from 'micro-nosniff'
import ratelimit from 'micro-ratelimit'
import Sparkpost from 'sparkpost'
import { compose, curry } from 'ramda'
import he from 'he'
import sanitizeHtml from 'sanitize-html'
import ua from 'universal-analytics'
import { stringify } from 'jsan'
import noCache from './micro-no-cache'
import pixel from './pixel'

const isProduction = process.env.NODE_ENV === `production`

const middlewares = compose(
  noCache,
  noSniff,
  microCors({
    allowMethods: [`OPTIONS`, `GET`],
    origin: isProduction ? process.env.ENDPOINT_CORS_ORIGIN : `*`,
  }),
  curry(ratelimit)({ window: 1000, limit: 1, headers: true })
)

const spark = new Sparkpost()

const sendError = async error =>
  spark.transmissions.send({
    options: {
      open_tracking: false,
      click_tracking: false,
    },
    content: {
      from: {
        email: process.env.ANALYTICS_CRASH_SENDER,
      },
      subject: `GaiAma Analytics Error`,
      html: stringify(error, null, 2, true),
    },
    recipients: [
      {
        address: {
          email: process.env.ANALYTICS_CRASH_RECIPIENT,
        },
      },
    ],
  })

const sanitizeText = str =>
  sanitizeHtml(str, {
    allowedTags: [],
    allowedAttributes: [],
  })

const handlePixel = async (req, res) => {
  try {
    const { referer } = req.headers

    const {
      title: _title,
      uid: _userId,
      utm_source: _campaignSource = ``,
    } = req.query
    const { hostname, pathname } = referer ? new URL(referer) : {}
    const [lang] = pathname.replace(/^\/|\/$/, ``).split(`/`)
    const title = he.decode(sanitizeText(_title)).replace(` - GaiAma.org`, ``)
    const userId = sanitizeText(_userId)
    const campaignSource = sanitizeText(_campaignSource)

    if (!referer || !campaignSource) {
      return
    }

    const params = {
      documentTitle: title,
      documentPath: pathname,
      documentHostName: hostname,
      anonymizeIp: 1,
      userLanguage: lang,
      userId,
      campaignSource,
    }

    const visitor = ua(process.env.GOOGLE_ANALYTICS_ID, userId, {
      strictCidFormat: false,
    })

    visitor.pageview(params, async error => {
      if (error) await sendError({ error, req })
    })

    res.setHeader(`Content-Type`, `image/gif`)
    res.end(pixel, `binary`)
  } catch (error) {
    sendError({ error, req })
  }
}

export default middlewares(router(get(`/:random/p`, handlePixel)))
