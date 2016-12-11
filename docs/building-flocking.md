# Building Flocking #

Flocking ships with pre-built development and production files in the <code>dist</code> directory. For most users, it's suitable to simply load <code>flocking-all.min.js</code> in your HTML file.

For more advanced users, however, Flocking includes a build system that takes care of linting, concatenating, minifying, and organizing the Flocking source tree. The build system is powered by [Grunt](http://gruntjs.com).

The build system will generate a single file that is easy to include in your web page. Before you start, you'll need to have [Node.js](http://nodejs.org) installed. Flocking supports the latest Node.js LTS release (currently, that's Node.js 6.x with npm 3). Once you've installed it, you simply need to install Flocking's depedencies and then run _grunt_.

Install grunt and related dependencies:

    npm install -g grunt-cli
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
            <td>This build doesn't include include any view-related code whatsoever.
            You must provide your own builds of Infusion and jQuery.
            It also does not contain any unit generators beyond the basic set. Use this if you want to choose which unit generators to ship with your application, and if you don't intend to use
            Flocking's UI components, Infusion Views, or jQuery for access to the DOM. This build is also not compatible with browser-based module loaders.</code>
        </tr>
</table>
