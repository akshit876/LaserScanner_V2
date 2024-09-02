export const MODBUS_ADDRESSES = {
  INPUT_START: parseInt(process.env.NEXT_PUBLIC_READ_START_1 || "1400", 10),
  OUTPUT_START: parseInt(process.env.NEXT_PUBLIC_READ_START_2 || "1404", 10),
  SOFTWARE_PLC_INPUT_START: parseInt(
    process.env.NEXT_PUBLIC_READ_START_3 || "1410",
    10
  ),
  SOFTWARE_PLC_OUTPUT_START: parseInt(
    process.env.NEXT_PUBLIC_READ_START_4 || "1414",
    10
  ),
};

export const MODBUS_BITS = {
  INPUT: Array.from({ length: 16 }, (_, i) => i),
  OUTPUT: Array.from({ length: 16 }, (_, i) => i),
  SOFTWARE_PLC_INPUT: Array.from({ length: 16 }, (_, i) => i),
  SOFTWARE_PLC_OUTPUT: Array.from({ length: 16 }, (_, i) => i),
};

export const SECTION_LABELS = {
  INPUT: [
    "Start pushbutton -1",
    "Start pushbutton - 2",
    "Emergency Stop push button",
    "Safety Sensor",
    "Marking Complete",
    "Part Presence",
    "Scanner Read OK",
    "Read OCR OK",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
  ],
  OUTPUT: [
    "Marking Start",
    "Scanner Trigger",
    "OCR Camera Trigger",
    "Spare",
    "Spare",
    "Spare",
    "Tower Light Red",
    "Tower Light Green",
    "Tower Light Yellow",
    "Work Light",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
  ],
  SOFTWARE_PLC_INPUT: [
    "scanner data receive ok",
    "data sent to laser text file",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
    "result ok",
    "result ng",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
  ],
  SOFTWARE_PLC_OUTPUT: [
    "Marking start",
    "Scanner Trigger",
    "OCR Trigger",
    "Work Light",
    "Servo home",
    "Servo Scanner position",
    "Servo OCR Position",
    "Servo Marking Position",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
    "Spare",
  ],
};

export const MANUAL_RUN_OPERATIONS = [
  { name: "Marking Start", operation: "markingStart" },
  { name: "Scanner Trigger", operation: "scannerTrigger" },
  { name: "OCR Trigger", operation: "ocrTrigger" },
  { name: "Work Light", operation: "workLight" },
  { name: "Servo Home", operation: "servoHome" },
  { name: "Servo Scanner Position", operation: "servoScannerPosition" },
  { name: "Servo OCR Position", operation: "servoOcrPosition" },
  { name: "Servo Marking Position", operation: "servoMarkingPosition" },
];
