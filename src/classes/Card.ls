class Card
  @$card_divs = -> $ ".list-card"
  @all = -> @$card_divs! |> map -> new @@ it
  @current = {}
  (elm)->
    @$elm = $ elm
    @initialize!
  $badges_div:~ -> @_$badges_div ?= @$elm.find ".list-card-members"
  $dummy_textarea:~ -> @_$dummy_textarea ?= $ "<textarea class='dummy'>" .css position: "fixed", top: -1000
  $title_anchor:~ -> @_$title_anchor ?= @$elm.find "a.list-card-title"
  id:~ -> @_id ?= @$title_anchor.attr "href" .match /\/c\/([^/]+)\// .1
  is_current:~ -> @class.current is @
  class:~ -> @constructor
  initialize: ->
    @listen!
  listen: ->
    @$elm.on "mouseover", ~> @class.current = @
    Main.on_keydown "i", ~> if @is_current then @yank!
  add_copy_anchor: -> @$badges_div.append @$copy_anchor
  yank: -> 
    @$dummy_textarea.append-to($("body")).text @id .select!
    document.exec-command "copy"

