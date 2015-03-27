module.exports = (gulp, plugins)->
  gulp.task "concat", (cb)->
    gulp
      .src require("../pipeline.ls").js_files_to_concat
      .pipe plugins.concat "app.js"
      .pipe gulp.dest "tmp/concat"

        