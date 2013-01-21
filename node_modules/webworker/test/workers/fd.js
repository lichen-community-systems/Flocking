var assert = require('assert');
var net = require('net');
var sys = require('sys');

var s = undefined;

onmessage = function(e) {
    assert.ok('fd' in e);
    assert.ok(e.fd > 0);

    s = new net.Stream(e.fd);
    s.write(JSON.stringify(e.data));
};

// XXX: See comment in test/workers/simple.js.
onclose = function() {
    s.destroy();
};
