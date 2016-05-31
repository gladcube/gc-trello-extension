(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],3:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":4}],4:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],5:[function(require,module,exports){

/**
 * Module dependencies.
 */

var now = require('date-now');

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing.
 *
 * @source underscore.js
 * @see http://unscriptable.com/2009/03/20/debouncing-javascript-methods/
 * @param {Function} function to wrap
 * @param {Number} timeout in ms (`100`)
 * @param {Boolean} whether to execute at the beginning (`false`)
 * @api public
 */

module.exports = function debounce(func, wait, immediate){
  var timeout, args, context, timestamp, result;
  if (null == wait) wait = 100;

  function later() {
    var last = now() - timestamp;

    if (last < wait && last > 0) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      }
    }
  };

  return function debounced() {
    context = this;
    args = arguments;
    timestamp = now();
    var callNow = immediate && !timeout;
    if (!timeout) timeout = setTimeout(later, wait);
    if (callNow) {
      result = func.apply(context, args);
      context = args = null;
    }

    return result;
  };
};

},{"date-now":6}],6:[function(require,module,exports){
module.exports = Date.now || now

function now() {
    return new Date().getTime()
}

},{}],7:[function(require,module,exports){
(function (global){
require("LiveScript")
import$(global, require("prelude-ls"))
module.exports = require("./lib/index.ls")

function import$(obj, src){
  for(var key in src) obj[key] = src[key];
  return obj;
}



}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./lib/index.ls":8,"LiveScript":10,"prelude-ls":36}],8:[function(require,module,exports){
(function (global){
// Generated by LiveScript 1.4.0
var ref$, dist, lazy, may, when_, ref1$, get, set, let_, Domf, slice$ = [].slice;
ref$ = require('glad-functions'), dist = ref$.dist, lazy = ref$.lazy, may = ref$.may, when_ = ref$.when_, ref1$ = ref$.Obj, get = ref1$.get, set = ref1$.set, let_ = ref1$.let_;
module.exports = new (Domf = (function(){
  Domf.displayName = 'Domf';
  var lazy_doc, with_doc, on_, parent, parents, children, classes, has_class, add_class, remove_class, style, set_style, append_to, append, text, set_text, html, set_html, outer_html, set_outer_html, prototype = Domf.prototype, constructor = Domf;
  lazy_doc = lazy(get, 'document', global);
  with_doc = compose$(apply, (function(it){
    return compose$(partialize$.apply(this, [dist, [void 8, [lazy_doc, id]], [0]]), it);
  }));
  prototype.on_ = on_ = curry$(function(event, handler, elm){
    return let_(elm, 'addEventListener', event, handler);
  });
  prototype.parent = parent = get('parentNode');
  prototype.parents = parents = function(elm){
    var that;
    switch (false) {
    case (that = parent(elm)) == null:
      return [that].concat(parents(that));
    default:
      return [];
    }
  };
  prototype.children = children = compose$(get('childNodes'), map(id));
  prototype.classes = classes = compose$(get('classList'), (function(it){
    return it || [];
  }));
  prototype.has_class = has_class = curry$(function(name, elm){
    return in$(name, classes(elm));
  });
  prototype.add_class = add_class = curry$(function(c, e){
    return let_(classes(e), 'add', c);
  });
  prototype.remove_class = remove_class = curry$(function(c, e){
    return let_(classes(e), 'remove', c);
  });
  prototype.query = flip(partialize$.apply(Domf, [let_, [void 8, 'querySelector', void 8], [0, 2]]));
  prototype.query_all = flip(partialize$.apply(Domf, [let_, [void 8, 'querySelectorAll', void 8], [0, 2]]));
  prototype.create = partialize$.apply(Domf, [let_, [document, 'createElement', void 8], [2]]);
  prototype.attr = flip(partialize$.apply(Domf, [let_, [void 8, 'getAttribute', void 8], [0, 2]]));
  prototype.set_attr = curry$(function(k, v, e){
    return let_(e, 'setAttribute', k, v);
  });
  prototype.style = style = get('style');
  prototype.set_style = set_style = curry$(function(k, v, e){
    return set(k, v)(
    style(e));
  });
  prototype.append_to = append_to = partialize$.apply(Domf, [let_, [void 8, 'appendChild', void 8], [0, 2]]);
  prototype.append = append = flip(partialize$.apply(Domf, [let_, [void 8, 'appendChild', void 8], [0, 2]]));
  prototype.select = partialize$.apply(Domf, [let_, [void 8, 'select'], [0]]);
  prototype.blur = partialize$.apply(Domf, [let_, [void 8, 'blur'], [0]]);
  prototype.text = text = get('textContent');
  prototype.set_text = set_text = set('textContent');
  prototype.html = html = get('innerHTML');
  prototype.set_html = set_html = set('innerHTML');
  prototype.outer_html = outer_html = get('outerHTML');
  prototype.set_outer_html = set_outer_html = set('outerHTML');
  function Domf(){}
  return Domf;
}()));
function compose$() {
  var functions = arguments;
  return function() {
    var i, result;
    result = functions[0].apply(this, arguments);
    for (i = 1; i < functions.length; ++i) {
      result = functions[i](result);
    }
    return result;
  };
}
function partialize$(f, args, where){
  var context = this;
  return function(){
    var params = slice$.call(arguments), i,
        len = params.length, wlen = where.length,
        ta = args ? args.concat() : [], tw = where ? where.concat() : [];
    for(i = 0; i < len; ++i) { ta[tw[0]] = params[i]; tw.shift(); }
    return len < wlen && len ?
      partialize$.apply(context, [f, ta, tw]) : f.apply(context, ta);
  };
}
function curry$(f, bound){
  var context,
  _curry = function(args) {
    return f.length > 1 ? function(){
      var params = args ? args.concat() : [];
      context = bound ? context || this : this;
      return params.push.apply(params, arguments) <
          f.length && arguments.length ?
        _curry.call(context, params) : f.apply(context, params);
    } : f;
  };
  return _curry();
}
function in$(x, xs){
  var i = -1, l = xs.length >>> 0;
  while (++i < l) if (x === xs[i]) return true;
  return false;
}



}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"glad-functions":15}],9:[function(require,module,exports){
// Generated by LiveScript 1.3.1
var fold, ref$, nameFromPath, stripString, Node, Negatable, Block, Atom, Literal, Var, Key, Index, Slice, Chain, Call, List, Obj, Prop, Arr, Unary, Binary, Assign, Import, In, Existence, Fun, Class, Super, Parens, Splat, Jump, Throw, Return, While, For, Try, Switch, Case, If, Label, Cascade, JS, Require, Util, Vars, DECLS, UTILS, LEVEL_TOP, LEVEL_PAREN, LEVEL_LIST, LEVEL_COND, LEVEL_OP, LEVEL_CALL, PREC, TAB, ID, SIMPLENUM, slice$ = [].slice, toString$ = {}.toString;
fold = require('prelude-ls').fold;
ref$ = require('./util'), nameFromPath = ref$.nameFromPath, stripString = ref$.stripString;
(Node = function(){
  throw Error('unimplemented');
}).prototype = {
  compile: function(options, level){
    var o, node, code, that, i$, len$, tmp;
    o = import$({}, options);
    if (level != null) {
      o.level = level;
    }
    node = this.unfoldSoak(o) || this;
    if (o.level && node.isStatement()) {
      return node.compileClosure(o);
    }
    code = (node.tab = o.indent, node).compileNode(o);
    if (that = node.temps) {
      for (i$ = 0, len$ = that.length; i$ < len$; ++i$) {
        tmp = that[i$];
        o.scope.free(tmp);
      }
    }
    return code;
  },
  compileClosure: function(o){
    var that, fun, call, hasArgs, hasThis;
    if (that = this.getJump()) {
      that.carp('inconvertible statement');
    }
    fun = Fun([], Block(this));
    call = Call();
    this.traverseChildren(function(it){
      switch (it.value) {
      case 'this':
        hasThis = true;
        break;
      case 'arguments':
        hasArgs = it.value = 'args$';
      }
    });
    if (hasThis) {
      call.args.push(Literal('this'));
      call.method = '.call';
    }
    if (hasArgs) {
      call.args.push(Literal('arguments'));
      fun.params.push(Var('args$'));
    }
    return Parens(Chain((fun.wrapper = true, fun['void'] = this['void'], fun), [call]), true).compile(o);
  },
  compileBlock: function(o, node){
    var that;
    if (that = node != null ? node.compile(o, LEVEL_TOP) : void 8) {
      return "{\n" + that + "\n" + this.tab + "}";
    } else {
      return '{}';
    }
  },
  cache: function(o, once, level){
    var ref$, sub, ref;
    if (!this.isComplex()) {
      return [ref$ = level != null ? this.compile(o, level) : this, ref$];
    }
    sub = Assign(ref = Var(o.scope.temporary()), this);
    if (level != null) {
      sub = sub.compile(o, level);
      if (once) {
        o.scope.free(ref.value);
      }
      return [sub, ref.value];
    }
    if (once) {
      return [sub, (ref.temp = true, ref)];
    } else {
      return [sub, ref, [ref.value]];
    }
  },
  compileLoopReference: function(o, name, ret){
    var ref$, asn, tmp;
    if (this instanceof Var && o.scope.check(this.value) || this instanceof Unary && ((ref$ = this.op) === '+' || ref$ === '-') && (-1 / 0 < (ref$ = +this.it.value) && ref$ < 1 / 0) || this instanceof Literal && !this.isComplex()) {
      return [ref$ = this.compile(o), ref$];
    }
    asn = Assign(Var(tmp = o.scope.temporary(name)), this);
    ret || (asn['void'] = true);
    return [tmp, asn.compile(o, ret ? LEVEL_CALL : LEVEL_PAREN)];
  },
  eachChild: function(fn){
    var i$, ref$, len$, name, child, j$, len1$, i, node, that;
    for (i$ = 0, len$ = (ref$ = this.children).length; i$ < len$; ++i$) {
      name = ref$[i$];
      if (child = this[name]) {
        if ('length' in child) {
          for (j$ = 0, len1$ = child.length; j$ < len1$; ++j$) {
            i = j$;
            node = child[j$];
            if (that = fn(node, name, i)) {
              return that;
            }
          }
        } else {
          if ((that = fn(child, name)) != null) {
            return that;
          }
        }
      }
    }
  },
  traverseChildren: function(fn, xscope){
    var this$ = this;
    return this.eachChild(function(node, name, index){
      var ref$;
      return (ref$ = fn(node, this$, name, index)) != null
        ? ref$
        : node.traverseChildren(fn, xscope);
    });
  },
  anaphorize: function(){
    var base, name, ref$;
    this.children = this.aTargets;
    if (this.eachChild(hasThat)) {
      if ((base = this)[name = this.aSource] instanceof Existence) {
        base = base[name];
        name = 'it';
      }
      if (base[name].value !== 'that') {
        base[name] = Assign(Var('that'), base[name]);
      }
    }
    function hasThat(it){
      var that;
      return it.value === 'that' || ((that = it.aSource)
        ? (that = it[that]) ? hasThat(that) : void 8
        : it.eachChild(hasThat));
    }
    delete this.children;
    return ref$ = this[this.aSource], ref$.cond = true, ref$;
  },
  carp: function(msg, type){
    type == null && (type = SyntaxError);
    throw type(msg + " on line " + (this.line || this.traverseChildren(function(it){
      return it.line;
    })));
  },
  delegate: function(names, fn){
    var i$, len$;
    for (i$ = 0, len$ = names.length; i$ < len$; ++i$) {
      (fn$.call(this, names[i$]));
    }
    function fn$(name){
      this[name] = function(it){
        return fn.call(this, name, it);
      };
    }
  },
  children: [],
  terminator: ';',
  isComplex: YES,
  isStatement: NO,
  isAssignable: NO,
  isCallable: NO,
  isEmpty: NO,
  isArray: NO,
  isString: NO,
  isRegex: NO,
  isMatcher: function(){
    return this.isString() || this.isRegex();
  },
  assigns: NO,
  ripName: VOID,
  unfoldSoak: VOID,
  unfoldAssign: VOID,
  unparen: THIS,
  unwrap: THIS,
  maybeKey: THIS,
  expandSlice: THIS,
  varName: String,
  getAccessors: VOID,
  getCall: VOID,
  getDefault: VOID,
  getJump: VOID,
  invert: function(){
    return Unary('!', this, true);
  },
  invertCheck: function(it){
    if (it.inverted) {
      return this.invert();
    } else {
      return this;
    }
  },
  addElse: function($else){
    this['else'] = $else;
    return this;
  },
  makeReturn: function(ref, obj){
    var items, kv, i, v;
    if (obj) {
      items = this instanceof Arr
        ? (this.items[0] == null || this.items[1] == null && this.carp('must specify both key and value for object comprehension'), this.items)
        : (kv = 'keyValue$', (function(){
          var i$, ref$, len$, results$ = [];
          for (i$ = 0, len$ = (ref$ = [Assign(Var(kv), this), Var(kv)]).length; i$ < len$; ++i$) {
            i = i$;
            v = ref$[i$];
            results$.push(Chain(v).add(Index(Literal(i))));
          }
          return results$;
        }.call(this)));
      return Assign(Chain(Var(ref)).add(Index(items[0], '.', true)), items[1]);
    } else if (ref) {
      return Call.make(JS(ref + '.push'), [this]);
    } else {
      return Return(this);
    }
  },
  show: String,
  toString: function(idt){
    var tree, that;
    idt || (idt = '');
    tree = '\n' + idt + this.constructor.displayName;
    if (that = this.show()) {
      tree += ' ' + that;
    }
    this.eachChild(function(it){
      tree += it.toString(idt + TAB);
    });
    return tree;
  },
  stringify: function(space){
    return JSON.stringify(this, null, space);
  },
  toJSON: function(){
    return import$({
      type: this.constructor.displayName
    }, this);
  }
};
exports.parse = function(json){
  return exports.fromJSON(JSON.parse(json));
};
exports.fromJSON = (function(){
  function fromJSON(it){
    var that, node, key, val, i$, len$, v, results$ = [];
    if (!(it && typeof it === 'object')) {
      return it;
    }
    if (that = it.type) {
      node = clone$(exports[that].prototype);
      for (key in it) {
        val = it[key];
        node[key] = fromJSON(val);
      }
      return node;
    }
    if (it.length != null) {
      for (i$ = 0, len$ = it.length; i$ < len$; ++i$) {
        v = it[i$];
        results$.push(fromJSON(v));
      }
      return results$;
    } else {
      return it;
    }
  }
  return fromJSON;
}());
Negatable = {
  show: function(){
    return this.negated && '!';
  },
  invert: function(){
    this.negated = !this.negated;
    return this;
  }
};
exports.Block = Block = (function(superclass){
  var prototype = extend$((import$(Block, superclass).displayName = 'Block', Block), superclass).prototype, constructor = Block;
  function Block(body){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    body || (body = []);
    if ('length' in body) {
      this$.lines = body;
    } else {
      this$.lines = [];
      this$.add(body);
    }
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['lines'];
  prototype.toJSON = function(){
    delete this.back;
    return superclass.prototype.toJSON.call(this);
  };
  prototype.add = function(it){
    var that, ref$;
    it = it.unparen();
    switch (false) {
    case !(that = this.back):
      that.add(it);
      break;
    case !(that = it.lines):
      (ref$ = this.lines).push.apply(ref$, that);
      break;
    default:
      this.lines.push(it);
      if (that = (ref$ = it.back, delete it.back, ref$)) {
        this.back = that;
      }
    }
    return this;
  };
  prototype.prepend = function(){
    var ref$;
    (ref$ = this.lines).splice.apply(ref$, [this.neck(), 0].concat(slice$.call(arguments)));
    return this;
  };
  prototype.pipe = function(target, type){
    var args;
    args = type === '|>' ? this.lines.pop() : target;
    if (toString$.call(args).slice(8, -1) !== 'Array') {
      args = [args];
    }
    switch (type) {
    case '|>':
      this.lines.push(Call.make(target, args, {
        pipe: true
      }));
      break;
    case '<|':
      this.lines.push(Call.make(this.lines.pop(), args));
    }
    return this;
  };
  prototype.unwrap = function(){
    if (this.lines.length === 1) {
      return this.lines[0];
    } else {
      return this;
    }
  };
  prototype.chomp = function(){
    var lines, i, that;
    lines = this.lines;
    i = lines.length;
    while (that = lines[--i]) {
      if (!that.comment) {
        break;
      }
    }
    lines.length = i + 1;
    return this;
  };
  prototype.neck = function(){
    var pos, i$, ref$, len$, x;
    pos = 0;
    for (i$ = 0, len$ = (ref$ = this.lines).length; i$ < len$; ++i$) {
      x = ref$[i$];
      if (!(x.comment || x instanceof Literal)) {
        break;
      }
      ++pos;
    }
    return pos;
  };
  prototype.isComplex = function(){
    var ref$;
    return this.lines.length > 1 || ((ref$ = this.lines[0]) != null ? ref$.isComplex() : void 8);
  };
  prototype.delegate(['isCallable', 'isArray', 'isString', 'isRegex'], function(it){
    var ref$, ref1$;
    return (ref$ = (ref1$ = this.lines)[ref1$.length - 1]) != null ? ref$[it]() : void 8;
  });
  prototype.getJump = function(it){
    var i$, ref$, len$, node, that;
    for (i$ = 0, len$ = (ref$ = this.lines).length; i$ < len$; ++i$) {
      node = ref$[i$];
      if (that = node.getJump(it)) {
        return that;
      }
    }
  };
  prototype.makeReturn = function(){
    var that, ref$, key$, ref1$;
    this.chomp();
    if (that = (ref1$ = ref$ = this.lines)[key$ = ref1$.length - 1] != null ? ref$[key$] = (ref$ = ref$[key$]).makeReturn.apply(ref$, arguments) : void 8) {
      if (that instanceof Return && !that.it) {
        --this.lines.length;
      }
    }
    return this;
  };
  prototype.compile = function(o, level){
    var tab, codes, res$, i$, ref$, len$, node, code;
    level == null && (level = o.level);
    if (level) {
      return this.compileExpressions(o, level);
    }
    o.block = this;
    tab = o.indent;
    res$ = [];
    for (i$ = 0, len$ = (ref$ = this.lines).length; i$ < len$; ++i$) {
      node = ref$[i$];
      node = node.unfoldSoak(o) || node;
      if (!(code = (node.front = true, node).compile(o, level))) {
        continue;
      }
      node.isStatement() || (code += node.terminator);
      res$.push(tab + code);
    }
    codes = res$;
    return codes.join('\n');
  };
  prototype.compileRoot = function(options){
    var o, saveTo, ref$, bare, prefix, ref1$, code;
    o = (import$({
      level: LEVEL_TOP,
      scope: this.scope = Scope.root = new Scope
    }, options));
    if (saveTo = (ref$ = o.saveScope, delete o.saveScope, ref$)) {
      o.scope = saveTo.savedScope || (saveTo.savedScope = o.scope);
    }
    delete o.filename;
    o.indent = (bare = (ref$ = o.bare, delete o.bare, ref$)) ? '' : TAB;
    if (/^\s*(?:[/#]|javascript:)/.test((ref$ = this.lines[0]) != null ? ref$.code : void 8)) {
      prefix = this.lines.shift().code + '\n';
    }
    if ((ref1$ = o.eval, delete o.eval, ref1$) && this.chomp().lines.length) {
      if (bare) {
        this.lines.push(Parens(this.lines.pop()));
      } else {
        this.makeReturn();
      }
    }
    code = this.compileWithDeclarations(o);
    bare || (code = "(function(){\n" + code + "\n}).call(this);\n");
    return [prefix] + code;
  };
  prototype.compileWithDeclarations = function(o){
    var pre, i, rest, post, that;
    o.level = LEVEL_TOP;
    pre = '';
    if (i = this.neck()) {
      rest = this.lines.splice(i, 9e9);
      pre = this.compile(o);
      this.lines = rest;
    }
    if (!(post = this.compile(o))) {
      return pre;
    }
    return (pre && pre + "\n") + ((that = this.scope) ? that.emit(post, o.indent) : post);
  };
  prototype.compileExpressions = function(o, level){
    var lines, i, that, code, last, i$, len$, node;
    lines = this.chomp().lines;
    i = -1;
    while (that = lines[++i]) {
      if (that.comment) {
        lines.splice(i--, 1);
      }
    }
    if (!lines.length) {
      lines.push(Literal('void'));
    }
    lines[0].front = this.front;
    lines[lines.length - 1]['void'] = this['void'];
    if (!lines[1]) {
      return lines[0].compile(o, level);
    }
    code = '';
    last = lines.pop();
    for (i$ = 0, len$ = lines.length; i$ < len$; ++i$) {
      node = lines[i$];
      code += (node['void'] = true, node).compile(o, LEVEL_PAREN) + ', ';
    }
    code += last.compile(o, LEVEL_PAREN);
    if (level < LEVEL_LIST) {
      return code;
    } else {
      return "(" + code + ")";
    }
  };
  return Block;
}(Node));
Atom = (function(superclass){
  var prototype = extend$((import$(Atom, superclass).displayName = 'Atom', Atom), superclass).prototype, constructor = Atom;
  prototype.show = function(){
    return this.value;
  };
  prototype.isComplex = NO;
  function Atom(){
    Atom.superclass.apply(this, arguments);
  }
  return Atom;
}(Node));
exports.Literal = Literal = (function(superclass){
  var prototype = extend$((import$(Literal, superclass).displayName = 'Literal', Literal), superclass).prototype, constructor = Literal;
  function Literal(value){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.value = value;
    if (value.js) {
      return JS(value + "", true);
    }
    if (value === 'super') {
      return new Super;
    }
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.isEmpty = function(){
    var ref$;
    return (ref$ = this.value) === 'void' || ref$ === 'null';
  };
  prototype.isCallable = function(){
    var ref$;
    return (ref$ = this.value) === 'this' || ref$ === 'eval' || ref$ === '..';
  };
  prototype.isString = function(){
    return 0 <= '\'"'.indexOf((this.value + "").charAt());
  };
  prototype.isRegex = function(){
    return (this.value + "").charAt() === '/';
  };
  prototype.isComplex = function(){
    return this.isRegex() || this.value === 'debugger';
  };
  prototype.isWhat = function(){
    switch (false) {
    case !this.isEmpty():
      return 'empty';
    case !this.isCallable():
      return 'callable';
    case !this.isString():
      return 'string';
    case !this.isRegex():
      return 'regex';
    case !this.isComplex():
      return 'complex';
    }
  };
  prototype.varName = function(){
    if (/^\w+$/.test(this.value)) {
      return '$' + this.value;
    } else {
      return '';
    }
  };
  prototype.makeReturn = function(it){
    if (!it && this.value === 'debugger') {
      return this;
    } else {
      return superclass.prototype.makeReturn.apply(this, arguments);
    }
  };
  prototype.compile = function(o, level){
    var val, ref$;
    level == null && (level = o.level);
    switch (val = this.value + "") {
    case 'this':
      return ((ref$ = o.scope.fun) != null ? ref$.bound : void 8) || val;
    case 'void':
      if (!level) {
        return '';
      }
      val += ' 8';
      // fallthrough
    case 'null':
      if (level === LEVEL_CALL) {
        this.carp('invalid use of ' + this.value);
      }
      break;
    case 'on':
    case 'yes':
      val = 'true';
      break;
    case 'off':
    case 'no':
      val = 'false';
      break;
    case '*':
      this.carp('stray star');
      break;
    case '..':
      if (!(val = o.ref)) {
        this.carp('stray reference');
      }
      this.cascadee || (val.erred = true);
      break;
    case 'debugger':
      if (level) {
        return "(function(){ debugger; }())";
      }
    }
    return val;
  };
  return Literal;
}(Atom));
exports.Var = Var = (function(superclass){
  var prototype = extend$((import$(Var, superclass).displayName = 'Var', Var), superclass).prototype, constructor = Var;
  function Var(value){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.value = value;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.isAssignable = prototype.isCallable = YES;
  prototype.assigns = function(it){
    return it === this.value;
  };
  prototype.maybeKey = function(){
    var ref$;
    return ref$ = Key(this.value), ref$.line = this.line, ref$;
  };
  prototype.varName = prototype.show;
  prototype.compile = function(o){
    if (this.temp) {
      return o.scope.free(this.value);
    } else {
      return this.value;
    }
  };
  return Var;
}(Atom));
exports.Key = Key = (function(superclass){
  var prototype = extend$((import$(Key, superclass).displayName = 'Key', Key), superclass).prototype, constructor = Key;
  function Key(name, reserved){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.reserved = reserved || name.reserved;
    this$.name = '' + name;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.isComplex = NO;
  prototype.assigns = function(it){
    return it === this.name;
  };
  prototype.varName = function(){
    var name;
    name = this.name;
    if (this.reserved || (name === 'arguments' || name === 'eval')) {
      return "$" + name;
    } else {
      return name;
    }
  };
  prototype.compile = prototype.show = function(){
    if (this.reserved) {
      return "'" + this.name + "'";
    } else {
      return this.name;
    }
  };
  return Key;
}(Node));
exports.Index = Index = (function(superclass){
  var prototype = extend$((import$(Index, superclass).displayName = 'Index', Index), superclass).prototype, constructor = Index;
  function Index(key, symbol, init){
    var k, this$ = this instanceof ctor$ ? this : new ctor$;
    symbol || (symbol = '.');
    if (init && key instanceof Arr) {
      switch (key.items.length) {
      case 1:
        if (!((k = key.items[0]) instanceof Splat)) {
          key = Parens(k);
        }
      }
    }
    switch (symbol) {
    case '[]':
      this$.vivify = Arr;
      break;
    case '{}':
      this$.vivify = Obj;
      break;
    default:
      if ('=' === symbol.slice(-1)) {
        this$.assign = symbol.slice(1);
      }
    }
    this$.key = key;
    this$.symbol = symbol;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['key'];
  prototype.show = function(){
    return [this.soak ? '?' : void 8] + this.symbol;
  };
  prototype.isComplex = function(){
    return this.key.isComplex();
  };
  prototype.varName = function(){
    var ref$;
    return ((ref$ = this.key) instanceof Key || ref$ instanceof Literal) && this.key.varName();
  };
  prototype.compile = function(o){
    var code;
    code = this.key.compile(o, LEVEL_PAREN);
    if (this.key instanceof Key && '\'' !== code.charAt(0)) {
      return "." + code;
    } else {
      return "[" + code + "]";
    }
  };
  return Index;
}(Node));
exports.Slice = Slice = (function(superclass){
  var prototype = extend$((import$(Slice, superclass).displayName = 'Slice', Slice), superclass).prototype, constructor = Slice;
  function Slice(arg$){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.type = arg$.type, this$.target = arg$.target, this$.from = arg$.from, this$.to = arg$.to;
    this$.from == null && (this$.from = Literal(0));
    if (this$.to && this$.type === 'to') {
      this$.to = Binary('+', this$.to, Literal('1'));
    }
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['target', 'from', 'to'];
  prototype.show = function(){
    return this.type;
  };
  prototype.compileNode = function(o){
    var args;
    if (this.to && this.type === 'to') {
      this.to = Binary('||', this.to, Literal('9e9'));
    }
    args = [this.target, this.from];
    if (this.to) {
      args.push(this.to);
    }
    return Chain(Var(util('slice'))).add(Index(Key('call'), '.', true)).add(Call(args)).compile(o);
  };
  return Slice;
}(Node));
exports.Chain = Chain = (function(superclass){
  var prototype = extend$((import$(Chain, superclass).displayName = 'Chain', Chain), superclass).prototype, constructor = Chain;
  function Chain(head, tails){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    if (!tails && head instanceof Chain) {
      return head;
    }
    this$.head = head;
    this$.tails = tails || [];
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['head', 'tails'];
  prototype.add = function(it){
    var last, ref$, index, ref1$, bi, that, ref2$, logics, call, f;
    if (this.tails.length) {
      last = (ref$ = this.tails)[ref$.length - 1];
      if (last instanceof Call && ((ref$ = last.partialized) != null ? ref$.length : void 8) === 1 && it.args.length === 1) {
        index = last.partialized[0].head.value;
        delete last.partialized;
        last.args[index] = it.args[0];
        return this;
      }
    }
    if (this.head instanceof Existence) {
      ref1$ = Chain(this.head.it), this.head = ref1$.head, this.tails = ref1$.tails;
      it.soak = true;
    }
    this.tails.push(it);
    bi = this.head instanceof Parens && this.head.it instanceof Binary && !this.head.it.partial
      ? this.head.it
      : this.head instanceof Binary && !this.head.partial ? this.head : void 8;
    if (this.head instanceof Super) {
      if (!this.head.called && it instanceof Call && !it.method) {
        it.method = '.call';
        it.args.unshift(Literal('this'));
        this.head.called = true;
      } else if (!this.tails[1] && ((ref1$ = it.key) != null ? ref1$.name : void 8) === 'prototype') {
        this.head.sproto = true;
      }
    } else if (that = (ref2$ = it.vivify, delete it.vivify, ref2$)) {
      this.head = Assign(Chain(this.head, this.tails.splice(0, 9e9)), that(), '=', '||');
    } else if (it instanceof Call && this.tails.length === 1 && bi && in$(bi.op, logics = ['&&', '||', 'xor'])) {
      call = it;
      f = function(x, key){
        var y;
        y = x[key];
        if (y instanceof Binary && in$(y.op, logics)) {
          f(y, 'first');
          return f(y, 'second');
        } else {
          return x[key] = Chain(y).autoCompare(call.args);
        }
      };
      f(bi, 'first');
      f(bi, 'second');
      return bi;
    }
    return this;
  };
  prototype.autoCompare = function(target){
    var test;
    test = this.head;
    switch (false) {
    case !(test instanceof Literal):
      return Binary('===', test, target[0]);
    case !(test instanceof Unary && test.it instanceof Literal):
      return Binary('===', test, target[0]);
    case !(test instanceof Arr || test instanceof Obj):
      return Binary('====', test, target[0]);
    case !(test instanceof Var && test.value === '_'):
      return Literal('true');
    default:
      return this.add(Call(target)) || [];
    }
  };
  prototype.flipIt = function(){
    this.flip = true;
    return this;
  };
  prototype.unwrap = function(){
    if (this.tails.length) {
      return this;
    } else {
      return this.head;
    }
  };
  prototype.delegate(['getJump', 'assigns', 'isStatement', 'isString'], function(it, arg){
    return !this.tails.length && this.head[it](arg);
  });
  prototype.isComplex = function(){
    return this.tails.length || this.head.isComplex();
  };
  prototype.isCallable = function(){
    var that, ref$;
    if (that = (ref$ = this.tails)[ref$.length - 1]) {
      return !((ref$ = that.key) != null && ref$.items);
    } else {
      return this.head.isCallable();
    }
  };
  prototype.isArray = function(){
    var that, ref$;
    if (that = (ref$ = this.tails)[ref$.length - 1]) {
      return that.key instanceof Arr;
    } else {
      return this.head.isArray();
    }
  };
  prototype.isRegex = function(){
    return this.head.value === 'RegExp' && !this.tails[1] && this.tails[0] instanceof Call;
  };
  prototype.isAssignable = function(){
    var tail, ref$, i$, len$;
    if (!(tail = (ref$ = this.tails)[ref$.length - 1])) {
      return this.head.isAssignable();
    }
    if (!(tail instanceof Index) || tail.key instanceof List || tail.symbol === '.~') {
      return false;
    }
    for (i$ = 0, len$ = (ref$ = this.tails).length; i$ < len$; ++i$) {
      tail = ref$[i$];
      if (tail.assign) {
        return false;
      }
    }
    return true;
  };
  prototype.isSimpleAccess = function(){
    return this.tails.length === 1 && !this.head.isComplex() && !this.tails[0].isComplex();
  };
  prototype.makeReturn = function(){
    var ref$;
    if (this.tails.length) {
      return superclass.prototype.makeReturn.apply(this, arguments);
    } else {
      return (ref$ = this.head).makeReturn.apply(ref$, arguments);
    }
  };
  prototype.getCall = function(){
    var tail, ref$;
    return (tail = (ref$ = this.tails)[ref$.length - 1]) instanceof Call && tail;
  };
  prototype.varName = function(){
    var ref$, ref1$;
    return (ref$ = (ref1$ = this.tails)[ref1$.length - 1]) != null ? ref$.varName() : void 8;
  };
  prototype.cacheReference = function(o){
    var name, ref$, base, ref, bref, nref;
    name = (ref$ = this.tails)[ref$.length - 1];
    if (!this.isAssignable()) {
      return this.unwrap().cache(o, true);
    }
    if (this.tails.length < 2 && !this.head.isComplex() && !(name != null && name.isComplex())) {
      return [this, this];
    }
    base = Chain(this.head, this.tails.slice(0, -1));
    if (base.isComplex()) {
      ref = o.scope.temporary();
      base = Chain(Assign(Var(ref), base));
      bref = (ref$ = Var(ref), ref$.temp = true, ref$);
    }
    if (!name) {
      return [base, bref];
    }
    if (name.isComplex()) {
      ref = o.scope.temporary('key');
      name = Index(Assign(Var(ref), name.key));
      nref = Index((ref$ = Var(ref), ref$.temp = true, ref$));
    }
    return [base.add(name), Chain(bref || base.head, [nref || name])];
  };
  prototype.compileNode = function(o){
    var head, tails, that, i$, len$, t, hasPartial, pre, rest, broken, partial, post, context, idt, func, base, news, ref$;
    if (this.flip) {
      util('flip');
      util('curry');
    }
    head = this.head, tails = this.tails;
    head.front = this.front;
    head.newed = this.newed;
    if (!tails.length) {
      return head.compile(o);
    }
    if (that = this.unfoldAssign(o)) {
      return that.compile(o);
    }
    for (i$ = 0, len$ = tails.length; i$ < len$; ++i$) {
      t = tails[i$];
      if (t.partialized) {
        hasPartial = true;
        break;
      }
    }
    if (hasPartial) {
      util('slice');
      pre = [];
      rest = [];
      for (i$ = 0, len$ = tails.length; i$ < len$; ++i$) {
        t = tails[i$];
        broken = broken || t.partialized != null;
        if (broken) {
          rest.push(t);
        } else {
          pre.push(t);
        }
      }
      if (rest != null) {
        partial = rest[0], post = slice$.call(rest, 1);
      }
      this.tails = pre;
      context = pre.length
        ? Chain(head, slice$.call(pre, 0, -1))
        : Literal('this');
      return Chain(Chain(Var(util('partialize'))).add(Index(Key('apply'))).add(Call([context, Arr([this, Arr(partial.args), Arr(partial.partialized)])])), post).compile(o);
    }
    if (tails[0] instanceof Call && !head.isCallable()) {
      this.carp('invalid callee');
    }
    this.expandSlice(o);
    this.expandBind(o);
    this.expandSplat(o);
    this.expandStar(o);
    if (this.splattedNewArgs) {
      idt = o.indent + TAB;
      func = Chain(this.head, tails.slice(0, -1));
      return "(function(func, args, ctor) {\n" + idt + "ctor.prototype = func.prototype;\n" + idt + "var child = new ctor, result = func.apply(child, args), t;\n" + idt + "return (t = typeof result)  == \"object\" || t == \"function\" ? result || child : child;\n" + TAB + "})(" + func.compile(o) + ", " + this.splattedNewArgs + ", function(){})";
    }
    if (!this.tails.length) {
      return this.head.compile(o);
    }
    base = this.head.compile(o, LEVEL_CALL);
    news = rest = '';
    for (i$ = 0, len$ = (ref$ = this.tails).length; i$ < len$; ++i$) {
      t = ref$[i$];
      if (t['new']) {
        news += 'new ';
      }
      rest += t.compile(o);
    }
    if ('.' === rest.charAt(0) && SIMPLENUM.test(base)) {
      base += ' ';
    }
    return news + base + rest;
  };
  prototype.unfoldSoak = function(o){
    var that, ref$, i$, len$, i, node, ref1$, bust, test;
    if (that = this.head.unfoldSoak(o)) {
      (ref$ = that.then.tails).push.apply(ref$, this.tails);
      return that;
    }
    for (i$ = 0, len$ = (ref$ = this.tails).length; i$ < len$; ++i$) {
      i = i$;
      node = ref$[i$];
      if (ref1$ = node.soak, delete node.soak, ref1$) {
        bust = Chain(this.head, this.tails.splice(0, i));
        if (node.assign && !bust.isAssignable()) {
          node.carp('invalid accessign');
        }
        if (i && (node.assign || node instanceof Call)) {
          ref1$ = bust.cacheReference(o), test = ref1$[0], bust = ref1$[1];
          if (bust instanceof Chain) {
            (ref1$ = this.tails).unshift.apply(ref1$, bust.tails);
            bust = bust.head;
          }
          this.head = bust;
        } else {
          ref1$ = bust.unwrap().cache(o), test = ref1$[0], this.head = ref1$[1];
        }
        test = node instanceof Call
          ? JS("typeof " + test.compile(o, LEVEL_OP) + " == 'function'")
          : Existence(test);
        return ref1$ = If(test, this), ref1$.soak = true, ref1$.cond = this.cond, ref1$['void'] = this['void'], ref1$;
      }
    }
  };
  prototype.unfoldAssign = function(o){
    var that, ref$, i$, len$, i, index, op, left, lefts, rites, j$, len1$, node, ref1$;
    if (that = this.head.unfoldAssign(o)) {
      (ref$ = that.right.tails).push.apply(ref$, this.tails);
      return that;
    }
    for (i$ = 0, len$ = (ref$ = this.tails).length; i$ < len$; ++i$) {
      i = i$;
      index = ref$[i$];
      if (op = index.assign) {
        index.assign = '';
        left = Chain(this.head, this.tails.splice(0, i)).expandSlice(o).unwrap();
        if (left instanceof Arr) {
          lefts = left.items;
          rites = (this.head = Arr()).items;
          for (j$ = 0, len1$ = lefts.length; j$ < len1$; ++j$) {
            i = j$;
            node = lefts[j$];
            ref1$ = Chain(node).cacheReference(o), rites[i] = ref1$[0], lefts[i] = ref1$[1];
          }
        } else {
          ref1$ = Chain(left).cacheReference(o), left = ref1$[0], this.head = ref1$[1];
        }
        if (op === '=') {
          op = ':=';
        }
        return ref1$ = Assign(left, this, op), ref1$.access = true, ref1$;
      }
    }
  };
  prototype.expandSplat = function(o){
    var tails, i, call, args, ctx, ref$;
    tails = this.tails;
    i = -1;
    while (call = tails[++i]) {
      if (!(args = call.args)) {
        continue;
      }
      ctx = call.method === '.call' && (args = args.concat()).shift();
      if (!(args = Splat.compileArray(o, args, true))) {
        continue;
      }
      if (call['new']) {
        this.splattedNewArgs = args;
      } else {
        if (!ctx && tails[i - 1] instanceof Index) {
          ref$ = Chain(this.head, tails.splice(0, i - 1)).cache(o, true), this.head = ref$[0], ctx = ref$[1];
          i = 0;
        }
        call.method = '.apply';
        call.args = [ctx || Literal('null'), JS(args)];
      }
    }
  };
  prototype.expandBind = function(o){
    var tails, i, that, obj, key, call;
    tails = this.tails;
    i = -1;
    while (that = tails[++i]) {
      if (that.symbol !== '.~') {
        continue;
      }
      that.symbol = '';
      obj = Chain(this.head, tails.splice(0, i)).unwrap();
      key = tails.shift().key;
      call = Call.make(Util('bind'), [obj, (key.reserved = true, key)]);
      this.head = this.newed ? Parens(call, true) : call;
      i = -1;
    }
  };
  prototype.expandStar = function(o){
    var tails, i, that, stars, ref$, sub, ref, temps, value, i$, len$, star;
    tails = this.tails;
    i = -1;
    while (that = tails[++i]) {
      if (that.args || that.stars || that.key instanceof Key) {
        continue;
      }
      stars = that.stars = [];
      that.eachChild(seek);
      if (!stars.length) {
        continue;
      }
      ref$ = Chain(this.head, tails.splice(0, i)).unwrap().cache(o), sub = ref$[0], ref = ref$[1], temps = ref$[2];
      value = Chain(ref, [Index(Key('length'))]).compile(o);
      for (i$ = 0, len$ = stars.length; i$ < len$; ++i$) {
        star = stars[i$];
        star.value = value;
        star.isAssignable = YES;
      }
      this.head = JS(sub.compile(o, LEVEL_CALL) + tails.shift().compile(o));
      if (temps) {
        o.scope.free(temps[0]);
      }
      i = -1;
    }
    function seek(it){
      if (it.value === '*') {
        stars.push(it);
      } else if (!(it instanceof Index)) {
        it.eachChild(seek);
      }
    }
  };
  prototype.expandSlice = function(o, assign){
    var tails, i, tail, ref$, x;
    tails = this.tails;
    i = -1;
    while (tail = tails[++i]) {
      if ((ref$ = tail.key) != null && ref$.items) {
        if (tails[i + 1] instanceof Call) {
          tail.carp('calling a slice');
        }
        x = tails.splice(0, i + 1);
        x = x.pop().key.toSlice(o, Chain(this.head, x).unwrap(), tail.symbol, assign);
        this.head = (x.front = this.front, x);
        i = -1;
      }
    }
    return this;
  };
  return Chain;
}(Node));
exports.Call = Call = (function(superclass){
  var prototype = extend$((import$(Call, superclass).displayName = 'Call', Call), superclass).prototype, constructor = Call;
  function Call(args){
    var splat, i$, len$, i, a, ref$, this$ = this instanceof ctor$ ? this : new ctor$;
    args || (args = []);
    if (args.length === 1 && (splat = args[0]) instanceof Splat) {
      if (splat.filler) {
        this$.method = '.call';
        args[0] = Literal('this');
        args[1] = Splat(Literal('arguments'));
      } else if (splat.it instanceof Arr) {
        args = splat.it.items;
      }
    } else {
      for (i$ = 0, len$ = args.length; i$ < len$; ++i$) {
        i = i$;
        a = args[i$];
        if (a.value === '_') {
          args[i] = Chain(Literal('void'));
          args[i].placeholder = true;
          ((ref$ = this$.partialized) != null
            ? ref$
            : this$.partialized = []).push(Chain(Literal(i)));
        }
      }
    }
    this$.args = args;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['args'];
  prototype.show = function(){
    return [this['new']] + [this.method] + [this.soak ? '?' : void 8];
  };
  prototype.compile = function(o){
    var code, i$, ref$, len$, i, a;
    code = (this.method || '') + '(' + (this.pipe ? "\n" + o.indent : '');
    for (i$ = 0, len$ = (ref$ = this.args).length; i$ < len$; ++i$) {
      i = i$;
      a = ref$[i$];
      code += (i ? ', ' : '') + a.compile(o, LEVEL_LIST);
    }
    return code + ')';
  };
  Call.make = function(callee, args, opts){
    var call;
    call = Call(args);
    if (opts) {
      import$(call, opts);
    }
    return Chain(callee).add(call);
  };
  Call.block = function(fun, args, method){
    var ref$, ref1$;
    return ref$ = Parens(Chain(fun, [(ref1$ = Call(args), ref1$.method = method, ref1$)]), true), ref$.calling = true, ref$;
  };
  Call.back = function(params, node, bound, curried){
    var fun, ref$, args, index, i$, len$, a;
    fun = Fun(params, void 8, bound, curried);
    if (fun.hushed = node.op === '!') {
      node = node.it;
    }
    if (node instanceof Label) {
      fun.name = node.label;
      fun.labeled = true;
      node = node.it;
    }
    if (!fun.hushed && (fun.hushed = node.op === '!')) {
      node = node.it;
    }
    if ((ref$ = node.getCall()) != null) {
      ref$.partialized = null;
    }
    args = (node.getCall() || (node = Chain(node).add(Call())).getCall()).args;
    index = 0;
    for (i$ = 0, len$ = args.length; i$ < len$; ++i$) {
      a = args[i$];
      if (a.placeholder) {
        break;
      }
      ++index;
    }
    return node.back = (args[index] = fun).body, node;
  };
  Call['let'] = function(args, body){
    var params, res$, i$, len$, i, a, that, gotThis;
    res$ = [];
    for (i$ = 0, len$ = args.length; i$ < len$; ++i$) {
      i = i$;
      a = args[i$];
      if (that = a.op === '=' && !a.logic && a.right) {
        args[i] = that;
        if (i === 0 && (gotThis = a.left.value === 'this')) {
          continue;
        }
        res$.push(a.left);
      } else {
        res$.push(Var(a.varName() || a.carp('invalid "let" argument')));
      }
    }
    params = res$;
    gotThis || args.unshift(Literal('this'));
    return this.block(Fun(params, body), args, '.call');
  };
  return Call;
}(Node));
List = (function(superclass){
  var prototype = extend$((import$(List, superclass).displayName = 'List', List), superclass).prototype, constructor = List;
  prototype.children = ['items'];
  prototype.show = function(){
    return this.name;
  };
  prototype.named = function(name){
    this.name = name;
    return this;
  };
  prototype.isEmpty = function(){
    return !this.items.length;
  };
  prototype.assigns = function(it){
    var i$, ref$, len$, node;
    for (i$ = 0, len$ = (ref$ = this.items).length; i$ < len$; ++i$) {
      node = ref$[i$];
      if (node.assigns(it)) {
        return true;
      }
    }
  };
  List.compile = function(o, items, deepEq){
    var indent, level, code, i, that, target;
    switch (items.length) {
    case 0:
      return '';
    case 1:
      return items[0].compile(o, LEVEL_LIST);
    }
    indent = o.indent, level = o.level;
    o.indent = indent + TAB;
    o.level = LEVEL_LIST;
    code = items[i = 0].compile(o);
    while (that = items[++i]) {
      code += ', ';
      target = that;
      if (deepEq) {
        if (target instanceof Var && target.value === '_') {
          target = Obj([Prop(Key('__placeholder__'), Literal(true))]);
        } else if (target instanceof Obj || target instanceof Arr) {
          target.deepEq = true;
        }
      }
      code += target.compile(o);
    }
    if (~code.indexOf('\n')) {
      code = "\n" + o.indent + code + "\n" + indent;
    }
    o.indent = indent;
    o.level = level;
    return code;
  };
  function List(){
    List.superclass.apply(this, arguments);
  }
  return List;
}(Node));
exports.Obj = Obj = (function(superclass){
  var prototype = extend$((import$(Obj, superclass).displayName = 'Obj', Obj), superclass).prototype, constructor = Obj;
  function Obj(items){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.items = items || [];
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.asObj = THIS;
  prototype.toSlice = function(o, base, symbol, assign){
    var items, ref$, ref, temps, i$, len$, i, node, name, chain, logic, key, val;
    items = this.items;
    if (items.length > 1) {
      ref$ = base.cache(o), base = ref$[0], ref = ref$[1], temps = ref$[2];
    } else {
      ref = base;
    }
    for (i$ = 0, len$ = items.length; i$ < len$; ++i$) {
      i = i$;
      node = items[i$];
      if (node.comment) {
        continue;
      }
      if (node instanceof Prop || node instanceof Splat) {
        node[name = (ref$ = node.children)[ref$.length - 1]] = chain = Chain(base, [Index(node[name].maybeKey())]);
      } else {
        if (logic = node.getDefault()) {
          node = node.first;
        }
        if (node instanceof Parens) {
          ref$ = node.cache(o, true), key = ref$[0], node = ref$[1];
          if (assign) {
            ref$ = [node, key], key = ref$[0], node = ref$[1];
          }
          key = Parens(key);
        } else {
          key = node;
        }
        val = chain = Chain(base, [Index(node.maybeKey(), symbol)]);
        if (logic) {
          val = (logic.first = val, logic);
        }
        items[i] = Prop(key, val);
      }
      base = ref;
    }
    chain || this.carp('empty slice');
    if (temps) {
      (chain.head = Var(temps[0])).temp = true;
    }
    return this;
  };
  prototype.compileNode = function(o){
    var items, code, idt, dic, i$, len$, i, node, logic, rest, ref$, multi, key, val;
    items = this.items;
    if (!items.length) {
      return this.front ? '({})' : '{}';
    }
    code = '';
    idt = '\n' + (o.indent += TAB);
    dic = {};
    for (i$ = 0, len$ = items.length; i$ < len$; ++i$) {
      i = i$;
      node = items[i$];
      if (node.comment) {
        code += idt + node.compile(o);
        continue;
      }
      if (logic = node.getDefault()) {
        node = node.first;
      }
      if (node instanceof Splat || (node.key || node) instanceof Parens) {
        rest = items.slice(i);
        break;
      }
      if (logic) {
        if (node instanceof Prop) {
          node.val = (logic.first = node.val, logic);
        } else {
          node = Prop(node, (logic.first = node, logic));
        }
      }
      if (this.deepEq && node instanceof Prop) {
        if (node.val instanceof Var && node.val.value === '_') {
          node.val = Obj([Prop(Key('__placeholder__'), Literal(true))]);
        } else if ((ref$ = node.val) instanceof Obj || ref$ instanceof Arr) {
          node.val.deepEq = true;
        }
      }
      if (multi) {
        code += ',';
      } else {
        multi = true;
      }
      code += idt + (node instanceof Prop
        ? (key = node.key, val = node.val, node.accessor
          ? node.compileAccessor(o, key = key.compile(o))
          : (val.ripName(key), (key = key.compile(o)) + ": " + val.compile(o, LEVEL_LIST)))
        : (key = node.compile(o)) + ": " + key);
      ID.test(key) || (key = Function("return " + key)());
      if (!(dic[key + "."] ^= 1)) {
        node.carp("duplicate property \"" + key + "\"");
      }
    }
    code = "{" + (code && code + '\n' + this.tab) + "}";
    rest && (code = Import(JS(code), Obj(rest)).compile((o.indent = this.tab, o)));
    if (this.front && '{' === code.charAt()) {
      return "(" + code + ")";
    } else {
      return code;
    }
  };
  return Obj;
}(List));
exports.Prop = Prop = (function(superclass){
  var prototype = extend$((import$(Prop, superclass).displayName = 'Prop', Prop), superclass).prototype, constructor = Prop;
  function Prop(key, val){
    var that, i$, len$, fun, this$ = this instanceof ctor$ ? this : new ctor$;
    this$.key = key;
    this$.val = val;
    if (key.value === '...') {
      return Splat(this$.val);
    }
    if (that = val.getAccessors()) {
      this$.val = that;
      for (i$ = 0, len$ = that.length; i$ < len$; ++i$) {
        fun = that[i$];
        fun.x = (fun.hushed = fun.params.length) ? 's' : 'g';
      }
      this$['accessor'] = 'accessor';
    }
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['key', 'val'];
  prototype.show = function(){
    return this.accessor;
  };
  prototype.assigns = function(it){
    var ref$;
    return typeof (ref$ = this.val).assigns == 'function' ? ref$.assigns(it) : void 8;
  };
  prototype.compileAccessor = function(o, key){
    var funs, fun;
    funs = this.val;
    if (funs[1] && funs[0].params.length + funs[1].params.length !== 1) {
      funs[0].carp('invalid accessor parameter');
    }
    return (function(){
      var i$, ref$, len$, results$ = [];
      for (i$ = 0, len$ = (ref$ = funs).length; i$ < len$; ++i$) {
        fun = ref$[i$];
        fun.accessor = true;
        results$.push(fun.x + "et " + key + fun.compile(o, LEVEL_LIST).slice(8));
      }
      return results$;
    }()).join(',\n' + o.indent);
  };
  prototype.compileDescriptor = function(o){
    var obj, i$, ref$, len$, fun;
    obj = Obj();
    for (i$ = 0, len$ = (ref$ = this.val).length; i$ < len$; ++i$) {
      fun = ref$[i$];
      obj.items.push(Prop(Key(fun.x + 'et'), fun));
    }
    obj.items.push(Prop(Key('configurable'), Literal(true)));
    obj.items.push(Prop(Key('enumerable'), Literal(true)));
    return obj.compile(o);
  };
  return Prop;
}(Node));
exports.Arr = Arr = (function(superclass){
  var prototype = extend$((import$(Arr, superclass).displayName = 'Arr', Arr), superclass).prototype, constructor = Arr;
  function Arr(items){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.items = items || [];
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.isArray = YES;
  prototype.asObj = function(){
    var i, item;
    return Obj((function(){
      var i$, ref$, len$, results$ = [];
      for (i$ = 0, len$ = (ref$ = this.items).length; i$ < len$; ++i$) {
        i = i$;
        item = ref$[i$];
        results$.push(Prop(Literal(i), item));
      }
      return results$;
    }.call(this)));
  };
  prototype.toSlice = function(o, base, symbol){
    var items, ref$, ref, i$, len$, i, item, splat, chain;
    items = this.items;
    if (items.length > 1) {
      ref$ = base.cache(o), base = ref$[0], ref = ref$[1];
    } else {
      ref = base;
    }
    for (i$ = 0, len$ = items.length; i$ < len$; ++i$) {
      i = i$;
      item = items[i$];
      if (splat = item instanceof Splat) {
        item = item.it;
      }
      if (item.isEmpty()) {
        continue;
      }
      chain = Chain(base, [Index(item, symbol)]);
      items[i] = splat ? Splat(chain) : chain;
      base = ref;
    }
    chain || this.carp('empty slice');
    return this;
  };
  prototype.compile = function(o){
    var items, code;
    items = this.items;
    if (!items.length) {
      return '[]';
    }
    if (code = Splat.compileArray(o, items)) {
      return this.newed ? "(" + code + ")" : code;
    }
    return "[" + List.compile(o, items, this.deepEq) + "]";
  };
  Arr.maybe = function(nodes){
    if (nodes.length === 1 && !(nodes[0] instanceof Splat)) {
      return nodes[0];
    }
    return constructor(nodes);
  };
  Arr.wrap = function(it){
    return constructor([Splat((it.isArray = YES, it))]);
  };
  return Arr;
}(List));
exports.Unary = Unary = (function(superclass){
  var prototype = extend$((import$(Unary, superclass).displayName = 'Unary', Unary), superclass).prototype, constructor = Unary;
  function Unary(op, it, flag){
    var that, i$, ref$, len$, node, this$ = this instanceof ctor$ ? this : new ctor$;
    if (it != null) {
      if (that = !flag && it.unaries) {
        that.push(op);
        return it;
      }
      switch (op) {
      case '!':
        if (flag) {
          break;
        }
        if (it instanceof Fun && !it.hushed) {
          return it.hushed = true, it;
        }
        return it.invert();
      case '++':
      case '--':
        if (flag) {
          this$.post = true;
        }
        break;
      case 'new':
        if (it instanceof Existence && !it.negated) {
          it = Chain(it).add(Call());
        }
        it.newed = true;
        for (i$ = 0, len$ = (ref$ = it.tails || '').length; i$ < len$; ++i$) {
          node = ref$[i$];
          if (node instanceof Call && !node['new']) {
            if (node.method === '.call') {
              node.args.shift();
            }
            node['new'] = 'new';
            node.method = '';
            return it;
          }
        }
        break;
      case '~':
        if (it instanceof Fun && it.statement && !it.bound) {
          return it.bound = 'this$', it;
        }
      }
    }
    this$.op = op;
    this$.it = it;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['it'];
  prototype.show = function(){
    return [this.post ? '@' : void 8] + this.op;
  };
  prototype.isCallable = function(){
    var ref$;
    return ((ref$ = this.op) === 'do' || ref$ === 'new' || ref$ === 'delete') || this.it == null;
  };
  prototype.isArray = function(){
    return this.it instanceof Arr && this.it.items.length || this.it instanceof Chain && this.it.isArray();
  };
  prototype.isString = function(){
    var ref$;
    return (ref$ = this.op) === 'typeof' || ref$ === 'classof';
  };
  prototype.invert = function(){
    var ref$;
    if (this.op === '!' && ((ref$ = this.it.op) === '!' || ref$ === '<' || ref$ === '>' || ref$ === '<=' || ref$ === '>=' || ref$ === 'of' || ref$ === 'instanceof')) {
      return this.it;
    }
    return constructor('!', this, true);
  };
  prototype.unfoldSoak = function(o){
    var ref$;
    return ((ref$ = this.op) === '++' || ref$ === '--' || ref$ === 'delete') && this.it != null && If.unfoldSoak(o, this, 'it');
  };
  prototype.getAccessors = function(){
    var items;
    if (this.op !== '~') {
      return;
    }
    if (this.it instanceof Fun) {
      return [this.it];
    }
    if (this.it instanceof Arr) {
      items = this.it.items;
      if (!items[2] && items[0] instanceof Fun && items[1] instanceof Fun) {
        return items;
      }
    }
  };
  function crement(it){
    return {
      '++': 'in',
      '--': 'de'
    }[it] + 'crement';
  }
  prototype.compileNode = function(o){
    var that, op, it, x, code;
    if (this.it == null) {
      return this.compileAsFunc(o);
    }
    if (that = this.compileSpread(o)) {
      return that;
    }
    op = this.op, it = this.it;
    switch (op) {
    case '!':
      it.cond = true;
      break;
    case 'new':
      it.isCallable() || it.carp('invalid constructor');
      break;
    case 'do':
      if (o.level === LEVEL_TOP && it instanceof Fun && it.isStatement()) {
        return it.compile(o) + " " + Unary('do', Var(it.name)).compile(o);
      }
      x = Parens(it instanceof Existence && !it.negated
        ? Chain(it).add(Call())
        : Call.make(it));
      return (x.front = this.front, x.newed = this.newed, x).compile(o);
    case 'delete':
      if (it instanceof Var || !it.isAssignable()) {
        this.carp('invalid delete');
      }
      if (o.level && !this['void']) {
        return this.compilePluck(o);
      }
      break;
    case '++':
    case '--':
      it.isAssignable() || this.carp('invalid ' + crement(op));
      if (that = it instanceof Var && o.scope.checkReadOnly(it.value)) {
        this.carp(crement(op) + " of " + that + " \"" + it.value + "\"", ReferenceError);
      }
      if (this.post) {
        it.front = this.front;
      }
      break;
    case '^^':
      return util('clone') + "(" + it.compile(o, LEVEL_LIST) + ")";
    case 'jsdelete':
      return "delete " + it.compile(o, LEVEL_LIST);
    case 'classof':
      return util('toString') + ".call(" + it.compile(o, LEVEL_LIST) + ").slice(8, -1)";
    }
    code = it.compile(o, LEVEL_OP + PREC.unary);
    if (this.post) {
      code += op;
    } else {
      if (op === 'yieldfrom') {
        op = 'yield* ';
      }
      if ((op === 'new' || op === 'typeof' || op === 'delete' || op === 'yield') || (op === '+' || op === '-') && op === code.charAt()) {
        op += ' ';
      }
      code = op + code;
    }
    if (o.level < LEVEL_CALL) {
      return code;
    } else {
      return "(" + code + ")";
    }
  };
  prototype.compileSpread = function(o){
    var it, ops, them, i$, len$, i, node, sp, j$, op, lat, ref$;
    it = this.it;
    ops = [this];
    for (; it instanceof constructor; it = it.it) {
      ops.push(it);
    }
    if (!((it = it.expandSlice(o).unwrap()) instanceof Arr && (them = it.items).length)) {
      return '';
    }
    for (i$ = 0, len$ = them.length; i$ < len$; ++i$) {
      i = i$;
      node = them[i$];
      if (sp = node instanceof Splat) {
        node = node.it;
      }
      for (j$ = ops.length - 1; j$ >= 0; --j$) {
        op = ops[j$];
        node = constructor(op.op, node, op.post);
      }
      them[i] = sp ? lat = Splat(node) : node;
    }
    if (!lat && (this['void'] || !o.level)) {
      it = (ref$ = Block(them), ref$.front = this.front, ref$['void'] = true, ref$);
    }
    return it.compile(o, LEVEL_PAREN);
  };
  prototype.compilePluck = function(o){
    var ref$, get, del, code, ref;
    ref$ = Chain(this.it).cacheReference(o), get = ref$[0], del = ref$[1];
    code = (ref = o.scope.temporary()) + " = " + get.compile(o, LEVEL_LIST) + ", delete " + del.compile(o, LEVEL_LIST) + ", " + o.scope.free(ref);
    if (o.level < LEVEL_LIST) {
      return code;
    } else {
      return "(" + code + ")";
    }
  };
  prototype.compileAsFunc = function(o){
    if (this.op === '!') {
      return util('not');
    } else {
      return "(" + Fun([], Block(Unary(this.op, Chain(Var('it'))))).compile(o) + ")";
    }
  };
  return Unary;
}(Node));
exports.Binary = Binary = (function(superclass){
  var COMPARER, INVERSIONS, prototype = extend$((import$(Binary, superclass).displayName = 'Binary', Binary), superclass).prototype, constructor = Binary;
  function Binary(op, first, second, destructuring){
    var logic, that, ref$, this$ = this instanceof ctor$ ? this : new ctor$;
    if (destructuring) {
      logic = op.logic;
      if (toString$.call(destructuring).slice(8, -1) === 'String') {
        logic = destructuring;
      }
      op = (function(){
        switch (false) {
        case !(that = logic):
          return that;
        case op !== '=':
          return '?';
        default:
          return '=';
        }
      }());
    }
    this$.partial = first == null || second == null;
    if (!this$.partial) {
      if ('=' === op.charAt(op.length - 1) && ((ref$ = op.charAt(op.length - 2)) !== '=' && ref$ !== '<' && ref$ !== '>' && ref$ !== '!')) {
        return Assign(first.unwrap(), second, op);
      }
      switch (op) {
      case 'in':
        return new In(first, second);
      case 'with':
        return new Import(Unary('^^', first), second, false);
      case '<<<':
      case '<<<<':
        return Import(first, second, op === '<<<<');
      case '<|':
        return Block(first).pipe(second, op);
      case '|>':
        return Block(second).pipe(first, '<|');
      case '.':
      case '.~':
        return Chain(first).add(Index(second, op));
      }
    }
    this$.op = op;
    this$.first = first;
    this$.second = second;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['first', 'second'];
  prototype.show = function(){
    return this.op;
  };
  prototype.isCallable = function(){
    var ref$;
    return this.partial || ((ref$ = this.op) === '&&' || ref$ === '||' || ref$ === '?' || ref$ === '<<' || ref$ === '>>') && this.first.isCallable() && this.second.isCallable();
  };
  prototype.isArray = function(){
    switch (this.op) {
    case '*':
      return this.first.isArray();
    case '/':
      return this.second.isMatcher();
    }
  };
  prototype.isString = function(){
    switch (this.op) {
    case '+':
    case '*':
      return this.first.isString() || this.second.isString();
    case '-':
      return this.second.isMatcher();
    }
  };
  COMPARER = /^(?:[!=]=|[<>])=?$/;
  INVERSIONS = {
    '===': '!==',
    '!==': '===',
    '==': '!=',
    '!=': '=='
  };
  prototype.invert = function(){
    var that;
    if (that = !COMPARER.test(this.second.op) && INVERSIONS[this.op]) {
      this.op = that;
      this.wasInverted = true;
      return this;
    }
    return Unary('!', Parens(this), true);
  };
  prototype.invertIt = function(){
    this.inverted = true;
    return this;
  };
  prototype.getDefault = function(){
    switch (this.op) {
    case '?':
    case '||':
    case '&&':
      return this;
    }
  };
  prototype.xorChildren = function(test){
    var ref$, ref1$, first;
    if (!(!(ref$ = first = test(this.first)) !== !(ref1$ = test(this.second)) && (ref$ || ref1$))) {
      return false;
    }
    return first
      ? [this.first, this.second]
      : [this.second, this.first];
  };
  prototype.compileNode = function(o){
    var top, rite, items, that, ref$, code, level;
    if (this.partial) {
      return this.compilePartial(o);
    }
    switch (this.op) {
    case '?':
      return this.compileExistence(o);
    case '*':
      if (this.second.isString()) {
        return this.compileJoin(o);
      }
      if (this.first.isString() || this.first.isArray()) {
        return this.compileRepeat(o);
      }
      break;
    case '-':
      if (this.second.isMatcher()) {
        return this.compileRemove(o);
      }
      break;
    case '/':
      if (this.second.isMatcher()) {
        return this.compileSplit(o);
      }
      break;
    case '**':
    case '^':
      return this.compilePow(o);
    case '<?':
    case '>?':
      return this.compileMinMax(o);
    case '<<':
    case '>>':
      return this.compileCompose(o);
    case '++':
      return this.compileConcat(o);
    case '%%':
      return this.compileMod(o);
    case 'xor':
      return this.compileXor(o);
    case '&&':
    case '||':
      if (top = this['void'] || !o.level) {
        this.second['void'] = true;
      }
      if (top || this.cond) {
        this.first.cond = true;
        this.second.cond = true;
      }
      break;
    case 'instanceof':
      rite = this.second.expandSlice(o).unwrap(), items = rite.items;
      if (rite instanceof Arr) {
        if (items[1]) {
          return this.compileAnyInstanceOf(o, items);
        }
        this.second = items[0] || rite;
      }
      this.second.isCallable() || this.second.carp('invalid instanceof operand');
      break;
    case '====':
    case '!===':
      this.op = this.op.slice(0, 3);
      // fallthrough
    case '<==':
    case '>==':
    case '<<=':
    case '>>=':
      return this.compileDeepEq(o);
    default:
      if (COMPARER.test(this.op)) {
        if (that = ((ref$ = this.op) === '===' || ref$ === '!==') && this.xorChildren(function(it){
          return it.isRegex();
        })) {
          return this.compileRegexEquals(o, that);
        }
        if (this.op === '===' && (this.first instanceof Literal && this.second instanceof Literal) && this.first.isWhat() !== this.second.isWhat()) {
          if (typeof console != 'undefined' && console !== null) {
            console.warn("WARNING: strict comparison of two different types will always be false: " + this.first.value + " == " + this.second.value);
          }
        }
      }
      if (COMPARER.test(this.op) && COMPARER.test(this.second.op)) {
        return this.compileChain(o);
      }
    }
    this.first.front = this.front;
    code = this.first.compile(o, level = LEVEL_OP + PREC[this.op]) + " " + this.mapOp(this.op) + " " + this.second.compile(o, level);
    if (o.level <= level) {
      return code;
    } else {
      return "(" + code + ")";
    }
  };
  prototype.mapOp = function(op){
    var that;
    switch (false) {
    case !(that = op.match(/\.([&\|\^]|<<|>>>?)\./)):
      return that[1];
    case op !== 'of':
      return 'in';
    default:
      return op;
    }
  };
  prototype.compileChain = function(o){
    var code, level, ref$, sub;
    code = this.first.compile(o, level = LEVEL_OP + PREC[this.op]);
    ref$ = this.second.first.cache(o, true), sub = ref$[0], this.second.first = ref$[1];
    code += " " + this.op + " " + sub.compile(o, level) + " && " + this.second.compile(o, LEVEL_OP);
    if (o.level <= LEVEL_OP) {
      return code;
    } else {
      return "(" + code + ")";
    }
  };
  prototype.compileExistence = function(o){
    var x;
    if (this['void'] || !o.level) {
      x = Binary('&&', Existence(this.first, true), this.second);
      return (x['void'] = true, x).compileNode(o);
    }
    x = this.first.cache(o, true);
    return If(Existence(x[0]), x[1]).addElse(this.second).compileExpression(o);
  };
  prototype.compileAnyInstanceOf = function(o, items){
    var ref$, sub, ref, test, i$, len$, item;
    ref$ = this.first.cache(o), sub = ref$[0], ref = ref$[1], this.temps = ref$[2];
    test = Binary('instanceof', sub, items.shift());
    for (i$ = 0, len$ = items.length; i$ < len$; ++i$) {
      item = items[i$];
      test = Binary('||', test, Binary('instanceof', ref, item));
    }
    return Parens(test).compile(o);
  };
  prototype.compileMinMax = function(o){
    var lefts, rites, x;
    lefts = this.first.cache(o, true);
    rites = this.second.cache(o, true);
    x = Binary(this.op.charAt(), lefts[0], rites[0]);
    return If(x, lefts[1]).addElse(rites[1]).compileExpression(o);
  };
  prototype.compileMethod = function(o, klass, method, arg){
    var args;
    args = [this.second].concat(arg || []);
    if (this.first["is" + klass]()) {
      return Chain(this.first, [Index(Key(method)), Call(args)]).compile(o);
    } else {
      args.unshift(this.first);
      return Call.make(JS(util(method) + '.call'), args).compile(o);
    }
  };
  prototype.compileJoin = function(it){
    return this.compileMethod(it, 'Array', 'join');
  };
  prototype.compileRemove = function(it){
    return this.compileMethod(it, 'String', 'replace', JS("''"));
  };
  prototype.compileSplit = function(it){
    return this.compileMethod(it, 'String', 'split');
  };
  prototype.compileRepeat = function(o){
    var x, n, items, arr, that, refs, i$, len$, i, item, ref$, q;
    x = this.first, n = this.second;
    items = (x = x.expandSlice(o).unwrap()).items;
    arr = x.isArray() && 'Array';
    if (that = items && Splat.compileArray(o, items)) {
      x = JS(that);
      items = null;
    }
    if (arr && !items || !(n instanceof Literal && n.value < 0x20)) {
      return Call.make(Util('repeat' + (arr || 'String')), [x, n]).compile(o);
    }
    n = +n.value;
    if (1 <= n && n < 2) {
      return x.compile(o);
    }
    if (items) {
      if (n < 1) {
        return Block(items).add(JS('[]')).compile(o);
      }
      refs = [];
      for (i$ = 0, len$ = items.length; i$ < len$; ++i$) {
        i = i$;
        item = items[i$];
        ref$ = item.cache(o, 1), items[i] = ref$[0], refs[refs.length] = ref$[1];
      }
      items.push((ref$ = JS(), ref$.compile = function(){
        return (repeatString$(", " + List.compile(o, refs), n - 1)).slice(2);
      }, ref$));
      return x.compile(o);
    } else if (x instanceof Literal) {
      return (q = (x = x.compile(o)).charAt()) + repeatString$(x.slice(1, -1) + "", n) + q;
    } else {
      if (n < 1) {
        return Block(x.it).add(JS("''")).compile(o);
      }
      x = (refs = x.cache(o, 1, LEVEL_OP))[0] + repeatString$(" + " + refs[1], n - 1);
      if (o.level < LEVEL_OP + PREC['+']) {
        return x;
      } else {
        return "(" + x + ")";
      }
    }
  };
  prototype.compilePow = function(o){
    return Call.make(JS('Math.pow'), [this.first, this.second]).compile(o);
  };
  prototype.compileConcat = function(o){
    var f;
    f = function(x){
      switch (false) {
      case !(x instanceof Binary && x.op === '++'):
        return f(x.first).concat(f(x.second));
      default:
        return [x];
      }
    };
    return Chain(this.first).add(Index(Key('concat'), '.', true)).add(Call(f(this.second))).compile(o);
  };
  prototype.compileCompose = function(o){
    var op, functions, x;
    op = this.op;
    functions = [this.first];
    x = this.second;
    while (x instanceof Binary && x.op === op) {
      functions.push(x.first);
      x = x.second;
    }
    functions.push(x);
    if (op === '<<') {
      functions.reverse();
    }
    return Chain(Var(util('compose'))).add(Call(functions)).compile(o);
  };
  prototype.compileMod = function(o){
    var ref, code;
    ref = o.scope.temporary();
    code = "(((" + this.first.compile(o) + ") % (" + ref + " = " + this.second.compile(o) + ") + " + ref + ") % " + ref + ")";
    o.scope.free(ref);
    return code;
  };
  prototype.compilePartial = function(o){
    var vit, x, y;
    vit = Var('it');
    switch (false) {
    case !(this.first == null && this.second == null):
      x = Var('x$');
      y = Var('y$');
      return Fun([x, y], Block(Binary(this.op, x, y).invertCheck(this)), false, true).compile(o);
    case this.first == null:
      return "(" + Fun([vit], Block(Binary(this.op, this.first, vit).invertCheck(this))).compile(o) + ")";
    default:
      return "(" + Fun([vit], Block(Binary(this.op, vit, this.second).invertCheck(this))).compile(o) + ")";
    }
  };
  prototype.compileRegexEquals = function(o, arg$){
    var regex, target, method;
    regex = arg$[0], target = arg$[1];
    if (this.op === '===') {
      method = this.wasInverted ? 'test' : 'exec';
      return Chain(regex).add(Index(Key(method))).add(Call([target])).compile(o);
    } else {
      return Unary('!', Chain(regex).add(Index(Key('test'))).add(Call([target]))).compile(o);
    }
  };
  prototype.compileDeepEq = function(o){
    var ref$, negate, i$, len$, x, r;
    if ((ref$ = this.op) === '>==' || ref$ === '>>=') {
      ref$ = [this.second, this.first], this.first = ref$[0], this.second = ref$[1];
      this.op = this.op === '>==' ? '<==' : '<<=';
    }
    if (this.op === '!==') {
      this.op = '===';
      negate = true;
    }
    for (i$ = 0, len$ = (ref$ = [this.first, this.second]).length; i$ < len$; ++i$) {
      x = ref$[i$];
      if (x instanceof Obj || x instanceof Arr) {
        x.deepEq = true;
      }
    }
    r = Chain(Var(util('deepEq'))).add(Call([this.first, this.second, Literal("'" + this.op + "'")]));
    return (negate ? Unary('!', r) : r).compile(o);
  };
  prototype.compileXor = function(o){
    var left, right;
    left = Chain(this.first).cacheReference(o);
    right = Chain(this.second).cacheReference(o);
    return Binary('&&', Binary('!==', Unary('!', left[0]), Unary('!', right[0])), Parens(Binary('||', left[1], right[1]))).compile(o);
  };
  return Binary;
}(Node));
exports.Assign = Assign = (function(superclass){
  var prototype = extend$((import$(Assign, superclass).displayName = 'Assign', Assign), superclass).prototype, constructor = Assign;
  function Assign(left, rite, op, logic, defParam){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.left = left;
    this$.op = op || '=';
    this$.logic = logic || this$.op.logic;
    this$.defParam = defParam;
    this$.op += '';
    this$[rite instanceof Node ? 'right' : 'unaries'] = rite;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['left', 'right'];
  prototype.show = function(){
    return [void 8].concat(this.unaries).reverse().join(' ') + [this.logic] + this.op;
  };
  prototype.assigns = function(it){
    return this.left.assigns(it);
  };
  prototype.delegate(['isCallable', 'isRegex'], function(it){
    var ref$;
    return ((ref$ = this.op) === '=' || ref$ === ':=') && this.right[it]();
  });
  prototype.isArray = function(){
    switch (this.op) {
    case '=':
    case ':=':
      return this.right.isArray();
    case '/=':
      return this.right.isMatcher();
    }
  };
  prototype.isString = function(){
    switch (this.op) {
    case '=':
    case ':=':
    case '+=':
    case '*=':
      return this.right.isString();
    case '-=':
      return this.right.isMatcher();
    }
  };
  prototype.unfoldSoak = function(o){
    var that, ref$, ref1$, rite, temps;
    if (this.left instanceof Existence) {
      if (that = (ref1$ = (ref$ = this.left = this.left.it).name, delete ref$.name, ref1$)) {
        rite = this.right;
        rite = Assign(this.right = Var(that), rite);
      } else {
        ref$ = this.right.cache(o), rite = ref$[0], this.right = ref$[1], temps = ref$[2];
      }
      return ref$ = If(Existence(rite), this), ref$.temps = temps, ref$.cond = this.cond, ref$['void'] = this['void'], ref$;
    }
    return If.unfoldSoak(o, this, 'left');
  };
  prototype.unfoldAssign = function(){
    return this.access && this;
  };
  prototype.compileNode = function(o){
    var left, ref$, i$, len$, op, right, reft, sign, name, lvar, that, protoSplit, dotSplit, code, empty, res;
    if (this.left instanceof Slice && this.op === '=') {
      return this.compileSplice(o);
    }
    left = this.left.expandSlice(o, true).unwrap();
    if (!this.right) {
      left.isAssignable() || left.carp('invalid unary assign');
      ref$ = Chain(left).cacheReference(o), left = ref$[0], this.right = ref$[1];
      for (i$ = 0, len$ = (ref$ = this.unaries).length; i$ < len$; ++i$) {
        op = ref$[i$];
        this.right = Unary(op, this.right);
      }
    }
    if (left.isEmpty()) {
      return (ref$ = Parens(this.right), ref$.front = this.front, ref$.newed = this.newed, ref$).compile(o);
    }
    if (left.getDefault()) {
      this.right = Binary(left.op, this.right, left.second);
      left = left.first;
    }
    if (left.items) {
      return this.compileDestructuring(o, left);
    }
    left.isAssignable() || left.carp('invalid assign');
    if (this.logic) {
      return this.compileConditional(o, left);
    }
    op = this.op, right = this.right;
    if (op === '<?=' || op === '>?=') {
      return this.compileMinMax(o, left, right);
    }
    if ((op === '**=' || op === '^=' || op === '%%=' || op === '++=' || op === '|>=') || op === '*=' && right.isString() || (op === '-=' || op === '/=') && right.isMatcher()) {
      ref$ = Chain(left).cacheReference(o), left = ref$[0], reft = ref$[1];
      right = Binary(op.slice(0, -1), reft, right);
      op = ':=';
    }
    if (op === '.&.=' || op === '.|.=' || op === '.^.=' || op === '.<<.=' || op === '.>>.=' || op === '.>>>.=') {
      op = op.slice(1, -2) + '=';
    }
    (right = right.unparen()).ripName(left = left.unwrap());
    sign = op.replace(':', '');
    name = (left.front = true, left).compile(o, LEVEL_LIST);
    if (lvar = left instanceof Var) {
      if (op === '=') {
        o.scope.declare(name, left, this['const'] || !this.defParam && o['const'] && '$' !== name.slice(-1));
      } else if (that = o.scope.checkReadOnly(name)) {
        left.carp("assignment to " + that + " \"" + name + "\"", ReferenceError);
      }
    }
    if (left instanceof Chain && right instanceof Fun) {
      protoSplit = name.split('.prototype.');
      dotSplit = name.split('.');
      if (protoSplit.length > 1) {
        right.inClass = protoSplit[0];
      } else if (dotSplit.length > 1) {
        right.inClassStatic = slice$.call(dotSplit, 0, -1).join('');
      }
    }
    code = !o.level && right instanceof While && !right['else'] && (lvar || left instanceof Chain && left.isSimpleAccess())
      ? (empty = right.objComp ? '{}' : '[]', (res = o.scope.temporary('res')) + " = " + empty + ";\n" + this.tab + right.makeReturn(res).compile(o) + "\n" + this.tab + name + " " + sign + " " + o.scope.free(res))
      : (name + " " + sign + " ") + right.compile(o, LEVEL_LIST);
    if (o.level > LEVEL_LIST) {
      code = "(" + code + ")";
    }
    return code;
  };
  prototype.compileConditional = function(o, left){
    var lefts, morph;
    if (left instanceof Var && in$(this.logic, ['?']) && this.op === '=') {
      o.scope.declare(left.value, left);
    }
    lefts = Chain(left).cacheReference(o);
    o.level += LEVEL_OP < o.level;
    morph = Binary(this.logic, lefts[0], (this.logic = false, this.left = lefts[1], this));
    return (morph['void'] = this['void'], morph).compileNode(o);
  };
  prototype.compileMinMax = function(o, left, right){
    var lefts, rites, test, put, ref$;
    lefts = Chain(left).cacheReference(o);
    rites = right.cache(o, true);
    test = Binary(this.op.replace('?', ''), lefts[0], rites[0]);
    put = Assign(lefts[1], rites[1], ':=');
    if (this['void'] || !o.level) {
      return Parens(Binary('||', test, put)).compile(o);
    }
    ref$ = test.first.cache(o, true), test.first = ref$[0], left = ref$[1];
    return If(test, left).addElse(put).compileExpression(o);
  };
  prototype.compileDestructuring = function(o, left){
    var items, len, ret, rite, that, cache, rref, list, code;
    items = left.items, len = items.length;
    ret = o.level && !this['void'];
    rite = this.right.compile(o, len === 1 ? LEVEL_CALL : LEVEL_LIST);
    if (that = left.name) {
      cache = that + " = " + rite;
      o.scope.declare(rite = that, left);
    } else if ((ret || len > 1) && (!ID.test(rite) || left.assigns(rite))) {
      cache = (rref = o.scope.temporary()) + " = " + rite;
      rite = rref;
    }
    list = this["rend" + left.constructor.displayName](o, items, rite);
    if (rref) {
      o.scope.free(rref);
    }
    if (cache) {
      list.unshift(cache);
    }
    if (ret || !list.length) {
      list.push(rite);
    }
    code = list.join(', ');
    if (list.length < 2 || o.level < LEVEL_LIST) {
      return code;
    } else {
      return "(" + code + ")";
    }
  };
  prototype.compileSplice = function(o){
    var ref$, fromExpNode, fromExp, rightNode, right, toExp;
    ref$ = Chain(this.left.from).cacheReference(o), fromExpNode = ref$[0], fromExp = ref$[1];
    ref$ = Chain(this.right).cacheReference(o), rightNode = ref$[0], right = ref$[1];
    toExp = Binary('-', this.left.to, fromExp);
    return Block([Chain(Var(util('splice'))).add(Index(Key('apply'), '.', true)).add(Call([this.left.target, Chain(Arr([fromExpNode, toExp])).add(Index(Key('concat'), '.', true)).add(Call([rightNode]))])), right]).compile(o, LEVEL_LIST);
  };
  prototype.rendArr = function(o, nodes, rite){
    var i$, len$, i, node, skip, len, val, ivar, start, inc, rcache, ref$, results$ = [];
    for (i$ = 0, len$ = nodes.length; i$ < len$; ++i$) {
      i = i$;
      node = nodes[i$];
      if (node.isEmpty()) {
        continue;
      }
      if (node instanceof Splat) {
        len && node.carp('multiple splat in an assignment');
        skip = (node = node.it).isEmpty();
        if (i + 1 === (len = nodes.length)) {
          if (skip) {
            break;
          }
          val = Arr.wrap(JS(util('slice') + '.call(' + rite + (i ? ", " + i + ")" : ')')));
        } else {
          val = ivar = rite + ".length - " + (len - i - 1);
          if (skip && i + 2 === len) {
            continue;
          }
          start = i + 1;
          this.temps = [ivar = o.scope.temporary('i')];
          val = skip
            ? (node = Var(ivar), Var(val))
            : Arr.wrap(JS(i + " < (" + ivar + " = " + val + ")\ ? " + util('slice') + ".call(" + rite + ", " + i + ", " + ivar + ")\ : (" + ivar + " = " + i + ", [])"));
        }
      } else {
        (inc = ivar) && start < i && (inc += " + " + (i - start));
        val = Chain(rcache || (rcache = Literal(rite)), [Index(JS(inc || i))]);
      }
      if (node instanceof Assign) {
        node = Binary(node.op, node.left, node.right, node.logic || true);
      }
      results$.push((ref$ = clone$(this), ref$.left = node, ref$.right = val, ref$['void'] = true, ref$).compile(o, LEVEL_PAREN));
    }
    return results$;
  };
  prototype.rendObj = function(o, nodes, rite){
    var i$, len$, node, splat, logic, ref$, key, val, rcache, results$ = [];
    for (i$ = 0, len$ = nodes.length; i$ < len$; ++i$) {
      node = nodes[i$];
      if (splat = node instanceof Splat) {
        node = node.it;
      }
      if (logic = node.getDefault()) {
        node = node.first;
      }
      if (node instanceof Parens) {
        ref$ = Chain(node.it).cacheReference(o), node = ref$[0], key = ref$[1];
      } else if (node instanceof Prop) {
        node = (key = node.key, node).val;
      } else {
        key = node;
      }
      if (node instanceof Key) {
        node = Var(node.name);
      }
      if (logic) {
        node = (logic.first = node, logic);
      }
      val = Chain(rcache || (rcache = Var(rite)), [Index(key.maybeKey())]);
      if (splat) {
        val = Import(Obj(), val);
      }
      results$.push((ref$ = clone$(this), ref$.left = node, ref$.right = val, ref$['void'] = true, ref$).compile(o, LEVEL_PAREN));
    }
    return results$;
  };
  return Assign;
}(Node));
exports.Import = Import = (function(superclass){
  var prototype = extend$((import$(Import, superclass).displayName = 'Import', Import), superclass).prototype, constructor = Import;
  function Import(left, right, all){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.left = left;
    this$.right = right;
    this$.all = all && 'All';
    if (!all && left instanceof Obj && right.items) {
      return Obj(left.items.concat(right.asObj().items));
    }
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['left', 'right'];
  prototype.show = function(){
    return this.all;
  };
  prototype.delegate(['isCallable', 'isArray'], function(it){
    return this.left[it]();
  });
  prototype.unfoldSoak = function(o){
    var left, value, ref$, temps;
    left = this.left;
    if (left instanceof Existence && !left.negated) {
      if ((left = left.it) instanceof Var) {
        value = (this.left = left).value;
        if (!o.scope.check(value, true)) {
          left = JS("typeof " + value + " != 'undefined' && " + value);
        }
      } else {
        ref$ = left.cache(o), left = ref$[0], this.left = ref$[1], temps = ref$[2];
      }
      return ref$ = If(left, this), ref$.temps = temps, ref$.soak = true, ref$.cond = this.cond, ref$['void'] = this['void'], ref$;
    }
    return If.unfoldSoak(o, this, 'left') || (this['void'] || !o.level) && If.unfoldSoak(o, this, 'right');
  };
  prototype.compileNode = function(o){
    var right;
    right = this.right;
    if (!this.all) {
      if (right instanceof Chain) {
        right = right.unfoldSoak(o) || right.unfoldAssign(o) || right.expandSlice(o).unwrap();
      }
      if (right instanceof List) {
        return this.compileAssign(o, right.asObj().items);
      }
    }
    return Call.make(Util("import" + (this.all || '')), [this.left, right]).compileNode(o);
  };
  prototype.compileAssign = function(o, items){
    var top, reft, ref$, left, delim, space, code, i$, len$, i, node, com, logic, dyna, key, val;
    if (!items.length) {
      return this.left.compile(o);
    }
    top = !o.level;
    if (items.length < 2 && (top || this['void'] || items[0] instanceof Splat)) {
      reft = this.left;
      if (reft.isComplex()) {
        reft = Parens(reft);
      }
    } else {
      ref$ = this.left.cache(o), left = ref$[0], reft = ref$[1], this.temps = ref$[2];
    }
    ref$ = top
      ? [';', '\n' + this.tab]
      : [',', ' '], delim = ref$[0], space = ref$[1];
    delim += space;
    code = this.temps ? left.compile(o, LEVEL_PAREN) + delim : '';
    for (i$ = 0, len$ = items.length; i$ < len$; ++i$) {
      i = i$;
      node = items[i$];
      i && (code += com ? space : delim);
      if (com = node.comment) {
        code += node.compile(o);
        continue;
      }
      if (node instanceof Splat) {
        code += Import(reft, node.it).compile(o);
        continue;
      }
      if (logic = node.getDefault()) {
        node = node.first;
      }
      if (dyna = node instanceof Parens) {
        ref$ = node.it.cache(o, true), key = ref$[0], val = ref$[1];
      } else if (node instanceof Prop) {
        key = node.key, val = node.val;
        if (node.accessor) {
          if (key instanceof Key) {
            key = JS("'" + key.name + "'");
          }
          code += "Object.defineProperty(" + reft.compile(o, LEVEL_LIST) + ", " + key.compile(o, LEVEL_LIST) + ", " + node.compileDescriptor(o) + ")";
          continue;
        }
      } else {
        key = val = node;
      }
      dyna || (key = key.maybeKey());
      logic && (val = (logic.first = val, logic));
      code += Assign(Chain(reft, [Index(key)]), val).compile(o, LEVEL_PAREN);
    }
    if (top) {
      return code;
    }
    this['void'] || node instanceof Splat || (code += (com ? ' ' : ', ') + reft.compile(o, LEVEL_PAREN));
    if (o.level < LEVEL_LIST) {
      return code;
    } else {
      return "(" + code + ")";
    }
  };
  return Import;
}(Node));
exports.In = In = (function(superclass){
  var prototype = extend$((import$(In, superclass).displayName = 'In', In), superclass).prototype, constructor = In;
  importAll$(prototype, arguments[1]);
  function In(item, array){
    this.item = item;
    this.array = array;
  }
  prototype.children = ['item', 'array'];
  prototype.compileNode = function(o){
    var array, items, code, ref$, sub, ref, cmp, cnj, i$, len$, i, test;
    items = (array = this.array.expandSlice(o).unwrap()).items;
    if (!(array instanceof Arr) || items.length < 2) {
      return (this.negated ? '!' : '') + "" + util('in') + "(" + this.item.compile(o, LEVEL_LIST) + ", " + array.compile(o, LEVEL_LIST) + ")";
    }
    code = '';
    ref$ = this.item.cache(o, false, LEVEL_PAREN), sub = ref$[0], ref = ref$[1];
    ref$ = this.negated
      ? [' !== ', ' && ']
      : [' === ', ' || '], cmp = ref$[0], cnj = ref$[1];
    for (i$ = 0, len$ = items.length; i$ < len$; ++i$) {
      i = i$;
      test = items[i$];
      code && (code += cnj);
      if (test instanceof Splat) {
        code += (ref$ = new In(Var(ref), test.it), ref$.negated = this.negated, ref$).compile(o, LEVEL_TOP);
        if (!(i || sub === ref)) {
          code = "(" + sub + ", " + code + ")";
        }
      } else {
        code += (i || sub === ref
          ? ref
          : "(" + sub + ")") + cmp + test.compile(o, LEVEL_OP + PREC['==']);
      }
    }
    sub === ref || o.scope.free(ref);
    if (o.level < LEVEL_OP + PREC['||']) {
      return code;
    } else {
      return "(" + code + ")";
    }
  };
  return In;
}(Node, Negatable));
exports.Existence = Existence = (function(superclass){
  var prototype = extend$((import$(Existence, superclass).displayName = 'Existence', Existence), superclass).prototype, constructor = Existence;
  importAll$(prototype, arguments[1]);
  function Existence(it, negated){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.it = it;
    this$.negated = negated;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['it'];
  prototype.compileNode = function(o){
    var node, ref$, code, op, eq;
    node = (ref$ = this.it.unwrap(), ref$.front = this.front, ref$);
    code = node.compile(o, LEVEL_OP + PREC['==']);
    if (node instanceof Var && !o.scope.check(code, true)) {
      ref$ = this.negated
        ? ['||', '=']
        : ['&&', '!'], op = ref$[0], eq = ref$[1];
      code = "typeof " + code + " " + eq + "= 'undefined' " + op + " " + code + " " + eq + "== null";
    } else {
      code += " " + (op = this.negated ? '==' : '!=') + " null";
    }
    if (o.level < LEVEL_OP + PREC[op]) {
      return code;
    } else {
      return "(" + code + ")";
    }
  };
  return Existence;
}(Node, Negatable));
exports.Fun = Fun = (function(superclass){
  var prototype = extend$((import$(Fun, superclass).displayName = 'Fun', Fun), superclass).prototype, constructor = Fun;
  function Fun(params, body, bound, curried, hushed, generator){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.params = params || [];
    this$.body = body || Block();
    this$.bound = bound && 'this$';
    this$.curried = curried || false;
    this$.hushed = hushed != null ? hushed : false;
    this$.generator = generator != null ? generator : false;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['params', 'body'];
  prototype.show = function(){
    var that;
    return [this.name] + [(that = this.bound) ? "~" + that : void 8];
  };
  prototype.named = function(it){
    return this.name = it, this.statement = true, this;
  };
  prototype.isCallable = YES;
  prototype.isStatement = function(){
    return !!this.statement;
  };
  prototype.traverseChildren = function(arg$, xscope){
    if (xscope) {
      return superclass.prototype.traverseChildren.apply(this, arguments);
    }
  };
  prototype.makeReturn = function(){
    if (this.statement) {
      return this.returns = true, this;
    } else {
      return superclass.prototype.makeReturn.apply(this, arguments);
    }
  };
  prototype.ripName = function(it){
    this.name || (this.name = it.varName());
  };
  prototype.compileNode = function(o){
    var pscope, sscope, scope, that, inLoop, ref$, body, name, tab, code, curryCodeCheck, this$ = this;
    pscope = o.scope;
    sscope = pscope.shared || pscope;
    scope = o.scope = this.body.scope = new Scope(this.wrapper ? pscope : sscope, this.wrapper && sscope);
    scope.fun = this;
    if (that = this.proto) {
      scope.assign('prototype', that.compile(o) + ".prototype");
    }
    if (that = this.cname) {
      scope.assign('constructor', that);
    }
    if (inLoop = (ref$ = o.loop, delete o.loop, ref$)) {
      o.indent = this.tab = '';
    }
    o.indent += TAB;
    body = this.body, name = this.name, tab = this.tab;
    code = 'function';
    if (this.generator) {
      this.ctor && this.carp("a constructor can't be a generator");
      this.hushed && this.carp("a generator is hushed by default");
      code += '*';
    }
    if (this.bound === 'this$') {
      if (this.ctor) {
        scope.assign('this$', 'this instanceof ctor$ ? this : new ctor$');
        body.lines.push(Return(Literal('this$')));
      } else if (that = (ref$ = sscope.fun) != null ? ref$.bound : void 8) {
        this.bound = that;
      } else {
        sscope.assign('this$', 'this');
      }
    }
    if (this.statement) {
      name || this.carp('nameless function declaration');
      pscope === o.block.scope || this.carp('misplaced function declaration');
      this.accessor && this.carp('named accessor');
      pscope.add(name, 'function', this);
    }
    if (this.statement || name && this.labeled) {
      code += ' ' + scope.add(name, 'function', this);
    }
    this.hushed || this.ctor || this.newed || this.generator || body.makeReturn();
    code += "(" + this.compileParams(o, scope) + "){";
    if (that = body.compileWithDeclarations(o)) {
      code += "\n" + that + "\n" + tab;
    }
    code += '}';
    curryCodeCheck = function(){
      if (this$.curried && this$.hasSplats) {
        this$.carp('cannot curry a function with a variable number of arguments');
      }
      if (this$.curried && this$.params.length > 1 && !this$.classBound) {
        return (util('curry') + "") + (this$.bound
          ? "((" + code + "), true)"
          : "(" + code + ")");
      } else {
        return code;
      }
    };
    if (inLoop) {
      return pscope.assign(pscope.temporary('fn'), curryCodeCheck());
    }
    if (this.returns) {
      code += "\n" + tab + "return " + name + ";";
    } else if (this.bound && this.ctor) {
      code += ' function ctor$(){} ctor$.prototype = prototype;';
    }
    code = curryCodeCheck();
    if (this.front && !this.statement) {
      return "(" + code + ")";
    } else {
      return code;
    }
  };
  prototype.compileParams = function(o, scope){
    var params, length, body, i$, p, len$, i, splace, rest, that, names, assigns, dic, vr, df, unaries, hasUnary, v, ref$, ref1$;
    params = this.params, length = params.length, body = this.body;
    for (i$ = params.length - 1; i$ >= 0; --i$) {
      p = params[i$];
      if (!(p.isEmpty() || p.filler)) {
        break;
      }
      --params.length;
    }
    for (i$ = 0, len$ = params.length; i$ < len$; ++i$) {
      i = i$;
      p = params[i$];
      if (p instanceof Splat) {
        this.hasSplats = true;
        splace = i;
      } else if (p.op === '=') {
        params[i] = Binary(p.logic || '?', p.left, p.right);
      }
    }
    if (splace != null) {
      rest = params.splice(splace, 9e9);
    } else if (this.accessor) {
      if (that = params[1]) {
        that.carp('excess accessor parameter');
      }
    } else if (!(length || this.wrapper)) {
      if (body.traverseChildren(function(it){
        return it.value === 'it' || null;
      })) {
        params[0] = Var('it');
      }
    }
    names = [];
    assigns = [];
    if (params.length) {
      dic = {};
      for (i$ = 0, len$ = params.length; i$ < len$; ++i$) {
        p = params[i$];
        vr = p;
        if (df = vr.getDefault()) {
          vr = vr.first;
        }
        if (vr.isEmpty()) {
          vr = Var(scope.temporary('arg'));
        } else if (vr.value === '..') {
          vr = Var(o.ref = scope.temporary());
        } else if (!(vr instanceof Var)) {
          unaries = [];
          while (vr instanceof Unary) {
            hasUnary = true;
            unaries.push(vr);
            vr = vr.it;
          }
          v = Var((ref1$ = (ref$ = vr.it || vr).name, delete ref$.name, ref1$) || vr.varName() || scope.temporary('arg'));
          assigns.push(Assign(vr, (fn$())));
          vr = v;
        } else if (df) {
          assigns.push(Assign(vr, p.second, '=', p.op, true));
        }
        names.push(scope.add(vr.value, 'arg', p));
      }
    }
    if (rest) {
      while (splace--) {
        rest.unshift(Arr());
      }
      assigns.push(Assign(Arr(rest), Literal('arguments')));
    }
    if (assigns.length) {
      (ref$ = this.body).prepend.apply(ref$, assigns);
    }
    return names.join(', ');
    function fn$(){
      switch (false) {
      case !df:
        return Binary(p.op, v, p.second);
      case !hasUnary:
        return fold(function(x, y){
          y.it = x;
          return y;
        }, v, unaries.reverse());
      default:
        return v;
      }
    }
  };
  return Fun;
}(Node));
exports.Class = Class = (function(superclass){
  var prototype = extend$((import$(Class, superclass).displayName = 'Class', Class), superclass).prototype, constructor = Class;
  function Class(arg$){
    var body;
    this.title = arg$.title, this.sup = arg$.sup, this.mixins = arg$.mixins, body = arg$.body;
    this.fun = Fun([], body);
  }
  prototype.children = ['title', 'sup', 'mixins', 'fun'];
  prototype.isCallable = YES;
  prototype.ripName = function(it){
    this.name = it.varName();
  };
  prototype.compile = function(o, level){
    var fun, body, lines, title, boundFuncs, curriedBoundFuncs, decl, name, proto, ctorName, ctor, ctorPlace, importProtoObj, i$, len$, i, node, f, vname, args, that, imports, ref$, res$, clas;
    fun = this.fun, body = fun.body, lines = body.lines, title = this.title;
    boundFuncs = [];
    curriedBoundFuncs = [];
    decl = title != null ? title.varName() : void 8;
    name = decl || this.name;
    if (ID.test(name || '')) {
      fun.cname = name;
    } else {
      name = 'constructor';
    }
    proto = Var('prototype');
    ctorName = 'constructor$$';
    importProtoObj = function(node, i){
      var j, prop, key, i$, ref$, len$, v;
      j = 0;
      for (; j < node.items.length; j++) {
        prop = node.items[j];
        key = prop.key;
        if ((key instanceof Key && key.name === ctorName) || (key instanceof Literal && key.value === "'" + ctorName + "'")) {
          if (ctor) {
            node.carp('redundant constructor');
          }
          ctor = prop.val;
          node.items.splice(j--, 1);
          ctorPlace = i;
        }
        if (!(prop.val instanceof Fun || prop.accessor)) {
          continue;
        }
        if (key.isComplex()) {
          key = Var(o.scope.temporary('key'));
          prop.key = Assign(key, prop.key);
        }
        if (prop.val.bound) {
          if (prop.val.curried) {
            curriedBoundFuncs.push(prop.key);
          } else {
            boundFuncs.push(prop.key);
          }
          prop.val.bound = false;
          prop.val.classBound = true;
        }
        for (i$ = 0, len$ = (ref$ = [].concat(prop.val)).length; i$ < len$; ++i$) {
          v = ref$[i$];
          v.meth = key;
        }
      }
      if (node.items.length) {
        return Import(proto, node);
      } else {
        return Literal('void');
      }
    };
    for (i$ = 0, len$ = lines.length; i$ < len$; ++i$) {
      i = i$;
      node = lines[i$];
      if (node instanceof Obj) {
        lines[i] = importProtoObj(node, i);
      } else if (node instanceof Fun && !node.statement) {
        ctor && node.carp('redundant constructor');
        ctor = node;
      } else if (node instanceof Assign && node.left instanceof Chain && node.left.head.value === 'this' && node.right instanceof Fun) {
        node.right.stat = node.left.tails[0].key;
      } else {
        node.traverseChildren(fn$);
      }
    }
    ctor || (ctor = lines[lines.length] = this.sup
      ? Fun([], Block(Chain(new Super).add(Call([Splat(Literal('arguments'))]))))
      : Fun());
    if (!(ctor instanceof Fun)) {
      lines.splice(ctorPlace + 1, 0, Assign(Var(ctorName), ctor));
      lines.unshift(ctor = Fun([], Block(Return(Chain(Var(ctorName)).add(Call([Splat('arguments', true)]))))));
    }
    ctor.name = name;
    ctor.ctor = true;
    ctor.statement = true;
    for (i$ = 0, len$ = boundFuncs.length; i$ < len$; ++i$) {
      f = boundFuncs[i$];
      ctor.body.lines.unshift(Assign(Chain(Literal('this')).add(Index(f)), Chain(Var(util('bind'))).add(Call([Literal('this'), Literal("'" + f.name + "'"), Var('prototype')]))));
    }
    for (i$ = 0, len$ = curriedBoundFuncs.length; i$ < len$; ++i$) {
      f = curriedBoundFuncs[i$];
      ctor.body.lines.unshift(Assign(Chain(Literal('this')).add(Index(Key("_" + f.name))), Chain(Var(util('curry'))).add(Call([Chain(Var('prototype')).add(Index(f)), Var('true')]))), Assign(Chain(Literal('this')).add(Index(f)), Chain(Var(util('bind'))).add(Call([Literal('this'), Literal("'_" + f.name + "'")]))));
    }
    lines.push(vname = fun.proto = Var(fun.bound = name));
    args = [];
    if (that = this.sup) {
      args.push(that);
      imports = Chain(Import(Literal('this'), Var('superclass')));
      fun.proto = Util.Extends(fun.cname ? Block([Assign(imports.add(Index(Key('displayName'))), Literal("'" + name + "'")), Literal(name)]) : imports, (ref$ = fun.params)[ref$.length] = Var('superclass'));
    }
    if (that = this.mixins) {
      res$ = [];
      for (i$ = 0, len$ = that.length; i$ < len$; ++i$) {
        args[args.length] = that[i$];
        res$.push(Import(proto, JS("arguments[" + (args.length - 1) + "]"), true));
      }
      imports = res$;
      body.prepend.apply(body, imports);
    }
    if (fun.cname && !this.sup) {
      body.prepend(Literal(name + ".displayName = '" + name + "'"));
    }
    clas = Parens(Call.make(fun, args), true);
    if (decl && title.isComplex()) {
      clas = Assign(vname, clas);
    }
    if (title) {
      clas = Assign(title, clas);
    }
    return clas.compile(o, level);
    function fn$(it){
      var i$, ref$, len$, k, child;
      if (it instanceof Block) {
        for (i$ = 0, len$ = (ref$ = it.lines).length; i$ < len$; ++i$) {
          k = i$;
          child = ref$[i$];
          if (child instanceof Obj) {
            it.lines[k] = importProtoObj(child, i);
          }
        }
      }
    }
  };
  return Class;
}(Node));
exports.Super = Super = (function(superclass){
  var prototype = extend$((import$(Super, superclass).displayName = 'Super', Super), superclass).prototype, constructor = Super;
  function Super(){}
  prototype.isCallable = YES;
  prototype.compile = function(o){
    var scope, that, result, ref$;
    scope = o.scope;
    if (!this.sproto) {
      for (; that = !scope.get('superclass') && scope.fun; scope = scope.parent) {
        result = that;
        if (that = result.meth) {
          return 'superclass.prototype' + Index(that).compile(o);
        }
        if (that = result.stat) {
          return 'superclass' + Index(that).compile(o);
        }
        if (that = scope.fun.inClass) {
          return that + ".superclass.prototype." + scope.fun.name;
        } else if (that = scope.fun.inClassStatic) {
          return that + ".superclass." + scope.fun.name;
        }
      }
      if (that = (ref$ = o.scope.fun) != null ? ref$.name : void 8) {
        return that + ".superclass";
      }
    }
    return 'superclass';
  };
  return Super;
}(Node));
exports.Parens = Parens = (function(superclass){
  var prototype = extend$((import$(Parens, superclass).displayName = 'Parens', Parens), superclass).prototype, constructor = Parens;
  function Parens(it, keep, string){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.it = it;
    this$.keep = keep;
    this$.string = string;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['it'];
  prototype.show = function(){
    return this.string && '""';
  };
  prototype.delegate(['isComplex', 'isCallable', 'isArray', 'isRegex'], function(it){
    return this.it[it]();
  });
  prototype.isString = function(){
    return this.string || this.it.isString();
  };
  prototype.unparen = function(){
    if (this.keep) {
      return this;
    } else {
      return this.it.unparen();
    }
  };
  prototype.compile = function(o, level){
    var it;
    level == null && (level = o.level);
    it = this.it;
    it.cond || (it.cond = this.cond), it['void'] || (it['void'] = this['void']);
    if (this.calling && (!level || this['void'])) {
      it.head.hushed = true;
    }
    if (!(this.keep || this.newed || level >= LEVEL_OP + PREC[it.op])) {
      return (it.front = this.front, it).compile(o, level || LEVEL_PAREN);
    }
    if (it.isStatement()) {
      return it.compileClosure(o);
    } else {
      return "(" + it.compile(o, LEVEL_PAREN) + ")";
    }
  };
  return Parens;
}(Node));
exports.Splat = Splat = (function(superclass){
  var ref$, prototype = extend$((import$(Splat, superclass).displayName = 'Splat', Splat), superclass).prototype, constructor = Splat;
  function Splat(it, filler){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.it = it;
    this$.filler = filler;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  ref$ = Parens.prototype, prototype.children = ref$.children, prototype.isComplex = ref$.isComplex;
  prototype.isAssignable = YES;
  prototype.assigns = function(it){
    return this.it.assigns(it);
  };
  prototype.compile = function(){
    return this.carp('invalid splat');
  };
  Splat.compileArray = function(o, list, apply){
    var index, i$, len$, node, args, atoms, ref$;
    expand(list);
    index = 0;
    for (i$ = 0, len$ = list.length; i$ < len$; ++i$) {
      node = list[i$];
      if (node instanceof Splat) {
        break;
      }
      ++index;
    }
    if (index >= list.length) {
      return '';
    }
    if (!list[1]) {
      return (apply ? Object : ensureArray)(list[0].it).compile(o, LEVEL_LIST);
    }
    args = [];
    atoms = [];
    for (i$ = 0, len$ = (ref$ = list.splice(index, 9e9)).length; i$ < len$; ++i$) {
      node = ref$[i$];
      if (node instanceof Splat) {
        if (atoms.length) {
          args.push(Arr(atoms.splice(0, 9e9)));
        }
        args.push(ensureArray(node.it));
      } else {
        atoms.push(node);
      }
    }
    if (atoms.length) {
      args.push(Arr(atoms));
    }
    return (index
      ? Arr(list)
      : args.shift()).compile(o, LEVEL_CALL) + (".concat(" + List.compile(o, args) + ")");
  };
  function expand(nodes){
    var index, node, it;
    index = -1;
    while (node = nodes[++index]) {
      if (node instanceof Splat) {
        it = node.it;
        if (it.isEmpty()) {
          nodes.splice(index--, 1);
        } else if (it instanceof Arr) {
          nodes.splice.apply(nodes, [index, 1].concat(slice$.call(expand(it.items))));
          index += it.items.length - 1;
        }
      }
    }
    return nodes;
  }
  function ensureArray(node){
    if (node.isArray()) {
      return node;
    }
    return Call.make(JS(util('slice') + '.call'), [node]);
  }
  return Splat;
}(Node));
exports.Jump = Jump = (function(superclass){
  var prototype = extend$((import$(Jump, superclass).displayName = 'Jump', Jump), superclass).prototype, constructor = Jump;
  function Jump(verb, label){
    this.verb = verb;
    this.label = label;
  }
  prototype.show = function(){
    var that;
    return (this.verb || '') + ((that = this.label) ? ' ' + that : '');
  };
  prototype.isStatement = YES;
  prototype.makeReturn = THIS;
  prototype.getJump = function(ctx){
    var that, ref$;
    ctx || (ctx = {});
    if (!ctx[this.verb]) {
      return this;
    }
    if (that = this.label) {
      return !in$(that, (ref$ = ctx.labels) != null
        ? ref$
        : ctx.labels = []) && this;
    }
  };
  prototype.compileNode = function(o){
    var that, ref$;
    if (that = this.label) {
      in$(that, (ref$ = o.labels) != null
        ? ref$
        : o.labels = []) || this.carp("unknown label \"" + that + "\"");
    } else {
      o[this.verb] || this.carp("stray " + this.verb);
    }
    return this.show() + ';';
  };
  Jump.extended = function(sub){
    sub.prototype.children = ['it'];
    this[sub.displayName.toLowerCase()] = sub;
  };
  return Jump;
}(Node));
exports.Throw = Throw = (function(superclass){
  var prototype = extend$((import$(Throw, superclass).displayName = 'Throw', Throw), superclass).prototype, constructor = Throw;
  function Throw(it){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.it = it;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.getJump = VOID;
  prototype.compileNode = function(o){
    var ref$;
    return "throw " + (((ref$ = this.it) != null ? ref$.compile(o, LEVEL_PAREN) : void 8) || 'null') + ";";
  };
  return Throw;
}(Jump));
exports.Return = Return = (function(superclass){
  var prototype = extend$((import$(Return, superclass).displayName = 'Return', Return), superclass).prototype, constructor = Return;
  function Return(it){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    if (it && it.value !== 'void') {
      this$.it = it;
    }
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.getJump = THIS;
  prototype.compileNode = function(o){
    var that;
    return "return" + ((that = this.it) ? ' ' + that.compile(o, LEVEL_PAREN) : '') + ";";
  };
  return Return;
}(Jump));
exports.While = While = (function(superclass){
  var prototype = extend$((import$(While, superclass).displayName = 'While', While), superclass).prototype, constructor = While;
  function While(test, un, mode){
    this.un = un;
    mode && (mode instanceof Node
      ? this.update = mode
      : this.post = true);
    if (this.post || test.value !== '' + !un) {
      this.test = test;
    }
  }
  prototype.children = ['test', 'body', 'update', 'else'];
  prototype.aSource = 'test';
  prototype.aTargets = ['body', 'update'];
  prototype.show = function(){
    return [this.un ? '!' : void 8, this.post ? 'do' : void 8].join('');
  };
  prototype.isStatement = prototype.isArray = YES;
  prototype.makeComprehension = function(toAdd, loops){
    this.isComprehension = true;
    while (loops.length) {
      toAdd = loops.pop().addBody(Block(toAdd));
      if (!toAdd.isComprehension) {
        toAdd.inComprehension = true;
      }
    }
    return this.addBody(Block(toAdd));
  };
  prototype.getJump = function(ctx){
    var i$, ref$, ref1$, len$, node;
    ctx || (ctx = {});
    ctx['continue'] = true;
    ctx['break'] = true;
    for (i$ = 0, len$ = (ref$ = ((ref1$ = this.body) != null ? ref1$.lines : void 8) || []).length; i$ < len$; ++i$) {
      node = ref$[i$];
      if (node.getJump(ctx)) {
        return node;
      }
    }
  };
  prototype.addBody = function(body){
    var top;
    this.body = body;
    if (this.guard) {
      this.body = Block(If(this.guard, this.body));
    }
    top = this.body.lines[0];
    if ((top != null ? top.verb : void 8) === 'continue' && !top.label) {
      this.body.lines.length = 0;
    }
    return this;
  };
  prototype.addGuard = function(guard){
    this.guard = guard;
    return this;
  };
  prototype.addObjComp = function(objComp){
    this.objComp = objComp != null ? objComp : true;
    return this;
  };
  prototype.makeReturn = function(it){
    var last, ref$, ref1$, ref2$;
    if (this.hasReturned) {
      return this;
    }
    if (it) {
      if (this.objComp) {
        this.body = Block(this.body.makeReturn(it, true));
        if (this.guard) {
          this.body = If(this.guard, this.body);
        }
      } else {
        if (!(this.body || this.index)) {
          this.addBody(Block(Var(this.index = 'ridx$')));
        }
        last = (ref$ = this.body.lines) != null ? ref$[ref$.length - 1] : void 8;
        if ((this.isComprehension || this.inComprehension) && !(last != null && last.isComprehension)) {
          (ref1$ = this.body).makeReturn.apply(ref1$, arguments);
          if ((ref1$ = this['else']) != null) {
            ref1$.makeReturn.apply(ref1$, arguments);
          }
          this.hasReturned = true;
        } else {
          this.resVar = it;
          if ((ref2$ = this['else']) != null) {
            ref2$.makeReturn.apply(ref2$, arguments);
          }
        }
      }
    } else {
      this.getJump() || (this.returns = true);
    }
    return this;
  };
  prototype.compileNode = function(o){
    var test, ref$, head, that;
    o.loop = true;
    this.test && (this.un
      ? this.test = this.test.invert()
      : this.anaphorize());
    if (this.post) {
      return 'do {' + this.compileBody((o.indent += TAB, o));
    }
    test = ((ref$ = this.test) != null ? ref$.compile(o, LEVEL_PAREN) : void 8) || '';
    if (!(this.update || this['else'])) {
      head = test ? "while (" + test : 'for (;;';
    } else {
      head = 'for (';
      if (this['else']) {
        head += (this.yet = o.scope.temporary('yet')) + " = true";
      }
      head += ";" + (test && ' ' + test) + ";";
      if (that = this.update) {
        head += ' ' + that.compile(o, LEVEL_PAREN);
      }
    }
    return head + ') {' + this.compileBody((o.indent += TAB, o));
  };
  prototype.compileBody = function(o){
    var lines, yet, tab, code, ret, mid, empty, resultName, last, hasLoop, res, temp, key$, ref$, that;
    o['break'] = o['continue'] = true;
    lines = this.body.lines, yet = this.yet, tab = this.tab;
    code = ret = mid = '';
    empty = this.objComp ? '{}' : '[]';
    resultName = this.objComp ? 'resultObj$' : 'results$';
    last = lines != null ? lines[lines.length - 1] : void 8;
    if (!((this.isComprehension || this.inComprehension) && !(last != null && last.isComprehension))) {
      if (last != null) {
        last.traverseChildren(function(it){
          var ref$;
          if (it instanceof Block && (ref$ = it.lines)[ref$.length - 1] instanceof While) {
            hasLoop = true;
          }
        });
      }
      if (this.returns && !this.resVar) {
        this.resVar = res = o.scope.assign(resultName, empty);
      }
      if (this.resVar && (last instanceof While || hasLoop)) {
        temp = o.scope.temporary('lresult');
        lines.unshift(Assign(Var(temp), lines[lines.length - 1].objComp
          ? Obj()
          : Arr(), '='));
        if (lines[key$ = lines.length - 1] != null) {
          lines[key$] = lines[key$].makeReturn(temp);
        }
        mid += TAB + "" + Chain(Var(this.resVar)).add(Index(Key('push'), '.', true)).add(Call([Chain(Var(temp))])).compile(o) + ";\n" + this.tab;
      } else {
        this.hasReturned = true;
        if (this.resVar) {
          this.body.makeReturn(this.resVar);
        }
      }
    }
    if (this.returns) {
      if (this.objComp) {
        this.body = Block(this.body.makeReturn(resultName, true));
      }
      if (this.guard && this.objComp) {
        this.body = If(this.guard, this.body);
      }
      if ((!last instanceof While && !this.hasReturned) || this.isComprehension || this.inComprehension) {
        if (lines[key$ = lines.length - 1] != null) {
          lines[key$] = lines[key$].makeReturn(res = o.scope.assign(resultName, empty));
        }
      }
      ret += "\n" + this.tab + "return " + (res || empty) + ";";
      if ((ref$ = this['else']) != null) {
        ref$.makeReturn();
      }
    }
    yet && lines.unshift(JS(yet + " = false;"));
    if (that = this.body.compile(o, LEVEL_TOP)) {
      code += "\n" + that + "\n" + tab;
    }
    code += mid;
    code += '}';
    if (this.post) {
      code += " while (" + this.test.compile((o.tab = tab, o), LEVEL_PAREN) + ");";
    }
    if (yet) {
      code += " if (" + yet + ") " + this.compileBlock(o, Block(this['else']));
      o.scope.free(yet);
    }
    return code + ret;
  };
  return While;
}(Node));
exports.For = For = (function(superclass){
  var prototype = extend$((import$(For, superclass).displayName = 'For', For), superclass).prototype, constructor = For;
  function For(it){
    var i$, x$, ref$, len$;
    importAll$(this, it);
    if (this.item instanceof Var && !this.item.value) {
      this.item = null;
    }
    for (i$ = 0, len$ = (ref$ = this.kind || []).length; i$ < len$; ++i$) {
      x$ = ref$[i$];
      this[x$] = true;
    }
    if (this.own && !this.object) {
      this.carp('`for own` requires `of`');
    }
  }
  prototype.children = ['item', 'source', 'from', 'to', 'step', 'body'];
  prototype.aSource = null;
  prototype.show = function(){
    return (this.kind.concat(this.index)).join(' ');
  };
  prototype.addBody = function(body){
    var ref$, x$, that, this$ = this;
    if (this['let']) {
      if (ref$ = this.ref, delete this.ref, ref$) {
        this.item = Literal('..');
      }
      body = Block(Call['let']((x$ = [], (that = this.index) && x$.push(Assign(Var(that), Literal('index$$'))), (that = this.item) && x$.push(Assign(that, Literal('item$$'))), x$), body));
    }
    superclass.prototype.addBody.call(this, body);
    if (this.guard && this['let'] && (this.index || this.item)) {
      this.body.lines[0]['if'].traverseChildren(function(it){
        if (it instanceof Var) {
          if (this$.index && it.value === this$.index) {
            it.value = 'index$$';
          }
          if (this$.item && it.value === this$.item.value) {
            it.value = 'item$$';
          }
        }
      });
    }
    if (this['let']) {
      delete this.index;
      delete this.item;
    }
    return this;
  };
  prototype.compileNode = function(o){
    var temps, idx, ref$, pvar, step, tvar, tail, fvar, vars, eq, cond, svar, srcPart, lvar, head, that, body;
    o.loop = true;
    temps = this.temps = [];
    if (this.object && this.index) {
      o.scope.declare(idx = this.index);
    } else {
      temps.push(idx = o.scope.temporary('i'));
    }
    if (!this.body) {
      this.addBody(Block(Var(idx)));
    }
    if (!this.object) {
      ref$ = (this.step || Literal(1)).compileLoopReference(o, 'step'), pvar = ref$[0], step = ref$[1];
      pvar === step || temps.push(pvar);
    }
    if (this.from) {
      ref$ = this.to.compileLoopReference(o, 'to'), tvar = ref$[0], tail = ref$[1];
      fvar = this.from.compile(o, LEVEL_LIST);
      vars = idx + " = " + fvar;
      if (tail !== tvar) {
        vars += ", " + tail;
        temps.push(tvar);
      }
      if (!this.step && +fvar > +tvar) {
        pvar = step = -1;
      }
      eq = this.op === 'til' ? '' : '=';
      cond = +pvar
        ? idx + " " + '<>'.charAt(pvar < 0) + eq + " " + tvar
        : pvar + " < 0 ? " + idx + " >" + eq + " " + tvar + " : " + idx + " <" + eq + " " + tvar;
    } else {
      if (this.ref) {
        this.item = Var(o.scope.temporary('x'));
      }
      if (this.item || this.object && this.own || this['let']) {
        ref$ = this.source.compileLoopReference(o, 'ref', !this.object), svar = ref$[0], srcPart = ref$[1];
        svar === srcPart || temps.push(svar);
      } else {
        svar = srcPart = this.source.compile(o, LEVEL_PAREN);
      }
      if (!this.object) {
        if (0 > pvar && ~~pvar === +pvar) {
          vars = idx + " = " + srcPart + ".length - 1";
          cond = idx + " >= 0";
        } else {
          temps.push(lvar = o.scope.temporary('len'));
          vars = idx + " = 0, " + lvar + " = " + srcPart + ".length";
          cond = idx + " < " + lvar;
        }
      }
    }
    this['else'] && (this.yet = o.scope.temporary('yet'));
    head = 'for (';
    if (this.object) {
      head += idx + " in ";
    }
    if (that = this.yet) {
      head += that + " = true, ";
    }
    if (this.object) {
      head += srcPart;
    } else {
      step === pvar || (vars += ', ' + step);
      head += (vars + "; " + cond + "; ") + (1 == Math.abs(pvar)
        ? (pvar < 0 ? '--' : '++') + idx
        : idx + (pvar < 0
          ? ' -= ' + pvar.slice(1)
          : ' += ' + pvar));
    }
    this.own && (head += ") if (" + o.scope.assign('own$', '{}.hasOwnProperty') + ".call(" + svar + ", " + idx + ")");
    head += ') {';
    if (this['let']) {
      this.body.traverseChildren(function(it){
        switch (it.value) {
        case 'index$$':
          it.value = idx;
          break;
        case 'item$$':
          it.value = svar + "[" + idx + "]";
        }
      });
    }
    o.indent += TAB;
    if (this.index && !this.object) {
      head += '\n' + o.indent + Assign(Var(this.index), JS(idx)).compile(o, LEVEL_TOP) + ';';
    }
    if (this.item && !this.item.isEmpty()) {
      head += '\n' + o.indent + Assign(this.item, JS(svar + "[" + idx + "]")).compile(o, LEVEL_TOP) + ';';
    }
    if (this.ref) {
      o.ref = this.item.value;
    }
    body = this.compileBody(o);
    if ((this.item || (this.index && !this.object)) && '}' === body.charAt(0)) {
      head += '\n' + this.tab;
    }
    return head + body;
  };
  return For;
}(While));
exports.Try = Try = (function(superclass){
  var prototype = extend$((import$(Try, superclass).displayName = 'Try', Try), superclass).prototype, constructor = Try;
  function Try(attempt, thrown, recovery, ensure){
    var ref$;
    this.attempt = attempt;
    this.thrown = thrown;
    this.recovery = recovery;
    this.ensure = ensure;
    if ((ref$ = this.recovery) != null) {
      ref$.lines.unshift(Assign(this.thrown || Var('e'), Var('e$')));
    }
  }
  prototype.children = ['attempt', 'recovery', 'ensure'];
  prototype.show = function(){
    return this.thrown;
  };
  prototype.isStatement = YES;
  prototype.isCallable = function(){
    var ref$;
    return ((ref$ = this.recovery) != null ? ref$.isCallable() : void 8) && this.attempt.isCallable();
  };
  prototype.getJump = function(it){
    var ref$;
    return this.attempt.getJump(it) || ((ref$ = this.recovery) != null ? ref$.getJump(it) : void 8);
  };
  prototype.makeReturn = function(){
    var ref$;
    this.attempt = (ref$ = this.attempt).makeReturn.apply(ref$, arguments);
    if (this.recovery != null) {
      this.recovery = (ref$ = this.recovery).makeReturn.apply(ref$, arguments);
    }
    return this;
  };
  prototype.compileNode = function(o){
    var code, that;
    o.indent += TAB;
    code = 'try ' + this.compileBlock(o, this.attempt);
    if (that = this.recovery || !this.ensure && JS('')) {
      code += ' catch (e$) ' + this.compileBlock(o, that);
    }
    if (that = this.ensure) {
      code += ' finally ' + this.compileBlock(o, that);
    }
    return code;
  };
  return Try;
}(Node));
exports.Switch = Switch = (function(superclass){
  var prototype = extend$((import$(Switch, superclass).displayName = 'Switch', Switch), superclass).prototype, constructor = Switch;
  function Switch(type, topic, cases, $default){
    var last, ref$;
    this.type = type;
    this.topic = topic;
    this.cases = cases;
    this['default'] = $default;
    if (type === 'match') {
      if (topic) {
        this.target = Arr(topic);
      }
      this.topic = null;
    } else {
      if (topic) {
        if (topic.length > 1) {
          throw "can't have more than one topic in switch statement";
        }
        this.topic = this.topic[0];
      }
    }
    if (this.cases.length && (last = (ref$ = this.cases)[ref$.length - 1]).tests.length === 1 && last.tests[0] instanceof Var && last.tests[0].value === '_') {
      this.cases.pop();
      this['default'] = last.body;
    }
  }
  prototype.children = ['topic', 'cases', 'default'];
  prototype.aSource = 'topic';
  prototype.aTargets = ['cases', 'default'];
  prototype.show = function(){
    return this.type;
  };
  prototype.isStatement = YES;
  prototype.isCallable = function(){
    var i$, ref$, len$, c;
    for (i$ = 0, len$ = (ref$ = this.cases).length; i$ < len$; ++i$) {
      c = ref$[i$];
      if (!c.isCallable()) {
        return false;
      }
    }
    if (this['default']) {
      return this['default'].isCallable();
    } else {
      return true;
    }
  };
  prototype.getJump = function(ctx){
    var i$, ref$, len$, c, that;
    ctx || (ctx = {});
    ctx['break'] = true;
    for (i$ = 0, len$ = (ref$ = this.cases).length; i$ < len$; ++i$) {
      c = ref$[i$];
      if (that = c.body.getJump(ctx)) {
        return that;
      }
    }
    return (ref$ = this['default']) != null ? ref$.getJump(ctx) : void 8;
  };
  prototype.makeReturn = function(){
    var i$, ref$, len$, c;
    for (i$ = 0, len$ = (ref$ = this.cases).length; i$ < len$; ++i$) {
      c = ref$[i$];
      c.makeReturn.apply(c, arguments);
    }
    if ((ref$ = this['default']) != null) {
      ref$.makeReturn.apply(ref$, arguments);
    }
    return this;
  };
  prototype.compileNode = function(o){
    var tab, ref$, targetNode, target, topic, t, code, stop, i$, len$, i, c, that;
    tab = this.tab;
    if (this.target) {
      ref$ = Chain(this.target).cacheReference(o), targetNode = ref$[0], target = ref$[1];
    }
    topic = this.type === 'match'
      ? (t = target
        ? [targetNode]
        : [], Block(t.concat([Literal('false')])).compile(o, LEVEL_PAREN))
      : !!this.topic && this.anaphorize().compile(o, LEVEL_PAREN);
    code = "switch (" + topic + ") {\n";
    stop = this['default'] || this.cases.length - 1;
    o['break'] = true;
    for (i$ = 0, len$ = (ref$ = this.cases).length; i$ < len$; ++i$) {
      i = i$;
      c = ref$[i$];
      code += c.compileCase(o, tab, i === stop, this.type === 'match' || !topic, this.type, target);
    }
    if (this['default']) {
      o.indent = tab + TAB;
      if (that = this['default'].compile(o, LEVEL_TOP)) {
        code += tab + ("default:\n" + that + "\n");
      }
    }
    return code + tab + '}';
  };
  return Switch;
}(Node));
exports.Case = Case = (function(superclass){
  var prototype = extend$((import$(Case, superclass).displayName = 'Case', Case), superclass).prototype, constructor = Case;
  function Case(tests, body){
    this.tests = tests;
    this.body = body;
  }
  prototype.children = ['tests', 'body'];
  prototype.isCallable = function(){
    return this.body.isCallable();
  };
  prototype.makeReturn = function(){
    var ref$, ref1$;
    if (((ref$ = (ref1$ = this.body.lines)[ref1$.length - 1]) != null ? ref$.value : void 8) !== 'fallthrough') {
      (ref1$ = this.body).makeReturn.apply(ref1$, arguments);
    }
    return this;
  };
  prototype.compileCase = function(o, tab, nobr, bool, type, target){
    var tests, i$, ref$, len$, test, j$, ref1$, len1$, t, i, tar, binary, that, code, lines, last, ft;
    tests = [];
    for (i$ = 0, len$ = (ref$ = this.tests).length; i$ < len$; ++i$) {
      test = ref$[i$];
      test = test.expandSlice(o).unwrap();
      if (test instanceof Arr && type !== 'match') {
        for (j$ = 0, len1$ = (ref1$ = test.items).length; j$ < len1$; ++j$) {
          t = ref1$[j$];
          tests.push(t);
        }
      } else {
        tests.push(test);
      }
    }
    tests.length || tests.push(Literal('void'));
    if (type === 'match') {
      for (i$ = 0, len$ = tests.length; i$ < len$; ++i$) {
        i = i$;
        test = tests[i$];
        tar = Chain(target).add(Index(Literal(i), '.', true));
        tests[i] = Chain(test).autoCompare(target ? [tar] : null);
      }
    }
    if (bool) {
      binary = type === 'match' ? '&&' : '||';
      t = tests[0];
      i = 0;
      while (that = tests[++i]) {
        t = Binary(binary, t, that);
      }
      tests = [(this.t = t, this.aSource = 't', this.aTargets = ['body'], this).anaphorize().invert()];
    }
    code = '';
    for (i$ = 0, len$ = tests.length; i$ < len$; ++i$) {
      t = tests[i$];
      code += tab + ("case " + t.compile(o, LEVEL_PAREN) + ":\n");
    }
    lines = this.body.lines;
    last = lines[lines.length - 1];
    if (ft = (last != null ? last.value : void 8) === 'fallthrough') {
      lines[lines.length - 1] = JS('// fallthrough');
    }
    o.indent = tab += TAB;
    if (that = this.body.compile(o, LEVEL_TOP)) {
      code += that + '\n';
    }
    if (!(nobr || ft || last instanceof Jump)) {
      code += tab + 'break;\n';
    }
    return code;
  };
  return Case;
}(Node));
exports.If = If = (function(superclass){
  var prototype = extend$((import$(If, superclass).displayName = 'If', If), superclass).prototype, constructor = If;
  function If($if, then, un){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$['if'] = $if;
    this$.then = then;
    this$.un = un;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['if', 'then', 'else'];
  prototype.aSource = 'if';
  prototype.aTargets = ['then'];
  prototype.show = function(){
    return this.un && '!';
  };
  prototype.terminator = '';
  prototype.delegate(['isCallable', 'isArray', 'isString', 'isRegex'], function(it){
    var ref$;
    return ((ref$ = this['else']) != null ? ref$[it]() : void 8) && this.then[it]();
  });
  prototype.getJump = function(it){
    var ref$;
    return this.then.getJump(it) || ((ref$ = this['else']) != null ? ref$.getJump(it) : void 8);
  };
  prototype.makeReturn = function(){
    var ref$;
    this.then = (ref$ = this.then).makeReturn.apply(ref$, arguments);
    if (this['else'] != null) {
      this['else'] = (ref$ = this['else']).makeReturn.apply(ref$, arguments);
    }
    return this;
  };
  prototype.compileNode = function(o){
    if (this.un) {
      this['if'] = this['if'].invert();
    } else {
      this.soak || this.anaphorize();
    }
    if (o.level) {
      return this.compileExpression(o);
    } else {
      return this.compileStatement(o);
    }
  };
  prototype.compileStatement = function(o){
    var code, els;
    code = "if (" + this['if'].compile(o, LEVEL_PAREN) + ") ";
    o.indent += TAB;
    code += this.compileBlock(o, Block(this.then));
    if (!(els = this['else'])) {
      return code;
    }
    return code + ' else ' + (els instanceof constructor
      ? els.compile((o.indent = this.tab, o), LEVEL_TOP)
      : this.compileBlock(o, els));
  };
  prototype.compileExpression = function(o){
    var thn, els, code, pad;
    thn = this.then, els = this['else'] || Literal('void');
    this['void'] && (thn['void'] = els['void'] = true);
    if (!this['else'] && (this.cond || this['void'])) {
      return Parens(Binary('&&', this['if'], thn)).compile(o);
    }
    code = this['if'].compile(o, LEVEL_COND);
    pad = els.isComplex() ? '\n' + (o.indent += TAB) : ' ';
    code += pad + "? " + thn.compile(o, LEVEL_LIST) + "" + pad + ": " + els.compile(o, LEVEL_LIST);
    if (o.level < LEVEL_COND) {
      return code;
    } else {
      return "(" + code + ")";
    }
  };
  If.unfoldSoak = function(o, parent, name){
    var that;
    if (that = parent[name].unfoldSoak(o)) {
      parent[name] = that.then;
      return that.cond = parent.cond, that['void'] = parent['void'], that.then = Chain(parent), that;
    }
  };
  return If;
}(Node));
exports.Label = Label = (function(superclass){
  var ref$, prototype = extend$((import$(Label, superclass).displayName = 'Label', Label), superclass).prototype, constructor = Label;
  function Label(label, it){
    var fun;
    this.label = label || '_';
    this.it = it;
    if (fun = (it instanceof Fun || it instanceof Class) && it || it.calling && it.it.head) {
      fun.name || (fun.name = this.label, fun.labeled = true);
      return it;
    }
  }
  ref$ = Parens.prototype, prototype.children = ref$.children, prototype.isCallable = ref$.isCallable, prototype.isArray = ref$.isArray;
  prototype.show = function(){
    return this.label;
  };
  prototype.isStatement = YES;
  prototype.getJump = function(ctx){
    var ref$;
    ctx || (ctx = {});
    ((ref$ = ctx.labels) != null
      ? ref$
      : ctx.labels = []).push(this.label);
    return this.it.getJump((ctx['break'] = true, ctx));
  };
  prototype.makeReturn = function(){
    var ref$;
    this.it = (ref$ = this.it).makeReturn.apply(ref$, arguments);
    return this;
  };
  prototype.compileNode = function(o){
    var label, it, labels;
    label = this.label, it = this.it;
    labels = o.labels = slice$.call(o.labels || []);
    if (in$(label, labels)) {
      this.carp("duplicate label \"" + label + "\"");
    }
    labels.push(label);
    it.isStatement() || (it = Block(it));
    return (label + ": ") + (it instanceof Block
      ? (o.indent += TAB, this.compileBlock(o, it))
      : it.compile(o));
  };
  return Label;
}(Node));
exports.Cascade = Cascade = (function(superclass){
  var prototype = extend$((import$(Cascade, superclass).displayName = 'Cascade', Cascade), superclass).prototype, constructor = Cascade;
  function Cascade(input, output, prog1){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.input = input;
    this$.output = output;
    this$.prog1 = prog1;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.show = function(){
    return this.prog1;
  };
  prototype.children = ['input', 'output'];
  prototype.terminator = '';
  prototype.delegate(['isCallable', 'isArray', 'isString', 'isRegex'], function(it){
    return this[this.prog1 ? 'input' : 'output'][it]();
  });
  prototype.getJump = function(it){
    return this.output.getJump(it);
  };
  prototype.makeReturn = function(ret){
    this.ret = ret;
    return this;
  };
  prototype.compileNode = function(o){
    var level, input, output, prog1, ref, ref$, code, out;
    level = o.level;
    input = this.input, output = this.output, prog1 = this.prog1, ref = this.ref;
    if (prog1 && ('ret' in this || level && !this['void'])) {
      output.add((ref$ = Literal('..'), ref$.cascadee = true, ref$));
    }
    if ('ret' in this) {
      output = output.makeReturn(this.ret);
    }
    if (ref) {
      prog1 || (output = Assign(Var(ref), output));
    } else {
      ref = o.scope.temporary('x');
    }
    if (input instanceof Cascade) {
      input.ref = ref;
    } else {
      input && (input = Assign(Var(ref), input));
    }
    o.level && (o.level = LEVEL_PAREN);
    code = input.compile(o);
    out = Block(output).compile((o.ref = new String(ref), o));
    if (prog1 === 'cascade' && !o.ref.erred) {
      this.carp("unreferred cascadee");
    }
    if (!level) {
      return code + "" + input.terminator + "\n" + out;
    }
    code += ", " + out;
    if (level > LEVEL_PAREN) {
      return "(" + code + ")";
    } else {
      return code;
    }
  };
  return Cascade;
}(Node));
exports.JS = JS = (function(superclass){
  var prototype = extend$((import$(JS, superclass).displayName = 'JS', JS), superclass).prototype, constructor = JS;
  function JS(code, literal, comment){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.code = code;
    this$.literal = literal;
    this$.comment = comment;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.show = function(){
    if (this.comment) {
      return this.code;
    } else {
      return "`" + this.code + "`";
    }
  };
  prototype.terminator = '';
  prototype.isAssignable = prototype.isCallable = function(){
    return !this.comment;
  };
  prototype.compile = function(it){
    if (this.literal) {
      return entab(this.code, it.indent);
    } else {
      return this.code;
    }
  };
  return JS;
}(Node));
exports.Require = Require = (function(superclass){
  var prototype = extend$((import$(Require, superclass).displayName = 'Require', Require), superclass).prototype, constructor = Require;
  function Require(body){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.body = body;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['body'];
  prototype.compile = function(o){
    var getValue, processItem, item, this$ = this;
    getValue = function(item, throwError){
      switch (false) {
      case !(item instanceof Key):
        return item.name;
      case !(item instanceof Var):
        return item.value;
      case !(item instanceof Literal):
        return item.value;
      default:
        if (throwError) {
          return this$.carp('invalid require! argument');
        } else {
          return item;
        }
      }
    };
    processItem = function(item){
      var ref$, asg, value, asgValue, toAsg, main;
      ref$ = (function(){
        switch (false) {
        case !(item instanceof Prop):
          return [item.val, item.key];
        default:
          return [item, item];
        }
      }()), asg = ref$[0], value = ref$[1];
      asgValue = getValue(asg);
      toAsg = toString$.call(asgValue).slice(8, -1) === 'String' ? Var(nameFromPath(asgValue)) : asg;
      value = stripString(getValue(value, true));
      main = Chain(Var('require')).add(Call([Literal("'" + value + "'")]));
      return Assign(toAsg, main).compile(o);
    };
    if (this.body.items != null) {
      return (function(){
        var i$, ref$, len$, results$ = [];
        for (i$ = 0, len$ = (ref$ = this.body.items).length; i$ < len$; ++i$) {
          item = ref$[i$];
          results$.push(processItem(item));
        }
        return results$;
      }.call(this)).join(";\n" + o.indent);
    } else {
      return processItem(this.body);
    }
  };
  return Require;
}(Node));
exports.Util = Util = (function(superclass){
  var prototype = extend$((import$(Util, superclass).displayName = 'Util', Util), superclass).prototype, constructor = Util;
  function Util(verb){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.verb = verb;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.show = Jump.prototype.show;
  prototype.isCallable = YES;
  prototype.compile = function(){
    return util(this.verb);
  };
  Util.Extends = function(){
    return Call.make(Util('extend'), [arguments[0], arguments[1]]);
  };
  return Util;
}(Node));
exports.Vars = Vars = (function(superclass){
  var prototype = extend$((import$(Vars, superclass).displayName = 'Vars', Vars), superclass).prototype, constructor = Vars;
  function Vars(vars){
    var this$ = this instanceof ctor$ ? this : new ctor$;
    this$.vars = vars;
    return this$;
  } function ctor$(){} ctor$.prototype = prototype;
  prototype.children = ['vars'];
  prototype.makeReturn = THIS;
  prototype.compile = function(o, level){
    var i$, ref$, len$, v, value;
    for (i$ = 0, len$ = (ref$ = this.vars).length; i$ < len$; ++i$) {
      v = ref$[i$], value = v.value;
      if (!(v instanceof Var)) {
        v.carp('invalid variable declaration');
      }
      if (o.scope.check(value)) {
        v.carp("redeclaration of \"" + value + "\"");
      }
      o.scope.declare(value, v);
    }
    return Literal('void').compile(o, level);
  };
  return Vars;
}(Node));
exports.L = function(yylineno, node){
  return node.line = yylineno + 1, node;
};
exports.Decl = function(type, nodes, lno){
  if (!nodes[0]) {
    throw SyntaxError("empty " + type + " on line " + lno);
  }
  return DECLS[type](nodes);
};
DECLS = {
  'export': function(lines){
    var i, out, node, that, ref$;
    i = -1;
    out = Util('out');
    while (node = lines[++i]) {
      if (node instanceof Block) {
        lines.splice.apply(lines, [i--, 1].concat(slice$.call(node.lines)));
        continue;
      }
      if (that = node instanceof Fun && node.name) {
        lines.splice(i++, 0, Assign(Chain(out, [Index(Key(that))]), Var(that)));
        continue;
      }
      lines[i] = (that = node.varName() || node instanceof Assign && node.left.varName() || node instanceof Class && ((ref$ = node.title) != null ? ref$.varName() : void 8))
        ? Assign(Chain(out, [Index(Key(that))]), node)
        : Import(out, node);
    }
    return Block(lines);
  },
  'import': function(lines, all){
    var i$, len$, i, line;
    for (i$ = 0, len$ = lines.length; i$ < len$; ++i$) {
      i = i$;
      line = lines[i$];
      lines[i] = Import(Literal('this'), line, all);
    }
    return Block(lines);
  },
  importAll: function(it){
    return this['import'](it, true);
  },
  'const': function(lines){
    var i$, len$, node;
    for (i$ = 0, len$ = lines.length; i$ < len$; ++i$) {
      node = lines[i$];
      node.op === '=' || node.carp('invalid constant variable declaration');
      node['const'] = true;
    }
    return Block(lines);
  },
  'var': Vars
};
function Scope(parent, shared){
  this.parent = parent;
  this.shared = shared;
  this.variables = {};
}
ref$ = Scope.prototype;
ref$.READ_ONLY = {
  'const': 'constant',
  'function': 'function',
  undefined: 'undeclared'
};
ref$.add = function(name, type, node){
  var t, that;
  if (node && (t = this.variables[name + "."])) {
    if (that = this.READ_ONLY[t] || this.READ_ONLY[type]) {
      node.carp("redeclaration of " + that + " \"" + name + "\"");
    } else if (t === type && type === 'arg') {
      node.carp("duplicate parameter \"" + name + "\"");
    } else if (t === 'upvar') {
      node.carp("accidental shadow of \"" + name + "\"");
    }
    if (t === 'arg' || t === 'function') {
      return name;
    }
  }
  this.variables[name + "."] = type;
  return name;
};
ref$.get = function(name){
  return this.variables[name + "."];
};
ref$.declare = function(name, node, constant){
  var that, scope;
  if (that = this.shared) {
    if (this.check(name)) {
      return;
    }
    scope = that;
  } else {
    scope = this;
  }
  return scope.add(name, constant ? 'const' : 'var', node);
};
ref$.assign = function(name, value){
  return this.add(name, {
    value: value
  });
};
ref$.temporary = function(name){
  var ref$;
  name || (name = 'ref');
  while ((ref$ = this.variables[name + "$."]) !== 'reuse' && ref$ !== void 8) {
    name = name.length < 2 && name < 'z'
      ? String.fromCharCode(name.charCodeAt() + 1)
      : name.replace(/\d*$/, fn$);
  }
  return this.add(name + '$', 'var');
  function fn$(it){
    return ++it;
  }
};
ref$.free = function(name){
  return this.add(name, 'reuse');
};
ref$.check = function(name, above){
  var type, ref$;
  if ((type = this.variables[name + "."]) || !above) {
    return type;
  }
  return (ref$ = this.parent) != null ? ref$.check(name, above) : void 8;
};
ref$.checkReadOnly = function(name){
  var that, ref$, key$;
  if (that = this.READ_ONLY[this.check(name, true)]) {
    return that;
  }
  (ref$ = this.variables)[key$ = name + "."] || (ref$[key$] = 'upvar');
  return '';
};
ref$.emit = function(code, tab){
  var vrs, asn, fun, name, ref$, type, that, val;
  vrs = [];
  asn = [];
  fun = [];
  for (name in ref$ = this.variables) {
    type = ref$[name];
    name = name.slice(0, -1);
    if (type === 'var' || type === 'const' || type === 'reuse') {
      vrs.push(name);
    } else if (that = type.value) {
      if (~(val = entab(that, tab)).lastIndexOf('function(', 0)) {
        fun.push("function " + name + val.slice(8));
      } else {
        asn.push(name + " = " + val);
      }
    }
  }
  if (that = vrs.concat(asn).join(', ')) {
    code = tab + "var " + that + ";\n" + code;
  }
  if (that = fun.join("\n" + tab)) {
    return code + "\n" + tab + that;
  } else {
    return code;
  }
};
function YES(){
  return true;
}
function NO(){
  return false;
}
function THIS(){
  return this;
}
function VOID(){}
UTILS = {
  clone: 'function(it){\n  function fun(){} fun.prototype = it;\n  return new fun;\n}',
  extend: 'function(sub, sup){\n  function fun(){} fun.prototype = (sub.superclass = sup).prototype;\n  (sub.prototype = new fun).constructor = sub;\n  if (typeof sup.extended == \'function\') sup.extended(sub);\n  return sub;\n}',
  bind: 'function(obj, key, target){\n  return function(){ return (target || obj)[key].apply(obj, arguments) };\n}',
  'import': 'function(obj, src){\n  var own = {}.hasOwnProperty;\n  for (var key in src) if (own.call(src, key)) obj[key] = src[key];\n  return obj;\n}',
  importAll: 'function(obj, src){\n  for (var key in src) obj[key] = src[key];\n  return obj;\n}',
  repeatString: 'function(str, n){\n  for (var r = \'\'; n > 0; (n >>= 1) && (str += str)) if (n & 1) r += str;\n  return r;\n}',
  repeatArray: 'function(arr, n){\n  for (var r = []; n > 0; (n >>= 1) && (arr = arr.concat(arr)))\n    if (n & 1) r.push.apply(r, arr);\n  return r;\n}',
  'in': 'function(x, xs){\n  var i = -1, l = xs.length >>> 0;\n  while (++i < l) if (x === xs[i]) return true;\n  return false;\n}',
  out: 'typeof exports != \'undefined\' && exports || this',
  curry: 'function(f, bound){\n  var context,\n  _curry = function(args) {\n    return f.length > 1 ? function(){\n      var params = args ? args.concat() : [];\n      context = bound ? context || this : this;\n      return params.push.apply(params, arguments) <\n          f.length && arguments.length ?\n        _curry.call(context, params) : f.apply(context, params);\n    } : f;\n  };\n  return _curry();\n}',
  flip: 'function(f){\n  return curry$(function (x, y) { return f(y, x); });\n}',
  partialize: 'function(f, args, where){\n  var context = this;\n  return function(){\n    var params = slice$.call(arguments), i,\n        len = params.length, wlen = where.length,\n        ta = args ? args.concat() : [], tw = where ? where.concat() : [];\n    for(i = 0; i < len; ++i) { ta[tw[0]] = params[i]; tw.shift(); }\n    return len < wlen && len ?\n      partialize$.apply(context, [f, ta, tw]) : f.apply(context, ta);\n  };\n}',
  not: 'function(x){ return !x; }',
  compose: 'function() {\n  var functions = arguments;\n  return function() {\n    var i, result;\n    result = functions[0].apply(this, arguments);\n    for (i = 1; i < functions.length; ++i) {\n      result = functions[i](result);\n    }\n    return result;\n  };\n}',
  deepEq: 'function(x, y, type){\n  var toString = {}.toString, hasOwnProperty = {}.hasOwnProperty,\n      has = function (obj, key) { return hasOwnProperty.call(obj, key); };\n  var first = true;\n  return eq(x, y, []);\n  function eq(a, b, stack) {\n    var className, length, size, result, alength, blength, r, key, ref, sizeB;\n    if (a == null || b == null) { return a === b; }\n    if (a.__placeholder__ || b.__placeholder__) { return true; }\n    if (a === b) { return a !== 0 || 1 / a == 1 / b; }\n    className = toString.call(a);\n    if (toString.call(b) != className) { return false; }\n    switch (className) {\n      case \'[object String]\': return a == String(b);\n      case \'[object Number]\':\n        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);\n      case \'[object Date]\':\n      case \'[object Boolean]\':\n        return +a == +b;\n      case \'[object RegExp]\':\n        return a.source == b.source &&\n               a.global == b.global &&\n               a.multiline == b.multiline &&\n               a.ignoreCase == b.ignoreCase;\n    }\n    if (typeof a != \'object\' || typeof b != \'object\') { return false; }\n    length = stack.length;\n    while (length--) { if (stack[length] == a) { return true; } }\n    stack.push(a);\n    size = 0;\n    result = true;\n    if (className == \'[object Array]\') {\n      alength = a.length;\n      blength = b.length;\n      if (first) {\n        switch (type) {\n        case \'===\': result = alength === blength; break;\n        case \'<==\': result = alength <= blength; break;\n        case \'<<=\': result = alength < blength; break;\n        }\n        size = alength;\n        first = false;\n      } else {\n        result = alength === blength;\n        size = alength;\n      }\n      if (result) {\n        while (size--) {\n          if (!(result = size in a == size in b && eq(a[size], b[size], stack))){ break; }\n        }\n      }\n    } else {\n      if (\'constructor\' in a != \'constructor\' in b || a.constructor != b.constructor) {\n        return false;\n      }\n      for (key in a) {\n        if (has(a, key)) {\n          size++;\n          if (!(result = has(b, key) && eq(a[key], b[key], stack))) { break; }\n        }\n      }\n      if (result) {\n        sizeB = 0;\n        for (key in b) {\n          if (has(b, key)) { ++sizeB; }\n        }\n        if (first) {\n          if (type === \'<<=\') {\n            result = size < sizeB;\n          } else if (type === \'<==\') {\n            result = size <= sizeB\n          } else {\n            result = size === sizeB;\n          }\n        } else {\n          first = false;\n          result = size === sizeB;\n        }\n      }\n    }\n    stack.pop();\n    return result;\n  }\n}',
  split: "''.split",
  replace: "''.replace",
  toString: '{}.toString',
  join: '[].join',
  slice: '[].slice',
  splice: '[].splice'
};
LEVEL_TOP = 0;
LEVEL_PAREN = 1;
LEVEL_LIST = 2;
LEVEL_COND = 3;
LEVEL_OP = 4;
LEVEL_CALL = 5;
(function(){
  this['&&'] = this['||'] = this['xor'] = 0.2;
  this['.&.'] = this['.^.'] = this['.|.'] = 0.3;
  this['=='] = this['!='] = this['~='] = this['!~='] = this['==='] = this['!=='] = 0.4;
  this['<'] = this['>'] = this['<='] = this['>='] = this.of = this['instanceof'] = 0.5;
  this['<<='] = this['>>='] = this['<=='] = this['>=='] = this['++'] = 0.5;
  this['.<<.'] = this['.>>.'] = this['.>>>.'] = 0.6;
  this['+'] = this['-'] = 0.7;
  this['*'] = this['/'] = this['%'] = 0.8;
}.call(PREC = {
  unary: 0.9
}));
TAB = '  ';
ID = /^(?!\d)[\w$\xAA-\uFFDC]+$/;
SIMPLENUM = /^\d+$/;
function util(it){
  return Scope.root.assign(it + '$', UTILS[it]);
}
function entab(code, tab){
  return code.replace(/\n/g, '\n' + tab);
}
function import$(obj, src){
  var own = {}.hasOwnProperty;
  for (var key in src) if (own.call(src, key)) obj[key] = src[key];
  return obj;
}
function clone$(it){
  function fun(){} fun.prototype = it;
  return new fun;
}
function extend$(sub, sup){
  function fun(){} fun.prototype = (sub.superclass = sup).prototype;
  (sub.prototype = new fun).constructor = sub;
  if (typeof sup.extended == 'function') sup.extended(sub);
  return sub;
}
function in$(x, xs){
  var i = -1, l = xs.length >>> 0;
  while (++i < l) if (x === xs[i]) return true;
  return false;
}
function repeatString$(str, n){
  for (var r = ''; n > 0; (n >>= 1) && (str += str)) if (n & 1) r += str;
  return r;
}
function importAll$(obj, src){
  for (var key in src) obj[key] = src[key];
  return obj;
}
},{"./util":14,"prelude-ls":36}],10:[function(require,module,exports){
// Generated by LiveScript 1.3.1
var lexer, parser, ast;
lexer = require('./lexer');
parser = require('./parser').parser;
ast = require('./ast');
parser.yy = ast;
parser.lexer = {
  lex: function(){
    var ref$, tag;
    ref$ = this.tokens[++this.pos] || [''], tag = ref$[0], this.yytext = ref$[1], this.yylineno = ref$[2];
    return tag;
  },
  setInput: function(it){
    this.pos = -1;
    return this.tokens = it;
  },
  upcomingInput: function(){
    return '';
  }
};
exports.VERSION = '1.3.1';
exports.compile = function(code, options){
  var output, e, that;
  options == null && (options = {});
  options.header == null && (options.header = true);
  try {
    output = parser.parse(lexer.lex(code)).compileRoot(options);
    if (options.header) {
      output = "// Generated by LiveScript " + exports.VERSION + "\n" + output;
    }
    return output;
  } catch (e$) {
    e = e$;
    if (that = options.filename) {
      e.message += "\nat " + that;
    }
    throw e;
  }
};
exports.ast = function(it){
  return parser.parse(typeof it === 'string' ? lexer.lex(it) : it);
};
exports.tokens = lexer.lex;
exports.lex = function(it){
  return lexer.lex(it, {
    raw: true
  });
};
exports.run = function(code, options){
  var ref$;
  return Function(exports.compile(code, (ref$ = {}, import$(ref$, options), ref$.bare = true, ref$)))();
};
exports.tokens.rewrite = lexer.rewrite;
importAll$(exports.ast, parser.yy);
if (require.extensions) {
  require('./node')(exports);
} else {
  exports.require = require;
}
function import$(obj, src){
  var own = {}.hasOwnProperty;
  for (var key in src) if (own.call(src, key)) obj[key] = src[key];
  return obj;
}
function importAll$(obj, src){
  for (var key in src) obj[key] = src[key];
  return obj;
}
},{"./ast":9,"./lexer":11,"./node":12,"./parser":13}],11:[function(require,module,exports){
// Generated by LiveScript 1.3.1
var string, TABS, unlines, enlines, enslash, reslash, camelize, character, KEYWORDS_SHARED, KEYWORDS_UNUSED, JS_KEYWORDS, LS_KEYWORDS, ID, SYMBOL, SPACE, MULTIDENT, SIMPLESTR, JSTOKEN, BSTOKEN, NUMBER, NUMBER_OMIT, REGEX, HEREGEX_OMIT, LASTDENT, INLINEDENT, NONASCII, OPENERS, CLOSERS, INVERSES, i, o, c, CHAIN, ARG, BLOCK_USERS, slice$ = [].slice;
exports.lex = function(code, options){
  return clone$(exports).tokenize(code || '', options || {});
};
exports.rewrite = function(it){
  var ref$;
  it || (it = this.tokens);
  firstPass(it);
  addImplicitIndentation(it);
  rewriteBlockless(it);
  addImplicitParentheses(it);
  addImplicitBraces(it);
  expandLiterals(it);
  if (((ref$ = it[0]) != null ? ref$[0] : void 8) === 'NEWLINE') {
    it.shift();
  }
  return it;
};
exports.tokenize = function(code, o){
  var i, c, that;
  this.inter || (code = code.replace(/[\r\u2028\u2029\uFEFF]/g, ''));
  code = '\n' + code;
  this.tokens = [this.last = ['NEWLINE', '\n', 0]];
  this.line = ~-o.line;
  this.dents = [];
  this.closes = [];
  this.parens = [];
  this.flags = [];
  i = 0;
  while (c = code.charAt(i)) {
    switch (c) {
    case ' ':
      i += this.doSpace(code, i);
      break;
    case '\n':
      i += this.doLine(code, i);
      break;
    case '\\':
      i += this.doBackslash(code, i);
      break;
    case '\'':
    case '"':
      i += this.doString(code, i, c);
      break;
    case "0":
    case "1":
    case "2":
    case "3":
    case "4":
    case "5":
    case "6":
    case "7":
    case "8":
    case "9":
      i += this.doNumber(code, i);
      break;
    case '/':
      switch (code.charAt(i + 1)) {
      case '*':
        i += this.doComment(code, i);
        break;
      case '/':
        i += this.doHeregex(code, i);
        break;
      default:
        i += this.doRegex(code, i) || this.doLiteral(code, i);
      }
      break;
    case '`':
      if ('`' === code.charAt(i + 1)) {
        i += this.doJS(code, i);
      } else {
        i += this.doLiteral(code, i);
      }
      break;
    default:
      i += this.doID(code, i) || this.doLiteral(code, i) || this.doSpace(code, i);
    }
  }
  this.dedent(this.dent);
  if (that = this.closes.pop()) {
    this.carp("missing `" + that + "`");
  }
  if (this.inter) {
    this.rest == null && this.carp('unterminated interpolation');
  } else {
    this.last.spaced = true;
    this.newline();
  }
  o.raw || this.rewrite();
  return this.tokens;
};
exports.dent = 0;
exports.identifiers = {};
exports.hasOwn = Object.prototype.hasOwnProperty;
exports.checkConsistency = function(camel, id){
  if (this.hasOwn.call(this.identifiers, camel) && this.identifiers[camel] !== id) {
    throw new ReferenceError("Inconsistent use of " + camel + " as " + id + " on line " + (-~this.line));
  } else {
    return this.identifiers[camel] = id;
  }
};
exports.doID = function(code, index){
  var regexMatch, input, id, e, last, ref$, tag, ref1$, that;
  input = (regexMatch = (ID.lastIndex = index, ID).exec(code))[0];
  if (!input) {
    return 0;
  }
  id = camelize(regexMatch[1]);
  if (/-/.test(regexMatch[1])) {
    this.checkConsistency(id, regexMatch[1]);
  }
  if (NONASCII.test(id)) {
    try {
      Function("var " + id);
    } catch (e$) {
      e = e$;
      this.carp("invalid identifier \"" + id + "\"");
    }
  }
  last = this.last;
  if (regexMatch[2] || last[0] === 'DOT' || this.adi()) {
    this.token('ID', in$(id, JS_KEYWORDS) ? (ref$ = Object(id), ref$.reserved = true, ref$) : id);
    if (regexMatch[2]) {
      this.token(':', ':');
    }
    return input.length;
  }
  switch (id) {
  case 'true':
  case 'false':
  case 'on':
  case 'off':
  case 'yes':
  case 'no':
  case 'null':
  case 'void':
  case 'arguments':
  case 'debugger':
    tag = 'LITERAL';
    break;
  case 'new':
  case 'do':
  case 'typeof':
  case 'delete':
    tag = 'UNARY';
    break;
  case 'yield':
    tag = 'YIELD';
    break;
  case 'return':
  case 'throw':
    tag = 'HURL';
    break;
  case 'break':
  case 'continue':
    tag = 'JUMP';
    break;
  case 'this':
  case 'eval':
  case 'super':
    return this.token('LITERAL', id, true).length;
  case 'for':
    id = [];
    this.fset('for', true);
    this.fset('to', false);
    break;
  case 'then':
    this.fset('for', false);
    this.fset('to', false);
    break;
  case 'catch':
  case 'function':
    id = '';
    break;
  case 'in':
  case 'of':
    if (this.fget('for')) {
      this.fset('for', false);
      if (id === 'in') {
        this.fset('by', true);
        id = '';
        if (last[0] === 'ID' && ((ref$ = (ref1$ = this.tokens)[ref1$.length - 2][0]) === ',' || ref$ === ']' || ref$ === '}')) {
          id = this.tokens.pop()[1];
          if ((ref$ = this.tokens)[ref$.length - 1][0] === ',') {
            this.tokens.pop();
          }
        }
      }
      break;
    }
    // fallthrough
  case 'instanceof':
    if (last[1] === '!') {
      id = this.tokens.pop()[1] + id;
    }
    tag = (ref$ = this.tokens)[ref$.length - 1][0] === '(' ? 'BIOPR' : 'RELATION';
    break;
  case 'not':
    if (last.alias && last[1] === '===') {
      return last[1] = '!==', 3;
    }
    tag = 'UNARY';
    id = '!';
    break;
  case 'and':
  case 'or':
  case 'xor':
  case 'is':
  case 'isnt':
    this.unline();
    tag = id === 'is' || id === 'isnt' ? 'COMPARE' : 'LOGIC';
    if (last[0] === '(') {
      tag = 'BIOP';
    }
    this.token(tag, (function(){
      switch (id) {
      case 'is':
        return '===';
      case 'isnt':
        return '!==';
      case 'or':
        return '||';
      case 'and':
        return '&&';
      case 'xor':
        return 'xor';
      }
    }()));
    this.last.alias = true;
    return id.length;
  case 'unless':
    tag = 'IF';
    break;
  case 'until':
    tag = 'WHILE';
    break;
  case 'import':
    if (last[0] === '(') {
      id = '<<<';
      tag = 'BIOP';
    } else {
      if (able(this.tokens)) {
        id = '<<<';
      } else {
        tag = 'DECL';
      }
    }
    break;
  case 'export':
  case 'const':
  case 'var':
    tag = 'DECL';
    break;
  case 'with':
    tag = (function(){
      switch (false) {
      case !able(this.tokens):
        return 'CLONEPORT';
      case last[0] !== '(':
        return 'BIOP';
      default:
        return 'WITH';
      }
    }.call(this));
    break;
  case 'when':
    this.fset('for', false);
    tag = 'CASE';
    // fallthrough
  case 'case':
    if (this.doCase()) {
      return input.length;
    }
    break;
  case 'match':
    tag = 'SWITCH';
    break;
  case 'loop':
    this.token('WHILE', id);
    this.token('LITERAL', 'true');
    return input.length;
  case 'let':
  case 'own':
    if (last[0] === 'FOR' && !in$(id, last[1])) {
      last[1].push(id);
      return 3;
    }
    // fallthrough
  default:
    if (in$(id, KEYWORDS_SHARED)) {
      break;
    }
    if (in$(id, KEYWORDS_UNUSED)) {
      this.carp("reserved word \"" + id + "\"");
    }
    if (!last[1] && ((ref$ = last[0]) === 'FUNCTION' || ref$ === 'GENERATOR' || ref$ === 'LABEL')) {
      last[1] = id;
      last.spaced = false;
      return input.length;
    }
    tag = 'ID';
    switch (id) {
    case 'otherwise':
      if ((ref$ = last[0]) === 'CASE' || ref$ === '|') {
        last[0] = 'DEFAULT';
        return id.length;
      }
      break;
    case 'all':
      if (that = last[1] === '<<<' && '<' || last[1] === 'import' && 'All') {
        last[1] += that;
        return 3;
      }
      break;
    case 'from':
      if (last[1] === 'yield') {
        last[1] += 'from';
        return 4;
      }
      this.forange() && (tag = 'FROM');
      break;
    case 'to':
    case 'til':
      this.forange() && this.tokens.push(['FROM', '', this.line], ['STRNUM', '0', this.line]);
      if (this.fget('from')) {
        this.fset('from', false);
        this.fset('by', true);
        tag = 'TO';
      } else if (!last.callable && last[0] === 'STRNUM' && (ref$ = this.tokens)[ref$.length - 2][0] === '[') {
        last[0] = 'RANGE';
        last.op = id;
        return id.length;
      } else if (in$(']', this.closes)) {
        this.token('TO', id);
        return id.length;
      }
      break;
    case 'by':
      if (last[0] === 'STRNUM' && (ref$ = this.tokens)[ref$.length - 2][0] === 'RANGE' && (ref$ = this.tokens)[ref$.length - 3][0] === '[') {
        tag = 'RANGE_BY';
      } else if (in$(']', this.closes)) {
        tag = 'BY';
      } else if (this.fget('by')) {
        tag = 'BY';
        this.fset('by', false);
      }
      break;
    case 'ever':
      if (last[0] === 'FOR') {
        this.fset('for', false);
        last[0] = 'WHILE';
        tag = 'LITERAL';
        id = 'true';
      }
    }
  }
  tag || (tag = regexMatch[1].toUpperCase());
  if ((tag === 'COMPARE' || tag === 'LOGIC' || tag === 'RELATION') && last[0] === '(') {
    tag = tag === 'RELATION' ? 'BIOPR' : 'BIOP';
  }
  if (tag === 'THEN' || tag === 'IF' || tag === 'WHILE') {
    this.fset('for', false);
    this.fset('by', false);
  }
  if (tag === 'RELATION' || tag === 'THEN' || tag === 'ELSE' || tag === 'CASE' || tag === 'DEFAULT' || tag === 'CATCH' || tag === 'FINALLY' || tag === 'IN' || tag === 'OF' || tag === 'FROM' || tag === 'TO' || tag === 'BY' || tag === 'EXTENDS' || tag === 'IMPLEMENTS' || tag === 'WHERE') {
    this.unline();
  }
  this.token(tag, id);
  return input.length;
};
exports.doNumber = function(code, lastIndex){
  var input, regexMatch, last, radix, num, rnum, bound, ref$;
  NUMBER.lastIndex = lastIndex;
  if (!(input = (regexMatch = NUMBER.exec(code))[0])) {
    return 0;
  }
  last = this.last;
  if (regexMatch[5] && (last[0] === 'DOT' || this.adi())) {
    this.token('STRNUM', regexMatch[4].replace(NUMBER_OMIT, ''));
    return regexMatch[4].length;
  }
  if (radix = regexMatch[1]) {
    num = parseInt(rnum = regexMatch[2].replace(NUMBER_OMIT, ''), radix);
    bound = false;
    if (radix > 36 || radix < 2) {
      if (/[0-9]/.exec(rnum)) {
        this.carp("invalid number base " + radix + " (with number " + rnum + "),base must be from 2 to 36");
      } else {
        bound = true;
      }
    }
    if (isNaN(num) || num === parseInt(rnum.slice(0, -1), radix)) {
      this.strnum(regexMatch[1]);
      this.token('DOT', '.~');
      this.token('ID', regexMatch[2]);
      return input.length;
    }
    num += '';
  } else {
    num = (regexMatch[3] || input).replace(NUMBER_OMIT, '');
    if (regexMatch[3] && num.charAt() === '0' && ((ref$ = num.charAt(1)) !== '' && ref$ !== '.')) {
      this.carp("deprecated octal literal " + regexMatch[4]);
    }
  }
  if (!last.spaced && last[0] === '+-') {
    last[0] = 'STRNUM';
    last[1] += num;
    return input.length;
  }
  this.strnum(num);
  return input.length;
};
exports.doString = function(code, index, q){
  var parts, str;
  if (q === code.charAt(index + 1)) {
    return q === code.charAt(index + 2)
      ? this.doHeredoc(code, index, q)
      : (this.strnum(q + q), 2);
  }
  if (q === '"') {
    parts = this.interpolate(code, index, q);
    this.addInterpolated(parts, unlines);
    return 1 + parts.size;
  }
  str = (SIMPLESTR.lastIndex = index, SIMPLESTR).exec(code)[0] || this.carp('unterminated string');
  this.strnum(unlines(this.string(q, str.slice(1, -1))));
  return this.countLines(str).length;
};
exports.doHeredoc = function(code, index, q){
  var end, raw, doc, parts, tabs, i$, len$, i, t;
  if (q === '\'') {
    ~(end = code.indexOf(q + q + q, index + 3)) || this.carp('unterminated heredoc');
    raw = code.slice(index + 3, end);
    doc = raw.replace(LASTDENT, '');
    this.strnum(enlines(this.string(q, lchomp(detab(doc, heretabs(doc))))));
    return this.countLines(raw).length + 6;
  }
  parts = this.interpolate(code, index, q + q + q);
  tabs = heretabs(code.slice(index + 3, index + parts.size).replace(LASTDENT, ''));
  for (i$ = 0, len$ = parts.length; i$ < len$; ++i$) {
    i = i$;
    t = parts[i$];
    if (t[0] === 'S') {
      if (i + 1 === parts.length) {
        t[1] = t[1].replace(LASTDENT, '');
      }
      t[1] = detab(t[1], tabs);
      if (i === 0) {
        t[1] = lchomp(t[1]);
      }
    }
  }
  this.addInterpolated(parts, enlines);
  return 3 + parts.size;
};
exports.doComment = function(code, index){
  var comment, end, ref$;
  comment = ~(end = code.indexOf('*/', index + 2))
    ? code.slice(index, end + 2)
    : code.slice(index) + '*/';
  if ((ref$ = this.last[0]) === 'NEWLINE' || ref$ === 'INDENT' || ref$ === 'THEN') {
    this.token('COMMENT', detab(comment, this.dent));
    this.token('NEWLINE', '\n');
  }
  return this.countLines(comment).length;
};
exports.doJS = function(code, lastIndex){
  var js, ref$;
  JSTOKEN.lastIndex = lastIndex;
  js = JSTOKEN.exec(code)[0] || this.carp('unterminated JS literal');
  this.token('LITERAL', (ref$ = Object(detab(js.slice(2, -2), this.dent)), ref$.js = true, ref$), true);
  return this.countLines(js).length;
};
exports.doRegex = function(code, index){
  var divisible, ref$, input, body, flag;
  if (divisible = able(this.tokens) || this.last[0] === 'CREMENT') {
    if (!this.last.spaced || ((ref$ = code.charAt(index + 1)) === ' ' || ref$ === '=')) {
      return 0;
    }
  }
  ref$ = (REGEX.lastIndex = index, REGEX).exec(code), input = ref$[0], body = ref$[1], flag = ref$[2];
  if (input) {
    this.regex(body, flag);
  } else if (!divisible && this.last[0] !== '(') {
    this.carp('unterminated regex');
  }
  return input.length;
};
exports.doHeregex = function(code, index){
  var tokens, last, parts, rest, flag, i$, i, t, dynaflag, len$, val, one;
  tokens = this.tokens, last = this.last;
  parts = this.interpolate(code, index, '//');
  rest = code.slice(index + 2 + parts.size);
  flag = this.validate(/^(?:[gimy]{1,4}|[?$]?)/.exec(rest)[0]);
  if (parts[1]) {
    if (flag === '$') {
      this.adi();
      this.token('(', '"');
    } else {
      tokens.push(['ID', 'RegExp', last[2]], ['CALL(', '', last[2]]);
      if (flag === '?') {
        for (i$ = parts.length - 1; i$ >= 0; --i$) {
          i = i$;
          t = parts[i$];
          if (t[0] === 'TOKENS') {
            dynaflag = parts.splice(i, 1)[0][1];
            break;
          }
        }
      }
    }
    for (i$ = 0, len$ = parts.length; i$ < len$; ++i$) {
      i = i$;
      t = parts[i$];
      if (t[0] === 'TOKENS') {
        tokens.push.apply(tokens, t[1]);
      } else {
        val = t[1].replace(HEREGEX_OMIT, '');
        if (one && !val) {
          continue;
        }
        one = tokens.push((t[0] = 'STRNUM', t[1] = this.string('\'', enslash(val)), t));
      }
      tokens.push(['+-', '+', tokens[tokens.length - 1][2]]);
    }
    --tokens.length;
    if (dynaflag || flag >= 'g') {
      this.token(',', ',');
      if (dynaflag) {
        tokens.push.apply(tokens, dynaflag);
      } else {
        this.token('STRNUM', "'" + flag + "'");
      }
    }
    this.token(flag === '$' ? ')' : ')CALL', '');
  } else {
    this.regex(reslash(parts[0][1].replace(HEREGEX_OMIT, '')), flag);
  }
  return 2 + parts.size + flag.length;
};
exports.doBackslash = function(code, lastIndex){
  var ref$, input, word;
  BSTOKEN.lastIndex = lastIndex;
  ref$ = BSTOKEN.exec(code), input = ref$[0], word = ref$[1];
  if (word) {
    this.strnum(this.string('\'', word));
  } else {
    this.countLines(input);
  }
  return input.length;
};
exports.doLine = function(code, index){
  var ref$, input, tabs, length, last, that, delta, tag, val;
  ref$ = (MULTIDENT.lastIndex = index, MULTIDENT).exec(code), input = ref$[0], tabs = ref$[1];
  length = this.countLines(input).length;
  last = this.last;
  last.eol = true;
  last.spaced = true;
  if (index + length >= code.length) {
    return length;
  }
  if (that = tabs && (this.emender || (this.emender = RegExp('[^' + tabs.charAt() + ']'))).exec(tabs)) {
    this.carp("contaminated indent " + escape(that));
  }
  if (0 > (delta = tabs.length - this.dent)) {
    this.dedent(-delta);
    this.newline();
  } else {
    tag = last[0], val = last[1];
    if (tag === 'ASSIGN' && ((ref$ = val + '') !== '=' && ref$ !== ':=' && ref$ !== '+=') || val === '++' && (ref$ = this.tokens)[ref$.length - 2].spaced || (tag === '+-' || tag === 'PIPE' || tag === 'BACKPIPE' || tag === 'DOT' || tag === 'LOGIC' || tag === 'MATH' || tag === 'COMPARE' || tag === 'RELATION' || tag === 'SHIFT' || tag === 'IN' || tag === 'OF' || tag === 'TO' || tag === 'BY' || tag === 'FROM' || tag === 'EXTENDS' || tag === 'IMPLEMENTS')) {
      return length;
    }
    if (delta) {
      this.indent(delta);
    } else {
      this.newline();
    }
  }
  this.fset('for', false);
  this.fset('by', false);
  return length;
};
exports.doSpace = function(code, lastIndex){
  var input;
  SPACE.lastIndex = lastIndex;
  if (input = SPACE.exec(code)[0]) {
    this.last.spaced = true;
  }
  return input.length;
};
exports.doCase = function(){
  var ref$, ref1$;
  this.seenFor = false;
  if (((ref$ = this.last[0]) === 'ASSIGN' || ref$ === '->' || ref$ === ':') || (this.last[0] === 'INDENT' && ((ref$ = (ref1$ = this.tokens)[ref1$.length - 2][0]) === 'ASSIGN' || ref$ === '->' || ref$ === ':'))) {
    this.token('SWITCH', 'switch');
    this.line++;
    return this.token('CASE', 'case');
  }
};
exports.doLiteral = function(code, index){
  var sym, tag, val, ref$, that;
  if (!(sym = (SYMBOL.lastIndex = index, SYMBOL).exec(code)[0])) {
    return 0;
  }
  switch (tag = val = sym) {
  case '|':
    tag = 'CASE';
    if (this.doCase()) {
      return sym.length;
    }
    break;
  case '|>':
    tag = 'PIPE';
    break;
  case '`':
    tag = 'BACKTICK';
    break;
  case '<<':
  case '>>':
    tag = 'COMPOSE';
    break;
  case '<|':
    tag = 'BACKPIPE';
    break;
  case '+':
  case '-':
    tag = '+-';
    break;
  case '&&':
  case '||':
    tag = 'LOGIC';
    break;
  case '.&.':
  case '.|.':
  case '.^.':
    tag = 'BITWISE';
    break;
  case '^^':
    tag = 'CLONE';
    break;
  case '**':
  case '^':
    tag = 'POWER';
    break;
  case '?':
    if (this.last[0] === '(') {
      this.token('PARAM(', '(');
      this.token(')PARAM', ')');
      this.token('->', '->');
      this.token('ID', 'it');
    } else {
      if (this.last.spaced) {
        tag = 'LOGIC';
      }
    }
    break;
  case '/':
  case '%':
  case '%%':
    tag = 'MATH';
    break;
  case '++':
  case '--':
    tag = 'CREMENT';
    break;
  case '<<<':
  case '<<<<':
    tag = 'IMPORT';
    break;
  case ';':
    tag = 'NEWLINE';
    this.fset('by', false);
    break;
  case '..':
    this.token('LITERAL', '..', true);
    return 2;
  case '.':
    if (this.last[1] === '?') {
      this.last[0] = '?';
    }
    tag = 'DOT';
    break;
  case ',':
    switch (this.last[0]) {
    case ',':
    case '[':
    case '(':
    case 'CALL(':
      this.token('LITERAL', 'void');
      break;
    case 'FOR':
    case 'OWN':
      this.token('ID', '');
    }
    break;
  case '!=':
  case '~=':
    if (!(able(this.tokens) || ((ref$ = this.last[0]) === '(' || ref$ === 'CREMENT'))) {
      this.tokens.push(val === '!='
        ? ['UNARY', '!', this.line]
        : ['UNARY', '~', this.line], ['ASSIGN', '=', this.line]);
      return 2;
    }
    // fallthrough
  case '!~=':
  case '==':
    val = (function(){
      switch (val) {
      case '~=':
        return '==';
      case '!~=':
        return '!=';
      case '==':
        return '===';
      case '!=':
        return '!==';
      }
    }());
    tag = 'COMPARE';
    break;
  case '===':
  case '!==':
    val += '=';
    // fallthrough
  case '<':
  case '>':
  case '<=':
  case '>=':
  case '<==':
  case '>==':
  case '>>=':
  case '<<=':
    tag = 'COMPARE';
    break;
  case '.<<.':
  case '.>>.':
  case '.>>>.':
  case '<?':
  case '>?':
    tag = 'SHIFT';
    break;
  case '(':
    if (!(((ref$ = this.last[0]) === 'FUNCTION' || ref$ === 'GENERATOR' || ref$ === 'LET') || this.able(true) || this.last[1] === '.@')) {
      this.token('(', '(');
      this.closes.push(')');
      this.parens.push(this.last);
      return 1;
    }
    tag = 'CALL(';
    this.closes.push(')CALL');
    break;
  case '[':
  case '{':
    this.adi();
    this.closes.push(']}'.charAt(val === '{'));
    break;
  case '}':
    if (this.inter && val !== (ref$ = this.closes)[ref$.length - 1]) {
      this.rest = code.slice(index + 1);
      return 9e9;
    }
    // fallthrough
  case ']':
  case ')':
    if (tag === ')' && ((ref$ = this.last[0]) === '+-' || ref$ === 'COMPARE' || ref$ === 'LOGIC' || ref$ === 'MATH' || ref$ === 'POWER' || ref$ === 'SHIFT' || ref$ === 'BITWISE' || ref$ === 'CONCAT' || ref$ === 'COMPOSE' || ref$ === 'RELATION' || ref$ === 'PIPE' || ref$ === 'BACKPIPE' || ref$ === 'IMPORT' || ref$ === 'CLONEPORT' || ref$ === 'ASSIGN')) {
      (ref$ = this.tokens)[ref$.length - 1][0] = (function(){
        switch (this.last[0]) {
        case 'RELATION':
          return 'BIOPR';
        case 'PIPE':
          this.parameters(false, -1);
          return 'BIOPP';
        default:
          return 'BIOP';
        }
      }.call(this));
    }
    if (')' === (tag = val = this.pair(val))) {
      this.lpar = this.parens.pop();
    }
    break;
  case '=':
  case ':':
    if (val === ':') {
      switch (this.last[0]) {
      case 'ID':
      case 'STRNUM':
      case ')':
        break;
      case '...':
        this.last[0] = 'STRNUM';
        break;
      default:
        tag = 'LABEL';
        val = '';
      }
      this.token(tag, val);
      return sym.length;
    }
    // fallthrough
  case ':=':
  case '+=':
  case '-=':
  case '*=':
  case '/=':
  case '%=':
  case '%%=':
  case '<?=':
  case '>?=':
  case '**=':
  case '^=':
  case '.&.=':
  case '.|.=':
  case '.^.=':
  case '.<<.=':
  case '.>>.=':
  case '.>>>.=':
  case '++=':
  case '|>=':
    if (this.last[1] === '.' || this.last[0] === '?' && this.adi()) {
      this.last[1] += val;
      return val.length;
    }
    if (this.last[0] === 'LOGIC') {
      (val = Object(val)).logic = this.tokens.pop()[1];
    } else if ((val === '+=' || val === '-=') && !able(this.tokens) && ((ref$ = this.last[0]) !== '+-' && ref$ !== 'UNARY' && ref$ !== 'LABEL')) {
      this.token('UNARY', val.charAt());
      val = '=';
    }
    tag = 'ASSIGN';
    break;
  case '::=':
    this.token('DOT', '.');
    this.token('ID', 'prototype');
    this.token('IMPORT', '<<');
    return sym.length;
  case '*':
    if (this.last[0] === 'FUNCTION') {
      this.last[0] = 'GENERATOR';
      return sym.length;
    }
    if (that = ((ref$ = this.last[0]) === 'NEWLINE' || ref$ === 'INDENT' || ref$ === 'THEN' || ref$ === '=>') && (INLINEDENT.lastIndex = index + 1, INLINEDENT).exec(code)[0].length) {
      this.tokens.push(['LITERAL', 'void', this.line], ['ASSIGN', '=', this.line]);
      this.indent(index + that - 1 - this.dent - code.lastIndexOf('\n', index - 1));
      return that;
    }
    tag = able(this.tokens) || this.last[0] === 'CREMENT' && able(this.tokens, this.tokens.length - 1) || this.last[0] === '(' ? 'MATH' : 'STRNUM';
    break;
  case '@':
    this.adi();
    if (this.last[0] === 'DOT' && this.last[1] === '.' && (ref$ = this.tokens)[ref$.length - 2][0] === 'ID' && (ref$ = this.tokens)[ref$.length - 2][1] === 'constructor') {
      this.tokens.pop();
      this.tokens.pop();
      this.token('LITERAL', 'this', true);
      this.adi();
      this.token('ID', 'constructor', true);
    } else {
      this.token('LITERAL', 'this', true);
    }
    return 1;
  case '@@':
    this.adi();
    this.token('ID', 'constructor', true);
    return 2;
  case '&':
    this.token('LITERAL', 'arguments');
    return 1;
  case '!':
    switch (false) {
    default:
      if (!this.last.spaced) {
        if (this.last[1] === 'require') {
          this.last[0] = 'REQUIRE';
          this.last[1] = 'require!';
        } else if (able(this.tokens, null, true)) {
          this.token('CALL(', '!');
          this.token(')CALL', ')');
        } else if (this.last[1] === 'typeof') {
          this.last[1] = 'classof';
        } else if (this.last[1] === 'delete') {
          this.last[1] = 'jsdelete';
        } else {
          break;
        }
        return 1;
      }
    }
    tag = 'UNARY';
    break;
  case '&':
    if (!able(this.tokens)) {
      tag = 'LITERAL';
    }
    break;
  case '|':
    tag = 'BITWISE';
    break;
  case '~':
    if (this.dotcat(val)) {
      return 1;
    }
    tag = 'UNARY';
    break;
  case '::':
    this.adi();
    val = 'prototype';
    tag = 'ID';
    break;
  case '=>':
    this.unline();
    this.fset('for', false);
    tag = 'THEN';
    break;
  default:
    if (/^!?(?:--?|~~?)>\*?$/.test(val)) {
      this.parameters(tag = '->');
    } else if (/^<(?:--?|~~?)$/.test(val)) {
      this.parameters(tag = '<-');
    } else {
      switch (val.charAt(0)) {
      case '(':
        this.token('CALL(', '(');
        tag = ')CALL';
        val = ')';
        break;
      case '<':
        if (val.length < 4) {
          this.carp('unterminated words');
        }
        this.token('WORDS', val.slice(2, -2), this.adi());
        return this.countLines(val).length;
      }
    }
  }
  if ((tag === '+-' || tag === 'COMPARE' || tag === 'LOGIC' || tag === 'MATH' || tag === 'POWER' || tag === 'SHIFT' || tag === 'BITWISE' || tag === 'CONCAT' || tag === 'COMPOSE' || tag === 'RELATION' || tag === 'PIPE' || tag === 'BACKPIPE' || tag === 'IMPORT') && this.last[0] === '(') {
    tag = tag === 'BACKPIPE' ? 'BIOPBP' : 'BIOP';
  }
  if (tag === ',' || tag === 'CASE' || tag === 'PIPE' || tag === 'BACKPIPE' || tag === 'DOT' || tag === 'LOGIC' || tag === 'COMPARE' || tag === 'MATH' || tag === 'POWER' || tag === 'IMPORT' || tag === 'SHIFT' || tag === 'BITWISE') {
    this.unline();
  }
  this.token(tag, val);
  return sym.length;
};
exports.token = function(tag, value, callable){
  this.tokens.push(this.last = [tag, value, this.line]);
  if (callable) {
    this.last.callable = true;
  }
  return value;
};
exports.indent = function(delta){
  this.dent += delta;
  this.dents.push(this.token('INDENT', delta));
  this.closes.push('DEDENT');
};
exports.dedent = function(debt){
  var dent;
  this.dent -= debt;
  while (debt > 0 && (dent = this.dents.pop())) {
    if (debt < dent && !this.inter) {
      this.carp("unmatched dedent (" + debt + " for " + dent + ")");
    }
    this.pair('DEDENT');
    debt -= typeof dent === 'number' ? this.token('DEDENT', dent) : dent;
  }
};
exports.newline = function(){
  var ref$;
  this.last[1] === '\n' || this.tokens.push(this.last = (ref$ = ['NEWLINE', '\n', this.line], ref$.spaced = true, ref$));
};
exports.unline = function(){
  var ref$;
  if (!this.tokens[1]) {
    return;
  }
  switch (this.last[0]) {
  case 'INDENT':
    (ref$ = this.dents)[ref$.length - 1] += '';
    // fallthrough
  case 'NEWLINE':
    this.tokens.length--;
  }
};
exports.parameters = function(arrow, offset){
  var i$, ref$, i, t, ref1$;
  if (this.last[0] === ')' && ')' === this.last[1]) {
    this.lpar[0] = 'PARAM(';
    this.last[0] = ')PARAM';
    return;
  }
  if (arrow === '->') {
    this.token('PARAM(', '');
  } else {
    for (i$ = (ref$ = this.tokens).length - 1; i$ >= 0; --i$) {
      i = i$;
      t = ref$[i$];
      if ((ref1$ = t[0]) === 'NEWLINE' || ref1$ === 'INDENT' || ref1$ === 'THEN' || ref1$ === '=>' || ref1$ === '(') {
        break;
      }
    }
    this.tokens.splice(i + 1, 0, ['PARAM(', '', t[2]]);
  }
  if (offset) {
    this.tokens.splice(this.tokens.length + offset, 0, [')PARAM', '', t[2]]);
  } else {
    this.token(')PARAM', '');
  }
};
exports.interpolate = function(str, idx, end){
  var parts, end0, pos, i, ch, c1, id, stringified, length, tag, e, delta, nested, clone, ref$;
  parts = [];
  end0 = end.charAt(0);
  pos = 0;
  i = -1;
  str = str.slice(idx + end.length);
  while (ch = str.charAt(++i)) {
    switch (ch) {
    case end0:
      if (end !== str.slice(i, i + end.length)) {
        continue;
      }
      parts.push(['S', this.countLines(str.slice(0, i)), this.line]);
      return parts.size = pos + i + end.length, parts;
    case '#':
      c1 = str.charAt(i + 1);
      id = in$(c1, ['@']) && c1 || (ID.lastIndex = i + 1, ID).exec(str)[1];
      if (!(id || c1 === '{')) {
        continue;
      }
      break;
    case '\\':
      ++i;
      // fallthrough
    default:
      continue;
    }
    if (i || nested && !stringified) {
      stringified = parts.push(['S', this.countLines(str.slice(0, i)), this.line]);
    }
    if (id) {
      length = id.length;
      if (id === '@') {
        id = 'this';
      }
      if (in$(id, ['this'])) {
        tag = 'LITERAL';
      } else {
        id = camelize(id);
        try {
          Function("'use strict'; var " + id);
        } catch (e$) {
          e = e$;
          this.carp("invalid variable interpolation \"" + id + "\"");
        }
        tag = 'ID';
      }
      str = str.slice(delta = i + 1 + length);
      parts.push(['TOKENS', nested = [[tag, id, this.line]]]);
    } else {
      clone = (ref$ = clone$(exports), ref$.inter = true, ref$.emender = this.emender, ref$);
      nested = clone.tokenize(str.slice(i + 2), {
        line: this.line,
        raw: true
      });
      delta = str.length - clone.rest.length;
      str = clone.rest, this.line = clone.line;
      while (((ref$ = nested[0]) != null ? ref$[0] : void 8) === 'NEWLINE') {
        nested.shift();
      }
      if (nested.length) {
        nested.unshift(['(', '(', nested[0][2]]);
        nested.push([')', ')', this.line]);
        parts.push(['TOKENS', nested]);
      }
    }
    pos += delta;
    i = -1;
  }
  this.carp("missing `" + end + "`");
};
exports.addInterpolated = function(parts, nlines){
  var tokens, last, ref$, left, right, joint, callable, i$, len$, i, t;
  if (!parts[1]) {
    return this.strnum(nlines(this.string('"', parts[0][1])));
  }
  tokens = this.tokens, last = this.last;
  ref$ = !last.spaced && last[1] === '%'
    ? (--tokens.length, this.last = last = tokens[tokens.length - 1], ['[', ']', [',', ',']])
    : ['(', ')', ['+-', '+']], left = ref$[0], right = ref$[1], joint = ref$[2];
  callable = this.adi();
  tokens.push([left, '"', last[2]]);
  for (i$ = 0, len$ = parts.length; i$ < len$; ++i$) {
    i = i$;
    t = parts[i$];
    if (t[0] === 'TOKENS') {
      tokens.push.apply(tokens, t[1]);
    } else {
      if (i > 1 && !t[1]) {
        continue;
      }
      tokens.push(['STRNUM', nlines(this.string('"', t[1])), t[2]]);
    }
    tokens.push(joint.concat(tokens[tokens.length - 1][2]));
  }
  --tokens.length;
  this.token(right, '', callable);
};
exports.strnum = function(it){
  this.token('STRNUM', it, this.adi() || this.last[0] === 'DOT');
};
exports.regex = function(body, flag){
  var e;
  try {
    RegExp(body);
  } catch (e$) {
    e = e$;
    this.carp(e.message);
  }
  if (flag === '$') {
    return this.strnum(this.string('\'', enslash(body)));
  }
  return this.token('LITERAL', "/" + (body || '(?:)') + "/" + this.validate(flag));
};
exports.adi = function(){
  if (this.last.spaced) {
    return;
  }
  if (!able(this.tokens)) {
    return;
  }
  return this.token('DOT', '.');
};
exports.dotcat = function(it){
  if (this.last[1] === '.' || this.adi()) {
    return this.last[1] += it;
  }
};
exports.pair = function(it){
  var wanted, ref$;
  if (!(it === (wanted = (ref$ = this.closes)[ref$.length - 1]) || ')CALL' === wanted && it === ')')) {
    if ('DEDENT' !== wanted) {
      this.carp("unmatched `" + it + "`");
    }
    this.dedent((ref$ = this.dents)[ref$.length - 1]);
    return this.pair(it);
  }
  this.unline();
  return this.closes.pop();
};
exports.able = function(call){
  return !this.last.spaced && able(this.tokens, null, call);
};
exports.countLines = function(it){
  var pos;
  while (pos = 1 + it.indexOf('\n', pos)) {
    ++this.line;
  }
  return it;
};
exports.forange = function(){
  var ref$, ref1$, ref2$;
  if (((ref$ = (ref1$ = this.tokens)[ref1$.length - 2 - ((ref2$ = this.last[0]) === 'NEWLINE' || ref2$ === 'INDENT')]) != null ? ref$[0] : void 8) === 'FOR' || this.last[0] === 'FOR') {
    this.fset('for', false);
    this.fset('from', true);
    return true;
  } else {
    return false;
  }
};
exports.validate = function(flag){
  var that;
  if (that = flag && /(.).*\1/.exec(flag)) {
    this.carp("duplicate regex flag `" + that[1] + "`");
  }
  return flag;
};
exports.fget = function(key){
  var ref$;
  return (ref$ = this.flags[this.closes.length]) != null ? ref$[key] : void 8;
};
exports.fset = function(key, val){
  var ref$, key$;
  ((ref$ = this.flags)[key$ = this.closes.length] || (ref$[key$] = {}))[key] = val;
};
exports.carp = function(it){
  carp(it, this.line);
};
exports.string = function(q, body){
  return string(q, body, this.line);
};
function carp(msg, lno){
  throw SyntaxError(msg + " on line " + (-~lno));
}
function able(tokens, i, call){
  var token, tag;
  i == null && (i = tokens.length);
  tag = (token = tokens[i - 1])[0];
  return (tag === 'ID' || tag === ']' || tag === '?') || (call
    ? token.callable || (tag === ')' || tag === ')CALL' || tag === 'BIOPBP') && token[1]
    : tag === '}' || tag === ')' || tag === ')CALL' || tag === 'STRNUM' || tag === 'LITERAL' || tag === 'WORDS');
}
string = (function(re){
  return function(q, body, lno){
    body = body.replace(re, function(it, oct, xu, rest){
      if (it === q || it === '\\') {
        return '\\' + it;
      }
      if (oct) {
        return '\\x' + (0x100 + parseInt(oct, 8)).toString(16).slice(1);
      }
      if (xu) {
        carp('malformed character escape sequence', lno);
      }
      if (!rest || q === rest) {
        return it;
      } else {
        return rest;
      }
    });
    return q + body + q;
  };
}.call(this, /['"]|\\(?:([0-3]?[0-7]{2}|[1-7]|0(?=[89]))|x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|([xu])|[\\0bfnrtv]|[^\n\S]|([\w\W]))?/g));
function heretabs(doc){
  var dent, that, ref$;
  dent = 0 / 0;
  while (that = TABS.exec(doc)) {
    dent <= (ref$ = that[0].length - 1) || (dent = ref$);
  }
  return dent;
}
TABS = /\n(?!$)[^\n\S]*/mg;
function detab(str, len){
  if (len) {
    return str.replace(detab[len] || (detab[len] = RegExp('\\n[^\\n\\S]{1,' + len + '}', 'g')), '\n');
  } else {
    return str;
  }
}
unlines = function(it){
  return it.replace(/\n[^\n\S]*/g, '');
};
enlines = function(it){
  return it.replace(/\n/g, '\\n');
};
enslash = function(it){
  return it.replace(/\\/g, '\\\\');
};
reslash = function(it){
  return it.replace(/(\\.)|\//g, function(){
    return arguments[1] || '\\/';
  });
};
camelize = function(it){
  return it.replace(/-[a-z]/ig, function(it){
    return it.charAt(1).toUpperCase();
  });
};
function lchomp(it){
  return it.slice(1 + it.lastIndexOf('\n', 0));
}
function decode(val, lno){
  if (!isNaN(val)) {
    return [+val];
  }
  val = val.length > 8
    ? 'ng'
    : Function('return ' + val)();
  val.length === 1 || carp('bad string in range', lno);
  return [val.charCodeAt(), true];
}
function uxxxx(it){
  return '"\\u' + ('000' + it.toString(16)).slice(-4) + '"';
}
character = typeof JSON == 'undefined' || JSON === null
  ? uxxxx
  : function(it){
    switch (it) {
    case 0x2028:
    case 0x2029:
      return uxxxx(it);
    default:
      return JSON.stringify(String.fromCharCode(it));
    }
  };
function firstPass(tokens){
  var prev, i, token, tag, val, line, next, ts, parens, i$, j;
  prev = ['NEWLINE', '\n', 0];
  i = 0;
  while (token = tokens[++i]) {
    tag = token[0], val = token[1], line = token[2];
    switch (false) {
    case !(tag === 'ASSIGN' && in$(prev[1], LS_KEYWORDS) && tokens[i - 2][0] !== 'DOT'):
      carp("cannot assign to reserved word \"" + prev[1] + "\"", line);
      break;
    case !(tag === 'DOT' && prev[0] === ']' && tokens[i - 2][0] === '[' && tokens[i - 3][0] === 'DOT'):
      tokens.splice(i - 2, 3);
      tokens[i - 3][1] = '[]';
      break;
    case !(tag === 'DOT' && prev[0] === '}' && tokens[i - 2][0] === '{' && tokens[i - 3][0] === 'DOT'):
      tokens.splice(i - 2, 3);
      tokens[i - 3][1] = '{}';
      break;
    case !(val === '.' && token.spaced && prev.spaced):
      tokens[i] = ['COMPOSE', '<<', line];
      break;
    case val !== '++':
      if (!(next = tokens[i + 1])) {
        break;
      }
      ts = ['ID', 'LITERAL', 'STRNUM'];
      if (prev.spaced && token.spaced || !(prev.spaced || token.spaced) && in$(prev[0], ts) && in$(next[0], ts)) {
        tokens[i][0] = 'CONCAT';
      }
      if (prev[0] === '(' && next[0] === ')' || prev[0] === '(' && token.spaced || next[0] === ')' && prev.spaced) {
        tokens[i][0] = 'BIOP';
      }
      break;
    case tag !== 'DOT':
      next = tokens[i + 1];
      if (prev[0] === '(' && next[0] === ')') {
        tokens[i][0] = 'BIOP';
      } else if (prev[0] === '(') {
        tokens.splice(i, 0, ['PARAM(', '(', line], [')PARAM', ')', line], ['->', '->', line], ['ID', 'it', line]);
      } else if (next[0] === ')') {
        tokens.splice(i + 1, 0, ['[', '[', line], ['ID', 'it', line], [']', ']', line]);
        parens = 1;
        LOOP: for (i$ = i + 1; i$ >= 0; --i$) {
          j = i$;
          switch (tokens[j][0]) {
          case ')':
            ++parens;
            break;
          case '(':
            if (--parens === 0) {
              tokens.splice(j + 1, 0, ['PARAM(', '(', line], ['ID', 'it', line], [')PARAM', ')', line], ['->', '->', line]);
              break LOOP;
            }
          }
        }
      }
    }
    prev = token;
    continue;
  }
}
function rewriteBlockless(tokens){
  var i$, len$, i, token, tag;
  for (i$ = 0, len$ = tokens.length; i$ < len$; ++i$) {
    i = i$;
    token = tokens[i$], tag = token[0];
    if (tag === 'IF' || tag === 'CLASS' || tag === 'CATCH') {
      detectEnd(tokens, i + 1, ok, go);
    }
  }
  function ok(it){
    var ref$;
    return (ref$ = it[0]) === 'NEWLINE' || ref$ === 'INDENT';
  }
  function go(it, i){
    var lno;
    if (tag === 'IF') {
      if (it[0] !== 'INDENT' || !it[1] && !it.then || in$(tokens[i - 1][0], BLOCK_USERS)) {
        token[0] = 'POST_IF';
      }
    } else if (it[0] !== 'INDENT') {
      tokens.splice(i, 0, ['INDENT', 0, lno = tokens[i - 1][2]], ['DEDENT', 0, lno]);
    }
  }
}
function addImplicitIndentation(tokens){
  var i, token, tag, next, indent, dedent, ref$, ref1$, idx;
  i = 0;
  while (token = tokens[++i]) {
    tag = token[0];
    if (tag !== '->' && tag !== 'THEN' && tag !== 'ELSE' && tag !== 'DEFAULT' && tag !== 'TRY' && tag !== 'FINALLY' && tag !== 'DECL') {
      continue;
    }
    switch (next = tokens[i + 1][0]) {
    case 'IF':
      if (tag === 'ELSE') {
        continue;
      }
      break;
    case 'INDENT':
    case 'THEN':
      if (tag === 'THEN') {
        tokens.splice(i--, 1);
      }
      continue;
    }
    indent = ['INDENT', 0, token[2]];
    dedent = ['DEDENT', 0];
    if (tag === 'THEN') {
      (tokens[i] = indent).then = true;
    } else {
      tokens.splice(++i, 0, indent);
    }
    switch (false) {
    case tag !== 'DECL':
      break;
    case next !== 'DOT' && next !== '?' && next !== ',' && next !== 'PIPE' && next !== 'BACKPIPE':
      --i;
      // fallthrough
    case !((next === 'ID' || next === 'STRNUM' || next === 'LITERAL') && ',' === ((ref$ = tokens[i + 2]) != null ? ref$[0] : void 8)):
      go(0, i += 2);
      ++i;
      continue;
    case !((next === '(' || next === '[' || next === '{') && ',' === ((ref1$ = tokens[idx = 1 + indexOfPair(tokens, i + 1)]) != null ? ref1$[0] : void 8)):
      go(0, idx);
      ++i;
      continue;
    }
    detectEnd(tokens, i + 1, ok, go);
  }
  function ok(token, i){
    var t0, t;
    t0 = token[0];
    t = tag;
    if (tag === t0 || tag === 'THEN' && t0 === 'SWITCH') {
      tag = '';
    }
    switch (t0) {
    case 'NEWLINE':
      return token[1] !== ';';
    case 'DOT':
    case '?':
    case ',':
    case 'PIPE':
    case 'BACKPIPE':
      return tokens[i - 1].eol;
    case 'ELSE':
      return t === 'THEN';
    case 'CATCH':
      return t === 'TRY';
    case 'FINALLY':
      return t === 'TRY' || t === 'CATCH' || t === 'THEN';
    case 'CASE':
    case 'DEFAULT':
      return t === 'CASE' || t === 'THEN';
    }
  }
  function go(arg$, i){
    var prev;
    prev = tokens[i - 1];
    tokens.splice(prev[0] === ',' ? i - 1 : i, 0, (dedent[2] = prev[2], dedent));
  }
}
function addImplicitParentheses(tokens){
  var i, brackets, token, endi, ref$, tpair, tag, prev, ref1$, skipBlock, seenSwitch;
  i = 0;
  brackets = [];
  while (token = tokens[++i]) {
    if (token[1] === 'do' && tokens[i + 1][0] === 'INDENT') {
      endi = indexOfPair(tokens, i + 1);
      if (tokens[endi + 1][0] === 'NEWLINE' && ((ref$ = tokens[endi + 2]) != null ? ref$[0] : void 8) === 'WHILE') {
        token[0] = 'DO';
        tokens[endi + 2].done = true;
        tokens.splice(endi + 1, 1);
      } else {
        (token = tokens[1 + i])[0] = '(';
        (tpair = tokens[endi])[0] = ')';
        token.doblock = true;
        tokens.splice(i, 1);
      }
    }
    tag = token[0];
    prev = tokens[i - 1];
    tag === '[' && brackets.push(prev[0] === 'DOT');
    if (prev[0] === ']') {
      if (brackets.pop()) {
        prev.index = true;
      } else {
        continue;
      }
    }
    if (!(((ref1$ = prev[0]) === 'FUNCTION' || ref1$ === 'GENERATOR' || ref1$ === 'LET' || ref1$ === 'WHERE') || prev.spaced && able(tokens, i, true))) {
      continue;
    }
    if (token.doblock) {
      token[0] = 'CALL(';
      tpair[0] = ')CALL';
      continue;
    }
    if (!exp(token)) {
      continue;
    }
    if (tag === 'CREMENT') {
      if (token.spaced || !in$((ref1$ = tokens[i + 1]) != null ? ref1$[0] : void 8, CHAIN)) {
        continue;
      }
    }
    skipBlock = seenSwitch = false;
    tokens.splice(i++, 0, ['CALL(', '', token[2]]);
    detectEnd(tokens, i, ok, go);
  }
  function exp(token){
    var tag;
    tag = token[0];
    return in$(tag, ARG) || !token.spaced && (tag === '+-' || tag === 'CLONE');
  }
  function ok(token, i){
    var tag, ref$, pre;
    tag = token[0];
    if (tag === 'POST_IF' || tag === 'PIPE' || tag === 'BACKPIPE') {
      return true;
    }
    if (!skipBlock) {
      if (token.alias && ((ref$ = token[1]) === '&&' || ref$ === '||' || ref$ === 'xor') || (tag === 'TO' || tag === 'BY' || tag === 'IMPLEMENTS')) {
        return true;
      }
    }
    pre = tokens[i - 1];
    switch (tag) {
    case 'NEWLINE':
      return pre[0] !== ',';
    case 'DOT':
    case '?':
      return !skipBlock && (pre.spaced || pre[0] === 'DEDENT');
    case 'SWITCH':
      seenSwitch = true;
      // fallthrough
    case 'IF':
    case 'CLASS':
    case 'FUNCTION':
    case 'GENERATOR':
    case 'LET':
    case 'WITH':
    case 'CATCH':
      skipBlock = true;
      break;
    case 'CASE':
      if (seenSwitch) {
        skipBlock = true;
      } else {
        return true;
      }
      break;
    case 'INDENT':
      if (skipBlock) {
        return skipBlock = false;
      }
      return !in$(pre[0], BLOCK_USERS);
    case 'WHILE':
      if (token.done) {
        return false;
      }
      // fallthrough
    case 'FOR':
      skipBlock = true;
      return able(tokens, i) || pre[0] === 'CREMENT' || pre[0] === '...' && pre.spaced;
    }
    return false;
  }
  function go(token, i){
    tokens.splice(i, 0, [')CALL', '', tokens[i - 1][2]]);
  }
}
function addImplicitBraces(tokens){
  var stack, i, token, tag, start, paren, index, pre, ref$, inline, ref1$;
  stack = [];
  i = 0;
  while (token = tokens[++i]) {
    if (':' !== (tag = token[0])) {
      switch (false) {
      case !in$(tag, CLOSERS):
        start = stack.pop();
        break;
      case !in$(tag, OPENERS):
        if (tag === 'INDENT' && tokens[i - 1][0] === '{') {
          tag = '{';
        }
        stack.push([tag, i]);
      }
      continue;
    }
    paren = tokens[i - 1][0] === ')';
    index = paren
      ? start[1]
      : i - 1;
    pre = tokens[index - 1];
    if (!(((ref$ = pre[0]) === ':' || ref$ === 'ASSIGN' || ref$ === 'IMPORT') || ((ref$ = stack[stack.length - 1]) != null ? ref$[0] : void 8) !== '{')) {
      continue;
    }
    stack.push(['{']);
    inline = !pre.doblock && ((ref1$ = pre[0]) !== 'NEWLINE' && ref1$ !== 'INDENT');
    while (((ref1$ = tokens[index - 2]) != null ? ref1$[0] : void 8) === 'COMMENT') {
      index -= 2;
    }
    tokens.splice(index, 0, ['{', '{', tokens[index][2]]);
    detectEnd(tokens, ++i + 1, ok, go);
  }
  function ok(token, i){
    var tag, t1, ref$, ref1$;
    switch (tag = token[0]) {
    case ',':
      break;
    case 'NEWLINE':
      if (inline) {
        return true;
      }
      break;
    case 'DEDENT':
      return true;
    case 'POST_IF':
    case 'FOR':
    case 'WHILE':
      return inline;
    default:
      return false;
    }
    t1 = (ref$ = tokens[i + 1]) != null ? ref$[0] : void 8;
    return t1 !== (tag === ',' ? 'NEWLINE' : 'COMMENT') && ':' !== ((ref1$ = tokens[t1 === '('
      ? 1 + indexOfPair(tokens, i + 1)
      : i + 2]) != null ? ref1$[0] : void 8);
  }
  function go(token, i){
    tokens.splice(i, 0, ['}', '', token[2]]);
  }
}
function expandLiterals(tokens){
  var i, fromNum, token, sig, ref$, ref1$, lno, ref2$, ref3$, ref4$, char, toNum, tochar, byNum, byp, ref5$, ts, enc, add, i$, n, ref6$, ref7$, len$, word, that;
  i = 0;
  while (token = tokens[++i]) {
    switch (token[0]) {
    case 'STRNUM':
      if (~'-+'.indexOf(sig = token[1].charAt(0))) {
        token[1] = token[1].slice(1);
        tokens.splice(i++, 0, ['+-', sig, token[2]]);
      }
      if (token.callable) {
        continue;
      }
      break;
    case 'TO':
    case 'TIL':
      if (!(tokens[i - 1][0] === '[' && ((tokens[i + 2][0] === ']' && (((ref$ = tokens[i + 1][1].charAt(0)) === '\'' || ref$ === '"') || +tokens[i + 1][1] >= 0)) || (tokens[i + 2][0] === 'BY' && ((ref$ = tokens[i + 3]) != null ? ref$[0] : void 8) === 'STRNUM' && ((ref1$ = tokens[i + 4]) != null ? ref1$[0] : void 8) === ']')))) {
        continue;
      }
      if (tokens[i + 2][0] === 'BY') {
        tokens[i + 2][0] = 'RANGE_BY';
      }
      token.op = token[1];
      fromNum = 0;
      // fallthrough
    case 'RANGE':
      lno = token[2];
      if (fromNum != null || (tokens[i - 1][0] === '[' && tokens[i + 1][0] === 'STRNUM' && ((tokens[i + 2][0] === ']' && (((ref2$ = tokens[i + 1][1].charAt(0)) === '\'' || ref2$ === '"') || +tokens[i + 1][1] >= 0)) || (tokens[i + 2][0] === 'RANGE_BY' && ((ref2$ = tokens[i + 3]) != null ? ref2$[0] : void 8) === 'STRNUM' && ((ref3$ = tokens[i + 4]) != null ? ref3$[0] : void 8) === ']')))) {
        if (fromNum == null) {
          ref4$ = decode(token[1], lno), fromNum = ref4$[0], char = ref4$[1];
        }
        ref4$ = decode(tokens[i + 1][1], lno), toNum = ref4$[0], tochar = ref4$[1];
        if (toNum == null || char ^ tochar) {
          carp('bad "to" in range', lno);
        }
        byNum = 1;
        if (byp = ((ref4$ = tokens[i + 2]) != null ? ref4$[0] : void 8) === 'RANGE_BY') {
          if (!(byNum = +((ref5$ = tokens[i + 3]) != null ? ref5$[1] : void 8))) {
            carp('bad "by" in range', tokens[i + 2][2]);
          }
        } else if (fromNum > toNum) {
          byNum = -1;
        }
        ts = [];
        enc = char ? character : String;
        add = fn$;
        if (token.op === 'to') {
          for (i$ = fromNum; byNum < 0 ? i$ >= toNum : i$ <= toNum; i$ += byNum) {
            n = i$;
            add();
          }
        } else {
          for (i$ = fromNum; byNum < 0 ? i$ > toNum : i$ < toNum; i$ += byNum) {
            n = i$;
            add();
          }
        }
        ts.pop() || carp('empty range', lno);
        tokens.splice.apply(tokens, [i, 2 + 2 * byp].concat(slice$.call(ts)));
        i += ts.length - 1;
      } else {
        token[0] = 'STRNUM';
        if (((ref6$ = tokens[i + 2]) != null ? ref6$[0] : void 8) === 'RANGE_BY') {
          tokens.splice(i + 2, 1, ['BY', 'by', lno]);
        }
        tokens.splice(i + 1, 0, ['TO', token.op, lno]);
      }
      fromNum = null;
      break;
    case 'WORDS':
      ts = [['[', '[', lno = token[2]]];
      for (i$ = 0, len$ = (ref7$ = token[1].match(/\S+/g) || '').length; i$ < len$; ++i$) {
        word = ref7$[i$];
        ts.push(['STRNUM', string('\'', word, lno), lno], [',', ',', lno]);
      }
      tokens.splice.apply(tokens, [i, 1].concat(slice$.call(ts), [[']', ']', lno]]));
      i += ts.length;
      break;
    case 'INDENT':
      if (that = tokens[i - 1]) {
        if (that[1] === 'new') {
          tokens.splice(i++, 0, ['PARAM(', '', token[2]], [')PARAM', '', token[2]], ['->', '', token[2]]);
        } else if ((ref7$ = that[0]) === 'FUNCTION' || ref7$ === 'GENERATOR' || ref7$ === 'LET') {
          tokens.splice(i, 0, ['CALL(', '', token[2]], [')CALL', '', token[2]]);
          i += 2;
        }
      }
      continue;
    case 'LITERAL':
    case '}':
      break;
    case ')':
    case ')CALL':
      if (token[1]) {
        continue;
      }
      break;
    case ']':
      if (token.index) {
        continue;
      }
      break;
    case 'CREMENT':
      if (!able(tokens, i)) {
        continue;
      }
      break;
    case 'BIOP':
      if (!token.spaced && ((ref7$ = token[1]) === '+' || ref7$ === '-') && tokens[i + 1][0] !== ')') {
        tokens[i][0] = '+-';
      }
      continue;
    default:
      continue;
    }
    if (token.spaced && in$(tokens[i + 1][0], ARG)) {
      tokens.splice(++i, 0, [',', ',', token[2]]);
    }
  }
  function fn$(){
    if (0x10000 < ts.push(['STRNUM', enc(n), lno], [',', ',', lno])) {
      carp('range limit exceeded', lno);
    }
  }
}
function detectEnd(tokens, i, ok, go){
  var levels, token, tag;
  levels = 0;
  for (; token = tokens[i]; ++i) {
    if (!levels && ok(token, i)) {
      return go(token, i);
    }
    tag = token[0];
    if (0 > (levels += in$(tag, OPENERS) || -in$(tag, CLOSERS))) {
      return go(token, i);
    }
  }
}
function indexOfPair(tokens, i){
  var level, end, start, that;
  level = 1;
  end = INVERSES[start = tokens[i][0]];
  while (that = tokens[++i]) {
    switch (that[0]) {
    case start:
      ++level;
      break;
    case end:
      if (!--level) {
        return i;
      }
    }
  }
  return -1;
}
KEYWORDS_SHARED = ['true', 'false', 'null', 'this', 'void', 'super', 'return', 'throw', 'break', 'continue', 'if', 'else', 'for', 'while', 'switch', 'case', 'default', 'try', 'catch', 'finally', 'function', 'class', 'extends', 'implements', 'new', 'do', 'delete', 'typeof', 'in', 'instanceof', 'let', 'with', 'var', 'const', 'import', 'export', 'debugger', 'yield'];
KEYWORDS_UNUSED = ['enum', 'interface', 'package', 'private', 'protected', 'public', 'static'];
JS_KEYWORDS = KEYWORDS_SHARED.concat(KEYWORDS_UNUSED);
LS_KEYWORDS = ['xor', 'match', 'where'];
ID = /((?!\s)[a-z_$\xAA-\uFFDC](?:(?!\s)[\w$\xAA-\uFFDC]|-[a-z])*)([^\n\S]*:(?![:=]))?|/ig;
SYMBOL = /[-\/^]=|[%+:*]{1,2}=|\|>=|\.(?:[&\|\^]|<<|>>>?)\.=?|\.{1,3}|\^\^|<(?:--?|~~?)|!?(?:--?|~~?)>\*?|([-+&|:])\1|%%|&|\([^\n\S]*\)|[!=]==?|!?\~=|@@?|<\[(?:[\s\S]*?\]>)?|<<<<?|<\||[<>]==|<<=|>>=|<<|>>|[<>]\??=?|\|>|\||=>|\*\*|\^|`|[^\s#]?/g;
SPACE = /[^\n\S]*(?:#.*)?/g;
MULTIDENT = /(?:\s*#.*)*(?:\n([^\n\S]*))*/g;
SIMPLESTR = /'[^\\']*(?:\\[\s\S][^\\']*)*'|/g;
JSTOKEN = /``[^\\`]*(?:\\[\s\S][^\\`]*)*``|/g;
BSTOKEN = RegExp('\\\\(?:(\\S[^\\s,;)}\\]]*)|(?:' + SPACE.source + '\\n?)*)', 'g');
NUMBER = /0x[\dA-Fa-f][\dA-Fa-f_]*|(\d*)~([\dA-Za-z]\w*)|((\d[\d_]*)(\.\d[\d_]*)?(?:e[+-]?\d[\d_]*)?)[$\w]*|/g;
NUMBER_OMIT = /_+/g;
REGEX = /\/([^[\/\n\\]*(?:(?:\\.|\[[^\]\n\\]*(?:\\.[^\]\n\\]*)*\])[^[\/\n\\]*)*)\/([gimy]{1,4}|\$?)|/g;
HEREGEX_OMIT = /\s+(?:#.*)?/g;
LASTDENT = /\n[^\n\S]*$/;
INLINEDENT = /[^\n\S]*[^#\s]?/g;
NONASCII = /[\x80-\uFFFF]/;
OPENERS = ['(', '[', '{', 'CALL(', 'PARAM(', 'INDENT'];
CLOSERS = [')', ']', '}', ')CALL', ')PARAM', 'DEDENT'];
INVERSES = import$((function(){
  var i$, ref$, len$, resultObj$ = {};
  for (i$ = 0, len$ = (ref$ = OPENERS).length; i$ < len$; ++i$) {
    i = i$;
    o = ref$[i$];
    resultObj$[o] = CLOSERS[i];
  }
  return resultObj$;
}()), (function(){
  var i$, ref$, len$, resultObj$ = {};
  for (i$ = 0, len$ = (ref$ = CLOSERS).length; i$ < len$; ++i$) {
    i = i$;
    c = ref$[i$];
    resultObj$[c] = OPENERS[i];
  }
  return resultObj$;
}()));
CHAIN = ['(', '{', '[', 'ID', 'STRNUM', 'LITERAL', 'LET', 'WITH', 'WORDS'];
ARG = CHAIN.concat(['...', 'UNARY', 'CREMENT', 'PARAM(', 'FUNCTION', 'GENERATOR', 'IF', 'SWITCH', 'TRY', 'CLASS', 'RANGE', 'LABEL', 'DECL', 'DO', 'BIOPBP']);
BLOCK_USERS = [',', ':', '->', 'ELSE', 'ASSIGN', 'IMPORT', 'UNARY', 'DEFAULT', 'TRY', 'FINALLY', 'HURL', 'DECL', 'DO', 'LET', 'FUNCTION', 'GENERATOR'];
function clone$(it){
  function fun(){} fun.prototype = it;
  return new fun;
}
function in$(x, xs){
  var i = -1, l = xs.length >>> 0;
  while (++i < l) if (x === xs[i]) return true;
  return false;
}
function import$(obj, src){
  var own = {}.hasOwnProperty;
  for (var key in src) if (own.call(src, key)) obj[key] = src[key];
  return obj;
}
},{}],12:[function(require,module,exports){
(function (process){
// Generated by LiveScript 1.3.1
var split$ = ''.split;
module.exports = function(LiveScript){
  var fs, path;
  fs = require('fs');
  path = require('path');
  LiveScript.run = function(code, options, js){
    var filename, main, dirname, ref$, e;
    if (options != null) {
      filename = options.filename;
    }
    main = require.main;
    if (filename) {
      dirname = path.dirname(fs.realpathSync(filename = process.argv[1] = path.resolve(filename)));
    } else {
      dirname = filename = '.';
    }
    main.paths = main.constructor._nodeModulePaths(dirname);
    main.filename = filename;
    js || (code = LiveScript.compile(code, (ref$ = {}, import$(ref$, options), ref$.bare = true, ref$)));
    try {
      return main._compile(code, filename);
    } catch (e$) {
      e = e$;
      throw hackTrace(e, code, filename);
    }
  };
  importAll$(LiveScript, require('events').EventEmitter.prototype);
  require.extensions['.ls'] = function(module, filename){
    var js, e;
    js = LiveScript.compile(fs.readFileSync(filename, 'utf8'), {
      filename: filename,
      bare: true
    });
    try {
      return module._compile(js, filename);
    } catch (e$) {
      e = e$;
      throw hackTrace(e, js, filename);
    }
  };
};
function hackTrace(error, js, filename){
  var stack, traces, i$, len$, i, trace, index, lno, end, length, lines, j$, ref$, n;
  if (error != null) {
    stack = error.stack;
  }
  if (!stack) {
    return error;
  }
  traces = split$.call(stack, '\n');
  if (!(traces.length > 1)) {
    return error;
  }
  for (i$ = 0, len$ = traces.length; i$ < len$; ++i$) {
    i = i$;
    trace = traces[i$];
    if (0 > (index = trace.indexOf("(" + filename + ":"))) {
      continue;
    }
    lno = (/:(\d+):/.exec(trace.slice(index + filename.length)) || '')[1];
    if (!(lno = +lno)) {
      continue;
    }
    length = ('' + (end = lno + 4)).length;
    lines || (lines = split$.call(js, '\n'));
    for (j$ = 1 > (ref$ = lno - 4) ? 1 : ref$; j$ <= end; ++j$) {
      n = j$;
      traces[i] += "\n" + ('    ' + n).slice(-length) + "" + '|+'.charAt(n === lno) + " " + [lines[n - 1]];
    }
  }
  return error.stack = traces.join('\n'), error;
}
function import$(obj, src){
  var own = {}.hasOwnProperty;
  for (var key in src) if (own.call(src, key)) obj[key] = src[key];
  return obj;
}
function importAll$(obj, src){
  for (var key in src) obj[key] = src[key];
  return obj;
}
}).call(this,require('_process'))
},{"_process":4,"events":2,"fs":1,"path":3}],13:[function(require,module,exports){
exports.parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"Chain":3,"ID":4,"Parenthetical":5,"List":6,"STRNUM":7,"LITERAL":8,"DOT":9,"Key":10,"CALL(":11,"ArgList":12,"OptComma":13,")CALL":14,"?":15,"LET":16,"Block":17,"[":18,"Expression":19,"LoopHeads":20,"]":21,"DEDENT":22,"{":23,"}":24,"(":25,"BIOP":26,")":27,"BIOPR":28,"BIOPBP":29,"BIOPP":30,"PARAM(":31,")PARAM":32,"UNARY":33,"CREMENT":34,"BACKTICK":35,"TO":36,"BY":37,"WITH":38,"FOR":39,"Properties":40,"LABEL":41,"KeyBase":42,"Arg":43,",":44,"NEWLINE":45,"INDENT":46,"...":47,"Lines":48,"Line":49,"<-":50,"COMMENT":51,"REQUIRE":52,"CLONEPORT":53,"ASSIGN":54,"IMPORT":55,"+-":56,"CLONE":57,"YIELD":58,"COMPARE":59,"LOGIC":60,"MATH":61,"POWER":62,"SHIFT":63,"BITWISE":64,"CONCAT":65,"COMPOSE":66,"RELATION":67,"PIPE":68,"BACKPIPE":69,"!?":70,"->":71,"FUNCTION":72,"GENERATOR":73,"IF":74,"Else":75,"POST_IF":76,"LoopHead":77,"DO":78,"WHILE":79,"CASE":80,"HURL":81,"JUMP":82,"SWITCH":83,"Exprs":84,"Cases":85,"DEFAULT":86,"ELSE":87,"TRY":88,"CATCH":89,"FINALLY":90,"CLASS":91,"OptExtends":92,"OptImplements":93,"EXTENDS":94,"DECL":95,"KeyValue":96,"Property":97,":":98,"Body":99,"IN":100,"OF":101,"FROM":102,"IMPLEMENTS":103,"Root":104,"$accept":0,"$end":1},
terminals_: {2:"error",4:"ID",7:"STRNUM",8:"LITERAL",9:"DOT",11:"CALL(",14:")CALL",15:"?",16:"LET",18:"[",21:"]",22:"DEDENT",23:"{",24:"}",25:"(",26:"BIOP",27:")",28:"BIOPR",29:"BIOPBP",30:"BIOPP",31:"PARAM(",32:")PARAM",33:"UNARY",34:"CREMENT",35:"BACKTICK",36:"TO",37:"BY",38:"WITH",39:"FOR",41:"LABEL",44:",",45:"NEWLINE",46:"INDENT",47:"...",50:"<-",51:"COMMENT",52:"REQUIRE",53:"CLONEPORT",54:"ASSIGN",55:"IMPORT",56:"+-",57:"CLONE",58:"YIELD",59:"COMPARE",60:"LOGIC",61:"MATH",62:"POWER",63:"SHIFT",64:"BITWISE",65:"CONCAT",66:"COMPOSE",67:"RELATION",68:"PIPE",69:"BACKPIPE",70:"!?",71:"->",72:"FUNCTION",73:"GENERATOR",74:"IF",76:"POST_IF",78:"DO",79:"WHILE",80:"CASE",81:"HURL",82:"JUMP",83:"SWITCH",86:"DEFAULT",87:"ELSE",88:"TRY",89:"CATCH",90:"FINALLY",91:"CLASS",94:"EXTENDS",95:"DECL",98:":",100:"IN",101:"OF",102:"FROM",103:"IMPLEMENTS"},
productions_: [0,[3,1],[3,1],[3,1],[3,1],[3,1],[3,3],[3,3],[3,5],[3,2],[3,6],[3,4],[3,5],[3,7],[3,3],[3,4],[3,4],[3,3],[3,4],[3,4],[3,3],[3,7],[3,3],[3,7],[3,3],[3,3],[3,5],[3,6],[3,6],[3,5],[3,7],[3,4],[3,6],[3,7],[3,6],[3,6],[3,5],[3,3],[3,3],[6,4],[6,4],[6,5],[6,5],[10,1],[10,1],[42,1],[42,1],[12,0],[12,1],[12,3],[12,4],[12,6],[43,1],[43,2],[43,1],[13,0],[13,1],[48,0],[48,1],[48,3],[48,2],[49,1],[49,2],[49,6],[49,1],[49,1],[49,2],[17,3],[19,3],[19,3],[19,5],[19,1],[19,3],[19,6],[19,3],[19,6],[19,2],[19,2],[19,3],[19,3],[19,3],[19,2],[19,2],[19,2],[19,2],[19,5],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,2],[19,6],[19,6],[19,6],[19,4],[19,3],[19,3],[19,4],[19,6],[19,2],[19,5],[19,1],[19,1],[19,2],[19,3],[19,5],[19,5],[19,2],[19,4],[19,4],[19,2],[19,2],[19,4],[19,6],[19,5],[19,7],[19,4],[19,5],[19,4],[19,3],[19,2],[19,2],[19,5],[84,1],[84,3],[96,1],[96,1],[96,3],[96,3],[96,5],[96,5],[97,3],[97,6],[97,1],[97,3],[97,3],[97,2],[97,2],[97,2],[97,1],[40,0],[40,1],[40,3],[40,4],[40,4],[5,3],[99,1],[99,1],[99,3],[75,0],[75,2],[75,5],[77,4],[77,6],[77,6],[77,8],[77,2],[77,4],[77,4],[77,6],[77,4],[77,6],[77,6],[77,8],[77,6],[77,5],[77,8],[77,7],[77,8],[77,10],[77,10],[77,2],[77,4],[77,4],[77,6],[20,1],[20,2],[20,3],[20,3],[85,3],[85,4],[92,2],[92,0],[93,2],[93,0],[104,1]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$
/**/) {

var $0 = $$.length - 1;
switch (yystate) {
case 1:this.$ = yy.Chain(yy.L(yylineno, yy.Var($$[$0])));
break;
case 2:
case 3:this.$ = yy.Chain($$[$0]);
break;
case 4:
case 5:this.$ = yy.Chain(yy.L(yylineno, yy.Literal($$[$0])));
break;
case 6:
case 7:this.$ = $$[$0-2].add(yy.Index($$[$0], $$[$0-1], true));
break;
case 8:this.$ = $$[$0-4].add(yy.Call($$[$0-2]));
break;
case 9:this.$ = yy.Chain(yy.Existence($$[$0-1].unwrap()));
break;
case 10:this.$ = yy.Chain(yy.Call['let']($$[$0-3], $$[$0]));
break;
case 11:this.$ = yy.Chain($$[$0-1][0].makeComprehension($$[$0-2], $$[$0-1].slice(1)));
break;
case 12:this.$ = yy.Chain($$[$0-2][0].makeComprehension($$[$0-3], $$[$0-2].slice(1)));
break;
case 13:this.$ = yy.Chain($$[$0-1][0].addObjComp().makeComprehension(yy.L(yylineno, yy.Arr($$[$0-4])), $$[$0-1].slice(1)));
break;
case 14:this.$ = yy.Chain(yy.Binary($$[$0-1]));
break;
case 15:this.$ = yy.Chain(yy.Binary($$[$0-2], void 8, $$[$0-1]));
break;
case 16:this.$ = yy.Chain(yy.Binary($$[$0-1], $$[$0-2]));
break;
case 17:this.$ = yy.Chain('!' === $$[$0-1].charAt(0)
        ? yy.Binary($$[$0-1].slice(1)).invertIt()
        : yy.Binary($$[$0-1]));
break;
case 18:this.$ = yy.Chain('!' === $$[$0-2].charAt(0)
        ? yy.Binary($$[$0-2].slice(1), void 8, $$[$0-1]).invertIt()
        : yy.Binary($$[$0-2], void 8, $$[$0-1]));
break;
case 19:this.$ = yy.Chain('!' === $$[$0-1].charAt(0)
        ? yy.Binary($$[$0-1].slice(1), $$[$0-2]).invertIt()
        : yy.Binary($$[$0-1], $$[$0-2]));
break;
case 20:this.$ = yy.Chain(yy.Binary($$[$0-1]));
break;
case 21:this.$ = yy.Chain(yy.Binary($$[$0-5], void 8, $$[$0-3]));
break;
case 22:this.$ = yy.Chain(yy.Binary($$[$0-1]));
break;
case 23:this.$ = yy.Chain(yy.Binary($$[$0-1], $$[$0-4]));
break;
case 24:
case 25:this.$ = yy.Chain(yy.Unary($$[$0-1]));
break;
case 26:this.$ = yy.Chain($$[$0-2]);
break;
case 27:this.$ = yy.Chain($$[$0-2].add(yy.Call([$$[$0-4]])));
break;
case 28:this.$ = yy.Chain(yy.Chain(yy.Var('flip$')).add(yy.Call([$$[$0-3]]))).flipIt().add(yy.Call([$$[$0-1]]));
break;
case 29:this.$ = yy.Chain(new yy.For({
        from: $$[$0-3],
        op: $$[$0-2],
        to: $$[$0-1],
        inComprehension: true
      }));
break;
case 30:this.$ = yy.Chain(new yy.For({
        from: $$[$0-5],
        op: $$[$0-4],
        to: $$[$0-3],
        step: $$[$0-1],
        inComprehension: true
      }));
break;
case 31:this.$ = yy.Chain(new yy.For({
        from: yy.Chain(yy.Literal(0)),
        op: $$[$0-2],
        to: $$[$0-1],
        inComprehension: true
      }));
break;
case 32:this.$ = yy.Chain(new yy.For({
        from: yy.Chain(yy.Literal(0)),
        op: $$[$0-4],
        to: $$[$0-3],
        step: $$[$0-1],
        inComprehension: true
      }));
break;
case 33:this.$ = yy.Chain(yy.Slice({
        type: $$[$0-2],
        target: $$[$0-6],
        from: $$[$0-3],
        to: $$[$0-1]
      }));
break;
case 34:this.$ = yy.Chain(yy.Slice({
        type: $$[$0-1],
        target: $$[$0-5],
        from: $$[$0-2]
      }));
break;
case 35:this.$ = yy.Chain(yy.Slice({
        type: $$[$0-2],
        target: $$[$0-5],
        to: $$[$0-1]
      }));
break;
case 36:this.$ = yy.Chain(yy.Slice({
        type: $$[$0-1],
        target: $$[$0-4]
      }));
break;
case 37:this.$ = yy.Chain(yy.Cascade($$[$0-1], $$[$0], 'with'));
break;
case 38:this.$ = yy.Chain(new yy.For({
        kind: $$[$0-2],
        source: $$[$0-1],
        body: $$[$0],
        ref: true
      }).addBody($$[$0]));
break;
case 39:this.$ = yy.L(yylineno, yy.Arr($$[$0-2]));
break;
case 40:this.$ = yy.L(yylineno, yy.Obj($$[$0-2]));
break;
case 41:this.$ = yy.L(yylineno, yy.Arr($$[$0-3])).named($$[$0]);
break;
case 42:this.$ = yy.L(yylineno, yy.Obj($$[$0-3])).named($$[$0]);
break;
case 45:this.$ = yy.L(yylineno, yy.Key($$[$0]));
break;
case 46:this.$ = yy.L(yylineno, yy.Literal($$[$0]));
break;
case 47:this.$ = [];
break;
case 48:this.$ = [$$[$0]];
break;
case 49:this.$ = $$[$0-2].concat($$[$0]);
break;
case 50:this.$ = $$[$0-3].concat($$[$0]);
break;
case 51:this.$ = $$[$0-5].concat($$[$0-2]);
break;
case 53:this.$ = yy.Splat($$[$0]);
break;
case 54:this.$ = yy.Splat(yy.L(yylineno, yy.Arr()), true);
break;
case 57:this.$ = yy.L(yylineno, yy.Block());
break;
case 58:this.$ = yy.Block($$[$0]);
break;
case 59:this.$ = $$[$0-2].add($$[$0]);
break;
case 62:this.$ = yy.Cascade($$[$0-1], $$[$0], 'cascade');
break;
case 63:this.$ = yy.Call.back($$[$0-4], $$[$0], $$[$0-1].charAt(1) === '~', $$[$0-1].length === 3);
break;
case 64:this.$ = yy.L(yylineno, yy.JS($$[$0], true, true));
break;
case 65:this.$ = yy.L(yylineno, yy.Throw(yy.JS("Error('unimplemented')")));
break;
case 66:this.$ = yy.Require($$[$0].unwrap());
break;
case 67:this.$ = $$[$0-1];
break;
case 68:this.$ = yy.Import(yy.Unary('^^', $$[$0-2], {
        prec: 'yy.UNARY'
      }), $$[$0], false);
break;
case 69:this.$ = yy.Import(yy.Unary('^^', $$[$0-2], {
        prec: 'yy.UNARY'
      }), $$[$0].unwrap(), false);
break;
case 70:this.$ = $$[$0-2].add(yy.Call([$$[$0-4], $$[$0]]));
break;
case 71:this.$ = $$[$0].unwrap();
break;
case 72:this.$ = yy.Assign($$[$0-2].unwrap(), $$[$0], $$[$0-1]);
break;
case 73:this.$ = yy.Assign($$[$0-5].unwrap(), yy.Arr.maybe($$[$0-2]), $$[$0-4]);
break;
case 74:this.$ = yy.Import($$[$0-2], $$[$0], $$[$0-1] === '<<<<');
break;
case 75:this.$ = yy.Import($$[$0-5], yy.Arr.maybe($$[$0-2]), $$[$0-4] === '<<<<');
break;
case 76:this.$ = yy.Unary($$[$0-1], $$[$0].unwrap());
break;
case 77:this.$ = yy.Unary($$[$0], $$[$0-1].unwrap(), true);
break;
case 78:
case 79:
case 80:this.$ = yy.Assign($$[$0].unwrap(), [$$[$0-2]], $$[$0-1]);
break;
case 81:
case 82:
case 83:
case 84:this.$ = yy.Unary($$[$0-1], $$[$0]);
break;
case 85:this.$ = yy.Unary($$[$0-4], yy.Arr.maybe($$[$0-2]));
break;
case 86:
case 87:
case 88:
case 89:
case 90:
case 91:
case 92:
case 93:
case 94:this.$ = yy.Binary($$[$0-1], $$[$0-2], $$[$0]);
break;
case 95:this.$ = '!' === $$[$0-1].charAt(0)
        ? yy.Binary($$[$0-1].slice(1), $$[$0-2], $$[$0]).invert()
        : yy.Binary($$[$0-1], $$[$0-2], $$[$0]);
break;
case 96:this.$ = yy.Block($$[$0-2]).pipe($$[$0], $$[$0-1]);
break;
case 97:this.$ = yy.Block($$[$0-2]).pipe([$$[$0]], $$[$0-1]);
break;
case 98:this.$ = yy.Existence($$[$0-1].unwrap(), true);
break;
case 99:this.$ = yy.L(yylineno, yy.Fun($$[$0-4], $$[$0], /~/.test($$[$0-1]), /--|~~/.test($$[$0-1]), /!/.test($$[$0-1]), /\*/.test($$[$0-1])));
break;
case 100:this.$ = yy.L(yylineno, yy.Fun($$[$0-3], $$[$0]).named($$[$0-5]));
break;
case 101:this.$ = yy.L(yylineno, yy.Fun($$[$0-3], $$[$0], false, false, false, true).named($$[$0-5]));
break;
case 102:this.$ = yy.If($$[$0-2], $$[$0-1], $$[$0-3] === 'unless').addElse($$[$0]);
break;
case 103:this.$ = yy.If($$[$0], $$[$0-2], $$[$0-1] === 'unless');
break;
case 104:this.$ = $$[$0-2].addBody($$[$0-1]).addElse($$[$0]);
break;
case 105:this.$ = new yy.While($$[$0], $$[$0-1] === 'until', true).addBody($$[$0-2]);
break;
case 106:this.$ = new yy.While($$[$0-2], $$[$0-3] === 'until', true).addGuard($$[$0]).addBody($$[$0-4]);
break;
case 107:this.$ = yy.Jump[$$[$0-1]]($$[$0]);
break;
case 108:this.$ = yy.Jump[$$[$0-4]](yy.Arr.maybe($$[$0-2]));
break;
case 109:this.$ = yy.L(yylineno, yy.Jump[$$[$0]]());
break;
case 110:this.$ = yy.L(yylineno, new yy.Jump($$[$0]));
break;
case 111:this.$ = yy.L(yylineno, new yy.Jump($$[$0-1], $$[$0]));
break;
case 112:this.$ = new yy.Switch($$[$0-2], $$[$0-1], $$[$0]);
break;
case 113:
case 114:this.$ = new yy.Switch($$[$0-4], $$[$0-3], $$[$0-2], $$[$0]);
break;
case 115:this.$ = new yy.Switch($$[$0-1], null, $$[$0]);
break;
case 116:
case 117:this.$ = new yy.Switch($$[$0-3], null, $$[$0-2], $$[$0]);
break;
case 118:this.$ = new yy.Switch($$[$0-1], null, [], $$[$0]);
break;
case 119:this.$ = new yy.Try($$[$0]);
break;
case 120:this.$ = new yy.Try($$[$0-2], void 8, $$[$0]);
break;
case 121:this.$ = new yy.Try($$[$0-4], void 8, $$[$0-2], $$[$0]);
break;
case 122:this.$ = new yy.Try($$[$0-3], $$[$0-1], $$[$0]);
break;
case 123:this.$ = new yy.Try($$[$0-5], $$[$0-3], $$[$0-2], $$[$0]);
break;
case 124:this.$ = new yy.Try($$[$0-2], void 8, void 8, $$[$0]);
break;
case 125:this.$ = new yy.Class({
        title: $$[$0-3].unwrap(),
        sup: $$[$0-2],
        mixins: $$[$0-1],
        body: $$[$0]
      });
break;
case 126:this.$ = new yy.Class({
        sup: $$[$0-2],
        mixins: $$[$0-1],
        body: $$[$0]
      });
break;
case 127:this.$ = yy.Util.Extends($$[$0-2].unwrap(), $$[$0]);
break;
case 128:
case 129:this.$ = new yy.Label($$[$0-1], $$[$0]);
break;
case 130:this.$ = yy.Decl($$[$0-4], $$[$0-2], yylineno + 1);
break;
case 131:this.$ = [$$[$0]];
break;
case 132:this.$ = $$[$0-2].concat($$[$0]);
break;
case 134:this.$ = yy.Prop(yy.L(yylineno, yy.Key($$[$0], $$[$0] !== 'arguments' && $$[$0] !== 'eval')), yy.L(yylineno, yy.Literal($$[$0])));
break;
case 135:this.$ = yy.Prop($$[$0], yy.Chain($$[$0-2], [yy.Index($$[$0], $$[$0-1])]));
break;
case 136:this.$ = yy.Prop($$[$0], yy.Chain(yy.L(yylineno, yy.Literal($$[$0-2])), [yy.Index($$[$0], $$[$0-1])]));
break;
case 137:this.$ = yy.Prop(yy.L(yylineno, yy.Key($$[$0])), yy.L(yylineno, yy.Obj($$[$0-3]).named($$[$0])));
break;
case 138:this.$ = yy.Prop(yy.L(yylineno, yy.Key($$[$0])), yy.L(yylineno, yy.Arr($$[$0-3]).named($$[$0])));
break;
case 139:this.$ = yy.Prop($$[$0-2], $$[$0]);
break;
case 140:this.$ = yy.Prop($$[$0-5], yy.Arr.maybe($$[$0-2]));
break;
case 142:this.$ = yy.Binary($$[$0-1], $$[$0-2], $$[$0]);
break;
case 143:this.$ = yy.Binary($$[$0-1], $$[$0-2], $$[$0], true);
break;
case 144:this.$ = yy.Prop($$[$0].maybeKey(), yy.L(yylineno, yy.Literal($$[$0-1] === '+')));
break;
case 145:this.$ = yy.Prop(yy.L(yylineno, yy.Key($$[$0], true)), yy.L(yylineno, yy.Literal($$[$0-1] === '+')));
break;
case 146:this.$ = yy.Splat($$[$0]);
break;
case 147:this.$ = yy.L(yylineno, yy.JS($$[$0], true, true));
break;
case 148:this.$ = [];
break;
case 149:this.$ = [$$[$0]];
break;
case 150:this.$ = $$[$0-2].concat($$[$0]);
break;
case 151:this.$ = $$[$0-3].concat($$[$0]);
break;
case 152:this.$ = $$[$0-2];
break;
case 153:this.$ = yy.Parens($$[$0-1].chomp().unwrap(), false, $$[$0-2] === '"');
break;
case 156:this.$ = $$[$0-2].add($$[$0]);
break;
case 157:this.$ = null;
break;
case 158:this.$ = $$[$0];
break;
case 159:this.$ = yy.If($$[$0-2], $$[$0-1], $$[$0-3] === 'unless').addElse($$[$0]);
break;
case 160:this.$ = new yy.For({
        kind: $$[$0-3],
        item: $$[$0-2].unwrap(),
        index: $$[$0-1],
        source: $$[$0]
      });
break;
case 161:this.$ = new yy.For({
        kind: $$[$0-5],
        item: $$[$0-4].unwrap(),
        index: $$[$0-3],
        source: $$[$0-2],
        guard: $$[$0]
      });
break;
case 162:this.$ = new yy.For({
        kind: $$[$0-5],
        item: $$[$0-4].unwrap(),
        index: $$[$0-3],
        source: $$[$0-2],
        step: $$[$0]
      });
break;
case 163:this.$ = new yy.For({
        kind: $$[$0-7],
        item: $$[$0-6].unwrap(),
        index: $$[$0-5],
        source: $$[$0-4],
        step: $$[$0-2],
        guard: $$[$0]
      });
break;
case 164:this.$ = new yy.For({
        kind: $$[$0-1],
        source: $$[$0],
        ref: true
      });
break;
case 165:this.$ = new yy.For({
        kind: $$[$0-3],
        source: $$[$0-2],
        ref: true,
        guard: $$[$0]
      });
break;
case 166:this.$ = new yy.For({
        kind: $$[$0-3],
        source: $$[$0-2],
        ref: true,
        step: $$[$0]
      });
break;
case 167:this.$ = new yy.For({
        kind: $$[$0-5],
        source: $$[$0-4],
        ref: true,
        step: $$[$0-2],
        guard: $$[$0]
      });
break;
case 168:this.$ = new yy.For({
        object: true,
        kind: $$[$0-3],
        index: $$[$0-2],
        source: $$[$0]
      });
break;
case 169:this.$ = new yy.For({
        object: true,
        kind: $$[$0-5],
        index: $$[$0-4],
        source: $$[$0-2],
        guard: $$[$0]
      });
break;
case 170:this.$ = new yy.For({
        object: true,
        kind: $$[$0-5],
        index: $$[$0-4],
        item: $$[$0-2].unwrap(),
        source: $$[$0]
      });
break;
case 171:this.$ = new yy.For({
        object: true,
        kind: $$[$0-7],
        index: $$[$0-6],
        item: $$[$0-4].unwrap(),
        source: $$[$0-2],
        guard: $$[$0]
      });
break;
case 172:this.$ = new yy.For({
        kind: $$[$0-5],
        index: $$[$0-4],
        from: $$[$0-2],
        op: $$[$0-1],
        to: $$[$0]
      });
break;
case 173:this.$ = new yy.For({
        kind: $$[$0-4],
        from: $$[$0-2],
        op: $$[$0-1],
        to: $$[$0]
      });
break;
case 174:this.$ = new yy.For({
        kind: $$[$0-7],
        index: $$[$0-6],
        from: $$[$0-4],
        op: $$[$0-3],
        to: $$[$0-2],
        guard: $$[$0]
      });
break;
case 175:this.$ = new yy.For({
        kind: $$[$0-6],
        from: $$[$0-4],
        op: $$[$0-3],
        to: $$[$0-2],
        guard: $$[$0]
      });
break;
case 176:this.$ = new yy.For({
        kind: $$[$0-7],
        index: $$[$0-6],
        from: $$[$0-4],
        op: $$[$0-3],
        to: $$[$0-2],
        step: $$[$0]
      });
break;
case 177:this.$ = new yy.For({
        kind: $$[$0-9],
        index: $$[$0-8],
        from: $$[$0-6],
        op: $$[$0-5],
        to: $$[$0-4],
        step: $$[$0-2],
        guard: $$[$0]
      });
break;
case 178:this.$ = new yy.For({
        kind: $$[$0-9],
        index: $$[$0-8],
        from: $$[$0-6],
        op: $$[$0-5],
        to: $$[$0-4],
        guard: $$[$0-2],
        step: $$[$0]
      });
break;
case 179:this.$ = new yy.While($$[$0], $$[$0-1] === 'until');
break;
case 180:this.$ = new yy.While($$[$0-2], $$[$0-3] === 'until').addGuard($$[$0]);
break;
case 181:this.$ = new yy.While($$[$0-2], $$[$0-3] === 'until', $$[$0]);
break;
case 182:this.$ = new yy.While($$[$0-4], $$[$0-5] === 'until', $$[$0-2]).addGuard($$[$0]);
break;
case 183:this.$ = [$$[$0]];
break;
case 184:this.$ = $$[$0-1].concat($$[$0]);
break;
case 185:
case 186:this.$ = $$[$0-2].concat($$[$0]);
break;
case 187:this.$ = [new yy.Case($$[$0-1], $$[$0])];
break;
case 188:this.$ = $$[$0-3].concat(new yy.Case($$[$0-1], $$[$0]));
break;
case 189:this.$ = $$[$0];
break;
case 190:this.$ = null;
break;
case 191:this.$ = $$[$0];
break;
case 192:this.$ = null;
break;
case 193:return this.$
}
},
table: [{1:[2,57],3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],17:4,18:[1,36],19:7,23:[1,37],25:[1,38],31:[1,8],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],45:[2,57],46:[1,6],47:[1,10],48:3,49:5,51:[1,9],52:[1,11],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29],99:2,104:1},{1:[3]},{1:[2,193]},{1:[2,154],27:[2,154],45:[1,42]},{1:[2,155],27:[2,155],45:[1,43]},{1:[2,58],22:[2,58],27:[2,58],45:[2,58]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:7,22:[2,57],23:[1,37],25:[1,38],31:[1,8],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],45:[2,57],47:[1,10],48:44,49:5,51:[1,9],52:[1,11],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,61],17:45,22:[2,61],27:[2,61],35:[1,46],45:[2,61],46:[1,6],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:61,16:[1,35],18:[1,36],19:63,23:[1,37],25:[1,38],31:[1,65],32:[2,47],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,64],22:[2,64],27:[2,64],45:[2,64]},{1:[2,65],22:[2,65],27:[2,65],45:[2,65]},{3:66,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],23:[1,37],25:[1,38],38:[1,39],39:[1,67]},{1:[2,71],9:[1,73],11:[1,74],14:[2,71],15:[1,75],21:[2,71],22:[2,71],24:[2,71],26:[2,71],27:[2,71],28:[2,71],32:[2,71],34:[1,70],35:[2,71],36:[2,71],37:[2,71],39:[2,71],44:[2,71],45:[2,71],46:[2,71],53:[1,68],54:[1,69],55:[2,71],56:[2,71],59:[2,71],60:[2,71],61:[2,71],62:[2,71],63:[2,71],64:[2,71],65:[2,71],66:[2,71],67:[2,71],68:[2,71],69:[2,71],70:[1,71],76:[2,71],79:[2,71],80:[2,71],94:[1,72],103:[2,71]},{3:76,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],23:[1,37],25:[1,38],38:[1,39],39:[1,67]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:78,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],46:[1,79],54:[1,77],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:81,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],54:[1,80],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:83,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],54:[1,82],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:84,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{11:[1,85]},{11:[1,86]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:87,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{17:88,46:[1,6]},{17:89,46:[1,6]},{1:[2,109],3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],14:[2,109],16:[1,35],18:[1,36],19:90,21:[2,109],22:[2,109],23:[1,37],24:[2,109],25:[1,38],26:[2,109],27:[2,109],28:[2,109],31:[1,65],32:[2,109],33:[1,14],34:[1,13],35:[2,109],36:[2,109],37:[2,109],38:[1,39],39:[1,40],41:[1,28],44:[2,109],45:[2,109],46:[1,91],55:[2,109],56:[1,15],57:[1,16],58:[1,17],59:[2,109],60:[2,109],61:[2,109],62:[2,109],63:[2,109],64:[2,109],65:[2,109],66:[2,109],67:[2,109],68:[2,109],69:[2,109],72:[1,18],73:[1,19],74:[1,20],76:[2,109],77:21,78:[1,22],79:[1,41],80:[2,109],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29],103:[2,109]},{1:[2,110],4:[1,92],14:[2,110],21:[2,110],22:[2,110],24:[2,110],26:[2,110],27:[2,110],28:[2,110],32:[2,110],35:[2,110],36:[2,110],37:[2,110],39:[2,110],44:[2,110],45:[2,110],46:[2,110],55:[2,110],56:[2,110],59:[2,110],60:[2,110],61:[2,110],62:[2,110],63:[2,110],64:[2,110],65:[2,110],66:[2,110],67:[2,110],68:[2,110],69:[2,110],76:[2,110],79:[2,110],80:[2,110],103:[2,110]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],17:95,18:[1,36],19:96,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],46:[1,6],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],80:[1,97],81:[1,23],82:[1,24],83:[1,25],84:93,85:94,88:[1,26],91:[1,27],95:[1,29]},{17:98,46:[1,6]},{3:99,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],23:[1,37],25:[1,38],38:[1,39],39:[1,67],46:[2,190],92:100,94:[1,101],103:[2,190]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],17:103,18:[1,36],19:102,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],46:[1,6],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{46:[1,104]},{1:[2,1],9:[2,1],11:[2,1],14:[2,1],15:[2,1],21:[2,1],22:[2,1],24:[2,1],26:[2,1],27:[2,1],28:[2,1],32:[2,1],34:[2,1],35:[2,1],36:[2,1],37:[2,1],39:[2,1],44:[2,1],45:[2,1],46:[2,1],53:[2,1],54:[2,1],55:[2,1],56:[2,1],59:[2,1],60:[2,1],61:[2,1],62:[2,1],63:[2,1],64:[2,1],65:[2,1],66:[2,1],67:[2,1],68:[2,1],69:[2,1],70:[2,1],76:[2,1],79:[2,1],80:[2,1],94:[2,1],101:[2,1],103:[2,1]},{1:[2,2],9:[2,2],11:[2,2],14:[2,2],15:[2,2],21:[2,2],22:[2,2],24:[2,2],26:[2,2],27:[2,2],28:[2,2],32:[2,2],34:[2,2],35:[2,2],36:[2,2],37:[2,2],39:[2,2],44:[2,2],45:[2,2],46:[2,2],53:[2,2],54:[2,2],55:[2,2],56:[2,2],59:[2,2],60:[2,2],61:[2,2],62:[2,2],63:[2,2],64:[2,2],65:[2,2],66:[2,2],67:[2,2],68:[2,2],69:[2,2],70:[2,2],76:[2,2],79:[2,2],80:[2,2],94:[2,2],100:[2,2],101:[2,2],103:[2,2]},{1:[2,3],9:[2,3],11:[2,3],14:[2,3],15:[2,3],21:[2,3],22:[2,3],24:[2,3],26:[2,3],27:[2,3],28:[2,3],32:[2,3],34:[2,3],35:[2,3],36:[2,3],37:[2,3],39:[2,3],44:[2,3],45:[2,3],46:[2,3],53:[2,3],54:[2,3],55:[2,3],56:[2,3],59:[2,3],60:[2,3],61:[2,3],62:[2,3],63:[2,3],64:[2,3],65:[2,3],66:[2,3],67:[2,3],68:[2,3],69:[2,3],70:[2,3],76:[2,3],79:[2,3],80:[2,3],94:[2,3],100:[2,3],101:[2,3],103:[2,3]},{1:[2,4],9:[2,4],11:[2,4],14:[2,4],15:[2,4],21:[2,4],22:[2,4],24:[2,4],26:[2,4],27:[2,4],28:[2,4],32:[2,4],34:[2,4],35:[2,4],36:[2,4],37:[2,4],39:[2,4],44:[2,4],45:[2,4],46:[2,4],53:[2,4],54:[2,4],55:[2,4],56:[2,4],59:[2,4],60:[2,4],61:[2,4],62:[2,4],63:[2,4],64:[2,4],65:[2,4],66:[2,4],67:[2,4],68:[2,4],69:[2,4],70:[2,4],76:[2,4],79:[2,4],80:[2,4],94:[2,4],100:[2,4],101:[2,4],103:[2,4]},{1:[2,5],9:[2,5],11:[2,5],14:[2,5],15:[2,5],21:[2,5],22:[2,5],24:[2,5],26:[2,5],27:[2,5],28:[2,5],32:[2,5],34:[2,5],35:[2,5],36:[2,5],37:[2,5],39:[2,5],44:[2,5],45:[2,5],46:[2,5],53:[2,5],54:[2,5],55:[2,5],56:[2,5],59:[2,5],60:[2,5],61:[2,5],62:[2,5],63:[2,5],64:[2,5],65:[2,5],66:[2,5],67:[2,5],68:[2,5],69:[2,5],70:[2,5],76:[2,5],79:[2,5],80:[2,5],94:[2,5],100:[2,5],101:[2,5],103:[2,5]},{11:[1,105]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:108,16:[1,35],18:[1,36],19:106,21:[2,47],23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],36:[1,107],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{4:[1,122],5:119,7:[1,123],8:[1,120],10:113,18:[1,109],23:[1,121],24:[2,148],25:[1,124],40:110,42:118,44:[2,148],45:[2,148],46:[1,112],47:[1,116],51:[1,117],56:[1,115],96:114,97:111},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],17:4,18:[1,36],19:126,23:[1,37],25:[1,38],26:[1,125],27:[2,57],28:[1,127],29:[1,128],30:[1,129],31:[1,130],33:[1,131],34:[1,132],35:[1,133],38:[1,39],39:[1,40],41:[1,28],45:[2,57],46:[1,6],47:[1,10],48:3,49:5,51:[1,9],52:[1,11],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29],99:134},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:135,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:137,4:[1,138],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:136,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29],102:[1,139]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:140,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,60],3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:7,22:[2,60],23:[1,37],25:[1,38],27:[2,60],31:[1,8],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],45:[2,60],47:[1,10],49:141,51:[1,9],52:[1,11],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,57],3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:7,23:[1,37],25:[1,38],27:[2,57],31:[1,8],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],45:[2,57],47:[1,10],48:142,49:5,51:[1,9],52:[1,11],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{22:[1,143],45:[1,42]},{1:[2,62],22:[2,62],27:[2,62],45:[2,62]},{3:144,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],23:[1,37],25:[1,38],38:[1,39],39:[1,67]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:145,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],46:[1,146],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:147,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:148,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:149,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:150,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:151,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:152,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:153,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:154,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:155,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:156,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:157,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:158,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:159,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{13:160,32:[2,55],44:[1,161],45:[2,55],46:[2,55]},{14:[2,48],21:[2,48],22:[2,48],32:[2,48],44:[2,48],45:[2,48],46:[2,48]},{14:[2,52],21:[2,52],22:[2,52],32:[2,52],35:[1,46],44:[2,52],45:[2,52],46:[2,52],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],14:[2,54],16:[1,35],18:[1,36],19:162,21:[2,54],22:[2,54],23:[1,37],25:[1,38],31:[1,65],32:[2,54],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],44:[2,54],45:[2,54],46:[2,54],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:163,16:[1,35],18:[1,36],19:63,23:[1,37],25:[1,38],31:[1,65],32:[2,47],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,66],9:[1,73],11:[1,74],15:[1,75],22:[2,66],27:[2,66],45:[2,66]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:164,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],17:166,18:[1,36],19:165,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],46:[1,6],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:167,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],46:[1,168],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,77],14:[2,77],21:[2,77],22:[2,77],24:[2,77],26:[2,77],27:[2,77],28:[2,77],32:[2,77],35:[2,77],36:[2,77],37:[2,77],39:[2,77],44:[2,77],45:[2,77],46:[2,77],55:[2,77],56:[2,77],59:[2,77],60:[2,77],61:[2,77],62:[2,77],63:[2,77],64:[2,77],65:[2,77],66:[2,77],67:[2,77],68:[2,77],69:[2,77],76:[2,77],79:[2,77],80:[2,77],103:[2,77]},{1:[2,98],14:[2,98],21:[2,98],22:[2,98],24:[2,98],26:[2,98],27:[2,98],28:[2,98],32:[2,98],35:[2,98],36:[2,98],37:[2,98],39:[2,98],44:[2,98],45:[2,98],46:[2,98],55:[2,98],56:[2,98],59:[2,98],60:[2,98],61:[2,98],62:[2,98],63:[2,98],64:[2,98],65:[2,98],66:[2,98],67:[2,98],68:[2,98],69:[2,98],76:[2,98],79:[2,98],80:[2,98],103:[2,98]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:169,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{4:[1,122],5:119,6:171,7:[1,123],10:170,18:[1,172],23:[1,173],25:[1,124],42:118},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:174,14:[2,47],16:[1,35],18:[1,36],19:63,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,9],9:[2,9],11:[2,9],14:[2,9],15:[2,9],21:[2,9],22:[2,9],24:[2,9],26:[2,9],27:[2,9],28:[2,9],32:[2,9],34:[2,9],35:[2,9],36:[2,9],37:[2,9],39:[2,9],44:[2,9],45:[2,9],46:[2,9],53:[2,9],54:[2,9],55:[2,9],56:[2,9],59:[2,9],60:[2,9],61:[2,9],62:[2,9],63:[2,9],64:[2,9],65:[2,9],66:[2,9],67:[2,9],68:[2,9],69:[2,9],70:[2,9],76:[2,9],79:[2,9],80:[2,9],94:[2,9],100:[2,9],101:[2,9],103:[2,9]},{1:[2,76],9:[1,73],11:[1,74],14:[2,76],15:[1,75],21:[2,76],22:[2,76],24:[2,76],26:[2,76],27:[2,76],28:[2,76],32:[2,76],35:[2,76],36:[2,76],37:[2,76],39:[2,76],44:[2,76],45:[2,76],46:[2,76],55:[2,76],56:[2,76],59:[2,76],60:[2,76],61:[2,76],62:[2,76],63:[2,76],64:[2,76],65:[2,76],66:[2,76],67:[2,76],68:[2,76],69:[2,76],76:[2,76],79:[2,76],80:[2,76],103:[2,76]},{3:175,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],23:[1,37],25:[1,38],38:[1,39],39:[1,67]},{1:[2,81],14:[2,81],21:[2,81],22:[2,81],24:[2,81],26:[2,81],27:[2,81],28:[2,81],32:[2,81],35:[1,46],36:[2,81],37:[2,81],39:[2,81],44:[2,81],45:[2,81],46:[2,81],55:[2,81],56:[2,81],59:[2,81],60:[2,81],61:[2,81],62:[1,52],63:[2,81],64:[2,81],65:[2,81],66:[1,56],67:[2,81],68:[2,81],69:[2,81],76:[2,81],79:[2,81],80:[2,81],103:[2,81]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:176,16:[1,35],18:[1,36],19:63,22:[2,47],23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:177,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],23:[1,37],25:[1,38],38:[1,39],39:[1,67]},{1:[2,83],14:[2,83],21:[2,83],22:[2,83],24:[2,83],26:[2,83],27:[2,83],28:[2,83],32:[2,83],35:[1,46],36:[2,83],37:[2,83],39:[2,83],44:[2,83],45:[2,83],46:[2,83],55:[2,83],56:[2,83],59:[2,83],60:[2,83],61:[2,83],62:[1,52],63:[2,83],64:[2,83],65:[2,83],66:[1,56],67:[2,83],68:[2,83],69:[2,83],76:[2,83],79:[2,83],80:[2,83],103:[2,83]},{3:178,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],23:[1,37],25:[1,38],38:[1,39],39:[1,67]},{1:[2,84],14:[2,84],21:[2,84],22:[2,84],24:[2,84],26:[2,84],27:[2,84],28:[2,84],32:[2,84],35:[1,46],36:[2,84],37:[2,84],39:[2,84],44:[2,84],45:[2,84],46:[2,84],55:[2,84],56:[2,84],59:[2,84],60:[2,84],61:[2,84],62:[1,52],63:[2,84],64:[2,84],65:[2,84],66:[1,56],67:[2,84],68:[2,84],69:[2,84],76:[2,84],79:[2,84],80:[2,84],103:[2,84]},{1:[2,82],14:[2,82],21:[2,82],22:[2,82],24:[2,82],26:[2,82],27:[2,82],28:[2,82],32:[2,82],35:[1,46],36:[2,82],37:[2,82],39:[2,82],44:[2,82],45:[2,82],46:[2,82],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[2,82],79:[2,82],80:[2,82],103:[2,82]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:179,14:[2,47],16:[1,35],18:[1,36],19:63,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:180,14:[2,47],16:[1,35],18:[1,36],19:63,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{17:181,35:[1,46],46:[1,6],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{1:[2,157],14:[2,157],21:[2,157],22:[2,157],24:[2,157],26:[2,157],27:[2,157],28:[2,157],32:[2,157],35:[2,157],36:[2,157],37:[2,157],39:[2,157],44:[2,157],45:[2,157],46:[2,157],55:[2,157],56:[2,157],59:[2,157],60:[2,157],61:[2,157],62:[2,157],63:[2,157],64:[2,157],65:[2,157],66:[2,157],67:[2,157],68:[2,157],69:[2,157],75:182,76:[2,157],79:[2,157],80:[2,157],87:[1,183],103:[2,157]},{79:[1,184]},{1:[2,107],14:[2,107],21:[2,107],22:[2,107],24:[2,107],26:[2,107],27:[2,107],28:[2,107],32:[2,107],35:[1,46],36:[2,107],37:[2,107],39:[2,107],44:[2,107],45:[2,107],46:[2,107],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[2,107],79:[2,107],80:[2,107],103:[2,107]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:185,16:[1,35],18:[1,36],19:63,22:[2,47],23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,111],14:[2,111],21:[2,111],22:[2,111],24:[2,111],26:[2,111],27:[2,111],28:[2,111],32:[2,111],35:[2,111],36:[2,111],37:[2,111],39:[2,111],44:[2,111],45:[2,111],46:[2,111],55:[2,111],56:[2,111],59:[2,111],60:[2,111],61:[2,111],62:[2,111],63:[2,111],64:[2,111],65:[2,111],66:[2,111],67:[2,111],68:[2,111],69:[2,111],76:[2,111],79:[2,111],80:[2,111],103:[2,111]},{44:[1,187],80:[1,97],85:186},{1:[2,115],14:[2,115],21:[2,115],22:[2,115],24:[2,115],26:[2,115],27:[2,115],28:[2,115],32:[2,115],35:[2,115],36:[2,115],37:[2,115],39:[2,115],44:[2,115],45:[2,115],46:[2,115],55:[2,115],56:[2,115],59:[2,115],60:[2,115],61:[2,115],62:[2,115],63:[2,115],64:[2,115],65:[2,115],66:[2,115],67:[2,115],68:[2,115],69:[2,115],76:[2,115],79:[2,115],80:[1,190],86:[1,188],87:[1,189],103:[2,115]},{1:[2,118],14:[2,118],21:[2,118],22:[2,118],24:[2,118],26:[2,118],27:[2,118],28:[2,118],32:[2,118],35:[2,118],36:[2,118],37:[2,118],39:[2,118],44:[2,118],45:[2,118],46:[2,118],55:[2,118],56:[2,118],59:[2,118],60:[2,118],61:[2,118],62:[2,118],63:[2,118],64:[2,118],65:[2,118],66:[2,118],67:[2,118],68:[2,118],69:[2,118],76:[2,118],79:[2,118],80:[2,118],103:[2,118]},{35:[1,46],44:[2,131],46:[2,131],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],80:[2,131]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:96,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],84:191,88:[1,26],91:[1,27],95:[1,29]},{1:[2,119],14:[2,119],21:[2,119],22:[2,119],24:[2,119],26:[2,119],27:[2,119],28:[2,119],32:[2,119],35:[2,119],36:[2,119],37:[2,119],39:[2,119],44:[2,119],45:[2,119],46:[2,119],55:[2,119],56:[2,119],59:[2,119],60:[2,119],61:[2,119],62:[2,119],63:[2,119],64:[2,119],65:[2,119],66:[2,119],67:[2,119],68:[2,119],69:[2,119],76:[2,119],79:[2,119],80:[2,119],89:[1,192],90:[1,193],103:[2,119]},{9:[1,73],11:[1,74],15:[1,75],46:[2,190],92:194,94:[1,101],103:[2,190]},{46:[2,192],93:195,103:[1,196]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:197,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,128],14:[2,128],21:[2,128],22:[2,128],24:[2,128],26:[2,128],27:[2,128],28:[2,128],32:[2,128],35:[1,46],36:[2,128],37:[2,128],39:[2,128],44:[2,128],45:[2,128],46:[2,128],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[2,128],69:[2,128],76:[2,128],79:[2,128],80:[2,128],103:[2,128]},{1:[2,129],14:[2,129],21:[2,129],22:[2,129],24:[2,129],26:[2,129],27:[2,129],28:[2,129],32:[2,129],35:[2,129],36:[2,129],37:[2,129],39:[2,129],44:[2,129],45:[2,129],46:[2,129],55:[2,129],56:[2,129],59:[2,129],60:[2,129],61:[2,129],62:[2,129],63:[2,129],64:[2,129],65:[2,129],66:[2,129],67:[2,129],68:[2,129],69:[2,129],76:[2,129],79:[2,129],80:[2,129],103:[2,129]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:198,16:[1,35],18:[1,36],19:63,22:[2,47],23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:199,14:[2,47],16:[1,35],18:[1,36],19:63,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{20:200,21:[2,52],35:[1,46],36:[1,201],39:[1,203],44:[2,52],45:[2,52],46:[2,52],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],77:202,79:[1,41]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:204,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{13:205,21:[2,55],44:[1,161],45:[2,55],46:[2,55]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:206,16:[1,35],18:[1,36],19:63,21:[2,47],23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{13:207,24:[2,55],44:[1,208],45:[2,55]},{22:[2,149],24:[2,149],44:[2,149],45:[2,149]},{4:[1,122],5:119,7:[1,123],8:[1,120],10:113,18:[1,210],22:[2,148],23:[1,121],25:[1,124],40:209,42:118,44:[2,148],45:[2,148],46:[1,112],47:[1,116],51:[1,117],56:[1,115],96:114,97:111},{9:[1,212],22:[2,133],24:[2,133],44:[2,133],45:[2,133],54:[2,133],60:[2,133],98:[1,211]},{22:[2,141],24:[2,141],44:[2,141],45:[2,141],54:[1,214],60:[1,213]},{4:[1,122],5:119,7:[1,123],8:[1,216],10:215,25:[1,124],42:118},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:217,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{22:[2,147],24:[2,147],44:[2,147],45:[2,147]},{1:[2,43],9:[2,43],11:[2,43],14:[2,43],15:[2,43],21:[2,43],22:[2,43],24:[2,43],26:[2,43],27:[2,43],28:[2,43],32:[2,43],34:[2,43],35:[2,43],36:[2,43],37:[2,43],39:[2,43],44:[2,43],45:[2,43],46:[2,43],53:[2,43],54:[2,43],55:[2,43],56:[2,43],59:[2,43],60:[2,43],61:[2,43],62:[2,43],63:[2,43],64:[2,43],65:[2,43],66:[2,43],67:[2,43],68:[2,43],69:[2,43],70:[2,43],76:[2,43],79:[2,43],80:[2,43],94:[2,43],98:[2,43],100:[2,43],101:[2,43],103:[2,43]},{1:[2,44],9:[2,44],11:[2,44],14:[2,44],15:[2,44],21:[2,44],22:[2,44],24:[2,44],26:[2,44],27:[2,44],28:[2,44],32:[2,44],34:[2,44],35:[2,44],36:[2,44],37:[2,44],39:[2,44],44:[2,44],45:[2,44],46:[2,44],53:[2,44],54:[2,44],55:[2,44],56:[2,44],59:[2,44],60:[2,44],61:[2,44],62:[2,44],63:[2,44],64:[2,44],65:[2,44],66:[2,44],67:[2,44],68:[2,44],69:[2,44],70:[2,44],76:[2,44],79:[2,44],80:[2,44],94:[2,44],98:[2,44],100:[2,44],101:[2,44],103:[2,44]},{9:[1,218],22:[2,134],24:[2,134],44:[2,134],45:[2,134],54:[2,134],60:[2,134]},{4:[1,122],5:119,7:[1,123],8:[1,120],10:113,18:[1,210],23:[1,121],24:[2,148],25:[1,124],40:219,42:118,44:[2,148],45:[2,148],46:[1,112],47:[1,116],51:[1,117],56:[1,115],96:114,97:111},{1:[2,45],9:[2,45],11:[2,45],14:[2,45],15:[2,45],21:[2,45],22:[2,45],24:[2,45],26:[2,45],27:[2,45],28:[2,45],32:[2,45],34:[2,45],35:[2,45],36:[2,45],37:[2,45],39:[2,45],44:[2,45],45:[2,45],46:[2,45],53:[2,45],54:[2,45],55:[2,45],56:[2,45],59:[2,45],60:[2,45],61:[2,45],62:[2,45],63:[2,45],64:[2,45],65:[2,45],66:[2,45],67:[2,45],68:[2,45],69:[2,45],70:[2,45],76:[2,45],79:[2,45],80:[2,45],94:[2,45],98:[2,45],100:[2,45],101:[2,45],103:[2,45]},{1:[2,46],9:[2,46],11:[2,46],14:[2,46],15:[2,46],21:[2,46],22:[2,46],24:[2,46],26:[2,46],27:[2,46],28:[2,46],32:[2,46],34:[2,46],35:[2,46],36:[2,46],37:[2,46],39:[2,46],44:[2,46],45:[2,46],46:[2,46],53:[2,46],54:[2,46],55:[2,46],56:[2,46],59:[2,46],60:[2,46],61:[2,46],62:[2,46],63:[2,46],64:[2,46],65:[2,46],66:[2,46],67:[2,46],68:[2,46],69:[2,46],70:[2,46],76:[2,46],79:[2,46],80:[2,46],94:[2,46],98:[2,46],100:[2,46],101:[2,46],103:[2,46]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],17:4,18:[1,36],19:7,23:[1,37],25:[1,38],27:[2,57],31:[1,8],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],45:[2,57],46:[1,6],47:[1,10],48:3,49:5,51:[1,9],52:[1,11],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29],99:134},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:221,23:[1,37],25:[1,38],27:[1,220],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{17:45,26:[1,222],27:[2,61],28:[1,223],35:[1,224],45:[2,61],46:[1,6],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:226,23:[1,37],25:[1,38],27:[1,225],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{11:[1,228],27:[1,227]},{27:[1,229]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:230,16:[1,35],18:[1,36],19:63,23:[1,37],25:[1,38],31:[1,65],32:[2,47],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:78,23:[1,37],25:[1,38],27:[1,231],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],46:[1,79],54:[1,77],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:76,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],23:[1,37],25:[1,38],27:[1,232],38:[1,39],39:[1,67]},{3:233,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],23:[1,37],25:[1,38],38:[1,39],39:[1,67]},{27:[1,234]},{17:235,35:[1,46],46:[1,6],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{17:236,35:[1,46],37:[1,238],46:[1,6],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],80:[1,237]},{9:[1,73],11:[1,74],15:[1,75],21:[2,71],22:[2,71],24:[2,71],34:[1,70],35:[2,71],37:[2,71],39:[2,71],45:[2,71],46:[2,71],53:[1,68],54:[1,69],55:[2,71],56:[2,71],59:[2,71],60:[2,71],61:[2,71],62:[2,71],63:[2,71],64:[2,71],65:[2,71],66:[2,71],67:[2,71],68:[2,71],69:[2,71],70:[1,71],76:[2,71],79:[2,71],80:[2,71],94:[1,72],100:[1,239]},{9:[2,1],11:[2,1],15:[2,1],21:[2,1],22:[2,1],24:[2,1],34:[2,1],35:[2,1],37:[2,1],39:[2,1],44:[1,241],45:[2,1],46:[2,1],53:[2,1],54:[2,1],55:[2,1],56:[2,1],59:[2,1],60:[2,1],61:[2,1],62:[2,1],63:[2,1],64:[2,1],65:[2,1],66:[2,1],67:[2,1],68:[2,1],69:[2,1],70:[2,1],76:[2,1],79:[2,1],80:[2,1],94:[2,1],100:[2,1],101:[1,240],102:[1,242]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:243,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{21:[2,179],22:[2,179],24:[2,179],35:[1,46],39:[2,179],44:[1,245],45:[2,179],46:[2,179],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,179],80:[1,244]},{1:[2,59],22:[2,59],27:[2,59],45:[2,59]},{1:[2,156],27:[2,156],45:[1,42]},{1:[2,67],9:[2,67],11:[2,67],14:[2,67],15:[2,67],21:[2,67],22:[2,67],24:[2,67],26:[2,67],27:[2,67],28:[2,67],32:[2,67],34:[2,67],35:[2,67],36:[2,67],37:[2,67],39:[2,67],44:[2,67],45:[2,67],46:[2,67],53:[2,67],54:[2,67],55:[2,67],56:[2,67],59:[2,67],60:[2,67],61:[2,67],62:[2,67],63:[2,67],64:[2,67],65:[2,67],66:[2,67],67:[2,67],68:[2,67],69:[2,67],70:[2,67],76:[2,67],79:[2,67],80:[2,67],86:[2,67],87:[2,67],89:[2,67],90:[2,67],94:[2,67],100:[2,67],101:[2,67],103:[2,67]},{9:[1,73],11:[1,74],15:[1,75],35:[1,246]},{1:[2,74],14:[2,74],21:[2,74],22:[2,74],24:[2,74],26:[2,74],27:[2,74],28:[2,74],32:[2,74],35:[1,46],36:[2,74],37:[2,74],39:[2,74],44:[2,74],45:[2,74],46:[2,74],55:[2,74],56:[1,48],59:[2,74],60:[2,74],61:[1,51],62:[1,52],63:[2,74],64:[2,74],65:[2,74],66:[1,56],67:[2,74],68:[2,74],69:[2,74],76:[2,74],79:[2,74],80:[2,74],103:[2,74]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:247,16:[1,35],18:[1,36],19:63,22:[2,47],23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,86],14:[2,86],21:[2,86],22:[2,86],24:[2,86],26:[2,86],27:[2,86],28:[2,86],32:[2,86],35:[1,46],36:[2,86],37:[2,86],39:[2,86],44:[2,86],45:[2,86],46:[2,86],55:[2,86],56:[2,86],59:[2,86],60:[2,86],61:[1,51],62:[1,52],63:[2,86],64:[2,86],65:[2,86],66:[1,56],67:[2,86],68:[2,86],69:[2,86],76:[2,86],79:[2,86],80:[2,86],103:[2,86]},{1:[2,87],14:[2,87],21:[2,87],22:[2,87],24:[2,87],26:[2,87],27:[2,87],28:[2,87],32:[2,87],35:[1,46],36:[2,87],37:[2,87],39:[2,87],44:[2,87],45:[2,87],46:[2,87],55:[1,47],56:[1,48],59:[1,49],60:[2,87],61:[1,51],62:[1,52],63:[1,53],64:[2,87],65:[1,55],66:[1,56],67:[1,57],68:[2,87],69:[2,87],76:[2,87],79:[2,87],80:[2,87],103:[2,87]},{1:[2,88],14:[2,88],21:[2,88],22:[2,88],24:[2,88],26:[2,88],27:[2,88],28:[2,88],32:[2,88],35:[1,46],36:[2,88],37:[2,88],39:[2,88],44:[2,88],45:[2,88],46:[2,88],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[2,88],69:[2,88],76:[2,88],79:[2,88],80:[2,88],103:[2,88]},{1:[2,89],14:[2,89],21:[2,89],22:[2,89],24:[2,89],26:[2,89],27:[2,89],28:[2,89],32:[2,89],35:[1,46],36:[2,89],37:[2,89],39:[2,89],44:[2,89],45:[2,89],46:[2,89],55:[2,89],56:[2,89],59:[2,89],60:[2,89],61:[2,89],62:[1,52],63:[2,89],64:[2,89],65:[2,89],66:[1,56],67:[2,89],68:[2,89],69:[2,89],76:[2,89],79:[2,89],80:[2,89],103:[2,89]},{1:[2,90],14:[2,90],21:[2,90],22:[2,90],24:[2,90],26:[2,90],27:[2,90],28:[2,90],32:[2,90],35:[1,46],36:[2,90],37:[2,90],39:[2,90],44:[2,90],45:[2,90],46:[2,90],55:[2,90],56:[2,90],59:[2,90],60:[2,90],61:[2,90],62:[1,52],63:[2,90],64:[2,90],65:[2,90],66:[1,56],67:[2,90],68:[2,90],69:[2,90],76:[2,90],79:[2,90],80:[2,90],103:[2,90]},{1:[2,91],14:[2,91],21:[2,91],22:[2,91],24:[2,91],26:[2,91],27:[2,91],28:[2,91],32:[2,91],35:[1,46],36:[2,91],37:[2,91],39:[2,91],44:[2,91],45:[2,91],46:[2,91],55:[2,91],56:[1,48],59:[2,91],60:[2,91],61:[1,51],62:[1,52],63:[2,91],64:[2,91],65:[2,91],66:[1,56],67:[2,91],68:[2,91],69:[2,91],76:[2,91],79:[2,91],80:[2,91],103:[2,91]},{1:[2,92],14:[2,92],21:[2,92],22:[2,92],24:[2,92],26:[2,92],27:[2,92],28:[2,92],32:[2,92],35:[1,46],36:[2,92],37:[2,92],39:[2,92],44:[2,92],45:[2,92],46:[2,92],55:[1,47],56:[1,48],59:[1,49],60:[2,92],61:[1,51],62:[1,52],63:[1,53],64:[2,92],65:[1,55],66:[1,56],67:[1,57],68:[2,92],69:[2,92],76:[2,92],79:[2,92],80:[2,92],103:[2,92]},{1:[2,93],14:[2,93],21:[2,93],22:[2,93],24:[2,93],26:[2,93],27:[2,93],28:[2,93],32:[2,93],35:[1,46],36:[2,93],37:[2,93],39:[2,93],44:[2,93],45:[2,93],46:[2,93],55:[1,47],56:[1,48],59:[2,93],60:[2,93],61:[1,51],62:[1,52],63:[1,53],64:[2,93],65:[1,55],66:[1,56],67:[2,93],68:[2,93],69:[2,93],76:[2,93],79:[2,93],80:[2,93],103:[2,93]},{1:[2,94],14:[2,94],21:[2,94],22:[2,94],24:[2,94],26:[2,94],27:[2,94],28:[2,94],32:[2,94],35:[1,46],36:[2,94],37:[2,94],39:[2,94],44:[2,94],45:[2,94],46:[2,94],55:[2,94],56:[2,94],59:[2,94],60:[2,94],61:[2,94],62:[2,94],63:[2,94],64:[2,94],65:[2,94],66:[1,56],67:[2,94],68:[2,94],69:[2,94],76:[2,94],79:[2,94],80:[2,94],103:[2,94]},{1:[2,95],14:[2,95],21:[2,95],22:[2,95],24:[2,95],26:[2,95],27:[2,95],28:[2,95],32:[2,95],35:[1,46],36:[2,95],37:[2,95],39:[2,95],44:[2,95],45:[2,95],46:[2,95],55:[1,47],56:[1,48],59:[2,95],60:[2,95],61:[1,51],62:[1,52],63:[1,53],64:[2,95],65:[1,55],66:[1,56],67:[2,95],68:[2,95],69:[2,95],76:[2,95],79:[2,95],80:[2,95],103:[2,95]},{1:[2,96],14:[2,96],21:[2,96],22:[2,96],24:[2,96],26:[2,96],27:[2,96],28:[2,96],32:[2,96],35:[1,46],36:[2,96],37:[2,96],39:[2,96],44:[2,96],45:[2,96],46:[2,96],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[2,96],69:[2,96],76:[2,96],79:[2,96],80:[2,96],103:[2,96]},{1:[2,97],14:[2,97],21:[2,97],22:[2,97],24:[2,97],26:[2,97],27:[2,97],28:[2,97],32:[2,97],35:[1,46],36:[2,97],37:[2,97],39:[2,97],44:[2,97],45:[2,97],46:[2,97],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[2,97],79:[2,97],80:[2,97],103:[2,97]},{1:[2,103],14:[2,103],21:[2,103],22:[2,103],24:[2,103],26:[2,103],27:[2,103],28:[2,103],32:[2,103],35:[1,46],36:[2,103],37:[2,103],39:[2,103],44:[2,103],45:[2,103],46:[2,103],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[2,103],79:[2,103],80:[2,103],103:[2,103]},{32:[1,248],45:[1,249],46:[1,250]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],14:[2,56],16:[1,35],18:[1,36],19:63,21:[2,56],22:[2,56],23:[1,37],25:[1,38],31:[1,65],32:[2,56],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:251,45:[2,56],46:[2,56],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{14:[2,53],21:[2,53],22:[2,53],32:[2,53],35:[1,46],44:[2,53],45:[2,53],46:[2,53],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{13:252,32:[2,55],44:[1,161],45:[2,55],46:[2,55]},{17:236,35:[1,46],46:[1,6],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{1:[2,68],14:[2,68],21:[2,68],22:[2,68],24:[2,68],26:[2,68],27:[2,68],28:[2,68],32:[2,68],35:[1,46],36:[2,68],37:[2,68],39:[2,68],44:[2,68],45:[2,68],46:[2,68],55:[2,68],56:[1,48],59:[2,68],60:[2,68],61:[1,51],62:[1,52],63:[2,68],64:[2,68],65:[2,68],66:[1,56],67:[2,68],68:[2,68],69:[2,68],76:[2,68],79:[2,68],80:[2,68],103:[2,68]},{1:[2,69],14:[2,69],21:[2,69],22:[2,69],24:[2,69],26:[2,69],27:[2,69],28:[2,69],32:[2,69],35:[2,69],36:[2,69],37:[2,69],39:[2,69],44:[2,69],45:[2,69],46:[2,69],55:[2,69],56:[2,69],59:[2,69],60:[2,69],61:[2,69],62:[2,69],63:[2,69],64:[2,69],65:[2,69],66:[2,69],67:[2,69],68:[2,69],69:[2,69],76:[2,69],79:[2,69],80:[2,69],103:[2,69]},{1:[2,72],14:[2,72],21:[2,72],22:[2,72],24:[2,72],26:[2,72],27:[2,72],28:[2,72],32:[2,72],35:[1,46],36:[2,72],37:[2,72],39:[2,72],44:[2,72],45:[2,72],46:[2,72],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[2,72],79:[2,72],80:[2,72],103:[2,72]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:253,16:[1,35],18:[1,36],19:63,22:[2,47],23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,127],14:[2,127],21:[2,127],22:[2,127],24:[2,127],26:[2,127],27:[2,127],28:[2,127],32:[2,127],35:[1,46],36:[2,127],37:[2,127],39:[2,127],44:[2,127],45:[2,127],46:[2,127],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[2,127],69:[2,127],76:[2,127],79:[2,127],80:[2,127],103:[2,127]},{1:[2,6],9:[2,6],11:[2,6],14:[2,6],15:[2,6],21:[2,6],22:[2,6],24:[2,6],26:[2,6],27:[2,6],28:[2,6],32:[2,6],34:[2,6],35:[2,6],36:[2,6],37:[2,6],39:[2,6],44:[2,6],45:[2,6],46:[2,6],53:[2,6],54:[2,6],55:[2,6],56:[2,6],59:[2,6],60:[2,6],61:[2,6],62:[2,6],63:[2,6],64:[2,6],65:[2,6],66:[2,6],67:[2,6],68:[2,6],69:[2,6],70:[2,6],76:[2,6],79:[2,6],80:[2,6],94:[2,6],100:[2,6],101:[2,6],103:[2,6]},{1:[2,7],9:[2,7],11:[2,7],14:[2,7],15:[2,7],21:[2,7],22:[2,7],24:[2,7],26:[2,7],27:[2,7],28:[2,7],32:[2,7],34:[2,7],35:[2,7],36:[2,7],37:[2,7],39:[2,7],44:[2,7],45:[2,7],46:[2,7],53:[2,7],54:[2,7],55:[2,7],56:[2,7],59:[2,7],60:[2,7],61:[2,7],62:[2,7],63:[2,7],64:[2,7],65:[2,7],66:[2,7],67:[2,7],68:[2,7],69:[2,7],70:[2,7],76:[2,7],79:[2,7],80:[2,7],94:[2,7],100:[2,7],101:[2,7],103:[2,7]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:108,16:[1,35],18:[1,36],19:254,21:[2,47],23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],36:[1,255],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{4:[1,122],5:119,7:[1,123],8:[1,120],10:113,18:[1,210],23:[1,121],24:[2,148],25:[1,124],40:110,42:118,44:[2,148],45:[2,148],46:[1,112],47:[1,116],51:[1,117],56:[1,115],96:114,97:111},{13:256,14:[2,55],44:[1,161],45:[2,55],46:[2,55]},{1:[2,78],9:[1,73],11:[1,74],14:[2,78],15:[1,75],21:[2,78],22:[2,78],24:[2,78],26:[2,78],27:[2,78],28:[2,78],32:[2,78],35:[2,78],36:[2,78],37:[2,78],39:[2,78],44:[2,78],45:[2,78],46:[2,78],55:[2,78],56:[2,78],59:[2,78],60:[2,78],61:[2,78],62:[2,78],63:[2,78],64:[2,78],65:[2,78],66:[2,78],67:[2,78],68:[2,78],69:[2,78],76:[2,78],79:[2,78],80:[2,78],103:[2,78]},{13:257,22:[2,55],44:[1,161],45:[2,55],46:[2,55]},{1:[2,79],9:[1,73],11:[1,74],14:[2,79],15:[1,75],21:[2,79],22:[2,79],24:[2,79],26:[2,79],27:[2,79],28:[2,79],32:[2,79],35:[2,79],36:[2,79],37:[2,79],39:[2,79],44:[2,79],45:[2,79],46:[2,79],55:[2,79],56:[2,79],59:[2,79],60:[2,79],61:[2,79],62:[2,79],63:[2,79],64:[2,79],65:[2,79],66:[2,79],67:[2,79],68:[2,79],69:[2,79],76:[2,79],79:[2,79],80:[2,79],103:[2,79]},{1:[2,80],9:[1,73],11:[1,74],14:[2,80],15:[1,75],21:[2,80],22:[2,80],24:[2,80],26:[2,80],27:[2,80],28:[2,80],32:[2,80],35:[2,80],36:[2,80],37:[2,80],39:[2,80],44:[2,80],45:[2,80],46:[2,80],55:[2,80],56:[2,80],59:[2,80],60:[2,80],61:[2,80],62:[2,80],63:[2,80],64:[2,80],65:[2,80],66:[2,80],67:[2,80],68:[2,80],69:[2,80],76:[2,80],79:[2,80],80:[2,80],103:[2,80]},{13:258,14:[2,55],44:[1,161],45:[2,55],46:[2,55]},{13:259,14:[2,55],44:[1,161],45:[2,55],46:[2,55]},{1:[2,157],14:[2,157],21:[2,157],22:[2,157],24:[2,157],26:[2,157],27:[2,157],28:[2,157],32:[2,157],35:[2,157],36:[2,157],37:[2,157],39:[2,157],44:[2,157],45:[2,157],46:[2,157],55:[2,157],56:[2,157],59:[2,157],60:[2,157],61:[2,157],62:[2,157],63:[2,157],64:[2,157],65:[2,157],66:[2,157],67:[2,157],68:[2,157],69:[2,157],75:260,76:[2,157],79:[2,157],80:[2,157],87:[1,183],103:[2,157]},{1:[2,104],14:[2,104],21:[2,104],22:[2,104],24:[2,104],26:[2,104],27:[2,104],28:[2,104],32:[2,104],35:[2,104],36:[2,104],37:[2,104],39:[2,104],44:[2,104],45:[2,104],46:[2,104],55:[2,104],56:[2,104],59:[2,104],60:[2,104],61:[2,104],62:[2,104],63:[2,104],64:[2,104],65:[2,104],66:[2,104],67:[2,104],68:[2,104],69:[2,104],76:[2,104],79:[2,104],80:[2,104],103:[2,104]},{17:261,46:[1,6],74:[1,262]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:263,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{13:264,22:[2,55],44:[1,161],45:[2,55],46:[2,55]},{1:[2,112],14:[2,112],21:[2,112],22:[2,112],24:[2,112],26:[2,112],27:[2,112],28:[2,112],32:[2,112],35:[2,112],36:[2,112],37:[2,112],39:[2,112],44:[2,112],45:[2,112],46:[2,112],55:[2,112],56:[2,112],59:[2,112],60:[2,112],61:[2,112],62:[2,112],63:[2,112],64:[2,112],65:[2,112],66:[2,112],67:[2,112],68:[2,112],69:[2,112],76:[2,112],79:[2,112],80:[1,190],86:[1,265],87:[1,266],103:[2,112]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:267,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{17:268,46:[1,6]},{17:269,46:[1,6]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:96,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],84:270,88:[1,26],91:[1,27],95:[1,29]},{17:271,44:[1,187],46:[1,6]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],17:272,18:[1,36],19:63,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:273,46:[1,6],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{17:274,46:[1,6]},{46:[2,192],93:275,103:[1,196]},{17:276,46:[1,6]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:96,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],84:277,88:[1,26],91:[1,27],95:[1,29]},{35:[1,46],46:[2,189],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],103:[2,189]},{13:278,22:[2,55],44:[1,161],45:[2,55],46:[2,55]},{13:279,14:[2,55],44:[1,161],45:[2,55],46:[2,55]},{21:[1,280],22:[1,281],39:[1,203],45:[1,283],46:[1,284],77:282,79:[1,41]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:285,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{21:[2,183],22:[2,183],24:[2,183],39:[2,183],45:[2,183],46:[2,183],79:[2,183]},{3:137,4:[1,138],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:286,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29],102:[1,139]},{21:[1,287],35:[1,46],37:[1,288],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{21:[1,289],45:[1,249],46:[1,250]},{13:290,21:[2,55],44:[1,161],45:[2,55],46:[2,55]},{24:[1,291],45:[1,292]},{4:[1,122],5:119,7:[1,123],8:[1,120],10:113,18:[1,210],22:[2,56],23:[1,121],24:[2,56],25:[1,124],42:118,45:[2,56],47:[1,116],51:[1,117],56:[1,115],96:114,97:293},{13:294,22:[2,55],44:[1,208],45:[2,55]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:295,16:[1,35],18:[1,36],19:63,21:[2,47],23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:296,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],46:[1,297],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{4:[1,122],7:[1,123],42:298},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:299,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:300,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{22:[2,144],24:[2,144],44:[2,144],45:[2,144]},{22:[2,145],24:[2,145],44:[2,145],45:[2,145]},{22:[2,146],24:[2,146],35:[1,46],44:[2,146],45:[2,146],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{4:[1,122],7:[1,123],42:301},{13:302,24:[2,55],44:[1,208],45:[2,55]},{1:[2,14],9:[2,14],11:[2,14],14:[2,14],15:[2,14],21:[2,14],22:[2,14],24:[2,14],26:[2,14],27:[2,14],28:[2,14],32:[2,14],34:[2,14],35:[2,14],36:[2,14],37:[2,14],39:[2,14],44:[2,14],45:[2,14],46:[2,14],53:[2,14],54:[2,14],55:[2,14],56:[2,14],59:[2,14],60:[2,14],61:[2,14],62:[2,14],63:[2,14],64:[2,14],65:[2,14],66:[2,14],67:[2,14],68:[2,14],69:[2,14],70:[2,14],76:[2,14],79:[2,14],80:[2,14],94:[2,14],100:[2,14],101:[2,14],103:[2,14]},{27:[1,303],35:[1,46],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{27:[1,304]},{27:[1,305]},{3:306,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],23:[1,37],25:[1,38],38:[1,39],39:[1,67]},{1:[2,17],9:[2,17],11:[2,17],14:[2,17],15:[2,17],21:[2,17],22:[2,17],24:[2,17],26:[2,17],27:[2,17],28:[2,17],32:[2,17],34:[2,17],35:[2,17],36:[2,17],37:[2,17],39:[2,17],44:[2,17],45:[2,17],46:[2,17],53:[2,17],54:[2,17],55:[2,17],56:[2,17],59:[2,17],60:[2,17],61:[2,17],62:[2,17],63:[2,17],64:[2,17],65:[2,17],66:[2,17],67:[2,17],68:[2,17],69:[2,17],70:[2,17],76:[2,17],79:[2,17],80:[2,17],94:[2,17],100:[2,17],101:[2,17],103:[2,17]},{27:[1,307],35:[1,46],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{1:[2,20],9:[2,20],11:[2,20],14:[2,20],15:[2,20],21:[2,20],22:[2,20],24:[2,20],26:[2,20],27:[2,20],28:[2,20],32:[2,20],34:[2,20],35:[2,20],36:[2,20],37:[2,20],39:[2,20],44:[2,20],45:[2,20],46:[2,20],53:[2,20],54:[2,20],55:[2,20],56:[2,20],59:[2,20],60:[2,20],61:[2,20],62:[2,20],63:[2,20],64:[2,20],65:[2,20],66:[2,20],67:[2,20],68:[2,20],69:[2,20],70:[2,20],76:[2,20],79:[2,20],80:[2,20],94:[2,20],100:[2,20],101:[2,20],103:[2,20]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:308,14:[2,47],16:[1,35],18:[1,36],19:63,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,22],9:[2,22],11:[2,22],14:[2,22],15:[2,22],21:[2,22],22:[2,22],24:[2,22],26:[2,22],27:[2,22],28:[2,22],32:[2,22],34:[2,22],35:[2,22],36:[2,22],37:[2,22],39:[2,22],44:[2,22],45:[2,22],46:[2,22],53:[2,22],54:[2,22],55:[2,22],56:[2,22],59:[2,22],60:[2,22],61:[2,22],62:[2,22],63:[2,22],64:[2,22],65:[2,22],66:[2,22],67:[2,22],68:[2,22],69:[2,22],70:[2,22],76:[2,22],79:[2,22],80:[2,22],94:[2,22],100:[2,22],101:[2,22],103:[2,22]},{13:309,32:[2,55],44:[1,161],45:[2,55],46:[2,55]},{1:[2,24],9:[2,24],11:[2,24],14:[2,24],15:[2,24],21:[2,24],22:[2,24],24:[2,24],26:[2,24],27:[2,24],28:[2,24],32:[2,24],34:[2,24],35:[2,24],36:[2,24],37:[2,24],39:[2,24],44:[2,24],45:[2,24],46:[2,24],53:[2,24],54:[2,24],55:[2,24],56:[2,24],59:[2,24],60:[2,24],61:[2,24],62:[2,24],63:[2,24],64:[2,24],65:[2,24],66:[2,24],67:[2,24],68:[2,24],69:[2,24],70:[2,24],76:[2,24],79:[2,24],80:[2,24],94:[2,24],100:[2,24],101:[2,24],103:[2,24]},{1:[2,25],9:[2,25],11:[2,25],14:[2,25],15:[2,25],21:[2,25],22:[2,25],24:[2,25],26:[2,25],27:[2,25],28:[2,25],32:[2,25],34:[2,25],35:[2,25],36:[2,25],37:[2,25],39:[2,25],44:[2,25],45:[2,25],46:[2,25],53:[2,25],54:[2,25],55:[2,25],56:[2,25],59:[2,25],60:[2,25],61:[2,25],62:[2,25],63:[2,25],64:[2,25],65:[2,25],66:[2,25],67:[2,25],68:[2,25],69:[2,25],70:[2,25],76:[2,25],79:[2,25],80:[2,25],94:[2,25],100:[2,25],101:[2,25],103:[2,25]},{9:[1,73],11:[1,74],15:[1,75],35:[1,310]},{1:[2,153],9:[2,153],11:[2,153],14:[2,153],15:[2,153],21:[2,153],22:[2,153],24:[2,153],26:[2,153],27:[2,153],28:[2,153],32:[2,153],34:[2,153],35:[2,153],36:[2,153],37:[2,153],39:[2,153],44:[2,153],45:[2,153],46:[2,153],53:[2,153],54:[2,153],55:[2,153],56:[2,153],59:[2,153],60:[2,153],61:[2,153],62:[2,153],63:[2,153],64:[2,153],65:[2,153],66:[2,153],67:[2,153],68:[2,153],69:[2,153],70:[2,153],76:[2,153],79:[2,153],80:[2,153],94:[2,153],98:[2,153],100:[2,153],101:[2,153],103:[2,153]},{1:[2,37],9:[2,37],11:[2,37],14:[2,37],15:[2,37],21:[2,37],22:[2,37],24:[2,37],26:[2,37],27:[2,37],28:[2,37],32:[2,37],34:[2,37],35:[2,37],36:[2,37],37:[2,37],39:[2,37],44:[2,37],45:[2,37],46:[2,37],53:[2,37],54:[2,37],55:[2,37],56:[2,37],59:[2,37],60:[2,37],61:[2,37],62:[2,37],63:[2,37],64:[2,37],65:[2,37],66:[2,37],67:[2,37],68:[2,37],69:[2,37],70:[2,37],76:[2,37],79:[2,37],80:[2,37],94:[2,37],100:[2,37],101:[2,37],103:[2,37]},{1:[2,38],9:[2,38],11:[2,38],14:[2,38],15:[2,38],21:[2,38],22:[2,38],24:[2,38],26:[2,38],27:[2,38],28:[2,38],32:[2,38],34:[2,38],35:[2,38],36:[2,38],37:[2,38],39:[2,38],44:[2,38],45:[2,38],46:[2,38],53:[2,38],54:[2,38],55:[2,38],56:[2,38],59:[2,38],60:[2,38],61:[2,38],62:[2,38],63:[2,38],64:[2,38],65:[2,38],66:[2,38],67:[2,38],68:[2,38],69:[2,38],70:[2,38],76:[2,38],79:[2,38],80:[2,38],94:[2,38],100:[2,38],101:[2,38],103:[2,38]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:311,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:312,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:313,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:314,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:315,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],23:[1,37],25:[1,38],38:[1,39],39:[1,67]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:316,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{35:[1,46],36:[1,317],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:318,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:319,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:320,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{13:321,22:[2,55],44:[1,161],45:[2,55],46:[2,55]},{50:[1,322],71:[1,323]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:63,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:324,47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:325,16:[1,35],18:[1,36],19:63,22:[2,47],23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{14:[2,49],21:[2,49],22:[2,49],32:[2,49],44:[2,49],45:[2,49],46:[2,49]},{32:[1,326],45:[1,249],46:[1,250]},{13:327,22:[2,55],44:[1,161],45:[2,55],46:[2,55]},{21:[2,52],35:[1,46],36:[1,328],44:[2,52],45:[2,52],46:[2,52],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:329,21:[1,330],23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{14:[1,331],45:[1,249],46:[1,250]},{22:[1,332],45:[1,249],46:[1,250]},{14:[1,333],45:[1,249],46:[1,250]},{14:[1,334],45:[1,249],46:[1,250]},{1:[2,102],14:[2,102],21:[2,102],22:[2,102],24:[2,102],26:[2,102],27:[2,102],28:[2,102],32:[2,102],35:[2,102],36:[2,102],37:[2,102],39:[2,102],44:[2,102],45:[2,102],46:[2,102],55:[2,102],56:[2,102],59:[2,102],60:[2,102],61:[2,102],62:[2,102],63:[2,102],64:[2,102],65:[2,102],66:[2,102],67:[2,102],68:[2,102],69:[2,102],76:[2,102],79:[2,102],80:[2,102],103:[2,102]},{1:[2,158],14:[2,158],21:[2,158],22:[2,158],24:[2,158],26:[2,158],27:[2,158],28:[2,158],32:[2,158],35:[2,158],36:[2,158],37:[2,158],39:[2,158],44:[2,158],45:[2,158],46:[2,158],55:[2,158],56:[2,158],59:[2,158],60:[2,158],61:[2,158],62:[2,158],63:[2,158],64:[2,158],65:[2,158],66:[2,158],67:[2,158],68:[2,158],69:[2,158],76:[2,158],79:[2,158],80:[2,158],103:[2,158]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:335,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,105],14:[2,105],21:[2,105],22:[2,105],24:[2,105],26:[2,105],27:[2,105],28:[2,105],32:[2,105],35:[1,46],36:[2,105],37:[2,105],39:[2,105],44:[2,105],45:[2,105],46:[2,105],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[2,105],69:[2,105],76:[2,105],79:[2,105],80:[1,336],103:[2,105]},{22:[1,337],45:[1,249],46:[1,250]},{17:338,46:[1,6]},{17:339,46:[1,6]},{35:[1,46],44:[2,132],46:[2,132],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],80:[2,132]},{1:[2,116],14:[2,116],21:[2,116],22:[2,116],24:[2,116],26:[2,116],27:[2,116],28:[2,116],32:[2,116],35:[2,116],36:[2,116],37:[2,116],39:[2,116],44:[2,116],45:[2,116],46:[2,116],55:[2,116],56:[2,116],59:[2,116],60:[2,116],61:[2,116],62:[2,116],63:[2,116],64:[2,116],65:[2,116],66:[2,116],67:[2,116],68:[2,116],69:[2,116],76:[2,116],79:[2,116],80:[2,116],103:[2,116]},{1:[2,117],14:[2,117],21:[2,117],22:[2,117],24:[2,117],26:[2,117],27:[2,117],28:[2,117],32:[2,117],35:[2,117],36:[2,117],37:[2,117],39:[2,117],44:[2,117],45:[2,117],46:[2,117],55:[2,117],56:[2,117],59:[2,117],60:[2,117],61:[2,117],62:[2,117],63:[2,117],64:[2,117],65:[2,117],66:[2,117],67:[2,117],68:[2,117],69:[2,117],76:[2,117],79:[2,117],80:[2,117],103:[2,117]},{17:340,44:[1,187],46:[1,6]},{1:[2,187],14:[2,187],21:[2,187],22:[2,187],24:[2,187],26:[2,187],27:[2,187],28:[2,187],32:[2,187],35:[2,187],36:[2,187],37:[2,187],39:[2,187],44:[2,187],45:[2,187],46:[2,187],55:[2,187],56:[2,187],59:[2,187],60:[2,187],61:[2,187],62:[2,187],63:[2,187],64:[2,187],65:[2,187],66:[2,187],67:[2,187],68:[2,187],69:[2,187],76:[2,187],79:[2,187],80:[2,187],86:[2,187],87:[2,187],103:[2,187]},{1:[2,120],14:[2,120],21:[2,120],22:[2,120],24:[2,120],26:[2,120],27:[2,120],28:[2,120],32:[2,120],35:[2,120],36:[2,120],37:[2,120],39:[2,120],44:[2,120],45:[2,120],46:[2,120],55:[2,120],56:[2,120],59:[2,120],60:[2,120],61:[2,120],62:[2,120],63:[2,120],64:[2,120],65:[2,120],66:[2,120],67:[2,120],68:[2,120],69:[2,120],76:[2,120],79:[2,120],80:[2,120],90:[1,341],103:[2,120]},{17:342,46:[1,6]},{1:[2,124],14:[2,124],21:[2,124],22:[2,124],24:[2,124],26:[2,124],27:[2,124],28:[2,124],32:[2,124],35:[2,124],36:[2,124],37:[2,124],39:[2,124],44:[2,124],45:[2,124],46:[2,124],55:[2,124],56:[2,124],59:[2,124],60:[2,124],61:[2,124],62:[2,124],63:[2,124],64:[2,124],65:[2,124],66:[2,124],67:[2,124],68:[2,124],69:[2,124],76:[2,124],79:[2,124],80:[2,124],103:[2,124]},{17:343,46:[1,6]},{1:[2,126],14:[2,126],21:[2,126],22:[2,126],24:[2,126],26:[2,126],27:[2,126],28:[2,126],32:[2,126],35:[2,126],36:[2,126],37:[2,126],39:[2,126],44:[2,126],45:[2,126],46:[2,126],55:[2,126],56:[2,126],59:[2,126],60:[2,126],61:[2,126],62:[2,126],63:[2,126],64:[2,126],65:[2,126],66:[2,126],67:[2,126],68:[2,126],69:[2,126],76:[2,126],79:[2,126],80:[2,126],103:[2,126]},{44:[1,187],46:[2,191]},{22:[1,344],45:[1,249],46:[1,250]},{14:[1,345],45:[1,249],46:[1,250]},{1:[2,11],9:[2,11],11:[2,11],14:[2,11],15:[2,11],21:[2,11],22:[2,11],24:[2,11],26:[2,11],27:[2,11],28:[2,11],32:[2,11],34:[2,11],35:[2,11],36:[2,11],37:[2,11],39:[2,11],44:[2,11],45:[2,11],46:[2,11],53:[2,11],54:[2,11],55:[2,11],56:[2,11],59:[2,11],60:[2,11],61:[2,11],62:[2,11],63:[2,11],64:[2,11],65:[2,11],66:[2,11],67:[2,11],68:[2,11],69:[2,11],70:[2,11],76:[2,11],79:[2,11],80:[2,11],94:[2,11],100:[2,11],101:[2,11],103:[2,11]},{21:[1,346]},{21:[2,184],22:[2,184],24:[2,184],39:[2,184],45:[2,184],46:[2,184],79:[2,184]},{39:[1,203],77:347,79:[1,41]},{39:[1,203],77:348,79:[1,41]},{21:[1,349],35:[1,46],37:[1,350],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{21:[2,164],22:[2,164],24:[2,164],35:[1,46],37:[1,238],39:[2,164],45:[2,164],46:[2,164],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,164],80:[1,237]},{1:[2,31],9:[2,31],11:[2,31],14:[2,31],15:[2,31],21:[2,31],22:[2,31],24:[2,31],26:[2,31],27:[2,31],28:[2,31],32:[2,31],34:[2,31],35:[2,31],36:[2,31],37:[2,31],39:[2,31],44:[2,31],45:[2,31],46:[2,31],53:[2,31],54:[2,31],55:[2,31],56:[2,31],59:[2,31],60:[2,31],61:[2,31],62:[2,31],63:[2,31],64:[2,31],65:[2,31],66:[2,31],67:[2,31],68:[2,31],69:[2,31],70:[2,31],76:[2,31],79:[2,31],80:[2,31],94:[2,31],100:[2,31],101:[2,31],103:[2,31]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:351,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,39],9:[2,39],11:[2,39],14:[2,39],15:[2,39],21:[2,39],22:[2,39],24:[2,39],26:[2,39],27:[2,39],28:[2,39],32:[2,39],34:[2,39],35:[2,39],36:[2,39],37:[2,39],39:[2,39],41:[1,352],44:[2,39],45:[2,39],46:[2,39],53:[2,39],54:[2,39],55:[2,39],56:[2,39],59:[2,39],60:[2,39],61:[2,39],62:[2,39],63:[2,39],64:[2,39],65:[2,39],66:[2,39],67:[2,39],68:[2,39],69:[2,39],70:[2,39],76:[2,39],79:[2,39],80:[2,39],94:[2,39],100:[2,39],101:[2,39],103:[2,39]},{21:[1,353],45:[1,249],46:[1,250]},{1:[2,40],9:[2,40],11:[2,40],14:[2,40],15:[2,40],21:[2,40],22:[2,40],24:[2,40],26:[2,40],27:[2,40],28:[2,40],32:[2,40],34:[2,40],35:[2,40],36:[2,40],37:[2,40],39:[2,40],41:[1,354],44:[2,40],45:[2,40],46:[2,40],53:[2,40],54:[2,40],55:[2,40],56:[2,40],59:[2,40],60:[2,40],61:[2,40],62:[2,40],63:[2,40],64:[2,40],65:[2,40],66:[2,40],67:[2,40],68:[2,40],69:[2,40],70:[2,40],76:[2,40],79:[2,40],80:[2,40],94:[2,40],100:[2,40],101:[2,40],103:[2,40]},{4:[1,122],5:119,7:[1,123],8:[1,120],10:113,18:[1,210],23:[1,121],25:[1,124],42:118,47:[1,116],51:[1,117],56:[1,115],96:114,97:355},{22:[2,150],24:[2,150],44:[2,150],45:[2,150]},{22:[1,356],45:[1,292]},{13:357,21:[2,55],44:[1,161],45:[2,55],46:[2,55]},{22:[2,139],24:[2,139],35:[1,46],44:[2,139],45:[2,139],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],12:358,16:[1,35],18:[1,36],19:63,22:[2,47],23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],43:62,44:[2,47],45:[2,47],46:[2,47],47:[1,64],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{22:[2,135],24:[2,135],44:[2,135],45:[2,135],54:[2,135],60:[2,135]},{22:[2,142],24:[2,142],35:[1,46],44:[2,142],45:[2,142],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{22:[2,143],24:[2,143],35:[1,46],44:[2,143],45:[2,143],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{22:[2,136],24:[2,136],44:[2,136],45:[2,136],54:[2,136],60:[2,136]},{24:[1,359],45:[1,292]},{1:[2,15],9:[2,15],11:[2,15],14:[2,15],15:[2,15],21:[2,15],22:[2,15],24:[2,15],26:[2,15],27:[2,15],28:[2,15],32:[2,15],34:[2,15],35:[2,15],36:[2,15],37:[2,15],39:[2,15],44:[2,15],45:[2,15],46:[2,15],53:[2,15],54:[2,15],55:[2,15],56:[2,15],59:[2,15],60:[2,15],61:[2,15],62:[2,15],63:[2,15],64:[2,15],65:[2,15],66:[2,15],67:[2,15],68:[2,15],69:[2,15],70:[2,15],76:[2,15],79:[2,15],80:[2,15],94:[2,15],100:[2,15],101:[2,15],103:[2,15]},{1:[2,16],9:[2,16],11:[2,16],14:[2,16],15:[2,16],21:[2,16],22:[2,16],24:[2,16],26:[2,16],27:[2,16],28:[2,16],32:[2,16],34:[2,16],35:[2,16],36:[2,16],37:[2,16],39:[2,16],44:[2,16],45:[2,16],46:[2,16],53:[2,16],54:[2,16],55:[2,16],56:[2,16],59:[2,16],60:[2,16],61:[2,16],62:[2,16],63:[2,16],64:[2,16],65:[2,16],66:[2,16],67:[2,16],68:[2,16],69:[2,16],70:[2,16],76:[2,16],79:[2,16],80:[2,16],94:[2,16],100:[2,16],101:[2,16],103:[2,16]},{1:[2,19],9:[2,19],11:[2,19],14:[2,19],15:[2,19],21:[2,19],22:[2,19],24:[2,19],26:[2,19],27:[2,19],28:[2,19],32:[2,19],34:[2,19],35:[2,19],36:[2,19],37:[2,19],39:[2,19],44:[2,19],45:[2,19],46:[2,19],53:[2,19],54:[2,19],55:[2,19],56:[2,19],59:[2,19],60:[2,19],61:[2,19],62:[2,19],63:[2,19],64:[2,19],65:[2,19],66:[2,19],67:[2,19],68:[2,19],69:[2,19],70:[2,19],76:[2,19],79:[2,19],80:[2,19],94:[2,19],100:[2,19],101:[2,19],103:[2,19]},{9:[1,73],11:[1,74],15:[1,75],35:[1,360]},{1:[2,18],9:[2,18],11:[2,18],14:[2,18],15:[2,18],21:[2,18],22:[2,18],24:[2,18],26:[2,18],27:[2,18],28:[2,18],32:[2,18],34:[2,18],35:[2,18],36:[2,18],37:[2,18],39:[2,18],44:[2,18],45:[2,18],46:[2,18],53:[2,18],54:[2,18],55:[2,18],56:[2,18],59:[2,18],60:[2,18],61:[2,18],62:[2,18],63:[2,18],64:[2,18],65:[2,18],66:[2,18],67:[2,18],68:[2,18],69:[2,18],70:[2,18],76:[2,18],79:[2,18],80:[2,18],94:[2,18],100:[2,18],101:[2,18],103:[2,18]},{13:361,14:[2,55],44:[1,161],45:[2,55],46:[2,55]},{32:[1,362],45:[1,249],46:[1,250]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:364,23:[1,37],25:[1,38],27:[1,363],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{21:[2,165],22:[2,165],24:[2,165],35:[1,46],39:[2,165],45:[2,165],46:[2,165],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,165]},{21:[2,166],22:[2,166],24:[2,166],35:[1,46],39:[2,166],45:[2,166],46:[2,166],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,166],80:[1,365]},{21:[2,160],22:[2,160],24:[2,160],35:[1,46],37:[1,367],39:[2,160],45:[2,160],46:[2,160],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,160],80:[1,366]},{21:[2,168],22:[2,168],24:[2,168],35:[1,46],39:[2,168],45:[2,168],46:[2,168],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,168],80:[1,368]},{9:[1,73],11:[1,74],15:[1,75],101:[1,369]},{35:[1,46],36:[1,370],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:371,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{21:[2,180],22:[2,180],24:[2,180],35:[1,46],39:[2,180],45:[2,180],46:[2,180],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,180]},{21:[2,181],22:[2,181],24:[2,181],35:[1,46],39:[2,181],45:[2,181],46:[2,181],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,181],80:[1,372]},{1:[2,70],14:[2,70],21:[2,70],22:[2,70],24:[2,70],26:[2,70],27:[2,70],28:[2,70],32:[2,70],35:[2,70],36:[2,70],37:[2,70],39:[2,70],44:[2,70],45:[2,70],46:[2,70],55:[2,70],56:[2,70],59:[2,70],60:[2,70],61:[2,70],62:[2,70],63:[2,70],64:[2,70],65:[2,70],66:[2,70],67:[2,70],68:[2,70],69:[2,70],76:[2,70],79:[2,70],80:[2,70],103:[2,70]},{22:[1,373],45:[1,249],46:[1,250]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:374,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{17:375,46:[1,6]},{14:[2,50],21:[2,50],22:[2,50],32:[2,50],44:[2,50],45:[2,50],46:[2,50]},{13:376,22:[2,55],44:[1,161],45:[2,55],46:[2,55]},{71:[1,323]},{22:[1,377],45:[1,249],46:[1,250]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:378,21:[1,379],23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{21:[1,380],35:[1,46],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{1:[2,36],9:[2,36],11:[2,36],14:[2,36],15:[2,36],21:[2,36],22:[2,36],24:[2,36],26:[2,36],27:[2,36],28:[2,36],32:[2,36],34:[2,36],35:[2,36],36:[2,36],37:[2,36],39:[2,36],44:[2,36],45:[2,36],46:[2,36],53:[2,36],54:[2,36],55:[2,36],56:[2,36],59:[2,36],60:[2,36],61:[2,36],62:[2,36],63:[2,36],64:[2,36],65:[2,36],66:[2,36],67:[2,36],68:[2,36],69:[2,36],70:[2,36],76:[2,36],79:[2,36],80:[2,36],94:[2,36],100:[2,36],101:[2,36],103:[2,36]},{1:[2,8],9:[2,8],11:[2,8],14:[2,8],15:[2,8],21:[2,8],22:[2,8],24:[2,8],26:[2,8],27:[2,8],28:[2,8],32:[2,8],34:[2,8],35:[2,8],36:[2,8],37:[2,8],39:[2,8],44:[2,8],45:[2,8],46:[2,8],53:[2,8],54:[2,8],55:[2,8],56:[2,8],59:[2,8],60:[2,8],61:[2,8],62:[2,8],63:[2,8],64:[2,8],65:[2,8],66:[2,8],67:[2,8],68:[2,8],69:[2,8],70:[2,8],76:[2,8],79:[2,8],80:[2,8],94:[2,8],100:[2,8],101:[2,8],103:[2,8]},{1:[2,85],14:[2,85],21:[2,85],22:[2,85],24:[2,85],26:[2,85],27:[2,85],28:[2,85],32:[2,85],35:[2,85],36:[2,85],37:[2,85],39:[2,85],44:[2,85],45:[2,85],46:[2,85],55:[2,85],56:[2,85],59:[2,85],60:[2,85],61:[2,85],62:[2,85],63:[2,85],64:[2,85],65:[2,85],66:[2,85],67:[2,85],68:[2,85],69:[2,85],76:[2,85],79:[2,85],80:[2,85],103:[2,85]},{17:381,46:[1,6]},{17:382,46:[1,6]},{17:383,35:[1,46],46:[1,6],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:384,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,108],14:[2,108],21:[2,108],22:[2,108],24:[2,108],26:[2,108],27:[2,108],28:[2,108],32:[2,108],35:[2,108],36:[2,108],37:[2,108],39:[2,108],44:[2,108],45:[2,108],46:[2,108],55:[2,108],56:[2,108],59:[2,108],60:[2,108],61:[2,108],62:[2,108],63:[2,108],64:[2,108],65:[2,108],66:[2,108],67:[2,108],68:[2,108],69:[2,108],76:[2,108],79:[2,108],80:[2,108],103:[2,108]},{1:[2,113],14:[2,113],21:[2,113],22:[2,113],24:[2,113],26:[2,113],27:[2,113],28:[2,113],32:[2,113],35:[2,113],36:[2,113],37:[2,113],39:[2,113],44:[2,113],45:[2,113],46:[2,113],55:[2,113],56:[2,113],59:[2,113],60:[2,113],61:[2,113],62:[2,113],63:[2,113],64:[2,113],65:[2,113],66:[2,113],67:[2,113],68:[2,113],69:[2,113],76:[2,113],79:[2,113],80:[2,113],103:[2,113]},{1:[2,114],14:[2,114],21:[2,114],22:[2,114],24:[2,114],26:[2,114],27:[2,114],28:[2,114],32:[2,114],35:[2,114],36:[2,114],37:[2,114],39:[2,114],44:[2,114],45:[2,114],46:[2,114],55:[2,114],56:[2,114],59:[2,114],60:[2,114],61:[2,114],62:[2,114],63:[2,114],64:[2,114],65:[2,114],66:[2,114],67:[2,114],68:[2,114],69:[2,114],76:[2,114],79:[2,114],80:[2,114],103:[2,114]},{1:[2,188],14:[2,188],21:[2,188],22:[2,188],24:[2,188],26:[2,188],27:[2,188],28:[2,188],32:[2,188],35:[2,188],36:[2,188],37:[2,188],39:[2,188],44:[2,188],45:[2,188],46:[2,188],55:[2,188],56:[2,188],59:[2,188],60:[2,188],61:[2,188],62:[2,188],63:[2,188],64:[2,188],65:[2,188],66:[2,188],67:[2,188],68:[2,188],69:[2,188],76:[2,188],79:[2,188],80:[2,188],86:[2,188],87:[2,188],103:[2,188]},{17:385,46:[1,6]},{1:[2,122],14:[2,122],21:[2,122],22:[2,122],24:[2,122],26:[2,122],27:[2,122],28:[2,122],32:[2,122],35:[2,122],36:[2,122],37:[2,122],39:[2,122],44:[2,122],45:[2,122],46:[2,122],55:[2,122],56:[2,122],59:[2,122],60:[2,122],61:[2,122],62:[2,122],63:[2,122],64:[2,122],65:[2,122],66:[2,122],67:[2,122],68:[2,122],69:[2,122],76:[2,122],79:[2,122],80:[2,122],90:[1,386],103:[2,122]},{1:[2,125],14:[2,125],21:[2,125],22:[2,125],24:[2,125],26:[2,125],27:[2,125],28:[2,125],32:[2,125],35:[2,125],36:[2,125],37:[2,125],39:[2,125],44:[2,125],45:[2,125],46:[2,125],55:[2,125],56:[2,125],59:[2,125],60:[2,125],61:[2,125],62:[2,125],63:[2,125],64:[2,125],65:[2,125],66:[2,125],67:[2,125],68:[2,125],69:[2,125],76:[2,125],79:[2,125],80:[2,125],103:[2,125]},{1:[2,130],14:[2,130],21:[2,130],22:[2,130],24:[2,130],26:[2,130],27:[2,130],28:[2,130],32:[2,130],35:[2,130],36:[2,130],37:[2,130],39:[2,130],44:[2,130],45:[2,130],46:[2,130],55:[2,130],56:[2,130],59:[2,130],60:[2,130],61:[2,130],62:[2,130],63:[2,130],64:[2,130],65:[2,130],66:[2,130],67:[2,130],68:[2,130],69:[2,130],76:[2,130],79:[2,130],80:[2,130],103:[2,130]},{17:387,46:[1,6]},{1:[2,12],9:[2,12],11:[2,12],14:[2,12],15:[2,12],21:[2,12],22:[2,12],24:[2,12],26:[2,12],27:[2,12],28:[2,12],32:[2,12],34:[2,12],35:[2,12],36:[2,12],37:[2,12],39:[2,12],44:[2,12],45:[2,12],46:[2,12],53:[2,12],54:[2,12],55:[2,12],56:[2,12],59:[2,12],60:[2,12],61:[2,12],62:[2,12],63:[2,12],64:[2,12],65:[2,12],66:[2,12],67:[2,12],68:[2,12],69:[2,12],70:[2,12],76:[2,12],79:[2,12],80:[2,12],94:[2,12],100:[2,12],101:[2,12],103:[2,12]},{21:[2,185],22:[2,185],24:[2,185],39:[2,185],45:[2,185],46:[2,185],79:[2,185]},{21:[2,186],22:[2,186],24:[2,186],39:[2,186],45:[2,186],46:[2,186],79:[2,186]},{1:[2,29],9:[2,29],11:[2,29],14:[2,29],15:[2,29],21:[2,29],22:[2,29],24:[2,29],26:[2,29],27:[2,29],28:[2,29],32:[2,29],34:[2,29],35:[2,29],36:[2,29],37:[2,29],39:[2,29],44:[2,29],45:[2,29],46:[2,29],53:[2,29],54:[2,29],55:[2,29],56:[2,29],59:[2,29],60:[2,29],61:[2,29],62:[2,29],63:[2,29],64:[2,29],65:[2,29],66:[2,29],67:[2,29],68:[2,29],69:[2,29],70:[2,29],76:[2,29],79:[2,29],80:[2,29],94:[2,29],100:[2,29],101:[2,29],103:[2,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:388,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{21:[1,389],35:[1,46],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{1:[2,41],9:[2,41],11:[2,41],14:[2,41],15:[2,41],21:[2,41],22:[2,41],24:[2,41],26:[2,41],27:[2,41],28:[2,41],32:[2,41],34:[2,41],35:[2,41],36:[2,41],37:[2,41],39:[2,41],44:[2,41],45:[2,41],46:[2,41],53:[2,41],54:[2,41],55:[2,41],56:[2,41],59:[2,41],60:[2,41],61:[2,41],62:[2,41],63:[2,41],64:[2,41],65:[2,41],66:[2,41],67:[2,41],68:[2,41],69:[2,41],70:[2,41],76:[2,41],79:[2,41],80:[2,41],94:[2,41],100:[2,41],101:[2,41],103:[2,41]},{20:390,39:[1,203],41:[1,391],77:202,79:[1,41]},{1:[2,42],9:[2,42],11:[2,42],14:[2,42],15:[2,42],21:[2,42],22:[2,42],24:[2,42],26:[2,42],27:[2,42],28:[2,42],32:[2,42],34:[2,42],35:[2,42],36:[2,42],37:[2,42],39:[2,42],44:[2,42],45:[2,42],46:[2,42],53:[2,42],54:[2,42],55:[2,42],56:[2,42],59:[2,42],60:[2,42],61:[2,42],62:[2,42],63:[2,42],64:[2,42],65:[2,42],66:[2,42],67:[2,42],68:[2,42],69:[2,42],70:[2,42],76:[2,42],79:[2,42],80:[2,42],94:[2,42],100:[2,42],101:[2,42],103:[2,42]},{22:[2,151],24:[2,151],44:[2,151],45:[2,151]},{22:[2,152],24:[2,152],44:[2,152],45:[2,152]},{21:[1,392],45:[1,249],46:[1,250]},{13:393,22:[2,55],44:[1,161],45:[2,55],46:[2,55]},{41:[1,394]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:320,23:[1,37],25:[1,38],27:[1,395],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{14:[1,396],45:[1,249],46:[1,250]},{30:[1,397],50:[1,322],71:[1,323]},{1:[2,26],9:[2,26],11:[2,26],14:[2,26],15:[2,26],21:[2,26],22:[2,26],24:[2,26],26:[2,26],27:[2,26],28:[2,26],32:[2,26],34:[2,26],35:[2,26],36:[2,26],37:[2,26],39:[2,26],44:[2,26],45:[2,26],46:[2,26],53:[2,26],54:[2,26],55:[2,26],56:[2,26],59:[2,26],60:[2,26],61:[2,26],62:[2,26],63:[2,26],64:[2,26],65:[2,26],66:[2,26],67:[2,26],68:[2,26],69:[2,26],70:[2,26],76:[2,26],79:[2,26],80:[2,26],94:[2,26],100:[2,26],101:[2,26],103:[2,26]},{27:[1,398],35:[1,46],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:399,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:400,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:401,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:402,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:403,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:404,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{21:[2,173],22:[2,173],24:[2,173],35:[1,46],39:[2,173],45:[2,173],46:[2,173],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,173],80:[1,405]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:406,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{1:[2,75],14:[2,75],21:[2,75],22:[2,75],24:[2,75],26:[2,75],27:[2,75],28:[2,75],32:[2,75],35:[2,75],36:[2,75],37:[2,75],39:[2,75],44:[2,75],45:[2,75],46:[2,75],55:[2,75],56:[2,75],59:[2,75],60:[2,75],61:[2,75],62:[2,75],63:[2,75],64:[2,75],65:[2,75],66:[2,75],67:[2,75],68:[2,75],69:[2,75],76:[2,75],79:[2,75],80:[2,75],103:[2,75]},{1:[2,63],22:[2,63],27:[2,63],35:[1,46],45:[2,63],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{1:[2,99],14:[2,99],21:[2,99],22:[2,99],24:[2,99],26:[2,99],27:[2,99],28:[2,99],32:[2,99],35:[2,99],36:[2,99],37:[2,99],39:[2,99],44:[2,99],45:[2,99],46:[2,99],55:[2,99],56:[2,99],59:[2,99],60:[2,99],61:[2,99],62:[2,99],63:[2,99],64:[2,99],65:[2,99],66:[2,99],67:[2,99],68:[2,99],69:[2,99],76:[2,99],79:[2,99],80:[2,99],103:[2,99]},{22:[1,407],45:[1,249],46:[1,250]},{1:[2,73],14:[2,73],21:[2,73],22:[2,73],24:[2,73],26:[2,73],27:[2,73],28:[2,73],32:[2,73],35:[2,73],36:[2,73],37:[2,73],39:[2,73],44:[2,73],45:[2,73],46:[2,73],55:[2,73],56:[2,73],59:[2,73],60:[2,73],61:[2,73],62:[2,73],63:[2,73],64:[2,73],65:[2,73],66:[2,73],67:[2,73],68:[2,73],69:[2,73],76:[2,73],79:[2,73],80:[2,73],103:[2,73]},{21:[1,408],35:[1,46],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{1:[2,34],9:[2,34],11:[2,34],14:[2,34],15:[2,34],21:[2,34],22:[2,34],24:[2,34],26:[2,34],27:[2,34],28:[2,34],32:[2,34],34:[2,34],35:[2,34],36:[2,34],37:[2,34],39:[2,34],44:[2,34],45:[2,34],46:[2,34],53:[2,34],54:[2,34],55:[2,34],56:[2,34],59:[2,34],60:[2,34],61:[2,34],62:[2,34],63:[2,34],64:[2,34],65:[2,34],66:[2,34],67:[2,34],68:[2,34],69:[2,34],70:[2,34],76:[2,34],79:[2,34],80:[2,34],94:[2,34],100:[2,34],101:[2,34],103:[2,34]},{1:[2,35],9:[2,35],11:[2,35],14:[2,35],15:[2,35],21:[2,35],22:[2,35],24:[2,35],26:[2,35],27:[2,35],28:[2,35],32:[2,35],34:[2,35],35:[2,35],36:[2,35],37:[2,35],39:[2,35],44:[2,35],45:[2,35],46:[2,35],53:[2,35],54:[2,35],55:[2,35],56:[2,35],59:[2,35],60:[2,35],61:[2,35],62:[2,35],63:[2,35],64:[2,35],65:[2,35],66:[2,35],67:[2,35],68:[2,35],69:[2,35],70:[2,35],76:[2,35],79:[2,35],80:[2,35],94:[2,35],100:[2,35],101:[2,35],103:[2,35]},{1:[2,100],14:[2,100],21:[2,100],22:[2,100],24:[2,100],26:[2,100],27:[2,100],28:[2,100],32:[2,100],35:[2,100],36:[2,100],37:[2,100],39:[2,100],44:[2,100],45:[2,100],46:[2,100],55:[2,100],56:[2,100],59:[2,100],60:[2,100],61:[2,100],62:[2,100],63:[2,100],64:[2,100],65:[2,100],66:[2,100],67:[2,100],68:[2,100],69:[2,100],76:[2,100],79:[2,100],80:[2,100],103:[2,100]},{1:[2,101],14:[2,101],21:[2,101],22:[2,101],24:[2,101],26:[2,101],27:[2,101],28:[2,101],32:[2,101],35:[2,101],36:[2,101],37:[2,101],39:[2,101],44:[2,101],45:[2,101],46:[2,101],55:[2,101],56:[2,101],59:[2,101],60:[2,101],61:[2,101],62:[2,101],63:[2,101],64:[2,101],65:[2,101],66:[2,101],67:[2,101],68:[2,101],69:[2,101],76:[2,101],79:[2,101],80:[2,101],103:[2,101]},{1:[2,157],14:[2,157],21:[2,157],22:[2,157],24:[2,157],26:[2,157],27:[2,157],28:[2,157],32:[2,157],35:[2,157],36:[2,157],37:[2,157],39:[2,157],44:[2,157],45:[2,157],46:[2,157],55:[2,157],56:[2,157],59:[2,157],60:[2,157],61:[2,157],62:[2,157],63:[2,157],64:[2,157],65:[2,157],66:[2,157],67:[2,157],68:[2,157],69:[2,157],75:409,76:[2,157],79:[2,157],80:[2,157],87:[1,183],103:[2,157]},{1:[2,106],14:[2,106],21:[2,106],22:[2,106],24:[2,106],26:[2,106],27:[2,106],28:[2,106],32:[2,106],35:[1,46],36:[2,106],37:[2,106],39:[2,106],44:[2,106],45:[2,106],46:[2,106],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[2,106],69:[2,106],76:[2,106],79:[2,106],80:[2,106],103:[2,106]},{1:[2,121],14:[2,121],21:[2,121],22:[2,121],24:[2,121],26:[2,121],27:[2,121],28:[2,121],32:[2,121],35:[2,121],36:[2,121],37:[2,121],39:[2,121],44:[2,121],45:[2,121],46:[2,121],55:[2,121],56:[2,121],59:[2,121],60:[2,121],61:[2,121],62:[2,121],63:[2,121],64:[2,121],65:[2,121],66:[2,121],67:[2,121],68:[2,121],69:[2,121],76:[2,121],79:[2,121],80:[2,121],103:[2,121]},{17:410,46:[1,6]},{1:[2,10],9:[2,10],11:[2,10],14:[2,10],15:[2,10],21:[2,10],22:[2,10],24:[2,10],26:[2,10],27:[2,10],28:[2,10],32:[2,10],34:[2,10],35:[2,10],36:[2,10],37:[2,10],39:[2,10],44:[2,10],45:[2,10],46:[2,10],53:[2,10],54:[2,10],55:[2,10],56:[2,10],59:[2,10],60:[2,10],61:[2,10],62:[2,10],63:[2,10],64:[2,10],65:[2,10],66:[2,10],67:[2,10],68:[2,10],69:[2,10],70:[2,10],76:[2,10],79:[2,10],80:[2,10],94:[2,10],100:[2,10],101:[2,10],103:[2,10]},{21:[1,411],35:[1,46],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60]},{1:[2,32],9:[2,32],11:[2,32],14:[2,32],15:[2,32],21:[2,32],22:[2,32],24:[2,32],26:[2,32],27:[2,32],28:[2,32],32:[2,32],34:[2,32],35:[2,32],36:[2,32],37:[2,32],39:[2,32],44:[2,32],45:[2,32],46:[2,32],53:[2,32],54:[2,32],55:[2,32],56:[2,32],59:[2,32],60:[2,32],61:[2,32],62:[2,32],63:[2,32],64:[2,32],65:[2,32],66:[2,32],67:[2,32],68:[2,32],69:[2,32],70:[2,32],76:[2,32],79:[2,32],80:[2,32],94:[2,32],100:[2,32],101:[2,32],103:[2,32]},{24:[1,412],39:[1,203],45:[1,283],46:[1,284],77:282,79:[1,41]},{22:[2,138],24:[2,138],44:[2,138],45:[2,138],54:[2,138],60:[2,138]},{41:[1,391]},{22:[1,413],45:[1,249],46:[1,250]},{22:[2,137],24:[2,137],44:[2,137],45:[2,137],54:[2,137],60:[2,137]},{1:[2,27],9:[2,27],11:[2,27],14:[2,27],15:[2,27],21:[2,27],22:[2,27],24:[2,27],26:[2,27],27:[2,27],28:[2,27],32:[2,27],34:[2,27],35:[2,27],36:[2,27],37:[2,27],39:[2,27],44:[2,27],45:[2,27],46:[2,27],53:[2,27],54:[2,27],55:[2,27],56:[2,27],59:[2,27],60:[2,27],61:[2,27],62:[2,27],63:[2,27],64:[2,27],65:[2,27],66:[2,27],67:[2,27],68:[2,27],69:[2,27],70:[2,27],76:[2,27],79:[2,27],80:[2,27],94:[2,27],100:[2,27],101:[2,27],103:[2,27]},{27:[1,414]},{27:[1,415]},{1:[2,28],9:[2,28],11:[2,28],14:[2,28],15:[2,28],21:[2,28],22:[2,28],24:[2,28],26:[2,28],27:[2,28],28:[2,28],32:[2,28],34:[2,28],35:[2,28],36:[2,28],37:[2,28],39:[2,28],44:[2,28],45:[2,28],46:[2,28],53:[2,28],54:[2,28],55:[2,28],56:[2,28],59:[2,28],60:[2,28],61:[2,28],62:[2,28],63:[2,28],64:[2,28],65:[2,28],66:[2,28],67:[2,28],68:[2,28],69:[2,28],70:[2,28],76:[2,28],79:[2,28],80:[2,28],94:[2,28],100:[2,28],101:[2,28],103:[2,28]},{21:[2,167],22:[2,167],24:[2,167],35:[1,46],39:[2,167],45:[2,167],46:[2,167],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,167]},{21:[2,161],22:[2,161],24:[2,161],35:[1,46],39:[2,161],45:[2,161],46:[2,161],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,161]},{21:[2,162],22:[2,162],24:[2,162],35:[1,46],39:[2,162],45:[2,162],46:[2,162],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,162],80:[1,416]},{21:[2,169],22:[2,169],24:[2,169],35:[1,46],39:[2,169],45:[2,169],46:[2,169],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,169]},{21:[2,170],22:[2,170],24:[2,170],35:[1,46],39:[2,170],45:[2,170],46:[2,170],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,170],80:[1,417]},{21:[2,172],22:[2,172],24:[2,172],35:[1,46],37:[1,419],39:[2,172],45:[2,172],46:[2,172],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,172],80:[1,418]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:420,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{21:[2,182],22:[2,182],24:[2,182],35:[1,46],39:[2,182],45:[2,182],46:[2,182],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,182]},{14:[2,51],21:[2,51],22:[2,51],32:[2,51],44:[2,51],45:[2,51],46:[2,51]},{1:[2,33],9:[2,33],11:[2,33],14:[2,33],15:[2,33],21:[2,33],22:[2,33],24:[2,33],26:[2,33],27:[2,33],28:[2,33],32:[2,33],34:[2,33],35:[2,33],36:[2,33],37:[2,33],39:[2,33],44:[2,33],45:[2,33],46:[2,33],53:[2,33],54:[2,33],55:[2,33],56:[2,33],59:[2,33],60:[2,33],61:[2,33],62:[2,33],63:[2,33],64:[2,33],65:[2,33],66:[2,33],67:[2,33],68:[2,33],69:[2,33],70:[2,33],76:[2,33],79:[2,33],80:[2,33],94:[2,33],100:[2,33],101:[2,33],103:[2,33]},{1:[2,159],14:[2,159],21:[2,159],22:[2,159],24:[2,159],26:[2,159],27:[2,159],28:[2,159],32:[2,159],35:[2,159],36:[2,159],37:[2,159],39:[2,159],44:[2,159],45:[2,159],46:[2,159],55:[2,159],56:[2,159],59:[2,159],60:[2,159],61:[2,159],62:[2,159],63:[2,159],64:[2,159],65:[2,159],66:[2,159],67:[2,159],68:[2,159],69:[2,159],76:[2,159],79:[2,159],80:[2,159],103:[2,159]},{1:[2,123],14:[2,123],21:[2,123],22:[2,123],24:[2,123],26:[2,123],27:[2,123],28:[2,123],32:[2,123],35:[2,123],36:[2,123],37:[2,123],39:[2,123],44:[2,123],45:[2,123],46:[2,123],55:[2,123],56:[2,123],59:[2,123],60:[2,123],61:[2,123],62:[2,123],63:[2,123],64:[2,123],65:[2,123],66:[2,123],67:[2,123],68:[2,123],69:[2,123],76:[2,123],79:[2,123],80:[2,123],103:[2,123]},{1:[2,30],9:[2,30],11:[2,30],14:[2,30],15:[2,30],21:[2,30],22:[2,30],24:[2,30],26:[2,30],27:[2,30],28:[2,30],32:[2,30],34:[2,30],35:[2,30],36:[2,30],37:[2,30],39:[2,30],44:[2,30],45:[2,30],46:[2,30],53:[2,30],54:[2,30],55:[2,30],56:[2,30],59:[2,30],60:[2,30],61:[2,30],62:[2,30],63:[2,30],64:[2,30],65:[2,30],66:[2,30],67:[2,30],68:[2,30],69:[2,30],70:[2,30],76:[2,30],79:[2,30],80:[2,30],94:[2,30],100:[2,30],101:[2,30],103:[2,30]},{1:[2,13],9:[2,13],11:[2,13],14:[2,13],15:[2,13],21:[2,13],22:[2,13],24:[2,13],26:[2,13],27:[2,13],28:[2,13],32:[2,13],34:[2,13],35:[2,13],36:[2,13],37:[2,13],39:[2,13],44:[2,13],45:[2,13],46:[2,13],53:[2,13],54:[2,13],55:[2,13],56:[2,13],59:[2,13],60:[2,13],61:[2,13],62:[2,13],63:[2,13],64:[2,13],65:[2,13],66:[2,13],67:[2,13],68:[2,13],69:[2,13],70:[2,13],76:[2,13],79:[2,13],80:[2,13],94:[2,13],100:[2,13],101:[2,13],103:[2,13]},{22:[2,140],24:[2,140],44:[2,140],45:[2,140]},{1:[2,21],9:[2,21],11:[2,21],14:[2,21],15:[2,21],21:[2,21],22:[2,21],24:[2,21],26:[2,21],27:[2,21],28:[2,21],32:[2,21],34:[2,21],35:[2,21],36:[2,21],37:[2,21],39:[2,21],44:[2,21],45:[2,21],46:[2,21],53:[2,21],54:[2,21],55:[2,21],56:[2,21],59:[2,21],60:[2,21],61:[2,21],62:[2,21],63:[2,21],64:[2,21],65:[2,21],66:[2,21],67:[2,21],68:[2,21],69:[2,21],70:[2,21],76:[2,21],79:[2,21],80:[2,21],94:[2,21],100:[2,21],101:[2,21],103:[2,21]},{1:[2,23],9:[2,23],11:[2,23],14:[2,23],15:[2,23],21:[2,23],22:[2,23],24:[2,23],26:[2,23],27:[2,23],28:[2,23],32:[2,23],34:[2,23],35:[2,23],36:[2,23],37:[2,23],39:[2,23],44:[2,23],45:[2,23],46:[2,23],53:[2,23],54:[2,23],55:[2,23],56:[2,23],59:[2,23],60:[2,23],61:[2,23],62:[2,23],63:[2,23],64:[2,23],65:[2,23],66:[2,23],67:[2,23],68:[2,23],69:[2,23],70:[2,23],76:[2,23],79:[2,23],80:[2,23],94:[2,23],100:[2,23],101:[2,23],103:[2,23]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:421,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:422,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:423,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:424,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{21:[2,175],22:[2,175],24:[2,175],35:[1,46],39:[2,175],45:[2,175],46:[2,175],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,175]},{21:[2,163],22:[2,163],24:[2,163],35:[1,46],39:[2,163],45:[2,163],46:[2,163],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,163]},{21:[2,171],22:[2,171],24:[2,171],35:[1,46],39:[2,171],45:[2,171],46:[2,171],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,171]},{21:[2,174],22:[2,174],24:[2,174],35:[1,46],37:[1,425],39:[2,174],45:[2,174],46:[2,174],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,174]},{21:[2,176],22:[2,176],24:[2,176],35:[1,46],39:[2,176],45:[2,176],46:[2,176],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,176],80:[1,426]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:427,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{3:12,4:[1,30],5:31,6:32,7:[1,33],8:[1,34],16:[1,35],18:[1,36],19:428,23:[1,37],25:[1,38],31:[1,65],33:[1,14],34:[1,13],38:[1,39],39:[1,40],41:[1,28],56:[1,15],57:[1,16],58:[1,17],72:[1,18],73:[1,19],74:[1,20],77:21,78:[1,22],79:[1,41],81:[1,23],82:[1,24],83:[1,25],88:[1,26],91:[1,27],95:[1,29]},{21:[2,178],22:[2,178],24:[2,178],35:[1,46],39:[2,178],45:[2,178],46:[2,178],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,178]},{21:[2,177],22:[2,177],24:[2,177],35:[1,46],39:[2,177],45:[2,177],46:[2,177],55:[1,47],56:[1,48],59:[1,49],60:[1,50],61:[1,51],62:[1,52],63:[1,53],64:[1,54],65:[1,55],66:[1,56],67:[1,57],68:[1,58],69:[1,59],76:[1,60],79:[2,177]}],
defaultActions: {2:[2,193]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

    //this.reductionCount = this.shiftCount = 0;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;

    if (typeof this.yy.parseError === 'function')
        this.parseError = this.yy.parseError;

    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
    }

    function lex() {
        var token;
        token = self.lexer.lex() || 1; // $end = 1
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    };

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected;
    while (true) {
        // retreive state number from top of stack
        state = stack[stack.length-1];

        // use default actions if available
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null)
                symbol = lex();
            // read action for current state and first input
            action = table[state] && table[state][symbol];
        }

        // handle parse error
        if (typeof action === 'undefined' || !action.length || !action[0]) {

            if (!recovering) {
                // Report error
                expected = [];
                for (p in table[state]) if (this.terminals_[p] && p > 2) {
                    expected.push("'"+this.terminals_[p]+"'");
                }
                var errStr = '';
                if (this.lexer.showPosition) {
                    errStr = 'Parse error on line '+(yylineno+1)+":\n"+this.lexer.showPosition()+'\nExpecting '+expected.join(', ');
                } else {
                    errStr = 'Parse error on line '+(yylineno+1)+": Unexpected " +
                                  (symbol == 1 /*EOF*/ ? "end of input" :
                                              ("'"+(this.terminals_[symbol] || symbol)+"'"));
                }
                this.parseError(errStr,
                    {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, expected: expected});
            }

            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw new Error(errStr || 'Parsing halted.');
                }

                // discard current lookahead and grab another
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                symbol = lex();
            }

            // try to recover from error
            while (1) {
                // check for error recovery rule in this state
                if ((TERROR.toString()) in table[state]) {
                    break;
                }
                if (state == 0) {
                    throw new Error(errStr || 'Parsing halted.');
                }
                popStack(1);
                state = stack[stack.length-1];
            }
            
            preErrorSymbol = symbol; // save the lookahead token
            symbol = TERROR;         // insert generic error symbol as new lookahead
            state = stack[stack.length-1];
            action = table[state] && table[state][TERROR];
            recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
        }

        // this shouldn't happen, unless resolve defaults are off
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);
        }

        switch (action[0]) {

            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(this.lexer.yytext);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;

            case 2: // reduce
                //this.reductionCount++;

                len = this.productions_[action[1]][1];

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                }

                stack.push(this.productions_[action[1]][0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 3: // accept
                return true;
        }

    }

    return true;
}};


},{}],14:[function(require,module,exports){
// Generated by LiveScript 1.3.1
var path, stripString, nameFromPath;
path = require('path');
stripString = function(val){
  var that;
  if (that = /^['"](.*)['"]$/.exec(val.trim())) {
    return that[1];
  } else {
    return val;
  }
};
nameFromPath = function(modulePath){
  return path.basename(stripString(modulePath)).split('.')[0].replace(/-[a-z]/ig, function(it){
    return it.charAt(1).toUpperCase();
  });
};
module.exports = {
  nameFromPath: nameFromPath,
  stripString: stripString
};
},{"path":3}],15:[function(require,module,exports){
arguments[4][7][0].apply(exports,arguments)
},{"./lib/index.ls":20,"LiveScript":26,"dup":7,"prelude-ls":36}],16:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var Applicative;
module.exports = new (Applicative = (function(){
  Applicative.displayName = 'Applicative';
  var return_, prototype = Applicative.prototype, constructor = Applicative;
  prototype.return_ = return_ = function(x){
    return function(){
      return x;
    };
  };
  prototype['return'] = return_;
  function Applicative(){}
  return Applicative;
}()));



},{}],17:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var Control;
module.exports = new (Control = (function(){
  Control.displayName = 'Control';
  var if_, unless_, try_, catch_, finally_, throw_, prototype = Control.prototype, constructor = Control;
  prototype.if_ = if_ = curry$(function(x, f){
    if (x) {
      return f();
    }
  });
  prototype['if'] = if_;
  prototype.unless_ = unless_ = curry$(function(x, f){
    if (!x) {
      return f();
    }
  });
  prototype.unless = unless_;
  prototype.try_ = try_ = function(f, g, h){
    var e;
    try {
      return f();
    } catch (e$) {
      e = e$;
      return typeof g == 'function' ? g(e) : void 8;
    } finally {
      if (typeof h == 'function') {
        h();
      }
    }
  };
  prototype['try'] = try_;
  prototype.catch_ = catch_ = curry$(function(f, g){
    var e;
    try {
      return f();
    } catch (e$) {
      e = e$;
      return g(e);
    }
  });
  prototype['catch'] = catch_;
  prototype.finally_ = finally_ = curry$(function(f, g){
    try {
      return f();
    } finally {
      g();
    }
  });
  prototype['finally'] = finally_;
  prototype.throw_ = throw_ = function(x){
    throw x;
  };
  prototype['throw'] = throw_;
  function Control(){}
  return Control;
}()));
function curry$(f, bound){
  var context,
  _curry = function(args) {
    return f.length > 1 ? function(){
      var params = args ? args.concat() : [];
      context = bound ? context || this : this;
      return params.push.apply(params, arguments) <
          f.length && arguments.length ?
        _curry.call(context, params) : f.apply(context, params);
    } : f;
  };
  return _curry();
}



},{}],18:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var return_, Flow, slice$ = [].slice;
return_ = require('./applicative.ls').return_;
module.exports = new (Flow = (function(){
  Flow.displayName = 'Flow';
  var act, if_, unless_, when_, except, then_, else_, ref$, case_, otherwise_, case$, let_, prototype = Flow.prototype, constructor = Flow;
  prototype.act = act = curry$(function(f, x){
    return return_(x)(
    f(x));
  });
  prototype.if_ = if_ = curry$(function(x, f, y){
    if (x) {
      return f(y);
    } else {
      return y;
    }
  });
  prototype['if'] = if_;
  prototype.unless_ = unless_ = curry$(function(x, f, y){
    if (!x) {
      return f(y);
    } else {
      return y;
    }
  });
  prototype.unless = unless_;
  prototype.when_ = when_ = curry$(function(f, g, x){
    if (f(x)) {
      return g(x);
    } else {
      return x;
    }
  });
  prototype.when = when_;
  prototype.except = except = curry$(function(f, g, x){
    if (!f(x)) {
      return g(x);
    } else {
      return x;
    }
  });
  prototype.then_ = then_ = curry$(function(f, x){
    if (x) {
      return f(x);
    } else {
      return x;
    }
  });
  prototype.then = then_;
  prototype.else_ = else_ = curry$(function(f, x){
    if (!x) {
      return f(x);
    } else {
      return x;
    }
  });
  prototype['else'] = else_;
  ref$ = function(){
    var $;
    $ = {};
    return [
      curry$(function(f, g, x){
        switch (false) {
        case x !== $:
          return $;
        case !f(x):
          return return_($)(
          g(x));
        default:
          return x;
        }
      }), curry$(function(f, x){
        switch (false) {
        case x === $:
          return f(x);
        }
      })
    ];
  }(), case_ = ref$[0], otherwise_ = ref$[1];
  prototype.case_ = case_;
  prototype['case'] = case_;
  prototype.otherwise_ = otherwise_;
  prototype.otherwise = otherwise_;
  prototype.case$ = case$ = compose$(when_, act);
  prototype.let_ = let_ = function(k){
    var a;
    a = slice$.call(arguments, 1);
    return function(x){
      return return_(x)(
      x[k].apply(x, a));
    };
  };
  prototype['let'] = let_;
  function Flow(){}
  return Flow;
}()));
function curry$(f, bound){
  var context,
  _curry = function(args) {
    return f.length > 1 ? function(){
      var params = args ? args.concat() : [];
      context = bound ? context || this : this;
      return params.push.apply(params, arguments) <
          f.length && arguments.length ?
        _curry.call(context, params) : f.apply(context, params);
    } : f;
  };
  return _curry();
}
function compose$() {
  var functions = arguments;
  return function() {
    var i, result;
    result = functions[0].apply(this, arguments);
    for (i = 1; i < functions.length; ++i) {
      result = functions[i](result);
    }
    return result;
  };
}



},{"./applicative.ls":16}],19:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var Func, slice$ = [].slice;
module.exports = new (Func = (function(){
  Func.displayName = 'Func';
  var $, lazy, dist, prototype = Func.prototype, constructor = Func;
  prototype.$ = $ = curry$(function(f, x){
    return f(x);
  });
  prototype.lazy = lazy = function(x){
    var y;
    y = slice$.call(arguments, 1);
    return function(){
      return apply(x, y);
    };
  };
  prototype.dist = dist = curry$(function(x, fs){
    return map((function(it){
      return it(x);
    }), fs);
  });
  function Func(){}
  return Func;
}()));
function curry$(f, bound){
  var context,
  _curry = function(args) {
    return f.length > 1 ? function(){
      var params = args ? args.concat() : [];
      context = bound ? context || this : this;
      return params.push.apply(params, arguments) <
          f.length && arguments.length ?
        _curry.call(context, params) : f.apply(context, params);
    } : f;
  };
  return _curry();
}



},{}],20:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var applicative, control, flow, func, list, obj, option, str, GladFunctions;
applicative = require('./applicative.ls');
control = require('./control.ls');
flow = require('./flow.ls');
func = require('./func.ls');
list = require('./list.ls');
obj = require('./obj.ls');
option = require('./option.ls');
str = require('./str.ls');
module.exports = (function(it){
  return importAll$(it, func);
})(
(function(it){
  return importAll$(it, applicative);
})(
(function(it){
  return importAll$(it, option);
})(
(function(it){
  return importAll$(it, flow);
})(
(function(it){
  return importAll$(it, control);
})(
(function(it){
  return importAll$(it, list);
})(
(function(it){
  return importAll$(it, str);
})(
(function(it){
  return importAll$(it, obj);
})(
new (GladFunctions = (function(){
  GladFunctions.displayName = 'GladFunctions';
  var prototype = GladFunctions.prototype, constructor = GladFunctions;
  prototype.Applicative = applicative;
  prototype.Control = control;
  prototype.Flow = flow;
  prototype.Func = func;
  prototype.List = list;
  prototype.Obj = obj;
  prototype.Option = option;
  prototype.Str = str;
  function GladFunctions(){}
  return GladFunctions;
}()))))))))));
function importAll$(obj, src){
  for (var key in src) obj[key] = src[key];
  return obj;
}



},{"./applicative.ls":16,"./control.ls":17,"./flow.ls":18,"./func.ls":19,"./list.ls":21,"./obj.ls":22,"./option.ls":23,"./str.ls":24}],21:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var get, may, List;
get = require('./obj.ls').get;
may = require('./option.ls').may;
module.exports = new (List = (function(){
  List.displayName = 'List';
  var find_map, filter_map, length, prototype = List.prototype, constructor = List;
  prototype.find_map = find_map = curry$(function(f, xs){
    return may(f)(
    find(f, xs));
  });
  prototype.filter_map = filter_map = curry$(function(f, xs){
    return map(f)(
    filter(f, xs));
  });
  prototype.length = length = get('length');
  function List(){}
  return List;
}()));
function curry$(f, bound){
  var context,
  _curry = function(args) {
    return f.length > 1 ? function(){
      var params = args ? args.concat() : [];
      context = bound ? context || this : this;
      return params.push.apply(params, arguments) <
          f.length && arguments.length ?
        _curry.call(context, params) : f.apply(context, params);
    } : f;
  };
  return _curry();
}



},{"./obj.ls":22,"./option.ls":23}],22:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var Obj, slice$ = [].slice;
module.exports = new (Obj = (function(){
  Obj.displayName = 'Obj';
  var let_, get, set, delete_, prototype = Obj.prototype, constructor = Obj;
  prototype.let_ = let_ = function(x, k){
    var a;
    a = slice$.call(arguments, 2);
    return x[k].apply(x, a);
  };
  prototype['let'] = let_;
  prototype.get = get = curry$(function(k, x){
    return x[k];
  });
  prototype.set = set = curry$(function(k, v, x){
    return x[k] = v;
  });
  prototype.delete_ = delete_ = curry$(function(k, x){
    var ref$;
    return ref$ = x[k], delete x[k], ref$;
  });
  prototype['delete'] = delete_;
  function Obj(){}
  return Obj;
}()));
function curry$(f, bound){
  var context,
  _curry = function(args) {
    return f.length > 1 ? function(){
      var params = args ? args.concat() : [];
      context = bound ? context || this : this;
      return params.push.apply(params, arguments) <
          f.length && arguments.length ?
        _curry.call(context, params) : f.apply(context, params);
    } : f;
  };
  return _curry();
}



},{}],23:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var when_, Option;
when_ = require('./flow.ls').when_;
module.exports = new (Option = (function(){
  Option.displayName = 'Option';
  var may, prototype = Option.prototype, constructor = Option;
  prototype.may = may = when_(function(it){
    return it != null;
  });
  function Option(){}
  return Option;
}()));



},{"./flow.ls":18}],24:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var let_, Str, slice$ = [].slice;
let_ = require('./obj.ls').let_;
module.exports = new (Str = (function(){
  Str.displayName = 'Str';
  var match_, prototype = Str.prototype, constructor = Str;
  prototype.match_ = match_ = flip(partialize$.apply(Str, [let_, [void 8, 'match', void 8], [0, 2]]));
  prototype.match = match_;
  function Str(){}
  return Str;
}()));
function partialize$(f, args, where){
  var context = this;
  return function(){
    var params = slice$.call(arguments), i,
        len = params.length, wlen = where.length,
        ta = args ? args.concat() : [], tw = where ? where.concat() : [];
    for(i = 0; i < len; ++i) { ta[tw[0]] = params[i]; tw.shift(); }
    return len < wlen && len ?
      partialize$.apply(context, [f, ta, tw]) : f.apply(context, ta);
  };
}



},{"./obj.ls":22}],25:[function(require,module,exports){
arguments[4][9][0].apply(exports,arguments)
},{"./util":30,"dup":9,"prelude-ls":36}],26:[function(require,module,exports){
arguments[4][10][0].apply(exports,arguments)
},{"./ast":25,"./lexer":27,"./node":28,"./parser":29,"dup":10}],27:[function(require,module,exports){
arguments[4][11][0].apply(exports,arguments)
},{"dup":11}],28:[function(require,module,exports){
arguments[4][12][0].apply(exports,arguments)
},{"_process":4,"dup":12,"events":2,"fs":1,"path":3}],29:[function(require,module,exports){
arguments[4][13][0].apply(exports,arguments)
},{"dup":13}],30:[function(require,module,exports){
arguments[4][14][0].apply(exports,arguments)
},{"dup":14,"path":3}],31:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var apply, curry, flip, fix, over, memoize, slice$ = [].slice, toString$ = {}.toString;
apply = curry$(function(f, list){
  return f.apply(null, list);
});
curry = function(f){
  return curry$(f);
};
flip = curry$(function(f, x, y){
  return f(y, x);
});
fix = function(f){
  return function(g){
    return function(){
      return f(g(g)).apply(null, arguments);
    };
  }(function(g){
    return function(){
      return f(g(g)).apply(null, arguments);
    };
  });
};
over = curry$(function(f, g, x, y){
  return f(g(x), g(y));
});
memoize = function(f){
  var memo;
  memo = {};
  return function(){
    var args, key, arg;
    args = slice$.call(arguments);
    key = (function(){
      var i$, ref$, len$, results$ = [];
      for (i$ = 0, len$ = (ref$ = args).length; i$ < len$; ++i$) {
        arg = ref$[i$];
        results$.push(arg + toString$.call(arg).slice(8, -1));
      }
      return results$;
    }()).join('');
    return memo[key] = key in memo
      ? memo[key]
      : f.apply(null, args);
  };
};
module.exports = {
  curry: curry,
  flip: flip,
  fix: fix,
  apply: apply,
  over: over,
  memoize: memoize
};
function curry$(f, bound){
  var context,
  _curry = function(args) {
    return f.length > 1 ? function(){
      var params = args ? args.concat() : [];
      context = bound ? context || this : this;
      return params.push.apply(params, arguments) <
          f.length && arguments.length ?
        _curry.call(context, params) : f.apply(context, params);
    } : f;
  };
  return _curry();
}
},{}],32:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var each, map, compact, filter, reject, partition, find, head, first, tail, last, initial, empty, reverse, unique, uniqueBy, fold, foldl, fold1, foldl1, foldr, foldr1, unfoldr, concat, concatMap, flatten, difference, intersection, union, countBy, groupBy, andList, orList, any, all, sort, sortWith, sortBy, sum, product, mean, average, maximum, minimum, maximumBy, minimumBy, scan, scanl, scan1, scanl1, scanr, scanr1, slice, take, drop, splitAt, takeWhile, dropWhile, span, breakList, zip, zipWith, zipAll, zipAllWith, at, elemIndex, elemIndices, findIndex, findIndices, toString$ = {}.toString, slice$ = [].slice;
each = curry$(function(f, xs){
  var i$, len$, x;
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    f(x);
  }
  return xs;
});
map = curry$(function(f, xs){
  var i$, len$, x, results$ = [];
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    results$.push(f(x));
  }
  return results$;
});
compact = function(xs){
  var i$, len$, x, results$ = [];
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    if (x) {
      results$.push(x);
    }
  }
  return results$;
};
filter = curry$(function(f, xs){
  var i$, len$, x, results$ = [];
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    if (f(x)) {
      results$.push(x);
    }
  }
  return results$;
});
reject = curry$(function(f, xs){
  var i$, len$, x, results$ = [];
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    if (!f(x)) {
      results$.push(x);
    }
  }
  return results$;
});
partition = curry$(function(f, xs){
  var passed, failed, i$, len$, x;
  passed = [];
  failed = [];
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    (f(x) ? passed : failed).push(x);
  }
  return [passed, failed];
});
find = curry$(function(f, xs){
  var i$, len$, x;
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    if (f(x)) {
      return x;
    }
  }
});
head = first = function(xs){
  return xs[0];
};
tail = function(xs){
  if (!xs.length) {
    return;
  }
  return xs.slice(1);
};
last = function(xs){
  return xs[xs.length - 1];
};
initial = function(xs){
  if (!xs.length) {
    return;
  }
  return xs.slice(0, -1);
};
empty = function(xs){
  return !xs.length;
};
reverse = function(xs){
  return xs.concat().reverse();
};
unique = function(xs){
  var result, i$, len$, x;
  result = [];
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    if (!in$(x, result)) {
      result.push(x);
    }
  }
  return result;
};
uniqueBy = curry$(function(f, xs){
  var seen, i$, len$, x, val, results$ = [];
  seen = [];
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    val = f(x);
    if (in$(val, seen)) {
      continue;
    }
    seen.push(val);
    results$.push(x);
  }
  return results$;
});
fold = foldl = curry$(function(f, memo, xs){
  var i$, len$, x;
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    memo = f(memo, x);
  }
  return memo;
});
fold1 = foldl1 = curry$(function(f, xs){
  return fold(f, xs[0], xs.slice(1));
});
foldr = curry$(function(f, memo, xs){
  var i$, x;
  for (i$ = xs.length - 1; i$ >= 0; --i$) {
    x = xs[i$];
    memo = f(x, memo);
  }
  return memo;
});
foldr1 = curry$(function(f, xs){
  return foldr(f, xs[xs.length - 1], xs.slice(0, -1));
});
unfoldr = curry$(function(f, b){
  var result, x, that;
  result = [];
  x = b;
  while ((that = f(x)) != null) {
    result.push(that[0]);
    x = that[1];
  }
  return result;
});
concat = function(xss){
  return [].concat.apply([], xss);
};
concatMap = curry$(function(f, xs){
  var x;
  return [].concat.apply([], (function(){
    var i$, ref$, len$, results$ = [];
    for (i$ = 0, len$ = (ref$ = xs).length; i$ < len$; ++i$) {
      x = ref$[i$];
      results$.push(f(x));
    }
    return results$;
  }()));
});
flatten = function(xs){
  var x;
  return [].concat.apply([], (function(){
    var i$, ref$, len$, results$ = [];
    for (i$ = 0, len$ = (ref$ = xs).length; i$ < len$; ++i$) {
      x = ref$[i$];
      if (toString$.call(x).slice(8, -1) === 'Array') {
        results$.push(flatten(x));
      } else {
        results$.push(x);
      }
    }
    return results$;
  }()));
};
difference = function(xs){
  var yss, results, i$, len$, x, j$, len1$, ys;
  yss = slice$.call(arguments, 1);
  results = [];
  outer: for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    for (j$ = 0, len1$ = yss.length; j$ < len1$; ++j$) {
      ys = yss[j$];
      if (in$(x, ys)) {
        continue outer;
      }
    }
    results.push(x);
  }
  return results;
};
intersection = function(xs){
  var yss, results, i$, len$, x, j$, len1$, ys;
  yss = slice$.call(arguments, 1);
  results = [];
  outer: for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    for (j$ = 0, len1$ = yss.length; j$ < len1$; ++j$) {
      ys = yss[j$];
      if (!in$(x, ys)) {
        continue outer;
      }
    }
    results.push(x);
  }
  return results;
};
union = function(){
  var xss, results, i$, len$, xs, j$, len1$, x;
  xss = slice$.call(arguments);
  results = [];
  for (i$ = 0, len$ = xss.length; i$ < len$; ++i$) {
    xs = xss[i$];
    for (j$ = 0, len1$ = xs.length; j$ < len1$; ++j$) {
      x = xs[j$];
      if (!in$(x, results)) {
        results.push(x);
      }
    }
  }
  return results;
};
countBy = curry$(function(f, xs){
  var results, i$, len$, x, key;
  results = {};
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    key = f(x);
    if (key in results) {
      results[key] += 1;
    } else {
      results[key] = 1;
    }
  }
  return results;
});
groupBy = curry$(function(f, xs){
  var results, i$, len$, x, key;
  results = {};
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    key = f(x);
    if (key in results) {
      results[key].push(x);
    } else {
      results[key] = [x];
    }
  }
  return results;
});
andList = function(xs){
  var i$, len$, x;
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    if (!x) {
      return false;
    }
  }
  return true;
};
orList = function(xs){
  var i$, len$, x;
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    if (x) {
      return true;
    }
  }
  return false;
};
any = curry$(function(f, xs){
  var i$, len$, x;
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    if (f(x)) {
      return true;
    }
  }
  return false;
});
all = curry$(function(f, xs){
  var i$, len$, x;
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    if (!f(x)) {
      return false;
    }
  }
  return true;
});
sort = function(xs){
  return xs.concat().sort(function(x, y){
    if (x > y) {
      return 1;
    } else if (x < y) {
      return -1;
    } else {
      return 0;
    }
  });
};
sortWith = curry$(function(f, xs){
  return xs.concat().sort(f);
});
sortBy = curry$(function(f, xs){
  return xs.concat().sort(function(x, y){
    if (f(x) > f(y)) {
      return 1;
    } else if (f(x) < f(y)) {
      return -1;
    } else {
      return 0;
    }
  });
});
sum = function(xs){
  var result, i$, len$, x;
  result = 0;
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    result += x;
  }
  return result;
};
product = function(xs){
  var result, i$, len$, x;
  result = 1;
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    result *= x;
  }
  return result;
};
mean = average = function(xs){
  var sum, i$, len$, x;
  sum = 0;
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    x = xs[i$];
    sum += x;
  }
  return sum / xs.length;
};
maximum = function(xs){
  var max, i$, ref$, len$, x;
  max = xs[0];
  for (i$ = 0, len$ = (ref$ = xs.slice(1)).length; i$ < len$; ++i$) {
    x = ref$[i$];
    if (x > max) {
      max = x;
    }
  }
  return max;
};
minimum = function(xs){
  var min, i$, ref$, len$, x;
  min = xs[0];
  for (i$ = 0, len$ = (ref$ = xs.slice(1)).length; i$ < len$; ++i$) {
    x = ref$[i$];
    if (x < min) {
      min = x;
    }
  }
  return min;
};
maximumBy = curry$(function(f, xs){
  var max, i$, ref$, len$, x;
  max = xs[0];
  for (i$ = 0, len$ = (ref$ = xs.slice(1)).length; i$ < len$; ++i$) {
    x = ref$[i$];
    if (f(x) > f(max)) {
      max = x;
    }
  }
  return max;
});
minimumBy = curry$(function(f, xs){
  var min, i$, ref$, len$, x;
  min = xs[0];
  for (i$ = 0, len$ = (ref$ = xs.slice(1)).length; i$ < len$; ++i$) {
    x = ref$[i$];
    if (f(x) < f(min)) {
      min = x;
    }
  }
  return min;
});
scan = scanl = curry$(function(f, memo, xs){
  var last, x;
  last = memo;
  return [memo].concat((function(){
    var i$, ref$, len$, results$ = [];
    for (i$ = 0, len$ = (ref$ = xs).length; i$ < len$; ++i$) {
      x = ref$[i$];
      results$.push(last = f(last, x));
    }
    return results$;
  }()));
});
scan1 = scanl1 = curry$(function(f, xs){
  if (!xs.length) {
    return;
  }
  return scan(f, xs[0], xs.slice(1));
});
scanr = curry$(function(f, memo, xs){
  xs = xs.concat().reverse();
  return scan(f, memo, xs).reverse();
});
scanr1 = curry$(function(f, xs){
  if (!xs.length) {
    return;
  }
  xs = xs.concat().reverse();
  return scan(f, xs[0], xs.slice(1)).reverse();
});
slice = curry$(function(x, y, xs){
  return xs.slice(x, y);
});
take = curry$(function(n, xs){
  if (n <= 0) {
    return xs.slice(0, 0);
  } else {
    return xs.slice(0, n);
  }
});
drop = curry$(function(n, xs){
  if (n <= 0) {
    return xs;
  } else {
    return xs.slice(n);
  }
});
splitAt = curry$(function(n, xs){
  return [take(n, xs), drop(n, xs)];
});
takeWhile = curry$(function(p, xs){
  var len, i;
  len = xs.length;
  if (!len) {
    return xs;
  }
  i = 0;
  while (i < len && p(xs[i])) {
    i += 1;
  }
  return xs.slice(0, i);
});
dropWhile = curry$(function(p, xs){
  var len, i;
  len = xs.length;
  if (!len) {
    return xs;
  }
  i = 0;
  while (i < len && p(xs[i])) {
    i += 1;
  }
  return xs.slice(i);
});
span = curry$(function(p, xs){
  return [takeWhile(p, xs), dropWhile(p, xs)];
});
breakList = curry$(function(p, xs){
  return span(compose$(p, not$), xs);
});
zip = curry$(function(xs, ys){
  var result, len, i$, len$, i, x;
  result = [];
  len = ys.length;
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    i = i$;
    x = xs[i$];
    if (i === len) {
      break;
    }
    result.push([x, ys[i]]);
  }
  return result;
});
zipWith = curry$(function(f, xs, ys){
  var result, len, i$, len$, i, x;
  result = [];
  len = ys.length;
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    i = i$;
    x = xs[i$];
    if (i === len) {
      break;
    }
    result.push(f(x, ys[i]));
  }
  return result;
});
zipAll = function(){
  var xss, minLength, i$, len$, xs, ref$, i, lresult$, j$, results$ = [];
  xss = slice$.call(arguments);
  minLength = undefined;
  for (i$ = 0, len$ = xss.length; i$ < len$; ++i$) {
    xs = xss[i$];
    minLength <= (ref$ = xs.length) || (minLength = ref$);
  }
  for (i$ = 0; i$ < minLength; ++i$) {
    i = i$;
    lresult$ = [];
    for (j$ = 0, len$ = xss.length; j$ < len$; ++j$) {
      xs = xss[j$];
      lresult$.push(xs[i]);
    }
    results$.push(lresult$);
  }
  return results$;
};
zipAllWith = function(f){
  var xss, minLength, i$, len$, xs, ref$, i, results$ = [];
  xss = slice$.call(arguments, 1);
  minLength = undefined;
  for (i$ = 0, len$ = xss.length; i$ < len$; ++i$) {
    xs = xss[i$];
    minLength <= (ref$ = xs.length) || (minLength = ref$);
  }
  for (i$ = 0; i$ < minLength; ++i$) {
    i = i$;
    results$.push(f.apply(null, (fn$())));
  }
  return results$;
  function fn$(){
    var i$, ref$, len$, results$ = [];
    for (i$ = 0, len$ = (ref$ = xss).length; i$ < len$; ++i$) {
      xs = ref$[i$];
      results$.push(xs[i]);
    }
    return results$;
  }
};
at = curry$(function(n, xs){
  if (n < 0) {
    return xs[xs.length + n];
  } else {
    return xs[n];
  }
});
elemIndex = curry$(function(el, xs){
  var i$, len$, i, x;
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    i = i$;
    x = xs[i$];
    if (x === el) {
      return i;
    }
  }
});
elemIndices = curry$(function(el, xs){
  var i$, len$, i, x, results$ = [];
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    i = i$;
    x = xs[i$];
    if (x === el) {
      results$.push(i);
    }
  }
  return results$;
});
findIndex = curry$(function(f, xs){
  var i$, len$, i, x;
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    i = i$;
    x = xs[i$];
    if (f(x)) {
      return i;
    }
  }
});
findIndices = curry$(function(f, xs){
  var i$, len$, i, x, results$ = [];
  for (i$ = 0, len$ = xs.length; i$ < len$; ++i$) {
    i = i$;
    x = xs[i$];
    if (f(x)) {
      results$.push(i);
    }
  }
  return results$;
});
module.exports = {
  each: each,
  map: map,
  filter: filter,
  compact: compact,
  reject: reject,
  partition: partition,
  find: find,
  head: head,
  first: first,
  tail: tail,
  last: last,
  initial: initial,
  empty: empty,
  reverse: reverse,
  difference: difference,
  intersection: intersection,
  union: union,
  countBy: countBy,
  groupBy: groupBy,
  fold: fold,
  fold1: fold1,
  foldl: foldl,
  foldl1: foldl1,
  foldr: foldr,
  foldr1: foldr1,
  unfoldr: unfoldr,
  andList: andList,
  orList: orList,
  any: any,
  all: all,
  unique: unique,
  uniqueBy: uniqueBy,
  sort: sort,
  sortWith: sortWith,
  sortBy: sortBy,
  sum: sum,
  product: product,
  mean: mean,
  average: average,
  concat: concat,
  concatMap: concatMap,
  flatten: flatten,
  maximum: maximum,
  minimum: minimum,
  maximumBy: maximumBy,
  minimumBy: minimumBy,
  scan: scan,
  scan1: scan1,
  scanl: scanl,
  scanl1: scanl1,
  scanr: scanr,
  scanr1: scanr1,
  slice: slice,
  take: take,
  drop: drop,
  splitAt: splitAt,
  takeWhile: takeWhile,
  dropWhile: dropWhile,
  span: span,
  breakList: breakList,
  zip: zip,
  zipWith: zipWith,
  zipAll: zipAll,
  zipAllWith: zipAllWith,
  at: at,
  elemIndex: elemIndex,
  elemIndices: elemIndices,
  findIndex: findIndex,
  findIndices: findIndices
};
function curry$(f, bound){
  var context,
  _curry = function(args) {
    return f.length > 1 ? function(){
      var params = args ? args.concat() : [];
      context = bound ? context || this : this;
      return params.push.apply(params, arguments) <
          f.length && arguments.length ?
        _curry.call(context, params) : f.apply(context, params);
    } : f;
  };
  return _curry();
}
function in$(x, xs){
  var i = -1, l = xs.length >>> 0;
  while (++i < l) if (x === xs[i]) return true;
  return false;
}
function compose$() {
  var functions = arguments;
  return function() {
    var i, result;
    result = functions[0].apply(this, arguments);
    for (i = 1; i < functions.length; ++i) {
      result = functions[i](result);
    }
    return result;
  };
}
function not$(x){ return !x; }
},{}],33:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var max, min, negate, abs, signum, quot, rem, div, mod, recip, pi, tau, exp, sqrt, ln, pow, sin, tan, cos, asin, acos, atan, atan2, truncate, round, ceiling, floor, isItNaN, even, odd, gcd, lcm;
max = curry$(function(x$, y$){
  return x$ > y$ ? x$ : y$;
});
min = curry$(function(x$, y$){
  return x$ < y$ ? x$ : y$;
});
negate = function(x){
  return -x;
};
abs = Math.abs;
signum = function(x){
  if (x < 0) {
    return -1;
  } else if (x > 0) {
    return 1;
  } else {
    return 0;
  }
};
quot = curry$(function(x, y){
  return ~~(x / y);
});
rem = curry$(function(x$, y$){
  return x$ % y$;
});
div = curry$(function(x, y){
  return Math.floor(x / y);
});
mod = curry$(function(x$, y$){
  var ref$;
  return (((x$) % (ref$ = y$) + ref$) % ref$);
});
recip = (function(it){
  return 1 / it;
});
pi = Math.PI;
tau = pi * 2;
exp = Math.exp;
sqrt = Math.sqrt;
ln = Math.log;
pow = curry$(function(x$, y$){
  return Math.pow(x$, y$);
});
sin = Math.sin;
tan = Math.tan;
cos = Math.cos;
asin = Math.asin;
acos = Math.acos;
atan = Math.atan;
atan2 = curry$(function(x, y){
  return Math.atan2(x, y);
});
truncate = function(x){
  return ~~x;
};
round = Math.round;
ceiling = Math.ceil;
floor = Math.floor;
isItNaN = function(x){
  return x !== x;
};
even = function(x){
  return x % 2 === 0;
};
odd = function(x){
  return x % 2 !== 0;
};
gcd = curry$(function(x, y){
  var z;
  x = Math.abs(x);
  y = Math.abs(y);
  while (y !== 0) {
    z = x % y;
    x = y;
    y = z;
  }
  return x;
});
lcm = curry$(function(x, y){
  return Math.abs(Math.floor(x / gcd(x, y) * y));
});
module.exports = {
  max: max,
  min: min,
  negate: negate,
  abs: abs,
  signum: signum,
  quot: quot,
  rem: rem,
  div: div,
  mod: mod,
  recip: recip,
  pi: pi,
  tau: tau,
  exp: exp,
  sqrt: sqrt,
  ln: ln,
  pow: pow,
  sin: sin,
  tan: tan,
  cos: cos,
  acos: acos,
  asin: asin,
  atan: atan,
  atan2: atan2,
  truncate: truncate,
  round: round,
  ceiling: ceiling,
  floor: floor,
  isItNaN: isItNaN,
  even: even,
  odd: odd,
  gcd: gcd,
  lcm: lcm
};
function curry$(f, bound){
  var context,
  _curry = function(args) {
    return f.length > 1 ? function(){
      var params = args ? args.concat() : [];
      context = bound ? context || this : this;
      return params.push.apply(params, arguments) <
          f.length && arguments.length ?
        _curry.call(context, params) : f.apply(context, params);
    } : f;
  };
  return _curry();
}
},{}],34:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var values, keys, pairsToObj, objToPairs, listsToObj, objToLists, empty, each, map, compact, filter, reject, partition, find;
values = function(object){
  var i$, x, results$ = [];
  for (i$ in object) {
    x = object[i$];
    results$.push(x);
  }
  return results$;
};
keys = function(object){
  var x, results$ = [];
  for (x in object) {
    results$.push(x);
  }
  return results$;
};
pairsToObj = function(object){
  var i$, len$, x, resultObj$ = {};
  for (i$ = 0, len$ = object.length; i$ < len$; ++i$) {
    x = object[i$];
    resultObj$[x[0]] = x[1];
  }
  return resultObj$;
};
objToPairs = function(object){
  var key, value, results$ = [];
  for (key in object) {
    value = object[key];
    results$.push([key, value]);
  }
  return results$;
};
listsToObj = curry$(function(keys, values){
  var i$, len$, i, key, resultObj$ = {};
  for (i$ = 0, len$ = keys.length; i$ < len$; ++i$) {
    i = i$;
    key = keys[i$];
    resultObj$[key] = values[i];
  }
  return resultObj$;
});
objToLists = function(object){
  var keys, values, key, value;
  keys = [];
  values = [];
  for (key in object) {
    value = object[key];
    keys.push(key);
    values.push(value);
  }
  return [keys, values];
};
empty = function(object){
  var x;
  for (x in object) {
    return false;
  }
  return true;
};
each = curry$(function(f, object){
  var i$, x;
  for (i$ in object) {
    x = object[i$];
    f(x);
  }
  return object;
});
map = curry$(function(f, object){
  var k, x, resultObj$ = {};
  for (k in object) {
    x = object[k];
    resultObj$[k] = f(x);
  }
  return resultObj$;
});
compact = function(object){
  var k, x, resultObj$ = {};
  for (k in object) {
    x = object[k];
    if (x) {
      resultObj$[k] = x;
    }
  }
  return resultObj$;
};
filter = curry$(function(f, object){
  var k, x, resultObj$ = {};
  for (k in object) {
    x = object[k];
    if (f(x)) {
      resultObj$[k] = x;
    }
  }
  return resultObj$;
});
reject = curry$(function(f, object){
  var k, x, resultObj$ = {};
  for (k in object) {
    x = object[k];
    if (!f(x)) {
      resultObj$[k] = x;
    }
  }
  return resultObj$;
});
partition = curry$(function(f, object){
  var passed, failed, k, x;
  passed = {};
  failed = {};
  for (k in object) {
    x = object[k];
    (f(x) ? passed : failed)[k] = x;
  }
  return [passed, failed];
});
find = curry$(function(f, object){
  var i$, x;
  for (i$ in object) {
    x = object[i$];
    if (f(x)) {
      return x;
    }
  }
});
module.exports = {
  values: values,
  keys: keys,
  pairsToObj: pairsToObj,
  objToPairs: objToPairs,
  listsToObj: listsToObj,
  objToLists: objToLists,
  empty: empty,
  each: each,
  map: map,
  filter: filter,
  compact: compact,
  reject: reject,
  partition: partition,
  find: find
};
function curry$(f, bound){
  var context,
  _curry = function(args) {
    return f.length > 1 ? function(){
      var params = args ? args.concat() : [];
      context = bound ? context || this : this;
      return params.push.apply(params, arguments) <
          f.length && arguments.length ?
        _curry.call(context, params) : f.apply(context, params);
    } : f;
  };
  return _curry();
}
},{}],35:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var split, join, lines, unlines, words, unwords, chars, unchars, reverse, repeat, capitalize, camelize, dasherize;
split = curry$(function(sep, str){
  return str.split(sep);
});
join = curry$(function(sep, xs){
  return xs.join(sep);
});
lines = function(str){
  if (!str.length) {
    return [];
  }
  return str.split('\n');
};
unlines = function(it){
  return it.join('\n');
};
words = function(str){
  if (!str.length) {
    return [];
  }
  return str.split(/[ ]+/);
};
unwords = function(it){
  return it.join(' ');
};
chars = function(it){
  return it.split('');
};
unchars = function(it){
  return it.join('');
};
reverse = function(str){
  return str.split('').reverse().join('');
};
repeat = curry$(function(n, str){
  var result, i$;
  result = '';
  for (i$ = 0; i$ < n; ++i$) {
    result += str;
  }
  return result;
});
capitalize = function(str){
  return str.charAt(0).toUpperCase() + str.slice(1);
};
camelize = function(it){
  return it.replace(/[-_]+(.)?/g, function(arg$, c){
    return (c != null ? c : '').toUpperCase();
  });
};
dasherize = function(str){
  return str.replace(/([^-A-Z])([A-Z]+)/g, function(arg$, lower, upper){
    return lower + "-" + (upper.length > 1
      ? upper
      : upper.toLowerCase());
  }).replace(/^([A-Z]+)/, function(arg$, upper){
    if (upper.length > 1) {
      return upper + "-";
    } else {
      return upper.toLowerCase();
    }
  });
};
module.exports = {
  split: split,
  join: join,
  lines: lines,
  unlines: unlines,
  words: words,
  unwords: unwords,
  chars: chars,
  unchars: unchars,
  reverse: reverse,
  repeat: repeat,
  capitalize: capitalize,
  camelize: camelize,
  dasherize: dasherize
};
function curry$(f, bound){
  var context,
  _curry = function(args) {
    return f.length > 1 ? function(){
      var params = args ? args.concat() : [];
      context = bound ? context || this : this;
      return params.push.apply(params, arguments) <
          f.length && arguments.length ?
        _curry.call(context, params) : f.apply(context, params);
    } : f;
  };
  return _curry();
}
},{}],36:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var Func, List, Obj, Str, Num, id, isType, replicate, prelude, toString$ = {}.toString;
Func = require('./Func.js');
List = require('./List.js');
Obj = require('./Obj.js');
Str = require('./Str.js');
Num = require('./Num.js');
id = function(x){
  return x;
};
isType = curry$(function(type, x){
  return toString$.call(x).slice(8, -1) === type;
});
replicate = curry$(function(n, x){
  var i$, results$ = [];
  for (i$ = 0; i$ < n; ++i$) {
    results$.push(x);
  }
  return results$;
});
Str.empty = List.empty;
Str.slice = List.slice;
Str.take = List.take;
Str.drop = List.drop;
Str.splitAt = List.splitAt;
Str.takeWhile = List.takeWhile;
Str.dropWhile = List.dropWhile;
Str.span = List.span;
Str.breakStr = List.breakList;
prelude = {
  Func: Func,
  List: List,
  Obj: Obj,
  Str: Str,
  Num: Num,
  id: id,
  isType: isType,
  replicate: replicate
};
prelude.each = List.each;
prelude.map = List.map;
prelude.filter = List.filter;
prelude.compact = List.compact;
prelude.reject = List.reject;
prelude.partition = List.partition;
prelude.find = List.find;
prelude.head = List.head;
prelude.first = List.first;
prelude.tail = List.tail;
prelude.last = List.last;
prelude.initial = List.initial;
prelude.empty = List.empty;
prelude.reverse = List.reverse;
prelude.difference = List.difference;
prelude.intersection = List.intersection;
prelude.union = List.union;
prelude.countBy = List.countBy;
prelude.groupBy = List.groupBy;
prelude.fold = List.fold;
prelude.foldl = List.foldl;
prelude.fold1 = List.fold1;
prelude.foldl1 = List.foldl1;
prelude.foldr = List.foldr;
prelude.foldr1 = List.foldr1;
prelude.unfoldr = List.unfoldr;
prelude.andList = List.andList;
prelude.orList = List.orList;
prelude.any = List.any;
prelude.all = List.all;
prelude.unique = List.unique;
prelude.uniqueBy = List.uniqueBy;
prelude.sort = List.sort;
prelude.sortWith = List.sortWith;
prelude.sortBy = List.sortBy;
prelude.sum = List.sum;
prelude.product = List.product;
prelude.mean = List.mean;
prelude.average = List.average;
prelude.concat = List.concat;
prelude.concatMap = List.concatMap;
prelude.flatten = List.flatten;
prelude.maximum = List.maximum;
prelude.minimum = List.minimum;
prelude.maximumBy = List.maximumBy;
prelude.minimumBy = List.minimumBy;
prelude.scan = List.scan;
prelude.scanl = List.scanl;
prelude.scan1 = List.scan1;
prelude.scanl1 = List.scanl1;
prelude.scanr = List.scanr;
prelude.scanr1 = List.scanr1;
prelude.slice = List.slice;
prelude.take = List.take;
prelude.drop = List.drop;
prelude.splitAt = List.splitAt;
prelude.takeWhile = List.takeWhile;
prelude.dropWhile = List.dropWhile;
prelude.span = List.span;
prelude.breakList = List.breakList;
prelude.zip = List.zip;
prelude.zipWith = List.zipWith;
prelude.zipAll = List.zipAll;
prelude.zipAllWith = List.zipAllWith;
prelude.at = List.at;
prelude.elemIndex = List.elemIndex;
prelude.elemIndices = List.elemIndices;
prelude.findIndex = List.findIndex;
prelude.findIndices = List.findIndices;
prelude.apply = Func.apply;
prelude.curry = Func.curry;
prelude.flip = Func.flip;
prelude.fix = Func.fix;
prelude.over = Func.over;
prelude.split = Str.split;
prelude.join = Str.join;
prelude.lines = Str.lines;
prelude.unlines = Str.unlines;
prelude.words = Str.words;
prelude.unwords = Str.unwords;
prelude.chars = Str.chars;
prelude.unchars = Str.unchars;
prelude.repeat = Str.repeat;
prelude.capitalize = Str.capitalize;
prelude.camelize = Str.camelize;
prelude.dasherize = Str.dasherize;
prelude.values = Obj.values;
prelude.keys = Obj.keys;
prelude.pairsToObj = Obj.pairsToObj;
prelude.objToPairs = Obj.objToPairs;
prelude.listsToObj = Obj.listsToObj;
prelude.objToLists = Obj.objToLists;
prelude.max = Num.max;
prelude.min = Num.min;
prelude.negate = Num.negate;
prelude.abs = Num.abs;
prelude.signum = Num.signum;
prelude.quot = Num.quot;
prelude.rem = Num.rem;
prelude.div = Num.div;
prelude.mod = Num.mod;
prelude.recip = Num.recip;
prelude.pi = Num.pi;
prelude.tau = Num.tau;
prelude.exp = Num.exp;
prelude.sqrt = Num.sqrt;
prelude.ln = Num.ln;
prelude.pow = Num.pow;
prelude.sin = Num.sin;
prelude.tan = Num.tan;
prelude.cos = Num.cos;
prelude.acos = Num.acos;
prelude.asin = Num.asin;
prelude.atan = Num.atan;
prelude.atan2 = Num.atan2;
prelude.truncate = Num.truncate;
prelude.round = Num.round;
prelude.ceiling = Num.ceiling;
prelude.floor = Num.floor;
prelude.isItNaN = Num.isItNaN;
prelude.even = Num.even;
prelude.odd = Num.odd;
prelude.gcd = Num.gcd;
prelude.lcm = Num.lcm;
prelude.VERSION = '1.1.2';
module.exports = prelude;
function curry$(f, bound){
  var context,
  _curry = function(args) {
    return f.length > 1 ? function(){
      var params = args ? args.concat() : [];
      context = bound ? context || this : this;
      return params.push.apply(params, arguments) <
          f.length && arguments.length ?
        _curry.call(context, params) : f.apply(context, params);
    } : f;
  };
  return _curry();
}
},{"./Func.js":31,"./List.js":32,"./Num.js":33,"./Obj.js":34,"./Str.js":35}],37:[function(require,module,exports){
// Generated by LiveScript 1.4.0
module.exports = {
  key_codes: {
    a: 65,
    b: 66,
    c: 67,
    d: 68,
    e: 69,
    f: 70,
    g: 71,
    h: 72,
    i: 73,
    j: 74,
    k: 75,
    l: 76,
    m: 77,
    n: 78,
    o: 79,
    p: 80,
    q: 81,
    r: 82,
    s: 83,
    t: 84,
    u: 85,
    v: 86,
    w: 87,
    x: 88,
    y: 89,
    z: 90
  }
};



},{}],38:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var preludeLs, ref$, lazy, except, act, may, return_, when_, find_board, is_scrum, lists, is_editing, stylize, format, listen, listen_o_key, listen_i_key, track_mouse, format_lists, main;
preludeLs = require('prelude-ls');
ref$ = require('glad-functions'), lazy = ref$.lazy, except = ref$.except, act = ref$.act, may = ref$.may, return_ = ref$.return_, when_ = ref$.when_;
ref$ = require('./services/board-manager.ls'), find_board = ref$.find, is_scrum = ref$.is_scrum;
ref$ = require('./services/list-manager.ls'), lists = ref$.lists, is_editing = ref$.is_editing, stylize = ref$.stylize, format = ref$.format, listen = ref$.listen, listen_o_key = ref$.listen_o_key;
listen_i_key = require('./services/card-manager.ls').listen_i_key;
track_mouse = require('./services/mouse-tracker.ls').start;
format_lists = function(){
  return lazy(setTimeout, format_lists, 2000)(
  may(when_(is_scrum, compose$(lists, each(except(is_editing, compose$(stylize, format, listen))))))(
  find_board()));
};
(main = compose$(format_lists, track_mouse, listen_o_key, listen_i_key))();
function compose$() {
  var functions = arguments;
  return function() {
    var i, result;
    result = functions[0].apply(this, arguments);
    for (i = 1; i < functions.length; ++i) {
      result = functions[i](result);
    }
    return result;
  };
}



},{"./services/board-manager.ls":39,"./services/card-manager.ls":40,"./services/list-manager.ls":42,"./services/mouse-tracker.ls":43,"glad-functions":15,"prelude-ls":36}],39:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var lazy, ref$, lists, type, query, selector, BoardManager;
lazy = require('glad-functions').lazy;
ref$ = require('./list-manager.ls'), lists = ref$.lists, type = ref$.type;
query = require('domf').query;
selector = '#board';
module.exports = new (BoardManager = (function(){
  BoardManager.displayName = 'BoardManager';
  var find, prototype = BoardManager.prototype, constructor = BoardManager;
  prototype.find = find = lazy(query, selector, document);
  prototype.is_scrum = compose$(lists, any(compose$(type, (function(it){
    return it === 'Idea' || it === 'Plan' || it === 'Current' || it === 'Doing' || it === 'Done';
  }))));
  function BoardManager(){}
  return BoardManager;
}()));
function compose$() {
  var functions = arguments;
  return function() {
    var i, result;
    result = functions[0].apply(this, arguments);
    for (i = 1; i < functions.length; ++i) {
      result = functions[i](result);
    }
    return result;
  };
}



},{"./list-manager.ls":42,"domf":7,"glad-functions":15}],40:[function(require,module,exports){
(function (global){
// Generated by LiveScript 1.4.0
var ref$, find_map, match_, except, return_, lazy, may, act, ref1$, get, let_, classes, set_style, children, query, attr, parents, has_class, on_keydown, current_element, yank, selector, class_name, label_orders, CardManager, slice$ = [].slice;
ref$ = require('glad-functions'), find_map = ref$.find_map, match_ = ref$.match_, except = ref$.except, return_ = ref$.return_, lazy = ref$.lazy, may = ref$.may, act = ref$.act, ref1$ = ref$.Obj, get = ref1$.get, let_ = ref1$.let_;
ref$ = require('domf'), classes = ref$.classes, set_style = ref$.set_style, children = ref$.children, query = ref$.query, attr = ref$.attr, parents = ref$.parents, has_class = ref$.has_class;
on_keydown = require('./dom.ls').on_keydown;
current_element = require('./mouse-tracker.ls').element;
yank = require('./yanker.ls').yank;
selector = '.list-card';
class_name = 'list-card';
label_orders = {
  green: 0,
  yellow: 1,
  orange: 2,
  red: 3,
  purple: 4,
  blue: 5,
  sky: 6
};
module.exports = new (CardManager = (function(){
  CardManager.displayName = 'CardManager';
  var listen_i_key, current_card, title_elm, id, yank_id, colorize, uncolorize, effect, cards, label_color, label_order, prototype = CardManager.prototype, constructor = CardManager;
  prototype.listen_i_key = listen_i_key = function(){
    return act(on_keydown('i', compose$(current_card, may(compose$(yank_id, effect)))));
  };
  prototype.current_card = current_card = function(){
    return find(has_class(class_name))(
    parents(
    current_element()));
  };
  prototype.title_elm = title_elm = query("a.list-card-title");
  prototype.id = id = compose$(title_elm, attr('href'), match_(/\/c\/([^/]+)\//), at(1));
  prototype.yank_id = yank_id = act(compose$(id, yank));
  prototype.colorize = colorize = act(compose$(act(set_style('transition', "all 0.4s ease-in-out")), set_style('background', 'black')));
  prototype.uncolorize = uncolorize = act(compose$(act(set_style('transition', "")), set_style('background', 'white')));
  prototype.effect = effect = compose$(colorize, partialize$.apply(CardManager, [lazy, [uncolorize, void 8], [1]]), partialize$.apply(CardManager, [let_, [global, 'setTimeout', void 8, 300], [2]]));
  prototype.cards = cards = compose$(query('.list-cards'), children);
  prototype.label_color = label_color = compose$(query('.card-label'), may(compose$(compose$(classes, find_map(match_(/card-label-(\w+)/))), may(at(1)))));
  prototype.label_order = label_order = compose$(label_color, partialize$.apply(CardManager, [get, [void 8, label_orders], [0]]), except(function(it){
    return it != null;
  }, return_(99)));
  function CardManager(){}
  return CardManager;
}()));
function compose$() {
  var functions = arguments;
  return function() {
    var i, result;
    result = functions[0].apply(this, arguments);
    for (i = 1; i < functions.length; ++i) {
      result = functions[i](result);
    }
    return result;
  };
}
function partialize$(f, args, where){
  var context = this;
  return function(){
    var params = slice$.call(arguments), i,
        len = params.length, wlen = where.length,
        ta = args ? args.concat() : [], tw = where ? where.concat() : [];
    for(i = 0; i < len; ++i) { ta[tw[0]] = params[i]; tw.shift(); }
    return len < wlen && len ?
      partialize$.apply(context, [f, ta, tw]) : f.apply(context, ta);
  };
}



}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./dom.ls":41,"./mouse-tracker.ls":43,"./yanker.ls":44,"domf":7,"glad-functions":15}],41:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var key_codes, ref$, when_, ref1$, get, let_, Dom;
key_codes = require('../configs/constants.ls').key_codes;
ref$ = require('glad-functions'), when_ = ref$.when_, ref1$ = ref$.Obj, get = ref1$.get, let_ = ref1$.let_;
module.exports = new (Dom = (function(){
  Dom.displayName = 'Dom';
  var prototype = Dom.prototype, constructor = Dom;
  prototype.on_keydown = function(key, cb){
    return let_(document, 'addEventListener', 'keydown', when_(compose$(get('keyCode'), (function(it){
      return it === get(key, key_codes);
    })), cb));
  };
  function Dom(){}
  return Dom;
}()));
function compose$() {
  var functions = arguments;
  return function() {
    var i, result;
    result = functions[0].apply(this, arguments);
    for (i = 1; i < functions.length; ++i) {
      result = functions[i](result);
    }
    return result;
  };
}



},{"../configs/constants.ls":37,"glad-functions":15}],42:[function(require,module,exports){
(function (global){
// Generated by LiveScript 1.4.0
var debounce, ref$, dist, match_, unless_, case_, otherwise_, lazy, return_, $, act, may, ref1$, let_, get, set, outer_html, set_html, add_class, remove_class, parents, query, has_class, set_style, query_all, on_keydown, current_element, cards, label_order, selector, class_name, ListManager, slice$ = [].slice;
debounce = require('debounce');
ref$ = require('glad-functions'), dist = ref$.dist, match_ = ref$.match_, unless_ = ref$.unless_, case_ = ref$.case_, otherwise_ = ref$.otherwise_, lazy = ref$.lazy, return_ = ref$.return_, $ = ref$.$, act = ref$.act, may = ref$.may, ref1$ = ref$.Obj, let_ = ref1$.let_, get = ref1$.get, set = ref1$.set;
ref$ = require('domf'), outer_html = ref$.outer_html, set_html = ref$.set_html, add_class = ref$.add_class, remove_class = ref$.remove_class, parents = ref$.parents, query = ref$.query, has_class = ref$.has_class, set_style = ref$.set_style, query_all = ref$.query_all;
on_keydown = require('./dom.ls').on_keydown;
current_element = require('./mouse-tracker.ls').element;
ref$ = require('./card-manager.ls'), cards = ref$.cards, label_order = ref$.label_order;
selector = "div.list:not(.mod-add)";
class_name = "list";
module.exports = new (ListManager = (function(){
  ListManager.displayName = 'ListManager';
  var lists, cards_container_elm, editing_target_elm, name_elm, assist_elm, title, type, period, time_resource, hide, show, set_background, set_opacity, set_font_size, switch_header, revert_header, listen_header_clicked, description, format, sorted_cards, set_sorted_cards, toggle, sort, listen_o_key, current_list, listen, prototype = ListManager.prototype, constructor = ListManager;
  prototype.lists = lists = query_all(selector);
  prototype.cards_container_elm = cards_container_elm = query('.list-cards');
  prototype.editing_target_elm = editing_target_elm = query('.js-editing-target');
  prototype.name_elm = name_elm = query('.list-header-name');
  prototype.assist_elm = assist_elm = query('.list-header-name-assist');
  prototype.title = title = compose$(name_elm, get('value'));
  prototype.type = type = compose$(title, match_(/\(([^)]+)\)/), may(at(1)));
  prototype.period = period = compose$(title, match_(/<([^>]+)>/), may(at(1)));
  prototype.time_resource = time_resource = compose$(title, match_(/\[([^\]]+)\]/), may(at(1)));
  prototype.hide = hide = set_style('display', 'none');
  prototype.show = show = set_style('display', 'block');
  prototype.is_editing = compose$(name_elm, get('classList'), any((function(it){
    return it === 'is-editing';
  })));
  prototype.set_background = set_background = function(list){
    return set_style('background', (function(){
      switch (type(list)) {
      case 'Idea':
        return '#dff';
      case 'Plan':
        return '#ddf';
      case 'DoingInAdvance':
        return '#dfd';
      case 'Current':
        return '#ffd';
      case 'Doing':
        return '#fdd';
      default:
        return "";
      }
    }()), list);
  };
  prototype.set_opacity = set_opacity = function(list){
    return set_style('opacity', (function(){
      switch (type(list)) {
      case 'Done':
        return 0.8;
      default:
        return 1;
      }
    }()), list);
  };
  prototype.set_font_size = set_font_size = compose$(assist_elm, set_style('fontSize', '14px'));
  prototype.switch_header = switch_header = compose$(curry$(function(x$, y$){
    return y$(x$);
  }), flip$(each)([compose$(name_elm, hide), compose$(assist_elm, show)]));
  prototype.revert_header = revert_header = compose$(curry$(function(x$, y$){
    return y$(x$);
  }), flip$(each)([compose$(assist_elm, hide), compose$(name_elm, show)]));
  prototype.listen_header_clicked = listen_header_clicked = act(compose$(partialize$.apply(ListManager, [dist, [void 8, [editing_target_elm, compose$(partialize$.apply(ListManager, [lazy, [revert_header, void 8], [1]]), partialize$.apply(ListManager, [debounce, [void 8, 150], [0]]))]], [0]]), act(apply(partialize$.apply(ListManager, [let_, [void 8, 'addEventListener', 'click', void 8], [0, 3]]))), partialize$.apply(ListManager, [lazy, [apply(partialize$.apply(ListManager, [let_, [void 8, 'removeEventListener', 'click', void 8], [0, 3]])), void 8], [1]]), partialize$.apply(ListManager, [let_, [global, 'setTimeout', void 8, 2000], [2]])));
  prototype.stylize = act(fold1(curry$(function(x$, y$){
    return compose$(x$, y$);
  }), [act(set_background), act(set_opacity), act(set_font_size), act(switch_header)]));
  prototype.description = description = compose$(partialize$.apply(ListManager, [dist, [void 8, [type, period, time_resource]], [0]]), compact, join("<br>"));
  prototype.format = format = act(compose$(partialize$.apply(ListManager, [dist, [void 8, [description, assist_elm]], [0]]), act(apply(partialize$.apply(ListManager, [set, ['innerHTML', void 8, void 8], [1, 2]])))));
  prototype.sorted_cards = sorted_cards = compose$(partialize$.apply(ListManager, [dist, [void 8, [has_class('reversed'), compose$(cards, sortBy(label_order))]], [0]]), apply(partialize$.apply(ListManager, [unless_, [void 8, reverse, void 8], [0, 2]])));
  prototype.set_sorted_cards = set_sorted_cards = act(compose$(partialize$.apply(ListManager, [dist, [void 8, [compose$(sorted_cards, map(outer_html), join("")), cards_container_elm]], [0]]), apply(set_html)));
  prototype.toggle = toggle = compose$(case_(has_class('reversed'), remove_class('reversed')), otherwise_(add_class('reversed')));
  prototype.sort = sort = compose$(set_sorted_cards, toggle);
  prototype.listen_o_key = listen_o_key = function(){
    return act(on_keydown('o', compose$(current_list, may(sort))));
  };
  prototype.current_list = current_list = function(){
    return find(has_class(class_name))(
    parents(
    current_element()));
  };
  prototype.listen = listen = listen_header_clicked;
  function ListManager(){}
  return ListManager;
}()));
function compose$() {
  var functions = arguments;
  return function() {
    var i, result;
    result = functions[0].apply(this, arguments);
    for (i = 1; i < functions.length; ++i) {
      result = functions[i](result);
    }
    return result;
  };
}
function curry$(f, bound){
  var context,
  _curry = function(args) {
    return f.length > 1 ? function(){
      var params = args ? args.concat() : [];
      context = bound ? context || this : this;
      return params.push.apply(params, arguments) <
          f.length && arguments.length ?
        _curry.call(context, params) : f.apply(context, params);
    } : f;
  };
  return _curry();
}
function flip$(f){
  return curry$(function (x, y) { return f(y, x); });
}
function partialize$(f, args, where){
  var context = this;
  return function(){
    var params = slice$.call(arguments), i,
        len = params.length, wlen = where.length,
        ta = args ? args.concat() : [], tw = where ? where.concat() : [];
    for(i = 0; i < len; ++i) { ta[tw[0]] = params[i]; tw.shift(); }
    return len < wlen && len ?
      partialize$.apply(context, [f, ta, tw]) : f.apply(context, ta);
  };
}



}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./card-manager.ls":40,"./dom.ls":41,"./mouse-tracker.ls":43,"debounce":5,"domf":7,"glad-functions":15}],43:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var ref$, dist, ref1$, get, let_, x, y, MouseTracker, slice$ = [].slice;
ref$ = require('glad-functions'), dist = ref$.dist, ref1$ = ref$.Obj, get = ref1$.get, let_ = ref1$.let_;
x = 0;
y = 0;
module.exports = new (MouseTracker = (function(){
  MouseTracker.displayName = 'MouseTracker';
  var memorize, position, element, prototype = MouseTracker.prototype, constructor = MouseTracker;
  prototype.start = function(){
    return let_(document, 'addEventListener', 'mousemove', compose$(partialize$.apply(this, [dist, [void 8, [get('pageX'), get('pageY')]], [0]]), apply(memorize)));
  };
  prototype.memorize = memorize = function(_x, _y){
    x = _x;
    return y = _y;
  };
  prototype.position = position = function(){
    return [x, y];
  };
  prototype.element = element = function(){
    return let_(document, 'elementFromPoint', x, y);
  };
  function MouseTracker(){}
  return MouseTracker;
}()));
function compose$() {
  var functions = arguments;
  return function() {
    var i, result;
    result = functions[0].apply(this, arguments);
    for (i = 1; i < functions.length; ++i) {
      result = functions[i](result);
    }
    return result;
  };
}
function partialize$(f, args, where){
  var context = this;
  return function(){
    var params = slice$.call(arguments), i,
        len = params.length, wlen = where.length,
        ta = args ? args.concat() : [], tw = where ? where.concat() : [];
    for(i = 0; i < len; ++i) { ta[tw[0]] = params[i]; tw.shift(); }
    return len < wlen && len ?
      partialize$.apply(context, [f, ta, tw]) : f.apply(context, ta);
  };
}



},{"glad-functions":15}],44:[function(require,module,exports){
// Generated by LiveScript 1.4.0
var ref$, act, lazy, ref1$, get, let_, append_to, set_text, select, blur, set_style, create, Yanker;
ref$ = require('glad-functions'), act = ref$.act, lazy = ref$.lazy, ref1$ = ref$.Obj, get = ref1$.get, let_ = ref1$.let_;
ref$ = require('domf'), append_to = ref$.append_to, set_text = ref$.set_text, select = ref$.select, blur = ref$.blur, set_style = ref$.set_style, create = ref$.create;
module.exports = new (Yanker = (function(){
  Yanker.displayName = 'Yanker';
  var dummy_textarea, prototype = Yanker.prototype, constructor = Yanker;
  prototype.yank = function(str){
    return act(blur)(
    act(lazy(let_, document, 'execCommand', 'copy'))(
    act(select)(
    act(set_text(str))(
    act(append_to(get('body', document)))(
    dummy_textarea())))));
  };
  prototype.dummy_textarea = dummy_textarea = compose$(lazy(create, 'textarea'), act(set_style('position', 'fixed')), act(set_style('top', '-1000px')));
  function Yanker(){}
  return Yanker;
}()));
function compose$() {
  var functions = arguments;
  return function() {
    var i, result;
    result = functions[0].apply(this, arguments);
    for (i = 1; i < functions.length; ++i) {
      result = functions[i](result);
    }
    return result;
  };
}



},{"domf":7,"glad-functions":15}]},{},[38]);
