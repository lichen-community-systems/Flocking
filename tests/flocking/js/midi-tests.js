/*global fluid, module, test, equal*/

(function () {
    "use strict";

    var testPort = {
        manufacturer: "KORG INC.",
        name: "SLIDER/KNOB"
    };

    var testMatch = function (name, matcherType, matchSpec, port, matchExpected) {
        test(name, function () {
            var matcher = fluid.invokeGlobalFunction(matcherType, [matchSpec]);
            var didMatch = matcher(port);

            var msg = matchExpected ? "The match specification should have matched the port." :
                "The match specification should not have matched the port.";

            equal(didMatch, matchExpected, msg);
        });
    };

    var runMatchTests = function (testSpecsByType) {
        for (var matcherType in testSpecsByType) {
            var testSpecs = testSpecsByType[matcherType];
            module("Port Matcher: " + matcherType);
            for (var i = 0; i < testSpecs.length; i++) {
                var spec = testSpecs[i];
                testMatch(spec.name, matcherType, spec.matchSpec, spec.port, spec.shouldMatch);
            }
        }
    };

    var matchTestSpecs = {
        "flock.midi.findPorts.lowerCaseContainsMatcher": [
            {
                name: "Single-property complete match",
                matchSpec: {
                    manufacturer: "KORG INC."
                },
                port: testPort,
                shouldMatch: true
            },
            {
                name: "Single property mismatch",
                matchSpec: {
                    manufacturer: "AKAI"
                },
                port: testPort,
                shouldMatch: false
            },
            {
                name: "Multiple property complete match",
                matchSpec: {
                    manufacturer: "KORG INC.",
                    name: "SLIDER/KNOB"
                },
                port: testPort,
                shouldMatch: true
            },
            {
                name: "Multiple property mismatch",
                matchSpec: {
                    manufacturer: "AKAI",
                    name: "SLIDER/KNOB"
                },
                port: testPort,
                shouldMatch: false
            },
            {
                name: "Single property partial match",
                matchSpec: {
                    manufacturer: "KORG"
                },
                port: testPort,
                shouldMatch: true
            },
            {
                name: "Multiple property partial match",
                matchSpec: {
                    manufacturer: "KORG",
                    name: "SLIDER"
                },
                port: testPort,
                shouldMatch: true
            },
            {
                name: "Single property wildcard match",
                matchSpec: {
                    name: "*"
                },
                port: testPort,
                shouldMatch: true
            },
            {
                name: "Multiple property wildcard match",
                matchSpec: {
                    manufacturer: "KORG INC.",
                    name: "*"
                },
                port: testPort,
                shouldMatch: true
            }
        ]
    };

    runMatchTests(matchTestSpecs);


    // test(, function () {
    //     var matchSpec = ;
    // });
    //
    // test("Case mismatch match", function () {
    //
    // });
    //
    // test("Partial match", function () {
    //
    // });
    //
    // test("Wildcart match", function () {
    //
    // });

}());
