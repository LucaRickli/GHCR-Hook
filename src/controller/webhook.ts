import { Webhooks } from '@octokit/webhooks'
import type {} from '@octokit/webhooks'

import { DOCKER_IMAGE_REGEX, IS_IMAGE_BLACKLISTED, WEBHOOK_SECRET } from '../utils/config'
import { AccessLog, Log } from '../utils/log'
import { dockerController } from './docker'

const webhooks = new Webhooks({
  secret: WEBHOOK_SECRET,
  log: Log
})

interface SharedPayload {
  sender?: { id: string; login: string }
  repository: { id: string; full_name: string }
}

webhooks.onAny((ev) => {
  let msg = `Recieved hook: "${ev.name}`

  if ('action' in ev.payload) msg = msg.concat(`.${ev.payload.action}`)
  msg = msg.concat('". ')

  const payload = ev.payload as unknown as SharedPayload

  if (typeof payload.sender === 'object') {
    msg = msg.concat(`From: ${payload.sender.login} (id: ${payload.sender.id}). `)
  }

  if (typeof payload.repository === 'object') {
    msg = msg.concat(`Repo: ${payload.repository.full_name} (id: ${payload.repository.id}). `)
  }

  AccessLog.info(msg)
})

webhooks.onError((ev) => Log.error('Webhook error:', ev))

webhooks.on('package.published', async (ev) => {
  const package_url = ev.payload?.package?.package_version?.package_url

  if (!package_url || !DOCKER_IMAGE_REGEX.test(package_url)) {
    AccessLog.warn(
      `Got invalid image tag: From: ${ev.payload.sender.login} (id: ${ev.payload.sender.id}). Repo: ${ev.payload.repository.full_name} (id: ${ev.payload.repository.id}).`
    )
    throw new SyntaxError('Invalid package_url.')
  }

  if (IS_IMAGE_BLACKLISTED(package_url)) {
    AccessLog.warn(
      `Image on blacklist was requested to be reloaded. "${package_url}" From: ${ev.payload.sender.login} (id: ${ev.payload.sender.id}). Repo: ${ev.payload.repository.full_name} (id: ${ev.payload.repository.id}).`
    )
    throw new Error('Image is not allowed to be reloaded.')
  }

  await dockerController.updateImage(package_url)
})

export { webhooks }
