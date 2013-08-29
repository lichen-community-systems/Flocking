/*! Flocking 0.1, Copyright 2012 Colin Clark | flockingjs.org */

/*
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2012, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global Float32Array, window, jQuery*/
/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true, browser: true,
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");
    
    flock.init = function (options) {
        var enviroOpts = !options ? undefined : {
            audioSettings: options
        };
        flock.enviro.shared = flock.enviro(enviroOpts);
    };
    
    flock.OUT_UGEN_ID = "flocking-out";
    flock.TWOPI = 2.0 * Math.PI;
    flock.LOG01 = Math.log(0.1);
    flock.LOG001 = Math.log(0.001);
    flock.ROOT2 = Math.sqrt(2);
    
    flock.rates = {
        AUDIO: "audio",
        CONTROL: "control",
        DEMAND: "demand",
        CONSTANT: "constant"
    };
    
    flock.sampleFormats = {
        FLOAT32NE: "float32NE"
    };

    flock.browser = function () {
        if (typeof (navigator) === "undefined") {
            return {};
        }

        // This is a modified version of jQuery's browser detection code,
        // which they removed from jQuery 2.0.
        // Some of us still have to live in the messy reality of the web.
        var ua = navigator.userAgent.toLowerCase(),
            browser = {},
            match,
            matched;
        
        match = /(chrome)[ \/]([\w.]+)/.exec( ua ) ||
            /(webkit)[ \/]([\w.]+)/.exec( ua ) ||
            /(opera)(?:.*version|)[ \/]([\w.]+)/.exec( ua ) ||
            /(msie) ([\w.]+)/.exec( ua ) ||
            ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec( ua ) || [];
        
        matched = {
            browser: match[ 1 ] || "",
            version: match[ 2 ] || "0"
        };

        if (matched.browser) {
            browser[matched.browser] = true;
            browser.version = matched.version;
        }

        // Chrome is Webkit, but Webkit is also Safari.
        if ( browser.chrome ) {
            browser.webkit = true;
        } else if ( browser.webkit ) {
            browser.safari = true;
        }
        
        return browser;
    };
    
    // TODO: Move to components in the static environment and into the appropriate platform files.
    fluid.registerNamespace("flock.platform");
    flock.platform.isBrowser = typeof (window) !== "undefined";
    flock.platform.os = flock.platform.isBrowser ? window.navigator.platform : fluid.require("os").platform();
    flock.platform.isLinux = flock.platform.os.indexOf("Linux") > -1;
    flock.platform.isAndroid = flock.platform.isLinux && flock.platform.os.indexOf("arm") > -1;
    flock.platform.isIOS = flock.platform.os === "iPhone" || flock.platform.os === "iPad" || flock.platform.os === "iPod";
    flock.platform.isMobile = flock.platform.isAndroid || flock.platform.isIOS;
    flock.platform.browser = flock.browser();
    flock.platform.isWebAudio = (typeof (AudioContext) !== "undefined" && (new AudioContext()).createJavaScriptNode) ||
        typeof (webkitAudioContext) !== "undefined";
    flock.platform.audioEngine = flock.platform.isBrowser ? (flock.platform.isWebAudio ? "webAudio" : "moz") : "nodejs";
    fluid.staticEnvironment.audioEngine = fluid.typeTag("flock.platform." + flock.platform.audioEngine);

    
    flock.shim = {
        URL: typeof (window) !== "undefined" ? window.URL || window.webkitURL || window.msURL : undefined
    };
    
    /*************
     * Utilities *
     *************/
    
    flock.isIterable = function (o) {
        var type = typeof (o);
        return o && o.length !== undefined && type !== "string" && type !== "function";
    };
    
    flock.generate = function (bufOrSize, generator) {
        var buf = typeof (bufOrSize) === "number" ? new Float32Array(bufOrSize) : bufOrSize,
            isFunc = typeof (generator) === "function",
            i;
        
        for (i = 0; i < buf.length; i++) {
            buf[i] = isFunc ? generator(i, buf) : generator;
        }

        return buf;
    };
    
    flock.generate.silence = function (bufOrSize) {
        if (typeof (bufOrSize) === "number") {
            return new Float32Array(bufOrSize);
        }
        
        var buf = bufOrSize,
            i;
        for (i = 0; i < buf.length; i++) {
            buf[i] = 0.0;
        }
        return buf;
    };
     
    flock.minBufferSize = function (latency, audioSettings) {
        var size = (audioSettings.rates.audio * audioSettings.chans) / (1000 / latency);
        return Math.round(size);
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
        if (flock.isIterable(collection)) {
            var val = flock.arrayChoose(collection, strategy);
            return val;
        }

        var key = flock.arrayChoose(collection.keys, strategy);
        return collection[key];
    };
    
    /**
     * Normalizes the specified buffer in place to the specified value.
     *
     * @param {Arrayable} buffer the buffer to normalize; it will not be copied
     * @param {Number} normal the value to normalize the buffer to
     * @return the buffer, normalized in place
     */
    flock.normalize = function (buffer, normal) {
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
                buffer[i] = (val / maxVal) * normal;
            }
        }
        
        return buffer;
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
    
    flock.scale = function (buf, minVal, maxVal) {
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
    
    
    flock.interpolate = {};
    
    /**
     * Performs linear interpretation.
     */
    flock.interpolate.linear = function (idx, table) {
        idx = idx % table.length;
        
        var i1 = idx | 0,
            i2 = (i1 + 1) % table.length,
            frac = idx - i1,
            y1 = table[i1],
            y2 = table[i2];
        
        return y1 + frac * (y2 - y1);
    };
    
    /**
     * Performs cubic interpretation.
     */
    flock.interpolate.cubic = function (idx, table) {
        idx = idx % table.length;
        
        var len = table.length,
            i1 = idx | 0,
            i0 = i1 > 0 ? i1 - 1 : len - 1,
            i2 = (i1 + 1) % len,
            i3 = (i1 + 2) % len,
            frac = idx - i1,
            fracSq = frac * frac,
            fracCub = frac * fracSq,
            y0 = table[i0],
            y1 = table[i1],
            y2 = table[i2],
            y3 = table[i3],
            a = 0.5 * (y1 - y2) + (y3 - y0),
            b = (y0 + y2) * 0.5 - y1,
            c = y2 - (0.3333333333333333 * y0) - (0.5 * y1) - (0.16666666666666667 * y3);
        
        return (a * fracCub) + (b * fracSq) + (c * frac) + y1;
    };
    
    
    flock.pathParseError = function (path, token) {
        throw new Error("Error parsing path: " + path + ". Segment '" + token + 
            "' could not be resolved.");
    };
    
    flock.get = function (root, path) {
        if (!root) {
            return fluid.getGlobalValue(path);
        } else if (arguments.length == 1 && typeof (root) === "string") {
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
                flock.pathParseError(path, tokenized[i - 1]);
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
            type = typeof (root);
            if (type !== "object") {
                throw new Error("A non-container object was found at segment " + prop + ". Value: " + root);
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
        var fn = typeof (root) === "function" ? root : flock.get(root, path);
        if (typeof (fn) !== "function") {
            throw new Error("Path '" + path + "' does not resolve to a function.");
        }
        return fn.apply(null, args);
    };

    
    flock.input = {};
    
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
        return (typeof (path) === "string") ? flock.input.pathExpander(path) : flock.input.expandPaths(path);
    };
    
    flock.input.getValueForPath = function (root, path) {
        path = flock.input.expandPath(path);
        var input = flock.get(root, path);
        // TODO: This algorithm needs to be made much clearer.
        return (input && !input.gen && input.model && typeof (input.model.value) !== "undefined") ?
            input.model.value : input;
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
        return typeof (path) === "string" ? flock.input.getValueForPath(root, path) :
            flock.isIterable(path) ? flock.input.getValuesForPathArray(root, path) :
            flock.input.getValuesForPathObject(root, path);
    };
    
    flock.input.setValueForPath = function (root, path, val, baseTarget, valueParser) {
        path = flock.input.expandPath(path);
        
        var previousInput = flock.get(root, path),
            lastDotIdx = path.lastIndexOf("."),
            inputName = path.slice(lastDotIdx + 1),
            target = lastDotIdx > -1 ? flock.get(root, path.slice(0, path.lastIndexOf(".inputs"))) : baseTarget,
            newInput = valueParser ? valueParser(val, path, target, previousInput) : val;
        
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
        return typeof (path) === "string" ?
            flock.input.setValueForPath(root, path, val, baseTarget, valueParser) :
            flock.input.setValuesForPaths(root, path, baseTarget, valueParser);
    };
    
    
    /**
     * Creates a Buffer Description object from an array of audio buffers for each channel.
     */
    fluid.defaults("flock.bufferDesc", {
        gradeNames: ["fluid.littleComponent", "autoInit"],
        mergePolicy: {
            channelBuffers: "nomerge"
        },
        container: {},
        format: {
            sampleRate: 44100,
            numChannels: "{that}.options.data.channels.length",
            numSampleFrames: "{that}.options.data.channels.0.length"
        }
    });

    flock.bufferDesc.finalInit = function (that) {
        that.container = that.options.container;
        that.format = that.options.format;
        that.data = that.options.data;
        that.format.duration = that.format.numSampleFrames / that.format.sampleRate;
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
                return that.head(node);
            }
            
            that.nodes[idx] = newNode;
            delete that.namedNodes[oldNode.nickName];

            if (newNode.nickName) {
                that.namedNodes[newNode.nickName] = newNode;
            }
            return idx;
        };
    };
    
    
    /***********************
     * Synths and Playback *
     ***********************/
    
    fluid.defaults("flock.enviro", {
        gradeNames: ["fluid.modelComponent", "flock.nodeList", "autoInit"],
        model: {
            playState: {
                written: 0,
                total: null
            },
            
            isPlaying: false
        },
        audioSettings: {
            rates: {
                audio: 48000, // This is only a hint. Some audio backends (such as the Web Audio API) 
                              // may define the sample rate themselves.
                control: 64,
                constant: 1
            },
            chans: 2,
            numBuses: 2,
            // This buffer size determines the overall latency of Flocking's audio output. On Firefox, it will be 2x.
            // TODO: Replace this with IoC awesomeness.
            bufferSize: flock.platform.isWebAudio ? 1024 : 
                flock.platform.os === "Win32" ? 16384 : flock.platform.isMobile ? 8192 : 4096,
            
            // Hints to some audio backends.
            genPollIntervalFactor: flock.platform.isLinux ? 1 : 20 // Only used on Firefox.
        },
        components: {
            asyncScheduler: {
                type: "flock.scheduler.async"
            },
            
            audioStrategy: {
                type: "flock.enviro.audioStrategy",
                options: {
                    audioSettings: "{enviro}.options.audioSettings",
                    model: {
                        playState: "{enviro}.model.playState"
                    }
                }
            }
        }
    });
    
    flock.enviro.preInit = function (that) {
        that.audioSettings = that.options.audioSettings;
        that.buses = flock.enviro.createAudioBuffers(that.audioSettings.numBuses, 
                that.audioSettings.rates.control);
        that.buffers = {};
        that.promisedBuffers = {};
        
        /**
         * Starts generating samples from all synths.
         *
         * @param {Number} dur optional duration to play in seconds
         */
        that.play = function (dur) {
            dur = dur === undefined ? Infinity : dur;
            
            var playState = that.model.playState,
                sps = dur * that.audioSettings.rates.audio * that.audioSettings.chans;
                
            playState.total = playState.written + sps;
            that.audioStrategy.startGeneratingSamples();
            that.model.isPlaying = true;
        };
        
        /**
         * Stops generating samples from all synths.
         */
        that.stop = function () {
            that.audioStrategy.stopGeneratingSamples();
            that.model.isPlaying = false;
        };
        
        that.reset = function () {
            that.stop();
            that.asyncScheduler.clearAll();
            // Clear the environment's node list.
            while (that.nodes.length > 0) {
                that.nodes.pop();
            }
        };
        
        that.registerBuffer = function (bufDesc) {
            bufDesc.id = bufDesc.id || fluid.allocateGuid();
            that.buffers[bufDesc.id] = bufDesc;
        };

        that.releaseBuffer = function (bufDesc) {
            if (!bufDesc) {
                return;
            }
            
            var id = typeof (bufDesc) === "string" ? bufDesc : bufDesc.id;
            delete that.buffers[id];
        };
    };
    
    flock.enviro.finalInit = function (that) {
        that.gen = that.audioStrategy.nodeEvaluator.gen;
        
        // TODO: Model-based (with ChangeApplier) sharing of audioSettings
        that.options.audioSettings.rates.audio = that.audioStrategy.options.audioSettings.rates.audio;
    };
    
    flock.enviro.createAudioBuffers = function (numBufs, kr) {
        var bufs = [],
            i;
        for (i = 0; i < numBufs; i++) {
            bufs[i] = new Float32Array(kr);
        }
        return bufs;
    };
    
    fluid.defaults("flock.enviro.audioStrategy", {
        gradeNames: ["fluid.modelComponent"],
        
        components: {
            nodeEvaluator: {
                type: "flock.enviro.nodeEvaluator",
                options: {
                    numBuses: "{enviro}.options.audioSettings.numBuses",
                    controlRate: "{enviro}.options.audioSettings.rates.control",
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
        that.gen = function () {
            var numBuses = that.options.numBuses,
                busLen = that.options.controlRate,
                i,
                bus,
                j,
                node;
            
            // Clear all buses before evaluating the synth graph.
            for (i = 0; i < numBuses; i++) {
                bus = that.buses[i];
                for (j = 0; j < busLen; j++) {
                    bus[j] = 0;
                }
            }
            
            // Now evaluate each node.
            for (i = 0; i < that.nodes.length; i++) {
                node = that.nodes[i];
                node.gen(node.model.blockSize);
            }
        };
    };
    
    
    fluid.defaults("flock.autoEnviro", {
        gradeNames: ["fluid.littleComponent", "autoInit"]
    });
    
    flock.autoEnviro.preInit = function (that) {
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
                if (typeof (input) !== "number") {
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
                if (typeof (input) !== "number") {
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
        gradeNames: ["flock.node", "flock.ugenNodeList", "autoInit"],
        rate: flock.rates.AUDIO
    });
    
    /**
     * Synths represent a collection of signal-generating units, wired together to form an instrument.
     * They are created with a synthDef object, a declarative structure describing the synth's unit generator graph.
     */
    flock.synth.finalInit = function (that) {
        that.rate = that.options.rate;
        that.enviro = that.enviro || flock.enviro.shared;
        that.model.blockSize = that.enviro.audioSettings.rates.control;
        
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
            return !path ? undefined : typeof (path) === "string" ?
                arguments.length < 2 ? that.get(path) : that.set(path, val, swap) :
                flock.isIterable(path) ? that.get(path) : that.set(path, val, swap);
        };
                
        /**
         * Plays the synth. This is a convenience method that will add the synth to the tail of the
         * environment's node graph and then play the environmnent.
         *
         * @param {Number} dur optional duration to play this synth in seconds
         */
        that.play = function () {
            var e = that.enviro;
            
            if (e.nodes.indexOf(that) === -1) {
                e.head(that);
            }
            
            if (!e.isPlaying) {
                e.play();
            }
        };
        
        /**
         * Stops the synth if it is currently playing.
         * This is a convenience method that will remove the synth from the environment's node graph.
         */
        that.pause = function () {
            that.enviro.remove(that);
        };

        that.init = function () {
            if (!that.options.synthDef) {
                fluid.log(fluid.logLevel.IMPORTANT,
                    "Warning: Instantiating a flock.synth instance with an empty synth def.")
            }
            
            // Parse the synthDef into a graph of unit generators.
            that.out = flock.parse.synthDef(that.options.synthDef, {
                rate: that.options.rate,
                overrideRate: (that.options.rate === flock.rates.DEMAND), // At demand rate, override the rate of all ugens.
                visitors: that.tail,
                buffers: that.enviro.buffers,
                buses: that.enviro.buses,
                audioSettings: that.enviro.audioSettings
            });
            
            // Add this synth to the tail of the synthesis environment if appropriate.
            if (that.options.addToEnvironment !== false) {
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
            audioSettings: that.enviro.audioSettings,
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
    
    
    fluid.defaults("flock.synth.group", {
        gradeNames: ["flock.node", "flock.nodeList", "autoInit"],
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
                if (typeof(normalizer) === "function") {
                    norm(voice, ampKey);
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
                for (var i = 0; i < that.options.maxVoices; i++) {
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
    
    
    /**************************************
     * Infusion Typed Array Monkeypatches *
     **************************************/
    
    /**
     * Monkey patches fluid.mergeOneImpl until an general Infusion solution can be put in place for
     * defining custom primitive detection logic. Currently, ArrayBufferViews are detected as objects.
     */
    // unsupported, NON-API function
    fluid.mergeOneImpl = function (thisTarget, thisSource, j, sources, newPolicy, i, segs) {
        var togo = thisTarget;

        var primitiveTarget = fluid.isPrimitive(thisTarget);

        if (thisSource !== undefined) {
            if (!newPolicy.func && thisSource !== null &&
                    typeof (thisSource) === "object" &&
                    !(thisSource.buffer instanceof ArrayBuffer) &&
                    !fluid.isDOMish(thisSource) && thisSource !== fluid.VALUE &&
                    !newPolicy.preserve && !newPolicy.nomerge) {
                if (primitiveTarget) {
                    togo = thisTarget = fluid.freshContainer(thisSource);
                }
                // recursion is now external? We can't do it from here since sources are not all known
                // options.recurse(thisTarget, i + 1, segs, sources, newPolicyHolder, options);
            } else {
                sources[j] = undefined;
                if (newPolicy.func) {
                    togo = newPolicy.func.call(null, thisTarget, thisSource, segs[i - 1], segs, i); // NB - change in this mostly unused argument
                } else {
                    togo = fluid.isValue(thisTarget) && newPolicy.preserve ? fluid.model.mergeModel(thisTarget, thisSource) : thisSource;
                }
            }
        }
        return togo;
    };
    
    /**
     * Monkey patches fluid.isPrimitive until an general Infusion solution can be put in place for
     * defining custom primitive detection logic. Currently, ArrayBufferViews are detected as objects.
     */
    fluid.isPrimitive = function (value) {
        var valueType = typeof (value);
        return !value || valueType === "string" || valueType === "boolean" || valueType === "number" || 
            valueType === "function" || value.buffer instanceof ArrayBuffer;
    };
    
}());
