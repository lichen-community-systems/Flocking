var assert = require('assert');
var sys = require('sys');

setTimeout(function() {
    assert.ok(false);
}, 5000);
