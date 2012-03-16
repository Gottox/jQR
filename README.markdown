[![Flattr this git repo](http://api.flattr.com/button/flattr-badge-large.png)](https://flattr.com/submit/auto?user_id=Gottox&url=https://github.com/Gottox/jQR&title=jQR&language=&tags=github&category=software)

# jQR

jQR is a jQuery plugin generates QR-Codes without calling external urls.
It's entirely written in Javascript

# Usage

```Javascript

	<div id="qrcode"></div>
	<script language="javascript">
		$(document).ready(function() {
			$('#qrcode').qrcode("Hello World");      
		});
	</script>

```

# Bugs

Currently, jQR generates too big QR-Codes, therefor, it's only usefull for
small amounts of data. I'm hoping to get this fixed.
