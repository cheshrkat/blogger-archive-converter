#!/usr/bin/env node

/*
NOTE...
This project is a rough and ready conversion tool, not a work of art. 
Started a long time ago, picked up and put down many times while Life Happened.
While I should refactor it, well, it works... don't judge ;)

Jokes aside, the code you probably actually want 
to change is in config.json and _templates.js
*/

const fs = require('fs');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const parser = require('xml2json');
const countFiles = require('count-files');
const cheerio = require('cheerio');
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;

const sourceFile = process.argv[2];
const configFile = './config.json';
const templates = require('./_templates.js');
const log = require('./_logging.js');
const helpers = require('./_helpers.js');
const sitemaps = require('./_sitemap.js');

var options;
var json;
var parsed;
var downloadCount;
var entriesCount;
var dirs = {};
var outputDir;
var blogPosts = [];
var blogPages = [];
var page = {};
var blogSettings = [];
var setting = {}
var allCommenters = [];
var allComments = [];
var allLabels = [];
var allImages = [];
var imagesToDownload = [];
var imageError = [];
var imageExcluded = [];
var imageSkipped = [];
var imagesProcessed = 0;
var dataImages = 0;

var blogDetails = {
  'blogTitle': 'ERROR: title not parsed',
  'blogUrl': 'ERROR: blog URL not parsed',
  'blogID': 'ERROR: blog ID not parsed',
  'blogIDfull': 'ERROR: full blog ID not parsed',
  'blogAuthor': 'ERROR: author not parsed',
  'emailAddresses': {
    'admins': 'ERROR: admin emails not parsed',
    'authors': 'ERROR: author emails not parsed'
  },
  'allAuthors': [],
   'contentTypes': {
    "blogs": 0,
    "blogdrafts": 0,
    "templates": 0,
    "pages": 0,
    "pagedrafts": 0,
    "settings": 0,
    "comments": 0,
    "unidentified": 0
  },
};


// ------------------------------------------------------------
// FILE EXISTENCE CHECKS
// ------------------------------------------------------------

if (!sourceFile) {
  log.error(`[ERROR] You must specify the data source - node index.js ./path/to/filename.xml`)
  log.bar();
  process.exit(1);
}

if (!fs.existsSync(sourceFile)) {
  log.error(`[ERROR] Specified data source file not found: ${sourceFile}`);
  log.bar();
  process.exit(2);
}

if (!fs.existsSync(configFile)) {
  log.error(`[ERROR] Config file not found: ${configFile}`);
  log.bar();
  process.exit(3);
}


// ------------------------------------------------------------
// FUNCTIONS FOR LATER
// ------------------------------------------------------------

// This pulls out the Blogger template and writes it to a file.
function processTemplate(item, index) {
  // Index guards against edge case of a blog having more 
  // than one template. Don't think it actually happens.
  var templateFile = `${dirs.data}/template-${index}.xml`;
  fs.writeFileSync(templateFile, item.content["$t"]);
  log.message(`Template saved: ${templateFile}`); 
  blogDetails.contentTypes.templates++;
}

