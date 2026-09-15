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

    fluid.registerNamespace("fluid.moduleLayout");

    /**
     * Calculate the location of the item and the column in which it resides.
     *
     * @param {Object} item - The item.
     * @param {Object} layout - The layout object.
     * @return {Object} - An object with column index and item index (within that column) properties.
     *                    These indices are -1 if the item does not exist in the grid.
     */
    // unsupported - NON-API function
    fluid.moduleLayout.findColumnAndItemIndices = function (item, layout) {
        return fluid.find(layout.columns,
            function (column, colIndex) {
                var index = $.inArray(item, column.elements);
                return index === -1 ? undefined : {columnIndex: colIndex, itemIndex: index};
            }, {columnIndex: -1, itemIndex: -1});
    };
    // unsupported - NON-API function
    fluid.moduleLayout.findColIndex = function (item, layout) {
        return fluid.find(layout.columns,
            function (column, colIndex) {
                return item === column.container ? colIndex : undefined;
            }, -1);
    };

    /*
     * Move an item within the layout object.
     */
    // unsupported - NON-API function
    fluid.moduleLayout.updateLayout = function (item, target, position, layout) {
        item = fluid.unwrap(item);
        target = fluid.unwrap(target);
        var itemIndices = fluid.moduleLayout.findColumnAndItemIndices(item, layout);
        layout.columns[itemIndices.columnIndex].elements.splice(itemIndices.itemIndex, 1);
        var targetCol;
        if (position === fluid.position.INSIDE) {
            targetCol = layout.columns[fluid.moduleLayout.findColIndex(target, layout)].elements;
            targetCol.splice(targetCol.length, 0, item);

        } else {
            var relativeItemIndices = fluid.moduleLayout.findColumnAndItemIndices(target, layout);
            targetCol = layout.columns[relativeItemIndices.columnIndex].elements;
            position = fluid.dom.normalisePosition(position,
                itemIndices.columnIndex === relativeItemIndices.columnIndex,
                relativeItemIndices.itemIndex, itemIndices.itemIndex);
            var relative = position === fluid.position.BEFORE ? 0 : 1;
            targetCol.splice(relativeItemIndices.itemIndex + relative, 0, item);
        }
    };

    /**
     * Builds a layout object from a set of columns and modules.
     *
     * @param {jQuery} container - The container element.
     * @param {jQuery} columns - One or more jQuery objects representing columns of data.
     * @param {jQuery} portlets - One or more "portlet" elements to include in the layout.
     * @return {Object} - A layout object.
     */
    fluid.moduleLayout.layoutFromFlat = function (container, columns, portlets) {
        var layout = {};
        layout.container = container;
        layout.columns = fluid.transform(columns,
            function (column) {
                return {
                    container: column,
                    elements: fluid.makeArray(portlets.filter(function () {
                        // is this a bug in filter? would have expected "this" to be 1st arg
                        return fluid.dom.isContainer(column, this);
                    }))
                };
            });
        return layout;
    };

    /*
     * Builds a layout object from a serialisable "layout" object consisting of id lists
     */
    fluid.moduleLayout.layoutFromIds = function (idLayout) {
        return {
            container: fluid.byId(idLayout.id),
            columns: fluid.transform(idLayout.columns, function (column) {
                return {
                    container: fluid.byId(column.id),
                    elements: fluid.transform(column.children, fluid.byId)
                };
            })
        };
    };

    /*
     * Serializes the current layout into a structure of ids
     */
    fluid.moduleLayout.layoutToIds = function (idLayout) {
        return {
            id: fluid.getId(idLayout.container),
            columns: fluid.transform(idLayout.columns, function (column) {
                return {
                    id: fluid.getId(column.container),
                    children: fluid.transform(column.elements, fluid.getId)
                };
            })
        };
    };

    fluid.moduleLayout.defaultOnShowKeyboardDropWarning = function (item, dropWarning) {
        if (dropWarning) {
            var offset = $(item).offset();
            dropWarning = $(dropWarning);
            dropWarning.css("position", "absolute");
            dropWarning.css("top", offset.top);
            dropWarning.css("left", offset.left);
        }
    };

    /*
     * Module Layout Handler for reordering content modules.
     *
     * General movement guidelines:
     *
     * - Arrowing sideways will always go to the top (moveable) module in the column
     * - Moving sideways will always move to the top available drop target in the column
     * - Wrapping is not necessary at this first pass, but is ok
     */

    fluid.defaults("fluid.moduleLayoutHandler", {
        gradeNames: ["fluid.layoutHandler"],
        orientation:         fluid.orientation.VERTICAL,
        containerRole:       fluid.reorderer.roles.REGIONS,
        selectablesTabindex: -1,
        sentinelize:         true,
        events: {
            onMove: "{reorderer}.events.onMove",
            onRefresh: "{reorderer}.events.onRefresh",
            onShowKeyboardDropWarning: "{reorderer}.events.onShowKeyboardDropWarning"
        },
        listeners: {
            "onShowKeyboardDropWarning.setPosition": "fluid.moduleLayout.defaultOnShowKeyboardDropWarning",
            onRefresh: {
                priority: "first",
                listener: "{that}.computeLayout"
            },
            onMove: {
                priority: "last",
                listener: "fluid.moduleLayout.onMoveListener",
                args: ["{arguments}.0", "{arguments}.1", "{that}.layout"]
            }
        },
        members: {
            layout: {
                expander: {
                    func: "{that}.computeLayout"
                }
            },
            getRelativePosition: { // TODO: an old-fashioned function member - convert to invoker
                expander: {
                    funcName: "fluid.reorderer.relativeInfoGetter",
                    args: [ "{that}.options.orientation", fluid.reorderer.WRAP_LOCKED_STRATEGY, fluid.reorderer.GEOMETRIC_STRATEGY,
                        "{that}.dropManager", "{that}.options.disableWrap"]
                }
            }
        },
        invokers: { // Use very specific arguments for selectors to avoid circularity
            // also, do not share our DOM binder for our own selectors with parent, to avoid inability to
            // update DOM binder's selectors after initialisation - and since we require a DOM binder in order to compute
            // the modified selectors for upward injection
            computeLayout: {
                funcName: "fluid.moduleLayout.computeLayout",
                args: ["{that}", "{reorderer}.options.selectors.modules", "{that}.dom"]
            },
            computeModules: { // guarantees to read "layout" on every call
                funcName: "fluid.moduleLayout.computeModules",
                args: ["{that}.layout", "{that}.isLocked", "{arguments}.0"]
            },
            makeComputeModules: { // expander function to create DOM locators
                funcName: "fluid.moduleLayout.makeComputeModules",
                args: ["{that}", "{arguments}.0"]
            },
            isLocked: {
                funcName: "fluid.moduleLayout.isLocked",
                args: ["{arguments}.0", "{reorderer}.options.selectors.lockedModules", "{that}.reordererDom"]
            },
            getGeometricInfo: "fluid.moduleLayout.getGeometricInfo({that})",
            getModel: "fluid.moduleLayout.getModel({that})"
        },
        selectors: {
            modules: "{reorderer}.options.selectors.modules",
            columns: "{reorderer}.options.selectors.columns"
        },
        distributeOptions: {
            target: "{reorderer}.options",
            record: {
                selectors: {
                    movables: {
                        expander: {
                            func: "{that}.makeComputeModules",
                            args: [false]
                        }
                    },
                    dropTargets: {
                        expander: {
                            func: "{that}.makeComputeModules",
                            args: [false]
                        }
                    },
                    selectables: {
                        expander: {
                            func: "{that}.makeComputeModules",
                            args: [true]
                        }
                    }
                }
            }
        }
    });

    fluid.moduleLayout.getGeometricInfo = function (that) {
        var options = that.options;
        var extents = [];
        var togo = {extents: extents, sentinelize: options.sentinelize};
        togo.elementMapper = function (element) {
            return that.isLocked(element) ? "locked" : null;
        };
        togo.elementIndexer = function (element) {
            var indices = fluid.moduleLayout.findColumnAndItemIndices(element, that.layout);
            return {
                index: indices.itemIndex,
                length: that.layout.columns[indices.columnIndex].elements.length,
                moduleIndex: indices.columnIndex,
                moduleLength: that.layout.columns.length
            };
        };
        for (var col = 0; col < that.layout.columns.length; col++) {
            var column = that.layout.columns[col];
            var thisEls = {
                orientation: options.orientation,
                elements: fluid.makeArray(column.elements),
                parentElement: column.container
            };
            //  fluid.log("Geometry col " + col + " elements " + fluid.dumpEl(thisEls.elements) + " isLocked [" +
            //       fluid.transform(thisEls.elements, togo.elementMapper).join(", ") + "]");
            extents.push(thisEls);
        }
        return togo;
    };

    fluid.moduleLayout.getModel = function (that) {
        return fluid.moduleLayout.layoutToIds(that.layout); // note that that.layout is a "volatile member"
    };

    fluid.moduleLayout.computeLayout = function (that, modulesSelector, dom) {
        var togo;
        if (modulesSelector) {
            togo = fluid.moduleLayout.layoutFromFlat(that.container, dom.locate("columns"), dom.locate("modules"));
        }
        if (!togo) { // TODO: this branch appears to be unspecified and untested
            var idLayout = fluid.get(that.options, "moduleLayout.layout");
            togo = fluid.moduleLayout.layoutFromIds(idLayout);
        }
        that.layout = togo;
        return togo;
    };

    fluid.moduleLayout.computeModules = function (layout, isLocked, all) {
        var modules = fluid.accumulate(layout.columns, function (column, list) {
            return list.concat(column.elements); // note that concat will not work on a jQuery
        }, []);
        if (!all) {
            fluid.remove_if(modules, isLocked);
        }
        return modules;
    };

    fluid.moduleLayout.makeComputeModules = function (that, all) {
        return function () {
            return that.computeModules(all);
        };
    };

    fluid.moduleLayout.isLocked = function (item, lockedModulesSelector, dom) {
        var lockedModules = lockedModulesSelector ? dom.fastLocate("lockedModules") : [];
        return $.inArray(item, lockedModules) !== -1;
    };

    fluid.moduleLayout.onMoveListener = function (item, requestedPosition, layout) {
        fluid.moduleLayout.updateLayout(item, requestedPosition.element, requestedPosition.position, layout);
    };

})(jQuery, fluid_3_0_0);
