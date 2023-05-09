import { DEFAULT_RETRY_COUNT, DEFAULT_RETRY_TIMEOUT } from "./config";
import { Log } from "./log";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function retry<T>(
  promise: Promise<T>,
  maxAttempts: number = Number(DEFAULT_RETRY_COUNT),
  timeout: number = Number(DEFAULT_RETRY_TIMEOUT)
): Promise<T> {
  let attempts = 0;
  return (async function run() {
    try {
      attempts++;
      const result = await promise;
      return result;
    } catch (err) {
      Log.warn(`Promise error (${attempts} / ${maxAttempts}). Reason:`, err);
      if (attempts >= maxAttempts) return Promise.reject(err);
      if (timeout) await wait(timeout);
      await run();
    }
  })();
}
