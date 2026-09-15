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

    fluid.registerNamespace("fluid.pagedTable");

    // cf. ancient SVN-era version in bitbucket at https://bitbucket.org/fluid/infusion/src/adf319d9b279/branches/FLUID-2881/src/webapp/components/pager/js/PagedTable.js

    fluid.defaults("fluid.pagedTable.rangeAnnotator", {
        gradeNames: ["fluid.component"]
    });

    // TODO: Get rid of this old-style kind of architecture - we should just react to model changes directly and not inject this
    // peculiar event up and down the place. Probably best to have new renderer first.
    fluid.pagedTable.rangeAnnotator.onRenderPageLinks = function (that, tree, newModel, pagerBar) {
        pagerBar.tooltip.close(); // Close any existing tooltips otherwise they will linger after their parent is destroyed
        var roots = {};
        var column = that.options.annotateColumnRange || (that.options.annotateSortedColumn ? newModel.sortKey : null);
        if (!column) {
            return;
        }
        var dataModel = that.options.dataModel;
        var columnDefs = that.options.columnDefs;
        var columnDef = fluid.table.findColumnDef(columnDefs, column);

        function fetchValue(index) {
            index = that.permutation ? that.permutation[index] : index;
            return fluid.table.fetchValue(that.options.dataOffset, dataModel, index, columnDef.valuebinding, roots);
        }
        var tModel = {};
        fluid.model.copyModel(tModel, newModel);
        var tooltipInfo = {};

        fluid.each(tree, function (cell) {
            if (cell.ID === "page-link:link") {
                var page = cell.pageIndex;
                var start = page * tModel.pageSize;
                tModel.pageIndex = page;
                var limit = fluid.pager.computePageLimit(tModel);
                var iValue = fetchValue(start);
                var lValue = fetchValue(limit - 1);

                tooltipInfo[page] = {
                    first: iValue,
                    last: lValue
                };
            }
        });
        pagerBar.tooltipInfo = tooltipInfo;
    };


    fluid.pagedTable.directModelFilter = function (model, pagerModel, perm) {
        var togo = [];
        var limit = fluid.pager.computePageLimit(pagerModel);
        for (var i = pagerModel.pageIndex * pagerModel.pageSize; i < limit; ++i) {
            var index = perm ? perm[i] : i;
            togo[togo.length] = {index: index, row: model[index]};
        }
        return togo;
    };

    fluid.pagedTable.configureTooltip = function (pagedTable, pagerBar, renderedPageList) {
        var idMap = renderedPageList.rendererOptions.idMap;
        var idToContent = {};
        fluid.each(pagerBar.tooltipInfo, function (value, index) {
            idToContent[idMap["pageLink:" + index]] = fluid.stringTemplate(pagedTable.options.markup.rangeAnnotation, value);
        });
        pagerBar.tooltip.applier.change("idToContent", idToContent);
    };

    fluid.defaults("fluid.pagedTable", {
        gradeNames: ["fluid.pager", "fluid.table"],
        distributeOptions: [{
            target: "{that renderedPageList}.options.listeners.afterRender",
            record: {
                funcName: "fluid.pagedTable.configureTooltip",
                args: ["{pagedTable}", "{pagerBar}", "{arguments}.0"]
                // NB! Use of "pagerBar" depends on FLUID-5258 - we will need a new annotation when this is fixed
            }
        }, {
            target: "{that renderedPageList}.options.listeners.onRenderPageLinks",
            record: {
                funcName: "fluid.pagedTable.rangeAnnotator.onRenderPageLinks",
                args: ["{pagedTable}", "{arguments}.0", "{arguments}.1", "{pagerBar}"] // FLUID-5258 as above
            }
        }, {
            target: "{that pagerBar}.options.components.tooltip",
            source: "{that}.options.tooltip"
        }],
        annotateSortedColumn: false,
        annotateColumnRange: undefined, // specify a "key" from the columnDefs

        markup: {
            rangeAnnotation: "<b> %first </b><br/>&mdash;<br/><b> %last </b>"
        },

        tooltip: {
            type: "fluid.tooltip",
            container: "{that}.container",
            options: {
            }
        },
        invokers: {
            acquireDefaultRange: {
                funcName: "fluid.identity",
                args: "{that}.dataModel.length"
            }
        },
        modelFilter: fluid.pagedTable.directModelFilter,
        model: {
            pageSize: 10
        }
    });


})(jQuery, fluid_3_0_0);
