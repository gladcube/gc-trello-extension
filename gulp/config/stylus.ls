module.exports = (gulp, plugins)->
  gulp.task "stylus", (cb)->
    gulp
      .src "src/css/importer.styl"
      .pipe plugins.plumber!
      .pipe plugins.stylus!
      .pipe gulp.dest "tmp/"
