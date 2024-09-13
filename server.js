import { createServer } from "http";
import next from "next";
import fs from "fs";
import morgan from "morgan";
import { Server } from "socket.io";
import logger from "./logger.js";
import {
  handleFirstScan,
  handleSecondScan,
} from "./services/serialPortService.js";
import { MockSerialPort } from "./services/mockSerialPort.js";
import { fileURLToPath } from "url";
import path, { dirname, parse } from "path";
import { getCurrentDate } from "./services/scanUtils.js";
import {
  connect,
  readBit,
  readRegister,
  writeBit,
  writeRegister,
} from "./services/modbus.js";
import { manualRun } from "./services/manualRunService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const MODBUS_IP = process.env.NEXT_PUBLIC_MODBUS_IP;
const MODBUS_PORT = parseInt(process.env.NEXT_PUBLIC_MODBUS_PORT, 10);

console.log({ MODBUS_IP, MODBUS_PORT });

app.prepare().then(() => {
  const server = createServer((req, res) => {
    morgan("combined", {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })(req, res, (err) => {
      if (err) {
        res.statusCode = 500;
        res.end("Internal Server Error");
        return;
      }
      handle(req, res);
    });
  });

  const io = new Server(server);

  io.on("connection", (socket) => {
    let intervalId = null;
    logger.info(`New client connected: ${socket.id}`);

    socket.on("request-csv-data", () => {
      sendCsvDataToClient(socket);
    });

    socket.on(
      "request-modbus-data",
      async ({ register, bits, interval = 1000 }) => {
        // Clear any existing interval for this socket
        if (intervalId) {
          clearInterval(intervalId);
        }

        // Set up periodic polling
        // intervalId = setInterval(async () => {
        //   await sendModbusDataToClientBits(socket, register, bits);
        // }, interval);

        // Initial data send
        await sendModbusDataToClientBits(socket, register, bits);
      }
    );

    socket.on("stop-modbus-data", () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    });

    socket.on("disconnect", () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      logger.info(`Client disconnected: ${socket.id}`);
    });

    socket.on("write-modbus-register", async ({ address, bit, value }) => {
      try {
        await writeModbusBit(address, bit, value);
        logger.info(
          `Client ${socket.id} wrote value ${value} to register ${address}, bit ${bit}`
        );
        socket.emit("writeSuccess", { address, bit, value });
      } catch (error) {
        logger.error(
          `Error writing to register for client ${socket.id}:`,
          error
        );
        socket.emit("error", {
          message: "Failed to write to register",
          details: error.message,
        });
      }
    });

    socket.on("manual-run", async (operation) => {
      try {
        const result = await manualRun(operation);
        logger.info(`Client ${socket.id} triggered manual run: ${operation}`);
        socket.emit("manualRunSuccess", { operation, result });
      } catch (error) {
        logger.error(
          `Error executing manual run for client ${socket.id}:`,
          error
        );
        socket.emit("error", {
          message: "Failed to execute manual run",
          details: error.message,
        });
      }
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, async (err) => {
    if (err) {
      logger.error("Server failed to start: %s", err.message);
      throw err;
    }
    logger.info(`> Server ready on http://localhost:${PORT}`);

    // initSerialPort(io);
    // watchCodeFile();

    // Initialize Modbus connection once
    try {
      await connect();
      logger.info("Modbus connection initialized");
      // runContinuousScan().catch((error) => {
      //   logger.error("Continuous scan process crashed:", error);
      // });
      // await runContinuousScan();
    } catch (error) {
      logger.error("Failed to initialize Modbus connection:", error);
    }
  });

  server.on("error", (err) => {
    logger.error("Server error: %s", err.message);
  });

  server.on("close", () => {
    logger.info("Server closed");
  });

  async function sendModbusDataToClient(socket, readRange) {
    try {
      const [start, length] = readRange;
      logger.info(
        `Client ${socket.id} requested read: start=${start}, length=${length}`
      );

      // const registers = await readRegister(start, length);
      const registers = await readRegister(start, length - start + 1);

      logger.info(
        `Read successful for client ${socket.id}: ${JSON.stringify(registers)}`
      );
      socket.emit("modbus-data", { registers });
    } catch (error) {
      logger.error(`Error reading registers for client ${socket.id}:`, error);
      socket.emit("error", {
        message: "Failed to read registers",
        details: error.message,
      });
    }
  }

  async function writeModbusBit(address, bit, value) {
    await writeBit(address, bit, value);
  }

  async function sendModbusDataToClientBits(socket, register, bits) {
    try {
      const [registerValue] = await readRegister(register, 1);
      const bitValues = {};

      for (const bit of bits) {
        bitValues[bit] = await readBit(register, bit);
      }

      socket.emit("modbus-data", {
        register,
        value: registerValue,
        bits: bitValues,
      });
    } catch (error) {
      logger.error(`Error reading register for client ${socket.id}:`, error);
      socket.emit("error", {
        message: "Failed to read register",
        details: error.message,
      });
    }
  }

  async function runContinuousScan() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        // First scan
        logger.info("Starting first scan...");
        await handleFirstScan(io);

        // Second scan
        logger.info("Starting second scan...");
        await handleSecondScan(io);

        logger.info("Scan cycle completed");
      } catch (error) {
        logger.error("Error during scan cycle:", error);
      }

      // Optional: Add a small delay between cycles if needed
      // await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async function writeModbusRegister(address, value) {
    await writeRegister(address, value);
  }

  // Set up periodic updates if needed
  // setInterval(updateModbusData, 1000); // Update every second

  function sendCsvDataToClient(socket) {
    const fileName = `${getCurrentDate()}.csv`;
    const filePath = path.join(__dirname, "data", fileName);

    console.log({ fileName });

    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      console.log("File is accessible");
    } catch (err) {
      console.error("File is not accessible:", err);
      return;
    }

    if (fs.existsSync(filePath)) {
      fs.readFile(filePath, "utf8", (err, data) => {
        if (err) {
          logger.error("Error reading CSV file: ", err.message);
          return;
        }

        // Split the data by line breaks to get each row
        const rows = data.trim().split("\n");

        if (rows.length === 0) {
          logger.info("CSV file is empty.");
          return;
        }

        // Extract the header row
        const header = rows[0];

        // Extract and reverse the remaining rows
        const dataRows = rows
          .slice(1)
          .map((row) => row.split(",").map((cell) => cell.replace(/"/g, "")))
          .reverse(); // Reverse the order starting from the second row

        // Combine the header with the reversed data rows
        const csvData = [header.split(","), ...dataRows];

        socket.emit("csv-data", {
          csvData,
        });
        logger.info(`Emitted current date CSV data to client: ${socket.id}`);
      });
    } else {
      logger.info(`No CSV file found for ${fileName}.`);
    }
  }
});
