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

    fluid.defaults("fluid.uploader.errorPanel", {
        gradeNames: ["fluid.viewComponent", "fluid.contextAware"],
        invokers: {
            refreshView: "fluid.uploader.errorPanel.refreshView({that})"
        },
        events: {
            afterRender: null
        },

        components: {
            // TODO: This won't scale nicely with more types of errors.
            fileSizeErrorSection: {
                type: "fluid.uploader.errorPanel.section",
                createOnEvent: "afterRender",
                container: "{errorPanel}.dom.fileSizeErrorSection",
                options: {
                    model: {
                        errorCode: fluid.uploader.queueErrorConstants.FILE_EXCEEDS_SIZE_LIMIT
                    },
                    strings: {
                        header: "{errorPanel}.options.strings.exceedsFileSize"
                    }
                }
            },

            numFilesErrorSection: {
                type: "fluid.uploader.errorPanel.section",
                createOnEvent: "afterRender",
                container: "{errorPanel}.dom.numFilesErrorSection",
                options: {
                    model: {
                        errorCode: fluid.uploader.queueErrorConstants.QUEUE_LIMIT_EXCEEDED
                    },
                    strings: {
                        header: "{errorPanel}.options.strings.exceedsNumFilesLimit"
                    }
                }
            }
        },

        selectors: {
            header: ".flc-uploader-errorPanel-header",
            sectionTemplate: ".flc-uploader-errorPanel-section-tmplt",
            fileSizeErrorSection: ".flc-uploader-errorPanel-section-fileSize",
            numFilesErrorSection: ".flc-uploader-errorPanel-section-numFiles"
        },

        strings: {
            headerText: "Warning(s)",
            exceedsNumFilesLimit: "Too many files were selected. %numFiles were not added to the queue.",
            exceedsFileSize: "%numFiles files were too large and were not added to the queue."
        },
        listeners: {
            "onCreate.renderSectionTemplates": {
                funcName: "fluid.uploader.errorPanel.renderSectionTemplates",
                args: "{that}",
                priority: "before:domComplete"
            },
            "onCreate.domComplete": {
                funcName: "fluid.uploader.errorPanel.domComplete",
                args: "{that}"
            }
        },

        styles: {
            hiddenTemplate: "fl-hidden-templates"
        }
    });

    fluid.uploader.errorPanel.refreshView = function (that) {
        for (var i = 0; i < that.sections.length; i++) {
            if (that.sections[i].model.files.length > 0) {
                // One of the sections has errors. Show them and bail immediately.
                that.container.show();
                return;
            }
        }
        that.container.hide();
    };

    fluid.uploader.errorPanel.renderSectionTemplates = function (that) {
        var sectionTmpl = that.locate("sectionTemplate").remove().removeClass(that.options.styles.hiddenTemplate);
        that.locate("fileSizeErrorSection").append(sectionTmpl.clone());
        that.locate("numFilesErrorSection").append(sectionTmpl.clone());
        that.events.afterRender.fire(that);
    };

    fluid.uploader.errorPanel.domComplete = function (that) {
        that.sections = [that.fileSizeErrorSection, that.numFilesErrorSection];
        that.locate("header").text(that.options.strings.headerText);
        that.container.hide();
    };

    // An "interactional mixin" - a courtesy to dream of a possibility that an "errorPanel" could conceivably be deployed separately
    // from an "uploader"
    fluid.defaults("fluid.uploader.errorPanel.bindUploader", {
        listeners: {
            "{uploader}.events.afterFileDialog": "{errorPanel}.refreshView"
        },
        distributeOptions: {
            target: "{that fluid.uploader.errorPanel.section}.options.listeners",
            record: {
                "{uploader}.events.onQueueError": "{section}.addFile",
                "{uploader}.events.onFilesSelected": "{section}.clear",
                "{uploader}.events.onUploadStart": "{section}.clear",
                "{section}.events.afterErrorsCleared": "{errorPanel}.refreshView"
            }
        }
    });

    fluid.defaults("fluid.uploader.errorPanel.section", {
        gradeNames: ["fluid.viewComponent"],
        model: {
            errorCode: undefined,
            files: [],
            showingDetails: false
        },

        events: {
            afterErrorsCleared: null
        },

        selectors: {
            errorTitle: ".fl-uploader-errorPanel-section-title",
            deleteErrorButton: ".flc-uploader-errorPanel-section-removeButton",
            errorDetails: ".flc-uploader-errorPanel-section-details",
            erroredFiles: ".flc-uploader-errorPanel-section-files",
            showHideFilesToggle: ".flc-uploader-errorPanel-section-toggleDetails"
        },

        strings: {
            hideFiles: "Hide files",
            showFiles: "Show files",
            fileListDelimiter: ", "
        },
        invokers: {
            toggleDetails: "fluid.uploader.errorPanel.section.toggleDetails({that})",
            showDetails: "fluid.uploader.errorPanel.section.showDetails({that})",
            hideDetails: "fluid.uploader.errorPanel.section.hideDetails({that})",
            addFile: "fluid.uploader.errorPanel.section.addFile({that}, {arguments}.0, {arguments}.1)", // file, errorCode
            clear: "fluid.uploader.errorPanel.section.clear({that})",
            refreshView: "fluid.uploader.errorPanel.section.refreshView({that})"
        },
        listeners: {
            "onCreate.bindHandlers": {
                funcName: "fluid.uploader.errorPanel.section.bindHandlers",
                priority: "after:refreshView"
            },
            "onCreate.refreshView": "{that}.refreshView"
        }
    });

    fluid.uploader.errorPanel.section.toggleDetails = function (that) {
        var detailsAction = that.model.showingDetails ? that.hideDetails : that.showDetails;
        detailsAction();
    };

    fluid.uploader.errorPanel.section.showDetails = function (that) {
        that.locate("errorDetails").show();
        that.locate("showHideFilesToggle").text(that.options.strings.hideFiles);
        that.model.showingDetails = true; // TODO: model abuse
    };

    fluid.uploader.errorPanel.section.hideDetails = function (that) {
        that.locate("errorDetails").hide();
        that.locate("showHideFilesToggle").text(that.options.strings.showFiles);
        that.model.showingDetails = false;
    };

    fluid.uploader.errorPanel.section.addFile = function (that, file, errorCode) {
        if (errorCode === that.model.errorCode) {
            that.model.files.push(file.name);
            that.refreshView();
        }
    };

    fluid.uploader.errorPanel.section.clear = function (that) {
        that.model.files = [];
        that.refreshView();
        that.events.afterErrorsCleared.fire();
    };

    fluid.uploader.errorPanel.section.refreshView = function (that) {
        fluid.uploader.errorPanel.section.renderHeader(that);
        fluid.uploader.errorPanel.section.renderErrorDetails(that);
        that.hideDetails();

        if (that.model.files.length <= 0) { // TODO: use model relay and "visibility model"
            that.container.hide();
        } else {
            that.container.show();
        }
    };

    fluid.uploader.errorPanel.section.bindHandlers = function (that) {
        // Bind delete button
        that.locate("deleteErrorButton").on("click", that.clear);

        // Bind hide/show error details link
        that.locate("showHideFilesToggle").on("click", that.toggleDetails);
    };

    fluid.uploader.errorPanel.section.renderHeader = function (that) {
        var errorTitle = fluid.stringTemplate(that.options.strings.header, {
            numFiles: that.model.files.length
        });

        that.locate("errorTitle").text(errorTitle);
    };

    fluid.uploader.errorPanel.section.renderErrorDetails = function (that) {
        var files = that.model.files;
        var filesList = files.length > 0 ? files.join(that.options.strings.fileListDelimiter) : "";
        that.locate("erroredFiles").text(filesList);
    };


})(jQuery, fluid_3_0_0);
