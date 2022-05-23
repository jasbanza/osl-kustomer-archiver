'use strict';
const config = require("./config/config.json");
const fetch = require("node-fetch");
const {
  GoogleSpreadsheet
} = require('google-spreadsheet');

/**
 * Main function
 */
(async function() {
  // Retrieve relevant support conversation metadata using Kustomer API
  const arrConvMetadata = await getKustomerConversationMetadata(); // conversations to save to Google Sheets and delete from Kustomer

  // Save to Google Sheets
  let results = await saveToGoogleSheets(arrConvMetadata);
  console.log(results);
  // TODO: delete from Kustomer


}());

/**
 * Get conversations from Kustomer API
 * @return {Array} [formatted conversation metadata to archive]
 */
async function getKustomerConversationMetadata() {
  const arr_metadata_kustomerConversations = []; // conversations to save to Google Sheets and delete from Kustomer

  // Lookup tags from Kustomer API
  const obj_tagLookup = await createTagLookup();

  // execute kustomer conversation search
  await fetch_kustomer_conversations()
    .then((res) => res.json())
    .then((json) => {
      // Format each raw conversation object
      for (var raw of json.data) {
        try {
          let dt_createdAt = formatDateTime(new Date(raw.attributes.createdAt));
          let dt_endedAt = formatDateTime(new Date(raw.attributes.endedAt));
          let obj_formatted = {
            "id": raw.id,
            "channel": raw.attributes.channels[0],
            "messageCount": raw.attributes.messageCount,
            "createdAt": dt_createdAt,
            "endedAt": dt_endedAt
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
              obj_formatted.reasonForSupport = raw.attributes.custom.reasonForSupportStr;
            }
            if (raw.attributes.custom.fromWhichChainStr) {
              obj_formatted.fromWhichChain = raw.attributes.custom.fromWhichChainStr;
            }
            if (raw.attributes.custom.whichAssetsStr) {
              obj_formatted.whichAssets = raw.attributes.custom.whichAssetsStr;
            }
            if (raw.attributes.custom.poolOrParingStr) {
              obj_formatted.poolOrParing = raw.attributes.custom.poolOrParingStr;
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
          console.log('\x1b[36m%s\x1b[0m', "Caught Error");
          console.log('\x1b[36m%s\x1b[0m', e);
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
    const obj_results = await doRows(sheet, arrConversations);
    return obj_results;

  } catch (e) {
    console.log('\x1b[31m%s\x1b[0m', "Caught Error");
    console.log('\x1b[31m%s\x1b[0m', e.message);
  }
}

/* ADD NECESSARY HEADERS TO SHEET */
async function doHeaders(sheet, arrConversations) {
  let arrHeaderValues = [];
  let hasUpdates = false;
  try {

    console.log('\x1b[35m%s\x1b[0m', "Column check:");
    console.log('\x1b[36m%s\x1b[0m', "Getting current header row");
    const headerRow = await sheet.loadHeaderRow();
    arrHeaderValues = sheet.headerValues;
  } catch (e) {
    console.log('\x1b[33m%s\x1b[0m', "Google Sheets:");
    console.log('\x1b[33m%s\x1b[0m', e.message);
    console.log('\x1b[36m%s\x1b[0m', "+ Adding default header row to Google Sheet");

    // If there aren't headers in the sheet, take these defaults:
    arrHeaderValues = ["id", "messageCount", "channel", "createdAt", "endedAt", "device", "reasonForSupport", "whichAssets", "fromWhichChain", "poolOrParing", "tags"];
    hasUpdates = true;
  }


  // also add any extra headers (e.g. custom tags)
  for (var conv of arrConversations) {
    for (var field in conv) {
      if (!arrHeaderValues.includes(field)) {
        arrHeaderValues.push(field);
        hasUpdates = true;
        console.log('\x1b[36m%s\x1b[0m', "+ Adding extra header: '" + field + "'");
      }
    }
  }

  if (hasUpdates) {
    // save the headers to the sheet
    console.log('\x1b[36m%s\x1b[0m', "Updating header row...");
    await sheet.setHeaderRow(arrHeaderValues);
    console.log('\x1b[36m%s\x1b[0m', "...done!");
  }
}

/* ADD NEW ROWS, avoiding duplicates, verify what was added */
async function doRows(sheet, arrConversations) {
  console.log('\x1b[35m%s\x1b[0m', "Record check:");

  const arrRowsToInsert = [];
  const arrExistingIds = [];
  const arrFetchedIds = [];


  // get existing ids
  //
  console.log('\x1b[36m%s\x1b[0m', "Getting existing Google Sheets rows");
  const rows = await sheet.getRows();
  for (var i = 0; i < rows.length; i++) {
    arrExistingIds.push(rows[i].id);
  }
  console.log('\x1b[36m%s\x1b[0m', "Comparing data");

  // get new ids
  for (var conv of arrConversations) {
    arrFetchedIds.push(conv.id);
  }

  // check which new ids have yet to be saved
  const ex = new Set(arrExistingIds);
  const arrNewIds = [...new Set(arrFetchedIds.filter(x => !ex.has(x)))];

  // Insert new rows
  for (var conv of arrConversations) {
    if (arrNewIds.includes(conv.id)) {
      arrRowsToInsert.push(conv);
    }
  }


  console.log('\x1b[36m%s\x1b[0m', `Inserting ${arrRowsToInsert.length} new record(s) to Google Sheet`);
  await sheet.addRows(arrRowsToInsert);

  // Fetch all records from sheet again
  console.log('\x1b[36m%s\x1b[0m', "Verifying saved state");
  const arrCurrentIds = [];
  const currentRows = await sheet.getRows();
  for (var i = 0; i < currentRows.length; i++) {
    arrCurrentIds.push(currentRows[i].id);
  }

  // Verify that the rows were saved
  let isSaveVerified = false;
  let soFarSoGood = true;
  for (var newId of arrNewIds) {
    if (!arrCurrentIds.includes(newId)) {
      soFarSoGood = false;
    }
  }
  if (soFarSoGood) {
    isSaveVerified = true;
    console.log('\x1b[36m%s\x1b[0m', `...Saved data looks good!`);
  } else {
    console.log('\x1b[31m%s\x1b[0m', `${arrRowsToInsert.length} record(s) not saved...`);
  }

  return {
    arrFetchedIds: arrFetchedIds,
    arrInsertedIds: arrNewIds,
    arrCurrentIds: arrCurrentIds,
    isSaveVerified: isSaveVerified
  };
}

/**
 * Fetches tags from Kustomer API, and returns them as a lookup object
 * @return {Object} [tags object with each property being a tag id, and each value being tag name string]
 */
async function createTagLookup() {
  const obj_tagLookup = {};
  await fetch_kustomer_tags()
    .then((res) => res.json())
    .then((json) => {
      for (var tag of json.data) {
        obj_tagLookup[tag.id] = tag.attributes.name ? tag.attributes.name : "";
      }
    });
  return obj_tagLookup;
}


/* === FORMAT FUNCTIONS === */
function formatTags(arrTagIds, obj_tagLookup) {
  let formattedTags = "";
  if (arrTagIds) {
    for (var tagId of arrTagIds) {
      formattedTags += (formattedTags != "") ? "," : "";
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
function fetch_kustomer_conversations() {
  return fetch("https://osmosis.api.kustomerapp.com/v1/customers/searches/" + config.KUSTOMER.SAVED_SEARCH_ID + "/execution?page=1&pageSize=30&source=current-search-poller&include=customers%2CsatisfactionResponse&trackTotalHits=10000&client-request-id=93a57a32-f983-436c-917d-02bc337d9717", {
    "headers": {
      "accept": "application/json",
      "accept-language": "en-US,en;q=0.9",
      "content-type": "application/json",
      "x-csrf-token": config.KUSTOMER.HEADER_CSRF_TOKEN,
      "cookie": "_csrf=" + config.KUSTOMER.COOKIE_CSRF_TOKEN + "; x-kustomer-auth-token=" + config.KUSTOMER.API_KEY + ";",
      "Referer": "https://osmosis.kustomerapp.com/",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    "body": "{}",
    "method": "POST"
  });
}

function fetch_kustomer_tags() {
  return fetch("https://osmosis.api.kustomerapp.com/v1/tags?deleted=false&page=1&pageSize=50", {
    "headers": {
      "accept": "application/json",
      "accept-language": "en-US,en;q=0.9",
      "content-type": "application/json",
      "x-csrf-token": config.KUSTOMER.HEADER_CSRF_TOKEN,
      "cookie": "_csrf=" + config.KUSTOMER.COOKIE_CSRF_TOKEN + "; x-kustomer-auth-token=" + config.KUSTOMER.API_KEY + ";",
      "Referer": "https://osmosis.kustomerapp.com/",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    "body": null,
    "method": "GET"
  });
}
