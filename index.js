/**
 * Author: @jasbanza
 * - Archive non-sensitive Kustomer conversation metadata to google sheets
 * for statistical purposes
 * - Deletes the original conversations from Kustomer to protect users
 * - Updates google sheet to indicate deletion success
 */

"use strict";
const config = require("./config/config.json");
const fetch = require("node-fetch");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const { ConsoleLogColors } = require("js-console-log-colors");
const out = new ConsoleLogColors();

const arrEventLog = [];

/**
 * Main function
 */
(async function () {
  let countToBeDeleted = 0;
  let countConfirmedDeleted = 0;
  let countNotSaved = 0;
  let successOrFailure = "SUCCESS";
  try {
    debug("Main (async function() {...}());");
    // Retrieve relevant support conversation metadata using Kustomer API
    out.command("1. Fetching Kustomer conversation metadata...");
    const arrConvMetadata = await getKustomerConversationMetadata();
    countToBeDeleted = arrConvMetadata.length;
    if (countToBeDeleted == 0) {
      out.info("No old conversations found.");
    } else {
      out.info(`${countToBeDeleted} old conversations found needing deletion.`);

      // Save to Google Sheets
      out.ln();
      out.command("2. Checking google sheets...");
      const results_sheets_save = await saveToGoogleSheets(arrConvMetadata);

      // if there were conversations archived
      if (
        results_sheets_save.arrInsertedIds.length > 0 &&
        results_sheets_save.isArchiveVerified
      ) {
        out.success(
          `${results_sheets_save.arrInsertedIds.length} old Kustomer conversation stats were saved to Google Sheets`
        );

        // Delete conversations from Kustomer
        out.ln();
        out.command("3. Deleting Kustomer conversations...");
        await deleteConversationsFromKustomer(
          results_sheets_save.arrInsertedIds
        );

        // Confirm deleted from Kustomer
        out.ln();
        out.command("4. Confirming deletion from Kustomer...");
        const arrDeletedIds = await confirmDeletedFromKustomer(
          results_sheets_save.arrInsertedIds
        );
        countConfirmedDeleted = arrDeletedIds.length;
        if (countToBeDeleted == countConfirmedDeleted) {
          out.success(
            `${arrDeletedIds.length} of ${countToBeDeleted} old conversation(s) successfully deleted from Kustomer`
          );
        } else {
          out.ln();
          out.error(
            `Attention! Only ${countConfirmedDeleted} of ${countToBeDeleted} old conversation(s) were deleted from Kustomer!`
          );
          out.warn(
            "Please try re-running this script again manually, or troubleshoot the issue."
          );
          successOrFailure = "FAILURE";
        }
        // update google sheets "deletedAt" column for the affected rows
        out.ln();
        out.command("5. Updating Google Sheet with deletion time...");
        await updateGoogleSheets_setDeleted(
          results_sheets_save.arrCurrentIds,
          arrDeletedIds
        );
        out.ln();
        out.warn(
          "Please confirm that the Google Sheet has been successfully updated."
        );
      } else if (results_sheets_save.failCount > 0) {
        out.error(
          `Unable to save ${results_sheets_save.failCount} records to Google Sheets. Place solved me ser!`
        );
        successOrFailure = "FAILURE";
        countNotSaved = results_sheets_save.failCount;
      }
    }

    // get total amount of kustomer tickets (for reporting purposes) and save to google sheets
    out.command("6. Checking remaining tickets on Kustomer");
    await recordUnarchivedTicketCountToGoogleSheets();
  } catch (e) {
    out.error("Error in Main function (IIFE):");
    out.error(e.message);
  } finally {
    out.ln();
    out.info("Saving event log...");
    let logMsg = "";
    if (countToBeDeleted > 0) {
      logMsg +=
        "Deleted: " +
        countConfirmedDeleted +
        " out of " +
        countToBeDeleted +
        " conversations from Kustomer.";
      if (countNotSaved > 0) {
        logMsg +=
          " Unable to save " +
          countNotSaved +
          " conversation's stats to Google Sheets";
      }
    } else {
      logMsg = "No conversations found for deletion.";
    }
    event_log(successOrFailure, "ARCHIVER", "Run completed", logMsg);
    await saveEventLog();
    out.ln();
    out.success("done!");
  }
})();

