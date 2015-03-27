Main =
  cards:~ -> Card.all!
  execute: ->
    @initialize!
    # @sort_cards!
  initialize: -> Card.initialize!
  # sort_cards: -> @cards
  on_keydown: (key, cb)->
    $(document).on "keydown", ~> if event.key-code is KEY_CODES.(key) then cb!

$(document).on "ready", -> Main.execute!


