/*! CodeMirror components for Fluid Infusion
 *  Copyright 2015, Antranig Basman
 *  Copyright 2015, Colin Clark
 *  Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global fluid, jQuery*/

(function ($) {
    "use strict";

    fluid.defaults("fluid.codeMirror", {
        gradeNames: "fluid.viewComponent",

        codeMirrorOptions: {
            "lineNumbers": true,
            "mode": true,
            "gutters": true,
            "autoCloseBrackets": true,
            "tabSize": true,
            "indentUnit": true,
            "theme": true,
            "smartIndent": true,
            "matchBrackets": true,
            "autofocus": true
        },

        // We relay all raw CodeMirror events with the additional argument "that" in 0th place;
        // the rest are shifted one to the right.
        codeMirrorEvents: [
            "onChange",
            "onCursorActivity",
            "onViewportChange",
            "onGutterClick",
            "onScroll",
            "onUpdate"
        ],

        events: {
            onAssembleCodeMirrorOptions: null,
            onCreateCodeMirror: null,
            onChange: null,
            onCursorActivity: null,
            onViewportChange: null,
            onGutterClick: null,
            onScroll: null,
            onUpdate: null
        },

        listeners: {
            "onCreate.createCodeMirror": "fluid.codeMirror.create",
            "onCreateCodeMirror.bindBlurHandler": {
                funcName: "fluid.codeMirror.bindBlurHandler",
                args:    ["{that}", "{arguments}.1"] // editor
            }
        },
        invokers: {
            handleBlur: "fluid.codeMirror.handleBlur({that})",
            createEditor: "CodeMirror({that}.container.0, {arguments}.0)",
            getContent: "fluid.codeMirror.getContent({that}.editor)",
            setContent: "fluid.codeMirror.setContent({that}.editor, {arguments}.0)",
            isEmpty: "fluid.codeMirror.isEmpty({that}.editor)"
        }
    });

    fluid.defaults("fluid.codeMirror.textArea", {
        gradeNames: "fluid.component",
        invokers: {
            createEditor: "CodeMirror.fromTextArea({that}.container.0, {arguments}.0)"
        }
    });

    fluid.codeMirror.makeEventListener = function (that, event) {
        return function () {
            var args = fluid.makeArray(arguments);
            args.unshift(that);
            return event.fire.apply(null, args);
        };
    };

    // Acquire all of the initial values of recognised CodeMirror option values, and copy them into our model
    // This forms a kind of "late initial transaction" for these model values. We then begin listening to further changes
    // to them and applying them back into our model.
    fluid.codeMirror.initOptionsModel = function (that, editor) {
        var trans = that.applier.initiate();
        fluid.each(that.options.codeMirrorOptions, function (valoo, key) {
            var optValue = editor.getOption(key);
            trans.change(["codeMirrorOptions", key], optValue);
        });
        trans.commit();
        that.applier.modelChanged.addListener("codeMirrorOptions.*", function (value, oldValue, segs) {
            editor.setOption(segs[1], value);
        });
    };

    fluid.codeMirror.create = function (that) {
        var opts = fluid.filterKeys($.extend({}, that.options), fluid.keys(that.options.codeMirrorOptions));
        var events = that.options.codeMirrorEvents;

        for (var i = 0; i < events.length; ++i) {
            var event = events[i];
            opts[event] = fluid.codeMirror.makeEventListener(that, that.events[event]);
        }
        that.events.onAssembleCodeMirrorOptions.fire(that, opts);
        that.editor = that.createEditor(opts);
        that.wrapper = that.editor.getWrapperElement();
        that.events.onCreateCodeMirror.fire(that, that.editor);
        that.codeMirrorInitialised = true;
    };

    /**
     *
     * CodeMirror does not provide a means of exiting the editor, and traps tabs.  This combination makes it a dead end
     * from which keyboard navigation users can only release themselves by reloading the screen.  It also means that
     * keyboard navigation users can never navigate beyond the editor.
     *
     * This function is called when a user hits the `Esc` key from within the editor, and focuses on the next focusable
     * element after the editor.  If there is no focusable element after the editor, our next choice is the first
     * focusable element in the body.  This approximates what would happen if the user was able to hit tab again to
     * leave the editor.
     *
     * Note that this introduces a requirement on jQuery UI, which provides the `:focusable` selector.
     *
     * @param that - The component itself.
     *
     */
    fluid.codeMirror.handleBlur = function (that) {
        var elementToFocusOn = $(that.container).next(":focusable");
        if (!elementToFocusOn || elementToFocusOn.length === 0) {
            elementToFocusOn =  $(document).find(":focusable")[0];
        }

        elementToFocusOn.focus();
    };

    fluid.codeMirror.bindBlurHandler = function (that, editor) {
        editor.setOption("extraKeys", {
            Esc: that.handleBlur
        });
    };

    fluid.codeMirror.getContent = function (editor) {
        return editor.getDoc().getValue();
    };

    fluid.codeMirror.setContent = function (editor, content) {
        var doc = editor.getDoc();
        doc.setValue(content);
    };

    fluid.codeMirror.isEmpty = function (editor) {
        // TODO: If the editor is created with some content,
        // we should get at this directly (via the textarea, etc.)
        if (!editor) {
            return true;
        }

        var doc = editor.getDoc();
        if (doc.lineCount() > 1) {
            return false;
        }

        var first = doc.getLine(0);
        return $.trim(first).length === 0;
    };

    /** CODEMIRROR GRADE WITH LINTING SUPPORT **/

    fluid.defaults("fluid.lintingCodeMirror", {
        gradeNames: "fluid.codeMirror",

        events: {
            onUpdateLinting: null,
            // An event derived from "onUpdateLinting" which fires (that, true/false, etc.)
            // depending on whether the editor contents were linted as valid or not.
            // Currently this is detected by having any lint markers.
            onValidatedContentChange: null
        },

        listeners: {
            "onAssembleCodeMirrorOptions.createLinting": "fluid.codeMirror.createLinting",
            "onCreateCodeMirror.initOptionsModel": "fluid.codeMirror.initOptionsModel",
            "onUpdateLinting.onValidatedContentChange": "fluid.codeMirror.onUpdateLinting"
        },
        modelListeners: {
            "codeMirrorOptions.mode": "fluid.lintingCodeMirror.performLinting({that})"
        },

        invokers: {
            showLintMarkers: "fluid.codeMirror.showLintMarkers({that}, {arguments}.0, {arguments}.1)"
        },

        // Options to be passed raw to the codeMirror linting helper;
        // can accept funcs such as getAnnotation, formatAnnotation etc.
        lint: {
            tooltips: true,
            async: false,
            options: {}
        }
    });

    fluid.lintingCodeMirror.performLinting = function (that) {
        if (that.codeMirrorInitialised) {
            fluid.invokeLater(function () { // For some obscure reason a mode change will not be detected until the previous stack returns
                that.editor.performLint();
            });
        }
    };

    fluid.codeMirror.createLinting = function (that, opts) {
        var lint = fluid.copy(that.options.lint);
        lint.onUpdateLinting = fluid.codeMirror.makeEventListener(that, that.events.onUpdateLinting);
        opts.lint = lint;
    };

    fluid.codeMirror.showLintMarkers = function (that, visibility, selfDispatch) {
        if (!that.editor) {
            // Since CodeMirror does not participate in the GINGER WORLD,
            // we can't deal with this kind of race in a civilized manner;
            // the linting may apply during the construction process of the editor,
            // during which we can't find its parent element.
            if (!selfDispatch) {
                setTimeout(function () {
                    that.showLintMarkers(visibility, true);
                }, 1);
            }
        } else {
            var wrapper = that.editor.getWrapperElement();
            var markers = $(".CodeMirror-lint-marker-error", wrapper);
            markers.toggle(visibility);
        }
    };

    fluid.codeMirror.onUpdateLinting = function (that, annotationsNotSorted, annotations) {
        that.events.onValidatedContentChange.fire(
            that,
            annotationsNotSorted.length === 0,
            annotationsNotSorted,
            annotations
        );
        that.showLintMarkers(!that.isEmpty());
    };

})(jQuery);
