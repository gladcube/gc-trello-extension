class List
  @is_initialized = no
  @selector = ".list-cards"
  @reverse = no
  @initialize = -> @sort!; @listen!
  @listen = ->
    Main.on_keydown "o", ~> @sort!
  @$list_divs = -> $ @selector
  @all = -> @$list_divs! |> map -> new @@ it
  @sort = ->
    @all! |> each ~> it.sort reverse: @reverse
    @reverse = !@reverse
  (elm)->
    @$elm = $ elm
  id:~ -> @_id ?= @$title_anchor.attr "href" .match /\/c\/([^/]+)\// .1
  class:~ -> @constructor
  sort: ({reverse})->
    @$elm.html do
      @$elm.children!
      |> arrayify
      |> sort-by -> (new Card it).label_order * (if reverse then -1 else 1)

