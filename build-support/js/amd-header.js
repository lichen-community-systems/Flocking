(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define(["jquery"], function (jQuery) {
            // Also create a global in case some scripts
            // that are loaded still are looking for
            // a global even when an AMD loader is in use.
            return (root.flock = factory(jQuery));
        });
    } else {
        // Browser globals
        root.flock = factory(jQuery);
    }
}(this, function (jQuery) {
