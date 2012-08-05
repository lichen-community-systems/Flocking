/*! Flocking 0.1, Copyright 2012 Colin Clark | flockingjs.org */

/*
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2012, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global Float32Array, Audio, window, webkitAudioContext, Blob, Worker, self, jQuery*/
/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true, browser: true,
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock = flock || {};

(function ($) {
    "use strict";
    
    flock.OUT_UGEN_ID = "flocking-out";
    flock.TWOPI = 2.0 * Math.PI;
    flock.LOG1 = Math.log(0.1);
    flock.LOG001 = Math.log(0.001);
    
    flock.rates = {
        AUDIO: "audio",
        CONTROL: "control",
        CONSTANT: "constant"
    };
    
    flock.platform = {
        os: window.navigator.platform || "",
        browser: $.browser
    };
    
    flock.defaults = function (name, defaults) {
        if (defaults) {
            flock.defaults.store[name] = defaults;
            return defaults;
        }
        
        return flock.defaults.store[name];
    };
    flock.defaults.store = {};
    
    flock.defaults("flock.audioSettings", {
        rates: {
            audio: 44100,
            control: 64,
            constant: 1
        },        
        tableSize: 8192,
        bufferSize: flock.platform.os.indexOf("Linux") > -1 ||
            (flock.platform.os === "Win32" && flock.platform.browser.mozilla) ?
            4096 : 2048
    });
    
    flock.idIdx = 0;
    flock.id = function () {
        return "flock-id-" + flock.idIdx++;
    };
    
    flock.identity = function (val) {
        return val;
    };
    
    /*************
     * Utilities *
     *************/
    
    flock.isIterable = function (o) {
        return o && o.length !== undefined && typeof (o.length) === "number";
    };

    flock.generate = function (bufOrSize, generator) {
        var buf = typeof (bufOrSize) === "number" ? new Float32Array(bufOrSize) : bufOrSize,
            i;

        if (typeof (generator) === "number") {
            var value = generator;
            generator = function () { 
                return value; 
            };
        }
        
        for (i = 0; i < buf.length; i++) {
            buf[i] = generator(i, buf);
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
        arr = $.makeArray(arr);
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
            current = buffer[i];
            if (current > maxVal) {
                maxVal = current;
            }
        }
        
        // And then normalize the buffer.
        if (maxVal > 0.0) {
            for (i = 0; i < buffer.length; i++) {
                val = buffer[i];
                buffer[i] = (val / maxVal) * normal;
            }
        }
        
        return buffer;
    };
    
    flock.pathParseError = function (path, token) {
        throw new Error("Error parsing path: " + path + ". Segment '" + token + 
            "' could not be resolved.");
    };
    
    flock.get = function (root, path) {
        root = root || window;
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
        root = root || window;
        if (!path || path === "") {
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
        var fn = flock.get(root, path);
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
        return (input && input.model && typeof (input.model.value) !== "undefined") ?
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
        var path,
            val,
            result;
        
        for (path in valueMap) {
            val = valueMap[path];
            result = flock.input.set(root, path, val, baseTarget, valueParser);
            valueMap[path] = result;
        }
        
        return valueMap;
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
    
    
    /***********************
     * Time and Scheduling *
     ***********************/

    flock.shim = {
        BlobBuilder: window.BlobBuilder || window.MozBlobBuilder || 
            window.WebKitBlobBuilder || window.MSBlobBuilder || window.OBlobBuilder,
        URL: window.URL || window.webkitURL || window.msURL || window.oURL
    };
    
     /**
      * Creates a Web Worker from a String or Function.
      *
      * Note that if a Function is used, it will be converted into a string
      * and then evaluated again in the Worker's "alternate universe."
      * As a result functions passed to workers will not capture their lexical scope, etc.
      *
      * @param {String|Function} code the code to pass to the Web Worker to be evaluated
      * @return a standard W3C Worker instance
      */
    flock.worker = function (code) {
        var type = typeof (code),
            url,
            blob;
        
        if (type === "function") {
            code = "(" + code.toString() + ")();";
        } else if (type !== "string") {
            throw new Error("A flock.worker must be initialized with a String or a Function.");
        }
         
        if (window.Blob) {
            blob = new Blob([code]);
            url = flock.shim.URL.createObjectURL(blob);
        } else {
            url = "data:text/javascript;base64," + window.btoa(code);
        }
        return new Worker(url);
    };
     
    flock.worker.code = {
        interval: function () {
            self.intervals = {};

            self.onInterval = function (interval) {
                self.postMessage({
                    msg: "tick",
                    value: interval
                });
            };

            self.schedule = function (interval) {
                var id = setInterval(function () {
                    self.onInterval(interval);
                }, interval);
                self.intervals[interval] = id;
            };

            self.clear = function (interval) {
                var id = self.intervals[interval];
                clearInterval(id);
            };
             
            self.clearAll = function () {
                for (var interval in self.intervals) {
                    self.clear(interval);
                }
            };

            self.addEventListener("message", function (e) {
                self[e.data.msg](e.data.value);
            }, false);
        }
    };
     
    flock.conductor = function () {
        var that = {
            intervalWorker: flock.worker(flock.worker.code.interval)
        };
         
        that.schedulePeriodic = function (interval, fn) {
            that.intervalWorker.addEventListener("message", function (e) {
                if (e.data.value === interval) {
                    fn();
                }
            }, false);
             
            that.intervalWorker.postMessage({
                msg: "schedule",
                value: interval
            });
        };
         
        that.clearPeriodic = function (interval) {
            that.intervalWorker.postMessage({
                msg: "clear",
                value: interval
            });
        };
         
        that.clearAll = function () {
            that.intervalWorker.postMessage({
                msg: "clearAll"
            });
        };
         
        return that;
    };
     
     
    /***********************
     * Synths and Playback *
     ***********************/
    
    var setupEnviro = function (that) {
        var setupFn = typeof (window.webkitAudioContext) !== "undefined" ?
            flock.enviro.webkit : flock.enviro.moz;
        setupFn(that);
    };
    
    flock.enviro = function (options) {
        options = options || {};        
        var defaultSettings = flock.defaults("flock.audioSettings"),
            // TODO: Replace with options merging.
            that = {
                audioSettings: {
                    rates: {
                        audio: options.sampleRate || defaultSettings.rates.audio,
                        control: options.controlRate || defaultSettings.rates.control,
                        constant: options.constantRate || defaultSettings.rates.constant
                    },
                    chans: options.chans || 2,
                    bufferSize: options.bufferSize || defaultSettings.bufferSize,
                    numBuses: options.numBuses || 16
                },
                model: {
                    playState: {
                        written: 0,
                        total: null
                    }
                },
                nodes: [],
            
                isPlaying: false
            };
        
        // TODO: Buffers are named but buses are numbered. Should we have a consistent strategy?
        // The advantage to numbers is that they're easily modulatable with a ugen. Names are easier to deal with.
        that.buses = flock.enviro.createAudioBuffers(that.audioSettings.numBuses, 
                that.audioSettings.rates.control);
        that.buffers = {};
        that.conductor = flock.conductor();
        
        /**
         * Starts generating samples from all synths.
         *
         * @param {Number} dur optional duration to play in seconds
         */
        that.play = function (dur) {
            var playState = that.model.playState,
                sps = dur * (that.audioSettings.rates.audio * that.audioSettings.chans);
                
            playState.total = dur === undefined ? Infinity :
                playState.total === Infinity ? sps : playState.written + sps;
            that.startGeneratingSamples();
            that.isPlaying = true;
        };
        
        /**
         * Stops generating samples from all synths.
         */
        that.stop = function () {
            that.stopGeneratingSamples();
            that.isPlaying = false;
        };
        
        that.reset = function () {
            that.stop();
            that.conductor.clearAll();
            // Clear the environment's node list.
            while (that.nodes.length > 0) {
                that.nodes.pop();
            }
        };
        
        that.gen = function () {
            that.clearBuses();
            flock.enviro.evalGraph(that.nodes, that.audioSettings.rates.control);
        };
        
        that.head = function (node) {
            that.nodes.unshift(node);
        };
        
        that.before = function (refNode, node) {
            var refIdx = that.nodes.indexOf(refNode);
            that.at(refIdx, node);
        };
        
        that.after = function (refNode, node) {
            var refIdx = that.nodes.indexOf(refNode);
            that.at(refIdx + 1, node);
        };
        
        that.at = function (idx, node) {
            that.nodes.splice(idx, 0, node);
        };
        
        that.tail = function (node) {
            that.nodes.push(node);
        };
        
        that.remove = function (node) {
            var idx = that.nodes.indexOf(node);
            that.nodes.splice(idx, 1);
        };
                
        that.loadBuffer = function (name, src, onLoadFn) {
            if (!src && onLoadFn) {
                // Assume the buffer has already been loaded by other means.
                onLoadFn(that.buffers[name], name);
                return;
            }
            
            flock.audio.decode(src, function (decoded) {
                var chans = decoded.data.channels;
                that.buffers[name] = chans;
                if (onLoadFn) {
                    onLoadFn(chans, name); 
                }
            });
        };
        
        that.clearBuses = function () {
            var numBuses = that.audioSettings.numBuses,
                buses = that.buses,
                i,
                bus,
                j;
                
            for (i = 0; i < numBuses; i++) {
                bus = buses[i];
                for (j = 0; j < bus.length; j++) {
                    bus[j] = 0;
                }
            }
        };

        setupEnviro(that);
        return that;
    };

    flock.enviro.createAudioBuffers = function (numBufs, kr) {
        var bufs = [],
            i;
        for (i = 0; i < numBufs; i++) {
            bufs[i] = new Float32Array(kr);
        }
        return bufs;
    };
    
    flock.enviro.evalGraph = function (nodes, kr) {
        var i,
            node;
        for (i = 0; i < nodes.length; i++) {
            node = nodes[i];
            node.gen(node.rate === flock.rates.AUDIO ? kr : 1);
        }
    };
    
    /**
     * Generates an interleaved audio buffer from the output unit generator for the specified
     * 'needed' number of samples. If number of needed samples isn't divisble by the control rate,
     * the output buffer's size will be rounded up to the nearest control period.
     *
     * @param {Number} needed the number of samples to generate
     * @param {Function} evalFn a function to invoke when writing each buffer
     * @param {Array} an array of buffers to write
     * @param {Object} audioSettings the current audio system settings
     * @return a channel-interleaved output buffer containing roughly the number of needed samples
     */
    flock.interleavedDemandWriter = function (outBuf, evalFn, sourceBufs, audioSettings) {
        var kr = audioSettings.rates.control,
            chans = audioSettings.chans,
            // Figure out how many control periods worth of samples to generate.
            // This means that we could conceivably write slightly more or less than needed.
            numKRBufs = audioSettings.bufferSize / kr,
            i,
            chan,
            samp;
            
        for (i = 0; i < numKRBufs; i++) {
            evalFn();
            var offset = i * kr * chans;
            
            // Interleave each output channel.
            for (chan = 0; chan < chans; chan++) {
                var sourceBuf = sourceBufs[chan];
                for (samp = 0; samp < kr; samp++) {
                    var frameIdx = samp * chans + offset;
                    outBuf[frameIdx + chan] = sourceBuf[samp];
                }
            }
        }
        
        return outBuf;
    };
    
    /**
     * Mixes in Firefox-specific Audio Data API implementations for outputting audio
     *
     * @param that the environment to mix into
     */
    flock.enviro.moz = function (that) {
        that.audioEl = new Audio();
        that.model.writeInterval = 1;
        that.model.sampleOverflow = -(that.audioSettings.bufferSize * 4);
        that.audioEl.mozSetup(that.audioSettings.chans, that.audioSettings.rates.audio);
        
        that.startGeneratingSamples = function () {
            if (that.scheduled) {
                return;
            }
            that.conductor.schedulePeriodic(that.model.writeInterval, that.writeSamples);
            that.scheduled = true;
        };
        
        that.writeSamples = function () {
            var playState = that.model.playState,
                currentOffset = that.audioEl.mozCurrentSampleOffset(),
                needed = currentOffset - playState.written,
                outBuf;
            
            if (needed < that.model.sampleOverflow || that.nodes.length < 1) {
                return;
            }
            
            outBuf = new Float32Array(that.audioSettings.bufferSize * that.audioSettings.chans);
            flock.interleavedDemandWriter(outBuf, that.gen, that.buses, that.audioSettings);
            playState.written += that.audioEl.mozWriteAudio(outBuf);
            
            if (playState.written >= playState.total) {
                that.stop();
            }
        };
        
        that.stopGeneratingSamples = function () {
            that.conductor.clearPeriodic(that.model.writeInterval);
            that.scheduled = false;
        };        
    };
    
    
    var setupWebKitEnviro = function (that) {
        that.jsNode.onaudioprocess = function (e) {
            // TODO: Do all these settings need to be read every time onaudioprocess gets called?
            var defaultSettings = flock.defaults("flock.audioSettings"),
                kr = defaultSettings.rates.control,
                playState = that.model,
                chans = that.audioSettings.chans,
                bufSize = that.audioSettings.bufferSize,
                numKRBufs = bufSize / kr,
                sourceBufs = that.buses,
                outBufs = e.outputBuffer,
                i,
                chan,
                samp;
                
            // If there are no nodes providing samples, write out silence.
            if (that.nodes.length < 1) {
                for (chan = 0; chan < chans; chan++) {
                    flock.generate.silence(outBufs.getChannelData(chan));
                }
                return;
            }

            for (i = 0; i < numKRBufs; i++) {
                that.gen();
                var offset = i * kr;

                // Loop through each channel.
                for (chan = 0; chan < chans; chan++) {
                    var sourceBuf = sourceBufs[chan],
                        outBuf = outBufs.getChannelData(chan);
                    
                    // And output each sample.
                    for (samp = 0; samp < kr; samp++) {
                        outBuf[samp + offset] = sourceBuf[samp];
                    }
                }
            }
            
            playState.written += bufSize * chans;
            if (playState.written >= playState.total) {
                that.stop();
            }
        };
        that.source.connect(that.jsNode);
    };
    
    
    /**
     * Mixes in WebKit-specific Web Audio API implementations for outputting audio
     *
     * @param that the environment to mix into
     */
    flock.enviro.webkit = function (that) {
        that.context = new webkitAudioContext();
        that.source = that.context.createBufferSource();
        that.jsNode = that.context.createJavaScriptNode(that.audioSettings.bufferSize);
        
        that.startGeneratingSamples = function () {
            that.jsNode.connect(that.context.destination);
        };
        
        that.stopGeneratingSamples = function () {
            that.jsNode.disconnect(0);
        };
        
        setupWebKitEnviro(that);
    };
    
    // Immediately register a singleton environment for the page.
    // Users are free to replace this with their own if needed.
    flock.enviro.shared = flock.enviro();
    
    /**
     * Synths represent a collection of signal-generating units, wired together to form an instrument.
     * They are created with a synthDef object, a declarative structure describing the synth's unit generator graph.
     */
    flock.synth = function (def, options) {
        var that = {
            rate: flock.rates.AUDIO,
            enviro: flock.enviro.shared,
            ugens: flock.synth.ugenCache(),
            model: {
                synthDef: def
            },
            options: options || {}
        };
        
        /**
         * Generates an audio rate signal by evaluating this synth's unit generator graph.
         *
         * @param numSamps the number of samples to generate
         * @return a buffer containing the generated audio
         */
        that.gen = function () {
            // Synths always evaluate their ugen graph at the audio rate.
            flock.enviro.evalGraph(that.ugens.active, that.enviro.audioSettings.rates.control);
        };
        
        /**
         * Gets the value of the ugen at the specified path.
         *
         * @param {String} path the ugen's path within the synth graph
         * @return {Number|UGen} a scalar value in the case of a value ugen, otherwise the ugen itself
         */
        that.get = function (path) {
            return flock.input.get(that.ugens.named, path);
        };
        
        /**
         * Sets the value of the ugen at the specified path.
         *
         * @param {String} path the ugen's path within the synth graph
         * @param {Number || UGenDef} val a scalar value (for Value ugens) or a UGenDef object
         * @return {UGen} the newly created UGen that was set at the specified path
         */
        that.set = function (path, val, swap) {
            return flock.input.set(that.ugens.named, path, val, undefined, function (ugenDef, path, target, previous) {
                var ugen = flock.parse.ugenDef(ugenDef, that.enviro.audioSettings.rates);
                that.ugens.replace(ugen, previous, swap);
                return ugen;
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
            // Set up the ugenCache as a visitor for the parsing stage, 
            // so that we don't have to traverse the graph again later.
            var parseOptions = $.extend({}, that.enviro.audioSettings, {
                visitors: that.ugens.add
            });
            
            // Parse the synthDef into a graph of unit generators.
            that.out = flock.parse.synthDef(that.model.synthDef, parseOptions);
            
            // Add this synth to the tail of the synthesis environment if appropriate.
            if (that.options.addToEnvironment !== false) {
                that.enviro.tail(that);
            }
        };
        
        that.init();
        return that;
    };
    
    flock.synth.ugenCache = function () {
        var that = {
            named: {},
            active: []
        };
        
        that.add = function (ugens) {
            var i,
                ugen;
            
            ugens = $.makeArray(ugens);
            for (i = 0; i < ugens.length; i++) {
                ugen = ugens[i];
                if (ugen.gen) {
                    that.active.push(ugen);
                }
                if (ugen.id) {
                    that.named[ugen.id] = ugen;
                }
            }

        };
        
        that.remove = function (ugens, recursively) {
            var active = that.active,
                named = that.named,
                i,
                ugen,
                idx,
                inputs,
                input;
            
            ugens = $.makeArray(ugens);
            for (i = 0; i < ugens.length; i++) {
                ugen = ugens[i];
                idx = active.indexOf(ugen);
                if (idx > -1) {
                    active.splice(idx, 1);
                }
                if (ugen.id) {
                    delete named[ugen.id];
                }
                if (recursively) {
                    inputs = [];
                    for (input in ugen.inputs) {
                        inputs.push(ugen.inputs[input]);
                    }
                    that.remove(inputs, true);
                }
            }
        };
        
        that.reattachInputs = function (currentUGen, previousUGen, inputsToReattach) {
            var i,
                inputName;
                
            if (inputsToReattach) {
                // Replace only the specified inputs.
                for (i = 0; i < inputsToReattach.length; i++) {
                    inputName = inputsToReattach[i];
                    currentUGen.inputs[inputName]  = previousUGen.inputs[inputName];
                }
            } else {
                // Replace all the current ugen's inputs with the previous'.
                currentUGen.inputs = previousUGen.inputs;
            }
        };
        
        that.replaceActiveOutput = function (currentUGen, previousUGen) {
            // TODO: This only traverses active ugens, which is probably adequate for most real-world cases 
            // but still not comprehensive. This should be replaced with a graph walker.
            var i,
                ugen,
                inputName,
                input;
                
            for (i = 0; i < that.active.length; i++) {
                ugen = that.active[i];
                for (inputName in ugen.inputs) {
                    input = ugen.inputs[inputName];
                    if (input === previousUGen) {
                        ugen.inputs[inputName] = currentUGen;
                        break;
                    }
                }
            }
            
            return currentUGen;
        };
        
        /**
         * Swaps a list of unit generators with a new set, reattaching the specified inputs and replacing outputs.
         *
         * @param {UGen || Array of UGens} ugens the new unit generators to swap in
         * @param {UGen || Array of UGens} previousUGens the unit generators to replace
         * @param {Object || boolean} inputsToReattach a list of inputs to reattach to the new unit generator, or a boolean for all
         * @return the newly-connected unit generators
         */
        that.swap = function (ugens, previousUGens, inputsToReattach) {
            var i,
                prev,
                current;
                
            // Note: This algorithm assumes that number of previous and current ugens is the same length.
            previousUGens = $.makeArray(previousUGens);
            ugens = $.makeArray(ugens);
            
            for (i = 0; i < previousUGens.length; i++) {
                prev = previousUGens[i];
                current = ugens[i];
                that.reattachInputs(current, prev, inputsToReattach);
                that.replaceActiveOutput(current, prev);
            }
            
            return ugens;
        };
        
        /**
         * Replaces a list of unit generators with another.
         *
         * If "reattachInputs" is an array, it should contain a list of inputNames to replace.
         *
         * @param {UGen||Array of UGens} ugens the new unit generators to add
         * @param {UGen||Array of UGens} previousUGens the unit generators to replace with the new ones
         * @param {boolean||Object} reattachInputs specifies if the old unit generator's inputs should be attached to the new ones
         * @return the new unit generators
         */
        that.replace = function (ugens, previousUGens, reattachInputs) {
            if (reattachInputs) {
                reattachInputs = typeof (reattachInputs) === "object" ? reattachInputs : undefined;
                that.swap(ugens, previousUGens, reattachInputs);
            }
            that.remove(previousUGens, true);
            that.add(ugens);
            
            return ugens;
        };
        
        return that;
    };
    
}(jQuery));
