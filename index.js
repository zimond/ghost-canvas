if ( typeof module !== 'undefined' && module.exports ) module.exports = function GhostCanvas(callback) {
  // register document on web worker
  var inWorker = self.document === undefined
  var post = callback || self.postMessage
  if (!self.document) self.document = self.window = {
    createElement: function(tagName) {
      if (tagName === 'canvas') return new GhostCanvas();
      else if (tagName === 'img') return new GhostImage();
    }
  };
  self.CanvasRenderingContext2D = GhostCanvasContext;

  var globalCounter = 0;

  function GhostImage() {
    var _src = null, that = this, _onload = null;
    this._id = globalCounter++;
    this._crossOrigin = null;
    this._tag = 'img'
    Object.defineProperty(this, 'crossOrigin', {
      get: function() { return _crossOrigin; },
      set: function(value) {
        _crossOrigin = value
        post({ type: 'set', id: that._id, tag: 'img', key: 'crossOrigin', value: _src });
      }
    });
    Object.defineProperty(this, 'src', {
      get: function() { return _src; },
      set: function(value) {
        _src = value;
        post({ type: 'set', id: that._id, tag: 'img', key: 'src', value: _src });
        if (_onload) _onload()
      }
    });
    Object.defineProperty(this, 'onload', {
      get: function() { return _onload; },
      set: function(cb) {
        _onload = cb;
      }
    });
    post({ type: 'create', id: that._id, tag: 'img' });
  }

  function GhostImageData() {
    this.width = 0;
    this.height = 0;
    this.data = [];
    this._id = globalCounter++;
  }

  function GhostCanvasFill() {
    this._id = globalCounter++;
    this.colorStops = []
  }

  GhostCanvasFill.prototype.addColorStop = function(offset, color) {
    this.colorStops.push(offset, color)
  }

  GhostCanvasFill.prototype.toJSON = function() {
    var result = { id: this._id }
    if (this.colorStops.length) result.colorStops = this.colorStops
    return result
  }

  function GhostCanvas() {
    this._width = 0;
    this._height = 0;
    this._id = this.id = globalCounter++;
    this.childNodes = [];
    this._operationCount = 0;
    var that = this
    Object.defineProperty(this, 'width', {
      get: function() { return that._width; },
      set: function(value) {
        that._width = value
        post({ type: 'set', id: that._id, tag: 'canvas', key: 'width', value: value });
      }
    });
    Object.defineProperty(this, 'height', {
      get: function() { return that._height; },
      set: function(value) {
        that._height = value
        post({ type: 'set', id: that._id, tag: 'canvas', key: 'height', value: value });
      }
    });
    post({ type: 'create', id: this._id, tag: 'canvas' });
  }

  GhostCanvas.prototype.toJSON = function() {
    return {
      id: this._id
    }
  }

  GhostCanvas.prototype.getContext = function(key) {
    if (key === '2d') {
      if (!this.context) this.context = new GhostCanvasContext(this);
      return this.context;
    } else throw new Error('Only 2d context is supported');
  }

  GhostCanvas.prototype.caller = function(fnName, args) {
    if (inWorker) {
      args = args || []
      var attrs = {}, ctx = this.context
      for (var key in ctx) {
        if (ctx.hasOwnProperty(key) && key[0] !== '_' && key !== 'canvas') {
          if (ctx._lastTimeProps[key] !== ctx[key]) {
            attrs[key] = ctx[key]
            ctx._lastTimeProps[key] = attrs[key];
          }
        }
      }
      var message = { type: 'call', method: fnName, args: args, from: this._id, tag: 'canvas', attrs: attrs }
      if (args.args) {
        message.id = args.id;
        message.args = args.args;
      }
      message.args = Array.apply(null, message.args);
      post(message)
    }
  }

  function GhostCanvasContext(ghostCanvas) {
    this._state = [];
    this._matrix = [ 1, 0, 0, 1, 0, 0 ]; // 11, 12, 21, 22, 31, 32
    this._lineDash = [];
    this._lastTimeProps = {};
    // props
    this.canvas = ghostCanvas;
    this.direction = 'inherit';
    this.fillStyle = '#000';
    this.font = '10px sans-serif';
    this.globalAlpha = 1.0;
    this.globalCompositeOperation = null;
    this.lineCap = 'butt';
    this.lineDashOffset = null;
    this.lineJoin = 'miter';
    this.lineWidth = 1.0;
    this.miterLimit = 10;
    this.shadowBlur = 0;
    this.shadowColor = '#000';
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
    this.strokeStyle = '#000';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
  }


  // methods type 1
  ['arc', 'arcTo', 'beginPath', 'bezierCurveTo', 'clearRect', 'clip', 'closePath', 'fill', 'fillRect', 'fillText', 'lineTo', 'moveTo', 'quadraticCurveTo', 'rect', 'stroke', 'strokeRect', 'strokeText'].forEach(function(key) {
    GhostCanvasContext.prototype[key] = function() {
      this.canvas.caller(key, arguments)
    }
  });

  GhostCanvasContext.prototype.rotate = function(rad) {
    var c = Math.cos(rad);
    var s = Math.sin(rad);
    var m11 = this._matrix[0] * c + this._matrix[2] * s;
    var m12 = this._matrix[1] * c + this._matrix[3] * s;
    var m21 = this._matrix[0] * -s + this._matrix[2] * c;
    var m22 = this._matrix[1] * -s + this._matrix[3] * c;
    this._matrix[0] = m11;
    this._matrix[1] = m12;
    this._matrix[2] = m21;
    this._matrix[3] = m22;
    this.canvas.caller('rotate', [rad]);
  };

  GhostCanvasContext.prototype.scale = function(sx, sy) {
    this._matrix[0] *= sx;
    this._matrix[1] *= sx;
    this._matrix[2] *= sy;
    this._matrix[3] *= sy;
    this.canvas.caller('scale', [sx, sy]);
  };

  GhostCanvasContext.prototype.translate = function(x, y) {
    this._matrix[4] += this._matrix[0] * x + this._matrix[2] * y;
    this._matrix[5] += this._matrix[1] * x + this._matrix[3] * y;
    this.canvas.caller('translate', [x, y]);
  };

  GhostCanvasContext.prototype.transform = function(a, b, c, d, e, f) {
    var matrix = [a, b, c, d, e, f]
    var m11 = this._matrix[0] * matrix[0] + this._matrix[2] * matrix[1];
    var m12 = this._matrix[1] * matrix[0] + this._matrix[3] * matrix[1];

    var m21 = this._matrix[0] * matrix[2] + this._matrix[2] * matrix[3];
    var m22 = this._matrix[1] * matrix[2] + this._matrix[3] * matrix[3];

    var dx = this._matrix[0] * matrix[4] + this._matrix[2] * matrix[5] + this._matrix[4];
    var dy = this._matrix[1] * matrix[4] + this._matrix[3] * matrix[5] + this._matrix[5];

    this._matrix[0] = m11;
    this._matrix[1] = m12;
    this._matrix[2] = m21;
    this._matrix[3] = m22;
    this._matrix[4] = dx;
    this._matrix[5] = dy;
    this.canvas.caller('transform', arguments);
  };

  GhostCanvasContext.prototype.setTransform = function(a, b, c, d, e, f) {
    this._matrix = [a, b, c, d, e, f];
    this.canvas.caller('setTransform', arguments);
  };

  GhostCanvasContext.prototype.drawImage = function(image) {
    // image should be a GhostImage instance
    this.canvas.caller('drawImage', [{ id: image._id }].concat(Array.prototype.slice.call(arguments, 1)));
  };

  GhostCanvasContext.prototype.setLineDash = function(segments) {
    this._lineDash = segments;
    this.canvas.caller('setLineDash', arguments);
  };

  GhostCanvasContext.prototype.getLineDash = function() {
    return this._lineDash;
  };

  GhostCanvasContext.prototype.createImageData = function(width, height) {
    var result = new GhostImageData();
    if (width instanceof GhostImageData) {
      result.width = width.width;
      result.height = width.height;
    } else {
      result.width = width;
      result.height = height;
    }
    this.canvas.caller('createImageData', { args: arguments, id: result._id });
    return result;
  };

  GhostCanvasContext.prototype.putImageData = function(imageData) {
    this.canvas.caller('putImageData', { args: arguments, id: imageData._id });
  };

  GhostCanvasContext.prototype.getImageData = function(sx, sy, sw, sh) {
    var result = new GhostImageData();
    result.width = sw;
    result.height = sh;
    this.canvas.caller('getImageData', { args: arguments, id: result._id });
    return result;
  };

  GhostCanvasContext.prototype.createPattern = function(image, rep) {
    var result = new GhostCanvasFill();
    var args = [];
    if (image._id) args.push({ id: image._id });
    else args.push(image);
    args.push(rep);
    this.canvas.caller('createPattern', { args: args, id: result._id });
    return result;
  };

  ['createLinearGradient', 'createRadialGradient'].forEach(function(key) {
    GhostCanvasContext.prototype[key] = function() {
      var result = new GhostCanvasFill();
      this.canvas.caller(key, { args: arguments, id: result._id });
      return result;
    };
  });

  GhostCanvasContext.prototype.save = function() {
    var tmp = {};
    for (var key in this) {
      if (key[0] !== '_' && this.hasOwnProperty(key)) {
        tmp[key] = this[key];
      }
    }
    tmp._matrix = this._matrix;
    tmp._lineDash = this._lineDash;
    this._state.push(tmp);
    this.canvas.caller('save');
  };

  GhostCanvasContext.prototype.restore = function() {
    var tmp = this._state.pop();
    if (tmp) {
      for (var key in tmp) this[key] = tmp[key];
    }
    this.canvas.caller('restore');
  };

  ['drawFocusIfNeeded', 'isPointInPath', 'isPointInStroke'].forEach(function(key) {
    GhostCanvasContext.prototype[key] = function() {
      console.warn('The method', key, 'is not supported.');
    };
  });
  // measureText not supported
}
