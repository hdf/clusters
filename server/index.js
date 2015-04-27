//{ Variable setup
var spdy = require('spdy'),
    express = require('express'),
    app = express(),
    compress = require('compression'),
    helmet = require('helmet'),
    //session = require('express-session'),
    bodyParser = require('body-parser'),
    engines = require('consolidate'),
    //uuid = require('node-uuid').v4,
    basicAuth = require('basic-auth'),
    argv = require('minimist')(process.argv.slice(2)),
    UglifyJS = require("uglify-js"),
    //CleanCSS = require('clean-css'),
    favicon = require('serve-favicon'),
    fs = require('fs'),
    zlib = require('zlib'),
    stream = require('stream');

var options = {
  key: fs.readFileSync(__dirname + '/keys/server.key'),
  cert: fs.readFileSync(__dirname + '/keys/server.crt'),
  ca: fs.readFileSync(__dirname + '/keys/root.crt')
};
//}

//{ Minify client js and css files
fs.writeFileSync(__dirname + '/../www/static/func.min.js', UglifyJS.minify(__dirname + '/../www/static/func.js').code);
fs.writeFileSync(__dirname + '/../www/static/main.min.js', UglifyJS.minify(__dirname + '/../www/static/main.js').code);
//fs.writeFileSync(__dirname + '/../www/static/css/custom.min.css', new CleanCSS().minify(fs.readFileSync(__dirname + '/../www/static/css/custom.css')).styles);
//}

//{ Server setup
var port = argv.port || 8082;
app.use(helmet());
app.use(helmet.hsts({maxAge: 16070400000, includeSubdomains: true}));
app.use(helmet.frameguard('deny'));
app.disable('x-powered-by');
app.use(compress());
app.use(bodyParser.json());
app.engine('html', engines.hogan);
app.set('view engine', 'html');
app.set('views', __dirname + '/../www');
app.use(function(req, res, next) { // Strip redundant headers, that break the protocol, if we are proxied through nginx
  if (req.headers['x-nginx-proxy']) {
    res.removeHeader('x-frame-options');
    res.removeHeader('strict-transport-security');
  }
  next();
});
app.use(favicon(__dirname + '/../nwjs/icon.png'));
app.use('/static', express['static'](__dirname + '/../www/static'));
/*app.use(session({
  cookie: { secure: true },
  genid: function(req) {
    return uuid()
  },
  store: new MongoStore({ db: db }),
  secret: 'Video Killed the Radio Star',
  resave: false,
  rolling: true,
  saveUninitialized: true
}));*/
//}

//{ Logging
function logger(txt, console_too) {
  fs.appendFile(__dirname + '/server.log', txt + '\n', function(err){if(err)throw err;});
  if (console_too) console.log(txt);
}

app.use(function(req, res, next) {
  logger(
    (req.headers['x-forwarded-for'] || req.connection.remoteAddress) + ' - ' +
    new Date().toLocaleString() + ' - ' +
    req.method + ' - ' +
    req.url + ' - ' +
    req.headers['user-agent']
  );
  next();
});
//}

//{ Basic Auth
var ips = {};
var auth = function (req, res, next) {
  var ip = 'ip_' + (req.headers['x-forwarded-for'] || req.connection.remoteAddress);
  var user = basicAuth(req);
  function unauthorized() {
    if (ips[ip])
      ips[ip].tries++;
    else
      ips[ip] = {tries: 1};
    if (typeof(user) != 'undefined')
      logger('Failed login attempt from: ' + (req.headers['x-forwarded-for'] || req.connection.remoteAddress) + ' tries: ' + ips[ip].tries + ' tried: ' + user.name + ' - ' + user.pass);
    ips[ip].lastTry = Date.now();
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.sendStatus(401);
  }
  if (!user || !user.name || !user.pass || (ips[ip] && (Date.now() - ips[ip].lastTry) < 6e5 && ips[ip].tries > 2)) // 3 tries every 10 minutes
    return unauthorized();
  if (user.name === 'marco' && user.pass === 'polo') {
    if (ips[ip]) delete ips[ip]; // Amnesty :)
    return next();
  } else {
    return unauthorized();
  }
};
//}

