`node-webworkers` is an implementation of the [Web Workers
API](http://www.whatwg.org/specs/web-workers/current-work/) for
[node.js](http://nodejs.org).

See the design document
[here](http://blog.std.in/2010/07/08/nodejs-webworker-design/).

### Example

#### Master source

    var sys = require('sys');
    var Worker = require('webworker').Worker;
    
    var w = new Worker('foo.js');
    
    w.onmessage = function(e) {
        sys.debug('Received mesage: ' + sys.inspect(e));
        w.terminate();
    };
    
    w.postMessage({ foo : 'bar' });

#### Worker source

    onmessage = function(e) {
        postMessage({ test : 'this is a test' });
    };
    
    onclose = function() {
        sys.debug('Worker shuttting down.');
    };

### API

Supported API methods are

   * `postMessage(e)` in both workers and the parent; messages are in the
     parent if this is invoked before the child is fully initialized
   * `onmessage(e)` in both workers and the parent
   * `onerror(e)`in both workers and the parent
   * `terminate()` in the parent

In addition, some nonstandard APIs are provided

   * `onclose()` in the worker (allows for graceful shutdown)
   * The `postMessage()` method takes an additional optional file descriptor parameter, which
     will be sent with the message. This descriptor will be passed to
     `onmessage` handlers as an optional `fd` field. Handlers receiving
     messages posted without file descriptors will not see an `fd` field. Both
     the parent and child can send file descriptors using this mechanism.
   * `Worker.onexit(code, signal)` in the master, which is invoked on the
     master `Worker` object when the worker process exits.
   * The `Worker` constructor takes an additional optional object argument,
     `opts`, which is used as a dictionary of options with the following keys
      * `args` : A string or array of strings to pass to the executable before the filename to invoke. This can be used to request that the worker start up in debug mode (e.g. `{ 'args' : '--debug-brk' }`). By default this is empty.
      * `path` : A string naming the executable to invoke for workers. By default this is the value of `process.execPath` (e.g. `node` or similar).

### Installation

This package can be installed via [npm](http://npmjs.org/) as follows

    % npm install webworker

Note that this requires
[node-websocket-client](http://github.com/pgriess/node-websocket-client) v0.9.3
or later. This dependency will be handled automatically by `npm`, but must be
dealt with manually if installing using another procedure.

### Credits

This package contains a static snapshot of Micheil Smith's excellent
[node-websocket-server](http://github.com/miksago/node-websocket-server) with
some fixes applied to handle UNIX sockets.