// Process the actual HTML of each blog post,
// using Cheerio for easy jQuery syntax.
function processPostBody(postBody, postId, blogDetails) {
  const $ = cheerio.load(postBody);

  // convert blogger 'more' links back to <!--more-->
  $('a[name="more"]').each(function (i, el) {
    $(this).replaceWith('<!more>');
  });

  // Yoink the images and convert them to local paths.
  $('img[src]').each(function (i, el) {
    let imgSrc = $(this).attr('src');
    let fileName = postId + '-' + imgSrc.split('/').pop();

      if (options.imageExclusionUrls.some(x => imgSrc.includes(x))) {

          imageExcluded.push({
            'postId': postId,
            'imageUrl': imgSrc
          });

      } else if (options.imageUrls.some(x => imgSrc.includes(x))) {

          $(this).attr('src', options.imagePath + fileName);
          imagesToDownload.push({
            source: imgSrc,
            destination: fileName
          });

      } else if ( imgSrc.startsWith('/') || imgSrc.includes(blogDetails.blogUrl) ) {

        // check we have a fallback set
        if ( options.imageRelativeUrl != 'http://your.image.domain/' ) {

          // remove the blog URL from the src string so we can sub in the fallback domain
          if (imgSrc.includes(blogDetails.blogUrl)) {
            imgSrc = imgSrc.slice(blogDetails.blogUrl.length);
          }

          $(this).attr('src', options.imagePath + fileName);

          imagesToDownload.push({
            source: options.imageRelativeUrl + imgSrc,
            destination: fileName
          });
          
        } else {
          imageError.push({
            'postId': postId,
            'imageUrl': imgSrc,
            'error': 'No fallback domain supplied, cannot download this image.'
          });
        }

      } else if ( imgSrc.startsWith('data:') ) {
        // data URIs just get left alone
        dataImages++;

      } else {
        imageSkipped.push({
          'postId': postId,
          'imageUrl': imgSrc,
          'error': 'Image skipped. Not a known exclusion, inclusion or relative image.'
        });
      }

  });

  // cheerio automatically adds html/body so we return the contents of 'body'
  return $('body').html();
}

// Just processes the data, doesn't write to files
function processPostOrPageData(item) {
  var draft = helpers.isDraft(item);
  var postId = helpers.getPostId(item.id);
  var author = helpers.tidyAuthor(item.author);
  var publishedDate = helpers.tidyDate(item.published);
  var updatedDate = helpers.tidyDate(item.updated);
  var postStatus = 'draft';
  var postURL = 'none';
  var postFileName;
  var postLabels = [];
  var postContent = item.content["$t"];
  var postLinks = [];
  var postImages = [];

  if (typeof postContent != 'undefined') {

    // data processing for the post body
    const $ = cheerio.load(postContent);

    // pull out link data
    $('a').each(function (i, el) {
      postLinks.push({
        href: $(this).attr('href'),
        text: $(this).text()
      })
    });

    // pull out image data
    $('img').each(function (i, el) {
      let imgSrc = $(this).attr('src');
      let imgAlt = $(this).attr('alt');
      postImages.push({ 
        src: imgSrc,
        alt: imgAlt
      });
      allImages.push({
        src: imgSrc,
        alt: imgAlt,
        post: postId
      });
    });

    // this goes last as it modifies the content
    postContent = processPostBody(postContent, postId, blogDetails);
  }

  // Add author to overall set
  blogDetails.allAuthors.push(author);

  // Process post labels
  if (JSON.stringify(item.category).includes('ns#')) {
    let len = item.category.length;
    for (var i=0; i < len; i++) {
      var category = item.category[i];
      if (category.scheme.includes('ns#')) {
        postLabels.push(category.term);
        allLabels.push(category.term);
      }
    }
  }

  if (draft) {
    postFileName = `draft-${publishedDate.YYYYMMDD}-${postId}`;
  } else {
    postStatus = 'published';
    postURL = helpers.findRelAlternate(item.link);
    postFileName = postURL.toString().split("/").pop().replace(/\.html/g, '');    
  }

  return {
    'id':           postId,
    'metadata': {
      'title':      item.title["$t"],
      'author':     author,
      'url':        postURL,
      'filename':   postFileName,
      'published':  publishedDate,
      'updated':    updatedDate,
      'status':     postStatus
    },
    'content':      postContent,
    'labels':       postLabels.sort(),
    'comments':     [], // these get added later
    'links':        postLinks,
    'images':       postImages
  }

}

function processPostOrPage(item, type) {
  var draft = helpers.isDraft(item);
  var typeCount;

  if (type === 'post') {
    blogPosts.push(processPostOrPageData(item));
    typeCount = (draft) ? 'blogdrafts' : 'blogs';
  } else if (type === 'page') {
    blogPages.push(processPostOrPageData(item));
    typeCount = (draft) ? 'pagedrafts' : 'pages';
  } else {
    log.error(`Unknown type: ${type}`);
  }
  blogDetails.contentTypes[typeCount]++;
}

