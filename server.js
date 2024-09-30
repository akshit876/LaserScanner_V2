import { createServer } from "http";
import next from "next";
import fs from "fs";
import morgan from "morgan";
import { Server } from "socket.io";
import logger from "./logger.js";
import {
  handleFirstScan,
  handleSecondScan,
  // initSerialPort,
  watchCodeFile,
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
import mongoDbService from "./services/mongoDbService.js";
import { runContinuousScan } from "./services/testCycle.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const MODBUS_IP = process.env.NEXT_PUBLIC_MODBUS_IP;
const MODBUS_PORT = parseInt(process.env.NEXT_PUBLIC_MODBUS_PORT, 10);

console.log({ MODBUS_IP, MODBUS_PORT });

function emitErrorEvent(socket, errorType, errorMessage) {
  if (socket) {
    socket.emit("error", {
      type: errorType,
      message: errorMessage,
    });
  }
  logger.error(`${errorType}: ${errorMessage}`);
}

// Server-side normalization function
const normalizeServoSettings = (settings) => {
  const normalized = {};
  for (const [key, value] of Object.entries(settings)) {
    if (key === "fwdEndLimit" || key === "revEndLimit") {
      normalized[key] = {
        register: value.register,
        value: value.value,
      };
    } else {
      normalized[key] = {
        position: {
          register:
            typeof value.position === "object" ? value.position.register : "",
          value:
            typeof value.position === "object"
              ? value.position.value
              : value.position,
        },
        speed: {
          register: value.speed.register,
          value: value.speed.value,
        },
      };
    }
  }
  return normalized;
};

// function floatToInt(value) {
//   return Math.round(parseFloat(value) * 100);
// }
function floatToInt(value, isSpeed = false) {
  if (isSpeed) {
    // For speed, just convert to integer directly
    return Math.round(parseFloat(value));
  } else {
    // For position, remove decimal and concatenate
    return Math.round(parseFloat(value) * 100);
  }
}
// function floatToInt(value) {
//   // Remove the decimal point, concatenate all digits, and convert to integer
//   return parseInt(value.toString().replace(".", ""), 10);
// }

// Mock functions for hardware communication (replace with actual hardware functions)
const readServoSetting = async (register) => {
  // This should be replaced with actual hardware communication
  console.log({ register });
  const d = await readRegister(register, 1);
  return d[0];
};

const writeServoSetting = async (register, value) => {
  // This should be replaced with actual hardware communication
  return await writeRegister(register, value);
};

const servoSettings = {
  homePosition: {
    position: { register: "550", value: 0 },
    speed: { register: "552", value: 0 },
  },
  scannerPosition: {
    position: { register: "554", value: 0 },
    speed: { register: "556", value: 0 },
  },
  ocrPosition: {
    position: { register: "558", value: 0 },
    speed: { register: "560", value: 0 },
  },
  markPosition: {
    position: { register: "562", value: 0 },
    speed: { register: "564", value: 0 },
  },
  fwdEndLimit: { register: "574", value: 0 },
  revEndLimit: { register: "578", value: 0 },
};

const updateServoSettings = async () => {
  console.log({ servoSettings });
  // debugger;
  for (const [key, value] of Object.entries(servoSettings)) {
    if (typeof value === "object" && value !== null) {
      if ("position" in value && "speed" in value) {
        value.position.value = await readServoSetting(
          parseInt(value.position.register, 10)
        );
        value.speed.value = await readServoSetting(
          parseInt(value.speed.register, 10)
        );
      } else {
        value.value = await readServoSetting(parseInt(value.register, 10));
      }
    }
  }
};

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
      // sendCsvDataToClient(socket);
      mongoDbService
        .sendMongoDbDataToClient(socket, "main-data", "records")
        .catch((error) => {
          console.error("Error in sendMongoDbDataToClient:", error);
        });
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

    socket.on("servo-setting-change", async (data) => {
      try {
        const { setting, value } = data;

        if (!servoSettings[setting]) {
          throw new Error("Invalid setting");
        }

        let register, intValue;
        const isEndLimit =
          setting === "fwdEndLimit" || setting === "revEndLimit";

        if (isEndLimit) {
          register = servoSettings[setting].register;
          intValue = floatToInt(value);
          servoSettings[setting].value = value;
        } else {
          const subSetting = value?.hasOwnProperty("position")
            ? "position"
            : "speed";
          register = servoSettings[setting][subSetting].register;
          intValue = floatToInt(value[subSetting], subSetting === "speed");
          servoSettings[setting][subSetting].value = value[subSetting];
        }

        await writeRegister(parseInt(register, 10), intValue);

        logger.info(
          `Client ${socket.id} updated ${setting} to ${JSON.stringify(value)} (written as ${intValue} to register ${register})`
        );

        socket.emit("servo-setting-change-response", {
          success: true,
          setting,
        });

        // Broadcast the updated settings to all connected clients
        io.emit("servo-settings-update", servoSettings);
      } catch (error) {
        logger.error(
          `Error updating servo setting for client ${socket.id}:`,
          error
        );
        socket.emit("servo-setting-change-response", {
          success: false,
          setting: data.setting,
          message: error.message,
        });
      }
    });

    socket.on("request-servo-settings", async () => {
      try {
        await updateServoSettings();
        const normalizedSettings = normalizeServoSettings(servoSettings);
        socket.emit("servo-settings-update", normalizedSettings);
      } catch (error) {
        logger.error("Error fetching servo settings:", error);
        socket.emit("error", { message: "Failed to fetch servo settings" });
      }
    });

    socket.on("servo-setting-change", async ({ setting, value }) => {
      try {
        const settingObj = servoSettings[setting];
        if (settingObj) {
          if (typeof value === "object") {
            for (const [subKey, subValue] of Object.entries(value)) {
              await writeServoSetting(
                settingObj[subKey].register,
                parseFloat(subValue)
              );
              settingObj[subKey].value = parseFloat(subValue);
            }
          } else {
            await writeServoSetting(settingObj.register, parseFloat(value));
            settingObj.value = parseFloat(value);
          }
          socket.emit("servo-setting-change-response", {
            key: setting,
            success: true,
          });
        } else {
          throw new Error("Invalid setting");
        }
      } catch (error) {
        logger.error(`Error changing servo setting ${setting}:`, error);
        socket.emit("servo-setting-change-response", {
          key: setting,
          success: false,
        });
      }
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, async (err) => {
    if (err) {
      emitErrorEvent(io, "server-start-failure", JSON.stringify(err));
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

      // Make sure to call this function when your application starts
      // runContinuousScan(io).catch((error) => {
      //   logger.error("Failed to start continuous scan:", error);
      //   process.exit(1);
      // });

      // /-----------------------------------------------------------
      // await runContinuousScan();
      // setInterval(() => {
      //   emitErrorEvent(io, "errorType", "errorMessage");
      // }, 5000);
    } catch (error) {
      emitErrorEvent(io, "modbus-connection-error", JSON.stringify(error));
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
      // socket.emit("error", {
      //   message: "Failed to read register",
      //   details: error.message,
      // });
      emitErrorEvent(io, "register-read-failure", "Failed to read register");
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

// Handle graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT. Closing MongoDB connection and exiting...");
  await mongoDbService.disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM. Closing MongoDB connection and exiting...");
  await mongoDbService.disconnect();
  process.exit(0);
});
