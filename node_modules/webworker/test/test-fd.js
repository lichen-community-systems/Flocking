// Verify that we can send and receive a file descriptor.

var assert = require('assert');
var net = require('net');
var netBinding = process.binding('net');
var path = require('path');
var sys = require('sys');
var Worker = require('../lib/webworker').Worker;

var w = new Worker(path.join(__dirname, 'workers', 'fd.js'));

var fds = netBinding.pipe();

var s = new net.Stream(fds[0]);
s.resume();

var receivedData = false;
s.addListener('data', function(d) {
    var o = JSON.parse(d.toString('utf8'));

    assert.equal(o.grumpy, 'frumpy');

    receivedData = true;
    s.destroy();
    w.terminate();
});

w.postMessage({ 'grumpy' : 'frumpy' }, fds[1]);

process.addListener('exit', function() {
    assert.equal(receivedData, true);
});
