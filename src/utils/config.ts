import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

config();

export const {
  NODE_ENV,
  PORT = "8000",
  SOCKET_PATH = "/var/run/docker.sock",
  WEBHOOK_SECRET: WEBHOOK_SECRET_SRC,
  WEBHOOK_SECRET_FILE,
  WEBHOOK_PATH = "/",
  DEFAULT_RETRY_COUNT = "3",
  DEFAULT_RETRY_TIMEOUT = "250", // ms
  LOG_LEVEL = "info",
  LOG_PATH = join(__dirname, "/logs"),
  ERR_LOG_LEVEL = "warn",
  ACCESS_LOG_LEVEL = "info",
} = process.env;

export const ERR_LOG_FILE = join(LOG_PATH, "/err.log");
export const ACCESS_LOG_FILE = join(LOG_PATH, "/access.log");

export const WEBHOOK_SECRET = WEBHOOK_SECRET_FILE
  ? readFileSync(WEBHOOK_SECRET_FILE, "utf-8").trim()
  : WEBHOOK_SECRET_SRC;

if (!WEBHOOK_SECRET) throw new Error("WEBHOOK_SECRET is required!");
