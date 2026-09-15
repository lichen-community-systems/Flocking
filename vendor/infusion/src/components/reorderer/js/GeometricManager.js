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

    fluid.orientation = {
        HORIZONTAL: 4,
        VERTICAL: 1
    };

    fluid.rectSides = {
        // agree with fluid.orientation
        4: ["left", "right"],
        1: ["top", "bottom"],
        // agree with fluid.direction
        8: "top",
        12: "bottom",
        2: "left",
        3: "right"
    };

    /**
     * This is the position, relative to a given drop target, that a dragged item should be dropped.
     */
    fluid.position = {
        BEFORE: -1,
        AFTER: 1,
        INSIDE: 2,
        REPLACE: 3
    };

    /**
     * For incrementing/decrementing a count or index, or moving in a rectilinear direction.
     */
    fluid.direction = {
        NEXT: 1,
        PREVIOUS: -1,
        UP: 8,
        DOWN: 12,
        LEFT: 2,
        RIGHT: 3
    };

    fluid.directionSign = function (direction) {
        return direction === fluid.direction.UP || direction === fluid.direction.LEFT ?
            fluid.direction.PREVIOUS : fluid.direction.NEXT;
    };

    fluid.directionAxis = function (direction) {
        return direction === fluid.direction.LEFT || direction === fluid.direction.RIGHT ?
            0 : 1;
    };

    fluid.directionOrientation = function (direction) {
        return fluid.directionAxis(direction) ? fluid.orientation.VERTICAL : fluid.orientation.HORIZONTAL;
    };

    fluid.keycodeDirection = {
        up: fluid.direction.UP,
        down: fluid.direction.DOWN,
        left: fluid.direction.LEFT,
        right: fluid.direction.RIGHT
    };

    fluid.registerNamespace("fluid.dom");

    // moves a single node in the DOM to a new position relative to another
    // unsupported, NON-API function
    fluid.dom.moveDom = function (source, target, position) {
        source = fluid.unwrap(source);
        target = fluid.unwrap(target);

        var scan;
        // fluid.log("moveDom source " + fluid.dumpEl(source) + " target " + fluid.dumpEl(target) + " position " + position);
        if (position === fluid.position.INSIDE) {
            target.appendChild(source);
        } else if (position === fluid.position.BEFORE) {
            for (scan = target.previousSibling;; scan = scan.previousSibling) {
                if (!scan || !fluid.dom.isIgnorableNode(scan)) {
                    if (scan !== source) {
                        fluid.dom.cleanseScripts(source);
                        target.parentNode.insertBefore(source, target);
                    }
                    break;
                }
            }
        } else if (position === fluid.position.AFTER) {
            for (scan = target.nextSibling;; scan = scan.nextSibling) {
                if (!scan || !fluid.dom.isIgnorableNode(scan)) {
                    if (scan !== source) {
                        fluid.dom.cleanseScripts(source);
                        fluid.dom.insertAfter(source, target);
                    }
                    break;
                }
            }
        } else {
            fluid.fail("Unrecognised position supplied to fluid.moveDom: " + position);
        }
    };

    // unsupported, NON-API function
    fluid.dom.normalisePosition = function (position, samespan, targeti, sourcei) {
        // convert a REPLACE into a primitive BEFORE/AFTER
        if (position === fluid.position.REPLACE) {
            position = samespan && targeti >= sourcei ? fluid.position.AFTER : fluid.position.BEFORE;
        }
        return position;
    };

    fluid.dom.permuteDom = function (element, target, position, sourceelements, targetelements) {
        element = fluid.unwrap(element);
        target = fluid.unwrap(target);
        var sourcei = $.inArray(element, sourceelements);
        if (sourcei === -1) {
            fluid.fail("Error in permuteDom: source element " + fluid.dumpEl(element) +
                " not found in source list " + fluid.dumpEl(sourceelements));
        }
        var targeti = $.inArray(target, targetelements);
        if (targeti === -1) {
            fluid.fail("Error in permuteDom: target element " + fluid.dumpEl(target) +
                " not found in source list " + fluid.dumpEl(targetelements));
        }
        var samespan = sourceelements === targetelements;
        position = fluid.dom.normalisePosition(position, samespan, targeti, sourcei);

        //fluid.log("permuteDom sourcei " + sourcei + " targeti " + targeti);
        // cache the old neighbourhood of the element for the final move
        var oldn = {};
        oldn[fluid.position.AFTER] = element.nextSibling;
        oldn[fluid.position.BEFORE] = element.previousSibling;
        fluid.dom.moveDom(sourceelements[sourcei], targetelements[targeti], position);

        // perform the leftward-moving, AFTER shift
        var frontlimit = samespan ? targeti - 1 : sourceelements.length - 2;
        var i;
        if (position === fluid.position.BEFORE && samespan) {
            // we cannot do skip processing if the element was "fused against the grain"
            frontlimit--;
        }
        if (!samespan || targeti > sourcei) {
            for (i = frontlimit; i > sourcei; --i) {
                fluid.dom.moveDom(sourceelements[i + 1], sourceelements[i], fluid.position.AFTER);
            }
            if (sourcei + 1 < sourceelements.length) {
                fluid.dom.moveDom(sourceelements[sourcei + 1], oldn[fluid.position.AFTER], fluid.position.BEFORE);
            }
        }
        // perform the rightward-moving, BEFORE shift
        var backlimit = samespan ? sourcei - 1 : targetelements.length - 1;
        if (position === fluid.position.AFTER) {
            // we cannot do skip processing if the element was "fused against the grain"
            targeti++;
        }
        if (!samespan || targeti < sourcei) {
            for (i = targeti; i < backlimit; ++i) {
                fluid.dom.moveDom(targetelements[i], targetelements[i + 1], fluid.position.BEFORE);
            }
            if (backlimit >= 0 && backlimit < targetelements.length - 1) {
                fluid.dom.moveDom(targetelements[backlimit], oldn[fluid.position.BEFORE], fluid.position.AFTER);
            }
        }

    };

    var curCss = function (a, name) {
        return window.getComputedStyle ? window.getComputedStyle(a, null).getPropertyValue(name) :
            a.currentStyle[name];
    };

    fluid.dom.isAttached = function (node) {
        while (node && node.nodeName) {
            if (node.nodeName === "BODY") {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    };

    fluid.dom.generalHidden = function (a) {
        return "hidden" === a.type || curCss(a, "display") === "none" || curCss(a, "visibility") === "hidden" || !fluid.dom.isAttached(a);
    };

    fluid.registerNamespace("fluid.geometricManager");

    fluid.geometricManager.computeGeometry = function (element, orientation, disposition) {
        var elem = {};
        elem.element = element;
        elem.orientation = orientation;
        if (disposition === fluid.position.INSIDE) {
            elem.position = disposition;
        }
        if (fluid.dom.generalHidden(element)) {
            elem.clazz = "hidden";
        }
        var pos = fluid.dom.computeAbsolutePosition(element) || [0, 0];
        var width = element.offsetWidth;
        var height = element.offsetHeight;
        elem.rect = {left: pos[0], top: pos[1]};
        elem.rect.right = pos[0] + width;
        elem.rect.bottom = pos[1] + height;
        return elem;
    };

    // A "suitable large" value for the sentinel blocks at the ends of spans
    var SENTINEL_DIMENSION = 10000;

    fluid.geometricManager.dumprect = function (rect) {
        return "Rect top: " + rect.top +
                 " left: " + rect.left +
               " bottom: " + rect.bottom +
                " right: " + rect.right;
    };

    fluid.geometricManager.dumpelem = function (cacheelem) {
        if (!cacheelem || !cacheelem.rect) {
            return "null";
        } else {
            return fluid.geometricManager.dumprect(cacheelem.rect) + " position: " +
                cacheelem.position +
                " for " +
                fluid.dumpEl(cacheelem.element);
        }
    };


    // unsupported, NON-API function
    fluid.dropManager = function () {
        var targets = [];
        var cache = {};
        var that = {};

        var lastClosest;
        var lastGeometry;
        var displacementX, displacementY;

        that.updateGeometry = function (geometricInfo) {
            lastGeometry = geometricInfo;
            targets = [];
            cache = {};
            var mapper = geometricInfo.elementMapper;
            var geometryComputor = geometricInfo.geometryComputor || fluid.geometricManager.computeGeometry;

            var processElement = function (element, extent, sentB, sentF, disposition, index) {
                var orientation = extent.orientation;
                var sides = fluid.rectSides[orientation];
                var cacheelem = geometryComputor(element, orientation, disposition);
                cacheelem.owner = extent;
                if (cacheelem.clazz !== "hidden" && mapper) {
                    cacheelem.clazz = mapper(element);
                }
                cache[fluid.dropManager.cacheKey(element)] = cacheelem;
                var backClass = fluid.dropManager.getRelativeClass(extent.elements, index, fluid.position.BEFORE, cacheelem.clazz, mapper);
                var frontClass = fluid.dropManager.getRelativeClass(extent.elements, index, fluid.position.AFTER, cacheelem.clazz, mapper);
                if (disposition === fluid.position.INSIDE) {
                    targets[targets.length] = cacheelem;
                } else {
                    fluid.dropManager.splitElement(targets, sides, cacheelem, disposition, backClass, frontClass);
                }
                // deal with sentinel blocks by creating near-copies of the end elements
                if (sentB && geometricInfo.sentinelize) {
                    fluid.dropManager.sentinelizeElement(targets, sides, cacheelem, 1, disposition, backClass);
                }
                if (sentF && geometricInfo.sentinelize) {
                    fluid.dropManager.sentinelizeElement(targets, sides, cacheelem, 0, disposition, frontClass);
                }
                //fluid.log(dumpelem(cacheelem));
                return cacheelem;
            };

            for (var i = 0; i < geometricInfo.extents.length; ++i) {
                var thisInfo = geometricInfo.extents[i];
                var allHidden = true;
                for (var j = 0; j < thisInfo.elements.length; ++j) {
                    var element = thisInfo.elements[j];
                    var cacheelem = processElement(element, thisInfo, j === 0, j === thisInfo.elements.length - 1,
                        fluid.position.INTERLEAVED, j);
                    if (cacheelem.clazz !== "hidden") {
                        allHidden = false;
                    }
                }
                if (allHidden && thisInfo.parentElement) {
                    processElement(thisInfo.parentElement, thisInfo, true, true, fluid.position.INSIDE);
                }
            }
            fluid.dropManager.normalizeSentinels(targets);
        };

        that.startDrag = function (event, handlePos, handleWidth, handleHeight) {
            var handleMidX = handlePos[0] + handleWidth / 2;
            var handleMidY = handlePos[1] + handleHeight / 2;
            var dX = handleMidX - event.pageX;
            var dY = handleMidY - event.pageY;
            that.updateGeometry(lastGeometry);
            lastClosest = null;
            displacementX = dX;
            displacementY = dY;
            $("body").on("mousemove.fluid-dropManager", that.mouseMove);
        };

        that.lastPosition = function () {
            return lastClosest;
        };

        that.endDrag = function () {
            $("body").off("mousemove.fluid-dropManager");
        };

        that.mouseMove = function (evt) {
            var x = evt.pageX + displacementX;
            var y = evt.pageY + displacementY;
            //fluid.log("Mouse x " + x + " y " + y );

            var closestTarget = that.closestTarget(x, y, lastClosest);
            if (closestTarget && closestTarget !== fluid.dropManager.NO_CHANGE) {
                lastClosest = closestTarget;

                that.dropChangeFirer.fire(closestTarget);
            }
        };

        that.dropChangeFirer = fluid.makeEventFirer();

        var blankHolder = {
            element: null
        };

        that.closestTarget = function (x, y, lastClosest) {
            var mindistance = Number.MAX_VALUE;
            var minelem = blankHolder;
            var minlockeddistance = Number.MAX_VALUE;
            var minlockedelem = blankHolder;
            for (var i = 0; i < targets.length; ++i) {
                var cacheelem = targets[i];
                if (cacheelem.clazz === "hidden") {
                    continue;
                }
                var distance = fluid.geom.minPointRectangle(x, y, cacheelem.rect);
                if (cacheelem.clazz === "locked") {
                    if (distance < minlockeddistance) {
                        minlockeddistance = distance;
                        minlockedelem = cacheelem;
                    }
                } else {
                    if (distance < mindistance) {
                        mindistance = distance;
                        minelem = cacheelem;
                    }
                    if (distance === 0) {
                        break;
                    }
                }
            }
            if (!minelem) {
                return minelem;
            }
            if (minlockeddistance >= mindistance) {
                minlockedelem = blankHolder;
            }
            //fluid.log("PRE: mindistance " + mindistance + " element " +
            //   fluid.dumpEl(minelem.element) + " minlockeddistance " + minlockeddistance
            //    + " locked elem " + dumpelem(minlockedelem));
            if (lastClosest && lastClosest.position === minelem.position &&
                fluid.unwrap(lastClosest.element) === fluid.unwrap(minelem.element) &&
                fluid.unwrap(lastClosest.lockedelem) === fluid.unwrap(minlockedelem.element)
            ) {
                return fluid.dropManager.NO_CHANGE;
            }
            //fluid.log("mindistance " + mindistance + " minlockeddistance " + minlockeddistance);
            return {
                position: minelem.position,
                element: minelem.element,
                lockedelem: minlockedelem.element
            };
        };

        that.shuffleProjectFrom = function (element, direction, includeLocked, disableWrap) {
            var togo = that.projectFrom(element, direction, includeLocked, disableWrap);
            if (togo) {
                togo.position = fluid.position.REPLACE;
            }
            return togo;
        };

        that.projectFrom = function (element, direction, includeLocked, disableWrap) {
            that.updateGeometry(lastGeometry);
            var cacheelem = cache[fluid.dropManager.cacheKey(element)];
            var projected = fluid.geom.projectFrom(cacheelem.rect, direction, targets, includeLocked, disableWrap);
            if (!projected.cacheelem) {
                return null;
            }
            var retpos = projected.cacheelem.position;
            return {element: projected.cacheelem.element,
                position: retpos ? retpos : fluid.position.BEFORE
            };
        };

        that.logicalFrom = function (element, direction, includeLocked, disableWrap) {
            var orderables = that.getOwningSpan(element, fluid.position.INTERLEAVED, includeLocked);
            return {element: fluid.dropManager.getRelativeElement(element, direction, orderables, disableWrap),
                position: fluid.position.REPLACE};
        };

        that.lockedWrapFrom = function (element, direction, includeLocked, disableWrap) {
            var base = that.logicalFrom(element, direction, includeLocked, disableWrap);
            var selectables = that.getOwningSpan(element, fluid.position.INTERLEAVED, includeLocked);
            var allElements = cache[fluid.dropManager.cacheKey(element)].owner.elements;
            if (includeLocked || selectables[0] === allElements[0]) {
                return base;
            }
            var directElement = fluid.dropManager.getRelativeElement(element, direction, allElements, disableWrap);
            if (lastGeometry.elementMapper(directElement) === "locked") {
                base.element = null;
                base.clazz = "locked";
            }
            return base;
        };

        that.getOwningSpan = function (element, position, includeLocked) {
            var owner = cache[fluid.dropManager.cacheKey(element)].owner;
            var elements = position === fluid.position.INSIDE ? [owner.parentElement] : owner.elements;
            if (!includeLocked && lastGeometry.elementMapper) {
                elements = fluid.makeArray(elements);
                fluid.remove_if(elements, function (element) {
                    return lastGeometry.elementMapper(element) === "locked";
                });
            }
            return elements;
        };

        that.geometricMove = function (element, target, position) {
            var sourceElements = that.getOwningSpan(element, null, true);
            var targetElements = that.getOwningSpan(target, position, true);
            fluid.dom.permuteDom(element, target, position, sourceElements, targetElements);
        };

        return that;
    };


    fluid.dropManager.NO_CHANGE = "no change";

    fluid.dropManager.cacheKey = function (element) {
        return fluid.allocateSimpleId(element);
    };

    fluid.dropManager.sentinelizeElement = function (targets, sides, cacheelem, fc, disposition, clazz) {
        var elemCopy = $.extend(true, {}, cacheelem);
        elemCopy.origRect = fluid.copy(elemCopy.rect);
        elemCopy.rect[sides[fc]] = elemCopy.rect[sides[1 - fc]] + (fc ? 1 : -1);
        elemCopy.rect[sides[1 - fc]] = (fc ? -1 : 1) * SENTINEL_DIMENSION;
        elemCopy.position = disposition === fluid.position.INSIDE ?
            disposition : (fc ? fluid.position.BEFORE : fluid.position.AFTER);
        elemCopy.clazz = clazz;
        targets[targets.length] = elemCopy;
    };

    // This function is necessary to prevent overlapping sentinels for FLUID-4692
    // Very sadly this simple implementation now makes the setup O(n^2) in the number of elements

    fluid.dropManager.normalizeSentinels = function (targets) {
        for (var i = 0; i < targets.length; ++i) {
            for (var j = 0; j < targets.length; ++j) {
                var ti = targets[i], tj = targets[j];
                var jrect = tj.origRect || tj.rect;
                if (ti.element !== tj.element && ti.origRect && fluid.geom.minRectRect(ti.rect, jrect) === 0) {
                    ti.rect = ti.origRect;
                    delete ti.origRect;
                }
            }
        }
    };

    fluid.dropManager.splitElement = function (targets, sides, cacheelem, disposition, clazz1, clazz2) {
        var elem1 = $.extend(true, {}, cacheelem);
        var elem2 = $.extend(true, {}, cacheelem);
        var midpoint = (elem1.rect[sides[0]] + elem1.rect[sides[1]]) / 2;
        elem1.rect[sides[1]] = midpoint;
        elem1.position = fluid.position.BEFORE;

        elem2.rect[sides[0]] = midpoint;
        elem2.position = fluid.position.AFTER;

        elem1.clazz = clazz1;
        elem2.clazz = clazz2;
        targets[targets.length] = elem1;
        targets[targets.length] = elem2;
    };

    // Expand this configuration point if we ever go back to a full "permissions" model
    fluid.dropManager.getRelativeClass = function (thisElements, index, relative, thisclazz, mapper) {
        index += relative;
        if (index < 0 && thisclazz === "locked") {
            return "locked";
        }
        if (index >= thisElements.length || mapper === null) {
            return null;
        } else {
            relative = thisElements[index];
            return mapper(relative) === "locked" && thisclazz === "locked" ? "locked" : null;
        }
    };

    fluid.dropManager.getRelativeElement = function (element, direction, elements, disableWrap) {
        var folded = fluid.directionSign(direction);

        var index = $(elements).index(element) + folded;
        if (index < 0) {
            index += elements.length;
        }

        // disable wrap
        if (disableWrap) {
            if (index === elements.length || index === (elements.length + folded)) {
                return element;
            }
        }

        index %= elements.length;
        return elements[index];
    };

    fluid.geom = fluid.geom || {};

    // These distance algorithms have been taken from
    // http://www.cs.mcgill.ca/~cs644/Godfried/2005/Fall/fzamal/concepts.htm

    /* Returns the minimum squared distance between a point and a rectangle */
    fluid.geom.minPointRectangle = function (x, y, rectangle) {
        var dx = x < rectangle.left ? (rectangle.left - x) :
            (x > rectangle.right ? (x - rectangle.right) : 0);
        var dy = y < rectangle.top ? (rectangle.top - y) :
            (y > rectangle.bottom ? (y - rectangle.bottom) : 0);
        return dx * dx + dy * dy;
    };

    /* Returns the minimum squared distance between two rectangles */
    fluid.geom.minRectRect = function (rect1, rect2) {
        var dx = rect1.right < rect2.left ? rect2.left - rect1.right :
            rect2.right < rect1.left ? rect1.left - rect2.right : 0;
        var dy = rect1.bottom < rect2.top ? rect2.top - rect1.bottom :
            rect2.bottom < rect1.top ? rect1.top - rect2.bottom : 0;
        return dx * dx + dy * dy;
    };

    var makePenCollect = function () {
        return {
            mindist: Number.MAX_VALUE,
            minrdist: Number.MAX_VALUE
        };
    };

    /**
     * Determine the one amongst a set of rectangle targets which is the "best fit"
     * for an axial motion from a "base rectangle" (commonly arising from the case
     * of cursor key navigation).
     *
     * @param {Rectangle} baserect - The base rectangle from which the motion is to be referred.
     * @param {Object} direction - The direction of motion, which should be an instance of fluid.direction.
     * @param {Array} targets - An array of objects "cache elements" for which the member <code>rect</code> is the
     * holder of the rectangle to be tested.
     * @param {Boolean} forSelection - Set to `true` to indicate that we are dealing with a selection.
     * @param {Boolean} disableWrap - Set to `true` to disable wrapping of elements.
     * @return {Object} - The cache element which is the most appropriate for the requested motion.
     */
    fluid.geom.projectFrom = function (baserect, direction, targets, forSelection, disableWrap) {
        var axis = fluid.directionAxis(direction);
        var frontSide = fluid.rectSides[direction];
        var backSide = fluid.rectSides[axis * 15 + 5 - direction];
        var dirSign = fluid.directionSign(direction);

        var penrect = {
            left: (7 * baserect.left + 1 * baserect.right) / 8,
            right: (5 * baserect.left + 3 * baserect.right) / 8,
            top: (7 * baserect.top + 1 * baserect.bottom) / 8,
            bottom: (5 * baserect.top + 3 * baserect.bottom) / 8
        };

        penrect[frontSide] = dirSign * SENTINEL_DIMENSION;
        penrect[backSide] = -penrect[frontSide];

        function accPen(collect, cacheelem, backSign) {
            var thisrect = cacheelem.rect;
            var pdist = fluid.geom.minRectRect(penrect, thisrect);
            var rdist = -dirSign * backSign * (baserect[backSign === 1 ? frontSide : backSide] -
                                                thisrect[backSign === 1 ? backSide : frontSide]);
            // fluid.log("pdist: " + pdist + " rdist: " + rdist);
            // the oddity in the rdist comparison is intended to express "half-open"-ness of rectangles
            // (backSign === 1 ? 0 : 1) - this is now gone - must be possible to move to perpendicularly abutting regions
            if (pdist <= collect.mindist && rdist >= 0) {
                if (pdist === collect.mindist && rdist * backSign > collect.minrdist) {
                    return;
                }
                collect.minrdist = rdist * backSign;
                collect.mindist = pdist;
                collect.minelem = cacheelem;
            }
        }

        var collect = makePenCollect();
        var backcollect = makePenCollect();
        var lockedcollect = makePenCollect();

        for (var i = 0; i < targets.length; ++i) {
            var elem = targets[i];
            var isPure = elem.owner && elem.element === elem.owner.parentElement;
            if (elem.clazz === "hidden" || (forSelection && isPure)) {
                continue;
            } else if (!forSelection && elem.clazz === "locked") {
                accPen(lockedcollect, elem, 1);
            } else {
                accPen(collect, elem, 1);
                accPen(backcollect, elem, -1);
            }
            //fluid.log("Element " + i + " " + dumpelem(elem) + " mindist " + collect.mindist);
        }
        var wrap = !collect.minelem || backcollect.mindist < collect.mindist;

        // disable wrap
        wrap = wrap && !disableWrap;

        var mincollect = wrap ? backcollect : collect;

        var togo = {
            wrapped: wrap,
            cacheelem: mincollect.minelem
        };
        if (lockedcollect.mindist < mincollect.mindist) {
            togo.lockedelem = lockedcollect.minelem;
        }
        return togo;
    };
})(jQuery, fluid_3_0_0);
