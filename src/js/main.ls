Main =
  cards:~ -> Card.all!
  execute: ->
    @initialize!
  initialize: ->
    Card.initialize!
    List.initialize!
  on_keydown: (key, cb)->
    $(document).on "keydown", ~> if event.key-code is KEY_CODES.(key) then cb!

$(document).on "ready", -> Main.execute!
