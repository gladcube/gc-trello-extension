Main =
  cards:~ -> Card.all!
  execute: ->
    @initialize!
    @set_interval!
    @listen!
  initialize: ->
    Board.initialize!
    Card.initialize!
    List.initialize!
  instanciate: ->
    Board.instanciate!
    List.instanciate!
  on_keydown: (key, cb)->
    $(document).on "keydown", ~> if event.key-code is KEY_CODES.(key) then cb!
  set_interval: ->
    if @_interval_id? => return
    set-interval @~instanciate, 2000_mx
    |> ~> @_interval_id = it
  clear_interval: ->
    clear-interval @_interval_id
    delete @_interval_id
  listen: ->
    $ document .on \visibilitychange, ~>
      | document.hidden => @clear_interval!
      | not document.hidden => @instanciate!; @set_interval!

Main.execute!
