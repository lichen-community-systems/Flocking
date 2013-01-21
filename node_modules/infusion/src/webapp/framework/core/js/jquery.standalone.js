/* 
 * Definitions in this file taken from:
 *
 * jQuery JavaScript Library v1.6.1
 * http://jquery.com/
 *
 * This implementation is only intended to be used in contexts where the Fluid Infusion framework
 * is required to be used without a functioning DOM being available (node.js or other standalone contexts).
 * It includes the minimum definitions taken from jQuery required to operate the core of Fluid.js
 * without FluidView.js. Consult http://issues.fluidproject.org/browse/FLUID-4568 for more details.
 *
 * Copyright 2011, John Resig
 * Copyright 2011- OCAD University
 *
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 * Date: Thu May 12 15:04:36 2011 -0400
 */
 
var fluid_1_5 = fluid_1_5 || {};
var fluid = fluid || fluid_1_5;

(function (fluid) {
    // Save a reference to some core methods
    var toString = Object.prototype.toString;
    var hasOwn = Object.prototype.hasOwnProperty;
    var indexOf = Array.prototype.indexOf;
    // Map over jQuery in case of overwrite
    var _jQuery = window.jQuery;
    // Map over the $ in case of overwrite
    var _$ = window.$;
    // Used for trimming whitespace
    var trimLeft = /^\s+/,
        trimRight = /\s+$/,
        trim = String.prototype.trim;
    
    var jQuery = fluid.jQueryStandalone = {
      
        // The current version of jQuery being used
        jquery: "1.6.1-fluidStandalone",
      
        noConflict: function (deep) {
            if (window.$ === jQuery) {
                window.$ = _$;
            }
            if (deep && window.jQuery === jQuery) {
                window.jQuery = _jQuery;
            }
            return jQuery;
        },
      
        isArray: Array.isArray || function (obj) {
            toString.call(obj) === "[object Array]"
        },

        // Use native String.trim function wherever possible
        trim: trim ? function( text ) {
            return text === null ? "" : trim.call( text );
        } :
        // Otherwise use our own trimming functionality
        function( text ) {
            return text === null ? "" : text.toString().replace( trimLeft, "" ).replace( trimRight, "" );
        },
        
        // A crude way of determining if an object is a window
        isWindow: function (obj) {
            return obj && typeof obj === "object" && "setInterval" in obj;
        },
      
        isPlainObject: function (obj) {
            // Must be an Object.
            // Because of IE, we also have to check the presence of the constructor property.
            // Make sure that DOM nodes and window objects don't pass through, as well
            if ( !obj || toString.call(obj) !== "[object Object]" || obj.nodeType || jQuery.isWindow( obj ) ) {
                return false;
            }
        
            // Not own constructor property must be Object
            if ( obj.constructor &&
                !hasOwn.call(obj, "constructor") &&
                !hasOwn.call(obj.constructor.prototype, "isPrototypeOf") ) {
                return false;
            }
            // Own properties are enumerated firstly, so to speed up,
            // if last one is own, then all properties are own.
            // TODO: Isn't this enormously expensive?
            var key;
            for (key in obj) {}
            return key === undefined || hasOwn.call( obj, key );
        },
      
        inArray: function (elem, array) {
            if (indexOf) {
                return indexOf.call( array, elem );
            }
            for (var i = 0, length = array.length; i < length; i++) {
                if (array[i] === elem) {
                    return i;
                }
            }
            return -1;
        },
        
        extend: function () {
            var options, 
                target = arguments[0] || {},
                i = 1,
                length = arguments.length,
                deep = false;
          
            // Handle a deep copy situation
            if (typeof target === "boolean") {
                deep = target;
                target = arguments[1] || {};
                // skip the boolean and the target
                i = 2;
            }
          
            // Handle case when target is a string or something (possible in deep copy)
            if (typeof target !== "object" && !typeof(target) === "function") {
                target = {};
            }
          
            for ( ; i < length; i++ ) {
                // Only deal with non-null/undefined values
                if ( (options = arguments[ i ]) != null ) {
                    // Extend the base object
                    for (var name in options) {
                        var src = target[ name ];
                        var copy = options[ name ];
                
                        // Prevent never-ending loop
                        if ( target === copy ) {
                            continue;
                        }
                        var copyIsArray, clone;
                        // Recurse if we're merging plain objects or arrays
                        if (deep && copy && ( jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy))) ) {
                            if (copyIsArray) {
                                copyIsArray = false;
                                clone = src && jQuery.isArray(src) ? src : [];
                            } else {
                                clone = src && jQuery.isPlainObject(src) ? src : {};
                            }
                            // Never move original objects, clone them
                            target[name] = jQuery.extend( deep, clone, copy );
                        } else if (copy !== undefined) {
                            // Don't bring in undefined values
                            target[name] = copy;
                        }
                    }
                }
            }
            return target;
        }
    }
  
})(fluid_1_5);

var jQuery = fluid.jQueryStandalone;
