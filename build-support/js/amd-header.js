(function (root, factory) {
    if (typeof exports === "object") {
        // We're in a CommonJS-style loader.
        root.flock = exports;  // Always create the "flock" global.
        factory(exports, require("jquery"));
    } else if (typeof define === "function" && define.amd) {
        // We're in an AMD-style loader.
        define(["exports", "jquery"], function (exports, jQuery) {
            root.flock = exports; // Always create the "flock" global.
            return (root.flock, factory(exports, jQuery));
        });
    } else {
        // Plain old browser.
        root.flock = {};
        factory(root.flock, jQuery);
    }
}(this, function (exports, jQuery) {
    // To hell with isolationism.
    window.jQuery = jQuery;
