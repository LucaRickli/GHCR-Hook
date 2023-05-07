import { config } from "dotenv";
config();

if (!process.env.WEBHOOK_SECRET) throw new Error("WEBHOOK_SECRET is required!");

export const {
  NODE_ENV,
  PORT = "8000",
  SOCKET_PATH = "/var/run/docker.sock",
  WEBHOOK_SECRET,
  WEBHOOK_PATH = "/",
  DEBUG: DEBUG_SRC,
} = process.env;

export const DEBUG = DEBUG_SRC?.split(/,/g).includes("webhooks");