function processPost(item) {
  processPostOrPage(item, 'post');
}

function processPage(item) {
  processPostOrPage(item, 'page');
}

function processComment(item) {
  // Both the comment id and the parent id are identified 
  // with post-<id> at the end of the relevant string.
  // Not clear were PID is used but it seems unique as well.
  var comment = {
    'pid':          item['gd:extendedProperty'][0].value.slice(4),
    'id':           helpers.getPostId(item.id),
    'parentItem':   helpers.getPostId(item['thr:in-reply-to'].ref),
    'author':       helpers.tidyAuthor(item.author),
    'published':    helpers.tidyDate(item.published),
    'updated':      helpers.tidyDate(item.updated),
    'content':      item.content['$t']
  }

  // Add each comment to the relevant blog post in the main data.
  // The original data seems to be chronological so we don't need to sort 
  blogPosts[blogPosts.findIndex(x => x.id === comment.parentItem)].comments.push(comment);

  // Add to the separate commenter and comment data
  allCommenters.push(helpers.tidyAuthor(item.author));
  allComments.push(comment);

  blogDetails.contentTypes.comments++;
}

function processSetting(item) {
  setting = {
    'setting': item.id,
    'value': item.content['$t'] || 'Setting not defined in Blogger data.',
    'description': item.title['$t']
  };

  blogSettings.push(setting);

  if (item.id.includes('BLOG_ADMIN_PERMISSION')) {
    blogDetails.emailAddresses.admins = setting['value'];
  }
  if (item.id.includes('BLOG_AUTHOR_PERMISSION')) {
    blogDetails.emailAddresses.authors = setting['value'];
  }
  blogDetails.contentTypes.settings++;
}

// Used for the json files with processed data
function writeDataFile(filename, content, description) {
  fs.writeFileSync(`${dirs.data}/${filename}`, JSON.stringify(content, null, 2));
  log.message(`${description} saved as ${dirs.data}/${filename}`);  
}

// Used for posts and pages
function writeToFile(item, dir, extension, type, draft) {
  var data;
  var filename;

  if (options.structure === 'tree' && type === 'post' && !draft) {
    // create YYYY/MM/DD string
    var tree = item.metadata.published['YYYY-MM-DD'].replace(/-/g, '/');
    filename = `${tree}/${item.metadata.filename}.${extension}`;
    // create the directory so the file will write later
    mkdirp.sync(`${dir}/${tree}/`);

  } else {
    // everything else just gets flat directory structure
    filename = `${item.metadata.published.YYYYMMDD}-${item.metadata.filename}.${extension}`;    
  }

  if (extension === 'html') {
    data = templates.html(item);
  } else if (extension === 'md') {
    data = templates.markdown(item);
  } else {
    log.error(`extension not recognised: ${extension}`)
  }

  fs.writeFileSync(`${dir}/${filename}`, data);
  log.message(`File written: ${filename}`);
}

function writePostsOrPages(data, type) {
  var dirPrefix;
  var dataLen = data.length;
  for (var i = 0; i < dataLen; i++){

    var draft = (data[i].metadata.status === 'draft');

    if (type === 'post') {
      dirPrefix = (draft) ? 'draft-posts' : 'posts';
    } else if (type === 'page') {
      dirPrefix = (draft) ? 'draft-pages' : 'pages';
    }

    writeToFile(data[i], dirs[dirPrefix+'-html'], 'html', type, draft);
    writeToFile(data[i], dirs[dirPrefix+'-markdown'], 'md', type, draft);
  }
}

// https://gist.github.com/kethinov/6658166
function walkSync(dir, filelist) {
  var path = path || require('path');
  var fs = fs || require('fs'),
    files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    } else {
      filelist.push(file);
    }
  });
  return filelist;
}

