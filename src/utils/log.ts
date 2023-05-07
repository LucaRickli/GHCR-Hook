import { DEBUG } from "./config";

const prefix = "[webhook]";
const timestamp = () => `[${new Date(Date.now()).toLocaleString()}]`;

export class Log {
  public static debug(...args: any[]) {
    if (DEBUG) console.debug(prefix + timestamp(), ...args);
  }

  public static log(...args: any[]) {
    console.log(prefix + timestamp(), ...args);
  }

  public static error(...args: any[]) {
    console.error(prefix + timestamp(), ...args);
  }

  public static info(...args: any[]) {
    console.info(prefix + timestamp(), ...args);
  }
}
