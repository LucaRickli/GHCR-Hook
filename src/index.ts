import { createServer } from "http";
import { createNodeMiddleware } from "@octokit/webhooks";

import { webhooks } from "./controller/webhook";
import { WEBHOOK_PATH, PORT } from "./utils/config";
import { AccessLog, Log } from "./utils/log";

const middleware = createNodeMiddleware(webhooks, { path: WEBHOOK_PATH });

createServer(async (req, res) => {
  AccessLog.debug(
    `${req.socket.remoteAddress} => ${req.method} ${req.headers.host}${req.url}`
  );

  const end = (statusCode: number, message: string) => {
    res
      .writeHead(statusCode, { "Content-Type": "application/json" })
      .end(message);
  };

  const next = (err: any = undefined) => {
    if (err) {
      Log.error("Middleware error:", err);
      end(500, `{"error":"Internal server error"}`);
    } else if (!res.headersSent) {
      end(404, `{"error":"Unknown route: ${req.method} ${req.url}"}`);
    }
  };

  if (!(await middleware(req, res, next).catch(next))) next();
}).listen(Number(PORT), undefined, () => {
  Log.info(`Server started on port ${PORT}`);
});
