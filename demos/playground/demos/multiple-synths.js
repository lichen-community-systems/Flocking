/*global flock, $*/

/*
 * Multiple synths playing back simultaneously, playing shifting chords.
 */

// Creates an array of synths, each playing a degree of the chord specified in "intervals."
function makeIntervallicSynths (fundamental, intervals) {
    var ampScale = 0.4 / intervals.length;
    return $.map(intervals, function (interval) {
        return flock.synth({
            synthDef: {
                id: "carrier",
                ugen: "flock.ugen.sin",
                freq: fundamental * interval,
                mul: ampScale
            }
        });
    });
}

var fundamental = 440,
    baseIntervals = [1/1, 5/4, 3/2],
    weightedIntervals = baseIntervals.concat([4/3, 6/5, 7/6, 2/1]).concat(baseIntervals),
    synths = makeIntervallicSynths(fundamental, baseIntervals),
    clock = flock.scheduler.async.tempo({
        bpm: 60
    });

// Every second, change one of the intervals by randomly choosing a synth
// and assigning it a new frequency from the list of intervals.
clock.repeat(1, function () {
    var intervalSynth = flock.choose(synths),
        newInterval = flock.choose(weightedIntervals);
    intervalSynth.input("carrier.freq", fundamental * newInterval);
});
