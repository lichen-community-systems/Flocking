/*!
 Copyright 2011 unscriptable.com / John Hann
 Copyright The Infusion copyright holders
 See the AUTHORS.md file at the top-level directory of this distribution and at
 https://github.com/fluid-project/infusion/raw/main/AUTHORS.md.

 License MIT
*/

(function ($, fluid) {
    "use strict";

    // Light fluidification of minimal promises library. See original gist at
    // https://gist.github.com/unscriptable/814052 for limitations and commentary

    // This implementation provides what could be described as "flat promises" with
    // no support for structured programming idioms involving promise composition.
    // It provides what a proponent of mainstream promises would describe as
    // a "glorified callback aggregator"

    fluid.promise = function () {
        var that = {
            onResolve: [],
            onReject: []
            // disposition
            // value
        };
        that.then = function (onResolve, onReject) {
            if (onResolve) {
                if (that.disposition === "resolve") {
                    onResolve(that.value);
                } else {
                    that.onResolve.push(onResolve);
                }
            }
            if (onReject) {
                if (that.disposition === "reject") {
                    onReject(that.value);
                } else {
                    that.onReject.push(onReject);
                }
            }
            return that;
        };
        that.resolve = function (value) {
            if (that.disposition) {
                fluid.fail("Error: resolving promise ", that,
                    " which has already received \"" + that.disposition + "\"");
            } else {
                that.complete("resolve", that.onResolve, value);
            }
            return that;
        };
        that.reject = function (reason) {
            if (that.disposition) {
                fluid.fail("Error: rejecting promise ", that,
                    "which has already received \"" + that.disposition + "\"");
            } else {
                that.complete("reject", that.onReject, reason);
            }
            return that;
        };
        // PRIVATE, NON-API METHOD
        that.complete = function (which, queue, arg) {
            that.disposition = which;
            that.value = arg;
            for (var i = 0; i < queue.length; ++i) {
                queue[i](arg);
            }
        };
        return that;
    };

    /* Any object with a member <code>then</code> of type <code>function</code> passes this test.
     * This includes essentially every known variety, including jQuery promises.
     */
    fluid.isPromise = function (totest) {
        return totest && typeof(totest.then) === "function";
    };

    /** Coerces any value to a promise
     * @param {Any} promiseOrValue - The value to be coerced
     * @return {Promise} - If the supplied value is already a promise, it is returned unchanged. Otherwise a fresh promise is created with the value as resolution and returned
     */
    fluid.toPromise = function (promiseOrValue) {
        if (fluid.isPromise(promiseOrValue)) {
            return promiseOrValue;
        } else {
            var togo = fluid.promise();
            togo.resolve(promiseOrValue);
            return togo;
        }
    };

    /* Chains the resolution methods of one promise (target) so that they follow those of another (source).
     * That is, whenever source resolves, target will resolve, or when source rejects, target will reject, with the
     * same payloads in each case.
     */
    fluid.promise.follow = function (source, target) {
        source.then(target.resolve, target.reject);
    };

    /** Returns a promise whose resolved value is mapped from the source promise or value by the supplied function.
     * @param {Object|Promise} source - An object or promise whose value is to be mapped
     * @param {Function} func - A function which will map the resolved promise value
     * @return {Promise} - A promise for the resolved mapped value.
     */
    fluid.promise.map = function (source, func) {
        var promise = fluid.toPromise(source);
        var togo = fluid.promise();
        promise.then(function (value) {
            var mapped = func(value);
            if (fluid.isPromise(mapped)) {
                fluid.promise.follow(mapped, togo);
            } else {
                togo.resolve(mapped);
            }
        }, function (error) {
            togo.reject(error);
        });
        return togo;
    };

    /* General skeleton for all sequential promise algorithms, e.g. transform, reduce, sequence, etc.
     * These accept a variable "strategy" pair to customise the interchange of values and final return
     */

    fluid.promise.makeSequencer = function (sources, options, strategy) {
        if (!fluid.isArrayable(sources)) {
            fluid.fail("fluid.promise sequence algorithms must be supplied an array as source");
        }
        return {
            sources: sources,
            resolvedSources: [], // the values of "sources" only with functions invoked (an array of promises or values)
            index: 0,
            strategy: strategy,
            options: options, // available to be supplied to each listener
            returns: [],
            promise: fluid.promise() // the final return value
        };
    };

    fluid.promise.progressSequence = function (that, retValue) {
        that.returns.push(retValue);
        that.index++;
        // No we dun't have no tail recursion elimination
        fluid.promise.resumeSequence(that);
    };

    fluid.promise.processSequenceReject = function (that, error) { // Allow earlier promises in the sequence to wrap the rejection supplied by later ones (FLUID-5584)
        for (var i = that.index - 1; i >= 0; --i) {
            var resolved = that.resolvedSources[i];
            var accumulator = fluid.isPromise(resolved) && typeof(resolved.accumulateRejectionReason) === "function" ? resolved.accumulateRejectionReason : fluid.identity;
            error = accumulator(error);
        }
        that.promise.reject(error);
    };

    fluid.promise.resumeSequence = function (that) {
        if (that.index === that.sources.length) {
            that.promise.resolve(that.strategy.resolveResult(that));
        } else {
            var value = that.strategy.invokeNext(that);
            that.resolvedSources[that.index] = value;
            if (fluid.isPromise(value)) {
                value.then(function (retValue) {
                    fluid.promise.progressSequence(that, retValue);
                }, function (error) {
                    fluid.promise.processSequenceReject(that, error);
                });
            } else {
                fluid.promise.progressSequence(that, value);
            }
        }
    };

    // SEQUENCE ALGORITHM APPLYING PROMISES

    fluid.promise.makeSequenceStrategy = function () {
        return {
            invokeNext: function (that) {
                var source = that.sources[that.index];
                return typeof(source) === "function" ? source(that.options) : source;
            },
            resolveResult: function (that) {
                return that.returns;
            }
        };
    };

    // accepts an array of values, promises or functions returning promises - in the case of functions returning promises,
    // will assure that at most one of these is "in flight" at a time - that is, the succeeding function will not be invoked
    // until the promise at the preceding position has resolved
    fluid.promise.sequence = function (sources, options) {
        var sequencer = fluid.promise.makeSequencer(sources, options, fluid.promise.makeSequenceStrategy());
        fluid.promise.resumeSequence(sequencer);
        return sequencer.promise;
    };

    // TRANSFORM ALGORITHM APPLYING PROMISES

    fluid.promise.makeTransformerStrategy = function () {
        return {
            invokeNext: function (that) {
                var lisrec = that.sources[that.index];
                lisrec.listener = fluid.event.resolveListener(lisrec.listener);
                var value = lisrec.listener.apply(null, [that.returns[that.index], that.options]);
                return value;
            },
            resolveResult: function (that) {
                return that.returns[that.index];
            }
        };
    };

    // Construct a "mini-object" managing the process of a sequence of transforms,
    // each of which may be synchronous or return a promise
    fluid.promise.makeTransformer = function (listeners, payload, options) {
        listeners.unshift({listener:
            function () {
                return payload;
            }
        });
        var sequencer = fluid.promise.makeSequencer(listeners, options, fluid.promise.makeTransformerStrategy());
        sequencer.returns.push(null); // first dummy return from initial entry
        fluid.promise.resumeSequence(sequencer);
        return sequencer;
    };

    fluid.promise.filterNamespaces = function (listeners, namespaces) {
        if (!namespaces) {
            return listeners;
        }
        return fluid.remove_if(fluid.makeArray(listeners), function (element) {
            return element.namespace && !element.softNamespace && !fluid.contains(namespaces, element.namespace);
        });
    };

    /**
     * Top-level API to operate a Fluid event which manages a sequence of
     * chained transforms. Rather than being a standard listener accepting the
     * same payload, each listener to the event accepts the payload returned by the
     * previous listener, and returns either a transformed payload or else a promise
     * yielding such a payload.
     *
     * @param {fluid.eventFirer} event - A Fluid event to which the listeners are to be interpreted as
     * elements cooperating in a chained transform. Each listener will receive arguments <code>(payload, options)</code> where <code>payload</code>
     * is the (successful, resolved) return value of the previous listener, and <code>options</code> is the final argument to this function
     * @param {Object|Promise} payload - The initial payload input to the transform chain
     * @param {Object} options - A free object containing options governing the transform. Fields interpreted at this top level are:
     *     reverse {Boolean}: <code>true</code> if the listeners are to be called in reverse order of priority (typically the case for an inverse transform)
     *     filterTransforms {Array}: An array of listener namespaces. If this field is set, only the transform elements whose listener namespaces listed in this array will be applied.
     * @return {fluid.promise} A promise which will yield either the final transformed value, or the response of the first transform which fails.
     */
    fluid.promise.fireTransformEvent = function (event, payload, options) {
        options = options || {};
        var listeners = options.reverse ? fluid.makeArray(event.sortedListeners).reverse() :
            fluid.makeArray(event.sortedListeners);
        listeners = fluid.promise.filterNamespaces(listeners, options.filterNamespaces);
        var transformer = fluid.promise.makeTransformer(listeners, payload, options);
        return transformer.promise;
    };


})(jQuery, fluid_3_0_0);
