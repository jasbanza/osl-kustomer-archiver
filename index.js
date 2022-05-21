'use strict';
const config = require("./config.json");
const fetch = require("node-fetch");

const objTagLookup = {};
const records_to_save = [];


(async function() {

  // GET TAGS
  await fetch("https://osmosis.api.kustomerapp.com/v1/tags?deleted=false&page=1&pageSize=50", {
      "headers": {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "x-csrf-token": config.HEADER_CSRF_TOKEN,
        "cookie": "_csrf=" + config.COOKIE_CSRF_TOKEN + "; x-kustomer-auth-token=" + config.API_KEY + ";",
        "Referer": "https://osmosis.kustomerapp.com/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      },
      "body": null,
      "method": "GET"
    })
    .then((res) => res.json())
    .then((json) => {
      for (var tag of json.data) {
        objTagLookup[tag.id] = tag.attributes.name ? tag.attributes.name : "";
      }
    });


  // GET CONVERSATIONS FROM FILTER
  await fetch("https://osmosis.api.kustomerapp.com/v1/customers/searches/628797d1104b03001adff3c9/execution?page=1&pageSize=30&source=current-search-poller&include=customers%2CsatisfactionResponse&trackTotalHits=10000&client-request-id=93a57a32-f983-436c-917d-02bc337d9717", {
      "headers": {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "x-csrf-token": config.HEADER_CSRF_TOKEN,
        "cookie": "_csrf=" + config.COOKIE_CSRF_TOKEN + "; x-kustomer-auth-token=" + config.API_KEY + ";",
        "Referer": "https://osmosis.kustomerapp.com/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      },
      "body": "{}",
      "method": "POST"
    })
    .then((res) => res.json())
    .then((json) => {
      // Parse records
      for (var raw of json.data) {
        // console.log(raw.attributes.name);
        try {
          let dt_createdAt = formatDateTime(new Date(raw.attributes.createdAt));
          let dt_endedAt = formatDateTime(new Date(raw.attributes.endedAt));
          let record = {
            "id": raw.id,
            "channels": raw.attributes.channels,
            "messageCount": raw.attributes.messageCount,
            "createdAt": dt_createdAt,
            "endedAt": dt_endedAt,
            "tags": formatTags(raw.attributes.tags),
            "deviceStr": "",
            "reasonForSupportStr": "",
            "fromWhichChainStr": "",
            "whichAssetsStr": "",
            "poolOrParingStr": "",
          };
          if (raw.attributes.custom) {
            record.deviceStr = raw.attributes.custom.deviceStr ? raw.attributes.custom.deviceStr : "";
            record.reasonForSupportStr = raw.attributes.custom.reasonForSupportStr ? raw.attributes.custom.reasonForSupportStr : "";
            record.fromWhichChainStr = raw.attributes.custom.fromWhichChainStr ? raw.attributes.custom.fromWhichChainStr : "";
            record.whichAssetsStr = raw.attributes.custom.whichAssetsStr ? raw.attributes.custom.whichAssetsStr : "";
            record.poolOrParingStr = raw.attributes.custom.poolOrParingStr ? raw.attributes.custom.poolOrParingStr : "";
          }
          records_to_save.push(record);
        } catch (e) {
          console.log("Catch:");
          console.log(e);
        }
      }
      console.log(records_to_save);
    });
}());


function formatTags(arrTagIds) {
  let arrFormattedTags = [];
  if (arrTagIds) {
    for (var tagId of arrTagIds) {
      arrFormattedTags.push(objTagLookup[tagId]);
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
