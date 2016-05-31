{lazy} = require \glad-functions
{lists, type} = require \./list-manager.ls
{query} = require \domf
selector = \#board

module.exports = new class BoardManager
  find: find = lazy query, selector, document
  is_scrum: lists >> any (type >> (in <[Idea Plan Current Doing Done]>))

