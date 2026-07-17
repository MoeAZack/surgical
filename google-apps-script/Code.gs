/**
 * Google Apps Script Backend for Surgical Case Tracker
 * Serves the HTML UI and acts as the relational database using Google Sheets.
 * Place this in Code.gs inside your Apps Script project.
 */

// Initialize Spreadsheet and Sheets on first load
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Surgical Tracker')
    .addItem('Initialize Database Sheets', 'initDatabase')
    .addToUi();
}

/**
 * Creates the required sheets with correct headers if they don't exist.
 */
function initDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = {
    'Operations': ['PatientID', 'Age', 'OperationDate', 'Procedure', 'Surgeon', 'DrainPlaced', 'Notes', 'id', 'CreatedAt', 'CreatedBy'],
    'Drains': ['PatientID', 'RemovedDate', 'RemovedBy', 'id'],
    'Complications': ['PatientID', 'Complication', 'Grade', 'DateDetected', 'Management', 'Resolved', 'ResolvedDate', 'id'],
    'Followups': ['PatientID', 'M1', 'M3', 'M6', 'M12', 'FinalOutcome', 'id'],
    'Checks': ['PatientID', 'Item', 'Done', 'id'],
    'Appointments': ['PatientID', 'Date', 'Time', 'Type', 'Notes', 'Status', 'CreatedBy', 'id'],
    'Lists': ['Type', 'Item'],
    'Config': ['Key', 'Value']
  };

  for (const sheetName in sheets) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(sheets[sheetName]);
      // Format header row
      sheet.getRange(1, 1, 1, sheets[sheetName].length)
        .setFontWeight('bold')
        .setBackground('#0A2E2A')
        .setFontColor('white');
    }
  }

  // Seed default lists if empty
  seedDefaultLists();
  seedDefaultConfig();
  
  SpreadsheetApp.getUi().alert('Database initialized successfully! All tables created.');
}

function seedDefaultLists() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Lists');
  if (sheet.getLastRow() > 1) return; // already seeded

  const defaults = [
    ['surgeons', 'Dr. A'],
    ['surgeons', 'Dr. B'],
    ['procedures', 'Liposuction'],
    ['procedures', 'Abdominoplasty'],
    ['procedures', 'Breast Augmentation'],
    ['procedures', 'Breast Reduction'],
    ['procedures', 'Mastopexy'],
    ['procedures', 'Augmentation-Mastopexy'],
    ['procedures', 'Gynecomastia Correction'],
    ['procedures', 'Fat Transfer / BBL'],
    ['procedures', 'Brachioplasty'],
    ['procedures', 'Thigh Lift'],
    ['procedures', 'Rhinoplasty'],
    ['procedures', 'Blepharoplasty'],
    ['procedures', 'Facelift / Neck Lift'],
    ['procedures', 'Other'],
    ['complications', 'Seroma'],
    ['complications', 'Hematoma'],
    ['complications', 'Infection'],
    ['complications', 'Wound Dehiscence'],
    ['complications', 'Capsular Contracture'],
    ['complications', 'Implant Rupture/Malposition'],
    ['complications', 'Fat Necrosis'],
    ['complications', 'Skin/Flap Necrosis'],
    ['complications', 'Asymmetry/Contour Irregularity'],
    ['complications', 'Hypertrophic Scar/Keloid'],
    ['complications', 'DVT/PE'],
    ['complications', 'Fat Embolism'],
    ['complications', 'Other'],
    ['checklist', 'Consent signed'],
    ['checklist', 'Pre-op photos taken'],
    ['checklist', 'Pre-op labs reviewed'],
    ['checklist', 'Prophylactic antibiotics'],
    ['checklist', 'Post-op instructions given']
  ];

  defaults.forEach(row => sheet.appendRow(row));
}

function seedDefaultConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Config');
  if (sheet.getLastRow() > 1) return; // already seeded

  const defaults = [
    ['DrainAlertDays', '7'],
    ['FU1', '1'],
    ['FU2', '3'],
    ['FU3', '6'],
    ['FU4', '12']
  ];

  defaults.forEach(row => sheet.appendRow(row));
}

