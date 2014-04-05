// TODO: This is a copy of polydataview.js, now inlined here to avoid script loading
// issues related to web workers. Ultimately, Flocking should shed its dependency on
// PolyDataView now that DataView ships in all major browsers.

/*
 * PolyDataView, a better polyfill for DataView.
 * http://github.com/colinbdclark/PolyDataView
 *
 * Copyright 2012, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 *
 * Contributions:
 *   - getFloat32 and getFloat64, Copyright 2011 Christopher Chedeau
 *   - getFloat80, Copyright 2011 Joe Turner
 */

/*global global, self, require, window, ArrayBuffer, Uint8Array, Uint32Array, Float32Array,
  File, FileReader, PolyDataView*/
/*jshint white: false, newcap: true, regexp: true, browser: true,
    forin: false, nomen: true, bitwise: false, maxerr: 100,
    indent: 4, plusplus: false, curly: true, eqeqeq: true,
    freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
    unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
    funcscope: false*/

/*
 * To Do:
 *  - Finish unit tests for getFloat80() and the various array getters.
 */

(function () {
    "use strict";

    var g = typeof (window) !== "undefined" ? window : typeof (self) !== "undefined" ? self : global;

    var nativeDataView = typeof (g.DataView) !== "undefined" ? g.DataView : undefined;

    var isHostLittleEndian = (function () {
        var endianTest = new ArrayBuffer(4),
            u8View = new Uint8Array(endianTest),
            u32View = new Uint32Array(endianTest);

        u8View[0] = 0x01;
        u8View[1] = 0x02;
        u8View[2] = 0x03;
        u8View[3] = 0x04;

        return u32View[0] === 0x04030201;
    }());


    var addSharedMethods = function (that) {

        /**
         * Non-standard
         */
        that.getString = function (len, w, o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;

            var s = "",
                i,
                c;

            for (i = 0; i < len; i++) {
                c = that.getUint(w, o, isL);
                if (c > 0xFFFF) {
                    c -= 0x10000;
                    s += String.fromCharCode(0xD800 + (c >> 10), 0xDC00 + (c & 0x3FF));
                } else {
                    s += String.fromCharCode(c);
                }
                o = o + w;
            }

            return s;
        };

        /**
         * Non-standard
         */
        that.getFloat80 = function (o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;

            // This method is a modified version of Joe Turner's implementation of an "extended" float decoder,
            // originally licensed under the WTF license.
            // https://github.com/oampo/audiofile.js/blob/master/audiofile.js
            var expon = that.getUint(2, o, isL),
                hi = that.getUint(4, o + 2),
                lo = that.getUint(4, o + 6),
                rng = 1 << (16 - 1),
                sign = 1,
                value;

            if (expon >= rng) {
                expon |= ~(rng - 1);
            }

            if (expon < 0) {
                sign = -1;
                expon += rng;
            }

            if (expon === hi === lo === 0) {
                value = 0;
            } else if (expon === 0x7FFF) {
                value = Number.MAX_VALUE;
            } else {
                expon -= 16383;
                value = (hi * 0x100000000 + lo) * Math.pow(2, expon - 63);
            }

            that.offsetState = o + 10;

            return sign * value;
        };
    };

    var PolyDataView = function (buffer, byteOffset, byteLength) {
        var cachedArray = [];

        var that = {
            buffer: buffer,
            byteOffset: typeof (byteOffset) === "number" ? byteOffset : 0
        };
        that.byteLength = typeof (byteLength) === "number" ? byteLength : buffer.byteLength - that.byteOffset;

        // Bail if we're trying to read off the end of the buffer.
        if (that.byteOffset > buffer.byteLength || that.byteOffset + that.byteLength > buffer.byteLength) {
            throw new Error("INDEX_SIZE_ERR: DOM Exception 1");
        }

        /**
         * Non-standard
         */
        that.u8Buf = new Uint8Array(buffer, that.byteOffset, that.byteLength);

        /**
         * Non-standard
         */
        that.offsetState = that.byteOffset;

        /**
         * Non-standard
         */
        that.getUints = function (len, w, o, isL, array) {
            // TODO: Complete cut and paste job from getInts()!
            o = typeof (o) === "number" ? o : that.offsetState;
            if (o + (len * w) > that.u8Buf.length) {
                throw new Error("INDEX_SIZE_ERR: DOM Exception 1");
            }

            that.offsetState = o + (len * w);
            var arrayType = g["Uint" + (w * 8) + "Array"];

            if (len > 1 && isHostLittleEndian === isL) {
                return new arrayType(that.buffer, o, len); // jshint ignore:line
            }

            array = array || new arrayType(len); // jshint ignore:line
            var startByte,
                idxInc,
                i,
                idx,
                n,
                j,
                scale,
                v;

            if (isL) {
                startByte = 0;
                idxInc = 1;
            } else {
                startByte = w - 1;
                idxInc = -1;
            }

            for (i = 0; i < len; i++) {
                idx = o + (i * w) + startByte;
                n = 0;
                for (j = 0, scale = 1; j < w; j++, scale *= 256) {
                    v = that.u8Buf[idx];
                    n += v * scale;
                    idx += idxInc;
                }
                array[i] = n;
            }

            return array;
        };

        /**
         * Non-standard
         */
        that.getInts = function (len, w, o, isL, array) {
            o = typeof (o) === "number" ? o : that.offsetState;
            if (o + (len * w) > that.u8Buf.length) {
                throw new Error("INDEX_SIZE_ERR: DOM Exception 1");
            }

            that.offsetState = o + (len * w);
            var arrayType = g["Int" + (w * 8) + "Array"];

            // If the host's endianness matches the file's, just use a typed array view directly.
            if (len > 1 && isHostLittleEndian === isL) {
                return new arrayType(that.buffer, o, len); // jshint ignore:line
            }

            array = array || new arrayType(len); // jshint ignore:line
            var mask = Math.pow(256, w),
                halfMask = (mask / 2) - 1,
                startByte,
                idxInc,
                i,
                idx,
                n,
                j,
                scale,
                v;

            if (isL) {
                startByte = 0;
                idxInc = 1;
            } else {
                startByte = w - 1;
                idxInc = -1;
            }

            for (i = 0; i < len; i++) {
                idx = o + (i * w) + startByte;
                n = 0;
                for (j = 0, scale = 1; j < w; j++, scale *= 256) {
                    v = that.u8Buf[idx];
                    n += v * scale;
                    idx += idxInc;
                }
                array[i] = n > halfMask ? n - mask : n;
            }

            return array;
        };

        /**
         * Non-standard
         */
        that.getFloats = function (len, w, o, isL, array) {
            var bits = w * 8,
                getterName = "getFloat" + bits,
                arrayType = g["Float" + bits + "Array"],
                i;

            // If the host's endianness matches the file's, just use a typed array view directly.
            if (len > 1 && isHostLittleEndian === isL) {
                o = typeof (o) === "number" ? o : that.offsetState;
                if (o + (len * w) > that.u8Buf.length) {
                    throw new Error("INDEX_SIZE_ERR: DOM Exception 1");
                }
                that.offsetState = o + (len * w);
                return new arrayType(that.buffer, o, len); // jshint ignore:line
            }

            array = array || new arrayType(len); // jshint ignore:line

            for (i = 0; i < len; i++) {
                array[i] = that[getterName](o, isL);
            }

            return array;
        };

        /**
         * Non-standard
         */
        that.getUint = function (w, o, isL) {
            return w === 1 ? that.getUint8(o, isL) : that.getUints(1, w, o, isL, cachedArray)[0];
        };

        /**
         * Non-standard
         */
        that.getInt = function (w, o, isL) {
            return that.getInts(1, w, o, isL, cachedArray)[0];
        };

        that.getUint8 = function (o) {
            o = typeof (o) === "number" ? o : that.offsetState;

            var n = that.u8Buf[o];
            that.offsetState = o + 1;

            return n;
        };

        that.getInt8 = function (o, isL) {
            return that.getInts(1, 1, o, isL, cachedArray)[0];
        };

        that.getUint16 = function (o, isL) {
            return that.getUints(1, 2, o, isL, cachedArray)[0];
        };

        that.getInt16 = function (o, isL) {
            return that.getInts(1, 2, o, isL, cachedArray)[0];
        };

        that.getUint32 = function (o, isL) {
            return that.getUints(1, 4, o, isL, cachedArray)[0];
        };

        that.getInt32 = function (o, isL) {
            return that.getInts(1, 4, o, isL, cachedArray)[0];
        };

        that.getFloat32 = function (o, isL) {
            // This method is a modified version of Christopher Chedeau's Float32 decoding
            // implementation from jDataView, originally distributed under the WTF license.
            // https://github.com/vjeux/jDataView
            var bytes = that.getUints(4, 1, o, isL),
                b0,
                b1,
                b2,
                b3,
                sign,
                exp,
                mant;

            if (isL) {
                b0 = bytes[3];
                b1 = bytes[2];
                b2 = bytes[1];
                b3 = bytes[0];
            } else {
                b0 = bytes[0];
                b1 = bytes[1];
                b2 = bytes[2];
                b3 = bytes[3];
            }

            sign = 1 - (2 * (b0 >> 7));
            exp = (((b0 << 1) & 255) | (b1 >> 7)) - 127;
            mant = ((b1 & 127) * 65536) | (b2 * 256) | b3;

            if (exp === 128) {
                return mant !== 0 ? NaN : sign * Infinity;
            }

            if (exp === -127) {
                return sign * mant * 1.401298464324817e-45;
            }

            return sign * (1 + mant * 1.1920928955078125e-7) * Math.pow(2, exp);
        };

        that.getFloat64 = function (o, isL) {
            // This method is a modified version of Christopher Chedeau's Float64 decoding
            // implementation from jDataView, originally distributed under the WTF license.
            // https://github.com/vjeux/jDataView
            var bytes = that.getUints(8, 1, o, isL),
                b0,
                b1,
                b2,
                b3,
                b4,
                b5,
                b6,
                b7,
                sign,
                exp,
                mant;

            if (isL) {
                b0 = bytes[7];
                b1 = bytes[6];
                b2 = bytes[5];
                b3 = bytes[4];
                b4 = bytes[3];
                b5 = bytes[2];
                b6 = bytes[1];
                b7 = bytes[0];
            } else {
                b0 = bytes[0];
                b1 = bytes[1];
                b2 = bytes[2];
                b3 = bytes[3];
                b4 = bytes[4];
                b5 = bytes[5];
                b6 = bytes[6];
                b7 = bytes[7];
            }

            sign = 1 - (2 * (b0 >> 7));
            exp = ((((b0 << 1) & 255) << 3) | (b1 >> 4)) - 1023;
            mant = ((b1 & 15) * 281474976710656) + (b2 * 1099511627776) + (b3 * 4294967296) +
                (b4 * 16777216) + (b5 * 65536) + (b6 * 256) + b7;

            if (exp === 1024) {
                return mant !== 0 ? NaN : sign * Infinity;
            }

            if (exp === -1023) {
                return sign * mant * 5e-324;
            }

            return sign * (1 + mant * 2.220446049250313e-16) * Math.pow(2, exp);
        };

        addSharedMethods(that);
        return that;
    };

    var wrappedDataView = function (buffer, byteOffset, byteLength) {
        var that = {
            buffer: buffer,
            byteOffset: typeof (byteOffset) === "number" ? byteOffset : 0
        };
        that.byteLength = typeof (byteLength) === "number" ? byteLength : buffer.byteLength - that.byteOffset;

        /**
         * Non-standard
         */
        that.dv = new nativeDataView(buffer, that.byteOffset, that.byteLength); // jshint ignore:line

        /**
         * Non-standard
         */
        that.offsetState = that.byteOffset;

        /**
         * Non-standard
         */
        that.getUint = function (w, o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;

            var n = that.dv["getUint" + (w * 8)](o, isL);
            that.offsetState = o + w;

            return n;
        };

        /**
         * Non-standard
         */
        that.getInt = function (w, o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;

            var n = that.dv["getInt" + (w * 8)](o, isL);
            that.offsetState = o + w;

            return n;
        };

        /**
         * Non-standard
         */
        var getBytes = function (type, len, w, o, isL, array) {
            var bits = w * 8,
                typeSize = type + bits,
                dv = that.dv,
                getterName = "get" + typeSize,
                i;

            array = array || new g[typeSize + "Array"](len);
            o = typeof (o) === "number" ? o : that.offsetState;

            for (i = 0; i < len; i++) {
                array[i] = dv[getterName](o, isL);
                o += w;
            }

            that.offsetState = o;

            return array;
        };

        /**
         * Non-standard
         */
        that.getUints = function (len, w, o, isL, array) {
            return getBytes("Uint", len, w, o, isL, array);
        };

        /**
         * Non-standard
         */
        that.getInts = function (len, w, o, isL, array) {
            return getBytes("Int", len, w, o, isL, array);
        };

        /**
         * Non-standard
         */
        that.getFloats = function (len, w, o, isL, array) {
            return getBytes("Float", len, w, o, isL, array);
        };

        that.getUint8 = function (o) {
            o = typeof (o) === "number" ? o : that.offsetState;

            var n = that.dv.getUint8(o);
            that.offsetState = o + 1;

            return n;
        };

        that.getInt8 = function (o) {
            o = typeof (o) === "number" ? o : that.offsetState;

            var n = that.dv.getInt8(o);
            that.offsetState = o + 1;

            return n;
        };

        that.getUint16 = function (o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;

            var n = that.dv.getUint16(o, isL);
            that.offsetState = o + 2;

            return n;
        };

        that.getInt16 = function (o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;

            var n = that.dv.getInt16(o, isL);
            that.offsetState = o + 2;

            return n;
        };

        that.getUint32 = function (o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;

            var n = that.dv.getUint32(o, isL);
            that.offsetState = o + 4;

            return n;
        };

        that.getInt32 = function (o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;

            var n = that.dv.getInt32(o, isL);
            that.offsetState = o + 4;

            return n;
        };

        that.getFloat32 = function (o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;

            var n = that.dv.getFloat32(o, isL);
            that.offsetState = o + 4;

            return n;
        };

        that.getFloat64 = function (o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;

            var n = that.dv.getFloat64(o, isL);
            that.offsetState = o + 8;

            return n;
        };

        addSharedMethods(that);
        return that;
    };

    g.PolyDataView = nativeDataView ? wrappedDataView : PolyDataView;

}());


