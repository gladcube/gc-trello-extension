class List
  @is_initialized = no
  @selector = ".list-cards"
  @current = null
  @initialize = -> @listen!
  @listen = ->
    $ document .on "mouseover", @selector, ({target})~>
      @current = new @@ ($ target .parents!.filter @selector).0
    Main.on_keydown "o", ~>
      @current?.sort! unless event.target.tag-name is "TEXTAREA"
  @$list_divs = -> $ @selector
  @all = -> @$list_divs! |> map -> new @@ it
  # @sort = ->
  #   @all! |> each ~> it.sort reverse: @reverse
  #   @reverse = !@reverse
  (elm)->
    @$elm = $ elm
  reverse:~ -> @$elm.has-class "reverse"
  id:~ -> @_id ?= @$title_anchor.attr "href" .match /\/c\/([^/]+)\// .1
  class:~ -> @constructor
  sort: ->
    @$elm.html do
      @$elm.children!
      |> arrayify
      |> sort-by ~> (new Card it).label_order * (if @reverse then -1 else 1)
    if @reverse then @$elm.remove-class "reverse" else @$elm.add-class "reverse"

