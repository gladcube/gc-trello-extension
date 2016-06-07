global <<<< require \prelude-ls
global <<<< require \glad-functions
{on_} = require \domf
{find: find_board, is_scrum} = require \./services/board-manager.ls
{lists, is_editing, stylize, format, listen, listen_o_key} = require \./services/list-manager.ls
{listen_i_key} = require \./services/card-manager.ls
{start: track_mouse} = require \./services/mouse-tracker.ls

format_lists = ->
  find_board!
  |> may when_ is_scrum,
     lists >> each except is_editing,
       stylize
       >> format
       >> listen
  |> lazy set-timeout, format_lists, 2000_ms
  |> set \timer, _, global

stop_timer =
  (lazy get, \timer, global)
  >> let_ global, \clearTimeout, _

start_formatting_lists =
  format_lists
  >> lazy dist, window, [
    on_ \focus, stop_timer >> format_lists
    on_ \blur, stop_timer
  ]

do main =
  track_mouse
  >> listen_o_key
  >> listen_i_key
  >> start_formatting_lists

