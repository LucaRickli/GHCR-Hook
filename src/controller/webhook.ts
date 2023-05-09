import { Webhooks } from "@octokit/webhooks";

import { WEBHOOK_SECRET } from "../utils/config";
import { AccessLog, Log } from "../utils/log";
import { dockerController } from "./docker";

const webhooks = new Webhooks({
  secret: WEBHOOK_SECRET,
  log: Log,
});

webhooks.onAny((ev) => {
  let msg = `Recieved hook: "${ev.name}`;

  if ("action" in ev.payload) msg = msg.concat(`.${ev.payload.action}`);
  msg = msg.concat('". ');

  if (typeof ev.payload["sender"] === "object") {
    msg = msg.concat(
      `From: ${ev.payload["sender"]?.login} (id: ${ev.payload["sender"]?.id}). `
    );
  }

  if (typeof ev.payload["repository"] === "object") {
    msg = msg.concat(
      `Repo: ${ev.payload["repository"]?.full_name} (id: ${ev.payload["repository"]?.id}). `
    );
  }

  Log.log(msg);
});

webhooks.onError((ev) => Log.error("Webhook error:", ev));

webhooks.on("package.published", async (ev) => {
  AccessLog.log(
    `Recieved hook: "${ev.name}.${ev.payload.action}". From: ${ev.payload.sender.login} (id: ${ev.payload.sender.id}). Repo: ${ev.payload.repository.full_name} (id: ${ev.payload.repository.id}).`
  );

  const { package_url } = ev.payload.package.package_version;

  if (!package_url) throw "package_url is missing.";

  await dockerController.reloadImage(package_url);
});

export { webhooks };
