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



    function debugPosition(component) {
        return "as child of " + (component.parent.fullID ? "component with full ID " + component.parent.fullID : "root");
    }

    function computeFullID(component) {
        var togo = "";
        var move = component;
        if (component.children === undefined) { // not a container
            // unusual case on the client-side, since a repetitive leaf may have localID blasted onto it.
            togo = component.ID + (component.localID !== undefined ? component.localID : "");
            move = component.parent;
        }

        while (move.parent) {
            var parent = move.parent;
            if (move.fullID !== undefined) {
                togo = move.fullID + togo;
                return togo;
            }
            if (move.noID === undefined) {
                var ID = move.ID;
                if (ID === undefined) {
                    fluid.fail("Error in component tree - component found with no ID " +
                        debugPosition(parent) + ": please check structure");
                }
                var colpos = ID.indexOf(":");
                var prefix = colpos === -1 ? ID : ID.substring(0, colpos);
                togo = prefix + ":" + (move.localID === undefined ? "" : move.localID) + ":" + togo;
            }
            move = parent;
        }

        return togo;
    }

    var renderer = {};

    renderer.isBoundPrimitive = function (value) {
        return fluid.isPrimitive(value) || fluid.isArrayable(value) &&
            (value.length === 0 || typeof(value[0]) === "string");
    };

    var unzipComponent;

    function processChild(value, key) {
        if (renderer.isBoundPrimitive(value)) {
            return {componentType: "UIBound", value: value, ID: key};
        }
        else {
            var unzip = unzipComponent(value);
            if (unzip.ID) {
                return {ID: key, componentType: "UIContainer", children: [unzip]};
            } else {
                unzip.ID = key;
                return unzip;
            }
        }
    }

    function fixChildren(children) {
        if (!fluid.isArrayable(children)) {
            var togo = [];
            for (var key in children) {
                var value = children[key];
                if (fluid.isArrayable(value)) {
                    for (var i = 0; i < value.length; ++i) {
                        var processed = processChild(value[i], key);
                        // if (processed.componentType === "UIContainer" &&
                        //     processed.localID === undefined) {
                        //     processed.localID = i;
                        // }
                        togo[togo.length] = processed;
                    }
                } else {
                    togo[togo.length] = processChild(value, key);
                }
            }
            return togo;
        } else {return children; }
    }

    function fixupValue(uibound, model, resolverGetConfig) {
        if (uibound.value === undefined && uibound.valuebinding !== undefined) {
            uibound.value = fluid.get(model, uibound.valuebinding, resolverGetConfig);
        }
    }

    function upgradeBound(holder, property, model, resolverGetConfig) {
        if (holder[property] !== undefined) {
            if (renderer.isBoundPrimitive(holder[property])) {
                holder[property] = {value: holder[property]};
            }
            else if (holder[property].messagekey) {
                holder[property].componentType = "UIMessage";
            }
        }
        else {
            holder[property] = {value: null};
        }
        fixupValue(holder[property], model, resolverGetConfig);
    }

    renderer.duckMap = {
        children: "UIContainer",
        value: "UIBound", valuebinding: "UIBound", messagekey: "UIMessage",
        markup: "UIVerbatim", selection: "UISelect", target: "UILink",
        choiceindex: "UISelectChoice", functionname: "UIInitBlock"
    };

    var boundMap = {
        UISelect: ["selection", "optionlist", "optionnames"],
        UILink: ["target", "linktext"],
        UIVerbatim: ["markup"],
        UIMessage: ["messagekey"]
    };

    renderer.boundMap = fluid.transform(boundMap, fluid.arrayToHash);

    renderer.inferComponentType = function (component) {
        for (var key in renderer.duckMap) {
            if (component[key] !== undefined) {
                return renderer.duckMap[key];
            }
        }
    };

    renderer.applyComponentType = function (component) {
        component.componentType = renderer.inferComponentType(component);
        if (component.componentType === undefined && component.ID !== undefined) {
            component.componentType = "UIBound";
        }
    };

    unzipComponent = function (component, model, resolverGetConfig) {
        if (component) {
            renderer.applyComponentType(component);
        }
        if (!component || component.componentType === undefined) {
            var decorators = component.decorators;
            if (decorators) {delete component.decorators;}
            component = {componentType: "UIContainer", children: component};
            component.decorators = decorators;
        }
        var cType = component.componentType;
        if (cType === "UIContainer") {
            component.children = fixChildren(component.children);
        }
        else {
            var map = renderer.boundMap[cType];
            if (map) {
                fluid.each(map, function (value, key) {
                    upgradeBound(component, key, model, resolverGetConfig);
                });
            }
        }

        return component;
    };

    function fixupTree(tree, model, resolverGetConfig) {
        if (tree.componentType === undefined) {
            tree = unzipComponent(tree, model, resolverGetConfig);
        }
        if (tree.componentType !== "UIContainer" && !tree.parent) {
            tree = {children: [tree]};
        }

        if (tree.children) {
            tree.childmap = {};
            for (var i = 0; i < tree.children.length; ++i) {
                var child = tree.children[i];
                if (child.componentType === undefined) {
                    child = unzipComponent(child, model, resolverGetConfig);
                    tree.children[i] = child;
                }
                child.parent = tree;
                if (child.ID === undefined) {
                    fluid.fail("Error in component tree: component found with no ID " + debugPosition(child));
                }
                tree.childmap[child.ID] = child;
                var colpos = child.ID.indexOf(":");
                if (colpos === -1) {
                //  tree.childmap[child.ID] = child; // moved out of branch to allow
                // "relative id expressions" to be easily parsed
                }
                else {
                    var prefix = child.ID.substring(0, colpos);
                    var childlist = tree.childmap[prefix];
                    if (!childlist) {
                        childlist = [];
                        tree.childmap[prefix] = childlist;
                    }
                    if (child.localID === undefined && childlist.length !== 0) {
                        child.localID = childlist.length;
                    }
                    childlist[childlist.length] = child;
                }
                child.fullID = computeFullID(child);

                var componentType = child.componentType;
                if (componentType === "UISelect") {
                    child.selection.fullID = child.fullID;
                }
                else if (componentType === "UIInitBlock") {
                    var call = child.functionname + "(";
                    var childArgs = child.arguments;
                    for (var j = 0; j < childArgs.length; ++j) {
                        if (childArgs[j] instanceof fluid.ComponentReference) {
                            // TODO: support more forms of id reference
                            childArgs[j] = child.parent.fullID + childArgs[j].reference;
                        }
                        call += JSON.stringify(childArgs[j]);
                        if (j < childArgs.length - 1) {
                            call += ", ";
                        }
                    }
                    child.markup = {value: call + ")\n"};
                    child.componentType = "UIVerbatim";
                }
                else if (componentType === "UIBound") {
                    fixupValue(child, model, resolverGetConfig);
                }
                fixupTree(child, model, resolverGetConfig);
            }
        }
        return tree;
    }

    fluid.NULL_STRING = "\u25a9null\u25a9";

    var LINK_ATTRIBUTES = {
        a: "href",
        link: "href",
        img: "src",
        frame: "src",
        script: "src",
        style: "src",
        input: "src",
        embed: "src",
        form: "action",
        applet: "codebase",
        object: "codebase"
    };

    renderer.decoratorComponentPrefix = "**-renderer-";

    renderer.IDtoComponentName = function (ID, num) {
        return renderer.decoratorComponentPrefix + ID.replace(/\./g, "") + "-" + num;
    };

    renderer.invokeFluidDecorator = function (func, args, ID, num, options) {
        var that;
        if (options.parentComponent) {
            var parent = options.parentComponent;
            var name = renderer.IDtoComponentName(ID, num);
            fluid.set(parent, ["options", "components", name], {
                type: func,
                container: args[0],
                options: args[1]
            });
            that = fluid.initDependent(options.parentComponent, name);
        }
        else {
            that = fluid.invokeGlobalFunction(func, args);
        }
        return that;
    };

    fluid.renderer = function (templates, tree, options, fossilsIn) {

        options = options || {};
        tree = tree || {};
        var debugMode = options.debugMode;
        if (!options.messageLocator && options.messageSource) {
            options.messageLocator = fluid.resolveMessageSource(options.messageSource);
        }
        options.document = options.document || document;
        options.jQuery = options.jQuery || $;
        options.fossils = options.fossils || fossilsIn || {}; // map of submittingname to {EL, submittingname, oldvalue}

        var globalmap = {};
        var branchmap = {};
        var rewritemap = {}; // map of rewritekey (for original id in template) to full ID
        var seenset = {};
        var collected = {};
        var out = "";
        var renderOptions = options;
        var decoratorQueue = [];

        var renderedbindings = {}; // map of fullID to true for UISelects which have already had bindings written
        var usedIDs = {};

        var that = {options: options};

        function getRewriteKey(template, parent, id) {
            return template.resourceKey + parent.fullID + id;
        }
        // returns: lump
        function resolveInScope(searchID, defprefix, scope) {
            var deflump;
            var scopelook = scope ? scope[searchID] : null;
            if (scopelook) {
                for (var i = 0; i < scopelook.length; ++i) {
                    var scopelump = scopelook[i];
                    if (!deflump && scopelump.rsfID === defprefix) {
                        deflump = scopelump;
                    }
                    if (scopelump.rsfID === searchID) {
                        return scopelump;
                    }
                }
            }
            return deflump;
        }
        // returns: lump
        function resolveCall(sourcescope, child) {
            var searchID = child.jointID ? child.jointID : child.ID;
            var split = fluid.SplitID(searchID);
            var defprefix = split.prefix + ":";
            var match = resolveInScope(searchID, defprefix, sourcescope.downmap, child);
            if (match) {return match;}
            if (child.children) {
                match = resolveInScope(searchID, defprefix, globalmap, child);
                if (match) {return match;}
            }
            return null;
        }

        function noteCollected(template) {
            if (!seenset[template.href]) {
                fluid.aggregateMMap(collected, template.collectmap);
                seenset[template.href] = true;
            }
        }

        var fetchComponent;

        function resolveRecurse(basecontainer, parentlump) {
            var i;
            var id;
            var resolved;
            for (i = 0; i < basecontainer.children.length; ++i) {
                var branch = basecontainer.children[i];
                if (branch.children) { // it is a branch
                    resolved = resolveCall(parentlump, branch);
                    if (resolved) {
                        branchmap[branch.fullID] = resolved;
                        id = resolved.attributemap.id;
                        if (id !== undefined) {
                            rewritemap[getRewriteKey(parentlump.parent, basecontainer, id)] = branch.fullID;
                        }
                        // on server-side this is done separately
                        noteCollected(resolved.parent);
                        resolveRecurse(branch, resolved);
                    }
                }
            }
            // collect any rewritten ids for the purpose of later rewriting
            if (parentlump.downmap) {
                for (id in parentlump.downmap) {
                    //if (id.indexOf(":") === -1) {
                    var lumps = parentlump.downmap[id];
                    for (i = 0; i < lumps.length; ++i) {
                        var lump = lumps[i];
                        var lumpid = lump.attributemap.id;
                        if (lumpid !== undefined && lump.rsfID !== undefined) {
                            resolved = fetchComponent(basecontainer, lump.rsfID);
                            if (resolved !== null) {
                                var resolveID = resolved.fullID;
                                rewritemap[getRewriteKey(parentlump.parent, basecontainer,
                                    lumpid)] = resolveID;
                            }
                        }
                    }
                //  }
                }
            }

        }

        function resolveBranches(globalmapp, basecontainer, parentlump) {
            branchmap = {};
            rewritemap = {};
            seenset = {};
            collected = {};
            globalmap = globalmapp;
            branchmap[basecontainer.fullID] = parentlump;
            resolveRecurse(basecontainer, parentlump);
        }

        function dumpTillLump(lumps, start, limit) {
            for (; start < limit; ++start) {
                var text = lumps[start].text;
                if (text) { // guard against "undefined" lumps from "justended"
                    out += lumps[start].text;
                }
            }
        }

        function dumpScan(lumps, renderindex, basedepth, closeparent, insideleaf) {
            var start = renderindex;
            while (true) {
                if (renderindex === lumps.length) {
                    break;
                }
                var lump = lumps[renderindex];
                if (lump.nestingdepth < basedepth) {
                    break;
                }
                if (lump.rsfID !== undefined) {
                    if (!insideleaf) {break;}
                    if (insideleaf && lump.nestingdepth > basedepth + (closeparent ? 0 : 1)) {
                        fluid.log("Error in component tree - leaf component found to contain further components - at " +
                            lump.toString());
                    }
                    else {break;}
                }
                // target.print(lump.text);
                ++renderindex;
            }
            // ASSUMPTIONS: close tags are ONE LUMP
            if (!closeparent && (renderindex === lumps.length || !lumps[renderindex].rsfID)) {
                --renderindex;
            }

            dumpTillLump(lumps, start, renderindex);
            //target.write(buffer, start, limit - start);
            return renderindex;
        }


        function isPlaceholder() {
            // TODO: equivalent of server-side "placeholder" system
            return false;
        }

        function isValue(value) {
            return value !== null && value !== undefined && !isPlaceholder(value);
        }

        // In RSF Client, this is a "flyweight" "global" object that is reused for every tag,
        // to avoid generating garbage. In RSF Server, it is an argument to the following rendering
        // methods of type "TagRenderContext".

        var trc = {};

        /*** TRC METHODS ***/

        function openTag() {
            if (!trc.iselide) {
                out += "<" + trc.uselump.tagname;
            }
        }

        function closeTag() {
            if (!trc.iselide) {
                out += "</" + trc.uselump.tagname + ">";
            }
        }

        function renderUnchanged() {
            // TODO needs work since we don't keep attributes in text
            dumpTillLump(trc.uselump.parent.lumps, trc.uselump.lumpindex + 1,
                trc.close.lumpindex + (trc.iselide ? 0 : 1));
        }

        function isSelfClose() {
            return trc.endopen.lumpindex === trc.close.lumpindex && fluid.XMLP.closedTags[trc.uselump.tagname];
        }

        function dumpTemplateBody() {
            if (isSelfClose()) {
                if (!trc.iselide) {
                    out += "/>";
                }
            }
            else {
                if (!trc.iselide) {
                    out += ">";
                }
                dumpTillLump(trc.uselump.parent.lumps, trc.endopen.lumpindex,
                    trc.close.lumpindex + (trc.iselide ? 0 : 1));
            }
        }

        function replaceAttributes() {
            if (!trc.iselide) {
                out += fluid.dumpAttributes(trc.attrcopy);
            }
            dumpTemplateBody();
        }

        function replaceAttributesOpen() {
            if (trc.iselide) {
                replaceAttributes();
            }
            else {
                out += fluid.dumpAttributes(trc.attrcopy);
                var selfClose = isSelfClose();
                // TODO: the parser does not ever produce empty tags
                out += selfClose ? "/>" : ">";

                trc.nextpos = selfClose ? trc.close.lumpindex + 1 : trc.endopen.lumpindex;
            }
        }

        function replaceBody(value) {
            out += fluid.dumpAttributes(trc.attrcopy);
            if (!trc.iselide) {
                out += ">";
            }
            out += fluid.XMLEncode(value.toString());
            closeTag();
        }

        function rewriteLeaf(value) {
            if (isValue(value)) {
                replaceBody(value);
            }
            else {
                replaceAttributes();
            }
        }

        function rewriteLeafOpen(value) {
            if (trc.iselide) {
                rewriteLeaf(trc.value);
            }
            else {
                if (isValue(value)) {
                    replaceBody(value);
                }
                else {
                    replaceAttributesOpen();
                }
            }
        }


        /*** END TRC METHODS**/

        function rewriteUrl(template, url) {
            if (renderOptions.urlRewriter) {
                var rewritten = renderOptions.urlRewriter(url);
                if (rewritten) {
                    return rewritten;
                }
            }
            if (!renderOptions.rebaseURLs) {
                return url;
            }
            var protpos = url.indexOf(":/");
            if (url.charAt(0) === "/" || protpos !== -1 && protpos < 7) {
                return url;
            }
            else {
                return renderOptions.baseURL + url;
            }
        }

        function dumpHiddenField(/** UIParameter **/ todump) {
            out += "<input type=\"hidden\" ";
            var isvirtual = todump.virtual;
            var outattrs = {};
            outattrs[isvirtual ? "id" : "name"] = todump.name;
            outattrs.value = todump.value;
            out += fluid.dumpAttributes(outattrs);
            out += " />\n";
        }

        var outDecoratorsImpl;

        function applyAutoBind(torender, finalID) {
            if (!finalID) {
                // if no id is assigned so far, this is a signal that this is a "virtual" component such as
                // a non-HTML UISelect which will not have physical markup.
                return;
            }
            var tagname = trc.uselump.tagname;
            var applier = renderOptions.applier;
            function applyFunc() {
                fluid.applyBoundChange(fluid.byId(finalID, renderOptions.document), undefined, applier);
            }
            if (renderOptions.autoBind && /input|select|textarea/.test(tagname) && !renderedbindings[finalID]) {
                var decorators = [{jQuery: ["on", "change", applyFunc]}];
                // Work around bug 193: http://webbugtrack.blogspot.com/2007/11/bug-193-onchange-does-not-fire-properly.html
                if ($.browser.msie && tagname === "input" && /radio|checkbox/.test(trc.attrcopy.type)) {
                    decorators.push({jQuery: ["on", "click", applyFunc]});
                }
                if ($.browser.safari && tagname === "input" && trc.attrcopy.type === "radio") {
                    decorators.push({jQuery: ["on", "keyup", applyFunc]});
                }
                outDecoratorsImpl(torender, decorators, trc.attrcopy, finalID);
            }
        }

        function dumpBoundFields(/** UIBound**/ torender, parent) {
            if (torender) {
                var holder = parent ? parent : torender;
                if (renderOptions.fossils && holder.valuebinding !== undefined) {
                    var fossilKey = holder.submittingname || torender.finalID;
                    // TODO: this will store multiple times for each member of a UISelect
                    renderOptions.fossils[fossilKey] = {
                        name: fossilKey,
                        EL: holder.valuebinding,
                        oldvalue: holder.value
                    };
                    // But this has to happen multiple times
                    applyAutoBind(torender, torender.finalID);
                }
                if (torender.fossilizedbinding) {
                    dumpHiddenField(torender.fossilizedbinding);
                }
                if (torender.fossilizedshaper) {
                    dumpHiddenField(torender.fossilizedshaper);
                }
            }
        }

        function dumpSelectionBindings(uiselect) {
            if (!renderedbindings[uiselect.selection.fullID]) {
                renderedbindings[uiselect.selection.fullID] = true; // set this true early so that selection does not autobind twice
                dumpBoundFields(uiselect.selection);
                dumpBoundFields(uiselect.optionlist);
                dumpBoundFields(uiselect.optionnames);
            }
        }

        function isSelectedValue(torender, value) {
            var selection = torender.selection;
            return fluid.isArrayable(selection.value) ? selection.value.indexOf(value) !== -1 : selection.value === value;
        }

        function getRelativeComponent(component, relativeID) {
            component = component.parent;
            while (relativeID.indexOf("..::") === 0) {
                relativeID = relativeID.substring(4);
                component = component.parent;
            }
            return component.childmap[relativeID];
        }

        // TODO: This mechanism inefficiently handles the rare case of a target document
        // id collision requiring a rewrite for FLUID-5048. In case it needs improving, we
        // could hold an inverted index - however, these cases will become even rarer with FLUID-5047
        function rewriteRewriteMap(from, to) {
            fluid.each(rewritemap, function (value, key) {
                if (value === from) {
                    rewritemap[key] = to;
                }
            });
        }

        function adjustForID(attrcopy, component, late, forceID) {
            if (!late) {
                delete attrcopy["rsf:id"];
            }
            if (component.finalID !== undefined) {
                attrcopy.id = component.finalID;
            }
            else if (forceID !== undefined) {
                attrcopy.id = forceID;
            }
            else {
                if (attrcopy.id || late) {
                    attrcopy.id = component.fullID;
                }
            }

            var count = 1;
            var baseid = attrcopy.id;
            while (renderOptions.document.getElementById(attrcopy.id) || usedIDs[attrcopy.id]) {
                attrcopy.id = baseid + "-" + (count++);
            }
            if (count !== 1) {
                rewriteRewriteMap(baseid, attrcopy.id);
            }
            component.finalID = attrcopy.id;
            return attrcopy.id;
        }

        function assignSubmittingName(attrcopy, component, parent) {
            var submitting = parent || component;
            // if a submittingName is required, we must already go out to the document to
            // uniquify the id that it will be derived from
            adjustForID(attrcopy, component, true, component.fullID);
            if (submitting.submittingname === undefined && submitting.willinput !== false) {
                submitting.submittingname = submitting.finalID || submitting.fullID;
            }
            return submitting.submittingname;
        }

        function explodeDecorators(decorators) {
            var togo = [];
            if (decorators.type) {
                togo[0] = decorators;
            }
            else {
                for (var key in decorators) {
                    if (key === "$") {key = "jQuery";}
                    var value = decorators[key];
                    var decorator = {
                        type: key
                    };
                    if (key === "jQuery") {
                        decorator.func = value[0];
                        decorator.args = value.slice(1);
                    }
                    else if (key === "addClass" || key === "removeClass") {
                        decorator.classes = value;
                    }
                    else if (key === "attrs") {
                        decorator.attributes = value;
                    }
                    else if (key === "identify") {
                        decorator.key = value;
                    }
                    togo[togo.length] = decorator;
                }
            }
            return togo;
        }

        outDecoratorsImpl = function (torender, decorators, attrcopy, finalID) {
            var id;
            var sanitizeAttrs = function (value, key) {
                if (value === null || value === undefined) {
                    delete attrcopy[key];
                }
                else {
                    attrcopy[key] = fluid.XMLEncode(value);
                }
            };
            renderOptions.idMap = renderOptions.idMap || {};
            for (var i = 0; i < decorators.length; ++i) {
                var decorator = decorators[i];
                var type = decorator.type;
                if (!type) {
                    var explodedDecorators = explodeDecorators(decorator);
                    outDecoratorsImpl(torender, explodedDecorators, attrcopy, finalID);
                    continue;
                }
                if (type === "$") {type = decorator.type = "jQuery";}
                if (type === "jQuery" || type === "event" || type === "fluid") {
                    id = adjustForID(attrcopy, torender, true, finalID);
                    if (decorator.ids === undefined) {
                        decorator.ids = [];
                        decoratorQueue[decoratorQueue.length] = decorator;
                    }
                    decorator.ids.push(id);
                }
                // honour these remaining types immediately
                else if (type === "attrs") {
                    fluid.each(decorator.attributes, sanitizeAttrs);
                }
                else if (type === "addClass" || type === "removeClass") {
                    // Using an unattached DOM node because jQuery will use the
                    // node's setAttribute method to add the class.
                    var fakeNode = $("<div>", {class: attrcopy["class"]})[0];
                    renderOptions.jQuery(fakeNode)[type](decorator.classes);
                    attrcopy["class"] = fakeNode.className;
                }
                else if (type === "identify") {
                    id = adjustForID(attrcopy, torender, true, finalID);
                    renderOptions.idMap[decorator.key] = id;
                }
                else if (type !== "null") {
                    fluid.log("Unrecognised decorator of type " + type + " found at component of ID " + finalID);
                }
            }
        };

        function outDecorators(torender, attrcopy) {
            if (!torender.decorators) {return;}
            if (torender.decorators.length === undefined) {
                torender.decorators = explodeDecorators(torender.decorators);
            }
            outDecoratorsImpl(torender, torender.decorators, attrcopy);
        }

        function dumpBranchHead(branch, targetlump) {
            if (targetlump.elide) {
                return;
            }
            var attrcopy = {};
            $.extend(true, attrcopy, targetlump.attributemap);
            adjustForID(attrcopy, branch);
            outDecorators(branch, attrcopy);
            out += "<" + targetlump.tagname + " ";
            out += fluid.dumpAttributes(attrcopy);
            out += ">";
        }

        function resolveArgs(args) {
            if (!args) {return args;}
            args = fluid.copy(args); // FLUID-4737: Avoid corrupting material which may have been fetched from the model
            return fluid.transform(args, function (arg, index) {
                upgradeBound(args, index, renderOptions.model, renderOptions.resolverGetConfig);
                return args[index].value;
            });
        }

        function degradeMessage(torender) {
            if (torender.componentType === "UIMessage") {
                // degrade UIMessage to UIBound by resolving the message
                torender.componentType = "UIBound";
                if (!renderOptions.messageLocator) {
                    torender.value = "[No messageLocator is configured in options - please consult documentation on options.messageSource]";
                }
                else {
                    upgradeBound(torender, "messagekey", renderOptions.model, renderOptions.resolverGetConfig);
                    var resArgs = resolveArgs(torender.args);
                    torender.value = renderOptions.messageLocator(torender.messagekey.value, resArgs);
                }
            }
        }


        function renderComponent(torender) {
            var value;
            var attrcopy = trc.attrcopy;

            degradeMessage(torender);
            var componentType = torender.componentType;
            var tagname = trc.uselump.tagname;

            outDecorators(torender, attrcopy);

            function makeFail(torender, end) {
                fluid.fail("Error in component tree - UISelectChoice with id " + torender.fullID + end);
            }

            if (componentType === "UIBound" || componentType === "UISelectChoice") {
                var parent;
                if (torender.choiceindex !== undefined) {
                    if (torender.parentRelativeID !== undefined) {
                        parent = getRelativeComponent(torender, torender.parentRelativeID);
                        if (!parent) {
                            makeFail(torender, " has parentRelativeID of " + torender.parentRelativeID + " which cannot be resolved");
                        }
                    }
                    else {
                        makeFail(torender, " does not have parentRelativeID set");
                    }
                    assignSubmittingName(attrcopy, torender, parent.selection);
                    dumpSelectionBindings(parent);
                }

                var submittingname = parent ? parent.selection.submittingname : torender.submittingname;
                if (!parent && torender.valuebinding) {
                    // Do this for all bound fields even if non submitting so that finalID is set in order to track fossils (FLUID-3387)
                    submittingname = assignSubmittingName(attrcopy, torender);
                }
                if (tagname === "input" || tagname === "textarea") {
                    if (submittingname !== undefined) {
                        attrcopy.name = submittingname;
                    }
                }
                // this needs to happen early on the client, since it may cause the allocation of the
                // id in the case of a "deferred decorator". However, for server-side bindings, this
                // will be an inappropriate time, unless we shift the timing of emitting the opening tag.
                dumpBoundFields(torender, parent ? parent.selection : null);

                if (typeof(torender.value) === "boolean" || attrcopy.type === "radio" || attrcopy.type === "checkbox") {
                    var underlyingValue;
                    var directValue = torender.value;

                    if (torender.choiceindex !== undefined) {
                        if (!parent.optionlist.value) {
                            fluid.fail("Error in component tree - selection control with full ID " + parent.fullID + " has no values");
                        }
                        underlyingValue = parent.optionlist.value[torender.choiceindex];
                        directValue = isSelectedValue(parent, underlyingValue);
                    }
                    if (isValue(directValue)) {
                        if (directValue) {
                            attrcopy.checked = "checked";
                        }
                        else {
                            delete attrcopy.checked;
                        }
                    }
                    attrcopy.value = fluid.XMLEncode(underlyingValue ? underlyingValue : "true");
                    rewriteLeaf(null);
                }
                else if (fluid.isArrayable(torender.value)) {
                    // Cannot be rendered directly, must be fake
                    renderUnchanged();
                }
                else { // String value
                    value = parent ?
                        parent[tagname === "textarea" || tagname === "input" ? "optionlist" : "optionnames"].value[torender.choiceindex] :
                        torender.value;
                    if (tagname === "textarea") {
                        if (isPlaceholder(value) && torender.willinput) {
                            // FORCE a blank value for input components if nothing from
                            // model, if input was intended.
                            value = "";
                        }
                        rewriteLeaf(value);
                    }
                    else if (tagname === "input") {
                        if (torender.willinput || isValue(value)) {
                            attrcopy.value = fluid.XMLEncode(String(value));
                        }
                        rewriteLeaf(null);
                    }
                    else {
                        delete attrcopy.name;
                        rewriteLeafOpen(value);
                    }
                }
            }
            else if (componentType === "UISelect") {

                var ishtmlselect = tagname === "select";
                var ismultiple = false; // eslint-disable-line no-unused-vars

                if (fluid.isArrayable(torender.selection.value)) {
                    ismultiple = true; // eslint-disable-line no-unused-vars
                    if (ishtmlselect) {
                        attrcopy.multiple = "multiple";
                    }
                }
                // assignSubmittingName is now the definitive trigger point for uniquifying output IDs
                // However, if id is already assigned it is probably through attempt to decorate root select.
                // in this case restore it.
                assignSubmittingName(attrcopy, torender.selection);

                if (ishtmlselect) {
                    // The HTML submitted value from a <select> actually corresponds
                    // with the selection member, not the top-level component.
                    if (torender.selection.willinput !== false) {
                        attrcopy.name = torender.selection.submittingname;
                    }
                    applyAutoBind(torender, attrcopy.id);
                }

                out += fluid.dumpAttributes(attrcopy);
                if (ishtmlselect) {
                    out += ">";
                    var values = torender.optionlist.value;
                    var names = torender.optionnames === null || torender.optionnames === undefined || !torender.optionnames.value ? values : torender.optionnames.value;
                    if (!names || !names.length) {
                        fluid.fail("Error in component tree - UISelect component with fullID " +
                            torender.fullID + " does not have optionnames set");
                    }
                    for (var i = 0; i < names.length; ++i) {
                        out += "<option value=\"";
                        value = values[i];
                        if (value === null) {
                            value = fluid.NULL_STRING;
                        }
                        out += fluid.XMLEncode(value);
                        if (isSelectedValue(torender, value)) {
                            out += "\" selected=\"selected";
                        }
                        out += "\">";
                        out += fluid.XMLEncode(names[i]);
                        out += "</option>\n";
                    }
                    closeTag();
                }
                else {
                    dumpTemplateBody();
                }
                dumpSelectionBindings(torender);
            }
            else if (componentType === "UILink") {
                var attrname = LINK_ATTRIBUTES[tagname];
                if (attrname) {
                    degradeMessage(torender.target);
                    var target = torender.target.value;
                    if (!isValue(target)) {
                        target = attrcopy[attrname];
                    }
                    target = rewriteUrl(trc.uselump.parent, target);
                    // Note that all real browsers succeed in recovering the URL here even if it is presented in violation of XML
                    // seemingly due to the purest accident, the text &amp; cannot occur in a properly encoded URL :P
                    attrcopy[attrname] = fluid.XMLEncode(target);
                }
                value = undefined;
                if (torender.linktext) {
                    degradeMessage(torender.linktext);
                    value = torender.linktext.value;
                }
                if (!isValue(value)) {
                    replaceAttributesOpen();
                }
                else {
                    rewriteLeaf(value);
                }
            }

            else if (torender.markup !== undefined) { // detect UIVerbatim
                degradeMessage(torender.markup);
                var rendered = torender.markup.value;
                if (rendered === null) {
                    // TODO, doesn't quite work due to attr folding cf Java code
                    out += fluid.dumpAttributes(attrcopy);
                    out += ">";
                    renderUnchanged();
                }
                else {
                    if (!trc.iselide) {
                        out += fluid.dumpAttributes(attrcopy);
                        out += ">";
                    }
                    out += rendered;
                    closeTag();
                }
            }
            if (attrcopy.id !== undefined) {
                usedIDs[attrcopy.id] = true;
            }
        }

        function rewriteIDRelation(context) {
            var attrname;
            var attrval = trc.attrcopy["for"];
            if (attrval !== undefined) {
                attrname = "for";
            }
            else {
                attrval = trc.attrcopy.headers;
                if (attrval !== undefined) {
                    attrname = "headers";
                }
            }
            if (!attrname) {return;}
            var tagname = trc.uselump.tagname;
            if (attrname === "for" && tagname !== "label") {return;}
            if (attrname === "headers" && tagname !== "td" && tagname !== "th") {return;}
            var rewritten = rewritemap[getRewriteKey(trc.uselump.parent, context, attrval)];
            if (rewritten !== undefined) {
                trc.attrcopy[attrname] = rewritten;
            }
        }

        function renderComment(message) {
            out += ("<!-- " + fluid.XMLEncode(message) + "-->");
        }

        function renderDebugMessage(message) {
            out += "<span style=\"background-color:#FF466B;color:white;padding:1px;\">";
            out += message;
            out += "</span><br/>";
        }

        function reportPath(/*UIComponent*/ branch) {
            var path = branch.fullID;
            return !path ? "component tree root" : "full path " + path;
        }

        function renderComponentSystem(context, torendero, lump) {
            var lumpindex = lump.lumpindex;
            var lumps = lump.parent.lumps;
            var nextpos = -1;
            var outerendopen = lumps[lumpindex + 1];
            var outerclose = lump.close_tag;

            nextpos = outerclose.lumpindex + 1;

            var payloadlist = lump.downmap ? lump.downmap["payload-component"] : null;
            var payload = payloadlist ? payloadlist[0] : null;

            var iselide = lump.rsfID.charCodeAt(0) === 126; // "~"

            var endopen = outerendopen;
            var close = outerclose;
            var uselump = lump;
            var attrcopy = {};
            $.extend(true, attrcopy, (payload === null ? lump : payload).attributemap);

            trc.attrcopy = attrcopy;
            trc.uselump = uselump;
            trc.endopen = endopen;
            trc.close = close;
            trc.nextpos = nextpos;
            trc.iselide = iselide;

            rewriteIDRelation(context);

            if (torendero === null) {
                if (lump.rsfID.indexOf("scr=") === (iselide ? 1 : 0)) {
                    var scrname = lump.rsfID.substring(4 + (iselide ? 1 : 0));
                    if (scrname === "ignore") {
                        nextpos = trc.close.lumpindex + 1;
                    }
                    else if (scrname === "rewrite-url") {
                        torendero = {componentType: "UILink", target: {}};
                    }
                    else {
                        openTag();
                        replaceAttributesOpen();
                        nextpos = trc.endopen.lumpindex;
                    }
                }
            }
            if (torendero !== null) {
                // else there IS a component and we are going to render it. First make
                // sure we render any preamble.

                if (payload) {
                    trc.endopen = lumps[payload.lumpindex + 1];
                    trc.close = payload.close_tag;
                    trc.uselump = payload;
                    dumpTillLump(lumps, lumpindex, payload.lumpindex);
                    lumpindex = payload.lumpindex;
                }

                adjustForID(attrcopy, torendero);
                //decoratormanager.decorate(torendero.decorators, uselump.getTag(), attrcopy);

                // ALWAYS dump the tag name, this can never be rewritten. (probably?!)
                openTag();

                renderComponent(torendero);
                // if there is a payload, dump the postamble.
                if (payload !== null) {
                    // the default case is initialised to tag close
                    if (trc.nextpos === nextpos) {
                        dumpTillLump(lumps, trc.close.lumpindex + 1, outerclose.lumpindex + 1);
                    }
                }
                nextpos = trc.nextpos;
            }
            return nextpos;
        }
        var renderRecurse;

        function renderContainer(child, targetlump) {
            var t2 = targetlump.parent;
            var firstchild = t2.lumps[targetlump.lumpindex + 1];
            if (child.children !== undefined) {
                dumpBranchHead(child, targetlump);
            }
            else {
                renderComponentSystem(child.parent, child, targetlump);
            }
            renderRecurse(child, targetlump, firstchild);
        }

        fetchComponent = function (basecontainer, id) {
            if (id.indexOf("msg=") === 0) {
                var key = id.substring(4);
                return {componentType: "UIMessage", messagekey: key};
            }
            while (basecontainer) {
                var togo = basecontainer.childmap[id];
                if (togo) {
                    return togo;
                }
                basecontainer = basecontainer.parent;
            }
            return null;
        };

        function fetchComponents(basecontainer, id) {
            var togo;
            while (basecontainer) {
                togo = basecontainer.childmap[id];
                if (togo) {
                    break;
                }
                basecontainer = basecontainer.parent;
            }
            return togo;
        }

        function findChild(sourcescope, child) {
            var split = fluid.SplitID(child.ID);
            var headlumps = sourcescope.downmap[child.ID];
            if (!headlumps) {
                headlumps = sourcescope.downmap[split.prefix + ":"];
            }
            return headlumps ? headlumps[0] : null;
        }

        renderRecurse = function (basecontainer, parentlump, baselump) {
            var children;
            var targetlump;
            var child;
            var renderindex = baselump.lumpindex;
            var basedepth = parentlump.nestingdepth;
            var t1 = parentlump.parent;
            var rendered;
            if (debugMode) {
                rendered = {};
            }
            while (true) {
                renderindex = dumpScan(t1.lumps, renderindex, basedepth, !parentlump.elide, false);
                if (renderindex === t1.lumps.length) {
                    break;
                }
                var lump = t1.lumps[renderindex];
                var id = lump.rsfID;
                // new stopping rule - we may have been inside an elided tag
                if (lump.nestingdepth < basedepth || id === undefined) {
                    break;
                }

                if (id.charCodeAt(0) === 126) { // "~"
                    id = id.substring(1);
                }

                //var ismessagefor = id.indexOf("message-for:") === 0;

                if (id.indexOf(":") !== -1) {
                    var prefix = fluid.getPrefix(id);
                    children = fetchComponents(basecontainer, prefix);

                    var finallump = lump.uplump.finallump[prefix];
                    var closefinal = finallump.close_tag;

                    if (children) {
                        for (var i = 0; i < children.length; ++i) {
                            child = children[i];
                            if (child.children) { // it is a branch
                                if (debugMode) {
                                    rendered[child.fullID] = true;
                                }
                                targetlump = branchmap[child.fullID];
                                if (targetlump) {
                                    if (debugMode) {
                                        renderComment("Branching for " + child.fullID + " from " +
                                            fluid.debugLump(lump) + " to " + fluid.debugLump(targetlump));
                                    }

                                    renderContainer(child, targetlump);

                                    if (debugMode) {
                                        renderComment("Branch returned for " + child.fullID +
                                            fluid.debugLump(lump) + " to " + fluid.debugLump(targetlump));
                                    }
                                }
                                else if (debugMode) {
                                    renderDebugMessage(
                                        "No matching template branch found for branch container with full ID " +
                                            child.fullID +
                                            " rendering from parent template branch " +
                                            fluid.debugLump(baselump));
                                }
                            }
                            else { // repetitive leaf
                                targetlump = findChild(parentlump, child);
                                if (!targetlump) {
                                    if (debugMode) {
                                        renderDebugMessage("Repetitive leaf with full ID " +
                                            child.fullID +
                                            " could not be rendered from parent template branch " +
                                            fluid.debugLump(baselump));
                                    }
                                    continue;
                                }
                                var renderend = renderComponentSystem(basecontainer, child, targetlump);
                                var wasopentag = renderend < t1.lumps.lengtn && t1.lumps[renderend].nestingdepth >= targetlump.nestingdepth;
                                var newbase = child.children ? child : basecontainer;
                                if (wasopentag) {
                                    renderRecurse(newbase, targetlump, t1.lumps[renderend]);
                                    renderend = targetlump.close_tag.lumpindex + 1;
                                }
                                if (i !== children.length - 1) {
                                    // TODO - fix this bug in RSF Server!
                                    if (renderend < closefinal.lumpindex) {
                                        dumpScan(t1.lumps, renderend, targetlump.nestingdepth - 1, false, false);
                                    }
                                }
                                else {
                                    dumpScan(t1.lumps, renderend, targetlump.nestingdepth, true, false);
                                }
                            }
                        } // end for each repetitive child
                    }
                    else {
                        if (debugMode) {
                            renderDebugMessage("No branch container with prefix " +
                                prefix + ": found in container " +
                                reportPath(basecontainer) +
                                " rendering at template position " +
                                fluid.debugLump(baselump) +
                                ", skipping");
                        }
                    }

                    renderindex = closefinal.lumpindex + 1;
                    if (debugMode) {
                        renderComment("Stack returned from branch for ID " + id + " to " +
                            fluid.debugLump(baselump) + ": skipping from " + fluid.debugLump(lump) +
                            " to " + fluid.debugLump(closefinal));
                    }
                }
                else {
                    var component;
                    if (id) {
                        component = fetchComponent(basecontainer, id, lump);
                        if (debugMode && component) {
                            rendered[component.fullID] = true;
                        }
                    }
                    if (component && component.children !== undefined) {
                        renderContainer(component);
                        renderindex = lump.close_tag.lumpindex + 1;
                    }
                    else {
                        renderindex = renderComponentSystem(basecontainer, component, lump);
                    }
                }
                if (renderindex === t1.lumps.length) {
                    break;
                }
            }
            if (debugMode) {
                children = basecontainer.children;
                for (var key = 0; key < children.length; ++key) {
                    child = children[key];
                    if (!rendered[child.fullID]) {
                        renderDebugMessage("Component " +
                            child.componentType + " with full ID " +
                            child.fullID + " could not be found within template " +
                            fluid.debugLump(baselump));
                    }
                }
            }

        };

        function renderCollect(collump) {
            dumpTillLump(collump.parent.lumps, collump.lumpindex, collump.close_tag.lumpindex + 1);
        }

        // Let us pray
        function renderCollects() {
            for (var key in collected) {
                var collist = collected[key];
                for (var i = 0; i < collist.length; ++i) {
                    renderCollect(collist[i]);
                }
            }
        }

        function processDecoratorQueue() {
            for (var i = 0; i < decoratorQueue.length; ++i) {
                var decorator = decoratorQueue[i];
                for (var j = 0; j < decorator.ids.length; ++j) {
                    var id = decorator.ids[j];
                    var node = fluid.byId(id, renderOptions.document);
                    if (!node) {
                        fluid.fail("Error during rendering - component with id " + id +
                            " which has a queued decorator was not found in the output markup");
                    }
                    if (decorator.type === "jQuery") {
                        var jnode = renderOptions.jQuery(node);
                        jnode[decorator.func].apply(jnode, fluid.makeArray(decorator.args));
                    }
                    else if (decorator.type === "fluid") {
                        var args = decorator.args;
                        if (!args) {
                            var thisContainer = renderOptions.jQuery(node);
                            if (!decorator.container) {
                                decorator.container = thisContainer;
                            }
                            else {
                                decorator.container.push(node);
                            }
                            args = [thisContainer, decorator.options];
                        }
                        var that = renderer.invokeFluidDecorator(decorator.func, args, id, i, options);
                        decorator.that = that;
                    }
                    else if (decorator.type === "event") {
                        node[decorator.event] = decorator.handler;
                    }
                }
            }
        }

        that.renderTemplates = function () {
            tree = fixupTree(tree, options.model, options.resolverGetConfig);
            var template = templates[0];
            resolveBranches(templates.globalmap, tree, template.rootlump);
            renderedbindings = {};
            renderCollects();
            renderRecurse(tree, template.rootlump, template.lumps[template.firstdocumentindex]);
            return out;
        };

        that.processDecoratorQueue = function () {
            processDecoratorQueue();
        };
        return that;

    };

    jQuery.extend(true, fluid.renderer, renderer);

    /*
     * This function is unsupported: It is not really intended for use by implementors.
     */
    fluid.ComponentReference = function (reference) {
        this.reference = reference;
    };

    // Explodes a raw "hash" into a list of UIOutput/UIBound entries
    fluid.explode = function (hash, basepath) {
        var togo = [];
        for (var key in hash) {
            var binding = basepath === undefined ? key : basepath + "." + key;
            togo[togo.length] = {ID: key, value: hash[key], valuebinding: binding};
        }
        return togo;
    };


    /**
     * A common utility function to make a simple view of rows, where each row has a selection control and a label
     *
     * @param {Object} optionlist - An array of the values of the options in the select
     * @param {Object} opts - An object with this structure: {
     *       selectID: "",
     *       rowID: "",
     *       inputID: "",
     *       labelID: ""
     *   }
     * @return {Object} - The results of transforming optionlist.
     */
    fluid.explodeSelectionToInputs = function (optionlist, opts) {
        return fluid.transform(optionlist, function (option, index) {
            return {
                ID: opts.rowID,
                children: [
                    {ID: opts.inputID, parentRelativeID: "..::" + opts.selectID, choiceindex: index},
                    {ID: opts.labelID, parentRelativeID: "..::" + opts.selectID, choiceindex: index}
                ]
            };
        });
    };

    fluid.renderTemplates = function (templates, tree, options, fossilsIn) {
        var renderer = fluid.renderer(templates, tree, options, fossilsIn);
        var rendered = renderer.renderTemplates();
        return rendered;
    };
    /**
     * A driver to render and bind an already parsed set of templates onto
     * a node. See documentation for fluid.selfRender.
     *
     * @param {Object} templates - A parsed template set, as returned from fluid.selfRender or fluid.parseTemplates.
     * @param {jQuery|DomElement} node - The node both holding the template, and whose markup is to be
     * replaced with the rendered result.
     * @param {Object} tree - The component tree to be rendered.
     * @param {Object} [options] - (optional) An options structure to configure the rendering and binding process.
     * @return {Object} - A templates structure, suitable for a further call to fluid.reRender or fluid.renderTemplates.
     */
    fluid.reRender = function (templates, node, tree, options) {
        options = options || {};
        var renderer = fluid.renderer(templates, tree, options, options.fossils);
        options = renderer.options;
        // Empty the node first, to head off any potential id collisions when rendering
        node = fluid.unwrap(node);
        var lastFocusedElement = fluid.getLastFocusedElement ? fluid.getLastFocusedElement() : null;
        var lastId;
        if (lastFocusedElement && fluid.dom.isContainer(node, lastFocusedElement)) {
            lastId = lastFocusedElement.id;
        }
        if ($.browser.msie) {
            options.jQuery(node).empty(); //- this operation is very slow.
        }
        else {
            node.innerHTML = "";
        }

        var rendered = renderer.renderTemplates();
        if (options.renderRaw) {
            rendered = fluid.XMLEncode(rendered);
            rendered = rendered.replace(/\n/g, "<br/>");
        }
        if (options.model) {
            fluid.bindFossils(node, options.model, options.fossils);
        }
        if ($.browser.msie) {
            options.jQuery(node).html(rendered);
        }
        else {
            node.innerHTML = rendered;
        }
        renderer.processDecoratorQueue();
        if (lastId) {
            var element = fluid.byId(lastId, options.document);
            if (element) {
                options.jQuery(element).trigger("focus");
            }
        }

        return templates;
    };

    function findNodeValue(rootNode) {
        var node = fluid.dom.iterateDom(rootNode, function (node) {
            // NB, in Firefox at least, comment and cdata nodes cannot be distinguished!
            return node.nodeType === 8 || node.nodeType === 4 ? "stop" : null;
        }, true);
        var value = node.nodeValue;
        if (value.indexOf("[CDATA[") === 0) {
            return value.substring(6, value.length - 2);
        }
        else {
            return value;
        }
    }

    fluid.extractTemplate = function (node, armouring) {
        if (!armouring) {
            return node.innerHTML;
        }
        else {
            return findNodeValue(node);
        }
    };
    /** A slightly generalised version of fluid.selfRender that does not assume that the
     * markup used to source the template is within the target node.
     * @param {Object | String} source - Either a structure {node: node, armouring: armourstyle} or a string
     * holding a literal template
     * @param {Object} target - The node to receive the rendered markup
     * @param {Object} tree - The component tree to be rendered.
     * @param {Object} options - An options structure to configure the rendering and binding process.
     * @return {Object} - A templates structure, suitable for a further call to fluid.reRender or fluid.renderTemplates.
     */
    fluid.render = function (source, target, tree, options) {
        options = options || {};
        var template = source;
        if (typeof(source) === "object") {
            template = fluid.extractTemplate(fluid.unwrap(source.node), source.armouring);
        }
        target = fluid.unwrap(target);
        var resourceSpec = {
            base: {
                resourceText: template,
                href: ".", resourceKey: ".", cutpoints: options.cutpoints
            }
        };
        var templates = fluid.parseTemplates(resourceSpec, ["base"], options);
        return fluid.reRender(templates, target, tree, options);
    };

    /** A simple driver for single node self-templating. Treats the markup for a
     * node as a template, parses it into a template structure, renders it using
     * the supplied component tree and options, then replaces the markup in the
     * node with the rendered markup, and finally performs any required data
     * binding. The parsed template is returned for use with a further call to
     * reRender.
     * @param {Object} node - The node both holding the template, and whose markup is to be
     * replaced with the rendered result.
     * @param {Object} tree - The component tree to be rendered.
     * @param {Object} options - An options structure to configure the rendering and binding process.
     * @return {Object} - A templates structure, suitable for a further call to fluid.reRender or fluid.renderTemplates.
     */
    fluid.selfRender = function (node, tree, options) {
        options = options || {};
        return fluid.render({node: node, armouring: options.armouring}, node, tree, options);
    };

})(jQuery, fluid_3_0_0);
