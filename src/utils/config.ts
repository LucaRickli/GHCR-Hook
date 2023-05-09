import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

config();

export const {
  WEBHOOK_SECRET: WEBHOOK_SECRET_SRC,
  WEBHOOK_SECRET_FILE,
  PORT = "8000",
  SOCKET_PATH = "/var/run/docker.sock",
  WEBHOOK_PATH = "/",
  DEFAULT_RETRY_COUNT = "3",
  DEFAULT_RETRY_TIMEOUT = "250", // ms
  LOG_LEVEL = "info",
  LOG_PATH = join(__dirname, "/logs"),
  ERR_LOG_LEVEL = "warn",
  ACCESS_LOG_LEVEL = "info",
  IMAGE_BLACKLIST: IMAGE_BLACKLIST_SRC = "ghcr.io/lucarickli/ghcr-hook", // list seperated by whitespaces.
  NODE_ENV,
} = process.env;

export const ERR_LOG_FILE = join(LOG_PATH, "/err.log");
export const ACCESS_LOG_FILE = join(LOG_PATH, "/access.log");

export const WEBHOOK_SECRET = WEBHOOK_SECRET_FILE
  ? readFileSync(WEBHOOK_SECRET_FILE, "utf-8").trim()
  : WEBHOOK_SECRET_SRC;

export const IMAGE_BLACKLIST = IMAGE_BLACKLIST_SRC.toLowerCase().split(" ");

export const IS_IMAGE_BLACKLISTED = (img: string): boolean =>
  IMAGE_BLACKLIST.includes(img.toLowerCase());

if (!WEBHOOK_SECRET) throw new Error("WEBHOOK_SECRET is required!");
