/* eslint-env node */
// There are no node modules in this package.  We register ourselves purely to allow people to access our content
// using `fluid.module.resolvePath` and package-relative paths like `%codemirror-infusion/src/codemirror-infusion.js`.
"use strict";
var fluid = require("infusion");
fluid.module.register("codemirror-infusion", __dirname, require);
