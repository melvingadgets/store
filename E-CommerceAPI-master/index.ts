import path from "path";
import express from "express";
import type { Server } from "http";
import { mainApp } from "./mainApp";
import "./database/database";
import Db from "./database/database";
import { env } from "./config/env";

let server: Server | undefined;
const app = express();

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection", reason);

  if (server) {
    server.close(() => process.exit(1));
    return;
  }

  process.exit(1);
});

const startServer = async () => {
  try {
    await Db;
    mainApp(app);

    app.set("view engine", "ejs");
    app.set("views", path.resolve(process.cwd(), "Views"));

    server = app.listen(env.port, () => {
      console.log(`Server listening on port ${env.port}`);
    });
  } catch {
    console.log("Database isnt Connecting");
  }
};

void startServer();
