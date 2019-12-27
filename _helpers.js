module.exports = {

  // This is for digging out the actual URL from blogger's data
  findRelAlternate: function(obj) {
    let len = obj.length || 0;
    for (var li = 0; li < len; li++){
      if ( obj[li].rel === "alternate" ) {
        return obj[li].href;
      }
    }
  },

  // https://stackoverflow.com/questions/2218999/remove-duplicates-from-an-array-of-objects-in-javascript
  removeDuplicates: function(originalArray, prop) {
    var newArray = [];
    var lookupObject  = {};
    for(var i in originalArray) {
      lookupObject[originalArray[i][prop]] = originalArray[i];
    }
    for(i in lookupObject) {
      newArray.push(lookupObject[i]);
    }
    return newArray;
  },

  // Pull out the author data we actually want.
  tidyAuthor: function tidyAuthor(author) {
    return {
      'name':     author.name,
      'url':      author.uri,
      'email':    author.email,
      'avatar':     author['gd:image'].src
    };
  },

  // Set up a variety of date formats to make things easier later.
  tidyDate: function(date) {
    // All blogger dates seem to be in the format 2006-02-06T19:09:00.002+11:00
    // so while I wouldn't recommend this elsewhere, we'll just rely on that.
    return {
      'timestamp':  date,
      'YYYY-MM-DD': date.slice(0, 10),
      'HH:MM:SS':   date.slice(11, 19),
      'tidyISO':    date.slice(0, 19).replace(/T/g, ' '),
      'YYYYMMDD':   date.slice(0, 10).replace(/-/g, '')
    }
  },

  // Post IDs are 18 chars and prefixed by post- or page-
  getPostId: function(str) {
    var postType;
    if (str.includes('post-')) {
      postType = 'post-';
    } else if (str.includes('page-')) {
      postType = 'page-';
    } else {
      log.error(`Could not find item ID in: ${str}`);
    }
    return str.slice(str.indexOf(postType) + 5)
  },

  // Categories are #category inside their value fields.
  // There only ever seems to be one so we just do a quick string check. 
  categoryIncludes: function(category, term) {
    return JSON.stringify(category).includes(term);
  },

  // Pain in the butt. There's nothing in the data for published posts,
  // so we have to check every step of the way to check if it's a draft.
  isDraft: function(item) {
    return (item['app:control'] && item['app:control']['app:draft'] && item['app:control']['app:draft'] === 'yes');
  },

};
