class Board
  @selector = "\#board"
  @initialize = ->
    @instanciate!
  @instanciate = -> @_instance = new @@
  ->
  $elm:~ -> @_$elm = if ($elm = $ @@selector).length > 0 then $elm
  elm:~ -> @$elm?.0
  lists:~ -> lists |> filter ~> @elm in it.$elm.parents!
  is_scrum:~ -> @lists |> any -> it.type in <[Idea Plan Current Doing Done]>
  observe: (ops, cb)->
    if @elm? then (new MutationObserver cb).observe @elm, ops
    else set-timeout (~> @observe ops, cb), 100

window <<<
  board:~ -> Board._instance