/*
 * Flocking Audio File Decoder Library
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2014, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

// Stub out fluid.registerNamespace in cases where we're in a Web Worker and Infusion is unavailable.
var fluid = typeof (fluid) !== "undefined" ? fluid : typeof (require) !== "undefined" ? require("infusion") : {
    registerNamespace: function (path) {
        "use strict";

        if (!path) {
            return;
        }
        var root = self,
            tokens = path.split("."),
            i,
            token;

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            if (!root[token]) {
                root[token] = {};
            }
            root = root[token];
        }

        return root;
    }
};

var flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");

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
                if (xhr.status === 200) {
                    options.success(xhr.response, flock.file.parseFileExtension(src));
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
            throw new Error("The file '" + fileName + "' does not have a valid extension.");
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
            var decoders = flock.audio.decode,
                decoder;

            if (!options) {
                decoder = decoders.async;
            } else if (options.decoder) {
                decoder = typeof (options.decoder) === "string" ?
                    fluid.getGlobalValue(options.decoder) : options.decoder;
            } else if (options.async === false) {
                decoder = decoders.sync;
            } else {
                decoder = decoders.async;
            }

            decoder({
                rawData: rawData,
                type: type,
                success: success,
                error: options.error
            });
        };

        options.success = wrappedSuccess;
        flock.audio.loadBuffer(options);
    };

    /**
     * Synchronously decodes an audio file.
     */
    flock.audio.decode.sync = function (options) {
        try {
            var buffer = flock.audio.decodeArrayBuffer(options.rawData, options.type);
            options.success(buffer, options.type);
        } catch (e) {
            if (options.error) {
                options.error(e.msg);
            } else {
                throw e;
            }
        }
    };

    /**
     * Asynchronously decodes the specified rawData in a Web Worker.
     */
    flock.audio.decode.async = function (options) {
        var workerUrl = flock.audio.decode.async.findWorkerUrl(options),
            w = new Worker(workerUrl);

        w.addEventListener("message", function (e) {
            var data = e.data,
                msg = e.data.msg;

            if (msg === "afterDecoded") {
                options.success(data.buffer, data.type);
            } else if (msg === "onError") {
                options.error(data.errorMsg);
            }
        }, true);

        w.postMessage({
            msg: "decode",
            rawData: options.rawData,
            type: options.type
        });
    };

    flock.audio.decode.async.findWorkerUrl = function (options) {
        if (options && options.workerUrl) {
            return options.workerUrl;
        }

        var workerFileName = "flocking-audiofile-worker.js",
            flockingFileNames = flock.audio.decode.async.findWorkerUrl.flockingFileNames,
            i,
            fileName,
            scripts,
            src,
            idx,
            baseUrl;

        for (i = 0; i < flockingFileNames.length; i++) {
            fileName = flockingFileNames[i];
            scripts = $("script[src$='" + fileName + "']");
            if (scripts.length > 0) {
                break;
            }
        }

        if (scripts.length < 1) {
            throw new Error("Flocking error: could not load the Audio Decoder into a worker because " +
                "flocking-all.js or flocking-core.js could not be found.");
        }

        src = scripts.eq(0).attr("src");
        idx = src.indexOf(fileName);
        baseUrl = src.substring(0, idx);

        return baseUrl + workerFileName;
    };

    flock.audio.decode.async.findWorkerUrl.flockingFileNames = [
        "flocking-all.js",
        "flocking-all.min.js",
        "flocking-audiofile.js",
        "flocking-core.js"
    ];

    flock.audio.decodeArrayBuffer = function (data, type) {
        var formatSpec = flock.audio.formats[type];
        if (!formatSpec) {
            throw new Error("There is no decoder available for " + type + " files.");
        }

        return formatSpec.reader(data, formatSpec);
    };

    flock.audio.decode.deinterleaveSampleData = function (dataType, bits, numChans, interleaved) {
        var numFrames = interleaved.length / numChans,
            chans = [],
            i,
            samp = 0,
            max,
            frame,
            chan;

        // Initialize each channel.
        for (i = 0; i < numChans; i++) {
            chans[i] = new Float32Array(numFrames);
        }

        if (dataType === "Int") {
            max = Math.pow(2, bits - 1);
            for (frame = 0; frame < numFrames; frame++) {
                for (chan = 0; chan < numChans; chan++) {
                    chans[chan][frame] = interleaved[samp] / max;
                    samp++;
                }
            }
        } else {
            for (frame = 0; frame < numFrames; frame++) {
                for (chan = 0; chan < numChans; chan++) {
                    chans[chan][frame] = interleaved[samp];
                    samp++;
                }
            }

        }

        return chans;
    };

    flock.audio.decode.data = function (dv, format, dataType, isLittle) {
        var numChans = format.numChannels,
            numFrames = format.numSampleFrames,
            l = numFrames * numChans,
            bits = format.bitRate,
            interleaved = dv["get" + dataType + "s"](l, bits / 8, undefined, isLittle);

        return flock.audio.decode.deinterleaveSampleData(dataType, bits, numChans, interleaved);
    };

    flock.audio.decode.dataChunk = function (dv, format, dataType, data, isLittle) {
        var l = data.size;

        // Now that we've got the actual data size, correctly set the number of sample frames if it wasn't already present.
        format.numSampleFrames = format.numSampleFrames || (l / (format.bitRate / 8)) / format.numChannels;
        format.duration = format.numSampleFrames / format.sampleRate;

        // Read the channel data.
        data.channels = flock.audio.decode.data(dv, format, dataType, isLittle);

        return data;
    };

    flock.audio.decode.chunk = function (dv, id, type, headerLayout, layout, chunkIDs, metadata, isLittle, chunks) {
        var chunkMetadata = metadata[id],
            offsets = chunkMetadata.offsets,
            header = chunkMetadata.header,
            chunk,
            prop,
            subchunksLength;

        chunk = flock.audio.decode.chunkFields(dv, layout, isLittle, offsets.fields);

        for (prop in header) {
            chunk[prop] = header[prop];
        }

        if (offsets.fields + header.size > dv.offsetState) {
            offsets.data = dv.offsetState;
        }

        // Read subchunks if there are any.
        if (layout.chunkLayouts) {
            subchunksLength = dv.byteLength - offsets.data;
            flock.audio.decode.scanChunks(dv, subchunksLength, headerLayout, isLittle, metadata);
            flock.audio.decode.chunks(dv, headerLayout, layout.chunkLayouts, chunkIDs, metadata, isLittle, chunks);
        }

        return chunk;
    };

    flock.audio.decode.scanChunks = function (dv, l, headerLayout, isLittle, allMetadata) {
        allMetadata = allMetadata || {};

        var metadata;

        while (dv.offsetState < l) {
            metadata = flock.audio.decode.chunkHeader(dv, headerLayout, isLittle);
            allMetadata[metadata.header.id] = metadata;
            dv.offsetState += metadata.header.size;
        }

        return allMetadata;
    };

    flock.audio.decode.chunks = function (dv, headerLayout, layouts, chunkIDs, metadata, isLittle, chunks) {
        chunks = chunks || {};

        var order = layouts.order,
            i,
            id,
            type,
            layout;

        for (i = 0; i < order.length; i++) {
            id = order[i];
            type = chunkIDs[id];
            layout = layouts[id];
            chunks[type] = flock.audio.decode.chunk(dv, id, type, headerLayout, layout, chunkIDs, metadata, isLittle, chunks);
        }

        return chunks;
    };

    flock.audio.decode.chunkFields = function (dv, layout, isLittle, offset) {
        var decoded = {};

        var order = layout.order,
            fields = layout.fields,
            i,
            name,
            spec;

        dv.offsetState = typeof (offset) === "number" ? offset : dv.offsetState;

        for (i = 0; i < order.length; i++) {
            name = order[i];
            spec = fields[name];

            decoded[name] = typeof spec === "string" ? dv[spec](undefined, isLittle) :
                dv[spec.getter](spec.length, spec.width, undefined, isLittle);
        }

        return decoded;
    };

    flock.audio.decode.chunkHeader = function (dv, headerLayout, isLittle) {
        var metadata = {
            offsets: {}
        };

        metadata.offsets.start = dv.offsetState;
        metadata.header = flock.audio.decode.chunkFields(dv, headerLayout, isLittle);
        metadata.offsets.fields = dv.offsetState;

        return metadata;
    };

    flock.audio.decode.wavSampleDataType = function (chunks) {
        var t = chunks.format.audioFormatType;
        if (t !== 1 && t !== 3) {
            throw new Error("Flocking decoder error: this file contains an unrecognized WAV format type.");
        }

        return t === 1 ? "Int" : "Float";
    };

    flock.audio.decode.aiffSampleDataType = function (chunks) {
        var t = chunks.container.formatType;
        if (t !== "AIFF" && t !== "AIFC") {
            throw new Error("Flocking decoder error: this file contains an unrecognized AIFF format type.");
        }

        return t === "AIFF" ? "Int" : "Float";
    };

    flock.audio.decode.chunked = function (data, formatSpec) {
        var dv = new PolyDataView(data, 0, data.byteLength),
            isLittle = formatSpec.littleEndian,
            headerLayout = formatSpec.headerLayout,
            metadata,
            chunks,
            dataType;

        metadata = flock.audio.decode.scanChunks(dv, dv.byteLength, headerLayout, isLittle);
        chunks = flock.audio.decode.chunks(dv, headerLayout, formatSpec.chunkLayouts, formatSpec.chunkIDs, metadata, isLittle);

        // Calculate the data type for the sample data.
        dataType = formatSpec.findSampleDataType(chunks, metadata, dv);

        // Once all the chunks have been read, decode the channel data.
        flock.audio.decode.dataChunk(dv, chunks.format, dataType, chunks.data, isLittle);

        return chunks;
    };


    /************************************
     * Audio Format Decoding Strategies *
     ************************************/

    flock.audio.formats = {};

    flock.audio.formats.wav = {
        reader: flock.audio.decode.chunked,
        littleEndian: true,

        chunkIDs: {
            "RIFF": "container",
            "fmt ": "format",
            "data": "data"
        },

        headerLayout: {
            fields: {
                id: {
                    getter: "getString",
                    length: 4,
                    width: 1
                },
                size: "getUint32"
            },
            order: ["id", "size"]
        },

        chunkLayouts: {
            "RIFF": {
                fields: {
                    formatType: {
                        getter: "getString",
                        length: 4,
                        width: 1
                    }
                },

                order: ["formatType"],

                chunkLayouts: {
                    "fmt ": {
                        fields: {
                            audioFormatType: "getUint16",
                            numChannels: "getUint16",
                            sampleRate: "getUint32",
                            avgBytesPerSecond: "getUint32",
                            blockAlign: "getUint16",
                            bitRate: "getUint16"
                        },
                        order: ["audioFormatType", "numChannels", "sampleRate", "avgBytesPerSecond", "blockAlign", "bitRate"]
                    },
                    "data": {
                        fields: {},
                        order: []
                    },

                    order: ["fmt ", "data"]
                }
            },

            order: ["RIFF"]
        },

        findSampleDataType: flock.audio.decode.wavSampleDataType
    };


    flock.audio.formats.aiff = {
        reader: flock.audio.decode.chunked,
        littleEndian: false,

        chunkIDs: {
            "FORM": "container",
            "COMM": "format",
            "SSND": "data"
        },

        headerLayout: {
            fields: {
                id: {
                    getter: "getString",
                    length: 4,
                    width: 1
                },
                size: "getUint32"
            },
            order: ["id", "size"]
        },

        chunkLayouts: {
            "FORM": {
                fields: {
                    formatType: {
                        getter: "getString",
                        length: 4,
                        width: 1
                    }
                },

                order: ["formatType"],

                chunkLayouts: {
                    "COMM": {
                        fields: {
                            numChannels: "getInt16",
                            numSampleFrames: "getUint32",
                            bitRate: "getUint16",
                            sampleRate: "getFloat80"

                        },
                        order: ["numChannels", "numSampleFrames", "bitRate", "sampleRate"]
                    },

                    "SSND": {
                        fields: {
                            offset: "getUint32",
                            blockSize: "getUint32"
                        },
                        order: ["offset", "blockSize"]
                    },

                    order: ["COMM", "SSND"]
                }
            },

            order: ["FORM"]
        },

        findSampleDataType: flock.audio.decode.aiffSampleDataType
    };

}());
