//---------------------------------------------------------------------
// QRCode for JQuery
//
// Copyright (c) 2011 Enno Boland
//
// This work uses some snippets from Kazuhiko Arase QRCode
// implementation (such as some value tables an the Math classes)
//
// Licensed under GPL3:
//   http://www.opensource.org/licenses/GPL-3.0
//
// The word "QR Code" is registered trademark of 
// DENSO WAVE INCORPORATED
//   http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------
(function( $ ){
$.fn.qrcode= function() {
	var options = {
		width:-1,
		heigth:-1,
		size:1,
		correction:'H',
		type:-1
	};
	var Math2 = {
		log : function(n) {
			return Math2.LOG_TABLE[n];
		},
		exp : function(n) {
			while (n < 0) {
				n += 255;
			}
			while (n >= 256) {
				n -= 255;
			}
			return Math2.EXP_TABLE[n];
		},
		EXP_TABLE : [],
		LOG_TABLE : []
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
		Math2.LOG_TABLE[Math2.EXP_TABLE[i]] = i;
	}

	var Polynomial = function(num, shift) {
		var offset = 0;
		while (offset < num.length && num[offset] == 0) {
			offset++;
		}
		this.num = new Array(num.length - offset + shift);
		for (var i = 0; i < num.length - offset; i++) {
			this.num[i] = num[i + offset];
		}
		this.length = this.num.length;
	}
	Polynomial.prototype = {
		get : function(index) {
			return this.num[index];
		},
		multiply : function(e) {
			var num = new Array(this.length + e.length - 1);
			for (var i = 0; i < this.length; i++) {
				for (var j = 0; j < e.length; j++) {
					num[i + j] ^= Math2.exp(Math2.log(this.get(i) ) + Math2.log(e.get(j) ) );
				}
			}
			return new Polynomial(num, 0);
		},
		mod : function(e) {
			if (this.length - e.length < 0) {
				return this;
			}
			var ratio = Math2.log(this.get(0) ) - Math2.log(e.get(0) );
			var num = new Array(this.length);
			for (var i = 0; i < this.length; i++) {
				num[i] = this.get(i);
			}
			for (var i = 0; i < e.length; i++) {
				num[i] ^= Math2.exp(Math2.log(e.get(i) ) + ratio);
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
		put : function(v, l, r) {
			for(var i = 0; i < l; i++){
				this.set(((v >>> (r ? i : l-1-i)) & 1) == 1).n();
			}
			return this;
		},
		write : function(a) {
			for(var i = 0; i < a.length && this.inbounds; i++)
				this.set(a.p(i).get()).p(this.i + 1);
			return this;
		},
		bytes : function() {
			var tmp = new Array(Math.ceil(this.length / 8));
			var sav = this.i;
			this.p(0);
			
			for(var i = 0; i < tmp.length; i++) {
				for(var b = 0; b < 8; b++) {
					tmp[i] |= (this.get()) << (7 - b);
					this.n();
				}
			}
			this.p(sav);
			return tmp;
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
		set : function(v) {
			this.mask.set(1);
			this.map.set(v);
			return this;
		},
		put : function(v, l, r) {
			this.map.put(v, l, r);
			this.mask.put(~0, l, r);
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
					if(xs+x < 0 || ys+y < 0 || xs+x >= this.width
						|| ys+y >= this.height)
						continue;
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
		rotate : function() {
			map = new Bitmap(this.height, this.width)
			for(var y = 0; y < this.height; y++)
				for(var x = 0; x < this.width; x++) {
					if(this.p(x, y).ismasked())
						map.p(this.height-1-y,x).set(this.get());
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

	var RSBlock = function(data, errorlevel) {
		var tables = {
			// iterations, maxsize
			1 : [ // L
				[[1, 26, 19]],
				[[1, 44, 34]],
				[[1, 70, 55]],
				[[1, 100, 80]],
				[[1, 134, 108]],
				[[2, 86, 68]],
				[[2, 98, 78]],
				[[2, 121, 97]],
				[[2, 146, 116]],
				[[2, 86, 68], [2, 87, 69]]
			],
			0: [ // M
				[[1, 26, 16]],
				[[1, 44, 28]],
				[[1, 70, 44]],
				[[2, 50, 32]],
				[[2, 67, 43]],
				[[4, 43, 27]],
				[[4, 49, 31]],
				[[2, 60, 38], [2, 61, 39]],
				[[3, 58, 36], [2, 59, 37]],
				[[4, 69, 43], [1, 70, 44]]
			],
			3: [ // Q
				[[1, 26, 13]],
				[[1, 44, 22]],
				[[2, 35, 17]],
				[[2, 50, 24]],
				[[2, 33, 15], [2, 34, 16]],
				[[4, 43, 19]],
				[[2, 32, 14], [4, 33, 15]],
				[[4, 36, 16], [4, 37, 17]],
				[[4, 40, 18], [2, 41, 19]],
				[[6, 43, 19], [2, 44, 20]]
			],
			2: [ // H
				[[1, 26, 9]],
				[[1, 44, 16]],
				[[2, 35, 13]],
				[[4, 25, 9]],
				[[2, 33, 11], [2, 34, 12]],
				[[4, 43, 15]],
				[[4, 39, 13], [1, 40, 14]],
				[[4, 40, 14], [2, 41, 15]],
				[[4, 36, 12], [4, 37, 13]],
				[[6, 43, 15], [2, 44, 16]]
			]
		}
		this.errorlevel = errorlevel;
		this.table = tables[errorlevel];
		this.data = data;
		this.rsblocks = null;

		this.ecdata = null;
		this.maxsize = 0;
		this.type = 0;
	}
	RSBlock.prototype = {
		findtype : function() {
			if(this.type != 0)
				return this.type;
			this.type = 0;
			for(var i = 0; i < this.table.length; i++) {
				var maxsize = 0;
				for(var j = 0; j < this.table[i].length; j++) {
					maxsize += this.table[i][j][2] * this.table[i][j][0];
				}
				if(this.data.length < maxsize) {
					if(this.type == 0)
						this.type = 1;
					this.maxsize = maxsize;
					this.rsblocks = this.table[this.type-1];
					alert(this.type+" "+this.data.length + " - " + maxsize);
					return this.type;
				}
				else
					this.type = i + 1;
			}
			return 0;
		},
		build : function() {
			var databytes = this.data.bytes();
			var totalsize = 0;
			var datasize = 0
			this.rsblockcnt = 0;
			this.findtype();
			for(var i = 0; i < this.rsblocks.length; i++) {
				totalsize += this.rsblocks[i][1] * this.rsblocks[i][0];

				datasize += this.rsblocks[i][2] * this.rsblocks[i][0]
				this.rsblockcnt += this.rsblocks[i][0];
			}
			for(var i = 0; datasize > databytes.length;i++) {
				databytes.push(i % 2 == 0 ? 0xEC : 0x11);
			}
			var datas = [];
			var checks = []
			for(var i = 0; i < this.rsblocks.length; i++) {
				var count = this.rsblocks[i][0];
				var totalcnt = this.rsblocks[i][1];
				var datacnt = this.rsblocks[i][2];
				for(var j = 0; j < count;j++) {
					var data = databytes.splice(0, datacnt);
					datas.push(data)
					checks.push(this.correct(totalcnt - datacnt, data));
				}
			}
			var output = new Bitarray(totalsize * 8);
			for(var i = 0; i < datasize; i++) {
				for(var j = 0; j < datas.length; j++) {
					if (i < datas[j].length)
						output.put(datas[j][i], 8);
				}
			}
			for(var i = 0; i < totalsize - datasize; i++) {
				for(var j = 0; j < checks.length; j++) {
					if (i < checks[j].length)
						output.put(checks[j][i], 8);
				}
			}
			return output;
		},
		correct : function(eccnt, slice) {
			var rs = new Polynomial([1], 0);
			for(var i = 0; i < eccnt; i++)
				rs = rs.multiply(new Polynomial([1, Math2.exp(i)], 0));
			var raw = new Polynomial(slice, rs.length - 1);
			var mod = raw.mod(rs);
			var check = [];
			for(var i = 0; i < rs.length - 1; i++) {
				var modIndex = i + mod.length - (rs.length - 1);
				check.push((modIndex >= 0)? mod.get(modIndex) : 0);
			}
			return check;
		}
	}
	var QRCode = function(errorlevel, mask) {
		this.type = 0;
		this.posFigure = figureFactory(
			"         ",
			" xxxxxxx ",
			" x     x ",
			" x xxx x ",
			" x xxx x ",
			" x xxx x ",
			" x     x ",
			" xxxxxxx ",
			"         "
			);
		this.alignFigure = figureFactory(
			"xxxxx",
			"x   x",
			"x x x",
			"x   x",
			"xxxxx"
			);
		this.junks = [];
		this.data = null;
		this.image = null;
	}
	QRCode.prototype = {
		drawalign : function(image) {
			var pos = [
				[],
				[6, 18],
				[6, 22],
				[6, 26],
				[6, 30],
				[6, 34],
				[6, 22, 38],
				[6, 24, 42],
				[6, 26, 46],
				[6, 28, 50],
				[6, 30, 54],
				[6, 32, 58],
				[6, 34, 62],
				[6, 26, 46, 66],
				[6, 26, 48, 70],
				[6, 26, 50, 74],
				[6, 30, 54, 78],
				[6, 30, 56, 82],
				[6, 30, 58, 86],
				[6, 34, 62, 90],
				[6, 28, 50, 72, 94],
				[6, 26, 50, 74, 98],
				[6, 30, 54, 78, 102],
				[6, 28, 54, 80, 106],
				[6, 32, 58, 84, 110],
				[6, 30, 58, 86, 114],
				[6, 34, 62, 90, 118],
				[6, 26, 50, 74, 98, 122],
				[6, 30, 54, 78, 102, 126],
				[6, 26, 52, 78, 104, 130],
				[6, 30, 56, 82, 108, 134],
				[6, 34, 60, 86, 112, 138],
				[6, 30, 58, 86, 114, 142],
				[6, 34, 62, 90, 118, 146],
				[6, 30, 54, 78, 102, 126, 150],
				[6, 24, 50, 76, 102, 128, 154],
				[6, 28, 54, 80, 106, 132, 158],
				[6, 32, 58, 84, 110, 136, 162],
				[6, 26, 54, 82, 110, 138, 166],
				[6, 30, 58, 86, 114, 142, 170]
			][this.type-1];
			for(var i = 0; i < pos.length; i++) {
				for(var j = 0; j < pos.length; j++) {
					if(((i == 0 || j == 0) && (i == pos.length - 1 || j == pos.length - 1)) || (i == 0 && j == 0))
						continue;
					var x = pos[i] - 2;
					var y = pos[j] - 2;
					image.p(x,y)
						.merge(this.alignFigure);
				}
			}
		},
		drawstatic : function(image) {
			// Left Top
			image.p(-1,-1).merge(this.posFigure);
			// Right Top
			image.p(this.size-this.posFigure.width+1, -1)
				.merge(this.posFigure);
			// Left Bottom
			image.p(-1, this.size-this.posFigure.height+1)
				.merge(this.posFigure);
			// Alignment
			/*image.p(this.size-4-this.alignFigure.width,
					this.size-4-this.alignFigure.width)
				.merge(this.alignFigure);*/
			this.drawalign(image);
			// Horizontal
			drawTiming(image, 8, 6, this.size-this.posFigure.height, 6);
			// Vertical
			drawTiming(image, 6, 8, 6, this.size-this.posFigure.height);
		},
		drawtypenumber : function() {
			var g18 = parseInt("1111100100101", 2);
			var data = bch(this.type, g18);
			
			for (var i = 0; i < 18; i++) {
				var mod = (( (data >> i) & 1) == 1);
				image.p(i % 3 + this.size - 8 - 3,Math.floor(i / 3)).set(mod);
				image.p(Math.floor(i / 3),i % 3 + this.size - 8 - 3).set(mod);
			}
		},
		drawtype : function(image, mask) {
			var data = (this.errorlevel << 3) | mask;
			var g15 = parseInt("10100110111", 2);
			var mask = parseInt("101010000010010", 2);
			data = bch(data, g15) ^ mask;
			var vertical = new Bitmap(this.size, 1);
			// first 6 bit
			vertical.put(data, 6, true)
			// Recover timing pixel
				.put(1,1, true)
			// set two bits afterwards
				.put(data >>> 6, 2, true)
			// rest follows at the end
				.p(this.size - 8, 0)
				.put(1,1, true)
				.put(data >>> 8, 7, true);

			image.p(8,0).merge(vertical.rotate());

			var horizontal = new Bitmap(this.size, 1);
			horizontal.put(data, 8, true)
				.p(this.size - 8,0)
				.put(data >>> 8, 1, true)
				.put(1, 1)
				.put(data >>> 9, 6,true)

			image.p(0,8).merge(horizontal.rotate().rotate());
		},
		add8bittext : function(text) {
			var data = new Bitarray(text.length * 8);
			for(var i = 0; i < text.length; i++) {
				data.put(text.charCodeAt(i), 8);
			}
			this.junks.push({data: data, mode: 1<<2})
		},
		joinjunks : function() {
			var size = 0;
			for(var i = 0; i < this.junks.length; i++) {
				size += 4 + this.junks[i].data.length + this.typelength(this.junks[i].mode);
			}
			this.data = new Bitarray(size);
			for(var i = 0; i < this.junks.length; i++) {
				this.data
					.put(this.junks[i].mode, 4)
					.put(this.junks[i].data.length/8,
						this.typelength(this.junks[i].mode))
					.write(this.junks[i].data);
			}
		},

		drawcode : function(image, mask) {
			var y = this.size - 1;
			this.data.p(0)
			var setpx = function(i,d,x,y) {
				if(!i.p(x,y).ismasked()) {
					var v = d.get();
					if(mask(x,y))
						v = !v;
					i.set(v);
					d.n();
				}
			}
			var up = false
			for(var x = this.size - 1; x >= 0; x -= 2) {
				if(x == 6)
					x = 5;
				for(var y = 0; y < this.size; y++) {
					setpx(image,this.data,x, up ? y : this.size - 1 - y);
					setpx(image,this.data,x-1, up ? y : this.size - 1 - y);
				}
				up = !up;
			}
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
		create : function(errorlevel) {
			var errorlevels = {
				'L':1, // Low (7%)
				'M':0, // Middle (15%)
				'Q':3, // Normal (25%)
				'H':2  // High (30%)
			}
			this.errorlevel = errorlevels[errorlevel];
			this.joinjunks();
			this.rsblock();
			
			var minscore = -1;
			for(var i = 0; i < this.maskpatterns.length; i++) {
				var image = new Bitmap(this.size, this.size);
				this.drawstatic(image);
				this.drawtype(image, i);
				if(this.type >= 7) {
					this.drawtypenumber(image)
				}
				this.drawcode(image, this.maskpatterns[i]);
				var score = this.scoreImage(image);
				if(minscore == -1 || minscore > score) {
					this.image = image;
					minscore = score;
				}
			}
		},
		scoreImage : function(image) {
			var lostPoint = 0;

			// LEVEL1: 
			// x = pixel
			// 1-8 testing
			// 123
			// 4x5
			// 678
			// If there are more than 5 pixels found, add at last three

			for (var y = 0; y < this.size; y++) {
				for (var x = 0; x < this.size; x++) {
					var sameCount = 0;
					var dark = image.p(x, y).get();
					for (var r = -1; r <= 1; r++) {
						if (y + r < 0 || this.size <= y + r) {
							continue;
						}
						for (var c = -1; c <= 1; c++) {
							if (x + c < 0 || this.size <= x + c) {
								continue;
							}
							if (r == 0 && c == 0) {
								continue;
							}
							if (dark == image.p(x + c, y + r).get()) {
								sameCount++;
							}
						}
					}

					if (sameCount > 5) {
						lostPoint += (3 + sameCount - 5);
					}
				}
			}

			// LEVEL2:
			// Testing for larger whitespaces or blackareas
			// 13
			// 24

			for (var y = 0; y < this.size - 1; y++) {
				for (var x = 0; x < this.size - 1; x++) {
					var count = 0;
					if (image.p(x,     y    ).get() ) count++;
					if (image.p(x + 1, y    ).get() ) count++;
					if (image.p(x,     y + 1).get() ) count++;
					if (image.p(x + 1, y + 1).get() ) count++;
					if (count == 0 || count == 4) {
						lostPoint += 3;
					}
				}
			}

			// LEVEL3
			// Testing for pattern:
			// X_XXX_X
			// and
			// X
			// _
			// X
			// X
			// X
			// _
			// X

			for (var y = 0; y < this.size; y++) {
				for (var x = 0; x < this.size - 6; x++) {
					if (image.p(y, x).get()
							&& !image.p(x, y + 1).get()
							&&  image.p(x, y + 2).get()
							&&  image.p(x, y + 3).get()
							&&  image.p(x, y + 4).get()
							&& !image.p(x, y + 5).get()
							&&  image.p(x, y + 6).get() ) {
						lostPoint += 40;
					}
				}
			}

			for (var x = 0; x < this.size; x++) {
				for (var y = 0; y < this.size - 6; y++) {
					if (image.p(y, x)
							&& !image.p(x + 1, y).get()
							&&  image.p(x + 2, y).get()
							&&  image.p(x + 3, y).get()
							&&  image.p(x + 4, y).get()
							&& !image.p(x + 5, y).get()
							&&  image.p(x + 6, y).get() ) {
						lostPoint += 40;
					}
				}
			}

			// LEVEL4
			// Testing for ratio between dark and light pixels

			var darkCount = 0;

			for (var x = 0; x < this.size; x++) {
				for (var y = 0; y < this.size; y++) {
					if (image.p(x, y).get ) {
						darkCount++;
					}
				}
			}

			var ratio = Math.abs(100 * darkCount / this.size / this.size - 50) / 5;
			lostPoint += ratio * 10;

			return lostPoint;
		},
		rsblock : function() {
			var rs = new RSBlock(this.data, this.errorlevel, this.data);
			this.type = rs.findtype();
			this.size = this.type * 4 + 17;
			this.data = rs.build();
		},
		maskpatterns: [
			function(x,y) { return (x + y) % 2 == 0; },
			function(x,y) { return y % 2 == 0; },
			function(x,y) { return x % 3 == 0; },
			function(x,y) { return (x + y) % 3 == 0; },
			function(x,y) { return (Math.floor(x / 3) + Math.floor(y / 2) ) % 2 == 0; },
			function(x,y) { return (x * y) % 2 + (x * y) % 3 == 0; },
			function(x,y) { return ( (x * y) % 2 + (x * y) % 3) % 2 == 0; },
			function(x,y) { return ( (x * y) % 3 + (x + y) % 2) % 2 == 0; }
		]
	}

	var CanvasDrawer = function(bitmap, obj, factor) {
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
	var TextDrawer = function(bitmap, pattern) {
		this.bitmap = bitmap;
		this.pattern = pattern;
	}
	TextDrawer.prototype = {
		draw : function() {
			var text = "";
			for(var y = 0; y < this.bitmap.height; y++) {
				for(var x = 0; x < this.bitmap.width; x++) {
					text += pattern[this.bitmap.p(x,y).get() ? 0 : 1]
				}
			}
			text += "\n"
		}
	}
	var text = arguments.length > 0 ? arguments[0] : obj.text();
	if(arguments.length > 1) for(var o in arguments[1])
		options[o] = arguments[1][o];

	$(this).each(function() {
		var qrcode = new QRCode();
		qrcode.add8bittext(text);
		qrcode.create(options.correction);
		
		var drawer = new CanvasDrawer(qrcode.image, $(this), options.size);
		//var drawer = new TextDrawer(qrcode.image, [" "]);
		drawer.draw();
	});
  };
})( jQuery );
