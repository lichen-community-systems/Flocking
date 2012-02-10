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
    
    flock.audio.get = function (dv, typeSpec, offset, isLittle) {
        var getter;
        
        if (typeof (typeSpec) === "string") {
            getter = dv["get" + typeSpec];
            return getter.call(dv, offset, isLittle);
        } else {
            getter = dv["get" + typeSpec.type];
            return getter.call(dv, typeSpec.length, offset, isLittle);            
        }        
    };
    
    flock.audio.decode.chunk = function (dv, chunkName, formatSpec) {
        var chunkID = formatSpec.chunkIDs[chunkName],
            layout = formatSpec.chunkLayouts[chunkID],
            isLittle = formatSpec.littleEndian,
            decoded = {},
            i,
            name,
            spec;
        
        for (i = 0; i < layout.order.length; i++) {
            name = layout.order[i];
            spec = layout.fields[name];
            decoded[name] = flock.audio.get(dv, spec, undefined, isLittle);
        }
        
        return decoded;
    };
    
    flock.audio.decode.data = function (dv, decoded, dataType, length, offset) {
        offset = offset || dv._offset;
        
        var numChans = decoded.header.numChannels,
            numFrames = decoded.header.numSampleFrames,
            bits = decoded.header.bitRate,
            rng = 1 << (bits - 1),
            arrayType = window[dataType + "Array"],
            chans = [],
            view,
            i, frame, chan, samp;
        
        // Initialize each channel.            
        for (i = 0; i < numChans; i++) {
            chans[i] = new Float32Array(numFrames);
        }
        
        // View the whole range of sample data as the correct type.
        view = new arrayType(dv.buffer);
        view = view.subarray(offset / (bits / 8), (offset / (bits / 8)) + length); // TODO: Lame!
        
        // Whip through each sample frame and read out sample data for each channel.
        for (frame = 0; frame < numFrames; frame++) {
            for (chan = 0; chan < numChans; chan++) {
                samp = view[frame + chan];
                // Scale it to a value between -1.0 and 1.0
                if (samp >= rng) {
                    samp |= ~(rng -1);
                }
                chans[chan][frame] = samp / rng;
            }
        }

        return chans;
    };
    
    flock.audio.decode.dataChunk = function (dv, formatSpec, decoded, offset) {
        var h = decoded.header,
            d = decoded.data = flock.audio.decode.chunk(dv, "data", formatSpec);
        
        // Now that we've got the actual data size, correctly set the number of sample frames if it wasn't already present.
        h.numSampleFrames = h.numSampleFrames || (d.size / (h.bitRate / 8)) / h.numChannels;

        // Read the channel data.
        // TODO: Support float types, which will involve some format-specific processing.
        decoded.data.channels = flock.audio.decode.data(dv, decoded, "Int" + h.bitRate, d.size, dv.polyOffset);
        return decoded;
    };
    
    flock.audio.decode.chunked = function (data, formatSpec) {
        var dv = new DataView(data, 0, data.byteLength),
            decoded = {};
            
        decoded.container = flock.audio.decode.chunk(dv, "container", formatSpec);
        
        // TODO: Can't safely assume chunk order. We need to iterate through each of the container's chunks and handle them in appropriate order.
        decoded.header = flock.audio.decode.chunk(dv, "header", formatSpec);
        flock.audio.decode.dataChunk(dv, formatSpec, decoded);
        
        return decoded;
    };

    
    /************************************
     * Audio Format Decoding Strategies *
     ************************************/
     
    flock.audio.formats = {};
    
    flock.audio.formats.wav = {
        reader: flock.audio.decode.chunked,
        littleEndian: true,
        
        chunkIDs: {
            container: "RIFF",
            header: "fmt ",
            data: "data"
        },
        
        validFormatTypes: ["WAVE"],
        validAudioFormatTypes: [1, 3], // TODO: this field is specific to WAVE files. Need a better way to express validation declaratively.

        chunkLayouts: {
            "RIFF": {
                fields: {
                    id: {
                        type: "String",
                        length: 4
                    },
                    size: "Uint32",
                    formatType: {
                        type: "String",
                        length: 4
                    }
                },
                order: ["id", "size", "formatType"]
            },
            "fmt ": {
                fields: {
                    id: {
                        type: "String",
                        length: 4
                    },
                    size: "Uint32",
                    audioFormatType: "Uint16",
                    numChannels: "Uint16",
                    sampleRate: "Uint32",
                    avgBytesPerSecond: "Uint32",
                    blockAlign: "Uint16",
                    bitRate: "Uint16"
                },
                order: ["id", "size", "audioFormatType", "numChannels", "sampleRate", "avgBytesPerSecond", "blockAlign", "bitRate"]
            },
            "data": {
                fields: {
                    id: {
                        type: "String",
                        length: 4
                    },
                    size: "Uint32"
                },
                order: ["id", "size"]
            }
        }
    };
    

    flock.audio.formats.aiff = {
        reader: flock.audio.decode.chunked,
        littleEndian: false,
        
        chunkIDs: {
            container: "FORM",
            header: "COMM",
            data: "SSND"
        },
        
        validFormatTypes: ["AIFF", "AIFC"],
        
        chunkLayouts: {
            "FORM": {
                fields: {
                    id: {
                        type: "String",
                        length: 4
                    },
                    size: "Int32",
                    formatType: {
                        type: "String",
                        length: 4
                    }
                },
                order: ["id", "size", "formatType"]
            },
            
            "COMM": {
                fields: {
                    id: {
                        type: "String",
                        length: 4
                    },
                    size: "Int32",
                    numChannels: "Int16",
                    numSampleFrames: "Uint32",
                    bitRate: "Int16",
                    sampleRate: "Float80"
                    
                },
                order: ["id", "size", "numChannels", "numSampleFrames", "bitRate", "sampleRate"]
            },
            "SSND": {
                fields: {
                    id: {
                        type: "String",
                        length: 4
                    },
                    size: "Int32",
                    offset: "Uint32",
                    blockSize: "Uint32"
                },
                order: ["id", "size", "offset", "blockSize"]
            }
        }
    };

    
}());
