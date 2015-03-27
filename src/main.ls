Main =
  cards:~ -> Card.all!
  execute: ->
    @cards |> each -> it.add_copy_anchor!
  on_keydown: (key, cb)->
    $(document).on "keydown", ~> if event.key-code is KEY_CODES.(key) then cb!

$(document).on "ready", -> Main.execute!


