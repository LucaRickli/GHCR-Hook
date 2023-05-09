import * as Docker from "dockerode";
import { statSync } from "fs";

import { SOCKET_PATH } from "../utils/config";
import { Log } from "../utils/log";
import { retry } from "../utils/retryPromise";

if (!statSync(SOCKET_PATH).isSocket()) {
  throw "Are you sure the docker is running?";
}

class DockerController {
  private readonly docker: Docker;

  public constructor(
    { socketPath = SOCKET_PATH } = { socketPath: SOCKET_PATH }
  ) {
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
      throw msg;
    }

    if (containers.length <= 0) {
      const msg = `No container found using this image.`;
      Log.error(msg, `Image: ${tag}`);
      throw msg;
    }

    Log.info(`Pulling image "${tag}".`);

    await this.pullImage(tag);

    const promises: Set<Promise<any>> = new Set();

    containers.map(({ Id, State }) => {
      if (State === "running") {
        promises.add(
          new Promise(async (resolve, reject) => {
            try {
              const snaphot = await this.createContainerSnapshot(Id, tag);
              await this.removeContainer(Id, true);
              Log.debug(`Removed container: ${Id}`);
              await this.createContainer(snaphot);
              Log.debug(`Created container: ${Id}`);
              await this.startContainer(Id);
              Log.debug(`Started container: ${Id}`);
              resolve(undefined);
            } catch (err) {
              reject(err);
            }
          })
        );
      }
    });

    const results = await Promise.allSettled(promises);

    const failedPromises = results.filter(
      (i) => i.status === "rejected"
    ).length;

    if (failedPromises > 0) {
      const msg = `${failedPromises} container failed while restarting.`;
      Log.error("[CRITICAL]", msg);
      throw msg;
    }

    Log.info(
      `Successfully restared ${results.length} container${
        results.length > 1 ? "s" : ""
      }.`
    );
  }

  private async getImages(tag: string | string[]) {
    return retry(
      this.docker
        .listImages({
          filters: JSON.stringify({
            reference: Array.isArray(tag) ? tag : [tag],
          }),
        })
        .catch((reason) => {
          const msg = "Failed to list images.";
          Log.error(msg, "Reason:", reason);
          throw msg;
        })
    );
  }

  private async getContainers(tag: string | string[]) {
    return retry(
      this.docker
        .listContainers({
          filters: JSON.stringify({
            ancestor: Array.isArray(tag) ? tag : [tag],
          }),
        })
        .catch((reason) => {
          const msg = "Failed to get running containers.";
          Log.error(msg, "Reason:", reason);
          throw msg;
        })
    );
  }

  private async pullImage(tag: string) {
    return retry(
      this.docker.pull(tag).catch((reason) => {
        const msg = "[CRITICAL] Failed to pull latest image.";
        Log.error(msg, `Image: "${tag}". Reason:`, reason);
        throw msg;
      })
    );
  }

  private async createContainerSnapshot(
    Id: string,
    Image: string
  ): Promise<Docker.ContainerCreateOptions> {
    const {
      Config,
      Name,
      HostConfig,
      NetworkSettings: { MacAddress, Networks },
    } = await retry(
      this.docker
        .getContainer(Id)
        .inspect()
        .catch((reason) => {
          const msg = "[CRITICAL] Failed to create snapshot of container.";
          Log.error(msg, `Container: "${Id}". Reason:`, reason);
          throw msg;
        })
    );

    return {
      ...Config,
      Image,
      name: Name,
      MacAddress,
      HostConfig,
      NetworkingConfig: {
        EndpointsConfig: Networks,
      },
    };
  }

  // not needed with force remove
  /* private async stopContainer(id: string) {
    return retry(
      this.docker
        .getContainer(id)
        .stop()
        .catch((reason) => {
          const msg = "[CRITICAL] Error occured while stopping container.";
          Log.error(msg, `Container: "${id}". Reason:`, reason);
          throw msg;
        })
    );
  } */

  private async removeContainer(id: string, force: boolean = false) {
    return retry(
      this.docker
        .getContainer(id)
        .remove({ force })
        .catch((reason) => {
          const msg = "[CRITICAL] Error occured while removing container.";
          Log.error(msg, `Container: "${id}". Reason:`, reason);
          throw msg;
        })
    );
  }

  private async createContainer(opt: Docker.ContainerCreateOptions) {
    return retry(
      this.docker.createContainer(opt).catch((reason) => {
        const msg = "[CRITICAL] Error occured while creating container.";
        Log.error(msg, `Image: "${opt.Image}". Reason:`, reason);
        throw msg;
      })
    );
  }

  private async startContainer(id: string) {
    return retry(
      this.docker
        .getContainer(id)
        .start()
        .catch((reason) => {
          const msg = "[CRITICAL] Error occured while starting container.";
          Log.error(msg, `Container: "${id}". Reason:`, reason);
          throw msg;
        })
    );
  }
}

export const dockerController = new DockerController();
