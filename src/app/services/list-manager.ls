require! \debounce
{append_to, set_html, add_class, remove_class, parents, query, has_class, set_style, query_all} = require \domf
{on_keydown} = require \./dom.ls
{element: current_element} = require \./mouse-tracker.ls
{cards, label_order} = require \./card-manager.ls
selector = "div.list:not(.mod-add)"
class_name = "list"

module.exports = new class ListManager
  lists: lists = query_all selector
  cards_container_elm: cards_container_elm = query \.list-cards
  editing_target_elm: editing_target_elm = query \.js-editing-target
  name_elm: name_elm = query \.list-header-name
  assist_elm: assist_elm = query \.list-header-name-assist
  title: title =
    name_elm >> (get \value)
  type: type =
    title
    >> (match_ /\(([^)]+)\)/)
    >> may at 1
  period: period =
    title
    >> (match_ /<([^>]+)>/)
    >> may at 1
  time_resource: time_resource =
    title
    >> (match_ /\[([^\]]+)\]/)
    >> may at 1
  hide: hide = set_style \display, \none
  show: show = set_style \display, \block
  is_editing:
    name_elm
    >> (get \classList)
    >> any (is \is-editing)
  set_background: set_background = (list)->
    set_style \background, (
      switch type list
      | \Idea => \#dff
      | \Plan => \#ddf
      | \DoingInAdvance => \#dfd
      | \Current => \#ffd
      | \Doing => \#fdd
      | _ => ""
    ), list
  set_opacity: set_opacity = (list)->
    set_style \opacity, (
      switch type list
      | \Done => 0.8
      | _ => 1
    ), list
  set_font_size: set_font_size =
    assist_elm
    >> set_style \fontSize, \14px
  switch_header: switch_header =
    (act name_elm >> hide)
    >> (act assist_elm >> show)
  revert_header: revert_header =
    (act assist_elm >> hide)
    >> (act name_elm >> show)
  listen_header_clicked: listen_header_clicked =
    act ($$ [
      editing_target_elm
      (lazy revert_header, _) >> debounce _, 150_ms
    ]) >> (act apply let_ _, \addEventListener, \click, _)
    >> (lazy (apply let_ _, \removeEventListener, \click, _), _)
    >> (let_ global, \setTimeout, _, 2000_ms)
  stylize: stylize =
    act $$ [
      set_background
      set_opacity
      set_font_size
      switch_header
    ]
  description: description =
    ($$ [type, period, time_resource])
    >> compact
    >> join "<br>"
  format: format =
    act (
      ($$ [description, assist_elm])
      >> apply (set \innerHTML, _, _)
    )
  sorted_cards: sorted_cards =
    ($$ [
      has_class \reversed
      cards >> (sort-by label_order)
    ]) >> apply (unless_ _, reverse, _)
  set_sorted_cards: set_sorted_cards =
    act ($$ [
      append_to . cards_container_elm
      sorted_cards >> reverse
    ]) >> apply each _, _
  toggle: toggle =
    (case_ (has_class \reversed), remove_class \reversed)
    >> (otherwise_ add_class \reversed)
  sort: sort = set_sorted_cards >> toggle
  listen_o_key: listen_o_key = ->
    act on_keydown \o,
      except (get \target) >> (get \tagName) >> (is \TEXTAREA),
        current_list >> may sort
  current_list: current_list = ->
    current_element!
    |> parents
    |> find has_class class_name
  listen: listen = listen_header_clicked


