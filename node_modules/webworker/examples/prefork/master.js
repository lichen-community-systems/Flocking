var path = require('path');
var netBindings = process.binding('net');
var Worker = require('../lib/webworker').Worker;

var fd = netBindings.socket('tcp4');
netBindings.bind(fd, 80);
netBindings.listen(fd, 128);

for (var i = 0; i < 8; i++) {
    var w = new Worker(path.join(__dirname, 'worker.js'));
    w.postMessage({ 'banner' : 'Hello, world!' }, fd);
}
