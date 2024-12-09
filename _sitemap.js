const execSync = require('child_process').execSync;
const fs = require('fs');
const log = require('./_logging.js');
const { XMLParser } = require('fast-xml-parser');

const xmlParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '$t',
  isArray: (name) => {
    return ['sitemap', 'url'].includes(name);
  }
};
const parser = new XMLParser(xmlParserOptions);

module.exports = {

  // downloadSitemap(blogDetails.blogUrl, dirs.data)
  downloadSitemap: function(blogUrl, siteMapDir) {

    const siteMapURL = `${blogUrl}sitemap.xml`;

    log.message(`Attempting to download ${siteMapURL}`);

    // -L to follow redirects
    const siteMapData = execSync(`curl -L --silent ${siteMapURL}`, function(err, stdout, stderr) {
      if (err) { console.log(err) }
      if (stderr) { console.log(stderr) }
    });

    const siteMapXML = siteMapData.toString("utf8");
    const siteMapJSON = parser.parse(siteMapXML);

    fs.writeFileSync(`${siteMapDir}/sitemap.xml`, siteMapXML);
    log.message(`File written: ${siteMapDir}/sitemap.xml`);  

    if('sitemapindex' in siteMapJSON) {
      console.log('sitemapindex found, downloading paged sitemaps')

      let len = siteMapJSON.sitemapindex.sitemap.length || 0;

      for (var i = 0; i < len; i++){
        const url = siteMapJSON.sitemapindex.sitemap[i].loc;
        console.log(`Downloading ${url}`)

        const siteMapPage = execSync(`curl --silent ${url}`, function(err, stdout, stderr) {
          if (err) { console.log(err) }
          if (stderr) { console.log(stderr) }
        });

        fs.writeFileSync(`${siteMapDir}/sitemap-page${i+1}.xml`, siteMapPage.toString('utf8'));

      }

      console.log('finished downloading paged sitemaps')

    } else if ('urlset' in siteMapJSON) {  
      console.log('urlset found in sitemap, no further data to download')
    } else {
      console.log('Unknown format. Inspect downloaded sitemap to see if you need to download more.')
    }

  }

};