/**
 * Get conversations from Kustomer API
 * @return {Array} [formatted conversation metadata to archive]
 */
async function getKustomerConversationMetadata() {
  debug("getKustomerConversationMetadata()");

  const arr_metadata_kustomerConversations = []; // conversations to save to Google Sheets and delete from Kustomer

  // Lookup tags from Kustomer API
  const obj_tagLookup = await createTagLookup();

  // execute kustomer conversation search
  await kustomer_conversations_get_old()
    .then((res) => res.json())
    .then((json) => {
      // Format each raw conversation object
      if (json.data) {
        for (var raw of json.data) {
          try {
            let dt_createdAt = formatDateTime(
              new Date(raw.attributes.createdAt)
            );
            let dt_endedAt = formatDateTime(new Date(raw.attributes.endedAt));
            let obj_formatted = {
              id: raw.id,
              channel: raw.attributes.channels[0],
              messageCount: raw.attributes.messageCount,
              createdAt: dt_createdAt,
              endedAt: dt_endedAt,
            };

            // add custom properties
            if (raw.attributes.custom) {
              // for (var customField in raw.attributes.custom) {
              //   obj_formatted[customField] = raw.attributes.custom[customField];
              // }
              if (raw.attributes.custom.deviceStr) {
                obj_formatted.device = raw.attributes.custom.deviceStr;
              }
              if (raw.attributes.custom.reasonForSupportStr) {
                obj_formatted.reasonForSupport =
                  raw.attributes.custom.reasonForSupportStr;
              }
              if (raw.attributes.custom.fromWhichChainStr) {
                obj_formatted.fromWhichChain =
                  raw.attributes.custom.fromWhichChainStr;
              }
              if (raw.attributes.custom.whichAssetsStr) {
                obj_formatted.whichAssets =
                  raw.attributes.custom.whichAssetsStr;
              }
              if (raw.attributes.custom.poolOrParingStr) {
                obj_formatted.poolOrParing =
                  raw.attributes.custom.poolOrParingStr;
              }
            }

            // add custom tag properties
            let strTags = formatTags(raw.attributes.tags, obj_tagLookup);
            if (strTags !== "") {
              obj_formatted.tags = strTags;
              for (var tag of strTags.split(",")) {
                obj_formatted[tag] = true;
              }
            }
            arr_metadata_kustomerConversations.push(obj_formatted);
          } catch (e) {
            out.error("Caught Error");
            out.error(e.message);
          }
        }
      }
    });
  return arr_metadata_kustomerConversations;
}

/**
 * Save conversation to google sheets
 * @return {Object} Success/failure object
 */
async function saveToGoogleSheets(arrConversations) {
  debug("saveToGoogleSheets()");
  debug("arg arrConversations:");
  debug(arrConversations);

  // SELECT SHEET
  const doc = new GoogleSpreadsheet(config.GOOGLE.SHEET_ID);

  // AUTHENTICATE SERVICE ACCOUNT
  await doc.useServiceAccountAuth({
    client_email: config.GOOGLE.SERVICE_ACCOUNT_EMAIL,
    private_key: config.GOOGLE.PRIVATE_KEY,
  });

  try {
    await doc.loadInfo(); // load document properties and worksheets
    const sheet = doc.sheetsByTitle["import"]; // Load the "import" sheet into memory

    // 1. ADD NECESSARY HEADERS TO SHEET
    await doHeaders(sheet, arrConversations);

    // 2. ADD NEW ROWS
    const obj_results = await insertRows(sheet, arrConversations);
    return obj_results;
  } catch (e) {
    out.error("Error caught:");
    out.error(e.message);
  }
}

