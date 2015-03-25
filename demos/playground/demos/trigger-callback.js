// Periodically trigger a function that causes the scope area to shake.

flock.synth({
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
                    $("#gfx").toggleClass("shake");
                }
            }
        }
    }
});
