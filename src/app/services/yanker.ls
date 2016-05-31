{act, lazy, Obj: {get, let_}} = require \glad-functions
{append_to, set_text, select, blur, set_style, create} = require \domf

module.exports = new class Yanker
  yank: (str)->
    dummy_textarea!
    |> act append_to (get \body, document)
    |> act set_text str
    |> act select
    |> act lazy let_, document, \execCommand, \copy
    |> act blur
  dummy_textarea: dummy_textarea =
    (lazy create, \textarea) >> (
      act set_style \position, \fixed
    ) >> (act set_style \top, \-1000px)
