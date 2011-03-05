"use strict";

var synth = synth || {};
var gfx = gfx || {};

(function () {

    /**
     * Sets various stroke and fill styles for the specified 2d context.
     */
    gfx.strokeAndFill = function (ctx, shape) {
        ctx.fillStyle = shape.fill || ctx.fillStyle;
        ctx.strokeStyle = shape.strokeColor || ctx.strokeStyle;
        ctx.lineWidth = shape.strokeWidth || ctx.lineWidth;
    };
   
    /**
     * Draws a pie chart in the specified 2d context. Based on a demo by Paul Rouget.
     * Example:
     *    pieChart(ctx, {
     *        x: 25,
     *        y: 25,
     *        radius: 10,
     *        percent: 75,
     *        fill: "#FBB829",
     *        strokeColor: "gray",
     *    });
     */
    gfx.pieChart = function (ctx, pieChart) {
        gfx.strokeAndFill(ctx, pieChart);
        ctx.beginPath();
        ctx.moveTo(pieChart.x, pieChart.y);
        ctx.arc(pieChart.x, pieChart.y, pieChart.radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pieChart.percent / 100, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    };
    

    /**
     * Draws a rectangle in the specified 2d context.
     * Example:
     *    circle(ctx, {
     *        fill: "#FBB829",
     *        x: canvas.getAttribute("width") / 2,
     *        y: canvas.getAttribute("height") / 2,
     *       radius: 20,
     *        strokeColor: "gray",
     *        strokeWidth: 3
     *    });
     */
    gfx.circle = function (ctx, circle) {
        gfx.strokeAndFill(ctx, circle);
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    };

    /**
     * Draws a rectangle in the specified 2d context.
     * Example:
     *   rect(ctx, {
     *       fill: "rgba(200, 0, 0, 0.75)",
     *       x: 0,
     *       y: 0,
     *       height: 15,
     *       width: 15
     *   });
     */
    gfx.rect = function (ctx, rect) {
        gfx.strokeAndFill(ctx, rect);
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    };
    
    /**
     * Yep, it draws a line.
     * Example:
     *    gfx.line(ctx, {
     *        x: knob.x,
     *        y: knob.y,
     *        endX: lineEndX,
     *        endY: lineEndY,
     *        strokeColor: knob.strokeColor,
     *        strokeWidth: knob.strokeWidth
     *    });
     */
    gfx.line = function (ctx, line) {
        ctx.moveTo(line.x, line.y);
        ctx.lineTo(line.endX, line.endY);
        ctx.stroke();
    };
    
    gfx.knob = function (ctx, knob) {
        gfx.circle(ctx, knob);
        
        var angle = (knob.atPos * 3.6) + 90; // Convert percentage to angle, shifting 0 degrees to the bottom.
        var theta = angle * (Math.PI / 180);
        var lineEndX = (Math.cos(theta) * knob.radius) * ctx.canvas.getAttribute("width");
        var lineEndY = (Math.sin(theta) * knob.radius) * ctx.canvas.getAttribute("height");
        
        gfx.line(ctx, {
            x: knob.x,
            y: knob.y,
            endX: lineEndX,
            endY: lineEndY,
            strokeColor: knob.strokeColor,
            strokeWidth: knob.strokeWidth
        });
    };
    
    synth.control = function (canvas) {
        var that = {
            pos: 0
        };
        
        var ctx = canvas.getContext("2d");
        canvas.addEventListener("click", function (e) {
            var x = e.pageX - canvas.offsetLeft, y = e.pageY - canvas.offsetTop;
            console.log(x);
            console.log(y);
            // TODO need to convert from Cartesian to unit circle.
            that.refreshView();
        }, false);
        
        that.refreshView = function () {
            gfx.knob(ctx, {
                radius: 20,
                atPos: that.pos,
                x: canvas.getAttribute("width") / 2,
                y: canvas.getAttribute("height") / 2,
                fill: "#FBB829",
                strokeColor: "gray",
                strokeWidth: 3
            });
        };
        
        that.refreshView();
    };
    
    synth.mulAdd = function (inputs, output, sampleRate) {
        // Reads directly from the output buffer, overwriting it in place with modified values.
        for (var i = 0; i < output.length; i++) {
            output[i] = output[i] * inputs.mul[i] + inputs.add[i];
        }
        return output;
    };
    
    synth.sinOsc = function (inputs, output, sampleRate) {
        // TODO: Need to store wavetable state somewhere more sensible. Objects, anyone?
        var wavetable = synth.sinOsc.wavetable ? 
            synth.sinOsc.wavetable : 
            synth.sinOsc.wavetable = synth.sinOsc.generateWavetable(sampleRate);
        
        // Scan the wavetable at the given frequency to generate the output.
        var freq = inputs.freq;
        var tableLen = wavetable.length;
        var phase = 0;
        for (var i = 0; i < output.length; i++) {
            output[i] = wavetable[phase];
            var increment = freq[i] * tableLen / sampleRate;
            phase += increment;
            if (phase > tableLen) {
                phase -= tableLen;
            }
        }
        return synth.mulAdd(inputs, output);
    };
    
    synth.sinOsc.generateWavetable = function (sampleRate) {
        var scale = (2.0 * Math.PI) / sampleRate;
        var wavetable = new Float32Array(sampleRate);
        for (var i = 0; i < sampleRate; i++) {
            wavetable[i] = Math.sin(i * scale);
        }
        return wavetable;
    };
    
    synth.init = function (sampleRate, bufferSize) {
        var that = {};
        that.sampleRate = sampleRate || 44100;
        that.bufferSize = bufferSize || that.sampleRate / 2;
        that.outAudio = new Audio();
    
        that.fillBuffer = function (val) {
            var size = that.bufferSize;
            var buf = new Float32Array(size);
            for (var i = 0; i < size; i++) {
                buf[i] = val;
            }
            return buf;
        };
        
        that.out = function (inputs, output, sampleRate) {
            // Handle multiple channels.
            var len = output.length,
                left, right;
            
            if (len === 2) {
                // Assume we've got a stereo pair of output buffers
                left = output[0];
                right = output[1];
                len = left.length;
                if (len !== right.length) {
                     throw new Error("Left and right output buffers must be the same length.");
                }
            } else {
                left = output;
                right = output; 
            }

            // Interleave each output channel into stereo frames.
            var stereo = new Float32Array(len * 2);
            for (var i = 0; i < len; i++) {
                var frameIdx = i * 2;
                stereo[frameIdx] = left[i];
                stereo[frameIdx + 1] = right[i];
            }
            
            that.outAudio.mozWriteAudio(stereo);
        };
        
        that.outBuffer = new Float32Array(that.bufferSize);
        that.outAudio.mozSetup(2, that.sampleRate);
        
        return that;
    };
    
    synth.test = function (duration) {
        var sampleRate = 44100;
        var testSynth = synth.init(sampleRate, 22050);
        
        // TODO: 
        // Timing is a mess
        // Need a real scheduler
        // Handle output buffers sensibly
        // seamless input buffer handling for constant arguments like freq, mul and add are often
        var writes = 0;
        var interval = 1000 / (sampleRate / testSynth.bufferSize); //  How often to write, in millis
        var maxWrites = duration / interval;
        
        var id;
        var writeAudio = function () {
            console.log(new Date());
            var ampMod = synth.sinOsc({
                freq: testSynth.fillBuffer(1.0), 
                mul: testSynth.fillBuffer(1.0), 
                add: testSynth.fillBuffer(0)
            }, new Float32Array(sampleRate), sampleRate);
            
            var sinOsc = synth.sinOsc({
                freq: testSynth.fillBuffer(165),
                mul: ampMod,
                //mul: testSynth.fillBuffer(0.5),
                add: testSynth.fillBuffer(0)
            }, testSynth.outBuffer, sampleRate);

            testSynth.out({}, testSynth.outBuffer, sampleRate);
            
            writes++;
            if (writes >= maxWrites) {
                window.clearInterval(id);
            }
        };
        id = window.setInterval(writeAudio, interval);
    };
})();