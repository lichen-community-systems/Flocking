#! /usr/bin/env node

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

/* eslint-env node */
"use strict";

const build = {};
const cpy = require("cpy");
const dayjs = require("dayjs");
const fg = require("fast-glob");
const fs = require("fs");
const mkdirp = require("mkdirp");
const path = require("path");
const {execSync} = require("child_process");
const {minify} = require("terser");
const minimist = require("minimist");
const zip = require("bestzip");

/**
 * Filters a provided array, `toFilter`, by removing the common values found in the set of other provided arrays.
 * That is, only includes vaues unique to the `toFilter` array.
 *
 * @param {Array} toFilter - the array to filter. Only values that are not found in subsequent arrays will be returned.
 * @param  {...Array} arrays - the arrays to filter `toFilter` with.
 * @return {Array} - the filtered array.
 */
build.arrayFilter = (toFilter, ...arrays) => {
    let filter = (accumulator, current) => accumulator.filter(val => !current.includes(val));

    return arrays.reduce(filter, toFilter);
};

/**
 * Reads in a JSON file and returns an object.
 * @param {String} path - the file path for the JSON file to read in.
 * @param {Object} [options] - (optional) options to pass down to `fs.readFileSync`
 * @return {Object} - the JSON file as an object
 */
build.readJSON = (path, options) => {
    let data = fs.readFileSync(path, options);
    return JSON.parse(data);
};

/**
 *
 * @param {String} filePath - basepath of file to use to source the directory path
 * @param  {...String} paths - additional paths to augment the directory path found from the `filePath`
 * @return {String} - the directory path
 */
build.getDir = (filePath, ...paths) => {
    var basePath = path.dirname(filePath);
    return path.join.apply(null, [basePath, ...paths]);
};

/**
 *
 * @param {String|String[]} files - The set of file paths to the package.json files to source the Infusion modules from.
 * @return {Object} - An object keyed off the package names, and containing the package info for each package.
 *                     Additionally a `dir` property is added for each, to identity the path to the packages directory.
 */
build.gatherPackages = files => {
    let modules = {};
    fg.sync(files).forEach(filePath => {
        var modulePackage = build.readJSON(filePath);
        if (modulePackage.packages) {
            modulePackage.packages.forEach(pack => {
                modules[pack.name] = {...pack, ...{dir: build.getDir(filePath, pack.infusion.dir || "")}};
            });
        } else {
            modules[modulePackage.name] = {...modulePackage, ...{dir: build.getDir(filePath, modulePackage.infusion.dir || "")}};
        }
    });
    return modules;
};

/**
 * Returns the set of requested modules/packages based on their dependency requirements. If the include options is
 * provided only the requested modules will be returned. If the exclude option is provied, the exclude modules will be
 * removed.
 * @param {Object<String, String>} packages - All available packages
 * @param {String[]} [include] - (optional) an array of module names to include
 * @param {String[]} [exclude] - (optional) an array of module names to exclude
 * @throws {Error} - If an `include` or dependency cannot be located in the `packages`
 * @return {Object} - An object with the modules sorted based on dependency.
 */
build.sortModules = (packages, include, exclude = []) => {
    let modules = {};
    include = include || Object.keys(packages);
    let toInclude = build.arrayFilter(include, exclude);

    toInclude.forEach(moduleName => {
        if (!packages[moduleName]) {
            throw new Error(`The "${moduleName}" Infusion module could not be found. Either the related package.json file could not be located or the package name is invalid.`);
        }

        let dependencies = packages[moduleName].dependencies;
        if (dependencies) {
            let dependsOn = build.sortModules(packages, Object.keys(dependencies), exclude);
            modules = {...modules, ...dependsOn};
        }
        modules[moduleName] = packages[moduleName];
    });

    return modules;
};

/**
 * Assembles the sorted file and directory paths for the requested modules.
 * @param {String|String[]} files - the set of files to source the module/package information from
 * @param {Object} [options] - (optional) options to determine which modules are included
 * @param {String[]} [options.include] - An array of module names to include
 * @param {String[]} [options.exclude] - An array of module names to exclude
 * @return {Object} - an object containing arrays, `files` and `dirs`, of the sorted paths.
 */
build.getModulePaths = (files, options = {}) => {
    const packages = build.gatherPackages(files);
    let include = options.include && options.include.split(",").map(name => name.trim());
    let exclude = options.exclude && options.exclude.split(",").map(name => name.trim());
    let paths = {
        files: [],
        dirs: []
    };

    let sortedModules = build.sortModules(packages, include, exclude);
    for (let moduleName in sortedModules) {
        let mod = sortedModules[moduleName];
        paths.dirs.push(path.join(mod.dir, "**/*"));
        if (mod.infusion && mod.infusion.jsCommonFiles) {
            let files = mod.infusion.jsCommonFiles.map(filePath => path.join(mod.dir, filePath));
            paths.files = [...paths.files, ...files];
        }
    }

    return paths;
};

