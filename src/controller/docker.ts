import * as Docker from "dockerode";
import { statSync } from "node:fs";

import { SOCKET_PATH } from "../utils/config";
import { Log } from "../utils/log";

if (!statSync(SOCKET_PATH).isSocket()) {
  throw new Error("Are you sure the docker is running?");
}

class DockerController {
  // change to private
  private readonly docker: Docker;

  public constructor({ socketPath = SOCKET_PATH }) {
    this.docker = new Docker({ socketPath });
  }

  public async reloadImage(tag: string) {
    const [images, containers] = await Promise.all([
      this.getImages(tag),
      this.getContainers(tag),
    ]);

    if (images.length !== 1) {
      const msg = `Invalid amount of images found. (${images.length} item${
        images.length === 1 ? "" : "s"
      } found)`;
      Log.error(msg);
      throw new Error(msg);
    }

    if (containers.length <= 0) {
      const msg = `No container found using this image.`;
      Log.error(msg, `Image: ${tag}`);
      throw new Error(msg);
    }

    Log.info(`Pulling image "${tag}".`);

    await this.pullImage(tag);

    Log.debug(`Found ${containers.length} Active containers using this image`);

    const snapshots: Set<
      Awaited<ReturnType<typeof this.createContainerSnapshot>>
    > = new Set();
    const stopPromises: Set<Promise<any>> = new Set();
    const startPromises: Set<Promise<any>> = new Set();

    containers.map(({ Id, State }) => {
      if (State === "running") {
        stopPromises.add(
          new Promise(async (resolve, reject) => {
            try {
              snapshots.add(await this.createContainerSnapshot(Id, tag));
              await this.removeContainer(Id, true);
              Log.debug(`Removed container: ${Id}`);
              resolve(undefined);
            } catch (err) {
              reject(err);
            }
          })
        );
      }
    });
    await Promise.all(stopPromises);

    for (const snapshot of snapshots) {
      startPromises.add(
        new Promise(async (resolve, reject) => {
          try {
            const { id } = await this.createContainer(snapshot);
            Log.debug(`Created container: ${id}`);
            await this.startContainer(id);
            Log.debug(`Started container: ${id}`);
            resolve(undefined);
          } catch (err) {
            reject;
          }
        })
      );
    }
    await Promise.all(startPromises);
  }

  private async getImages(tag: string | string[]) {
    return this.docker
      .listImages({
        filters: JSON.stringify({
          reference: Array.isArray(tag) ? tag : [tag],
        }),
      })
      .catch((reason) => {
        const msg = "Failed to list images.";
        Log.error(msg, "Reason:", reason);
        throw new Error(msg);
      });
  }

  private async getContainers(tag: string | string[]) {
    return this.docker
      .listContainers({
        filters: JSON.stringify({
          ancestor: Array.isArray(tag) ? tag : [tag],
        }),
      })
      .catch((reason) => {
        const msg = "Failed to get running containers.";
        Log.error(msg, "Reason:", reason);
        throw new Error(msg);
      });
  }

  private async pullImage(tag: string) {
    return this.docker.pull(tag).catch((reason) => {
      const msg = "[CRITICAL] Failed to pull latest image.";
      Log.error(msg, `Image: "${tag}". Reason:`, reason);
      throw new Error(msg);
    });
  }

  private async createContainerSnapshot(Id: string, Image: string) {
    const {
      Config,
      Name,
      HostConfig,
      NetworkSettings: { MacAddress, Networks },
    } = await this.docker
      .getContainer(Id)
      .inspect()
      .catch((reason) => {
        const msg = "[CRITICAL] Failed to create snapshot of container.";
        Log.error(msg, `Container: "${Id}". Reason:`, reason);
        throw new Error(msg);
      });

    const containerSnapshot: Docker.ContainerCreateOptions = {
      ...Config,
      Image,
      name: Name,
      MacAddress,
      HostConfig,
      NetworkingConfig: {
        EndpointsConfig: Networks,
      },
    };

    return containerSnapshot;
  }

  // not needed with force remove
  /* private async stopContainer(id: string) {
    return this.docker
      .getContainer(id)
      .stop()
      .catch((reason) => {
        const msg = "[CRITICAL] Error occured while stopping container.";
        Log.error(msg, `Container: "${id}". Reason:`, reason);
        throw new Error(msg);
      });
  } */

  private async removeContainer(id: string, force: boolean = false) {
    return this.docker
      .getContainer(id)
      .remove({ force })
      .catch((reason) => {
        const msg = "[CRITICAL] Error occured while removing container.";
        Log.error(msg, `Container: "${id}". Reason:`, reason);
        throw new Error(msg);
      });
  }

  private async createContainer(opt: Docker.ContainerCreateOptions) {
    return this.docker.createContainer(opt).catch((reason) => {
      const msg = "[CRITICAL] Error occured while creating container.";
      Log.error(msg, `Image: "${opt.Image}". Reason:`, reason);
      throw new Error(msg);
    });
  }

  private async startContainer(id: string) {
    return this.docker
      .getContainer(id)
      .start()
      .catch((reason) => {
        const msg = "[CRITICAL] Error occured while starting container.";
        Log.error(msg, `Container: "${id}". Reason:`, reason);
        throw new Error(msg);
      });
  }
}

export const dockerController = new DockerController({});
