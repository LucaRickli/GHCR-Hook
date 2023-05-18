import { createServer } from "http";
import { createNodeMiddleware } from "@octokit/webhooks";

import "./utils/retryPromise";
import { webhooks } from "./controller/webhook";
import { WEBHOOK_PATH, PORT } from "./utils/config";
import { AccessLog, Log } from "./utils/log";

const middleware = createNodeMiddleware(webhooks, { path: WEBHOOK_PATH });

createServer(async (req, res) => {
  AccessLog.debug(
    `${req.socket.remoteAddress} => ${req.method} ${req.headers.host}${req.url}`
  );

  // prettier-ignore
  const end = (status: number, msg: string) => res.writeHead(status, { "Content-Type": "application/json" }).end(`{"error":"${msg}"}`);

  const next = (err: any = undefined) => {
    if (err) {
      Log.error("Middleware error:", err);
      end(500, `Internal server error`);
    } else if (!res.headersSent) {
      const msg = `Unknown route: ${req.method} ${req.url}`;
      Log.debug(msg);
      end(404, msg);
    }
  };

  if (!(await middleware(req, res, next).catch(next))) next();
}).listen(Number(PORT), undefined, () => {
  Log.info(`Server started on port ${PORT}`);
});
