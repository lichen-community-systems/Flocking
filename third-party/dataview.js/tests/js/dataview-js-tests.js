(function () {
    "use strict";    

    var floatTestVals = [0, 0.5, 1.0, -0.5 -1.0];
    
    (function () {
        module("Construction");
        
        var arrayView = new Float32Array(floatTestVals),
            buffer = arrayView.buffer;
            
        test("New DataView with offset and length not specified.", function () {
            var dv = new polyDataView(buffer);

            equals(dv.offset, 0, "When no offset is specified, it should default to 0.");
            equals(dv.length, arrayView.byteLength, "When no length is specified, it should be the same as the array's byte length.");
        });

        test("New DataView with only offset specified.", function () {
            var dv = new polyDataView(buffer, 4);
            
            equals(dv.offset, 4, "When an offset is specified, it should be reflected correctly.");
            equals(dv.length, 12, 
                "With an offset but no length specified, the DataView's length should be the array's byte length less the offset.");
        });
        
        test("New DataView with both offset and length specified.", function () {
            var dv = new polyDataView(buffer, 4, 4);
            
            equals(dv.offset, 4, "When an offset is specified, it should be reflected correctly.");
            equals(dv.length, 4, "When a length is specified, it should be correct.");
        });
    }());
    

    
    var getterTest = function (spec) {
        module(spec.name);
        
        var tester = function (typedBuffer, isLittle) {
            var dv = new polyDataView(typedBuffer.buffer),
                i,
                expected, actual;
            
            for (i = 0; i < spec.expected.length; i++) {
                expected = spec.expected[i];
                actual = dv[spec.name](undefined, isLittle);
                equal(actual, expected);
            }
        };
        
        for (var endian in spec.ordered) {
            test(spec.name + " " + endian + " endian", function () {
               tester(spec.ordered[endian], true);
            });
        }
    };
        
    getterTest({
        name: "getUint8",
        byteSize: 1,
        expected: [0, 1, 128, 255],
        ordered: {
            little: new Uint8Array([0, 1, 128, 255]),
            big: new Uint8Array([0, 1, 128, 255])
        } 
    });
    
    getterTest({
        name: "getInt16",
        byteSize: 2,
        expected: new Int16Array([0, 32767, -32767]),
        ordered: {
            little: new Int16Array([0, 32767, -32767])
        }
    });
    
    getterTest({
        name: "getFloat32",
        byteSize: 4,
        expected: new Float32Array(floatTestVals),
        ordered: {
            little: new Float32Array(floatTestVals)
        }
    });

})();
