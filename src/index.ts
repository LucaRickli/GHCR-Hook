import { createServer } from "http";
import { createNodeMiddleware } from "@octokit/webhooks";

import { webhooks } from "./controller/webhook";
import { WEBHOOK_PATH, PORT } from "./utils/config";
import { Log } from "./utils/log";

// import { dockerController } from "./controller/docker";
// dockerController
//   .reloadImage("alpine:latest")
//   .then(() => console.log("reload complete"));

const middleware = createNodeMiddleware(webhooks, { path: WEBHOOK_PATH });

createServer(async (req, res) => {
  Log.debug(
    `${req.socket.remoteAddress} => ${req.method} ${req.headers.host}${req.url}`
  );

  const end = (statusCode: number, message: string) => {
    res
      .writeHead(statusCode, { "Content-Type": "application/json" })
      .end(message);
  };

  const next = (err: any = undefined) => {
    if (err) {
      Log.error(err);
      end(500, `{"error":"Internal server error"}`);
      return;
    }
    if (!res.headersSent) {
      end(404, `{"error":"Unknown route: ${req.method} ${req.url}"}`);
    }
  };

  if (await middleware(req, res, next).catch(next)) return;

  next();
}).listen(Number(PORT), undefined, () =>
  console.log(`Server stared on port ${PORT}`)
);
