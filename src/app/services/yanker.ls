{append_to, set_text, select, blur, set_style, create} = require \domf

module.exports = new class Yanker
  dummy_textarea: dummy_textarea =
    (lazy create, \textarea)
    >> (act set_style \position, \fixed)
    >> (act set_style \top, \-1000px)
  yank:
    act (
      (withr dummy_textarea)
      >> (act apply set_text)
      >> (at 1)
      >> $$ [
        append_to (get \body, document)
        select
        lazy let_, document, \execCommand, \copy
        blur
      ]
    )
