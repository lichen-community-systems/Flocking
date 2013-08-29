module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        
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
                    "third-party/infusion/js/FluidIoC.js",
                    "third-party/infusion/js/DataBinding.js",
                    
                    // Marcus Geelnard's DSPI API polyfill
                    "third-party/dspapi/js/dspapi.js",
                    
                    // DataView Polyfill
                    "third-party/polydataview/js/polydataview.js",
                    
                    // Tiny Promise Library
                    "third-party/tiny2-promise/js/tiny2-promise.js",
                    
                    // Flocking
                    "flocking/flocking-core.js",
                    "flocking/flocking-parser.js",
                    "flocking/flocking-audiofile.js",
                    "flocking/flocking-scheduler.js",
                    "flocking/flocking-firefox.js",
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
                banner: "<%= flock.banners.short %>"
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
        
        clean: {
            all: {
                src: ["dist/"]
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

    grunt.registerTask("default", ["clean", "concat", "uglify"]);
};
