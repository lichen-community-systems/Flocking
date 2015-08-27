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
            components: {
                audioSystem: {
                    options: {
                        model: options
                    }
                }
            }
        };

        var enviro = flock.enviro(enviroOpts);

        // flock.enviro.shared is deprecated. Use "flock.environment"
        // or an IoC reference to {enviro} instead
        flock.environment = flock.enviro.shared = enviro;

        return enviro;
    };

    flock.ALL_CHANNELS = 32; // TODO: This should go.
    flock.OUT_UGEN_ID = "flocking-out";

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
    flock.platform.audioEngine = flock.platform.isBrowser ? "webAudio" : "nodejs";

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
        webarraymath: "../third-party/webarraymath/js/webarraymath.js",
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
        fail: function (msg) {
            fluid.log(fluid.logLevel.FAIL, msg);
        },

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
            flock.log.fail(msg);
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
        gradeNames: ["fluid.component"],

        members: {
            nodes: [],
            namedNodes: {}
        },

        invokers: {
            insert: {
                funcName: "flock.nodeList.insert",
                // TODO: Backwards arguments?
                args: [
                    "{arguments}.0", // The index to insert it at.
                    "{arguments}.1", // The node to insert.
                    "{that}.nodes",
                    "{that}.events.onInsert.fire"
                ]
            },

            head: {
                func: "{that}.insert",
                args: [0, "{arguments}.0"]
            },

            tail: {
                funcName: "flock.nodeList.tail",
                args: ["{arguments}.0", "{that}.nodes", "{that}.insert"]
            },

            before: {
                funcName: "flock.nodeList.before",
                args: [
                    "{arguments}.0", // Reference node.
                    "{arguments}.1", // Node to add.
                    "{that}.nodes",
                    "{that}.insert"
                ]
            },

            after: {
                funcName: "flock.nodeList.after",
                args: [
                    "{arguments}.0", // Reference node.
                    "{arguments}.1", // Node to add.
                    "{that}.nodes",
                    "{that}.insert"
                ]
            },

            remove: {
                funcName: "flock.nodeList.remove",
                args: [
                    "{arguments}.0", // Node to remove.
                    "{that}.nodes",
                    "{that}.events.onRemove.fire"
                ]
            },

            replace: {
                funcName: "flock.nodeList.replace",
                args: [
                    // TODO: Backwards arguments?
                    "{arguments}.0", // New node.
                    "{arguments}.1", // Old node.
                    "{that}.nodes",
                    "{that}.head",
                    "{that}.events.onRemove.fire",
                    "{that}.events.onInsert.fire"
                ]
            },

            clearAll: {
                func: "{that}.events.onClearAll.fire"
            }
        },

        events: {
            onInsert: null,
            onRemove: null,
            onClearAll: null
        },

        listeners: {
            onClearAll: [
                {
                    func: "fluid.clear",
                    args: "{that}.nodes"
                },
                {
                    func: "fluid.clear",
                    args: "{that}.namedNodes"
                }
            ],

            onInsert: {
                funcName: "flock.nodeList.registerNode",
                args: ["{arguments}.0", "{that}.namedNodes"]
            },

            onRemove: {
                funcName: "flock.nodeList.unregisterNode",
                args: ["{arguments}.0", "{that}.namedNodes"]
            }
        }
    });

    flock.nodeList.insert = function (idx, node, nodes, onInsert) {
        if (idx < 0) {
            idx = 0;
        }

        nodes.splice(idx, 0, node);
        onInsert(node, idx);

        return idx;
    };

    flock.nodeList.registerNode = function (node, namedNodes) {
        if (!node.nickName) {
            return;
        }

        namedNodes[node.nickName] = node;
    };

    flock.nodeList.before = function (refNode, node, nodes, insertFn) {
        var refIdx = nodes.indexOf(refNode);
        return insertFn(refIdx, node);
    };

    flock.nodeList.after = function (refNode, node, nodes, insertFn) {
        var refIdx = nodes.indexOf(refNode),
            atIdx = refIdx + 1;

        return insertFn(atIdx, node);
    };

    flock.nodeList.tail = function (node, nodes, insertFn) {
        var idx = nodes.length;
        return insertFn(idx, node);
    };

    flock.nodeList.remove = function (node, nodes, onRemove) {
        var idx = nodes.indexOf(node);
        if (idx > -1) {
            nodes.splice(idx, 1);
            onRemove(node);
        }

        return idx;
    };

    flock.nodeList.unregisterNode = function (node, namedNodes) {
        delete namedNodes[node.nickName];
    };

    flock.nodeList.replace = function (newNode, oldNode, nodes, notFoundFn, onRemove, onInsert) {
        var idx = nodes.indexOf(oldNode);
        if (idx < 0) {
            return notFoundFn(newNode);
        }

        nodes[idx] = newNode;
        onRemove(oldNode);
        onInsert(newNode);

        return idx;
    };


    /***********************
     * Synths and Playback *
     ***********************/

    fluid.defaults("flock.audioSystem", {
        gradeNames: ["fluid.modelComponent"],

        channelRange: {
            min: 1,
            max: 32
        },

        outputBusRange: {
            min: 2,
            max: 1024
        },

        inputBusRange: {
            min: 1, // TODO: This constraint should be removed.
            max: 32
        },

        model: {
            rates: {
                audio: 44100,
                control: 689.0625,
                scheduled: 0,
                demand: 0,
                constant: 0
            },
            blockSize: 64,
            numBlocks: 16,
            chans: 2,
            numInputBuses: 2,
            numBuses: 8,
            bufferSize: "@expand:flock.audioSystem.defaultBufferSize()"
        },

        modelRelay: [
            {
                target: "rates.control",
                singleTransform: {
                    type: "fluid.transforms.binaryOp",
                    left: "{that}.model.rates.audio",
                    operator: "/",
                    right: "{that}.model.blockSize"
                }
            },
            {
                target: "numBlocks",
                singleTransform: {
                    type: "fluid.transforms.binaryOp",
                    left: "{that}.model.bufferSize",
                    operator: "/",
                    right: "{that}.model.blockSize"
                }
            },
            {
                target: "chans",
                singleTransform: {
                    type: "fluid.transforms.limitRange",
                    input: "{that}.model.chans",
                    min: "{that}.options.channelRange.min",
                    max: "{that}.options.channelRange.max"
                }
            },
            {
                target: "numInputBuses",
                singleTransform: {
                    type: "fluid.transforms.limitRange",
                    input: "{that}.model.numInputBuses",
                    min: "{that}.options.inputBusRange.min",
                    max: "{that}.options.inputBusRange.max"
                }
            },
            {
                target: "numBuses",
                singleTransform: {
                    type: "fluid.transforms.free",
                    func: "flock.audioSystem.clampNumBuses",
                    args: ["{that}.model.numBuses", "{that}.options.outputBusRange", "{that}.model.chans"]
                }
            }
        ]
    });

    flock.audioSystem.clampNumBuses = function (numBuses, outputBusRange, chans) {
        numBuses = Math.max(numBuses, Math.max(chans, outputBusRange.min));
        numBuses = Math.min(numBuses, outputBusRange.max);

        return numBuses;
    };

    flock.audioSystem.defaultBufferSize = function () {
        return flock.platform.isMobile ? 8192 :
            flock.platform.browser.mozilla ? 2048 : 1024;
    };


    /*****************
     * Node Evalutor *
     *****************/

    fluid.defaults("flock.nodeEvaluator", {
        gradeNames: ["fluid.modelComponent"],

        model: "{audioSystem}.model",

        members: {
            nodes: "{enviro}.nodes",
            buses: "{busManager}.buses"
        },

        invokers: {
            gen: {
                funcName: "flock.nodeEvaluator.gen",
                args: ["{that}.nodes"]
            },

            clearBuses: {
                funcName: "flock.nodeEvaluator.clearBuses",
                args: [
                    "{that}.model.numBuses",
                    "{that}.model.blockSize",
                    "{that}.buses"
                ]
            }
        }
    });

    flock.nodeEvaluator.gen = function (nodes) {
        var i,
            node;

        // Now evaluate each node.
        for (i = 0; i < nodes.length; i++) {
            node = nodes[i];
            node.genFn(node);
        }
    };


    flock.nodeEvaluator.clearBuses = function (numBuses, busLen, buses) {
        for (var i = 0; i < numBuses; i++) {
            var bus = buses[i];
            for (var j = 0; j < busLen; j++) {
                bus[j] = 0;
            }
        }
    };


    fluid.defaults("flock.audioStrategy", {
        gradeNames: ["fluid.modelComponent"],

        components: {
            nodeEvaluator: {
                type: "flock.nodeEvaluator"
            }
        },

        invokers: {
            reset: {
                func: "{that}.events.onReset.fire"
            }
        },

        events: {
            onStart: "{enviro}.events.onStart",
            onStop: "{enviro}.events.onStop",
            onReset: "{enviro}.events.onReset"
        }
    });

    // TODO: Refactor how buses work so that they're clearly
    // delineated into types--input, output, and interconnect.
    // TODO: Get rid of the concept of buses altogether.
    fluid.defaults("flock.busManager", {
        gradeNames: ["fluid.modelComponent"],

        model: {
            nextAvailableBus: {
                input: 0,
                interconnect: 0
            }
        },

        members: {
            buses: {
                expander: {
                    funcName: "flock.enviro.createAudioBuffers",
                    args: ["{audioSystem}.model.numBuses", "{audioSystem}.model.blockSize"]
                }
            }
        },

        invokers: {
            acquireNextBus: {
                funcName: "flock.busManager.acquireNextBus",
                args: [
                    "{arguments}.0", // The type of bus, either "input" or "interconnect".
                    "{that}.buses",
                    "{that}.applier",
                    "{that}.model",
                    "{audioSystem}.model.chans",
                    "{audioSystem}.model.numInputBuses"
                ]
            }
        }
    });

    flock.busManager.acquireNextBus = function (type, buses, applier, m, chans, numInputBuses) {
        var busNum = m.nextAvailableBus[type];

        if (busNum === undefined) {
            flock.fail("An invalid bus type was specified when invoking " +
                "flock.busManager.acquireNextBus(). Type was: " + type);
            return;
        }

        // Input buses start immediately after the output buses.
        var offsetBusNum = busNum + chans,
            offsetBusMax = chans + numInputBuses;

        // Interconnect buses are after the input buses.
        if (type === "interconnect") {
            offsetBusNum += numInputBuses;
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


    fluid.defaults("flock.enviro", {
        gradeNames: [
            "flock.nodeList",
            "fluid.modelComponent",
            "fluid.resolveRootSingle"
        ],

        singleRootType: "flock.enviro",

        members: {
            buffers: {},
            bufferSources: {}
        },

        components: {
            asyncScheduler: {
                type: "flock.scheduler.async"
            },

            audioSystem: {
                type: "flock.webAudio.audioSystem" // TODO: Make polymorphic again!
            },

            audioStrategy: {
                type: "flock.audioStrategy.web", // TODO: Also needs to be repolymorphosed.
                options: {
                    audioSettings: "{audioSystem}.model"
                }
            },

            busManager: {
                type: "flock.busManager"
            }
        },

        model: {
            isPlaying: false
        },

        invokers: {
            /**
             * Generates a block of samples by evaluating all registered nodes.
             */
            gen: "flock.enviro.gen({audioStrategy}.nodeEvaluator)",

            /**
             * Starts generating samples from all synths.
             *
             * @param {Number} dur optional duration to play in seconds
             */
            start: "flock.enviro.start({that}.model, {that}.events.onStart.fire)",

            /**
             * Deprecated. Use start() instead.
             */
            play: "{that}.start",

            /**
             * Stops generating samples.
             */
            stop: "flock.enviro.stop({that}.model, {that}.events.onStop.fire)",


            /**
             * Fully resets the state of the environment.
             */
            reset: "{that}.events.onReset.fire()",

            /**
             * Registers a shared buffer.
             *
             * @param {BufferDesc} bufDesc the buffer description object to register
             */
            registerBuffer: "flock.enviro.registerBuffer({arguments}.0, {that}.buffers)",

            /**
             * Releases a shared buffer.
             *
             * @param {String|BufferDesc} bufDesc the buffer description (or string id) to release
             */
            releaseBuffer: "flock.enviro.releaseBuffer({arguments}.0, {that}.buffers)",

            /**
             * Saves a buffer to the user's computer.
             *
             * @param {String|BufferDesc} id the id of the buffer to save
             * @param {String} path the path to save the buffer to (if relevant)
             */
            saveBuffer: {
                funcName: "flock.enviro.saveBuffer",
                args: [
                    "{arguments}.0",
                    "{that}.buffers",
                    "{audioStrategy}"
                ]
            }
        },

        events: {
            onStart: null,
            onPlay: "{that}.events.onStart", // Deprecated. Use onStart instead.
            onStop: null,
            onReset: null
        },

        listeners: {
            onStart: [
                "{that}.applier.change(isPlaying, true)",
            ],

            onStop: [
                "{that}.applier.change(isPlaying, false)"
            ],

            onReset: [
                "{that}.stop()",
                "{asyncScheduler}.clearAll()",
                {
                    func: "{that}.applier.change",
                    args: ["nextAvailableBus.input", []]
                },
                {
                    func: "{that}.applier.change",
                    args: ["nextAvailableBus.interconnect", []]
                },
                "{that}.clearAll()"
            ]
        }
    });

    flock.enviro.registerBuffer = function (bufDesc, buffers) {
        if (bufDesc.id) {
            buffers[bufDesc.id] = bufDesc;
        }
    };

    flock.enviro.releaseBuffer = function (bufDesc, buffers) {
        if (!bufDesc) {
            return;
        }

        var id = typeof bufDesc === "string" ? bufDesc : bufDesc.id;
        delete buffers[id];
    };

    flock.enviro.saveBuffer = function (o, buffers, audioStrategy) {
        if (typeof o === "string") {
            o = {
                buffer: o
            };
        }

        if (typeof o.buffer === "string") {
            var id = o.buffer;
            o.buffer = buffers[id];
            o.buffer.id = id;
        }

        o.type = o.type || "wav";
        o.path = o.path || o.buffer.id + "." + o.type;
        o.format = o.format || "int16";

        return audioStrategy.saveBuffer(o, o.buffer);
    };

    flock.enviro.gen = function (nodeEvaluator) {
        nodeEvaluator.clearBuses();
        nodeEvaluator.gen();
    };

    flock.enviro.start = function (model, onStart) {
        if (!model.isPlaying) {
            onStart();
        }
    };

    flock.enviro.stop = function (model, onStop) {
        if (model.isPlaying) {
            onStop();
        }
    };

    flock.enviro.createAudioBuffers = function (numBufs, blockSize) {
        var bufs = [],
            i;
        for (i = 0; i < numBufs; i++) {
            bufs[i] = new Float32Array(blockSize);
        }
        return bufs;
    };


    fluid.defaults("flock.autoEnviro", {
        gradeNames: ["fluid.component"],

        members: {
            enviro: "@expand:flock.autoEnviro.initEnvironment()"
        }
    });

    flock.autoEnviro.initEnvironment = function () {
        if (!flock.environment) {
            flock.init();
        }

        return flock.environment;
    };

    fluid.defaults("flock.node", {
        gradeNames: ["flock.autoEnviro", "fluid.modelComponent"],
        model: {}
    });

    fluid.defaults("flock.ugenNodeList", {
        gradeNames: ["flock.nodeList"],

        invokers: {
            /**
             * Inserts a unit generator and all its inputs into the node list,
             * starting at the specified index.
             *
             * Note that the node itself will not be inserted into the list at this index;
             * its inputs must must be ahead of it in the list.
             *
             * @param {Number} idx the index to start adding the new node and its inputs at
             * @param {UGen} node the node to add, along with its inputs
             * @return {Number} the index at which the specified node was inserted
             */
            insertTree: {
                funcName: "flock.ugenNodeList.insertTree",
                args: [
                    "{arguments}.0", // The index at whcih to add the new node.
                    "{arguments}.1", // The node to add.
                    "{that}.insert"
                ]
            },

            /**
             * Removes the specified unit generator and all its inputs from the node list.
             *
             * @param {UGen} node the node to remove along with its inputs
             * @return {Number} the index at which the node was removed
             */
            removeTree: {
                funcName: "flock.ugenNodeList.removeTree",
                args: [
                    "{arguments}.0", // The node to remove.
                    "{that}.remove"
                ]
            },

            /**
             * Replaces one node and all its inputs with a new node and its inputs.
             *
             * @param {UGen} newNode the node to add to the list
             * @param {UGen} oldNode the node to remove from the list
             * @return {Number} idx the index at which the new node was added
             */
            //flock.ugenNodeList.replaceTree = function (newNode, oldNode, insertFn, removeFn) {
            replaceTree: {
                funcName: "flock.ugenNodeList.replaceTree",
                args: [
                    "{arguments}.0", // The node to add.
                    "{arguments}.1", // The node to replace.
                    "{that}.nodes",
                    "{that}.insert",
                    "{that}.remove"
                ]
            },

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
            //flock.ugenNodeList.swapTree = function (newNode, oldNode, inputsToReattach, removeFn, replaceTreeFn, replaceFn) {

            swapTree: {
                funcName: "flock.ugenNodeList.swapTree",
                args: [
                    "{arguments}.0", // The node to add.
                    "{arguments}.1", // The node to replace.
                    "{arguments}.2", // A list of inputs to attach to the new node from the old.
                    "{that}.remove",
                    "{that}.replaceTree",
                    "{that}.replace"
                ]
            }
        }
    });

    flock.ugenNodeList.insertTree = function (idx, node, insertFn) {
        var inputs = node.inputs,
            key,
            input;

        for (key in inputs) {
            input = inputs[key];
            if (flock.isUGen(input)) {
                idx = flock.ugenNodeList.insertTree(idx, input, insertFn);
                idx++;
            }
        }

        return insertFn(idx, node);
    };

    flock.ugenNodeList.removeTree = function (node, removeFn) {
        var inputs = node.inputs,
            key,
            input;

        for (key in inputs) {
            input = inputs[key];
            if (flock.isUGen(input)) {
                flock.ugenNodeList.removeTree(input, removeFn);
            }
        }

        return removeFn(node);
    };

    flock.ugenNodeList.replaceTree = function (newNode, oldNode, nodes, insertFn, removeFn) {
        if (!oldNode) {
             // Can't use .tail() because it won't recursively add inputs.
            return flock.ugenNodeList.insertTree(nodes.length, newNode, insertFn);
        }

        var idx = flock.ugenNodeList.removeTree(oldNode, removeFn);
        flock.ugenNodeList.insertTree(idx, newNode, insertFn);

        return idx;
    };

    flock.ugenNodeList.swapTree = function (newNode, oldNode, inputsToReattach, removeFn, replaceTreeFn, replaceFn) {
        if (!inputsToReattach) {
            newNode.inputs = oldNode.inputs;
        } else {
            flock.ugenNodeList.reattachInputs(newNode, oldNode, inputsToReattach, removeFn);
            flock.ugenNodeList.replaceInputs(newNode, oldNode, inputsToReattach, replaceTreeFn);
        }

        return replaceFn(newNode, oldNode);
    };

    flock.ugenNodeList.reattachInputs = function (newNode, oldNode, inputsToReattach, removeFn) {
        for (var inputName in oldNode.inputs) {
            if (inputsToReattach.indexOf(inputName) < 0) {
                flock.ugenNodeList.removeTree(oldNode.inputs[inputName], removeFn);
            } else {
                newNode.inputs[inputName] = oldNode.inputs[inputName];
            }
        }
    };

    flock.ugenNodeList.replaceInputs = function (newNode, oldNode, inputsToReattach, replaceTreeFn) {
        for (var inputName in newNode.inputs) {
            if (inputsToReattach.indexOf(inputName) < 0) {
                replaceTreeFn(
                    newNode.inputs[inputName],
                    oldNode.inputs[inputName]
                );
            }
        }
    };


    /**
     * Synths represent a collection of signal-generating units,
     * wired together to form an instrument.
     * They are created with a synthDef object, which is a declarative structure
     * that describes the synth's unit generator graph.
     */
    fluid.defaults("flock.synth", {
        gradeNames: ["flock.node", "flock.ugenNodeList"],

        addToEnvironment: "tail",
        rate: flock.rates.AUDIO,

        members: {
            rate: "{that}.options.rate",
            audioSettings: "{enviro}.audioSystem.model", // TODO: Move this.
            out: {
                expander: {
                    funcName: "flock.synth.parseSynthDef",
                    args: [
                        "{that}.options.synthDef",
                        "{that}.rate",
                        "{enviro}.audioSystem.model",
                        "{that}.enviro.buffers",
                        "{that}.enviro.busManager.buses",
                        "{that}.tail"
                    ]
                }
            },

            genFn: "@expand:fluid.getGlobalValue({that}.options.invokers.gen.funcName)"
        },

        components: {
            enviro: "{environment}"
        },

        model: {
            blockSize: "@expand:flock.synth.calcBlockSize({that}.rate, {enviro}.audioSystem.model)"
        },

        invokers: {
            /**
             * Plays the synth. This is a convenience method that will add the synth to the tail of the
             * environment's node graph and then play the environmnent.
             *
             * @param {Number} dur optional duration to play this synth in seconds
             */
            play: {
                funcName: "flock.synth.play",
                args: ["{that}", "{that}.enviro", "{that}.addToEnvironment"]
            },

            /**
             * Stops the synth if it is currently playing.
             * This is a convenience method that will remove the synth from the environment's node graph.
             */
            pause: {
                funcName: "flock.synth.pause",
                args: ["{that}", "{that}.enviro"]
            },

            /**
             * Sets the value of the ugen at the specified path.
             *
             * @param {String} path the ugen's path within the synth graph
             * @param {Number || UGenDef} val a scalar value (for Value ugens) or a UGenDef object
             * @param {Boolean} swap ??
             * @return {UGen} the newly created UGen that was set at the specified path
             */
            set: {
                funcName: "flock.synth.set",
                args: ["{that}", "{that}.namedNodes", "{arguments}.0", "{arguments}.1", "{arguments}.2"]
            },

            /**
             * Gets the value of the ugen at the specified path.
             *
             * @param {String} path the ugen's path within the synth graph
             * @return {Number|UGen} a scalar value in the case of a value ugen, otherwise the ugen itself
             */
            get: {
                funcName: "flock.input.get",
                args: ["{that}.namedNodes", "{arguments}.0"]
            },

            /**
             * Deprecated.
             *
             * Gets or sets the value of a ugen at the specified path
             *
             * @param {String} path the ugen's path within the synth graph
             * @param {Number || UGenDef || Array} val an optional value to to set--a scalar value, a UGenDef object, or an array of UGenDefs
             * @param {Boolean || Object} swap specifies if the existing inputs should be swapped onto the new value
             * @return {Number || UGenDef || Array} the value that was set or retrieved
             */
            input: {
                funcName: "flock.synth.input",
                args: [
                    "{arguments}",
                    "{that}.get",
                    "{that}.set"
                ]
            },

            /**
             * Generates one block of audio rate signal by evaluating this synth's unit generator graph.
             */
            gen: {
                funcName: "flock.synth.gen",
                args: "{that}"
            },

            /**
             * Adds the synth to its environment's list of active nodes.
             *
             * @param {String || Boolean || Number} position the place to insert the node at;
             *     if undefined, the synth's addToEnvironment option will be used.
             */
            addToEnvironment: {
                funcName: "flock.synth.addToEnvironment",
                args: ["{that}", "{arguments}.0", "{that}.options", "{that}.enviro"]
            }
        },

        listeners: {
            onCreate: {
                funcName: "flock.synth.addToEnvironment",
                args: ["{that}", undefined, "{that}.options", "{that}.enviro"]
            },

            onDestroy: {
                "func": "{that}.pause"
            }
        }
    });

    flock.synth.calcBlockSize = function (rate, audioSettings) {
        return rate === flock.rates.AUDIO ? audioSettings.blockSize : 1;
    };

    flock.synth.parseSynthDef = function (synthDef, rate, audioSettings, buffers, buses, tailFn) {
        if (!synthDef) {
            fluid.log(fluid.logLevel.IMPORTANT,
                "Warning: Instantiating a flock.synth instance with an empty synth def.");
        }

        // At demand or schedule rates, override the rate of all non-constant ugens.
        var overrideRate = rate === flock.rates.SCHEDULED || rate === flock.rates.DEMAND;

        // Parse the synthDef into a graph of unit generators.
        return flock.parse.synthDef(synthDef, {
            rate: rate,
            overrideRate: overrideRate,
            visitors: tailFn,
            buffers: buffers,
            buses: buses,
            audioSettings: audioSettings
        });
    };

    flock.synth.play = function (synth, enviro, addToEnviroFn) {
        if (enviro.nodes.indexOf(synth) === -1) {
            var position = synth.options.addToEnvironment || "tail";
            addToEnviroFn(position);
        }

        // TODO: This behaviour is confusing
        // since calling mySynth.play() will cause
        // all synths in the environment to be played.
        // This functionality should be removed.
        if (!enviro.model.isPlaying) {
            enviro.play();
        }
    };

    flock.synth.pause = function (synth, enviro) {
        enviro.remove(synth);
    };

    flock.synth.set = function (that, namedNodes, path, val, swap) {
        return flock.input.set(namedNodes, path, val, undefined, function (ugenDef, path, target, prev) {
            return flock.synth.ugenValueParser(that, ugenDef, prev, swap);
        });
    };

    flock.synth.gen = function (that) {
        var nodes = that.nodes,
            m = that.model,
            i,
            node;

        for (i = 0; i < nodes.length; i++) {
            node = nodes[i];
            if (node.gen !== undefined) {
                node.gen(node.model.blockSize); // TODO: De-thatify.
            }

            m.value = node.model.value;
        }
    };

    flock.synth.input = function (args, getFn, setFn) {
        //path, val, swap
        var path = args[0];

        return !path ? undefined : typeof path === "string" ?
            args.length < 2 ? getFn(path) : setFn.apply(null, args) :
            flock.isIterable(path) ? getFn(path) : setFn.apply(null, args);
    };

    flock.synth.addToEnvironment = function (synth, position, options, enviro) {
        if (position === undefined) {
            position = options.addToEnvironment;
        }

        // Add this synth to the tail of the synthesis environment if appropriate.
        if (position === undefined || position === null || position === false) {
            return;
        }

        var type = typeof (position);
        if (type === "string" && position === "head" || position === "tail") {
            enviro[position](synth);
        } else if (type === "number") {
            enviro.insert(position, synth);
        } else {
            enviro.tail(synth);
        }
    };

    // TODO: Reduce all these dependencies on "that" (i.e. a synth instance).
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


    fluid.defaults("flock.synth.value", {
        gradeNames: ["flock.synth"],

        rate: "demand",

        addToEnvironment: false,

        invokers: {
            value: {
                funcName: "flock.synth.value.genValue",
                args: ["{that}.model", "{that}.gen"]
            }
        }
    });

    flock.synth.value.genValue = function (m, genFn) {
        genFn(1);
        return m.value;
    };


    fluid.defaults("flock.synth.frameRate", {
        gradeNames: ["flock.synth.value"],

        rate: "scheduled",

        fps: 60,

        audioSettings: {
            rates: {
                scheduled: "{that}.options.fps"
            }
        }
    });


    // TODO: At the moment, flock.synth.group attempts to act as a proxy for
    // a collection of synths, allowing users to address it as if it were
    // a single synth. However, it does nothing to ensure that its contained synths
    // are managed properly with the environment. There's currently no way to ensure that
    // when a group is removed from the environment, all its synths are too.
    // This should be completely refactored in favour of an approach using dynamic components.
    fluid.defaults("flock.synth.group", {
        gradeNames: ["flock.synth"],

        members: {
            out: null,
        },

        methodEventMap: {
            "onSet": "set",
            "onGen": "gen",
            "onPlay": "play",
            "onPause": "pause"
        },

        invokers: {
            play: "{that}.events.onPlay.fire",
            pause: "{that}.events.onPause.fire",
            set: "{that}.events.onSet.fire",
            get: "flock.synth.group.get({arguments}, {that}.nodes)",
            input: {
                funcName: "flock.synth.group.input",
                args: ["{arguments}", "{that}.get", "{that}.events.onSet.fire"]
            },
            gen: {
                funcName: "flock.synth.group.gen",
                args: "{that}"
            }
        },

        events: {
            onSet: null,
            onGen: null,
            onPlay: null,
            onPause: null
        },

        listeners: {
            onInsert: [
                {
                    funcName: "flock.synth.group.bindMethods",
                    args: [
                        "{arguments}.0", // The newly added node.
                        "{that}.options.methodEventMap",
                        "{that}.events",
                        "addListener"
                    ]
                },

                // Brute force and unreliable way of ensuring that
                // children of a group don't get directly added to the environment.
                {
                    funcName: "flock.synth.pause",
                    args: ["{arguments}.0", "{that}.enviro"]
                }
            ],

            onRemove: {
                funcName: "flock.synth.group.bindMethods",
                args: [
                    "{arguments}.0", // The removed node.
                    "{that}.options.methodEventMap",
                    "{that}.events",
                    "removeListener"
                ]
            }
        }
    });

    flock.synth.group.gen = function (that) {
        flock.nodeEvaluator.gen(that.nodes);
    };

    flock.synth.group.get = function (args, nodes) {
        var tailIdx = nodes.length - 1,
            tailNode = nodes[tailIdx];

        return tailNode.get.apply(tailNode, args);
    };

    flock.synth.group.input = function (args, onGet, onSet) {
        var evt = args.length > 1 ? onSet : onGet;
        return evt.apply(null, args);
    };

    flock.synth.group.bindMethods = function (node, methodEventMap, events, eventActionName) {
        for (var eventName in methodEventMap) {
            var methodName = methodEventMap[eventName],
                method = node[methodName],
                firer = events[eventName],
                eventAction = firer[eventActionName];

            eventAction(method);
        }
    };

    fluid.defaults("flock.synth.polyphonic", {
        gradeNames: ["flock.synth.group"],

        maxVoices: 16,
        amplitudeNormalizer: "static", // "dynamic", "static", Function, falsey
        amplitudeKey: "env.sustain",

        noteSpecs: {
            on: {
                "env.gate": 1
            },
            off: {
                "env.gate": 0
            }
        },

        components: {
            voiceAllocator: {
                type: "flock.synth.voiceAllocator.lazy",
                options: {
                    // TODO: Replace these with distributeOptions.
                    synthDef: "{polyphonic}.options.synthDef",
                    maxVoices: "{polyphonic}.options.maxVoices",
                    amplitudeNormalizer: "{polyphonic}.options.amplitudeNormalizer",
                    amplitudeKey: "{polyphonic}.options.amplitudeKey",

                    listeners: {
                        onCreateVoice: "{polyphonic}.tail({arguments}.0)"
                    }
                }
            }
        },

        invokers: {
            noteChange: {
                funcName: "flock.synth.polyphonic.noteChange",
                args: [
                    "{arguments}.0", // The voice synth to change.
                    "{arguments}.1", // The note event name (i.e. "on" or "off").
                    "{arguments}.2", // The note change spec to apply.
                    "{that}.options.noteSpecs"
                ]
            },

            noteOn: {
                funcName: "flock.synth.polyphonic.noteOn",
                args: [
                    "{arguments}.0", // Note name.
                    "{arguments}.1", // Optional changeSpec
                    "{voiceAllocator}",
                    "{that}.noteOff",
                    "{that}.noteChange"
                ]
            },

            noteOff: {
                funcName: "flock.synth.polyphonic.noteOff",
                args: [
                    "{arguments}.0", // Note name.
                    "{arguments}.1", // Optional changeSpec
                    "{voiceAllocator}",
                    "{that}.noteChange"
                ]
            },

            createVoice: {
                func: "{voiceAllocator}.createVoice",
                args: ["{that}.options", "{that}.insert"]
            }
        }
    });

    flock.synth.polyphonic.noteChange = function (voice, eventName, changeSpec, noteSpecs) {
        var noteEventSpec = noteSpecs[eventName];
        changeSpec = $.extend({}, noteEventSpec, changeSpec);
        voice.input(changeSpec);
    };

    flock.synth.polyphonic.noteOn = function (noteName, changeSpec, voiceAllocator, noteOff, noteChange) {
        var voice = voiceAllocator.getFreeVoice();
        if (voiceAllocator.activeVoices[noteName]) {
            noteOff(noteName);
        }
        voiceAllocator.activeVoices[noteName] = voice;
        noteChange(voice, "on", changeSpec);

        return voice;
    };

    flock.synth.polyphonic.noteOff = function (noteName, changeSpec, voiceAllocator, noteChange) {
        var voice = voiceAllocator.activeVoices[noteName];
        if (!voice) {
            return null;
        }
        noteChange(voice, "off", changeSpec);
        delete voiceAllocator.activeVoices[noteName];
        voiceAllocator.freeVoices.push(voice);

        return voice;
    };

    fluid.defaults("flock.synth.voiceAllocator", {
        gradeNames: ["fluid.component"],

        maxVoices: 16,
        amplitudeNormalizer: "static", // "dynamic", "static", Function, falsey
        amplitudeKey: "env.sustain",

        members: {
            activeVoices: {},
            freeVoices: []
        },

        invokers: {
            createVoice: {
                funcName: "flock.synth.voiceAllocator.createVoice",
                args: ["{that}.options", "{that}.events.onCreateVoice.fire"]
            }
        },

        events: {
            onCreateVoice: null
        }
    });


    flock.synth.voiceAllocator.createVoice = function (options, onCreateVoice) {
        var voice = flock.synth({
            synthDef: options.synthDef,
            addToEnvironment: false
        });

        var normalizer = options.amplitudeNormalizer,
            ampKey = options.amplitudeKey,
            normValue;

        if (normalizer) {
            if (typeof normalizer === "function") {
                normalizer(voice, ampKey);
            } else if (normalizer === "static") {
                normValue = 1.0 / options.maxVoices;
                voice.input(ampKey, normValue);
            }
            // TODO: Implement dynamic voice normalization.
        }

        onCreateVoice(voice);

        return voice;
    };

    fluid.defaults("flock.synth.voiceAllocator.lazy", {
        gradeNames: ["flock.synth.voiceAllocator"],

        invokers: {
            getFreeVoice: {
                funcName: "flock.synth.voiceAllocator.lazy.get",
                args: [
                    "{that}.freeVoices",
                    "{that}.activeVoices",
                    "{that}.createVoice",
                    "{that}.options.maxVoices"
                ]
            }
        }
    });

    flock.synth.voiceAllocator.lazy.get = function (freeVoices, activeVoices, createVoiceFn, maxVoices) {
        return freeVoices.length > 1 ?
            freeVoices.pop() : Object.keys(activeVoices).length > maxVoices ?
            null : createVoiceFn();
    };

    fluid.defaults("flock.synth.voiceAllocator.pool", {
        gradeNames: ["flock.synth.voiceAllocator"],

        invokers: {
            getFreeVoice: "flock.synth.voiceAllocator.pool.get({that}.freeVoices)"
        }
    });

    flock.synth.voiceAllocator.pool.get = function (freeVoices) {
        if (freeVoices.length > 0) {
            return freeVoices.pop();
        }
    };

    flock.synth.voiceAllocator.pool.allocateVoices = function (freeVoices, createVoiceFn, maxVoices) {
        for (var i = 0; i < maxVoices; i++) {
            freeVoices[i] = createVoiceFn();
        }

    };


    /**
     * flock.band provides an IoC-friendly interface for a collection of named synths.
     */
    // TODO: Unit tests.
    fluid.defaults("flock.band", {
        gradeNames: ["fluid.component"],

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

        distributeOptions: [
            {
                source: "{that}.options.childListeners",
                removeSource: true,
                target: "{that fluid.component}.options.listeners"
            },
            {
                source: "{that}.options.synthListeners",
                removeSource: true,
                target: "{that flock.synth}.options.listeners"
            }
        ],

        childListeners: {
            "{band}.events.onDestroy": {
                func: "{that}.destroy"
            }
        },

        synthListeners: {
            "{band}.events.onPlay": {
                func: "{that}.play"
            },

            "{band}.events.onPause": {
                func: "{that}.pause"
            },

            "{band}.events.onSet": {
                func: "{that}.set"
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
