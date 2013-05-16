module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      options: {
        separator: ';'
      },
      dist: {
        src: [
          'flocking/flocking-core.js',
          'flocking/flocking-scheduler.js',
          'flocking/flocking-firefox.js',
          'flocking/flocking-webaudio.js',
          'flocking/flocking-parser.js',
          'flocking/flocking-ugens.js',
          'flocking/flocking-ugens-browser.js',
          'flocking/flocking-gfx.js',
          'flocking/flocking-audiofile.js', 
        ],
        dest: 'dist/<%= pkg.name %>.js'
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src: 'dist/<%= pkg.name %>.js',
        dest: 'dist/<%= pkg.name %>.min.js'
      }
    },
    clean: {
      all: {
        src: ['dist/']
      }
    }
  });

  // Load the plugin that provides the "concat" task.
  grunt.loadNpmTasks('grunt-contrib-concat');

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');

  // Load the plugin that provides the "clean" task.

  grunt.loadNpmTasks('grunt-contrib-clean');

  // Default task(s).
  grunt.registerTask('default', ['concat', 'uglify']);  

};