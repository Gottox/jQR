var Math2 = {
	glog : function(n) {
	
		if (n < 1) {
			throw new Error("glog(" + n + ")");
		}
		
		return Math2.LOG_TABLE[n];
	},
	gexp : function(n) {
		while (n < 0) {
			n += 255;
		}
	
		while (n >= 256) {
			n -= 255;
		}
	
		return Math2.EXP_TABLE[n];
	},
	EXP_TABLE : new Array(256),
	LOG_TABLE : new Array(256)

};
for (var i = 0; i < 8; i++) {
	Math2.EXP_TABLE[i] = 1 << i;
}
for (var i = 8; i < 256; i++) {
	Math2.EXP_TABLE[i] = Math2.EXP_TABLE[i - 4]
		^ Math2.EXP_TABLE[i - 5]
		^ Math2.EXP_TABLE[i - 6]
		^ Math2.EXP_TABLE[i - 8];
}
for (var i = 0; i < 255; i++) {
	Math2.LOG_TABLE[Math2.EXP_TABLE[i] ] = i;
}
(function( $ ){
$.fn.qrcode= function() {
	var obj = $(this);
	var text = arguments.length > 0 ? arguments[0] : obj.text();
	var width = arguments.length > 1 ? arguments[1] : 200;
	var height = arguments.length > 2 ? arguments[3] : 200;

	
	var Polynomial = function(num, shift) {
		if (num.length == undefined) {
			throw new Error(num.length + "/" + shift);
		}
		var offset = 0;
		while (offset < num.length && num[offset] == 0) {
			offset++;
		}
		this.num = new Array(num.length - offset + shift);
		for (var i = 0; i < num.length - offset; i++) {
			this.num[i] = num[i + offset];
		}
	}

	Polynomial.prototype = {
		get : function(index) {
			return this.num[index];
		},
		getLength : function() {
			return this.num.length;
		},
		multiply : function(e) {
			var num = new Array(this.getLength() + e.getLength() - 1);
			for (var i = 0; i < this.getLength(); i++) {
				for (var j = 0; j < e.getLength(); j++) {
					num[i + j] ^= Math2.gexp(Math2.glog(this.get(i) ) + Math2.glog(e.get(j) ) );
				}
			}
			return new Polynomial(num, 0);
		},
		mod : function(e) {
			if (this.getLength() - e.getLength() < 0) {
				return this;
			}
			var ratio = Math2.glog(this.get(0) ) - Math2.glog(e.get(0) );
			var num = new Array(this.getLength() );
			for (var i = 0; i < this.getLength(); i++) {
				num[i] = this.get(i);
			}
			for (var i = 0; i < e.getLength(); i++) {
				num[i] ^= Math2.gexp(Math2.glog(e.get(i) ) + ratio);
			}
			// recursive call
			return new Polynomial(num, 0).mod(e);
		}
	};

	var Bitarray = function(l) {
		this.length = l;
		this.bits = (~0 >>> 1).toString(2).length + 1;
		this.i = 0;
		this.index = 0;
		this.inbounds= true;
		this.offset = 0;
		this.array = [];
		for(var i = 0; i < Math.ceil(l / this.bits); i++) {
			this.array[i] = 0;
		}
	}
	Bitarray.prototype = {
		p : function(i) {
			this.i = i;
			this.inbounds = i < this.length;
			this.index = Math.floor(i / this.bits);
			this.offset = i % this.bits;
			return this;
		},
		n : function() {
			return this.p(this.i+1);
		},
		get : function() {
			if(this.inbounds)
				return (this.array[this.index] & (1 << this.offset)) ? 1 : 0;
			else
				return null;
		},
		set : function(v) {
			if(this.inbounds) {
				if(v)
					this.array[this.index] |= (1 << this.offset);
				else
					this.array[this.index] &= ~(1 << this.offset);
			}
			return this;
		},
		put : function(v, l) {
			for(var i = 0; i < l; i++)
				this.set(((v >>> i) & 1) == 1).p(this.i + 1);
			return this;
		},
		write : function(a) {
			for(var i = 0; i < a.length && this.inbounds; i++)
				this.set(a.p(i).get()).p(this.i + 1);
			return this;
		},
		tobytes : function() {
			var bytes = new Array(Math.ceil(this.length / 8));
			this.p(0);
			for(var i = 0; i < bytes.length; i++) {
				for(var b = 0; b < 8; b++) {
					bytes[i] |= (this.get()) << b;
					this.n();
				}
			}
			return bytes;
		}
	}

	var Bitmap = function(w, h) {
		this.width = w;
		this.height = h;
		this.x = 0;
		this.y = 0;
		this.map = new Bitarray(w*h);
		this.mask = new Bitarray(w*h);
		this.inbounds = true;
	}
	Bitmap.prototype = {
		p : function(x, y) {
			this.x = x;
			this.y = y;
			this.map.p(y * this.width + x);
			this.mask.p(y * this.width + x);
			this.inbounds = this.map.inbounds;
			return this;
		},
		n : function() {
			return this.p(this.x+1,this.y);
		},
		set: function(v) {
			this.mask.set(1);
			this.map.set(v);
			return this;
		},
		put: function(v, l) {
			this.map.put(v, l);
			return this;
		},
		get: function() {
			return this.map.get()
		},
		merge: function(map) {
			var xs = this.x;
			var ys = this.y;
			for(var y = 0; y < map.height; y++) {
				for(var x = 0; x < map.width; x++) {
					if(map.p(x,y).ismasked())
						this.p(xs+x, ys+y)
							.set(map.get());
				}
			}
			return this;
		},
		ismasked : function() {
			return this.mask.get();
		},
		rotate : function(deg) {
			deg = deg % 4;
			var map;
			switch(deg) {
			case 1:
				map = new Bitmap(this.height, this.width)
				for(var y = 0; y < this.height; y++)
					for(var x = 0; x < this.width; x++) {
						if(map.p(y, x).ismasked())
							map.set(this.p(x,y).get());
					}
				break;
			case 2:
				map = new Bitmap(this.width, this.height)
				for(var y = 0; y < this.height; y++)
					for(var x = 0; x < this.width; x++) {
						if(map.p(this.width-x-1, this.height-y-1).ismasked())
							map.set(this.p(x,y).get());
					}
				break;
			case 3:
				map = new Bitmap(this.height, this.width)
				for(var y = 0; y < this.height; y++)
					for(var x = 0; x < this.width; x++) {
						if(map.p(this.width-y-1, this.height-x-1).ismasked())
							map.set(this.p(x,y).get());
					}
				break;
			}
			return map;
		}
	}
	
	var bch = function(data, mask) {
		var highest = mask.toString(2).length - 1;
		if(mask == 0)
			return 0;
		var d = data << highest;
		while(d.toString(2).length - mask.toString(2).length >= 0) {
			d ^= mask << (d.toString(2).length - mask.toString(2).length);
		}
		return (data << highest) | d;
	}

	var figureFactory = function() {
		var bitmap = new Bitmap(arguments[0].length,arguments.length);
		for(var y = 0; y < arguments.length; y++)
			for(var x = 0; x < arguments[0].length; x++)
				bitmap.p(x,y).set(arguments[y][x] != ' ');
		return bitmap;
	}
	var drawTiming = function(bitmap, xs, ys, xe, ye) {
		for(var y = ys; y <= ye; y++) {
			for(var x = xs; x <= xe; x++) {
				bitmap.p(x,y).set((x+y)%2 == 0);
			}
		}
	}

	var RSBlock = function(count, totalcnt, datacnt) {
		this.count = count;
		this.datacnt = datacnt;
		this.totalcnt = totalcnt;
		this.eccnt = totalcnt - datacnt;

		this.ecdata = null;
		this.data = new Bitarray(this.datacnt * 8)
	}
	RSBlock.prototype = {
		fill : function(offset,data) {
			data.p(offset);
			while(data.inbounds && this.data.inbounds) {
				this.data.set(data.get())
					.p(this.data.i + 1);
				data.p(data.i + 1);
			}
			return data.i;
		},
		correction : function() {
			var rs = new Polynomial([1], 0);
			for(var i = 0; i < this.eccnt; i++) {
				rs = rs.multiply(
						new Polynomial([1, Math2.gexp(i)], 0));
			}
			var raw = new Polynomial(this.data.tobytes(), rs.getLength() - 1);
			var mod = raw.mod(rs);
			this.ecdata = new Array(rs.getLength() - 1);
			for(var i = 0; i < this.ecdata.length; i++) {
				var modIndex = i + mod.getLength() - this.ecdata.length;
				this.ecdata[i] = (modIndex >= 0)? mod.get(modIndex) : 0;
			}
		}
	}
	var QRCode = function(errorlevel, mask) {
		var errorlevels = {
			'L':1, // Low (7%)
			'M':0, // Middle (15%)
			'Q':3, // Normal (25%)
			'H':2  // High (30%)
		}
		this.rsblock = {
			1 : [
				[new RSBlock(1, 26, 19)],
				[new RSBlock(1, 44, 34)],
				[new RSBlock(1, 70, 55)],
				[new RSBlock(1, 100, 80)],
				[new RSBlock(1, 134, 108)],
				[new RSBlock(2, 86, 68)],
				[new RSBlock(2, 98, 78)],
				[new RSBlock(2, 121, 97)],
				[new RSBlock(2, 146, 116)],
				[new RSBlock(2, 86, 68),new RSBlock(2, 87, 69)],
			],
			0: [
				[new RSBlock(1, 26, 16)],
				[new RSBlock(1, 44, 28)],
				[new RSBlock(1, 70, 44)],
				[new RSBlock(2, 50, 32)],
				[new RSBlock(2, 67, 43)],
				[new RSBlock(4, 43, 27)],
				[new RSBlock(4, 49, 31)],
				[new RSBlock(2, 60, 38),new RSBlock(2, 61, 39)],
				[new RSBlock(3, 58, 36),new RSBlock(2, 59, 37)],
				[new RSBlock(4, 69, 43),new RSBlock(1, 70, 44)],
			],
			3: [
				[new RSBlock(1, 26, 13)],
				[new RSBlock(1, 44, 22)],
				[new RSBlock(2, 35, 17)],
				[new RSBlock(2, 50, 24)],
				[new RSBlock(2, 33, 15),new RSBlock(2, 34, 16), 16],
				[new RSBlock(4, 43, 19)],
				[new RSBlock(2, 32, 14),new RSBlock(4, 33, 15)],
				[new RSBlock(4, 40, 18),new RSBlock(2, 41, 19)],
				[new RSBlock(4, 36, 16),new RSBlock(4, 37, 17)],
				[new RSBlock(6, 43, 19),new RSBlock(2, 44, 20)],
			],

			2: [
				[new RSBlock(1, 26, 9)],
				[new RSBlock(1, 44, 16)],
				[new RSBlock(2, 35, 13)],
				[new RSBlock(4, 25, 9)],
				[new RSBlock(2, 33, 11),new RSBlock(2, 34, 34)],
				[new RSBlock(4, 43, 15)],
				[new RSBlock(4, 39, 13),new RSBlock(1, 40, 14)],
				[new RSBlock(4, 40, 14),new RSBlock(2, 41, 15)],
				[new RSBlock(4, 36, 12),new RSBlock(4, 37, 13)],
				[new RSBlock(6, 43, 15),new RSBlock(2, 44, 16)],
			],
		}
		this.type = 0;
		this.errorlevel = errorlevels[errorlevel];
		this.posFigure = figureFactory(
			"xxxxxxx",
			"x     x",
			"x xxx x",
			"x xxx x",
			"x xxx x",
			"x     x",
			"xxxxxxx"
			);
		this.alignFigure = figureFactory(
			"xxxxx",
			"x   x",
			"x x x",
			"x   x",
			"xxxxx"
			);
		this.mask = mask;
		this.image = null;
		this.datas = [];
		this.bytes = null;
	}
	QRCode.prototype = {
		drawstatic : function() {
			// Left Top
			this.image.p(0,0).merge(this.posFigure);
			// Right Top
			this.image.p(this.size-this.posFigure.width, 0)
				.merge(this.posFigure);
			// Left Bottom
			this.image.p(0, this.size-this.posFigure.height)
				.merge(this.posFigure);
			// Alignment
			this.image.p(this.size-4-this.alignFigure.width,
					this.size-4-this.alignFigure.width)
				.merge(this.alignFigure);
			// Horizontal
			drawTiming(this.image, 8, 6, this.size-this.posFigure.height, 6);
			// Vertival
			drawTiming(this.image, 6, 8, 6, this.size-this.posFigure.height);
		},
		drawtypenumber : function() {
			var g18 = parseInt("1111100100101", 2);
			var data = bch(this.type, g18);
			
			for (var i = 0; i < 18; i++) {
				var mod = (( (data >> i) & 1) == 1);
				this.image.p(i % 3 + this.size - 8 - 3,Math.floor(i / 3)).set(mod);
				this.image.p(Math.floor(i / 3),i % 3 + this.size - 8 - 3).set(mod);
			}
		},
		drawtype : function() {
			var data = (this.errorlevel << 3) | this.mask;
			var g15 = parseInt("10100110111", 2);
			var mask = parseInt("101010000010010", 2);
			data = bch(data, g15) ^ mask;
			var vertical = new Bitmap(this.size, 1);
			// first 6 bit
			vertical.put(data, 6)
			// Recover timing pixel
				.put(1,1)
			// set two bits afterwards
				.put(data >>> 6, 2)
			// rest follows at the end
				.p(this.size - 7, 0)
				.put(data >>> 8, 8);

			this.image.p(8,0).merge(vertical.rotate(1));

			var horizontal = new Bitmap(this.size, 1);
			horizontal.put(data, 8)
				.p(this.size - 8,0)
				.put(data >>> 8, 1)
				.put(1, 1)
				.put(data >>> 9, 6)

			this.image.p(0,8).merge(horizontal.rotate(2));
		},
		add8bittext : function(text) {
			var data = new Bitarray(text.length * 8);
			for(var i = 0; i < text.length; i++) {
				data.put(text.charCodeAt(i), 8);
			}
			this.datas.push({data: data, mode: 1<<2})
		},
		packdata : function() {
			var rsblock = this.rsblock[this.errorlevel][this.type];
			var size = 0;
			for(var i = 0; i < this.datas.length; i++)
				size += 4 + this.datas[i].data.length;
			var maxsize = 0;
			var total = 0
			for(var i = 0; i < rsblock.length; i++) {
				maxsize += rsblock[i].datacnt * 8;
				total += rsblock[i].totalcnt;
			}
			if(size > maxsize) {
				alert("too much data!");
				return;
			}

			var data = new Bitarray(maxsize);
			for(var i = 0; i < this.datas.length; i++)
				data.put(this.datas[i].mode, 4)
					.put(this.datas[i].length,
						this.typelength(this.datas[i].mode))
					.write(this.datas[i].data);

			// padding
			if(data.i <= maxsize)
				data.put(0, 4);
			if(data.i % 8 != 0)
				data.put(0, 8 - (size % 8));
			
			while(data.i < maxsize) {
				data.put(0xEC, 8)
					.put(0x11,8)
			}

			var offset = 0;
			var maxdc = 0;
			var maxec = 0;
			for(var i = 0; i < rsblock.length; i++) {
				offset = rsblock[i].fill(offset, data);
				rsblock[i].correction();
				maxdc = Math.max(maxdc, rsblock[i].datacnt);
				maxec = Math.max(maxec, rsblock[i].eccnt);
			}

			var bytes = new Bitarray(8 * total);
			for (var i = 0; i < maxdc; i++) {
				for (var r = 0; r < rsblock.length; r++) {
					if (i < rsblock[r].data.length) {
						bytes.put(rsblock[r].data[i], 8)
					}
				}
			}
			for (var i = 0; i < maxec; i++) {
				for (var r = 0; r < rsblock.length; r++) {
					if (i < rsblock[r].data.length) {
						bytes.put(rsblock[r].ecdata[i], 8)
					}
				}
			}
			this.bytes = bytes;
		},
		drawcode : function() {
			this.image.p(0,0);
			this.bytes.p(0)
			alert(this.bytes.length + " " + this.size*this.size);
			alert(this.bytes.array);

			while(this.image.inbounds && this.bytes.inbounds) {
				if(this.image.ismasked()) {
					this.image.n()
				}
				else {
					this.image.set(this.bytes.get());
					this.image.n();
					this.bytes.n();
				}
			}
			/*for (var col = this.size - 1; col > 0; col -= 2) {
				console.log(col)
				if (col == 6) col--;
				while (true) {
					for (var c = 0; c < 2; c++) {
						this.image.p(col - c, row)
						if(!this.image.ismasked()) {
							this.image.set(1);
							/*
							var dark = false;
							if (byteIndex < data.length) {
								dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
							}
							var mask = QRUtil.getMask(maskPattern, row, col - c);
							if (mask) {
								dark = !dark;
							}
							this.image.set(dark);
							bitIndex--;
							if (bitIndex == -1) {
								byteIndex++;
								bitIndex = 7;
							}
						}
					}
					row += inc;
					if (row < 0 || this.moduleCount <= row) {
						row -= inc;
						inc = -inc;
						break;
					}
				}
			}*/
		},
		typelength: function(mode) {
			if (this.type < 10) {
				switch(mode) {
					case 1 << 0: return 10;
					case 1 << 1: return 9;
					case 1 << 2: return 8;
					case 1 << 3: return 8;
				  }
			} else if (this.type < 27) {
				switch(mode) {
					case 1 << 0: return 12;
					case 1 << 1: return 11;
					case 1 << 2: return 16;
					case 1 << 3: return 10;
				}
			} else {
				switch(mode) {
					case 1 << 0: return 14;
					case 1 << 1: return 13;
					case 1 << 2: return 16;
					case 1 << 3: return 12;
				}
			}
		},
		create : function(type) {
			this.type = type;
			this.size = type * 4 + 17;
			this.image = new Bitmap(this.size, this.size);
			this.drawstatic();
			this.drawtype();
			if(type >= 7) {
				this.drawtypenumber()
			}
			this.packdata();
			this.drawcode();
		},
		maskpatterns: [
			function(i,j,v) { return (i + j) % 2 == 0 ? ~v : v; },
			function(i,j,v) { return i % 2 == 0 ? ~v : v; },
			function(i,j,v) { return j % 3 == 0 ? ~v : v; },
			function(i,j,v) { return (i + j) % 3 == 0 ? ~v : v; },
			function(i,j,v) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0 ? ~v : v; },
			function(i,j,v) { return (i * j) % 2 + (i * j) % 3 == 0 ? ~v : v; },
			function(i,j,v) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0 ? ~v : v; },
			function(i,j,v) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0 ? ~v : v; },
		]
	}

	var CanvasDrawer = function(obj, bitmap, factor) {
		this.obj = obj;
		this.canvas = $('<canvas>');
		this.bitmap = bitmap;
		this.factor = factor;

		this.canvas.attr('height',bitmap.height*factor);
		this.canvas.attr('width',bitmap.width*factor);
	}
	CanvasDrawer.prototype = {
		draw : function() {
			this.obj.html(this.canvas);
			var context = this.canvas.get(0).getContext('2d');
			for(var y = 0; y < this.bitmap.height; y++) {
				for(var x = 0; x < this.bitmap.width; x++) {
					if(this.bitmap.p(x,y).get())
						context.fillRect(x*this.factor, y*this.factor, this.factor, this.factor);
				}
			}
		},
	}

	var qrcode = new QRCode('H',3);
	qrcode.add8bittext(text);
	qrcode.create(4);
	
	var drawer = new CanvasDrawer(obj, qrcode.image, 2);
	drawer.draw();
	
  };
})( jQuery );
