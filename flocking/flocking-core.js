/*! Flocking 0.1, Copyright 2012 Colin Clark | flockingjs.org */

/*
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2012, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global Float32Array, window, Blob, Worker, self*/
/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true, browser: true,
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock;

(function () {
    
    flock = function (options) {
        var enviroOpts = !options ? undefined : {
            audioSettings: options
        };
        flock.enviro.shared = flock.enviro(enviroOpts);
    };
    
    // Grab hold of the global object and then move into strict mode.
    flock.global = this;
    "use strict";
    
    flock.OUT_UGEN_ID = "flocking-out";
    flock.TWOPI = 2.0 * Math.PI;
    flock.LOG01 = Math.log(0.1);
    flock.LOG001 = Math.log(0.001);
    flock.ROOT2 = Math.sqrt(2);
    
    flock.rates = {
        AUDIO: "audio",
        CONTROL: "control",
        CONSTANT: "constant"
    };
    
    flock.platform = {
        os: typeof(window) !== "undefined" ? window.navigator.platform : "",
        browser: typeof(jQuery) !== "undefined" ? jQuery.browser : {}
    };
    
    
    /*************
     * Utilities *
     *************/
    
    flock.isIterable = function (o) {
        return o && o.length !== undefined && typeof (o.length) === "number";
    };
    
    flock.clear = function (o) {
        var k;
        for (k in o) {
            delete o[k];
        }
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
    
    
    flock.interpolate = {};
    
    /**
     * Performs linear interpretation.
     */
    flock.interpolate.linear = function (idx, table) {
        idx = idx % table.length;
        
        var i1 = Math.floor(idx),
            i2 = i1 + 1 % table.length,
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
            i1 = Math.floor(idx),
            i0 = i1 > 0 ? i1 - 1 : len - 1,
            i2 = i1 + 1 % len,
            i3 = i1 + 2 % len,
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
        if (arguments.length == 1 && typeof (root) === "string") {
            path = root;
            root = flock.global;
        } else if (!root){
            root = flock.global;
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
        if (arguments.length == 1 && typeof (root) === "string") {
            path = root;
            root = flock.global;
        } else if (!root){
            root = flock.global;
        }

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
    
    
    /***********************
     * Time and Scheduling *
     ***********************/

    flock.scheduler = {};
    
    flock.shim = {
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
            self.scheduled = {};

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
                self.scheduled[interval] = id;
            };

            self.clear = function (interval) {
                var id = self.scheduled[interval];
                clearInterval(id);
            };
             
            self.clearAll = function () {
                for (var interval in self.scheduled) {
                    self.clear(interval);
                }
            };

            self.addEventListener("message", function (e) {
                self[e.data.msg](e.data.value);
            }, false);
        },
        
        specifiedTime: function () {
            self.scheduled = [];
            
            self.schedule = function (timeFromNow) {
                var id;
                id = setTimeout(function () {
                    self.clear(id);
                    self.postMessage({
                        msg: "tick",
                        value: timeFromNow
                    });
                }, timeFromNow);
                self.scheduled.push(id);
            };
            
            // TODO: How do we pass the id back to the client?
            self.clear = function (id, idx) {
                idx = idx === undefined ? self.scheduled.indexOf(id) : idx;
                if (idx > -1) {
                    self.scheduled.splice(idx, 1);
                }
                clearTimeout(id);
            };
            
            self.clearAll = function () {
                for (var i = 0; i < self.scheduled.length; i++) {
                    var id = self.scheduled[i];
                    clearTimeout(id);
                }
                self.scheduled.length = 0;
            };

            // TODO: Cut and pastage.
            self.addEventListener("message", function (e) {
                self[e.data.msg](e.data.value);
            }, false);
        }
    };
    
    flock.scheduler.asyncFinalInit = function (that) {
        that.workers = {};
        that.valueListeners = {};
        that.messages = { // Reuse message objects to avoid creating garbage.
            schedule: {
                msg: "schedule"
            },
            clear: {
                msg: "clear"
            },
            clearAll: {
                msg: "clearAll"
            }
        };
        
        that.addFilteredListener = function (eventName, target, value, fn, isOneShot) {
            if (!that.valueListeners[value]) {
                that.valueListeners[value] = [];
            }
            
            var listeners = that.valueListeners[value],
                listener = function (e) {
                if (e.data.value === value) {
                    fn(e.data.value);
                    if (isOneShot) {
                        target.removeEventListener(eventName, listener, false);
                    }
                }
            };
            listener.wrappedListener = fn;
            target.addEventListener(eventName, listener, false);
            listeners.push(listener);

            return listener;
        };
        
        that.removeFilteredListener = function (eventName, target, value) {
            var listeners = that.valueListeners[value],
                i,
                listener;
            
            if (!listeners) {
                return;
            }
            
            for (i = 0; i < listeners.length; i++) {
                listener = listeners[i];
                target.removeEventListener(eventName, listener, false);
            }
            listeners.length = 0;
            
            return listener;
        };
        
        that.repeat = function (interval, fn) {
            return that.schedule(that.workers.interval, interval, fn, false);
        };
        
        that.once = function (time, fn) {
            return that.schedule(that.workers.specifiedTime, time, fn, true);
        };
        
        that.schedule = function (worker, time, fn, isOneShot) {
            var ms = that.timeConverter.value(time),
                listener = that.addFilteredListener("message", worker, ms, fn, isOneShot),
                msg = that.messages.schedule;

            msg.value = ms;
            worker.postMessage(msg);

            return listener;
        };
        
        that.sequence = function (times, fn) {
            var listeners = [],
                listener;
                
            for (var i = 0; i < times.length; i++) {
                listener = that.once(times[i], fn)
                listeners.push(listener);
            }
            
            return listeners;
        };
        
        that.clear = function (listener) {
            if (!listener) {
                return;
            }
            
            // TODO: Rather inefficient.
            var workers = that.workers,
                type,
                w;
            for (type in workers) {
                w = workers[type];
                w.removeEventListener("message", listener, false);
            }
        };
        
        that.clearRepeat = function (interval) {
            var msg = that.messages.clear,
                worker = that.workers.interval;
            that.removeFilteredListener("message", worker, interval);
            msg.value = interval;
            that.workers.interval.postMessage(msg);
        };
        
        that.clearAll = function () {
            var listeners = that.valueListeners,
                key,
                worker,
                interval;
                
            for (key in that.workers) {
                worker = that.workers[key];
                worker.postMessage(that.messages.clearAll);
            }
            
            for (interval in listeners) {
                that.clearRepeat(interval);
            }
        };
        
        that.init = function () {
            // TODO: This is pretty silly. Refactor flock.worker().
            var workerTypes = flock.worker.code,
                worker,
                converter,
                converterType;
            
            for (var type in workerTypes) {
                worker = flock.worker(workerTypes[type]);
                that.workers[type] = worker;
            }
            
            // TODO: Convert to Infusion subcomponent.
            converter = that.options.timeConverter;
            converterType = typeof (converter) === "string" ? converter : converter.type;
            that.timeConverter = flock.invoke(undefined, converterType, converter.options);
        };
         
        that.init();
    };
    
    fluid.defaults("flock.scheduler.async", {
        gradeNames: ["fluid.littleComponent", "autoInit"],
        finalInitFunction: "flock.scheduler.asyncFinalInit",
        timeConverter: "flock.convert.seconds"
    });

    
    flock.scheduler.async.beat = function (bpm, options) {
        var that = fluid.initComponent("flock.sycheduler.async.beat", options);
        if (bpm !== undefined) {
            that.timeConverter.options.bpm = bpm;
        }
        return that;
    };
    
    fluid.defaults("flock.scheduler.async.beat", {
        gradeNames: ["flock.scheduler.async"],
        initFunction: "flock.scheduler.async.beat",
        argumentMap: {
            options: 1
        },
        timeConverter: {
            type: "flock.convert.beats",
            options: {
                bpm: 60
            }
        }
    });
    
    
    flock.convert = {};
    
    flock.convert.makeStatelessConverter = function (convertFn) {
        return function (options) {
            return {
                value: convertFn
            };
        }
    };
    
    flock.convert.ms = flock.convert.makeStatelessConverter(fluid.identity);
    
    flock.convert.seconds = flock.convert.makeStatelessConverter(function (secs) {
        return secs * 1000;
    });
    
    flock.convert.beatsFinalInit = function (that) {
        that.value = function (beats) {
            var bpm = that.options.bpm;
            return bpm <= 0 ? 0 : (beats / bpm) * 60000;
        };
    };
    
    fluid.defaults("flock.convert.beats", {
        gradeNames: ["fluid.littleComponent", "autoInit"],
        finalInitFunction: "flock.convert.beatsFinalInit",
        bpm: 60
    });
    
    
    flock.nodeListFinalInit = function (that) {
        that.nodes = [];
        
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
    };
    
    fluid.defaults("flock.nodeList", {
        gradeNames: ["fluid.littleComponent", "autoInit"],
        finalInitFunction: "flock.nodeListFinalInit"
    });
    
    /***********************
     * Synths and Playback *
     ***********************/
    
    var setupEnviro = function (that) {
        var setupFn = typeof (window.webkitAudioContext) !== "undefined" ?
            flock.enviro.webkit : flock.enviro.moz;
        setupFn(that);
    };
    
    flock.enviroFinalInit = function (that) {
        that.audioSettings = that.options.audioSettings;
        
        // TODO: Buffers are named but buses are numbered. Should we have a consistent strategy?
        // The advantage to numbers is that they're easily modulatable with a ugen. Names are easier to deal with.
        that.buses = flock.enviro.createAudioBuffers(that.audioSettings.numBuses, 
                that.audioSettings.rates.control);
        that.buffers = {};
        that.asyncScheduler = flock.scheduler.async({
            timeConverter: "flock.convert.ms"
        });
        
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
            that.model.isPlaying = true;
        };
        
        /**
         * Stops generating samples from all synths.
         */
        that.stop = function () {
            that.stopGeneratingSamples();
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
        
        that.gen = function () {
            flock.enviro.clearBuses(that.audioSettings.numBuses, that.buses, that.audioSettings.rates.control);
            flock.enviro.evalGraph(that.nodes, that.audioSettings.rates.control);
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

        setupEnviro(that);
    };
    
    fluid.defaults("flock.enviro", {
        gradeNames: ["fluid.modelComponent", "flock.nodeList", "autoInit"],
        finalInitFunction: "flock.enviroFinalInit",
        model: {
            playState: {
                written: 0,
                total: null
            },
            
            isPlaying: false
        },
        audioSettings: {
            rates: {
                audio: 44100,
                control: 64,
                constant: 1
            },
            chans: 2,
            numBuses: 16,
            // This buffer size determines the overall latency of Flocking's audio output. On Firefox, it will be 2x.
            bufferSize: (flock.platform.os === "Win32" && flock.platform.browser.mozilla) ?
                16384: 4096
        }
    });
    
    flock.enviro.clearBuses = function (numBuses, buses, busLen) {
        var i,
            bus,
            j;
            
        for (i = 0; i < numBuses; i++) {
            bus = buses[i];
            for (j = 0; j < busLen; j++) {
                bus[j] = 0;
            }
        }
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
    
    flock.autoEnviroFinalInit = function (that) {
        if (!flock.enviro.shared && !that.options.enviro) {
            flock();
        }
    };
    
    fluid.defaults("flock.autoEnviro", {
        gradeNames: ["fluid.littleComponent", "autoInit"],
        finalInitFunction: "flock.autoEnviroFinalInit"
    });
    
    
    /**
     * Synths represent a collection of signal-generating units, wired together to form an instrument.
     * They are created with a synthDef object, a declarative structure describing the synth's unit generator graph.
     */
    flock.synth = function (def, options) {
        var that = fluid.initComponent("flock.synth", options);
        that.rate = flock.rates.AUDIO;
        that.model.synthDef = def;
        that.enviro = that.options.enviro || flock.enviro.shared;
        that.ugens = flock.synth.ugenCache();
        
        /**
         * Generates an audio rate signal by evaluating this synth's unit generator graph.
         *
         * @param numSamps the number of samples to generate
         * @return a buffer containing the generated audio
         */
        that.gen = function (numSamps) {
            numSamps = numSamps || that.enviro.audioSettings.rates.control;
            flock.enviro.evalGraph(that.ugens.active, numSamps);
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
                var ugen = flock.parse.ugenDef(ugenDef, {
                    audioSettings: that.enviro.audioSettings,
                    buses: that.enviro.buses,
                    buffers: that.enviro.buffers
                });
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
            // Parse the synthDef into a graph of unit generators.
            that.out = flock.parse.synthDef(that.model.synthDef, {
                visitors: that.ugens.add,
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
    
    fluid.defaults("flock.synth", {
        gradeNames: ["fluid.modelComponent", "flock.autoEnviro"],
        argumentMap: {
            options: 1
        },
        mergePolicy: {
            enviro: "nomerge"
        }
    });
    
    
    flock.synth.ugenCache = function () {
        var that = {
            named: {},
            active: []
        };
        
        that.add = function (ugens) {
            var i,
                ugen;
            
            ugens = fluid.makeArray(ugens);
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
            
            ugens = fluid.makeArray(ugens);
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
            previousUGens = fluid.makeArray(previousUGens);
            ugens = fluid.makeArray(ugens);
            
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
    
    
    flock.synth.groupFinalInit = function (that) {
        that.rate = that.options.rate;
        that.enviro = that.options.enviro || flock.enviro.shared;
        
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
    
    fluid.defaults("flock.synth.group", {
        gradeNames: ["fluid.modelComponent", "flock.nodeList", "flock.autoEnviro", "autoInit"],
        finalInitFunction: "flock.synth.groupFinalInit",
        mergePolicy: {
            enviro: "nomerge"
        },
        rate: flock.rates.AUDIO
    });
    
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
    
    flock.synth.polyphonic = function (def, options) {
        var that = fluid.initComponent("flock.synth.polyphonic", options);
        that.model.synthDef = def;
        that.activeVoices = {};
        that.freeVoices = [];
        
        that.noteChange = function (voice, eventName, changeSpec) {
            var noteEventSpec = that.options.noteSpecs[eventName];
            changeSpec = fluid.extend({}, noteEventSpec, changeSpec);
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
            var voice = flock.synth(that.model.synthDef, {
                    addToEnvironment: false
                }),
                normalizer = that.options.amplitudeNormalizer,
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
    
    fluid.defaults("flock.synth.polyphonic", {
        gradeNames: ["flock.synth.group"],
        argumentMap: {
            options: 1
        },
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
    
}());
