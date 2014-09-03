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
        flock.enviro.shared = flock.enviro(enviroOpts);
    };

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
        if (flock.platform.browser.mozilla) {
            // Strangely terrible performance seems to have cropped up on Firefox in recent versions.
            return 16384;
        }

        if (flock.platform.isMobile) {
            return 8192;
        }

        return 1024;
    };

    flock.shim = {
        URL: flock.platform.isBrowser ? (window.URL || window.webkitURL || window.msURL) : undefined
    };

    flock.requireModule = function (globalName, moduleName) {
        if (!moduleName) {
            moduleName = globalName;
        }
        return flock.platform.isBrowser ? window[globalName] :
            (flock.platform.hasRequire ? require(moduleName)[globalName] : undefined);
    };

    /*************
     * Utilities *
     *************/

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

    flock.interpolate = {};

    /**
     * Performs linear interpretation.
     */
    flock.interpolate.linear = function (idx, table) {
        var len = table.length;
        if (len < 1) {
            return 0;
        }

        idx = idx % len;

        var i1 = idx | 0,
            i2 = (i1 + 1) % len,
            frac = idx - i1,
            y1 = table[i1],
            y2 = table[i2];

        return y1 + frac * (y2 - y1);
    };

    /**
     * Performs cubic interpretation.
     *
     * Based on Laurent De Soras' implementation at:
     * http://www.musicdsp.org/showArchiveComment.php?ArchiveID=93
     *
     * @param idx {Number} an index into the table
     * @param table {Arrayable} the table from which values around idx should be drawn and interpolated
     * @return {Number} an interpolated value
     */
    flock.interpolate.cubic = function (idx, table) {
        var len = table.length;

        if (len < 1) {
            return 0;
        }

        var intPortion = Math.floor(idx),
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
    };

    flock.fail = function (msg) {
        if (flock.debug.failHard) {
            throw new Error(msg);
        } else {
            fluid.log(fluid.logLevel.FAIL, msg);
        }
    };

    flock.pathParseError = function (root, path, token) {
        var msg = "Error parsing path: " + path + ". Segment '" + token +
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
                flock.fail("Error while setting a value at path + " + path +
                    ". A non-container object was found at segment " + prop + ". Value: " + root);

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

    flock.input.shouldExpand = function (inputName, target) {
        var specialInputs = flock.parse.specialInputs;
        if (target && target.options && target.options.noExpand) {
            specialInputs = specialInputs.concat(target.options.noExpand);
        }

        return specialInputs.indexOf(inputName) < 0;
    };

    flock.input.pathExpander = function (path) {
        return path.replace(/\.(?![0-9])/g, ".inputs.");
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
        return flock.hasTag(input, "flock.ugen.valueType") ? input.model.value : input;
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

    flock.input.setValueForPath = function (root, path, val, baseTarget, valueParser) {
        path = flock.input.expandPath(path);

        var previousInput = flock.get(root, path),
            lastDotIdx = path.lastIndexOf("."),
            inputName = path.slice(lastDotIdx + 1),
            target = lastDotIdx > -1 ? flock.get(root, path.slice(0, path.lastIndexOf(".inputs"))) : baseTarget,
            newInput = flock.input.shouldExpand(inputName, target) && valueParser ?
                valueParser(val, path, target, previousInput) : val;

        flock.set(root, path, newInput);

        if (target && target.onInputChanged) {
            target.onInputChanged(inputName);
        }

        return newInput;
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
        gradeNames: ["fluid.eventedComponent", "autoInit"],

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
        if (node.nickName) {
            namedNodes[node.nickName] = node;
        }
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


    fluid.defaults("flock.audioStrategy", {
        gradeNames: ["fluid.standardComponent", "autoInit"],

        components: {
            nodeEvaluator: {
                type: "flock.enviro.nodeEvaluator"
            }
        }
    });


    fluid.defaults("flock.enviro", {
        gradeNames: ["fluid.standardComponent", "flock.nodeList", "autoInit"],

        model: {
            playState: {
                written: 0,
                total: Infinity
            },

            isPlaying: false
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
            numBuses: 8,
            // This buffer size determines the overall latency of Flocking's audio output.
            // TODO: Replace this with IoC awesomeness.
            bufferSize: flock.defaultBufferSizeForPlatform(),

            // Hints to some audio backends.
            genPollIntervalFactor: flock.platform.isLinux ? 1 : 20 // Only used on Firefox.
        },

        members: {
            // TODO: Modelize.
            audioSettings: "{that}.options.audioSettings",
            buses: {
                expander: {
                    funcName: "flock.enviro.createAudioBuffers",
                    args: ["{that}.audioSettings.numBuses", "{that}.audioSettings.blockSize"]
                }
            },
            buffers: {},
            bufferSources: {}
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
            play: {
                funcName: "flock.enviro.play",
                args: [
                    "{arguments}.0",
                    "{that}.model",
                    "{that}.applier",
                    "{that}.audioSettings",
                    "{that}.events.onPlay.fire"
                ]
            },

            /**
             * Stops generating samples.
             */
            stop: {
                funcName: "flock.enviro.stop",
                args: [
                    "{that}.applier",
                    "{that}.events.onStop.fire"
                ]
            },

            /**
             * Fully resets the state of the environment.
             */
            reset: {
                func: "{that}.events.onReset.fire"
            },

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
            releaseBuffer: "flock.enviro.releaseBuffer({arguments}.0, {that}.buffers)"
        },

        events: {
            onPlay: null,
            onStop: null,
            onReset: null
        },

        listeners: {
            onPlay: "{audioStrategy}.startGeneratingSamples()",

            onStop: "{audioStrategy}.stopGeneratingSamples()",

            onReset: [
                "{that}.stop()",
                "{asyncScheduler}.clearAll()",
                "{that}.clearAll()"
            ],

            onCreate: {
                funcName: "flock.enviro.initAudioSettings",
                args: ["{that}.audioSettings", "{audioStrategy}.options.audioSettings"]
            }
        },

        components: {
            asyncScheduler: {
                type: "flock.scheduler.async"
            },

            audioStrategy: {
                type: "flock.audioStrategy.platform",
                options: {
                    audioSettings: "{enviro}.audioSettings",
                    model: {
                        playState: "{enviro}.model.playState"
                    }
                }
            }
        }
    });

    flock.enviro.initAudioSettings = function (audioSettings, audioStrategySettings) {
        var rates = audioSettings.rates;

        // TODO: Model-based (with ChangeApplier) sharing of audioSettings
        rates.audio = audioStrategySettings.rates.audio;
        rates.control = rates.audio / audioSettings.blockSize;
        audioSettings.chans = audioStrategySettings.chans;
    };

    flock.enviro.play = function (dur, model, applier, audioSettings, onPlay) {
        dur = dur === undefined ? Infinity : dur;

        var playState = model.playState,
            sps = dur * audioSettings.rates.audio * audioSettings.chans,
            totalSamples = playState.written + sps;

        applier.requestChange("playState.total", totalSamples);
        applier.requestChange("isPlaying", true);
        onPlay(dur);
    };

    flock.enviro.stop = function (applier, onStop) {
        applier.requestChange("isPlaying", false);
        onStop();
    };

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

    flock.enviro.gen = function (nodeEvaluator) {
        nodeEvaluator.clearBuses();
        nodeEvaluator.gen();
    };

    flock.enviro.createAudioBuffers = function (numBufs, blockSize) {
        var bufs = [],
            i;
        for (i = 0; i < numBufs; i++) {
            bufs[i] = new Float32Array(blockSize);
        }
        return bufs;
    };


    /*****************
     * Node Evalutor *
     *****************/

    fluid.defaults("flock.enviro.nodeEvaluator", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],

        members: {
            nodes: "{enviro}.nodes",
            buses: "{enviro}.buses"
        },

        invokers: {
            gen: {
                funcName: "flock.enviro.nodeEvaluator.gen",
                args: [
                    "{enviro}.options.audioSettings.numBuses",
                    "{enviro}.options.audioSettings.blockSize",
                    "{that}.nodes",
                    "{that}.buses"
                ]
            },

            clearBuses: {
                funcName: "flock.enviro.nodeEvaluator.clearBuses",
                args: [
                    "{enviro}.options.audioSettings.numBuses",
                    "{enviro}.options.audioSettings.blockSize",
                    "{that}.buses"
                ]
            }
        }
    });

    flock.enviro.nodeEvaluator.gen = function (numBuses, busLen, nodes, buses) {
        var i,
            bus,
            j,
            node;

        // Clear all buses before evaluating the synth graph.
        for (i = 0; i < numBuses; i++) {
            bus = buses[i];
            for (j = 0; j < busLen; j++) {
                bus[j] = 0;
            }
        }

        // Now evaluate each node.
        for (i = 0; i < nodes.length; i++) {
            node = nodes[i];
            node.gen(node.model.blockSize);
        }
    };


    flock.enviro.nodeEvaluator.clearBuses = function (numBuses, busLen, buses) {
        for (var i = 0; i < numBuses; i++) {
            var bus = buses[i];
            for (var j = 0; j < busLen; j++) {
                bus[j] = 0;
            }
        }
    };

    fluid.defaults("flock.autoEnviro", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],

        members: {
            enviro: "@expand:flock.autoEnviro.initEnvironment()"
        }
    });

    flock.autoEnviro.initEnvironment = function () {
        if (!flock.enviro.shared) {
            flock.init();
        }

        return flock.enviro.shared;
    };

    fluid.defaults("flock.node", {
        gradeNames: ["flock.autoEnviro", "fluid.standardComponent", "autoInit"],
        model: {}
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
                if (typeof input !== "number") {
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
            "flock.node",
            "flock.ugenNodeList",
            "autoInit"
        ],

        rate: flock.rates.AUDIO,
        addToEnvironment: "tail",

        invokers: {
            /**
             * Plays the synth. This is a convenience method that will add the synth to the tail of the
             * environment's node graph and then play the environmnent.
             *
             * @param {Number} dur optional duration to play this synth in seconds
             */
            play: {
                funcName: "flock.synth.play",
                args: ["{that}"]
            },

            /**
             * Stops the synth if it is currently playing.
             * This is a convenience method that will remove the synth from the environment's node graph.
             */
            pause: {
                funcName: "flock.synth.pause",
                args: ["{that}"]
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
            }
        },

        listeners: {
            onDestroy: {
                "func": "{that}.pause"
            }
        }
    });

    flock.synth.play = function (that) {
        var enviro = that.enviro;

        if (enviro.nodes.indexOf(that) === -1) {
            that.addToEnvironment();
        }

        if (!enviro.model.isPlaying) {
            enviro.play();
        }
    };

    flock.synth.pause = function (that) {
        var enviro = that.enviro;
        enviro.remove(that);
    };

    flock.synth.set = function (that, namedNodes, path, val, swap) {
        return flock.input.set(namedNodes, path, val, undefined, function (ugenDef, path, target, prev) {
            return flock.synth.ugenValueParser(that, ugenDef, prev, swap);
        });
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
        that.gen = function () {
            var nodes = that.nodes,
                i,
                node;

            for (i = 0; i < nodes.length; i++) {
                node = nodes[i];
                if (node.gen !== undefined) {
                    node.gen(node.model.blockSize);
                }
            }
        };

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
        that.input = function (path, val, swap) {
            return !path ? undefined : typeof path === "string" ?
                arguments.length < 2 ? that.get(path) : that.set(path, val, swap) :
                flock.isIterable(path) ? that.get(path) : that.set(path, val, swap);
        };

        /**
         * Adds the synth to its environment's list of active nodes.
         *
         * @param {String || Boolean || Number} position the place to insert the node at;
         *     if undefined, the synth's addToEnvironment option will be used.
         */
        that.addToEnvironment = function (position) {
            if (position === undefined) {
                position = that.options.addToEnvironment;
            }

            // Add this synth to the tail of the synthesis environment if appropriate.
            if (position === undefined || position === null || position === false) {
                return;
            }

            var type = typeof (position);
            if (type === "string" && position === "head" || position === "tail") {
                that.enviro[position](that);
            } else if (type === "number") {
                that.enviro.insert(position, that);
            } else {
                that.enviro.tail(that);
            }
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

            that.addToEnvironment();
        };

        that.init();
        return that;
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
            var nodes = that.nodes,
                lastIdx = nodes.length - 1,
                out = nodes[lastIdx];

            that.gen(1);

            return out.model.value;
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


    // TODO: At the moment, flock.synth.group attempts to act as a proxy for
    // a collection of synths, allowing users to address it as if it were
    // a single synth. However, it does nothing to ensure that its contained synths
    // are managed properly with the environment. As a result, it will double-generate
    // output from each synth unless the user has manually specified their synths with the
    // "addToEnvironment: false" option.
    // It's also not IoC-enabled, which makes it very diffult to use it in IoC-based
    // contexts.
    // At very least, it should override the essential flock.nodeList methods and ensure
    // that synths added to the group are actively removed from the environment's node list.
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
