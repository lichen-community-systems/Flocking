/*
 * Flocking Audio File Decoder Library
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2014, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global self, require, Float32Array, Uint8Array, ArrayBuffer, File, FileReader, PolyDataView*/
/*jshint white: false, newcap: true, regexp: true, browser: true,
    forin: false, nomen: true, bitwise: false, maxerr: 100,
    indent: 4, plusplus: false, curly: true, eqeqeq: true,
    freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
    unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
    funcscope: false*/


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
        var ext = fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase(),
            alias = flock.file.typeAliases[ext];
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
            flockingFileNames = ["flocking-all.js", "flocking-audiofile.js", "flocking-core.js"],
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
