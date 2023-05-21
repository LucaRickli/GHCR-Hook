import * as Docker from "dockerode";
import { statSync } from "fs";

import { DOCKER_SOCKET_PATH } from "../utils/config";
import { Log } from "../utils/log";

class DockerController {
  private readonly docker: Docker;

  public constructor(
    { socketPath = DOCKER_SOCKET_PATH } = { socketPath: DOCKER_SOCKET_PATH }
  ) {
    if (!statSync(DOCKER_SOCKET_PATH).isSocket()) {
      throw new Error("Docker socket is not reachable!");
    }
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

    const stopPromises: Set<Promise<void>> = new Set();
    const startPromises: Set<Promise<void>> = new Set();
    const snapshots: Set<{
      running: boolean;
      options: SnapshotResponse;
    }> = new Set();
    type SnapshotResponse = Awaited<
      ReturnType<typeof this.createContainerSnapshot>
    >;

    for (const { Id, State } of containers) {
      stopPromises.add(
        new Promise(async (resolve, reject) => {
          try {
            const snapshot = await this.createContainerSnapshot(Id, tag);
            snapshots.add({ options: snapshot, running: State === "running" });

            Log.info(`Removing container: ${snapshot.name} (${Id}).`);
            await this.removeContainer(Id, true);

            resolve(void 0);
          } catch (err) {
            reject(err);
          }
        })
      );
    }

    const stopFailures = (await Promise.allSettled(stopPromises)).filter(
      (i) => i.status === "rejected"
    ).length;

    if (stopFailures <= 0) {
      /* Log.info("Removing old image.");
      await this.removeImage(images[0].Id); */

      Log.info(`Updating image "${tag}".`);
      await this.pullImage(tag);

      Log.info("Pruning untagged images.");
      const pruneResult = await this.pruneImages();

      Log.debug("Pruning untagged images results:");
      pruneResult.ImagesDeleted?.map((i) =>
        Log.debug(
          `${i.Deleted ? "  Deleted:" + i.Deleted : ""}\n${
            i.Untagged ? "  Untagged:" + i.Untagged : ""
          }`
        )
      ).join("\n");
    } else {
      Log.error(
        `Error while stopping ${stopFailures} container${
          stopFailures === 1 ? "" : "s"
        }. Skipping pull of new image and restarting containers with old image.`
      );
    }

    for (const { running, options } of snapshots) {
      startPromises.add(
        new Promise(async (resolve, reject) => {
          try {
            Log.info(`Creating new container: ${options.name}`);
            const { id } = await this.createContainer(options);

            if (running) {
              Log.info(`Starting container: ${options.name} (${id}).`);
              await this.startContainer(id);
            }

            resolve(void 0);
          } catch (err) {
            reject(err);
          }
        })
      );
    }

    const startFailures = (await Promise.allSettled(startPromises)).filter(
      (i) => i.status === "rejected"
    ).length;

    if (startFailures > 0) {
      const msg = `${startFailures} container${
        startFailures === 1 ? "" : "s"
      } failed while restarting.`;
      Log.error(msg);
      throw new Error(msg);
    }

    if (stopFailures > 0) {
      const msg = `${stopFailures} container${
        stopFailures === 1 ? "" : "s"
      } failed while stopping. Successfully restarted all containers with old image.`;
      Log.error(msg);
      throw new Error(msg);
    }

    Log.info(
      `Successfully pulled new image & restared ${snapshots.size} container${
        snapshots.size > 1 ? "s" : ""
      }.`
    );
  }

  private async getImages(tag: string | string[]) {
    return Promise.retry<Docker.ImageInfo[]>((resolve, reject) =>
      this.docker
        .listImages({
          filters: JSON.stringify({
            reference: Array.isArray(tag) ? tag : [tag],
          }),
        })
        .then(resolve)
        .catch(reject)
    ).catch((reason) => {
      const msg = "Failed to list images.";
      Log.error(msg, "Reason:", reason);
      throw new Error(msg);
    });
  }

