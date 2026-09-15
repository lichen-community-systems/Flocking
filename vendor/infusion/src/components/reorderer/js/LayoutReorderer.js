/*
Copyright The Infusion copyright holders
See the AUTHORS.md file at the top-level directory of this distribution and at
https://github.com/fluid-project/infusion/raw/main/AUTHORS.md.

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/main/Infusion-LICENSE.txt
*/

(function ($, fluid) {
    "use strict";

    /**
     * A convenience function for applying the Reorderer to portlets, content blocks, or other chunks of layout with
     * minimal effort.
     *
     * @param {String|Object} container - A CSS-based selector, single-element jQuery object, or DOM element that identifies the DOM element containing the layout.
     * @param {Object} [userOptions] - An optional collection of key/value pairs that can be used to further configure the Layout Reorderer. See: https://wiki.fluidproject.org/display/docs/Layout+Reorderer+API
     * @return {Object} - A newly constructed reorderer component.
     */
    fluid.reorderLayout = function (container, userOptions) {
        var assembleOptions = {
            layoutHandler: "fluid.moduleLayoutHandler",
            selectors: {
                columns: ".flc-reorderer-column",
                modules: ".flc-reorderer-module"
            }
        };
        var options = $.extend(true, assembleOptions, userOptions);
        return fluid.reorderer(container, options);
    };
})(jQuery, fluid_3_0_0);
