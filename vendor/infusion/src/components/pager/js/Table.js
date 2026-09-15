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

    // cf. ancient SVN-era version in bitbucket at https://bitbucket.org/fluid/infusion/src/adf319d9b279/branches/FLUID-2881/src/webapp/components/pager/js/Table.js

    fluid.registerNamespace("fluid.table");

    fluid.table.findColumnDef = function (columnDefs, key) {
        return fluid.find_if(columnDefs, function (def) {
            return def.key === key;
        });
    };

    fluid.table.getRoots = function (target, dataOffset, index) {
        target.shortRoot = index;
        target.longRoot = fluid.pathUtil.composePath(dataOffset, target.shortRoot);
    };

    // TODO: This crazed variable expansion system was a sketch for what eventually became the "protoComponent expansion system" delivered in 1.x versions of
    // Infusion. It in turn should be abolished when FLUID-4260 is implemented, allowing users to code with standard Fluid components and standard IoC references

    fluid.table.expandPath = function (EL, shortRoot, longRoot) {
        if (EL.charAt(0) === "*") {
            return longRoot + EL.substring(1);
        } else {
            return EL.replace("*", shortRoot);
        }
    };

    fluid.table.fetchValue = function (dataOffset, dataModel, index, valuebinding, roots) {
        fluid.table.getRoots(roots, dataOffset, index);

        var path = fluid.table.expandPath(valuebinding, roots.shortRoot, roots.longRoot);
        return fluid.get(dataModel, path);
    };

    fluid.table.rowComparator = function (sortDir) {
        return function (arec, brec) {
            return (arec.value > brec.value ? 1 : (arec.value < brec.value ? -1 : 0)) * sortDir;
        };
    };

    fluid.table.basicSorter = function (columnDefs, dataModel, dataOffset, model) {
        var roots = {};
        var columnDef = fluid.table.findColumnDef(columnDefs, model.sortKey);
        var sortrecs = [];
        for (var i = 0; i < model.totalRange; ++i) {
            sortrecs[i] = {
                index: i,
                value: fluid.table.fetchValue(dataOffset, dataModel, i, columnDef.valuebinding, roots)
            };
        }

        sortrecs.sort(fluid.table.rowComparator(model.sortDir));
        return fluid.getMembers(sortrecs, "index");
    };

    fluid.table.IDforColumn = function (columnDef, keyPrefix, roots) {
        var EL = columnDef.valuebinding;
        var key = columnDef.key;
        if (!EL) {
            fluid.fail("Error in definition for column with key " + key + ": valuebinding is not set");
        }
        if (!key) {
            var segs = fluid.model.parseEL(EL);
            key = segs[segs.length - 1];
        }
        return {
            ID: (keyPrefix || "") + key,
            EL: fluid.table.expandPath(EL, roots.shortRoot, roots.longRoot)
        };
    };


    fluid.table.bigHeaderForKey = function (key, options) {
        // TODO: ensure this is shared properly
        var id = options.rendererOptions.idMap["header:" + key];
        var smallHeader = fluid.jById(id);
        if (smallHeader.length === 0) {
            return null;
        }
        var headerSortStylisticOffset = options.selectors.headerSortStylisticOffset;
        var bigHeader = fluid.findAncestor(smallHeader, function (element) {
            return $(element).is(headerSortStylisticOffset);
        });
        return bigHeader;
    };

    fluid.table.setSortHeaderClass = function (styles, element, sort) {
        element = $(element);
        element.removeClass(styles.ascendingHeader);
        element.removeClass(styles.descendingHeader);
        if (sort !== 0) {
            element.addClass(sort === 1 ? styles.ascendingHeader : styles.descendingHeader);
            // aria-sort property are specified in the W3C WAI spec, ascending, descending, none, other.
            // since pager currently uses ascending and descending, we do not support the others.
            // http://www.w3.org/WAI/PF/aria/states_and_properties#aria-sort
            element.attr("aria-sort", sort === 1 ? "ascending" : "descending");
        }
    };

    fluid.table.isCurrentColumnSortable = function (columnDefs, model) {
        var columnDef = model.sortKey ? fluid.table.findColumnDef(columnDefs, model.sortKey) : null;
        return columnDef ? columnDef.sortable : false;
    };

    fluid.table.setModelSortHeaderClass = function (columnDefs, newModel, options) {
        var styles = options.styles;
        var sort = fluid.table.isCurrentColumnSortable(columnDefs, newModel) ? newModel.sortDir : 0;
        fluid.table.setSortHeaderClass(styles, fluid.table.bigHeaderForKey(newModel.sortKey, options), sort);
    };


    fluid.table.generateColumnClick = function (tableThat, options, model, columnDef) {
        return function () {
            if (columnDef.sortable === true) {
                var model = tableThat.model;
                var newModel = fluid.copy(model);
                var styles = tableThat.options.styles;
                var oldKey = model.sortKey;
                if (columnDef.key !== model.sortKey) {
                    newModel.sortKey = columnDef.key;
                    newModel.sortDir = 1;
                    var oldBig = fluid.table.bigHeaderForKey(oldKey, options);
                    if (oldBig) {
                        fluid.table.setSortHeaderClass(styles, oldBig, 0);
                    }
                } else if (newModel.sortKey === columnDef.key) {
                    newModel.sortDir = -1 * newModel.sortDir;
                } else {
                    return false;
                }
                newModel.pageIndex = 0;
                tableThat.applier.change("", newModel);
                // fluid.table.setModelSortHeaderClass(newModel, options); - done during rerender, surely
            }
            return false;
        };
    };

    fluid.table.fetchHeaderDecorators = function (decorators, columnDef) {
        return decorators[columnDef.sortable ? "sortableHeader" : "unsortableHeader"];
    };

    fluid.table.generateHeader = function (tableThat, options, newModel) { // arg 2 is renderThat.options
        var sortableColumnTxt = options.strings.sortableColumnText;
        if (newModel.sortDir === 1) {
            sortableColumnTxt = options.strings.sortableColumnTextAsc;
        } else if (newModel.sortDir === -1) {
            sortableColumnTxt = options.strings.sortableColumnTextDesc;
        }
        var columnDefs = tableThat.options.columnDefs;

        return {
            children:
                fluid.transform(columnDefs, function (columnDef) {
                    return {
                        ID: fluid.table.IDforColumn(columnDef, options.keyPrefix, {}).ID,
                        value: columnDef.label,
                        decorators: [
                            {"jQuery": ["on", "click", fluid.table.generateColumnClick(tableThat, options, newModel, columnDef)]},
                            {identify: "header:" + columnDef.key},
                            {type: "attrs", attributes: { title: (columnDef.key === newModel.sortKey) ? sortableColumnTxt : options.strings.sortableColumnText}}
                        ].concat(fluid.table.fetchHeaderDecorators(options.decorators, columnDef))
                    };
                })
        };
    };

    fluid.table.expandVariables = function (value, opts) {
        var togo = "";
        var index = 0;
        while (true) {
            var nextindex = value.indexOf("${", index);
            if (nextindex === -1) {
                togo += value.substring(index);
                break;
            } else {
                togo += value.substring(index, nextindex);
                var endi = value.indexOf("}", nextindex + 2);
                var EL = value.substring(nextindex + 2, endi);
                if (EL === "VALUE") {
                    EL = opts.EL;
                } else {
                    EL = fluid.table.expandPath(EL, opts.shortRoot, opts.longRoot);
                }
                var val = fluid.get(opts.dataModel, EL);
                togo += val;
                index = endi + 1;
            }
        }
        return togo;
    };

    fluid.table.expandPaths = function (target, tree, opts) {
        for (var i in tree) {
            var val = tree[i];
            if (fluid.isMarker(val, fluid.VALUE)) { // TODO, in theory, we could prevent copying of columnDefs
                if (i === "valuebinding") {
                    target[i] = opts.EL;
                } else {
                    target[i] = {"valuebinding" : opts.EL};
                }
            } else if (i === "valuebinding") {
                target[i] = fluid.table.expandPath(tree[i], opts);
            } else if (typeof(val) === "object") {
                target[i] = val.length !== undefined ? [] : {};
                fluid.table.expandPaths(target[i], val, opts);
            } else if (typeof(val) === "string") {
                target[i] = fluid.table.expandVariables(val, opts);
            } else {
                target[i] = tree[i];
            }
        }
        return target;
    };

    fluid.table.expandColumnDefs = function (columnDefs, keyPrefix, dataModel, filteredRow, roots) {
        var tree = fluid.transform(columnDefs, function (columnDef) {
            var record = fluid.table.IDforColumn(columnDef, keyPrefix, roots);
            var opts = $.extend({
                dataModel: dataModel
            }, roots, record);
            var togo;
            if (!columnDef.components) {
                return {
                    ID: record.ID,
                    valuebinding: record.EL
                };
            } else if (typeof columnDef.components === "function") {
                togo = columnDef.components(filteredRow.row, filteredRow.index);
            } else {
                togo = columnDef.components;
            }
            togo = fluid.table.expandPaths({}, togo, opts);
            togo.ID = record.ID;
            return togo;
        });
        return tree;
    };

    fluid.table.fetchDataModel = function (dataModel, dataOffset) {
        return fluid.get(dataModel, dataOffset);
    };

    fluid.table.produceTree = function (tableThat, renderThat) {
        var options = renderThat.options;
        var columnDefs = tableThat.options.columnDefs;
        var roots = {};
        var tree = fluid.transform(tableThat.filtered,
            function (filteredRow) {
                fluid.table.getRoots(roots, tableThat.options.dataOffset, filteredRow.index);
                if (columnDefs === "explode") {
                    return fluid.explode(filteredRow.row, roots.longRoot);
                } else if (columnDefs.length) {
                    return fluid.table.expandColumnDefs(columnDefs, renderThat.options.keyPrefix, tableThat.dataModel, filteredRow, roots);
                }
            });
        var fullTree = {};
        fullTree[options.row] = tree;
        if (typeof(columnDefs) === "object") {
            fullTree[options.header] = fluid.table.generateHeader(tableThat, renderThat.options, tableThat.model);
        }
        return fullTree;
    };

    fluid.table.sortInvoker = function (tableThat, newModel) {
        var columnDefs = tableThat.options.columnDefs;
        var sorted = fluid.table.isCurrentColumnSortable(columnDefs, newModel) ?
            tableThat.options.sorter(columnDefs, tableThat.options.dataModel, tableThat.options.dataOffset, newModel) : null;
        tableThat.permutation = sorted;
    };

    fluid.table.onModelChange = function (tableThat, renderThat, newModel) {
        renderThat.sortInvoker(newModel);
        tableThat.dataModel = tableThat.fetchDataModel();
        tableThat.filtered = tableThat.options.modelFilter(tableThat.dataModel, newModel, tableThat.permutation);
    };

    /** A body renderer implementation which uses the Fluid renderer to render a table section **/

    fluid.defaults("fluid.table.selfRender", {
        gradeNames: ["fluid.rendererComponent"],
        listeners: {
            onCreate: [{
                "this": "{that}.root",
                method: "addClass",
                args: "{that}.options.styles.root"
            }],
            onIndexModelChange: [{
                funcName: "fluid.table.onModelChange",
                namespace: "onModelChange",
                args: ["{fluid.table}", "{fluid.table.selfRender}", "{arguments}.0", "{arguments}.1"] // newModel, oldModel
            }, {
                func: "{that}.sortInvoker",
                namespace: "sortInvoker",
                args: "{arguments}.0"
            }, {
                priority: "last",
                namespace: "refreshView",
                func: "{that}.refreshView"
            }],
            afterRender: { // TODO, should this not be actually renderable?
                funcName: "fluid.table.setModelSortHeaderClass",
                args: ["{that}.options.columnDefs", "{fluid.table}.model", "{that}.options"]
            }
        },
        modelListeners: {
            "{fluid.table}.model": "{that}.events.onIndexModelChange.fire({change}.value, {change}.oldValue)"
        },
        events: {
            onIndexModelChange: null
        },
        invokers: {
            sortInvoker: {
                funcName: "fluid.table.sortInvoker",
                args: ["{fluid.table}", "{arguments}.0"] // newModel
            },
            produceTree: {
                funcName: "fluid.table.produceTree",
                args: ["{fluid.table}", "{fluid.table.selfRender}"]
            }
        },
        selectors: {
            root: ".flc-pager-body-template",
            headerSortStylisticOffset: "{table}.options.selectors.headerSortStylisticOffset",
            header: ".flc-table-header",
            row: ".flc-table-row"
        },
        repeatingSelectors: ["header", "row"],
        selectorsToIgnore: ["root", "headerSortStylisticOffset"],
        styles: {
            root: "fl-pager",
            ascendingHeader: "{table}.options.styles.ascendingHeader",
            descendingHeader: "{table}.options.styles.descendingHeader"
        },
        members: {
            root: "{that}.dom.root"
        },
        decorators: {
            sortableHeader: [],
            unsortableHeader: []
        },
        keyStrategy: "id",
        keyPrefix: "",
        row: "row:", // should match selector name, deprecated after v1.5
        header: "header:", // should match selector name, deprecated after v1.5
        strings: "{table}.options.strings",
        columnDefs: "{table}.options.columnDefs",
        // Options passed upstream to the renderer
        rendererFnOptions: {
            templateSource: {node: "{that}.dom.root"},
            renderTarget: "{that}.dom.root",
            noexpand: true
        },
        rendererOptions: {
            model: "{table}.options.dataModel",
            idMap: {}
        }
    });


    fluid.table.checkTotalRange = function (totalRange, pagerBar) {
        if (totalRange === undefined && !pagerBar) {
            fluid.fail("Error in Pager configuration - cannot determine total range, " +
                    " since not configured in model.totalRange and no PagerBar is configured");
        }
    };

    fluid.defaults("fluid.table", {
        gradeNames: ["fluid.viewComponent"],
        mergePolicy: {
            dataModel: "preserve",
            columnDefs: "noexpand"
        },
        components: {
            bodyRenderer: {
                type: "fluid.table.selfRender",
                container: "{table}.container"
            }
        },
        listeners: {
            onCreate: {
                funcName: "fluid.table.checkTotalRange",
                namespace: "checkTotalRange",
                args: ["{that}.model.totalRange", "{that}.pagerBar"]
            }
        },
        modelFilter: fluid.table.directModelFilter, // TODO: no implementation for this yet
        sorter: fluid.table.basicSorter,
        members: {
            dataModel: {
                expander: {
                    func: "{that}.fetchDataModel"
                }
            }
        },
        invokers: {
            fetchDataModel: {
                funcName: "fluid.table.fetchDataModel",
                args: ["{that}.options.dataModel", "{that}.options.dataOffset"]
            }
        },

        styles: {
            ascendingHeader: "fl-pager-asc",
            descendingHeader: "fl-pager-desc"
        },
        selectors: {
            headerSortStylisticOffset: ".flc-pager-sort-header"
        },
        strings: {
            sortableColumnText: "Select to sort",
            sortableColumnTextDesc: "Select to sort in ascending, currently in descending order.",
            sortableColumnTextAsc: "Select to sort in descending, currently in ascending order."
        },
        // Offset of the tree's "main" data from the overall dataModel root
        dataOffset: "",
        // strategy for generating a tree row, either "explode" or an array of columnDef objects
        columnDefs: [] // [{key: "columnName", valuebinding: "*.valuePath", sortable: true/false}]
    });

})(jQuery, fluid_3_0_0);
