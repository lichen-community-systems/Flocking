(function () {
    "use strict";    

    var nums = new Int16Array([0, 32767, -32767]);
    var buffer = nums.buffer;
    
    module("Int16");
    
    test("getInt16 little", function () {
        var dv = new DataView(buffer, 0, buffer.byteLength),
            i,
            expected, actual;
        
        for (i = 0; i < nums.length; i++) {
            expected = nums[i];
            actual = dv.getInt16(i, true);
            equal(actual, expected);
        }        
    });

})();