//{ Server Push (does not work through nginx)
var mimes = {
  types: {
    'js': 'application/javascript',
    'json': 'application/json',
    'css': 'text/css; charset=UTF-8',
    'txt': 'text/plain; charset=UTF-8',
    'jpg': 'image/jpeg',
    'png': 'image/png'
  },
  exts: {
    '.js': ['js', true], // True menas, should be compressed
    '.json': ['json', true],
    '.jpg': ['jpg'],
    '.png': ['png'],
    '.css': ['css', true],
    '.l20n': ['txt', true]
  }
};
function mime(file) {
  var ext = file.substr(file.lastIndexOf('.'));
  var headers = {};
  headers['content-type'] = mimes.types[mimes.exts[ext][0]];
  if (push_compressed.indexOf(file) >= 0) {
    headers['content-encoding'] = 'gzip';
    headers['accept-ranges'] = 'bytes';
  }
  return headers;
}

var push_files = [
  'css/normalize.min.css',
  'css/foundation.min.css',
  'css/custom.css',
  'locale/locale.json',
  'locale/en.l20n',
  'locale/hu.l20n',
  'en.png',
  'hu.png',
  'l20n.min.js',
  'main.min.js',
  'func.min.js'
  //'background.jpg' // Browsers do not accept large files, they prefer to get them themselves
];
push_cache = {}, push_compressed = [];

function fillPushCache() {
  function writer(chunk, encoding, done) {
    this.buffs.push(chunk);
    done();
  }
  function errHandler(e){
    console.log(e);
  }
  function finisher() {
    push_cache[this.file] = Buffer.concat(this.buffs);
    push_compressed.push(this.file);
  }
  var file, size, path = __dirname + '/../www/static/';
  for (var i = 0; i < push_files.length; i++) {
    file = push_files[i];
    size = fs.statSync(path + file).size;
    if (!mimes.exts[file.substr(file.lastIndexOf('.'))][1] || size < 1024) { // If not compressible, or too small
      push_cache[file] = fs.readFileSync(path + file);
      continue;
    }
    var s = new stream.Writable();
    s.file = file;
    s.buffs = [];
    s._write = writer;
    s.on('error', errHandler);
    s.on('finish', finisher);
    fs.createReadStream(path + file)
      .pipe(zlib.createGzip())
      .pipe(s);
  }
}
if (argv.push) fillPushCache();

function pusher(req, res) {
  if (!res.push) // If proxied through nginx
    return;

  function pushHandler(err, stream) {
    stream.on('error', function(err) {
      if (err.code != 'RST_STREAM' && err.message != 'Write after end!') { // Browser cancelled the request (probably)
        console.log(err);
      }
    });
  }

  function pushIt(file) {
    var s = res.push('/static/' + file, mime(file), pushHandler);
    var bufferStream = new stream.Transform();
    bufferStream.push(push_cache[file]);
    bufferStream.end();
    bufferStream.pipe(s);
  }

  for (var i = 0; i < push_files.length; i++) {
    pushIt(push_files[i]);
  }
}
//}