/**
 * Serves the web app UI
 */
function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('Surgical Case Tracker')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Generic sheet reader helper. Returns array of objects mapped by header.
 */
function readSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  return values.map((row, rIdx) => {
    const obj = { _row: rIdx + 2 }; // _row matches index in sheet (1-indexed + header)
    headers.forEach((header, cIdx) => {
      let val = row[cIdx];
      // Convert dates to ISO string format for JSON transmission
      if (val instanceof Date) {
        obj[header] = val.toISOString().split('T')[0];
      } else {
        obj[header] = val;
      }
    });
    return obj;
  });
}

/**
 * Fetch all database tables and configuration in a single payload.
 */
function getAllData() {
  try {
    // Auto initialize if sheets are missing
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss.getSheetByName('Operations')) {
      initDatabase();
    }

    const operations = readSheet('Operations');
    const drains = readSheet('Drains');
    const complications = readSheet('Complications');
    const followup = readSheet('Followups');
    const checks = readSheet('Checks');
    const appointments = readSheet('Appointments');

    // Parse lists
    const rawLists = readSheet('Lists');
    const lists = {
      surgeons: rawLists.filter(l => l.Type === 'surgeons').map(l => l.Item),
      procedures: rawLists.filter(l => l.Type === 'procedures').map(l => l.Item),
      checklistItems: rawLists.filter(l => l.Type === 'checklist').map(l => l.Item),
      complications: rawLists.filter(l => l.Type === 'complications').map(l => l.Item),
      fuStatus: ["—", "Good", "Issue noted", "Concern — review", "Missed"],
      outcomes: ["Ongoing", "Success", "Failure", "Recurrence", "Reoperation", "Lost to follow-up", "Deceased"],
      apptTypes: ["Wound check", "Drain removal", "Suture removal", "Dressing change", "1-week review", "Consultation", "Other"],
      apptStatus: ["Scheduled", "Done", "No-show", "Cancelled"]
    };

    // Parse config
    const rawConfig = readSheet('Config');
    const config = {
      DrainAlertDays: 7,
      FU1: 1,
      FU2: 3,
      FU3: 6,
      FU4: 12
    };
    rawConfig.forEach(c => {
      if (c.Key) {
        config[c.Key] = Number(c.Value);
      }
    });

    const user = Session.getActiveUser().getEmail() || "moezaka@gmail.com";

    return {
      operations,
      drains,
      complications,
      followup,
      checks,
      appointments,
      lists,
      config,
      user,
      sheetUrl: ss.getUrl(),
      photosUrl: "https://drive.google.com"
    };
  } catch (e) {
    throw new Error('Failed to load Google Sheet database: ' + e.toString());
  }
}

/**
 * Add a new surgical operation record
 */
function addOperation(op) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Operations');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Check duplicate ID
  const ops = readSheet('Operations');
  if (ops.some(o => o.PatientID.toString().toLowerCase() === op.PatientID.toString().toLowerCase())) {
    throw new Error('Patient ID ' + op.PatientID + ' already exists.');
  }

  const id = Date.now().toString();
  const createdAt = new Date().toISOString();
  const createdBy = Session.getActiveUser().getEmail() || "moezaka@gmail.com";

  const newOpRow = headers.map(header => {
    if (header === 'id') return id;
    if (header === 'CreatedAt') return createdAt;
    if (header === 'CreatedBy') return createdBy;
    if (header === 'DrainPlaced') return op.DrainPlaced ? 'Yes' : 'No';
    return op[header] || '';
  });

  sheet.appendRow(newOpRow);

  // Auto seed follow-up sheet
  const fuSheet = ss.getSheetByName('Followups');
  const fuHeaders = fuSheet.getRange(1, 1, 1, fuSheet.getLastColumn()).getValues()[0];
  const newFuRow = fuHeaders.map(header => {
    if (header === 'PatientID') return op.PatientID;
    if (header === 'M1' || header === 'M3' || header === 'M6' || header === 'M12') return '—';
    if (header === 'FinalOutcome') return 'Ongoing';
    if (header === 'id') return (Date.now() + 1).toString();
    return '';
  });
  fuSheet.appendRow(newFuRow);

  return getAllData();
}

