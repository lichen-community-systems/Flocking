/*! Flocking 0.1, Copyright 2011-2014 Colin Clark | flockingjs.org */

/*
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2014, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global require, Float32Array, window, AudioContext, webkitAudioContext*/
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

    var $ = fluid.registerNamespace("jQuery");

    flock.fluid = fluid;

    flock.init = function (options) {
        var enviroOpts = !options ? undefined : {
            audioSettings: options
        };

        var enviro = flock.enviro.shared = flock.enviro(enviroOpts);

        return enviro;
    };

    flock.OUT_UGEN_ID = "flocking-out";
    flock.MAX_CHANNELS = 32;
    flock.MIN_BUSES = 2;
    flock.MAX_INPUT_BUSES = 32;
    flock.MIN_INPUT_BUSES = 1; // TODO: This constraint should be removed.
    flock.ALL_CHANNELS = flock.MAX_INPUT_BUSES;

    flock.PI = Math.PI;
    flock.TWOPI = 2.0 * Math.PI;
    flock.HALFPI = Math.PI / 2.0;
    flock.LOG01 = Math.log(0.1);
    flock.LOG001 = Math.log(0.001);
    flock.ROOT2 = Math.sqrt(2);

    flock.rates = {
        AUDIO: "audio",
        CONTROL: "control",
        SCHEDULED: "scheduled",
        DEMAND: "demand",
        CONSTANT: "constant"
    };

    flock.sampleFormats = {
        FLOAT32NE: "float32NE"
    };

    fluid.registerNamespace("flock.debug");
    flock.debug.failHard = true;

    flock.browser = function () {
        if (typeof navigator === "undefined") {
            return {};
        }

        // This is a modified version of jQuery's browser detection code,
        // which they removed from jQuery 2.0.
        // Some of us still have to live in the messy reality of the web.
        var ua = navigator.userAgent.toLowerCase(),
            browser = {},
            match,
            matched;

        match = /(chrome)[ \/]([\w.]+)/.exec(ua) ||
            /(webkit)[ \/]([\w.]+)/.exec(ua) ||
            /(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua) ||
            /(msie) ([\w.]+)/.exec(ua) ||
            ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua) || [];

        matched = {
            browser: match[1] || "",
            version: match[2] || "0"
        };

        if (matched.browser) {
            browser[matched.browser] = true;
            browser.version = matched.version;
        }

        // Chrome is Webkit, but Webkit is also Safari.
        if (browser.chrome) {
            browser.webkit = true;
        } else if (browser.webkit) {
            browser.safari = true;
        }

        return browser;
    };

    // TODO: Move to components in the static environment and into the appropriate platform files.
    fluid.registerNamespace("flock.platform");
    flock.platform.isBrowser = typeof window !== "undefined";
    flock.platform.hasRequire = typeof require !== "undefined";
    flock.platform.os = flock.platform.isBrowser ? window.navigator.platform : fluid.require("os").platform();
    flock.platform.isLinux = flock.platform.os.indexOf("Linux") > -1;
    flock.platform.isAndroid = flock.platform.isLinux && flock.platform.os.indexOf("arm") > -1;
    flock.platform.isIOS = flock.platform.os === "iPhone" || flock.platform.os === "iPad" || flock.platform.os === "iPod";
    flock.platform.isMobile = flock.platform.isAndroid || flock.platform.isIOS;
    flock.platform.browser = flock.browser();
    flock.platform.isWebAudio = typeof AudioContext !== "undefined" || typeof webkitAudioContext !== "undefined";
    flock.platform.audioEngine = flock.platform.isBrowser ? (flock.platform.isWebAudio ? "webAudio" : "moz") : "nodejs";
    fluid.staticEnvironment.audioEngine = fluid.typeTag("flock.platform." + flock.platform.audioEngine);

    flock.defaultBufferSizeForPlatform = function () {
        if (flock.platform.isMobile) {
            return 8192;
        }

        return 1024;
    };

    flock.shim = {
        URL: flock.platform.isBrowser ? (window.URL || window.webkitURL || window.msURL) : undefined
    };

    flock.requireModule = function (moduleName, globalName) {
        if (flock.platform.isBrowser) {
            return window[globalName || moduleName];
        }

        if (!flock.platform.hasRequire) {
            return undefined;
        }

        var resolvedName = flock.requireModule.paths[moduleName] || moduleName;
        var togo = require(resolvedName);

        return globalName ? togo[globalName] : togo;
    };

    flock.requireModule.paths = {
        dspapi: "../third-party/dspapi/js/dspapi.js",
        Random: "../third-party/simjs/js/random-0.26.js"
    };

    /*************
     * Utilities *
     *************/

    flock.noOp = function () {};

    flock.isIterable = function (o) {
        var type = typeof o;
        return o && o.length !== undefined && type !== "string" && type !== "function";
    };

    flock.hasTag = function (obj, tag) {
        if (!obj || !tag) {
            return false;
        }
        return obj.tags && obj.tags.indexOf(tag) > -1;
    };

    // TODO: Chrome profiler marks this function as unoptimized.
    // This should probably be factored into separate functions for
    // new and existing arrays. (e.g. "generate" vs. "fill")
    flock.generate = function (bufOrSize, generator) {
        var buf = typeof bufOrSize === "number" ? new Float32Array(bufOrSize) : bufOrSize,
            isFunc = typeof generator === "function",
            i;

        for (i = 0; i < buf.length; i++) {
            buf[i] = isFunc ? generator(i, buf) : generator;
        }

        return buf;
    };

    flock.generate.silence = function (bufOrSize) {
        if (typeof bufOrSize === "number") {
            return new Float32Array(bufOrSize);
        }

        var buf = bufOrSize,
            i;
        for (i = 0; i < buf.length; i++) {
            buf[i] = 0.0;
        }
        return buf;
    };

    /**
     * Performs an in-place reversal of all items in the array.
     *
     * @arg {Iterable} b a buffer or array to reverse
     * @return {Iterable} the buffer, reversed
     */
    flock.reverse = function (b) {
        if (!b || !flock.isIterable(b) || b.length < 2) {
            return b;
        }

        // A native implementation of reverse() exists for regular JS arrays
        // and is partially implemented for TypedArrays. Use it if possible.
        if (typeof b.reverse === "function") {
            return b.reverse();
        }

        var t;
        for (var l = 0, r = b.length - 1; l < r; l++, r--) {
            t = b[l];
            b[l] = b[r];
            b[r] = t;
        }

        return b;
    };

    /**
     * Randomly selects an index from the specified array.
     */
    flock.randomIndex = function (arr) {
        var max = arr.length - 1;
        return Math.round(Math.random() * max);
    };

    /**
     * Randomly selects an item from an array-like object.
     *
     * @param {Array-like object} arr the array to choose from
     * @param {Function} a selection strategy; defaults to flock.randomIndex
     * @return a randomly selected list item
     */
    flock.arrayChoose = function (arr, strategy) {
        strategy = strategy || flock.randomIndex;
        arr = fluid.makeArray(arr);
        var idx = strategy(arr);
        return arr[idx];
    };

    /**
     * Randomly selects an item from an array or object.
     *
     * @param {Array-like object|Object} collection the object to choose from
     * @return a randomly selected item from collection
     */
    flock.choose = function (collection, strategy) {
        var key, val;

        if (flock.isIterable(collection)) {
            val = flock.arrayChoose(collection, strategy);
            return val;
        }

        key = flock.arrayChoose(collection.keys, strategy);
        val = collection[key];
        return val;
    };

    /**
     * Normalizes the specified buffer in place to the specified value.
     *
     * @param {Arrayable} buffer the buffer to normalize
     * @param {Number} normal the value to normalize the buffer to
     * @param {Arrayable} a buffer to output values into; if omitted, buffer will be modified in place
     * @return the buffer, normalized in place
     */
    flock.normalize = function (buffer, normal, output) {
        output = output || buffer;

        var maxVal = 0.0,
            i,
            current,
            val;

        normal = normal === undefined ? 1.0 : normal;
        // Find the maximum value in the buffer.
        for (i = 0; i < buffer.length; i++) {
            current = Math.abs(buffer[i]);
            if (current > maxVal) {
                maxVal = current;
            }
        }

        // And then normalize the buffer in place.
        if (maxVal > 0.0) {
            for (i = 0; i < buffer.length; i++) {
                val = buffer[i];
                output[i] = (val / maxVal) * normal;
            }
        }

        return output;
    };

    flock.generateFourierTable = function (size, scale, numHarms, phase, amps) {
        phase *= flock.TWOPI;

        return flock.generate(size, function (i) {
            var harm,
                amp,
                w,
                val = 0.0;

            for (harm = 0; harm < numHarms; harm++) {
                amp = amps ? amps[harm] : 1.0;
                w = (harm + 1) * (i * scale);
                val += amp * Math.cos(w + phase);
            }

            return val;
        });
    };

    flock.generateNormalizedFourierTable = function (size, scale, numHarms, phase, ampGenFn) {
        var amps = flock.generate(numHarms, function (harm) {
            return ampGenFn(harm + 1); //  Harmonics are indexed from 1 instead of 0.
        });

        var table = flock.generateFourierTable(size, scale, numHarms, phase, amps);
        return flock.normalize(table);
    };

    flock.fillTable = function (sizeOrTable, fillFn) {
        var len = typeof (sizeOrTable) === "number" ? sizeOrTable : sizeOrTable.length;
        return fillFn(sizeOrTable, flock.TWOPI / len);
    };

    flock.tableGenerators = {
        sin: function (size, scale) {
            return flock.generate(size, function (i) {
                return Math.sin(i * scale);
            });
        },

        tri: function (size, scale) {
            return flock.generateNormalizedFourierTable(size, scale, 1000, 1.0, function (harm) {
                // Only odd harmonics,
                // amplitudes decreasing by the inverse square of the harmonic number
                return harm % 2 === 0 ? 0.0 : 1.0 / (harm * harm);
            });
        },

        saw: function (size, scale) {
            return flock.generateNormalizedFourierTable(size, scale, 10, -0.25, function (harm) {
                // All harmonics,
                // amplitudes decreasing by the inverse of the harmonic number
                return 1.0 / harm;
            });
        },

        square: function (size, scale) {
            return flock.generateNormalizedFourierTable(size, scale, 10, -0.25, function (harm) {
                // Only odd harmonics,
                // amplitudes decreasing by the inverse of the harmonic number
                return harm % 2 === 0 ? 0.0 : 1.0 / harm;
            });
        },

        hann: function (size) {
            // Hanning envelope: sin^2(i) for i from 0 to pi
            return flock.generate(size, function (i) {
                var y = Math.sin(Math.PI * i / size);
                return y * y;
            });
        },

        sinWindow: function (size) {
            return flock.generate(size, function (i) {
                return Math.sin(Math.PI * i / size);
            });
        }
    };

    flock.range = function (buf) {
        var range = {
            max: Number.NEGATIVE_INFINITY,
            min: Infinity
        };
        var i, val;

        for (i = 0; i < buf.length; i++) {
            val = buf[i];
            if (val > range.max) {
                range.max = val;
            }
            if (val < range.min) {
                range.min = val;
            }
        }

        return range;
    };

    flock.scale = function (buf) {
        if (!buf) {
            return;
        }

        var range = flock.range(buf),
            mul = (range.max - range.min) / 2,
            sub = (range.max + range.min) / 2,
            i;

        for (i = 0; i < buf.length; i++) {
            buf[i] = (buf[i] - sub) / mul;
        }

        return buf;
    };

    flock.copyBuffer = function (buffer, start, end) {
        if (end === undefined) {
            end = buffer.length;
        }

        var len = end - start,
            target = new Float32Array(len),
            i,
            j;

        for (i = start, j = 0; i < end; i++, j++) {
            target[j] = buffer[i];
        }

        return target;
    };

    flock.parseMidiString = function (midiStr) {
        if (!midiStr || midiStr.length < 2) {
            return NaN;
        }

        midiStr = midiStr.toLowerCase();

        var secondChar = midiStr.charAt(1),
            splitIdx = secondChar === "#" || secondChar === "b" ? 2 : 1,
            note = midiStr.substring(0, splitIdx),
            octave = Number(midiStr.substring(splitIdx)),
            pitchClass = flock.midiFreq.noteNames[note],
            midiNum = octave * 12 + pitchClass;

        return midiNum;
    };

    flock.midiFreq = function (midi, a4Freq, a4NoteNum, notesPerOctave) {
        a4Freq = a4Freq === undefined ? 440 : a4Freq;
        a4NoteNum = a4NoteNum === undefined ? 69 : a4NoteNum;
        notesPerOctave = notesPerOctave || 12;

        if (typeof midi === "string") {
            midi = flock.parseMidiString(midi);
        }

        return a4Freq * Math.pow(2, (midi - a4NoteNum) * 1 / notesPerOctave);
    };

    flock.midiFreq.noteNames = {
        "b#": 0,
        "c": 0,
        "c#": 1,
        "db": 1,
        "d": 2,
        "d#": 3,
        "eb": 3,
        "e": 4,
        "e#": 5,
        "f": 5,
        "f#": 6,
        "gb": 6,
        "g": 7,
        "g#": 8,
        "ab": 8,
        "a": 9,
        "a#": 10,
        "bb": 10,
        "b": 11,
        "cb": 11
    };

    flock.interpolate = {
        /**
         * Performs simple truncation.
         */
        none: function (idx, table) {
            idx = idx % table.length;

            return table[idx | 0];
        },

        /**
         * Performs linear interpolation.
         */
        linear: function (idx, table) {
            var len = table.length;
            idx = idx % len;

            var i1 = idx | 0,
                i2 = (i1 + 1) % len,
                frac = idx - i1,
                y1 = table[i1],
                y2 = table[i2];

            return y1 + frac * (y2 - y1);
        },

        /**
         * Performs Hermite cubic interpolation.
         *
         * Based on Laurent De Soras' implementation at:
         * http://www.musicdsp.org/showArchiveComment.php?ArchiveID=93
         *
         * @param idx {Number} an index into the table
         * @param table {Arrayable} the table from which values around idx should be drawn and interpolated
         * @return {Number} an interpolated value
         */
        hermite: function (idx, table) {
            var len = table.length,
                intPortion = Math.floor(idx),
                i0 = intPortion % len,
                frac = idx - intPortion,
                im1 = i0 > 0 ? i0 - 1 : len - 1,
                i1 = (i0 + 1) % len,
                i2 = (i0 + 2) % len,
                xm1 = table[im1],
                x0 = table[i0],
                x1 = table[i1],
                x2 = table[i2],
                c = (x1 - xm1) * 0.5,
                v = x0 - x1,
                w = c + v,
                a = w + v + (x2 - x0) * 0.5,
                bNeg = w + a,
                val = (((a * frac) - bNeg) * frac + c) * frac + x0;

            return val;
        }
    };

    flock.interpolate.cubic = flock.interpolate.hermite;

    flock.log = {
        warn: function (msg) {
            fluid.log(fluid.logLevel.WARN, msg);
        },

        debug: function (msg) {
            fluid.log(fluid.logLevel.INFO, msg);
        }
    };

    flock.fail = function (msg) {
        if (flock.debug.failHard) {
            throw new Error(msg);
        } else {
            fluid.log(fluid.logLevel.FAIL, msg);
        }
    };

    flock.pathParseError = function (root, path, token) {
        var msg = "Error parsing path '" + path + "'. Segment '" + token +
            "' could not be resolved. Root object was: " + fluid.prettyPrintJSON(root);

        flock.fail(msg);
    };

    flock.get = function (root, path) {
        if (!root) {
            return fluid.getGlobalValue(path);
        }

        if (arguments.length === 1 && typeof root === "string") {
            return fluid.getGlobalValue(root);
        }

        if (!path || path === "") {
            return;
        }

        var tokenized = path === "" ? [] : String(path).split("."),
            valForSeg = root[tokenized[0]],
            i;

        for (i = 1; i < tokenized.length; i++) {
            if (valForSeg === null || valForSeg === undefined) {
                flock.pathParseError(root, path, tokenized[i - 1]);
                return;
            }
            valForSeg = valForSeg[tokenized[i]];
        }

        return valForSeg;
    };

    flock.set = function (root, path, value) {
        if (!root || !path || path === "") {
            return;
        }

        var tokenized = String(path).split("."),
            l = tokenized.length,
            prop = tokenized[0],
            i,
            type;

        for (i = 1; i < l; i++) {
            root = root[prop];
            type = typeof root;
            if (type !== "object") {
                flock.fail("Error while setting a value at path '" + path +
                    "'. A non-container object was found at segment '" + prop + "'. Value: " + root);

                return;
            }
            prop = tokenized[i];
            if (root[prop] === undefined) {
                root[prop] = {};
            }
        }
        root[prop] = value;

        return value;
    };

    flock.invoke = function (root, path, args) {
        var fn = typeof root === "function" ? root : flock.get(root, path);
        if (typeof fn !== "function") {
            flock.fail("Path '" + path + "' does not resolve to a function.");
            return;
        }
        return fn.apply(null, args);
    };


    flock.input = {};

    flock.input.shouldExpand = function (inputName) {
        return flock.parse.specialInputs.indexOf(inputName) < 0;
    };

    // TODO: Replace this with a regular expression;
    // this produces too much garbage!
    flock.input.pathExpander = function (path) {
        var segs = fluid.model.parseEL(path),
            separator = "inputs",
            len = segs.length,
            penIdx = len - 1,
            togo = [],
            i;

        for (i = 0; i < penIdx; i++) {
            var seg = segs[i];
            var nextSeg = segs[i + 1];

            togo.push(seg);

            if (nextSeg === "model" || nextSeg === "options") {
                togo = togo.concat(segs.slice(i + 1, penIdx));
                break;
            }

            if (!isNaN(Number(nextSeg))) {
                continue;
            }

            togo.push(separator);
        }

        togo.push(segs[penIdx]);

        return togo.join(".");
    };

    flock.input.expandPaths = function (paths) {
        var expanded = {},
            path,
            expandedPath,
            value;

        for (path in paths) {
            expandedPath = flock.input.pathExpander(path);
            value = paths[path];
            expanded[expandedPath] = value;
        }

        return expanded;
    };

    flock.input.expandPath = function (path) {
        return (typeof path === "string") ? flock.input.pathExpander(path) : flock.input.expandPaths(path);
    };

    flock.input.getValueForPath = function (root, path) {
        path = flock.input.expandPath(path);
        var input = flock.get(root, path);

        // If the unit generator is a valueType ugen, return its value, otherwise return the ugen itself.
        return flock.hasTag(input, "flock.ugen.valueType") ? input.inputs.value : input;
    };

    flock.input.getValuesForPathArray = function (root, paths) {
        var values = {},
            i,
            path;

        for (i = 0; i < paths.length; i++) {
            path = paths[i];
            values[path] = flock.input.get(root, path);
        }

        return values;
    };

    flock.input.getValuesForPathObject = function (root, pathObj) {
        var key;

        for (key in pathObj) {
            pathObj[key] = flock.input.get(root, key);
        }

        return pathObj;
    };

    /**
     * Gets the value of the ugen at the specified path.
     *
     * @param {String} path the ugen's path within the synth graph
     * @return {Number|UGen} a scalar value in the case of a value ugen, otherwise the ugen itself
     */
    flock.input.get = function (root, path) {
        return typeof path === "string" ? flock.input.getValueForPath(root, path) :
            flock.isIterable(path) ? flock.input.getValuesForPathArray(root, path) :
            flock.input.getValuesForPathObject(root, path);
    };

    flock.input.resolveValue = function (root, path, val, target, inputName, previousInput, valueParser) {
        // Check to see if the value is actually a "get expression"
        // (i.e. an EL path wrapped in ${}) and resolve it if necessary.
        if (typeof val === "string") {
            var extracted = fluid.extractEL(val, flock.input.valueExpressionSpec);
            if (extracted) {
                var resolved = flock.input.getValueForPath(root, extracted);
                if (resolved === undefined) {
                    flock.log.debug("The value expression '" + val + "' resolved to undefined. " +
                    "If this isn't expected, check to ensure that your path is valid.");
                }

                return resolved;
            }
        }

        return flock.input.shouldExpand(inputName) && valueParser ?
            valueParser(val, path, target, previousInput) : val;
    };

    flock.input.valueExpressionSpec = {
        ELstyle: "${}"
    };

    flock.input.setValueForPath = function (root, path, val, baseTarget, valueParser) {
        path = flock.input.expandPath(path);

        var previousInput = flock.get(root, path),
            lastDotIdx = path.lastIndexOf("."),
            inputName = path.slice(lastDotIdx + 1),
            target = lastDotIdx > -1 ? flock.get(root, path.slice(0, path.lastIndexOf(".inputs"))) :
                baseTarget,
            resolvedVal = flock.input.resolveValue(root, path, val, target, inputName, previousInput, valueParser);

        flock.set(root, path, resolvedVal);

        if (target && target.onInputChanged) {
            target.onInputChanged(inputName);
        }

        return resolvedVal;
    };

    flock.input.setValuesForPaths = function (root, valueMap, baseTarget, valueParser) {
        var resultMap = {},
            path,
            val,
            result;

        for (path in valueMap) {
            val = valueMap[path];
            result = flock.input.set(root, path, val, baseTarget, valueParser);
            resultMap[path] = result;
        }

        return resultMap;
    };

    /**
     * Sets the value of the ugen at the specified path.
     *
     * @param {String} path the ugen's path within the synth graph
     * @param {Number || UGenDef} val a scalar value (for Value ugens) or a UGenDef object
     * @return {UGen} the newly created UGen that was set at the specified path
     */
    flock.input.set = function (root, path, val, baseTarget, valueParser) {
        return typeof path === "string" ?
            flock.input.setValueForPath(root, path, val, baseTarget, valueParser) :
            flock.input.setValuesForPaths(root, path, baseTarget, valueParser);
    };


    fluid.defaults("flock.nodeList", {
        gradeNames: ["fluid.littleComponent", "autoInit"],
        members: {
            nodes: [],
            namedNodes: {}
        }
    });

    flock.nodeList.preInit = function (that) {
        that.head = function (node) {
            that.nodes.unshift(node);
            if (node.nickName) {
                that.namedNodes[node.nickName] = node;
            }
            return 0;
        };

        that.before = function (refNode, node) {
            var refIdx = that.nodes.indexOf(refNode);
            that.insert(refIdx, node);
            return refIdx;
        };

        that.after = function (refNode, node) {
            var refIdx = that.nodes.indexOf(refNode),
                atIdx = refIdx + 1;
            that.insert(atIdx, node);
            return atIdx;
        };

        that.insert = function (idx, node) {
            if (idx < 0) {
                return that.head(node);
            }

            that.nodes.splice(idx, 0, node);
            if (node.nickName) {
                that.namedNodes[node.nickName] = node;
            }
            return idx;
        };

        that.tail = function (node) {
            that.nodes.push(node);
            if (node.nickName) {
                that.namedNodes[node.nickName] = node;
            }
            return that.nodes.length;
        };

        that.remove = function (node) {
            var idx = that.nodes.indexOf(node);
            if (idx < 0) {
                return idx;
            }

            that.nodes.splice(idx, 1);
            delete that.namedNodes[node.nickName];
            return idx;
        };

        that.replace = function (newNode, oldNode) {
            var idx = that.nodes.indexOf(oldNode);
            if (idx < 0) {
                return that.head(newNode);
            }

            that.nodes[idx] = newNode;
            delete that.namedNodes[oldNode.nickName];

            if (newNode.nickName) {
                that.namedNodes[newNode.nickName] = newNode;
            }
            return idx;
        };

        that.clearAll = function () {
            while (that.nodes.length > 0) {
                that.nodes.pop();
            }
        };
    };


    /***********************
     * Synths and Playback *
     ***********************/

    fluid.defaults("flock.enviro", {
        gradeNames: ["fluid.standardRelayComponent", "flock.nodeList", "autoInit"],

        members: {
            audioSettings: "@expand:flock.enviro.clampAudioSettings({that}.options.audioSettings)",
            buses: {
                expander: {
                    funcName: "flock.enviro.createAudioBuffers",
                    args: ["{that}.audioSettings.numBuses", "{that}.audioSettings.blockSize"]
                }
            },
            buffers: {},
            bufferSources: {}
        },

        model: {
            isPlaying: false,

            // TODO: Buses should probably be managed by their own component.
            nextAvailableBus: {
                input: 0,
                interconnect: 0
            }
        },

        audioSettings: {
            rates: {
                audio: 48000, // This is only a hint. Some audio backends (such as the Web Audio API)
                              // may define the sample rate themselves.
                control: undefined, // Control rate is calculated dynamically based on the audio rate and the block size.
                scheduled: undefined, // The scheduled rate is a user-specified parameter.
                demand: 0,
                constant: 0
            },
            blockSize: 64,
            chans: 2,
            numInputBuses: 2,
            numBuses: 8,
            // This buffer size determines the overall latency of Flocking's audio output.
            // TODO: Replace this with IoC awesomeness.
            bufferSize: flock.defaultBufferSizeForPlatform(),
        },

        components: {
            asyncScheduler: {
                type: "flock.scheduler.async"
            },

            audioStrategy: {
                type: "flock.audioStrategy.platform",
                options: {
                    audioSettings: "{enviro}.audioSettings"
                }
            }
        },

        invokers: {
            acquireNextBus: {
                funcName: "flock.enviro.acquireNextBus",
                args: [
                    "{arguments}.0", // The type of bus, either "input" or "interconnect".
                    "{that}.buses",
                    "{that}.applier",
                    "{that}.model",
                    "{that}.audioSettings"
                ]
            }
        },

        listeners: {
            onCreate: {
                funcName: "flock.enviro.calculateControlRate",
                args: ["{that}.audioSettings"]
            }
        }
    });

    flock.enviro.clampAudioSettings = function (s) {
        s.numInputBuses = Math.min(s.numInputBuses, flock.MAX_INPUT_BUSES);
        s.numInputBuses = Math.max(s.numInputBuses, flock.MIN_INPUT_BUSES);
        s.chans = Math.min(s.chans, flock.MAX_CHANNELS);
        s.numBuses = Math.max(s.numBuses, s.chans);
        s.numBuses = Math.max(s.numBuses, flock.MIN_BUSES);

        return s;
    };

    // TODO: This should be modelized.
    flock.enviro.calculateControlRate = function (audioSettings) {
        audioSettings.rates.control = audioSettings.rates.audio / audioSettings.blockSize;
        return audioSettings;
    };

    flock.enviro.acquireNextBus = function (type, buses, applier, m, s) {
        var busNum = m.nextAvailableBus[type];

        if (busNum === undefined) {
            flock.fail("An invalid bus type was specified when invoking " +
                "flock.enviro.acquireNextBus(). Type was: " + type);
            return;
        }

        // Input buses start immediately after the output buses.
        var offsetBusNum = busNum + s.chans,
            offsetBusMax = s.chans + s.numInputBuses;

        // Interconnect buses are after the input buses.
        if (type === "interconnect") {
            offsetBusNum += s.numInputBuses;
            offsetBusMax = buses.length;
        }

        if (offsetBusNum >= offsetBusMax) {
            flock.fail("Unable to aquire a bus. There are insufficient buses available. " +
                "Please use an existing bus or configure additional buses using the enviroment's " +
                "numBuses and numInputBuses parameters.");
            return;
        }

        applier.change("nextAvailableBus." + type, ++busNum);

        return offsetBusNum;
    };

    flock.enviro.preInit = function (that) {

        /**
         * Starts generating samples from all synths.
         */
        that.start = function () {
            if (that.model.isPlaying) {
                return;
            }

            that.audioStrategy.start();
            that.model.isPlaying = true;
        };

        /**
         * Deprecated. Use start() instead.
         */
        that.play = that.start;

        /**
         * Stops generating samples from all synths.
         */
        that.stop = function () {
            if (!that.model.isPlaying) {
                return;
            }

            that.audioStrategy.stop();
            that.model.isPlaying = false;
        };

        // TODO: This should be factored as an event.
        that.reset = function () {
            that.stop();
            that.asyncScheduler.clearAll();
            that.applier.change("nextAvailableBus.input", 0);
            that.applier.change("nextAvailableBus.interconnect", 0);
            that.audioStrategy.reset();
            that.clearAll();
        };

        that.registerBuffer = function (bufDesc) {
            if (bufDesc.id) {
                that.buffers[bufDesc.id] = bufDesc;
            }
        };

        that.releaseBuffer = function (bufDesc) {
            if (!bufDesc) {
                return;
            }

            var id = typeof bufDesc === "string" ? bufDesc : bufDesc.id;
            delete that.buffers[id];
        };
    };

    flock.enviro.finalInit = function (that) {

        that.gen = function () {
            var evaluator = that.audioStrategy.nodeEvaluator;
            evaluator.clearBuses();
            evaluator.gen();
        };

    };

    flock.enviro.createAudioBuffers = function (numBufs, blockSize) {
        var bufs = [],
            i;
        for (i = 0; i < numBufs; i++) {
            bufs[i] = new Float32Array(blockSize);
        }
        return bufs;
    };


    fluid.defaults("flock.audioStrategy", {
        gradeNames: ["fluid.standardRelayComponent"],

        components: {
            nodeEvaluator: {
                type: "flock.enviro.nodeEvaluator",
                options: {
                    numBuses: "{enviro}.options.audioSettings.numBuses",
                    blockSize: "{enviro}.options.audioSettings.blockSize",
                    members: {
                        buses: "{enviro}.buses",
                        nodes: "{enviro}.nodes"
                    }
                }
            }
        }
    });

    /*****************
     * Node Evalutor *
     *****************/

    fluid.defaults("flock.enviro.nodeEvaluator", {
        gradeNames: ["fluid.littleComponent", "autoInit"]
    });

    flock.enviro.nodeEvaluator.finalInit = function (that) {
        that.clearBuses = function () {
            var numBuses = that.options.numBuses,
                busLen = that.options.blockSize,
                i,
                bus,
                j;

            for (i = 0; i < numBuses; i++) {
                bus = that.buses[i];
                for (j = 0; j < busLen; j++) {
                    bus[j] = 0;
                }
            }
        };

        that.gen = function () {
            var nodes = that.nodes,
                i,
                node;

            for (i = 0; i < nodes.length; i++) {
                node = nodes[i];
                node.gen(node.model.blockSize);
            }
        };
    };


    fluid.defaults("flock.autoEnviro", {
        gradeNames: ["fluid.littleComponent", "autoInit"]
    });

    flock.autoEnviro.preInit = function () {
        if (!flock.enviro.shared) {
            flock.init();
        }
    };


    fluid.defaults("flock.node", {
        gradeNames: ["flock.autoEnviro", "fluid.modelComponent", "autoInit"]
    });

    fluid.defaults("flock.ugenNodeList", {
        gradeNames: ["flock.nodeList", "autoInit"]
    });

    flock.ugenNodeList.finalInit = function (that) {

        /**
         * Inserts a unit generator and all its inputs into the node list, starting at the specified index.
         * Note that the node itself will not be insert into the list at this index--its inputs must
         * must be ahead of it in the list.
         *
         * @param {Number} idx the index to start adding the new node and its inputs at
         * @param {UGen} node the node to add, along with its inputs
         * @return {Number} the index at which the specified node was inserted
         */
        that.insertTree = function (idx, node) {
            var inputs = node.inputs,
                key,
                input;

            for (key in inputs) {
                input = inputs[key];
                if (flock.isUGen(input)) {
                    idx = that.insertTree(idx, input);
                    idx++;
                }
            }

            return that.insert(idx, node);
        };

        /**
         * Removes the specified unit generator and all its inputs from the node list.
         *
         * @param {UGen} node the node to remove along with its inputs
         * @return {Number} the index at which the node was removed
         */
        that.removeTree = function (node) {
            var inputs = node.inputs,
                key,
                input;

            for (key in inputs) {
                input = inputs[key];
                if (typeof input !== "number") {
                    that.removeTree(input);
                }
            }

            return that.remove(node);
        };

        /**
         * Replaces one node and all its inputs with a new node and its inputs.
         *
         * @param {UGen} newNode the node to add to the list
         * @param {UGen} oldNode the node to remove from the list
         * @return {Number} idx the index at which the new node was added
         */
        that.replaceTree = function (newNode, oldNode) {
            if (!oldNode) {
                 // Can't use .tail() because it won't recursively add inputs.
                return that.insertTree(that.nodes.length, newNode);
            }

            var idx = that.removeTree(oldNode);
            that.insertTree(idx, newNode);

            return idx;
        };

        /**
         * Swaps one node in the list for another in place, attaching the previous unit generator's
         * inputs to the new one. If a list of inputsToReattach is specified, only these inputs will
         * be swapped.
         *
         * Note that this function will directly modify the nodes in question.
         *
         * @param {UGen} newNode the node to add to the list, swapping it in place for the old one
         * @param {UGen} oldNode the node remove from the list
         * @param {Array} inputsToReattach a list of inputNames to attach to the new node from the old one
         * @return the index at which the new node was inserted
         */
        that.swapTree = function (newNode, oldNode, inputsToReattach) {
            var inputName;

            if (!inputsToReattach) {
                newNode.inputs = oldNode.inputs;
            } else {
                for (inputName in oldNode.inputs) {
                    if (inputsToReattach.indexOf(inputName) < 0) {
                        that.removeTree(oldNode.inputs[inputName]);
                    } else {
                        newNode.inputs[inputName] = oldNode.inputs[inputName];
                    }
                }

                for (inputName in newNode.inputs) {
                    if (inputsToReattach.indexOf(inputName) < 0) {
                        that.replaceTree(newNode.inputs[inputName], oldNode.inputs[inputName]);
                    }
                }
            }

            return that.replace(newNode, oldNode);
        };
    };

    fluid.defaults("flock.synth", {
        gradeNames: [
            "fluid.eventedComponent",
            "fluid.modelComponent",
            "flock.node",
            "flock.ugenNodeList",
            "autoInit"
        ],

        rate: flock.rates.AUDIO,

        invokers: {
            /**
             * Plays the synth. This is a convenience method that will add the synth to the tail of the
             * environment's node graph and then play the environmnent.
             *
             * @param {Number} dur optional duration to play this synth in seconds
             */
            play: {
                funcName: "flock.synth.play",
                args: ["{that}", "{that}.enviro"]
            },

            /**
             * Stops the synth if it is currently playing.
             * This is a convenience method that will remove the synth from the environment's node graph.
             */
            pause: {
                funcName: "flock.synth.pause",
                args: ["{that}", "{that}.enviro"]
            }
        },

        listeners: {
            onDestroy: {
                "func": "{that}.pause"
            }
        }
    });

    flock.synth.play = function (that, en) {
        if (en.nodes.indexOf(that) === -1) {
            en.head(that);
        }

        if (!en.model.isPlaying) {
            en.play();
        }
    };

    flock.synth.pause = function (that, en) {
        en.remove(that);
    };

    /**
     * Synths represent a collection of signal-generating units, wired together to form an instrument.
     * They are created with a synthDef object, a declarative structure describing the synth's unit generator graph.
     */
    flock.synth.finalInit = function (that) {
        that.rate = that.options.rate;
        that.enviro = that.enviro || flock.enviro.shared;
        that.audioSettings = $.extend(true, {}, that.enviro.audioSettings, that.options.audioSettings);
        that.model.blockSize = that.rate === flock.rates.AUDIO ? that.audioSettings.blockSize : 1;

        /**
         * Generates one block of audio rate signal by evaluating this synth's unit generator graph.
         */
        // TODO: This function is marked as unoptimized by the Chrome profiler.
        that.gen = function () {
            var m = that.model,
                nodes = that.nodes,
                i,
                node;

            for (i = 0; i < nodes.length; i++) {
                node = nodes[i];
                if (node.gen !== undefined) {
                    node.gen(node.model.blockSize);
                }

                m.value = node.model.value;
            }
        };

        /**
         * Gets the value of the ugen at the specified path.
         *
         * @param {String} path the ugen's path within the synth graph
         * @return {Number|UGen} a scalar value in the case of a value ugen, otherwise the ugen itself
         */
        that.get = function (path) {
            return flock.input.get(that.namedNodes, path);
        };


        /**
         * Sets the value of the ugen at the specified path.
         *
         * @param {String} path the ugen's path within the synth graph
         * @param {Number || UGenDef} val a scalar value (for Value ugens) or a UGenDef object
         * @return {UGen} the newly created UGen that was set at the specified path
         */
        that.set = function (path, val, swap) {
            return flock.input.set(that.namedNodes, path, val, undefined, function (ugenDef, path, target, prev) {
                return flock.synth.ugenValueParser(that, ugenDef, prev, swap);
            });
        };

        /**
         * Gets or sets the value of a ugen at the specified path
         *
         * @param {String} path the ugen's path within the synth graph
         * @param {Number || UGenDef || Array} val an optional value to to set--a scalar value, a UGenDef object, or an array of UGenDefs
         * @param {Boolean || Object} swap specifies if the existing inputs should be swapped onto the new value
         * @return {Number || UGenDef || Array} the value that was set or retrieved
         */
        that.input = function (path, val, swap) {
            return !path ? undefined : typeof path === "string" ?
                arguments.length < 2 ? that.get(path) : that.set(path, val, swap) :
                flock.isIterable(path) ? that.get(path) : that.set(path, val, swap);
        };

        that.init = function () {
            var o = that.options,
                // At demand or schedule rates, override the rate of all non-constant ugens.
                overrideRate = o.rate === flock.rates.SCHEDULED || o.rate === flock.rates.DEMAND;

            if (!o.synthDef) {
                fluid.log(fluid.logLevel.IMPORTANT,
                    "Warning: Instantiating a flock.synth instance with an empty synth def.");
            }

            // Parse the synthDef into a graph of unit generators.
            that.out = flock.parse.synthDef(o.synthDef, {
                rate: o.rate,
                overrideRate: overrideRate,
                visitors: that.tail,
                buffers: that.enviro.buffers,
                buses: that.enviro.buses,
                audioSettings: that.audioSettings
            });

            // Add this synth to the tail of the synthesis environment if appropriate.
            if (o.addToEnvironment !== false) {
                that.enviro.tail(that);
            }
        };

        that.init();
        return that;
    };

    flock.synth.ugenValueParser = function (that, ugenDef, prev, swap) {
        if (ugenDef === null || ugenDef === undefined) {
            return prev;
        }

        var parsed = flock.parse.ugenDef(ugenDef, {
            audioSettings: that.audioSettings,
            buses: that.enviro.buses,
            buffers: that.enviro.buffers
        });

        var newUGens = flock.isIterable(parsed) ? parsed : (parsed !== undefined ? [parsed] : []),
            oldUGens = flock.isIterable(prev) ? prev : (prev !== undefined ? [prev] : []);

        var replaceLen = Math.min(newUGens.length, oldUGens.length),
            replaceFn = swap ? that.swapTree : that.replaceTree,
            i,
            atIdx,
            j;

        // TODO: Improve performance by handling arrays inline instead of repeated function calls.
        for (i = 0; i < replaceLen; i++) {
            atIdx = replaceFn(newUGens[i], oldUGens[i]);
        }

        for (j = i; j < newUGens.length; j++) {
            atIdx++;
            that.insertTree(atIdx, newUGens[j]);
        }

        for (j = i; j < oldUGens.length; j++) {
            that.removeTree(oldUGens[j]);
        }

        return parsed;
    };

    /**
     * Makes a new synth.
     * Deprecated. Use flock.synth instead. This is provided for semi-backwards-compatibility with
     * previous version of Flocking where flock.synth had a multi-argument signature.
     */
    flock.synth.make = function (def, options) {
        options = options || {};
        options.synthDef = def;
        return flock.synth(options);
    };

    fluid.defaults("flock.synth.value", {
        gradeNames: ["flock.synth", "autoInit"],

        rate: "demand",

        addToEnvironment: false
    });

    flock.synth.value.finalInit = function (that) {
        that.value = function () {
            that.gen(1);
            return that.model.value;
        };
    };


    fluid.defaults("flock.synth.frameRate", {
        gradeNames: ["flock.synth.value", "autoInit"],

        rate: "scheduled",

        fps: 60,

        audioSettings: {
            rates: {
                scheduled: "{that}.options.fps"
            }
        }
    });


    fluid.defaults("flock.synth.group", {
        gradeNames: ["fluid.eventedComponent", "flock.node", "flock.nodeList", "autoInit"],
        rate: flock.rates.AUDIO
    });

    flock.synth.group.finalInit = function (that) {
        that.rate = that.options.rate;
        that.enviro = that.enviro || flock.enviro.shared;

        flock.synth.group.makeDispatchedMethods(that, [
            "input", "get", "set", "gen", "play", "pause"
        ]);

        that.init = function () {
            if (that.options.addToEnvironment !== false) {
                that.enviro.tail(that);
            }
        };

        that.init();
    };

    flock.synth.group.makeDispatcher = function (nodes, msg) {
        return function () {
            var i,
                node,
                val;
            for (i = 0; i < nodes.length; i++) {
                node = nodes[i];
                val = node[msg].apply(node, arguments);
            }

            return val;
        };
    };

    flock.synth.group.makeDispatchedMethods = function (that, methodNames) {
        var name,
            i;

        for (i = 0; i < methodNames.length; i++) {
            name = methodNames[i];
            that[name] = flock.synth.group.makeDispatcher(that.nodes, name, flock.synth.group.dispatch);
        }

        return that;
    };


    fluid.defaults("flock.synth.polyphonic", {
        gradeNames: ["flock.synth.group", "autoInit"],
        noteSpecs: {
            on: {
                "env.gate": 1
            },
            off: {
                "env.gate": 0
            }
        },
        maxVoices: 16,
        initVoicesLazily: true,
        amplitudeKey: "env.sustain",
        amplitudeNormalizer: "static" // "dynamic", "static", Function, falsey
    });

    flock.synth.polyphonic.finalInit = function (that) {
        that.activeVoices = {};
        that.freeVoices = [];

        that.noteChange = function (voice, eventName, changeSpec) {
            var noteEventSpec = that.options.noteSpecs[eventName];
            changeSpec = $.extend({}, noteEventSpec, changeSpec);
            voice.input(changeSpec);
        };

        that.noteOn = function (noteName, changeSpec) {
            var voice = that.nextFreeVoice();
            if (that.activeVoices[noteName]) {
                that.noteOff(noteName);
            }
            that.activeVoices[noteName] = voice;
            that.noteChange(voice, "on", changeSpec);

            return voice;
        };

        that.noteOff = function (noteName, changeSpec) {
            var voice = that.activeVoices[noteName];
            if (!voice) {
                return null;
            }
            that.noteChange(voice, "off", changeSpec);
            delete that.activeVoices[noteName];
            that.freeVoices.push(voice);

            return voice;
        };

        that.createVoice = function () {
            var voice = flock.synth({
                synthDef: that.options.synthDef,
                addToEnvironment: false
            });

            var normalizer = that.options.amplitudeNormalizer,
                ampKey = that.options.amplitudeKey,
                normValue;

            if (normalizer) {
                if (typeof normalizer === "function") {
                    normalizer(voice, ampKey);
                } else if (normalizer === "static") {
                    normValue = 1.0 / that.options.maxVoices;
                    voice.input(ampKey, normValue);
                }
                // TODO: Implement dynamic voice normalization.
            }
            that.nodes.push(voice);

            return voice;
        };

        that.pooledVoiceAllocator = function () {
            return that.freeVoices.pop();
        };

        that.lazyVoiceAllocator = function () {
            return that.freeVoices.length > 1 ?
                that.freeVoices.pop() : Object.keys(that.activeVoices).length > that.options.maxVoices ?
                null : that.createVoice();
        };

        that.init = function () {
            if (!that.options.initVoicesLazily) {
                var i;
                for (i = 0; i < that.options.maxVoices; i++) {
                    that.freeVoices[i] = that.createVoice();
                }
                that.nextFreeVoice = that.pooledVoiceAllocator;
            } else {
                that.nextFreeVoice = that.lazyVoiceAllocator;
            }
        };

        that.init();
        return that;
    };

    /**
     * flock.band provides an IoC-friendly interface for a collection of named synths.
     */
    // TODO: Unit tests.
    fluid.defaults("flock.band", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],

        invokers: {
            play: {
                func: "{that}.events.onPlay.fire"
            },

            pause: {
                func: "{that}.events.onPause.fire"
            },

            set: {
                func: "{that}.events.onSet.fire"
            }
        },

        events: {
            onPlay: null,
            onPause: null,
            onSet: null
        },

        distributeOptions: {
            source: "{that}.options.synthListeners",
            removeSource: true,
            target: "{that flock.synth}.options.listeners"
        },

        synthListeners: {
            "{band}.events.onPlay": {
                func: "{that}.play"
            },

            "{band}.events.onPause": {
                func: "{that}.pause"
            }
        }
    });

    /*******************************
     * Error Handling Conveniences *
     *******************************/

    flock.bufferDesc = function () {
        throw new Error("flock.bufferDesc is not defined. Did you forget to include the flocking-buffers.js file?");
    };
}());
