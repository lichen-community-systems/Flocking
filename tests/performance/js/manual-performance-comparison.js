(function () {
    "use strict";

    flock.test = flock.test || {};
        
    var test = function (options) {
        options.numReps = options.numReps || 1000;
        
        if (typeof (options) === "function") {
            options = {
                test: options
            };
        }
        
        var obj = options.setup ? options.setup() : undefined,
            timing = {},
            i;

        timing.start = Date.now();
        for (i = 0; i < options.numReps; i++) {
            options.test(obj);
        }
        timing.end = Date.now();
        timing.total = timing.end - timing.start;
        timing.avg = timing.total / options.numReps;
        timing.runs = options.numReps;
        timing.name = options.name;
            
        return timing;
    };
    
    var renderTestRow = function (times) {
        return "<tr><td>" + times.name + "</td><td>" + times.runs + "</td><td>" + times.total + "</td><td>" + times.avg + "</td></tr>";
    };
    
    var renderTestResults = function (timesArray) {
        var table = "<table><tr><th>Name</th><th>Runs</th><th>Total ms</th><th>Avg. ms</th></tr>",
            i;
        for (i = 0; i < timesArray.length; i++) {
            table += renderTestRow(timesArray[i]);
        }
        table += "</table>";
        
        return table;
    };

    var mockAudioRateUGen = function (outputBufferGenerator) {
        return {
            rate: flock.rates.AUDIO,
            output: flock.generate(64, outputBufferGenerator)
        };
    };
    
    flock.test.timeAudioRateOscillators = function (ugens, numSamps) {
        numSamps = numSamps || 64;

        var allTimes = [],
            ugenDef,
            testSpec,
            i;
        
        ugenDef = {
            freq: 440,
            phase: 1.0
        };
        
        testSpec = {                
            setup: function () {
                var ug = flock.parse.ugenForDef(ugenDef);
                
                ug.inputs.freq = mockAudioRateUGen(function () {
                    return Math.random() * 1200;
                });
                
                ug.inputs.phase = mockAudioRateUGen(function () {
                    return Math.random() * flock.TWOPI;
                });

                ug.onInputChanged();
                
                return ug;
            },
            
            test: function (ug) {
                ug.gen(numSamps);
            }
        };
        
        for (i = 0; i < ugens.length; i++) {
            ugenDef.ugen = testSpec.name = ugens[i];
            allTimes.push(test(testSpec));            
        }
        
        document.querySelector("#message").innerHTML = renderTestResults(allTimes);
    };
    
})();