/*  */
async function recordUnarchivedTicketCountToGoogleSheets() {
  debug("recordUnarchivedTicketCountToGoogleSheets()");

  let totalUnarchivedCount = 0;
  // execute kustomer conversation search
  await kustomer_conversations_get_all()
    .then((res) => res.json())
    .then((json) => {
      if (json?.meta?.total) {
        totalUnarchivedCount = json.meta.total;
      }
    });

  // SELECT SHEET
  const doc = new GoogleSpreadsheet(config.GOOGLE.SHEET_ID);

  // AUTHENTICATE SERVICE ACCOUNT
  await doc.useServiceAccountAuth({
    client_email: config.GOOGLE.SERVICE_ACCOUNT_EMAIL,
    private_key: config.GOOGLE.PRIVATE_KEY,
  });

  try {
    await doc.loadInfo(); // load document properties and worksheets
    const sheet = doc.sheetsByTitle["OSL Helpdesk Stats"]; // Load the "import" sheet into memory

    // SELECT CELL
    await sheet.loadCells("C7");

    // UPDATE CELLS
    let cell = sheet.getCellByA1("C7");
    cell.value = totalUnarchivedCount;
    out.info(
      `Updating "Ticket Count: Less than 2 weeks old" ("OSL Helpdesk Stats" cell C7)...`
    );

    await sheet.saveUpdatedCells();
    event_log(
      "SUCCESS",
      "Google Sheets",
      "Update Cells",
      "OSL Helpdesk Stats: C7"
    );
  } catch (e) {
    out.error("Caught Error");
    out.error(e.message);
  }
}

/* ADD NECESSARY HEADERS TO SHEET */
async function doHeaders(sheet, arrConversations) {
  debug("doHeaders()");
  debug("arrConversations:");
  debug(arrConversations);

  let arrHeaderValues = [];
  let hasUpdates = false;
  try {
    out.info("Checking if additional columns need to be added...");
    const headerRow = await sheet.loadHeaderRow();
    arrHeaderValues = sheet.headerValues;
  } catch (e) {
    out.warn(e.message);
    out.info("+ Adding default column headers");

    // If there aren't headers in the sheet, take these defaults:
    arrHeaderValues = [
      "id",
      "deletedAt",
      "messageCount",
      "channel",
      "createdAt",
      "endedAt",
      "device",
      "reasonForSupport",
      "whichAssets",
      "fromWhichChain",
      "poolOrParing",
      "tags",
    ];
    hasUpdates = true;
  }

  // also add any extra headers (e.g. custom tags)
  for (var conv of arrConversations) {
    for (var field in conv) {
      if (!arrHeaderValues.includes(field)) {
        arrHeaderValues.push(field);
        hasUpdates = true;
        out.info(`+ Adding new column "${field}"`);
      }
    }
  }

  if (hasUpdates) {
    // save the headers to the sheet
    await sheet.setHeaderRow(arrHeaderValues);
    out.info(`Columns saved!`);
  }
}