/**
 * Update an existing surgical operation record with cascading rename support
 */
function updateOperation(op) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Operations');
  const rowIdx = Number(op._row);

  if (!rowIdx || rowIdx < 2) {
    throw new Error('Invalid row index specified for update.');
  }

  // Check duplicates if name changed
  if (op.PatientID.toLowerCase() !== op.oldPatientID.toLowerCase()) {
    const ops = readSheet('Operations');
    if (ops.some(o => o.PatientID.toString().toLowerCase() === op.PatientID.toString().toLowerCase())) {
      throw new Error('Patient ID ' + op.PatientID + ' already exists.');
    }
  }

  // Update operations table row
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowRange = sheet.getRange(rowIdx, 1, 1, headers.length);
  const rowValues = rowRange.getValues()[0];

  headers.forEach((header, cIdx) => {
    if (header === 'PatientID') rowValues[cIdx] = op.PatientID;
    else if (header === 'Age') rowValues[cIdx] = op.Age || '';
    else if (header === 'OperationDate') rowValues[cIdx] = op.OperationDate;
    else if (header === 'Procedure') rowValues[cIdx] = op.Procedure;
    else if (header === 'Surgeon') rowValues[cIdx] = op.Surgeon;
    else if (header === 'DrainPlaced') rowValues[cIdx] = op.DrainPlaced ? 'Yes' : 'No';
    else if (header === 'Notes') rowValues[cIdx] = op.Notes || '';
  });

  rowRange.setValues([rowValues]);

  // Cascade PatientID rename across all worksheets
  if (op.PatientID.toLowerCase() !== op.oldPatientID.toLowerCase()) {
    const oldId = op.oldPatientID;
    const newId = op.PatientID;

    const cascadingSheets = ['Drains', 'Complications', 'Followups', 'Checks', 'Appointments'];
    cascadingSheets.forEach(sName => {
      const targetSheet = ss.getSheetByName(sName);
      if (!targetSheet) return;
      const lastRow = targetSheet.getLastRow();
      if (lastRow < 2) return;

      const pHeaders = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
      const pIdColIdx = pHeaders.indexOf('PatientID') + 1;
      if (pIdColIdx <= 0) return;

      const colValues = targetSheet.getRange(2, pIdColIdx, lastRow - 1, 1).getValues();
      const updatedColValues = colValues.map(row => {
        if (row[0].toString() === oldId.toString()) {
          return [newId];
        }
        return [row[0]];
      });
      targetSheet.getRange(2, pIdColIdx, lastRow - 1, 1).setValues(updatedColValues);
    });
  }

  // Delete drain if drain is no longer placed
  if (!op.DrainPlaced) {
    deleteRowsMatching('Drains', 'PatientID', op.PatientID);
  }

  return getAllData();
}

/**
 * Delete patient operation and cascade-delete all linked records
 */
function deleteOperation(pid) {
  deleteRowsMatching('Operations', 'PatientID', pid);
  deleteRowsMatching('Drains', 'PatientID', pid);
  deleteRowsMatching('Complications', 'PatientID', pid);
  deleteRowsMatching('Followups', 'PatientID', pid);
  deleteRowsMatching('Checks', 'PatientID', pid);
  deleteRowsMatching('Appointments', 'PatientID', pid);

  return getAllData();
}

/**
 * Remove a drain (save removal record)
 */
