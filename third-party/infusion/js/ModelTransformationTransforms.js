/*
Copyright 2010 University of Toronto
Copyright 2010-2011 OCAD University
Copyright 2013 Raising the Floor - International

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

// Declare dependencies
/*global fluid:true, fluid_1_5:true, jQuery*/

// JSLint options 
/*jslint white: true, elsecatch: true, jslintok: true, funcinvoke: true, undef: true, newcap: true, nomen: true, regexp: true, bitwise: true, browser: true, forin: true, maxerr: 100, indent: 4 */

var fluid_1_5 = fluid_1_5 || {};
var fluid = fluid || fluid_1_5;

(function ($, fluid) {
    "use strict";

    fluid.registerNamespace("fluid.model.transform");
    fluid.registerNamespace("fluid.transforms");

    /**********************************
     * Standard transformer functions *
     **********************************/
        
    fluid.defaults("fluid.transforms.value", { 
        gradeNames: "fluid.standardTransformFunction",
        invertConfiguration: "fluid.transforms.value.invert"
    });

    fluid.transforms.value = fluid.identity;
    
    fluid.transforms.value.invert = function (transformSpec, transform) {
        var togo = fluid.copy(transformSpec);
        // TODO: this will not behave correctly in the face of compound "value" which contains
        // further transforms
        togo.inputPath = fluid.model.composePaths(transform.outputPrefix, transformSpec.outputPath);
        togo.outputPath = fluid.model.composePaths(transform.inputPrefix, transformSpec.inputPath);
        return togo;
    };


    fluid.defaults("fluid.transforms.literalValue", { 
        gradeNames: "fluid.standardOutputTransformFunction"
    });

    fluid.transforms.literalValue = function (transformSpec) {
        return transformSpec.value;  
    };
    

    fluid.defaults("fluid.transforms.arrayValue", { 
        gradeNames: "fluid.standardTransformFunction"
    });
    
    fluid.transforms.arrayValue = fluid.makeArray;


    fluid.defaults("fluid.transforms.count", { 
        gradeNames: "fluid.standardTransformFunction"
    });
    
    fluid.transforms.count = function (value) {
        return fluid.makeArray(value).length;
    };
    
    
    fluid.defaults("fluid.transforms.round", { 
        gradeNames: "fluid.standardTransformFunction"
    });
    
    fluid.transforms.round = function (value) {
        return Math.round(value);
    };
    

    fluid.defaults("fluid.transforms.delete", { 
        gradeNames: "fluid.transformFunction"
    });

    fluid.transforms["delete"] = function (transformSpec, transform) {
        var outputPath = fluid.model.composePaths(transform.outputPrefix, transformSpec.outputPath);
        transform.applier.requestChange(outputPath, null, "DELETE");
    };

    
    fluid.defaults("fluid.transforms.firstValue", { 
        gradeNames: "fluid.transformFunction"
    });
    
    fluid.transforms.firstValue = function (transformSpec, transform) {
        if (!transformSpec.values || !transformSpec.values.length) {
            fluid.fail("firstValue transformer requires an array of values at path named \"values\", supplied", transformSpec);
        }
        for (var i = 0; i < transformSpec.values.length; i++) {
            var value = transformSpec.values[i];
            // TODO: problem here - all of these transforms will have their side-effects (setValue) even if only one is chosen 
            var expanded = transform.expand(value);
            if (expanded !== undefined) {
                return expanded;
            }
        }
    };
    
    fluid.defaults("fluid.transforms.linearScale", {
        gradeNames: [ "fluid.multiInputTransformFunction", "fluid.standardOutputTransformFunction", "fluid.lens" ],
        invertConfiguration: "fluid.transforms.linearScale.invert",
        inputVariables: {
            value: null, 
            factor: 1,
            offset: 0
        }
    });

    /* simple linear transformation */
    fluid.transforms.linearScale = function (inputs) {        
        if (typeof(inputs.value) !== "number" || typeof(inputs.factor) !== "number" || typeof(inputs.offset) !== "number") {
            return undefined;
        }
        return inputs.value * inputs.factor + inputs.offset;
    };

    /* TODO: This inversion doesn't work if the value and factors are given as paths in the source model */
    fluid.transforms.linearScale.invert = function  (transformSpec, transform) {
        var togo = fluid.copy(transformSpec);
        
        if (togo.factor) {
            togo.factor = (togo.factor === 0) ? 0 : 1 / togo.factor;
        }
        if (togo.offset) {
            togo.offset = - togo.offset * (togo.factor !== undefined ? togo.factor : 1);
        }
        togo.valuePath = fluid.model.composePaths(transform.outputPrefix, transformSpec.outputPath);
        togo.outputPath = fluid.model.composePaths(transform.inputPrefix, transformSpec.valuePath);
        return togo;
    };

    fluid.defaults("fluid.transforms.binaryOp", { 
        gradeNames: [ "fluid.multiInputTransformFunction", "fluid.standardOutputTransformFunction" ],
        inputVariables: {
            left: null,
            right: null
        }
    });

    fluid.transforms.binaryLookup = {
        "===": function (a, b) { return a === b; },
        "!==": function (a, b) { return a !== b; },
        "<=": function (a, b) { return a <= b; },
        "<": function (a, b) { return a < b; },
        ">=": function (a, b) { return a >= b; },
        ">": function (a, b) { return a > b; },
        "+": function (a, b) { return a + b; },
        "-": function (a, b) { return a - b; },
        "*": function (a, b) { return a * b; },
        "/": function (a, b) { return a / b; },
        "%": function (a, b) { return a % b; },
        "&&": function (a, b) { return a && b; },
        "||": function (a, b) { return a || b; }
    };

    fluid.transforms.binaryOp = function (inputs, transformSpec, transform) {
        var operator = fluid.model.transform.getValue(undefined, transformSpec.operator, transform);

        var fun = fluid.transforms.binaryLookup[operator];
        return (fun === undefined || inputs.left === undefined || inputs.right === undefined) ? undefined : fun(inputs.left, inputs.right);
    };


    fluid.defaults("fluid.transforms.condition", { 
        gradeNames: [ "fluid.multiInputTransformFunction", "fluid.standardOutputTransformFunction" ],
        inputVariables: {
            "true": null,
            "false": null,
            "condition": null
        }
    });
    
    fluid.transforms.condition = function (inputs) {
        if (inputs.condition === null) {
            return undefined;
        }

        return inputs[inputs.condition];
    };


    fluid.defaults("fluid.transforms.valueMapper", { 
        gradeNames: ["fluid.transformFunction", "fluid.lens"],
        invertConfiguration: "fluid.transforms.valueMapper.invert",
        collectInputPaths: "fluid.transforms.valueMapper.collect"
    });

    // unsupported, NON-API function    
    fluid.model.transform.matchValueMapperFull = function (outerValue, transformSpec, transform) {
        var o = transformSpec.options;
        if (o.length === 0) {
            fluid.fail("valueMapper supplied empty list of options: ", transformSpec);
        }
        if (o.length === 1) {
            return 0;
        }
        var matchPower = []; 
        for (var i = 0; i < o.length; ++i) {
            var option = o[i];
            var value = fluid.firstDefined(fluid.model.transform.getValue(option.inputPath, undefined, transform),
                outerValue);
            var matchCount = fluid.model.transform.matchValue(option.undefinedInputValue ? undefined : option.inputValue, value);
            matchPower[i] = {index: i, matchCount: matchCount};
        }
        matchPower.sort(fluid.model.transform.compareMatches);
        return matchPower[0].matchCount === matchPower[1].matchCount ? -1 : matchPower[0].index; 
    };

    fluid.transforms.valueMapper = function (transformSpec, transform) {
        if (!transformSpec.options) {
            fluid.fail("demultiplexValue requires a list or hash of options at path named \"options\", supplied ", transformSpec);
        }
        var value = fluid.model.transform.getValue(transformSpec.inputPath, undefined, transform);
        var deref = fluid.isArrayable(transformSpec.options) ? // long form with list of records    
            function (testVal) {
                var index = fluid.model.transform.matchValueMapperFull(testVal, transformSpec, transform);
                return index === -1 ? null : transformSpec.options[index];
            } : 
            function (testVal) {
                return transformSpec.options[testVal];
            };
      
        var indexed = deref(value);
        if (!indexed) {
            // if no branch matches, try again using this value - WARNING, this seriously
            // threatens invertibility
            indexed = deref(transformSpec.defaultInputValue);
        }
        if (!indexed) {
            return;
        }

        var outputPath = indexed.outputPath === undefined ? transformSpec.defaultOutputPath : indexed.outputPath;
        transform.outputPrefixOp.push(outputPath);
        var outputValue;
        if (fluid.isPrimitive(indexed)) {
            outputValue = indexed;
        } else {
            // if undefinedOutputValue is set, outputValue should be undefined
            if (indexed.undefinedOutputValue) {
                outputValue = undefined;
            } else {
                // get value from outputValue or outputValuePath. If none is found set the outputValue to be that of defaultOutputValue (or undefined)
                outputValue = fluid.model.transform.resolveParam(indexed, transform, "outputValue", undefined);
                outputValue = (outputValue === undefined) ? transformSpec.defaultOutputValue : outputValue;
            }
        }
        //output if outputPath or defaultOutputPath have been specified and the relevant child hasn't done the outputting
        if (typeof(outputPath) === "string" && outputValue !== undefined) {
            fluid.model.transform.setValue(undefined, outputValue, transform, transformSpec.merge);
            outputValue = undefined;
        }
        transform.outputPrefixOp.pop();
        return outputValue; 
    };
    
    fluid.transforms.valueMapper.invert = function (transformSpec, transform) {
        var options = [];
        var togo = {
            type: "fluid.transforms.valueMapper",
            options: options
        };
        var isArray = fluid.isArrayable(transformSpec.options);
        var findCustom = function (name) {
            return fluid.find(transformSpec.options, function (option) {
                if (option[name]) {
                    return true;
                }
            });
        };
        var anyCustomOutput = findCustom("outputPath");
        var anyCustomInput = findCustom("inputPath");
        if (!anyCustomOutput) {
            togo.inputPath = fluid.model.composePaths(transform.outputPrefix, transformSpec.outputPath);
        }
        if (!anyCustomInput) {
            togo.defaultOutputPath = fluid.model.composePaths(transform.inputPrefix, transformSpec.inputPath);
        }
        var def = fluid.firstDefined;
        fluid.each(transformSpec.options, function (option, key) {
            var outOption = {};
            var origInputValue = def(isArray ? option.inputValue : key, transformSpec.defaultInputValue);
            if (origInputValue === undefined) {
                fluid.fail("Failure inverting configuration for valueMapper - inputValue could not be resolved for record " + key + ": ", transformSpec);
            }
            outOption.outputValue = origInputValue;
            var origOutputValue = def(option.outputValue, transformSpec.defaultOutputValue);
            outOption.inputValue = fluid.model.transform.getValue(option.outputValuePath, origOutputValue, transform);
            if (anyCustomOutput) {
                outOption.inputPath = fluid.model.composePaths(transform.outputPrefix, def(option.outputPath, transformSpec.outputPath));
            }
            if (anyCustomInput) {
                outOption.outputPath = fluid.model.composePaths(transform.inputPrefix, def(option.inputPath, transformSpec.inputPath));
            }
            if (option.outputValuePath) {
                outOption.inputValuePath = option.outputValuePath;
            }
            options.push(outOption);
        });
        return togo;
    };
    
    fluid.transforms.valueMapper.collect = function (transformSpec, transform) {
        var togo = [];
        fluid.model.transform.accumulateInputPath(transformSpec.inputPath, transform, togo);
        fluid.each(transformSpec.options, function (option) {
            fluid.model.transform.accumulateInputPath(option.inputPath, transform, togo);
        });
        return togo;
    };

    /* -------- arrayToSetMembership and setMembershipToArray ---------------- */
    
    fluid.defaults("fluid.transforms.arrayToSetMembership", { 
        gradeNames: ["fluid.standardInputTransformFunction", "fluid.lens"],
        invertConfiguration: "fluid.transforms.arrayToSetMembership.invert"
    });

 
    fluid.transforms.arrayToSetMembership = function (value, transformSpec, transform) {
        var options = transformSpec.options;

        if (!value || !fluid.isArrayable(value)) {
            fluid.fail("arrayToSetMembership didn't find array at inputPath nor passed as value.", transformSpec);
        }
        if (!options) {
            fluid.fail("arrayToSetMembership requires an options block set");
        }

        if (transformSpec.presentValue === undefined) {
            transformSpec.presentValue = true;
        }
        
        if (transformSpec.missingValue === undefined) {
            transformSpec.missingValue = false;
        }

        fluid.each(options, function (outPath, key) {
            // write to output path given in options the value <presentValue> or <missingValue> depending on whether key is found in user input
            var outVal = ($.inArray(key, value) !== -1) ? transformSpec.presentValue : transformSpec.missingValue;
            fluid.model.transform.setValue(outPath, outVal, transform);
        });
        // TODO: Why does this transform make no return?
    };

    fluid.transforms.arrayToSetMembership.invert = function (transformSpec, transform) {
        var togo = fluid.copy(transformSpec);
        delete togo.inputPath;
        togo.type = "fluid.transforms.setMembershipToArray";
        togo.outputPath = fluid.model.composePaths(transform.inputPrefix, transformSpec.inputPath);
        var newOptions = {};
        fluid.each(transformSpec.options, function (path, oldKey) {
            var newKey = fluid.model.composePaths(transform.outputPrefix, path);
            newOptions[newKey] = oldKey;
        });
        togo.options = newOptions;
        return togo;
    };

    fluid.defaults("fluid.transforms.setMembershipToArray", { 
        gradeNames: ["fluid.standardOutputTransformFunction"]
    });

    fluid.transforms.setMembershipToArray = function (transformSpec, transform) {
        var options = transformSpec.options;

        if (!options) {
            fluid.fail("setMembershipToArray requires an options block specified");
        }

        if (transformSpec.presentValue === undefined) {
            transformSpec.presentValue = true;
        }
        
        if (transformSpec.missingValue === undefined) {
            transformSpec.missingValue = false;
        }

        var outputArr = [];
        fluid.each(options, function (arrVal, inPath) {
            var val = fluid.model.transform.getValue(inPath, undefined, transform);
            if (val === transformSpec.presentValue) {
                outputArr.push(arrVal);
            }
        });
        return outputArr;
    };    

    /* -------- objectToArray and arrayToObject -------------------- */
    
    /**
     * Transforms the given array to an object.
     * Uses the transformSpec.options.key values from each object within the array as new keys.
     *
     * For example, with transformSpec.key = "name" and an input object like this:
     *
     * {
     *   b: [
     *     { name: b1, v: v1 },
     *     { name: b2, v: v2 }
     *   ]
     * }
     *
     * The output will be:
     * {
     *   b: {
     *     b1: {
     *       v: v1
     *     }
     *   },
     *   {
     *     b2: {
     *       v: v2
     *     }
     *   }
     * }
     */
    fluid.model.transform.applyPaths = function (operation, pathOp, paths) {
        for (var i = 0; i < paths.length; ++i) {
            if (operation === "push") {
                pathOp.push(paths[i]);
            } else {
                pathOp.pop();   
            }
        }
    };
    
    fluid.model.transform.expandInnerValues = function (inputPath, outputPath, transform, innerValues) {
        var inputPrefixOp = transform.inputPrefixOp;
        var outputPrefixOp = transform.outputPrefixOp;
        var apply = fluid.model.transform.applyPaths;
        
        apply("push", inputPrefixOp, inputPath);
        apply("push", outputPrefixOp, outputPath);
        var expanded = {};
        fluid.each(innerValues, function (innerValue) {
            var expandedInner = transform.expand(innerValue);
            if (!fluid.isPrimitive(expandedInner)) {
                $.extend(true, expanded, expandedInner);
            } else {
                expanded = expandedInner;
            }
        });
        apply("pop", outputPrefixOp, outputPath);
        apply("pop", inputPrefixOp, inputPath);
        
        return expanded;
    };


    fluid.defaults("fluid.transforms.arrayToObject", {
        gradeNames: ["fluid.standardTransformFunction", "fluid.lens" ],
        invertConfiguration: "fluid.transforms.arrayToObject.invert"
    });

    fluid.transforms.arrayToObject = function (arr, transformSpec, transform) {
        if (transformSpec.key === undefined) {
            fluid.fail("arrayToObject requires a 'key' option.", transformSpec);
        }
        if (!fluid.isArrayable(arr)) {
            fluid.fail("arrayToObject didn't find array at inputPath.", transformSpec);
        }
        var newHash = {};
        var pivot = transformSpec.key;

        fluid.each(arr, function (v, k) {
            // check that we have a pivot entry in the object and it's a valid type:            
            var newKey = v[pivot];
            var keyType = typeof(newKey);
            if (keyType !== "string" && keyType !== "boolean" && keyType !== "number") {
                fluid.fail("arrayToObject encountered untransformable array due to missing or invalid key", v);
            }
            // use the value of the key element as key and use the remaining content as value
            var content = fluid.copy(v);
            delete content[pivot];
            // fix sub Arrays if needed:
            if (transformSpec.innerValue) {
                content = fluid.model.transform.expandInnerValues([transform.inputPrefix, transformSpec.inputPath, k.toString()], 
                    [newKey], transform, transformSpec.innerValue);
            }
            newHash[newKey] = content;
        });
        return newHash;
    };

    fluid.transforms.arrayToObject.invert = function (transformSpec, transform) {
        var togo = fluid.copy(transformSpec);
        togo.type = "fluid.transforms.objectToArray";
        togo.inputPath = fluid.model.composePaths(transform.outputPrefix, transformSpec.outputPath);
        togo.outputPath = fluid.model.composePaths(transform.inputPrefix, transformSpec.inputPath);
        // invert transforms from innerValue as well:
        // TODO: The Model Transformations framework should be capable of this, but right now the
        // issue is that we use a "private contract" to operate the "innerValue" slot. We need to
        // spend time thinking of how this should be formalised
        if (togo.innerValue) {
            var innerValue = togo.innerValue;
            for (var i = 0; i < innerValue.length; ++i) {
                innerValue[i] = fluid.model.transform.invertConfiguration(innerValue[i]);
            }            
        }
        return togo;
    };
    

    fluid.defaults("fluid.transforms.objectToArray", {
        gradeNames: "fluid.standardTransformFunction"
    });

    /**
     * Transforms an object into array of objects.
     * This performs the inverse transform of fluid.transforms.arrayToObject.
     */
    fluid.transforms.objectToArray = function (hash, transformSpec, transform) {
        if (transformSpec.key === undefined) {
            fluid.fail("objectToArray requires a 'key' option.", transformSpec);
        }
        
        var newArray = [];
        var pivot = transformSpec.key;

        fluid.each(hash, function (v, k) {
            var content = {};
            content[pivot] = k;
            if (transformSpec.innerValue) {
                v = fluid.model.transform.expandInnerValues([transformSpec.inputPath, k], [transformSpec.outputPath, newArray.length.toString()], 
                    transform, transformSpec.innerValue);
            }
            $.extend(true, content, v);
            newArray.push(content);
        });
        return newArray;
    };
    
    fluid.defaults("fluid.transforms.limitRange", {
        gradeNames: "fluid.standardTransformFunction"  
    });
    
    fluid.transforms.limitRange = function (value, transformSpec, transform) {
        var min = transformSpec.min;
        if (min !== undefined) {
            var excludeMin = transformSpec.excludeMin || 0;
            min += excludeMin;
            if (value < min) {
                value = min;
            }  
        }
        var max = transformSpec.max;
        if (max !== undefined) {
            var excludeMax = transformSpec.excludeMax || 0;
            max -= excludeMax;
            if (value > max) {
                value = max;
            }  
        }
        return value;
    };
    
    fluid.defaults("fluid.transforms.free", {
        gradeNames: "fluid.transformFunction"  
    });
    
    fluid.transforms.free = function (transformSpec, transform) {
        var args = fluid.makeArray(transformSpec.args);
        return fluid.invokeGlobalFunction(transformSpec.func, args);
    };
    
})(jQuery, fluid_1_5);
