var assert = require('assert');
var http = require('http');

process.setuid('nobody');

var banner = undefined;

var srv = http.createServer(function(req, resp) {
    resp.writeHead(200, {'Content-Type' : 'text/plain'});
    resp.write(banner + ' (pid ' + process.pid + ')\n');
    resp.end();
});

onmessage = function(msg) {
    assert.ok(msg.fd && msg.fd > 0);

    banner = msg.data.banner;

    srv.listenFD(msg.fd);
};
