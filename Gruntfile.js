module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),

        jshint: {
            all: ["flocking/*.js", "demos/**/*.js", "tests/**/*.js", "!**/third-party/**"],
            options: {
                jshintrc: true
            }
        },

        concat: {
            options: {
                separator: ";",
                banner: "<%= flock.banners.short %>"
            },
            dist: {
                src: [
                    // jQuery
                    "third-party/jquery/js/jquery-2.0.0.js",

                    // Fluid Infusion
                    "third-party/infusion/js/Fluid.js",
                    "third-party/infusion/js/FluidDocument.js",
                    "third-party/infusion/js/FluidDOMUtilities.js",
                    "third-party/infusion/js/FluidDebugging.js",
                    "third-party/infusion/js/FluidIoC.js",
                    "third-party/infusion/js/DataBinding.js",
                    "third-party/infusion/js/ModelTransformation.js",
                    "third-party/infusion/js/ModelTransformationTransforms.js",
                    "third-party/infusion/js/FluidView.js",
                    "third-party/infusion/js/FluidRequests.js",

                    // Marcus Geelnard's DSPI API polyfill
                    "third-party/dspapi/js/dspapi.js",

                    // Sim.js' random distribution library.
                    "third-party/simjs/js/random-0.26.js",

                    // Flocking
                    "flocking/flocking-core.js",
                    "flocking/flocking-buffers.js",
                    "flocking/flocking-parser.js",
                    "flocking/flocking-audiofile.js",
                    "flocking/flocking-scheduler.js",
                    "flocking/flocking-webaudio.js",
                    "flocking/flocking-ugens.js",
                    "flocking/flocking-ugens-browser.js",
                    "flocking/flocking-gfx.js"
                ],
                dest: "dist/<%= pkg.name %>-all.js"
            }
        },

        uglify: {
            options: {
                banner: "<%= flock.banners.short %>",
                beautify: {
                    ascii_only: true
                }
            },
            dist: {
                files: [
                    {
                        expand: true,
                        cwd: 'dist/',
                        src: ['*.js'],
                        dest: 'dist/',
                        ext: '.min.js',
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
                    src: ["flocking/flocking-audiofile*.js"],
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
