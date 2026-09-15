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

(function (fluid) {
    "use strict";

    fluid.registerNamespace("fluid.uploader");

    fluid.uploader.mimeTypeRegistry = {
        // Images
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        bmp: "image/bmp",
        png: "image/png",
        tif: "image/tiff",
        tiff: "image/tiff",

        // Audio
        mp3: "audio/mpeg",
        m4a: "audio/mp4a-latm",
        ogg: "audio/ogg",
        wav: "audio/x-wav",
        aiff: "audio/x-aiff",

        // Video
        mpg: "video/mpeg",
        mpeg: "video/mpeg",
        m4v: "video/x-m4v",
        ogv: "video/ogg",
        mov: "video/quicktime",
        avi: "video/x-msvideo",

        // Text documents
        html: "text/html",
        htm: "text/html",
        text: "text/plain",

        // Office Docs.
        doc: "application/msword",
        docx: "application/msword",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.ms-excel",
        ppt: "application/vnd.ms-powerpoint",
        pptx: "application/vnd.ms-powerpoint"
    };
})(fluid_3_0_0);
