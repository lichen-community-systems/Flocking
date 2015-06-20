# Building Flocking #

Flocking ships with pre-built development and production files in the <code>dist</code> directory. For most users, it's suitable to simply load <code>flocking-all.min.js</code> in your HTML file.

For more advanced users, however, Flocking includes a build system that takes care of linting, concatenating, minifying, and organizing the Flocking source tree. The build system is powered by [Grunt](http://gruntjs.com).

The build system will generate a single file that is easy to include in your web page. Before you start, you'll need to have [Node.js](http://nodejs.org) installed. Once you've installed it, you simply need to install Flocking's depedencies and then run _grunt_.

Install grunt and related dependencies:

    npm install

To make a build, simply run:

    grunt

And then link to the Flocking file in your HTML:

    <script src="flocking/dist/flocking-all.js"></script>
