import { DEFAULT_RETRY_COUNT, DEFAULT_RETRY_DELAY } from "./config";
import { Log } from "./log";

declare global {
  interface PromiseConstructor {
    retry<T>(
      executor: (
        resolve: (value: T) => void,
        reject: (reason?: any) => void
      ) => void,
      retries?: number,
      timeout?: number
    ): Promise<T>;
  }
}

Object.defineProperty(Promise, "retry", {
  configurable: true,
  writable: true,
  value: async function retry<T>(
    executor: (
      resolve: (value: T) => void,
      reject: (reason?: any) => void
    ) => void,
    retries: number = Number(DEFAULT_RETRY_COUNT),
    timeout: number = Number(DEFAULT_RETRY_DELAY)
  ): Promise<T> {
    if (typeof retries !== "number") {
      throw new TypeError("retries is not a number");
    }

    return new Promise<T>(executor).catch((err) => {
      Log.warn(
        `Promise error (${retries} ${
          retries === 1 ? "retry" : "retries"
        } left). Reason:`,
        err
      );
      return retries <= 0
        ? Promise.reject(err)
        : typeof timeout === "number" && timeout > 0
        ? new Promise((r) => setTimeout(r, timeout)).then(() =>
            Promise.retry(executor, retries - 1, timeout)
          )
        : Promise.retry(executor, retries - 1, timeout);
    });
  },
});
