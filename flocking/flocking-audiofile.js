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
    
    flock.audio.decode.data = function (dv, decoded, length, isLittle) {
        var numChans = decoded.format.numChannels,
            numFrames = decoded.format.numSampleFrames,
            l = numFrames * numChans,
            bits = decoded.format.bitRate,
            max = (1 << (bits - 1)) - 1,
            chans = [],
            samp = 0,
            interleaved,
            i, frame, chan;
        
        // Initialize each channel.            
        for (i = 0; i < numChans; i++) {
            chans[i] = new Float32Array(numFrames);
        }
                
        // Whip through each sample frame and read out sample data for each channel.
        interleaved = dv.getInts(l, bits / 8, undefined, isLittle);

        for (frame = 0; frame < numFrames; frame++) {
            for (chan = 0; chan < numChans; chan++) {
                chans[chan][frame] = interleaved[samp] / max;
                samp++;
            }
        }

        return chans;
    };
    
    flock.audio.decode.dataChunk = function (dv, chunk, isLittle) {
        var f = chunk.format, // TODO: This needs to be satisfied by another chunk!
            d = chunk;
        
        // Now that we've got the actual data size, correctly set the number of sample frames if it wasn't already present.
        f.numSampleFrames = f.numSampleFrames || (d.size / (f.bitRate / 8)) / f.numChannels;

        // Read the channel data.
        // TODO: Support float types, which will involve some format-specific processing.
        d.channels = flock.audio.decode.data(dv, chunk, d.size, isLittle);
        
        return chunk;
    };
    
    flock.audio.decode.chunk = function (dv, formatSpec, metadata) {
        // TODO: Tons of duplication with the site where this is called in chunks()
        var id = metadata.header.id,
            layout = formatSpec.chunkLayouts[id],
            isLittle = formatSpec.littleEndian,
            type = formatSpec.chunkIDs[metadata.header.id],
            chunk,
            prop;
            
        chunk = flock.audio.decode.chunkLayout(dv, layout, isLittle,metadata.offsets.data);
        
        for (prop in metadata.header) {
            chunk[prop] = metadata.header[prop];
        }
        
        if (type === "data") {
            flock.audio.decode.dataChunk(dv, chunk, isLittle);
        }
        
        return chunk;
    };
    
    flock.audio.decode.scanChunks = function (dv, l, labelLayout, isLittle) {
        var allMetadata = {},
            metadata;
                        
        while (dv.offset < l) {
            metadata = flock.audio.decode.chunkHeader(dv, labelLayout, isLittle);
            allMetadata[metadata.header.id] = metadata;
            dv.offset += metadata.header.size; // TODO: Hardcoded size property, but it seems a sensible contract.
        }
        
        return allMetadata;
    };
    
    flock.audio.decode.chunks = function (dv, formatSpec, chunksMetadata) {
        var chunks = {},
            order = formatSpec.chunkReadOrder,
            i,
            id,
            type,
            metadata;
            
        for (i = 0; i < order.length; i++) {
            id = order[i];
            type = formatSpec.chunkIDs[id];
            metadata = chunksMetadata[id];
            chunks[type] = flock.audio.decode.chunk(dv, formatSpec, metadata);
        }
        
        return chunks;
    };
    
    flock.audio.decode.chunkLayout = function (dv, layout, isLittle, offset) {
        var decoded = {};
        
        var i,
            name,
            spec,
            getter;
        
        dv.offset = typeof (offset) === "number" ? offset : dv.offset;
        
        for (i = 0; i < layout.order.length; i++) {
            name = layout.order[i];
            spec = layout.fields[name];
            if (typeof (spec) === "string") {
                getter = dv["get" + spec];
                decoded[name] = getter(undefined, isLittle);
            } else {
                getter = dv["get" + spec.type];
                decoded[name] = getter(spec.length, undefined, isLittle);
            }
        }
        
        return decoded;
    };
    
    flock.audio.decode.chunkHeader = function (dv, labelLayout, isLittle) {
        var metadata = {
            offsets: {}
        };
        
        metadata.offsets.start = dv.offset;
        metadata.header = flock.audio.decode.chunkLayout(dv, labelLayout, isLittle);
        metadata.offsets.data = dv.offset;
        
        return metadata;
    };
    
    flock.audio.decode.chunked = function (data, formatSpec) {
        var dv = new polyDataView(data, 0, data.byteLength),
            order = formatSpec.chunkReadOrder,
            isLittle = formatSpec.littleEndian,
            labelLayout = formatSpec.labelLayout,
            containerMetadata,
            container,
            chunksMetadata,
            chunks;
        
        // Read the container chunk to get preliminary information
        containerMetadata = flock.audio.decode.chunkHeader(dv, labelLayout, isLittle);
        container = flock.audio.decode.chunk(dv, formatSpec, containerMetadata);
        
        // Scan each subchunk header in sequence to find out where they all are.
        chunksMetadata = flock.audio.decode.scanChunks(dv, containerMetadata.header.size, labelLayout, isLittle);
        
        // Add the container's metadata to our collection of information about all chunks in the file.
        chunksMetadata[containerMetadata.header.id] = containerMetadata;
        
        chunks = flock.audio.decode.chunks(dv, formatSpec, chunksMetadata);
        chunks.container = container;
        
        return chunks;
    };

    
    /************************************
     * Audio Format Decoding Strategies *
     ************************************/
     
    flock.audio.formats = {};
    
    flock.audio.formats.wav = {
        reader: flock.audio.decode.chunked,
        littleEndian: true,
        
        containerID: "RIFF",
         
        chunkIDs: {
            "RIFF": "container",
            "fmt ": "format",
            "data": "data"
        },
        
        labelLayout: {
            fields: {
                id: {
                    type: "String",
                    length: 4
                },
                size: "Uint32"
            },
            order: ["id", "size"]
        },
        
        chunkLayouts: {
            "RIFF": {
                fields: {
                    formatType: {
                        type: "String",
                        length: 4
                    }
                },
                order: ["formatType"]
            },
            "fmt ": {
                fields: {
                    audioFormatType: "Uint16",
                    numChannels: "Uint16",
                    sampleRate: "Uint32",
                    avgBytesPerSecond: "Uint32",
                    blockAlign: "Uint16",
                    bitRate: "Uint16"
                },
                order: ["audioFormatType", "numChannels", "sampleRate", "avgBytesPerSecond", "blockAlign", "bitRate"]
            },
            "data": {
                fields: {},
                order: []
            }
        },
        
        chunkReadOrder: ["fmt ", "data"]
    };
    

    flock.audio.formats.aiff = {
        reader: flock.audio.decode.chunked,
        littleEndian: false,
        
        containerID: "FORM",
        
        chunkIDs: {
            "FORM": "container",
            "COMM": "header",
            "SSND": "data" 
        },
                
        labelLayout: {
            fields: {
                id: {
                    type: "String",
                    length: 4
                },
                size: "Uint32"
            },
            order: ["id", "size"]
        },
        
        chunkLayouts: {
            "FORM": {
                fields: {
                    formatType: {
                        type: "String",
                        length: 4
                    }
                },
                order: ["formatType"]
            },
            
            "COMM": {
                fields: {
                    numChannels: "Int16",
                    numSampleFrames: "Uint32",
                    bitRate: "Uint16",
                    sampleRate: "Float80"
                    
                },
                order: ["numChannels", "numSampleFrames", "bitRate", "sampleRate"]
            },
            "SSND": {
                fields: {
                    offset: "Uint32",
                    blockSize: "Uint32"
                },
                order: ["offset", "blockSize"]
            }
        },
        
        chunkReadOrder: ["COMM", "SSND"]
    };

    
}());
