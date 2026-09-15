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

/*******************
 * File Queue View *
 *******************/

(function ($, fluid) {
    "use strict";

    fluid.registerNamespace("fluid.uploader.fileQueueView");

    // Real data binding would be nice to replace these two pairs.
    fluid.uploader.fileQueueView.rowForFile = function (that, file) {
        return that.container.find("#" + file.id);
    };

    fluid.uploader.fileQueueView.errorRowForFile = function (that, file) {
        return $("#" + file.id + "_error", that.container);
    };

    // TODO: None of this hierarchy operates a proper model idiom since it just shares an array instance with fileQueue
    fluid.uploader.fileQueueView.fileForRow = function (that, row) {
        return fluid.find_if(that.queueFiles, function (file) {
            return file.id.toString() === row.prop("id");
        });
    };

    fluid.uploader.fileQueueView.progressorForFile = function (that, file) {
        var progressId = file.id + "_progress";
        return that.fileProgressors[progressId];
    };

    fluid.uploader.fileQueueView.startFileProgress = function (that, file) {
        var fileRowElm = fluid.uploader.fileQueueView.rowForFile(that, file);
        that.scroller.scrollTo(fileRowElm);

        // update the progressor and make sure that it's in position
        var fileProgressor = fluid.uploader.fileQueueView.progressorForFile(that, file);
        fileProgressor.refreshView();
        fileProgressor.show();
    };

    fluid.uploader.fileQueueView.updateFileProgress = function (that, file, fileBytesComplete, fileTotalBytes) {
        var filePercent = fluid.uploader.derivePercent(fileBytesComplete, fileTotalBytes);
        var filePercentStr = filePercent + "%";
        fluid.uploader.fileQueueView.progressorForFile(that, file).update(filePercent, filePercentStr);
    };

    fluid.uploader.fileQueueView.hideFileProgress = function (that, file) {
        var fileRowElm = fluid.uploader.fileQueueView.rowForFile(that, file);
        fluid.uploader.fileQueueView.progressorForFile(that, file).hide();
        if (file.filestatus === fluid.uploader.fileStatusConstants.COMPLETE) {
            that.locate("fileIconBtn", fileRowElm).removeClass(that.options.styles.dim);
        }
    };

    fluid.uploader.fileQueueView.removeFileProgress = function (that, file) {
        var fileProgressor = fluid.uploader.fileQueueView.progressorForFile(that, file);
        if (!fileProgressor) {
            return;
        }
        var rowProgressor = fileProgressor.displayElement;
        rowProgressor.remove();
    };

    fluid.uploader.fileQueueView.animateRowRemoval = function (that, row) {
        row.fadeOut("fast", function () {
            row.remove();
            that.refreshView();
        });
    };

    fluid.uploader.fileQueueView.removeFileErrorRow = function (that, file) {
        if (file.filestatus === fluid.uploader.fileStatusConstants.ERROR) {
            fluid.uploader.fileQueueView.animateRowRemoval(that, fluid.uploader.fileQueueView.errorRowForFile(that, file));
        }
    };

    fluid.uploader.fileQueueView.removeFileAndRow = function (that, file, row) {
        // Clean up the stuff associated with a file row.
        fluid.uploader.fileQueueView.removeFileProgress(that, file);
        fluid.uploader.fileQueueView.removeFileErrorRow(that, file);

        // Remove the file itself.
        that.events.onFileRemoved.fire(file);
        fluid.uploader.fileQueueView.animateRowRemoval(that, row);
    };

    fluid.uploader.fileQueueView.removeFileForRow = function (that, row) {
        var file = fluid.uploader.fileQueueView.fileForRow(that, row);
        if (!file || file.filestatus === fluid.uploader.fileStatusConstants.COMPLETE) {
            return;
        }
        fluid.uploader.fileQueueView.removeFileAndRow(that, file, row);
    };

    fluid.uploader.fileQueueView.removeRowForFile = function (that, file) {
        var row = fluid.uploader.fileQueueView.rowForFile(that, file);
        fluid.uploader.fileQueueView.removeFileAndRow(that, file, row);
    };

    fluid.uploader.fileQueueView.bindHover = function (row, styles) {
        var over = function () {
            if (row.hasClass(styles.ready) && !row.hasClass(styles.uploading)) {
                row.addClass(styles.hover);
            }
        };

        var out = function () {
            if (row.hasClass(styles.ready) && !row.hasClass(styles.uploading)) {
                row.removeClass(styles.hover);
            }
        };
        row.on("mouseenter", over);
        row.on("mouseleave", out);
    };

    fluid.uploader.fileQueueView.bindDeleteKey = function (that, row) {
        var deleteHandler = function () {
            fluid.uploader.fileQueueView.removeFileForRow(that, row);
        };

        fluid.activatable(row, null, {
            additionalBindings: [{
                key: $.ui.keyCode.DELETE,
                activateHandler: deleteHandler
            }]
        });
    };

    fluid.uploader.fileQueueView.bindRowHandlers = function (that, row) {
        if ($.browser.msie && $.browser.version < 7) {
            fluid.uploader.fileQueueView.bindHover(row, that.options.styles);
        }

        that.locate("fileIconBtn", row).on("click", function () {
            fluid.uploader.fileQueueView.removeFileForRow(that, row);
        });

        fluid.uploader.fileQueueView.bindDeleteKey(that, row);
    };

    fluid.uploader.fileQueueView.renderRowFromTemplate = function (that, file) {
        var row = that.rowTemplate.clone(),
            fileName = file.name,
            fileSize = fluid.uploader.formatFileSize(file.size);

        row.removeClass(that.options.styles.hiddenTemplate);
        that.locate("fileName", row).text(fileName);
        that.locate("fileSize", row).text(fileSize);

        var fileIconBtn = that.locate("fileIconBtn", row);
        fileIconBtn.addClass(that.options.styles.remove);
        fluid.updateAriaLabel(fileIconBtn, that.options.strings.buttons.remove);

        row.prop("id", file.id);
        row.addClass(that.options.styles.ready);
        fluid.uploader.fileQueueView.bindRowHandlers(that, row);
        fluid.updateAriaLabel(row, fileName + " " + fileSize);
        return row;
    };

    fluid.uploader.fileQueueView.createProgressorFromTemplate = function (that, row) {
        // create a new progress bar for the row and position it
        var rowProgressor = that.rowProgressorTemplate.clone();
        var rowId = row.prop("id");
        var progressId = rowId + "_progress";
        rowProgressor.prop("id", progressId);
        rowProgressor.css("top", row.position().top);
        rowProgressor.height(row.height()).width(5);
        that.container.after(rowProgressor);

        that.fileProgressors[progressId] = fluid.progress(that.options.uploaderContainer, {
            selectors: {
                progressBar: "#" + rowId,
                displayElement: "#" + progressId,
                label: "#" + progressId + " .fl-uploader-file-progress-text",
                indicator: "#" + progressId
            }
        });
    };

    fluid.uploader.fileQueueView.addFile = function (that, file) {
        var row = fluid.uploader.fileQueueView.renderRowFromTemplate(that, file);
        /* FLUID-2720 - do not hide the row under IE8 */
        if (!($.browser.msie && ($.browser.version >= 8))) {
            row.hide();
        }
        that.container.append(row);
        row.attr("title", that.options.strings.status.remove);
        row.fadeIn("slow");
        fluid.uploader.fileQueueView.createProgressorFromTemplate(that, row);
        that.refreshView();
        that.scroller.scrollTo("max");
    };

    // Toggle keyboard row handlers on and off depending on the uploader state
    fluid.uploader.fileQueueView.enableRows = function (rows, state) {
        for (var i = 0; i < rows.length; i++) {
            fluid.enabled(rows[i], state);
        }
    };

    fluid.uploader.fileQueueView.prepareForUpload = function (that) {
        var rowButtons = that.locate("fileIconBtn", that.locate("fileRows"));
        rowButtons.prop("disabled", true);
        rowButtons.addClass(that.options.styles.dim);
        fluid.uploader.fileQueueView.enableRows(that.locate("fileRows"), false);
    };

    fluid.uploader.fileQueueView.refreshAfterUpload = function (that) {
        var rows = that.locate("fileRows");
        var rowButtons = that.locate("fileIconBtn", rows);
        // only re-enable rowButtons for files that have not been uploaded.
        rowButtons.each(function (index, rowButton) {
            // TODO: Improve detection of completed files so as not to rely on row styling.
            $(rowButton).prop("disabled", rows.eq(index).hasClass(that.options.styles.uploaded));
        });
        rowButtons.removeClass(that.options.styles.dim);
        fluid.uploader.fileQueueView.enableRows(that.locate("fileRows"), true);
    };

    fluid.uploader.fileQueueView.changeRowState = function (that, row, newState) {
        row.removeClass(that.options.styles.ready).removeClass(that.options.styles.error).addClass(newState);
    };

    fluid.uploader.fileQueueView.markRowAsComplete = function (that, file) {
        // update styles and keyboard bindings for the file row
        var row = fluid.uploader.fileQueueView.rowForFile(that, file);
        fluid.uploader.fileQueueView.changeRowState(that, row, that.options.styles.uploaded);
        row.attr("title", that.options.strings.status.success);
        fluid.enabled(row, false);

        // update the click event and the styling for the file delete button
        var rowButton = that.locate("fileIconBtn", row);
        rowButton.off("click");
        rowButton.removeClass(that.options.styles.remove);
        rowButton.attr("title", that.options.strings.status.success);
    };

    fluid.uploader.fileQueueView.renderErrorInfoFromTemplate = function (that, fileRow, error) {
        // Render the row by cloning the template and binding its id to the file.
        var errorRow = that.errorInfoTemplate.clone();
        errorRow.prop("id", fileRow.prop("id") + "_error");

        // Look up the error message and render it.
        var errorType = fluid.keyForValue(fluid.uploader.errorConstants, error);
        var errorMsg = that.options.strings.errors[errorType];
        that.locate("errorText", errorRow).text(errorMsg);
        that.locate("fileName", fileRow).after(errorRow);
        that.scroller.scrollTo(errorRow);
    };

    fluid.uploader.fileQueueView.showErrorForFile = function (that, file, error) {
        fluid.uploader.fileQueueView.hideFileProgress(that, file);
        if (file.filestatus === fluid.uploader.fileStatusConstants.ERROR) {
            var fileRowElm = fluid.uploader.fileQueueView.rowForFile(that, file);
            fluid.uploader.fileQueueView.changeRowState(that, fileRowElm, that.options.styles.error);
            fluid.uploader.fileQueueView.renderErrorInfoFromTemplate(that, fileRowElm, error);
        }
    };

    fluid.uploader.fileQueueView.addKeyboardNavigation = function (that) {
        fluid.tabbable(that.container);
        that.selectableContext = fluid.selectable(that.container, {
            selectableSelector: that.options.selectors.fileRows,
            onSelect: function (itemToSelect) {
                $(itemToSelect).addClass(that.options.styles.selected);
            },
            onUnselect: function (selectedItem) {
                $(selectedItem).removeClass(that.options.styles.selected);
            }
        });
    };

    fluid.uploader.fileQueueView.prepareTemplateElements = function (that) {
        // Grab our template elements out of the DOM.
        that.errorInfoTemplate = that.locate("errorInfoTemplate").remove();
        that.errorInfoTemplate.removeClass(that.options.styles.hiddenTemplate);
        that.rowTemplate = that.locate("rowTemplate").remove();
        that.rowProgressorTemplate = that.locate("rowProgressorTemplate", that.options.uploaderContainer).remove();
    };

    fluid.uploader.fileQueueView.markFileComplete = function (that, file) {
        fluid.uploader.fileQueueView.progressorForFile(that, file).update(100, "100%");
        fluid.uploader.fileQueueView.markRowAsComplete(that, file);
    };

    fluid.uploader.fileQueueView.refreshView = function (that) {
        that.selectableContext.refresh();
        that.scroller.refreshView();
    };

    /**
     * Creates a new File Queue view.
     *
     * @param {jQuery|selector} container - the file queue's container DOM element
     * @param {fileQueue} queue - a file queue model instance
     * @param {Object} options - (optional) configuration options for the view
     */
    fluid.defaults("fluid.uploader.fileQueueView", {
        gradeNames: ["fluid.viewComponent"],
        mergePolicy: {
            // TODO: This mergePolicy was required by some attempts at fixing FLUID-5668
            // and may be required again in future if this component is not modelised
            // "members.queueFiles": "nomerge"
        },
        members: {
            fileProgressors: {}
            // queueFiles: applied in uploader options - TODO: no model idiom
        },
        invokers: {
            addFile: {
                funcName: "fluid.uploader.fileQueueView.addFile",
                args: ["{that}", "{arguments}.0"] // file
            },
            removeFile: {
                funcName: "fluid.uploader.fileQueueView.removeRowForFile",
                args: ["{that}", "{arguments}.0"] // file
            },
            prepareForUpload: {
                funcName: "fluid.uploader.fileQueueView.prepareForUpload",
                args: "{that}"
            },
            refreshAfterUpload: {
                funcName: "fluid.uploader.fileQueueView.refreshAfterUpload",
                args: "{that}"
            },
            showFileProgress: {
                funcName: "fluid.uploader.fileQueueView.startFileProgress",
                args: ["{that}", "{arguments}.0"] // file
            },
            updateFileProgress: {
                funcName: "fluid.uploader.fileQueueView.updateFileProgress",
                args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // file, fileBytesComplete, fileTotalBytes
            },
            markFileComplete: {
                funcName: "fluid.uploader.fileQueueView.markFileComplete",
                args: ["{that}", "{arguments}.0"] // file
            },
            showErrorForFile: {
                funcName: "fluid.uploader.fileQueueView.showErrorForFile",
                args: ["{that}", "{arguments}.0", "{arguments}.1"] // file, error
            },
            hideFileProgress: {
                funcName: "fluid.uploader.fileQueueView.hideFileProgress",
                args: ["{that}", "{arguments}.0"] // file
            },
            refreshView: {
                funcName: "fluid.uploader.fileQueueView.refreshView",
                args: "{that}"
            }
        },
        components: {
            scroller: {
                type: "fluid.scrollableTable",
                container: "{fileQueueView}.container"
            }
        },

        selectors: {
            fileRows: ".flc-uploader-file",
            fileName: ".flc-uploader-file-name",
            fileSize: ".flc-uploader-file-size",
            fileIconBtn: ".flc-uploader-file-action",
            errorText: ".flc-uploader-file-error",

            rowTemplate: ".flc-uploader-file-tmplt",
            errorInfoTemplate: ".flc-uploader-file-error-tmplt",
            rowProgressorTemplate: ".flc-uploader-file-progressor-tmplt"
        },

        styles: {
            hover: "fl-uploader-file-hover",
            selected: "fl-uploader-file-focus",
            ready: "fl-uploader-file-state-ready",
            uploading: "fl-uploader-file-state-uploading",
            uploaded: "fl-uploader-file-state-uploaded",
            error: "fl-uploader-file-state-error",
            remove: "fl-uploader-file-action-remove",
            dim: "fl-uploader-dim",
            hiddenTemplate: "fl-uploader-hidden-templates"
        },

        strings: {
            progress: {
                toUploadLabel: "To upload: %fileCount %fileLabel (%totalBytes)",
                singleFile: "file",
                pluralFiles: "files"
            },
            status: {
                success: "File Uploaded",
                error: "File Upload Error",
                remove: "Press Delete key to remove file"
            },
            errors: {
                HTTP_ERROR: "File upload error: a network error occured or the file was rejected (reason unknown).",
                IO_ERROR: "File upload error: a network error occured.",
                UPLOAD_LIMIT_EXCEEDED: "File upload error: you have uploaded as many files as you are allowed during this session",
                UPLOAD_FAILED: "File upload error: the upload failed for an unknown reason.",
                QUEUE_LIMIT_EXCEEDED: "You have as many files in the queue as can be added at one time. Removing files from the queue may allow you to add different files.",
                FILE_EXCEEDS_SIZE_LIMIT: "One or more of the files that you attempted to add to the queue exceeded the limit of %fileSizeLimit.",
                ZERO_BYTE_FILE: "One or more of the files that you attempted to add contained no data.",
                INVALID_FILETYPE: "One or more files were not added to the queue because they were of the wrong type."
            },
            buttons: {
                remove: "Remove"
            }
        },
        events: {
            onFileRemoved: null
        },
        listeners: {
            "onCreate.prepareTemplateElement": "fluid.uploader.fileQueueView.prepareTemplateElements",
            "onCreate.addKeyboardNavigation":   "fluid.uploader.fileQueueView.addKeyboardNavigation",
            "onCreate.addAriaRole": {
                "this": "{that}.container",
                method: "attr",
                args: {
                    role: "application"
                }
            }
        }
    });

    /**
     * An interactional mixin for binding a fileQueueView to an Uploader
     */
    fluid.defaults("fluid.uploader.fileQueueView.bindUploader", {
        events: {
            onFileRemoved: "{uploader}.events.onFileRemoved"
        },
        listeners: {
            "{uploader}.events.afterFileQueued": "{fileQueueView}.addFile",
            "{uploader}.events.onUploadStart": "{fileQueueView}.prepareForUpload",
            "{uploader}.events.onFileStart": "{fileQueueView}.showFileProgress",
            "{uploader}.events.onFileProgress": "{fileQueueView}.updateFileProgress",
            "{uploader}.events.onFileSuccess": "{fileQueueView}.markFileComplete",
            "{uploader}.events.onFileError": "{fileQueueView}.showErrorForFile",
            "{uploader}.events.afterFileComplete": "{fileQueueView}.hideFileProgress",
            "{uploader}.events.afterUploadComplete": "{fileQueueView}.refreshAfterUpload"
        }
    });

    /**************
     * Scrollable *
     **************/

    fluid.registerNamespace("fluid.scrollable");

    fluid.scrollable.makeSimple = function (element) {
        return fluid.container(element);
    };

    fluid.scrollable.makeTable =  function (table, wrapperMarkup) {
        table.wrap(wrapperMarkup);
        return table.closest(".fl-scrollable-scroller");
    };

    /*
     * Simple component cover for the jQuery scrollTo plugin. Provides roughly equivalent
     * functionality to Uploader's old Scroller plugin.
     */
    fluid.defaults("fluid.scrollable", {
        gradeNames: ["fluid.viewComponent"],
        makeScrollableFn: fluid.scrollable.makeSimple, // NB - a modern style would configure an invoker
        members: {
            scrollable: {
                expander: {
                    func: "{that}.options.makeScrollableFn",
                    args: ["{that}.container", "{that}.options.wrapperMarkup"] // TODO: we need to make sure that expander arguments are evaluated fully
                }
            },
            maxHeight: {
                expander: {
                    "this": "{that}.scrollable",
                    method: "css",
                    args: "max-height"
                }
            }
        },
        invokers: {
            /**
             * Programmatically scrolls this scrollable element to the region specified.
             * This method is directly compatible with the underlying jQuery.scrollTo plugin.
             */
            scrollTo: {
                "this": "{that}.scrollable",
                method: "scrollTo",
                args: "{arguments}.0"
            },
            refreshView: {
                funcName: "fluid.scrollable.refreshView",
                args: "{that}"
            }
        },
        listeners: {
            onCreate: "{that}.refreshView"
        }
    });

    /*
     * Updates the view of the scrollable region. This should be called when the content of the scrollable region is changed.
     */
    fluid.scrollable.refreshView = function (that) {
        if ($.browser.msie && $.browser.version === "6.0") {
            that.scrollable.css("height", "");

            // Set height, if max-height is reached, to allow scrolling in IE6.
            if (that.scrollable.height() >= parseInt(that.maxHeight, 10)) {
                that.scrollable.css("height", that.maxHeight);
            }
        }
    };

    /*
     * Wraps a table in order to make it scrollable with the jQuery.scrollTo plugin.
     * Container divs are injected to allow cross-browser support.
     */
    fluid.defaults("fluid.scrollableTable", {
        gradeNames: ["fluid.scrollable"],
        makeScrollableFn: fluid.scrollable.makeTable,
        wrapperMarkup: "<div class='fl-scrollable-scroller'><div class='fl-scrollable-inner'></div></div>"
    });


})(jQuery, fluid_3_0_0);
