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

Description of Each Build
--------------------------

<table>
    <tr>
        <th>Filename</th>
        <th>Description</th>
    </tr>
        <tr>
            <td><code>flocking-all.js</code></td>
            <td>All of Flocking and all its dependencies. Use this file if you're not using a module loader and want a simple way to link Flocking into your web page.</code>
        </tr>
        <tr>
            <td><code>flocking-no-jquery.js</code></td>
            <td>All of Flocking's dependencies except jQuery. This build is CommonJS/AMD/CMD/whatever module system friendly.</code>
        </tr>
        <tr>
            <td><code>flocking-base.js</code></td>
            <td>Like <code>flocking-no-jquery.js</code>, except this build doesn't include any unit generators beyond the basic set, nor does it include any View-related code (such as <code>gfx.js</code>). Use this if you want to choose which unit generators to ship with your application, and if you're not using any of Flocking's UI components.</code>
        </tr>
</table>
