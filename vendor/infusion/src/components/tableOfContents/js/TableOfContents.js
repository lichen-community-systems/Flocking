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

    /******
    * ToC *
    *******/
    fluid.registerNamespace("fluid.tableOfContents");

    fluid.tableOfContents.headingTextToAnchorInfo = function (heading) {
        var id = fluid.allocateSimpleId(heading);

        var anchorInfo = {
            id: id,
            url: "#" + id
        };

        return anchorInfo;
    };

    fluid.tableOfContents.locateHeadings = function (that) {
        var headings = that.locate("headings");

        fluid.each(that.options.ignoreForToC, function (sel) {
            headings = headings.not(sel).not(sel + " :header");
        });

        return headings;
    };

    fluid.tableOfContents.refreshView = function (that) {
        var headings = that.locateHeadings();

        that.anchorInfo = fluid.transform(headings, function (heading) {
            return that.headingTextToAnchorInfo(heading);
        });

        var headingsModel = that.modelBuilder.assembleModel(headings, that.anchorInfo);
        that.applier.change("", headingsModel);

        that.events.onRefresh.fire();
    };

    fluid.defaults("fluid.tableOfContents", {
        gradeNames: ["fluid.viewComponent"],
        components: {
            levels: {
                type: "fluid.tableOfContents.levels",
                createOnEvent: "onCreate",
                container: "{tableOfContents}.dom.tocContainer",
                options: {
                    model: {
                        headings: "{tableOfContents}.model"
                    },
                    events: {
                        afterRender: "{tableOfContents}.events.afterRender"
                    },
                    listeners: {
                        "{tableOfContents}.events.onRefresh": "{that}.refreshView"
                    },
                    strings: "{tableOfContents}.options.strings"
                }
            },
            modelBuilder: {
                type: "fluid.tableOfContents.modelBuilder"
            }
        },
        model: [],
        invokers: {
            headingTextToAnchorInfo: "fluid.tableOfContents.headingTextToAnchorInfo",
            locateHeadings: {
                funcName: "fluid.tableOfContents.locateHeadings",
                args: ["{that}"]
            },
            refreshView: {
                funcName: "fluid.tableOfContents.refreshView",
                args: ["{that}"]
            },
            // TODO: is it weird to have hide and show on a component?
            hide: {
                "this": "{that}.dom.tocContainer",
                "method": "hide"
            },
            show: {
                "this": "{that}.dom.tocContainer",
                "method": "show"
            }
        },
        strings: {
            tocHeader: "Table of Contents"
        },
        selectors: {
            headings: ":header:visible",
            tocContainer: ".flc-toc-tocContainer"
        },
        ignoreForToC: {
            tocContainer: "{that}.options.selectors.tocContainer"
        },
        events: {
            onRefresh: null,
            afterRender: null,
            onReady: {
                events: {
                    "onCreate": "onCreate",
                    "afterRender": "afterRender"
                },
                args: ["{that}"]
            }
        },
        listeners: {
            "onCreate.refreshView": "{that}.refreshView"
        }
    });


    /*******************
    * ToC ModelBuilder *
    ********************/
    fluid.registerNamespace("fluid.tableOfContents.modelBuilder");

    fluid.tableOfContents.modelBuilder.toModel = function (headingInfo, modelLevelFn) {
        var headings = fluid.copy(headingInfo);
        var buildModelLevel = function (headings, level) {
            var modelLevel = [];
            while (headings.length > 0) {
                var heading = headings[0];
                if (heading.level < level) {
                    break;
                }
                if (heading.level > level) {
                    var subHeadings = buildModelLevel(headings, level + 1);
                    if (modelLevel.length > 0) {
                        modelLevel[modelLevel.length - 1].headings = subHeadings;
                    } else {
                        modelLevel = modelLevelFn(modelLevel, subHeadings);
                    }
                }
                if (heading.level === level) {
                    modelLevel.push(heading);
                    headings.shift();
                }
            }
            return modelLevel;
        };
        return buildModelLevel(headings, 1);
    };

    fluid.tableOfContents.modelBuilder.gradualModelLevelFn = function (modelLevel, subHeadings) {
        // Clone the subHeadings because we don't want to modify the reference of the subHeadings.
        // the reference will affect the equality condition in generateTree(), resulting an unwanted tree.
        var subHeadingsClone = fluid.copy(subHeadings);
        subHeadingsClone[0].level--;
        return subHeadingsClone;
    };

    fluid.tableOfContents.modelBuilder.skippedModelLevelFn = function (modelLevel, subHeadings) {
        modelLevel.push({headings: subHeadings});
        return modelLevel;
    };

    fluid.tableOfContents.modelBuilder.convertToHeadingObjects = function (that, headings, anchorInfo) {
        headings = $(headings);
        return fluid.transform(headings, function (heading, index) {
            return {
                level: that.headingCalculator.getHeadingLevel(heading),
                text: $(heading).text(),
                url: anchorInfo[index].url
            };
        });
    };

    fluid.tableOfContents.modelBuilder.assembleModel = function (that, headings, anchorInfo) {
        var headingInfo = that.convertToHeadingObjects(headings, anchorInfo);
        return that.toModel(headingInfo);
    };

    fluid.defaults("fluid.tableOfContents.modelBuilder", {
        gradeNames: ["fluid.component"],
        components: {
            headingCalculator: {
                type: "fluid.tableOfContents.modelBuilder.headingCalculator"
            }
        },
        invokers: {
            toModel: {
                funcName: "fluid.tableOfContents.modelBuilder.toModel",
                args: ["{arguments}.0", "{modelBuilder}.modelLevelFn"]
            },
            modelLevelFn: "fluid.tableOfContents.modelBuilder.gradualModelLevelFn",
            convertToHeadingObjects: "fluid.tableOfContents.modelBuilder.convertToHeadingObjects({that}, {arguments}.0, {arguments}.1)", // headings, anchorInfo
            assembleModel: "fluid.tableOfContents.modelBuilder.assembleModel({that}, {arguments}.0, {arguments}.1)" // headings, anchorInfo
        }
    });

    /*************************************
    * ToC ModelBuilder headingCalculator *
    **************************************/
    fluid.registerNamespace("fluid.tableOfContents.modelBuilder.headingCalculator");

    fluid.tableOfContents.modelBuilder.headingCalculator.getHeadingLevel = function (that, heading) {
        return that.options.levels.indexOf(heading.tagName) + 1;
    };

    fluid.defaults("fluid.tableOfContents.modelBuilder.headingCalculator", {
        gradeNames: ["fluid.component"],
        invokers: {
            getHeadingLevel: "fluid.tableOfContents.modelBuilder.headingCalculator.getHeadingLevel({that}, {arguments}.0)" // heading
        },
        levels: ["H1", "H2", "H3", "H4", "H5", "H6"]
    });

    /*************
    * ToC Levels *
    **************/
    fluid.registerNamespace("fluid.tableOfContents.levels");

    /**
     * Create an object model based on the type and ID.  The object should contain an
     * ID that maps the selectors (ie. level1:), and the object should contain a children
     * @param {String} type - Accepted values are: level, items
     * @param {Integer} ID - The current level which is used here as the ID.
     * @return {Object} - An object that models the level based on the type and ID.
     */
    fluid.tableOfContents.levels.objModel = function (type, ID) {
        var objModel = {
            ID: type + ID + ":",
            children: []
        };
        return objModel;
    };

    /*
     * Configure item object when item object has no text, uri, level in it.
     * defaults to add a decorator to hide the bullets.
     */
    fluid.tableOfContents.levels.handleEmptyItemObj = function (itemObj) {
        itemObj.decorators = [{
            type: "addClass",
            classes: "fl-tableOfContents-hide-bullet"
        }];
    };

    /**
     * @param {Object} headingsModel - that.model, the model with all the headings, it should be in the format of {headings: [...]}
     * @param {Integer} currentLevel - the current level we want to generate the tree for.  default to 1 if not defined.
     * @return {Object} - A tree that looks like {children: [{ID: x, subTree:[...]}, ...]}
     */
    fluid.tableOfContents.levels.generateTree = function (headingsModel, currentLevel) {
        currentLevel = currentLevel || 0;
        var levelObj = fluid.tableOfContents.levels.objModel("level", currentLevel);

        // FLUID-4352, run generateTree if there are headings in the model.
        if (headingsModel.headings.length === 0) {
            return currentLevel ? [] : {children: []};
        }

        // base case: level is 0, returns {children:[generateTree(nextLevel)]}
        // purpose is to wrap the first level with a children object.
        if (currentLevel === 0) {
            var tree = {
                children: [
                    fluid.tableOfContents.levels.generateTree(headingsModel, currentLevel + 1)
                ]
            };
            return tree;
        }

        // Loop through the heading array, which can have multiple headings on the same level
        $.each(headingsModel.headings, function (index, model) {
            var itemObj = fluid.tableOfContents.levels.objModel("items", currentLevel);
            var linkObj = {
                ID: "link" + currentLevel,
                target: model.url,
                linktext: model.text
            };

            // If level is undefined, then add decorator to it, otherwise add the links to it.
            if (!model.level) {
                fluid.tableOfContents.levels.handleEmptyItemObj(itemObj);
            } else {
                itemObj.children.push(linkObj);
            }
            // If there are sub-headings, go into the next level recursively
            if (model.headings) {
                itemObj.children.push(fluid.tableOfContents.levels.generateTree(model, currentLevel + 1));
            }
            // At this point, the itemObj should be in a tree format with sub-headings children
            levelObj.children.push(itemObj);
        });
        return levelObj;
    };

    /**
     * @param {Object} that - The component itself.
     * @return {Object} - Returned produceTree must be in {headings: [trees]}
     */
    fluid.tableOfContents.levels.produceTree = function (that) {
        var tree = fluid.tableOfContents.levels.generateTree(that.model);
        // Add the header to the tree
        tree.children.push({
            ID: "tocHeader",
            messagekey: "tocHeader"
        });
        return tree;
    };

    fluid.tableOfContents.levels.fetchResources = function (that) {
        fluid.fetchResources(that.options.resources, function () {
            that.container.append(that.options.resources.template.resourceText);
            that.refreshView();
        });
    };


    fluid.defaults("fluid.tableOfContents.levels", {
        gradeNames: ["fluid.rendererComponent"],
        produceTree: "fluid.tableOfContents.levels.produceTree",
        strings: {
            tocHeader: "Table of Contents"
        },
        selectors: {
            tocHeader: ".flc-toc-header",
            level1: ".flc-toc-levels-level1",
            level2: ".flc-toc-levels-level2",
            level3: ".flc-toc-levels-level3",
            level4: ".flc-toc-levels-level4",
            level5: ".flc-toc-levels-level5",
            level6: ".flc-toc-levels-level6",
            items1: ".flc-toc-levels-items1",
            items2: ".flc-toc-levels-items2",
            items3: ".flc-toc-levels-items3",
            items4: ".flc-toc-levels-items4",
            items5: ".flc-toc-levels-items5",
            items6: ".flc-toc-levels-items6",
            link1: ".flc-toc-levels-link1",
            link2: ".flc-toc-levels-link2",
            link3: ".flc-toc-levels-link3",
            link4: ".flc-toc-levels-link4",
            link5: ".flc-toc-levels-link5",
            link6: ".flc-toc-levels-link6"
        },
        repeatingSelectors: ["level1", "level2", "level3", "level4", "level5", "level6", "items1", "items2", "items3", "items4", "items5", "items6"],
        model: {
            headings: [] // [text: heading, url: linkURL, headings: [ an array of subheadings in the same format]
        },
        listeners: {
            "onCreate.fetchResources": "fluid.tableOfContents.levels.fetchResources"
        },
        resources: {
            template: {
                forceCache: true,
                url: "../html/TableOfContents.html"
            }
        },
        rendererFnOptions: {
            noexpand: true
        },
        rendererOptions: {
            debugMode: false
        }

    });

})(jQuery, fluid_3_0_0);