//{ Page handling
app.get(/^.+\/$/, function(req, res) {
  res.redirect(301, '/');
});
app.get('/', function(req, res) {
  if (argv.push) pusher(req, res);
  res.render('index'/*, {'min': minified}*/);
});
app.get('/status', auth, function(req, res) {
  if (argv.push) pusher(req, res);
  res.render('status', {'state': 'state = ' + JSON.stringify(getStatus()) + ';'});
});
app.get('/status_source', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/event-stream; charset=UTF-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Transfer-Encoding': 'chunked'});
  var tmp = '', state;
  var timer = setInterval(function() {
    state = JSON.stringify(getStatus());
    if (state == tmp) return; // Uncomment!!!
    res.write('data: ' + state + '\n\n');
    res.flush();
    tmp = state;
  }, 1500);
  res.on('close', function() {
    clearInterval(timer);
  });
});
app.post('/reset', auth, function(req, res) {
  var pkg = req.body.packageId.split('_');
  if (packages[pkg[0]] && packages[pkg[0]][pkg[1]]) {
    if (packages[pkg[0]][pkg[1]].t)
      delete packages[pkg[0]][pkg[1]].t;
    if (packages[pkg[0]][pkg[1]].lt)
      delete packages[pkg[0]][pkg[1]].lt;
  }
  if (results[pkg[0]] && results[pkg[0]][pkg[1]])
    delete results[pkg[0]][pkg[1]];
  res.end();
});
app.get('/restart', auth, function(req, res) {
  if (argv.forever) process.exit();
  res.end();
});
app.post('/get', function(req, res) {
  res.writeHead(200, {'Content-Type': 'application/json'});
  var done = false, proj, n2, pkgN, json;
  for (var i = 0, n = Object.keys(packages).length; i < n; i++) { // Select first project, if all packages completed, or empty, move to next one
    proj = Object.keys(packages)[i];
    n2 = Object.keys(packages[proj]).length;
    for (var i2 = 0; i2 < n2; i2++) { // Select first package, if completed, or empty, move to next one
      pkgN = Object.keys(packages[proj])[i2];
      if (proj && pkgN) { // If package exists ( might be unnecessary, but lets just keep it anyway, for luck :) )
        if (packages[proj][pkgN].t) { // If this package is already out, don't send it again
          if (results[proj] && results[proj][pkgN]) // Infact, drop results for this package
            delete results[proj][pkgN];
          continue;
        }
        json = { // This is what we will send
          packageId: proj + '_' + pkgN,
          data: packages[proj][pkgN].d,
          time: Date.now()
        };
        packages[proj][pkgN].t = json.time; // Update memory store
        if (req.body.packageId.split('_')[0] != proj) // If we give a new package, also give function, which to apply to the data
          json.func = funcs[proj];
        res.write(JSON.stringify(json));
        done = true;
        break;
      }
    }
    if (done) break;
  }
  if (!done) res.write('{}');
  res.end();
});
app.post('/result', function(req, res) {
  processResult(req.body);
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.write(JSON.stringify({packageId: req.body.packageId, msg: 'Got it, thx. :)'}));
  res.end();
});
app.post('/pkgstatus', function(req, res) { // Have we comppleted it, and was it given out at the given time?
  res.writeHead(200, {'Content-Type': 'application/json'});
  var pkg = req.body.packageId.split('_');
  res.write(JSON.stringify({
    // Completed might be a lie, we might just have it out by someone else already
    status: (indexOfFor(completed, req.body.packageId) < 0 &&
    packages[pkg[0]] && packages[pkg[0]][pkg[1]] &&
    // Since "packages" is not stored on disk, server restart means, we have no idea what is "out there", assume need
    (typeof(packages[pkg[0]][pkg[1]].t) == 'undefined' || packages[pkg[0]][pkg[1]].t == req.body.time))?'need':'completed'
  }));
  res.end();
});
app.get('/download', function(req, res) {
  if (isItDone(req.query.project) < 0)
    res.status(404).end();
  else
    res.download(__dirname + '/db/projects/' + req.query.project + '_results.json');
});
function isItDone(p) {
  for (var i = 0, n = projects.length; i < n; i++)
    if (projects[i][p] && projects[i][p].completed) return i;
  return -1;
}
//}

//{ Start server
var server = spdy.createServer(options, app);
server.listen(port, function(){logger('Clusters server started at ' + new Date().toLocaleString() + ' on port: ' + port, true);}); //443
//}