/* ADD NEW ROWS, avoiding duplicates, verify what was added */
async function insertRows(sheet, arrConversations) {
  debug("insertRows(sheet, arrConversations)");
  debug("arrConversations:");
  debug(arrConversations);

  const arrRowsToInsert = [];
  let arrCurrentIds = [];
  const arrFetchedIds = [];
  let arrInsertedIds = [];

  // get existing ids
  out.info("Reading existing rows...");
  const rows = await sheet.getRows();
  for (var i = 0; i < rows.length; i++) {
    arrCurrentIds.push(rows[i].id);
  }

  out.info(`${arrCurrentIds.length} existing record(s) found.`);
  // get new ids
  for (var conv of arrConversations) {
    arrFetchedIds.push(conv.id);
  }

  // check which new ids have yet to be saved
  const ex = new Set(arrCurrentIds);
  const arrNewIds = [...new Set(arrFetchedIds.filter((x) => !ex.has(x)))];

  if (arrNewIds.length == 0) {
    out.info("All records are accounted for.");
  } else {
    out.info(`${arrNewIds.length} unsaved records(s).`);

    // Insert new rows
    for (var conv of arrConversations) {
      if (arrNewIds.includes(conv.id)) {
        arrRowsToInsert.push(conv);
      }
    }

    out.info(`Inserting ${arrRowsToInsert.length} new rows(s)...`);

    await sheet.addRows(arrRowsToInsert);

    // Fetch all records from sheet again
    out.info(`Verifying saved state...`);
    arrCurrentIds = [];
    const currentRows = await sheet.getRows();
    for (var i = 0; i < currentRows.length; i++) {
      arrCurrentIds.push(currentRows[i].id);
    }
  }
  // Verify that the rows were saved
  let isArchiveVerified = false;
  let soFarSoGood = true;
  let failCount = 0;
  for (var newId of arrNewIds) {
    if (!arrCurrentIds.includes(newId)) {
      soFarSoGood = false;
      failCount++;
    } else {
      arrInsertedIds.push(newId);
    }
  }
  if (soFarSoGood) {
    isArchiveVerified = true;
    out.info("...Saved data looks good!");
    event_log(
      "SUCCESS",
      "Google Sheets",
      "Rows Inserted",
      "Inserted " +
        arrInsertedIds.length +
        " conversations: " +
        arrInsertedIds.join()
    );
  } else {
    out.error(`${failCount} record(s) not saved...`);
    event_log(
      "FAIL",
      "Google Sheets",
      "Not all rows inserted",
      "Inserted " +
        arrInsertedIds.length +
        "/" +
        arrNewIds.length +
        " conversations: " +
        arrInsertedIds.join()
    );
  }

  return {
    arrFetchedIds: arrFetchedIds,
    arrInsertedIds: arrInsertedIds,
    arrCurrentIds: arrCurrentIds,
    isArchiveVerified: isArchiveVerified,
    failCount: failCount,
  };
}

async function deleteConversationsFromKustomer(arrConversationIds) {
  debug("deleteConversationsFromKustomer(arrConversationIds)");
  debug("arg arrConversationIds:");
  debug(arrConversationIds);
  // Delete kustomer conversations
  for (var conversationId of arrConversationIds) {
    out.info("...");
    try {
      await kustomer_conversation_deleteById(conversationId);
      event_log(
        "SUCCESS",
        "Kustomer",
        "Delete Conversation",
        "conversationId: " + conversationId
      );
    } catch (e) {
      out.error("Failed to delete conversation");
      out.error(e.message);
      event_log(
        "FAIL",
        "Kustomer",
        "Delete Conversation",
        "conversationId: " + conversationId
      );
    }
  }
}

/* confirm deleted conversations & return array of conversationIds that were affected */
async function confirmDeletedFromKustomer(arrConversationIds) {
  debug("confirmDeletedFromKustomer(arrConversationIds)");
  debug("arg arrConversationIds:");
  debug(arrConversationIds);

  const arrDeletedConversationIds = [];
  for (var conversationId of arrConversationIds) {
    out.info("...");
    await kustomer_conversation_getById(conversationId)
      .then((res) => res.json())
      .then((json) => {
        if (
          json.errors &&
          json.errors[0] &&
          json.errors[0].status &&
          json.errors[0].status == 404
        ) {
          arrDeletedConversationIds.push(conversationId);
        }
      });
  }
  return arrDeletedConversationIds;
}

async function updateGoogleSheets_setDeleted(arrCurrentIds, arrDeletedIds) {
  debug("updateGoogleSheets_setDeleted(arrCurrentIds, arrDeletedIds)");
  debug("arg arrCurrentIds:");
  debug(arrCurrentIds);
  debug("arg arrDeletedIds:");
  debug(arrDeletedIds);

  const objCellsToUpdate = {};
  for (var i = 0; i < arrCurrentIds.length; i++) {
    if (arrDeletedIds.includes(arrCurrentIds[i])) {
      objCellsToUpdate["B" + (i + 2)] = formatDateTime(new Date(Date.now())); // +2 due to header row and non-zero index
    }
  }
  return updateGoogleSheetCells(objCellsToUpdate);
}

