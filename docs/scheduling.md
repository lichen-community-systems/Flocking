# Scheduling Changes in Flocking #

## Using Unit Generators to Trigger Changes ##
There are a number of ways to schedule changes in Flocking. One way is to trigger periodic signal changes
using unit generators. Impulse is particularly useful for this task. For example, here's how to play a sound file every 2 seconds:

    flock.synth({
        synthDef: {
            ugen: "flock.ugen.playBuffer",
            buffer: {
                id: "drum",
                url: "audio/kick.wav"
            },
            loop: 1,
            trigger: {
                ugen: "flock.ugen.impulse",
                freq: 1/2
            }
        }
    });

## The Scheduler ##

The declarative scheduler provides a richer API for scheduling changes. The scheduler is still under active development, so expect some changes over time. There is currently one type of scheduler available in Flocking, the asynchronous scheduler. It runs outside the sample generation pipeline, triggered by an interval timer that runs in a separate web worker. This strategy can be reliable in cases where the browser might otherwise throttle the scheduler (for example, if the tab is placed in the background), but the nature of setInterval() in JavaScript is that it's not always as accurate as we'd like. Chrome and Safari seem to provide a more stable clock than Firefox does. Firefox tends to drift by up to 50 ms or so. A sample accurate scheduler is in the works.

Here's an example of using the Infusion style to create a very simple drum machine that triggers a kick drum based on sequence:

    (function () {
        "use strict";

        fluid.registerNamespace("flock.examples");

        flock.init();

        fluid.defaults("flock.examples.drumMachine", {
            gradeNames: ["fluid.eventedComponent", "autoInit"],

            score: [
                {
                    interval: "repeat",
                    time: 1,
                    change: {
                        synth: "synth",
                        values: {
                            "trig.source": {
                                synthDef: {
                                    ugen: "flock.ugen.sequence",
                                    list: [1, 1, 0, 1, 1, 0, 1, 0],
                                    loop: 1
                                }
                            }
                        }
                    }
                }
            ],

            components: {
                synth: {
                    type: "flock.synth",
                    options: {
                        synthDef: {
                            ugen: "flock.ugen.playBuffer",
                            buffer: {
                                id: "kick",
                                url: "audio/kick.wav"
                            },
                            trigger: {
                                id: "trig",
                                ugen: "flock.ugen.inputChangeTrigger",
                                source: 0,
                                duration: 0.01
                            }
                        }
                    }
                },

                scheduler: {
                    type: "flock.scheduler.async.tempo",
                    options: {
                        bpm: 120,
                        score: "{drumMachine}.options.score"
                    }
                }
            },

            listeners: {
                onCreate: {
                    func: "{synth}.play"
                }
            }
        });
    }());
