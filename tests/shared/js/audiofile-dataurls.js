/*!
* Flocking - Audio File Data URLs
* http://github.com/colinbdclark/flocking
*
* Copyright 2012, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global fluid, flock*/

(function () {
    "use strict";

    fluid.registerNamespace("flock.test.audio");

    flock.test.audio.b64Int16WAVData = "UklGRngAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YVQAAAAAAM0MmRlmJjMzAEDMTJlZZmYyc/9/MnNmZplZzEwAQDMzZiaZGc0MAAAz82fmmtnNzADANLNnppqZzowBgM6MmplnpjSzAMDNzJrZZ+Yz8wAAzQw=";
    flock.test.audio.triangleInt16WAV = "data:audio/wav;base64," + flock.test.audio.b64Int16WAVData;
    flock.test.audio.triangleInt32WAV = "data:audio/wav;base64,UklGRswAAABXQVZFZm10IBAAAAABAAEARKwAABCxAgAEACAAZGF0YagAAAAAAAAA0MzMDKCZmRmAZmYmQDMzMwAAAEAAzcxMgJmZWYBmZmYAMzNz////fwAzM3OAZmZmgJmZWQDNzEwAAABAQDMzM4BmZiagmZkZ0MzMDAAAAAAwMzPzYGZm5oCZmdnAzMzMAAAAwAAzM7OAZmamgJmZmQDNzIwAAACAAM3MjICZmZmAZmamADMzswAAAMDAzMzMgJmZ2WBmZuYwMzPzAAAAANDMzAw=";
    flock.test.audio.triangleFloatWAV = "data:audio/wav;base64,UklGRvAAAABXQVZFZm10IBAAAAADAAEARKwAABCxAgAEACAAZmFjdAQAAAAqAAAAUEVBSxAAAAABAAAAyqI2TwAAgD8KAAAAZGF0YagAAAAAAAAAzczMPc3MTD6amZk+zczMPgAAAD+amRk/MzMzP83MTD9mZmY/AACAP2ZmZj/NzEw/MzMzP5qZGT8AAAA/zczMPpqZmT7NzEw+zczMPQAAAADNzMy9zcxMvpqZmb7NzMy+AAAAv5qZGb8zMzO/zcxMv2ZmZr8AAIC/ZmZmv83MTL8zMzO/mpkZvwAAAL/NzMy+mpmZvs3MTL7NzMy9AAAAAM3MzD0=";

    flock.test.audio.triangleInt8AIFF = "data:audio/aiff;base64,Rk9STQAAAFhBSUZGQ09NTQAAABIAAQAAACoACEAOrEQAAAAAAABTU05EAAAAMgAAAAAAAAAAAA0ZJjNATFlmcn9yZllMQDMmGQ0A8+fazcC0p5qOgY6ap7TAzdrn8wAN";
    flock.test.audio.triangleInt16AIFF = "data:audio/aiff;base64,Rk9STQAAAIJBSUZGQ09NTQAAABIAAQAAACoAEEAOrEQAAAAAAABTU05EAAAAXAAAAAAAAAAAAAAMzRmZJmYzM0AATMxZmWZmczJ//3MyZmZZmUzMQAAzMyZmGZkMzQAA8zPmZ9mazM3AALM0pmeZmozOgAGMzpmapmezNMAAzM3ZmuZn8zMAAAzN";
    flock.test.audio.triangleInt32AIFF = "data:audio/aiff;base64,Rk9STQAAANZBSUZGQ09NTQAAABIAAQAAACoAIEAOrEQAAAAAAABTU05EAAAAsAAAAAAAAAAAAAAAAAzMzNAZmZmgJmZmgDMzM0BAAAAATMzNAFmZmYBmZmaAczMzAH////9zMzMAZmZmgFmZmYBMzM0AQAAAADMzM0AmZmaAGZmZoAzMzNAAAAAA8zMzMOZmZmDZmZmAzMzMwMAAAACzMzMApmZmgJmZmYCMzM0AgAAAAIzMzQCZmZmApmZmgLMzMwDAAAAAzMzMwNmZmYDmZmZg8zMzMAAAAAAMzMzQ";
    flock.test.audio.triangleFloatAIFF = "data:audio/aiff;base64,Rk9STQAAAQBBSUZDRlZFUgAAAASigFFAQ09NTQAAABgAAQAAACoAIEAOrEQAAAAAAABGTDMyAABQRUFLAAAAEAAAAAFPNqLKP4AAAAAAAApTU05EAAAAsAAAAAAAAAAAAAAAAD3MzM0+TMzNPpmZmj7MzM0/AAAAPxmZmj8zMzM/TMzNP2ZmZj+AAAA/ZmZmP0zMzT8zMzM/GZmaPwAAAD7MzM0+mZmaPkzMzT3MzM0AAAAAvczMzb5MzM2+mZmavszMzb8AAAC/GZmavzMzM79MzM2/ZmZmv4AAAL9mZma/TMzNvzMzM78ZmZq/AAAAvszMzb6ZmZq+TMzNvczMzQAAAAA9zMzN";

    flock.test.audio.triangleData = new Float32Array([
        0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
        0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1,
        0.0, -0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -1.0,
        -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1,
        0.0, 0.1
    ]);
})();
