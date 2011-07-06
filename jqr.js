	$(document).ready(function($) {
		var bitmap = [];
		for(var i = 0; i < 10000; i++) {
			bitmap.push(Math.round(Math.random()));
		}
		/*drawer($("#canvas"), 100, 100, bitmap);
		divDrawer($("#div"), 100, 100, bitmap);*/
		qrcode();
	});

	/*function drawer(obj, width, height, bitmap) {
		var context = obj.get(0).getContext('2d');
		for(var y = 0; y < height; y++) {
			for(var x = 0; x < width; x++) {
				if(bitmap[y * width + x])
					context.fillRect(x, y, 1, 1);
			}
		}
	}
	function divDrawer(obj, width, height, bitmap) {
		var px = $("<div>");
		var wstep = 100.0 / width;
		var hstep = 100.0 / height;

		px.css("background","black");
		px.css("position","absolute");
		for(var y = 0; y < height; y++) {
			for(var x = 0; x < width; x++) {
				if(bitmap[y * width + x]) {
					console.log(wstep);
					px.css("left",(wstep*x)+"%");
					px.css("right",(100-wstep*(x+1))+"%");
					px.css("top",(hstep*y)+"%");
					px.css("bottom",(100-hstep*(y+1))+"%");
					obj.append(px.clone());
				}
			}
		}
	}*/
	function drawer(obj, width, height, bitmap) {
		var context = obj.get(0).getContext('2d');
		for(var y = 0; y < height; y++) {
			for(var x = 0; x < width; x++) {
				if(bitmap[y * width + x])
					context.fillRect(x, y, 1, 1);
			}
		}
	}
	function divDrawer(obj, width, height, bitmap) {
		var px = $("<div>");
		var wstep = 100.0 / width;
		var hstep = 100.0 / height;

		px.css("background","black");
		px.css("position","absolute");
		for(var y = 0; y < height; y++) {
			for(var x = 0; x < width; x++) {
				if(bitmap[y * width + x]) {
					console.log(wstep);
					px.css("left",(wstep*x)+"%");
					px.css("right",(100-wstep*(x+1))+"%");
					px.css("top",(hstep*y)+"%");
					px.css("bottom",(100-hstep*(y+1))+"%");
					obj.append(px.clone());
				}
			}
		}
	}
	function qrcode() {
		var bits = (~0 >>> 1).toString(2).length + 1;
		var size = 33;
		var map = new Array();
		var mask = new Array();
		for(var i = 0; i < Math.ceil(size / bits) * size; i++) {
			map[i] = mask[i] = 0;
		}
		var positionPattern = [
			"         ",
			" xxxxxxx ",
			" x     x ",
			" x xxx x ",
			" x xxx x ",
			" x xxx x ",
			" x     x ",
			" xxxxxxx ",
			"         "
		];
		var alignmentPattern = [
			"xxxxx",
			"x   x",
			"x x x",
			"x   x",
			"xxxxx",
		]

		var drawPattern = function(figure, posx, posy) {
			for(var y = 0; y < figure.length; y++) {
				if(posy + y < 0 || posy + y >= size)
					continue;
				for(var x = 0; x < figure[y].length; x++) {
					if(posx + x < 0 || posx + x >= size)
						continue;
					setPixel(posx+x,posy+y, figure[y][x] == "x");
				}
			}
		}
		var choordToIndex = function(x, y) {
			return Math.ceil(size/bits)*y + Math.floor(x/bits);
		}
		var setPixel = function(x,y,black) {
			var index = choordToIndex(x,y);
			var m = (0x1 << (x%bits));
			mask[index] |= m;
			if(black)
				map[index] |= m;
		}


		var drawer = function(obj) {
			var f = getResizeFactor(obj);
			var context = obj.get(0).getContext('2d');
			for(var y = 0; y < size; y++) {
				for(var x = 0; x < size; x++) {
					var index = choordToIndex(x,y);
					if(map[index] & (0x1 << (x%bits)))
						context.fillRect(x*f, y*f, f, f);
				}
			}
		}
		var getResizeFactor = function(obj) {
			var objsize = obj.innerHeight() < obj.innerWidth ? obj.innerHeight() : obj.innerWidth();
			return Math.floor(objsize / size);
			
		}
		var drawTiming = function(xs, ys, xe, ye) {
			for(var y = ys; y <= ye; y++) {
				for(var x = xs; x <= xe; x++) {
					setPixel(x,y, (x+y)%2 == 0);
				}
			}
		}

		// Left Top
		drawPattern(positionPattern, -1, -1);
		// Right Top
		drawPattern(positionPattern, size-positionPattern.length+1, -1);
		// Left Bottom
		drawPattern(positionPattern, -1, size-positionPattern.length+1);
		// Alignment
		drawPattern(alignmentPattern, size-4-alignmentPattern.length, size-4-alignmentPattern.length);
		// Horizontal
		drawTiming(8, 6, size-positionPattern.length, 6);
		// Vertival
		drawTiming(6, 8, 6, size-positionPattern.length);
		for(var x = 0; x < size; x++) {
			for(var y = 0; y < size; y++) {
				var index = choordToIndex(x,y);
				if((mask[index] & (0x1 << (x%bits))) == 0)
					setPixel(x, y, Math.round(Math.random()));
			}
		}
		drawer($("#canvas"));
	}
