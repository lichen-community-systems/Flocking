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

/************
 * Uploader *
 ************/

(function ($, fluid) {
    "use strict";

    fluid.enhance.supportsBinaryXHR = function () {
        return window.FormData || (window.XMLHttpRequest && window.XMLHttpRequest.prototype && window.XMLHttpRequest.prototype.sendAsBinary);
    };
    fluid.enhance.supportsFormData = function () {
        return !!window.FormData;
    };

    fluid.contextAware.makeChecks({
        "fluid.browser.supportsBinaryXHR": {
            funcName: "fluid.enhance.supportsBinaryXHR"
        },
        "fluid.browser.supportsFormData": {
            funcName: "fluid.enhance.supportsFormData"
        }
    });


    fluid.registerNamespace("fluid.uploader");

    fluid.uploader.fileOrFiles = function (that, numFiles) {
        return (numFiles === 1) ? that.options.strings.progress.singleFile :
            that.options.strings.progress.pluralFiles;
    };

    // TODO: Use of these four utilities should be replaced by use of the "visibility model" described in FLUID-4928
    fluid.uploader.enableElement = function (that, elm) {
        elm.prop("disabled", false);
        elm.removeClass(that.options.styles.dim);
    };

    fluid.uploader.disableElement = function (that, elm) {
        elm.prop("disabled", true);
        elm.addClass(that.options.styles.dim);
    };

    fluid.uploader.showElement = function (that, elm) {
        elm.removeClass(that.options.styles.hidden);
    };

    fluid.uploader.hideElement = function (that, elm) {
        elm.addClass(that.options.styles.hidden);
    };

    fluid.uploader.maxFilesUploaded = function (that) {
        var fileUploadLimit = that.queue.getUploadedFiles().length + that.queue.getReadyFiles().length + that.queue.getErroredFiles().length;
        return (fileUploadLimit === that.options.queueSettings.fileUploadLimit);
    };

    fluid.uploader.setTotalProgressStyle = function (that, didError) {
        didError = didError || false;
        var indicator = that.totalProgress.indicator;
        indicator.toggleClass(that.options.styles.totalProgress, !didError);
        indicator.toggleClass(that.options.styles.totalProgressError, didError);
    };

    fluid.uploader.setStateEmpty = function (that) {
        fluid.uploader.disableElement(that, that.locate("uploadButton"));

        // If the queue is totally empty, treat it specially.
        if (that.queue.files.length === 0) {
            that.locate("browseButtonText").text(that.options.strings.buttons.browse);
            that.locate("browseButton").removeClass(that.options.styles.browseButton);
            fluid.uploader.showElement(that, that.locate("instructions"));
        }
    };

    // Only enable the browse button if the fileUploadLimit
    // has not been reached
    fluid.uploader.enableBrowseButton = function (that) {
        if (!fluid.uploader.maxFilesUploaded(that)) {
            fluid.uploader.enableElement(that, that.locate("browseButton"));
            that.strategy.local.enableBrowseButton();
        }
    };

    // See above comment: All of this wasted logic should be replaced by a model mapping system
    fluid.uploader.setStateDone = function (that) {
        fluid.uploader.disableElement(that, that.locate("uploadButton"));
        fluid.uploader.hideElement(that, that.locate("pauseButton"));
        fluid.uploader.showElement(that, that.locate("uploadButton"));
        fluid.uploader.enableBrowseButton(that);
    };

    fluid.uploader.setStateLoaded = function (that) {
        that.locate("browseButtonText").text(that.options.strings.buttons.addMore);
        that.locate("browseButton").addClass(that.options.styles.browseButton);
        fluid.uploader.hideElement(that, that.locate("pauseButton"));
        fluid.uploader.showElement(that, that.locate("uploadButton"));
        fluid.uploader.enableElement(that, that.locate("uploadButton"));
        fluid.uploader.hideElement(that, that.locate("instructions"));
        that.totalProgress.hide();
        fluid.uploader.enableBrowseButton(that);
    };

    fluid.uploader.setStateUploading = function (that) {
        that.totalProgress.hide(false, false);
        fluid.uploader.setTotalProgressStyle(that);
        fluid.uploader.hideElement(that, that.locate("uploadButton"));
        fluid.uploader.disableElement(that, that.locate("browseButton"));
        that.strategy.local.disableBrowseButton();
        fluid.uploader.enableElement(that, that.locate("pauseButton"));
        fluid.uploader.showElement(that, that.locate("pauseButton"));
    };

    fluid.uploader.setStateFull = function (that) {
        that.locate("browseButtonText").text(that.options.strings.buttons.addMore);
        that.locate("browseButton").addClass(that.options.styles.browseButton);
        fluid.uploader.hideElement(that, that.locate("pauseButton"));
        fluid.uploader.showElement(that, that.locate("uploadButton"));
        fluid.uploader.enableElement(that, that.locate("uploadButton"));
        fluid.uploader.disableElement(that, that.locate("browseButton"));
        that.strategy.local.disableBrowseButton();
        fluid.uploader.hideElement(that, that.locate("instructions"));
        that.totalProgress.hide();
    };

    fluid.uploader.renderUploadTotalMessage = function (that) {
        // Preservered for backwards compatibility, should be refactored post v1.5
        var numReadyFiles = that.queue.getReadyFiles().length;
        var bytesReadyFiles = that.queue.sizeOfReadyFiles();
        var fileLabelStr = fluid.uploader.fileOrFiles(that, numReadyFiles);

        var totalCount = that.queue.files.length;
        var noFilesMsg = that.options.strings.progress.noFiles;

        var totalStateStr = fluid.stringTemplate(that.options.strings.progress.toUploadLabel, {
            fileCount: numReadyFiles,
            fileLabel: fileLabelStr,
            totalBytes: fluid.uploader.formatFileSize(bytesReadyFiles),
            uploadedCount: that.queue.getUploadedFiles().length,
            uploadedSize: fluid.uploader.formatFileSize(that.queue.sizeOfUploadedFiles()),
            totalCount: totalCount,
            totalSize: fluid.uploader.formatFileSize(that.queue.totalBytes())
        });

        if (!totalCount && noFilesMsg) {
            totalStateStr = noFilesMsg;
        }

        that.locate("totalFileStatusText").html(totalStateStr);
    };

    fluid.uploader.renderFileUploadLimit = function (that) {
        if (that.options.queueSettings.fileUploadLimit > 0) {
            var fileUploadLimitText = fluid.stringTemplate(that.options.strings.progress.fileUploadLimitLabel, {
                fileUploadLimit: that.options.queueSettings.fileUploadLimit,
                fileLabel: fluid.uploader.fileOrFiles(that, that.options.queueSettings.fileUploadLimit)
            });
            that.locate("fileUploadLimitText").html(fileUploadLimitText);
        }
    };


    /**
     * Pretty prints a file's size, converting from bytes to kilobytes or megabytes.
     *
     * @param {Number} bytes - The file's size, specified as in number bytes.
     * @return {String} - The file size as a string.
     */
    fluid.uploader.formatFileSize = function (bytes) {
        if (typeof(bytes) === "number") {
            if (bytes === 0) {
                return "0.0 KB";
            } else if (bytes > 0) {
                if (bytes < 1048576) {
                    return (Math.ceil(bytes / 1024 * 10) / 10).toFixed(1) + " KB";
                } else {
                    return (Math.ceil(bytes / 1048576 * 10) / 10).toFixed(1) + " MB";
                }
            }
        }
        return "";
    };

    fluid.uploader.derivePercent = function (num, total) {
        return Math.round((num * 100) / total);
    };

    fluid.uploader.updateTotalProgress = function (that) {
        // Preservered for backwards compatibility, should be refactored post v1.5
        var batch = that.queue.currentBatch;
        var totalPercent = fluid.uploader.derivePercent(batch.totalBytesUploaded, batch.totalBytes);
        var numFilesInBatch = batch.files.length;
        var fileLabelStr = fluid.uploader.fileOrFiles(that, numFilesInBatch);

        var uploadingSize = batch.totalBytesUploaded + that.queue.sizeOfUploadedFiles();

        var totalProgressStr = fluid.stringTemplate(that.options.strings.progress.totalProgressLabel, {
            curFileN: batch.fileIdx,
            totalFilesN: numFilesInBatch,
            fileLabel: fileLabelStr,
            currBytes: fluid.uploader.formatFileSize(batch.totalBytesUploaded),
            totalBytes: fluid.uploader.formatFileSize(batch.totalBytes),
            uploadedCount: that.queue.getUploadedFiles().length,
            uploadedSize: fluid.uploader.formatFileSize(uploadingSize),
            totalCount: that.queue.files.length,
            totalSize: fluid.uploader.formatFileSize(that.queue.totalBytes())
        });

        that.totalProgress.update(totalPercent, totalProgressStr);
    };

    fluid.uploader.updateTotalAtCompletion = function (that) {
        // Preservered for backwards compatibility, should be refactored post v1.5
        var numErroredFiles = that.queue.getErroredFiles().length;
        var numTotalFiles = that.queue.files.length;
        var fileLabelStr = fluid.uploader.fileOrFiles(that, numTotalFiles);
        var errorStr = "";

        // if there are errors then change the total progress bar
        // and set up the errorStr so that we can use it in the totalProgressStr
        if (numErroredFiles > 0) {
            var errorLabelString = (numErroredFiles === 1) ? that.options.strings.progress.singleError :
                that.options.strings.progress.pluralErrors;
            fluid.uploader.setTotalProgressStyle(that, true);
            errorStr = fluid.stringTemplate(that.options.strings.progress.numberOfErrors, {
                errorsN: numErroredFiles,
                errorLabel: errorLabelString
            });
        }

        var totalProgressStr = fluid.stringTemplate(that.options.strings.progress.completedLabel, {
            curFileN: that.queue.getUploadedFiles().length,
            totalFilesN: numTotalFiles,
            errorString: errorStr,
            fileLabel: fileLabelStr,
            totalCurrBytes: fluid.uploader.formatFileSize(that.queue.sizeOfUploadedFiles()),
            uploadedCount: that.queue.getUploadedFiles().length,
            uploadedSize: fluid.uploader.formatFileSize(that.queue.sizeOfUploadedFiles()),
            totalCount: that.queue.files.length,
            totalSize: fluid.uploader.formatFileSize(that.queue.totalBytes())
        });

        that.totalProgress.update(100, totalProgressStr);
    };

    fluid.uploader.updateStateAfterFileDialog = function (that) {
        var queueLength = that.queue.getReadyFiles().length;
        if (queueLength > 0) {
            fluid.uploader[queueLength === that.options.queueSettings.fileUploadLimit ? "setStateFull" : "setStateLoaded"](that);
            fluid.uploader.renderUploadTotalMessage(that);
            that.locate(that.options.focusWithEvent.afterFileDialog).trigger("focus");
        }
    };

    fluid.uploader.updateStateAfterFileRemoval = function (that) {
        fluid.uploader[that.queue.getReadyFiles().length === 0 ? "setStateEmpty" : "setStateLoaded"] (that);
        fluid.uploader.renderUploadTotalMessage(that);
    };

    fluid.uploader.updateStateAfterCompletion = function (that) {
        fluid.uploader[that.queue.getReadyFiles().length === 0 ? "setStateDone" : "setStateLoaded"] (that);
        fluid.uploader.updateTotalAtCompletion(that);
    };

    fluid.uploader.uploadNextOrFinish = function (that) {
        if (that.queue.shouldUploadNextFile()) {
            that.strategy.remote.uploadNextFile();
        } else {
            that.events.afterUploadComplete.fire(that.queue.currentBatch.files);
            that.queue.clearCurrentBatch();
        }
    };

    // Standard event listening functions

    fluid.uploader.onFileStart = function (file, queue) {
        file.filestatus = fluid.uploader.fileStatusConstants.IN_PROGRESS;
        queue.startFile();
    };

    // TODO: Improve the dependency profile of this listener and "updateTotalProgress"
    fluid.uploader.onFileProgress = function (that, currentBytes) {
        that.queue.updateBatchStatus(currentBytes);
        fluid.uploader.updateTotalProgress(that);
    };

    fluid.uploader.onFileComplete = function (file, that) {
        that.queue.finishFile(file);
        that.events.afterFileComplete.fire(file);
        fluid.uploader.uploadNextOrFinish(that);
    };

    // TODO: Avoid reaching directly into the FileQueue and manipulating its state from this and the next two listeners
    fluid.uploader.onFileSuccess = function (file, that) {
        file.filestatus = fluid.uploader.fileStatusConstants.COMPLETE;
        if (that.queue.currentBatch.bytesUploadedForFile === 0) {
            that.queue.currentBatch.totalBytesUploaded += file.size;
        }
        fluid.uploader.updateTotalProgress(that);
    };

    fluid.uploader.onFileError = function (file, error, that) {
        if (error === fluid.uploader.errorConstants.UPLOAD_STOPPED) {
            file.filestatus = fluid.uploader.fileStatusConstants.CANCELLED;
        } else {
            file.filestatus = fluid.uploader.fileStatusConstants.ERROR;
            if (that.queue.isUploading) {
                that.queue.currentBatch.totalBytesUploaded += file.size;
                that.queue.currentBatch.numFilesErrored++;
                fluid.uploader.uploadNextOrFinish(that);
            }
        }
    };

    fluid.uploader.afterUploadComplete = function (that) {
        that.queue.isUploading = false;
        fluid.uploader.updateStateAfterCompletion(that);
    };


    /**
     * Instantiates a new Uploader component.
     */
    fluid.defaults("fluid.uploader", {
        gradeNames: ["fluid.viewComponent", "fluid.contextAware"],
        contextAwareness: {
            technology: {
                defaultGradeNames: "fluid.uploader.singleFile"
            },
            liveness: {
                priority: "before:technology",
                checks: {
                    localDemoOption: {
                        contextValue: "{uploader}.options.demo",
                        gradeNames: "fluid.uploader.demo"
                    }
                },
                defaultGradeNames: "fluid.uploader.live"
            }
        }
    });

    fluid.defaults("fluid.uploader.builtinStrategyDistributor", {
        gradeNames: ["fluid.component"],
        distributeOptions: {
            record: {
                contextValue: "{fluid.browser.supportsBinaryXHR}",
                gradeNames: "fluid.uploader.html5"
            },
            target: "{/ fluid.uploader}.options.contextAwareness.technology.checks.supportsBinaryXHR"
        }
    });

    fluid.constructSingle([], "fluid.uploader.builtinStrategyDistributor");

    // Implementation of standard public invoker methods

    fluid.uploader.browse = function (queue, localStrategy) {
        if (!queue.isUploading) {
            localStrategy.browse();
        }
    };

    /**
     * Removes the specified file from the upload queue.
     *
     * @param {fluid.uploader.fileQueue} queue - an instance of the `fluid.uploader.fileQueue` component
     * @param {fluid.uploader.local} localStrategy - an instance of the `fluid.uploader.local` component
     * @param {InfusionEvent} afterFileRemoved - An event to be fired after the file has been removed
     * @param {File} file - the file to remove
     */
    fluid.uploader.removeFile = function (queue, localStrategy, afterFileRemoved, file) {
        queue.removeFile(file);
        localStrategy.removeFile(file);
        afterFileRemoved.fire(file);
    };

    fluid.uploader.start = function (queue, remoteStrategy, onUploadStart) {
        queue.start();
        onUploadStart.fire(queue.currentBatch.files);
        remoteStrategy.uploadNextFile();
    };

    fluid.uploader.stop = function (remoteStrategy, onUploadStop) {
        onUploadStop.fire();
        remoteStrategy.stop();
    };

    fluid.uploader.defaultQueueSettings = {
        uploadURL: "",
        postParams: {},
        fileSizeLimit: "20480",
        fileTypes: null,
        fileTypesDescription: null,
        fileUploadLimit: 0,
        fileQueueLimit: 0
    };

    // Automatically bind a listener transferring focus to those DOM elements requested for component events
    fluid.uploader.bindFocus = function (focusWithEvent, noAutoFocus, events, dom) {
        fluid.each(focusWithEvent, function (element, event) {
            if (!noAutoFocus[event]) {
                events[event].addListener(function () {
                    dom.locate(element).trigger("focus");
                });
            }
        });
    };

    /**
     * Multiple file Uploader implementation. Encapsulates logic which is common across all configurations supporing multiple
     * file uploads - HTML5 (and historically Flash)
     */

    fluid.defaults("fluid.uploader.multiFileUploader", {
        gradeNames: ["fluid.viewComponent"],
        members: {
            totalFileStatusTextId: {
                expander: {
                    // create an id for that.dom.container, if it does not have one already,
                    // and set that.totalFileStatusTextIdId to the id value
                    funcName: "fluid.allocateSimpleId",
                    args: "{that}.dom.totalFileStatusText"
                }
            }
        },
        invokers: {
            /**
             * Opens the native OS browse file dialog.
             */
            browse: {
                funcName: "fluid.uploader.browse",
                args: ["{that}.queue", "{that}.strategy.local"]
            },
            // Removes the specified file from the upload queue.
            removeFile: {
                funcName: "fluid.uploader.removeFile",
                args: ["{that}.queue", "{that}.strategy.local", "{that}.events.afterFileRemoved", "{arguments}.0"]
            },
            /**
             * Starts uploading all queued files to the server.
             */
            start: {
                funcName: "fluid.uploader.start",
                args: ["{that}.queue", "{that}.strategy.remote", "{that}.events.onUploadStart"]
            },
            /**
             * Cancels an in-progress upload.
             */
            stop: {
                funcName: "fluid.uploader.stop",
                args: ["{that}.strategy.remote", "{that}.events.onUploadStop"]
            }
        },

        components: {
            queue: {
                type: "fluid.uploader.fileQueue"
            },
            strategy: {
                type: "fluid.uploader.strategy"
            },
            errorPanel: {
                type: "fluid.uploader.errorPanel",
                container: "{uploader}.dom.errorsPanel",
                options: {
                    gradeNames: "fluid.uploader.errorPanel.bindUploader"
                }
            },
            fileQueueView: {
                type: "fluid.uploader.fileQueueView",
                container: "{uploader}.dom.fileQueue",
                options: {
                    gradeNames: "fluid.uploader.fileQueueView.bindUploader",
                    members: { // TODO: This amounts to the entire model idiom for fileQueueView
                        queueFiles: "{uploader}.queue.files"
                    },
                    uploaderContainer: "{uploader}.container",
                    strings: {
                        buttons: {
                            remove: "{uploader}.options.strings.buttons.remove"
                        }
                    }
                }
            },
            totalProgress: {
                type: "fluid.progress",
                container: "{uploader}.container",
                options: {
                    selectors: {
                        progressBar: ".flc-uploader-queue-footer",
                        displayElement: ".flc-uploader-total-progress",
                        label: ".flc-uploader-total-progress-text",
                        indicator: ".flc-uploader-total-progress",
                        ariaElement: ".flc-uploader-total-progress"
                    }
                }
            }
        },

        queueSettings: fluid.uploader.defaultQueueSettings,

        demo: false,

        selectors: {
            fileQueue: ".flc-uploader-queue",
            browseButton: ".flc-uploader-button-browse",
            browseButtonText: ".flc-uploader-button-browse-text",
            uploadButton: ".flc-uploader-button-upload",
            pauseButton: ".flc-uploader-button-pause",
            totalFileStatusText: ".flc-uploader-total-progress-text",
            fileUploadLimitText: ".flc-uploader-upload-limit-text",
            instructions: ".flc-uploader-browse-instructions",
            errorsPanel: ".flc-uploader-errorsPanel"
        },
        noAutoFocus: { // Specifies a member of "focusWithEvent" which the uploader will not attempt to automatically honour
            afterFileDialog: true
        },

        // Specifies a selector name to move keyboard focus to when a particular event fires.
        // Event listeners must already be implemented to use these options.
        focusWithEvent: {
            afterFileDialog: "uploadButton",
            onUploadStart: "pauseButton",
            onUploadStop: "uploadButton"
        },

        styles: {
            disabled: "fl-uploader-disabled",
            hidden: "fl-uploader-hidden",
            dim: "fl-uploader-dim",
            totalProgress: "fl-uploader-total-progress-okay",
            totalProgressError: "fl-uploader-total-progress-errored",
            browseButton: "fl-uploader-browseMore"
        },

        events: {
            // TODO: this event "afterReady" was only fired by the Flash Uploader.
            // It should either be removed or refactored post v1.5
            afterReady: null,
            onFileDialog: null,
            onFilesSelected: null,
            onFileQueued: null,     // file
            afterFileQueued: null,  // file
            onFileRemoved: null,    // file
            afterFileRemoved: null, // file
            afterFileDialog: null,
            onUploadStart: null,
            onUploadStop: null,
            onFileStart: null,      // file
            onFileProgress: null,   // file, currentBytes, totalBytes
            onFileError: null,      // file, error
            onQueueError: null,
            onFileSuccess: null,
            onFileComplete: null,
            afterFileComplete: null,
            afterUploadComplete: null
        },
        listeners: {
            "onCreate": [{
                listener: "fluid.uploader.bindFocus",
                args: ["{that}.options.focusWithEvent", "{that}.options.noAutoFocus", "{that}.events", "{that}.dom"]
            }, {
                funcName: "fluid.uploader.multiFileUploader.setupMarkup",
                namespace: "setupMarkup"
            },
            { // TODO: These two part of the "new renderer" as "new decorators"
                "this": "{that}.dom.uploadButton",
                method: "on",
                args: ["click", "{that}.start"]
            }, {
                "this": "{that}.dom.pauseButton",
                method: "on",
                args: ["click", "{that}.stop"]
            }, {
                "this": "{that}.dom.totalFileStatusText",
                method: "attr",
                args: [{
                    "role": "log",
                    "aria-live": "assertive",
                    "aria-relevant": "text",
                    "aria-atomic": "true"
                }]
            }, {
                "this": "{that}.dom.fileQueue",
                method: "attr",
                args: [{
                    "aria-controls": "{that}.totalFileStatusTextId",
                    "aria-labelledby": "{that}.totalFileStatusTextId"
                }]
            }],
            // Namespace all our standard listeners so they are easy to override
            "afterFileDialog.uploader": {
                listener: "fluid.uploader.updateStateAfterFileDialog",
                args: "{that}"
            },
            "afterFileQueued.uploader": {
                listener: "{that}.queue.addFile",
                args: "{arguments}.0" // file
            },
            "onFileRemoved.uploader": {
                listener: "{that}.removeFile",
                args: "{arguments}.0" // file
            },
            "afterFileRemoved.uploader": {
                listener: "fluid.uploader.updateStateAfterFileRemoval",
                args: "{that}"
            },
            "onUploadStart.uploader": {
                listener: "fluid.uploader.setStateUploading",
                args: "{that}"
            },
            "onFileStart.uploader": {
                listener: "fluid.uploader.onFileStart",
                args: ["{arguments}.0", "{that}.queue"]
            },
            "onFileProgress.uploader": {
                listener: "fluid.uploader.onFileProgress",
                args: ["{that}", "{arguments}.1"] // 1: currentBytes
            },
            "onFileComplete.uploader": {
                listener: "fluid.uploader.onFileComplete",
                args: ["{arguments}.0", "{that}"]
            },
            "onFileSuccess.uploader": {
                listener: "fluid.uploader.onFileSuccess",
                args: ["{arguments}.0", "{that}"]
            },
            "onFileError.uploader": {
                listener: "fluid.uploader.onFileError",
                args: ["{arguments}.0", "{arguments}.1", "{that}"]
            },
            "afterUploadComplete.uploader": {
                listener: "fluid.uploader.afterUploadComplete",
                args: "{that}"
            }
        },

        strings: {
            progress: {
                fileUploadLimitLabel: "%fileUploadLimit %fileLabel maximum",
                noFiles: "0 files",
                toUploadLabel: "%uploadedCount out of %totalCount files uploaded (%uploadedSize of %totalSize)",
                totalProgressLabel: "%uploadedCount out of %totalCount files uploaded (%uploadedSize of %totalSize)",
                completedLabel: "%uploadedCount out of %totalCount files uploaded (%uploadedSize of %totalSize)%errorString",
                numberOfErrors: ", %errorsN %errorLabel",
                singleFile: "file",
                pluralFiles: "files",
                singleError: "error",
                pluralErrors: "errors"
            },
            buttons: {
                browse: "Browse Files",
                addMore: "Add More",
                stopUpload: "Stop Upload",
                cancelRemaning: "Cancel remaining Uploads",
                resumeUpload: "Resume Upload",
                remove: "Remove"
            }
        }
    });

    fluid.uploader.multiFileUploader.setupMarkup = function (that) {
        // Upload button should not be enabled until there are files to upload
        fluid.uploader.disableElement(that, that.locate("uploadButton"));

        fluid.uploader.renderFileUploadLimit(that);

        // placed here for backwards compatibility, as a noFiles string
        // may not be defined.
        var noFilesMsg = that.options.strings.progress.noFiles;
        if (noFilesMsg)  {
            that.locate("totalFileStatusText").text(noFilesMsg);
        }
    };


    fluid.defaults("fluid.uploader.strategy", {
        gradeNames: ["fluid.component"],
        components: {
            local: {
                type: "fluid.uploader.local"
            },
            remote: {
                type: "fluid.uploader.remote"
            }
        }
    });

    fluid.defaults("fluid.uploader.local", {
        gradeNames: ["fluid.component"],
        queueSettings: "{uploader}.options.queueSettings",
        members: {
            queue: "{uploader}.queue"
        },
        events: {
            onFileDialog: "{uploader}.events.onFileDialog",
            onFilesSelected: "{uploader}.events.onFilesSelected",
            afterFileDialog: "{uploader}.events.afterFileDialog",
            afterFileQueued: "{uploader}.events.afterFileQueued",
            onQueueError: "{uploader}.events.onQueueError"
        },
        invokers: {
            enableBrowseButton: "fluid.uploader.local.enableBrowseButton", // TODO: FLUID-4928 "visibility model"
            disableBrowseButton: "fluid.uploader.local.disableBrowseButton"
        }
    });

    fluid.defaults("fluid.uploader.remote", {
        gradeNames: ["fluid.component"],
        members: {
            queue: "{uploader}.queue", // TODO: explosions, see FLUID-4925
            queueSettings: "{uploader}.options.queueSettings"
        },
        events: {
            onFileStart: "{uploader}.events.onFileStart",
            onFileProgress: "{uploader}.events.onFileProgress",
            onFileSuccess: "{uploader}.events.onFileSuccess",
            onFileError: "{uploader}.events.onFileError",
            onFileComplete: "{uploader}.events.onFileComplete",
            onUploadStop: "{uploader}.events.onUploadStop",
            afterFileComplete: "{uploader}.events.afterFileComplete",
            afterUploadComplete: "{uploader}.events.afterUploadComplete"
        },
        invokers: {
            uploadNextFile: "fluid.uploader.uploadNextFile",
            stop: "fluid.uploader.stop"
        }
    });

    /**************************************************
     * Error constants for the Uploader               *
     **************************************************/

    // Partial TODO: The values of these keys are now our own - however, the key
    // values themselves still align with those from SWFUpload
    fluid.uploader.queueErrorConstants = {
        QUEUE_LIMIT_EXCEEDED:    "queue limit exceeded",
        FILE_EXCEEDS_SIZE_LIMIT: "file exceeds size limit",
        ZERO_BYTE_FILE:          "zero byte file",
        INVALID_FILETYPE:        "invalid filetype"
    };

    fluid.uploader.errorConstants = {
        HTTP_ERROR:                  "HTTP error",
        MISSING_UPLOAD_URL:          "Missing upload URL",
        IO_ERROR:                    "I/O error",
        SECURITY_ERROR:              "Security error",
        UPLOAD_LIMIT_EXCEEDED:       "Upload limit exceeded",
        UPLOAD_FAILED:               "Uploader failed",
        SPECIFIED_FILE_ID_NOT_FOUND: "Specified file ID not found",
        FILE_VALIDATION_FAILED:      "File validation failed",
        FILE_CANCELLED:              "File cancelled",
        UPLOAD_STOPPED:              "Upload stopped"
    };

    fluid.uploader.fileStatusConstants = {
        QUEUED:      "queued",
        IN_PROGRESS: "in progress",
        ERROR:       "error",
        COMPLETE:    "complete",
        CANCELLED:   "cancelled"
    };

    /*
     * Single file Uploader implementation. Use fluid.uploader() for IoC-resolved, progressively
     * enhanceable Uploader, or call this directly if you only want a standard single file uploader.
     * But why would you want that?
     */
    fluid.defaults("fluid.uploader.singleFile", {
        gradeNames: ["fluid.viewComponent"],
        selectors: {
            basicUpload: ".fl-progEnhance-basic"
        },
        listeners: {
            "onCreate.showMarkup": "fluid.uploader.singleFile.showMarkup"
        }
    });

    fluid.uploader.singleFile.toggleVisibility = function (toShow, toHide) {
        // For FLUID-2789: hide() doesn't work in Opera
        if (window.opera) {
            toShow.show().removeClass("hideUploaderForOpera");
            toHide.show().addClass("hideUploaderForOpera");
        } else {
            toShow.show();
            toHide.hide();
        }
    };

    fluid.uploader.singleFile.showMarkup = function (that) {
        // TODO: direct DOM fascism that will fail with multiple uploaders on a single page.
        fluid.uploader.singleFile.toggleVisibility($(that.options.selectors.basicUpload), that.container);
    };

})(jQuery, fluid_3_0_0);
