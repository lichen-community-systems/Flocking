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

/*global global, self, require, window, Float32Array, PolyDataView*/
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

    var g = typeof (window) !== "undefined" ? window : typeof (self) !== "undefined" ? self : global,
        nativeDataView = typeof (g.DataView) !== "undefined" ? g.DataView : undefined;

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

    if (!nativeDataView && typeof window.PolyDataView === "undefined") {
        throw new Error("Your browser doesn't support DataView natively. " +
            "Please include the PolyDataView polyfill. https://github.com/colinbdclark/PolyDataView");
    }

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


(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery"),
        flock = fluid.registerNamespace("flock");

    flock.audio.decode.convertSampleRate = function (buf, originalSampleRate, sampleRate) {
        var dur = buf.length / originalSampleRate,
            resampledLen = Math.round(dur * sampleRate),
            resampled = new Float32Array(resampledLen),
            stepSize = originalSampleRate / sampleRate,
            step = 0;

        for (var i = 0; i < resampledLen; i++) {
            resampled[i] = flock.interpolate.hermite(step, buf);
            step += stepSize;
        }

        return resampled;
    };

    flock.audio.decode.resample = function (bufDesc, sampleRate) {
        var fmt = bufDesc.format;

        if (!sampleRate || fmt.sampleRate === sampleRate) {
            return bufDesc;
        }

        var originalSampleRate = fmt.sampleRate,
            channels = bufDesc.data.channels;

        for (var chan = 0; chan < channels.length; chan++) {
            channels[chan] = flock.audio.decode.convertSampleRate(channels[chan],
                originalSampleRate, sampleRate);
        }

        fmt.sampleRate = sampleRate;
        fmt.avgBytesPerSecond = fmt.sampleRate * fmt.numChannels * fmt.blockAlign;
        fmt.numSampleFrames = channels[0].length;
         // Resampling may involve a one sample or so shift in duration.
        fmt.duration = fmt.numSampleFrames / fmt.sampleRate;

        return bufDesc;
    };

    /**
     * Synchronously decodes an audio file.
     */
    flock.audio.decode.sync = function (options) {
        try {
            var buffer = flock.audio.decodeArrayBuffer(options.rawData, options.type);
            flock.audio.decode.resample(buffer, options.sampleRate);
            options.success(buffer, options.type);
        } catch (e) {
            if (options.error) {
                options.error(e);
            } else {
                throw e;
            }
        }
    };

    flock.audio.decode.workerAsync = function (options) {
        var workerUrl = flock.audio.decode.workerAsync.findUrl(options),
            w = new Worker(workerUrl);

        w.addEventListener("message", function (e) {
            var data = e.data,
            msg = e.data.msg;

            if (msg === "afterDecoded") {
                flock.audio.decode.resample(data.buffer, options.sampleRate);
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

    flock.audio.decode.workerAsync.findUrl = function (options) {
        if (options && options.workerUrl) {
            return options.workerUrl;
        }

        var workerFileName = "flocking-audiofile-worker.js",
            flockingFileNames = flock.audio.decode.workerAsync.findUrl.flockingFileNames,
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
            "flocking-all.js or core.js could not be found.");
        }

        src = scripts.eq(0).attr("src");
        idx = src.indexOf(fileName);
        baseUrl = src.substring(0, idx);

        return baseUrl + workerFileName;
    };

    flock.audio.decode.workerAsync.findUrl.flockingFileNames = [
        "flocking-audiofile-compatibilty.js",
        "flocking-all.js",
        "flocking-all.min.js",
        "flocking-no-jquery.js",
        "flocking-no-jquery.min.js",
        "audiofile.js",
        "core.js"
    ];

    flock.audio.decodeArrayBuffer = function (data, type) {
        var formatSpec = flock.audio.formats[type];
        if (!formatSpec) {
            var msg = "There is no decoder available for " + type + " files.";
            if (!type) {
                msg += " Did you forget to specify a decoder 'type' option?";
            }
            throw new Error(msg);
        }

        return formatSpec.reader(data, formatSpec);
    };

    flock.audio.decode.deinterleaveSampleData = function (dataType, bits, numChans, interleaved) {
        var numFrames = interleaved.length / numChans,
            format = dataType.toLowerCase() + bits,
            convertSpec = flock.audio.convert.specForPCMType(format),
            chans = [],
            i,
            sampIdx = 0,
            frame,
            chan,
            s;

        // Initialize each channel.
        for (i = 0; i < numChans; i++) {
            chans[i] = new Float32Array(numFrames);
        }

        if (dataType === "Int") {
            for (frame = 0; frame < numFrames; frame++) {
                for (chan = 0; chan < numChans; chan++) {
                    s = flock.audio.convert.intToFloat(interleaved[sampIdx], convertSpec);
                    chans[chan][frame] = s;
                    sampIdx++;
                }
            }
        } else {
            for (frame = 0; frame < numFrames; frame++) {
                for (chan = 0; chan < numChans; chan++) {
                    chans[chan][frame] = interleaved[sampIdx];
                    sampIdx++;
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
        format.numSampleFrames = format.numSampleFrames ||
            (l / (format.bitRate / 8)) / format.numChannels;
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


    if (flock.audio.registerDecoderStrategy) {
        // Register this implementation for AIFF files and, if not on Web Audio,
        // as the default decoder strategy.
        if (!flock.browser.safari) {
            flock.audio.registerDecoderStrategy("aiff", flock.audio.decode.workerAsync);
        }

        if (flock.platform && !flock.platform.isWebAudio) {
            flock.audio.registerDecoderStrategy("default", flock.audio.decode.workerAsync);
        }
    }

}());
