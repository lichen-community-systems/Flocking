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

var fluid_3_0_0 = fluid_3_0_0 || {}; // eslint-disable-line no-redeclare
var fluid = fluid || fluid_3_0_0; // eslint-disable-line no-redeclare

(function ($, fluid) {
    "use strict";

    // $().fluid("selectable", args)
    // $().fluid("selectable".that()
    // $().fluid("pager.pagerBar", args)
    // $().fluid("reorderer", options)

    /** Create a "bridge" from code written in the Fluid standard "that-ist" style,
     *  to the standard JQuery UI plugin architecture specified at http://docs.jquery.com/UI/Guidelines .
     *  Every Fluid component corresponding to the top-level standard signature (JQueryable, options)
     *  will automatically convert idiomatically to the JQuery UI standard via this adapter.
     *  Any return value which is a primitive or array type will become the return value
     *  of the "bridged" function - however, where this function returns a general hash
     *  (object) this is interpreted as forming part of the Fluid "return that" pattern,
     *  and the function will instead be bridged to "return this" as per JQuery standard,
     *  permitting chaining to occur. However, as a courtesy, the particular "this" returned
     *  will be augmented with a function that() which will allow the original return
     *  value to be retrieved if desired.
     *  @param {String} name - The name under which the "plugin space" is to be injected into JQuery
     *  @param {Object} peer - The root of the namespace corresponding to the peer object.
     *  @return {Function} - A JQuery UI plugin function.
     */

    fluid.thatistBridge = function (name, peer) {

        var togo = function (funcname) {
            var segs = funcname.split(".");
            var move = peer;
            for (var i = 0; i < segs.length; ++i) {
                move = move[segs[i]];
            }
            var args = [this];
            if (arguments.length === 2) {
                args = args.concat($.makeArray(arguments[1]));
            }

            var ret = move.apply(null, args);
            this.that = function () {
                return ret;
            };
            return ret && ret.constructor && ret.constructor.name === "fluid.componentConstructor" ? this : ret;
        };
        $.fn[name] = togo;
        return togo;
    };

    fluid.thatistBridge("fluid", fluid);
    fluid.thatistBridge("fluid_3_0_0", fluid_3_0_0);

    /*************************************************************************
     * Tabindex normalization - compensate for browser differences in naming
     * and function of "tabindex" attribute and tabbing order.
     *************************************************************************/

    // -- Private functions --


    var normalizeTabindexName = function () {
        return $.browser.msie ? "tabIndex" : "tabindex";
    };

    var canHaveDefaultTabindex = function (elements) {
        if (elements.length <= 0) {
            return false;
        }

        return $(elements[0]).is("a, input, button, select, area, textarea, object");
    };

    var getValue = function (elements) {
        if (elements.length <= 0) {
            return undefined;
        }

        if (!fluid.tabindex.hasAttr(elements)) {
            return canHaveDefaultTabindex(elements) ? Number(0) : undefined;
        }

        // Get the attribute and return it as a number value.
        var value = elements.attr(normalizeTabindexName());
        return Number(value);
    };

    var setValue = function (elements, toIndex) {
        return elements.each(function (i, item) {
            $(item).attr(normalizeTabindexName(), toIndex);
        });
    };

    // -- Public API --

    /**
     * Gets the value of the tabindex attribute for the first item, or sets the tabindex value of all elements
     * if toIndex is specified.
     *
     * @param {jQuery} target - The target element.
     * @param {String|Number} toIndex - (Optional) the tabIndex value to set on the target.
     * @return {Any} - The result of the underlying "get" or "set" operation.
     */
    fluid.tabindex = function (target, toIndex) {
        target = $(target);
        if (toIndex !== null && toIndex !== undefined) {
            return setValue(target, toIndex);
        } else {
            return getValue(target);
        }
    };

    /*
     * Removes the tabindex attribute altogether from each element.
     */
    fluid.tabindex.remove = function (target) {
        target = $(target);
        return target.each(function (i, item) {
            $(item).removeAttr(normalizeTabindexName());
        });
    };

    /*
     * Determines if an element actually has a tabindex attribute present.
     */
    fluid.tabindex.hasAttr = function (target) {
        target = $(target);
        if (target.length <= 0) {
            return false;
        }
        var togo = target.map(
            function () {
                var attributeNode = this.getAttributeNode(normalizeTabindexName());
                return attributeNode ? attributeNode.specified : false;
            }
        );
        return togo.length === 1 ? togo[0] : togo;
    };

    /*
     * Determines if an element either has a tabindex attribute or is naturally tab-focussable.
     */
    fluid.tabindex.has = function (target) {
        target = $(target);
        return fluid.tabindex.hasAttr(target) || canHaveDefaultTabindex(target);
    };

    // Keyboard navigation
    // Public, static constants needed by the rest of the library.
    fluid.a11y = $.a11y || {};

    fluid.a11y.orientation = {
        HORIZONTAL: 0,
        VERTICAL: 1,
        BOTH: 2
    };

    var UP_DOWN_KEYMAP = {
        next: $.ui.keyCode.DOWN,
        previous: $.ui.keyCode.UP
    };

    var LEFT_RIGHT_KEYMAP = {
        next: $.ui.keyCode.RIGHT,
        previous: $.ui.keyCode.LEFT
    };

    // Private functions.
    var unwrap = function (element) {
        return element.jquery ? element[0] : element; // Unwrap the element if it's a jQuery.
    };


    var makeElementsTabFocussable = function (elements) {
        // If each element doesn't have a tabindex, or has one set to a negative value, set it to 0.
        elements.each(function (idx, item) {
            item = $(item);
            if (!item.fluid("tabindex.has") || item.fluid("tabindex") < 0) {
                item.fluid("tabindex", 0);
            }
        });
    };

    // Public API.
    /*
     * Makes all matched elements available in the tab order by setting their tabindices to "0".
     */
    fluid.tabbable = function (target) {
        target = $(target);
        makeElementsTabFocussable(target);
    };

    /***********************************************************************
     * Selectable functionality - geometrising a set of nodes such that they
     * can be navigated (by setting focus) using a set of directional keys
     */

    var CONTEXT_KEY = "selectionContext";
    var NO_SELECTION = -32768;

    var cleanUpWhenLeavingContainer = function (selectionContext) {
        if (selectionContext.activeItemIndex !== NO_SELECTION) {
            if (selectionContext.options.onLeaveContainer) {
                selectionContext.options.onLeaveContainer(
                    selectionContext.selectables[selectionContext.activeItemIndex]
                );
            } else if (selectionContext.options.onUnselect) {
                selectionContext.options.onUnselect(
                    selectionContext.selectables[selectionContext.activeItemIndex]
                );
            }
        }

        if (!selectionContext.options.rememberSelectionState) {
            selectionContext.activeItemIndex = NO_SELECTION;
        }
    };

    /*
     * Does the work of selecting an element and delegating to the client handler.
     */
    var drawSelection = function (elementToSelect, handler) {
        if (handler) {
            handler(elementToSelect);
        }
    };

    /*
     * Does the work of unselecting an element and delegating to the client handler.
     */
    var eraseSelection = function (selectedElement, handler) {
        if (handler && selectedElement) {
            handler(selectedElement);
        }
    };

    var unselectElement = function (selectedElement, selectionContext) {
        eraseSelection(selectedElement, selectionContext.options.onUnselect);
    };

    var selectElement = function (elementToSelect, selectionContext) {
        // It's possible that we're being called programmatically, in which case we should clear any previous selection.
        unselectElement(selectionContext.selectedElement(), selectionContext);

        elementToSelect = unwrap(elementToSelect);
        var newIndex = selectionContext.selectables.index(elementToSelect);

        // Next check if the element is a known selectable. If not, do nothing.
        if (newIndex === -1) {
            return;
        }

        // Select the new element.
        selectionContext.activeItemIndex = newIndex;
        drawSelection(elementToSelect, selectionContext.options.onSelect);
    };

    var selectableFocusHandler = function (selectionContext) {
        return function (evt) {
            // FLUID-3590: newer browsers (FF 3.6, Webkit 4) have a form of "bug" in that they will go bananas
            // on attempting to move focus off an element which has tabindex dynamically set to -1.
            $(evt.target).fluid("tabindex", 0);
            selectElement(evt.target, selectionContext);

            // Force focus not to bubble on some browsers.
            return evt.stopPropagation();
        };
    };

    var selectableBlurHandler = function (selectionContext) {
        return function (evt) {
            $(evt.target).fluid("tabindex", selectionContext.options.selectablesTabindex);
            unselectElement(evt.target, selectionContext);

            // Force blur not to bubble on some browsers.
            return evt.stopPropagation();
        };
    };

    var reifyIndex = async function (sc_that) {
        var elements = sc_that.selectables;
        if (sc_that.activeItemIndex >= elements.length) {
            sc_that.activeItemIndex = (sc_that.options.noWrap ? elements.length - 1 : 0);
        }
        if (sc_that.activeItemIndex < 0 && sc_that.activeItemIndex !== NO_SELECTION) {
            sc_that.activeItemIndex = (sc_that.options.noWrap ? 0 : elements.length - 1);
        }
        if (sc_that.activeItemIndex >= 0) {
            return fluid.focus(elements[sc_that.activeItemIndex]);
        }
    };

    var prepareShift = async function (selectionContext) {
        // FLUID-3590: FF 3.6 and Safari 4.x won't fire blur() when programmatically moving focus.
        var selElm = selectionContext.selectedElement();
        if (selElm) {
            await fluid.blur(selElm);
        }

        unselectElement(selectionContext.selectedElement(), selectionContext);
        if (selectionContext.activeItemIndex === NO_SELECTION) {
            selectionContext.activeItemIndex = -1;
        }
    };

    var focusNextElement = async function (selectionContext) {
        await prepareShift(selectionContext);
        ++selectionContext.activeItemIndex;
        return reifyIndex(selectionContext);
    };

    var focusPreviousElement = async function (selectionContext) {
        await prepareShift(selectionContext);
        --selectionContext.activeItemIndex;
        return reifyIndex(selectionContext);
    };

    var arrowKeyHandler = function (selectionContext, keyMap) {
        return async function (evt) {
            if (evt.which === keyMap.next) {
                await focusNextElement(selectionContext);
                evt.preventDefault();
            } else if (evt.which === keyMap.previous) {
                await focusPreviousElement(selectionContext);
                evt.preventDefault();
            }
        };
    };

    var getKeyMapForDirection = function (direction) {
        // Determine the appropriate mapping for next and previous based on the specified direction.
        var keyMap;
        if (direction === fluid.a11y.orientation.HORIZONTAL) {
            keyMap = LEFT_RIGHT_KEYMAP;
        }
        else if (direction === fluid.a11y.orientation.VERTICAL) {
            // Assume vertical in any other case.
            keyMap = UP_DOWN_KEYMAP;
        }

        return keyMap;
    };

    var tabKeyHandler = function (selectionContext) {
        return function (evt) {
            if (evt.which !== $.ui.keyCode.TAB) {
                return;
            }
            cleanUpWhenLeavingContainer(selectionContext);

            // Catch Shift-Tab and note that focus is on its way out of the container.
            if (evt.shiftKey) {
                selectionContext.focusIsLeavingContainer = true;
            }
        };
    };

    var containerFocusHandler = function (selectionContext) {
        return async function (evt) {
            var shouldOrig = selectionContext.options.autoSelectFirstItem;
            var shouldSelect = typeof(shouldOrig) === "function" ? shouldOrig() : shouldOrig;

            // Override the autoselection if we're on the way out of the container.
            if (selectionContext.focusIsLeavingContainer) {
                shouldSelect = false;
            }

            // This target check works around the fact that sometimes focus bubbles, even though it shouldn't.
            if (shouldSelect && evt.target === selectionContext.container.get(0)) {
                if (selectionContext.activeItemIndex === NO_SELECTION) {
                    selectionContext.activeItemIndex = 0;
                }
                await fluid.focus(selectionContext.selectables[selectionContext.activeItemIndex]);
            }

            // Force focus not to bubble on some browsers.
            return evt.stopPropagation();
        };
    };

    var containerBlurHandler = function (selectionContext) {
        return function (evt) {
            selectionContext.focusIsLeavingContainer = false;

            // Force blur not to bubble on some browsers.
            return evt.stopPropagation();
        };
    };

    var makeElementsSelectable = function (container, defaults, userOptions) {
        var options = $.extend(true, {}, defaults, userOptions);

        var keyMap = getKeyMapForDirection(options.direction);

        var selectableElements = options.selectableElements ? options.selectableElements :
            container.find(options.selectableSelector);

        // Context stores the currently active item(undefined to start) and list of selectables.
        var that = {
            container: container,
            activeItemIndex: NO_SELECTION,
            selectables: selectableElements,
            focusIsLeavingContainer: false,
            options: options
        };

        that.selectablesUpdated = async function (focusedItem) {
            // Remove selectables from the tab order and add focus/blur handlers
            if (typeof(that.options.selectablesTabindex) === "number") {
                that.selectables.fluid("tabindex", that.options.selectablesTabindex);
            }
            that.selectables.off("focus." + CONTEXT_KEY);
            that.selectables.off("blur." + CONTEXT_KEY);
            that.selectables.on("focus." + CONTEXT_KEY, selectableFocusHandler(that));
            that.selectables.on("blur."  + CONTEXT_KEY, selectableBlurHandler(that));
            if (keyMap && that.options.noBubbleListeners) {
                that.selectables.off("keydown." + CONTEXT_KEY);
                that.selectables.on("keydown." + CONTEXT_KEY, arrowKeyHandler(that, keyMap));
            }
            if (focusedItem) {
                selectElement(focusedItem, that);
            }
            else {
                return reifyIndex(that);
            }
        };

        that.refresh = async function () {
            if (!that.options.selectableSelector) {
                fluid.fail("Cannot refresh selectable context which was not initialised by a selector");
            }
            that.selectables = container.find(options.selectableSelector);
            return that.selectablesUpdated();
        };

        that.selectedElement = function () {
            return that.activeItemIndex < 0 ? null : that.selectables[that.activeItemIndex];
        };

        // Add various handlers to the container.
        if (keyMap && !that.options.noBubbleListeners) {
            container.on("keydown", arrowKeyHandler(that, keyMap));
        }
        container.on("keydown", tabKeyHandler(that));
        container.on("focus", containerFocusHandler(that));
        container.on("blur", containerBlurHandler(that));

        that.promise = that.selectablesUpdated();

        return that;
    };

    /*
     * Makes all matched elements selectable with the arrow keys.
     * Supply your own handlers object with onSelect: and onUnselect: properties for custom behaviour.
     * Options provide configurability, including direction: and autoSelectFirstItem:
     * Currently supported directions are jQuery.a11y.directions.HORIZONTAL and VERTICAL.
     */
    fluid.selectable = function (target, options) {
        target = $(target);
        var that = makeElementsSelectable(target, fluid.selectable.defaults, options);
        fluid.setScopedData(target, CONTEXT_KEY, that);
        return that;
    };

    /*
     * Selects the specified element.
     */
    fluid.selectable.select = async function (target, toSelect) {
        return fluid.focus(toSelect);
    };

    /*
     * Selects the next matched element.
     */
    fluid.selectable.selectNext = async function (target) {
        target = $(target);
        return focusNextElement(fluid.getScopedData(target, CONTEXT_KEY));
    };

    /*
     * Selects the previous matched element.
     */
    fluid.selectable.selectPrevious = async function (target) {
        target = $(target);
        return focusPreviousElement(fluid.getScopedData(target, CONTEXT_KEY));
    };

    /*
     * Returns the currently selected item wrapped as a jQuery object.
     */
    fluid.selectable.currentSelection = function (target) {
        target = $(target);
        var that = fluid.getScopedData(target, CONTEXT_KEY);
        return $(that.selectedElement());
    };

    fluid.selectable.defaults = {
        direction: fluid.a11y.orientation.VERTICAL,
        selectablesTabindex: -1,
        autoSelectFirstItem: true,
        rememberSelectionState: true,
        selectableSelector: ".selectable",
        selectableElements: null,
        onSelect: null,
        onUnselect: null,
        onLeaveContainer: null,
        noWrap: false
    };

    /********************************************************************
     *  Activation functionality - declaratively associating actions with
     * a set of keyboard bindings.
     */

    var checkForModifier = function (binding, evt) {
        // If no modifier was specified, just return true.
        if (!binding.modifier) {
            return true;
        }

        var modifierKey = binding.modifier;
        var isCtrlKeyPresent = modifierKey && evt.ctrlKey;
        var isAltKeyPresent = modifierKey && evt.altKey;
        var isShiftKeyPresent = modifierKey && evt.shiftKey;

        return isCtrlKeyPresent || isAltKeyPresent || isShiftKeyPresent;
    };

    /* Constructs a raw "keydown"-facing handler, given a binding entry. This
     *  checks whether the key event genuinely triggers the event and forwards it
     *  to any "activateHandler" registered in the binding.
     */
    var makeActivationHandler = function (binding) {
        return function (evt) {
            var target = evt.target;
            if (!fluid.enabled(target)) {
                return;
            }
            // The following 'if' clause works in the real world, but there's a bug in the jQuery simulation
            // that causes keyboard simulation to fail in Safari, causing our tests to fail:
            //     http://ui.jquery.com/bugs/ticket/3229
            // The replacement 'if' clause works around this bug.
            // When this issue is resolved, we should revert to the original clause.

            // if (evt.which === binding.key && binding.activateHandler && checkForModifier(binding, evt)) {
            var code = evt.which ? evt.which : evt.keyCode;
            if (code === binding.key && binding.activateHandler && checkForModifier(binding, evt)) {
                var event = $.Event("fluid-activate");
                $(target).trigger(event, [binding.activateHandler]);
                if (event.isDefaultPrevented()) {
                    evt.preventDefault();
                }
            }
        };
    };

    var makeElementsActivatable = function (elements, onActivateHandler, defaultKeys, options) {
        // Create bindings for each default key.
        var bindings = [];
        $(defaultKeys).each(function (index, key) {
            bindings.push({
                modifier: null,
                key: key,
                activateHandler: onActivateHandler
            });
        });

        // Merge with any additional key bindings.
        if (options && options.additionalBindings) {
            bindings = bindings.concat(options.additionalBindings);
        }

        fluid.initEnablement(elements);

        // Add listeners for each key binding.
        for (var i = 0; i < bindings.length; ++i) {
            var binding = bindings[i];
            elements.on("keydown", makeActivationHandler(binding));
        }
        elements.on("fluid-activate", function (evt, handler) {
            handler = handler || onActivateHandler;
            return handler ? handler(evt) : null;
        });
    };

    /*
     * Makes all matched elements activatable with the Space and Enter keys.
     * Provide your own handler function for custom behaviour.
     * Options allow you to provide a list of additionalActivationKeys.
     */
    fluid.activatable = function (target, fn, options) {
        target = $(target);
        makeElementsActivatable(target, fn, fluid.activatable.defaults.keys, options);
    };

    /*
     * Activates the specified element.
     */
    fluid.activate = function (target) {
        $(target).trigger("fluid-activate");
    };

    // Public Defaults.
    fluid.activatable.defaults = {
        keys: [$.ui.keyCode.ENTER, $.ui.keyCode.SPACE]
    };


})(jQuery, fluid_3_0_0);
