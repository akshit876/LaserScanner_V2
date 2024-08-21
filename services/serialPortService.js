/* eslint-disable @typescript-eslint/no-var-requires */
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const logger = require("./logging"); // Import the logger

let buffer = "";
let scanResults = [];

// Function to get the current date as a string for the file name
function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Function to save data to an Excel file
async function saveToExcel(data) {
  const fileName = `${getCurrentDate()}.xlsx`;
  const filePath = path.join(__dirname, "../data", fileName); // Save files in a 'data' directory

  const workbook = new ExcelJS.Workbook();
  let worksheet;

  if (fs.existsSync(filePath)) {
    await workbook.xlsx.readFile(filePath);
    worksheet = workbook.getWorksheet(1);
  } else {
    worksheet = workbook.addWorksheet("Scan Results");
    worksheet.columns = [
      { header: "Timestamp", key: "timestamp", width: 20 },
      { header: "Scan Data", key: "data", width: 30 },
    ];
  }

  data.forEach((item) => {
    worksheet.addRow({
      timestamp: item.timestamp,
      data: item.data,
    });
  });

  await workbook.xlsx.writeFile(filePath);
  logger.info(`Data saved to ${fileName}`);
}

// Function to initialize and handle the serial port connection
function initSerialPort() {
  const port = new SerialPort({
    path: process.env.SERIAL_PORT || "COM4",
    baudRate: parseInt(process.env.BAUD_RATE, 10) || 9600,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    autoOpen: false,
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: "\r" }));

  port.open((err) => {
    if (err) {
      logger.error("Error opening port: %s", err.message);
      return;
    }
    logger.info("Serial port opened");
  });

  parser.on("data", async (data) => {
    buffer += data.toString();

    let parts = buffer.split(/(NG|\r)/);

    while (parts.length > 1) {
      let part = parts.shift().trim();
      if (part) {
        const timestamp = new Date().toISOString();
        scanResults.push({ timestamp, data: part });
        logger.info("Received data: %s", part);
      }
      let delimiter = parts.shift().trim();
      if (delimiter === "NG") {
        const timestamp = new Date().toISOString();
        scanResults.push({ timestamp, data: delimiter });
        logger.info("Received delimiter: %s", delimiter);
      }
    }

    buffer = parts.length ? parts[0] : "";

    try {
      await saveToExcel(scanResults);
      scanResults.length = 0;
    } catch (err) {
      logger.error("Error saving to Excel: %s", err.message);
    }
  });

  port.on("error", (err) => {
    logger.error("Error: %s", err.message);
  });

  port.on("close", () => {
    logger.info("Serial port closed");
  });

  port.on("open", () => {
    logger.info("Port is open and ready to read data");
  });

  port.on("disconnect", () => {
    logger.info("Port disconnected");
  });

  port.on("drain", () => {
    logger.info("Port drain event");
  });

  port.on("flush", () => {
    logger.info("Port flush event");
  });

  return port;
}

module.exports = { initSerialPort };
