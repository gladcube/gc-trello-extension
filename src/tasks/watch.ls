require! <[debounce glob]>
{watch: _watch} = require \fs
build = require \./build.ls
target_dir = "#__dirname/../app"

module.exports = watch = ->
  _, targets <- glob "#target_dir/**/*"
  targets
  |> ( ++ target_dir)
  |> each _watch _, debounce build, 300_ms

