/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global Float32Array, Audio, window, webkitAudioContext*/
/*jslint white: true, vars: true, plusplus: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock = flock || {};

(function () {
    "use strict";
    
    flock.OUT_UGEN_ID = "flocking-out";
    flock.ALL_UGENS_ID = "flocking-all";
    flock.TWOPI = 2.0 * Math.PI;
    flock.LOG1 = Math.log(0.1);
    
    flock.rates = {
        AUDIO: "audio",
        CONTROL: "control",
        CONSTANT: "constant"
    };
    
    flock.defaults = {
        rates: {
            audio: 44100,
            control: 64,
            constant: 1
        },        
        tableSize: 8192,
        minLatency: 125,
        writeInterval: 50,
        fps: 60
    };

    flock.idIdx = 0;
    flock.id = function () {
        return "flock-id-" + flock.idIdx++;
    };
    
    /*************
     * Utilities *
     *************/
    
     // TODO: Move this to an as-yet non-existent base file.
     flock.isArray = function (o) {
         var l = o.length;
         return o && l !== undefined && typeof (l) === "number";
     };

    // TODO: Unit tests
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
    
    // TODO:
    //   - Unit tests
    //   - Allow normalization to other values than 1.0.
    flock.normalize = function (buffer) {
        var maxVal = 0.0,
            i,
            current;
        
        // Find the maximum value in the buffer.
        for (i = 0; i < buffer.length; i++) {
            current = buffer[i];
            if (current > maxVal) {
                maxVal = current;
            }
        }
        
        // And then normalize the buffer to 1.0.
        if (maxVal > 0.0) {
            for (i = 0; i < buffer.length; i++) {
                buffer[i] /= maxVal;
            }
        }
        
        return buffer;
    };
    
    flock.pathParseError = function (path, token) {
        throw new Error("Error parsing path: " + path + ". Segment '" + token + 
            "' could not be resolved.");
    };
    
    flock.resolvePath = function (path, root) {
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
    
    flock.invokePath = function (path, args, root) {
        var fn = flock.resolvePath(path, root);
        if (typeof (fn) !== "function") {
            throw new Error("Path '" + path + "' does not resolve to a function.");
        }
        return fn.apply(null, args);
    };
    
    
    /***********************
     * Synths and Playback *
     ***********************/

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
    flock.interleavedDemandWriter = function (needed, evalFn, sourceBufs, audioSettings) {
        var kr = audioSettings.rates.control,
            chans = audioSettings.chans,
            // Figure out how many control periods worth of samples to generate.
            // This means that we'll probably be writing slightly more or less than needed.
            numKRBufs = Math.round(needed / kr),
            outBufSize = numKRBufs * kr * chans,
            outBuf = new Float32Array(outBufSize), // TODO: Don't generate a new buffer each time through.
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
    
    var setupEnviro = function (that) {
        var setupFn = typeof (window.webkitAudioContext) !== "undefined" ?
            flock.enviro.webkit : flock.enviro.moz;
        setupFn(that);
    };
    
    flock.enviro = function (options) {
        options = options || {};        
        var that = {
            audioSettings: {
                rates: {
                    audio: options.sampleRate || flock.defaults.rates.audio,
                    control: options.controlRate || flock.defaults.rates.control,
                    constant: options.constantRate || flock.defaults.rates.constant
                },
                chans: options.chans || 2
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
        that.buses = flock.enviro.createAudioBuffers(16, that.audioSettings.rates.control);
        that.buffers = {};
        
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
            
            // Clear the environment's node list.
            while (that.nodes.length > 0) {
                that.nodes.pop();
            }
        };
        
        that.gen = function () {
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
     * Mixes in Firefox-specific Audio Data API implementations for outputting audio
     *
     * @param that the environment to mix into
     */
    flock.enviro.moz = function (that) {
        that.audioEl = new Audio();
        that.model.writeInterval = that.model.writeInterval || flock.defaults.writeInterval;
        that.audioSettings.bufferSize = flock.minBufferSize(flock.defaults.minLatency, that.audioSettings);
        that.audioEl.mozSetup(that.audioSettings.chans, that.audioSettings.rates.audio);
        that.playbackTimerId = null;
        
        that.startGeneratingSamples = function () {
            if (that.playbackTimerId) {
                return;
            }
            
            that.playbackTimerId = window.setInterval(function () {
                var playState = that.model.playState;
                var needed = that.audioEl.mozCurrentSampleOffset() + 
                    that.audioSettings.bufferSize - playState.written;
                if (needed <= 0 || that.nodes.length < 1) {
                    return;
                }
                
                var outBuf = flock.interleavedDemandWriter(needed, that.gen, that.buses, that.audioSettings);
                playState.written += that.audioEl.mozWriteAudio(outBuf);
                if (playState.written >= playState.total) {
                    that.stop();
                }
            }, that.model.writeInterval);
        };
        
        that.stopGeneratingSamples = function () {
            window.clearInterval(that.playbackTimerId);
            that.playbackTimerId = null;
        };        
    };
    
    
    var setupWebKitEnviro = function (that) {
        that.jsNode.onaudioprocess = function (e) {
            var kr = flock.defaults.rates.control,
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
            // TODO: Why can't the Web Audio API just handle this?
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
        that.audioSettings.bufferSize = 4096; // TODO: how does this relate to minimum latency?
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
            model: {
                synthDef: def
            },
            options: options || {}
        };
        that.enviro = flock.enviro.shared;
        that.inputUGens = flock.parse.synthDef(that.model.synthDef, that.enviro.audioSettings);
        that.ugens = that.inputUGens[flock.ALL_UGENS_ID];
        that.out = that.inputUGens[flock.OUT_UGEN_ID];
        
        /**
         * Generates an audio rate signal by evaluating this synth's unit generator graph.
         *
         * @param numSamps the number of samples to generate
         * @return a buffer containing the generated audio
         */
        that.gen = function () {
            // Synths always evaluate their ugen graph at the audio rate.
            flock.enviro.evalGraph(that.ugens, that.enviro.audioSettings.rates.control);
        };
        
        /**
         * Gets the value of the ugen at the specified path.
         *
         * @param {String} path the ugen's path within the synth graph
         * @return {Number|UGen} a scalar value in the case of a value ugen, otherwise the ugen itself
         */
        that.getUGenPath = function (path) {
            var input = flock.resolvePath(path, that.inputUGens);
            return typeof (input.model.value) !== "undefined" ? input.model.value : input;
        };
        
        /**
         * Sets the value of the ugen at the specified path.
         *
         * @param {String} path the ugen's path within the synth graph
         * @param {Number || UGenDef} val a scalar value (for Value ugens) or a UGenDef object
         * @return {UGen} the newly created UGen that was set at the specified path
         */
        that.setUGenPath = function (path, val) {
            if (path.indexOf(".") === -1) {
                throw new Error("Setting a ugen directly is not currently supported.");
            }
            
            var lastSegIdx = path.lastIndexOf("."),
                ugenInputPath = path.substring(0, lastSegIdx),
                ugenPath = ugenInputPath.substring(0, ugenInputPath.lastIndexOf(".")),
                inputName = path.substring(lastSegIdx + 1),
                ugen = flock.resolvePath(ugenPath, that.inputUGens),
                inputUGen = ugen.input(inputName, val);
                                
            ugen.onInputChanged();
            return inputUGen;
        };
        
        /**
         * Gets or sets the value of a ugen at the specified path
         *
         * @param {String} path the ugen's path within the synth graph
         * @param {Number || UGenDef} val an optional value to to set--either a a scalar or a UGenDef object
         * @return {UGen} optionally, the newly created UGen that was set at the specified path
         */
        // TODO: Naming?
        that.input = function (path, val) {
            if (!path) {
                return;
            }
            var expanded = path.replace(".", ".inputs.");
            return arguments.length < 2 ? that.getUGenPath(expanded) : that.setUGenPath(expanded, val);
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

        if (that.options.addToEnvironment !== false) {
            that.enviro.head(that);
        }
        
        return that;
    };
    
}());
