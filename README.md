# osl-kustomer-archiver
Remove old conversations from Kustomer. Preserve stats to Google Sheets



## Prerequisites
- Node.js v16.15.0 or later
- npm v8.5.5 or later (included with Node.js)

## Setup
- [ ] Kustomer API
- [ ] Google API
- [ ] 

### [Kustomer API:](#kustomer-api)
- API Key with the following 5 roles:
  - org.admin.search.read
  - org.user.search.read
  - org.user.search_execution.write
  - org.permission.search_execution.create
  - org.permission.conversation.delete

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


### Node.js

In your Node.js working directory install the package:
```npm -i osl-kustomer-archiver```

Copy ```./config/config-template.js``` file to ```./config/config.js```



#### Included Dependancies:
- [google-spreadsheet](https://www.npmjs.com/package/google-spreadsheet)
- [js-console-log-colors](https://www.npmjs.com/package/js-console-log-colors)
- [node-fetch@2](https://www.npmjs.com/package/node-fetch) (CommonJS version)




## Usage
