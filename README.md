# ghost-cavas

NOTE: This project is only for personal use now. It's in early stage and not tested,
use with your own risk.

Record canvas changes without actually rendering anything.

This project is intended to be used in a Web Worker currently. When the canvas's
property changed or a method is called, a message is posted via the standard
`postMessage` worker API.

# General workflow

## Create, load and use `Image`

Canvas painting usually involves `Image` manipulation. As web worker do not have
`Image` API, this module fakes a `document` interface with only the `createDocument`
method for you. So you could create a Image with no pain in worker:

** Worker code **
```js
var image = document.createDocument('img');
var image2 = new Image();
```

When a new `Image` is created, this module instead creates a `GhostImage` instance.
Of course it could not do what a real image could do, only a interface. The main thread
will be notified for this:

```
message: { type: 'create', id: 0, tag: 'img' }
```

When property of a image is set, the main thread will receive a message:

```
message: { type: 'set', id: 0, tag: 'img', key: 'src', value: 'http://example.com/1.jpg' }
```

The `type: 'set'` indicates this is a property set event, `id` is a unique value
assigned to every interface object that is created in the worker. You should create
the real objects in the main thread and keep a reference map of id - objects.

The rest params mean that the `src` property of our object of `id=0` is set to `"http://example.com/1.jpg"`

Note that some code may rely on `onload` callback on image, so you should return
the event to worker manually.

** Main thread code **
```js
var refMap = {};
worker.onMessage = function(e) {
  var data = e.data;
  if (data.tag === 'img') {
    if (data.type === 'create') {
      var image = new Image();
      refMap[data.id] = image;
      image.onload = function() {
        worker.postMessage({ tag: 'img', type: 'onload', id: data.id })
      }
    }
    else if (data.type === 'set') {
      refMap[data.id][data.key] = data.value;
    }
  }
}
```

## Create and use canvas

You could use `Canvas` and `HTMLCanvasContext2d` in web worker now.

** Worker code **
```js
var canvas = document.createElement('canvas');
var context = canvas.getContext('2d');
cavans.id = 'canvas1';
```

Take the follow as an example:

** Worker code **
```js
context.fillStyle = "rgb(20, 20, 20)";
context.fillRect(10, 10, 55, 50);
```

When `fillRect()` is called, a message is sent. The module compares every property
on the canvas and find the ones that are different from last message, and attach
them to `attrs` of the message.

```
message: {
  type: 'call',
  method: 'fillRect',
  args: [10, 10, 55, 50],
  from: 'canvas1',
  tag: 'canvas',
  attrs: {
    fillStyle: 'rgb(20, 20, 20)'
  }
}
```

So you should always handle `attrs` before `method`

## Create patterns and gradients

Some canvas API methods creates new objects, and could be assigned to the canvas
again. This is in fact similar to the situation of `Image`. The message returned
from worker will have an additional `id` as a reference to use the object later.

** Worker code **
```
var imageData = ctx.getImageData(0, 0, 100, 100); // a GhostImageData instance is created
// the module will send a message for getImageData here
ctx.putImageData(imageData);
// the module will send a message for putImageData now, instead of sending
// the GhostImageData instance, it will send the id of it.
```

The message will be:
```
message: {
  type: 'call',
  method: 'putImageData',
  args: [ { id: 1 }, ...],
  from: 'canvas1',
  tag: 'canvas',
  attrs: {...}
}
```

## Methods fails

`drawFocusIfNeeded`, `measureText`, `isPointInPath`, `isPointInStroke`

# Lisence

MIT
