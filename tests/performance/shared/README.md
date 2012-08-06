Sheep: JavaScript Performance Benchmarking
==========================================

What is Sheep?
--------------

Sheep is a simple tool for running performance tests in the browser and timing their results.

Examples
--------

Test a simple function:
```javascript
sheep.test({
    name: "How fast is Math.random()?",
    test: Math.random
});
```

Test a function with arguments:
```javascript
sheep.test({
    name: "How fast is Math.round()?",
    test: function() {
        Math.round(27.443);
    }
});
```

Test a method on an object:
```javascript
sheep.test({
    name: "How fast Array.length?",
    
    // The setup function is called once per test sequence.
    setup: function () {
        return [1, 2, 3, 4, 5];
    },
    
    // The test function is passed the return value of the setup function each time.
    test: function (arr) {
        arr.length();
    }
});
```

Run several tests:
```javascript
sheep.test([
    {
        name: "How fast is the Math.random?",
        test: Math.random
    },
    
    {
        name: "How fast Array.length?",
        
        // The setup function is called once per test sequence.
        setup: function () {
            return [1, 2, 3, 4, 5];
        },
        
        // The test function is passed the return value of the setup function each time.
        test: function (arr) {
            arr.length();
        }
    }
]);
```

All options:
```javascript
sheep.test({
    name: "How fast Array.length?",
    
    numReps: 10, // Defaults to 100000
    
    // The setup function is called once per test sequence.
    setup: function () {
        return [1, 2, 3, 4, 5];
    },
    
    // The test function is passed the return value of the setup function each time.
    test: function (arr) {
        arr.length();
    },
    
    // onSuccess is called at the end of each test sequence, and is passed the timing data.
    onSuccess: function (timing) {
        console.log("The test for Array.length() just finished and it took " +
            timing.total + "ms to run the test " + timing.runs + " times.");
    }
});
```