  private async getContainers(tag: string | string[]) {
    return Promise.retry<Docker.ContainerInfo[]>((resolve, reject) =>
      this.docker
        .listContainers({
          filters: JSON.stringify({
            ancestor: Array.isArray(tag) ? tag : [tag],
          }),
        })
        .then(resolve)
        .catch(reject)
    ).catch((reason) => {
      const msg = "Failed to get running containers.";
      Log.error(msg, "Reason:", reason);
      throw new Error(msg);
    });
  }

  /* private async removeImage(id: string, noprune: boolean = true) {
    return Promise.retry<any>((resolve, reject) =>
      this.docker.getImage(id).remove({ noprune }).then(resolve).catch(reject)
    ).catch((reason) => {
      const msg = "[CRITICAL] Failed to remove old image.";
      Log.error(msg, `Image: "${id}". Reason:`, reason);
      throw new Error(msg);
    });
  } */

  private async pullImage(tag: string) {
    return Promise.retry<any>((resolve, reject) => {
      this.docker.pull(tag, (err: any, stream: import("stream").Stream) => {
        if (err) reject(err);
        this.docker.modem.followProgress(
          stream,
          (err, results) => (err ? reject(err) : resolve(results)),
          (progress: PullProgress) =>
            Log[/^Status:/.test(progress.status) ? "info" : "debug"](
              `Pull progess: ${progress.status} ${progress.progress || ""}`
            )
        );
      });
    }).catch((reason) => {
      const msg = "[CRITICAL] Failed to pull latest image.";
      Log.error(msg, `Image: "${tag}". Reason:`, reason);
      throw new Error(msg);
    });
  }

  private async pruneImages() {
    return Promise.retry<Docker.PruneImagesInfo>(
      (resolve, reject) =>
        this.docker
          .pruneImages(
            JSON.stringify({
              dangling: true,
            })
          )
          .then(resolve)
          .catch(reject),
      1 // 1 retry
    ).catch((reason) => {
      const msg = "[CRITICAL] Error occured while pruning images.";
      Log.error(msg, `Reason:`, reason);
      throw new Error(msg);
    });
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
      // Image,
    } = await Promise.retry<Docker.ContainerInspectInfo>((resolve, reject) =>
      this.docker.getContainer(Id).inspect().then(resolve).catch(reject)
    ).catch((reason) => {
      const msg = "[CRITICAL] Failed to create snapshot of container.";
      Log.error(msg, `Container: "${Id}". Reason:`, reason);
      throw new Error(msg);
    });

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
    return Promise.retry<any>((resolve, reject) =>
      this.docker.getContainer(id).stop().then(resolve).catch(reject)
    ).catch((reason) => {
      const msg = "[CRITICAL] Error occured while stopping container.";
      Log.error(msg, `Container: "${id}". Reason:`, reason);
      throw new Error(msg);
    });
  } */

  private async removeContainer(id: string, force: boolean = false) {
    return Promise.retry<any>((resolve, reject) =>
      this.docker.getContainer(id).remove({ force }).then(resolve).catch(reject)
    ).catch((reason) => {
      const msg = "[CRITICAL] Error occured while removing container.";
      Log.error(msg, `Container: "${id}". Reason:`, reason);
      throw new Error(msg);
    });
  }

  private async createContainer(opt: Docker.ContainerCreateOptions) {
    return Promise.retry<Docker.Container>((resolve, reject) =>
      this.docker.createContainer(opt).then(resolve).catch(reject)
    ).catch((reason) => {
      const msg = "[CRITICAL] Error occured while creating container.";
      Log.error(msg, `Image: "${opt.Image}". Reason:`, reason);
      throw new Error(msg);
    });
  }

  private async startContainer(id: string) {
    return Promise.retry<any>((resolve, reject) =>
      this.docker.getContainer(id).start().then(resolve).catch(reject)
    ).catch((reason) => {
      const msg = "[CRITICAL] Error occured while starting container.";
      Log.error(msg, `Container: "${id}". Reason:`, reason);
      throw new Error(msg);
    });
  }
}

export const dockerController = new DockerController();

interface PullProgress {
  status: string;
  progressDetail: Object;
  progress: string;
  id: string;
}
