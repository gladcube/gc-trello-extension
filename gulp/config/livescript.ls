module.exports = (gulp, plugins)->
  gulp.task "livescript", (cb)->
    gulp
      .src "src/**/*.ls"
      .pipe plugins.plumber!
      .pipe plugins.livescript bare: yes
      .pipe gulp.dest "tmp/"
