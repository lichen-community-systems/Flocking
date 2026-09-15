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

    fluid.registerNamespace("fluid.reorderer");

    fluid.reorderer.defaultAvatarCreator = function (item, cssClass, dropWarning) {
        fluid.dom.cleanseScripts(fluid.unwrap(item));
        var avatar = $(item).clone();

        fluid.dom.iterateDom(avatar.get(0), function (node) {
            node.removeAttribute("id");
            if (node.tagName.toLowerCase() === "input") {
                node.setAttribute("disabled", "disabled");
            }
        });

        avatar.removeProp("id");
        avatar.removeClass("ui-droppable");
        avatar.addClass(cssClass);

        if (dropWarning) {
            // Will a 'div' always be valid in this position?
            var avatarContainer = $(document.createElement("div"));
            avatarContainer.append(avatar);
            avatarContainer.append(dropWarning);
            avatar = avatarContainer;
        }
        $("body").append(avatar);
        if (!$.browser.safari) {
            // FLUID-1597: Safari appears incapable of correctly determining the dimensions of elements
            avatar.css("display", "block").width(item.offsetWidth).height(item.offsetHeight);
        }

        if ($.browser.opera) { // FLUID-1490. Without this detect, curCSS explodes on the avatar on Firefox.
            avatar.hide();
        }
        return avatar;
    };

    // unsupported, NON-API function
    fluid.reorderer.bindHandlersToContainer = function (container, keyDownHandler, keyUpHandler) {
        var actualKeyDown = keyDownHandler;
        var advancedPrevention = false;

        // FLUID-1598 and others: Opera will refuse to honour a "preventDefault" on a keydown.
        // http://forums.devshed.com/javascript-development-115/onkeydown-preventdefault-opera-485371.html
        if ($.browser.opera) {
            container.on("keypress", function (evt) {
                if (advancedPrevention) {
                    advancedPrevention = false;
                    evt.preventDefault();
                    return false;
                }
            });
            actualKeyDown = async function (evt) {
                var oldret = await keyDownHandler(evt);
                if (oldret === false) {
                    advancedPrevention = true;
                }
            };
        }
        container.on("keydown", actualKeyDown);
        container.on("keyup", keyUpHandler);
    };

    // unsupported, NON-API function
    fluid.reorderer.addRolesToContainer = function (that) {
        that.container.attr("role", that.options.containerRole.container);
        that.container.attr("aria-multiselectable", "false");
        that.container.attr("aria-readonly", "false");
        that.container.attr("aria-disabled", "false");
        // FLUID-3707: We require to have BOTH application role as well as our named role
        // This however breaks the component completely under NVDA and causes it to perpetually drop back into "browse mode"
        //that.container.wrap("<div role=\"application\"></div>");
    };

    // unsupported, NON-API function
    fluid.reorderer.createAvatarId = function (parentId) {
        // Generating the avatar's id to be containerId_avatar
        // This is safe since there is only a single avatar at a time
        return parentId + "_avatar";
    };

    /**
     * Constants for key codes in events.
     */
    fluid.reorderer.keys = {
        TAB: 9,
        ENTER: 13,
        SHIFT: 16,
        CTRL: 17,
        ALT: 18,
        META: 19,
        SPACE: 32,
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,
        i: 73,
        j: 74,
        k: 75,
        m: 77
    };

    /**
     * The default key sets for the Reorderer. Should be moved into the proper component defaults.
     */
    fluid.reorderer.defaultKeysets = [
        {
            modifier : function (evt) {
                return evt.ctrlKey;
            },
            up : fluid.reorderer.keys.UP,
            down : fluid.reorderer.keys.DOWN,
            right : fluid.reorderer.keys.RIGHT,
            left : fluid.reorderer.keys.LEFT
        },
        {
            modifier : function (evt) {
                return evt.ctrlKey;
            },
            up : fluid.reorderer.keys.i,
            down : fluid.reorderer.keys.m,
            right : fluid.reorderer.keys.k,
            left : fluid.reorderer.keys.j
        }
    ];

    fluid.reorderer.keysetsPolicy = function (target, source) {
        var value = source ? source : target;
        return fluid.makeArray(value);
    };

    fluid.reorderer.copyDropWarning = function (dropWarning) {
        return dropWarning ? dropWarning.clone() : dropWarning;
    };

    /**
     * @param container - A jQueryable designator for the root node of the reorderer (a selector, a DOM node, or a jQuery instance)
     * @param options - an object containing any of the available options:
     *                  containerRole - indicates the role, or general use, for this instance of the Reorderer
     *                  keysets - an object containing sets of keycodes to use for directional navigation. Must contain:
     *                            modifier - a function that returns a boolean, indicating whether or not the required modifier(s) are activated
     *                            up
     *                            down
     *                            right
     *                            left
     *                  styles - an object containing class names for styling the Reorderer
     *                                  defaultStyle
     *                                  selected
     *                                  dragging
     *                                  hover
     *                                  dropMarker
     *                                  mouseDrag
     *                                  avatar
     *                  avatarCreator - a function that returns a valid DOM node to be used as the dragging avatar
     */

    fluid.defaults("fluid.reorderer", {
        gradeNames: ["fluid.viewComponent"],
        styles: {
            defaultStyle: "fl-reorderer-movable-default",
            selected: "fl-reorderer-movable-selected",
            dragging: "fl-reorderer-movable-dragging",
            mouseDrag: "fl-reorderer-movable-dragging",
            hover: "fl-reorderer-movable-hover",
            dropMarker: "fl-reorderer-dropMarker",
            avatar: "fl-reorderer-avatar"
        },
        selectors: {
            dropWarning: ".flc-reorderer-dropWarning",
            movables:    ".flc-reorderer-movable",
            selectables: ".flc-reorderer-movable",
            dropTargets: ".flc-reorderer-movable",
            grabHandle: ""
        },
        avatarCreator: fluid.reorderer.defaultAvatarCreator,
        keysets: fluid.reorderer.defaultKeysets,
        // These two ginger options injected "upwards" from layoutHandler and actually time its construction (before FLUID-4925)
        containerRole:       "{that}.layoutHandler.options.containerRole",
        selectablesTabindex: "{that}.layoutHandler.options.selectablesTabindex",
        layoutHandler: "fluid.listLayoutHandler",

        members: {
            dropManager: "@expand:fluid.dropManager()", // TODO: this is an old-style "that" which can no longer be supported as a component
            activeItem: null,
            kbDropWarning: "{that}.dom.dropWarning",
            mouseDropWarning: "@expand:fluid.reorderer.copyDropWarning({that}.kbDropWarning)"
        },
        events: {
            onShowKeyboardDropWarning: null,
            onSelect: null,
            onBeginMove: "preventable",
            onMove: null,
            afterMove: null,
            onHover: null, // item, state
            onRefresh: null
        },
        listeners: {
            onCreate: [ {
                namespace: "bindKeyHandlers",
                funcName: "fluid.reorderer.bindHandlersToContainer",
                args: ["{that}.container", "{that}.handleKeyDown", "{that}.handleKeyUp"]
            }, {
                namespace: "addContainerRoles",
                funcName: "fluid.reorderer.addRolesToContainer",
                args: "{that}"
            }, {
                namespace: "makeTabbable",
                funcName: "fluid.tabbable",
                args: "{that}.container"
            }, {
                namespace: "processAfterMoveCallback",
                funcName: "fluid.reorderer.processAfterMoveCallbackUrl",
                args: "{that}"
            },
            "{that}.refresh"],
            onRefresh: {
                listener: "fluid.reorderer.initItems",
                args: "{that}",
                priority: -1000 // TODO: Can't be "first" since moduleLayout needs to respond first
            },
            onHover: {
                funcName: "fluid.reorderer.hoverStyleHandler",
                args: ["{that}.dom", "{that}.options.styles", "{arguments}.0", "{arguments}.1"] // item, state
            }
        },
        invokers: {
            changeSelectedToDefault: {
                funcName: "fluid.reorderer.changeSelectedToDefault",
                args: ["{arguments}.0", "{that}.options.styles"]
            },
            setDropEffects: {
                funcName: "fluid.reorderer.setDropEffects",
                args: ["{that}.dom", "{arguments}.0"]
            },
            createDropMarker: {
                funcName: "fluid.reorderer.createDropMarker",
                args: ["{arguments}.0", "{that}.options.styles.dropMarker"]
            },
            refresh: {
                funcName: "fluid.reorderer.refresh",
                args: ["{that}.dom", "{that}.events", "{that}.selectableContext", "{that}.activeItem"]
            },
            selectItem: {
                funcName: "fluid.reorderer.selectItem",
                args: ["{that}", "{arguments}.0"]
            },
            initSelectables: { // unsupported, NON-API function
                funcName: "fluid.reorderer.initSelectables",
                args: ["{that}"]
            },
            initMovable: { // unsupported, NON-API function
                funcName: "fluid.reorderer.initMovable",
                args: ["{that}", "{that}.dropManager", "{arguments}.0"]
            },
            isMove: { // unsupported, NON-API function
                funcName: "fluid.reorderer.isMove",
                args: ["{that}.options.keysets", "{arguments}.0"] // evt
            },
            isActiveItemMovable: { // unsupported, NON-API function
                funcName: "fluid.reorderer.isActiveItemMovable",
                args: ["{that}.activeItem", "{that}.dom"]
            },
            handleKeyDown: { // unsupported, NON-API function
                funcName: "fluid.reorderer.handleKeyDown",
                args: ["{that}", "{that}.options.styles", "{arguments}.0"] // evt
            },
            handleDirectionKeyDown: { // unsupported, NON-API function
                funcName: "fluid.reorderer.handleDirectionKeyDown",
                args: ["{that}", "{arguments}.0"] // evt
            },
            handleKeyUp: { // unsupported, NON-API function
                funcName: "fluid.reorderer.handleKeyUp",
                args: ["{that}", "{that}.options.styles", "{arguments}.0"] // evt
            },
            requestMovement: { // unsupported, NON-API function
                funcName: "fluid.reorderer.requestMovement",
                args: ["{that}", "{arguments}.0", "{arguments}.1"] // requestedPosition, item
            }
        },

        mergePolicy: {
            keysets: fluid.reorderer.keysetsPolicy,
            "selectors.labelSource": "selectors.grabHandle",
            "selectors.selectables": "selectors.movables",
            "selectors.dropTargets": "selectors.movables"
        },
        components: {
            layoutHandler: {
                type: "{that}.options.layoutHandler",
                container: "{reorderer}.container"
            },
            labeller: {
                type: "fluid.reorderer.labeller",
                options: {
                    members: {
                        dom: "{reorderer}.dom"
                    },
                    getGeometricInfo: "{reorderer}.layoutHandler.getGeometricInfo",
                    orientation: "{reorderer}.layoutHandler.options.orientation",
                    layoutType: "{reorderer}.options.layoutHandler"
                }
            }
        },

        // The user option to enable or disable wrapping of elements within the container
        disableWrap: false
    });

    fluid.reorderer.noModifier = function (evt) {
        return (!evt.ctrlKey && !evt.altKey && !evt.shiftKey && !evt.metaKey);
    };

    // unsupported, NON-API function
    fluid.reorderer.isMove = function (keysets, evt) { // NB, needs dynamic binding
        for (var i = 0; i < keysets.length; i++) {
            if (keysets[i].modifier(evt)) {
                return true;
            }
        }
        return false;
    };

    // unsupported, NON-API function
    fluid.reorderer.isActiveItemMovable = function (activeItem, dom) {
        return $.inArray(activeItem, dom.fastLocate("movables")) >= 0;
    };

    // unsupported, NON-API function
    fluid.reorderer.handleKeyDown = async function (thatReorderer, styles, evt) {
        if (!thatReorderer.activeItem || thatReorderer.activeItem !== evt.target) {
            return true;
        }
        // If the key pressed is ctrl, and the active item is movable we want to restyle the active item.
        var jActiveItem = $(thatReorderer.activeItem);
        if (!jActiveItem.hasClass(styles.dragging) && thatReorderer.isMove(evt)) {
            // Don't treat the active item as dragging unless it is a movable.
            if (thatReorderer.isActiveItemMovable()) {
                jActiveItem.removeClass(styles.selected);
                jActiveItem.addClass(styles.dragging);
                jActiveItem.attr("aria-grabbed", "true");
                thatReorderer.setDropEffects("move");
            }
            return false;
        }
        // The only other keys we listen for are the arrows.
        return thatReorderer.handleDirectionKeyDown(evt);
    };

    // unsupported, NON-API function
    fluid.reorderer.handleDirectionKeyDown = async function (thatReorderer, evt) {
        var item = thatReorderer.activeItem;
        if (!item) {
            return true;
        }
        var keysets = thatReorderer.options.keysets;
        for (var i = 0; i < keysets.length; i++) {
            var keyset = keysets[i];
            var keydir = fluid.keyForValue(keyset, evt.keyCode);
            if (!keydir) {
                continue;
            }
            var isMovement = keyset.modifier(evt);

            var dirnum = fluid.keycodeDirection[keydir];
            var relativeItem = thatReorderer.layoutHandler.getRelativePosition(item, dirnum, !isMovement);
            if (!relativeItem) {
                continue;
            }

            if (isMovement) {
                var prevent = thatReorderer.events.onBeginMove.fire(item);
                if (prevent === false) {
                    return false;
                }
                var kbDropWarning = thatReorderer.kbDropWarning;
                if (kbDropWarning.length > 0) {
                    if (relativeItem.clazz === "locked") {
                        thatReorderer.events.onShowKeyboardDropWarning.fire(item, kbDropWarning);
                        kbDropWarning.show();
                    } else {
                        kbDropWarning.hide();
                    }
                }
                if (relativeItem.element) {
                    thatReorderer.requestMovement(relativeItem, item);
                }

            } else if (fluid.reorderer.noModifier(evt)) {
                await fluid.blur(item);
                await fluid.focus(relativeItem.element);
            }
            return false;
        }
        return true;
    };

    // unsupported, NON-API function
    fluid.reorderer.handleKeyUp = function (thatReorderer, styles, evt) {
        if (!thatReorderer.activeItem || thatReorderer.activeItem !== evt.target) {
            return true;
        }
        var jActiveItem = $(thatReorderer.activeItem);

        // Handle a key up event for the modifier
        if (jActiveItem.hasClass(styles.dragging) && !thatReorderer.isMove(evt)) {
            if (thatReorderer.kbDropWarning) {
                thatReorderer.kbDropWarning.hide();
            }
            jActiveItem.removeClass(styles.dragging);
            jActiveItem.addClass(styles.selected);
            jActiveItem.attr("aria-grabbed", "false");
            thatReorderer.setDropEffects("none");
            return false;
        }
        return false;
    };

    // unsupported, NON-API function
    fluid.reorderer.requestMovement = async function (thatReorderer, requestedPosition, item) {
        item = fluid.unwrap(item);
        // Temporary censoring to get around ModuleLayout inability to update relative to self.
        if (!requestedPosition || fluid.unwrap(requestedPosition.element) === item) {
            return;
        }
        var activeItem = $(thatReorderer.activeItem);

        // Fixes FLUID-3288.
        // Need to remove the blur event as safari will call blur on movements.
        // This caused the user to have to double tap the arrow keys to move.
        activeItem.off("blur.fluid.reorderer");

        thatReorderer.events.onMove.fire(item, requestedPosition);
        thatReorderer.dropManager.geometricMove(item, requestedPosition.element, requestedPosition.position);
        //$(thatReorderer.activeItem).removeClass(options.styles.selected);

        // refocus on the active item because moving places focus on the body
        await fluid.focus(activeItem);

        thatReorderer.refresh();

        thatReorderer.dropManager.updateGeometry(thatReorderer.layoutHandler.getGeometricInfo());

        thatReorderer.events.afterMove.fire(item, requestedPosition, thatReorderer.dom.fastLocate("movables"));
    };

    // unsupported, NON-API function
    fluid.reorderer.hoverStyleHandler = function (dom, styles, item, state) {
        dom.fastLocate("grabHandle", item)[state ? "addClass" : "removeClass"](styles.hover);
    };

    // unsupported, NON-API function
    fluid.reorderer.processAfterMoveCallbackUrl = function (thatReorderer) {
        var options = thatReorderer.options;
        if (options.afterMoveCallbackUrl) {
            thatReorderer.events.afterMove.addListener(function () {
                var layoutHandler = thatReorderer.layoutHandler;
                var model = layoutHandler.getModel ? layoutHandler.getModel() :
                    options.acquireModel(thatReorderer);
                $.post(options.afterMoveCallbackUrl, JSON.stringify(model));
            }, "postModel");
        }
    };

    fluid.reorderer.setDropEffects = function (dom, value) {
        dom.fastLocate("dropTargets").attr("aria-dropeffect", value);
    };

    fluid.reorderer.createDropMarker = function (tagName, dropClass) {
        var dropMarker = $(document.createElement(tagName));
        dropMarker.addClass(dropClass);
        dropMarker.hide();
        return dropMarker;
    };

    fluid.reorderer.changeSelectedToDefault = function (jItem, styles) {
        jItem.removeClass(styles.selected);
        jItem.removeClass(styles.dragging);
        jItem.addClass(styles.defaultStyle);
        jItem.attr("aria-selected", "false");
    };

    fluid.reorderer.initSelectables = function (thatReorderer) {
        var handleBlur = function (evt) {
            thatReorderer.changeSelectedToDefault($(this));
            return evt.stopPropagation();
        };

        var handleFocus = function (evt) {
            thatReorderer.selectItem(this);
            return evt.stopPropagation();
        };

        var handleClick = async function (evt) {
            var handle = fluid.unwrap(thatReorderer.dom.fastLocate("grabHandle", this));
            if (fluid.dom.isContainer(handle, evt.target)) {
                await fluid.focus(this);
            }
        };

        var selectables = thatReorderer.dom.fastLocate("selectables");
        for (var i = 0; i < selectables.length; ++i) {
            var selectable = $(selectables[i]);
            if (!$.data(selectable[0], "fluid.reorderer.selectable-initialised")) {
                selectable.addClass(thatReorderer.options.styles.defaultStyle);

                selectable.on("blur.fluid.reorderer", handleBlur);
                selectable.on("focus", handleFocus);
                selectable.on("click", handleClick);

                selectable.attr("role", thatReorderer.options.containerRole.item);
                selectable.attr("aria-selected", "false");
                selectable.attr("aria-disabled", "false");
                $.data(selectable[0], "fluid.reorderer.selectable-initialised", true);
            }
        }
        if (!thatReorderer.selectableContext) {
            thatReorderer.selectableContext = fluid.selectable(thatReorderer.container, {
                selectableElements: selectables,
                selectablesTabindex: thatReorderer.options.selectablesTabindex,
                direction: null
            });
        }
    };

    fluid.reorderer.selectItem = function (thatReorderer, anItem) {
        thatReorderer.events.onSelect.fire(anItem);
        // Set the previous active item back to its default state.
        if (thatReorderer.activeItem && thatReorderer.activeItem !== anItem) {
            thatReorderer.changeSelectedToDefault($(thatReorderer.activeItem));
        }
        // Then select the new item.
        thatReorderer.activeItem = anItem;
        var jItem = $(anItem);
        var styles = thatReorderer.options.styles;
        jItem.removeClass(styles.defaultStyle);
        jItem.addClass(styles.selected);
        jItem.attr("aria-selected", "true");
    };

    /*
     * Takes a $ object and adds 'movable' functionality to it
     */
    fluid.reorderer.initMovable = function (thatReorderer, dropManager, item) {
        var options = thatReorderer.options;
        var styles = options.styles;
        item.attr("aria-grabbed", "false");

        item.on("mouseover", function () {
            thatReorderer.events.onHover.fire(item, true);
        });

        item.on("mouseout", function () {
            thatReorderer.events.onHover.fire(item, false);
        });
        var avatar;
        var handle = thatReorderer.dom.fastLocate("grabHandle", item);

        item.draggable({
            refreshPositions: false,
            scroll: true,
            helper: function () {
                var dropWarningEl;
                if (thatReorderer.mouseDropWarning) {
                    dropWarningEl = thatReorderer.mouseDropWarning[0];
                }
                avatar = $(options.avatarCreator(item[0], styles.avatar, dropWarningEl));
                avatar.prop("id", fluid.reorderer.createAvatarId(thatReorderer.container.id));
                return avatar;
            },
            start: function (e) {
                var prevent = thatReorderer.events.onBeginMove.fire(item);
                if (prevent === false) {
                    return false;
                }
                var handle = thatReorderer.dom.fastLocate("grabHandle", item)[0];
                var handlePos = fluid.dom.computeAbsolutePosition(handle);
                var handleWidth = handle.offsetWidth;
                var handleHeight = handle.offsetHeight;
                // Typically with `fluid.focus` we'd use async/await to wait for it to complete. However, with this
                // function that can result in breaking the drag and drop interaction. For example with the layout
                // reorderer, after reordering some items, clicking outside of the orderable element retains focus on
                // the reoderable element, but it may no longer be reorderable.
                // see: https://github.com/fluid-project/infusion/pull/1008#discussion_r569525065
                fluid.focus(item);
                item.removeClass(options.styles.selected);
                // all this junk should happen in handler for a new event - although note that mouseDrag style might cause display: none,
                // invalidating dimensions
                item.addClass(options.styles.mouseDrag);
                item.attr("aria-grabbed", "true");
                thatReorderer.setDropEffects("move");
                dropManager.startDrag(e, handlePos, handleWidth, handleHeight);
                avatar.show();
            },
            stop: async function (e, ui) {
                item.removeClass(options.styles.mouseDrag);
                item.addClass(options.styles.selected);
                $(thatReorderer.activeItem).attr("aria-grabbed", "false");
                var markerNode = fluid.unwrap(thatReorderer.dropMarker);
                if (markerNode.parentNode) {
                    markerNode.parentNode.removeChild(markerNode);
                }
                avatar.hide();
                ui.helper = null;
                thatReorderer.setDropEffects("none");
                dropManager.endDrag();

                await thatReorderer.requestMovement(dropManager.lastPosition(), item);
                // refocus on the active item because moving places focus on the body
                await fluid.focus(thatReorderer.activeItem);
            },
            // This explicit detection is now required for jQuery UI after version 1.10.2 since the upstream API has been broken permanently.
            // See https://github.com/jquery/jquery-ui/pull/963
            handle: fluid.unwrap(handle) === fluid.unwrap(item) ? null : handle
        });
    };

    fluid.reorderer.initItems = function (thatReorderer) {
        var movables = thatReorderer.dom.fastLocate("movables");
        var dropTargets = thatReorderer.dom.fastLocate("dropTargets");
        thatReorderer.initSelectables();

        // Setup movables
        for (var i = 0; i < movables.length; i++) {
            var item = movables[i];
            if (!$.data(item, "fluid.reorderer.movable-initialised")) {
                thatReorderer.initMovable($(item));
                $.data(item, "fluid.reorderer.movable-initialised", true);
            }
        }
        // In order to create valid html, the drop marker is the same type as the node being dragged.
        // This creates a confusing UI in cases such as an ordered list.
        if (movables.length > 0 && !thatReorderer.dropMarker) {
            thatReorderer.dropMarker = thatReorderer.createDropMarker(movables[0].tagName);
        }

        thatReorderer.dropManager.updateGeometry(thatReorderer.layoutHandler.getGeometricInfo());

        var dropChangeListener = function (dropTarget) {
            fluid.dom.moveDom(thatReorderer.dropMarker, dropTarget.element, dropTarget.position);
            thatReorderer.dropMarker.css("display", "");
            if (thatReorderer.mouseDropWarning) {
                if (dropTarget.lockedelem) {
                    thatReorderer.mouseDropWarning.show();
                } else {
                    thatReorderer.mouseDropWarning.hide();
                }
            }
        };

        thatReorderer.dropManager.dropChangeFirer.addListener(dropChangeListener, "fluid.reorderer");
        // Set up dropTargets
        dropTargets.attr("aria-dropeffect", "none");

    };

    fluid.reorderer.refresh = function (dom, events, selectableContext, activeItem) {
        dom.refresh("movables");
        dom.refresh("selectables");
        dom.refresh("grabHandle", dom.fastLocate("movables"));
        dom.refresh("dropTargets");
        if (selectableContext) { // if it didn't exist on dispatch, it must be up to date now
            selectableContext.selectables = dom.fastLocate("selectables");
            selectableContext.selectablesUpdated(activeItem);
        }
        events.onRefresh.fire(); // This should be last otherwise handlers will see stale DOM binder contents
    };

    /**
     * These roles are used to add ARIA roles to orderable items. This list can be extended as needed,
     * but the values of the container and item roles must match ARIA-specified roles.
     */
    fluid.reorderer.roles = {
        GRID: { container: "grid", item: "gridcell" },
        LIST: { container: "list", item: "listitem" },
        REGIONS: { container: "main", item: "article" }
    };

    fluid.defaults("fluid.reorderList", {
        gradeNames: ["fluid.reorderer"],
        layoutHandler: "fluid.listLayoutHandler"
    });

    fluid.defaults("fluid.reorderGrid", {
        gradeNames: ["fluid.reorderer"],
        layoutHandler: "fluid.gridLayoutHandler"
    });

    fluid.reorderer.SHUFFLE_GEOMETRIC_STRATEGY = "shuffleProjectFrom";
    fluid.reorderer.GEOMETRIC_STRATEGY         = "projectFrom";
    fluid.reorderer.LOGICAL_STRATEGY           = "logicalFrom";
    fluid.reorderer.WRAP_LOCKED_STRATEGY       = "lockedWrapFrom";
    fluid.reorderer.NO_STRATEGY = null;

    // unsupported, NON-API function
    fluid.reorderer.relativeInfoGetter = function (orientation, coStrategy, contraStrategy, dropManager, disableWrap) {
        return function (item, direction, forSelection) {
            var dirorient = fluid.directionOrientation(direction);
            var strategy = dirorient === orientation ? coStrategy : contraStrategy;
            return strategy !== null ? dropManager[strategy](item, direction, forSelection, disableWrap) : null;
        };
    };



    /*******************
     * Layout Handlers *
     *******************/

    // unsupported, NON-API function
    fluid.reorderer.makeGeometricInfoGetter = function (orientation, sentinelize, dom) {
        var that = {
            sentinelize: sentinelize,
            extents: [{
                orientation: orientation,
                elements: dom.fastLocate("dropTargets")
            }],
            elementMapper: function (element) {
                return $.inArray(element, dom.fastLocate("movables")) === -1 ? "locked" : null;
            },
            elementIndexer: function (element) {
                var selectables = dom.fastLocate("selectables");
                return {
                    elementClass: that.elementMapper(element),
                    index: $.inArray(element, selectables),
                    length: selectables.length
                };
            }
        };
        return that;
    };

    fluid.defaults("fluid.layoutHandler", {
        gradeNames: ["fluid.viewComponent"],
        disableWrap: "{reorderer}.options.disableWrap",
        members: {
            reordererDom: "{reorderer}.dom",
            dropManager: "{reorderer}.dropManager"
        },
        invokers: { // overridden in moduleLayoutHandler
            getGeometricInfo: "fluid.reorderer.makeGeometricInfoGetter({that}.options.orientation, {that}.options.sentinelize, {that}.reordererDom)"
        }
    });

    // Public layout handlers.
    fluid.defaults("fluid.listLayoutHandler", {
        gradeNames: ["fluid.layoutHandler"],
        orientation:         fluid.orientation.VERTICAL,
        containerRole:       fluid.reorderer.roles.LIST,
        selectablesTabindex: -1,
        sentinelize:         true,
        members: {
            getRelativePosition: { // TODO: an old-fashioned function member - convert to invoker
                expander: {
                    funcName: "fluid.reorderer.relativeInfoGetter",
                    args: [ "{that}.options.orientation", fluid.reorderer.LOGICAL_STRATEGY, null,
                        "{that}.dropManager", "{that}.options.disableWrap"]
                }
            }
        }
    });

    /*
     * Items in the Lightbox are stored in a list, but they are visually presented as a grid that
     * changes dimensions when the window changes size. As a result, when the user presses the up or
     * down arrow key, what lies above or below depends on the current window size.
     *
     * The GridLayoutHandler is responsible for handling changes to this virtual 'grid' of items
     * in the window, and of informing the Lightbox of which items surround a given item.
     */

    fluid.defaults("fluid.gridLayoutHandler", {
        gradeNames: ["fluid.layoutHandler"],
        orientation:         fluid.orientation.HORIZONTAL,
        containerRole:       fluid.reorderer.roles.GRID,
        selectablesTabindex: -1,
        sentinelize:         false,
        coStrategy: "@expand:fluid.gridLayoutHandler.computeCoStrategy({that}.options.disableWrap)",
        members: {
            getRelativePosition: { // TODO: an old-fashioned function member - convert to invoker
                expander: {
                    funcName: "fluid.reorderer.relativeInfoGetter",
                    args: [ "{that}.options.orientation", "{that}.options.coStrategy", fluid.reorderer.SHUFFLE_GEOMETRIC_STRATEGY,
                        "{that}.dropManager", "{that}.options.disableWrap"]
                }
            }
        }
    });

    fluid.gridLayoutHandler.computeCoStrategy = function (disableWrap) {
        return disableWrap ? fluid.reorderer.SHUFFLE_GEOMETRIC_STRATEGY : fluid.reorderer.LOGICAL_STRATEGY;
    };

    /*************
     * Labelling *
     *************/

    /*
     * ARIA labeller component which decorates the reorderer with the function of announcing the current
     * focused position of the reorderer as well as the coordinates of any requested move
     */

    fluid.defaults("fluid.reorderer.labeller", {
        gradeNames: ["fluid.component"],
        members: {
            movedMap: {},
            moduleCell: {
                expander: {
                    funcName: "fluid.reorderer.labeller.computeModuleCell",
                    args: ["{that}.resolver", "{that}.options.orientation"]
                }
            },
            layoutType: {
                expander: {
                    funcName: "fluid.computeNickName",
                    args: "{that}.options.layoutType"
                }
            },
            positionTemplate: {
                expander: {
                    funcName: "fluid.reorderer.labeller.computePositionTemplate",
                    args: ["{that}.resolver", "{that}.layoutType"]
                }
            }
        },
        strings: {
            overallTemplate: "%recentStatus %item %position %movable",
            position:        "%index of %length",
            position_moduleLayoutHandler: "%index of %length in %moduleCell %moduleIndex of %moduleLength",
            moduleCell_0:    "row", // NB, these keys must agree with fluid.a11y.orientation constants
            moduleCell_1:    "column",
            movable:         "movable",
            fixed:           "fixed",
            recentStatus:    "moved from position %position"
        },
        components: {
            resolver: {
                type: "fluid.messageResolver",
                options: {
                    messageBase: "{labeller}.options.strings"
                }
            }
        },
        invokers: {
            renderLabel: {
                funcName: "fluid.reorderer.labeller.renderLabel",
                args: ["{labeller}", "{arguments}.0", "{arguments}.1"]
            }
        },
        listeners: {
            "{reorderer}.events.onRefresh": {
                listener: "fluid.reorderer.labeller.onRefresh",
                args: "{that}"
            },
            "{reorderer}.events.onMove": {
                listener: "fluid.reorderer.labeller.onMove",
                args: ["{that}", "{arguments}.0", "{arguments}.1"] // item, newPosition
            }
        }
    });

    // unsupported, NON-API function
    fluid.reorderer.labeller.computeModuleCell = function (resolver, orientation) {
        return resolver.resolve("moduleCell_" + orientation);
    };

    // unsupported, NON-API function
    fluid.reorderer.labeller.computePositionTemplate = function (resolver, layoutType) {
        return resolver.lookup(["position_" + layoutType, "position"]);
    };

    // unsupported, NON-API function
    fluid.reorderer.labeller.onRefresh = function (that) {
        var selectables = that.dom.locate("selectables");
        var movedMap = that.movedMap;
        fluid.each(selectables, function (selectable) {
            var labelOptions = {};
            var id = fluid.allocateSimpleId(selectable);
            var moved = movedMap[id];
            var label = that.renderLabel(selectable);
            var plainLabel = label;
            if (moved) {
                moved.newRender = plainLabel;
                label = that.renderLabel(selectable, moved.oldRender.position);
                // once we move focus out of the element which just moved, return its ARIA label to be the new plain label
                $(selectable).one("focusout.ariaLabeller", function () {
                    if (movedMap[id]) {
                        var oldLabel = movedMap[id].newRender.label;
                        delete movedMap[id];
                        fluid.updateAriaLabel(selectable, oldLabel);
                    }
                });
                labelOptions.dynamicLabel = true;
            }
            fluid.updateAriaLabel(selectable, label.label, labelOptions);
        });
    };

    // unsupported, NON-API function
    fluid.reorderer.labeller.onMove = function (that, item) {
        fluid.clear(that.movedMap); // if we somehow were fooled into missing a defocus, at least clear the map on a 2nd move
        // This "off" is needed for FLUID-4693 with Chrome 18, which generates a focusOut when
        // simply doing the DOM manipulation to move the element to a new position.
        $(item).off("focusout.ariaLabeller");
        var movingId = fluid.allocateSimpleId(item);
        that.movedMap[movingId] = {
            oldRender: that.renderLabel(item)
        };
    };

    // unsupported, NON-API function
    // Convert from 0-based to 1-based indices for announcement
    fluid.reorderer.indexRebaser = function (indices) {
        indices.index++;
        if (indices.moduleIndex !== undefined) {
            indices.moduleIndex++;
        }
        return indices;
    };

    // unsupported, NON-API function
    fluid.reorderer.labeller.renderLabel = function (that, selectable, recentPosition) {
        var geom = that.options.getGeometricInfo();
        var indices = fluid.reorderer.indexRebaser(geom.elementIndexer(selectable));
        indices.moduleCell = that.moduleCell;

        var elementClass = geom.elementMapper(selectable);
        var labelSource = that.dom.locate("labelSource", selectable);
        var recentStatus;
        if (recentPosition) {
            recentStatus = that.resolver.resolve("recentStatus", {position: recentPosition});
        }
        var topModel = {
            item: typeof(labelSource) === "string" ? labelSource : fluid.dom.getElementText(fluid.unwrap(labelSource)),
            position: that.positionTemplate.resolveFunc(that.positionTemplate.template, indices),
            movable: that.resolver.resolve(elementClass === "locked" ? "fixed" : "movable"),
            recentStatus: recentStatus || ""
        };

        var template = that.resolver.lookup(["overallTemplate"]);
        var label = template.resolveFunc(template.template, topModel);
        return {
            position: topModel.position,
            label: label
        };
    };

})(jQuery, fluid_3_0_0);
