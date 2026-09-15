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

    fluid.registerNamespace("fluid.debug");

    fluid.debug.toggleClass = function (styles, element, openStyle, closedStyle, state) {
        if (openStyle) {
            element.toggleClass(styles[openStyle], state);
        }
        if (closedStyle) {
            element.toggleClass(styles[closedStyle], !state);
        }
    };

    fluid.debug.bindToggleClick = function (element, applier, path) {
        element.on("click", function () {
            var state = fluid.get(applier.holder.model, path);
            applier.change(path, !state);
        });
    };


    fluid.defaults("fluid.debug.highlighter", {
        gradeNames: ["fluid.viewComponent"],
        selectors: {
            highlightRoot: "#fluid-debug-highlightRoot"
        },
        markup: {
            highlightRoot: "<div id=\"fluid-debug-highlightRoot\" class=\"fluid-debug-highlightRoot\"></div>",
            highlightElement: "<div class=\"fl-debug-highlightElement\"></div>"
        },
        events: {
            highlightClick: null
        },
        listeners: {
            onCreate: "fluid.debug.highlighter.renderRoot"
        },
        invokers: {
            clear: "fluid.debug.highlighter.clear({that}.dom.highlightRoot)",
            highlight: "fluid.debug.highlighter.highlight({that}, {that}.dom.highlightRoot, {arguments}.0)" // dispositions
        }
    });

    fluid.debug.highlighter.renderRoot = function (that) {
        var highlightRoot = $(that.options.markup.highlightRoot);
        that.container.append(highlightRoot);
        highlightRoot.on("click", that.events.highlightClick.fire);
    };

    fluid.debug.highlighter.clear = function (highlightRoot) {
        highlightRoot.empty();
    };

    fluid.debug.highlighter.positionProps = ["width","height","marginLeft","marginTop","paddingLeft","paddingTop"];

    fluid.debug.highlighter.colours = {
        components: [
            [0, 0, 0],    // black
            [255, 0, 0],  // red
            [255, 255, 0] // yellow
        ],
        domBinder: [0, 255, 0],  // green
        renderer:  [0, 255, 255] // cyan
    };

    fluid.debug.arrayToRGBA = function (array) {
        return "rgba(" + array.join(", ") + ")";
    };

    fluid.debug.assignColour = function (colour, alpha) {
        return [colour[0], colour[1], colour[2], alpha];
    };

    fluid.debug.highlighter.indexToColour = function (i, isDomBind, isRenderer) {
        var a = fluid.debug.assignColour, c = fluid.debug.highlighter.colours.components;
        var base;
        if (isRenderer) {
            base = a(fluid.debug.highlighter.colours.renderer, 0.5);
        } else if (isDomBind) {
            base = a(fluid.debug.highlighter.colours.domBinder, 0.5);
        } else {
            base = a(c[i % c.length], i > c.length ? 0.2 : 0.5);
        }
        return base;
    };

    fluid.debug.isRendererSelector = function (component, selectorName) {
        var isRendererComponent = fluid.componentHasGrade(component, "fluid.rendererComponent");
        var ignoreContains = fluid.contains(component.options.selectorsToIgnore, selectorName);

        return isRendererComponent ? (!selectorName || ignoreContains ? false : true) : false;
    };

    fluid.debug.highlighter.disposeEntries = function (entries, domIds) {
        return fluid.transform(entries, function (entry, i) {
            var component = entry.component;
            var container = component.container;
            var element = fluid.jById(domIds[i], container[0].ownerDocument);
            var selectorName = entry.selectorName;
            var isRendererSelector = fluid.debug.isRendererSelector(component, selectorName);
            var noHighlight = container.is("body");
            return {
                component: component,
                container: element,
                noHighlight: noHighlight,
                selectorName: selectorName,
                colour: fluid.debug.highlighter.indexToColour(i, selectorName, isRendererSelector)
            };
        });
    };

    fluid.debug.domIdtoHighlightId = function (domId) {
        return "highlight-for:" + domId;
    };

    fluid.debug.highlighter.construct = function (markup, highlightRoot, container) {
        var highlight = $(markup);
        highlight.prop("id", fluid.debug.domIdtoHighlightId(container.prop("id")));
        highlightRoot.append(highlight);
        return highlight;
    };

    fluid.debug.highlighter.position =  function (highlight, disp, container) {
        var p = fluid.debug.highlighter.positionProps;
        for (var j = 0; j < p.length; ++j) {
            highlight.css(p[j], container.css(p[j] || ""));
        }
        var offset = container.offset();
        var containerBody = container[0].ownerDocument.body;
        if (containerBody !== document.body) { // TODO: This primitive algorithm will not account for nested iframes
            offset.left -= $(containerBody).scrollLeft();
            offset.top -= $(containerBody).scrollTop();
        }
        highlight.offset(offset);
    };

    fluid.debug.highlighter.highlight = function (that, highlightRoot, dispositions) {
        for (var i = 0; i < dispositions.length; ++i) {
            var disp = dispositions[i];
            if (disp.noHighlight) {
                continue;
            }
            var container = disp.container;
            var highlight = fluid.debug.highlighter.construct(that.options.markup.highlightElement, highlightRoot, container);
            highlight.css("background-color", fluid.debug.arrayToRGBA(disp.colour));
            fluid.debug.highlighter.position(highlight, disp, container);
        }
    };

    fluid.debug.ignorableGrades = ["fluid.debug.listeningView", "fluid.debug.listeningPanel", "fluid.debug.listeningRenderer"];

    fluid.debug.frameworkGrades = fluid.frameworkGrades;

    fluid.debug.filterGrades = function (gradeNames) {
        var highestFrameworkIndex = -1;
        var output = [];
        fluid.each(gradeNames, function (gradeName) { // TODO: remove fluid.indexOf
            var findex = fluid.debug.frameworkGrades.indexOf(gradeName);
            if (findex > highestFrameworkIndex) {
                highestFrameworkIndex = findex;
            } else if (findex === -1 && fluid.debug.ignorableGrades.indexOf(gradeName) === -1 && gradeName.indexOf("{") === -1) {
                output.push(gradeName);
            }
        });
        output.push(fluid.debug.frameworkGrades[highestFrameworkIndex]);
        return output;
    };

    fluid.debug.renderDefaults = function (defaultsTemplate, typeName, options) {
        return fluid.stringTemplate(defaultsTemplate, {
            typeName: typeName,
            options: JSON.stringify(options, null, 4)
        });
    };

    fluid.debug.renderSelectorUsageRecurse = function (source, segs, options) {
        if (fluid.isPrimitive(source)) {
            if (typeof(source) === "string" && source.indexOf(options.findString) !== -1) {
                var path = segs.slice(0, 2);
                var usage = fluid.copy(fluid.get(options.fullSource, path));
                fluid.set(options.target, path, usage);
            }
        } else if (fluid.isPlainObject(source)) {
            fluid.each(source, function (value, key) {
                segs.push(key);
                fluid.debug.renderSelectorUsageRecurse(source[key], segs, options);
                segs.pop(key);
            });
        }
    };

    fluid.debug.renderSelectorUsage = function (selectorUsageTemplate, selectorName, options) {
        var target = {}, segs = [], findString = "}.dom." + selectorName;
        fluid.debug.renderSelectorUsageRecurse(options, segs, {
            findString: findString,
            target: target,
            fullSource: options
        });
        var markup = fluid.stringTemplate(selectorUsageTemplate, {selectorUsage: JSON.stringify(target, null, 4)});
        return markup;
    };

    fluid.debug.renderIndexElement = function (indexElTemplate, colour) {
        return fluid.stringTemplate(indexElTemplate, {colour: fluid.debug.arrayToRGBA(colour)});
    };

    fluid.debug.domIdtoRowId = function (domId) {
        return "row-for:" + domId;
    };

    fluid.debug.rowForDomId = function (row, indexElTemplate, disp, rowIdToDomId) {
        row.indexEl = fluid.debug.renderIndexElement(indexElTemplate, disp.colour);
        row.domId = disp.container.prop("id");
        row.rowId = fluid.debug.domIdtoRowId(row.domId);
        rowIdToDomId[row.rowId] = row.domId;
    };

    fluid.debug.renderSelectorUsageRows = function (disp, markup, defaultsIdToContent) {
        var tooltipTriggerId = fluid.allocateGuid();
        var options = disp.component.options;
        defaultsIdToContent[tooltipTriggerId] = fluid.debug.renderSelectorUsage(markup.selectorUsage, disp.selectorName, options);
        var rows = [{
            componentId: "",
            extraTooltipClass: "flc-debug-tooltip-trigger",
            extraGradesClass: "fl-debug-selector-cell",
            grade: options.selectors[disp.selectorName],
            line: disp.selectorName,
            tooltipTriggerId: tooltipTriggerId
        }];
        return rows;
    };

    fluid.debug.renderDefaultsRows = function (oneGrade, markup, defaultsIdToContent) {
        var defaults = fluid.defaultsStore[oneGrade];
        var line = defaults && defaults.callerInfo ? defaults.callerInfo.filename + ":" + defaults.callerInfo.index : "";
        // horrible mixture of semantic levels in this rendering function - don't we need a new renderer!
        var extraTooltipClass = "";
        var tooltipTriggerId = fluid.allocateGuid();
        if (line) {
            extraTooltipClass = "flc-debug-tooltip-trigger";
            defaultsIdToContent[tooltipTriggerId] = fluid.debug.renderDefaults(markup.defaults, oneGrade, defaults.options);
        }
        return {
            rowId: fluid.allocateGuid(),
            indexEl: "",
            domId: "",
            componentId: "",
            grade: oneGrade,
            line: line,
            extraGradesClass: "",
            extraTooltipClass: extraTooltipClass,
            tooltipTriggerId: tooltipTriggerId
        };
    };

    fluid.debug.renderOneDisposition = function (disp, markup, defaultsIdToContent, rowIdToDomId) {
        var rows;
        if (disp.selectorName) {
            rows = fluid.debug.renderSelectorUsageRows(disp, markup, defaultsIdToContent);
        } else {
            var filtered = fluid.debug.filterGrades(disp.component.options.gradeNames);
            rows = fluid.transform(filtered, function (oneGrade) {
                return fluid.debug.renderDefaultsRows(oneGrade, markup, defaultsIdToContent);
            });
            rows[0].componentId = disp.component.id;
        }
        fluid.debug.rowForDomId(rows[0], markup.indexElement, disp, rowIdToDomId);
        return rows;
    };

    fluid.debug.renderInspecting = function (that, paneBody, markup, inspecting) {
        if (!paneBody || !that.highlighter) { // stupid ginger world failure
            return;
        }
        var defaultsIdToContent = {}; // driver for tooltips showing defaults source
        paneBody.empty();
        that.highlighter.clear();

        var ids = fluid.keys(inspecting).reverse(); // TODO: more principled ordering
        var entries = fluid.transform(ids, function (inspectingId) {
            return that.viewMapper.domIdToEntry[inspectingId];
        });
        var dispositions = fluid.debug.highlighter.disposeEntries(entries, ids);
        var rowIdToDomId = {};
        var allRows = fluid.transform(dispositions, function (disp) {
            return fluid.debug.renderOneDisposition(disp, markup, defaultsIdToContent, rowIdToDomId);
        });
        var flatRows = fluid.flatten(allRows);

        var contents = fluid.transform(flatRows, function (row) {
            return fluid.stringTemplate(markup.paneRow, row);
        });
        paneBody.html(contents.join(""));
        that.highlighter.highlight(dispositions);
        that.tooltips.applier.change("idToContent", defaultsIdToContent);
        that.rowIdToDomId = rowIdToDomId;
        that.dispositions = dispositions; // currently for looking up colour
        var initSelection = fluid.arrayToHash(fluid.values(rowIdToDomId));
        that.applier.change("highlightSelected", initSelection);
    };


    fluid.defaults("fluid.debug.browser", {
        gradeNames: ["fluid.viewComponent"],
        model: {
            isOpen: false,
            isInspecting: false,
            isFrozen: false,
            inspecting: {},
            highlightSelected: {}
        },
        members: {
            rowIdToDomId: {}
        },
        modelListeners: {
            isOpen: {
                funcName: "fluid.debug.toggleClass",
                args: ["{that}.options.styles", "{that}.dom.holder", "holderOpen", "holderClosed", "{change}.value"]
            },
            isInspecting: [{
                funcName: "fluid.debug.toggleClass",
                args: ["{that}.options.styles", "{that}.dom.inspectTrigger", "inspecting", null, "{change}.value"]
            }, {
                funcName: "fluid.debug.browser.finishInspecting",
                args: ["{that}", "{change}.value"]
            }],
            inspecting: {
                funcName: "fluid.debug.renderInspecting",
                args: ["{that}", "{that}.dom.paneBody", "{that}.options.markup", "{change}.value"]
            },
            "highlightSelected.*": {
                funcName: "fluid.debug.renderHighlightSelection",
                args: ["{that}", "{change}.value", "{change}.path"]
            }
        },
        styles: {
            holderOpen: "fl-debug-holder-open",
            holderClosed: "fl-debug-holder-closed",
            inspecting: "fl-debug-inspect-active"
        },
        markup: {
            holder: "<div class=\"flc-debug-holder fl-debug-holder\"><div class=\"flc-debug-open-pane-trigger fl-debug-open-pane-trigger\"></div><div class=\"flc-debug-pane fl-debug-pane\"><div class=\"flc-debug-inspect-trigger fl-debug-inspect-trigger\"></div></div></div>",
            pane: "<table><thead><tr><td class=\"fl-debug-pane-index\"></td><td class=\"fl-debug-pane-dom-id\">DOM ID</td><td class=\"fl-debug-pane-component-id\">Component ID</td><td class=\"fl-debug-pane-grades\">Grades / Selector</td><td class=\"fl-debug-pane-line\">Line / Selector name</td></tr></thead><tbody class=\"flc-debug-pane-body\"></tbody></table>",
            paneRow: "<tr class=\"flc-debug-pane-row\" id=\"%rowId\"><td class=\"fl-debug-pane-index\">%indexEl</td><td class=\"flc-debug-dom-id\">%domId</td><td class=\"flc-debug-component-id\">%componentId</td><td class=\"flc-debug-pane-grades %extraGradesClass\">%grade</td><td class=\"flc-debug-pane-line %extraTooltipClass\" id=\"%tooltipTriggerId\">%line</td></tr>",
            indexElement: "<div class=\"flc-debug-pane-indexel\" style=\"background-color: %colour\"></div>",
            defaults: "<pre>fluid.defaults(\"%typeName\", %options);\n</pre>",
            selectorUsage: "<pre>%selectorUsage</pre>"
        },
        selectors: {
            openPaneTrigger: ".flc-debug-open-pane-trigger",
            inspectTrigger: ".flc-debug-inspect-trigger",
            holder: ".fl-debug-holder",
            pane: ".fl-debug-pane",
            paneBody: ".flc-debug-pane-body",
            indexEl: ".flc-debug-pane-indexel",
            row: ".flc-debug-pane-row"
        },
        events: {
            onNewDocument: null,
            onMarkupReady: null,
            highlightClick: null
        },
        listeners: {
            "onCreate.render": {
                priority: "first",
                funcName: "fluid.debug.browser.renderMarkup",
                args: ["{that}", "{that}.options.markup.holder", "{that}.options.markup.pane"]
            },
            "onCreate.toggleTabClick": {
                funcName: "fluid.debug.bindToggleClick",
                args: ["{that}.dom.openPaneTrigger", "{that}.applier", "isOpen"]
            },
            "onCreate.toggleInspectClick": {
                funcName: "fluid.debug.bindToggleClick",
                args: ["{that}.dom.inspectTrigger", "{that}.applier", "isInspecting"]
            },
            "onCreate.bindHighlightSelection": {
                funcName: "fluid.debug.browser.bindHighlightSelection",
                args: ["{that}", "{that}.dom.pane"]
            },
            "onNewDocument.bindHover": {
                funcName: "fluid.debug.browser.bindHover",
                args: ["{that}", "{arguments}.0"]
            },
            "onNewDocument.bindHighlightClick": {
                funcName: "fluid.debug.browser.bindHighlightClick",
                args: ["{that}", "{arguments}.0"]
            },
            highlightClick: {
                funcName: "fluid.debug.browser.highlightClick",
                args: "{that}"
            }
        },
        components: {
            tooltips: {
                createOnEvent: "onMarkupReady",
                type: "fluid.tooltip",
                container: "{browser}.dom.pane",
                options: {
                    items: ".flc-debug-tooltip-trigger",
                    styles: {
                        tooltip: "fl-debug-tooltip"
                    },
                    position: {
                        my: "right center",
                        at: "left center"
                    },
                    duration: 0,
                    delay: 0
                }
            },
            viewMapper: {
                type: "fluid.debug.viewMapper",
                options: {
                    events: {
                        onNewDocument: "{fluid.debug.browser}.events.onNewDocument"
                    }
                }
            },
            highlighter: {
                type: "fluid.debug.highlighter",
                container: "{fluid.debug.browser}.container",
                options: {
                    events: {
                        highlightClick: "{browser}.events.highlightClick"
                    }
                }
            }
        }
    });

    fluid.debug.browser.finishInspecting = function (that, isInspecting) {
        if (!isInspecting) {
            var ation = that.applier.initiate();
            ation.change("inspecting", null, "DELETE"); // TODO - reform this terrible API through FLUID-5373
            ation.change("", {
                "inspecting": {}
            });
            ation.change("isFrozen", false);
            ation.commit();
        }
    };

    // go into frozen state if we are not in it and are inspecting.
    // if we are already frozen, finish inspecting (which will also finish frozen)
    fluid.debug.browser.highlightClick = function (that) {
        if (that.model.isFrozen) {
            that.applier.change("isInspecting", false);
        } else if (that.model.isInspecting) {
            that.applier.change("isFrozen", true);
        }
    };

    fluid.debug.browser.renderMarkup = function (that, holderMarkup, paneMarkup) {
        that.container.append(holderMarkup);
        var debugPane = that.locate("pane");
        debugPane.append(paneMarkup);
        that.events.onMarkupReady.fire();
    };

    fluid.debug.browser.domIdForElement = function (rowIdToDomId, rowSelector, element) {
        var row = $(element).closest(rowSelector);
        if (row.length > 0) {
            var rowId = row[0].id;
            return rowIdToDomId[rowId];
        }
    };

    fluid.debug.browser.bindHighlightSelection = function (that, pane) {
        pane.on("click", that.options.selectors.indexEl, function (evt) {
            var domId = fluid.debug.browser.domIdForElement(that.rowIdToDomId, that.options.selectors.row, evt.target);
            var path = ["highlightSelected", domId];
            that.applier.change(path, !fluid.get(that.model, path));
        });
    };

    fluid.debug.renderHighlightSelection = function (that, newState, path) {
        var domId = path[1];
        var disposition = fluid.find_if(that.dispositions, function (disp) {
            return disp.container.prop("id") === domId;
        });
        if (disposition.noHighlight) {
            return;
        }
        var outColour = fluid.copy(disposition.colour);
        outColour[3] = outColour[3] * (newState ? 1.0 : 0.1);
        var colourString = fluid.debug.arrayToRGBA(outColour);
        var row = fluid.jById(fluid.debug.domIdtoRowId(domId));
        $(that.options.selectors.indexEl, row).css("background-color", colourString);
        fluid.jById(fluid.debug.domIdtoHighlightId(domId)).css("background-color", colourString);
    };

    fluid.debug.browser.bindHighlightClick = function (that, dokkument) {
        // We have a global problem in that we can't accept pointer events on the highlight elements
        // themselves since this will cause their own mouseenter/mouseleave events to self-block.
        dokkument.on("mousedown", "*", function (evt) {
            var target = $(evt.target);
            var holderParents = target.parents(that.options.selectors.holder);
            if (holderParents.length > 0) {
                return;
            }
            if (that.model.isInspecting) {
                that.events.highlightClick.fire();
                return false;
            }
        });
    };

    fluid.debug.browser.bindHover = function (that, dokkument) {
        var listener = function (event) {
            if (!that.model.isInspecting || that.model.isFrozen) {
                return;
            }
            var allParents = $(event.target).parents().addBack().get();
            for (var i = 0; i < allParents.length; ++i) {
                var id = allParents[i].id;
                var entry = that.viewMapper.domIdToEntry[id];
                if (entry) {
                    if (event.type === "mouseleave") {
                        that.applier.change(["inspecting", id], null, "DELETE");
                    } else if (event.type === "mouseenter") {
                        that.applier.change(["inspecting", id], true);
                    }
                }
            }
        };
        dokkument.on("mouseenter mouseleave", "*", listener);
    };

    fluid.defaults("fluid.debug.listeningView", {
        listeners: {
            onCreate: {
                funcName: "fluid.debug.viewMapper.registerView",
                args: ["{fluid.debug.viewMapper}", "{that}", "add"]
            },
            onDestroy: {
                funcName: "fluid.debug.viewMapper.registerView",
                args: ["{fluid.debug.viewMapper}", "{that}", "remove"]
            }
        }
    });

    fluid.defaults("fluid.debug.listeningPanel", {
        listeners: {
            onDomBind: {
                funcName: "fluid.debug.viewMapper.registerView",
                args: ["{fluid.debug.viewMapper}", "{that}", "rebind"]
            }
        }
    });

    fluid.defaults("fluid.debug.listeningRenderer", {
        listeners: {
            afterRender: {
                funcName: "fluid.debug.viewMapper.registerView",
                args: ["{fluid.debug.viewMapper}", "{that}", "rebind"]
            }
        }
    });

    fluid.defaults("fluid.debug.viewMapper", {
        gradeNames: ["fluid.component", "fluid.resolveRoot"],
        members: {
            seenDocuments: {},
            idToEntry: {},
            domIdToEntry: {}
        },
        distributeOptions: [{
            record: "fluid.debug.listeningView",
            target: "{/ fluid.viewComponent}.options.gradeNames"
        }, {
            record: "fluid.debug.listeningPanel",
            target: "{/ fluid.prefs.panel}.options.gradeNames"
        }, {
            record: "fluid.debug.listeningRenderer",
            target: "{/ fluid.rendererComponent}.options.gradeNames"
        }],
        events: {
            onNewDocument: null
        },
        listeners: {
            onCreate: {
                funcName: "fluid.debug.viewMapper.scanInit"
            }
        }
    });

    fluid.debug.viewMapper.registerComponent = function (that, component, containerId) {
        var domBound = fluid.transform(component.options.selectors, function (selector, selectorName) {
            return fluid.allocateSimpleId(component.locate(selectorName));
        });
        var entry = {
            component: component,
            containerId: containerId,
            domBound: domBound
        };
        that.idToEntry[component.id] = entry;
        if (containerId) {
            that.domIdToEntry[containerId] = entry;

            fluid.each(domBound, function (subId, selectorName) {
                var subEntry = $.extend({}, entry);
                subEntry.selectorName = selectorName;
                that.domIdToEntry[subId] = subEntry;
            });
        }
    };

    fluid.debug.viewMapper.deregisterComponent = function (that, id) {
        var entry = that.idToEntry[id];
        delete that.idToEntry[id];
        delete that.domIdToEntry[entry.containerId];
        fluid.each(entry.domBound, function (subId) {
            delete that.domIdToEntry[subId];
        });
    };

    fluid.debug.viewMapper.registerView = function (that, component, action) {
        var id = component.id;
        var containerId = fluid.allocateSimpleId(component.container);
        if (containerId) {
            var dokkument = $(component.container[0].ownerDocument);
            var dokkumentId = fluid.allocateSimpleId(dokkument);
            if (!that.seenDocuments[dokkumentId]) {
                that.seenDocuments[dokkumentId] = true;
                that.events.onNewDocument.fire(dokkument);
            }
        }
        if (action === "add") {
            fluid.debug.viewMapper.registerComponent(that, component, containerId);
        } else if (action === "remove") {
            fluid.debug.viewMapper.deregisterComponent(that, id);
        } else if (action === "rebind") {
            fluid.debug.viewMapper.deregisterComponent(that, id);
            fluid.debug.viewMapper.registerComponent(that, component, containerId);
        }
    };

    fluid.debug.viewMapper.scanInit = function (that) {
        var views = fluid.queryIoCSelector(fluid.rootComponent, "fluid.viewComponent");
        for (var i = 0; i < views.length; ++i) {
            fluid.debug.viewMapper.registerView(that, views[i], true);
        }
    };

    $(function () {
        fluid.debug.browser("body");
    });

})(jQuery, fluid_3_0_0);
