/*
 * Flocking Audio File Utilities
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2014, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require, ArrayBuffer, Uint8Array, File, FileReader */
/*jshint white: false, newcap: true, regexp: true, browser: true,
forin: false, nomen: true, bitwise: false, maxerr: 100,
indent: 4, plusplus: false, curly: true, eqeqeq: true,
freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
funcscope: false*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {

    "use strict";

    var atob = typeof (window) !== "undefined" ? window.atob : require("atob");

    /**
     * Applies the specified function in the next round of the event loop.
     */
    // TODO: Replace this and the code that depends on it with a good Promise implementation.
    flock.applyDeferred = function (fn, args, delay) {
        if (!fn) {
            return;
        }

        delay = typeof (delay) === "undefined" ? 0 : delay;
        setTimeout(function () {
            fn.apply(null, args);
        }, delay);
    };


    /*********************
     * Network utilities *
     *********************/

    fluid.registerNamespace("flock.net");

    /**
     * Loads an ArrayBuffer into memory using XMLHttpRequest.
     */
    flock.net.readBufferFromUrl = function (options) {
        var src = options.src,
            xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (flock.net.isXHRSuccessful(xhr)) {
                    options.success(xhr.response,
                        flock.file.parseFileExtension(src));
                } else {
                    if (!options.error) {
                        throw new Error(xhr.statusText);
                    }

                    options.error(xhr.statusText);
                }
            }
        };

        xhr.open(options.method || "GET", src, true);
        xhr.responseType = options.responseType || "arraybuffer";
        xhr.send(options.data);
    };

    flock.net.isXHRSuccessful = function (xhr) {
        return xhr.status === 200 ||
            (xhr.responseURL.indexOf("file://") === 0 && xhr.status === 0 &&
            xhr.response);
    };


    /*****************
     * File Utilties *
     *****************/

    fluid.registerNamespace("flock.file");

    flock.file.mimeTypes = {
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/wave": "wav",
        "audio/x-aiff": "aiff",
        "audio/aiff": "aiff",
        "sound/aiff": "aiff"
    };

    flock.file.typeAliases = {
        "aif": "aiff",
        "wave": "wav"
    };

    flock.file.parseFileExtension = function (fileName) {
        var lastDot = fileName.lastIndexOf("."),
            ext,
            alias;

        // TODO: Better error handling in cases where we've got unrecognized file extensions.
        //       i.e. we should try to read the header instead of relying on extensions.
        if (lastDot < 0) {
            return undefined;
        }

        ext = fileName.substring(lastDot + 1);
        ext = ext.toLowerCase();
        alias =  flock.file.typeAliases[ext];

        return alias || ext;
    };

    flock.file.parseMIMEType = function (mimeType) {
        return flock.file.mimeTypes[mimeType];
    };

    /**
     * Converts a binary string to an ArrayBuffer, suitable for use with a DataView.
     *
     * @param {String} s the raw string to convert to an ArrayBuffer
     *
     * @return {Uint8Array} the converted buffer
     */
    flock.file.stringToBuffer = function (s) {
        var len = s.length,
            b = new ArrayBuffer(len),
            v = new Uint8Array(b),
            i;
        for (i = 0; i < len; i++) {
            v[i] = s.charCodeAt(i);
        }
        return v.buffer;
    };

    /**
     * Asynchronously parses the specified data URL into an ArrayBuffer.
     */
    flock.file.readBufferFromDataUrl = function (options) {
        var url = options.src,
            delim = url.indexOf(","),
            header = url.substring(0, delim),
            data = url.substring(delim + 1),
            base64Idx = header.indexOf(";base64"),
            isBase64 =  base64Idx > -1,
            mimeTypeStartIdx = url.indexOf("data:") + 5,
            mimeTypeEndIdx = isBase64 ? base64Idx : delim,
            mimeType = url.substring(mimeTypeStartIdx, mimeTypeEndIdx);

        if (isBase64) {
            data = atob(data);
        }

        flock.applyDeferred(function () {
            var buffer = flock.file.stringToBuffer(data);
            options.success(buffer, flock.file.parseMIMEType(mimeType));
        });
    };

    /**
     * Asynchronously reads the specified File into an ArrayBuffer.
     */
    flock.file.readBufferFromFile = function (options) {
        var reader  = new FileReader();
        reader.onload = function (e) {
            options.success(e.target.result, flock.file.parseFileExtension(options.src.name));
        };
        reader.readAsArrayBuffer(options.src);

        return reader;
    };


    fluid.registerNamespace("flock.audio");

    /**
     * Asychronously loads an ArrayBuffer into memory.
     *
     * Options:
     *  - src: the URL to load the array buffer from
     *  - method: the HTTP method to use (if applicable)
     *  - data: the data to be sent as part of the request (it's your job to query string-ize this if it's an HTTP request)
     *  - success: the success callback, which takes the ArrayBuffer response as its only argument
     *  - error: a callback that will be invoked if an error occurs, which takes the error message as its only argument
     */
    flock.audio.loadBuffer = function (options) {
        var src = options.src || options.url;
        if (!src) {
            return;
        }

        if (src instanceof ArrayBuffer) {
            flock.applyDeferred(options.success, [src, options.type]);
        }

        var reader = flock.audio.loadBuffer.readerForSource(src);

        reader(options);
    };

    flock.audio.loadBuffer.readerForSource = function (src) {
        return (typeof (File) !== "undefined" && src instanceof File) ? flock.file.readBufferFromFile :
            src.indexOf("data:") === 0 ? flock.file.readBufferFromDataUrl : flock.net.readBufferFromUrl;
    };


    /**
     * Loads and decodes an audio file. By default, this is done asynchronously in a Web Worker.
     * This decoder currently supports WAVE and AIFF file formats.
     */
    flock.audio.decode = function (options) {
        var success = options.success;

        var wrappedSuccess = function (rawData, type) {
            var strategies = flock.audio.decoderStrategies,
                strategy = strategies[type] || strategies["default"];

            if (options.decoder) {
                strategy = typeof (options.decoder) === "string" ?
                     fluid.getGlobalValue(options.decoder) : options.decoder;
            }

            strategy({
                rawData: rawData,
                type: type,
                success: success,
                error: options.error,
                sampleRate: options.sampleRate
            });
        };

        options.success = wrappedSuccess;
        flock.audio.loadBuffer(options);
    };

    /**
     * Asynchronously decodes the specified ArrayBuffer rawData using
     * the browser's Web Audio Context.
     */
    flock.audio.decode.webAudio = function (o) {
        // TODO: Raw reference to the Web Audio context singleton.
        var ctx = flock.webAudio.audioSystem.audioContextSingleton,
            success = function (audioBuffer) {
                var bufDesc = flock.bufferDesc.fromAudioBuffer(audioBuffer);
                o.success(bufDesc);
            };

        ctx.decodeAudioData(o.rawData, success, o.error);
    };

    flock.audio.decoderStrategies = {
        "default": flock.audio.decode.webAudio
    };

    flock.audio.registerDecoderStrategy = function (type, strategy) {
        if (!type) {
            return;
        }

        if (typeof type === "object") {
            for (var key in type) {
                flock.audio.decoderStrategies[key] = type[key];
            }

            return;
        }

        if (typeof strategy === "string") {
            strategy = fluid.getGlobalValue(strategy);
        }

        flock.audio.decoderStrategies[type] = strategy;
    };
}());
