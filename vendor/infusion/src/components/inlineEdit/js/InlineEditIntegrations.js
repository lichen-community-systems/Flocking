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

/* global CKEDITOR, tinyMCE */

fluid_3_0_0 = fluid_3_0_0 || {};

(function ($, fluid) {
    "use strict";

    /*************************************
     * Shared Rich Text Editor functions *
     *************************************/

    fluid.defaults("fluid.inlineEdit.editorViewAccessor", {
        gradeNames: ["fluid.viewComponent"],
        invokers: {
            value: {
                funcName: "fluid.inlineEdit.editorViewAccessor.value",
                args: ["{that}.container", "{that}.options", "{arguments}.0"]
            }
        }
    });

    fluid.inlineEdit.editorViewAccessor.value = function (editField, options, newValue) {
        var editor = options.editorGetFn(editField);
        if (!editor || editor.length === 0) {
            if (newValue !== undefined) {
                $(editField).val(newValue);
            }
            return "";
        }
        if (newValue !== undefined) {
            options.setValueFn(editField, editor, newValue);
        } else {
            return options.getValueFn(editor);
        }
    };

    fluid.defaults("fluid.inlineEdit.richTextViewAccessor", {
        gradeNames: ["fluid.viewComponent"],
        invokers: {
            value: {
                funcName: "fluid.inlineEdit.richTextViewAccessor.value",
                args: ["{that}.container", "{arguments}.0"]
            }
        }
    });

    fluid.inlineEdit.richTextViewAccessor.value = function (element, newValue) {
        return fluid.html(element, newValue);
    };

    fluid.inlineEdit.normalizeHTML = function (value) {
        var togo = value.replace(/\s+/g, " ").trim();
        togo = togo.replace(/\s+<\//g, "</");
        togo = togo.replace(/<([a-z0-9A-Z\/]+)>/g, function (match) {
            return match.toLowerCase();
        });
        return togo;
    };

    fluid.inlineEdit.htmlComparator = function (el1, el2) {
        return fluid.inlineEdit.normalizeHTML(el1) === fluid.inlineEdit.normalizeHTML(el2);
    };

    fluid.inlineEdit.bindRichTextHighlightHandler = function (element, displayModeRenderer, invitationStyle) {
        element = $(element);

        var focusOn = function () {
            displayModeRenderer.addClass(invitationStyle);
        };
        var focusOff = function () {
            displayModeRenderer.removeClass(invitationStyle);
        };

        element.on("focus", focusOn);
        element.on("blur", focusOff);
    };

    fluid.inlineEdit.setupRichTextEditButton = function (that) {
        var opts = that.options;
        var textEditButton = that.locate("textEditButton");

        if (textEditButton.length === 0) {
            var markup = $("<a href='#_' class='flc-inlineEdit-textEditButton'></a>");
            markup.text(opts.strings.textEditButton);

            that.locate("text").after(markup);

            // Refresh the textEditButton with the newly appended options
            textEditButton = that.locate("textEditButton");
        }
        return textEditButton;
    };

    /*
     * Wrap the display text and the textEditButton with the display mode container
     * for better style control.
     */
    fluid.inlineEdit.richTextDisplayModeRenderer = function (that, edit) {
        var styles = that.options.styles;

        var displayModeWrapper = fluid.inlineEdit.setupDisplayModeContainer(styles);
        var displayModeRenderer = that.viewEl.wrap(displayModeWrapper).parent();

        that.textEditButton = fluid.inlineEdit.setupRichTextEditButton(that);
        displayModeRenderer.append(that.textEditButton);
        displayModeRenderer.addClass(styles.focus);

        // Add event handlers.
        fluid.inlineEdit.bindHoverHandlers(displayModeRenderer, styles.invitation);
        fluid.inlineEdit.bindMouseHandlers(that.textEditButton, edit);
        fluid.inlineEdit.bindKeyboardHandlers(that.textEditButton, edit);
        fluid.inlineEdit.bindRichTextHighlightHandler(that.viewEl, displayModeRenderer, styles.invitation);
        fluid.inlineEdit.bindRichTextHighlightHandler(that.textEditButton, displayModeRenderer, styles.invitation);

        return displayModeRenderer;
    };

    /************************
     * Tiny MCE Integration *
     ************************/

    var flTinyMCE = fluid.registerNamespace("fluid.inlineEdit.tinyMCE");

    fluid.inlineEdit.tinyMCE.getEditor = function (editField) {
        return tinyMCE.get(editField.prop("id"));
    };

    fluid.inlineEdit.tinyMCE.setValue = function (editField, editor, value) {
        // without this, there is an intermittent race condition if the editor has been created on this event.
        $(editField).val(value);
        editor.setContent(value, {format : "raw"});
    };

    fluid.inlineEdit.tinyMCE.getValue = function (editor) {
        return editor.getContent();
    };

    fluid.defaults("fluid.inlineEdit.tinyMCE.viewAccessor", {
        gradeNames: ["fluid.inlineEdit.editorViewAccessor"],
        editorGetFn: flTinyMCE.getEditor,
        setValueFn: flTinyMCE.setValue,
        getValueFn: flTinyMCE.getValue
    });

    fluid.inlineEdit.tinyMCE.blurHandlerBinder = function (that) {
        function focusEditor(editor) {
            setTimeout(function () {
                tinyMCE.execCommand("mceFocus", false, that.editField[0].id);
                editor.selection.select(editor.getBody(), 1);
                editor.selection.collapse(0);
            }, 10);
        }

        that.events.afterInitEdit.addListener(function (editor) {
            focusEditor(editor);
            var editorBody = editor.getBody();

            // NB - this section has no effect - on most browsers no focus events
            // are delivered to the actual body - however, on recent TinyMCE, the
            // "focusEditor" call DOES deliver a blur which causes FLUID-4681
            that.deadMansBlur = fluid.deadMansBlur(that.editField, {
                cancelByDefault: true,
                exclusions: {body: $(editorBody), container: that.container},
                handler: function () {
                    that[that.options.onBlur]();
                }
            });
        });

        that.events.afterBeginEdit.addListener(function () {
            var editor = tinyMCE.get(that.editField[0].id);
            if (editor) {
                focusEditor(editor);
            }
            if (that.deadMansBlur) {
                that.deadMansBlur.reArm();
            }
        });
        that.events.afterFinishEdit.addListener(function () {
            that.deadMansBlur.noteProceeded();
        });
    };

    fluid.inlineEdit.tinyMCE.editModeRenderer = function (that) {
        var options = that.options.tinyMCE;
        options.elements = fluid.allocateSimpleId(that.editField);
        var oldinit = options.init_instance_callback;

        options.init_instance_callback = function (instance) {
            that.events.afterInitEdit.fire(instance);
            if (oldinit) {
                oldinit();
            }
        };
        // Ensure that instance creation is always asynchronous, to ensure that
        // blurHandlerBinder always executes BEFORE instance is ready - so that
        // its afterInitEdit listener is registered in time. All of this architecture
        // is unsatisfactory, but can't be easily fixed until the whole component is
        // migrated over to IoC with declarative listener registration.
        setTimeout(function () {
            tinyMCE.init(options);
        }, 1);
    };

    /**
     * Instantiate a rich-text InlineEdit component that uses an instance of TinyMCE.
     *
     * @param {Object} componentContainer - the element containing the inline editors
     * @param {Object} options - configuration options for the components
     */

    fluid.defaults("fluid.inlineEdit.tinyMCE", {
        gradeNames: ["fluid.inlineEdit"],
        tinyMCE : {
            mode: "exact",
            theme: "simple"
        },
        listeners: {
            onCreate: {
                "this": "tinyMCE",
                method: "init",
                namespace: "initTinyMCE",
                args: "{that}.options.tinyMCE"
            }
        },
        useTooltip: true,
        selectors: {
            edit: "textarea"
        },
        styles: {
            invitation: "fl-inlineEdit-richText-invitation",
            displayView: "fl-inlineEdit-textContainer",
            text: ""

        },
        strings: {
            textEditButton: "Edit"
        },
        displayAccessor: {
            type: "fluid.inlineEdit.richTextViewAccessor"
        },
        editAccessor: {
            type: "fluid.inlineEdit.tinyMCE.viewAccessor"
        },
        lazyEditView: true,
        defaultViewText: "Click Edit",
        modelComparator: fluid.inlineEdit.htmlComparator,
        onBlur: "finish",
        blurHandlerBinder: fluid.inlineEdit.tinyMCE.blurHandlerBinder,
        displayModeRenderer: fluid.inlineEdit.richTextDisplayModeRenderer,
        editModeRenderer: fluid.inlineEdit.tinyMCE.editModeRenderer
    });


    /****************************
     * CKEditor 3.x Integration *
     ****************************/

    var flCKEditor = fluid.registerNamespace("fluid.inlineEdit.CKEditor");

    fluid.inlineEdit.CKEditor.getEditor = function (editField) {
        return CKEDITOR.instances[editField.prop("id")];
    };

    fluid.inlineEdit.CKEditor.setValue = function (editField, editor, value) {
        editor.setData(value);
    };

    fluid.inlineEdit.CKEditor.getValue = function (editor) {
        return editor.getData();
    };

    fluid.defaults("fluid.inlineEdit.CKEditor.viewAccessor", {
        gradeNames: ["fluid.inlineEdit.editorViewAccessor"],
        editorGetFn: flCKEditor.getEditor,
        setValueFn: flCKEditor.setValue,
        getValueFn: flCKEditor.getValue
    });

    fluid.inlineEdit.CKEditor.focus = function (editor) {
        setTimeout(function () {
            // CKEditor won't focus itself except in a timeout.
            editor.trigger("focus");
        }, 0);
    };

    // Special hacked HTML normalisation for CKEditor which spuriously inserts whitespace
    // just after the first opening tag
    fluid.inlineEdit.CKEditor.normalizeHTML = function (value) {
        var togo = fluid.inlineEdit.normalizeHTML(value);
        var angpos = togo.indexOf(">");
        if (angpos !== -1 && angpos < togo.length - 1) {
            if (togo.charAt(angpos + 1) !== " ") {
                togo = togo.substring(0, angpos + 1) + " " + togo.substring(angpos + 1);
            }
        }
        return togo;
    };

    fluid.inlineEdit.CKEditor.htmlComparator = function (el1, el2) {
        return fluid.inlineEdit.CKEditor.normalizeHTML(el1) ===
            fluid.inlineEdit.CKEditor.normalizeHTML(el2);
    };

    fluid.inlineEdit.CKEditor.blurHandlerBinder = function (that) {
        that.events.afterInitEdit.addListener(fluid.inlineEdit.CKEditor.focus);
        that.events.afterBeginEdit.addListener(function () {
            var editor = fluid.inlineEdit.CKEditor.getEditor(that.editField);
            if (editor) {
                fluid.inlineEdit.CKEditor.focus(editor);
            }
        });
    };

    fluid.inlineEdit.CKEditor.editModeRenderer = function (that) {
        var id = fluid.allocateSimpleId(that.editField);
        $.data(fluid.unwrap(that.editField), "fluid.inlineEdit.CKEditor", that);
        var editor = CKEDITOR.replace(id, that.options.CKEditor);
        editor.on("instanceReady", function (e) {
            fluid.inlineEdit.CKEditor.focus(e.editor);
            that.events.afterInitEdit.fire(e.editor);
        });
    };

    fluid.defaults("fluid.inlineEdit.CKEditor", {
        gradeNames: ["fluid.inlineEdit"],
        selectors: {
            edit: "textarea"
        },
        styles: {
            invitation: "fl-inlineEdit-richText-invitation",
            displayView: "fl-inlineEdit-textContainer",
            text: ""
        },
        strings: {
            textEditButton: "Edit"
        },
        displayAccessor: {
            type: "fluid.inlineEdit.richTextViewAccessor"
        },
        editAccessor: {
            type: "fluid.inlineEdit.CKEditor.viewAccessor"
        },
        lazyEditView: true,
        defaultViewText: "Click Edit",
        modelComparator: fluid.inlineEdit.CKEditor.htmlComparator,
        blurHandlerBinder: fluid.inlineEdit.CKEditor.blurHandlerBinder,
        displayModeRenderer: fluid.inlineEdit.richTextDisplayModeRenderer,
        editModeRenderer: fluid.inlineEdit.CKEditor.editModeRenderer,
        CKEditor: {
            // CKEditor-specific configuration goes here.
        }
    });


    /************************
     * Dropdown Integration *
     ************************/

    fluid.registerNamespace("fluid.inlineEdit.dropdown");

    fluid.inlineEdit.dropdown.editModeRenderer = function (that) {
        fluid.allocateSimpleId(that.editField);
        that.editField.selectbox({
            finishHandler: function () {
                that.finish();
            }
        });
        return {
            container: that.editContainer,
            field: $("input.selectbox", that.editContainer)
        };
    };

    fluid.inlineEdit.dropdown.blurHandlerBinder = function (that) {
        fluid.deadMansBlur(that.editField, {
            exclusions: {selectBox: $("div.selectbox-wrapper", that.editContainer)},
            handler: function () {
                that.cancel();
            }
        });
    };

    /**
     * Instantiate a drop-down InlineEdit component
     *
     * @param {Object} container - The container for this component.
     * @param {Object} options - The component options.
     */

    fluid.defaults("fluid.inlineEdit.dropdown", {
        gradeNames: ["fluid.inlineEdit"],
        applyEditPadding: false,
        blurHandlerBinder: fluid.inlineEdit.dropdown.blurHandlerBinder,
        editModeRenderer: fluid.inlineEdit.dropdown.editModeRenderer
    });
})(jQuery, fluid_3_0_0);
