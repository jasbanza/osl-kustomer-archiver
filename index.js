'use strict';
const http = require("http");
const config = require("config.json");
// const sdk = require('api')('@kustomer-api-docs/v1.0#snhyfky3gfzlb');

// sdk.auth('');
// sdk.GetAllSearches()
//   .then(res => console.log(res))
//   .catch(err => console.error(err));







// HTTP Server
const server = http.createServer(async (req, res) => {

  res.writeHead(200);
  res.write("server running");
  res.end();
});
