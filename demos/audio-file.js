var fs = require("fs"),
    //DSP = require("dsp"),
    fluid = require("infusion"),
    loader = fluid.getLoader(__dirname);

loader.require("../flocking/third-party/polydataview/js/polydataview.js");
loader.require("../flocking/third-party/dspapi/js/dspapi.js");

loader.require("../flocking/flocking/flocking-core.js");
loader.require("../flocking/flocking/flocking-audiofile.js");
loader.require("../flocking/flocking/flocking-scheduler.js");
loader.require("../flocking-node.js");
loader.require("../flocking/flocking/flocking-parser.js");
loader.require("../flocking/flocking/flocking-ugens.js");

flock = fluid.registerNamespace("flock");
fluid.registerNamespace("flock.file");

// TODO: Refactor Flocking's file and buffer loading API to accomodate this.
flock.file.readPathAsync = function (path, success, error) {
    fs.exists(path, function (exists) {
        if (!exists) {
            console.log(path, "doesn't exist.");
            return;
        }
        
        fs.stat(path, function (error, stats) {
            fs.open(path, "r", function (error, fd) {
                var buf = new Buffer(stats.size);
                fs.read(fd, buf, 0, buf.length, null, function (error, bytesRead) {
                    var type = flock.file.parseFileExtension(path);
                    var arr = new Int8Array(buf);
                    var decoded = flock.audio.decodeArrayBuffer(arr.buffer, type);
                    
                    fs.close(fd);
                    success(decoded, type);
                });
            });
        });
    })
};

flock.file.readPathAsync("demos/audio/hillier-first-chord.wav", function (bufferDesc) {
    var synth = flock.synth({
        synthDef: {
            ugen: "flock.ugen.playBuffer",
            buffer: bufferDesc.data.channels[0],
            loop: 1,
            speed: {
                ugen: "flock.ugen.lfNoise",
                freq: 2.5,
                mul: {
                    ugen: "flock.ugen.math",
                    source: 1,
                    div: {
                        ugen: "flock.ugen.bufferDuration",
                        buffer: bufferDesc.data.channels[0] // TODO: Improve buffer registration so this can be shared.
                    }
                },
                add: 1.0,
                options: {
                    interpolation: "linear"
                }
            }
        }
    });
    
    synth.play();
});
