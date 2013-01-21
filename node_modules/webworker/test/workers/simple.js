var assert = require('assert');

onmessage = function(e) {
    assert.ok('data' in e);
    assert.ok('foo' in e.data);
    assert.equal(e.data.foo, 'bar');

    var msg = {};
    for (k in e.data) {
        msg[e.data[k]] = k;
    }

    postMessage(msg);
};

// XXX: We can do better than this. We should have an API to detach the
//      worker from the event loop so that we can exit cleanly. Otherwise,
//      test-simple.js can never work, really.
onclose = function() {
    process.exit(0);
};
