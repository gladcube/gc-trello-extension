require! \prelude-ls
{lazy, except, act, may, return_, when_} = require \glad-functions
{find: find_board, is_scrum} = require \./services/board-manager.ls
{lists, is_editing, stylize, format, listen, listen_o_key} = require \./services/list-manager.ls
{listen_i_key} = require \./services/card-manager.ls
{start: track_mouse} = require \./services/mouse-tracker.ls

format_lists = ->
  find_board!
  |> may when_ is_scrum,
       lists >> each except is_editing, (stylize >> format >> listen)
  |> lazy set-timeout, format_lists, 2000_ms

do main =
  format_lists >> track_mouse >> listen_o_key >> listen_i_key

