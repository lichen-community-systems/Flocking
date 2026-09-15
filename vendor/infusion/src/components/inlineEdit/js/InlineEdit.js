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

    fluid.registerNamespace("fluid.inlineEdit");

    fluid.inlineEdit.switchToViewMode = function (that) {
        that.editContainer.hide();
        that.displayModeRenderer.show();
    };

    fluid.inlineEdit.cancel = function (that) {
        if (that.isEditing()) {
            // Roll the edit field back to its old value and close it up.
            // This setTimeout is necessary on Firefox, since any attempt to modify the
            // input control value during the stack processing the ESCAPE key will be ignored.
            setTimeout(function () {
                that.editView.value(that.model.value);
            }, 1);
            fluid.inlineEdit.switchToViewMode(that);
            that.events.afterFinishEdit.fire(that.model.value, that.model.value,
                that.editField[0], that.viewEl[0]);
        }
    };

    fluid.inlineEdit.finish = function (that) {
        var newValue = that.editView.value();
        var oldValue = that.model.value;

        var viewNode = that.viewEl[0];
        var editNode = that.editField[0];
        var ret = that.events.onFinishEdit.fire(newValue, oldValue, editNode, viewNode);
        if (ret === false) {
            return;
        }

        that.updateModelValue(newValue);
        that.events.afterFinishEdit.fire(newValue, oldValue, editNode, viewNode);

        fluid.inlineEdit.switchToViewMode(that);
    };

    /**
     * Do not allow the textEditButton to regain focus upon completion unless
     * the keypress is enter or esc.
     *
     * @param {Object} that - The component itself.
     */
    fluid.inlineEdit.bindEditFinish = function (that) {
        if (that.options.submitOnEnter === undefined) {
            that.options.submitOnEnter = "textarea" !== fluid.unwrap(that.editField).nodeName.toLowerCase();
        }
        function keyCode(evt) {
            // Fix for handling arrow key presses. See FLUID-760.
            return evt.keyCode ? evt.keyCode : (evt.which ? evt.which : 0);
        }
        var button = that.textEditButton || $();
        var escHandler = function (evt) {
            var code = keyCode(evt);
            if (code === $.ui.keyCode.ESCAPE) {
                button.trigger("focus");
                fluid.inlineEdit.cancel(that);
                return false;
            }
        };
        var finishHandler = function (evt) {
            var code = keyCode(evt);

            if (code !== $.ui.keyCode.ENTER) {
                button.trigger("blur");
                return true;
            } else {
                fluid.inlineEdit.finish(that);
                button.trigger("focus");
            }

            return false;
        };
        if (that.options.submitOnEnter) {
            that.editContainer.on("keypress", finishHandler);
        }
        that.editContainer.on("keydown", escHandler);
    };

    fluid.inlineEdit.bindBlurHandler = function (that) {
        if (that.options.blurHandlerBinder) {
            that.options.blurHandlerBinder(that);
        } else {
            var blurHandler = function () {
                if (that.isEditing()) {
                    fluid.inlineEdit.finish(that);
                }
                return false;
            };
            that.editField.on("blur", blurHandler);
        }
    };

    fluid.inlineEdit.initializeEditView = function (that, initial) {
        if (!that.editInitialized) {
            fluid.inlineEdit.renderEditContainer(that, !that.options.lazyEditView || !initial);

            if (!that.options.lazyEditView || !initial) {
                that.events.onCreateEditView.fire();

                if (that.textEditButton) {
                    fluid.inlineEdit.bindEditFinish(that);
                }
                fluid.inlineEdit.bindBlurHandler(that);
                that.editView.refreshView(that);
                that.editInitialized = true;
            }
        }
    };

    fluid.inlineEdit.edit = function (that) {
        fluid.inlineEdit.initializeEditView(that, false);

        var viewEl = that.viewEl;
        var displayText = that.displayView.value();
        that.updateModelValue(that.model.value === "" ? "" : displayText);
        if (that.options.applyEditPadding) {
            that.editField.width(Math.max(viewEl.width() + that.options.paddings.edit, that.options.paddings.minimumEdit));
        }

        that.displayModeRenderer.hide();
        that.editContainer.show();

        // Work around for FLUID-726
        // Without 'setTimeout' the finish handler gets called with the event and the edit field is inactivated.
        setTimeout(function () {
            that.editField.trigger("focus");
            if (that.options.selectOnEdit) {
                that.editField[0].select();
            }
        }, 0);
        that.events.afterBeginEdit.fire();
    };

    fluid.inlineEdit.clearEmptyViewStyles = function (textEl, styles, originalViewPadding) {
        textEl.removeClass(styles.defaultViewStyle);
        textEl.css("padding-right", originalViewPadding);
        textEl.removeClass(styles.emptyDefaultViewText);
    };

    fluid.inlineEdit.showDefaultViewText = function (that) {
        that.displayView.value(that.options.strings.defaultViewText);
        that.viewEl.css("padding-right", that.existingPadding);
        that.viewEl.addClass(that.options.styles.defaultViewStyle);
    };

    fluid.inlineEdit.showNothing = function (that) {
        that.displayView.value("");

        // workaround for FLUID-938:
        // IE can not style an empty inline element, so force element to be display: inline-block
        if ($.browser.msie) {
            if (that.viewEl.css("display") === "inline") {
                that.viewEl.css("display", "inline-block");
            }
        }
    };

    fluid.inlineEdit.showEditedText = function (that) {
        that.displayView.value(that.model.value);
        fluid.inlineEdit.clearEmptyViewStyles(that.viewEl, that.options.styles, that.existingPadding);
    };

    /**
     * Updates the state of the inline editor in the DOM, based on changes that may have
     * happened to the model.
     *
     * @param {fluid.inlineEdit} that - an instance of `fluid.inlineEdit`
     * @param {Object} source - (optional) An object identifying the source of the change (see ChangeApplier documentation)
     */
    fluid.inlineEdit.refreshView = function (that, source) {
        that.displayView.refreshView(that, source);
        if (that.editView) {
            that.editView.refreshView(that, source);
        }
    };

    /**
     * Pushes external changes to the model into the inline editor, refreshing its
     * rendering in the DOM. The modelChanged event will fire.
     *
     * @param {fluid.inlineEdit} that - an instance of `fluid.inlineEdit`
     * @param {String} newValue - The bare value of the model, i.e. the string being edited
     * @param {Object} [source] - (optional) "source" (perhaps a DOM element) which triggered this event
     */
    fluid.inlineEdit.updateModelValue = function (that, newValue, source) {
        var comparator = that.options.modelComparator;
        var unchanged = comparator ? comparator(that.model.value, newValue) :
            that.model.value === newValue;
        if (!unchanged) {
            var oldModel = $.extend(true, {}, that.model);
            that.model.value = newValue;
            that.events.modelChanged.fire(that.model, oldModel, source);
            that.refreshView(source);
        }
    };

    fluid.inlineEdit.editHandler = function (that) {
        var prevent = that.events.onBeginEdit.fire();
        if (prevent === false) {
            return false;
        }
        fluid.inlineEdit.edit(that);

        return true;
    };

    // Initialize the tooltip once the document is ready.
    // For more details, see http://issues.fluidproject.org/browse/FLUID-1030
    fluid.inlineEdit.initTooltips = function (that) {
        var tooltipOptions = {
            content: that.options.tooltipText,
            position: {
                my: "left top",
                at: "left bottom+25%", // add a 25% offset to keep the tooltip from overlapping the element it is for
                // setting the "of" property to ensure that the tooltip is positioned relative to that.viewEl
                // even when keyboard focus is on that.textEditButton
                of: that.viewEl
            },
            target: "*",
            delay: that.options.tooltipDelay,
            styles: {
                tooltip: that.options.styles.tooltip
            }
        };

        fluid.tooltip(that.viewEl, tooltipOptions);

        if (that.textEditButton) {
            fluid.tooltip(that.textEditButton, tooltipOptions);
        }
    };

    fluid.inlineEdit.calculateInitialPadding = function (viewEl) {
        var padding = viewEl.css("padding-right");
        return padding ? parseFloat(padding) : 0;
    };

    /**
     * Set up and style the edit field.  If an edit field is not provided,
     * default markup is created for the edit field
     *
     * @param {String} editStyle - The default styling for the edit field.
     * @param {Object} editField - The existing edit field.
     * @param {Object} editFieldMarkup - The edit field markup provided by the integrator.
     *
     * @return {Object} The styled edit field.
     */
    fluid.inlineEdit.setupEditField = function (editStyle, editField, editFieldMarkup) {
        var eField = $(editField);
        eField = eField.length ? eField : $(editFieldMarkup);
        eField.addClass(editStyle);
        return eField;
    };

    /**
     * Set up the edit container and append the edit field to the container.  If an edit container
     * is not provided, default markup is created.
     *
     * @param {Object} displayContainer - The display mode container
     * @param {Object} editField - The edit field that is to be appended to the edit container
     * @param {Object} editContainer - The edit container markup provided by the integrator
     * @param {Object} editContainerMarkup - The edit container markup provided by the integrator.
     *
     * @return {Object} The edit container containing the edit field
     */
    fluid.inlineEdit.setupEditContainer = function (displayContainer, editField, editContainer, editContainerMarkup) {
        var eContainer = $(editContainer);
        eContainer = eContainer.length ? eContainer : $(editContainerMarkup);
        displayContainer.after(eContainer);
        eContainer.append(editField);

        return eContainer;
    };

    /**
     * Default renderer for the edit mode view.
     *
     * @param {Object} that - The component itself.
     * @return {Object} An object containing:
     *  - container The edit container containing the edit field
     *  - field The styled edit field
     */
    fluid.inlineEdit.defaultEditModeRenderer = function (that) {
        var editField = fluid.inlineEdit.setupEditField(that.options.styles.edit, that.editField, that.options.markup.editField);
        var editContainer = fluid.inlineEdit.setupEditContainer(that.displayModeRenderer, editField, that.editContainer, that.options.markup.editContainer);
        var editModeInstruction = fluid.inlineEdit.setupEditModeInstruction(that.options.styles.editModeInstruction,
            that.options.strings.editModeInstruction, that.options.markup.editModeInstruction);

        var id = fluid.allocateSimpleId(editModeInstruction);
        editField.attr("aria-describedby", id);

        fluid.inlineEdit.positionEditModeInstruction(editModeInstruction, editContainer, editField);

        // Package up the container and field for the component.
        return {
            container: editContainer,
            field: editField
        };
    };

    /** Configures the edit container and view, and uses the component's editModeRenderer to render
     * the edit container.
     *
     * @param {Object} that - The component itself.
     * @param {Boolean} lazyEditView - If true, will delay rendering of the edit container; Default is false
     */
    fluid.inlineEdit.renderEditContainer = function (that, lazyEditView) {
        that.editContainer = that.locate("editContainer");
        that.editField = that.locate("edit");
        if (that.editContainer.length !== 1) {
            if (that.editContainer.length > 1) {
                fluid.fail("InlineEdit did not find a unique container for selector " + that.options.selectors.editContainer + ": " + fluid.dumpEl(that.editContainer));
            }
        }

        if (!lazyEditView) {
            return;
        } // do not invoke the renderer, unless this is the "final" effective time

        var editElms = that.options.editModeRenderer(that);
        if (editElms) {
            that.editContainer = editElms.container;
            that.editField = editElms.field;
        }
    };

    /** Set up the edit mode instruction with aria in edit mode
     * @param {String} editModeInstructionStyle - The default styling for the instruction
     * @param {String} editModeInstructionText - The default instruction text
     * @param {Object} editModeInstructionMarkup - The markup to modify.
     * @return {jQuery} The displayed instruction in edit mode
     */
    fluid.inlineEdit.setupEditModeInstruction = function (editModeInstructionStyle, editModeInstructionText, editModeInstructionMarkup) {
        var editModeInstruction = $(editModeInstructionMarkup);
        editModeInstruction.addClass(editModeInstructionStyle);
        editModeInstruction.text(editModeInstructionText);

        return editModeInstruction;
    };

    /**
     * Positions the edit mode instruction directly beneath the edit container
     *
     * @param {Object} editModeInstruction - The displayed instruction in edit mode
     * @param {Object} editContainer - The edit container in edit mode
     * @param {Object} editField - The edit field in edit mode
     */
    fluid.inlineEdit.positionEditModeInstruction = function (editModeInstruction, editContainer, editField) {
        editContainer.append(editModeInstruction);

        editField.on("focus", function () {
            editModeInstruction.show();

            var editFieldPosition = editField.offset();
            // For FLUID-5980 (https://issues.fluidproject.org/browse/FLUID-5980)
            //
            // From the jQuery height docs (http://api.jquery.com/height/)
            // "As of jQuery 1.8, this may require retrieving the CSS height plus
            // box-sizing property and then subtracting any potential border and
            // padding on each element when the element has box-sizing: border-box.
            // To avoid this penalty, use .css( "height" ) rather than .height()."
            var editFieldHeight = parseInt(editField.css("height"), 10);
            editModeInstruction.css({left: editFieldPosition.left});
            editModeInstruction.css({top: editFieldPosition.top + editFieldHeight + 5});
        });
    };

    /**
     * Set up and style the display mode container for the viewEl and the textEditButton
     *
     * @param {Object} styles - The default styling for the display mode container
     * @param {Object} displayModeWrapper - The markup used to generate the display mode container
     *
     * @return {jQuery} The styled display mode container
     */
    fluid.inlineEdit.setupDisplayModeContainer = function (styles, displayModeWrapper) {
        var displayModeContainer = $(displayModeWrapper);
        displayModeContainer = displayModeContainer.length ? displayModeContainer : $("<span></span>");
        displayModeContainer.addClass(styles.displayView);

        return displayModeContainer;
    };

    /** Retrieve the display text from the DOM.
     * @param {Object} viewEl - The view element.
     * @param {String} textStyle - The classes to apply to the view element.
     * @return {jQuery} The view element.
     */
    fluid.inlineEdit.setupDisplayText = function (viewEl, textStyle) {
        /*  Remove the display from the tab order to prevent users to think they
         *  are able to access the inline edit field, but they cannot since the
         *  keyboard event binding is only on the button.
         */
        viewEl.attr("tabindex", "-1");
        viewEl.addClass(textStyle);
        return viewEl;
    };

    /**
     * Set up the textEditButton.  Append a background image with appropriate
     * descriptive text to the button.
     *
     * @param {Object} that - The component itself.
     * @param {Object} model - The model data.
     * @return {jQuery} The accessible button located after the display text
     */
    fluid.inlineEdit.setupTextEditButton = function (that, model) {
        var opts = that.options;
        var textEditButton = that.locate("textEditButton");

        if (textEditButton.length === 0) {
            var markup = $(that.options.markup.textEditButton);
            markup.addClass(opts.styles.textEditButton);
            markup.text(opts.tooltipText);

            /**
             * Set text for the button and listen
             * for modelChanged to keep it updated
             */
            fluid.inlineEdit.updateTextEditButton(markup, model.value || opts.strings.defaultViewText, opts.strings.textEditButton);
            that.events.modelChanged.addListener(function () {
                fluid.inlineEdit.updateTextEditButton(markup, model.value || opts.strings.defaultViewText, opts.strings.textEditButton);
            });

            that.locate("text").after(markup);

            // Refresh the textEditButton with the newly appended options
            textEditButton = that.locate("textEditButton");
        }
        return textEditButton;
    };

    /**
     * Update the textEditButton text with the current value of the field.
     *
     * @param {Object} textEditButton - the textEditButton
     * @param {String} value - The current value of the inline editable text
     * @param {String} stringTemplate - The string template to use in producing the button text.
     */
    fluid.inlineEdit.updateTextEditButton = function (textEditButton, value, stringTemplate) {
        var buttonText = fluid.stringTemplate(stringTemplate, {
            text: value
        });
        textEditButton.text(buttonText);
    };

    /**
     * Bind mouse hover event handler to the display mode container.
     *
     * @param {Object} displayModeRenderer - The display mode container
     * @param {String} invitationStyle - The default styling for the display mode container on mouse hover
     */
    fluid.inlineEdit.bindHoverHandlers = function (displayModeRenderer, invitationStyle) {
        var over = function () {
            displayModeRenderer.addClass(invitationStyle);
        };
        var out = function () {
            displayModeRenderer.removeClass(invitationStyle);
        };
        displayModeRenderer.on("mouseenter", over);
        displayModeRenderer.on("mouseleave", out);
    };

    /**
     * Bind keyboard focus and blur event handlers to an element
     *
     * Note: This function is an unsupported, NON-API function
     *
     * @param {Object} element - The element to which the event handlers are bound
     * @param {Object} displayModeRenderer - The display mode container
     * @param {Object} styles - The default styling for the display mode container on mouse hover
     * @param {Object} strings - String messages to use if there is no model value.
     * @param {Object} model - Model data to display.
     */
    fluid.inlineEdit.bindHighlightHandler = function (element, displayModeRenderer, styles, strings, model) {
        element = $(element);

        var makeFocusSwitcher = function (focusOn) {
            return function () {
                displayModeRenderer.toggleClass(styles.focus, focusOn);
                displayModeRenderer.toggleClass(styles.invitation, focusOn);
                if (!model || !model.value) {
                    displayModeRenderer.prevObject.text(focusOn ? strings.defaultFocussedViewText : strings.defaultViewText);
                }
            };
        };
        element.on("focus", makeFocusSwitcher(true));
        element.on("blur", makeFocusSwitcher(false));
    };

    /**
     * Bind mouse click handler to an element
     *
     * @param {Object} element - The element to which the event handler is bound
     * @param {Object} edit - Function to invoke the edit mode
     *
     */
    fluid.inlineEdit.bindMouseHandlers = function (element, edit) {
        element = $(element);

        var triggerGuard = fluid.inlineEdit.makeEditTriggerGuard(element, edit);
        element.on("click", function (e) {
            triggerGuard(e);
            return false;
        });
    };

    /**
     * Bind keyboard press handler to an element
     *
     * @param {Object} element - The element to which the event handler is bound
     * @param {Object} edit - Function to invoke the edit mode
     *
     */
    fluid.inlineEdit.bindKeyboardHandlers = function (element, edit) {
        element = $(element);
        element.attr("role", "button");

        var guard = fluid.inlineEdit.makeEditTriggerGuard(element, edit);
        fluid.activatable(element, function (event) {
            return guard(event);
        });
    };

    /**
     * Creates an event handler that will trigger the edit mode if caused by something other
     * than standard HTML controls. The event handler will return false if entering edit mode.
     *
     * @param {Object} jElement - The element to trigger the edit mode
     * @param {Object} edit - Function to invoke the edit mode
     *
     * @return {Function} The event handler function
     */
    fluid.inlineEdit.makeEditTriggerGuard = function (jElement, edit) {
        var element = fluid.unwrap(jElement);
        return function (event) {
            // FLUID-2017 - avoid triggering edit mode when operating standard HTML controls. Ultimately this
            // might need to be extensible, in more complex authouring scenarios.
            var outer = fluid.findAncestor(event.target, function (elem) {
                if (/input|select|textarea|button|a/i.test(elem.nodeName) || elem === element) {
                    return true;
                }
            });
            if (outer === element) {
                edit();
                return false;
            }
        };
    };

    /* Bind all user-facing event handlers required by the component */
    fluid.inlineEdit.bindEventHandlers = function (that, edit, displayModeContainer) {
        var styles = that.options.styles;

        fluid.inlineEdit.bindHoverHandlers(displayModeContainer, styles.invitation);
        fluid.inlineEdit.bindMouseHandlers(that.viewEl, edit);
        fluid.inlineEdit.bindMouseHandlers(that.textEditButton, edit);
        fluid.inlineEdit.bindKeyboardHandlers(that.textEditButton, edit);
        fluid.inlineEdit.bindHighlightHandler(that.viewEl, displayModeContainer, that.options.styles, that.options.strings, that.model);
        fluid.inlineEdit.bindHighlightHandler(that.textEditButton, displayModeContainer, that.options.styles, that.options.strings, that.model);
    };

    /** Render the display mode view.
     *
     * @param {Object} that - The component itself.
     * @param {Object} edit - Function to invoke the edit mode
     * @param {Object} model - Model data to display.
     * @return {jQuery} The display container containing the display text and textEditbutton for display mode view.
     */
    fluid.inlineEdit.defaultDisplayModeRenderer = function (that, edit, model) {
        var styles = that.options.styles;

        var displayModeWrapper = fluid.inlineEdit.setupDisplayModeContainer(styles);
        var displayModeContainer = that.viewEl.wrap(displayModeWrapper).parent();

        that.textEditButton = fluid.inlineEdit.setupTextEditButton(that, model);
        displayModeContainer.append(that.textEditButton);

        fluid.inlineEdit.bindEventHandlers(that, edit, displayModeContainer);

        return displayModeContainer;
    };

    fluid.inlineEdit.getNodeName = function (element) {
        return fluid.unwrap(element).nodeName.toLowerCase();
    };

    fluid.defaults("fluid.inlineEdit.standardAccessor", {
        gradeNames: ["fluid.viewComponent"],
        members: {
            nodeName: {
                expander: {
                    funcName: "fluid.inlineEdit.getNodeName",
                    args: "{that}.container"
                }
            }
        },
        invokers: {
            value: {
                funcName: "fluid.inlineEdit.standardAccessor.value",
                args: ["{that}.nodeName", "{that}.container", "{arguments}.0"]
            }
        }
    });

    fluid.inlineEdit.standardAccessor.value = function (nodeName, element, newValue) {
        return fluid[nodeName === "input" || nodeName === "textarea" ? "value" : "text"]($(element), newValue);
    };

    fluid.defaults("fluid.inlineEdit.standardDisplayView", {
        gradeNames: ["fluid.viewComponent"],
        invokers: {
            refreshView: {
                funcName: "fluid.inlineEdit.standardDisplayView.refreshView",
                args: ["{fluid.inlineEdit}", "{that}.container", "{arguments}.0"]
            }
        }
    });

    fluid.inlineEdit.standardDisplayView.refreshView = function (componentThat) {
        if (componentThat.model.value) {
            fluid.inlineEdit.showEditedText(componentThat);
        } else if (componentThat.options.strings.defaultViewText) {
            fluid.inlineEdit.showDefaultViewText(componentThat);
        } else {
            fluid.inlineEdit.showNothing(componentThat);
        }
        // If necessary, pad the view element enough that it will be evident to the user.
        if (componentThat.viewEl.text().trim().length === 0) {
            componentThat.viewEl.addClass(componentThat.options.styles.emptyDefaultViewText);

            if (componentThat.existingPadding < componentThat.options.paddings.minimumView) {
                componentThat.viewEl.css("padding-right", componentThat.options.paddings.minimumView);
            }
        }
    };

    fluid.defaults("fluid.inlineEdit.standardEditView", {
        gradeNames: ["fluid.viewComponent"],
        invokers: {
            refreshView: {
                funcName: "fluid.inlineEdit.standardEditView.refreshView",
                args: ["{fluid.inlineEdit}", "{that}.container", "{arguments}.0"]
            }
        }
    });

    fluid.inlineEdit.standardEditView.refreshView = function (componentThat, editField, source) {
        if (!source || (editField && editField.index(source) === -1)) {
            componentThat.editView.value(componentThat.model.value);
        }
    };

    fluid.inlineEdit.setup = function (that) {
        // Hide the edit container to start
        if (that.editContainer) {
            that.editContainer.hide();
        }

        // Add tooltip handler if required and available
        if (that.tooltipEnabled()) {
            fluid.inlineEdit.initTooltips(that);
        }
    };


    // TODO: Should really be part of a "collateral" or "shadow model"
    fluid.inlineEdit.setIsEditing = function (that, state) {
        that.isEditingState = state;
    };

    /**
     * Determines if the tooltip feature is enabled.
     *
     * @param {Boolean} useTooltip - A boolean indicating fi the tooltip should be enabled (true) or disabled (false)
     *
     * @return {Boolean} - Returns true if the tooltip feature is turned on, false if not
     */
    fluid.inlineEdit.tooltipEnabled = function (useTooltip) {
        return useTooltip && $.fn.tooltip;
    };

    // Backwards compatibility for users of the 1.4.x and below Infusion API - new users are recommended to directly attach
    // a "fluid.undo" as a subcomponent with appropriate configuration - express this using FLUID-5022 system when it is available
    fluid.inlineEdit.processUndoDecorator = function (that) {
        if (that.options.componentDecorators) {
            var decorators = fluid.makeArray(that.options.componentDecorators);
            var decorator = decorators[0];
            if (typeof(decorator) === "string") {
                decorator = {type: decorator};
            }
            if (decorator.type === "fluid.undoDecorator") {
                fluid.set(that.options, ["components", "undo"], { type: "fluid.undo", options: decorator.options});
                that.decorators = [ fluid.initDependent(that, "undo")];
            }
        }
    };

    /**
     * Instantiates a new Inline Edit component
     *
     * @param {Object} componentContainer - a selector, jQuery, or a DOM element representing the component's container
     * @param {Object} options - a collection of options settings
     */

    fluid.defaults("fluid.inlineEdit", {
        gradeNames: ["fluid.undoable", "fluid.viewComponent"],
        mergePolicy: {
            "strings.defaultViewText": "defaultViewText"
        },
        members: {
            isEditingState: false,
            viewEl: {
                expander: {
                    funcName: "fluid.inlineEdit.setupDisplayText",
                    args: ["{that}.dom.text", "{that}.options.styles.text"]
                }
            },
            existingPadding: {
                expander: {
                    funcName: "fluid.inlineEdit.calculateInitialPadding",
                    args: "{that}.viewEl"
                }
            },
            displayModeRenderer: {
                expander: {
                    func: "{that}.options.displayModeRenderer",
                    args: ["{that}", "{that}.edit", "{that}.model"]
                }
            }
        },
        invokers: {
            // Switches to edit mode.
            edit: {
                funcName: "fluid.inlineEdit.editHandler",
                args: "{that}"
            },
            // Determines if the component is currently in edit mode.
            // Returns true if edit mode shown, false if view mode is shown
            isEditing: {
                funcName: "fluid.identity",
                args: "{that}.isEditingState"
            },
            // Finishes editing, switching back to view mode.
            finish: {
                funcName: "fluid.inlineEdit.finish",
                args: "{that}"
            },
            // Cancels the in-progress edit and switches back to view mode
            cancel: {
                funcName: "fluid.inlineEdit.cancel",
                args: "{that}"
            },
            // Determines if the tooltip feature is enabled.
            tooltipEnabled: {
                funcName: "fluid.inlineEdit.tooltipEnabled",
                args: "{that}.options.useTooltip"
            },
            // Updates the state of the inline editor in the DOM
            refreshView: {
                funcName: "fluid.inlineEdit.refreshView",
                args: ["{that}", "{arguments}.0"]
            },
            updateModelValue: {
                funcName: "fluid.inlineEdit.updateModelValue",
                args: ["{that}", "{arguments}.0", "{arguments}.1"] // newValue, source
            },
            updateModel: {
                funcName: "fluid.inlineEdit.updateModelValue",
                args: ["{that}", "{arguments}.0.value", "{arguments}.1"] // newModel, source
            }
        },
        components: {
            displayView: {
                type: "{that}.options.displayView.type",
                container: "{that}.viewEl",
                options: {
                    gradeNames: "{fluid.inlineEdit}.options.displayAccessor.type"
                }
            },
            editView: {
                type: "{that}.options.editView.type",
                createOnEvent: "onCreateEditView",
                container: "{that}.editField",
                options: {
                    gradeNames: "{fluid.inlineEdit}.options.editAccessor.type"
                }
            }
        },
        model: {
            value: {
                expander: { func: "{that}.displayView.value"}
            }
        },
        selectors: {
            text: ".flc-inlineEdit-text",
            editContainer: ".flc-inlineEdit-editContainer",
            edit: ".flc-inlineEdit-edit",
            textEditButton: ".flc-inlineEdit-textEditButton"
        },

        styles: {
            text: "fl-inlineEdit-text",
            edit: "fl-inlineEdit-edit",
            invitation: "fl-inlineEdit-invitation",
            defaultViewStyle: "fl-inlineEdit-emptyText-invitation",
            emptyDefaultViewText: "fl-inlineEdit-emptyDefaultViewText",
            focus: "fl-inlineEdit-focus",
            tooltip: "fl-inlineEdit-tooltip",
            editModeInstruction: "fl-inlineEdit-editModeInstruction",
            displayView: "fl-inlineEdit-simple-editableText fl-inlineEdit-textContainer",
            textEditButton: "fl-hidden-accessible"
        },

        events: {
            modelChanged: null,
            onBeginEdit: "preventable",
            afterBeginEdit: null,
            onFinishEdit: "preventable",
            afterFinishEdit: null,
            afterInitEdit: null,
            onCreateEditView: null
        },
        listeners: {
            onCreate: [{
                func: "{that}.refreshView"
            }, {
                funcName: "fluid.inlineEdit.initializeEditView",
                args: ["{that}", true]
            }, {
                funcName: "fluid.inlineEdit.setup",
                args: "{that}"
            }, {
                funcName: "fluid.inlineEdit.processUndoDecorator",
                args: "{that}"
            }],
            onBeginEdit: {
                funcName: "fluid.inlineEdit.setIsEditing",
                args: ["{that}", true]
            },
            afterFinishEdit: {
                funcName: "fluid.inlineEdit.setIsEditing",
                args: ["{that}", false]
            }
        },

        strings: {
            textEditButton: "Edit text %text",
            editModeInstruction: "Escape to cancel, Enter or Tab when finished",
            defaultViewText: "Click here to edit", /* this will override the direct option */
            defaultFocussedViewText: "Click here or press enter to edit"
        },

        markup: {
            editField: "<input type='text' class='flc-inlineEdit-edit'/>",
            editContainer: "<span></span>",
            editModeInstruction: "<p></p>",
            textEditButton: "<a href='#_' class='flc-inlineEdit-textEditButton'></a>"
        },

        paddings: {
            edit: 10,
            minimumEdit: 80,
            minimumView: 60
        },

        applyEditPadding: true,

        blurHandlerBinder: null,

        // set this to true or false to cause unconditional submission, otherwise it will
        // be inferred from the edit element tag type.
        submitOnEnter: undefined,

        modelComparator: null,

        displayAccessor: {
            type: "fluid.inlineEdit.standardAccessor"
        },

        displayView: {
            type: "fluid.inlineEdit.standardDisplayView"
        },

        editAccessor: {
            type: "fluid.inlineEdit.standardAccessor"
        },

        editView: {
            type: "fluid.inlineEdit.standardEditView"
        },

        displayModeRenderer: fluid.inlineEdit.defaultDisplayModeRenderer,

        editModeRenderer: fluid.inlineEdit.defaultEditModeRenderer,

        lazyEditView: false,

        /** View Mode Tooltip Settings **/
        useTooltip: true,

        // this is here for backwards API compatibility, but should be in the strings block
        tooltipText: "Select or press Enter to edit",

        tooltipDelay: 1000,

        selectOnEdit: false
    });

    /*
     * Creates a whole list of inline editors as subcomponents of the supplied component
     */
    fluid.setupInlineEdits = function (that, editables) {
        // TODO: create useful framework for automated construction of component definitions, possibly using Model Transformation - FLUID-5022
        return fluid.transform(editables, function (editable, i) {
            var componentDef = {
                type: "fluid.inlineEdit",
                container: editable
            };
            var name = "inlineEdit-" + i;
            fluid.set(that.options, ["components", name], componentDef);
            return fluid.initDependent(that, name);

        });
    };

    fluid.defaults("fluid.inlineEditsComponent", {
        gradeNames: ["fluid.viewComponent"],
        distributeOptions: {
            source: "{that}.options",
            // TODO: Appalling requirement to evade FLUID-5887 check - otherwise all of this fluid.modelComponent material is broadcast down to each component.
            // "source" distributions are silly and dangerous in any case, but they have become fairly widely used, together with the expectation that the
            // material from "defaults" can be broadcast too. But clearly material that is from base grade defaults is unwelcome to be distributed.
            // This seems to imply that we've got no option but to start supporting "provenance" in options and defaults - highly expensive.
            exclusions: ["members.inlineEdits", "members.modelRelay", "members.applier", "members.model", "selectors.editables", "events"],
            removeSource: true,
            target: "{that > fluid.inlineEdit}.options"
        },
        members: {
            inlineEdits: {
                expander: {
                    funcName: "fluid.setupInlineEdits",
                    args: ["{that}", "{that}.dom.editables"]
                }
            }
        },
        selectors: {
            editables: ".flc-inlineEditable"
        }
    });

    fluid.inlineEdits = function (container, options) {
        var that = fluid.inlineEditsComponent(container, options);
        return that.inlineEdits;
    };

})(jQuery, fluid_3_0_0);
