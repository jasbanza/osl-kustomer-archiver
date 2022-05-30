# osl-kustomer-archiver
Remove old conversations from Kustomer. Preserve stats to Google Sheets

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Usage](#usage)

## Prerequisites
- Node.js v16.15.0 or later
- npm v8.5.5 or later (included with Node.js)

## Setup
- [Kustomer API](#kustomer-api)
- [Google API](#google-api)
- [Google Sheets](#google-sheets)
- [Node.js](#nodejs)

### Kustomer API:
- API Key with the following 4 roles:
  - org.permission.conversation.delete
  - org.permission.conversation.read
  - org.permission.search_execution.create
  - org.permission.tag.read

### Kustomer Saved Search:
- Make a Saved Search, and remember to make it publicly viewable in it's settings. Note it's ID (taken from the URL when you edit it) which is used in the config.json

### Google API:
- Setup a new Google Project and create a "Service account", with this guide:

[Google Developers Console](https://console.developers.google.com/)

![image](https://user-images.githubusercontent.com/1925470/170743950-7df949d1-ba54-45fa-865f-a39e0e36f792.png)

https://theoephraim.github.io/node-google-spreadsheet/#/getting-started/authentication?id=service-account

![image](https://user-images.githubusercontent.com/1925470/170743962-f0dba866-883e-4048-a48f-45cb51db82af.png)

### Google Sheets
- Create a new Google Sheet
- Name one of the sheet tabs to "import":

![image](https://user-images.githubusercontent.com/1925470/170741510-e852d5c2-0853-4017-8ffe-15bb9a119d57.png)

- On the "import" sheet tab, set columns B, E & F to be a datetime format of your choice
- Share the google sheet with the Service Account email address as per the [Google API Guide](#google-api)

### Node.js

In your Node.js working directory install the package:
```bash
npm -i osl-kustomer-archiver
```

Copy ```./config/config.template.json``` file to ```./config/config.json``` and edit the values.

Most are self-explanatory.

Firstly, set ```ENVIRONMENT.NAME``` accordingly.

If there is an unexpected error, setting ```DEBUG_MODE``` to ```true``` will show some verbose variable information in the terminal output.


To execute a saved-search in Kustomer, you need to aquire a ```CSRF token``` from the frontend request when testing the saved search, since they are not accisible directly through the API. This can easily be aquired using devtools, and looking for the "/execute" request

The ```SHEET_ID``` is simply the id in the URL when you open the google sheet:
https://docs.google.com/spreadsheets/d/ ***THIS_PART_HERE*** /edit



```json
{
  "ENVIRONMENT": {
    "NAME": "My Environment",
    "DEBUG_MODE": false
  },
  "KUSTOMER": {
    "API_KEY": "Get from Kustomer settings",
    "HEADER_CSRF_TOKEN": "Copy from frontend request",
    "COOKIE_CSRF_TOKEN": "Copy from frontend request",
    "SAVED_SEARCH_ID": "Get from the URL when editing a Saved Search"
  },
  "GOOGLE": {
    "SERVICE_ACCOUNT_EMAIL": "copied from service account credentials generated by google",
    "PRIVATE_KEY": "copied from service account credentials generated by google",
    "SHEET_ID": "the long ID in the sheets URL"
  }
}

```


#### Included Dependancies:
- [google-spreadsheet](https://www.npmjs.com/package/google-spreadsheet)
- [js-console-log-colors](https://www.npmjs.com/package/js-console-log-colors)
- [node-fetch@2](https://www.npmjs.com/package/node-fetch) (CommonJS version)




## Usage

### Run manually:
```bash
node index.js
```
OR
```bash
npm start
```

### Run periodically:

- Open crontab
```bash
$ crontab -e
```

#### Every Hour
```bash
0 * * * * node /path/to/this/repo/index.js >/dev/null 2>&1
```

#### 2pm Every Day
```bash
0 14 * * * node /path/to/this/repo/index.js >/dev/null 2>&1
```
