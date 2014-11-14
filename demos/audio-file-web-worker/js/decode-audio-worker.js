/*global flock, importScripts, postMessage, self*/

(function () {

    "use strict";

    importScripts(
        "./flocking-audiofile.js"
    );

    flock.audio.workerDecoder = {};

    flock.audio.workerDecoder.sendBuffer = function (buffer) {
        postMessage({
            msg: "afterDecoded",
            buffer: buffer
        });
    };

    self.addEventListener("message", function (e) {
        var url;
        if (e.data.msg === "decode") {
            url = e.data.url.toString();
            flock.audio.decode(url, flock.audio.workerDecoder.sendBuffer);
        }
    });

}());
