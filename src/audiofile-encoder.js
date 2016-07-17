/*
 * Flocking Audio Encoders
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2015, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require, ArrayBuffer, Uint8Array */
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

    fluid.registerNamespace("flock.audio.encode");

    flock.audio.interleave = function (bufDesc) {
        var numFrames = bufDesc.format.numSampleFrames,
            chans = bufDesc.data.channels,
            numChans = bufDesc.format.numChannels,
            numSamps = numFrames * numChans,
            out = new Float32Array(numSamps),
            outIdx = 0,
            frame,
            chan;

        for (frame = 0; frame < numFrames; frame++) {
            for (chan = 0; chan < numChans; chan++) {
                out[outIdx] = chans[chan][frame];
                outIdx++;
            }
        }

        return out;
    };

    flock.audio.encode = function (bufDesc, type, format) {
        type = type || "wav";
        if (type.toLowerCase() !== "wav") {
            flock.fail("Flocking currently only supports encoding WAVE files.");
        }

        return flock.audio.encode.wav(bufDesc, format);
    };

    flock.audio.encode.writeFloat32Array = function (offset, dv, buf) {
        for (var i = 0; i < buf.length; i++) {
            dv.setFloat32(offset, buf[i], true);
            offset += 4;
        }

        return dv;
    };

    flock.audio.encode.setString = function (dv, offset, str){
        for (var i = 0; i < str.length; i++){
            dv.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    flock.audio.encode.setBytes = function (dv, offset, bytes) {
        for (var i = 0; i < bytes.length; i++) {
            dv.setUint8(offset + i, bytes[i]);
        }
    };

    flock.audio.encode.writeAsPCM = function (convertSpec, offset, dv, buf) {
        if (convertSpec.setter === "setFloat32" && buf instanceof Float32Array) {
            return flock.audio.encode.writeFloat32Array(offset, dv, buf);
        }

        for (var i = 0; i < buf.length; i++) {
            var s = flock.audio.convert.floatToInt(buf[i], convertSpec);

            // Write the sample to the DataView.
            dv[convertSpec.setter](offset, s, true);
            offset += convertSpec.width;
        }

        return dv;
    };

    flock.audio.encode.wav = function (bufDesc, format) {
        format = format || flock.audio.convert.pcm.int16;

        var convertSpec = flock.audio.convert.specForPCMType(format),
            interleaved = flock.audio.interleave(bufDesc),
            numChans = bufDesc.format.numChannels,
            sampleRate = bufDesc.format.sampleRate,
            isPCM = convertSpec.setter !== "setFloat32",
            riffHeaderSize = 8,
            formatHeaderSize = 12,
            formatBodySize = 16,
            formatTag = 1,
            dataHeaderSize = 8,
            dataBodySize = interleaved.length * convertSpec.width,
            dataChunkSize = dataHeaderSize + dataBodySize,
            bytesPerFrame = convertSpec.width * numChans,
            bitsPerSample = 8 * convertSpec.width;

        if (numChans > 2 || !isPCM) {
            var factHeaderSize = 8,
                factBodySize = 4,
                factChunkSize = factHeaderSize + factBodySize;

            formatBodySize += factChunkSize;

            if (numChans > 2) {
                formatBodySize += 24;
                formatTag = 0xFFFE; // Extensible.
            } else {
                formatBodySize += 2;
                formatTag = 3; // Two-channel IEEE float.
            }
        }

        var formatChunkSize = formatHeaderSize + formatBodySize,
            riffBodySize = formatChunkSize + dataChunkSize,
            numBytes = riffHeaderSize + riffBodySize,
            out = new ArrayBuffer(numBytes),
            dv = new DataView(out);

        // RIFF chunk header.
        flock.audio.encode.setString(dv, 0, "RIFF"); // ckID
        dv.setUint32(4, riffBodySize, true); // cksize

        // Format Header
        flock.audio.encode.setString(dv, 8, "WAVE"); // WAVEID
        flock.audio.encode.setString(dv, 12, "fmt "); // ckID
        dv.setUint32(16, formatBodySize, true); // cksize, length of the format chunk.

        // Format Body
        dv.setUint16(20, formatTag, true); // wFormatTag
        dv.setUint16(22, numChans, true); // nChannels
        dv.setUint32(24, sampleRate, true); // nSamplesPerSec
        dv.setUint32(28, sampleRate * bytesPerFrame, true); // nAvgBytesPerSec (sample rate * byte width * channels)
        dv.setUint16(32, bytesPerFrame, true); //nBlockAlign (channel count * bytes per sample)
        dv.setUint16(34, bitsPerSample, true); // wBitsPerSample

        var offset = 36;
        if (formatTag === 3) {
            // IEEE Float. Write out a fact chunk.
            dv.setUint16(offset, 0, true); // cbSize: size of the extension
            offset += 2;
            offset = flock.audio.encode.wav.writeFactChunk(dv, offset, bufDesc.format.numSampleFrames);
        } else if (formatTag === 0xFFFE) {
            // Extensible format (i.e. > 2 channels).
            // Write out additional format fields and fact chunk.
            dv.setUint16(offset, 22, true); // cbSize: size of the extension
            offset += 2;

            // Additional format fields.
            offset = flock.audio.encode.wav.additionalFormat(offset, dv, bitsPerSample, isPCM);

            // Fact chunk.
            offset = flock.audio.encode.wav.writeFactChunk(dv, offset, bufDesc.format.numSampleFrames);
        }

        flock.audio.encode.wav.writeDataChunk(convertSpec, offset, dv, interleaved, dataBodySize);

        return dv.buffer;
    };

    flock.audio.encode.wav.subformats = {
        pcm: new Uint8Array([1, 0, 0, 0, 0, 0, 16, 0, 128, 0, 0, 170, 0, 56, 155, 113]),
        float: new Uint8Array([3, 0, 0, 0, 0, 0, 16, 0, 128, 0, 0, 170, 0, 56, 155, 113])
    };

    flock.audio.encode.wav.additionalFormat = function (offset, dv, bitsPerSample, isPCM) {
        dv.setUint16(offset, bitsPerSample, true); // wValidBitsPerSample
        offset += 2;

        dv.setUint32(offset, 0x80000000, true); // dwChannelMask, hardcoded to SPEAKER_RESERVED
        offset += 4;

        // Subformat GUID.
        var subformat = flock.audio.encode.wav.subformats[isPCM ? "pcm" : "float"];
        flock.audio.encode.setBytes(dv, offset, subformat);
        offset += 16;

        return offset;
    };

    flock.audio.encode.wav.writeFactChunk = function (dv, offset, numSampleFrames) {
        flock.audio.encode.setString(dv, offset, "fact"); // ckID
        offset += 4;

        dv.setUint32(offset, 4, true); //cksize
        offset += 4;

        dv.setUint32(offset, numSampleFrames, true); // dwSampleLength
        offset += 4;

        return offset;
    };

    flock.audio.encode.wav.writeDataChunk = function (convertSpec, offset, dv, interleaved, numSampleBytes) {
        // Data chunk Header
        flock.audio.encode.setString(dv, offset, "data");
        offset += 4;
        dv.setUint32(offset, numSampleBytes, true); // Length of the datahunk.
        offset += 4;

        flock.audio.encode.writeAsPCM(convertSpec, offset, dv, interleaved);
    };
}());
