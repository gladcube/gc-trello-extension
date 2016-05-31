{Obj: {get, let_}} = require \glad-functions
x = 0
y = 0

module.exports = new class MouseTracker
  start: ->
    let_ document, \addEventListener, \mousemove,
      (dist _, [(get \pageX), (get \pageY)]
      ) >> apply memorize
  memorize: memorize = (_x, _y)->
    x := _x; y := _y
  position: position = -> [x, y]
  element: element = ->
    let_ document, \elementFromPoint, x, y