/**
 * UPDATE CELLS by passing object of cellAddress:value
 * objCellsToUpdate = { "A1":"some value", "B2":"some other value"}
 */
async function updateGoogleSheetCells(objCellsToUpdate) {
  debug("updateGoogleSheetCells(objCellsToUpdate)");
  debug("arg objCellsToUpdate:");
  debug(objCellsToUpdate);
  // SELECT SHEET
  const doc = new GoogleSpreadsheet(config.GOOGLE.SHEET_ID);

  // AUTHENTICATE SERVICE ACCOUNT
  await doc.useServiceAccountAuth({
    client_email: config.GOOGLE.SERVICE_ACCOUNT_EMAIL,
    private_key: config.GOOGLE.PRIVATE_KEY,
  });

  try {
    await doc.loadInfo(); // load document properties and worksheets
    const sheet = doc.sheetsByTitle["import"]; // Load the "import" sheet into memory

    // SELECT CELLS
    const arrA1CellAddresses = [];
    for (var address in objCellsToUpdate) {
      arrA1CellAddresses.push(address);
    }
    await sheet.loadCells(arrA1CellAddresses);

    // UPDATE CELLS
    for (var address in objCellsToUpdate) {
      let cell = sheet.getCellByA1(address);
      cell.value = objCellsToUpdate[address];

      out.info(`Updating "deletedAt" Date/Time (cell ${address})...`);
    }

    await sheet.saveUpdatedCells();
    event_log(
      "SUCCESS",
      "Google Sheets",
      "Update Cells",
      "import: " + arrA1CellAddresses.join()
    );
    return arrA1CellAddresses;
  } catch (e) {
    out.error("Caught Error");
    out.error(e.message);
  }
}

/**
 * Fetches tags from Kustomer API, and returns them as a lookup object
 * @return {Object} [tags object with each property being a tag id, and each value being tag name string]
 */
async function createTagLookup() {
  debug("createTagLookup()");
  const obj_tagLookup = {};
  await kustomer_tags_get()
    .then((res) => res.json())
    .then((json) => {
      for (var tag of json.data) {
        obj_tagLookup[tag.id] = tag.attributes.name ? tag.attributes.name : "";
      }
    });
  return obj_tagLookup;
}

/* === DEBUGGING & EVENT LOG === */
function debug(txt) {
  if (config.ENVIRONMENT.DEBUG_MODE) {
    out.debug(">>> DEBUG: " + txt);
  }
}

function event_log(status, resource, action, details) {
  const time = formatDateTime(new Date(Date.now()));
  arrEventLog.push({
    environment: config.ENVIRONMENT.NAME,
    time: time,
    status: status,
    resource: resource,
    action: action,
    details: details,
  });
}

async function saveEventLog() {
  debug("saveEventLog()");
  const doc = new GoogleSpreadsheet(config.GOOGLE.SHEET_ID);

  // AUTHENTICATE SERVICE ACCOUNT
  await doc.useServiceAccountAuth({
    client_email: config.GOOGLE.SERVICE_ACCOUNT_EMAIL,
    private_key: config.GOOGLE.PRIVATE_KEY,
  });

  try {
    await doc.loadInfo(); // load document properties and worksheets
    const sheet = doc.sheetsByTitle["event_log"]; // Load the "import" sheet into memory

    await sheet.setHeaderRow([
      "environment",
      "time",
      "status",
      "resource",
      "action",
      "details",
    ]);

    return await sheet.addRows(arrEventLog);
  } catch (e) {
    out.error("Error caught:");
    out.error(e.message);
  }
}

/* === FORMAT FUNCTIONS === */
function formatTags(arrTagIds, obj_tagLookup) {
  let formattedTags = "";
  if (arrTagIds) {
    for (var tagId of arrTagIds) {
      formattedTags += formattedTags != "" ? "," : "";
      formattedTags += obj_tagLookup[tagId];
    }
  }
  return formattedTags;
}

