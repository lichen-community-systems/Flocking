/*!
* Flocking Audio File Library
* http://github.com/colinbdclark/flocking
*
* Copyright 2012, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global window, Float32Array*/
/*jslint white: true, funcinvoke: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, continue: true, forvar: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock = flock || {};

(function () {
    "use strict";
    
    
    /*********************
     * Network utilities *
     *********************/
    flock.net = {};
    
    flock.net.load = function (options) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    options.success(xhr.response);
                } else {
                    options.error(xhr.statusText);
                }
            }
        };
        // Default to array buffer response, since this code is most likely to be used for audio files.
        xhr.responseType = options.responseType || "arraybuffer"; 
        xhr.open(options.method, options.url, true); 
        xhr.send(options.data);
    };
    
    
    /*****************
     * File Utilties *
     *****************/
     
    flock.file = {};
    
    flock.file.mimeTypes = {
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/wave": "wav",
        "audio/x-aiff": "aiff",
        "audio/aiff": "aiff",
        "sound/aiff": "aiff"
    };
    
    flock.file.parseFileExtension = function (fileName) {
        return fileName.substring(fileName.lastIndexOf(".") + 1);
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
        var l = s.length,
            b = new ArrayBuffer(l),
            v = new Uint8Array(b),
            i;
        for (i = 0; i < l; i++) {
            v[i] = s.charCodeAt(i);
        }
        return v.buffer;
    };
    
    /**
     * Loads the contents of a URL via an AJAX GET request into an ArrayBuffer.
     *
     * @param {String} url the URL to load
     * @param {Function} onSucess a callback to invoke when the file is successfully loaded
     */
    flock.file.readUrl = function (url, onSuccess) {
        flock.net.load({
            url: url, 
            success: function (data) {
                onSuccess(data, flock.file.parseFileExtension(url));
            }
        });
    };
    
    /**
     * Parses the specified data URL into an ArrayBuffer.
     *
     * @param {String} url the DataURL to parse, in the format "data:[mimeType][;base64],<data>"
     * @param {Function} onSuccess a callback to invoke when the dataURL has been successfully parsed
     */
    flock.file.readDataUrl = function (url, onSuccess) {
        var delim = url.indexOf(","),
            header = url.substring(0, delim),
            data = url.substring(delim + 1),
            base64Idx = header.indexOf(";base64"),
            isBase64 =  base64Idx > -1,
            mimeTypeStartIdx = url.indexOf("data:") + 5,
            mimeTypeEndIdx = isBase64 ? base64Idx : delim,
            mimeType = url.substring(mimeTypeStartIdx, mimeTypeEndIdx);
            
        if (isBase64) {
            data = window.atob(data);
        }
                
        onSuccess(flock.file.stringToBuffer(data), flock.file.parseMIMEType(mimeType));
    };
    
    /**
     * Reads the specified File into an ArrayBuffer.
     *
     * @param {File} file the file to read
     * @param {Function} onSuccess a callback to invoke when the File has been successfully read
     */
    flock.file.readFile = function (file, onSuccess) {
        if (!file) {
            return null;
        }
        
        var reader  = new FileReader();
        reader.onload = function (e) {
            onSuccess(e.target.result, flock.file.parseFileExtension(file.name));
        };
        reader.readAsArrayBuffer(file);
        
        return reader;
    };
    
    
    flock.audio = {};
    
    /**
     * Decodes audio sample data in the specified format. This decoder currently supports WAVE and AIFF file formats.
     *
     * @param {Object} src either a File, URL, data URL, or the raw audio file data as a binary string
     * @param {Function} onSuccess a callback to invoke when decoding is finished
     * @param {String} format (optional) the format of the audio data; include this ONLY if src is a binary string
     *
     * @return {Array} an array of Float32Arrays, each representing a single channel's worth of sample data
     */
    flock.audio.decode = function (src, onSuccess, format) {
        var isString = typeof (src) === "string",
            reader;
        
        if (format && isString) {
            onSuccess(flock.audio.decodeArrayBuffer(flock.file.stringToBuffer(src), format));            
        } else {
            reader = isString ? (src.indexOf("data:") === 0 ? flock.file.readDataUrl : flock.file.readUrl) : flock.file.readFile;
            reader(src, function (data, type) {
                onSuccess(flock.audio.decodeArrayBuffer(data, type));
            });
        }
    };
    
    flock.audio.decodeArrayBuffer = function (data, type) {
        var formatSpec = flock.audio.formats[type];
        if (!formatSpec) {
            throw new Error("There is no decoder available for " + format + " files.");
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
            spec,
            len,
            w;
        
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
        return t === 1 ? "Int" : (t === 3 ? "Float" : null);
    };
    
    flock.audio.decode.aiffSampleDataType = function (chunks) {
        var t = chunks.container.formatType;
        return t === "AIFF" ? "Int" : (t === "AIFC" ? "Float" : null);
    }; 
    
    flock.audio.decode.chunked = function (data, formatSpec) {
        var dv = new polyDataView(data, 0, data.byteLength),
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