/**
 * Runs `child_process.execSync` but with the stderr ignored and catching any errors to return undefined. This is done
 * to allow the calling function to replace with a default value when the child process fails.
 * See: https://nodejs.org/dist/latest-v15.x/docs/api/child_process.html#child_process_child_process_execsync_command_options
 * @param {String} command - a string representing the command to run
 * @param {Object} [options] - (optional) options for `child_process.execSync`
 * @return {String|undefined} - returns either the string from the stdout of the executed command, or undefined if an
 * error occurs.
 */
build.execSync = (command, options) => {
    let result;

    options = {
        stdio: ["pipe", "pipe", "ignore"],
        encoding: "utf8",
        ...options
    };

    try {
        result = execSync(command, options).trim();
    } catch (err) {
        result;
    }

    return result;
};

/**
 * Assembles the banner to use at the top of the minified filed. Variable values are supplied as described below:
 *
 * Parameters:
 * - include: the string of modules requested to include
 * - exclude: the string of modules requested to exclude
 *
 * Environment Variables:
 * - npm_package_name (from package.json): package name
 * - npm_package_version (from package.json): package version
 *
 * System:
 * - date: current date
 * - branch: git branch the build is generated from
 * - revision: git revision the build is generated from
 * - tag: if HEAD corresponds to a tag, the git tag name is used for the version information
 * @param {String} [include] - (optional) the string of modules requested to include
 * @param {String} [exclude] - (optional) the string of modules requested to exclude
 * @return {String} - compiled string to use as a banner for the minified file.
 */
build.banner = (include, exclude) => {
    let defaultVer = `v${process.env.npm_package_version}-dev`;
    let version = `${process.env.npm_package_name} - ${build.execSync("git describe --exact-match --tags HEAD") || defaultVer}`;
    let date = `build date: ${dayjs().format("YYYY-MM-DDTHH:mm:ssZ[Z]")}`;
    let branch = `branch: ${build.execSync("git rev-parse --abbrev-ref HEAD") || "unknown"}`;
    let revision = `revision: ${build.execSync("git rev-parse --verify --short HEAD") || "unknown"}`;

    let banner = `* ${version}\n *\n * Build Info:\n *  ${branch}\n *  ${revision}\n *  ${date}`;

    if (include) {
        banner += `\n *  includes: ${include}`;
    }

    if (exclude) {
        banner += `\n *  excludes: ${exclude}`;
    }

    return `/*!\n ${banner}\n*/`;
};

/**
 * Iterates over an array of file paths, expanding them to an objected keyed off of the paths with the file contents
 * as values. This is used by terser to minify the files and concatenate together.
 * @param {String[]} files - an array of file paths
 * @return {Object} - An object with keys as paths to the files and values as the file contents as a String.
 */
build.readFiles = (files) => {
    let readFiles = {};
    files.forEach(path => {
        readFiles[path] = fs.readFileSync(path, "utf8");
    });
    return readFiles;
};

/**
 * Minifies and concatenates the supplied files. Will write the concatenated file to the `output` and provide a sibling
 * source map. If no `output` is provided, it will write the minified contents to stdout. Internally this uses terser to
 * peform minification. See: https://github.com/terser/terser
 * @param {String} [output] - (optional) path to write the minified/concatenated file to.
 * @param {String[]} files - an array of files minify and concatenate
 * @param {Object} [options] - (optional) options to pass down to terser's minify method.
 */
build.minify = async (output, files, options) => {
    let result;
    try {
        result = await minify(build.readFiles(files), options);
    } catch (err) {
        throw err;
    }

    if (output) {
        mkdirp.sync(path.dirname(output));
        fs.writeFileSync(output, `${result.code}`);
        fs.writeFileSync(`${output}.map`, result.map);
    } else {
        console.log(result.code); // eslint-disable-line no-console
    }
};

build.assembleHelpParams = (params) => {
    let padding = Object.keys(params).reduce((acc, cv) => Math.max(acc, cv.length), 0);
    let help = "";
    for (let param in params) {
        let start = `${param}:`;
        help += `  ${start.padEnd(padding, " ")} ${params[param]}\n`;
    };
    return help;
};

