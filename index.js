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
const path = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const minimist = require('minimist');
const { XMLParser } = require('fast-xml-parser');
const xmlParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '$t',
  // https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/docs/v4%2C%20v5/5.Entities.md
  processEntities: {
    maxEntitySize: 1000000,
    maxTotalExpansions: 1000000,
  },
  // Ensure commonly repeated nodes are returned as arrays
  isArray: (name) => {
    return ['entry', 'category', 'link', 'gd:extendedProperty', 'sitemap'].includes(name);
  }
};
const parser = new XMLParser(xmlParserOptions);
const countFiles = require('count-files');
const cheerio = require('cheerio');
const execFileSync = require('child_process').execFileSync;

const cliArgs = minimist(process.argv.slice(2));
const sourceFile = cliArgs._[0];
const outputBase = path.resolve(cliArgs.output || path.join(__dirname, 'output'));
const configFile = './config.json';
const templates = require('./_templates.js');
const log = require('./_logging.js');
const helpers = require('./_helpers.js');
const sitemaps = require('./_sitemap.js');

const sourceFileFormat = sourceFile.split('.').pop().toLowerCase();
const atomMode = (sourceFileFormat === 'atom') ? true : false;
const xmlMode = (sourceFileFormat === 'xml') ? true : false;

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
var imageDownloadPause = 5000;

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
  fs.writeFileSync(templateFile, item.content["$t"] || item.content);
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

function isValidImageFile(filePath, contentType = '') {
  if (!fs.existsSync(filePath)) return false;

  const file = fs.openSync(filePath, 'r');
  const data = Buffer.alloc(512);
  let bytesRead;
  try {
    bytesRead = fs.readSync(file, data, 0, data.length, 0);
  } finally {
    fs.closeSync(file);
  }
  if (bytesRead === 0) return false;
  const headerData = data.subarray(0, bytesRead);

  const isKnownImage =
    (headerData[0] === 0xff && headerData[1] === 0xd8 && headerData[2] === 0xff) ||
    headerData.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    ['GIF87a', 'GIF89a'].includes(headerData.subarray(0, 6).toString()) ||
    (headerData.subarray(0, 4).toString() === 'RIFF' && headerData.subarray(8, 12).toString() === 'WEBP') ||
    headerData.subarray(0, 2).toString() === 'BM' ||
    ['II*\u0000', 'MM\u0000*'].includes(headerData.subarray(0, 4).toString()) ||
    headerData.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0x01, 0x00])) ||
    (headerData.subarray(4, 8).toString() === 'ftyp' && ['avif', 'avis'].includes(headerData.subarray(8, 12).toString()));
  if (isKnownImage) return true;

  const header = headerData.toString('utf8').trimStart();
  if (/^(?:<svg\b|<\?xml\b[\s\S]*?<svg\b)/i.test(header)) return true;
  if (/^image\//i.test(contentType)) return true;

  // Unknown binary formats may still be valid images, but text error pages are not.
  return headerData.some(byte => byte === 0 || byte < 9 || (byte > 13 && byte < 32));
}

function getRetryAfterDelay(headers) {
  const responseBlocks = headers.split(/(?=HTTP\/\S+\s+\d{3})/i);
  const responseBlock = responseBlocks.filter(block => /^HTTP\/\S+\s+\d{3}/i.test(block)).pop();
  if (!responseBlock || !/^HTTP\/\S+\s+429\b/i.test(responseBlock)) return null;

  const retryAfter = responseBlock.match(/^Retry-After:\s*(.+)\s*$/im);
  if (!retryAfter) return null;

  const value = retryAfter[1].trim();
  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return Number.isSafeInteger(seconds) && seconds <= Number.MAX_SAFE_INTEGER / 1000 ? seconds * 1000 : null;
  }

  const retryAt = Date.parse(value);
  return Number.isNaN(retryAt) ? null : Math.max(0, retryAt - Date.now());
}

function waitFor(milliseconds) {
  const waitArray = new Int32Array(new SharedArrayBuffer(4));
  while (milliseconds > 0) {
    const waitChunk = Math.min(milliseconds, 2147483647);
    Atomics.wait(waitArray, 0, 0, waitChunk);
    milliseconds -= waitChunk;
  }
}

function isDraft(item) {
  return helpers.isDraft(item) || (atomMode && item['blogger:status'] === 'DRAFT');
}

function tidyItemDate(date) {
  const tidyDate = helpers.tidyDate(date);
  if (atomMode && date.endsWith('Z')) {
    tidyDate.tidyISO += 'Z';
  }
  return tidyDate;
}

