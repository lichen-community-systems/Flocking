/*global module*/

module.exports = function(grunt) {

    "use strict";

    var files = {
        jQuery: [
            "node_modules/jquery/dist/jquery.js"
        ],

        jQueryStandalone: [
            "node_modules/infusion/src/framework/core/js/jquery.standalone.js"
        ],

        infusion: [
            "node_modules/infusion/src/framework/core/js/Fluid.js",
            "node_modules/infusion/src/framework/core/js/FluidDebugging.js",
            "node_modules/infusion/src/framework/core/js/FluidIoC.js",
            "node_modules/infusion/src/framework/core/js/DataBinding.js",
            "node_modules/infusion/src/framework/core/js/ModelTransformation.js",
            "node_modules/infusion/src/framework/core/js/ModelTransformationTransforms.js",
            "node_modules/infusion/src/framework/enhancement/js/ContextAwareness.js"
        ],

        infusionViews: [
            "node_modules/infusion/src/framework/core/js/FluidDocument.js",
            "node_modules/infusion/src/framework/core/js/FluidDOMUtilities.js",
            "node_modules/infusion/src/framework/core/js/FluidView.js"
        ],

        miscDeps: [
            // Marcus Geelnard's WebArrayMath polyfill
            "third-party/webarraymath/js/webarraymath.js",
            // Sim.js' random distribution library.
            "third-party/simjs/js/random-0.26.js"
        ],

        flockingBase: [
            "src/core.js",
            "src/node-list.js",
            "src/evaluators.js",
            "src/synths/model.js",
            "src/synths/group.js",
            "src/synths/polyphonic.js",
            "src/synths/band.js",
            "src/buffers.js",
            "src/parser.js",
            "src/audiofile.js",
            "src/flocking-audiofile-converters.js",
            "src/audiofile-encoder.js",
            // flocking-audiofile-compatibility.js is intentionally omitted
            // to reduce the size of the default Flocking build.
            "src/scheduler.js",
            "src/web/webaudio-core.js",
            "src/web/audio-system.js",
            "src/web/buffer-writer.js",
            "src/web/input-device-manager.js",
            "src/web/midi.js",
            "src/midi/controller.js",
            "src/web/native-node-manager.js",
            "src/web/output-manager.js",
            "src/ugens/core.js"
        ],

        flockingUGens: [
            "src/ugens/bandlimited.js",
            "src/ugens/buffer.js",
            "src/ugens/debugging.js",
            "src/ugens/distortion.js",
            "src/ugens/dynamics.js",
            "src/ugens/envelopes.js",
            "src/ugens/filters.js",
            "src/ugens/gates.js",
            "src/ugens/granular.js",
            "src/ugens/listening.js",
            "src/ugens/math.js",
            "src/ugens/midi.js",
            "src/ugens/multichannel.js",
            "src/ugens/oscillators.js",
            "src/ugens/random.js",
            "src/ugens/scheduling.js",
            "src/ugens/triggers.js"
        ],

        flockingViews: [
            "src/gfx.js",
            "src/ugens/browser.js"
        ],

        amdHeader: [
            "build-support/js/amd-header.js"
        ],

        amdFooter: [
            "build-support/js/amd-footer.js"
        ]
    };

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),

        jshint: {
            all: [
                "src/*.js",
                "demos/**/*.js",
                "tests/**/*.js",
                "nodejs/**/*.js",
                "!**/third-party/**"
            ],
            options: {
                jshintrc: true
            }
        },

        concat: {
            options: {
                separator: ";",
                banner: "<%= flock.banners.short %>"
            },

            all: {
                src: [].concat(
                    files.jQuery,
                    files.infusion, files.infusionViews,
                    files.miscDeps,
                    files.flockingBase, files.flockingUGens, files.flockingViews
                ),
                dest: "dist/<%= pkg.name %>-all.js"
            },

            amd: {
                src: [].concat(
                    files.amdHeader,
                    files.infusion,
                    files.miscDeps,
                    files.flockingBase, files.flockingUGens, files.flockingViews,
                    files.amdFooter
                ),
                dest: "dist/<%= pkg.name %>-no-jquery.js"
            },

            base: {
                src: [].concat(
                    files.miscDeps,
                    files.flockingBase
                ),
                dest: "dist/<%= pkg.name %>-base.js"
            }
        },

        uglify: {
            options: {
                banner: "<%= flock.banners.short %>",
                beautify: {
                    ascii_only: true
                }
            },
            all: {
                files: [
                    {
                        expand: true,
                        cwd: "dist/",
                        src: ["*.js"],
                        dest: "dist/",
                        ext: ".min.js",
                    }
                ]
            }
        },

        copy: {
          main: {
              files: [
                {
                    expand: true,
                    flatten: true,
                    src: [
                        "src/flocking-audiofile-compatibility.js",
                        "src/flocking-audiofile-worker.js",
                        "src/flocking-audiofile-converters.js"
                    ],
                    dest: "dist/",
                    filter: "isFile"
                }
            ]
          }
        },

        clean: {
            all: {
                src: ["dist/"]
            }
        },

        watch: {
            scripts: {
                files: ["src/**/*.js", "third-party/**/*.js", "Gruntfile.js"],
                tasks: ["default"],
                options: {
                    spawn: false
                }
            }
        },

        flock: {
            banners: {
                short: "/*! Flocking <%= pkg.version %>, Copyright <%= grunt.template.today('yyyy') %> Colin Clark | flockingjs.org */\n\n"
            }
        }
    });

    // Load relevant Grunt plugins.
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-contrib-watch");

    grunt.registerTask("default", ["jshint", "clean", "concat", "uglify", "copy"]);
};
