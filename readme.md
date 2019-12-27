[![Known Vulnerabilities](https://snyk.io/test/github/cheshrkat/blogger-archive-converter/badge.svg?targetFile=package.json)](https://snyk.io/test/github/cheshrkat/blogger-archive-converter?targetFile=package.json)

# Blogger Archive Converter

Processes Blogger archive XML files into HTML, Markdown and JSON files. Meaning you can convert...

* Blogger to HTML
* Blogger to Markdown (noting the body content remains HTML, it is not a full markdown conversion)
* Blogger to JSON

It also...

* extracts the display template
* extracts a list of commenters to JSON
* extracts a list of contributors to JSON
* extracts a list of labels to JSON
* extracts a list of images and their associated blog ID; also provided are JSON files mapping the old URL to the new file
* downloads images hosted on blogspot (you can allow and block other domains in the config)
* downloads the XML sitemap file(s)

## Intended use cases

This tool will help you migrate content from Blogger to a new solution. It is not a drop-in solution for any specific blog tool, the idea is to generate source files you can copy and paste into your new blog project.

Be aware this is a pretty rough conversion so you must inspect the output yourself before you rely on it. The project has been hacked together in holiday breaks, has no tests and generally... use at your own risk ;)

I expect most people will want to customise:

* settings in `config.json`
* rendering templates in `_templates.js`

Likely uses for each format:

* Markdown is used a ton of static site generators, noting they may all need differently-formatted frontmatter
* JSON is a common format and easier to work with than Blogger's XML
* HTML is provided more to inspect the conversion than anything else, although it does create a quite clean archive. If you want HTML fragments, edit the templates to remove what you don't need.

If you aren't migrating to a new tool and just want to store a static HTML copy of your site _as it was published_, I'd suggest you download a copy with wget instead:

```
wget --limit-rate=200k --no-clobber --convert-links --random-wait -r -p -E -e robots=off -U mozilla http://www.example.com
``` 

## Instructions

You will need to use a bash terminal like OSX Terminal or WSL on Windows 10. This will not work in anything else as it calls out to `curl`.

### Export your blog to XML

Log in to Blogger, then go to Settings - Other, then choose Back Up Content to download the XML file. You can also use Google Takeout to export your Blog in ATOM format. This tool should be able to read both, although it has mostly been tested with content exported from the Blogger web UI (not Takeout).

### Setup

1. Clone or download this repo
2. Ensure NodeJS is installed
  * If you have [NVM](https://github.com/creationix/nvm) just run `nvm install && nvm use` 
  * Otherwise check the `.nvmrc` file in this repo and [install that version](https://nodejs.org/en/download/)
3. Run `npm install` from the root of the repo

### Usage

After setup is done, run this in your bash terminal:

```
npm run bloggerconvert <filename>
```

...where `<filename>` is either a downloaded XML file from Blogger's interface, or an .atom file from Google Takeout (eg. `node index.js blog-01-01-2018.xml`).

To change configuration, edit `config.json`. Options:

* *structure*: tree (default) | flat
** flat: blog posts are all generated in one directory
** tree: blog posts are generated in a `YYYY/MM/DD` directory tree
* *imagePath*: the path to images in your final blog, used in the `src` attribute of `img` elements.
* *imageUrls*: array of substrings, if an `img src` contains matches any of the substrings it will be downloaded. 
* *imageExclusionUrls*: array of substrings, if any match that image will be excluded from download.
* *imageRelativeUrl*: since Blogger changed to hosted-only, relative images are handled with a fallback URL. You can check this setting in Blogger settings -> basic -> blog address (edit) -> Fallback subdomain (CNAME).

Notes:

* All generated files will be in `/output/blogname/`
* Old output for each blog is deleted every time you run the tool. This is to ensure each run is clean if you change anything.
* If you need multiple conversions of the same site, you will need to make copies manually between runs.

## Images

*IMPORTANT - READ THIS! - the image downloader is very very simple (ie. dumb as rocks), does not follow redirects or retry etc, and you MUST check the validity of downloaded images. DO NOT ASSUME THEY HAVE WORKED.* 

If an image has not downloaded correctly, the easiest thing to do is delete it from the image cache and run the script again. Anything from a network timeout to a legitimate error can cause a failed download. If repeated attempts fail, you will need to manually download images or at the least manually test one of the failed URLs.

If you do not edit `config.json`, all images hosted on blogpot URLs will be downloaded; and IMG elements in blog posts will be updated to link to the downloads. As each blog tool will have a different path to image storage, you need to edit the `imagePath` option to suit your target system.

If you want to download images from other domains, or exclude certain domains, there are options for that as well.

Images are stored in a local cache that is not deleted between runs, so if you do multiple downloads you don't smash your connection each time. This does mean that failed downloads may create an empty file. As stated above, you really must manually check your images!

## Output Formats

### HTML

By default HTML is written with a very simple HTML5 wrapper. It does *not* apply the Blogger template, as that's a proprietary format and not worth reproducing. To perhaps state the obvious, if you _really_ want to use Blogger templating you should probably stay on Blogger. If you simply want to preserve a read-only copy of your Blogger site in its original format, it would be better to download a copy with `wget` (see instructions above).

### Markdown with front matter

Post content is not parsed to Markdown, it is injected as raw HTML. If you need true Markdown, you will need to convert the extracted HTML yourself. However if you just need to repost the old content without editing it, this probably isn't necessary.

Markdown files contain frontmatter in YAML format:

```
---
key: value
key: value
key:
  - value
  - value
---
```

This frontmatter format is used in many popular static site generators like Hugo, Hexo, etc. You will need to choose the way you want to render labels into tags or categories.

`${module.exports.renderCategories(labels)}` renders labels in this format:

```
categories: 
  - foo
  - bar
  - baz
```

`${module.exports.renderTags(labels)}` renders labels in this format:

```
tags: ["foo","bar","baz"]
```

Example Hexo frontmatter:

```
---
title:      ${post.metadata.title}
date:       ${post.metadata.published.tidyISO}
updated:    ${post.metadata.updated.tidyISO}
categories: ${module.exports.renderCategories(labels)}  
tags:       ${module.exports.renderTags(labels)}    
permalink:  ${post.metadata.url}
---
```

Example Hugo frontmatter:

```
---
title:      ${post.metadata.title}
date:       ${post.metadata.published.tidyISO}
lastmod:    ${post.metadata.updated.tidyISO}
categories: ${module.exports.renderCategories(labels)}  
tags:       ${module.exports.renderTags(labels)}    
slug:       ${post.metadata.url}
---
```

To set up your target blog's exact format, refer to 'customising the output' below.

### JSON

While a direct conversion of Blogger's XML to JSON is possible (in fact this tool is based on it), it's not clean due to the flat data structure of Blogger's archive format. This tool gives a set of 'tidied up' JSON files that should be easier to work with.

## Customising the output

### Output templates

Output templates are in `_templates.js`. The file uses ES6 template literals to provide a very simple templating solution. When called, they are passed the data for a single post or page - so anything you can see in those data files is available for use.

### Modifying post contents

You can modify the HTML/contents of posts using [Cheerio](https://cheerio.js.org). Look for `processPostBody` in `index.js`. 

### Comments

Comments are included in the output as raw HTML, with a heading at the top noting how many comments and a note at the end that comments are closed. To generate without comments or modify any of these specifics, just remove them from the templates and run the conversion again.

If you need more-complex comment conversion, you will need to take care of that yourself - it's beyond the scope of this conversion tool.

## Troubleshooting

Generally speaking the script will try to tell you about problems.

If you are getting NodeJS errors (particularly `binding` errors), the first step is to ensure you are using a compatible version of Node. Check the `.nvmrc` file in the repo root; or [install NVM](https://github.com/creationix/nvm) and run `nvm install && nvm use` in the root of this repository.

If trouble persists, try deleting `node_modules` and doing a fresh `npm install` - it's node's version of turning it off and then on again... but it often works.

## License

MIT.

## Things that might get added later

But don't be waiting for it to happen, if you need them right away DIY or submit a pull request...

- create option to base64 encode all images
- add an index file for the HTML export
