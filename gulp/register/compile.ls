module.exports = (gulp, plugins)->
  gulp.task "compile", (cb)->
    plugins.sequence do
      "clean"
      <[livescript stylus]>
      "concat"
      "copy"
      cb

