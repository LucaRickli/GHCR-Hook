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
  DEFAULT_RETRY_COUNT = 3,
  DEFAULT_RETRY_TIMEOUT = 500, // ms
  LOG_LEVEL = "info", // main log level.
  LOG_PATH = join(__dirname, "/logs"),
  ERR_LOG_LEVEL = "warn", // written to "LOGPATH/logs/err.log".
  ACCESS_LOG_LEVEL = "info", /// set to debug to log every request made to the server.
  IMAGE_BLACKLIST: IMAGE_BLACKLIST_SRC = "ghcr.io/lucarickli/ghcr-hook", // list seperated by whitespaces.
  DOCKER_IMAGE_REGEX:
    DOCKER_IMAGE_REGEX_SRC = "^ghcr.io/([a-z0-9._-]{1,39})/([a-z0-9._-]{1,100}):([a-z0-9._-]{1,100})$",
  NODE_ENV,
} = process.env;

export const ERR_LOG_FILE = join(LOG_PATH, "/err.log");
export const ACCESS_LOG_FILE = join(LOG_PATH, "/access.log");

export const WEBHOOK_SECRET = WEBHOOK_SECRET_FILE
  ? readFileSync(WEBHOOK_SECRET_FILE, "utf-8").trim()
  : WEBHOOK_SECRET_SRC;

export const IMAGE_BLACKLIST = IMAGE_BLACKLIST_SRC.toLowerCase().split(/ /g);

export const IS_IMAGE_BLACKLISTED = (img: string): boolean =>
  IMAGE_BLACKLIST.includes(img.toLowerCase());

export const DOCKER_IMAGE_REGEX = new RegExp(DOCKER_IMAGE_REGEX_SRC);

if (!WEBHOOK_SECRET) throw new Error("WEBHOOK_SECRET is required!");
