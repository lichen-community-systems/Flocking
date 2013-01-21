// Verify that we can spawn a worker, send and receive a simple message, and
// kill it.

var assert = require('assert');
var path = require('path');
var sys = require('sys');
var Worker = require('../lib/webworker').Worker;

var receivedMsg = false;
var receivedExit = false;

var w = new Worker(path.join(__dirname, 'workers', 'simple.js'));

w.onmessage = function(e) {
    assert.ok('data' in e);
    assert.equal(e.data.bar, 'foo');
    assert.equal(e.data.bunkle, 'baz');

    receivedMsg = true;

    w.terminate();
};

w.onexit = function(c, s) {
    assert.equal(c, 0);
    assert.equal(s, null);

    receivedExit = true;
};

w.postMessage({'foo' : 'bar', 'baz' : 'bunkle'});

process.addListener('exit', function() {
    assert.equal(receivedMsg, true);
    assert.equal(receivedExit, true);
});
