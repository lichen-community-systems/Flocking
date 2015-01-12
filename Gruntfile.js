/*global module*/

module.exports = function(grunt) {

    "use strict";

    var files = {
        jQuery: [
            "third-party/jquery/js/jquery.js"
        ],

        infusion: [
            "third-party/infusion/js/Fluid.js",
            "third-party/infusion/js/FluidDocument.js",
            "third-party/infusion/js/FluidDOMUtilities.js",
            "third-party/infusion/js/FluidDebugging.js",
            "third-party/infusion/js/FluidIoC.js",
            "third-party/infusion/js/DataBinding.js",
            "third-party/infusion/js/ModelTransformation.js",
            "third-party/infusion/js/ModelTransformationTransforms.js",
            "third-party/infusion/js/FluidView.js",
            "third-party/infusion/js/FluidRequests.js"
        ],

        miscDeps: [
            // Marcus Geelnard's DSPI API polyfill
            "third-party/dspapi/js/dspapi.js",
            // Sim.js' random distribution library.
            "third-party/simjs/js/random-0.26.js"
        ],

        flocking: [
            "flocking/flocking-core.js",
            "flocking/flocking-buffers.js",
            "flocking/flocking-parser.js",
            "flocking/flocking-audiofile.js",
            // flocking-audiofile-compatibility.js is intentionally omitted
            // to reduce the size of the default Flocking build.
            "flocking/flocking-scheduler.js",
            "flocking/flocking-webaudio.js",
            "flocking/flocking-ugens.js",
            "flocking/flocking-ugens-bandlimited.js",
            "flocking/flocking-envelopes.js",
            "flocking/flocking-ugens-browser.js",
            "flocking/flocking-gfx.js",
            "flocking/flocking-webmidi.js"
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
            all: ["flocking/*.js", "demos/**/*.js", "tests/**/*.js", "nodejs/**/*.js", "!**/third-party/**"],
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
                src: [].concat(files.jQuery, files.infusion, files.miscDeps, files.flocking),
                dest: "dist/<%= pkg.name %>-all.js"
            },

            amd: {
                src: [].concat(
                    files.amdHeader,
                    files.infusion, files.miscDeps, files.flocking,
                    files.amdFooter
                ),
                dest: "dist/<%= pkg.name %>-no-jquery.js"

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

        githooks: {
            all: {
                "pre-commit": "default",
            }
        },

        flock: {
            banners: {
                short: "/*! Flocking <%= pkg.version %> (<%= grunt.template.today('mmmm d, yyyy') %>), Copyright <%= grunt.template.today('yyyy') %> Colin Clark | flockingjs.org */\n\n"
            }
        }
    });

    // Load relevant Grunt plugins.
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-githooks");

    grunt.registerTask("default", ["clean", "jshint", "concat", "uglify", "copy"]);
};
