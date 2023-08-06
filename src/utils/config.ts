import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'

config()

// prettier-ignore
export const {
  /* one is required */
  WEBHOOK_SECRET_FILE,
  WEBHOOK_SECRET: WEBHOOK_SECRET_SRC,

  /* server */
  PORT = "8000",
  WEBHOOK_PATH = "/",

  /* docker */
  DOCKER_SOCKET_PATH = "/var/run/docker.sock",
  DOCKER_IMAGE_BLACKLIST: DOCKER_IMAGE_BLACKLIST_SRC = "ghcr.io/lucarickli/ghcr-hook", // list seperated by whitespaces.
  DOCKER_IMAGE_REGEX: DOCKER_IMAGE_REGEX_SRC = "^ghcr.io\/([a-z0-9._-]{1,39})\/([a-z0-9._-]{1,100}):([a-z0-9._-]{1,100})$",

  /* retry */
  DEFAULT_RETRY_COUNT = 3,
  DEFAULT_RETRY_DELAY = 500, // ms

  /* log */
  LOG_LEVEL = "info", // main log level.
  LOG_PATH = join(__dirname, "/logs"),
  ERR_LOG_LEVEL = "warn", // written to "LOGPATH/err.log".
  ACCESS_LOG_LEVEL = "info", // written to "LOGPATH/access.log".

  /* internal */
  NODE_ENV,
} = process.env;

export const WEBHOOK_SECRET = WEBHOOK_SECRET_FILE
  ? (readFileSync(WEBHOOK_SECRET_FILE, 'utf-8')?.trim() as string)
  : (WEBHOOK_SECRET_SRC as string)

if (!WEBHOOK_SECRET) throw new Error('WEBHOOK_SECRET is required!')

export const ERR_LOG_FILE = join(LOG_PATH, '/err.log')
export const ACCESS_LOG_FILE = join(LOG_PATH, '/access.log')

export const DOCKER_IMAGE_REGEX = new RegExp(DOCKER_IMAGE_REGEX_SRC)
export const DOCKER_IMAGE_BLACKLIST = DOCKER_IMAGE_BLACKLIST_SRC.toLowerCase().trim().split(/ /g); // prettier-ignore
export const IS_IMAGE_BLACKLISTED = (img: string): boolean => DOCKER_IMAGE_BLACKLIST.includes(img.toLowerCase()); // prettier-ignore
