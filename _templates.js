module.exports = {

  escapeYamlString: function (string) {
    return string;
  },

	renderCategories: function (labels) {
		var yamlCategories = '';
		for ( var i=0; i < labels.length; i++) {
			// cheeky way to get line breaks
			yamlCategories += `
  - ${labels[i]}`;
		}
		return yamlCategories;
	},

	renderTags: function (tags) {
		return JSON.stringify(tags);
	},

	renderComments: function (comments) {
		var commentCount = comments.length;
		if (commentCount > 0) {
			var commentsHeading = (commentCount > 1) ? 'Comments' : 'Comment';
			var commentsHTML = ``;

			for (var i=0; i < commentCount; i++) {
				var comment = comments[i];
				commentsHTML = commentsHTML + `
			<div class="comment" id="comment-${comment.id}">
				<p class="comment-header">
					<date datetime="${comment.published.timestamp}">${comment.published.tidyISO}</date> 
					<a href="${comment.author.url}" rel="nofollow">${comment.author.name}</a>:
				</p>
				<div class="comment-content"><p>${comment.content}</p></div>
				<div class="comment-footer"></div>
			</div>`
			}

			return `
<div class="comments">
	<div class="comments-header"><h2>${commentCount} ${commentsHeading}</h2></div>
	<div class="comments-body">${commentsHTML}</div>
	<p class="comments-footer"><em>Comments are now closed.</em></p>
</div>`
		
		} else {
			return `<!-- no comments on this post -->`;
		}
	},

    html: function (post) {
    	var labels = (post.labels) ? post.labels : false;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>${post.metadata.title}</title>
	<style>
	body { background: white; color: black; font-family: sans-serif;}
	#page { max-width: 40rem; margin: 5rem auto; }
	.comments { margin-top: 4rem; }
	.comment { margin-bottom: 2rem; }
	</style>
</head>
<body>
	<div id="page">
		<div class="post">
			<div class="post-header"><h1>${post.metadata.title}</h1></div>
			<div class="post-content">${post.content}</div>
			<div class="post-footer">
				<p>
					Posted by ${post.metadata.author.name}
					on <date datetime="${post.metadata.published.timestamp}">${post.metadata.published.tidyISO}</date>
					${ (labels.length) ? `Labelled ${labels}` : ''}
				</p>
			</div>		
		</div>
${module.exports.renderComments(post.comments)}
	</div>
</body>
</html>`
    },

    markdown: function (post) {
    	var labels = (post.labels) ? post.labels : '';
    	// NOTE: the first --- *must* be the first line.
        return `---
title:		"${post.metadata.title}"
date:		${post.metadata.published.tidyISO}
updated:	${post.metadata.updated.tidyISO}
tags: ${module.exports.renderCategories(labels)}	
permalink:	${post.metadata.url}
---

${post.content}
${module.exports.renderComments(post.comments)}`
    },

};
