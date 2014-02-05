/*
 * Flocking Interactive Demo Playground
 *   Copyright 2012, Vitus Lorenz-Meyer (https://github.com/derDoc)
 *   Copyright 2013-2014, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require, window*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";
    
    var $ = fluid.registerNamespace("jQuery");
    
    /**************
     * Playground *
     **************/
      
    fluid.defaults("flock.playground", {
        gradeNames: ["fluid.viewComponent", "autoInit"],
        
        flockingSettings: {},
        
        components: {
            demos: {
                type: "flock.playground.demos"
            },
            
            editor: {
                type: "flock.ui.codeEditor.cm",
                container: "{that}.dom.editor"
            },
            
            demoSelector: {
                type: "flock.playground.demoSelector",
                container: "{that}.dom.demoSelector",
                options: {
                    listeners: {
                        afterDemoLoaded: [
                            {
                                funcName: "{editor}.setContent",
                                args: ["{arguments}.0"]
                            },
                            {
                                funcName: "{playButton}.pause"
                            }
                        ]
                    }
                }
                
            },
            
            playButton: {
                type: "flock.ui.playButton",
                container: "{that}.dom.playButton",
                options: {
                    listeners: {
                        onPlay: "{that}.events.evaluateDemo"
                    }
                }
                
            }
        },
        
        events: {
            evaluateDemo: null      // TODO: Implement something that actually does something with this event.
        },
        
        listeners: {
            onCreate: {
                funcName: "flock.init",
                args: ["{that}.options.flockingSettings"]
            }
        },

        selectors: {
            editor: "#editorRegion",
            playButton: "#playButton",
            demoSelector: "#demos"
        }
    });
    
    
    /*******************
     * Demo Components *
     *******************/
    
    fluid.defaults("flock.playground.demos", {
        gradeNames: ["fluid.littleComponent", "autoInit"],
        
        components: {
            osc: {
                type: "flock.playground.demos.osc",
            },
            
            noise: {
                type: "flock.playground.demos.noise"
            }
        },
        
        demos: [
            "{osc}.options.demos",
            "{noise}.options.demos"
        ]
    });
    
    fluid.defaults("flock.playground.demos.osc", {
        gradeNames: ["fluid.littleComponent", "autoInit"],
        
        demos: {
            name: "Oscillators",
            demos: [
                {
                    id: "sine",
                    name: "Sine"
                },
                {
                    id: "tri",
                    name: "Triangle"
                },
                {
                    id: "square",
                    name: "Square"
                },
                {
                    id: "saw",
                    name: "Saw"
                },
                {
                    id: "stereo",
                    name: "Stereo"
                }
            ]
        }
    });
    
    fluid.defaults("flock.playground.demos.noise", {
        gradeNames: ["fluid.littleComponent", "autoInit"],
        
        demos: {
            name: "Noise",
            demos: [
                {
                    id: "whitenoise",
                    name: "White noise"
                },
                {
                    id: "pinknoise",
                    name: "Pink noise"
                },
                {
                    id: "dust",
                    name: "Dust"
                },
                {
                    id: "lfNoise",
                    name: "lfNoise"
                },
                {
                    id: "noise-fm",
                    name: "lfNoise &amp; sinOsc"
                },
                {
                    id: "impulse",
                    name: "Impulse"
                },
                {
                    id: "impulse-pm",
                    name: "Impulse Phase Modulation"
                }
            ]
        }
    });
        /*<optgroup label="Simple Waveforms">
            <option value="simple_sin">Sine</option>
            <option value="simple_triangle">Triangle</option>
            <option value="simple_square">Square</option>
            <option value="simple_saw">Saw</option>
            <option value="stereo">Stereo</option>
        </optgroup>
        <optgroup label="Noise">
            <option value="noise_white">White noise</option>
            <option value="noise_pink">Pink noise</option>
            <option value="noise_dust">Dust</option>
            <option value="noise_lf">LFNoise</option>
            <option value="noise_sin">LFNoise &amp; SinOsc</option>
            <option value="noise_impulse">Impulse</option>
            <option value="impulse_phase">Impulse Phase Modulation</option>
        </optgroup>
        <optgroup label="Synthesis Techniques">
            <option value="amp_mod" selected="selected">Amplitude modulation</option>
            <option value="freq_mod">Frequency modulation</option>
            <option value="phase_mod">Phase modulation</option>
            <option value="sum">Additive Synthesis</option>
        </optgroup>
        <optgroup label="Granular Synthesis">
            <option value="granulator">Granulator</option>
        </optgroup>
        <optgroup label="Audio Buffers">
            <option value="playBuffer">Play a buffer</option>
            <option value="playBufferTrigger">Trigger buffer playback</option>
            <option value="readBuffer">Read buffer</option>
            <option value="readBufferPhasor">Read buffer with phasor</option>
        </optgroup>
        <optgroup label="Filters">
            <option value="lowpass">Low pass filter</option>
            <option value="highpass">High pass filter</option>
            <option value="bandpass">Band pass filter</option>
            <option value="bandreject">Band reject filter</option>
            <option value="delay">Delay</option>
            <option value="latch">Sample and Hold</option>
        </optgroup>
        <optgroup label="Envelopes">
            <option value="simpleASR">Simple Attack/Sustain/Release</option>
            <option value="decay">Decay</option>
            <option value="line_freq">SinOsc Freq</option>
            <option value="line_mod">Mod SinOsc Freq</option>
            <option value="line_phase">SinOsc Phase</option>
        </optgroup>
        <optgroup label="DOM UGens">
            <option value="scope">Scope</option>
            <option value="mouse_x">Mouse X</option>
            <option value="mouse_y">Mouse Y</option>
            <option value="mouse_xy">Mouse X &amp; Y</option>
            <option value="mouse_click">Mouse click</option>
        </optgroup>
        <optgroup label="Synths and Scheduling">
            <option value="multipleSynths">Multiple Synths</option>
            <option value="polyphonicSynth">Polyphonic Synth</option>
            <option value="declarativeScheduling">Declarative Scheduling</option>
        </optgroup>*/

    /**********************
     * Code Mirror Editor *
     **********************/
    
    // TODO: Move to a separate ui module.
    fluid.defaults("flock.ui.codeEditor.cm", {
        gradeNames: ["fluid.viewComponent", "autoInit"],

        members: {
            editor: {
                funcName: "CodeMirror",
                args: ["{that}.container", "{that}.options.cmOptions"]
            }
        },
        
        invokers: {
            setContent: {
                funcName: "flock.ui.codeEditor.cm.setContent",
                args: ["{arguments}.0", "{that}.editor", "{that}.events.afterNewContent.fire"]
            }
        },
        
        events: {
            afterNewContent: null
        },
        
        cmOptions: {
            mode: {
                name: "javascript",
                json: true
            },
            autoCloseBrackets: true,
            matchBrackets: true,
            smartIndent: true,
            theme: "flockingcm",
            indentUnit: 4,
            tabSize: 4,
            lineNumbers: true
        }
    });
    
    flock.ui.codeEditor.cm.setContent = function (code, editor, afterNewContent) {
        var doc = editor.getDoc();
        doc.setValue(code);
        afterNewContent(code, doc);
    };
    
    
    /***************
     * Play Button *
     ***************/
    
    // TODO: Move to a separate ui module.
    fluid.defaults("flock.ui.playButton", {
        gradeNames: ["fluid.viewComponent", "autoInit"],
        
        invokers: {
            toggle: {
                funcName: "flock.ui.playButton.toggle",
                args: ["{that}.events.onPlay.fire", "{that}.events.onPause.fire"]
            },
            
            toggleStyles: {
                "this": "$",
                method: "toggleClass",
                args: ["{that}.options.styles.paused", "{that}.options.styles.playing"]
            },

            play: {
                funcName: "{that}.events.onPlay.fire"

            },
            
            pause: {
                funcName: "{that}.events.onPause.fire"
            }
        },
        
        events: {
            onToggle: null,
            onPlay: null,
            onPause: null
        },
        
        listeners: {
            onPlay: [
                {
                    funcName: "{that}.toggleStyles"
                },
                {
                    "this": "$",
                    method: "html",
                    args: ["{that}.options.strings.pause"]
                },
                {
                    funcName: "flock.enviro.shared.play"
                }
            ],
            
            onPause: [
                {
                    funcName: "{that}.toggleStyles"
                },
                {
                    "this": "$",
                    method: "html",
                    args: ["{that}.options.strings.play"]
                },
                {
                    funcName: "flock.enviro.shared.reset"
                }
            ]
        },
        
        strings: {
            pause: "Pause",
            play: "Play",
        },
        
        styles: {
            playing: "playing",
            paused: "paused"
        }
    });

    flock.ui.playButton.toggle = function (onPlay, onPause) {
        if (!flock.enviro.shared.model.isPlaying) {
            onPlay();
        } else {
            onPause();
        }
    };
    
    /*****************
     * Demo Selector *
     *****************/
    
    // TODO: Render the actual widget.
    fluid.defaults("flock.playground.demoSelector", {
        gradeNames: ["fluid.viewComponent", "autoInit"],
        
        defaultURLSpec: {
            pathPrefix: "demos/",
            fileExt: "json"
        },
        
        invokers: {
            loadDemo: {
                funcName: "flock.playground.demoSelector.load",
                args: ["{arguments}.0", "{that}.options.defaultURLSpec", "{that}.events.afterDemoLoaded.fire"]
            },
            
            loadDemoFromURL: {
                funcName: "flock.playground.demoSelect.loadDemoFromURLHash",
                args: ["{that}.container", "{that}.loadDemo"]
            },
            
            updateURL: {
                funcName: "flock.playground.demoSelect.updateURLHash",
                args: ["{arguments}.0.id"]
            }
        },
        
        events: {
            onDemoSelected: null,       // Fires when the user selects a demo.
            afterDemoLoaded: null       // Fires after a demo file has been loaded.
        },
        
        listeners: {
            onCreate: [
                {
                    funcName: "{that}.loadDemoFromURL",
                    args: ["{that}.container", "{that}.events.onDemoSelected"]
                }
            ],
            
            onDemoSelected: [
                {
                    funcName: "{that}.updateURL",
                    args: ["{arguments}.0"]
                },
                {
                    funcName: "{that}.loadDemo",
                    args: ["{arguments}.0"]
                }
            ]
        }
    });
    
    flock.playground.demoSelector.updateURLHash = function (id) {
        if (id) {
            window.location.hash = "#" + id;
        }
    };
    
    flock.playground.demoSelector.loadDemoFromURLHash = function (container, onDemoSelected) {
        var id = window.location.hash;
        if (!id) {
            onDemoSelected();
            return;
        }
        
        id = id.slice(1);
        container.val(id);
    };
    
    flock.playground.demoSelector.load = function (demo, defaultURLSpec, afterDemoLoaded) {
        var url = demo.url || [defaultURLSpec.pathPrefix, ".", defaultURLSpec.fileExt].join();
        
        $.ajax({
            type: "get",
            url: url,
            dataType: "json",
            success: afterDemoLoaded,
            error: function (xhr, textStatus, errorThrown) {
                throw new Error(textStatus + " while loading " + url + ": " + errorThrown);
            }
        });
    };

}());
