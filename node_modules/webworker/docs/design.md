## Overview and Motivation

`node-webworkers` aims to implement as much of the [HTML5 Web
Workers](http://www.whatwg.org/specs/web-workers/current-work/) API as is
practical and useful in the context of NodeJS. Extensions to the HTML5 API
are provided where it makes sense (e.g. to allow file descriptor passing).

The motivation for providing this API to NodeJS is as follows

*   A set of standard (well, emerging standard anyway) platform-independency
    concurrency APIs is a useful abstraction. Particularly as HTML5 gains
    wider adoption and JavaScript developers are likely to familiar with Web
    Workers from doing browser development. The set of Node.JS primitives
    for managing processes, `child_process` provides a lot of utility, but
    is easily misunderstood by developers who have not developed for a UNIX
    platofrm before (e.g. "why does `kill()` not kill my process?").
    
    In addition, the error reporting APIs in the Web Workers spec are more
    full-featured and JavaScript-specific than that provided natively by
    `child_process` (e.g. one can get a stack trace, etc).

*   Existing communicaiton mechanisms with child processes involve
    communicating over `stdin`/`stdout`. These are opaque byte streams and
    require the application to implement their own framing logic to discern
    message boundaries. Further, use of these built-in streams prevents
    `sys.puts()` and friends from working.

*   [Shared Workers](http://dev.w3.org/html5/workers/#shared-workers-and-the-sharedworker-interface)
    provide a useful naming service for communicating with other workers by
    name. Without this, the application must maintain its own routing
    structure.
    
    Note that shared workers are *not* implemented yet.

## Design

The design that follows for Web Workers is motivated by a handful of
underlying assumptions / philosophies:

*   Worker instances should be relatively long-lived. That is, it is not
    considered an important workload to be able to create and destroy
    thousands of workers as quickly as possible. Passing messages to
    existing workers to dispatch work items is favored over creating a new
    worker for each work item.
    
*   In the future, it will be desirable to run workers off-box, and to
    implement workers in other application frameworks / languages. This is
    particularly relevant in the choice of communication medium.

In addition, there is a general preference to embracing standards and
existing building blocks, particularly those that are geared towards
JavaScript and/or HTTP.

### Worker Processes

Each worker executes in its own self-contained `node` process rather than as
a separate thread and V8 context within the master process.

Benefits of this approach include fault isolation (any worker running out of
memory or triggering some buggy C++ code will not take down other workers);
avoiding the complexity of managing multiple event loops in a single
process; and typical OSes are more likely to schedule different processes on
different CPUs (this may not always happen for multiple threads within the
same process), allowing the application to utilize multiple CPUs.

Drawbkacks include the cost of context switching between workers being more
expensive when using a process-per-worker model than it would be in a
thread-per-worker model; passing messages between processes typically
requires a data copy and always requires serializing data; and overhead of
spawning a new process.

### Worker Context

Each worker is launched by `webworker-child.js`.

This script is passed to `node` as the entry point for the process and is
responsible for constructing a V8 script context populated with bits
relevant to the Web Worker API (e.g. the `postMessage()`, `close()` and
`location` primitives, etc).

### Inter-worker Communication

The Web Workers spec provides a simple message passing API.

Under the covers, this is implemented by connecting each dedicated worker to
its parent process with a UNIX domain socket. This is lower overhead than
TCP, and allows for UNIX goodies like file descriptor passing.

Message passing is done over this UNIX socket by negotiating an HTML5 Web
Socket connection over this transport. This is done to provide a
reasonably-performant standards-based message framing implementation and to
lay the groundwork or communicating with off-box workers via HTTP over TCP,
which may be implemented in another application stack entirely (e.g. Java,
etc). The overhead of negotiating and maintaining the Web Socket connection
is 1 round trip for handshaking and the overhead of maintaining HTTP state
objects (`http_parser` and such). The handshaking overhead is not considered
an undue burden given that workers are expected to be relatively long-lived
and the HTTP state overhead considered small.

The format of the messages themselves is JSON, serialized using
`JSON.stringify()` and de-serialized using `JSON.parse()`. Significantly,
the use of a framing protocol allows the Web Workers implementation to wait
for an entire, complete JSON blob to arrive before invoking `JSON.parse()`.