function removeDrain(pid) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Drains');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const drains = readSheet('Drains');
  if (!drains.some(d => d.PatientID.toString() === pid.toString())) {
    const user = Session.getActiveUser().getEmail() || "moezaka@gmail.com";
    const date = new Date().toISOString().split('T')[0];
    const id = Date.now().toString();

    const newRow = headers.map(header => {
      if (header === 'PatientID') return pid;
      if (header === 'RemovedDate') return date;
      if (header === 'RemovedBy') return user;
      if (header === 'id') return id;
      return '';
    });
    sheet.appendRow(newRow);
  }

  return getAllData();
}

/**
 * Undo drain removal
 */
function undoDrain(pid) {
  deleteRowsMatching('Drains', 'PatientID', pid);
  return getAllData();
}

/**
 * Add complication registry log
 */
function addComplication(comp) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Complications');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const id = Date.now().toString();
  const date = comp.DateDetected || new Date().toISOString().split('T')[0];

  const newRow = headers.map(header => {
    if (header === 'id') return id;
    if (header === 'PatientID') return comp.PatientID;
    if (header === 'Complication') return comp.Complication || 'Other';
    if (header === 'Grade') return comp.Grade || 'I';
    if (header === 'DateDetected') return date;
    if (header === 'Management') return comp.Management || '';
    if (header === 'Resolved') return 'No';
    if (header === 'ResolvedDate') return '';
    return '';
  });

  sheet.appendRow(newRow);
  return getAllData();
}

/**
 * Update a complication registry log
 */
function updateComplication(comp) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Complications');
  const rowIdx = Number(comp._row);

  if (!rowIdx || rowIdx < 2) throw new Error('Invalid row index for complication.');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowRange = sheet.getRange(rowIdx, 1, 1, headers.length);
  const rowValues = rowRange.getValues()[0];

  const wasResolved = rowValues[headers.indexOf('Resolved')] === 'Yes';

  headers.forEach((header, cIdx) => {
    if (header === 'Complication') rowValues[cIdx] = comp.Complication || 'Other';
    else if (header === 'Grade') rowValues[cIdx] = comp.Grade || 'I';
    else if (header === 'DateDetected') rowValues[cIdx] = comp.DateDetected || '';
    else if (header === 'Management') rowValues[cIdx] = comp.Management || '';
    else if (header === 'Resolved') rowValues[cIdx] = comp.Resolved ? 'Yes' : 'No';
    else if (header === 'ResolvedDate') {
      rowValues[cIdx] = comp.Resolved ? (wasResolved ? rowValues[cIdx] : new Date().toISOString().split('T')[0]) : '';
    }
  });

  rowRange.setValues([rowValues]);
  return getAllData();
}

/**
 * Delete a complication log by sheet row index
 */
function deleteComplication(row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Complications');
  const rowIdx = Number(row);
  if (rowIdx >= 2 && rowIdx <= sheet.getLastRow()) {
    sheet.deleteRow(rowIdx);
  }
  return getAllData();
}

/**
 * Mark complication as resolved
 */
function resolveComplication(row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Complications');
  const rowIdx = Number(row);

  if (rowIdx >= 2 && rowIdx <= sheet.getLastRow()) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const resColIdx = headers.indexOf('Resolved') + 1;
    const dateColIdx = headers.indexOf('ResolvedDate') + 1;

    sheet.getRange(rowIdx, resColIdx).setValue('Yes');
    sheet.getRange(rowIdx, dateColIdx).setValue(new Date().toISOString().split('T')[0]);
  }

  return getAllData();
}

/**
 * Set long-term follow up milestone review value
 */
function setFollowUp(PatientID, field, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Followups');
  const lastRow = sheet.getLastRow();

  let foundRowIdx = -1;
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0].toString() === PatientID.toString()) {
        foundRowIdx = i + 2;
        break;
      }
    }
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const fieldColIdx = headers.indexOf(field) + 1;

  if (fieldColIdx <= 0) throw new Error('Invalid follow-up field: ' + field);

  if (foundRowIdx !== -1) {
    // Update existing row
    sheet.getRange(foundRowIdx, fieldColIdx).setValue(value);
  } else {
    // Append new row
    const newFuRow = headers.map(header => {
      if (header === 'PatientID') return PatientID;
      if (header === field) return value;
      if (header === 'id') return Date.now().toString();
      if (header === 'FinalOutcome') return 'Ongoing';
      return '—';
    });
    sheet.appendRow(newFuRow);
  }

  return getAllData();
}

