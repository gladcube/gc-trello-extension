class Card
  @is_initialized = no
  @selector = ".list-card"
  @current = null
  @initialize = -> @listen!
  @listen = ->
    $ document .on "mouseover", @selector, ({target})~>
      @current = new @@ ($ target .parents!.filter @selector).0
    Main.on_keydown "i", ~>
      @current?.yank! unless event.target.tag-name in <[TEXTAREA INPUT]>
  @$card_divs = -> $ @selector
  @all = -> @$card_divs! |> map -> new @@ it
  (elm)->
    @$elm = $ elm
  $dummy_textarea:~ -> @_$dummy_textarea ?= $ "<textarea class='dummy'>" .css position: "fixed", top: -1000
  $title_anchor:~ -> @_$title_anchor ?= @$elm.find "a.list-card-title"
  $list:~ -> @_$list ?= @$elm.parent!.filter ".list-cards"
  id:~ -> @_id ?= @$title_anchor.attr "href" .match /\/c\/([^/]+)\// .1
  is_current:~ -> @class.current is @
  class:~ -> @constructor
  label_color:~ ->
    ((@$elm.find(".card-label").attr("class") or "") |> split " " |> map ( .match /card-label-(\w+)/) |> compact |> head)?.1
  label_order:~ ->
    LABEL_ORDERS.(@label_color) ? 99
  yank: ->
    @$dummy_textarea.append-to($("body")).text @id .select!
    document.exec-command "copy"
    @$dummy_textarea.blur!
    @$elm.add-class "copied"; set-timeout (~> @$elm.remove-class "copied"), 300
