<!-- View in: https://stackedit.io/editor -->
># **Clusters**
>### _Work distribution system using WebWorkers_

[![Build Status](https://travis-ci.org/hdf/clusters.svg)](https://travis-ci.org/hdf/clusters)
<br>
## Installation (Windows)
Install [node.js](https://nodejs.org/en/)
Install [Chrome](https://www.google.com/chrome/browser/desktop/) and/or [Firefox](https://www.mozilla.org/en-US/firefox/all/)  
Install [OpenSSL](http://slproweb.com/products/Win32OpenSSL.html) (for self signed certificate generation)  
Install forever (`npm install forever -g`)  

And than either:

Download, and extract https://github.com/hdf/clusters/archive/master.zip  
Rename `clusters-master` to `clusters`  
Install all other dependencies by navigating to `clusters` and typing `npm install`  

Or just type:

`npm install https://github.com/hdf/clusters.git`, and than move `node_modules/clusters` to where you like.  

#### Create self signed certificates by:
>opening shell (cmd.exe),
>navigating to `clusters/server/keys`,
>running makecerts.bat like this: `makecerts example.com`

<br>
## Creating a work project
**navigate to** `clusters/server/db`**, and edit** `projects.json`.

#### **projects.json format**:
```javascript
[
  {"project1_name":{
    "chunkSize":3, //This is how many elements a package is supposed to have
    "completed":false
  }},
  {"project2_name":{"chunkSize":4,"completed":false}},
  {"project3_name":{"chunkSize":4,"completed":false}
]
```

<br>
**create** `clusters/server/db/project1_name.json`  
_(This file contains the input data to be processed by WebWorkers on the clients (browsers).)_

#### **project1_name.json format**:
`[1,3,5,2,4,9,0,11]`

(The elements of the array don't have to be numbers, they can be anything, json objects, arrays...)

<br>
**create** `clusters/server/db/project1_name.js`  
_(This file contains the function that will run on the WebWorkers on the clients (browsers). The sole argument is an element of the array defined in `project1_name.json`.)_

#### **project1_name.js example**:
```javascript
function(d) {
  return d + d;
}
```

<br>
## Usage
Look inside `run.bat` for various ways of running the clusters server. In a production environment something like this is suggested:
>`forever start -w --minUptime 1000 --spinSleepTime 1000 server --port 8082 --forever`

To start processing the data, navigate to https://localhost:8082/#auto (by default).

To see, how overall processing of projects is doing, and download results, navigate to https://localhost:8082/status.  
The default user/password is marco/polo. (Users can be managed in the file `clusters/server/users.json`.)

To remotely restart the server, navigate to https://localhost:8082/restart

<br>
## Optional nginx reverse proxy configuration example:
```nginx
http {
  ...

  upstream node_clusters {
    server localhost:8082;
  }

  server {
    ...

    location ~* ^/clusters/(.*)$ {
      proxy_pass https://node_clusters;
      proxy_pass_header Server;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header Host $http_host;
      proxy_set_header X-NginX-Proxy true;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_buffering off;
      proxy_cache off;
      proxy_redirect off;
      rewrite ^/clusters(.*)$ $1 break;
    }
  }
}
```

<br>
### LICENSE
>[GNU AGPLv3](https://www.gnu.org/licenses/agpl-3.0.html)