/**
 * Toggle pre/post-op checklist items
 */
function toggleCheckItem(PatientID, item, done) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Checks');
  const lastRow = sheet.getLastRow();

  let matchedRowIdx = -1;
  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues(); // PatientID, Item, Done
    for (let i = 0; i < values.length; i++) {
      if (values[i][0].toString() === PatientID.toString() && values[i][1].toString() === item.toString()) {
        matchedRowIdx = i + 2;
        break;
      }
    }
  }

  if (done) {
    if (matchedRowIdx === -1) {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const newRow = headers.map(header => {
        if (header === 'PatientID') return PatientID;
        if (header === 'Item') return item;
        if (header === 'Done') return 'Yes';
        if (header === 'id') return Date.now().toString();
        return '';
      });
      sheet.appendRow(newRow);
    }
  } else {
    if (matchedRowIdx !== -1) {
      sheet.deleteRow(matchedRowIdx);
    }
  }

  return getAllData();
}

/**
 * Add clinical short-term appointment
 */
function addAppointment(appt) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Appointments');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const user = Session.getActiveUser().getEmail() || "moezaka@gmail.com";
  const id = Date.now().toString();

  const newRow = headers.map(header => {
    if (header === 'PatientID') return appt.PatientID;
    if (header === 'Date') return appt.Date;
    if (header === 'Time') return appt.Time || '';
    if (header === 'Type') return appt.Type || 'Other';
    if (header === 'Notes') return appt.Notes || '';
    if (header === 'Status') return 'Scheduled';
    if (header === 'CreatedBy') return user;
    if (header === 'id') return id;
    return '';
  });

  sheet.appendRow(newRow);
  return getAllData();
}

/**
 * Set appointment status
 */
function setAppointmentStatus(row, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Appointments');
  const rowIdx = Number(row);

  if (rowIdx >= 2 && rowIdx <= sheet.getLastRow()) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const statusColIdx = headers.indexOf('Status') + 1;
    sheet.getRange(rowIdx, statusColIdx).setValue(status);
  }

  return getAllData();
}

/**
 * Delete appointment entry by row index
 */
function deleteAppointment(row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Appointments');
  const rowIdx = Number(row);

  if (rowIdx >= 2 && rowIdx <= sheet.getLastRow()) {
    sheet.deleteRow(rowIdx);
  }

  return getAllData();
}

/**
 * Save master items list for procedures, surgeons, checklists or complications
 */
function saveList(type, items) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Lists');
  
  // 1. Delete existing of this type
  deleteRowsMatching('Lists', 'Type', type);

  // 2. Append new items
  items.forEach(item => {
    if (item.trim()) {
      sheet.appendRow([type, item]);
    }
  });

  return getAllData();
}

/**
 * Save Alert configuration parameter overrides
 */
function saveConfig(configData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Config');

  for (const key in configData) {
    const value = configData[key].toString();
    
    // Find key and update, or append if missing
    const lastRow = sheet.getLastRow();
    let foundRowIdx = -1;
    if (lastRow >= 2) {
      const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < keys.length; i++) {
        if (keys[i][0].toString() === key) {
          foundRowIdx = i + 2;
          break;
        }
      }
    }

    if (foundRowIdx !== -1) {
      sheet.getRange(foundRowIdx, 2).setValue(value);
    } else {
      sheet.appendRow([key, value]);
    }
  }

  return getAllData();
}

/**
 * Helper to delete rows in a sheet matching a specific column value
 */
