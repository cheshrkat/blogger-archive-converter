#!/usr/bin/env node
const fs = require("fs");
let pass = 0;
let fail = 0;
let logGreen = '\x1b[32m%s\x1b[0m';
let logRed = '\x1b[31m%s\x1b[0m';

// Test for the expected file output of test data conversion
let testFiles = [
    "output/the404gfweblog/data/blog-commenters.json",
    "output/the404gfweblog/data/blog-comments.json",
    "output/the404gfweblog/data/blog-details.json",
    "output/the404gfweblog/data/blog-images.json",
    "output/the404gfweblog/data/blog-labels.json",
    "output/the404gfweblog/data/blog-pages.json",
    "output/the404gfweblog/data/blog-posts.json",
    "output/the404gfweblog/data/blog-settings.json",
    "output/the404gfweblog/data/image-downloaded.json",
    "output/the404gfweblog/data/image-errors.json",
    "output/the404gfweblog/data/image-excluded.json",
    "output/the404gfweblog/data/image-skipped.json",
    "output/the404gfweblog/data/output-raw.json",
    "output/the404gfweblog/data/sitemap.xml",
    "output/the404gfweblog/data/template-0.xml",
    "output/the404gfweblog/draft-posts/html/20131101-draft-20131101-3252217494363372199.html",
    "output/the404gfweblog/draft-posts/html/20140112-draft-20140112-1666616624114269778.html",
    "output/the404gfweblog/draft-posts/markdown/20131101-draft-20131101-3252217494363372199.md",
    "output/the404gfweblog/draft-posts/markdown/20140112-draft-20140112-1666616624114269778.md",
    "output/the404gfweblog/images/2968614290658965264-2015-01-02%2B15.45.52.jpg",
    "output/the404gfweblog/images/8146864272524357874-21382432249_024bca2260_h.jpg",
    "output/the404gfweblog/images/8146864272524357874-21382432249_6960387868_m.jpg",
    "output/the404gfweblog/images/8146864272524357874-sq2-mpc.gif",
    "output/the404gfweblog/pages/html/20121101-about-this-blog.html",
    "output/the404gfweblog/pages/html/20150419-contact.html",
    "output/the404gfweblog/pages/markdown/20121101-about-this-blog.md",
    "output/the404gfweblog/pages/markdown/20150419-contact.md",
    "output/the404gfweblog/posts/html/2012/10/27/craft-beer-kale-chips-wayfarers.html",
    "output/the404gfweblog/posts/html/2012/10/27/food-truck-bespoke-single-origin-coffee.html",
    "output/the404gfweblog/posts/html/2012/10/27/semiotics-hoodie.html",
    "output/the404gfweblog/posts/html/2013/11/01/pitchfork-cray.html",
    "output/the404gfweblog/posts/html/2015/09/27/tattooed-authentic.html",
    "output/the404gfweblog/posts/html/2015/11/10/content-test.html",
    "output/the404gfweblog/posts/html/2018/07/07/oversize-image.html",
    "output/the404gfweblog/posts/markdown/2012/10/27/craft-beer-kale-chips-wayfarers.md",
    "output/the404gfweblog/posts/markdown/2012/10/27/food-truck-bespoke-single-origin-coffee.md",
    "output/the404gfweblog/posts/markdown/2012/10/27/semiotics-hoodie.md",
    "output/the404gfweblog/posts/markdown/2013/11/01/pitchfork-cray.md",
    "output/the404gfweblog/posts/markdown/2015/09/27/tattooed-authentic.md",
    "output/the404gfweblog/posts/markdown/2015/11/10/content-test.md",
    "output/the404gfweblog/posts/markdown/2018/07/07/oversize-image.md",
    "output/the404gfweblog-images/2968614290658965264-2015-01-02%2B15.45.52.jpg",
    "output/the404gfweblog-images/8146864272524357874-21382432249_024bca2260_h.jpg",
    "output/the404gfweblog-images/8146864272524357874-21382432249_6960387868_m.jpg",
    "output/the404gfweblog-images/8146864272524357874-sq2-mpc.gif"
]

testFiles.forEach((file) => {
    if (fs.existsSync(file)) {
        console.log(logGreen, "exists:", file);
        pass++;
    } else {
        console.log(logRed, "DOES NOT exist:", file);
        fail++;
    }
})

if (fail > 0) {
    console.log(logRed, `TEST FAILED: ${fail} failures detected`);
    process.exit(1);    
} else {
    console.log(logGreen, `SUCCESS: ${pass} tests passed`);
    process.exit(0);
}

