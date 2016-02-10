class List
  @selector = "div.list:not(.mod-add)"
  @instanciate = ->
    if ($lists = $ document .find @selector).length > 0 then $lists |> each -> new @@ it
    else set-timeout (~> @instanciate!), 500
  @initialize = ->
    @instanciate!
    @listen!
    #@be_observed!
#  @be_observed = ->
#    board.observe (child-list: yes), (mutations)~>
#      mutations
#      |> map ( .added-nodes |> filter ( .class-name is "list"))
#      |> flatten
#      |> each ~> new @@ it
  @listen = ->
    $ document .on "mouseover", @selector, ({target})~>
      @current = @instances |> find -> ($ target .parents!.filter @@selector .0) is it.elm
    Main.on_keydown "o", ~>
      @current?.sort! unless event.target.tag-name is "TEXTAREA"
  (@elm)->
    if @already_exists then return # リストエレメントの数だけしか存在しないように
    @participate!
    @set_style!
    @format_header! if board.is_scrum
    @watch!
  already_exists:~ -> ((@@elms_instances_map ?= new WeakMap).get @elm)?
  $elm:~ -> @_$elm ?= $ @elm
  $cards_container:~ -> @_$cards_container ?= @$elm.find ".list-cards"
  $list_header_name:~ -> @_$list_header_name ?= @$elm.find ".list-header-name"
  title:~ -> @$list_header_name.text!
  type:~ -> @_type ?= if @title.match /\(([^)]+)\)/ then that.1
  period:~ -> @_period ?= if @title.match /<([^>]+)>/ then that.1
  time_resource:~ -> @_time_resource ?= if @title.match /\[([^\]]+)\]/ then that.1
  is_reverse:~ -> @$elm.has-class "reverse"
  class:~ -> @constructor
  style:~ ->
    background: @background
    opacity: @opacity
  background:~ -> switch (if @type? then @type |> trim)
    | \Idea => \#dff
    | \Plan => \#ddf
    | \DoingInAdvance => \#dfd
    | \Current => \#ffd
    | \Doing => \#fdd
    | _ => ""
  opacity:~ -> switch @type
    | \Done => 0.8
    | _ => 1
  is_formatted_header:~ ->
    (@$list_header_name.html!.match /<br>/) or ([@type, @period, @time_resource] |> compact |> ( .length is 1))
  participate: ->
    @@[]instances.push @
    (@@elms_instances_map ?= new WeakMap).set @elm, @
  watch: ->
    @observe_elm @$list_header_name.0, child-list: yes, ~>
      @clear_caches! if not @is_formatted_header
      @set_style!
      @format_header! if not @is_formatted_header and board.is_scrum
  observe_elm: (elm, ops, cb)->
    (new MutationObserver cb).observe  elm, ops
  sort: ->
    @$cards_container.html do
      @$cards_container.children!
      |> arrayify
      |> sort-by ~> (new Card it).label_order * (if @is_reverse then -1 else 1)
    if @is_reverse then @$elm.remove-class "reverse" else @$elm.add-class "reverse"
  set_style: -> @$elm.css @style
  format_header: ->
    @$list_header_name.html (
      [@type, @period, @time_resource] |> compact |> join "<br>"
    )
  clear_caches: -> @ |> keys |> filter ( .char-at(0) is "_") |> each ~> delete @.(it)

window <<<
  lists:~ -> List.instances
