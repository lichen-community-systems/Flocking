/*
* Flocking Audio File Library
* http://github.com/colinbdclark/flocking
*
* This file is based on Joe Turner's audiofile.js library (https://github.com/oampo/audiofile.js/blob/master/audiofile.js),
* distributed under the terms of the WTF License: https://github.com/oampo/audiofile.js/blob/master/LICENSE
*
* Modifications are Copyright 2011, Colin Clark, dual licensed under the MIT and GPL Version 2 licenses.
* Summary of changes:
*  - Factored out the duplicate code between the WAV and AIFF algorithms
*  - Decoder algorithms are now parameterized so that, at least in theory, new ones can be added without changing this file
*  - No more commonly-used names like "Decoder" exposed in the global namespace (to avoid conflicts with other code)
*/

/*global Float32Array*/
/*jslint white: true, funcinvoke: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, continue: true, forvar: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock = flock || {};

(function () {
    "use strict";
    
    flock.audio = {};
    
    flock.audio.readString = function (data, offset, length) {
        return data.slice(offset, offset + length);
    };
    
    flock.audio.readIntL = function (data, offset, length) {
        var value = 0;
        for (var i = 0; i < length; i++) {
            value = value + ((data.charCodeAt(offset + i) & 0xFF) *
                             Math.pow(2, 8 * i));
        }
        return value;
    };
    
    flock.audio.readIntB = function (data, offset, length) {
        var value = 0;
        for (var i = 0; i < length; i++) {
            value = value + ((data.charCodeAt(offset + i) & 0xFF) *
                             Math.pow(2, 8 * (length - i - 1)));
        }
        return value;
    };
    
    flock.audio.readFloatB = function (data, offset) {
        var expon = flock.audio.readIntB(data, offset, 2);
        var range = 1 << 16 - 1;
        if (expon >= range) {
            expon |= ~(range - 1);
        }

        var sign = 1;
        if (expon < 0) {
            sign = -1;
            expon += range;
        }

        var himant = flock.audio.readIntB(data, offset + 2, 4);
        var lomant = flock.audio.readIntB(data, offset + 6, 4);
        var value;
        if (expon == himant == lomant == 0) {
            value = 0;
        }
        else if (expon == 0x7FFF) {
            value = Number.MAX_VALUE;
        }
        else {
            expon -= 16383;
            value = (himant * 0x100000000 + lomant) * Math.pow(2, expon - 63);
        }
        return sign * value;
    };
    
    flock.audio.readChunkHeader = function (data, offset, reader) {
        var chunk = {};
        chunk.name = flock.audio.readString(data, offset, 4);
        chunk.length = reader(data, offset + 4, 4);
        return chunk;
    };
    
    flock.audio.checkHeader = function (expectedType, data, reader, readState) {
        var chunk = flock.audio.readChunkHeader(data, readState.offset, reader);
        readState.offset += 8;
        if (chunk.name !== expectedType.chunkID) {
            return null;
        }

        readState.fileLength = chunk.length;
        readState.fileLength += 8;

        var type = flock.audio.readString(data, readState.offset, 4);
        readState.offset += 4;
        if (type !== expectedType.formatName) {
            return null;
        }
        
        return readState;
    };

    flock.audio.readNumChannels = function (data, reader, readState) {
        // Number of channels
        readState.format.numberOfChannels = reader(data, readState.offset, 2);
        readState.offset += 2;
        return readState;
    };
    
    flock.audio.readBitDepth = function (data, reader, readState) {
        readState.format.bitDepth = reader(data, readState.offset, 2);
        readState.format.bytesPerSample = readState.format.bitDepth / 8;
        readState.offset += 2;
        return readState;
    };
    
    flock.audio.readChannelData = function (data, reader, readState) {
        var channels = [],
            fmt = readState.format,
            bytesPerSample = fmt.bytesPerSample,
            i;
        for (i = 0; i < fmt.numberOfChannels; i++) {
            channels.push(new Float32Array(fmt.length));
        }
        
        for (i = 0; i < fmt.numberOfChannels; i++) {
            var channel = channels[i];
            for (var j = 0; j < fmt.length; j++) {
                var index = readState.offset;
                index += (j * fmt.numberOfChannels + i) * bytesPerSample;
                // Sample
                var value = reader(data, index, bytesPerSample);
                // Scale range from 0 to 2**bitDepth -> -2**(bitDepth-1) to
                // 2**(bitDepth-1)
                var range = 1 << fmt.bitDepth - 1;
                if (value >= range) {
                    value |= ~(range - 1);
                }
                // Scale range to -1 to 1
                channel[j] = value / range;
            }
        }
        
        return channels;
    };

    flock.audio.decode = function (format, data) {
	    var formatSpec = flock.audio.formats[format];
	    
        if (!formatSpec) {
            console.error("There is no decoder available for " + format + " files.");
            return null;
        }
	    
	    var headerInfo = formatSpec.headerInfo,
	        reader = formatSpec.reader,
	        decoded;

        var readState = flock.audio.checkHeader(headerInfo, data, reader, {
            offset: 0,
            fileLength: undefined
        });
        
        if (readState === null) {
            console.error("File is not in the " + headerInfo.formatName + " format.");
            return null;
        }
        
        while (readState.offset < readState.fileLength) {
            var chunk = flock.audio.readChunkHeader(data, readState.offset, reader);
            readState.offset += 8;

            if (chunk.name === headerInfo.formatChunkName) {
                decoded = formatSpec.readFormat(data, reader, readState);
            }
            else if (chunk.name === headerInfo.dataChunkName) {
		        decoded.channels = formatSpec.readDataChunk(data, chunk, reader, readState);
            }
            else {
                readState.offset += chunk.length;
            }
        }
        
        return decoded;
    };
    
    
    flock.audio.formats = {};
    
    /*******
     * WAV *
     *******/
     
    flock.audio.formats.wav = {
        headerInfo: {
            chunkID: "RIFF",
            formatChunkName: "fmt ",
            dataChunkName: "data",
            formatName: "WAVE"
        },
        
        reader: flock.audio.readIntL,
        
        readFormat: function (data, reader, readState) {
            // File encoding
            var encoding = reader(data, readState.offset, 2);
            readState.offset += 2;

            if (encoding != 0x0001) {
                // Only support PCM
                console.error('Cannot decode non-PCM encoded WAV file');
                return null;
            }

            readState.format = {};

            // Number of channels
            flock.audio.readNumChannels(data, reader, readState);

            // Sample rate
            readState.format.sampleRate = reader(data, readState.offset, 4);
            readState.offset += 4;

            // Ignore bytes/sec - 4 bytes
            readState.offset += 4;

            // Ignore block align - 2 bytes
            readState.offset += 2;

            // Bit depth
            flock.audio.readBitDepth(data, reader, readState);

            return readState.format;
        },
        
        readDataChunk: function (data, chunk, reader, readState) {
            var fmt = readState.format;
            fmt.length = chunk.length / (fmt.bytesPerSample * fmt.numberOfChannels);
            var channels = flock.audio.readChannelData(data, reader, readState);
            readState.offset += chunk.length;
            
            return channels;
        }
    };
    
    
    /********
     * AIFF *
     ********/
     
    flock.audio.formats.aiff = {
        headerInfo: {
            chunkID: "FORM",
            formatName: "AIFF",
            formatChunkName: "COMM",
            dataChunkName: "SSND"
        },
        
        reader: flock.audio.readIntB,

        readFormat: function (data, reader, readState) {
            readState.format = {};

            // Number of channels
            flock.audio.readNumChannels(data, reader, readState);

            // Number of samples
            readState.format.length = reader(data, readState.offset, 4);
            readState.offset += 4;

            // Bit depth
            flock.audio.readBitDepth(data, reader, readState);

            // Sample rate
            readState.format.sampleRate = reader(data, readState.offset);
            readState.offset += 10;
            
            return readState.format;
        },
        
        readDataChunk: function (data, chunk, reader, readState) {
            // Data offset
            var dataOffset = reader(data, readState.offset, 4);
            readState.offset += 4;

            // Ignore block size
            readState.offset += 4;

            // Skip over data offset
            readState.offset += dataOffset;

            // Channel data
            var channels = flock.audio.readChannelData(data, reader, readState);
            readState.offset += chunk.length - dataOffset - 8;
            
            return channels;
        }
    };
    
}());
