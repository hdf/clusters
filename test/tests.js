var assert = require('assert'),
    //exec = require('child_process').execSync,
    spawn = require('child_process').spawn,
    https = require('https');

var server, port = '8082';

function connect(cb, path, method) {
  path = path || '/';
  method = method || 'GET';
  var req = https.request({
    host: 'localhost',
    port: port,
    path: path,
    method: method,
    rejectUnauthorized: false,
    requestCert: true,
    agent: false
  }, cb);
  req.on('error', function(err) {
    console.dir(err);
  });
  req.end();
}

describe('Clusters', function() {
  //this.timeout(5000);

  before(function(done) {
    //exec('npm start');
    server = spawn('node', ['server', '--port', port]);
    server.stderr.on('data', function(data) {
      console.log(data.toString());
    });
    done();
  });

  it('server started', function(done) {
    server.stdout.on('data', function(data) {
      assert.equal(data.toString().substr(-1 - port.length, port.length), port);
      done();
    });
  });

  it('should be able to connect', function(done) {
    connect(function(res) {
      assert.equal(res.statusCode, 200);
      done();
    });
  });

  it('should get the right data back', function(done) {
    connect(function(res) {
      var html = '';
      res.on('data', function(chunk) {
        html += chunk;
      });
      res.once('end', function() {
        assert.equal(html.indexOf('<title>Clusters Client UI</title>'), 140);
        done();
      });
    });
  });

  after(function() {
    //exec('npm stop');
    server.kill();
  });
});