build.help = () => {
    let description = "Concatenates and minifies the requested Infusion modules. Must include a reference to the Infusion module packages either with the -p, --packages, or as a list of glob patterns/filepaths.";
    let usage = "node .buildModules.js [options] [packages]";

    let opts = build.assembleHelpParams(build.cli.opts);
    let env = build.assembleHelpParams(build.cli.env);

    let help = `${description}\n\nUsage: ${usage}\n\nOptions:\n${opts}\n\nEnvironment Variables:\n${env}`;

    console.log(help); // eslint-disable-line no-console
};

build.cli = {
    opts: {
        "[--copy_dirs]": "(optional) If specified, will copy the module directories to the output directory. Requires that the output option is set.",
        "[-e], [--exclude=...]": "(optional) A comma separated list of Infusion modules to exclude from the build. Takes precedence over include.",
        "[-h], [--help]": "(optional) Output the command line (CLI) options available",
        "[-i], [--include=...]": "(optional) A comma separated list of Infusion modules to include in the build.",
        "[-n], [--name=...]": "(optional) A name for custom builds. The name will be interpolated into the minified file and zip archive if present. e.g. infusion-myName.js and infusion-myName-3.0.0.zip. By default it is set to 'custom'. Requires that the output option is set and that at least one of the include or exclude options are used.",
        "[-o], [--output=...]": "(optional) File path to write the concatenated and minified build to. Will output to stdout if not provided.",
        "[-p], [--packages=...]": "File paths to module package files. Glob patterns are supported. Providing packages is required, but can either be specified with this CLI option, or as a list of files.",
        "[-z], [--zip]": "(optional) If provided, a zip archive will be included alongside the output. Requires that the output option is set."
    },
    env: {
        "FL_EXCLUDE": "(optional) A comma separated list of Infusion modules to exclude from the build. Takes precedence over include.. Is superceded by the --exclude CLI option",
        "FL_INCLUDE": "(optional) A comma separated list of Infusion modules to include in the build. Is superceded by the --include CLI option",
        "FL_OUTPUT": "(optional) File path to write the concatenated and minified build to. Will output to stdout if not provided. Is superceded by the --output CLI option",
        "FL_OUTPUT_COPY_DIRS": "(optional) If specified, will copy the module directories to the output directory. Requires that the output option is set. Is superceded by the --copy_dirs CLI option",
        "FL_OUTPUT_NAME": "(optional) If specified, will be used for the name of custom build output files. Requires that the output option is set. Is superceded by the --name CLI option",
        "FL_OUTPUT_ZIP": "(optional) If specified, a zip archive will be included alongside the output. Requires that the output option is set. Is superceded by the --zip CLI option",
        "FL_PACKAGES": "File paths to module package files. Glob patterns are supported. Is superceded by the --packages CLI option"
    }
};

module.exports = build;

if (require.main === module) {
    let args = minimist(process.argv.slice(2), {
        string: ["exclude", "include", "name", "output", "packages"],
        boolean: ["copy_dirs", "help", "zip"],
        alias: {
            e: "exclude",
            h: "help",
            i: "include",
            n: "name",
            o: "output",
            p: "packages",
            z: "zip"
        },
        default: {
            copy_dirs: process.env.FL_OUTPUT_COPY_DIRS ? true : false,
            exclude: process.env.FL_EXCLUDE,
            include: process.env.FL_INCLUDE,
            name: process.env.FL_OUTPUT_NAME,
            output: process.env.FL_OUTPUT,
            packages: process.env.FL_PACKAGES,
            zip: process.env.FL_OUTPUT_ZIP
        }
    });

    let packages = args.packages || args._;

    if (args.help || !packages.length) {
        build.help();
        return;
    }

    let modulePaths = build.getModulePaths(args.packages || args._, args);
    let outputSuffix = args.include || args.exclude ? args.name || "custom" : "all";
    let outputFile = `infusion-${outputSuffix}.js`;

    build.minify(args.output && path.join(args.output, outputFile), modulePaths.files, {
        compress: false,
        mangle: false,
        format: {
            preamble: build.banner(args.include, args.exclude)
        },
        sourceMap: args.output ? {
            filename: outputFile,
            url: `${outputFile}.map`,
            root: args.copy_dirs ? "" : path.relative(args.output, "./")
        } : false
    });

    // copy module directories to the output directory
    if (args.output) {
        (async () => {
            if (args.copy_dirs) {
                await cpy(modulePaths.dirs, args.output, {parents: true});
            }

            if (args.zip) {
                let defaultVer = `${process.env.npm_package_version}-dev`;
                mkdirp.sync("./products");
                await zip({
                    cwd: args.output,
                    source: "./",
                    destination: path.join("../products", `${process.env.npm_package_name}-${outputSuffix}-${build.execSync("git describe --exact-match --tags HEAD") || defaultVer}.zip`)
                });
            }

        })();
    }
}
