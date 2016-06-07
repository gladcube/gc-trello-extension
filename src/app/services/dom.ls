{key_codes} = require \../configs/constants.ls

module.exports = new class Dom
  on_keydown: (key, cb)->
    let_ document, \addEventListener, \keydown,
      when_ (get \keyCode) >> (is (get key, key_codes)), cb
