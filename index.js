'use strict';
const config = require("./config.KUSTOMER.json");
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
  const response = await saveToGoogleSheets(arrConvMetadata);
  // TODO: save to google sheets
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
            "channels": raw.attributes.channels,
            "messageCount": raw.attributes.messageCount,
            "createdAt": dt_createdAt,
            "endedAt": dt_endedAt,
            "tags": formatTags(raw.attributes.tags, obj_tagLookup),
            "deviceStr": "",
            "reasonForSupportStr": "",
            "fromWhichChainStr": "",
            "whichAssetsStr": "",
            "poolOrParingStr": "",
          };
          if (raw.attributes.custom) {
            obj_formatted.deviceStr = raw.attributes.custom.deviceStr ? raw.attributes.custom.deviceStr : "";
            obj_formatted.reasonForSupportStr = raw.attributes.custom.reasonForSupportStr ? raw.attributes.custom.reasonForSupportStr : "";
            obj_formatted.fromWhichChainStr = raw.attributes.custom.fromWhichChainStr ? raw.attributes.custom.fromWhichChainStr : "";
            obj_formatted.whichAssetsStr = raw.attributes.custom.whichAssetsStr ? raw.attributes.custom.whichAssetsStr : "";
            obj_formatted.poolOrParingStr = raw.attributes.custom.poolOrParingStr ? raw.attributes.custom.poolOrParingStr : "";
          }
          arr_metadata_kustomerConversations.push(obj_formatted);
        } catch (e) {
          console.log("Catch:");
          console.log(e);
        }
      }
    });
  return arr_metadata_kustomerConversations;
}

/**
 * Save conversation to google sheets
 * @return {Object} Success/failure object
 */
async function saveToGoogleSheets() {

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
  let arrFormattedTags = [];
  if (arrTagIds) {
    for (var tagId of arrTagIds) {
      arrFormattedTags.push(obj_tagLookup[tagId]);
    }
  }
  return arrFormattedTags;
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