//{ Database loading
var projects, completed, packages = {}, funcs = {}, results = {};
try {
  projects = JSON.parse(fs.readFileSync(__dirname + '/db/projects.json'));
} catch(err) {
  projects = [];
}
try {
  completed = JSON.parse(fs.readFileSync(__dirname + '/db/completed.json'));
} catch(err) {
  completed = [];
}

function loadDb() {
  // Update database changes
  projects = updateDb('projects', projects, false, function(rec, arr){
    var firstRec = first(rec);
    for (var i = 0, n = arr.length; i < n; i++) // Let's see if we have this id
      if (first(arr[i]) == firstRec) return i;
    return -1;
  });
  completed = updateDb('completed', completed);
  // Fill up packages array
  var id, res;
  for (var i = 0, n = projects.length; i < n; i++) {
    id = first(projects[i]);
    if (!projects[i][id].completed) {
      projects[i][id].completed = false;
      packages[id] = chunk(id, projects[i][id].chunkSize, completed);
      funcs[id] = (fs.existsSync(__dirname + '/db/projects/' + id + '.js'))?fs.readFileSync(__dirname + '/db/projects/' + id + '.js').toString().trim():''; // Cache project function
    }
    // Update project results changes
    try {
      res = JSON.parse(fs.readFileSync(__dirname + '/db/projects/' + id + '_results.json'));
    } catch(err) {
      res = [];
    }
    updateDb('projects/' + id + '_results', res, true);
  }
}
loadDb();

function chunk(project, chunkSize, completed) { // Chop up project data to package sized bits
  chunkSize = chunkSize || 5000;
  completed = completed || [];
  var arr;
  try {
    arr = JSON.parse(fs.readFileSync(__dirname + '/db/projects/' + project + '.json'));
  } catch(err) {
    arr = [];
  }
  var ret = {}, i = 0, i2 = 0, n = arr.length;
  while (i < n) {
    if (indexOfFor(completed, project + '_' + i2) < 0)
      ret[i2] = {d: arr.slice(i, i + chunkSize)};
    i += chunkSize;
    i2++;
  }
  return ret;
}

function updateDb(db, arr, compact, finder) {
  finder = finder || function(rec, arr){return indexOfFor(arr, rec);};
  compact = compact || false;
  var changes = (fs.existsSync(__dirname + '/db/' + db + '.changes'))?fs.readFileSync(__dirname + '/db/' + db + '.changes').toString().split('\n'):[];
  changes.pop();
  var rec, pos, cn = changes.length;
  for (var i = 0; i < cn; i++) {
    if (changes[i].charAt(0) == '{')
      rec = JSON.parse(changes[i]);
    else
      rec = changes[i];
    pos = finder(rec, arr);
    if (pos >= 0) { // Found it in db
      if (rec.del) // Delete record
          arr.splice(pos, 1);
        else // Update
          arr[pos] = rec;
    } else // Add it to db
      arr.push(rec);
  }
  if (cn > 0) {
    fs.writeFileSync(__dirname + '/db/' + db + '.changes', '');
    if (compact) arr = arrayfy(arr);
    fs.writeFile(__dirname + '/db/' + db + '.json', JSON.stringify(arr), function(err){if(err)throw err;});
  }
  return arr;
}

function first(obj) {
  for (var a in obj) return a;
}

function indexOfFor(arr, x) {
  for (var i = 0, n = arr.length; i < n; i++)
    if (arr[i] === x) return i;
  return -1;
}

/*function arrayfy(arr) { // Supposed to be a general approach, but I am not happy with this solution
  var out = [];
  var n = (arr.constructor === Object)?Object.keys(arr).length:arr.length;
  for (var i = 0; i < n; i++) {
    while (typeof(arr[i]) == 'undefined') i++; // Could be dangerous
    out = out.concat((typeof(arr[i]) != 'object')?[arr[i]]:arrayfy(arr[i], out));
  }
  return out;
}*/