// ------------------------------------------------------------
// READING PHASE
// ------------------------------------------------------------

log.bar();
log.message('Blogger conversion started.');

// This is where we actually kick off and start doing stuff
fs.readFile(sourceFile, prepData);
function prepData (err, data) {
  if(err) { return console.log(err); }
  // Create raw JSON with xml2json
  json = parser.toJson(data);
  // Create tidy JSON to work with
  parsed = JSON.parse(json);
  log.message(`Data prepped from ${sourceFile}`);
  loadOptions();
}

// callback baton race ;)
function loadOptions() {
  fs.readFile(configFile, prepOptions);
}
function prepOptions(err, data) {
  if(err) { return console.log(err); }
  options = JSON.parse(data);
  log.message(`Options read from ${configFile}`);
  processData();
}

// ------------------------------------------------------------
// PROCESSING PHASE
// ------------------------------------------------------------
function processData() {
  var bloggerTag = 'tag:blogger.com,1999';

  // Top level data items
  blogDetails.blogIDfull = parsed.feed.id;
  blogDetails.blogID = parsed.feed.id.match(/(?:blog-)(\d*)/)[1];
  blogDetails.blogUrl = helpers.findRelAlternate(parsed.feed.link);
  blogDetails.blogAuthor = helpers.tidyAuthor(parsed.feed.author);
  blogDetails.blogTitle = parsed.feed.title["$t"];

  if (!parsed.feed.id.includes(bloggerTag)) {
    log.error(`!!!!!!!!!!`);
    log.error(`ID does not contain "${bloggerTag}", which suggests either the source file isn't a Blogger archive; or Blogger has changed their data format. All files that were tested included "${bloggerTag}" so it's unknown if your file will work. Script will attempt conversion but may fail.`)
    log.error(`!!!!!!!!!!`);
  }

  // It's a bit 'hello world' but we're up and running
  log.message(`Processing data for ${blogDetails.blogTitle}`);

  // Creates a subdirectory based on the blog's title.
  outputDir = `${__dirname}/output/${blogDetails.blogTitle.replace(/\s+/g, '')}`

  // 10 is a dumb way to check we've got more than just '/output/' 
  // in the variable. Or some other disaster like an empty var
  // being fed to rimraf. Which, you know, deletes stuff.
  if (outputDir.length > 10) {
    log.warning(`Fresh build: deleting ${outputDir}`);
    rimraf.sync(outputDir);
    log.warning('Output cleared.')
  }

  // define a bunch of directories
  dirs = {
    'output':               outputDir,
    'data':                 `${outputDir}/data`,
    'images':               `${outputDir}/images`,
    'images-temp':          `${__dirname}/output/${blogDetails.blogTitle.replace(/\s+/g, '')}-images`,

    'posts':                `${outputDir}/posts`,
    'posts-html':           `${outputDir}/posts/html`,
    'posts-markdown':       `${outputDir}/posts/markdown`,

    'draft-posts':          `${outputDir}/draft-posts`,
    'draft-posts-html':     `${outputDir}/draft-posts/html`,
    'draft-posts-markdown': `${outputDir}/draft-posts/markdown`,

    'pages':                `${outputDir}/pages`,
    'pages-html':           `${outputDir}/pages/html`,
    'pages-markdown':       `${outputDir}/pages/markdown`,

    'draft-pages':          `${outputDir}/draft-pages`,
    'draft-pages-html':     `${outputDir}/draft-pages/html`,
    'draft-pages-markdown': `${outputDir}/draft-pages/markdown`,
  }
  // make the directories
  for (var key in dirs) {
    mkdirp.sync(dirs[key]);
  }

  // identify the type of entry and process accordingly
  entriesCount = Object.keys(parsed.feed.entry).length;
  for (var i = 0; i < entriesCount; i++){
    var item = parsed.feed.entry[i];
    switch (true) {

      case helpers.categoryIncludes(item.category, "#comment"):
        processComment(item);
        break;

      case helpers.categoryIncludes(item.category, "#post"):
        processPost(item);
        break;

      case helpers.categoryIncludes(item.category, "#page"):
        processPage(item);
        break;

      case helpers.categoryIncludes(item.category, "#settings"):
        processSetting(item);
        break;

      case helpers.categoryIncludes(item.category, "#template"):
        processTemplate(item, i);
        break;

      default:
        blogDetails.contentTypes.unidentified++;
        log.error(`Unidentified type: ${JSON.stringify(item,null,2)}`);
    }
  }


  // ------------------------------------------------------------
  // WRITING PHASE
  // ------------------------------------------------------------

  // We have to come back and do this in a second pass, to get the comments.
  writePostsOrPages(blogPosts, 'post');
  writePostsOrPages(blogPages, 'page');

  // de-dupe authors. If names are unique you could use those.
  // don't use email as blogger puts in a noreply address.
  blogDetails.allAuthors = helpers.removeDuplicates(blogDetails.allAuthors, 'url');
  allLabels = allLabels.sort();

  log.bar();
  log.message('DATA FILES WRITTEN')
  log.bar();
  writeDataFile('output-raw.json',        json,           'Raw JSON');
  writeDataFile('blog-labels.json',       allLabels,      'Blog labels');
  writeDataFile('blog-details.json',      blogDetails,    'Blog details');
  writeDataFile('blog-settings.json',     blogSettings,   'Blog settings');
  writeDataFile('blog-posts.json',        blogPosts,      'Blog posts');
  writeDataFile('blog-pages.json',        blogPages,      'Blog pages');
  writeDataFile('blog-commenters.json',   allCommenters,  'Blog commenters');
  writeDataFile('blog-comments.json',     allComments,    'Blog comments');
  writeDataFile('blog-images.json',       allImages,      'Blog images');
  writeDataFile('image-errors.json',      imageError,     'Unreachable images');
  writeDataFile('image-excluded.json',    imageExcluded,  'Excluded images');
  writeDataFile('image-skipped.json',     imageSkipped,   'Skipped images');
  writeDataFile('image-downloaded.json',  imagesToDownload, 'Downloaded images');


  // ------------------------------------------------------------
  // SITEMAP DOWNLOAD
  // ------------------------------------------------------------

  log.bar();
  log.message('SITEMAP DOWNLOADS')
  log.bar();
  console.log('blogDetails.blogUrl', blogDetails.blogUrl)
  sitemaps.downloadSitemap(blogDetails.blogUrl, dirs.data);

  // ------------------------------------------------------------
  // IMAGE DOWNLOAD
  // ------------------------------------------------------------

  log.bar();
  log.message('IMAGE DOWNLOADS')
  log.bar();

  downloadCount = 1;

  log.message(`Downloading ${imagesToDownload.length} images`)
  imagesToDownload.forEach( function(element, index) {

    let source = element.source;
    let tempDestination = `${dirs['images-temp']}/${element.destination}`;
    let destination = `${dirs['images']}/${element.destination}`;
    let fileName = destination.split('/').pop();

    if (!fs.existsSync(tempDestination)) {
      log.message(`Downloading ${index}/${downloadCount}: ${source}`);      
      // this doesn't follow redirects as many image redirects do things you don't want 
      // (eg. downloading a bunch of bandwidth or hotlink error images)
      // in some cases setting curl -L may work better.
      execSync(`curl --silent ${source} > ${tempDestination}`, function(err, stdout, stderr) {
       if (err) { console.log(err) }
       if (stderr) { console.log(stderr) }
      });
      log.message(`Downloaded ${index}/${downloadCount}: ${fileName}`);      
    }

    fs.copyFileSync(tempDestination, destination, (err) => {
      if (err) throw err;
    });
    log.message(`${downloadCount}/${imagesToDownload.length}: copied ${fileName} from download cache`);

    downloadCount++;

  });

  // ------------------------------------------------------------
  // CHECKING PHASE
  // ------------------------------------------------------------

  // How many files got written and does that match the number found in the data? 
  function checkCount(dir, expected, description) {
    var actual = walkSync(dir).length;
    if (actual === expected) {
      log.success(`✔ ${description} count correct. Found ${expected}, wrote ${actual}`);
    } else {
      log.error(`✘ ${description} count not correct. Found ${expected}, wrote ${actual}`);
    }
  }

  log.bar();
  log.message('CONVERSION COUNT CHECK')
  log.bar();
  checkCount(dirs['posts-html'],            blogDetails.contentTypes.blogs,       'HTML: Blog post');
  checkCount(dirs['draft-posts-html'],      blogDetails.contentTypes.blogdrafts,  'HTML: Blog draft');
  checkCount(dirs['pages-html'],            blogDetails.contentTypes.pages,       'HTML: Page');
  checkCount(dirs['draft-pages-html'],      blogDetails.contentTypes.pagedrafts,  'HTML: Page draft');

  checkCount(dirs['posts-markdown'],        blogDetails.contentTypes.blogs,       'Markdown: Blog post ');
  checkCount(dirs['draft-posts-markdown'],  blogDetails.contentTypes.blogdrafts,  'Markdown: Blog draft');
  checkCount(dirs['pages-markdown'],        blogDetails.contentTypes.pages,       'Markdown: Page');
  checkCount(dirs['draft-pages-markdown'],  blogDetails.contentTypes.pagedrafts,  'Markdown: Page draft');


  // ------------------------------------------------------------
  // SUMMARY PHASE
  // ------------------------------------------------------------

  log.bar();
  log.message('SUMMARY')
  log.bar();
  log.success(`Processed ${entriesCount} items for "${blogDetails.blogTitle}"`);
  log.warning(`Cross check the number of posts, pages and drafts against the numbers you see in Blogger's web interface. This tool only checks that it converted the same number of items it found in the data; it can not check this was the right number in your original blog.`)
  log.success(`It's also recommended that you manually explore the contents of ${dirs.output} as that will give you the best idea if you are happy with the output.`)

  log.message(`Posts and pages:`)
  log.message(JSON.stringify(blogDetails.contentTypes, null, 2));

  log.message(`Images:`)
  log.message(`  ${allImages.length} total images found.`)
  log.message(`  ${imagesToDownload.length} of those identified as images that should be downloaded.`)
  log.message(`  ${dataImages} data URI images (preserved).`)
  if (imageSkipped.length > 0) {
    log.warning(`  ${imageSkipped.length} images skipped, review images-skipped.json for details.`);
  } else {
    log.message(`  ${imageSkipped.length} images skipped.`);
  }
  log.message(`  ${imageExcluded.length} excluded from download.`)
  if (imageError.length > 0) {
    log.error(`  ${imageError.length} unreachable images - you will need to download these manually and update links manually. Refer to image-errors.json for details. If you have not set your image fallback URL, this may help with some images.`);
  } else {
    log.message(`  ${imageError.length} unreachable images.`);    
  }
  log.warning(`  You should review the images to ensure they all downloaded successfully.`)

  imagesProcessed = imagesToDownload.length + imageSkipped.length + imageExcluded.length + imageError.length + dataImages;
  if (allImages.length !== imagesProcessed) {
    log.error(`ERROR: ${allImages.length} found but ${imagesProcessed} were processed.`)
  } else {
    log.message(`  ${allImages.length} found, ${imagesProcessed} processed.`)    
  }

  if (blogDetails.contentTypes.unidentified > 0) {
    log.error(`[ERROR] ${blogDetails.contentTypes.unidentified} items could not be processed. Check the logs for details.`)
  }

  log.success(`Blogger conversion finished. Review the summary and note the manual steps recommended.`)
  log.bar();
}