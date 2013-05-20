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
                    "third-party/jquery/js/*.js",
                    "third-party/**/*.js",
                    "flocking/js/*.js"
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
