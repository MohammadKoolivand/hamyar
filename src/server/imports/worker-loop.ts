import { MongoNetworkError, MongoServerSelectionError } from "mongodb";

export async function workerLoop(options: {
  running: () => boolean;
  cycle: () => Promise<boolean>;
  pause: (milliseconds: number) => Promise<void>;
  onReconnect: () => void;
}) {
  let delay = 1500;
  while (options.running()) {
    try {
      const worked = await options.cycle();
      delay = 1500;
      if (!worked && options.running()) await options.pause(1500);
    } catch (error) {
      // Pool-cleared errors inherit MongoNetworkError. The driver reconnects;
      // durable job leases, not this loop, decide whether a job may run again.
      if (
        !(error instanceof MongoNetworkError) &&
        !(error instanceof MongoServerSelectionError)
      )
        throw error;
      options.onReconnect();
      if (options.running()) await options.pause(delay);
      delay = Math.min(delay * 2, 30000);
    }
  }
}
