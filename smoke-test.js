#!/usr/bin/env node
const fs = require("fs");
const log = require('./_logging.js');
let pass = 0;
let fail = 0;

// These files should exist in both output and snapshot directories
let snapshotFiles = [
    "testblog/data/blog-commenters.json",
    "testblog/data/blog-comments.json",
    "testblog/data/blog-details.json",
    "testblog/data/blog-images.json",
    "testblog/data/blog-labels.json",
    "testblog/data/blog-pages.json",
    "testblog/data/blog-posts.json",
    "testblog/data/blog-settings.json",
    "testblog/data/image-downloaded.json",
    "testblog/data/image-errors.json",
    "testblog/data/image-excluded.json",
    "testblog/data/image-skipped.json",
    "testblog/data/output-raw.json",
    "testblog/data/sitemap.xml",
    "testblog/data/template-0.xml",
    "testblog/draft-posts/html/20131101-draft-20131101-3252217494363372199.html",
    "testblog/draft-posts/html/20140112-draft-20140112-1666616624114269778.html",
    "testblog/draft-posts/markdown/20131101-draft-20131101-3252217494363372199.md",
    "testblog/draft-posts/markdown/20140112-draft-20140112-1666616624114269778.md",
    "testblog/images/2968614290658965264-2015-01-02%2B15.45.52.jpg",
    "testblog/images/8146864272524357874-21382432249_024bca2260_h.jpg",
    "testblog/images/8146864272524357874-21382432249_6960387868_m.jpg",
    "testblog/images/8146864272524357874-sq2-mpc.gif",
    "testblog/pages/html/20121101-about-this-blog.html",
    "testblog/pages/html/20150419-contact.html",
    "testblog/pages/markdown/20121101-about-this-blog.md",
    "testblog/pages/markdown/20150419-contact.md",
    "testblog/posts/html/2012/10/27/craft-beer-kale-chips-wayfarers.html",
    "testblog/posts/html/2012/10/27/food-truck-bespoke-single-origin-coffee.html",
    "testblog/posts/html/2012/10/27/semiotics-hoodie.html",
    "testblog/posts/html/2013/11/01/pitchfork-cray.html",
    "testblog/posts/html/2015/09/27/tattooed-authentic.html",
    "testblog/posts/html/2015/11/10/content-test.html",
    "testblog/posts/html/2018/07/07/oversize-image.html",
    "testblog/posts/markdown/2012/10/27/craft-beer-kale-chips-wayfarers.md",
    "testblog/posts/markdown/2012/10/27/food-truck-bespoke-single-origin-coffee.md",
    "testblog/posts/markdown/2012/10/27/semiotics-hoodie.md",
    "testblog/posts/markdown/2013/11/01/pitchfork-cray.md",
    "testblog/posts/markdown/2015/09/27/tattooed-authentic.md",
    "testblog/posts/markdown/2015/11/10/content-test.md",
    "testblog/posts/markdown/2018/07/07/oversize-image.md",
    "testblog-images/2968614290658965264-2015-01-02%2B15.45.52.jpg",
    "testblog-images/8146864272524357874-21382432249_024bca2260_h.jpg",
    "testblog-images/8146864272524357874-21382432249_6960387868_m.jpg",
    "testblog-images/8146864272524357874-sq2-mpc.gif"
]  

function areWithinTolerance(num1, num2, tolerancePercentage) {
    // Handle the case where both numbers are zero to avoid division by zero
    if (num1 === 0 && num2 === 0) {
        return true;
    }

    // Choose the larger number as the base for the percentage calculation
    const base = Math.max(Math.abs(num1), Math.abs(num2));

    // Calculate the absolute difference between the two numbers using Math.abs()
    const difference = Math.abs(num1 - num2);

    // Calculate the maximum allowed difference based on the tolerance percentage
    const maxAllowedDifference = base * (tolerancePercentage / 100);

    if(difference != 0) {
        log.warning(`Comparing ${num1} and ${num2} with a tolerance of ${tolerancePercentage}% (absolute difference: ${difference})`);
    }

    // Check if the actual difference is less than or equal to the maximum allowed difference
    return difference <= maxAllowedDifference;
}

snapshotFiles.forEach((file, i) => {
    const thisFile = `output/${file}`;
    const thisFilesSnapshot = `test-data/snapshots/${file}`;

    log.bar();
    log.message(`Testing file ${i+1} of ${snapshotFiles.length}: ${thisFile}`);

    if (fs.existsSync(thisFile)) {
        log.success(`exists: ${thisFile}`);
        pass++;
    } else {
        log.error(`FAIL - file does not exist: ${thisFile}`);
        const outputDir = thisFile.substring(0, thisFile.lastIndexOf('/'));
        log.message(`Listing files in output directory: ${outputDir}`);
        if (fs.existsSync(outputDir)) {
            const files = fs.readdirSync(outputDir);
            files.forEach((f) => {
                log.message(` - ${f}`);
            });
        }
        fail++;
    }

    // add a test that the files are similar size
    if (fs.existsSync(thisFilesSnapshot)) {
        // const outputData = fs.readFileSync(thisFile, 'utf8');
        // const snapshotData = fs.readFileSync(thisFilesSnapshot, 'utf8');
        const outputStats = fs.statSync(thisFile);
        const snapshotStats = fs.statSync(thisFilesSnapshot);
        const tolerancePercentage = 5; // Allow a % difference in file size
        const outputFileSize = outputStats.size;
        const snapshotFileSize = snapshotStats.size;

        if (areWithinTolerance(outputFileSize, snapshotFileSize, tolerancePercentage)) {
            log.success(`matches snapshot: ${thisFile}`);
            pass++;
        } else {
            log.error(`FAIL - output file ${thisFile} does NOT match snapshot ${thisFilesSnapshot} within ${tolerancePercentage}% tolerance`);
            fail++;

            log.message(`Output file size:   ${outputFileSize} bytes`);
            log.message(`Snapshot file size: ${snapshotFileSize} bytes`);
        }
    } else {
        log.error(`Snapshot DOES NOT exist for: ${thisFile}`);
        fail++;
    }
})


log.bar();

log.message(`\nTesting complete.`);

if (fail > 0) {
    log.error(`TEST FAILED: ${fail} failures detected`);
    log.newline()
    process.exit(1);    
} else {
    log.success(`SUCCESS: ${pass} tests passed`);
    log.newline()
    process.exit(0);
}
