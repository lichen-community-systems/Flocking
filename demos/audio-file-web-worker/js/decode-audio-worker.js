
"use strict";

importScripts(
    "../third-party/polydataview/js/polydataview.js",
    "./flocking-audiofile.js"
);

flock.audio.workerDecoder = {};

flock.audio.workerDecoder.sendBuffer = function (buffer) {
    postMessage({
        msg: "afterDecoded",
        buffer: buffer
    });
};

onmessage = function (e) {
    var url;
    if (e.data.msg === "decode") {   
        url = new String(e.data.url).toString();
        flock.audio.decode(url, flock.audio.workerDecoder.sendBuffer);
    }
};

