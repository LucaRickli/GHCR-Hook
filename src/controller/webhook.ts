import { Webhooks } from "@octokit/webhooks";

import { WEBHOOK_SECRET } from "../utils/config";
import { Log } from "../utils/log";
import { dockerController } from "./docker";

const webhooks = new Webhooks({
  secret: WEBHOOK_SECRET,
  log: Log,
});

webhooks.onAny((ev) => Log.log("Recieved hook:", ev));

webhooks.onError((ev) => Log.error(ev));

webhooks.on("package.published", async (ev) => {
  const { package_url } = ev.payload.package.package_version;

  if (!package_url) {
    throw new Error("package.package_version.package_url is undefined");
  }

  await dockerController.reloadImage(package_url);
});

export { webhooks };
