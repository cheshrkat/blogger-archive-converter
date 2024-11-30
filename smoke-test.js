#!/usr/bin/env node
const fs = require("fs");
let pass = 0;
let fail = 0;
let logGreen = '\x1b[32m%s\x1b[0m';
let logRed = '\x1b[31m%s\x1b[0m';

// Test for the expected file output of test data conversion
let testFiles = [
    "output/testblog/data/blog-commenters.json",
    "output/testblog/data/blog-comments.json",
    "output/testblog/data/blog-details.json",
    "output/testblog/data/blog-images.json",
    "output/testblog/data/blog-labels.json",
    "output/testblog/data/blog-pages.json",
    "output/testblog/data/blog-posts.json",
    "output/testblog/data/blog-settings.json",
    "output/testblog/data/image-downloaded.json",
    "output/testblog/data/image-errors.json",
    "output/testblog/data/image-excluded.json",
    "output/testblog/data/image-skipped.json",
    "output/testblog/data/output-raw.json",
    "output/testblog/data/sitemap.xml",
    "output/testblog/data/template-0.xml",
    "output/testblog/draft-posts/html/20131101-draft-20131101-3252217494363372199.html",
    "output/testblog/draft-posts/html/20140112-draft-20140112-1666616624114269778.html",
    "output/testblog/draft-posts/markdown/20131101-draft-20131101-3252217494363372199.md",
    "output/testblog/draft-posts/markdown/20140112-draft-20140112-1666616624114269778.md",
    "output/testblog/images/2968614290658965264-2015-01-02%2B15.45.52.jpg",
    "output/testblog/images/8146864272524357874-21382432249_024bca2260_h.jpg",
    "output/testblog/images/8146864272524357874-21382432249_6960387868_m.jpg",
    "output/testblog/images/8146864272524357874-sq2-mpc.gif",
    "output/testblog/pages/html/20121101-about-this-blog.html",
    "output/testblog/pages/html/20150419-contact.html",
    "output/testblog/pages/markdown/20121101-about-this-blog.md",
    "output/testblog/pages/markdown/20150419-contact.md",
    "output/testblog/posts/html/2012/10/27/craft-beer-kale-chips-wayfarers.html",
    "output/testblog/posts/html/2012/10/27/food-truck-bespoke-single-origin-coffee.html",
    "output/testblog/posts/html/2012/10/27/semiotics-hoodie.html",
    "output/testblog/posts/html/2013/11/01/pitchfork-cray.html",
    "output/testblog/posts/html/2015/09/27/tattooed-authentic.html",
    "output/testblog/posts/html/2015/11/10/content-test.html",
    "output/testblog/posts/html/2018/07/07/oversize-image.html",
    "output/testblog/posts/markdown/2012/10/27/craft-beer-kale-chips-wayfarers.md",
    "output/testblog/posts/markdown/2012/10/27/food-truck-bespoke-single-origin-coffee.md",
    "output/testblog/posts/markdown/2012/10/27/semiotics-hoodie.md",
    "output/testblog/posts/markdown/2013/11/01/pitchfork-cray.md",
    "output/testblog/posts/markdown/2015/09/27/tattooed-authentic.md",
    "output/testblog/posts/markdown/2015/11/10/content-test.md",
    "output/testblog/posts/markdown/2018/07/07/oversize-image.md",
    "output/testblog-images/2968614290658965264-2015-01-02%2B15.45.52.jpg",
    "output/testblog-images/8146864272524357874-21382432249_024bca2260_h.jpg",
    "output/testblog-images/8146864272524357874-21382432249_6960387868_m.jpg",
    "output/testblog-images/8146864272524357874-sq2-mpc.gif"
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

