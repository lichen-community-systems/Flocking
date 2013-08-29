"use strict";

// TODO: Allow toggling of these files with a production concatenated build.
importScripts(
    "../third-party/polydataview/js/polydataview.js",
    "./flocking-audiofile.js"
);

flock.audio.workerDecoder = {};

flock.audio.workerDecoder.sendBuffer = function (buffer, type) {
    postMessage({
        msg: "afterDecoded",
        buffer: buffer,
        type: type
    });
};

flock.audio.workerDecoder.sendError = function (errorMsg) {
    postMessage({
        msg: "onError",
        errorMsg: errorMsg
    });
};

onmessage = function (e) {
    var data = e.data,
        type = data.type;

    if (data.msg === "decode") {
        try {
            var buffer = flock.audio.decodeArrayBuffer(data.rawData, type);
            flock.audio.workerDecoder.sendBuffer(buffer, type);
        } catch (err) {
            flock.audio.workerDecoder.sendError(err.message);
        }
    }
};
