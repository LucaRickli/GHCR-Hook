import Docker from 'dockerode'
import { statSync } from 'fs'

import { DOCKER_SOCKET_PATH } from '../utils/config'
import { Log } from '../utils/log'

class DockerController {
  private readonly docker: Docker

  public constructor({ socketPath = DOCKER_SOCKET_PATH } = { socketPath: DOCKER_SOCKET_PATH }) {
    if (!statSync(DOCKER_SOCKET_PATH).isSocket()) {
      throw new Error('Docker socket is not reachable.')
    }
    this.docker = new Docker({ socketPath })
  }

  public async updateImage(tag: string) {
    const images = await this.getImages(tag)
    if (!Array.isArray(images) || images.length !== 1) {
      throw new Error(`Invalid amount of images found. Got ${images?.length} / expected 1.`)
    }
    const oldImage = images[0]

    const containers = await this.getContainers(oldImage.Id)
    if (containers.length <= 0) {
      throw new Error(`No container found using image '${tag}' (${oldImage.Id}).`)
    }

    Log.info(`Pulling image '${tag}'.`)
    const updated = await this.pullImage(tag)
    if (!updated) {
      throw new Error(`Image is alredy up to date. Image: '${tag}' (${oldImage.Id}).`)
    }

    const allImages = await this.getImages(tag)
    if (!Array.isArray(allImages) || allImages.length !== 2) {
      throw new Error(
        `Expected to have 2 images after pulling new image. Got ${allImages?.length} images.`
      )
    }
    const filteredImages = allImages.filter((i) => i.Id !== oldImage.Id)
    if (filteredImages.length !== 1) {
      throw new Error('Failed to find new image inside list.')
    }
    const newImage = filteredImages[0]

    const updatePromises = new Set<Promise<void>>()
    for (const container of containers) {
      updatePromises.add(
        new Promise(async (reslve, reject) => {
          let snapshot: Awaited<ReturnType<typeof this.createContainerSnapshot>>

          try {
            Log.info(`Creating snapshot of container '${container.Names[0]}' (${container.Id}).`)
            snapshot = await this.createContainerSnapshot(container.Id, newImage.Id)

            Log.info(`Removing container '${snapshot.name}' (${container.Id}).`)
            await this.removeContainer(container.Id, true)
          } catch (err) {
            return reject(undefined)
          }

          try {
            Log.info(`Creating new container '${snapshot.name}'`)
            const { id } = await this.createContainer(snapshot)

            if (container.State === 'running') {
              Log.info(`Starting container ${snapshot.name} (${id}).`)
              await this.startContainer(id)
            }

            reslve(void 0)
          } catch (err) {
            Log.error(
              `Error while restarting container '${container.Names?.[0]}' (${container.Id}).`,
              err
            )

            if (snapshot) {
              try {
                Log.info(`Recovering container '${snapshot.name}'`)
                const { id } = await this.createContainer({ ...snapshot, Image: oldImage.Id })

                if (container.State === 'running') {
                  Log.info(`Starting recovered container ${snapshot.name} (${id}).`)
                  await this.startContainer(id)
                }
              } catch (recoveryError) {
                Log.error(
                  `Failed to recover container '${container.Names?.[0]}' (${container.Id}).`,
                  recoveryError
                )
              }
            }

            reject(undefined)
          }
        })
      )
    }

    const updateResults = await Promise.allSettled(updatePromises)
    const failed = updateResults.filter((i) => i.status === 'rejected').length

    if (failed) {
      Log.error(`${failed} restart failed. Skipping deletion of old Image.`)
    } else {
      Log.info('Removing old image ')
      await this.removeImage(oldImage.Id)

      Log.info(
        `Successfully pulled new image & restared ${updatePromises.size} container${
          updatePromises.size > 1 ? 's' : ''
        }.`
      )
    }
  }

