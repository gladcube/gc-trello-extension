require! <[fs browserify browserify-livescript]>

module.exports = build = ->
  err, content <- browserify "#__dirname/../app/index.ls", (
    transform: [browserify-livescript]
  ) .bundle
  if err? then console.error err.message; return
  <- fs.write-file "#__dirname/../../build/js/app.js", content
  console.log \built
