/*global module*/

module.exports = function(grunt) {

    "use strict";

    var files = {
        jQuery: [
            "third-party/jquery/js/jquery.js"
        ],

        infusion: [
            "third-party/infusion/js/Fluid.js",
            "third-party/infusion/js/FluidDebugging.js",
            "third-party/infusion/js/FluidIoC.js",
            "third-party/infusion/js/DataBinding.js",
            "third-party/infusion/js/ModelTransformation.js",
            "third-party/infusion/js/ModelTransformationTransforms.js",
        ],

        infusionViews: [
            "third-party/infusion/js/FluidDocument.js",
            "third-party/infusion/js/FluidDOMUtilities.js",
            "third-party/infusion/js/FluidView.js"
        ],

        miscDeps: [
            // Marcus Geelnard's WebArrayMath polyfill
            "third-party/webarraymath/js/webarraymath.js",
            // Sim.js' random distribution library.
            "third-party/simjs/js/random-0.26.js"
        ],

        flockingBase: [
            "flocking/flocking-core.js",
            "flocking/flocking-buffers.js",
            "flocking/flocking-parser.js",
            "flocking/flocking-audiofile.js",
            "flocking/flocking-audiofile-encoder.js",
            // flocking-audiofile-compatibility.js is intentionally omitted
            // to reduce the size of the default Flocking build.
            "flocking/flocking-scheduler.js",
            "flocking/flocking-webaudio.js",
            "flocking/flocking-webmidi.js",
            "flocking/ugens/core.js"
        ],

        flockingUGens: [
            "flocking/ugens/bandlimited.js",
            "flocking/ugens/buffer.js",
            "flocking/ugens/debugging.js",
            "flocking/ugens/distortion.js",
            "flocking/ugens/dynamics.js",
            "flocking/ugens/envelopes.js",
            "flocking/ugens/filters.js",
            "flocking/ugens/gates.js",
            "flocking/ugens/granular.js",
            "flocking/ugens/listening.js",
            "flocking/ugens/math.js",
            "flocking/ugens/midi.js",
            "flocking/ugens/multichannel.js",
            "flocking/ugens/oscillators.js",
            "flocking/ugens/random.js",
            "flocking/ugens/scheduling.js",
            "flocking/ugens/triggers.js"
        ],

        flockingViews: [
            "flocking/flocking-gfx.js",
            "flocking/ugens/browser.js"
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
                "flocking/*.js",
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
                    files.amdHeader,
                    files.infusion,
                    files.miscDeps,
                    files.flockingBase,
                    files.amdFooter
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
                        "flocking/flocking-audiofile-compatibility.js",
                        "flocking/flocking-audiofile-worker.js"
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
                files: ["flocking/**/*.js", "third-party/**/*.js", "Gruntfile.js"],
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
