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

    /** NOTE: Much of this work originated from
     * https://github.com/fluid-project/kettle/blob/d3b4d9a48c2d040bb6f882810ca515ec3555ae64/lib/dataSource-core.js and
     * https://github.com/fluid-project/kettle/blob/d3b4d9a48c2d040bb6f882810ca515ec3555ae64/lib/dataSource-url.js
     ***/

    /** Some common content encodings - suitable to appear as the "encoding" subcomponent of a dataSource **/

    fluid.defaults("fluid.dataSource.encoding.JSON", {
        gradeNames: "fluid.component",
        invokers: {
            parse: "fluid.dataSource.parseJSON",
            render: "fluid.dataSource.stringifyJSON"
        },
        contentType: "application/json"
    });

    fluid.defaults("fluid.dataSource.encoding.none", {
        gradeNames: "fluid.component",
        invokers: {
            parse: "fluid.identity",
            render: "fluid.identity"
        },
        contentType: "text/plain"
    });

    fluid.dataSource.parseJSON = function (string) {
        var togo = fluid.promise();
        if (!string) {
            togo.resolve(undefined);
        } else {
            try {
                togo.resolve(JSON.parse(string));
            } catch (err) {
                togo.reject(err);
            }
        }
        return togo;
    };

    fluid.dataSource.stringifyJSON = function (obj) {
        return obj === undefined ? "" : JSON.stringify(obj, null, 4);
    };

    /**
     * The head of the hierarchy of dataSource components. These abstract
     * over the process of read and write access to data, following a simple CRUD-type semantic, indexed by
     * a coordinate model (directModel) and which may be asynchronous.
     * Top-level methods are:
     *     get(directModel[, callback|options] -        to get the data from data resource
     *     set(directModel, model[, callback|options] - to set the data
     *
     *
     * directModel: An object expressing an "index" into some set of
     *              state which can be read or written.
     *
     * model: The payload sent to the storage.
     *
     * options: An object expressing implementation specific details
     *          regarding the handling of a request. Note: this does not
     *          include details for identifying the resource. Those should be
     *          placed in the directModel.
     */
    fluid.defaults("fluid.dataSource", {
        gradeNames: ["fluid.component", "fluid.contextAware"],
        contextAwareness: {
            writable: {
                checks: {
                    writableValue: {
                        contextValue: "{fluid.dataSource}.options.writable",
                        gradeNames: "{fluid.dataSource}.options.writableGrade"
                    }
                }
            }
        },
        writable: false,
        events: {
            // The "onRead" event is operated in a custom workflow by fluid.fireTransformEvent to
            // process dataSource payloads during the get process. Each listener receives the data returned by the last.
            onRead: null,
            onError: null
        },
        components: {
            encoding: {
                type: "fluid.dataSource.encoding.JSON"
            }
        },
        listeners: {
            // handler for "onRead.impl" must be implemented by a concrete subgrade
            // Note: The intial payload (first argument) will be undefined
            "onRead.impl": {
                func: "fluid.notImplemented",
                priority: "first"
            },
            "onRead.encoding": {
                func: "{encoding}.parse",
                priority: "after:impl"
            }
        },
        invokers: {
            get: {
                funcName: "fluid.dataSource.get",
                args: ["{that}", "{arguments}.0", "{arguments}.1"] // directModel, directOptions
            }
        }
    });


    /**
     * Base grade for adding write configuration to a dataSource. Because of issues like FLUID-5800, this is a pure
     * mixin grade. The related writable grade to a concrete DataSource grade is listed in its "writableGrade" options,
     * which response to the "writable: true" option via ContextAwareness.
     */
    fluid.defaults("fluid.dataSource.writable", {
        gradeNames: ["fluid.component"],
        events: {
            // events "onWrite" and "onWriteResponse" are operated in a custom workflow by fluid.fireTransformEvent to
            // process dataSource payloads during the set process. Each listener receives the data returned by the last.
            onWrite: null,
            onWriteResponse: null
        },
        listeners: {
            "onWrite.encoding": {
                func: "{encoding}.render"
            },
            // handler for "onWrite.impl" must be implemented by a concrete subgrade
            "onWrite.impl": {
                func: "fluid.notImplemented",
                priority: "after:encoding"
            },
            "onWriteResponse.encoding": {
                func: "{encoding}.parse"
            }
        },
        invokers: {
            set: {
                funcName: "fluid.dataSource.set",
                args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // directModel, model, directOptions
            }
        }
    });

    // Registers the default promise handlers for a dataSource operation -
    // i) If the user has supplied a function in place of method `options`, register this function as a success handler
    // ii) if the user has supplied an onError handler in method `options`, this is registered - otherwise
    // we register the firer of the dataSource's own onError method.

    fluid.dataSource.registerStandardPromiseHandlers = function (that, promise, requestOptions) {
        promise.then(requestOptions.callback, requestOptions.onError ? requestOptions.onError : that.events.onError.fire);
    };

    fluid.dataSource.defaultiseOptions = function (componentOptions, directOptions, directModel, isSet) {
        var options = typeof(directOptions) === "function" ? {
            callback: directOptions
        } : fluid.copy(directOptions) || {};
        options.directModel = directModel;
        options.operation = isSet ? "set" : "get";
        options.notFoundIsEmpty = options.notFoundIsEmpty || componentOptions.notFoundIsEmpty;
        return options;
    };

    /** Operate the core "transforming promise workflow" of a dataSource's `get` method. The initial listener provides the initial payload;
     *  which then proceeds through the transform chain to arrive at the final payload.
     * @param {fluid.dataSource} that - The dataSource itself
     * @param {Object} [directModel] - The direct model expressing the "coordinates" of the model to be fetched
     * @param {Object|Function} [directOptions] - A success callback, or a structure of options configuring the action of this get request,  - many of these will be specific to the particular concrete DataSource
     * @return {Promise} A promise for the final resolved payload
     */
    fluid.dataSource.get = function (that, directModel, directOptions) {
        var requestOptions = fluid.dataSource.defaultiseOptions(that.options, directOptions, directModel);
        var promise = fluid.promise.fireTransformEvent(that.events.onRead, undefined, requestOptions);
        fluid.dataSource.registerStandardPromiseHandlers(that, promise, requestOptions);
        return promise;
    };

    /**
     * Operate the core "transforming promise workflow" of a dataSource's `set` method.
     * Any return from this is then pushed forwards through a range of the transforms (typically, e.g. just decoding it as JSON)
     * on its way back to the user via the onWriteResponse event.
     * @param {fluid.dataSource} that - The dataSource itself
     * @param {Object} [directModel] - The direct model expressing the "coordinates" of the model to be written
     * @param {Any} model - The payload to be written to the dataSource
     * @param {Object|Function} [directOptions] - A success callback, or a structure of options configuring the action of this set request - many of these will be specific to the particular concrete DataSource
     * @return {Promise} A promise for the final resolved payload (not all DataSources will provide any for a `set` method)
     */
    fluid.dataSource.set = function (that, directModel, model, directOptions) {
        var requestOptions = fluid.dataSource.defaultiseOptions(that.options, directOptions, directModel, true); // shared and writeable between all participants
        var transformPromise = fluid.promise.fireTransformEvent(that.events.onWrite, model, requestOptions);
        var togo = fluid.promise();
        transformPromise.then(function (setResponse) {
            var options2 = fluid.dataSource.defaultiseOptions(that.options, fluid.copy(requestOptions), directModel);
            var retransformed = fluid.promise.fireTransformEvent(that.events.onWriteResponse, setResponse, options2);
            fluid.promise.follow(retransformed, togo);
        }, function (error) {
            togo.reject(error);
        });
        fluid.dataSource.registerStandardPromiseHandlers(that, togo, requestOptions);
        return togo;
    };

})(jQuery, fluid_3_0_0);
