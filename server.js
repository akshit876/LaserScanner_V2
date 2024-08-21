/* eslint-disable @typescript-eslint/no-var-requires */
const { createServer } = require("http");
const next = require("next");
const morgan = require("morgan");
const { initSerialPort } = require("./services/serialPortService");
const logger = require("./services/logging");
require("dotenv").config();

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  server.on(
    "request",
    morgan("combined", {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    }),
  );

  server.listen(process.env.PORT || 3000, (err) => {
    if (err) {
      logger.error("Server failed to start: %s", err.message);
      throw err;
    }
    logger.info(
      `> Server ready on http://localhost:${process.env.PORT || 3000}`,
    );

    // Initialize the serial port service after the server starts
    initSerialPort();
  });
});
