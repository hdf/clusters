//{ Get number of CPU cores (-1)
(function() {
  var cores = ((typeof(os) != 'undefined')?os.cpus().length:0 || navigator.hardwareConcurrency || 2) - 1;
  if (cores < 1) cores = 1;
  document.getElementById('workers').value = cores;
})();
//}

//{ #auto checkbox
document.getElementById('auto').onclick = function() {
  history.replaceState({page: 0}, document.title, (window.location.pathname + ((this.checked)?'#auto':'')));
};
document.getElementById('auto').checked = (window.location.hash == '#auto');
//}

//{ Spawn workers
var workers = [];
var proc = (typeof(localStorage.proc) != 'undefined' && localStorage.proc.length > 0)?localStorage.proc:'';
var inputData = (typeof(localStorage.inputData) != 'undefined' && localStorage.inputData.length > 0)?JSON.parse(localStorage.inputData):[];
var completed; // For progress meter
var c = 1; // Partition data for workers (dynamic scheduling)
var staticScheduling = false; // This is a switch (for the c above)!

function startWorkers() {
  stopWorkers();
  if (proc.length < 12) {
    alert('No processing function specified!');
    storageCleaner();
    return;
  }
  // Create worker content as blob
  var blob = new Blob(['var proc=' + proc + ';\n' + func.toString() + 'func();'], {type: 'text/javascript'});
  var code = window.URL.createObjectURL(blob);
  var n = document.getElementById('workers').value;
  for (var i = 0; i < n; i++) {
    workers[i] = new Worker(code);
    workers[i].onmessage = gotResult;
    workers[i].postMessage({id: i}); // Assign worker an id
  }
}

function stopWorkers() {
  for (var i = 0, n = workers.length; i < n; i++)
    workers[i].terminate();
  workers = [];
}

setInterval(function() { // Running workers display
  var e = document.getElementById('running');
  e.innerHTML = '<div data-l10n-id="runningworkers">Running Workers: </div>' + workers.length + '<br><div data-l10n-id="remainingjobs">Remaining jobs: </div>' + inputData.length;
  document.l10n.localizeNode(e);
}, 200);
//}

//{ Server communications
var pkgId = (typeof(localStorage.pkgId) != 'undefined' && localStorage.pkgId.length > 0)?localStorage.pkgId:'';
var getPackageTimer;

function ajax(url, data, cb) {
  cb = cb || function(){};
  var req = new XMLHttpRequest();
  req.onreadystatechange = function() {
    if (req.readyState == 4 && req.status == 200)
      cb(req.responseText);
  };
  req.open('POST', url, true);
  data = JSON.stringify(data);
  req.setRequestHeader('Content-Type', 'application/json');
  if (data.length > 1024) { // Compress if bigger than 1K
    req.setRequestHeader('Content-Encoding', 'gzip');
    data = new Blob([pako.gzip(data)], {type: 'application/json'});
  }
  req.send(data);
}

function getPackage() {
  ajax('get', {packageId: pkgId}, function(res) {
    document.getElementById('data').value = res;
    gotPackage(JSON.parse(res));
  });
}

function gotPackage(pkg) {
  if (getPackageTimer) clearTimeout(getPackageTimer);
  if (typeof(pkg.packageId) == 'undefined') { // If there are no more packages to process, check again in a minute
    getPackageTimer = setTimeout(getPackage, 60000);
    return;
  }
  pkgId = pkg.packageId;
  inputData = pkg.data;
  if (typeof(pkg.func) == 'string')
    localStorage.proc = proc = pkg.func;
  var tmp = [];
  for (var i = 0, n = inputData.length; i < n; i++) // Assign an index to each value (faster than map)
    tmp[i] = [i, inputData[i]];
  inputData = tmp;
  localStorage.inputData = JSON.stringify(inputData); // Store in case we want to resume after a browser crash or something
  localStorage.pkgId = pkgId;
  localStorage.time = pkg.time;
  if (window.location.hash == '#auto') doWork(); // Uncomment!!!
}

function sendResults() {
  ajax('result', {packageId: pkgId, result: results});
  results = [];
}

function storageCleaner() {
  var lng = localStorage.lang;
  localStorage.clear();
  localStorage.lang = lng;
}

// If we have unprocessed data waiting when we start, check if it's still needed
function checkStatus() {
  ajax('pkgstatus', {packageId: pkgId, time: localStorage.time}, function(res) {
    if (JSON.parse(res).status != 'need') {
      inputData = [];
      storageCleaner();
      if (window.location.hash == '#auto') getPackage();
    } else {
      document.getElementById('data').value = JSON.stringify({"packageId": pkgId, "data": inputData, time: localStorage.time});
      doWork();
    }
  });
}
if (inputData.length > 0)
  checkStatus();
else if (window.location.hash == '#auto')
  getPackage();
//}

//{ Work pump
function doWork() {
  startWorkers();
  if (typeof(inputData[0]) == 'undefined') { // We can continue, where we left off
    getPackage();
    return;
  }
  document.getElementById('progress').max = inputData.length;
  document.getElementById('progress').value = completed = 0;
  if (staticScheduling)
    c = Math.ceil(inputData.length / workers.length); // Partition data for workers (static scheduling)
  for (var i = 0, n = workers.length; i < n; i++) {
    if (inputData.length > i*c) {
      if (!staticScheduling)
        inputData[i].taken = true;
      workers[i].postMessage({data: inputData.slice(i*c, i*c+c)});
    }
  }
}

// Process results
var results = [];
var t = Date.now();
var bufferCheckTimer;

function gotResult(e) {
  results.push([e.data.i, e.data.out]);
  var i = getIndex(inputData, e.data.i);
  if (i >= 0) inputData.splice(i, 1); // Remove completed
  localStorage.inputData = JSON.stringify(inputData); // Update storage
  document.getElementById('progress').value = ++completed;
  if (!staticScheduling) { // Send next bit of data
    for (var i2 = 0; i2 < inputData.length; i2++) {
      if (!inputData[i2].taken) {
        inputData[i2].taken = true;
        this.postMessage({data: [inputData[i2]]});
        break;
      }
    }
  }
  if (bufferCheckTimer) clearTimeout(bufferCheckTimer);
  bufferCheck();
}

function getIndex(a, s) {
  for (var i = 0, n = a.length; i < n; i++)
    if (a[i][0] == s) return i;
  return -1; // Element not found
}

// Buffer manager
function bufferCheck() {
  if ((results.length > 0 && (Date.now()-t >= 60000 || inputData.length < 1)) || results.length > 5000) {
    document.getElementById('results').value = JSON.stringify(results);
    sendResults(); // Send back (partial) results to server
    if (inputData.length < 1) { // All done, so stop timer, and send request for more tasks
      storageCleaner();
      if (window.location.hash == '#auto') getPackage();
      return;
    }
    t = Date.now();
  }
  bufferCheckTimer = setTimeout(bufferCheck, 60000);
}
//}

//{ Worker code
function func() {
  var id = Math.floor(Math.random() * 9999); // Random worker id if not specified
  if (typeof(asmjs) == 'function') asmjs();
  onmessage = function(e) {
    if (typeof(e.data.id) == 'number') // Assign worker id
      id = e.data.id;
    if (typeof(e.data.data) == 'object')
      for (var i = 0, n = e.data.data.length; i < n; i++)
        postMessage({id: id, i: e.data.data[i][0], out: proc(e.data.data[i][1])}); // Pump input array trough processor function, and return results one by one
  };
}
//}
