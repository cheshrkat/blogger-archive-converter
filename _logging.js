/**
 * Usage:
 * 
 * log.<type>(`Log string`)
 * Types: message, error, warning, success
 * 
 * Separator bar - log.bar();
 */

const logRed = '\x1b[1m\x1b[31m%s\x1b[0m';
const logYellow = '\x1b[1m\x1b[33m%s\x1b[0m';
const logGreen = '\x1b[1m\x1b[32m%s\x1b[0m';

module.exports = {

  bar(char) {
    var character = char || '-';
    var width = process.stdout.columns;
    console.log(character.repeat(width));
  },

  message: function (message) {
    console.log(message);
  },

  success: function (message) {
    console.log(logGreen, message);
  },

  warning: function (message) {
    console.log(logYellow, message);
  },

  error: function (message) {
    console.error(logRed, message);
  },

};