function arrayfy(arr) {
  var out = [], a, c;
  for (var i = 0, n = arr.length; i < n; i++) {
    if (typeof(arr[i]) != 'object') { // Should be from imported results
      out = out.concat(arr[i]);
      continue;
    }
    a = [];
    c = Object.keys(arr[i])[0];
    for (var i2 = 0, n2 = Object.keys(arr[i][c]).length; i2 < n2; i2++)
      a[i2] = arr[i][c][i2];
    out = out.concat(a);
  }
  return out;
}
//}

//{ Logic
function processResult(result) {
  //result.result.sort(function(a,b){return (a[0] < b[0]) ? -1 : 1;});
  var pkg = result.packageId.split('_');
  if (typeof(packages[pkg[0]][pkg[1]].t) == 'undefined') // There was a server restart, or admin reset the package, sorry client, but I have to throw away your result
    return;
  if (!results[pkg[0]]) results[pkg[0]] = {}; // Init if empty
  if (!results[pkg[0]][pkg[1]]) results[pkg[0]][pkg[1]] = {}; // Init if empty
  for (var i = 0, n = result.result.length; i < n; i++) // Add partial results to memory store
    results[pkg[0]][pkg[1]][result.result[i][0]] = result.result[i][1];
  if (packages[pkg[0]][pkg[1]].d.length == Object.keys(results[pkg[0]][pkg[1]]).length) { // Package complete
    var obj = {};
    obj[pkg[1]] = results[pkg[0]][pkg[1]];
    fs.appendFile(__dirname + '/db/projects/' + pkg[0] + '_results.changes', JSON.stringify(obj) + '\n');
    fs.appendFile(__dirname + '/db/completed.changes', result.packageId + '\n');
    completed.push(result.packageId);
    delete results[pkg[0]][pkg[1]];
    delete packages[pkg[0]][pkg[1]];
  } else { // Add timestamp to package (client last seen)
    packages[pkg[0]][pkg[1]].lt = Date.now();
  }
  if (Object.keys(packages[pkg[0]]).length < 1) { // Project complete
    for (var i2 = 0, n2 = projects.length; i2 < n2; i2++)
      if (first(projects[i2]) == pkg[0]) {
        projects[i2][pkg[0]].completed = true;
        fs.appendFile(__dirname + '/db/projects.changes', JSON.stringify(projects[i2]) + '\n');
        break;
      }
    delete results[pkg[0]];
    delete packages[pkg[0]];
    fs.readFile(__dirname + '/db/projects/' + pkg[0] + '_results.json', {encoding: 'utf-8'}, function (err, data) {
      updateDb('projects/' + pkg[0] + '_results', (data)?JSON.parse(data):[], true);
    });
  }
}

function getStatus() {
  var p = [], c, k, pkgn, pkgs, i3;
  for (var i = 0, n = projects.length; i < n; i++) {
    k = Object.keys(projects[i])[0];
    pkgn = (packages[k])?Object.keys(packages[k]).length:0;
    c = 0;
    pkgs = {};
    for (var i2 = 0, n2 = completed.length; i2 < n2; i2++) // Number of completed packages for this project
      if (k == completed[i2].split('_')[0]) c++;
    for (i3 in packages[k]) { // Packages, that are out
      pkgs[i3] = {};
      if (packages[k][i3].t) // Package sent at
        pkgs[i3].t = packages[k][i3].t;
      if (packages[k][i3].lt) // Last partial result seen at
        pkgs[i3].lt = packages[k][i3].lt;
      if (results[k] && results[k][i3]) // Number of completed partials
        pkgs[i3].completed = Object.keys(results[k][i3]).length;
      if (Object.keys(pkgs[i3]).length < 1) delete pkgs[i3];
    }
    p[i] = {
      name: k,
      packages: pkgn,
      completed: c,
      pkgsize: projects[i][k].chunkSize,
      pkgs: pkgs
    };
  }
  return p;
  //return {projects: p, packages: packages, results: results, completed: completed};
}
//}
