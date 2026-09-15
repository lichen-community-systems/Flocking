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

    /*******************************************************************************
     * wordSpace
     *
     * Sets the word space on the container to the number of units to increase
     * the word space by. If a negative number is provided, the space between
     * characters will decrease. Setting the value to 1 or unit to 0 will use the
     * default word space.
     *******************************************************************************/

    // Note that the implementors need to provide the container for this view component
    fluid.defaults("fluid.prefs.enactor.wordSpace", {
        gradeNames: ["fluid.prefs.enactor.spacingSetter"],
        preferenceMap: {
            "fluid.prefs.wordSpace": {
                "model.value": "value"
            }
        },
        cssProp: "word-spacing"
    });

})(jQuery, fluid_3_0_0);