  private async getImages(tag: string | string[]) {
    return Promise.retry<Docker.ImageInfo[]>((resolve, reject) =>
      this.docker
        .listImages({
          filters: JSON.stringify({
            reference: Array.isArray(tag) ? tag : [tag]
          })
        })
        .then(resolve)
        .catch(reject)
    ).catch((reason) => {
      const msg = 'Failed to list images.'
      Log.error(msg, 'Reason:', reason)
      throw new Error(msg)
    })
  }

  private async removeImage(id: string) {
    return Promise.retry<any>((resolve, reject) =>
      this.docker.getImage(id).remove().then(resolve).catch(reject)
    ).catch((reason) => {
      const msg = 'Failed to remove image.'
      Log.error(msg, `Image: "${id}". Reason:`, reason)
      throw new Error(msg)
    })
  }

  private async pullImage(tag: string): Promise<boolean> {
    return Promise.retry<any>((resolve, reject) => {
      this.docker.pull(tag, (err: any, stream: NodeJS.ReadableStream) => {
        if (err) reject(err)
        this.docker.modem.followProgress(
          stream,
          (err, results) =>
            err
              ? reject(err)
              : resolve(!/^Status: Image is up to date/.test(results[results.length - 1]?.status)),
          (progress: PullProgress) => {
            const isStatus = /^Status:/.test(progress.status)
            Log[isStatus ? 'info' : 'debug'](
              `Pull ${isStatus ? '' : 'progress: '}${progress.status} ${progress.progress || ''}`
            )
          }
        )
      })
    }).catch((reason) => {
      const msg = 'Failed to pull latest image.'
      Log.error(msg, `Reason:`, reason)
      throw new Error(msg)
    })
  }

  private async createContainerSnapshot(
    Id: string,
    Image: string
  ): Promise<Docker.ContainerCreateOptions> {
    const {
      Config,
      Name,
      HostConfig,
      NetworkSettings: { MacAddress, Networks }
      // Image,
    } = await Promise.retry<Docker.ContainerInspectInfo>((resolve, reject) =>
      this.docker.getContainer(Id).inspect().then(resolve).catch(reject)
    ).catch((reason) => {
      const msg = '[CRITICAL] Failed to create snapshot of container.'
      Log.error(msg, `Reason:`, reason)
      throw new Error(msg)
    })

    return {
      ...Config,
      Image,
      name: Name,
      MacAddress,
      HostConfig,
      NetworkingConfig: {
        EndpointsConfig: Networks
      }
    }
  }

  private async getContainers(tag: string | string[]) {
    return Promise.retry<Docker.ContainerInfo[]>((resolve, reject) =>
      this.docker
        .listContainers({
          filters: JSON.stringify({
            ancestor: Array.isArray(tag) ? tag : [tag]
          })
        })
        .then(resolve)
        .catch(reject)
    ).catch((reason) => {
      const msg = 'Failed to get running containers.'
      Log.error(msg, 'Reason:', reason)
      throw new Error(msg)
    })
  }

  private async removeContainer(id: string, force: boolean = false) {
    return Promise.retry<any>((resolve, reject) =>
      this.docker.getContainer(id).remove({ force }).then(resolve).catch(reject)
    ).catch((reason) => {
      const msg = '[CRITICAL] Error occured while removing container.'
      Log.error(msg, `Reason:`, reason)
      throw new Error(msg)
    })
  }

  private async createContainer(opt: Docker.ContainerCreateOptions) {
    return Promise.retry<Docker.Container>((resolve, reject) =>
      this.docker.createContainer(opt).then(resolve).catch(reject)
    ).catch((reason) => {
      const msg = '[CRITICAL] Error occured while creating container.'
      Log.error(msg, `Reason:`, reason)
      throw new Error(msg)
    })
  }

  private async startContainer(id: string) {
    return Promise.retry<any>((resolve, reject) =>
      this.docker.getContainer(id).start().then(resolve).catch(reject)
    ).catch((reason) => {
      const msg = '[CRITICAL] Error occured while starting container.'
      Log.error(msg, `Reason:`, reason)
      throw new Error(msg)
    })
  }
}

export const dockerController = new DockerController()

interface PullProgress {
  status: string
  progressDetail: Object
  progress: string
  id: string
}
