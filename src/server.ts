import { createApp } from "./app";
import { connectDb, disconnectDb } from "./config/db";
import { env } from "./config/env";

async function main(): Promise<void> {
  await connectDb();
  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log(`TLM Site Operations API listening on port ${env.port}`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down gracefully...`);
    const forceExit = setTimeout(() => {
      console.error("Shutdown timed out; forcing exit");
      process.exit(1);
    }, 10_000);
    forceExit.unref();
    server.close(async () => {
      await disconnectDb().catch(() => undefined);
      clearTimeout(forceExit);
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