// Just processes the data, doesn't write to files
function processPostOrPageData(item) {
  var draft = isDraft(item);
  var postId = helpers.getPostId(item.id);
  var author = helpers.tidyAuthor(item.author);
  var publishedDate = tidyItemDate(item.published);
  var updatedDate = tidyItemDate(item.updated);
  var postStatus = 'draft';
  var postURL = 'none';
  var postFileName;
  var postLabels = [];
  var postContent = item.content["$t"] || item.content;
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

  // Process post labels from XML namespace categories or Atom Blogger categories.
  if (item.category) {
    let len = item.category.length;
    for (var i=0; i < len; i++) {
      var category = item.category[i];
      if (category.scheme && (category.scheme.includes('ns#') || category.scheme.startsWith('tag:blogger.com,1999:blog-')) && category.term) {
        postLabels.push(category.term);
        allLabels.push(category.term);
      }
    }
  }

  if (draft) {
    postFileName = `draft-${publishedDate.YYYYMMDD}-${postId}`;
  } else {
    postStatus = 'published';
    if (atomMode) {
      const postPath = item['blogger:filename'];
      if (typeof postPath !== 'string' || !postPath) {
        throw new Error(`Published Atom entry ${postId} does not have a Blogger filename`);
      }
      postURL = new URL(postPath, blogDetails.blogUrl).toString();
    } else {
      postURL = helpers.findRelAlternate(item.link);
    }
    postFileName = postURL.toString().split("/").pop().replace(/\.html/g, '');    
  }

  return {
    'id':           postId,
    'metadata': {
      'title':      item.title["$t"] || item.title,
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
  var draft = isDraft(item);
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

  let comment;
  if(atomMode) {
    comment = {
      // No PID in atom
      'id': helpers.getPostId(item.id),
      'parentItem': helpers.getPostId(item['blogger:parent']),
      'author': helpers.tidyAuthor(item.author),
      'published': tidyItemDate(item.published),
      'updated': tidyItemDate(item.updated),
      'content': item.content['$t'] || item.content
    }
  } else if (xmlMode) {
    // Both the comment id and the parent id are identified 
    // with post-<id> at the end of the relevant string.
    // Not clear were PID is used but it seems unique as well.
    comment = {
      'pid': item['gd:extendedProperty'][0].value.slice(4),
      'id': helpers.getPostId(item.id),
      'parentItem': helpers.getPostId(item['thr:in-reply-to'].ref),
      'author': helpers.tidyAuthor(item.author),
      'published': tidyItemDate(item.published),
      'updated': tidyItemDate(item.updated),
      'content': item.content['$t'] || item.content
    }
  } else {
    throw new Error(`Cannot process comment from unknown source format: ${sourceFileFormat}`);
  }

  // The Atom export may list comments before their parent posts.
  allCommenters.push(helpers.tidyAuthor(item.author));
  allComments.push(comment);

  blogDetails.contentTypes.comments++;
}

function processSetting(item) {
  setting = {
    'setting': item.id,
    'value': item.content['$t'] || item.content || 'Setting not defined in Blogger data.',
    'description': item.title['$t'] || item.title
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
  // Create raw JSON (string) and parsed object using fast-xml-parser
  parsed = parser.parse(data.toString('utf8'));
  json = JSON.stringify(parsed);
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

  if(atomMode) {
    log.warning(`Atom files do not contain the blog URL, so it must be provided in config.json. If you don't override the default value, your export won't work.`);
    blogDetails.blogUrl = options.blogUrl;
  } else if (xmlMode) {
    blogDetails.blogUrl = helpers.findRelAlternate(parsed.feed.link);
  } else {
    log.error(`Unknown source file format: ${sourcefileFormat}. Must be .atom or .xml`);
    process.exit(4);
  }

  // Top level data items
  blogDetails.blogIDfull = parsed.feed.id;
  blogDetails.blogID = parsed.feed.id.match(/(?:blog-)(\d*)/)[1];
  blogDetails.blogAuthor = helpers.tidyAuthor(parsed.feed.author);
  blogDetails.blogTitle = parsed.feed.title["$t"] || parsed.feed.title;

  if (!parsed.feed.id.includes(bloggerTag)) {
    log.error(`!!!!!!!!!!`);
    log.error(`ID does not contain "${bloggerTag}", which suggests either the source file isn't a Blogger archive; or Blogger has changed their data format. All files that were tested included "${bloggerTag}" so it's unknown if your file will work. Script will attempt conversion but may fail.`)
    log.error(`!!!!!!!!!!`);
  }

  // It's a bit 'hello world' but we're up and running
  log.message(`Processing data for ${blogDetails.blogTitle}`);

  // Creates a subdirectory based on the blog's title.
  outputDir = path.join(outputBase, blogDetails.blogTitle.replace(/\s+/g, ''));

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
    'images-temp':          path.join(outputBase, `${blogDetails.blogTitle.replace(/\s+/g, '')}-images`),

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
  for (var i = 0; i < entriesCount; i++) {
    var item = parsed.feed.entry[i];
    switch (true) {

      case (item['blogger:type'] === 'COMMENT') || helpers.categoryIncludes(item.category, "#comment"):
        processComment(item);
        break;

      case (item['blogger:type'] === 'POST') || helpers.categoryIncludes(item.category, "#post"):
        processPost(item);
        break;

      case (item['blogger:type'] === 'PAGE') || helpers.categoryIncludes(item.category, "#page"):
        processPage(item);
        break;

      case (item['blogger:type'] === 'SETTINGS') || helpers.categoryIncludes(item.category, "#settings"):
        processSetting(item);
        break;

      case (item['blogger:type'] === 'TEMPLATE') || helpers.categoryIncludes(item.category, "#template"):
        processTemplate(item, i);
        break;

      default:
        blogDetails.contentTypes.unidentified++;
        log.error(`Unidentified type: ${JSON.stringify(item, null, 2)}`);
    }
  }

  // Attach comments after all posts have been collected, since Atom feeds can
  // place comments before their parent posts.
  allComments.sort((first, second) => {
    return Date.parse(first.published.timestamp) - Date.parse(second.published.timestamp);
  });
  allComments.forEach((comment) => {
    const parentPost = blogPosts.find(post => post.id === comment.parentItem);
    if (!parentPost) {
      throw new Error(`Could not find parent post ${comment.parentItem} for comment ${comment.id}`);
    }
    parentPost.comments.push(comment);
  });

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
    let tempDestination = path.join(dirs['images-temp'], element.destination);
    let destination = path.join(dirs['images'], element.destination);
    let fileName = path.basename(destination);
    let downloadDestination = `${tempDestination}.download`;
    let responseHeaders = `${downloadDestination}.headers`;

    if (fs.existsSync(tempDestination) && !isValidImageFile(tempDestination)) {
      log.warning(`Discarding invalid cached image: ${tempDestination}`);
      fs.unlinkSync(tempDestination);
    }

    if (!fs.existsSync(tempDestination)) {
      log.message(`Downloading ${index}/${downloadCount}: ${source}`);
      try {
        let retryCount = 0;
        while (true) {
          try {
            if (imageDownloadPause > 0) {
              log.message(`Waiting ${imageDownloadPause} ms before image download attempt.`);
            }
            waitFor(imageDownloadPause);

            if (fs.existsSync(downloadDestination)) fs.unlinkSync(downloadDestination);
            if (fs.existsSync(responseHeaders)) fs.unlinkSync(responseHeaders);

            const response = execFileSync('curl', [
              '--fail',
              '--location',
              '--silent',
              '--show-error',
              '--dump-header',
              responseHeaders,
              '--output',
              downloadDestination,
              '--write-out',
              '%{http_code}\\n%{content_type}',
              source
            ], { encoding: 'utf8' });
            const [statusCode, contentType] = response.trim().split(/\r?\n/);

            if (!/^2\d\d$/.test(statusCode)) {
              throw new Error(`Unexpected HTTP status ${statusCode || 'unknown'}`);
            }
            if (!isValidImageFile(downloadDestination, contentType)) {
              throw new Error(`Response was not a valid image (content type: ${contentType || 'unknown'})`);
            }

            fs.renameSync(downloadDestination, tempDestination);
            log.message(`Downloaded ${index}/${downloadCount}: ${fileName}`);
            break;
          } catch (error) {
            const headers = fs.existsSync(responseHeaders) ? fs.readFileSync(responseHeaders, 'utf8') : '';
            const retryAfterDelay = getRetryAfterDelay(headers);
            if (retryAfterDelay !== null && retryCount === 0) {
              log.warning(`Received HTTP 429 for ${source}; retrying after ${retryAfterDelay} ms as requested by Retry-After.`);
              waitFor(retryAfterDelay);
              retryCount++;
              continue;
            }
            throw error;
          }
        }
      } catch (error) {
        if (fs.existsSync(downloadDestination)) {
          fs.unlinkSync(downloadDestination);
        }
        if (fs.existsSync(responseHeaders)) {
          fs.unlinkSync(responseHeaders);
        }
        const detail = error.stderr ? error.stderr.toString().trim() : error.message;
        const message = `Image download failed: ${detail}`;
        imageError.push({
          'postId': element.destination.split('-')[0],
          'imageUrl': source,
          'error': message
        });
        log.error(`${message} (${source})`);
        downloadCount++;
        return;
      }
      if (fs.existsSync(responseHeaders)) {
        fs.unlinkSync(responseHeaders);
      }
    }

    fs.copyFileSync(tempDestination, destination);
    log.message(`${downloadCount}/${imagesToDownload.length}: copied ${fileName} from download cache`);

    downloadCount++;

  });
  writeDataFile('image-errors.json', imageError, 'Unreachable images');

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
    log.warning(`  ${imageSkipped.length} images skipped, review ${dirs.data}/images-skipped.json for details.`);
  } else {
    log.message(`  ${imageSkipped.length} images skipped.`);
  }
  log.message(`  ${imageExcluded.length} excluded from download.`)
  if (imageError.length > 0) {
    log.error(`  ${imageError.length} unreachable images - you will need to download these manually and update links manually. Refer to ${dirs.data}/image-errors.json for details. It may help to try setting your image fallback URL if you have not done so.`);
  } else {
    log.message(`  ${imageError.length} unreachable images.`);    
  }
  log.warning(`  You should review the images to ensure they all downloaded successfully.`)

  imagesProcessed = imagesToDownload.length + imageSkipped.length + imageExcluded.length + dataImages;
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