function deleteRowsMatching(sheetName, columnHeader, valueToMatch) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colIdx = headers.indexOf(columnHeader) + 1;
  if (colIdx <= 0) return;

  // Iterate backwards to avoid index shifting bugs when deleting rows
  for (let r = lastRow; r >= 2; r--) {
    const cellValue = sheet.getRange(r, colIdx).getValue();
    if (cellValue.toString().toLowerCase() === valueToMatch.toString().toLowerCase()) {
      sheet.deleteRow(r);
    }
  }
}

/**
 * Import database tables directly from JSON backup file payload
 */
function importBackupFromJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.operations || !data.complications || !data.lists || !data.config) {
      throw new Error('Invalid JSON backup format structure.');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Reset and clear sheets
    const sheetsToClear = ['Operations', 'Drains', 'Complications', 'Followups', 'Checks', 'Appointments', 'Lists', 'Config'];
    sheetsToClear.forEach(sName => {
      const sheet = ss.getSheetByName(sName);
      if (sheet) {
        if (sheet.getLastRow() > 1) {
          sheet.deleteRows(2, sheet.getLastRow() - 1);
        }
      }
    });

    // Populate Operations
    const opSheet = ss.getSheetByName('Operations');
    const opHeaders = opSheet.getRange(1, 1, 1, opSheet.getLastColumn()).getValues()[0];
    data.operations.forEach(op => {
      const row = opHeaders.map(h => (h === 'DrainPlaced' ? (op.DrainPlaced ? 'Yes' : 'No') : op[h] || ''));
      opSheet.appendRow(row);
    });

    // Populate Drains
    const drSheet = ss.getSheetByName('Drains');
    const drHeaders = drSheet.getRange(1, 1, 1, drSheet.getLastColumn()).getValues()[0];
    (data.drains || []).forEach(dr => {
      const row = drHeaders.map(h => dr[h] || '');
      drSheet.appendRow(row);
    });

    // Populate Complications
    const compSheet = ss.getSheetByName('Complications');
    const compHeaders = compSheet.getRange(1, 1, 1, compSheet.getLastColumn()).getValues()[0];
    (data.complications || []).forEach(comp => {
      const row = compHeaders.map(h => comp[h] || '');
      compSheet.appendRow(row);
    });

    // Populate Followups
    const fuSheet = ss.getSheetByName('Followups');
    const fuHeaders = fuSheet.getRange(1, 1, 1, fuSheet.getLastColumn()).getValues()[0];
    (data.followup || []).forEach(fu => {
      const row = fuHeaders.map(h => fu[h] || '');
      fuSheet.appendRow(row);
    });

    // Populate Checks
    const chSheet = ss.getSheetByName('Checks');
    const chHeaders = chSheet.getRange(1, 1, 1, chSheet.getLastColumn()).getValues()[0];
    (data.checks || []).forEach(ch => {
      const row = chHeaders.map(h => ch[h] || '');
      chSheet.appendRow(row);
    });

    // Populate Appointments
    const apptSheet = ss.getSheetByName('Appointments');
    const apptHeaders = apptSheet.getRange(1, 1, 1, apptSheet.getLastColumn()).getValues()[0];
    (data.appointments || []).forEach(appt => {
      const row = apptHeaders.map(h => appt[h] || '');
      apptSheet.appendRow(row);
    });

    // Populate Lists
    const listSheet = ss.getSheetByName('Lists');
    if (data.lists.surgeons) data.lists.surgeons.forEach(item => listSheet.appendRow(['surgeons', item]));
    if (data.lists.procedures) data.lists.procedures.forEach(item => listSheet.appendRow(['procedures', item]));
    if (data.lists.checklistItems) data.lists.checklistItems.forEach(item => listSheet.appendRow(['checklist', item]));
    if (data.lists.complications) data.lists.complications.forEach(item => listSheet.appendRow(['complications', item]));

    // Populate Config
    const confSheet = ss.getSheetByName('Config');
    if (data.config) {
      for (const key in data.config) {
        confSheet.appendRow([key, data.config[key].toString()]);
      }
    }

    return getAllData();
  } catch (err) {
    throw new Error('Database backup restore failed: ' + err.toString());
  }
}

