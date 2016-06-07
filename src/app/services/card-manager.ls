{classes, set_style, children, query, attr, parents, has_class} = require \domf
{on_keydown} = require \./dom.ls
{element: current_element} = require \./mouse-tracker.ls
{yank} = require \./yanker.ls
selector = \.list-card
class_name = \list-card
label_orders =
  green: 0
  yellow: 1
  orange: 2
  red: 3
  purple: 4
  blue: 5
  sky: 6

module.exports = new class CardManager
  listen_i_key: listen_i_key = ->
    act on_keydown \i,
      except (get \target) >> (get \tagName) >> (in <[TEXTAREA INPUT]>),
        current_card >> may (
          yank_id >> effect
        )
  current_card: current_card = ->
    current_element!
    |> parents
    |> find has_class class_name
  title_elm: title_elm = query "a.list-card-title"
  id: id =
    title_elm
    >> (attr \href)
    >> (match_ /\/c\/([^/]+)\//)
    >> (at 1)
  yank_id: yank_id = act id >> yank
  colorize: colorize =
    act (
      act set_style \transition, "all 0.4s ease-in-out"
    ) >> set_style \background, \black
  uncolorize: uncolorize =
    act set_style \background, \white
  effect: effect =
    colorize
    >> (lazy uncolorize, _)
    >> (let_ global, \setTimeout _, 300_ms)
  cards: cards =
    (query \.list-cards)
    >> children
  label_color: label_color =
    (query \.card-label)
    >> (may classes >> find_map match_ /card-label-(\w+)/)
    >> may at 1
  label_order: label_order =
    label_color >> (
      get _, label_orders
    ) >> except (?), return_ 99
