// Periodically trigger a function that causes the scope area to shake.
var randomColour = function () {
    var r = (Math.random() * 255) | 0,
        g = (Math.random() * 255) | 0,
        b = (Math.random() * 255) | 0;

    return "rgb(" + r + "," + g + "," + b + ")";
};

var synth = flock.synth({
    synthDef: {
        ugen: "flock.ugen.triggerCallback",
        trigger: {
            ugen: "flock.ugen.impulse",
            freq: 0.75,
            phase: 0.5
        },
        options: {
            callback: {
                func: function () {
                    var gfx = $("#gfx");
                    gfx.css("background-color", randomColour());
                    gfx.toggleClass("shake");
                }
            }
        }
    }
});