/**
 * Scheduled Morning Digest (7:00 AM)
 * Scans Active Drains, Today's Scheduled Visits, Overdue Milestones, and Unresolved Complications
 * and emails a professional, beautifully styled HTML summary to the practice coordinator.
 */
function sendDailyDigestEmail() {
  try {
    const data = getAllData();
    const recipient = data.user || Session.getActiveUser().getEmail() || "moezaka@gmail.com";
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 1. Filter Today's Appointments
    const todayAppts = data.appointments.filter(a => a.Date === todayStr && a.Status === 'Scheduled');
    
    // 2. Filter Active Drains needing attention
    const activeDrains = [];
    data.operations.forEach(op => {
      if (op.DrainPlaced === 'Yes') {
        const removed = data.drains.some(d => d.PatientID.toString() === op.PatientID.toString());
        if (!removed) {
          const placementDate = new Date(op.OperationDate);
          const diffDays = Math.floor((new Date() - placementDate) / (1000 * 60 * 60 * 24));
          const alertThreshold = data.config.DrainAlertDays || 7;
          
          activeDrains.push({
            PatientID: op.PatientID,
            Procedure: op.Procedure,
            Surgeon: op.Surgeon,
            DaysInSitu: diffDays,
            IsOverLimit: diffDays >= alertThreshold
          });
        }
      }
    });
    
    // 3. Filter Open Complications
    const openComps = data.complications.filter(c => c.Resolved !== 'Yes');
    
    // 4. Overdue Follow-ups
    const overdueFollowUps = [];
    const addMonths = (dateStr, months) => {
      const d = new Date(dateStr);
      d.setMonth(d.getMonth() + months);
      return d;
    };
    
    data.operations.forEach(op => {
      const fu = data.followup.find(f => f.PatientID === op.PatientID);
      if (fu && fu.FinalOutcome === 'Ongoing') {
        const checkMilestone = (key, months) => {
          if (fu[key] === '—' && op.OperationDate) {
            const due = addMonths(op.OperationDate, months);
            if (due < new Date()) {
              overdueFollowUps.push({
                PatientID: op.PatientID,
                Milestone: key,
                DaysOverdue: Math.floor((new Date() - due) / (1000 * 60 * 60 * 24))
              });
            }
          }
        };
        checkMilestone('M1', data.config.FU1 || 1);
        checkMilestone('M3', data.config.FU2 || 3);
        checkMilestone('M6', data.config.FU3 || 6);
        checkMilestone('M12', data.config.FU4 || 12);
      }
    });

    // Generate HTML Email
    let html = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f7f9fa; padding: 24px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #0f172a, #0d9488); padding: 32px 24px; text-align: center; color: #ffffff;">
            <p style="text-transform: uppercase; letter-spacing: 0.15em; font-size: 11px; margin: 0 0 6px 0; color: #2dd4bf; font-weight: bold;">Daily Clinical Summary</p>
            <h1 style="font-size: 24px; margin: 0; font-weight: 700; letter-spacing: -0.02em;">Practice Digest Email</h1>
            <p style="font-size: 13px; opacity: 0.8; margin: 8px 0 0 0;">${todayStr} &bull; Generated Automatically</p>
          </div>
          
          <div style="padding: 24px;">
            <p style="font-size: 14px; margin-top: 0; line-height: 1.5; color: #475569;">
              Here is your morning surgical track status report. The clinic metrics show active cases and alerts requiring action today.
            </p>
            
            <!-- SECTION 1: TODAY'S CLINICAL VISITS -->
            <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #0d9488; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin: 28px 0 12px 0;">
              Today's Scheduled Visits (${todayAppts.length})
            </h3>
            ${todayAppts.length === 0 ? 
              `<p style="font-size: 13px; color: #94a3b8; font-style: italic; margin: 8px 0;">No clinic appointments scheduled for today.</p>` : 
              `<table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
                <thead>
                  <tr style="background-color: #f1f5f9; text-align: left; font-weight: bold; color: #475569;">
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">Patient</th>
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">Time</th>
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">Appointment Type</th>
                  </tr>
                </thead>
                <tbody>
                  ${todayAppts.map(a => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${a.PatientID}</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0;">${a.Time || '—'}</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0; color: #0d9488; font-weight: 600;">${a.Type}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>`
            }
            
            <!-- SECTION 2: ACTIVE DRAINS (ALERT STATUS) -->
            <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #e11d48; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin: 24px 0 12px 0;">
              Active Drains Needed Attention
            </h3>
            ${activeDrains.length === 0 ? 
              `<p style="font-size: 13px; color: #94a3b8; font-style: italic; margin: 8px 0;">No active surgical drains currently in situ.</p>` : 
              `<table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
                <thead>
                  <tr style="background-color: #f1f5f9; text-align: left; font-weight: bold; color: #475569;">
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">Patient ID</th>
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">Days In Situ</th>
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">Surgeon</th>
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${activeDrains.map(d => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${d.PatientID}</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; color: ${d.IsOverLimit ? '#e11d48' : '#0f172a'}">${d.DaysInSitu} days</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0;">${d.Surgeon}</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0;">
                        ${d.IsOverLimit ? 
                          `<span style="background-color: #ffe4e6; color: #e11d48; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px;">Exceeded Limit</span>` : 
                          `<span style="background-color: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 11px;">Normal</span>`
                        }
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>`
            }
            
            <!-- SECTION 3: UNRESOLVED COMPLICATIONS -->
            <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #ea580c; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin: 24px 0 12px 0;">
              Open Complications Registry (${openComps.length})
            </h3>
            ${openComps.length === 0 ? 
              `<p style="font-size: 13px; color: #94a3b8; font-style: italic; margin: 8px 0;">No active complications on file. Excellent! ✓</p>` : 
              `<table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
                <thead>
                  <tr style="background-color: #f1f5f9; text-align: left; font-weight: bold; color: #475569;">
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">Patient</th>
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">Complication</th>
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">Clavien Grade</th>
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">Management</th>
                  </tr>
                </thead>
                <tbody>
                  ${openComps.map(c => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${c.PatientID}</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0; color: #ea580c; font-weight: bold;">${c.Complication}</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; text-align: center;">${c.Grade}</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0; font-style: italic;">${c.Management || 'None logged'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>`
            }
            
            <!-- SECTION 4: OVERDUE MILESTONES -->
            <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #475569; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin: 24px 0 12px 0;">
              Overdue Follow-up Reviews (${overdueFollowUps.length})
            </h3>
            ${overdueFollowUps.length === 0 ? 
              `<p style="font-size: 13px; color: #94a3b8; font-style: italic; margin: 8px 0;">No outstanding follow-up milestones today.</p>` : 
              `<table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
                <thead>
                  <tr style="background-color: #f1f5f9; text-align: left; font-weight: bold; color: #475569;">
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">Patient ID</th>
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">Overdue Milestone</th>
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">Days Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  ${overdueFollowUps.map(fu => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${fu.PatientID}</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #ea580c;">${fu.Milestone} Review</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0; color: #e11d48; font-weight: bold;">${fu.DaysOverdue} days late</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>`
            }
            
          </div>
          
          <!-- Footer Branding -->
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 11px; color: #64748b;">
            <p style="margin: 0;">Surgical Case Tracker Clinical Notification System &bull; Secured with TLS</p>
            <p style="margin: 4px 0 0 0;">Do not reply to this email. For configurations, access your active application settings panel.</p>
          </div>
          
        </div>
      </div>
    `;
    
    // Send email
    MailApp.sendEmail({
      to: recipient,
      subject: `Surgical Tracker Clinical Summary: ${todayStr} (Alerts & Appointments)`,
      htmlBody: html
    });
    
  } catch(e) {
    Logger.log("Daily digest compilation failed: " + e.toString());
  }
}

