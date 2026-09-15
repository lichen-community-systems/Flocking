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

    fluid.registerNamespace("fluid.reorderImages");

    fluid.reorderImages.deriveLightboxCellBase = function (namebase, index) {
        return namebase + "lightbox-cell:" + index + ":";
    };

    fluid.reorderImages.addThumbnailActivateHandler = function (container) {
        var enterKeyHandler = function (evt) {
            if (evt.which === fluid.reorderer.keys.ENTER) {
                var thumbnailAnchors = $("a", evt.target);
                document.location = thumbnailAnchors.attr("href");
            }
        };

        container.keypress(enterKeyHandler);
    };

    // Custom query method seeks all tags descended from a given root with a
    // particular tag name, whose id matches a regex.
    fluid.reorderImages.seekNodesById = function (rootnode, tagname, idmatch) {
        var inputs = rootnode.getElementsByTagName(tagname);
        var togo = [];
        for (var i = 0; i < inputs.length; i += 1) {
            var input = inputs[i];
            var id = input.id;
            if (id && id.match(idmatch)) {
                togo.push(input);
            }
        }
        return togo;
    };

    fluid.reorderImages.createImageCellFinder = function (parentNode, containerId) {
        containerId = containerId || parentNode.prop("id");
        parentNode = fluid.unwrap(parentNode);

        var lightboxCellNamePattern = "^" + fluid.reorderImages.deriveLightboxCellBase(containerId, "[0-9]+") + "$";

        return function () {
            // This orderable finder assumes that the lightbox thumbnails are 'div' elements
            return fluid.reorderImages.seekNodesById(parentNode, "div", lightboxCellNamePattern);
        };
    };

    fluid.reorderImages.seekForm = function (container) {
        return fluid.findAncestor(container, function (element) {
            return $(element).is("form");
        });
    };

    fluid.reorderImages.seekInputs = function (container, reorderform) {
        return fluid.reorderImages.seekNodesById(reorderform,
            "input",
            "^" + fluid.reorderImages.deriveLightboxCellBase(container.prop("id"), "[^:]*") + "reorder-index$");
    };

    fluid.reorderImages.mapIdsToNames = function (container, reorderform) {
        var inputs = fluid.reorderImages.seekInputs(container, reorderform);
        for (var i = 0; i < inputs.length; i++) {
            var input = inputs[i];
            var name = input.name;
            input.name = name || input.id;
        }
    };

    /**
     * Returns a default afterMove listener using the id-based, form-driven scheme for communicating with the server.
     * It is implemented by nesting hidden form fields inside each thumbnail container. The value of these form elements
     * represent the order for each image. This default listener submits the form's default
     * action via AJAX.
     *
     * @param {jQueryable} container - The Image Reorderer's container element.
     * @return {Function} - A function which can be used as a listener for the afterMove event.
     */
    fluid.reorderImages.createIDAfterMoveListener = function (container) {
        var reorderform = fluid.reorderImages.seekForm(container);
        fluid.reorderImages.mapIdsToNames(container, reorderform);

        return function () {
            var inputs, i;
            inputs = fluid.reorderImages.seekInputs(container, reorderform);

            for (i = 0; i < inputs.length; i += 1) {
                inputs[i].value = i;
            }

            if (reorderform && reorderform.action) {
                var order = $(reorderform).serialize();
                $.post(reorderform.action, order, function () { /* No-op response */ });
            }
        };
    };

    // Public ImageReorderer API
    /*
     * Creates a new ImageReorderer instance from the specified parameters, providing full control over how
     * the ImageReorderer is configured.
     */
    fluid.defaults("fluid.reorderImages", {
        gradeNames: ["fluid.reorderer"],
        layoutHandler: "fluid.gridLayoutHandler",
        listeners: {
            "afterMove.postModel": {
                expander: {
                    funcName: "fluid.reorderImages.createIDAfterMoveListener",
                    args: "{that}.container"
                }
            }
        },
        selectors: {
            movables: {
                expander: {
                    funcName: "fluid.reorderImages.createImageCellFinder",
                    args: "{that}.container"
                }
            },
            labelSource: ".flc-reorderer-imageTitle"
        }
    });

    // This function now deprecated. Please use fluid.reorderImages() instead.
    fluid.lightbox = fluid.reorderImages;


})(jQuery, fluid_3_0_0);
