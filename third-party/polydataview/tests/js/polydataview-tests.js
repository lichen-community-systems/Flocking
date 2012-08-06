(function () {
    "use strict";    
    
    module("Construction");
    
    var arrayView = new Float32Array([0, 0.5, 1.0, -0.5 -1.0]),
        buffer = arrayView.buffer;
        
    test("New DataView with offset and length not specified.", function () {
        var dv = new PolyDataView(buffer);

        equals(dv.byteOffset, 0, "When no offset is specified, it should default to 0.");
        equals(dv.byteLength, arrayView.byteLength, "When no length is specified, it should be the same as the array's byte length.");
    });

    test("New DataView with only offset specified.", function () {
        var dv = new PolyDataView(buffer, 4);
        
        equals(dv.byteOffset, 4, "When an offset is specified, it should be reflected correctly.");
        equals(dv.byteLength, 12,
            "With an offset but no length specified, the DataView's length should be the array's byte length less the offset.");
    });
    
    test("New DataView with both offset and length specified.", function () {
        var dv = new PolyDataView(buffer, 4, 4);
        
        equals(dv.byteOffset, 4, "When an offset is specified, it should be reflected correctly.");
        equals(dv.byteLength, 4, "When a length is specified, it should be correct.");
    });


    module("Typed Getters");
    
    var getterTest = function (name, spec) {
        var tester = function (typedBuffer, offset, isLittle) {
            var dv = new PolyDataView(typedBuffer.buffer),
                i,
                expected, actual;
            
            for (i = 0; i < spec.expected.length; i++) {
                expected = spec.expected[i];
                actual = dv[name](offset, isLittle);
                if (isNaN(expected)) {
                    ok(isNaN(actual));
                } else {
                    equal(actual, expected);
                }
                
                offset = typeof (offset) === "number" ? offset + spec.byteSize : undefined;
            }
        };
        
        for (var endian in spec.byteOrders) {
            var byteOrder = spec.byteOrders[endian];
            var isLittle = endian === "little";
            var testDescription = name + " " + endian + " endian, ";
            test(testDescription + "unspecified offset.", function () {
               tester(byteOrder, undefined, isLittle);
            });
            
            test(testDescription + "offset specified.", function () {
                tester(byteOrder, 0, isLittle);
            });
        }
    };
    
    var testTypedGetters = function (specs) {
        for (var getter in specs) {
            var spec = specs[getter];
            getterTest(getter, spec);
        }
    };
    
    var getterTestSpecs = {
        "getUint8": {
            byteSize: 1,
            expected: [0, 1, 128, 255],
            byteOrders: {
                little: new Uint8Array([0, 1, 128, 255]),
                big: new Uint8Array([0, 1, 128, 255])
            }
        },
        
        "getUint16": {
            byteSize: 2,
            expected: [0, 32768, 65535, 1],
            byteOrders: {
                little: new Uint8Array([
                    0, 0,
                    0, 128,
                    255, 255,
                    1, 0
                ]),
                big: new Uint8Array([
                    0, 0,
                    128, 0,
                    255, 255,
                    0, 1
                ])
            }
        },
        
        "getUint32": {
            byteSize: 4,
            expected: [0, 32768, 65535, 4294967295, 1],
            byteOrders: {
                little: new Uint8Array([
                    0, 0, 0, 0,
                    0, 128, 0, 0,
                    255, 255, 0, 0,
                    255, 255, 255, 255,
                    1, 0, 0, 0
                ]),
                big: new Uint8Array([
                    0, 0, 0, 0,
                    0, 0, 128, 0,
                    0, 0, 255, 255,
                    255, 255, 255, 255,
                    0, 0, 0, 1
                ])
            }
        },
        
        "getInt8": {
            byteSize: 1,
            expected: [0, 1, 127, -1, -128],
            byteOrders: {
                little: new Uint8Array([
                    0, 1, 127, 255, 128
                ]),
                big: new Uint8Array([
                    0, 1, 127, 255, 128
                ])
            }
        },
        
        "getInt16": {
            byteSize: 2,
            expected: [0, 1, 128, 256, 32767, -1, -32768],
            byteOrders: {
                little: new Uint8Array([
                    0, 0,
                    1, 0,
                    128, 0,
                    0, 1,
                    255, 127,
                    255, 255,
                    0, 128
                ]),
                big: new Uint8Array([
                   0, 0,
                   0, 1,
                   0, 128,
                   1, 0,
                   127, 255,
                   255, 255,
                   128, 0
               ])
            }
        },
        
        "getInt32": {
            byteSize: 4,
            expected: [0, 1, 128, 256, 65535, 2147483647, -1, -2147483648],
            byteOrders: {
                little: new Uint8Array([
                    0, 0, 0, 0,
                    1, 0, 0, 0,
                    128, 0, 0, 0,
                    0, 1, 0, 0,
                    255, 255, 0, 0,
                    255, 255, 255, 127,
                    255, 255, 255, 255,
                    0, 0, 0, 128
                ]),
                big: new Uint8Array([
                    0, 0, 0, 0,
                    0, 0, 0, 1,
                    0, 0, 0, 128,
                    0, 0, 1, 0,
                    0, 0, 255, 255,
                    127, 255, 255, 255,
                    255, 255, 255, 255,
                    128, 0, 0, 0
                ])
            }
        },

        "getFloat32": {
            byteSize: 4,
            expected: new Float32Array([0, -0, 0.5, 1.0, 3.4028234e+38, Infinity, -0.5, -1.0, -3.4028234e+38, -Infinity, 0.3333333432674408, NaN]),
            byteOrders: {
                little: new Uint8Array([
                    0, 0, 0, 0,
                    0, 0, 0, 128,
                    0, 0, 0, 63,
                    0, 0, 128, 63,
                    255, 255, 127, 127,
                    0, 0, 0, 128, 127,
                    0, 0, 0, 191,
                    0, 0, 128, 191,
                    255, 255, 127, 255,
                    0, 0, 128, 255,
                    171, 170, 170, 62,
                    0, 0, 192, 127
                ]),
                big: new Uint8Array([
                    0, 0, 0, 0,
                    128, 0, 0, 0,
                    63, 0, 0, 0,
                    63, 128, 0, 0,
                    127, 127, 255, 255,
                    127, 128, 0, 0,
                    191, 0, 0, 0,
                    191, 128, 0, 0,
                    255, 127, 255, 255,
                    255, 128, 0, 0,
                    62, 170, 170, 171,
                    127, 192, 0, 0
                ])
            }
        },
        
        "getFloat64": {
            byteSize: 8,
            expected: new Float64Array([1, 1.0000000000000002, 2, -2, 0, -0, Infinity, -Infinity, Number.MAX_VALUE, Number.MIN_VALUE, 1/3, NaN]),
            byteOrders: {
                little: new Uint8Array([
                    0, 0, 0, 0, 0, 0, 24, 63,
                    1, 240, 0, 0, 0, 0, 240, 63,
                    0, 0, 0, 0, 0, 0, 0, 64,
                    0, 0, 0, 0, 0, 0, 0, 192,
                    0, 0, 0, 0, 0, 0, 0, 0,
                    0, 0, 0, 0, 0, 0, 0, 128,
                    0, 0, 0, 0, 0, 0, 240, 127,
                    0, 0, 0, 0, 0, 0, 240, 255,
                    255, 255, 255, 255, 255, 255, 127, 239,
                    1, 0, 0, 0, 0, 0, 0, 0,
                    85, 85, 85, 85, 85, 85, 213, 63,
                    0, 0, 0, 0, 0, 0, 248, 127
                ]),
                big: new Uint8Array([
                    63, 240, 0, 0, 0, 0, 0, 0,
                    63, 240, 0, 0, 0, 0, 0, 1,
                    64, 0, 0, 0, 0, 0, 0, 0,
                    192, 0, 0, 0, 0, 0, 0, 0,
                    0, 0, 0, 0, 0, 0, 0, 0,
                    128, 0, 0, 0, 0, 0, 0, 0,
                    127, 240, 0, 0, 0, 0, 0, 0,
                    255, 240, 0, 0, 0, 0, 0, 0,
                    127, 239, 255, 255, 255, 255, 255, 255,
                    0, 0, 0, 0, 0, 0, 0, 1,
                    63, 213, 85, 85, 85, 85, 85, 85,
                    127, 248, 0, 0, 0, 0, 0, 0
                ])
            }
        }
    };

    testTypedGetters(getterTestSpecs);
    
    module("String Getter");
    
    test("8-bit Strings", function () {
        var expected = "Stringy",
            raw = [],
            actual,
            i,
            buffer;
            
        for (i = 0; i < expected.length; i++) {
            raw.push(expected.charCodeAt(i));
        }
        buffer = new Uint8Array(raw).buffer;
        
        // Track offset ourselves.
        var dv = new PolyDataView(buffer);
        actual = dv.getString(7, 1, 0, true);
        equal(actual, expected);
        
        // Don't track offset.
        dv = new PolyDataView(buffer);
        actual = dv.getString(7, 1, undefined, true);
        equal(actual, expected);
    });
    
    test("Multibyte Strings", function () {
        var spec = {
            expected: String.fromCharCode(0xf900) + String.fromCharCode(0xf901) + String.fromCharCode(0xf902),
            byteOrders: {
                little: new Uint8Array([
                    0x00, 0xf9, // 豈
                    0x01, 0xf9, // 更
                    0x02, 0xf9  // 車
                ]),
                
                big: new Uint8Array([
                    0xf9, 0x00, // 豈
                    0xf9, 0x01, // 更
                    0xf9, 0x02  // 車
                ])
            }
        };
        
        var endian,
            isLittle,
            byteOrder,
            dv,
            actual;
            
        for (endian in spec.byteOrders) {
            isLittle = endian === "little";
            byteOrder = spec.byteOrders[endian];
            dv = new PolyDataView(byteOrder.buffer);
            actual = dv.getString(spec.expected.length, 2, undefined, isLittle);
            equal(actual, spec.expected);
        }
    });
    
    /*
     Not yet tested:
        getUints
        getInts
        getFloats
        getUint
        getInt
        getFloat80
    */
})();