function formatDateTime(dt) {
  // 21/05/2022 06:57:10
  let dtStr = dt.toISOString();
  dtStr = dtStr.replaceAll("-", "/");
  dtStr = dtStr.replace("T", " ");
  dtStr = dtStr.substring(0, dtStr.indexOf("."));
  return dtStr;
  //return dt.getFullYear() + "/" + (dt.getMonth() + 1) + "/" + dt.getDate() + " " + dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds();
}

/* === FETCH FUNCTIONS === */
function kustomer_conversations_get_old() {
  debug("kustomer_conversations_get_old()");
  return fetch(
    "https://osmosis.api.kustomerapp.com/v1/customers/searches/" +
      config.KUSTOMER.SAVED_SEARCH_ID_OLD +
      "/execution?page=1&pageSize=30&source=current-search-poller&include=customers%2CsatisfactionResponse&trackTotalHits=10000&client-request-id=93a57a32-f983-436c-917d-02bc337d9717",
    {
      headers: {
        accept: "application/json",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "x-csrf-token": config.KUSTOMER.HEADER_CSRF_TOKEN,
        cookie:
          "_csrf=" +
          config.KUSTOMER.COOKIE_CSRF_TOKEN +
          "; x-kustomer-auth-token=" +
          config.KUSTOMER.API_KEY +
          ";",
        Referer: "https://osmosis.kustomerapp.com/",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      body: "{}",
      method: "POST",
    }
  );
}

function kustomer_conversations_get_all() {
  debug("kustomer_conversations_get_all()");
  return fetch(
    "https://osmosis.api.kustomerapp.com/v1/customers/searches/" +
      config.KUSTOMER.SAVED_SEARCH_ID_ALL +
      "/execution?page=1&pageSize=0&source=current-search-poller&include=customers%2CsatisfactionResponse&trackTotalHits=10000&client-request-id=93a57a32-f983-436c-917d-02bc337d9717",
    {
      headers: {
        accept: "application/json",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "x-csrf-token": config.KUSTOMER.HEADER_CSRF_TOKEN,
        cookie:
          "_csrf=" +
          config.KUSTOMER.COOKIE_CSRF_TOKEN +
          "; x-kustomer-auth-token=" +
          config.KUSTOMER.API_KEY +
          ";",
        Referer: "https://osmosis.kustomerapp.com/",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      body: "{}",
      method: "POST",
    }
  );
}

function kustomer_tags_get() {
  debug("kustomer_tags_get()");
  return fetch(
    "https://osmosis.api.kustomerapp.com/v1/tags?deleted=false&page=1&pageSize=50",
    {
      headers: {
        accept: "application/json",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "x-csrf-token": config.KUSTOMER.HEADER_CSRF_TOKEN,
        cookie:
          "_csrf=" +
          config.KUSTOMER.COOKIE_CSRF_TOKEN +
          "; x-kustomer-auth-token=" +
          config.KUSTOMER.API_KEY +
          ";",
        Referer: "https://osmosis.kustomerapp.com/",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      body: null,
      method: "GET",
    }
  );
}

function kustomer_conversation_deleteById(conversationId) {
  debug("kustomer_conversation_deleteById(conversationId)");
  debug("arg conversationId:");
  debug(conversationId);
  return fetch(
    "https://api.kustomerapp.com/v1/conversations/" + conversationId,
    {
      method: "DELETE",
      headers: {
        Accept: "text/plain",
        Authorization: "Bearer " + config.KUSTOMER.API_KEY,
      },
    }
  );
}

function kustomer_conversation_getById(conversationId) {
  debug("kustomer_conversation_getById(conversationId)");
  debug("arg conversationId:");
  debug(conversationId);
  return fetch(
    "https://api.kustomerapp.com/v1/conversations/" + conversationId,
    {
      method: "GET",
      headers: {
        Accept: "text/plain",
        Authorization: "Bearer " + config.KUSTOMER.API_KEY,
      },
    }
  );
}
