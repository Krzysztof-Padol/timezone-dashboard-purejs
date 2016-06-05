(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
// doT.js
// 2011-2014, Laura Doktorova, https://github.com/olado/doT
// Licensed under the MIT license.

(function() {
	"use strict";

	var doT = {
		version: "1.0.3",
		templateSettings: {
			evaluate:    /\{\{([\s\S]+?(\}?)+)\}\}/g,
			interpolate: /\{\{=([\s\S]+?)\}\}/g,
			encode:      /\{\{!([\s\S]+?)\}\}/g,
			use:         /\{\{#([\s\S]+?)\}\}/g,
			useParams:   /(^|[^\w$])def(?:\.|\[[\'\"])([\w$\.]+)(?:[\'\"]\])?\s*\:\s*([\w$\.]+|\"[^\"]+\"|\'[^\']+\'|\{[^\}]+\})/g,
			define:      /\{\{##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\}\}/g,
			defineParams:/^\s*([\w$]+):([\s\S]+)/,
			conditional: /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
			iterate:     /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
			varname:	"it",
			strip:		true,
			append:		true,
			selfcontained: false,
			doNotSkipEncoded: false
		},
		template: undefined, //fn, compile template
		compile:  undefined  //fn, for express
	}, _globals;

	doT.encodeHTMLSource = function(doNotSkipEncoded) {
		var encodeHTMLRules = { "&": "&#38;", "<": "&#60;", ">": "&#62;", '"': "&#34;", "'": "&#39;", "/": "&#47;" },
			matchHTML = doNotSkipEncoded ? /[&<>"'\/]/g : /&(?!#?\w+;)|<|>|"|'|\//g;
		return function(code) {
			return code ? code.toString().replace(matchHTML, function(m) {return encodeHTMLRules[m] || m;}) : "";
		};
	};

	_globals = (function(){ return this || (0,eval)("this"); }());

	if (typeof module !== "undefined" && module.exports) {
		module.exports = doT;
	} else if (typeof define === "function" && define.amd) {
		define(function(){return doT;});
	} else {
		_globals.doT = doT;
	}

	var startend = {
		append: { start: "'+(",      end: ")+'",      startencode: "'+encodeHTML(" },
		split:  { start: "';out+=(", end: ");out+='", startencode: "';out+=encodeHTML(" }
	}, skip = /$^/;

	function resolveDefs(c, block, def) {
		return ((typeof block === "string") ? block : block.toString())
		.replace(c.define || skip, function(m, code, assign, value) {
			if (code.indexOf("def.") === 0) {
				code = code.substring(4);
			}
			if (!(code in def)) {
				if (assign === ":") {
					if (c.defineParams) value.replace(c.defineParams, function(m, param, v) {
						def[code] = {arg: param, text: v};
					});
					if (!(code in def)) def[code]= value;
				} else {
					new Function("def", "def['"+code+"']=" + value)(def);
				}
			}
			return "";
		})
		.replace(c.use || skip, function(m, code) {
			if (c.useParams) code = code.replace(c.useParams, function(m, s, d, param) {
				if (def[d] && def[d].arg && param) {
					var rw = (d+":"+param).replace(/'|\\/g, "_");
					def.__exp = def.__exp || {};
					def.__exp[rw] = def[d].text.replace(new RegExp("(^|[^\\w$])" + def[d].arg + "([^\\w$])", "g"), "$1" + param + "$2");
					return s + "def.__exp['"+rw+"']";
				}
			});
			var v = new Function("def", "return " + code)(def);
			return v ? resolveDefs(c, v, def) : v;
		});
	}

	function unescape(code) {
		return code.replace(/\\('|\\)/g, "$1").replace(/[\r\t\n]/g, " ");
	}

	doT.template = function(tmpl, c, def) {
		c = c || doT.templateSettings;
		var cse = c.append ? startend.append : startend.split, needhtmlencode, sid = 0, indv,
			str  = (c.use || c.define) ? resolveDefs(c, tmpl, def || {}) : tmpl;

		str = ("var out='" + (c.strip ? str.replace(/(^|\r|\n)\t* +| +\t*(\r|\n|$)/g," ")
					.replace(/\r|\n|\t|\/\*[\s\S]*?\*\//g,""): str)
			.replace(/'|\\/g, "\\$&")
			.replace(c.interpolate || skip, function(m, code) {
				return cse.start + unescape(code) + cse.end;
			})
			.replace(c.encode || skip, function(m, code) {
				needhtmlencode = true;
				return cse.startencode + unescape(code) + cse.end;
			})
			.replace(c.conditional || skip, function(m, elsecase, code) {
				return elsecase ?
					(code ? "';}else if(" + unescape(code) + "){out+='" : "';}else{out+='") :
					(code ? "';if(" + unescape(code) + "){out+='" : "';}out+='");
			})
			.replace(c.iterate || skip, function(m, iterate, vname, iname) {
				if (!iterate) return "';} } out+='";
				sid+=1; indv=iname || "i"+sid; iterate=unescape(iterate);
				return "';var arr"+sid+"="+iterate+";if(arr"+sid+"){var "+vname+","+indv+"=-1,l"+sid+"=arr"+sid+".length-1;while("+indv+"<l"+sid+"){"
					+vname+"=arr"+sid+"["+indv+"+=1];out+='";
			})
			.replace(c.evaluate || skip, function(m, code) {
				return "';" + unescape(code) + "out+='";
			})
			+ "';return out;")
			.replace(/\n/g, "\\n").replace(/\t/g, '\\t').replace(/\r/g, "\\r")
			.replace(/(\s|;|\}|^|\{)out\+='';/g, '$1').replace(/\+''/g, "");
			//.replace(/(\s|;|\}|^|\{)out\+=''\+/g,'$1out+=');

		if (needhtmlencode) {
			if (!c.selfcontained && _globals && !_globals._encodeHTML) _globals._encodeHTML = doT.encodeHTMLSource(c.doNotSkipEncoded);
			str = "var encodeHTML = typeof _encodeHTML !== 'undefined' ? _encodeHTML : ("
				+ doT.encodeHTMLSource.toString() + "(" + (c.doNotSkipEncoded || '') + "));"
				+ str;
		}
		try {
			return new Function(c.varname, str);
		} catch (e) {
			if (typeof console !== "undefined") console.log("Could not create a template function: " + str);
			throw e;
		}
	};

	doT.compile = function(tmpl, def) {
		return doT.template(tmpl, null, def);
	};
}());

},{}],3:[function(require,module,exports){
/* doT + auto-compilation of doT templates
 *
 * 2012, Laura Doktorova, https://github.com/olado/doT
 * Licensed under the MIT license
 *
 * Compiles .def, .dot, .jst files found under the specified path.
 * It ignores sub-directories.
 * Template files can have multiple extensions at the same time.
 * Files with .def extension can be included in other files via {{#def.name}}
 * Files with .dot extension are compiled into functions with the same name and
 * can be accessed as renderer.filename
 * Files with .jst extension are compiled into .js files. Produced .js file can be
 * loaded as a commonJS, AMD module, or just installed into a global variable
 * (default is set to window.render).
 * All inline defines defined in the .jst file are
 * compiled into separate functions and are available via _render.filename.definename
 *
 * Basic usage:
 * var dots = require("dot").process({path: "./views"});
 * dots.mytemplate({foo:"hello world"});
 *
 * The above snippet will:
 * 1. Compile all templates in views folder (.dot, .def, .jst)
 * 2. Place .js files compiled from .jst templates into the same folder.
 *    These files can be used with require, i.e. require("./views/mytemplate").
 * 3. Return an object with functions compiled from .dot templates as its properties.
 * 4. Render mytemplate template.
 */

var fs = require("fs"),
	doT = module.exports = require("./doT");

doT.process = function(options) {
	//path, destination, global, rendermodule, templateSettings
	return new InstallDots(options).compileAll();
};

function InstallDots(o) {
	this.__path 		= o.path || "./";
	if (this.__path[this.__path.length-1] !== '/') this.__path += '/';
	this.__destination	= o.destination || this.__path;
	if (this.__destination[this.__destination.length-1] !== '/') this.__destination += '/';
	this.__global		= o.global || "window.render";
	this.__rendermodule	= o.rendermodule || {};
	this.__settings 	= o.templateSettings ? copy(o.templateSettings, copy(doT.templateSettings)) : undefined;
	this.__includes		= {};
}

InstallDots.prototype.compileToFile = function(path, template, def) {
	def = def || {};
	var modulename = path.substring(path.lastIndexOf("/")+1, path.lastIndexOf("."))
		, defs = copy(this.__includes, copy(def))
		, settings = this.__settings || doT.templateSettings
		, compileoptions = copy(settings)
		, defaultcompiled = doT.template(template, settings, defs)
		, exports = []
		, compiled = ""
		, fn;

	for (var property in defs) {
		if (defs[property] !== def[property] && defs[property] !== this.__includes[property]) {
			fn = undefined;
			if (typeof defs[property] === 'string') {
				fn = doT.template(defs[property], settings, defs);
			} else if (typeof defs[property] === 'function') {
				fn = defs[property];
			} else if (defs[property].arg) {
				compileoptions.varname = defs[property].arg;
				fn = doT.template(defs[property].text, compileoptions, defs);
			}
			if (fn) {
				compiled += fn.toString().replace('anonymous', property);
				exports.push(property);
			}
		}
	}
	compiled += defaultcompiled.toString().replace('anonymous', modulename);
	fs.writeFileSync(path, "(function(){" + compiled
		+ "var itself=" + modulename + ", _encodeHTML=(" + doT.encodeHTMLSource.toString() + "(" + (settings.doNotSkipEncoded || '') + "));"
		+ addexports(exports)
		+ "if(typeof module!=='undefined' && module.exports) module.exports=itself;else if(typeof define==='function')define(function(){return itself;});else {"
		+ this.__global + "=" + this.__global + "||{};" + this.__global + "['" + modulename + "']=itself;}}());");
};

function addexports(exports) {
	for (var ret ='', i=0; i< exports.length; i++) {
		ret += "itself." + exports[i]+ "=" + exports[i]+";";
	}
	return ret;
}

function copy(o, to) {
	to = to || {};
	for (var property in o) {
		to[property] = o[property];
	}
	return to;
}

function readdata(path) {
	var data = fs.readFileSync(path);
	if (data) return data.toString();
	console.log("problems with " + path);
}

InstallDots.prototype.compilePath = function(path) {
	var data = readdata(path);
	if (data) {
		return doT.template(data,
					this.__settings || doT.templateSettings,
					copy(this.__includes));
	}
};

InstallDots.prototype.compileAll = function() {
	console.log("Compiling all doT templates...");

	var defFolder = this.__path,
		sources = fs.readdirSync(defFolder),
		k, l, name;

	for( k = 0, l = sources.length; k < l; k++) {
		name = sources[k];
		if (/\.def(\.dot|\.jst)?$/.test(name)) {
			console.log("Loaded def " + name);
			this.__includes[name.substring(0, name.indexOf('.'))] = readdata(defFolder + name);
		}
	}

	for( k = 0, l = sources.length; k < l; k++) {
		name = sources[k];
		if (/\.dot(\.def|\.jst)?$/.test(name)) {
			console.log("Compiling " + name + " to function");
			this.__rendermodule[name.substring(0, name.indexOf('.'))] = this.compilePath(defFolder + name);
		}
		if (/\.jst(\.dot|\.def)?$/.test(name)) {
			console.log("Compiling " + name + " to file");
			this.compileToFile(this.__destination + name.substring(0, name.indexOf('.')) + '.js',
					readdata(defFolder + name));
		}
	}
	return this.__rendermodule;
};

},{"./doT":2,"fs":1}],4:[function(require,module,exports){
module.exports={
	"version": "2016d",
	"zones": [
		"Africa/Abidjan|LMT GMT|g.8 0|01|-2ldXH.Q|48e5",
		"Africa/Accra|LMT GMT GHST|.Q 0 -k|012121212121212121212121212121212121212121212121|-26BbX.8 6tzX.8 MnE 1BAk MnE 1BAk MnE 1BAk MnE 1C0k MnE 1BAk MnE 1BAk MnE 1BAk MnE 1C0k MnE 1BAk MnE 1BAk MnE 1BAk MnE 1C0k MnE 1BAk MnE 1BAk MnE 1BAk MnE 1C0k MnE 1BAk MnE 1BAk MnE 1BAk MnE 1C0k MnE 1BAk MnE 1BAk MnE|41e5",
		"Africa/Nairobi|LMT EAT BEAT BEAUT|-2r.g -30 -2u -2J|01231|-1F3Cr.g 3Dzr.g okMu MFXJ|47e5",
		"Africa/Algiers|PMT WET WEST CET CEST|-9.l 0 -10 -10 -20|0121212121212121343431312123431213|-2nco9.l cNb9.l HA0 19A0 1iM0 11c0 1oo0 Wo0 1rc0 QM0 1EM0 UM0 DA0 Imo0 rd0 De0 9Xz0 1fb0 1ap0 16K0 2yo0 mEp0 hwL0 jxA0 11A0 dDd0 17b0 11B0 1cN0 2Dy0 1cN0 1fB0 1cL0|26e5",
		"Africa/Lagos|LMT WAT|-d.A -10|01|-22y0d.A|17e6",
		"Africa/Bissau|LMT WAT GMT|12.k 10 0|012|-2ldWV.E 2xonV.E|39e4",
		"Africa/Maputo|LMT CAT|-2a.k -20|01|-2GJea.k|26e5",
		"Africa/Cairo|EET EEST|-20 -30|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-1bIO0 vb0 1ip0 11z0 1iN0 1nz0 12p0 1pz0 10N0 1pz0 16p0 1jz0 s3d0 Vz0 1oN0 11b0 1oO0 10N0 1pz0 10N0 1pb0 10N0 1pb0 10N0 1pb0 10N0 1pz0 10N0 1pb0 10N0 1pb0 11d0 1oL0 11d0 1pb0 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 1oL0 11d0 1WL0 rd0 1Rz0 wp0 1pb0 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 1qL0 Xd0 1oL0 11d0 1oL0 11d0 1pb0 11d0 1oL0 11d0 1oL0 11d0 1ny0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 WL0 1qN0 Rb0 1wp0 On0 1zd0 Lz0 1EN0 Fb0 c10 8n0 8Nd0 gL0 e10 mn0|15e6",
		"Africa/Casablanca|LMT WET WEST CET|u.k 0 -10 -10|0121212121212121213121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2gMnt.E 130Lt.E rb0 Dd0 dVb0 b6p0 TX0 EoB0 LL0 gnd0 rz0 43d0 AL0 1Nd0 XX0 1Cp0 pz0 dEp0 4mn0 SyN0 AL0 1Nd0 wn0 1FB0 Db0 1zd0 Lz0 1Nf0 wM0 co0 go0 1o00 s00 dA0 vc0 11A0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 Rc0 11A0 e00 e00 U00 11A0 8o0 e00 11A0 11A0 5A0 e00 17c0 1fA0 1a00 1a00 1fA0 17c0 1io0 14o0 1lc0 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1lc0 14o0 1fA0|32e5",
		"Africa/Ceuta|WET WEST CET CEST|0 -10 -10 -20|010101010101010101010232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-25KN0 11z0 drd0 18o0 3I00 17c0 1fA0 1a00 1io0 1a00 1y7p0 LL0 gnd0 rz0 43d0 AL0 1Nd0 XX0 1Cp0 pz0 dEp0 4VB0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|85e3",
		"Africa/El_Aaiun|LMT WAT WET WEST|Q.M 10 0 -10|01232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-1rDz7.c 1GVA7.c 6L0 AL0 1Nd0 XX0 1Cp0 pz0 1cBB0 AL0 1Nd0 wn0 1FB0 Db0 1zd0 Lz0 1Nf0 wM0 co0 go0 1o00 s00 dA0 vc0 11A0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 Rc0 11A0 e00 e00 U00 11A0 8o0 e00 11A0 11A0 5A0 e00 17c0 1fA0 1a00 1a00 1fA0 17c0 1io0 14o0 1lc0 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1lc0 14o0 1fA0|20e4",
		"Africa/Johannesburg|SAST SAST SAST|-1u -20 -30|012121|-2GJdu 1Ajdu 1cL0 1cN0 1cL0|84e5",
		"Africa/Khartoum|LMT CAT CAST EAT|-2a.8 -20 -30 -30|01212121212121212121212121212121213|-1yW2a.8 1zK0a.8 16L0 1iN0 17b0 1jd0 17b0 1ip0 17z0 1i10 17X0 1hB0 18n0 1hd0 19b0 1gp0 19z0 1iN0 17b0 1ip0 17z0 1i10 18n0 1hd0 18L0 1gN0 19b0 1gp0 19z0 1iN0 17z0 1i10 17X0 yGd0|51e5",
		"Africa/Monrovia|MMT LRT GMT|H.8 I.u 0|012|-23Lzg.Q 29s01.m|11e5",
		"Africa/Ndjamena|LMT WAT WAST|-10.c -10 -20|0121|-2le10.c 2J3c0.c Wn0|13e5",
		"Africa/Tripoli|LMT CET CEST EET|-Q.I -10 -20 -20|012121213121212121212121213123123|-21JcQ.I 1hnBQ.I vx0 4iP0 xx0 4eN0 Bb0 7ip0 U0n0 A10 1db0 1cN0 1db0 1dd0 1db0 1eN0 1bb0 1e10 1cL0 1c10 1db0 1dd0 1db0 1cN0 1db0 1q10 fAn0 1ep0 1db0 AKq0 TA0 1o00|11e5",
		"Africa/Tunis|PMT CET CEST|-9.l -10 -20|0121212121212121212121212121212121|-2nco9.l 18pa9.l 1qM0 DA0 3Tc0 11B0 1ze0 WM0 7z0 3d0 14L0 1cN0 1f90 1ar0 16J0 1gXB0 WM0 1rA0 11c0 nwo0 Ko0 1cM0 1cM0 1rA0 10M0 zuM0 10N0 1aN0 1qM0 WM0 1qM0 11A0 1o00|20e5",
		"Africa/Windhoek|SWAT SAST SAST CAT WAT WAST|-1u -20 -30 -20 -10 -20|012134545454545454545454545454545454545454545454545454545454545454545454545454545454545454545|-2GJdu 1Ajdu 1cL0 1SqL0 9NA0 11D0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0 1nX0 11B0|32e4",
		"America/Adak|NST NWT NPT BST BDT AHST HST HDT|b0 a0 a0 b0 a0 a0 a0 90|012034343434343434343434343434343456767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676|-17SX0 8wW0 iB0 Qlb0 52O0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 cm0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|326",
		"America/Anchorage|CAT CAWT CAPT AHST AHDT YST AKST AKDT|a0 90 90 a0 90 90 90 80|012034343434343434343434343434343456767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676|-17T00 8wX0 iA0 Qlb0 52O0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 cm0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|30e4",
		"America/Port_of_Spain|LMT AST|46.4 40|01|-2kNvR.U|43e3",
		"America/Araguaina|LMT BRT BRST|3c.M 30 20|0121212121212121212121212121212121212121212121212121|-2glwL.c HdKL.c 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 dMN0 Lz0 1zd0 Rb0 1wN0 Wn0 1tB0 Rb0 1tB0 WL0 1tB0 Rb0 1zd0 On0 1HB0 FX0 ny10 Lz0|14e4",
		"America/Argentina/Buenos_Aires|CMT ART ARST ART ARST|4g.M 40 30 30 20|0121212121212121212121212121212121212121213434343434343234343|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wp0 Rb0 1wp0 TX0 g0p0 10M0 j3c0 uL0 1qN0 WL0",
		"America/Argentina/Catamarca|CMT ART ARST ART ARST WART|4g.M 40 30 30 20 40|0121212121212121212121212121212121212121213434343454343235343|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wq0 Ra0 1wp0 TX0 g0p0 10M0 ako0 7B0 8zb0 uL0",
		"America/Argentina/Cordoba|CMT ART ARST ART ARST WART|4g.M 40 30 30 20 40|0121212121212121212121212121212121212121213434343454343234343|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wq0 Ra0 1wp0 TX0 g0p0 10M0 j3c0 uL0 1qN0 WL0",
		"America/Argentina/Jujuy|CMT ART ARST ART ARST WART WARST|4g.M 40 30 30 20 40 30|01212121212121212121212121212121212121212134343456543432343|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1ze0 TX0 1ld0 WK0 1wp0 TX0 g0p0 10M0 j3c0 uL0",
		"America/Argentina/La_Rioja|CMT ART ARST ART ARST WART|4g.M 40 30 30 20 40|01212121212121212121212121212121212121212134343434534343235343|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Qn0 qO0 16n0 Rb0 1wp0 TX0 g0p0 10M0 ako0 7B0 8zb0 uL0",
		"America/Argentina/Mendoza|CMT ART ARST ART ARST WART WARST|4g.M 40 30 30 20 40 30|0121212121212121212121212121212121212121213434345656543235343|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1u20 SL0 1vd0 Tb0 1wp0 TW0 g0p0 10M0 agM0 Op0 7TX0 uL0",
		"America/Argentina/Rio_Gallegos|CMT ART ARST ART ARST WART|4g.M 40 30 30 20 40|0121212121212121212121212121212121212121213434343434343235343|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wp0 Rb0 1wp0 TX0 g0p0 10M0 ako0 7B0 8zb0 uL0",
		"America/Argentina/Salta|CMT ART ARST ART ARST WART|4g.M 40 30 30 20 40|01212121212121212121212121212121212121212134343434543432343|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wq0 Ra0 1wp0 TX0 g0p0 10M0 j3c0 uL0",
		"America/Argentina/San_Juan|CMT ART ARST ART ARST WART|4g.M 40 30 30 20 40|01212121212121212121212121212121212121212134343434534343235343|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Qn0 qO0 16n0 Rb0 1wp0 TX0 g0p0 10M0 ak00 m10 8lb0 uL0",
		"America/Argentina/San_Luis|CMT ART ARST ART ARST WART WARST|4g.M 40 30 30 20 40 30|01212121212121212121212121212121212121212134343456536353465653|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 XX0 1q20 SL0 AN0 kin0 10M0 ak00 m10 8lb0 8L0 jd0 1qN0 WL0 1qN0",
		"America/Argentina/Tucuman|CMT ART ARST ART ARST WART|4g.M 40 30 30 20 40|012121212121212121212121212121212121212121343434345434323534343|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wq0 Ra0 1wp0 TX0 g0p0 10M0 ako0 4N0 8BX0 uL0 1qN0 WL0",
		"America/Argentina/Ushuaia|CMT ART ARST ART ARST WART|4g.M 40 30 30 20 40|0121212121212121212121212121212121212121213434343434343235343|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wp0 Rb0 1wp0 TX0 g0p0 10M0 ajA0 8p0 8zb0 uL0",
		"America/Curacao|LMT ANT AST|4z.L 4u 40|012|-2kV7o.d 28KLS.d|15e4",
		"America/Asuncion|AMT PYT PYT PYST|3O.E 40 30 30|012131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313|-1x589.k 1DKM9.k 3CL0 3Dd0 10L0 1pB0 10n0 1pB0 10n0 1pB0 1cL0 1dd0 1db0 1dd0 1cL0 1dd0 1cL0 1dd0 1cL0 1dd0 1db0 1dd0 1cL0 1dd0 1cL0 1dd0 1cL0 1dd0 1db0 1dd0 1cL0 1lB0 14n0 1dd0 1cL0 1fd0 WL0 1rd0 1aL0 1dB0 Xz0 1qp0 Xb0 1qN0 10L0 1rB0 TX0 1tB0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 1cL0 WN0 1qL0 11B0 1nX0 1ip0 WL0 1qN0 WL0 1qN0 WL0 1tB0 TX0 1tB0 TX0 1tB0 19X0 1a10 1fz0 1a10 1fz0 1cN0 17b0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0|28e5",
		"America/Atikokan|CST CDT CWT CPT EST|60 50 50 50 50|0101234|-25TQ0 1in0 Rnb0 3je0 8x30 iw0|28e2",
		"America/Bahia|LMT BRT BRST|2y.4 30 20|01212121212121212121212121212121212121212121212121212121212121|-2glxp.U HdLp.U 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 1EN0 Lz0 1C10 IL0 1HB0 Db0 1HB0 On0 1zd0 On0 1zd0 Lz0 1zd0 Rb0 1wN0 Wn0 1tB0 Rb0 1tB0 WL0 1tB0 Rb0 1zd0 On0 1HB0 FX0 l5B0 Rb0|27e5",
		"America/Bahia_Banderas|LMT MST CST PST MDT CDT|71 70 60 80 60 50|0121212131414141414141414141414141414152525252525252525252525252525252525252525252525252525252|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 otX0 gmN0 P2N0 13Vd0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nW0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|84e3",
		"America/Barbados|LMT BMT AST ADT|3W.t 3W.t 40 30|01232323232|-1Q0I1.v jsM0 1ODC1.v IL0 1ip0 17b0 1ip0 17b0 1ld0 13b0|28e4",
		"America/Belem|LMT BRT BRST|3d.U 30 20|012121212121212121212121212121|-2glwK.4 HdKK.4 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0|20e5",
		"America/Belize|LMT CST CHDT CDT|5Q.M 60 5u 50|01212121212121212121212121212121212121212121212121213131|-2kBu7.c fPA7.c Onu 1zcu Rbu 1wou Rbu 1wou Rbu 1zcu Onu 1zcu Onu 1zcu Rbu 1wou Rbu 1wou Rbu 1wou Rbu 1zcu Onu 1zcu Onu 1zcu Rbu 1wou Rbu 1wou Rbu 1zcu Onu 1zcu Onu 1zcu Onu 1zcu Rbu 1wou Rbu 1wou Rbu 1zcu Onu 1zcu Onu 1zcu Rbu 1wou Rbu 1f0Mu qn0 lxB0 mn0|57e3",
		"America/Blanc-Sablon|AST ADT AWT APT|40 30 30 30|010230|-25TS0 1in0 UGp0 8x50 iu0|11e2",
		"America/Boa_Vista|LMT AMT AMST|42.E 40 30|0121212121212121212121212121212121|-2glvV.k HdKV.k 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 smp0 WL0 1tB0 2L0|62e2",
		"America/Bogota|BMT COT COST|4U.g 50 40|0121|-2eb73.I 38yo3.I 2en0|90e5",
		"America/Boise|PST PDT MST MWT MPT MDT|80 70 70 60 60 60|0101023425252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252|-261q0 1nX0 11B0 1nX0 8C10 JCL0 8x20 ix0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 Dd0 1Kn0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e4",
		"America/Cambridge_Bay|zzz MST MWT MPT MDDT MDT CST CDT EST|0 70 60 60 50 60 60 50 50|0123141515151515151515151515151515151515151515678651515151515151515151515151515151515151515151515151515151515151515151515151|-21Jc0 RO90 8x20 ix0 LCL0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11A0 1nX0 2K0 WQ0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e2",
		"America/Campo_Grande|LMT AMT AMST|3C.s 40 30|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212|-2glwl.w HdLl.w 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 1EN0 Lz0 1C10 IL0 1HB0 Db0 1HB0 On0 1zd0 On0 1zd0 Lz0 1zd0 Rb0 1wN0 Wn0 1tB0 Rb0 1tB0 WL0 1tB0 Rb0 1zd0 On0 1HB0 FX0 1C10 Lz0 1Ip0 HX0 1zd0 On0 1HB0 IL0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 Rb0 1zd0 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1C10 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 Rb0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1C10 Lz0 1C10 Lz0 1C10 Lz0 1C10 On0 1zd0 Rb0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0|77e4",
		"America/Cancun|LMT CST EST EDT CDT|5L.4 60 50 40 50|0123232341414141414141414141414141414141412|-1UQG0 2q2o0 yLB0 1lb0 14p0 1lb0 14p0 Lz0 xB0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 Dd0|63e4",
		"America/Caracas|CMT VET VET|4r.E 4u 40|01212|-2kV7w.k 28KM2.k 1IwOu kqo0|29e5",
		"America/Cayenne|LMT GFT GFT|3t.k 40 30|012|-2mrwu.E 2gWou.E|58e3",
		"America/Panama|CMT EST|5j.A 50|01|-2uduE.o|15e5",
		"America/Chicago|CST CDT EST CWT CPT|60 50 50 50 50|01010101010101010101010101010101010102010101010103401010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261s0 1nX0 11B0 1nX0 1wp0 TX0 WN0 1qL0 1cN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 11B0 1Hz0 14p0 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 RB0 8x30 iw0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|92e5",
		"America/Chihuahua|LMT MST CST CDT MDT|74.k 70 60 50 60|0121212323241414141414141414141414141414141414141414141414141414141414141414141414141414141|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 2zQN0 1lb0 14p0 1lb0 14q0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|81e4",
		"America/Costa_Rica|SJMT CST CDT|5A.d 60 50|0121212121|-1Xd6n.L 2lu0n.L Db0 1Kp0 Db0 pRB0 15b0 1kp0 mL0|12e5",
		"America/Creston|MST PST|70 80|010|-29DR0 43B0|53e2",
		"America/Cuiaba|LMT AMT AMST|3I.k 40 30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212|-2glwf.E HdLf.E 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 1EN0 Lz0 1C10 IL0 1HB0 Db0 1HB0 On0 1zd0 On0 1zd0 Lz0 1zd0 Rb0 1wN0 Wn0 1tB0 Rb0 1tB0 WL0 1tB0 Rb0 1zd0 On0 1HB0 FX0 4a10 HX0 1zd0 On0 1HB0 IL0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 Rb0 1zd0 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1C10 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 Rb0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1C10 Lz0 1C10 Lz0 1C10 Lz0 1C10 On0 1zd0 Rb0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0|54e4",
		"America/Danmarkshavn|LMT WGT WGST GMT|1e.E 30 20 0|01212121212121212121212121212121213|-2a5WJ.k 2z5fJ.k 19U0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 DC0|8",
		"America/Dawson|YST YDT YWT YPT YDDT PST PDT|90 80 80 80 70 80 70|0101023040565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565|-25TN0 1in0 1o10 13V0 Ser0 8x00 iz0 LCL0 1fA0 jrA0 fNd0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|13e2",
		"America/Dawson_Creek|PST PDT PWT PPT MST|80 70 70 70 70|0102301010101010101010101010101010101010101010101010101014|-25TO0 1in0 UGp0 8x10 iy0 3NB0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 ML0|12e3",
		"America/Denver|MST MDT MWT MPT|70 60 60 60|01010101023010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261r0 1nX0 11B0 1nX0 11B0 1qL0 WN0 mn0 Ord0 8x20 ix0 LCN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e5",
		"America/Detroit|LMT CST EST EWT EPT EDT|5w.b 60 50 40 40 40|01234252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252|-2Cgir.N peqr.N 156L0 8x40 iv0 6fd0 11z0 Jy10 SL0 dnB0 1cL0 s10 1Vz0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e5",
		"America/Edmonton|LMT MST MDT MWT MPT|7x.Q 70 60 60 60|01212121212121341212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2yd4q.8 shdq.8 1in0 17d0 hz0 2dB0 1fz0 1a10 11z0 1qN0 WL0 1qN0 11z0 IGN0 8x20 ix0 3NB0 11z0 LFB0 1cL0 3Cp0 1cL0 66N0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|10e5",
		"America/Eirunepe|LMT ACT ACST AMT|4D.s 50 40 40|0121212121212121212121212121212131|-2glvk.w HdLk.w 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 dPB0 On0 yTd0 d5X0|31e3",
		"America/El_Salvador|LMT CST CDT|5U.M 60 50|012121|-1XiG3.c 2Fvc3.c WL0 1qN0 WL0|11e5",
		"America/Tijuana|LMT MST PST PDT PWT PPT|7M.4 70 80 70 70 70|012123245232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-1UQE0 4PX0 8mM0 8lc0 SN0 1cL0 pHB0 83r0 zI0 5O10 1Rz0 cOP0 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 BUp0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 U10 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|20e5",
		"America/Fort_Nelson|PST PDT PWT PPT MST|80 70 70 70 70|01023010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010104|-25TO0 1in0 UGp0 8x10 iy0 3NB0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0|39e2",
		"America/Fort_Wayne|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|010101023010101010101010101040454545454545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 QI10 Db0 RB0 8x30 iw0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 5Tz0 1o10 qLb0 1cL0 1cN0 1cL0 1qhd0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Fortaleza|LMT BRT BRST|2y 30 20|0121212121212121212121212121212121212121|-2glxq HdLq 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 nsp0 WL0 1tB0 5z0 2mN0 On0|34e5",
		"America/Glace_Bay|LMT AST ADT AWT APT|3X.M 40 30 30 30|012134121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2IsI0.c CwO0.c 1in0 UGp0 8x50 iu0 iq10 11z0 Jg10 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|19e3",
		"America/Godthab|LMT WGT WGST|3q.U 30 20|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2a5Ux.4 2z5dx.4 19U0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|17e3",
		"America/Goose_Bay|NST NDT NST NDT NWT NPT AST ADT ADDT|3u.Q 2u.Q 3u 2u 2u 2u 40 30 20|010232323232323245232323232323232323232323232323232323232326767676767676767676767676767676767676767676768676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676|-25TSt.8 1in0 DXb0 2HbX.8 WL0 1qN0 WL0 1qN0 WL0 1tB0 TX0 1tB0 WL0 1qN0 WL0 1qN0 7UHu itu 1tB0 WL0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1tB0 WL0 1ld0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 S10 g0u 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14n1 1lb0 14p0 1nW0 11C0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zcX Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|76e2",
		"America/Grand_Turk|KMT EST EDT AST|57.b 50 40 40|0121212121212121212121212121212121212121212121212121212121212121212121212123|-2l1uQ.N 2HHBQ.N 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e2",
		"America/Guatemala|LMT CST CDT|62.4 60 50|0121212121|-24KhV.U 2efXV.U An0 mtd0 Nz0 ifB0 17b0 zDB0 11z0|13e5",
		"America/Guayaquil|QMT ECT|5e 50|01|-1yVSK|27e5",
		"America/Guyana|LMT GBGT GYT GYT GYT|3Q.E 3J 3J 30 40|01234|-2dvU7.k 24JzQ.k mlc0 Bxbf|80e4",
		"America/Halifax|LMT AST ADT AWT APT|4e.o 40 30 30 30|0121212121212121212121212121212121212121212121212134121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2IsHJ.A xzzJ.A 1db0 3I30 1in0 3HX0 IL0 1E10 ML0 1yN0 Pb0 1Bd0 Mn0 1Bd0 Rz0 1w10 Xb0 1w10 LX0 1w10 Xb0 1w10 Lz0 1C10 Jz0 1E10 OL0 1yN0 Un0 1qp0 Xb0 1qp0 11X0 1w10 Lz0 1HB0 LX0 1C10 FX0 1w10 Xb0 1qp0 Xb0 1BB0 LX0 1td0 Xb0 1qp0 Xb0 Rf0 8x50 iu0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 3Qp0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 3Qp0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 6i10 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|39e4",
		"America/Havana|HMT CST CDT|5t.A 50 40|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1Meuu.o 72zu.o ML0 sld0 An0 1Nd0 Db0 1Nd0 An0 6Ep0 An0 1Nd0 An0 JDd0 Mn0 1Ap0 On0 1fd0 11X0 1qN0 WL0 1wp0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 14n0 1ld0 14L0 1kN0 15b0 1kp0 1cL0 1cN0 1fz0 1a10 1fz0 1fB0 11z0 14p0 1nX0 11B0 1nX0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 14n0 1ld0 14n0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 1a10 1in0 1a10 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 17c0 1o00 11A0 1qM0 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 11A0 6i00 Rc0 1wo0 U00 1tA0 Rc0 1wo0 U00 1wo0 U00 1zc0 U00 1qM0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0|21e5",
		"America/Hermosillo|LMT MST CST PST MDT|7n.Q 70 60 80 60|0121212131414141|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 otX0 gmN0 P2N0 13Vd0 1lb0 14p0 1lb0 14p0 1lb0|64e4",
		"America/Indiana/Knox|CST CDT CWT CPT EST|60 50 50 50 50|0101023010101010101010101010101010101040101010101010101010101010101010101010101010101010141010101010101010101010101010101010101010101010101010101010101010|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 3NB0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 11z0 1o10 11z0 1o10 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 3Cn0 8wp0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 z8o0 1o00 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Marengo|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|0101023010101010101010104545454545414545454545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 dyN0 11z0 6fd0 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 jrz0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1VA0 LA0 1BX0 1e6p0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Petersburg|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|01010230101010101010101010104010101010101010101010141014545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 njX0 WN0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 3Fb0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 19co0 1o00 Rd0 1zb0 Oo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Tell_City|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|01010230101010101010101010101010454541010101010101010101010101010101010101010101010101010101010101010|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 1o10 11z0 g0p0 11z0 1o10 11z0 1qL0 WN0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 caL0 1cL0 1cN0 1cL0 1qhd0 1o00 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Vevay|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|010102304545454545454545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 kPB0 Awn0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1lnd0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Vincennes|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|01010230101010101010101010101010454541014545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 1o10 11z0 g0p0 11z0 1o10 11z0 1qL0 WN0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 caL0 1cL0 1cN0 1cL0 1qhd0 1o00 Rd0 1zb0 Oo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Winamac|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|01010230101010101010101010101010101010454541054545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 jrz0 1cL0 1cN0 1cL0 1qhd0 1o00 Rd0 1za0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Inuvik|zzz PST PDDT MST MDT|0 80 60 70 60|0121343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343|-FnA0 tWU0 1fA0 wPe0 2pz0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|35e2",
		"America/Iqaluit|zzz EWT EPT EST EDDT EDT CST CDT|0 40 40 50 30 40 60 50|01234353535353535353535353535353535353535353567353535353535353535353535353535353535353535353535353535353535353535353535353|-16K00 7nX0 iv0 LCL0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11C0 1nX0 11A0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|67e2",
		"America/Jamaica|KMT EST EDT|57.b 50 40|0121212121212121212121|-2l1uQ.N 2uM1Q.N 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0|94e4",
		"America/Juneau|PST PWT PPT PDT YDT YST AKST AKDT|80 70 70 70 80 90 90 80|01203030303030303030303030403030356767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676|-17T20 8x10 iy0 Vo10 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cM0 1cM0 1cL0 1cN0 1fz0 1a10 1fz0 co0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|33e3",
		"America/Kentucky/Louisville|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|0101010102301010101010101010101010101454545454545414545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 3Fd0 Nb0 LPd0 11z0 RB0 8x30 iw0 Bb0 10N0 2bB0 8in0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 xz0 gso0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1VA0 LA0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Kentucky/Monticello|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|0101023010101010101010101010101010101010101010101010101010101010101010101454545454545454545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 SWp0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11A0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/La_Paz|CMT BOST BOT|4w.A 3w.A 40|012|-1x37r.o 13b0|19e5",
		"America/Lima|LMT PET PEST|58.A 50 40|0121212121212121|-2tyGP.o 1bDzP.o zX0 1aN0 1cL0 1cN0 1cL0 1PrB0 zX0 1O10 zX0 6Gp0 zX0 98p0 zX0|11e6",
		"America/Los_Angeles|PST PDT PWT PPT|80 70 70 70|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261q0 1nX0 11B0 1nX0 SgN0 8x10 iy0 5Wp0 1Vb0 3dB0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e6",
		"America/Maceio|LMT BRT BRST|2m.Q 30 20|012121212121212121212121212121212121212121|-2glxB.8 HdLB.8 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 dMN0 Lz0 8Q10 WL0 1tB0 5z0 2mN0 On0|93e4",
		"America/Managua|MMT CST EST CDT|5J.c 60 50 50|0121313121213131|-1quie.M 1yAMe.M 4mn0 9Up0 Dz0 1K10 Dz0 s3F0 1KH0 DB0 9In0 k8p0 19X0 1o30 11y0|22e5",
		"America/Manaus|LMT AMT AMST|40.4 40 30|01212121212121212121212121212121|-2glvX.U HdKX.U 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 dPB0 On0|19e5",
		"America/Martinique|FFMT AST ADT|44.k 40 30|0121|-2mPTT.E 2LPbT.E 19X0|39e4",
		"America/Matamoros|LMT CST CDT|6E 60 50|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1UQG0 2FjC0 1nX0 i6p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 U10 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|45e4",
		"America/Mazatlan|LMT MST CST PST MDT|75.E 70 60 80 60|0121212131414141414141414141414141414141414141414141414141414141414141414141414141414141414141|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 otX0 gmN0 P2N0 13Vd0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|44e4",
		"America/Menominee|CST CDT CWT CPT EST|60 50 50 50 50|01010230101041010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 1o10 11z0 LCN0 1fz0 6410 9Jb0 1cM0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|85e2",
		"America/Merida|LMT CST EST CDT|5W.s 60 50 50|0121313131313131313131313131313131313131313131313131313131313131313131313131313131313131|-1UQG0 2q2o0 2hz0 wu30 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|11e5",
		"America/Metlakatla|PST PWT PPT PDT AKST AKDT|80 70 70 70 90 80|0120303030303030303030303030303030454545454545454545454545454545454545454545454|-17T20 8x10 iy0 Vo10 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1hU10 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
		"America/Mexico_City|LMT MST CST CDT CWT|6A.A 70 60 50 50|012121232324232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 gEn0 TX0 3xd0 Jb0 6zB0 SL0 e5d0 17b0 1Pff0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|20e6",
		"America/Miquelon|LMT AST PMST PMDT|3I.E 40 30 20|012323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-2mKkf.k 2LTAf.k gQ10 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|61e2",
		"America/Moncton|EST AST ADT AWT APT|50 40 30 30 30|012121212121212121212134121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2IsH0 CwN0 1in0 zAo0 An0 1Nd0 An0 1Nd0 An0 1Nd0 An0 1Nd0 An0 1Nd0 An0 1K10 Lz0 1zB0 NX0 1u10 Wn0 S20 8x50 iu0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 3Cp0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14n1 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 ReX 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|64e3",
		"America/Monterrey|LMT CST CDT|6F.g 60 50|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1UQG0 2FjC0 1nX0 i6p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|41e5",
		"America/Montevideo|MMT UYT UYHST UYST UYT UYHST|3I.I 3u 30 20 30 2u|012121212121212121212121213434343434345454543453434343434343434343434343434343434343434|-20UIf.g 8jzJ.g 1cLu 1dcu 1cLu 1dcu 1cLu ircu 11zu 1o0u 11zu 1o0u 11zu 1qMu WLu 1qMu WLu 1qMu WLu 1qMu 11zu 1o0u 11zu NAu 11bu 2iMu zWu Dq10 19X0 pd0 jz0 cm10 19X0 1fB0 1on0 11d0 1oL0 1nB0 1fzu 1aou 1fzu 1aou 1fzu 3nAu Jb0 3MN0 1SLu 4jzu 2PB0 Lb0 3Dd0 1pb0 ixd0 An0 1MN0 An0 1wp0 On0 1wp0 Rb0 1zd0 On0 1wp0 Rb0 s8p0 1fB0 1ip0 11z0 1ld0 14n0 1o10 11z0 1o10 11z0 1o10 14n0 1ld0 14n0 1ld0 14n0 1o10 11z0 1o10 11z0 1o10 11z0|17e5",
		"America/Toronto|EST EDT EWT EPT|50 40 40 40|01010101010101010101010101010101010101010101012301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-25TR0 1in0 11Wu 1nzu 1fD0 WJ0 1wr0 Nb0 1Ap0 On0 1zd0 On0 1wp0 TX0 1tB0 TX0 1tB0 TX0 1tB0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 4kM0 8x40 iv0 1o10 11z0 1nX0 11z0 1o10 11z0 1o10 1qL0 11D0 1nX0 11B0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|65e5",
		"America/Nassau|LMT EST EDT|59.u 50 40|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2kNuO.u 26XdO.u 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|24e4",
		"America/New_York|EST EDT EWT EPT|50 40 40 40|01010101010101010101010101010101010101010101010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261t0 1nX0 11B0 1nX0 11B0 1qL0 1a10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 RB0 8x40 iv0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e6",
		"America/Nipigon|EST EDT EWT EPT|50 40 40 40|010123010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-25TR0 1in0 Rnb0 3je0 8x40 iv0 19yN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|16e2",
		"America/Nome|NST NWT NPT BST BDT YST AKST AKDT|b0 a0 a0 b0 a0 90 90 80|012034343434343434343434343434343456767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676|-17SX0 8wW0 iB0 Qlb0 52O0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 cl0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|38e2",
		"America/Noronha|LMT FNT FNST|29.E 20 10|0121212121212121212121212121212121212121|-2glxO.k HdKO.k 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 nsp0 WL0 1tB0 2L0 2pB0 On0|30e2",
		"America/North_Dakota/Beulah|MST MDT MWT MPT CST CDT|70 60 60 60 60 50|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101014545454545454545454545454545454545454545454545454545454|-261r0 1nX0 11B0 1nX0 SgN0 8x20 ix0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Oo0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/North_Dakota/Center|MST MDT MWT MPT CST CDT|70 60 60 60 60 50|010102301010101010101010101010101010101010101010101010101014545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-261r0 1nX0 11B0 1nX0 SgN0 8x20 ix0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14o0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/North_Dakota/New_Salem|MST MDT MWT MPT CST CDT|70 60 60 60 60 50|010102301010101010101010101010101010101010101010101010101010101010101010101010101454545454545454545454545454545454545454545454545454545454545454545454|-261r0 1nX0 11B0 1nX0 SgN0 8x20 ix0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14o0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Ojinaga|LMT MST CST CDT MDT|6V.E 70 60 50 60|0121212323241414141414141414141414141414141414141414141414141414141414141414141414141414141|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 2zQN0 1lb0 14p0 1lb0 14q0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 U10 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e3",
		"America/Pangnirtung|zzz AST AWT APT ADDT ADT EDT EST CST CDT|0 40 30 30 20 30 40 50 60 50|012314151515151515151515151515151515167676767689767676767676767676767676767676767676767676767676767676767676767676767676767|-1XiM0 PnG0 8x50 iu0 LCL0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1o00 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11C0 1nX0 11A0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
		"America/Paramaribo|LMT PMT PMT NEGT SRT SRT|3E.E 3E.Q 3E.A 3u 3u 30|012345|-2nDUj.k Wqo0.c qanX.I 1dmLN.o lzc0|24e4",
		"America/Phoenix|MST MDT MWT|70 60 60|01010202010|-261r0 1nX0 11B0 1nX0 SgN0 4Al1 Ap0 1db0 SWqX 1cL0|42e5",
		"America/Port-au-Prince|PPMT EST EDT|4N 50 40|01212121212121212121212121212121212121212121|-28RHb 2FnMb 19X0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14q0 1o00 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 14o0 1o00 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 i6n0 1nX0 11B0 1nX0 d430 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
		"America/Rio_Branco|LMT ACT ACST AMT|4v.c 50 40 40|01212121212121212121212121212131|-2glvs.M HdLs.M 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 NBd0 d5X0|31e4",
		"America/Porto_Velho|LMT AMT AMST|4f.A 40 30|012121212121212121212121212121|-2glvI.o HdKI.o 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0|37e4",
		"America/Puerto_Rico|AST AWT APT|40 30 30|0120|-17lU0 7XT0 iu0|24e5",
		"America/Rainy_River|CST CDT CWT CPT|60 50 50 50|010123010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-25TQ0 1in0 Rnb0 3je0 8x30 iw0 19yN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|842",
		"America/Rankin_Inlet|zzz CST CDDT CDT EST|0 60 40 50 50|012131313131313131313131313131313131313131313431313131313131313131313131313131313131313131313131313131313131313131313131|-vDc0 keu0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e2",
		"America/Recife|LMT BRT BRST|2j.A 30 20|0121212121212121212121212121212121212121|-2glxE.o HdLE.o 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 nsp0 WL0 1tB0 2L0 2pB0 On0|33e5",
		"America/Regina|LMT MST MDT MWT MPT CST|6W.A 70 60 60 60 60|012121212121212121212121341212121212121212121212121215|-2AD51.o uHe1.o 1in0 s2L0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 66N0 1cL0 1cN0 19X0 1fB0 1cL0 1fB0 1cL0 1cN0 1cL0 M30 8x20 ix0 1ip0 1cL0 1ip0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 3NB0 1cL0 1cN0|19e4",
		"America/Resolute|zzz CST CDDT CDT EST|0 60 40 50 50|012131313131313131313131313131313131313131313431313131313431313131313131313131313131313131313131313131313131313131313131|-SnA0 GWS0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|229",
		"America/Santarem|LMT AMT AMST BRT|3C.M 40 30 30|0121212121212121212121212121213|-2glwl.c HdLl.c 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 NBd0|21e4",
		"America/Santiago|SMT CLT CLT CLST CLST|4G.K 50 40 40 30|010203131313131212421242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424|-2q2jh.e fJAh.e 5knG.K 1Vzh.e jRAG.K 1pbh.e 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 nHX0 op0 9Bz0 jb0 1oN0 ko0 Qeo0 WL0 1zd0 On0 1ip0 11z0 1o10 11z0 1qN0 WL0 1ld0 14n0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 1cL0 1cN0 11z0 1o10 11z0 1qN0 WL0 1fB0 19X0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1ip0 1fz0 1fB0 11z0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1o10 19X0 1fB0 1nX0 G10 1EL0 Op0 1zb0 Rd0 1wn0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Dd0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Dd0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Dd0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0|62e5",
		"America/Santo_Domingo|SDMT EST EDT EHDT AST|4E 50 40 4u 40|01213131313131414|-1ttjk 1lJMk Mn0 6sp0 Lbu 1Cou yLu 1RAu wLu 1QMu xzu 1Q0u xXu 1PAu 13jB0 e00|29e5",
		"America/Sao_Paulo|LMT BRT BRST|36.s 30 20|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212|-2glwR.w HdKR.w 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 pTd0 PX0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 1EN0 Lz0 1C10 IL0 1HB0 Db0 1HB0 On0 1zd0 On0 1zd0 Lz0 1zd0 Rb0 1wN0 Wn0 1tB0 Rb0 1tB0 WL0 1tB0 Rb0 1zd0 On0 1HB0 FX0 1C10 Lz0 1Ip0 HX0 1zd0 On0 1HB0 IL0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 Rb0 1zd0 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1C10 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 Rb0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1C10 Lz0 1C10 Lz0 1C10 Lz0 1C10 On0 1zd0 Rb0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0|20e6",
		"America/Scoresbysund|LMT CGT CGST EGST EGT|1r.Q 20 10 0 10|0121343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434|-2a5Ww.8 2z5ew.8 1a00 1cK0 1cL0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|452",
		"America/Sitka|PST PWT PPT PDT YST AKST AKDT|80 70 70 70 90 90 80|01203030303030303030303030303030345656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565|-17T20 8x10 iy0 Vo10 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 co0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|90e2",
		"America/St_Johns|NST NDT NST NDT NWT NPT NDDT|3u.Q 2u.Q 3u 2u 2u 2u 1u|01010101010101010101010101010101010102323232323232324523232323232323232323232323232323232323232323232323232323232323232323232323232323232326232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-28oit.8 14L0 1nB0 1in0 1gm0 Dz0 1JB0 1cL0 1cN0 1cL0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1fB0 1cL0 1cN0 1cL0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1fB0 1cL0 1fB0 19X0 1fB0 19X0 10O0 eKX.8 19X0 1iq0 WL0 1qN0 WL0 1qN0 WL0 1tB0 TX0 1tB0 WL0 1qN0 WL0 1qN0 7UHu itu 1tB0 WL0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1tB0 WL0 1ld0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14n1 1lb0 14p0 1nW0 11C0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zcX Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
		"America/Swift_Current|LMT MST MDT MWT MPT CST|7b.k 70 60 60 60 60|012134121212121212121215|-2AD4M.E uHdM.E 1in0 UGp0 8x20 ix0 1o10 17b0 1ip0 11z0 1o10 11z0 1o10 11z0 isN0 1cL0 3Cp0 1cL0 1cN0 11z0 1qN0 WL0 pMp0|16e3",
		"America/Tegucigalpa|LMT CST CDT|5M.Q 60 50|01212121|-1WGGb.8 2ETcb.8 WL0 1qN0 WL0 GRd0 AL0|11e5",
		"America/Thule|LMT AST ADT|4z.8 40 30|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2a5To.Q 31NBo.Q 1cL0 1cN0 1cL0 1fB0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|656",
		"America/Thunder_Bay|CST EST EWT EPT EDT|60 50 40 40 40|0123141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141|-2q5S0 1iaN0 8x40 iv0 XNB0 1cL0 1cN0 1fz0 1cN0 1cL0 3Cp0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
		"America/Vancouver|PST PDT PWT PPT|80 70 70 70|0102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-25TO0 1in0 UGp0 8x10 iy0 1o10 17b0 1ip0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
		"America/Whitehorse|YST YDT YWT YPT YDDT PST PDT|90 80 80 80 70 80 70|0101023040565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565|-25TN0 1in0 1o10 13V0 Ser0 8x00 iz0 LCL0 1fA0 3NA0 vrd0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e3",
		"America/Winnipeg|CST CDT CWT CPT|60 50 50 50|010101023010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aIi0 WL0 3ND0 1in0 Jap0 Rb0 aCN0 8x30 iw0 1tB0 11z0 1ip0 11z0 1o10 11z0 1o10 11z0 1rd0 10L0 1op0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 1cL0 1cN0 11z0 6i10 WL0 6i10 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1a00 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1a00 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 14o0 1lc0 14o0 1o00 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 14o0 1o00 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1o00 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 14o0 1o00 11A0 1o00 11A0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|66e4",
		"America/Yakutat|YST YWT YPT YDT AKST AKDT|90 80 80 80 90 80|01203030303030303030303030303030304545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-17T10 8x00 iz0 Vo10 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 cn0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|642",
		"America/Yellowknife|zzz MST MWT MPT MDDT MDT|0 70 60 60 50 60|012314151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151|-1pdA0 hix0 8x20 ix0 LCL0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|19e3",
		"Antarctica/Casey|zzz AWST CAST|0 -80 -b0|012121|-2q00 1DjS0 T90 40P0 KL0|10",
		"Antarctica/Davis|zzz DAVT DAVT|0 -70 -50|01012121|-vyo0 iXt0 alj0 1D7v0 VB0 3Wn0 KN0|70",
		"Antarctica/DumontDUrville|zzz PMT DDUT|0 -a0 -a0|0102|-U0o0 cfq0 bFm0|80",
		"Antarctica/Macquarie|AEST AEDT zzz MIST|-a0 -b0 0 -b0|0102010101010101010101010101010101010101010101010101010101010101010101010101010101010101013|-29E80 19X0 4SL0 1ayy0 Lvs0 1cM0 1o00 Rc0 1wo0 Rc0 1wo0 U00 1wo0 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 11A0 1qM0 WM0 1qM0 Oo0 1zc0 Oo0 1zc0 Oo0 1wo0 WM0 1tA0 WM0 1tA0 U00 1tA0 U00 1tA0 11A0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 11A0 1o00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1cM0 1cM0 1cM0|1",
		"Antarctica/Mawson|zzz MAWT MAWT|0 -60 -50|012|-CEo0 2fyk0|60",
		"Pacific/Auckland|NZMT NZST NZST NZDT|-bu -cu -c0 -d0|01020202020202020202020202023232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323|-1GCVu Lz0 1tB0 11zu 1o0u 11zu 1o0u 11zu 1o0u 14nu 1lcu 14nu 1lcu 1lbu 11Au 1nXu 11Au 1nXu 11Au 1nXu 11Au 1nXu 11Au 1qLu WMu 1qLu 11Au 1n1bu IM0 1C00 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1qM0 14o0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1io0 17c0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1io0 17c0 1io0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00|14e5",
		"Antarctica/Palmer|zzz ARST ART ART ARST CLT CLST|0 30 40 30 20 40 30|0121212121234356565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656|-cao0 nD0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 jsN0 14N0 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 1cL0 1cN0 11z0 1o10 11z0 1qN0 WL0 1fB0 19X0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1ip0 1fz0 1fB0 11z0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1o10 19X0 1fB0 1nX0 G10 1EL0 Op0 1zb0 Rd0 1wn0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Dd0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Dd0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Dd0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0|40",
		"Antarctica/Rothera|zzz ROTT|0 30|01|gOo0|130",
		"Antarctica/Syowa|zzz SYOT|0 -30|01|-vs00|20",
		"Antarctica/Troll|zzz UTC CEST|0 0 -20|01212121212121212121212121212121212121212121212121212121212121212121|1puo0 hd0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|40",
		"Antarctica/Vostok|zzz VOST|0 -60|01|-tjA0|25",
		"Europe/Oslo|CET CEST|-10 -20|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2awM0 Qm0 W6o0 5pf0 WM0 1fA0 1cM0 1cM0 1cM0 1cM0 wJc0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1qM0 WM0 zpc0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|62e4",
		"Asia/Riyadh|LMT AST|-36.Q -30|01|-TvD6.Q|57e5",
		"Asia/Almaty|LMT +05 +06 +07|-57.M -50 -60 -70|012323232323232323232321232323232323232323232323232|-1Pc57.M eUo7.M 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0|15e5",
		"Asia/Amman|LMT EET EEST|-2n.I -20 -30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1yW2n.I 1HiMn.I KL0 1oN0 11b0 1oN0 11b0 1pd0 1dz0 1cp0 11b0 1op0 11b0 fO10 1db0 1e10 1cL0 1cN0 1cL0 1cN0 1fz0 1pd0 10n0 1ld0 14n0 1hB0 15b0 1ip0 19X0 1cN0 1cL0 1cN0 17b0 1ld0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1So0 y00 1fc0 1dc0 1co0 1dc0 1cM0 1cM0 1cM0 1o00 11A0 1lc0 17c0 1cM0 1cM0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 4bX0 Dd0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0|25e5",
		"Asia/Anadyr|LMT ANAT ANAT ANAST ANAST ANAST ANAT|-bN.U -c0 -d0 -e0 -d0 -c0 -b0|01232414141414141414141561414141414141414141414141414141414141561|-1PcbN.U eUnN.U 23CL0 1db0 1cN0 1dc0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qN0 WM0|13e3",
		"Asia/Aqtau|LMT +04 +05 +06|-3l.4 -40 -50 -60|012323232323232323232123232312121212121212121212|-1Pc3l.4 eUnl.4 24PX0 2pX0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0|15e4",
		"Asia/Aqtobe|LMT +04 +05 +06|-3M.E -40 -50 -60|0123232323232323232321232323232323232323232323232|-1Pc3M.E eUnM.E 23CL0 3Db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0|27e4",
		"Asia/Ashgabat|LMT ASHT ASHT ASHST ASHST TMT TMT|-3R.w -40 -50 -60 -50 -40 -50|012323232323232323232324156|-1Pc3R.w eUnR.w 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 ba0 xC0|41e4",
		"Asia/Baghdad|BMT AST ADT|-2V.A -30 -40|012121212121212121212121212121212121212121212121212121|-26BeV.A 2ACnV.A 11b0 1cp0 1dz0 1dd0 1db0 1cN0 1cp0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1de0 1dc0 1dc0 1dc0 1cM0 1dc0 1cM0 1dc0 1cM0 1dc0 1dc0 1dc0 1cM0 1dc0 1cM0 1dc0 1cM0 1dc0 1dc0 1dc0 1cM0 1dc0 1cM0 1dc0 1cM0 1dc0 1dc0 1dc0 1cM0 1dc0 1cM0 1dc0 1cM0 1dc0|66e5",
		"Asia/Qatar|LMT GST AST|-3q.8 -40 -30|012|-21Jfq.8 27BXq.8|96e4",
		"Asia/Baku|LMT BAKT BAKT BAKST BAKST AZST AZT AZT AZST|-3j.o -30 -40 -50 -40 -40 -30 -40 -50|01232323232323232323232456578787878787878787878787878787878787878787|-1Pc3j.o 1jUoj.o WCL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 10K0 c30 1cM0 1cI0 8wu0 1o00 11z0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00|27e5",
		"Asia/Bangkok|BMT ICT|-6G.4 -70|01|-218SG.4|15e6",
		"Asia/Barnaul|LMT +06 +07 +08|-5z -60 -70 -80|0123232323232323232323212323232321212121212121212121212121212121212|-21S5z pCnz 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 p90 LE0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3rd0",
		"Asia/Beirut|EET EEST|-20 -30|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-21aq0 1on0 1410 1db0 19B0 1in0 1ip0 WL0 1lQp0 11b0 1oN0 11b0 1oN0 11b0 1pd0 11b0 1oN0 11b0 q6N0 En0 1oN0 11b0 1oN0 11b0 1oN0 11b0 1pd0 11b0 1oN0 11b0 1op0 11b0 dA10 17b0 1iN0 17b0 1iN0 17b0 1iN0 17b0 1vB0 SL0 1mp0 13z0 1iN0 17b0 1iN0 17b0 1jd0 12n0 1a10 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0|22e5",
		"Asia/Bishkek|LMT FRUT FRUT FRUST FRUST KGT KGST KGT|-4W.o -50 -60 -70 -60 -50 -60 -60|01232323232323232323232456565656565656565656565656567|-1Pc4W.o eUnW.o 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 11c0 1tX0 17b0 1ip0 17b0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1cPu 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 T8u|87e4",
		"Asia/Brunei|LMT BNT BNT|-7D.E -7u -80|012|-1KITD.E gDc9.E|42e4",
		"Asia/Kolkata|HMT BURT IST IST|-5R.k -6u -5u -6u|01232|-18LFR.k 1unn.k HB0 7zX0|15e6",
		"Asia/Chita|LMT YAKT YAKT YAKST YAKST YAKT IRKT|-7x.Q -80 -90 -a0 -90 -a0 -80|0123232323232323232323241232323232323232323232323232323232323232562|-21Q7x.Q pAnx.Q 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3re0|33e4",
		"Asia/Choibalsan|LMT ULAT ULAT CHOST CHOT CHOT CHOST|-7C -70 -80 -a0 -90 -80 -90|0123434343434343434343434343434343434343434343456565656565656565656565656565656565656565656565|-2APHC 2UkoC cKn0 1da0 1dd0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 6hD0 11z0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 3Db0 h1f0 1cJ0 1cP0 1cJ0 1cP0 1fx0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1fx0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1fx0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1fx0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0|38e3",
		"Asia/Shanghai|CST CDT|-80 -90|01010101010101010|-1c1I0 LX0 16p0 1jz0 1Myp0 Rb0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0|23e6",
		"Asia/Colombo|MMT IST IHST IST LKT LKT|-5j.w -5u -60 -6u -6u -60|01231451|-2zOtj.w 1rFbN.w 1zzu 7Apu 23dz0 11zu n3cu|22e5",
		"Asia/Dhaka|HMT BURT IST DACT BDT BDST|-5R.k -6u -5u -60 -60 -70|01213454|-18LFR.k 1unn.k HB0 m6n0 LqMu 1x6n0 1i00|16e6",
		"Asia/Damascus|LMT EET EEST|-2p.c -20 -30|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-21Jep.c Hep.c 17b0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1xRB0 11X0 1oN0 10L0 1pB0 11b0 1oN0 10L0 1mp0 13X0 1oN0 11b0 1pd0 11b0 1oN0 11b0 1oN0 11b0 1oN0 11b0 1pd0 11b0 1oN0 11b0 1oN0 11b0 1oN0 11b0 1pd0 11b0 1oN0 Nb0 1AN0 Nb0 bcp0 19X0 1gp0 19X0 3ld0 1xX0 Vd0 1Bz0 Sp0 1vX0 10p0 1dz0 1cN0 1cL0 1db0 1db0 1g10 1an0 1ap0 1db0 1fd0 1db0 1cN0 1db0 1dd0 1db0 1cp0 1dz0 1c10 1dX0 1cN0 1db0 1dd0 1db0 1cN0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1db0 1cN0 1db0 1cN0 19z0 1fB0 1qL0 11B0 1on0 Wp0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0|26e5",
		"Asia/Dili|LMT TLT JST TLT WITA|-8m.k -80 -90 -90 -80|012343|-2le8m.k 1dnXm.k 8HA0 1ew00 Xld0|19e4",
		"Asia/Dubai|LMT GST|-3F.c -40|01|-21JfF.c|39e5",
		"Asia/Dushanbe|LMT DUST DUST DUSST DUSST TJT|-4z.c -50 -60 -70 -60 -50|0123232323232323232323245|-1Pc4z.c eUnz.c 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 14N0|76e4",
		"Asia/Gaza|EET EET EEST IST IDT|-20 -30 -30 -20 -30|010101010102020202020202020202023434343434343434343434343430202020202020202020202020202020202020202020202020202020202020202020202020202020202020|-1c2q0 5Rb0 10r0 1px0 10N0 1pz0 16p0 1jB0 16p0 1jx0 pBd0 Vz0 1oN0 11b0 1oO0 10N0 1pz0 10N0 1pb0 10N0 1pb0 10N0 1pb0 10N0 1pz0 10N0 1pb0 10N0 1pb0 11d0 1oL0 dW0 hfB0 Db0 1fB0 Rb0 npB0 11z0 1C10 IL0 1s10 10n0 1o10 WL0 1zd0 On0 1ld0 11z0 1o10 14n0 1o10 14n0 1nd0 12n0 1nd0 Xz0 1q10 12n0 M10 C00 17c0 1io0 17c0 1io0 17c0 1o00 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 17c0 1io0 18N0 1bz0 19z0 1gp0 1610 1iL0 11z0 1o10 14o0 1lA1 SKX 1xd1 MKX 1AN0 1a00 1fA0 1cL0 1cN0 1nX0 1210 1nz0 1220 1ny0 1220 1qm0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1qm0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1qm0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1qm0 1220 1ny0 1220 1ny0 1220 1ny0|18e5",
		"Asia/Hebron|EET EET EEST IST IDT|-20 -30 -30 -20 -30|01010101010202020202020202020202343434343434343434343434343020202020202020202020202020202020202020202020202020202020202020202020202020202020202020|-1c2q0 5Rb0 10r0 1px0 10N0 1pz0 16p0 1jB0 16p0 1jx0 pBd0 Vz0 1oN0 11b0 1oO0 10N0 1pz0 10N0 1pb0 10N0 1pb0 10N0 1pb0 10N0 1pz0 10N0 1pb0 10N0 1pb0 11d0 1oL0 dW0 hfB0 Db0 1fB0 Rb0 npB0 11z0 1C10 IL0 1s10 10n0 1o10 WL0 1zd0 On0 1ld0 11z0 1o10 14n0 1o10 14n0 1nd0 12n0 1nd0 Xz0 1q10 12n0 M10 C00 17c0 1io0 17c0 1io0 17c0 1o00 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 17c0 1io0 18N0 1bz0 19z0 1gp0 1610 1iL0 12L0 1mN0 14o0 1lc0 Tb0 1xd1 MKX bB0 cn0 1cN0 1a00 1fA0 1cL0 1cN0 1nX0 1210 1nz0 1220 1ny0 1220 1qm0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1qm0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1qm0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1ny0 1220 1qm0 1220 1ny0 1220 1ny0 1220 1ny0|25e4",
		"Asia/Ho_Chi_Minh|LMT PLMT ICT IDT JST|-76.E -76.u -70 -80 -90|0123423232|-2yC76.E bK00.a 1h7b6.u 5lz0 18o0 3Oq0 k5b0 aW00 BAM0|90e5",
		"Asia/Hong_Kong|LMT HKT HKST JST|-7A.G -80 -90 -90|0121312121212121212121212121212121212121212121212121212121212121212121|-2CFHA.G 1sEP6.G 1cL0 ylu 93X0 1qQu 1tX0 Rd0 1In0 NB0 1cL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1kL0 14N0 1nX0 U10 1tz0 U10 1wn0 Rd0 1wn0 U10 1tz0 U10 1tz0 U10 1tz0 U10 1wn0 Rd0 1wn0 Rd0 1wn0 U10 1tz0 U10 1tz0 17d0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 s10 1Vz0 1cN0 1cL0 1cN0 1cL0 6fd0 14n0|73e5",
		"Asia/Hovd|LMT HOVT HOVT HOVST|-66.A -60 -70 -80|012323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-2APG6.A 2Uko6.A cKn0 1db0 1dd0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 6hD0 11z0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 kEp0 1cJ0 1cP0 1cJ0 1cP0 1fx0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1fx0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1fx0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1fx0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0|81e3",
		"Asia/Irkutsk|IMT IRKT IRKT IRKST IRKST IRKT|-6V.5 -70 -80 -90 -80 -90|012323232323232323232324123232323232323232323232323232323232323252|-21zGV.5 pjXV.5 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|60e4",
		"Europe/Istanbul|IMT EET EEST TRST TRT|-1U.U -20 -30 -40 -30|012121212121212121212121212121212121212121212121212121234343434342121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2ogNU.U dzzU.U 11b0 8tB0 1on0 1410 1db0 19B0 1in0 3Rd0 Un0 1oN0 11b0 zSp0 CL0 mN0 1Vz0 1gN0 1pz0 5Rd0 1fz0 1yp0 ML0 1kp0 17b0 1ip0 17b0 1fB0 19X0 1jB0 18L0 1ip0 17z0 qdd0 xX0 3S10 Tz0 dA10 11z0 1o10 11z0 1qN0 11z0 1ze0 11B0 WM0 1qO0 WI0 1nX0 1rB0 10L0 11B0 1in0 17d0 1in0 2pX0 19E0 1fU0 16Q0 1iI0 16Q0 1iI0 1Vd0 pb0 3Kp0 14o0 1df0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cL0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WO0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 Xc0 1qo0 WM0 1qM0 11A0 1o00 1200 1nA0 11A0 1tA0 U00 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|13e6",
		"Asia/Jakarta|BMT JAVT WIB JST WIB WIB|-77.c -7k -7u -90 -80 -70|01232425|-1Q0Tk luM0 mPzO 8vWu 6kpu 4PXu xhcu|31e6",
		"Asia/Jayapura|LMT WIT ACST|-9m.M -90 -9u|0121|-1uu9m.M sMMm.M L4nu|26e4",
		"Asia/Jerusalem|JMT IST IDT IDDT|-2k.E -20 -30 -40|01212121212132121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-26Bek.E SyMk.E 5Rb0 10r0 1px0 10N0 1pz0 16p0 1jB0 16p0 1jx0 3LB0 Em0 or0 1cn0 1dB0 16n0 10O0 1ja0 1tC0 14o0 1cM0 1a00 11A0 1Na0 An0 1MP0 AJ0 1Kp0 LC0 1oo0 Wl0 EQN0 Db0 1fB0 Rb0 npB0 11z0 1C10 IL0 1s10 10n0 1o10 WL0 1zd0 On0 1ld0 11z0 1o10 14n0 1o10 14n0 1nd0 12n0 1nd0 Xz0 1q10 12n0 1hB0 1dX0 1ep0 1aL0 1eN0 17X0 1nf0 11z0 1tB0 19W0 1e10 17b0 1ep0 1gL0 18N0 1fz0 1eN0 17b0 1gq0 1gn0 19d0 1dz0 1c10 17X0 1hB0 1gn0 19d0 1dz0 1c10 17X0 1kp0 1dz0 1c10 1aL0 1eN0 1oL0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0|81e4",
		"Asia/Kabul|AFT AFT|-40 -4u|01|-10Qs0|46e5",
		"Asia/Kamchatka|LMT PETT PETT PETST PETST|-ay.A -b0 -c0 -d0 -c0|01232323232323232323232412323232323232323232323232323232323232412|-1SLKy.A ivXy.A 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qN0 WM0|18e4",
		"Asia/Karachi|LMT IST IST KART PKT PKST|-4s.c -5u -6u -50 -50 -60|012134545454|-2xoss.c 1qOKW.c 7zX0 eup0 LqMu 1fy00 1cL0 dK10 11b0 1610 1jX0|24e6",
		"Asia/Urumqi|LMT XJT|-5O.k -60|01|-1GgtO.k|32e5",
		"Asia/Kathmandu|LMT IST NPT|-5F.g -5u -5J|012|-21JhF.g 2EGMb.g|12e5",
		"Asia/Khandyga|LMT YAKT YAKT YAKST YAKST VLAT VLAST VLAT YAKT|-92.d -80 -90 -a0 -90 -a0 -b0 -b0 -a0|01232323232323232323232412323232323232323232323232565656565656565782|-21Q92.d pAp2.d 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 qK0 yN0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 17V0 7zD0|66e2",
		"Asia/Krasnoyarsk|LMT KRAT KRAT KRAST KRAST KRAT|-6b.q -60 -70 -80 -70 -80|012323232323232323232324123232323232323232323232323232323232323252|-21Hib.q prAb.q 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|10e5",
		"Asia/Kuala_Lumpur|SMT MALT MALST MALT MALT JST MYT|-6T.p -70 -7k -7k -7u -90 -80|01234546|-2Bg6T.p 17anT.p 7hXE dM00 17bO 8Fyu 1so1u|71e5",
		"Asia/Kuching|LMT BORT BORT BORTST JST MYT|-7l.k -7u -80 -8k -90 -80|01232323232323232425|-1KITl.k gDbP.k 6ynu AnE 1O0k AnE 1NAk AnE 1NAk AnE 1NAk AnE 1O0k AnE 1NAk AnE pAk 8Fz0 1so10|13e4",
		"Asia/Macau|LMT MOT MOST CST|-7y.k -80 -90 -80|0121212121212121212121212121212121212121213|-2le7y.k 1XO34.k 1wn0 Rd0 1wn0 R9u 1wqu U10 1tz0 TVu 1tz0 17gu 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cJu 1cL0 1cN0 1fz0 1cN0 1cOu 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cJu 1cL0 1cN0 1fz0 1cN0 1cL0 KEp0|57e4",
		"Asia/Magadan|LMT MAGT MAGT MAGST MAGST MAGT|-a3.c -a0 -b0 -c0 -b0 -c0|0123232323232323232323241232323232323232323232323232323232323232512|-1Pca3.c eUo3.c 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3Cq0|95e3",
		"Asia/Makassar|LMT MMT WITA JST|-7V.A -7V.A -80 -90|01232|-21JjV.A vfc0 myLV.A 8ML0|15e5",
		"Asia/Manila|PHT PHST JST|-80 -90 -90|010201010|-1kJI0 AL0 cK10 65X0 mXB0 vX0 VK10 1db0|24e6",
		"Asia/Nicosia|LMT EET EEST|-2d.s -20 -30|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1Vc2d.s 2a3cd.s 1cL0 1qp0 Xz0 19B0 19X0 1fB0 1db0 1cp0 1cL0 1fB0 19X0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1o30 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|32e4",
		"Asia/Novokuznetsk|LMT KRAT KRAT KRAST KRAST NOVST NOVT NOVT|-5M.M -60 -70 -80 -70 -70 -60 -70|012323232323232323232324123232323232323232323232323232323232325672|-1PctM.M eULM.M 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qN0 WM0 8Hz0|55e4",
		"Asia/Novosibirsk|LMT NOVT NOVT NOVST NOVST|-5v.E -60 -70 -80 -70|0123232323232323232323241232341414141414141414141414141414141414121|-21Qnv.E pAFv.E 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 ml0 Os0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|15e5",
		"Asia/Omsk|LMT OMST OMST OMSST OMSST OMST|-4R.u -50 -60 -70 -60 -70|012323232323232323232324123232323232323232323232323232323232323252|-224sR.u pMLR.u 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|12e5",
		"Asia/Oral|LMT +04 +05 +06|-3p.o -40 -50 -60|01232323232323232121212121212121212121212121212|-1Pc3p.o eUnp.o 23CL0 3Db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1fA0 1cM0 1cM0 IM0 1EM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0|27e4",
		"Asia/Pontianak|LMT PMT WIB JST WIB WITA WIB|-7h.k -7h.k -7u -90 -80 -80 -70|012324256|-2ua7h.k XE00 munL.k 8Rau 6kpu 4PXu xhcu Wqnu|23e4",
		"Asia/Pyongyang|LMT KST JCST JST KST|-8n -8u -90 -90 -90|012341|-2um8n 97XR 12FXu jdA0 2Onc0|29e5",
		"Asia/Qyzylorda|LMT +04 +05 +06|-4l.Q -40 -50 -60|0123232323232323232323232323232323232323232323|-1Pc4l.Q eUol.Q 23CL0 3Db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 3ao0 1EM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0|73e4",
		"Asia/Rangoon|RMT BURT JST MMT|-6o.E -6u -90 -6u|0123|-21Jio.E SmnS.E 7j9u|48e5",
		"Asia/Sakhalin|LMT JCST JST SAKT SAKST SAKST SAKT|-9u.M -90 -90 -b0 -c0 -b0 -a0|01234343434343434343434356343434343435656565656565656565656565656363|-2AGVu.M 1iaMu.M je00 1qFa0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o10 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3rd0|58e4",
		"Asia/Samarkand|LMT SAMT SAMT SAMST TAST UZST UZT|-4r.R -40 -50 -60 -60 -60 -50|01234323232323232323232356|-1Pc4r.R eUor.R 23CL0 1db0 1cM0 1dc0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 11x0 bf0|36e4",
		"Asia/Seoul|LMT KST JCST JST KST KDT KDT|-8r.Q -8u -90 -90 -90 -9u -a0|01234151515151515146464|-2um8r.Q 97XV.Q 12FXu jjA0 kKo0 2I0u OL0 1FB0 Rb0 1qN0 TX0 1tB0 TX0 1tB0 TX0 1tB0 TX0 2ap0 12FBu 11A0 1o00 11A0|23e6",
		"Asia/Singapore|SMT MALT MALST MALT MALT JST SGT SGT|-6T.p -70 -7k -7k -7u -90 -7u -80|012345467|-2Bg6T.p 17anT.p 7hXE dM00 17bO 8Fyu Mspu DTA0|56e5",
		"Asia/Srednekolymsk|LMT MAGT MAGT MAGST MAGST MAGT SRET|-ae.Q -a0 -b0 -c0 -b0 -c0 -b0|012323232323232323232324123232323232323232323232323232323232323256|-1Pcae.Q eUoe.Q 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|35e2",
		"Asia/Taipei|JWST JST CST CDT|-80 -90 -80 -90|01232323232323232323232323232323232323232|-1iw80 joM0 1yo0 Tz0 1ip0 1jX0 1cN0 11b0 1oN0 11b0 1oN0 11b0 1oN0 11b0 10N0 1BX0 10p0 1pz0 10p0 1pz0 10p0 1db0 1dd0 1db0 1cN0 1db0 1cN0 1db0 1cN0 1db0 1BB0 ML0 1Bd0 ML0 uq10 1db0 1cN0 1db0 97B0 AL0|74e5",
		"Asia/Tashkent|LMT TAST TAST TASST TASST UZST UZT|-4B.b -50 -60 -70 -60 -60 -50|01232323232323232323232456|-1Pc4B.b eUnB.b 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 11y0 bf0|23e5",
		"Asia/Tbilisi|TBMT TBIT TBIT TBIST TBIST GEST GET GET GEST|-2X.b -30 -40 -50 -40 -40 -30 -40 -50|0123232323232323232323245656565787878787878787878567|-1Pc2X.b 1jUnX.b WCL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 3y0 19f0 1cK0 1cL0 1cN0 1cL0 1cN0 1cL0 1cM0 1cL0 1fB0 3Nz0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 An0 Os0 WM0|11e5",
		"Asia/Tehran|LMT TMT IRST IRST IRDT IRDT|-3p.I -3p.I -3u -40 -50 -4u|01234325252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252|-2btDp.I 1d3c0 1huLT.I TXu 1pz0 sN0 vAu 1cL0 1dB0 1en0 pNB0 UL0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 64p0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0|14e6",
		"Asia/Thimphu|LMT IST BTT|-5W.A -5u -60|012|-Su5W.A 1BGMs.A|79e3",
		"Asia/Tokyo|JCST JST JDT|-90 -90 -a0|0121212121|-1iw90 pKq0 QL0 1lB0 13X0 1zB0 NX0 1zB0 NX0|38e6",
		"Asia/Tomsk|LMT +06 +07 +08|-5D.P -60 -70 -80|0123232323232323232323212323232323232323232323212121212121212121212|-21NhD.P pxzD.P 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 co0 1bB0 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3Qp0|10e5",
		"Asia/Ulaanbaatar|LMT ULAT ULAT ULAST|-77.w -70 -80 -90|012323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-2APH7.w 2Uko7.w cKn0 1db0 1dd0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 6hD0 11z0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 kEp0 1cJ0 1cP0 1cJ0 1cP0 1fx0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1fx0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1fx0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1fx0 1cP0 1cJ0 1cP0 1cJ0 1cP0 1cJ0|12e5",
		"Asia/Ust-Nera|LMT YAKT YAKT MAGST MAGT MAGST MAGT MAGT VLAT VLAT|-9w.S -80 -90 -c0 -b0 -b0 -a0 -c0 -b0 -a0|0123434343434343434343456434343434343434343434343434343434343434789|-21Q9w.S pApw.S 23CL0 1d90 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 17V0 7zD0|65e2",
		"Asia/Vladivostok|LMT VLAT VLAT VLAST VLAST VLAT|-8L.v -90 -a0 -b0 -a0 -b0|012323232323232323232324123232323232323232323232323232323232323252|-1SJIL.v itXL.v 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|60e4",
		"Asia/Yakutsk|LMT YAKT YAKT YAKST YAKST YAKT|-8C.W -80 -90 -a0 -90 -a0|012323232323232323232324123232323232323232323232323232323232323252|-21Q8C.W pAoC.W 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|28e4",
		"Asia/Yekaterinburg|LMT PMT SVET SVET SVEST SVEST YEKT YEKST YEKT|-42.x -3J.5 -40 -50 -60 -50 -50 -60 -60|0123434343434343434343435267676767676767676767676767676767676767686|-2ag42.x 7mQh.s qBvJ.5 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|14e5",
		"Asia/Yerevan|LMT YERT YERT YERST YERST AMST AMT AMT AMST|-2W -30 -40 -50 -40 -40 -30 -40 -50|0123232323232323232323245656565657878787878787878787878787878787|-1Pc2W 1jUnW WCL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1am0 2r0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 3Fb0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0|13e5",
		"Atlantic/Azores|HMT AZOT AZOST AZOMT AZOT AZOST WET|1S.w 20 10 0 10 0 0|01212121212121212121212121212121212121212121232123212321232121212121212121212121212121212121212121454545454545454545454545454545456545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-2ldW5.s aPX5.s Sp0 LX0 1vc0 Tc0 1uM0 SM0 1vc0 Tc0 1vc0 SM0 1vc0 6600 1co0 3E00 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 3I00 17c0 1cM0 1cM0 3Fc0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Dc0 1tA0 1cM0 1dc0 1400 gL0 IM0 s10 U00 dX0 Rc0 pd0 Rc0 gL0 Oo0 pd0 Rc0 gL0 Oo0 pd0 14o0 1cM0 1cP0 1cM0 1cM0 1cM0 1cM0 1cM0 3Co0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 qIl0 1cM0 1fA0 1cM0 1cM0 1cN0 1cL0 1cN0 1cM0 1cM0 1cM0 1cM0 1cN0 1cL0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cL0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|25e4",
		"Atlantic/Bermuda|LMT AST ADT|4j.i 40 30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1BnRE.G 1LTbE.G 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|65e3",
		"Atlantic/Canary|LMT CANT WET WEST|11.A 10 0 -10|01232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-1UtaW.o XPAW.o 1lAK0 1a10 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|54e4",
		"Atlantic/Cape_Verde|LMT CVT CVST CVT|1y.4 20 10 10|01213|-2xomp.U 1qOMp.U 7zX0 1djf0|50e4",
		"Atlantic/Faroe|LMT WET WEST|r.4 0 -10|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2uSnw.U 2Wgow.U 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|49e3",
		"Atlantic/Madeira|FMT MADT MADST MADMT WET WEST|17.A 10 0 -10 0 -10|01212121212121212121212121212121212121212121232123212321232121212121212121212121212121212121212121454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-2ldWQ.o aPWQ.o Sp0 LX0 1vc0 Tc0 1uM0 SM0 1vc0 Tc0 1vc0 SM0 1vc0 6600 1co0 3E00 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 3I00 17c0 1cM0 1cM0 3Fc0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Dc0 1tA0 1cM0 1dc0 1400 gL0 IM0 s10 U00 dX0 Rc0 pd0 Rc0 gL0 Oo0 pd0 Rc0 gL0 Oo0 pd0 14o0 1cM0 1cP0 1cM0 1cM0 1cM0 1cM0 1cM0 3Co0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 qIl0 1cM0 1fA0 1cM0 1cM0 1cN0 1cL0 1cN0 1cM0 1cM0 1cM0 1cM0 1cN0 1cL0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|27e4",
		"Atlantic/Reykjavik|LMT IST ISST GMT|1s 10 0 0|012121212121212121212121212121212121212121212121212121212121212121213|-2uWmw mfaw 1Bd0 ML0 1LB0 Cn0 1LB0 3fX0 C10 HrX0 1cO0 LB0 1EL0 LA0 1C00 Oo0 1wo0 Rc0 1wo0 Rc0 1wo0 Rc0 1zc0 Oo0 1zc0 14o0 1lc0 14o0 1lc0 14o0 1o00 11A0 1lc0 14o0 1o00 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1o00 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1o00 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1o00 14o0|12e4",
		"Atlantic/South_Georgia|GST|20|0||30",
		"Atlantic/Stanley|SMT FKT FKST FKT FKST|3P.o 40 30 30 20|0121212121212134343212121212121212121212121212121212121212121212121212|-2kJw8.A 12bA8.A 19X0 1fB0 19X0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 Cn0 1Cc10 WL0 1qL0 U10 1tz0 U10 1qM0 WN0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1tz0 U10 1tz0 WN0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1tz0 WN0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qN0 U10 1wn0 Rd0 1wn0 U10 1tz0 U10 1tz0 U10 1tz0 U10 1tz0 U10 1wn0 U10 1tz0 U10 1tz0 U10|21e2",
		"Australia/Sydney|AEST AEDT|-a0 -b0|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-293lX xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 14o0 1o00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 U00 1qM0 WM0 1tA0 WM0 1tA0 U00 1tA0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 11A0 1o00 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 14o0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|40e5",
		"Australia/Adelaide|ACST ACDT|-9u -au|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-293lt xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 U00 1qM0 WM0 1tA0 WM0 1tA0 U00 1tA0 U00 1tA0 Oo0 1zc0 WM0 1qM0 Rc0 1zc0 U00 1tA0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 14o0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|11e5",
		"Australia/Brisbane|AEST AEDT|-a0 -b0|01010101010101010|-293lX xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 H1A0 Oo0 1zc0 Oo0 1zc0 Oo0|20e5",
		"Australia/Broken_Hill|ACST ACDT|-9u -au|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-293lt xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 14o0 1o00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 U00 1qM0 WM0 1tA0 WM0 1tA0 U00 1tA0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 14o0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|18e3",
		"Australia/Currie|AEST AEDT|-a0 -b0|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-29E80 19X0 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 11A0 1qM0 WM0 1qM0 Oo0 1zc0 Oo0 1zc0 Oo0 1wo0 WM0 1tA0 WM0 1tA0 U00 1tA0 U00 1tA0 11A0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 11A0 1o00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|746",
		"Australia/Darwin|ACST ACDT|-9u -au|010101010|-293lt xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0|12e4",
		"Australia/Eucla|ACWST ACWDT|-8J -9J|0101010101010101010|-293kI xcX 10jd0 yL0 1cN0 1cL0 1gSp0 Oo0 l5A0 Oo0 iJA0 G00 zU00 IM0 1qM0 11A0 1o00 11A0|368",
		"Australia/Hobart|AEST AEDT|-a0 -b0|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-29E80 19X0 10jd0 yL0 1cN0 1cL0 1fB0 19X0 VfB0 1cM0 1o00 Rc0 1wo0 Rc0 1wo0 U00 1wo0 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 11A0 1qM0 WM0 1qM0 Oo0 1zc0 Oo0 1zc0 Oo0 1wo0 WM0 1tA0 WM0 1tA0 U00 1tA0 U00 1tA0 11A0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 11A0 1o00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|21e4",
		"Australia/Lord_Howe|AEST LHST LHDT LHDT|-a0 -au -bu -b0|0121212121313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313|raC0 1zdu Rb0 1zd0 On0 1zd0 On0 1zd0 On0 1zd0 TXu 1qMu WLu 1tAu WLu 1tAu TXu 1tAu Onu 1zcu Onu 1zcu Onu 1zcu Rbu 1zcu Onu 1zcu Onu 1zcu 11zu 1o0u 11zu 1o0u 11zu 1o0u 11zu 1qMu WLu 11Au 1nXu 1qMu 11zu 1o0u 11zu 1o0u 11zu 1qMu WLu 1qMu 11zu 1o0u WLu 1qMu 14nu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1fzu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu|347",
		"Australia/Lindeman|AEST AEDT|-a0 -b0|010101010101010101010|-293lX xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 H1A0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0|10",
		"Australia/Melbourne|AEST AEDT|-a0 -b0|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-293lX xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 U00 1qM0 WM0 1qM0 11A0 1tA0 U00 1tA0 U00 1tA0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 11A0 1o00 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 14o0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|39e5",
		"Australia/Perth|AWST AWDT|-80 -90|0101010101010101010|-293jX xcX 10jd0 yL0 1cN0 1cL0 1gSp0 Oo0 l5A0 Oo0 iJA0 G00 zU00 IM0 1qM0 11A0 1o00 11A0|18e5",
		"CET|CET CEST|-10 -20|01010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1o00 11A0 Qrc0 6i00 WM0 1fA0 1cM0 1cM0 1cM0 16M0 1gMM0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00",
		"CST6CDT|CST CDT CWT CPT|60 50 50 50|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"Pacific/Easter|EMT EAST EASST EAST EASST|7h.s 70 60 60 50|0121212121212121212121212121234343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434|-1uSgG.w 1s4IG.w WL0 1zd0 On0 1ip0 11z0 1o10 11z0 1qN0 WL0 1ld0 14n0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 1cL0 1cN0 11z0 1o10 11z0 1qN0 WL0 1fB0 19X0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1ip0 1fz0 1fB0 11z0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1o10 19X0 1fB0 1nX0 G10 1EL0 Op0 1zb0 Rd0 1wn0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Dd0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Dd0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Dd0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0|30e2",
		"EET|EET EEST|-20 -30|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|hDB0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00",
		"EST|EST|50|0|",
		"EST5EDT|EST EDT EWT EPT|50 40 40 40|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261t0 1nX0 11B0 1nX0 SgN0 8x40 iv0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"Europe/Dublin|DMT IST GMT BST IST|p.l -y.D 0 -10 -10|01232323232324242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242|-2ax9y.D Rc0 1fzy.D 14M0 1fc0 1g00 1co0 1dc0 1co0 1oo0 1400 1dc0 19A0 1io0 1io0 WM0 1o00 14o0 1o00 17c0 1io0 17c0 1fA0 1a00 1lc0 17c0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1cM0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1a00 1io0 1qM0 Dc0 g5X0 14p0 1wn0 17d0 1io0 11A0 1o00 17c0 1fA0 1a00 1fA0 1cM0 1fA0 1a00 17c0 1fA0 1a00 1io0 17c0 1lc0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1a00 1a00 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1tA0 IM0 90o0 U00 1tA0 U00 1tA0 U00 1tA0 U00 1tA0 WM0 1qM0 WM0 1qM0 WM0 1tA0 U00 1tA0 U00 1tA0 11z0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 14o0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|12e5",
		"Etc/GMT+0|GMT|0|0|",
		"Etc/GMT+1|GMT+1|10|0|",
		"Etc/GMT+10|GMT+10|a0|0|",
		"Etc/GMT+11|GMT+11|b0|0|",
		"Etc/GMT+12|GMT+12|c0|0|",
		"Etc/GMT+2|GMT+2|20|0|",
		"Etc/GMT+3|GMT+3|30|0|",
		"Etc/GMT+4|GMT+4|40|0|",
		"Etc/GMT+5|GMT+5|50|0|",
		"Etc/GMT+6|GMT+6|60|0|",
		"Etc/GMT+7|GMT+7|70|0|",
		"Etc/GMT+8|GMT+8|80|0|",
		"Etc/GMT+9|GMT+9|90|0|",
		"Etc/GMT-1|GMT-1|-10|0|",
		"Etc/GMT-10|GMT-10|-a0|0|",
		"Etc/GMT-11|GMT-11|-b0|0|",
		"Etc/GMT-12|GMT-12|-c0|0|",
		"Etc/GMT-13|GMT-13|-d0|0|",
		"Etc/GMT-14|GMT-14|-e0|0|",
		"Etc/GMT-2|GMT-2|-20|0|",
		"Etc/GMT-3|GMT-3|-30|0|",
		"Etc/GMT-4|GMT-4|-40|0|",
		"Etc/GMT-5|GMT-5|-50|0|",
		"Etc/GMT-6|GMT-6|-60|0|",
		"Etc/GMT-7|GMT-7|-70|0|",
		"Etc/GMT-8|GMT-8|-80|0|",
		"Etc/GMT-9|GMT-9|-90|0|",
		"Etc/UCT|UCT|0|0|",
		"Etc/UTC|UTC|0|0|",
		"Europe/Amsterdam|AMT NST NEST NET CEST CET|-j.w -1j.w -1k -k -20 -10|010101010101010101010101010101010101010101012323234545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545|-2aFcj.w 11b0 1iP0 11A0 1io0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1co0 1io0 1yo0 Pc0 1a00 1fA0 1Bc0 Mo0 1tc0 Uo0 1tA0 U00 1uo0 W00 1s00 VA0 1so0 Vc0 1sM0 UM0 1wo0 Rc0 1u00 Wo0 1rA0 W00 1s00 VA0 1sM0 UM0 1w00 fV0 BCX.w 1tA0 U00 1u00 Wo0 1sm0 601k WM0 1fA0 1cM0 1cM0 1cM0 16M0 1gMM0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|16e5",
		"Europe/Andorra|WET CET CEST|0 -10 -20|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-UBA0 1xIN0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|79e3",
		"Europe/Astrakhan|LMT +03 +04 +05|-3c.c -30 -40 -50|012323232323232323212121212121212121212121212121212121212121212|-1Pcrc.c eUMc.c 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1fA0 1cM0 3Co0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3rd0",
		"Europe/Athens|AMT EET EEST CEST CET|-1y.Q -20 -30 -20 -10|012123434121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2a61x.Q CNbx.Q mn0 kU10 9b0 3Es0 Xa0 1fb0 1dd0 k3X0 Nz0 SCp0 1vc0 SO0 1cM0 1a00 1ao0 1fc0 1a10 1fG0 1cg0 1dX0 1bX0 1cQ0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|35e5",
		"Europe/London|GMT BST BDST|0 -10 -20|0101010101010101010101010101010101010101010101010121212121210101210101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2axa0 Rc0 1fA0 14M0 1fc0 1g00 1co0 1dc0 1co0 1oo0 1400 1dc0 19A0 1io0 1io0 WM0 1o00 14o0 1o00 17c0 1io0 17c0 1fA0 1a00 1lc0 17c0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1cM0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1a00 1io0 1qM0 Dc0 2Rz0 Dc0 1zc0 Oo0 1zc0 Rc0 1wo0 17c0 1iM0 FA0 xB0 1fA0 1a00 14o0 bb0 LA0 xB0 Rc0 1wo0 11A0 1o00 17c0 1fA0 1a00 1fA0 1cM0 1fA0 1a00 17c0 1fA0 1a00 1io0 17c0 1lc0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1a00 1a00 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1tA0 IM0 90o0 U00 1tA0 U00 1tA0 U00 1tA0 U00 1tA0 WM0 1qM0 WM0 1qM0 WM0 1tA0 U00 1tA0 U00 1tA0 11z0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 14o0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|10e6",
		"Europe/Belgrade|CET CEST|-10 -20|01010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-19RC0 3IP0 WM0 1fA0 1cM0 1cM0 1rc0 Qo0 1vmo0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|12e5",
		"Europe/Berlin|CET CEST CEMT|-10 -20 -30|01010101010101210101210101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1o00 11A0 Qrc0 6i00 WM0 1fA0 1cM0 1cM0 1cM0 kL0 Nc0 m10 WM0 1ao0 1cp0 dX0 jz0 Dd0 1io0 17c0 1fA0 1a00 1ehA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|41e5",
		"Europe/Prague|CET CEST|-10 -20|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1o00 11A0 Qrc0 6i00 WM0 1fA0 1cM0 16M0 1lc0 1tA0 17A0 11c0 1io0 17c0 1io0 17c0 1fc0 1ao0 1bNc0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|13e5",
		"Europe/Brussels|WET CET CEST WEST|0 -10 -20 -10|0121212103030303030303030303030303030303030303030303212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2ehc0 3zX0 11c0 1iO0 11A0 1o00 11A0 my0 Ic0 1qM0 Rc0 1EM0 UM0 1u00 10o0 1io0 1io0 17c0 1a00 1fA0 1cM0 1cM0 1io0 17c0 1fA0 1a00 1io0 1a30 1io0 17c0 1fA0 1a00 1io0 17c0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Dc0 y00 5Wn0 WM0 1fA0 1cM0 16M0 1iM0 16M0 1C00 Uo0 1eeo0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|21e5",
		"Europe/Bucharest|BMT EET EEST|-1I.o -20 -30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1xApI.o 20LI.o RA0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1Axc0 On0 1fA0 1a10 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cK0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cL0 1cN0 1cL0 1fB0 1nX0 11E0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|19e5",
		"Europe/Budapest|CET CEST|-10 -20|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1ip0 17b0 1op0 1tb0 Q2m0 3Ne0 WM0 1fA0 1cM0 1cM0 1oJ0 1dc0 1030 1fA0 1cM0 1cM0 1cM0 1cM0 1fA0 1a00 1iM0 1fA0 8Ha0 Rb0 1wN0 Rb0 1BB0 Lz0 1C20 LB0 SNX0 1a10 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|17e5",
		"Europe/Zurich|CET CEST|-10 -20|01010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-19Lc0 11A0 1o00 11A0 1xG10 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|38e4",
		"Europe/Chisinau|CMT BMT EET EEST CEST CET MSK MSD|-1T -1I.o -20 -30 -20 -10 -30 -40|012323232323232323234545467676767676767676767323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-26jdT wGMa.A 20LI.o RA0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 27A0 2en0 39g0 WM0 1fA0 1cM0 V90 1t7z0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 gL0 WO0 1cM0 1cM0 1cK0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1nX0 11D0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|67e4",
		"Europe/Copenhagen|CET CEST|-10 -20|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2azC0 Tz0 VuO0 60q0 WM0 1fA0 1cM0 1cM0 1cM0 S00 1HA0 Nc0 1C00 Dc0 1Nc0 Ao0 1h5A0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|12e5",
		"Europe/Gibraltar|GMT BST BDST CET CEST|0 -10 -20 -10 -20|010101010101010101010101010101010101010101010101012121212121010121010101010101010101034343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343|-2axa0 Rc0 1fA0 14M0 1fc0 1g00 1co0 1dc0 1co0 1oo0 1400 1dc0 19A0 1io0 1io0 WM0 1o00 14o0 1o00 17c0 1io0 17c0 1fA0 1a00 1lc0 17c0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1cM0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1a00 1io0 1qM0 Dc0 2Rz0 Dc0 1zc0 Oo0 1zc0 Rc0 1wo0 17c0 1iM0 FA0 xB0 1fA0 1a00 14o0 bb0 LA0 xB0 Rc0 1wo0 11A0 1o00 17c0 1fA0 1a00 1fA0 1cM0 1fA0 1a00 17c0 1fA0 1a00 1io0 17c0 1lc0 17c0 1fA0 10Jz0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|30e3",
		"Europe/Helsinki|HMT EET EEST|-1D.N -20 -30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1WuND.N OULD.N 1dA0 1xGq0 1cM0 1cM0 1cM0 1cN0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|12e5",
		"Europe/Kaliningrad|CET CEST CET CEST MSK MSD EEST EET FET|-10 -20 -20 -30 -30 -40 -30 -20 -30|0101010101010232454545454545454546767676767676767676767676767676767676767676787|-2aFe0 11d0 1iO0 11A0 1o00 11A0 Qrc0 6i00 WM0 1fA0 1cM0 1cM0 Am0 Lb0 1en0 op0 1pNz0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|44e4",
		"Europe/Kiev|KMT EET MSK CEST CET MSD EEST|-22.4 -20 -30 -20 -10 -40 -30|0123434252525252525252525256161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161|-1Pc22.4 eUo2.4 rnz0 2Hg0 WM0 1fA0 da0 1v4m0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 Db0 3220 1cK0 1cL0 1cN0 1cL0 1cN0 1cL0 1cQ0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|34e5",
		"Europe/Kirov|LMT +03 +04 +05|-3i.M -30 -40 -50|01232323232323232321212121212121212121212121212121212121212121|-22WNi.M qHai.M 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1fA0 1cM0 3Co0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|48e4",
		"Europe/Lisbon|LMT WET WEST WEMT CET CEST|A.J 0 -10 -20 -10 -20|012121212121212121212121212121212121212121212321232123212321212121212121212121212121212121212121214121212121212121212121212121212124545454212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2ldXn.f aPWn.f Sp0 LX0 1vc0 Tc0 1uM0 SM0 1vc0 Tc0 1vc0 SM0 1vc0 6600 1co0 3E00 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 3I00 17c0 1cM0 1cM0 3Fc0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Dc0 1tA0 1cM0 1dc0 1400 gL0 IM0 s10 U00 dX0 Rc0 pd0 Rc0 gL0 Oo0 pd0 Rc0 gL0 Oo0 pd0 14o0 1cM0 1cP0 1cM0 1cM0 1cM0 1cM0 1cM0 3Co0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 pvy0 1cM0 1cM0 1fA0 1cM0 1cM0 1cN0 1cL0 1cN0 1cM0 1cM0 1cM0 1cM0 1cN0 1cL0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|27e5",
		"Europe/Luxembourg|LMT CET CEST WET WEST WEST WET|-o.A -10 -20 0 -10 -20 -10|0121212134343434343434343434343434343434343434343434565651212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2DG0o.A t6mo.A TB0 1nX0 Up0 1o20 11A0 rW0 CM0 1qP0 R90 1EO0 UK0 1u20 10m0 1ip0 1in0 17e0 19W0 1fB0 1db0 1cp0 1in0 17d0 1fz0 1a10 1in0 1a10 1in0 17f0 1fA0 1a00 1io0 17c0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Dc0 vA0 60L0 WM0 1fA0 1cM0 17c0 1io0 16M0 1C00 Uo0 1eeo0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|54e4",
		"Europe/Madrid|WET WEST WEMT CET CEST|0 -10 -20 -10 -20|01010101010101010101010121212121234343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343|-28dd0 11A0 1go0 19A0 1co0 1dA0 b1A0 18o0 3I00 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 iyo0 Rc0 18o0 1hc0 1io0 1a00 14o0 5aL0 MM0 1vc0 17A0 1i00 1bc0 1eo0 17d0 1in0 17A0 6hA0 10N0 XIL0 1a10 1in0 17d0 19X0 1cN0 1fz0 1a10 1fX0 1cp0 1cO0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|62e5",
		"Europe/Malta|CET CEST|-10 -20|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2as10 M00 1cM0 1cM0 14o0 1o00 WM0 1qM0 17c0 1cM0 M3A0 5M20 WM0 1fA0 1cM0 1cM0 1cM0 16m0 1de0 1lc0 14m0 1lc0 WO0 1qM0 GTW0 On0 1C10 Lz0 1C10 Lz0 1EN0 Lz0 1C10 Lz0 1zd0 Oo0 1C00 On0 1cp0 1cM0 1lA0 Xc0 1qq0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1iN0 19z0 1fB0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|42e4",
		"Europe/Minsk|MMT EET MSK CEST CET MSD EEST FET|-1O -20 -30 -20 -10 -40 -30 -30|012343432525252525252525252616161616161616161616161616161616161616172|-1Pc1O eUnO qNX0 3gQ0 WM0 1fA0 1cM0 Al0 1tsn0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 3Fc0 1cN0 1cK0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hy0|19e5",
		"Europe/Monaco|PMT WET WEST WEMT CET CEST|-9.l 0 -10 -20 -10 -20|01212121212121212121212121212121212121212121212121232323232345454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-2nco9.l cNb9.l HA0 19A0 1iM0 11c0 1oo0 Wo0 1rc0 QM0 1EM0 UM0 1u00 10o0 1io0 1wo0 Rc0 1a00 1fA0 1cM0 1cM0 1io0 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 1fA0 1a00 1io0 17c0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Df0 2RV0 11z0 11B0 1ze0 WM0 1fA0 1cM0 1fa0 1aq0 16M0 1ekn0 1cL0 1fC0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|38e3",
		"Europe/Moscow|MMT MMT MST MDST MSD MSK MSM EET EEST MSK|-2u.h -2v.j -3v.j -4v.j -40 -30 -50 -20 -30 -40|012132345464575454545454545454545458754545454545454545454545454545454545454595|-2ag2u.h 2pyW.W 1bA0 11X0 GN0 1Hb0 c20 imv.j 3DA0 dz0 15A0 c10 2q10 iM10 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|16e6",
		"Europe/Paris|PMT WET WEST CEST CET WEMT|-9.l 0 -10 -20 -10 -20|0121212121212121212121212121212121212121212121212123434352543434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434|-2nco8.l cNb8.l HA0 19A0 1iM0 11c0 1oo0 Wo0 1rc0 QM0 1EM0 UM0 1u00 10o0 1io0 1wo0 Rc0 1a00 1fA0 1cM0 1cM0 1io0 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 1fA0 1a00 1io0 17c0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Df0 Ik0 5M30 WM0 1fA0 1cM0 Vx0 hB0 1aq0 16M0 1ekn0 1cL0 1fC0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|11e6",
		"Europe/Riga|RMT LST EET MSK CEST CET MSD EEST|-1A.y -2A.y -20 -30 -20 -10 -40 -30|010102345454536363636363636363727272727272727272727272727272727272727272727272727272727272727272727272727272727272727272727272|-25TzA.y 11A0 1iM0 ko0 gWm0 yDXA.y 2bX0 3fE0 WM0 1fA0 1cM0 1cM0 4m0 1sLy0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 1o00 11A0 1o00 11A0 1qM0 3oo0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|64e4",
		"Europe/Rome|CET CEST|-10 -20|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2as10 M00 1cM0 1cM0 14o0 1o00 WM0 1qM0 17c0 1cM0 M3A0 5M20 WM0 1fA0 1cM0 16K0 1iO0 16m0 1de0 1lc0 14m0 1lc0 WO0 1qM0 GTW0 On0 1C10 Lz0 1C10 Lz0 1EN0 Lz0 1C10 Lz0 1zd0 Oo0 1C00 On0 1C10 Lz0 1zd0 On0 1C10 LA0 1C00 LA0 1zc0 Oo0 1C00 Oo0 1zc0 Oo0 1fC0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|39e5",
		"Europe/Samara|LMT SAMT SAMT KUYT KUYST MSD MSK EEST SAMST SAMST|-3k.k -30 -40 -40 -50 -40 -30 -30 -50 -40|012343434343434343435656712828282828282828282828282828282828282912|-22WNk.k qHak.k bcn0 1Qqo0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1cM0 1cN0 8o0 14m0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qN0 WM0|12e5",
		"Europe/Simferopol|SMT EET MSK CEST CET MSD EEST MSK|-2g -20 -30 -20 -10 -40 -30 -40|012343432525252525252525252161616525252616161616161616161616161616161616172|-1Pc2g eUog rEn0 2qs0 WM0 1fA0 1cM0 3V0 1u0L0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1Q00 4eL0 1cL0 1cN0 1cL0 1cN0 dX0 WL0 1cN0 1cL0 1fB0 1o30 11B0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11z0 1nW0|33e4",
		"Europe/Sofia|EET CET CEST EEST|-20 -10 -20 -30|01212103030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030|-168L0 WM0 1fA0 1cM0 1cM0 1cN0 1mKH0 1dd0 1fb0 1ap0 1fb0 1a20 1fy0 1a30 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cK0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1nX0 11E0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|12e5",
		"Europe/Stockholm|CET CEST|-10 -20|01010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2azC0 TB0 2yDe0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|15e5",
		"Europe/Tallinn|TMT CET CEST EET MSK MSD EEST|-1D -10 -20 -20 -30 -40 -30|012103421212454545454545454546363636363636363636363636363636363636363636363636363636363636363636363636363636363636363636363|-26oND teD 11A0 1Ta0 4rXl KSLD 2FX0 2Jg0 WM0 1fA0 1cM0 18J0 1sTX0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o10 11A0 1qM0 5QM0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|41e4",
		"Europe/Tirane|LMT CET CEST|-1j.k -10 -20|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2glBj.k 14pcj.k 5LC0 WM0 4M0 1fCK0 10n0 1op0 11z0 1pd0 11z0 1qN0 WL0 1qp0 Xb0 1qp0 Xb0 1qp0 11z0 1lB0 11z0 1qN0 11z0 1iN0 16n0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|42e4",
		"Europe/Ulyanovsk|LMT +03 +04 +05 +02|-3d.A -30 -40 -50 -20|01232323232323232321214121212121212121212121212121212121212121212|-22WNd.A qHad.A 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3rd0",
		"Europe/Uzhgorod|CET CEST MSK MSD EET EEST|-10 -20 -30 -40 -20 -30|010101023232323232323232320454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-1cqL0 6i00 WM0 1fA0 1cM0 1ml0 1Cp0 1r3W0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1Q00 1Nf0 2pw0 1cL0 1cN0 1cL0 1cN0 1cL0 1cQ0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|11e4",
		"Europe/Vienna|CET CEST|-10 -20|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1o00 11A0 3KM0 14o0 LA00 6i00 WM0 1fA0 1cM0 1cM0 1cM0 400 2qM0 1a00 1cM0 1cM0 1io0 17c0 1gHa0 19X0 1cP0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|18e5",
		"Europe/Vilnius|WMT KMT CET EET MSK CEST MSD EEST|-1o -1z.A -10 -20 -30 -20 -40 -30|012324525254646464646464646473737373737373737352537373737373737373737373737373737373737373737373737373737373737373737373|-293do 6ILM.o 1Ooz.A zz0 Mfd0 29W0 3is0 WM0 1fA0 1cM0 LV0 1tgL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11B0 1o00 11A0 1qM0 8io0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|54e4",
		"Europe/Volgograd|LMT TSAT STAT STAT VOLT VOLST VOLST VOLT MSD MSK MSK|-2V.E -30 -30 -40 -40 -50 -40 -30 -40 -30 -40|0123454545454545454676767489898989898989898989898989898989898989a9|-21IqV.E cLXV.E cEM0 1gqn0 Lco0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1cM0 1cM0 1fA0 1cM0 2pz0 1cN0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|10e5",
		"Europe/Warsaw|WMT CET CEST EET EEST|-1o -10 -20 -20 -30|012121234312121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2ctdo 1LXo 11d0 1iO0 11A0 1o00 11A0 1on0 11A0 6zy0 HWP0 5IM0 WM0 1fA0 1cM0 1dz0 1mL0 1en0 15B0 1aq0 1nA0 11A0 1io0 17c0 1fA0 1a00 iDX0 LA0 1cM0 1cM0 1C00 Oo0 1cM0 1cM0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1C00 LA0 uso0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|17e5",
		"Europe/Zaporozhye|CUT EET MSK CEST CET MSD EEST|-2k -20 -30 -20 -10 -40 -30|01234342525252525252525252526161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161|-1Pc2k eUok rdb0 2RE0 WM0 1fA0 8m0 1v9a0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cK0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cQ0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|77e4",
		"HST|HST|a0|0|",
		"Indian/Chagos|LMT IOT IOT|-4N.E -50 -60|012|-2xosN.E 3AGLN.E|30e2",
		"Indian/Christmas|CXT|-70|0||21e2",
		"Indian/Cocos|CCT|-6u|0||596",
		"Indian/Kerguelen|zzz TFT|0 -50|01|-MG00|130",
		"Indian/Mahe|LMT SCT|-3F.M -40|01|-2yO3F.M|79e3",
		"Indian/Maldives|MMT MVT|-4S -50|01|-olgS|35e4",
		"Indian/Mauritius|LMT MUT MUST|-3O -40 -50|012121|-2xorO 34unO 14L0 12kr0 11z0|15e4",
		"Indian/Reunion|LMT RET|-3F.Q -40|01|-2mDDF.Q|84e4",
		"Pacific/Kwajalein|MHT KWAT MHT|-b0 c0 -c0|012|-AX0 W9X0|14e3",
		"MET|MET MEST|-10 -20|01010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1o00 11A0 Qrc0 6i00 WM0 1fA0 1cM0 1cM0 1cM0 16M0 1gMM0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00",
		"MST|MST|70|0|",
		"MST7MDT|MST MDT MWT MPT|70 60 60 60|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261r0 1nX0 11B0 1nX0 SgN0 8x20 ix0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"Pacific/Chatham|CHAST CHAST CHADT|-cf -cJ -dJ|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212|-WqAf 1adef IM0 1C00 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1qM0 14o0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1io0 17c0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1io0 17c0 1io0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00|600",
		"PST8PDT|PST PDT PWT PPT|80 70 70 70|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261q0 1nX0 11B0 1nX0 SgN0 8x10 iy0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"Pacific/Apia|LMT WSST SST SDT WSDT WSST|bq.U bu b0 a0 -e0 -d0|01232345454545454545454545454545454545454545454545454545454|-2nDMx.4 1yW03.4 2rRbu 1ff0 1a00 CI0 AQ0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00|37e3",
		"Pacific/Bougainville|PGT JST BST|-a0 -90 -b0|0102|-16Wy0 7CN0 2MQp0|18e4",
		"Pacific/Chuuk|CHUT|-a0|0||49e3",
		"Pacific/Efate|LMT VUT VUST|-bd.g -b0 -c0|0121212121212121212121|-2l9nd.g 2Szcd.g 1cL0 1oN0 10L0 1fB0 19X0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 Lz0 1Nd0 An0|66e3",
		"Pacific/Enderbury|PHOT PHOT PHOT|c0 b0 -d0|012|nIc0 B8n0|1",
		"Pacific/Fakaofo|TKT TKT|b0 -d0|01|1Gfn0|483",
		"Pacific/Fiji|LMT FJT FJST|-bT.I -c0 -d0|0121212121212121212121212121212121212121212121212121212121212121|-2bUzT.I 3m8NT.I LA0 1EM0 IM0 nJc0 LA0 1o00 Rc0 1wo0 Ao0 1Nc0 Ao0 1Q00 xz0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 uM0 1SM0 uM0 1SM0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1SM0 uM0 1SM0 uM0 1VA0 s00 1VA0 uM0 1SM0 uM0 1SM0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1SM0 uM0 1SM0 uM0|88e4",
		"Pacific/Funafuti|TVT|-c0|0||45e2",
		"Pacific/Galapagos|LMT ECT GALT|5W.o 50 60|012|-1yVS1.A 2dTz1.A|25e3",
		"Pacific/Gambier|LMT GAMT|8X.M 90|01|-2jof0.c|125",
		"Pacific/Guadalcanal|LMT SBT|-aD.M -b0|01|-2joyD.M|11e4",
		"Pacific/Guam|GST ChST|-a0 -a0|01|1fpq0|17e4",
		"Pacific/Honolulu|HST HDT HST|au 9u a0|010102|-1thLu 8x0 lef0 8Pz0 46p0|37e4",
		"Pacific/Kiritimati|LINT LINT LINT|aE a0 -e0|012|nIaE B8nk|51e2",
		"Pacific/Kosrae|KOST KOST|-b0 -c0|010|-AX0 1bdz0|66e2",
		"Pacific/Majuro|MHT MHT|-b0 -c0|01|-AX0|28e3",
		"Pacific/Marquesas|LMT MART|9i 9u|01|-2joeG|86e2",
		"Pacific/Pago_Pago|LMT NST BST SST|bm.M b0 b0 b0|0123|-2nDMB.c 2gVzB.c EyM0|37e2",
		"Pacific/Nauru|LMT NRT JST NRT|-b7.E -bu -90 -c0|01213|-1Xdn7.E PvzB.E 5RCu 1ouJu|10e3",
		"Pacific/Niue|NUT NUT NUT|bk bu b0|012|-KfME 17y0a|12e2",
		"Pacific/Norfolk|NMT NFT NFST NFT|-bc -bu -cu -b0|01213|-Kgbc W01G On0 1COp0|25e4",
		"Pacific/Noumea|LMT NCT NCST|-b5.M -b0 -c0|01212121|-2l9n5.M 2EqM5.M xX0 1PB0 yn0 HeP0 Ao0|98e3",
		"Pacific/Palau|PWT|-90|0||21e3",
		"Pacific/Pitcairn|PNT PST|8u 80|01|18Vku|56",
		"Pacific/Pohnpei|PONT|-b0|0||34e3",
		"Pacific/Port_Moresby|PGT|-a0|0||25e4",
		"Pacific/Rarotonga|CKT CKHST CKT|au 9u a0|012121212121212121212121212|lyWu IL0 1zcu Onu 1zcu Onu 1zcu Rbu 1zcu Onu 1zcu Onu 1zcu Onu 1zcu Onu 1zcu Onu 1zcu Rbu 1zcu Onu 1zcu Onu 1zcu Onu|13e3",
		"Pacific/Tahiti|LMT TAHT|9W.g a0|01|-2joe1.I|18e4",
		"Pacific/Tarawa|GILT|-c0|0||29e3",
		"Pacific/Tongatapu|TOT TOT TOST|-ck -d0 -e0|01212121|-1aB0k 2n5dk 15A0 1wo0 xz0 1Q10 xz0|75e3",
		"Pacific/Wake|WAKT|-c0|0||16e3",
		"Pacific/Wallis|WFT|-c0|0||94",
		"WET|WET WEST|0 -10|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|hDB0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00"
	],
	"links": [
		"Africa/Abidjan|Africa/Bamako",
		"Africa/Abidjan|Africa/Banjul",
		"Africa/Abidjan|Africa/Conakry",
		"Africa/Abidjan|Africa/Dakar",
		"Africa/Abidjan|Africa/Freetown",
		"Africa/Abidjan|Africa/Lome",
		"Africa/Abidjan|Africa/Nouakchott",
		"Africa/Abidjan|Africa/Ouagadougou",
		"Africa/Abidjan|Africa/Sao_Tome",
		"Africa/Abidjan|Africa/Timbuktu",
		"Africa/Abidjan|Atlantic/St_Helena",
		"Africa/Cairo|Egypt",
		"Africa/Johannesburg|Africa/Maseru",
		"Africa/Johannesburg|Africa/Mbabane",
		"Africa/Khartoum|Africa/Juba",
		"Africa/Lagos|Africa/Bangui",
		"Africa/Lagos|Africa/Brazzaville",
		"Africa/Lagos|Africa/Douala",
		"Africa/Lagos|Africa/Kinshasa",
		"Africa/Lagos|Africa/Libreville",
		"Africa/Lagos|Africa/Luanda",
		"Africa/Lagos|Africa/Malabo",
		"Africa/Lagos|Africa/Niamey",
		"Africa/Lagos|Africa/Porto-Novo",
		"Africa/Maputo|Africa/Blantyre",
		"Africa/Maputo|Africa/Bujumbura",
		"Africa/Maputo|Africa/Gaborone",
		"Africa/Maputo|Africa/Harare",
		"Africa/Maputo|Africa/Kigali",
		"Africa/Maputo|Africa/Lubumbashi",
		"Africa/Maputo|Africa/Lusaka",
		"Africa/Nairobi|Africa/Addis_Ababa",
		"Africa/Nairobi|Africa/Asmara",
		"Africa/Nairobi|Africa/Asmera",
		"Africa/Nairobi|Africa/Dar_es_Salaam",
		"Africa/Nairobi|Africa/Djibouti",
		"Africa/Nairobi|Africa/Kampala",
		"Africa/Nairobi|Africa/Mogadishu",
		"Africa/Nairobi|Indian/Antananarivo",
		"Africa/Nairobi|Indian/Comoro",
		"Africa/Nairobi|Indian/Mayotte",
		"Africa/Tripoli|Libya",
		"America/Adak|America/Atka",
		"America/Adak|US/Aleutian",
		"America/Anchorage|US/Alaska",
		"America/Argentina/Buenos_Aires|America/Buenos_Aires",
		"America/Argentina/Catamarca|America/Argentina/ComodRivadavia",
		"America/Argentina/Catamarca|America/Catamarca",
		"America/Argentina/Cordoba|America/Cordoba",
		"America/Argentina/Cordoba|America/Rosario",
		"America/Argentina/Jujuy|America/Jujuy",
		"America/Argentina/Mendoza|America/Mendoza",
		"America/Atikokan|America/Coral_Harbour",
		"America/Chicago|US/Central",
		"America/Curacao|America/Aruba",
		"America/Curacao|America/Kralendijk",
		"America/Curacao|America/Lower_Princes",
		"America/Denver|America/Shiprock",
		"America/Denver|Navajo",
		"America/Denver|US/Mountain",
		"America/Detroit|US/Michigan",
		"America/Edmonton|Canada/Mountain",
		"America/Fort_Wayne|America/Indiana/Indianapolis",
		"America/Fort_Wayne|America/Indianapolis",
		"America/Fort_Wayne|US/East-Indiana",
		"America/Halifax|Canada/Atlantic",
		"America/Havana|Cuba",
		"America/Indiana/Knox|America/Knox_IN",
		"America/Indiana/Knox|US/Indiana-Starke",
		"America/Jamaica|Jamaica",
		"America/Kentucky/Louisville|America/Louisville",
		"America/Los_Angeles|US/Pacific",
		"America/Los_Angeles|US/Pacific-New",
		"America/Manaus|Brazil/West",
		"America/Mazatlan|Mexico/BajaSur",
		"America/Mexico_City|Mexico/General",
		"America/New_York|US/Eastern",
		"America/Noronha|Brazil/DeNoronha",
		"America/Panama|America/Cayman",
		"America/Phoenix|US/Arizona",
		"America/Port_of_Spain|America/Anguilla",
		"America/Port_of_Spain|America/Antigua",
		"America/Port_of_Spain|America/Dominica",
		"America/Port_of_Spain|America/Grenada",
		"America/Port_of_Spain|America/Guadeloupe",
		"America/Port_of_Spain|America/Marigot",
		"America/Port_of_Spain|America/Montserrat",
		"America/Port_of_Spain|America/St_Barthelemy",
		"America/Port_of_Spain|America/St_Kitts",
		"America/Port_of_Spain|America/St_Lucia",
		"America/Port_of_Spain|America/St_Thomas",
		"America/Port_of_Spain|America/St_Vincent",
		"America/Port_of_Spain|America/Tortola",
		"America/Port_of_Spain|America/Virgin",
		"America/Regina|Canada/East-Saskatchewan",
		"America/Regina|Canada/Saskatchewan",
		"America/Rio_Branco|America/Porto_Acre",
		"America/Rio_Branco|Brazil/Acre",
		"America/Santiago|Chile/Continental",
		"America/Sao_Paulo|Brazil/East",
		"America/St_Johns|Canada/Newfoundland",
		"America/Tijuana|America/Ensenada",
		"America/Tijuana|America/Santa_Isabel",
		"America/Tijuana|Mexico/BajaNorte",
		"America/Toronto|America/Montreal",
		"America/Toronto|Canada/Eastern",
		"America/Vancouver|Canada/Pacific",
		"America/Whitehorse|Canada/Yukon",
		"America/Winnipeg|Canada/Central",
		"Asia/Ashgabat|Asia/Ashkhabad",
		"Asia/Bangkok|Asia/Phnom_Penh",
		"Asia/Bangkok|Asia/Vientiane",
		"Asia/Dhaka|Asia/Dacca",
		"Asia/Dubai|Asia/Muscat",
		"Asia/Ho_Chi_Minh|Asia/Saigon",
		"Asia/Hong_Kong|Hongkong",
		"Asia/Jerusalem|Asia/Tel_Aviv",
		"Asia/Jerusalem|Israel",
		"Asia/Kathmandu|Asia/Katmandu",
		"Asia/Kolkata|Asia/Calcutta",
		"Asia/Macau|Asia/Macao",
		"Asia/Makassar|Asia/Ujung_Pandang",
		"Asia/Nicosia|Europe/Nicosia",
		"Asia/Qatar|Asia/Bahrain",
		"Asia/Riyadh|Asia/Aden",
		"Asia/Riyadh|Asia/Kuwait",
		"Asia/Seoul|ROK",
		"Asia/Shanghai|Asia/Chongqing",
		"Asia/Shanghai|Asia/Chungking",
		"Asia/Shanghai|Asia/Harbin",
		"Asia/Shanghai|PRC",
		"Asia/Singapore|Singapore",
		"Asia/Taipei|ROC",
		"Asia/Tehran|Iran",
		"Asia/Thimphu|Asia/Thimbu",
		"Asia/Tokyo|Japan",
		"Asia/Ulaanbaatar|Asia/Ulan_Bator",
		"Asia/Urumqi|Asia/Kashgar",
		"Atlantic/Faroe|Atlantic/Faeroe",
		"Atlantic/Reykjavik|Iceland",
		"Australia/Adelaide|Australia/South",
		"Australia/Brisbane|Australia/Queensland",
		"Australia/Broken_Hill|Australia/Yancowinna",
		"Australia/Darwin|Australia/North",
		"Australia/Hobart|Australia/Tasmania",
		"Australia/Lord_Howe|Australia/LHI",
		"Australia/Melbourne|Australia/Victoria",
		"Australia/Perth|Australia/West",
		"Australia/Sydney|Australia/ACT",
		"Australia/Sydney|Australia/Canberra",
		"Australia/Sydney|Australia/NSW",
		"Etc/GMT+0|Etc/GMT",
		"Etc/GMT+0|Etc/GMT-0",
		"Etc/GMT+0|Etc/GMT0",
		"Etc/GMT+0|Etc/Greenwich",
		"Etc/GMT+0|GMT",
		"Etc/GMT+0|GMT+0",
		"Etc/GMT+0|GMT-0",
		"Etc/GMT+0|GMT0",
		"Etc/GMT+0|Greenwich",
		"Etc/UCT|UCT",
		"Etc/UTC|Etc/Universal",
		"Etc/UTC|Etc/Zulu",
		"Etc/UTC|UTC",
		"Etc/UTC|Universal",
		"Etc/UTC|Zulu",
		"Europe/Belgrade|Europe/Ljubljana",
		"Europe/Belgrade|Europe/Podgorica",
		"Europe/Belgrade|Europe/Sarajevo",
		"Europe/Belgrade|Europe/Skopje",
		"Europe/Belgrade|Europe/Zagreb",
		"Europe/Chisinau|Europe/Tiraspol",
		"Europe/Dublin|Eire",
		"Europe/Helsinki|Europe/Mariehamn",
		"Europe/Istanbul|Asia/Istanbul",
		"Europe/Istanbul|Turkey",
		"Europe/Lisbon|Portugal",
		"Europe/London|Europe/Belfast",
		"Europe/London|Europe/Guernsey",
		"Europe/London|Europe/Isle_of_Man",
		"Europe/London|Europe/Jersey",
		"Europe/London|GB",
		"Europe/London|GB-Eire",
		"Europe/Moscow|W-SU",
		"Europe/Oslo|Arctic/Longyearbyen",
		"Europe/Oslo|Atlantic/Jan_Mayen",
		"Europe/Prague|Europe/Bratislava",
		"Europe/Rome|Europe/San_Marino",
		"Europe/Rome|Europe/Vatican",
		"Europe/Warsaw|Poland",
		"Europe/Zurich|Europe/Busingen",
		"Europe/Zurich|Europe/Vaduz",
		"Pacific/Auckland|Antarctica/McMurdo",
		"Pacific/Auckland|Antarctica/South_Pole",
		"Pacific/Auckland|NZ",
		"Pacific/Chatham|NZ-CHAT",
		"Pacific/Chuuk|Pacific/Truk",
		"Pacific/Chuuk|Pacific/Yap",
		"Pacific/Easter|Chile/EasterIsland",
		"Pacific/Guam|Pacific/Saipan",
		"Pacific/Honolulu|Pacific/Johnston",
		"Pacific/Honolulu|US/Hawaii",
		"Pacific/Kwajalein|Kwajalein",
		"Pacific/Pago_Pago|Pacific/Midway",
		"Pacific/Pago_Pago|Pacific/Samoa",
		"Pacific/Pago_Pago|US/Samoa",
		"Pacific/Pohnpei|Pacific/Ponape"
	]
}
},{}],5:[function(require,module,exports){
var moment = module.exports = require("./moment-timezone");
moment.tz.load(require('./data/packed/latest.json'));

},{"./data/packed/latest.json":4,"./moment-timezone":6}],6:[function(require,module,exports){
//! moment-timezone.js
//! version : 0.5.4
//! author : Tim Wood
//! license : MIT
//! github.com/moment/moment-timezone

(function (root, factory) {
	"use strict";

	/*global define*/
	if (typeof define === 'function' && define.amd) {
		define(['moment'], factory);                 // AMD
	} else if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('moment')); // Node
	} else {
		factory(root.moment);                        // Browser
	}
}(this, function (moment) {
	"use strict";

	// Do not load moment-timezone a second time.
	if (moment.tz !== undefined) {
		logError('Moment Timezone ' + moment.tz.version + ' was already loaded ' + (moment.tz.dataVersion ? 'with data from ' : 'without any data') + moment.tz.dataVersion);
		return moment;
	}

	var VERSION = "0.5.4",
		zones = {},
		links = {},
		names = {},
		guesses = {},
		cachedGuess,

		momentVersion = moment.version.split('.'),
		major = +momentVersion[0],
		minor = +momentVersion[1];

	// Moment.js version check
	if (major < 2 || (major === 2 && minor < 6)) {
		logError('Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js ' + moment.version + '. See momentjs.com');
	}

	/************************************
		Unpacking
	************************************/

	function charCodeToInt(charCode) {
		if (charCode > 96) {
			return charCode - 87;
		} else if (charCode > 64) {
			return charCode - 29;
		}
		return charCode - 48;
	}

	function unpackBase60(string) {
		var i = 0,
			parts = string.split('.'),
			whole = parts[0],
			fractional = parts[1] || '',
			multiplier = 1,
			num,
			out = 0,
			sign = 1;

		// handle negative numbers
		if (string.charCodeAt(0) === 45) {
			i = 1;
			sign = -1;
		}

		// handle digits before the decimal
		for (i; i < whole.length; i++) {
			num = charCodeToInt(whole.charCodeAt(i));
			out = 60 * out + num;
		}

		// handle digits after the decimal
		for (i = 0; i < fractional.length; i++) {
			multiplier = multiplier / 60;
			num = charCodeToInt(fractional.charCodeAt(i));
			out += num * multiplier;
		}

		return out * sign;
	}

	function arrayToInt (array) {
		for (var i = 0; i < array.length; i++) {
			array[i] = unpackBase60(array[i]);
		}
	}

	function intToUntil (array, length) {
		for (var i = 0; i < length; i++) {
			array[i] = Math.round((array[i - 1] || 0) + (array[i] * 60000)); // minutes to milliseconds
		}

		array[length - 1] = Infinity;
	}

	function mapIndices (source, indices) {
		var out = [], i;

		for (i = 0; i < indices.length; i++) {
			out[i] = source[indices[i]];
		}

		return out;
	}

	function unpack (string) {
		var data = string.split('|'),
			offsets = data[2].split(' '),
			indices = data[3].split(''),
			untils  = data[4].split(' ');

		arrayToInt(offsets);
		arrayToInt(indices);
		arrayToInt(untils);

		intToUntil(untils, indices.length);

		return {
			name       : data[0],
			abbrs      : mapIndices(data[1].split(' '), indices),
			offsets    : mapIndices(offsets, indices),
			untils     : untils,
			population : data[5] | 0
		};
	}

	/************************************
		Zone object
	************************************/

	function Zone (packedString) {
		if (packedString) {
			this._set(unpack(packedString));
		}
	}

	Zone.prototype = {
		_set : function (unpacked) {
			this.name       = unpacked.name;
			this.abbrs      = unpacked.abbrs;
			this.untils     = unpacked.untils;
			this.offsets    = unpacked.offsets;
			this.population = unpacked.population;
		},

		_index : function (timestamp) {
			var target = +timestamp,
				untils = this.untils,
				i;

			for (i = 0; i < untils.length; i++) {
				if (target < untils[i]) {
					return i;
				}
			}
		},

		parse : function (timestamp) {
			var target  = +timestamp,
				offsets = this.offsets,
				untils  = this.untils,
				max     = untils.length - 1,
				offset, offsetNext, offsetPrev, i;

			for (i = 0; i < max; i++) {
				offset     = offsets[i];
				offsetNext = offsets[i + 1];
				offsetPrev = offsets[i ? i - 1 : i];

				if (offset < offsetNext && tz.moveAmbiguousForward) {
					offset = offsetNext;
				} else if (offset > offsetPrev && tz.moveInvalidForward) {
					offset = offsetPrev;
				}

				if (target < untils[i] - (offset * 60000)) {
					return offsets[i];
				}
			}

			return offsets[max];
		},

		abbr : function (mom) {
			return this.abbrs[this._index(mom)];
		},

		offset : function (mom) {
			return this.offsets[this._index(mom)];
		}
	};

	/************************************
		Current Timezone
	************************************/

	function OffsetAt(at) {
		var timeString = at.toTimeString();
		var abbr = timeString.match(/\([a-z ]+\)/i);
		if (abbr && abbr[0]) {
			// 17:56:31 GMT-0600 (CST)
			// 17:56:31 GMT-0600 (Central Standard Time)
			abbr = abbr[0].match(/[A-Z]/g);
			abbr = abbr ? abbr.join('') : undefined;
		} else {
			// 17:56:31 CST
			// 17:56:31 GMT+0800 (台北標準時間)
			abbr = timeString.match(/[A-Z]{3,5}/g);
			abbr = abbr ? abbr[0] : undefined;
		}

		if (abbr === 'GMT') {
			abbr = undefined;
		}

		this.at = +at;
		this.abbr = abbr;
		this.offset = at.getTimezoneOffset();
	}

	function ZoneScore(zone) {
		this.zone = zone;
		this.offsetScore = 0;
		this.abbrScore = 0;
	}

	ZoneScore.prototype.scoreOffsetAt = function (offsetAt) {
		this.offsetScore += Math.abs(this.zone.offset(offsetAt.at) - offsetAt.offset);
		if (this.zone.abbr(offsetAt.at).replace(/[^A-Z]/g, '') !== offsetAt.abbr) {
			this.abbrScore++;
		}
	};

	function findChange(low, high) {
		var mid, diff;

		while ((diff = ((high.at - low.at) / 12e4 | 0) * 6e4)) {
			mid = new OffsetAt(new Date(low.at + diff));
			if (mid.offset === low.offset) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function userOffsets() {
		var startYear = new Date().getFullYear() - 2,
			last = new OffsetAt(new Date(startYear, 0, 1)),
			offsets = [last],
			change, next, i;

		for (i = 1; i < 48; i++) {
			next = new OffsetAt(new Date(startYear, i, 1));
			if (next.offset !== last.offset) {
				change = findChange(last, next);
				offsets.push(change);
				offsets.push(new OffsetAt(new Date(change.at + 6e4)));
			}
			last = next;
		}

		for (i = 0; i < 4; i++) {
			offsets.push(new OffsetAt(new Date(startYear + i, 0, 1)));
			offsets.push(new OffsetAt(new Date(startYear + i, 6, 1)));
		}

		return offsets;
	}

	function sortZoneScores (a, b) {
		if (a.offsetScore !== b.offsetScore) {
			return a.offsetScore - b.offsetScore;
		}
		if (a.abbrScore !== b.abbrScore) {
			return a.abbrScore - b.abbrScore;
		}
		return b.zone.population - a.zone.population;
	}

	function addToGuesses (name, offsets) {
		var i, offset;
		arrayToInt(offsets);
		for (i = 0; i < offsets.length; i++) {
			offset = offsets[i];
			guesses[offset] = guesses[offset] || {};
			guesses[offset][name] = true;
		}
	}

	function guessesForUserOffsets (offsets) {
		var offsetsLength = offsets.length,
			filteredGuesses = {},
			out = [],
			i, j, guessesOffset;

		for (i = 0; i < offsetsLength; i++) {
			guessesOffset = guesses[offsets[i].offset] || {};
			for (j in guessesOffset) {
				if (guessesOffset.hasOwnProperty(j)) {
					filteredGuesses[j] = true;
				}
			}
		}

		for (i in filteredGuesses) {
			if (filteredGuesses.hasOwnProperty(i)) {
				out.push(names[i]);
			}
		}

		return out;
	}

	function rebuildGuess () {

		// use Intl API when available and returning valid time zone
		try {
			var intlName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (intlName){
				var name = names[normalizeName(intlName)];
				if (name) {
					return name;
				}
				logError("Moment Timezone found " + intlName + " from the Intl api, but did not have that data loaded.");
			}
		} catch (e) {
			// Intl unavailable, fall back to manual guessing.
		}

		var offsets = userOffsets(),
			offsetsLength = offsets.length,
			guesses = guessesForUserOffsets(offsets),
			zoneScores = [],
			zoneScore, i, j;

		for (i = 0; i < guesses.length; i++) {
			zoneScore = new ZoneScore(getZone(guesses[i]), offsetsLength);
			for (j = 0; j < offsetsLength; j++) {
				zoneScore.scoreOffsetAt(offsets[j]);
			}
			zoneScores.push(zoneScore);
		}

		zoneScores.sort(sortZoneScores);

		return zoneScores.length > 0 ? zoneScores[0].zone.name : undefined;
	}

	function guess (ignoreCache) {
		if (!cachedGuess || ignoreCache) {
			cachedGuess = rebuildGuess();
		}
		return cachedGuess;
	}

	/************************************
		Global Methods
	************************************/

	function normalizeName (name) {
		return (name || '').toLowerCase().replace(/\//g, '_');
	}

	function addZone (packed) {
		var i, name, split, normalized;

		if (typeof packed === "string") {
			packed = [packed];
		}

		for (i = 0; i < packed.length; i++) {
			split = packed[i].split('|');
			name = split[0];
			normalized = normalizeName(name);
			zones[normalized] = packed[i];
			names[normalized] = name;
			if (split[5]) {
				addToGuesses(normalized, split[2].split(' '));
			}
		}
	}

	function getZone (name, caller) {
		name = normalizeName(name);

		var zone = zones[name];
		var link;

		if (zone instanceof Zone) {
			return zone;
		}

		if (typeof zone === 'string') {
			zone = new Zone(zone);
			zones[name] = zone;
			return zone;
		}

		// Pass getZone to prevent recursion more than 1 level deep
		if (links[name] && caller !== getZone && (link = getZone(links[name], getZone))) {
			zone = zones[name] = new Zone();
			zone._set(link);
			zone.name = names[name];
			return zone;
		}

		return null;
	}

	function getNames () {
		var i, out = [];

		for (i in names) {
			if (names.hasOwnProperty(i) && (zones[i] || zones[links[i]]) && names[i]) {
				out.push(names[i]);
			}
		}

		return out.sort();
	}

	function addLink (aliases) {
		var i, alias, normal0, normal1;

		if (typeof aliases === "string") {
			aliases = [aliases];
		}

		for (i = 0; i < aliases.length; i++) {
			alias = aliases[i].split('|');

			normal0 = normalizeName(alias[0]);
			normal1 = normalizeName(alias[1]);

			links[normal0] = normal1;
			names[normal0] = alias[0];

			links[normal1] = normal0;
			names[normal1] = alias[1];
		}
	}

	function loadData (data) {
		addZone(data.zones);
		addLink(data.links);
		tz.dataVersion = data.version;
	}

	function zoneExists (name) {
		if (!zoneExists.didShowError) {
			zoneExists.didShowError = true;
				logError("moment.tz.zoneExists('" + name + "') has been deprecated in favor of !moment.tz.zone('" + name + "')");
		}
		return !!getZone(name);
	}

	function needsOffset (m) {
		return !!(m._a && (m._tzm === undefined));
	}

	function logError (message) {
		if (typeof console !== 'undefined' && typeof console.error === 'function') {
			console.error(message);
		}
	}

	/************************************
		moment.tz namespace
	************************************/

	function tz (input) {
		var args = Array.prototype.slice.call(arguments, 0, -1),
			name = arguments[arguments.length - 1],
			zone = getZone(name),
			out  = moment.utc.apply(null, args);

		if (zone && !moment.isMoment(input) && needsOffset(out)) {
			out.add(zone.parse(out), 'minutes');
		}

		out.tz(name);

		return out;
	}

	tz.version      = VERSION;
	tz.dataVersion  = '';
	tz._zones       = zones;
	tz._links       = links;
	tz._names       = names;
	tz.add          = addZone;
	tz.link         = addLink;
	tz.load         = loadData;
	tz.zone         = getZone;
	tz.zoneExists   = zoneExists; // deprecated in 0.1.0
	tz.guess        = guess;
	tz.names        = getNames;
	tz.Zone         = Zone;
	tz.unpack       = unpack;
	tz.unpackBase60 = unpackBase60;
	tz.needsOffset  = needsOffset;
	tz.moveInvalidForward   = true;
	tz.moveAmbiguousForward = false;

	/************************************
		Interface with Moment.js
	************************************/

	var fn = moment.fn;

	moment.tz = tz;

	moment.defaultZone = null;

	moment.updateOffset = function (mom, keepTime) {
		var zone = moment.defaultZone,
			offset;

		if (mom._z === undefined) {
			if (zone && needsOffset(mom) && !mom._isUTC) {
				mom._d = moment.utc(mom._a)._d;
				mom.utc().add(zone.parse(mom), 'minutes');
			}
			mom._z = zone;
		}
		if (mom._z) {
			offset = mom._z.offset(mom);
			if (Math.abs(offset) < 16) {
				offset = offset / 60;
			}
			if (mom.utcOffset !== undefined) {
				mom.utcOffset(-offset, keepTime);
			} else {
				mom.zone(offset, keepTime);
			}
		}
	};

	fn.tz = function (name) {
		if (name) {
			this._z = getZone(name);
			if (this._z) {
				moment.updateOffset(this);
			} else {
				logError("Moment Timezone has no data for " + name + ". See http://momentjs.com/timezone/docs/#/data-loading/.");
			}
			return this;
		}
		if (this._z) { return this._z.name; }
	};

	function abbrWrap (old) {
		return function () {
			if (this._z) { return this._z.abbr(this); }
			return old.call(this);
		};
	}

	function resetZoneWrap (old) {
		return function () {
			this._z = null;
			return old.apply(this, arguments);
		};
	}

	fn.zoneName = abbrWrap(fn.zoneName);
	fn.zoneAbbr = abbrWrap(fn.zoneAbbr);
	fn.utc      = resetZoneWrap(fn.utc);

	moment.tz.setDefault = function(name) {
		if (major < 2 || (major === 2 && minor < 9)) {
			logError('Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js ' + moment.version + '.');
		}
		moment.defaultZone = name ? getZone(name) : null;
		return moment;
	};

	// Cloning a moment should include the _z property.
	var momentProperties = moment.momentProperties;
	if (Object.prototype.toString.call(momentProperties) === '[object Array]') {
		// moment 2.8.1+
		momentProperties.push('_z');
		momentProperties.push('_a');
	} else if (momentProperties) {
		// moment 2.7.0
		momentProperties._z = null;
	}

	// INJECT DATA

	return moment;
}));

},{"moment":7}],7:[function(require,module,exports){
//! moment.js
//! version : 2.13.0
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, function () { 'use strict';

    var hookCallback;

    function utils_hooks__hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function create_utc__createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function valid__isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            m._isValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                m._isValid = m._isValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }
        }
        return m._isValid;
    }

    function valid__createInvalid (flags) {
        var m = create_utc__createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    function isUndefined(input) {
        return input === void 0;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = utils_hooks__hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i in momentProperties) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            utils_hooks__hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            return Math.ceil(number);
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (utils_hooks__hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (utils_hooks__hooks.deprecationHandler != null) {
                utils_hooks__hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(arguments).join(', ') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (utils_hooks__hooks.deprecationHandler != null) {
            utils_hooks__hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    utils_hooks__hooks.suppressDeprecationWarnings = false;
    utils_hooks__hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function isObject(input) {
        return Object.prototype.toString.call(input) === '[object Object]';
    }

    function locale_set__set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _ordinalParseLenient.
        this._ordinalParseLenient = new RegExp(this._ordinalParse.source + '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    // internal storage for locale config files
    var locales = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return null;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                require('./locale/' + name);
                // because defineLocale currently also sets the global locale, we
                // want to undo that for lazy loaded locales
                locale_locales__getSetGlobalLocale(oldLocale);
            } catch (e) { }
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function locale_locales__getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = locale_locales__getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale');
                config = mergeConfigs(locales[name]._config, config);
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    config = mergeConfigs(locales[config.parentLocale]._config, config);
                } else {
                    // treat as if there is no base config
                    deprecateSimple('parentLocaleUndefined',
                            'specified parentLocale is not defined yet');
                }
            }
            locales[name] = new Locale(config);

            // backwards compat for now: also set the locale
            locale_locales__getSetGlobalLocale(name);

            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale;
            if (locales[name] != null) {
                config = mergeConfigs(locales[name]._config, config);
            }
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            locale_locales__getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function locale_locales__getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function locale_locales__listLocales() {
        return keys(locales);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                get_set__set(this, unit, value);
                utils_hooks__hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get_set__get(this, unit);
            }
        };
    }

    function get_set__get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function get_set__set (mom, unit, value) {
        if (mom.isValid()) {
            mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
        }
    }

    // MOMENTS

    function getSet (units, value) {
        var unit;
        if (typeof units === 'object') {
            for (unit in units) {
                this.set(unit, units[unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += array[i] instanceof Function ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i;


    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (typeof callback === 'number') {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s+)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        return isArray(this._months) ? this._months[m.month()] :
            this._months[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function units_month__handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = create_utc__createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return units_month__handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = create_utc__createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (typeof value !== 'number') {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            utils_hooks__hooks.updateOffset(this, true);
            return this;
        } else {
            return get_set__get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = create_utc__createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
            utils_hooks__hooks.createFromInputFallback(config);
        }
    }

    utils_hooks__hooks.createFromInputFallback = deprecate(
        'moment construction falls back to js Date. This is ' +
        'discouraged and will be removed in upcoming major ' +
        'release. Please refer to ' +
        'https://github.com/moment/moment/issues/1407 for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    function createDate (y, m, d, h, M, s, ms) {
        //can't just apply() to create a date:
        //http://stackoverflow.com/questions/181348/instantiating-a-javascript-object-by-calling-prototype-constructor-apply
        var date = new Date(y, m, d, h, M, s, ms);

        //the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0 && isFinite(date.getFullYear())) {
            date.setFullYear(y);
        }
        return date;
    }

    function createUTCDate (y) {
        var date = new Date(Date.UTC.apply(null, arguments));

        //the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0 && isFinite(date.getUTCFullYear())) {
            date.setUTCFullYear(y);
        }
        return date;
    }

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? utils_hooks__hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = utils_hooks__hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    utils_hooks__hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    //http://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(utils_hooks__hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse)) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(local__createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            weekYear = defaults(w.gg, config._a[YEAR], weekOfYear(local__createLocal(), dow, doy).year);
            week = defaults(w.w, 1);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from begining of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to begining of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // constant that refers to the ISO standard
    utils_hooks__hooks.ISO_8601 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === utils_hooks__hooks.ISO_8601) {
            configFromISO(config);
            return;
        }

        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (getParsingFlags(config).bigHour === true &&
                config._a[HOUR] <= 12 &&
                config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!valid__isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || locale_locales__getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return valid__createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        } else if (isDate(input)) {
            config._d = input;
        } else {
            configFromInput(config);
        }

        if (!valid__isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (input === undefined) {
            config._d = new Date(utils_hooks__hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (typeof(input) === 'object') {
            configFromObject(config);
        } else if (typeof(input) === 'number') {
            // from milliseconds
            config._d = new Date(input);
        } else {
            utils_hooks__hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (typeof(locale) === 'boolean') {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function local__createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
         'moment().min is deprecated, use moment.max instead. https://github.com/moment/moment/issues/1548',
         function () {
             var other = local__createLocal.apply(null, arguments);
             if (this.isValid() && other.isValid()) {
                 return other < this ? this : other;
             } else {
                 return valid__createInvalid();
             }
         }
     );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. https://github.com/moment/moment/issues/1548',
        function () {
            var other = local__createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return valid__createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return local__createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = locale_locales__getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = ((string || '').match(matcher) || []);
        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : local__createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            utils_hooks__hooks.updateOffset(res, false);
            return res;
        } else {
            return local__createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    utils_hooks__hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
            } else if (Math.abs(input) < 16) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    add_subtract__addSubtract(this, create__createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    utils_hooks__hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm) {
            this.utcOffset(this._tzm);
        } else if (typeof this._i === 'string') {
            this.utcOffset(offsetFromString(matchOffset, this._i));
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? local__createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? create_utc__createUTC(c._a) : local__createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?\d*)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-)?P(?:(-?[0-9,.]*)Y)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)W)?(?:(-?[0-9,.]*)D)?(?:T(?:(-?[0-9,.]*)H)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)S)?)?$/;

    function create__createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (typeof input === 'number') {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])        * sign,
                h  : toInt(match[HOUR])        * sign,
                m  : toInt(match[MINUTE])      * sign,
                s  : toInt(match[SECOND])      * sign,
                ms : toInt(match[MILLISECOND]) * sign
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(local__createLocal(duration.from), local__createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    create__createDuration.fn = Duration.prototype;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {milliseconds: 0, months: 0};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period).');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = create__createDuration(val, period);
            add_subtract__addSubtract(this, dur, direction);
            return this;
        };
    }

    function add_subtract__addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (days) {
            get_set__set(mom, 'Date', get_set__get(mom, 'Date') + days * isAdding);
        }
        if (months) {
            setMonth(mom, get_set__get(mom, 'Month') + months * isAdding);
        }
        if (updateOffset) {
            utils_hooks__hooks.updateOffset(mom, days || months);
        }
    }

    var add_subtract__add      = createAdder(1, 'add');
    var add_subtract__subtract = createAdder(-1, 'subtract');

    function moment_calendar__calendar (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || local__createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            diff = this.diff(sod, 'days', true),
            format = diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format]() : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, local__createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : local__createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(!isUndefined(units) ? units : 'millisecond');
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : local__createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(!isUndefined(units) ? units : 'millisecond');
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(from, units) : !this.isBefore(from, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(to, units) : !this.isAfter(to, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : local__createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units || 'millisecond');
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input,units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input,units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            delta, output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        if (units === 'year' || units === 'month' || units === 'quarter') {
            output = monthDiff(this, that);
            if (units === 'quarter') {
                output = output / 3;
            } else if (units === 'year') {
                output = output / 12;
            }
        } else {
            delta = this - that;
            output = units === 'second' ? delta / 1e3 : // 1000
                units === 'minute' ? delta / 6e4 : // 1000 * 60
                units === 'hour' ? delta / 36e5 : // 1000 * 60 * 60
                units === 'day' ? (delta - zoneDelta) / 864e5 : // 1000 * 60 * 60 * 24, negate dst
                units === 'week' ? (delta - zoneDelta) / 6048e5 : // 1000 * 60 * 60 * 24 * 7, negate dst
                delta;
        }
        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    utils_hooks__hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    utils_hooks__hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function moment_format__toISOString () {
        var m = this.clone().utc();
        if (0 < m.year() && m.year() <= 9999) {
            if (isFunction(Date.prototype.toISOString)) {
                // native implementation is ~50x faster, use it when we can
                return this.toDate().toISOString();
            } else {
                return formatMoment(m, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
            }
        } else {
            return formatMoment(m, 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
        }
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? utils_hooks__hooks.defaultFormatUtc : utils_hooks__hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 local__createLocal(time).isValid())) {
            return create__createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(local__createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 local__createLocal(time).isValid())) {
            return create__createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(local__createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = locale_locales__getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    function startOf (units) {
        units = normalizeUnits(units);
        // the following switch intentionally omits break keywords
        // to utilize falling through the cases.
        switch (units) {
        case 'year':
            this.month(0);
            /* falls through */
        case 'quarter':
        case 'month':
            this.date(1);
            /* falls through */
        case 'week':
        case 'isoWeek':
        case 'day':
        case 'date':
            this.hours(0);
            /* falls through */
        case 'hour':
            this.minutes(0);
            /* falls through */
        case 'minute':
            this.seconds(0);
            /* falls through */
        case 'second':
            this.milliseconds(0);
        }

        // weeks are a special case
        if (units === 'week') {
            this.weekday(0);
        }
        if (units === 'isoWeek') {
            this.isoWeekday(1);
        }

        // quarters are also special
        if (units === 'quarter') {
            this.month(Math.floor(this.month() / 3) * 3);
        }

        return this;
    }

    function endOf (units) {
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond') {
            return this;
        }

        // 'date' is an alias for 'day', so it should be considered as such.
        if (units === 'date') {
            units = 'day';
        }

        return this.startOf(units).add(1, (units === 'isoWeek' ? 'week' : units)).subtract(1, 'ms');
    }

    function to_type__valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return this._offset ? new Date(this.valueOf()) : this._d;
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function moment_valid__isValid () {
        return valid__isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = utils_hooks__hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 1st is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        return isStrict ? locale._ordinalParse : locale._ordinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0], 10);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    // LOCALES

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        return isArray(this._weekdays) ? this._weekdays[m.day()] :
            this._weekdays[this._weekdays.isFormat.test(format) ? 'format' : 'standalone'][m.day()];
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return this._weekdaysShort[m.day()];
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return this._weekdaysMin[m.day()];
    }

    function day_of_week__handleStrictParse(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = create_utc__createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return day_of_week__handleStrictParse.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = create_utc__createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.
        return input == null ? this.day() || 7 : this.day(this.day() % 7 ? input : input - 7);
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = create_utc__createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour he wants. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var momentPrototype__proto = Moment.prototype;

    momentPrototype__proto.add               = add_subtract__add;
    momentPrototype__proto.calendar          = moment_calendar__calendar;
    momentPrototype__proto.clone             = clone;
    momentPrototype__proto.diff              = diff;
    momentPrototype__proto.endOf             = endOf;
    momentPrototype__proto.format            = format;
    momentPrototype__proto.from              = from;
    momentPrototype__proto.fromNow           = fromNow;
    momentPrototype__proto.to                = to;
    momentPrototype__proto.toNow             = toNow;
    momentPrototype__proto.get               = getSet;
    momentPrototype__proto.invalidAt         = invalidAt;
    momentPrototype__proto.isAfter           = isAfter;
    momentPrototype__proto.isBefore          = isBefore;
    momentPrototype__proto.isBetween         = isBetween;
    momentPrototype__proto.isSame            = isSame;
    momentPrototype__proto.isSameOrAfter     = isSameOrAfter;
    momentPrototype__proto.isSameOrBefore    = isSameOrBefore;
    momentPrototype__proto.isValid           = moment_valid__isValid;
    momentPrototype__proto.lang              = lang;
    momentPrototype__proto.locale            = locale;
    momentPrototype__proto.localeData        = localeData;
    momentPrototype__proto.max               = prototypeMax;
    momentPrototype__proto.min               = prototypeMin;
    momentPrototype__proto.parsingFlags      = parsingFlags;
    momentPrototype__proto.set               = getSet;
    momentPrototype__proto.startOf           = startOf;
    momentPrototype__proto.subtract          = add_subtract__subtract;
    momentPrototype__proto.toArray           = toArray;
    momentPrototype__proto.toObject          = toObject;
    momentPrototype__proto.toDate            = toDate;
    momentPrototype__proto.toISOString       = moment_format__toISOString;
    momentPrototype__proto.toJSON            = toJSON;
    momentPrototype__proto.toString          = toString;
    momentPrototype__proto.unix              = unix;
    momentPrototype__proto.valueOf           = to_type__valueOf;
    momentPrototype__proto.creationData      = creationData;

    // Year
    momentPrototype__proto.year       = getSetYear;
    momentPrototype__proto.isLeapYear = getIsLeapYear;

    // Week Year
    momentPrototype__proto.weekYear    = getSetWeekYear;
    momentPrototype__proto.isoWeekYear = getSetISOWeekYear;

    // Quarter
    momentPrototype__proto.quarter = momentPrototype__proto.quarters = getSetQuarter;

    // Month
    momentPrototype__proto.month       = getSetMonth;
    momentPrototype__proto.daysInMonth = getDaysInMonth;

    // Week
    momentPrototype__proto.week           = momentPrototype__proto.weeks        = getSetWeek;
    momentPrototype__proto.isoWeek        = momentPrototype__proto.isoWeeks     = getSetISOWeek;
    momentPrototype__proto.weeksInYear    = getWeeksInYear;
    momentPrototype__proto.isoWeeksInYear = getISOWeeksInYear;

    // Day
    momentPrototype__proto.date       = getSetDayOfMonth;
    momentPrototype__proto.day        = momentPrototype__proto.days             = getSetDayOfWeek;
    momentPrototype__proto.weekday    = getSetLocaleDayOfWeek;
    momentPrototype__proto.isoWeekday = getSetISODayOfWeek;
    momentPrototype__proto.dayOfYear  = getSetDayOfYear;

    // Hour
    momentPrototype__proto.hour = momentPrototype__proto.hours = getSetHour;

    // Minute
    momentPrototype__proto.minute = momentPrototype__proto.minutes = getSetMinute;

    // Second
    momentPrototype__proto.second = momentPrototype__proto.seconds = getSetSecond;

    // Millisecond
    momentPrototype__proto.millisecond = momentPrototype__proto.milliseconds = getSetMillisecond;

    // Offset
    momentPrototype__proto.utcOffset            = getSetOffset;
    momentPrototype__proto.utc                  = setOffsetToUTC;
    momentPrototype__proto.local                = setOffsetToLocal;
    momentPrototype__proto.parseZone            = setOffsetToParsedOffset;
    momentPrototype__proto.hasAlignedHourOffset = hasAlignedHourOffset;
    momentPrototype__proto.isDST                = isDaylightSavingTime;
    momentPrototype__proto.isDSTShifted         = isDaylightSavingTimeShifted;
    momentPrototype__proto.isLocal              = isLocal;
    momentPrototype__proto.isUtcOffset          = isUtcOffset;
    momentPrototype__proto.isUtc                = isUtc;
    momentPrototype__proto.isUTC                = isUtc;

    // Timezone
    momentPrototype__proto.zoneAbbr = getZoneAbbr;
    momentPrototype__proto.zoneName = getZoneName;

    // Deprecations
    momentPrototype__proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    momentPrototype__proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    momentPrototype__proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    momentPrototype__proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. https://github.com/moment/moment/issues/1779', getSetZone);

    var momentPrototype = momentPrototype__proto;

    function moment__createUnix (input) {
        return local__createLocal(input * 1000);
    }

    function moment__createInZone () {
        return local__createLocal.apply(null, arguments).parseZone();
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function locale_calendar__calendar (key, mom, now) {
        var output = this._calendar[key];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    function preParsePostFormat (string) {
        return string;
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relative__relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var prototype__proto = Locale.prototype;

    prototype__proto._calendar       = defaultCalendar;
    prototype__proto.calendar        = locale_calendar__calendar;
    prototype__proto._longDateFormat = defaultLongDateFormat;
    prototype__proto.longDateFormat  = longDateFormat;
    prototype__proto._invalidDate    = defaultInvalidDate;
    prototype__proto.invalidDate     = invalidDate;
    prototype__proto._ordinal        = defaultOrdinal;
    prototype__proto.ordinal         = ordinal;
    prototype__proto._ordinalParse   = defaultOrdinalParse;
    prototype__proto.preparse        = preParsePostFormat;
    prototype__proto.postformat      = preParsePostFormat;
    prototype__proto._relativeTime   = defaultRelativeTime;
    prototype__proto.relativeTime    = relative__relativeTime;
    prototype__proto.pastFuture      = pastFuture;
    prototype__proto.set             = locale_set__set;

    // Month
    prototype__proto.months            =        localeMonths;
    prototype__proto._months           = defaultLocaleMonths;
    prototype__proto.monthsShort       =        localeMonthsShort;
    prototype__proto._monthsShort      = defaultLocaleMonthsShort;
    prototype__proto.monthsParse       =        localeMonthsParse;
    prototype__proto._monthsRegex      = defaultMonthsRegex;
    prototype__proto.monthsRegex       = monthsRegex;
    prototype__proto._monthsShortRegex = defaultMonthsShortRegex;
    prototype__proto.monthsShortRegex  = monthsShortRegex;

    // Week
    prototype__proto.week = localeWeek;
    prototype__proto._week = defaultLocaleWeek;
    prototype__proto.firstDayOfYear = localeFirstDayOfYear;
    prototype__proto.firstDayOfWeek = localeFirstDayOfWeek;

    // Day of Week
    prototype__proto.weekdays       =        localeWeekdays;
    prototype__proto._weekdays      = defaultLocaleWeekdays;
    prototype__proto.weekdaysMin    =        localeWeekdaysMin;
    prototype__proto._weekdaysMin   = defaultLocaleWeekdaysMin;
    prototype__proto.weekdaysShort  =        localeWeekdaysShort;
    prototype__proto._weekdaysShort = defaultLocaleWeekdaysShort;
    prototype__proto.weekdaysParse  =        localeWeekdaysParse;

    prototype__proto._weekdaysRegex      = defaultWeekdaysRegex;
    prototype__proto.weekdaysRegex       =        weekdaysRegex;
    prototype__proto._weekdaysShortRegex = defaultWeekdaysShortRegex;
    prototype__proto.weekdaysShortRegex  =        weekdaysShortRegex;
    prototype__proto._weekdaysMinRegex   = defaultWeekdaysMinRegex;
    prototype__proto.weekdaysMinRegex    =        weekdaysMinRegex;

    // Hours
    prototype__proto.isPM = localeIsPM;
    prototype__proto._meridiemParse = defaultLocaleMeridiemParse;
    prototype__proto.meridiem = localeMeridiem;

    function lists__get (format, index, field, setter) {
        var locale = locale_locales__getLocale();
        var utc = create_utc__createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (typeof format === 'number') {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return lists__get(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = lists__get(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (typeof format === 'number') {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (typeof format === 'number') {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = locale_locales__getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return lists__get(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = lists__get(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function lists__listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function lists__listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function lists__listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function lists__listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function lists__listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    locale_locales__getSetGlobalLocale('en', {
        ordinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports
    utils_hooks__hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', locale_locales__getSetGlobalLocale);
    utils_hooks__hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', locale_locales__getLocale);

    var mathAbs = Math.abs;

    function duration_abs__abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function duration_add_subtract__addSubtract (duration, input, value, direction) {
        var other = create__createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function duration_add_subtract__add (input, value) {
        return duration_add_subtract__addSubtract(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function duration_add_subtract__subtract (input, value) {
        return duration_add_subtract__addSubtract(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'year') {
            days   = this._days   + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            return units === 'month' ? months : months / 12;
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function duration_as__valueOf () {
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asYears        = makeAs('y');

    function duration_get__get (units) {
        units = normalizeUnits(units);
        return this[units + 's']();
    }

    function makeGetter(name) {
        return function () {
            return this._data[name];
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        s: 45,  // seconds to minute
        m: 45,  // minutes to hour
        h: 22,  // hours to day
        d: 26,  // days to month
        M: 11   // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function duration_humanize__relativeTime (posNegDuration, withoutSuffix, locale) {
        var duration = create__createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds < thresholds.s && ['s', seconds]  ||
                minutes <= 1           && ['m']           ||
                minutes < thresholds.m && ['mm', minutes] ||
                hours   <= 1           && ['h']           ||
                hours   < thresholds.h && ['hh', hours]   ||
                days    <= 1           && ['d']           ||
                days    < thresholds.d && ['dd', days]    ||
                months  <= 1           && ['M']           ||
                months  < thresholds.M && ['MM', months]  ||
                years   <= 1           && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set a threshold for relative time strings
    function duration_humanize__getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        return true;
    }

    function humanize (withSuffix) {
        var locale = this.localeData();
        var output = duration_humanize__relativeTime(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var iso_string__abs = Math.abs;

    function iso_string__toISOString() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        var seconds = iso_string__abs(this._milliseconds) / 1000;
        var days         = iso_string__abs(this._days);
        var months       = iso_string__abs(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds;
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        return (total < 0 ? '-' : '') +
            'P' +
            (Y ? Y + 'Y' : '') +
            (M ? M + 'M' : '') +
            (D ? D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? h + 'H' : '') +
            (m ? m + 'M' : '') +
            (s ? s + 'S' : '');
    }

    var duration_prototype__proto = Duration.prototype;

    duration_prototype__proto.abs            = duration_abs__abs;
    duration_prototype__proto.add            = duration_add_subtract__add;
    duration_prototype__proto.subtract       = duration_add_subtract__subtract;
    duration_prototype__proto.as             = as;
    duration_prototype__proto.asMilliseconds = asMilliseconds;
    duration_prototype__proto.asSeconds      = asSeconds;
    duration_prototype__proto.asMinutes      = asMinutes;
    duration_prototype__proto.asHours        = asHours;
    duration_prototype__proto.asDays         = asDays;
    duration_prototype__proto.asWeeks        = asWeeks;
    duration_prototype__proto.asMonths       = asMonths;
    duration_prototype__proto.asYears        = asYears;
    duration_prototype__proto.valueOf        = duration_as__valueOf;
    duration_prototype__proto._bubble        = bubble;
    duration_prototype__proto.get            = duration_get__get;
    duration_prototype__proto.milliseconds   = milliseconds;
    duration_prototype__proto.seconds        = seconds;
    duration_prototype__proto.minutes        = minutes;
    duration_prototype__proto.hours          = hours;
    duration_prototype__proto.days           = days;
    duration_prototype__proto.weeks          = weeks;
    duration_prototype__proto.months         = months;
    duration_prototype__proto.years          = years;
    duration_prototype__proto.humanize       = humanize;
    duration_prototype__proto.toISOString    = iso_string__toISOString;
    duration_prototype__proto.toString       = iso_string__toISOString;
    duration_prototype__proto.toJSON         = iso_string__toISOString;
    duration_prototype__proto.locale         = locale;
    duration_prototype__proto.localeData     = localeData;

    // Deprecations
    duration_prototype__proto.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', iso_string__toISOString);
    duration_prototype__proto.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    utils_hooks__hooks.version = '2.13.0';

    setHookCallback(local__createLocal);

    utils_hooks__hooks.fn                    = momentPrototype;
    utils_hooks__hooks.min                   = min;
    utils_hooks__hooks.max                   = max;
    utils_hooks__hooks.now                   = now;
    utils_hooks__hooks.utc                   = create_utc__createUTC;
    utils_hooks__hooks.unix                  = moment__createUnix;
    utils_hooks__hooks.months                = lists__listMonths;
    utils_hooks__hooks.isDate                = isDate;
    utils_hooks__hooks.locale                = locale_locales__getSetGlobalLocale;
    utils_hooks__hooks.invalid               = valid__createInvalid;
    utils_hooks__hooks.duration              = create__createDuration;
    utils_hooks__hooks.isMoment              = isMoment;
    utils_hooks__hooks.weekdays              = lists__listWeekdays;
    utils_hooks__hooks.parseZone             = moment__createInZone;
    utils_hooks__hooks.localeData            = locale_locales__getLocale;
    utils_hooks__hooks.isDuration            = isDuration;
    utils_hooks__hooks.monthsShort           = lists__listMonthsShort;
    utils_hooks__hooks.weekdaysMin           = lists__listWeekdaysMin;
    utils_hooks__hooks.defineLocale          = defineLocale;
    utils_hooks__hooks.updateLocale          = updateLocale;
    utils_hooks__hooks.locales               = locale_locales__listLocales;
    utils_hooks__hooks.weekdaysShort         = lists__listWeekdaysShort;
    utils_hooks__hooks.normalizeUnits        = normalizeUnits;
    utils_hooks__hooks.relativeTimeThreshold = duration_humanize__getSetRelativeTimeThreshold;
    utils_hooks__hooks.prototype             = momentPrototype;

    var _moment = utils_hooks__hooks;

    return _moment;

}));
},{}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.config = exports.App = undefined;

var _dashboard = require('./dashboard/dashboard.js');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var config = {
  targetEl: document.querySelector('#main-content')
};

var App = function App() {
  _classCallCheck(this, App);

  this.dashboard = new _dashboard.Dashboard(config);
};

if (!window.__karma__) {
  var app = new App(); // eslint-disable-line no-unused-vars
}

exports.App = App;
exports.config = config;

},{"./dashboard/dashboard.js":10}],9:[function(require,module,exports){
module.exports = '<main class="text-center container-fluid">\n' +
    '  <section class="row centered">\n' +
    '    <div id="main-timezones-container" class="col-xs-12 col-md-6"></div>\n' +
    '  </section>\n' +
    '  <section id="add-timezone-container" class="row"></section>\n' +
    '  <section id="additional-timezones-container" class="row"></section>\n' +
    '</main>\n' +
    '';
},{}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Dashboard = exports.elementsQuery = exports.exceptionMsg = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _dashboard = require('./dashboard.html');

var _dashboard2 = _interopRequireDefault(_dashboard);

var _newTimezoneForm = require('./new-timezone-form/new-timezone-form.js');

var _timezoneCard = require('./timezone-card/timezone-card.js');

var _storeCurrentTime = require('./store-current-time/store-current-time.js');

var _element = require('./element/element.js');

var _dot = require('dot');

var _dot2 = _interopRequireDefault(_dot);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

exports.exceptionMsg = _element.exceptionMsg;
var elementsQuery = exports.elementsQuery = {
  mainTzContainer: '#main-timezones-container',
  addTzContainer: '#add-timezone-container',
  additionalTzContainer: '#additional-timezones-container'
};

var Dashboard = exports.Dashboard = function (_Element) {
  _inherits(Dashboard, _Element);

  function Dashboard() {
    var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Dashboard);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Dashboard).call(this, config, elementsQuery));

    _this.timezones = [];
    return _this;
  }

  _createClass(Dashboard, [{
    key: 'render',
    value: function render() {
      _get(Object.getPrototypeOf(Dashboard.prototype), 'render', this).call(this);
      this.config.targetEl.innerHTML = _dot2.default.template(_dashboard2.default)();
    }
  }, {
    key: 'post',
    value: function post() {
      _get(Object.getPrototypeOf(Dashboard.prototype), 'post', this).call(this);
      this.storeCurrentTime = new _storeCurrentTime.StoreCurrentTime();
      this.addElements();
    }
  }, {
    key: 'addElements',
    value: function addElements() {
      this.addNewTimezoneForm();
      this.initMainTimezones();
    }
  }, {
    key: 'addNewTimezoneForm',
    value: function addNewTimezoneForm() {
      new _newTimezoneForm.NewTimezoneForm({
        targetEl: this.domEl.addTzContainer,
        onAddTimezone: this.addNewTimeZone.bind(this)
      });
    }
  }, {
    key: 'initMainTimezones',
    value: function initMainTimezones() {
      new _timezoneCard.TimezoneCard({
        targetEl: this.domEl.mainTzContainer,
        cssClass: 'col-xs-12 col-md-6',
        time: this.storeCurrentTime.value,
        timezone: _momentTimezone2.default.tz.guess(),
        storeCurrentTime: this.storeCurrentTime
      });
      new _timezoneCard.TimezoneCard({
        targetEl: this.domEl.mainTzContainer,
        cssClass: 'col-xs-12 col-md-6',
        time: this.storeCurrentTime.value,
        timezone: 'GMT',
        storeCurrentTime: this.storeCurrentTime
      });
    }
  }, {
    key: 'addNewTimeZone',
    value: function addNewTimeZone(value) {
      new _timezoneCard.TimezoneCard({
        targetEl: this.domEl.additionalTzContainer,
        time: this.storeCurrentTime.value,
        timezone: value,
        storeCurrentTime: this.storeCurrentTime
      });
    }
  }]);

  return Dashboard;
}(_element.Element);

},{"./dashboard.html":9,"./element/element.js":11,"./new-timezone-form/new-timezone-form.js":13,"./store-current-time/store-current-time.js":15,"./timezone-card/timezone-card.js":17,"dot":3,"moment-timezone":5}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var exceptionMsg = exports.exceptionMsg = {
  noTargetEl: 'You should pass targetEl (DOM element) in config',
  noDomTargetEl: 'You should DOM element as a targetEl in config'
};

var Element = exports.Element = function () {
  function Element() {
    var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
    var elementsQuery = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, Element);

    this.config = config;
    this.elementsQuery = elementsQuery;
    this.checkConfig();
    this.domEl = {};

    // init
    this.preRender();
    this.render();
    this.postRender();
    this.assignDomElements();
    this.post();

    this.smartListeners = {};
    this.addListeners();
  }

  _createClass(Element, [{
    key: 'checkConfig',
    value: function checkConfig() {
      if (!this.config.targetEl) {
        throw new Error(exceptionMsg.noTargetEl);
      } else if (this.config.targetEl && !this.config.targetEl.tagName) {
        throw new Error(exceptionMsg.noDomTargetEl);
      }
    }
  }, {
    key: 'preRender',
    value: function preRender() {}
  }, {
    key: 'render',
    value: function render() {}
  }, {
    key: 'postRender',
    value: function postRender() {}
  }, {
    key: 'addListeners',
    value: function addListeners() {}
  }, {
    key: 'post',
    value: function post() {}
  }, {
    key: 'addSmartListeners',
    value: function addSmartListeners(elKey, eventName, cb) {
      if (!this.smartListeners[elKey]) {
        this.smartListeners[elKey] = {};
      }

      this.smartListeners[elKey][eventName] = cb;
      this.domEl[elKey].addEventListener('click', cb);
    }
  }, {
    key: 'removeAllSmartListeners',
    value: function removeAllSmartListeners() {
      var _this = this;

      Object.keys(this.smartListeners).forEach(function (elKey) {
        Object.keys(_this.smartListeners[elKey]).forEach(function (eventName) {
          _this.domEl[elKey].removeEventListener(eventName, _this.smartListeners[elKey][eventName]);

          delete _this.smartListeners[elKey][eventName];
        });
      });
    }
  }, {
    key: 'assignDomElements',
    value: function assignDomElements() {
      for (var key in this.elementsQuery) {
        if (this.elementsQuery.hasOwnProperty(key)) {
          this.domEl[key] = this.config.targetEl.querySelector(this.elementsQuery[key]);
        }
      }
    }
  }, {
    key: 'removeElement',
    value: function removeElement() {
      this.removeAllSmartListeners();
      this.config.targetEl.parentNode.removeChild(this.config.targetEl);
    }
  }]);

  return Element;
}();

},{}],12:[function(require,module,exports){
module.exports = '<i class="fa fa-clock-o fa-10x fa-lg" aria-hidden="true"></i>\n' +
    '<p class="lead">Welcome at brand new timezone dashboard!<br> Click on the card to flip it!</p>\n' +
    '<form name="add-timezone" class="form-inline" onkeypress="return event.keyCode != 13" onSubmit="return false;">\n' +
    '  <select id="ddTimezone" class="form-control input-lg">\n' +
    '    {{~it.timezones :value:index}}\n' +
    '      <option value="{{=value}}">{{=value}}</option>\n' +
    '    {{~}}\n' +
    '  </select>\n' +
    '  <button type="submit" class="btn btn-primary btn-lg">Add timezone</button>\n' +
    '</form>';
},{}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NewTimezoneForm = exports.elementsQuery = exports.exceptionMsg = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _newTimezoneForm = require('./new-timezone-form.html');

var _newTimezoneForm2 = _interopRequireDefault(_newTimezoneForm);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _element = require('./../element/element.js');

var _dot = require('dot');

var _dot2 = _interopRequireDefault(_dot);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

exports.exceptionMsg = _element.exceptionMsg;
var elementsQuery = exports.elementsQuery = {
  submitButton: 'button[type="submit"]',
  selectList: '#ddTimezone'
};

var NewTimezoneForm = exports.NewTimezoneForm = function (_Element) {
  _inherits(NewTimezoneForm, _Element);

  function NewTimezoneForm() {
    var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, NewTimezoneForm);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(NewTimezoneForm).call(this, config, elementsQuery));

    _this.timezones = [];
    return _this;
  }

  _createClass(NewTimezoneForm, [{
    key: 'preRender',
    value: function preRender() {
      this.prepareTimeZoneList();
    }
  }, {
    key: 'render',
    value: function render() {
      var tempFn = _dot2.default.template(_newTimezoneForm2.default);

      this.config.targetEl.innerHTML = tempFn({
        timezones: this.timezones
      });
    }
  }, {
    key: 'prepareTimeZoneList',
    value: function prepareTimeZoneList() {
      this.timezones = _momentTimezone2.default.tz.names();
    }
  }, {
    key: 'addListeners',
    value: function addListeners() {
      this.addSmartListeners('submitButton', 'click', this.addTimezone.bind(this));
    }
  }, {
    key: 'addTimezone',
    value: function addTimezone() {
      var selectedIndex = this.domEl.selectList.selectedIndex;
      var currentValue = this.domEl.selectList.options[selectedIndex].value;

      if (this.config.onAddTimezone) {
        this.config.onAddTimezone(currentValue);
      }
    }
  }]);

  return NewTimezoneForm;
}(_element.Element);

},{"./../element/element.js":11,"./new-timezone-form.html":12,"dot":3,"moment-timezone":5}],14:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Observer = function () {
  function Observer() {
    _classCallCheck(this, Observer);

    this.registered = [];
  }

  _createClass(Observer, [{
    key: "register",
    value: function register(fn) {
      this.registered.push(fn);
    }
  }, {
    key: "unregister",
    value: function unregister(fn) {
      this.registered = this.registered.filter(function (item) {
        if (item !== fn) {
          return item;
        }

        return false;
      });
    }
  }, {
    key: "fire",
    value: function fire(value) {
      this.registered.forEach(function (fn) {
        fn(value);
      });
    }
  }]);

  return Observer;
}();

exports.Observer = Observer;

},{}],15:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StoreCurrentTime = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _observer = require('./../observer/observer.js');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var StoreCurrentTime = function (_Observer) {
  _inherits(StoreCurrentTime, _Observer);

  function StoreCurrentTime() {
    _classCallCheck(this, StoreCurrentTime);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(StoreCurrentTime).call(this));

    _this.value = (0, _momentTimezone2.default)();
    return _this;
  }

  _createClass(StoreCurrentTime, [{
    key: 'update',
    value: function update(newTime) {
      this.value = newTime;
      this.fire(this.value);
    }
  }]);

  return StoreCurrentTime;
}(_observer.Observer);

exports.StoreCurrentTime = StoreCurrentTime;

},{"./../observer/observer.js":14,"moment-timezone":5}],16:[function(require,module,exports){
module.exports = '<article class="timezone-card {{=it.cssClass}}">\n' +
    '  <div class="timezone-card__flip-container">\n' +
    '    <section class="timezone-card__front">\n' +
    '      <h2 class="timezone-card__time-container">{{=it.time}}</h2>\n' +
    '      <h4>{{=it.timezone}}</h4>\n' +
    '      <i class="fa fa-times fa-2x timezone-card__delete" aria-hidden="true"></i>\n' +
    '    </section>\n' +
    '    <section class="timezone-card__back">\n' +
    '      <form class="text-center" name="change-datetime" onkeypress="return event.keyCode != 13" onSubmit="return false;">\n' +
    '          <h3>Change time</h3>\n' +
    '          <input type="date" class="form-control input-md" value="{{=it.dateFormat}}" name="newDate">\n' +
    '          <input type="time" class="form-control input-md" value="{{=it.timeFormat}}" name="newTime">\n' +
    '          <button type="button" class="timezone-card__backButton btn btn-default">Back</button>\n' +
    '          <button type="submit" class="btn btn-md btn-primary">Change</button>\n' +
    '      </form>\n' +
    '    </section>\n' +
    '  </div>\n' +
    '</article>';
},{}],17:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TimezoneCard = exports.elementsQuery = exports.exceptionMsg = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _timezoneCard = require('./timezone-card.html');

var _timezoneCard2 = _interopRequireDefault(_timezoneCard);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _storeCurrentTime = require('./../store-current-time/store-current-time.js');

var _element = require('./../element/element.js');

var _dot = require('dot');

var _dot2 = _interopRequireDefault(_dot);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var exceptionMsgInternal = Object.assign({}, _element.exceptionMsg, {
  noStoreCurrentTime: 'Please pass store current time in config',
  wrongInstance: 'Store current time property should be instance of StoreCurrentTime',
  noTime: 'Please pass time value',
  noTimeZone: 'Please pass timezone'
});

var defaultCssClass = 'col-xs-12 col-sm-6 col-md-3 col-lg-2';

exports.exceptionMsg = exceptionMsgInternal;
var elementsQuery = exports.elementsQuery = {
  flipContainer: '.timezone-card__flip-container',
  timeContainer: '.timezone-card__time-container',
  deleteIcon: '.timezone-card__delete',
  backButton: '.timezone-card__backButton',
  dateInput: 'input[type="date"]',
  timeInput: 'input[type="time"]',
  changeButton: 'button[type="submit"]'
};

var TimezoneCard = exports.TimezoneCard = function (_Element) {
  _inherits(TimezoneCard, _Element);

  function TimezoneCard() {
    var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, TimezoneCard);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(TimezoneCard).call(this, config, elementsQuery));
  }

  _createClass(TimezoneCard, [{
    key: 'checkConfig',
    value: function checkConfig() {
      _get(Object.getPrototypeOf(TimezoneCard.prototype), 'checkConfig', this).call(this);
      if (!this.config.storeCurrentTime) {
        throw new Error(exceptionMsgInternal.noStoreCurrentTime);
      } else if (!(this.config.storeCurrentTime instanceof _storeCurrentTime.StoreCurrentTime)) {
        throw new Error(exceptionMsgInternal.wrongInstance);
      } else if (!this.config.time) {
        throw new Error(exceptionMsgInternal.noTime);
      } else if (!this.config.timezone) {
        throw new Error(exceptionMsgInternal.noTimeZone);
      }
    }
  }, {
    key: 'render',
    value: function render() {
      var tempFn = _dot2.default.template(_timezoneCard2.default);
      var div = document.createElement('div');
      var targetEl = this.config.targetEl;

      div.innerHTML = tempFn({
        time: this.config.time.clone().tz(this.config.timezone).format('lll'),
        dateFormat: this.config.time.clone().tz(this.config.timezone).format('YYYY-MM-DD'),
        timeFormat: this.config.time.clone().tz(this.config.timezone).format('hh:mm'),
        timezone: this.config.timezone,
        cssClass: this.config.cssClass || defaultCssClass
      });

      this.config.targetEl = div;
      targetEl.appendChild(div);
    }
  }, {
    key: 'post',
    value: function post() {
      _get(Object.getPrototypeOf(TimezoneCard.prototype), 'post', this).call(this);
      this.storeCurrentTime = this.config.storeCurrentTime;
      this.onCurrentTimeChange = this.onNewTime.bind(this);
      this.storeCurrentTime.register(this.onCurrentTimeChange);
    }
  }, {
    key: 'addListeners',
    value: function addListeners() {
      var _this2 = this;

      this.addSmartListeners('deleteIcon', 'click', this.removeElement.bind(this));
      this.addSmartListeners('changeButton', 'click', function () {
        var newDateTime = [_this2.domEl.dateInput.value, _this2.domEl.timeInput.value].join(' ');
        var newDateTimeMoment = _momentTimezone2.default.tz(newDateTime, _this2.config.timezone);

        _this2.storeCurrentTime.update(newDateTimeMoment);
      });
      this.addSmartListeners('flipContainer', 'click', function (e) {
        if (e.target.className === 'timezone-card__front' || e.target.className === 'timezone-card__back') {
          _this2.domEl.flipContainer.classList.toggle('timezone-card--flipped');
        }
      });
      this.addSmartListeners('backButton', 'click', function () {
        _this2.domEl.flipContainer.classList.toggle('timezone-card--flipped');
      });
    }
  }, {
    key: 'removeElement',
    value: function removeElement() {
      _get(Object.getPrototypeOf(TimezoneCard.prototype), 'removeElement', this).call(this);
      this.storeCurrentTime.unregister(this.onCurrentTimeChange);
    }
  }, {
    key: 'onNewTime',
    value: function onNewTime(newMomentTime) {
      this.updateTime(newMomentTime);
    }
  }, {
    key: 'updateTime',
    value: function updateTime(time) {
      this.config.time = time.clone().tz(this.config.timezone).format('lll');
      this.domEl.timeContainer.innerHTML = this.config.time;
    }
  }]);

  return TimezoneCard;
}(_element.Element);

},{"./../element/element.js":11,"./../store-current-time/store-current-time.js":15,"./timezone-card.html":16,"dot":3,"moment-timezone":5}]},{},[8])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9saWIvX2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2RvdC9kb1QuanMiLCJub2RlX21vZHVsZXMvZG90L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL21vbWVudC10aW1lem9uZS9kYXRhL3BhY2tlZC9sYXRlc3QuanNvbiIsIm5vZGVfbW9kdWxlcy9tb21lbnQtdGltZXpvbmUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbW9tZW50LXRpbWV6b25lL21vbWVudC10aW1lem9uZS5qcyIsIm5vZGVfbW9kdWxlcy9tb21lbnQvbW9tZW50LmpzIiwic3JjL2FwcC5qcyIsInNyYy9kYXNoYm9hcmQvZGFzaGJvYXJkLmh0bWwiLCJzcmMvZGFzaGJvYXJkL2Rhc2hib2FyZC5qcyIsInNyYy9kYXNoYm9hcmQvZWxlbWVudC9lbGVtZW50LmpzIiwic3JjL2Rhc2hib2FyZC9uZXctdGltZXpvbmUtZm9ybS9uZXctdGltZXpvbmUtZm9ybS5odG1sIiwic3JjL2Rhc2hib2FyZC9uZXctdGltZXpvbmUtZm9ybS9uZXctdGltZXpvbmUtZm9ybS5qcyIsInNyYy9kYXNoYm9hcmQvb2JzZXJ2ZXIvb2JzZXJ2ZXIuanMiLCJzcmMvZGFzaGJvYXJkL3N0b3JlLWN1cnJlbnQtdGltZS9zdG9yZS1jdXJyZW50LXRpbWUuanMiLCJzcmMvZGFzaGJvYXJkL3RpbWV6b25lLWNhcmQvdGltZXpvbmUtY2FyZC5odG1sIiwic3JjL2Rhc2hib2FyZC90aW1lem9uZS1jYXJkL3RpbWV6b25lLWNhcmQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbGxCQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6bEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7OztBQ3Y4SEE7Ozs7QUFFQSxJQUFNLFNBQVM7QUFDYixZQUFVLFNBQVMsYUFBVCxDQUF1QixlQUF2QjtBQURHLENBQWY7O0lBSU0sRyxHQUNKLGVBQWM7QUFBQTs7QUFDWixPQUFLLFNBQUwsR0FBaUIseUJBQWMsTUFBZCxDQUFqQjtBQUNELEM7O0FBR0gsSUFBSSxDQUFDLE9BQU8sU0FBWixFQUF1QjtBQUNyQixNQUFNLE1BQU0sSUFBSSxHQUFKLEVBQVosQztBQUNEOztRQUVPLEcsR0FBQSxHO1FBQUssTSxHQUFBLE07OztBQ2hCYjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7Ozs7O0FDUEE7Ozs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7OztBQUNBOzs7Ozs7Ozs7Ozs7UUFFUSxZO0FBRUQsSUFBTSx3Q0FBZ0I7QUFDM0IsbUJBQWlCLDJCQURVO0FBRTNCLGtCQUFnQix5QkFGVztBQUczQix5QkFBdUI7QUFISSxDQUF0Qjs7SUFNTSxTLFdBQUEsUzs7O0FBQ1gsdUJBQXlCO0FBQUEsUUFBYixNQUFhLHlEQUFKLEVBQUk7O0FBQUE7O0FBQUEsNkZBQ2pCLE1BRGlCLEVBQ1QsYUFEUzs7QUFFdkIsVUFBSyxTQUFMLEdBQWlCLEVBQWpCO0FBRnVCO0FBR3hCOzs7OzZCQUVRO0FBQ1A7QUFDQSxXQUFLLE1BQUwsQ0FBWSxRQUFaLENBQXFCLFNBQXJCLEdBQWlDLGNBQUksUUFBSix1QkFBakM7QUFDRDs7OzJCQUVNO0FBQ0w7QUFDQSxXQUFLLGdCQUFMLEdBQXdCLHdDQUF4QjtBQUNBLFdBQUssV0FBTDtBQUNEOzs7a0NBRWE7QUFDWixXQUFLLGtCQUFMO0FBQ0EsV0FBSyxpQkFBTDtBQUNEOzs7eUNBRW9CO0FBQ25CLDJDQUFvQjtBQUNsQixrQkFBVSxLQUFLLEtBQUwsQ0FBVyxjQURIO0FBRWxCLHVCQUFlLEtBQUssY0FBTCxDQUFvQixJQUFwQixDQUF5QixJQUF6QjtBQUZHLE9BQXBCO0FBSUQ7Ozt3Q0FFbUI7QUFDbEIscUNBQWlCO0FBQ2Ysa0JBQVUsS0FBSyxLQUFMLENBQVcsZUFETjtBQUVmLGtCQUFVLG9CQUZLO0FBR2YsY0FBTSxLQUFLLGdCQUFMLENBQXNCLEtBSGI7QUFJZixrQkFBVSx5QkFBTyxFQUFQLENBQVUsS0FBVixFQUpLO0FBS2YsMEJBQWtCLEtBQUs7QUFMUixPQUFqQjtBQU9BLHFDQUFpQjtBQUNmLGtCQUFVLEtBQUssS0FBTCxDQUFXLGVBRE47QUFFZixrQkFBVSxvQkFGSztBQUdmLGNBQU0sS0FBSyxnQkFBTCxDQUFzQixLQUhiO0FBSWYsa0JBQVUsS0FKSztBQUtmLDBCQUFrQixLQUFLO0FBTFIsT0FBakI7QUFPRDs7O21DQUVjLEssRUFBTztBQUNwQixxQ0FBaUI7QUFDZixrQkFBVSxLQUFLLEtBQUwsQ0FBVyxxQkFETjtBQUVmLGNBQU0sS0FBSyxnQkFBTCxDQUFzQixLQUZiO0FBR2Ysa0JBQVUsS0FISztBQUlmLDBCQUFrQixLQUFLO0FBSlIsT0FBakI7QUFNRDs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNyRUksSUFBTSxzQ0FBZTtBQUMxQixjQUFZLGtEQURjO0FBRTFCLGlCQUFlO0FBRlcsQ0FBckI7O0lBS00sTyxXQUFBLE87QUFDWCxxQkFBNkM7QUFBQSxRQUFqQyxNQUFpQyx5REFBeEIsRUFBd0I7QUFBQSxRQUFwQixhQUFvQix5REFBSixFQUFJOztBQUFBOztBQUMzQyxTQUFLLE1BQUwsR0FBYyxNQUFkO0FBQ0EsU0FBSyxhQUFMLEdBQXFCLGFBQXJCO0FBQ0EsU0FBSyxXQUFMO0FBQ0EsU0FBSyxLQUFMLEdBQWEsRUFBYjs7O0FBR0EsU0FBSyxTQUFMO0FBQ0EsU0FBSyxNQUFMO0FBQ0EsU0FBSyxVQUFMO0FBQ0EsU0FBSyxpQkFBTDtBQUNBLFNBQUssSUFBTDs7QUFFQSxTQUFLLGNBQUwsR0FBc0IsRUFBdEI7QUFDQSxTQUFLLFlBQUw7QUFDRDs7OztrQ0FFYTtBQUNaLFVBQUksQ0FBQyxLQUFLLE1BQUwsQ0FBWSxRQUFqQixFQUEyQjtBQUN6QixjQUFNLElBQUksS0FBSixDQUFVLGFBQWEsVUFBdkIsQ0FBTjtBQUNELE9BRkQsTUFFTyxJQUFJLEtBQUssTUFBTCxDQUFZLFFBQVosSUFBd0IsQ0FBQyxLQUFLLE1BQUwsQ0FBWSxRQUFaLENBQXFCLE9BQWxELEVBQTJEO0FBQ2hFLGNBQU0sSUFBSSxLQUFKLENBQVUsYUFBYSxhQUF2QixDQUFOO0FBQ0Q7QUFDRjs7O2dDQUVXLENBQUU7Ozs2QkFFTCxDQUFFOzs7aUNBRUUsQ0FBRTs7O21DQUVBLENBQUU7OzsyQkFFVixDQUFFOzs7c0NBRVMsSyxFQUFPLFMsRUFBVyxFLEVBQUk7QUFDdEMsVUFBSSxDQUFDLEtBQUssY0FBTCxDQUFvQixLQUFwQixDQUFMLEVBQWlDO0FBQy9CLGFBQUssY0FBTCxDQUFvQixLQUFwQixJQUE2QixFQUE3QjtBQUNEOztBQUVELFdBQUssY0FBTCxDQUFvQixLQUFwQixFQUEyQixTQUEzQixJQUF3QyxFQUF4QztBQUNBLFdBQUssS0FBTCxDQUFXLEtBQVgsRUFBa0IsZ0JBQWxCLENBQW1DLE9BQW5DLEVBQTRDLEVBQTVDO0FBQ0Q7Ozs4Q0FFeUI7QUFBQTs7QUFDeEIsYUFBTyxJQUFQLENBQVksS0FBSyxjQUFqQixFQUFpQyxPQUFqQyxDQUF5QyxVQUFDLEtBQUQsRUFBVztBQUNsRCxlQUFPLElBQVAsQ0FBWSxNQUFLLGNBQUwsQ0FBb0IsS0FBcEIsQ0FBWixFQUF3QyxPQUF4QyxDQUFnRCxVQUFDLFNBQUQsRUFBZTtBQUM3RCxnQkFBSyxLQUFMLENBQVcsS0FBWCxFQUNHLG1CQURILENBRUksU0FGSixFQUdJLE1BQUssY0FBTCxDQUFvQixLQUFwQixFQUEyQixTQUEzQixDQUhKOztBQU1BLGlCQUFPLE1BQUssY0FBTCxDQUFvQixLQUFwQixFQUEyQixTQUEzQixDQUFQO0FBQ0QsU0FSRDtBQVNELE9BVkQ7QUFXRDs7O3dDQUVtQjtBQUNsQixXQUFLLElBQUksR0FBVCxJQUFnQixLQUFLLGFBQXJCLEVBQW9DO0FBQ2xDLFlBQUksS0FBSyxhQUFMLENBQW1CLGNBQW5CLENBQWtDLEdBQWxDLENBQUosRUFBNEM7QUFDMUMsZUFBSyxLQUFMLENBQVcsR0FBWCxJQUFrQixLQUFLLE1BQUwsQ0FDZixRQURlLENBRWYsYUFGZSxDQUVELEtBQUssYUFBTCxDQUFtQixHQUFuQixDQUZDLENBQWxCO0FBR0Q7QUFDRjtBQUNGOzs7b0NBRWU7QUFDZCxXQUFLLHVCQUFMO0FBQ0EsV0FBSyxNQUFMLENBQVksUUFBWixDQUFxQixVQUFyQixDQUFnQyxXQUFoQyxDQUE0QyxLQUFLLE1BQUwsQ0FBWSxRQUF4RDtBQUNEOzs7Ozs7O0FDN0VIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7OztBQ1RBOzs7O0FBQ0E7Ozs7QUFDQTs7QUFDQTs7Ozs7Ozs7Ozs7O1FBRVEsWTtBQUVELElBQU0sd0NBQWdCO0FBQzNCLGdCQUFjLHVCQURhO0FBRTNCLGNBQVk7QUFGZSxDQUF0Qjs7SUFLTSxlLFdBQUEsZTs7O0FBQ1gsNkJBQXlCO0FBQUEsUUFBYixNQUFhLHlEQUFKLEVBQUk7O0FBQUE7O0FBQUEsbUdBQ2pCLE1BRGlCLEVBQ1QsYUFEUzs7QUFFdkIsVUFBSyxTQUFMLEdBQWlCLEVBQWpCO0FBRnVCO0FBR3hCOzs7O2dDQUVXO0FBQ1YsV0FBSyxtQkFBTDtBQUNEOzs7NkJBRVE7QUFDUCxVQUFJLFNBQVMsY0FBSSxRQUFKLDJCQUFiOztBQUVBLFdBQUssTUFBTCxDQUFZLFFBQVosQ0FBcUIsU0FBckIsR0FBaUMsT0FBTztBQUN0QyxtQkFBVyxLQUFLO0FBRHNCLE9BQVAsQ0FBakM7QUFHRDs7OzBDQUVxQjtBQUNwQixXQUFLLFNBQUwsR0FBaUIseUJBQU8sRUFBUCxDQUFVLEtBQVYsRUFBakI7QUFDRDs7O21DQUVjO0FBQ2IsV0FBSyxpQkFBTCxDQUF1QixjQUF2QixFQUF1QyxPQUF2QyxFQUFnRCxLQUFLLFdBQUwsQ0FBaUIsSUFBakIsQ0FBc0IsSUFBdEIsQ0FBaEQ7QUFDRDs7O2tDQUVhO0FBQ1osVUFBSSxnQkFBZ0IsS0FBSyxLQUFMLENBQVcsVUFBWCxDQUFzQixhQUExQztBQUNBLFVBQUksZUFBZSxLQUFLLEtBQUwsQ0FBVyxVQUFYLENBQXNCLE9BQXRCLENBQThCLGFBQTlCLEVBQTZDLEtBQWhFOztBQUVBLFVBQUksS0FBSyxNQUFMLENBQVksYUFBaEIsRUFBK0I7QUFDN0IsYUFBSyxNQUFMLENBQVksYUFBWixDQUEwQixZQUExQjtBQUNEO0FBQ0Y7Ozs7Ozs7Ozs7Ozs7Ozs7O0lDN0NHLFE7QUFDSixzQkFBYztBQUFBOztBQUNaLFNBQUssVUFBTCxHQUFrQixFQUFsQjtBQUNEOzs7OzZCQUVRLEUsRUFBSTtBQUNYLFdBQUssVUFBTCxDQUFnQixJQUFoQixDQUFxQixFQUFyQjtBQUNEOzs7K0JBRVUsRSxFQUFJO0FBQ2IsV0FBSyxVQUFMLEdBQWtCLEtBQUssVUFBTCxDQUFnQixNQUFoQixDQUF1QixVQUFDLElBQUQsRUFBVTtBQUNqRCxZQUFJLFNBQVMsRUFBYixFQUFpQjtBQUNmLGlCQUFPLElBQVA7QUFDRDs7QUFFRCxlQUFPLEtBQVA7QUFDRCxPQU5pQixDQUFsQjtBQU9EOzs7eUJBRUksSyxFQUFPO0FBQ1YsV0FBSyxVQUFMLENBQWdCLE9BQWhCLENBQXdCLFVBQUMsRUFBRCxFQUFRO0FBQzlCLFdBQUcsS0FBSDtBQUNELE9BRkQ7QUFHRDs7Ozs7O1FBSUssUSxHQUFBLFE7Ozs7Ozs7Ozs7OztBQzNCUjs7QUFDQTs7Ozs7Ozs7Ozs7O0lBRU0sZ0I7OztBQUNKLDhCQUFjO0FBQUE7O0FBQUE7O0FBRVosVUFBSyxLQUFMLEdBQWEsK0JBQWI7QUFGWTtBQUdiOzs7OzJCQUVNLE8sRUFBUztBQUNkLFdBQUssS0FBTCxHQUFhLE9BQWI7QUFDQSxXQUFLLElBQUwsQ0FBVSxLQUFLLEtBQWY7QUFDRDs7Ozs7O1FBR0ssZ0IsR0FBQSxnQjs7O0FDZlI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7Ozs7O0FDakJBOzs7O0FBQ0E7Ozs7QUFDQTs7QUFDQTs7QUFDQTs7Ozs7Ozs7Ozs7O0FBRUEsSUFBTSx1QkFBdUIsT0FBTyxNQUFQLENBQWMsRUFBZCx5QkFBZ0M7QUFDM0Qsc0JBQW9CLDBDQUR1QztBQUUzRCxpQkFBZSxvRUFGNEM7QUFHM0QsVUFBUSx3QkFIbUQ7QUFJM0QsY0FBWTtBQUorQyxDQUFoQyxDQUE3Qjs7QUFPQSxJQUFNLGtCQUFrQixzQ0FBeEI7O1FBRWdDLFksR0FBeEIsb0I7QUFFRCxJQUFNLHdDQUFnQjtBQUMzQixpQkFBZSxnQ0FEWTtBQUUzQixpQkFBZSxnQ0FGWTtBQUczQixjQUFZLHdCQUhlO0FBSTNCLGNBQVksNEJBSmU7QUFLM0IsYUFBVyxvQkFMZ0I7QUFNM0IsYUFBVyxvQkFOZ0I7QUFPM0IsZ0JBQWM7QUFQYSxDQUF0Qjs7SUFVTSxZLFdBQUEsWTs7O0FBQ1gsMEJBQXlCO0FBQUEsUUFBYixNQUFhLHlEQUFKLEVBQUk7O0FBQUE7O0FBQUEsMkZBQ2pCLE1BRGlCLEVBQ1QsYUFEUztBQUV4Qjs7OztrQ0FFYTtBQUNaO0FBQ0EsVUFBSSxDQUFDLEtBQUssTUFBTCxDQUFZLGdCQUFqQixFQUFtQztBQUNqQyxjQUFNLElBQUksS0FBSixDQUFVLHFCQUFxQixrQkFBL0IsQ0FBTjtBQUNELE9BRkQsTUFFTyxJQUFJLEVBQUUsS0FBSyxNQUFMLENBQVksZ0JBQVosOENBQUYsQ0FBSixFQUFpRTtBQUN0RSxjQUFNLElBQUksS0FBSixDQUFVLHFCQUFxQixhQUEvQixDQUFOO0FBQ0QsT0FGTSxNQUVBLElBQUksQ0FBQyxLQUFLLE1BQUwsQ0FBWSxJQUFqQixFQUF1QjtBQUM1QixjQUFNLElBQUksS0FBSixDQUFVLHFCQUFxQixNQUEvQixDQUFOO0FBQ0QsT0FGTSxNQUVBLElBQUksQ0FBQyxLQUFLLE1BQUwsQ0FBWSxRQUFqQixFQUEyQjtBQUNoQyxjQUFNLElBQUksS0FBSixDQUFVLHFCQUFxQixVQUEvQixDQUFOO0FBQ0Q7QUFDRjs7OzZCQUVRO0FBQ1AsVUFBSSxTQUFTLGNBQUksUUFBSix3QkFBYjtBQUNBLFVBQUksTUFBTSxTQUFTLGFBQVQsQ0FBdUIsS0FBdkIsQ0FBVjtBQUNBLFVBQUksV0FBVyxLQUFLLE1BQUwsQ0FBWSxRQUEzQjs7QUFFQSxVQUFJLFNBQUosR0FBZ0IsT0FBTztBQUNyQixjQUFNLEtBQUssTUFBTCxDQUFZLElBQVosQ0FBaUIsS0FBakIsR0FBeUIsRUFBekIsQ0FBNEIsS0FBSyxNQUFMLENBQVksUUFBeEMsRUFBa0QsTUFBbEQsQ0FBeUQsS0FBekQsQ0FEZTtBQUVyQixvQkFBWSxLQUFLLE1BQUwsQ0FBWSxJQUFaLENBQWlCLEtBQWpCLEdBQXlCLEVBQXpCLENBQTRCLEtBQUssTUFBTCxDQUFZLFFBQXhDLEVBQWtELE1BQWxELENBQXlELFlBQXpELENBRlM7QUFHckIsb0JBQVksS0FBSyxNQUFMLENBQVksSUFBWixDQUFpQixLQUFqQixHQUF5QixFQUF6QixDQUE0QixLQUFLLE1BQUwsQ0FBWSxRQUF4QyxFQUFrRCxNQUFsRCxDQUF5RCxPQUF6RCxDQUhTO0FBSXJCLGtCQUFVLEtBQUssTUFBTCxDQUFZLFFBSkQ7QUFLckIsa0JBQVUsS0FBSyxNQUFMLENBQVksUUFBWixJQUF3QjtBQUxiLE9BQVAsQ0FBaEI7O0FBUUEsV0FBSyxNQUFMLENBQVksUUFBWixHQUF1QixHQUF2QjtBQUNBLGVBQVMsV0FBVCxDQUFxQixHQUFyQjtBQUNEOzs7MkJBRU07QUFDTDtBQUNBLFdBQUssZ0JBQUwsR0FBd0IsS0FBSyxNQUFMLENBQVksZ0JBQXBDO0FBQ0EsV0FBSyxtQkFBTCxHQUEyQixLQUFLLFNBQUwsQ0FBZSxJQUFmLENBQW9CLElBQXBCLENBQTNCO0FBQ0EsV0FBSyxnQkFBTCxDQUFzQixRQUF0QixDQUErQixLQUFLLG1CQUFwQztBQUNEOzs7bUNBRWM7QUFBQTs7QUFDYixXQUFLLGlCQUFMLENBQXVCLFlBQXZCLEVBQXFDLE9BQXJDLEVBQThDLEtBQUssYUFBTCxDQUFtQixJQUFuQixDQUF3QixJQUF4QixDQUE5QztBQUNBLFdBQUssaUJBQUwsQ0FBdUIsY0FBdkIsRUFBdUMsT0FBdkMsRUFBZ0QsWUFBTTtBQUNwRCxZQUFJLGNBQWMsQ0FDaEIsT0FBSyxLQUFMLENBQVcsU0FBWCxDQUFxQixLQURMLEVBRWhCLE9BQUssS0FBTCxDQUFXLFNBQVgsQ0FBcUIsS0FGTCxFQUdoQixJQUhnQixDQUdYLEdBSFcsQ0FBbEI7QUFJQSxZQUFJLG9CQUFvQix5QkFBTyxFQUFQLENBQVUsV0FBVixFQUF1QixPQUFLLE1BQUwsQ0FBWSxRQUFuQyxDQUF4Qjs7QUFFQSxlQUFLLGdCQUFMLENBQXNCLE1BQXRCLENBQTZCLGlCQUE3QjtBQUNELE9BUkQ7QUFTQSxXQUFLLGlCQUFMLENBQXVCLGVBQXZCLEVBQXdDLE9BQXhDLEVBQWlELFVBQUMsQ0FBRCxFQUFPO0FBQ3RELFlBQUksRUFBRSxNQUFGLENBQVMsU0FBVCxLQUF1QixzQkFBdkIsSUFDQSxFQUFFLE1BQUYsQ0FBUyxTQUFULEtBQXVCLHFCQUQzQixFQUNrRDtBQUNoRCxpQkFBSyxLQUFMLENBQVcsYUFBWCxDQUF5QixTQUF6QixDQUFtQyxNQUFuQyxDQUEwQyx3QkFBMUM7QUFDRDtBQUNGLE9BTEQ7QUFNQSxXQUFLLGlCQUFMLENBQXVCLFlBQXZCLEVBQXFDLE9BQXJDLEVBQThDLFlBQU07QUFDbEQsZUFBSyxLQUFMLENBQVcsYUFBWCxDQUF5QixTQUF6QixDQUFtQyxNQUFuQyxDQUEwQyx3QkFBMUM7QUFDRCxPQUZEO0FBR0Q7OztvQ0FFZTtBQUNkO0FBQ0EsV0FBSyxnQkFBTCxDQUFzQixVQUF0QixDQUFpQyxLQUFLLG1CQUF0QztBQUNEOzs7OEJBRVMsYSxFQUFlO0FBQ3ZCLFdBQUssVUFBTCxDQUFnQixhQUFoQjtBQUNEOzs7K0JBRVUsSSxFQUFNO0FBQ2YsV0FBSyxNQUFMLENBQVksSUFBWixHQUFtQixLQUFLLEtBQUwsR0FBYSxFQUFiLENBQWdCLEtBQUssTUFBTCxDQUFZLFFBQTVCLEVBQXNDLE1BQXRDLENBQTZDLEtBQTdDLENBQW5CO0FBQ0EsV0FBSyxLQUFMLENBQVcsYUFBWCxDQUF5QixTQUF6QixHQUFxQyxLQUFLLE1BQUwsQ0FBWSxJQUFqRDtBQUNEIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIiIsIi8vIGRvVC5qc1xuLy8gMjAxMS0yMDE0LCBMYXVyYSBEb2t0b3JvdmEsIGh0dHBzOi8vZ2l0aHViLmNvbS9vbGFkby9kb1Rcbi8vIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cblxuKGZ1bmN0aW9uKCkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgZG9UID0ge1xuXHRcdHZlcnNpb246IFwiMS4wLjNcIixcblx0XHR0ZW1wbGF0ZVNldHRpbmdzOiB7XG5cdFx0XHRldmFsdWF0ZTogICAgL1xce1xceyhbXFxzXFxTXSs/KFxcfT8pKylcXH1cXH0vZyxcblx0XHRcdGludGVycG9sYXRlOiAvXFx7XFx7PShbXFxzXFxTXSs/KVxcfVxcfS9nLFxuXHRcdFx0ZW5jb2RlOiAgICAgIC9cXHtcXHshKFtcXHNcXFNdKz8pXFx9XFx9L2csXG5cdFx0XHR1c2U6ICAgICAgICAgL1xce1xceyMoW1xcc1xcU10rPylcXH1cXH0vZyxcblx0XHRcdHVzZVBhcmFtczogICAvKF58W15cXHckXSlkZWYoPzpcXC58XFxbW1xcJ1xcXCJdKShbXFx3JFxcLl0rKSg/OltcXCdcXFwiXVxcXSk/XFxzKlxcOlxccyooW1xcdyRcXC5dK3xcXFwiW15cXFwiXStcXFwifFxcJ1teXFwnXStcXCd8XFx7W15cXH1dK1xcfSkvZyxcblx0XHRcdGRlZmluZTogICAgICAvXFx7XFx7IyNcXHMqKFtcXHdcXC4kXSspXFxzKihcXDp8PSkoW1xcc1xcU10rPykjXFx9XFx9L2csXG5cdFx0XHRkZWZpbmVQYXJhbXM6L15cXHMqKFtcXHckXSspOihbXFxzXFxTXSspLyxcblx0XHRcdGNvbmRpdGlvbmFsOiAvXFx7XFx7XFw/KFxcPyk/XFxzKihbXFxzXFxTXSo/KVxccypcXH1cXH0vZyxcblx0XHRcdGl0ZXJhdGU6ICAgICAvXFx7XFx7flxccyooPzpcXH1cXH18KFtcXHNcXFNdKz8pXFxzKlxcOlxccyooW1xcdyRdKylcXHMqKD86XFw6XFxzKihbXFx3JF0rKSk/XFxzKlxcfVxcfSkvZyxcblx0XHRcdHZhcm5hbWU6XHRcIml0XCIsXG5cdFx0XHRzdHJpcDpcdFx0dHJ1ZSxcblx0XHRcdGFwcGVuZDpcdFx0dHJ1ZSxcblx0XHRcdHNlbGZjb250YWluZWQ6IGZhbHNlLFxuXHRcdFx0ZG9Ob3RTa2lwRW5jb2RlZDogZmFsc2Vcblx0XHR9LFxuXHRcdHRlbXBsYXRlOiB1bmRlZmluZWQsIC8vZm4sIGNvbXBpbGUgdGVtcGxhdGVcblx0XHRjb21waWxlOiAgdW5kZWZpbmVkICAvL2ZuLCBmb3IgZXhwcmVzc1xuXHR9LCBfZ2xvYmFscztcblxuXHRkb1QuZW5jb2RlSFRNTFNvdXJjZSA9IGZ1bmN0aW9uKGRvTm90U2tpcEVuY29kZWQpIHtcblx0XHR2YXIgZW5jb2RlSFRNTFJ1bGVzID0geyBcIiZcIjogXCImIzM4O1wiLCBcIjxcIjogXCImIzYwO1wiLCBcIj5cIjogXCImIzYyO1wiLCAnXCInOiBcIiYjMzQ7XCIsIFwiJ1wiOiBcIiYjMzk7XCIsIFwiL1wiOiBcIiYjNDc7XCIgfSxcblx0XHRcdG1hdGNoSFRNTCA9IGRvTm90U2tpcEVuY29kZWQgPyAvWyY8PlwiJ1xcL10vZyA6IC8mKD8hIz9cXHcrOyl8PHw+fFwifCd8XFwvL2c7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKGNvZGUpIHtcblx0XHRcdHJldHVybiBjb2RlID8gY29kZS50b1N0cmluZygpLnJlcGxhY2UobWF0Y2hIVE1MLCBmdW5jdGlvbihtKSB7cmV0dXJuIGVuY29kZUhUTUxSdWxlc1ttXSB8fCBtO30pIDogXCJcIjtcblx0XHR9O1xuXHR9O1xuXG5cdF9nbG9iYWxzID0gKGZ1bmN0aW9uKCl7IHJldHVybiB0aGlzIHx8ICgwLGV2YWwpKFwidGhpc1wiKTsgfSgpKTtcblxuXHRpZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cykge1xuXHRcdG1vZHVsZS5leHBvcnRzID0gZG9UO1xuXHR9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kKSB7XG5cdFx0ZGVmaW5lKGZ1bmN0aW9uKCl7cmV0dXJuIGRvVDt9KTtcblx0fSBlbHNlIHtcblx0XHRfZ2xvYmFscy5kb1QgPSBkb1Q7XG5cdH1cblxuXHR2YXIgc3RhcnRlbmQgPSB7XG5cdFx0YXBwZW5kOiB7IHN0YXJ0OiBcIicrKFwiLCAgICAgIGVuZDogXCIpKydcIiwgICAgICBzdGFydGVuY29kZTogXCInK2VuY29kZUhUTUwoXCIgfSxcblx0XHRzcGxpdDogIHsgc3RhcnQ6IFwiJztvdXQrPShcIiwgZW5kOiBcIik7b3V0Kz0nXCIsIHN0YXJ0ZW5jb2RlOiBcIic7b3V0Kz1lbmNvZGVIVE1MKFwiIH1cblx0fSwgc2tpcCA9IC8kXi87XG5cblx0ZnVuY3Rpb24gcmVzb2x2ZURlZnMoYywgYmxvY2ssIGRlZikge1xuXHRcdHJldHVybiAoKHR5cGVvZiBibG9jayA9PT0gXCJzdHJpbmdcIikgPyBibG9jayA6IGJsb2NrLnRvU3RyaW5nKCkpXG5cdFx0LnJlcGxhY2UoYy5kZWZpbmUgfHwgc2tpcCwgZnVuY3Rpb24obSwgY29kZSwgYXNzaWduLCB2YWx1ZSkge1xuXHRcdFx0aWYgKGNvZGUuaW5kZXhPZihcImRlZi5cIikgPT09IDApIHtcblx0XHRcdFx0Y29kZSA9IGNvZGUuc3Vic3RyaW5nKDQpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCEoY29kZSBpbiBkZWYpKSB7XG5cdFx0XHRcdGlmIChhc3NpZ24gPT09IFwiOlwiKSB7XG5cdFx0XHRcdFx0aWYgKGMuZGVmaW5lUGFyYW1zKSB2YWx1ZS5yZXBsYWNlKGMuZGVmaW5lUGFyYW1zLCBmdW5jdGlvbihtLCBwYXJhbSwgdikge1xuXHRcdFx0XHRcdFx0ZGVmW2NvZGVdID0ge2FyZzogcGFyYW0sIHRleHQ6IHZ9O1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGlmICghKGNvZGUgaW4gZGVmKSkgZGVmW2NvZGVdPSB2YWx1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRuZXcgRnVuY3Rpb24oXCJkZWZcIiwgXCJkZWZbJ1wiK2NvZGUrXCInXT1cIiArIHZhbHVlKShkZWYpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gXCJcIjtcblx0XHR9KVxuXHRcdC5yZXBsYWNlKGMudXNlIHx8IHNraXAsIGZ1bmN0aW9uKG0sIGNvZGUpIHtcblx0XHRcdGlmIChjLnVzZVBhcmFtcykgY29kZSA9IGNvZGUucmVwbGFjZShjLnVzZVBhcmFtcywgZnVuY3Rpb24obSwgcywgZCwgcGFyYW0pIHtcblx0XHRcdFx0aWYgKGRlZltkXSAmJiBkZWZbZF0uYXJnICYmIHBhcmFtKSB7XG5cdFx0XHRcdFx0dmFyIHJ3ID0gKGQrXCI6XCIrcGFyYW0pLnJlcGxhY2UoLyd8XFxcXC9nLCBcIl9cIik7XG5cdFx0XHRcdFx0ZGVmLl9fZXhwID0gZGVmLl9fZXhwIHx8IHt9O1xuXHRcdFx0XHRcdGRlZi5fX2V4cFtyd10gPSBkZWZbZF0udGV4dC5yZXBsYWNlKG5ldyBSZWdFeHAoXCIoXnxbXlxcXFx3JF0pXCIgKyBkZWZbZF0uYXJnICsgXCIoW15cXFxcdyRdKVwiLCBcImdcIiksIFwiJDFcIiArIHBhcmFtICsgXCIkMlwiKTtcblx0XHRcdFx0XHRyZXR1cm4gcyArIFwiZGVmLl9fZXhwWydcIitydytcIiddXCI7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0dmFyIHYgPSBuZXcgRnVuY3Rpb24oXCJkZWZcIiwgXCJyZXR1cm4gXCIgKyBjb2RlKShkZWYpO1xuXHRcdFx0cmV0dXJuIHYgPyByZXNvbHZlRGVmcyhjLCB2LCBkZWYpIDogdjtcblx0XHR9KTtcblx0fVxuXG5cdGZ1bmN0aW9uIHVuZXNjYXBlKGNvZGUpIHtcblx0XHRyZXR1cm4gY29kZS5yZXBsYWNlKC9cXFxcKCd8XFxcXCkvZywgXCIkMVwiKS5yZXBsYWNlKC9bXFxyXFx0XFxuXS9nLCBcIiBcIik7XG5cdH1cblxuXHRkb1QudGVtcGxhdGUgPSBmdW5jdGlvbih0bXBsLCBjLCBkZWYpIHtcblx0XHRjID0gYyB8fCBkb1QudGVtcGxhdGVTZXR0aW5ncztcblx0XHR2YXIgY3NlID0gYy5hcHBlbmQgPyBzdGFydGVuZC5hcHBlbmQgOiBzdGFydGVuZC5zcGxpdCwgbmVlZGh0bWxlbmNvZGUsIHNpZCA9IDAsIGluZHYsXG5cdFx0XHRzdHIgID0gKGMudXNlIHx8IGMuZGVmaW5lKSA/IHJlc29sdmVEZWZzKGMsIHRtcGwsIGRlZiB8fCB7fSkgOiB0bXBsO1xuXG5cdFx0c3RyID0gKFwidmFyIG91dD0nXCIgKyAoYy5zdHJpcCA/IHN0ci5yZXBsYWNlKC8oXnxcXHJ8XFxuKVxcdCogK3wgK1xcdCooXFxyfFxcbnwkKS9nLFwiIFwiKVxuXHRcdFx0XHRcdC5yZXBsYWNlKC9cXHJ8XFxufFxcdHxcXC9cXCpbXFxzXFxTXSo/XFwqXFwvL2csXCJcIik6IHN0cilcblx0XHRcdC5yZXBsYWNlKC8nfFxcXFwvZywgXCJcXFxcJCZcIilcblx0XHRcdC5yZXBsYWNlKGMuaW50ZXJwb2xhdGUgfHwgc2tpcCwgZnVuY3Rpb24obSwgY29kZSkge1xuXHRcdFx0XHRyZXR1cm4gY3NlLnN0YXJ0ICsgdW5lc2NhcGUoY29kZSkgKyBjc2UuZW5kO1xuXHRcdFx0fSlcblx0XHRcdC5yZXBsYWNlKGMuZW5jb2RlIHx8IHNraXAsIGZ1bmN0aW9uKG0sIGNvZGUpIHtcblx0XHRcdFx0bmVlZGh0bWxlbmNvZGUgPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm4gY3NlLnN0YXJ0ZW5jb2RlICsgdW5lc2NhcGUoY29kZSkgKyBjc2UuZW5kO1xuXHRcdFx0fSlcblx0XHRcdC5yZXBsYWNlKGMuY29uZGl0aW9uYWwgfHwgc2tpcCwgZnVuY3Rpb24obSwgZWxzZWNhc2UsIGNvZGUpIHtcblx0XHRcdFx0cmV0dXJuIGVsc2VjYXNlID9cblx0XHRcdFx0XHQoY29kZSA/IFwiJzt9ZWxzZSBpZihcIiArIHVuZXNjYXBlKGNvZGUpICsgXCIpe291dCs9J1wiIDogXCInO31lbHNle291dCs9J1wiKSA6XG5cdFx0XHRcdFx0KGNvZGUgPyBcIic7aWYoXCIgKyB1bmVzY2FwZShjb2RlKSArIFwiKXtvdXQrPSdcIiA6IFwiJzt9b3V0Kz0nXCIpO1xuXHRcdFx0fSlcblx0XHRcdC5yZXBsYWNlKGMuaXRlcmF0ZSB8fCBza2lwLCBmdW5jdGlvbihtLCBpdGVyYXRlLCB2bmFtZSwgaW5hbWUpIHtcblx0XHRcdFx0aWYgKCFpdGVyYXRlKSByZXR1cm4gXCInO30gfSBvdXQrPSdcIjtcblx0XHRcdFx0c2lkKz0xOyBpbmR2PWluYW1lIHx8IFwiaVwiK3NpZDsgaXRlcmF0ZT11bmVzY2FwZShpdGVyYXRlKTtcblx0XHRcdFx0cmV0dXJuIFwiJzt2YXIgYXJyXCIrc2lkK1wiPVwiK2l0ZXJhdGUrXCI7aWYoYXJyXCIrc2lkK1wiKXt2YXIgXCIrdm5hbWUrXCIsXCIraW5kditcIj0tMSxsXCIrc2lkK1wiPWFyclwiK3NpZCtcIi5sZW5ndGgtMTt3aGlsZShcIitpbmR2K1wiPGxcIitzaWQrXCIpe1wiXG5cdFx0XHRcdFx0K3ZuYW1lK1wiPWFyclwiK3NpZCtcIltcIitpbmR2K1wiKz0xXTtvdXQrPSdcIjtcblx0XHRcdH0pXG5cdFx0XHQucmVwbGFjZShjLmV2YWx1YXRlIHx8IHNraXAsIGZ1bmN0aW9uKG0sIGNvZGUpIHtcblx0XHRcdFx0cmV0dXJuIFwiJztcIiArIHVuZXNjYXBlKGNvZGUpICsgXCJvdXQrPSdcIjtcblx0XHRcdH0pXG5cdFx0XHQrIFwiJztyZXR1cm4gb3V0O1wiKVxuXHRcdFx0LnJlcGxhY2UoL1xcbi9nLCBcIlxcXFxuXCIpLnJlcGxhY2UoL1xcdC9nLCAnXFxcXHQnKS5yZXBsYWNlKC9cXHIvZywgXCJcXFxcclwiKVxuXHRcdFx0LnJlcGxhY2UoLyhcXHN8O3xcXH18XnxcXHspb3V0XFwrPScnOy9nLCAnJDEnKS5yZXBsYWNlKC9cXCsnJy9nLCBcIlwiKTtcblx0XHRcdC8vLnJlcGxhY2UoLyhcXHN8O3xcXH18XnxcXHspb3V0XFwrPScnXFwrL2csJyQxb3V0Kz0nKTtcblxuXHRcdGlmIChuZWVkaHRtbGVuY29kZSkge1xuXHRcdFx0aWYgKCFjLnNlbGZjb250YWluZWQgJiYgX2dsb2JhbHMgJiYgIV9nbG9iYWxzLl9lbmNvZGVIVE1MKSBfZ2xvYmFscy5fZW5jb2RlSFRNTCA9IGRvVC5lbmNvZGVIVE1MU291cmNlKGMuZG9Ob3RTa2lwRW5jb2RlZCk7XG5cdFx0XHRzdHIgPSBcInZhciBlbmNvZGVIVE1MID0gdHlwZW9mIF9lbmNvZGVIVE1MICE9PSAndW5kZWZpbmVkJyA/IF9lbmNvZGVIVE1MIDogKFwiXG5cdFx0XHRcdCsgZG9ULmVuY29kZUhUTUxTb3VyY2UudG9TdHJpbmcoKSArIFwiKFwiICsgKGMuZG9Ob3RTa2lwRW5jb2RlZCB8fCAnJykgKyBcIikpO1wiXG5cdFx0XHRcdCsgc3RyO1xuXHRcdH1cblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIG5ldyBGdW5jdGlvbihjLnZhcm5hbWUsIHN0cik7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0aWYgKHR5cGVvZiBjb25zb2xlICE9PSBcInVuZGVmaW5lZFwiKSBjb25zb2xlLmxvZyhcIkNvdWxkIG5vdCBjcmVhdGUgYSB0ZW1wbGF0ZSBmdW5jdGlvbjogXCIgKyBzdHIpO1xuXHRcdFx0dGhyb3cgZTtcblx0XHR9XG5cdH07XG5cblx0ZG9ULmNvbXBpbGUgPSBmdW5jdGlvbih0bXBsLCBkZWYpIHtcblx0XHRyZXR1cm4gZG9ULnRlbXBsYXRlKHRtcGwsIG51bGwsIGRlZik7XG5cdH07XG59KCkpO1xuIiwiLyogZG9UICsgYXV0by1jb21waWxhdGlvbiBvZiBkb1QgdGVtcGxhdGVzXG4gKlxuICogMjAxMiwgTGF1cmEgRG9rdG9yb3ZhLCBodHRwczovL2dpdGh1Yi5jb20vb2xhZG8vZG9UXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2VcbiAqXG4gKiBDb21waWxlcyAuZGVmLCAuZG90LCAuanN0IGZpbGVzIGZvdW5kIHVuZGVyIHRoZSBzcGVjaWZpZWQgcGF0aC5cbiAqIEl0IGlnbm9yZXMgc3ViLWRpcmVjdG9yaWVzLlxuICogVGVtcGxhdGUgZmlsZXMgY2FuIGhhdmUgbXVsdGlwbGUgZXh0ZW5zaW9ucyBhdCB0aGUgc2FtZSB0aW1lLlxuICogRmlsZXMgd2l0aCAuZGVmIGV4dGVuc2lvbiBjYW4gYmUgaW5jbHVkZWQgaW4gb3RoZXIgZmlsZXMgdmlhIHt7I2RlZi5uYW1lfX1cbiAqIEZpbGVzIHdpdGggLmRvdCBleHRlbnNpb24gYXJlIGNvbXBpbGVkIGludG8gZnVuY3Rpb25zIHdpdGggdGhlIHNhbWUgbmFtZSBhbmRcbiAqIGNhbiBiZSBhY2Nlc3NlZCBhcyByZW5kZXJlci5maWxlbmFtZVxuICogRmlsZXMgd2l0aCAuanN0IGV4dGVuc2lvbiBhcmUgY29tcGlsZWQgaW50byAuanMgZmlsZXMuIFByb2R1Y2VkIC5qcyBmaWxlIGNhbiBiZVxuICogbG9hZGVkIGFzIGEgY29tbW9uSlMsIEFNRCBtb2R1bGUsIG9yIGp1c3QgaW5zdGFsbGVkIGludG8gYSBnbG9iYWwgdmFyaWFibGVcbiAqIChkZWZhdWx0IGlzIHNldCB0byB3aW5kb3cucmVuZGVyKS5cbiAqIEFsbCBpbmxpbmUgZGVmaW5lcyBkZWZpbmVkIGluIHRoZSAuanN0IGZpbGUgYXJlXG4gKiBjb21waWxlZCBpbnRvIHNlcGFyYXRlIGZ1bmN0aW9ucyBhbmQgYXJlIGF2YWlsYWJsZSB2aWEgX3JlbmRlci5maWxlbmFtZS5kZWZpbmVuYW1lXG4gKlxuICogQmFzaWMgdXNhZ2U6XG4gKiB2YXIgZG90cyA9IHJlcXVpcmUoXCJkb3RcIikucHJvY2Vzcyh7cGF0aDogXCIuL3ZpZXdzXCJ9KTtcbiAqIGRvdHMubXl0ZW1wbGF0ZSh7Zm9vOlwiaGVsbG8gd29ybGRcIn0pO1xuICpcbiAqIFRoZSBhYm92ZSBzbmlwcGV0IHdpbGw6XG4gKiAxLiBDb21waWxlIGFsbCB0ZW1wbGF0ZXMgaW4gdmlld3MgZm9sZGVyICguZG90LCAuZGVmLCAuanN0KVxuICogMi4gUGxhY2UgLmpzIGZpbGVzIGNvbXBpbGVkIGZyb20gLmpzdCB0ZW1wbGF0ZXMgaW50byB0aGUgc2FtZSBmb2xkZXIuXG4gKiAgICBUaGVzZSBmaWxlcyBjYW4gYmUgdXNlZCB3aXRoIHJlcXVpcmUsIGkuZS4gcmVxdWlyZShcIi4vdmlld3MvbXl0ZW1wbGF0ZVwiKS5cbiAqIDMuIFJldHVybiBhbiBvYmplY3Qgd2l0aCBmdW5jdGlvbnMgY29tcGlsZWQgZnJvbSAuZG90IHRlbXBsYXRlcyBhcyBpdHMgcHJvcGVydGllcy5cbiAqIDQuIFJlbmRlciBteXRlbXBsYXRlIHRlbXBsYXRlLlxuICovXG5cbnZhciBmcyA9IHJlcXVpcmUoXCJmc1wiKSxcblx0ZG9UID0gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9kb1RcIik7XG5cbmRvVC5wcm9jZXNzID0gZnVuY3Rpb24ob3B0aW9ucykge1xuXHQvL3BhdGgsIGRlc3RpbmF0aW9uLCBnbG9iYWwsIHJlbmRlcm1vZHVsZSwgdGVtcGxhdGVTZXR0aW5nc1xuXHRyZXR1cm4gbmV3IEluc3RhbGxEb3RzKG9wdGlvbnMpLmNvbXBpbGVBbGwoKTtcbn07XG5cbmZ1bmN0aW9uIEluc3RhbGxEb3RzKG8pIHtcblx0dGhpcy5fX3BhdGggXHRcdD0gby5wYXRoIHx8IFwiLi9cIjtcblx0aWYgKHRoaXMuX19wYXRoW3RoaXMuX19wYXRoLmxlbmd0aC0xXSAhPT0gJy8nKSB0aGlzLl9fcGF0aCArPSAnLyc7XG5cdHRoaXMuX19kZXN0aW5hdGlvblx0PSBvLmRlc3RpbmF0aW9uIHx8IHRoaXMuX19wYXRoO1xuXHRpZiAodGhpcy5fX2Rlc3RpbmF0aW9uW3RoaXMuX19kZXN0aW5hdGlvbi5sZW5ndGgtMV0gIT09ICcvJykgdGhpcy5fX2Rlc3RpbmF0aW9uICs9ICcvJztcblx0dGhpcy5fX2dsb2JhbFx0XHQ9IG8uZ2xvYmFsIHx8IFwid2luZG93LnJlbmRlclwiO1xuXHR0aGlzLl9fcmVuZGVybW9kdWxlXHQ9IG8ucmVuZGVybW9kdWxlIHx8IHt9O1xuXHR0aGlzLl9fc2V0dGluZ3MgXHQ9IG8udGVtcGxhdGVTZXR0aW5ncyA/IGNvcHkoby50ZW1wbGF0ZVNldHRpbmdzLCBjb3B5KGRvVC50ZW1wbGF0ZVNldHRpbmdzKSkgOiB1bmRlZmluZWQ7XG5cdHRoaXMuX19pbmNsdWRlc1x0XHQ9IHt9O1xufVxuXG5JbnN0YWxsRG90cy5wcm90b3R5cGUuY29tcGlsZVRvRmlsZSA9IGZ1bmN0aW9uKHBhdGgsIHRlbXBsYXRlLCBkZWYpIHtcblx0ZGVmID0gZGVmIHx8IHt9O1xuXHR2YXIgbW9kdWxlbmFtZSA9IHBhdGguc3Vic3RyaW5nKHBhdGgubGFzdEluZGV4T2YoXCIvXCIpKzEsIHBhdGgubGFzdEluZGV4T2YoXCIuXCIpKVxuXHRcdCwgZGVmcyA9IGNvcHkodGhpcy5fX2luY2x1ZGVzLCBjb3B5KGRlZikpXG5cdFx0LCBzZXR0aW5ncyA9IHRoaXMuX19zZXR0aW5ncyB8fCBkb1QudGVtcGxhdGVTZXR0aW5nc1xuXHRcdCwgY29tcGlsZW9wdGlvbnMgPSBjb3B5KHNldHRpbmdzKVxuXHRcdCwgZGVmYXVsdGNvbXBpbGVkID0gZG9ULnRlbXBsYXRlKHRlbXBsYXRlLCBzZXR0aW5ncywgZGVmcylcblx0XHQsIGV4cG9ydHMgPSBbXVxuXHRcdCwgY29tcGlsZWQgPSBcIlwiXG5cdFx0LCBmbjtcblxuXHRmb3IgKHZhciBwcm9wZXJ0eSBpbiBkZWZzKSB7XG5cdFx0aWYgKGRlZnNbcHJvcGVydHldICE9PSBkZWZbcHJvcGVydHldICYmIGRlZnNbcHJvcGVydHldICE9PSB0aGlzLl9faW5jbHVkZXNbcHJvcGVydHldKSB7XG5cdFx0XHRmbiA9IHVuZGVmaW5lZDtcblx0XHRcdGlmICh0eXBlb2YgZGVmc1twcm9wZXJ0eV0gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGZuID0gZG9ULnRlbXBsYXRlKGRlZnNbcHJvcGVydHldLCBzZXR0aW5ncywgZGVmcyk7XG5cdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBkZWZzW3Byb3BlcnR5XSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRmbiA9IGRlZnNbcHJvcGVydHldO1xuXHRcdFx0fSBlbHNlIGlmIChkZWZzW3Byb3BlcnR5XS5hcmcpIHtcblx0XHRcdFx0Y29tcGlsZW9wdGlvbnMudmFybmFtZSA9IGRlZnNbcHJvcGVydHldLmFyZztcblx0XHRcdFx0Zm4gPSBkb1QudGVtcGxhdGUoZGVmc1twcm9wZXJ0eV0udGV4dCwgY29tcGlsZW9wdGlvbnMsIGRlZnMpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGZuKSB7XG5cdFx0XHRcdGNvbXBpbGVkICs9IGZuLnRvU3RyaW5nKCkucmVwbGFjZSgnYW5vbnltb3VzJywgcHJvcGVydHkpO1xuXHRcdFx0XHRleHBvcnRzLnB1c2gocHJvcGVydHkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRjb21waWxlZCArPSBkZWZhdWx0Y29tcGlsZWQudG9TdHJpbmcoKS5yZXBsYWNlKCdhbm9ueW1vdXMnLCBtb2R1bGVuYW1lKTtcblx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLCBcIihmdW5jdGlvbigpe1wiICsgY29tcGlsZWRcblx0XHQrIFwidmFyIGl0c2VsZj1cIiArIG1vZHVsZW5hbWUgKyBcIiwgX2VuY29kZUhUTUw9KFwiICsgZG9ULmVuY29kZUhUTUxTb3VyY2UudG9TdHJpbmcoKSArIFwiKFwiICsgKHNldHRpbmdzLmRvTm90U2tpcEVuY29kZWQgfHwgJycpICsgXCIpKTtcIlxuXHRcdCsgYWRkZXhwb3J0cyhleHBvcnRzKVxuXHRcdCsgXCJpZih0eXBlb2YgbW9kdWxlIT09J3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIG1vZHVsZS5leHBvcnRzPWl0c2VsZjtlbHNlIGlmKHR5cGVvZiBkZWZpbmU9PT0nZnVuY3Rpb24nKWRlZmluZShmdW5jdGlvbigpe3JldHVybiBpdHNlbGY7fSk7ZWxzZSB7XCJcblx0XHQrIHRoaXMuX19nbG9iYWwgKyBcIj1cIiArIHRoaXMuX19nbG9iYWwgKyBcInx8e307XCIgKyB0aGlzLl9fZ2xvYmFsICsgXCJbJ1wiICsgbW9kdWxlbmFtZSArIFwiJ109aXRzZWxmO319KCkpO1wiKTtcbn07XG5cbmZ1bmN0aW9uIGFkZGV4cG9ydHMoZXhwb3J0cykge1xuXHRmb3IgKHZhciByZXQgPScnLCBpPTA7IGk8IGV4cG9ydHMubGVuZ3RoOyBpKyspIHtcblx0XHRyZXQgKz0gXCJpdHNlbGYuXCIgKyBleHBvcnRzW2ldKyBcIj1cIiArIGV4cG9ydHNbaV0rXCI7XCI7XG5cdH1cblx0cmV0dXJuIHJldDtcbn1cblxuZnVuY3Rpb24gY29weShvLCB0bykge1xuXHR0byA9IHRvIHx8IHt9O1xuXHRmb3IgKHZhciBwcm9wZXJ0eSBpbiBvKSB7XG5cdFx0dG9bcHJvcGVydHldID0gb1twcm9wZXJ0eV07XG5cdH1cblx0cmV0dXJuIHRvO1xufVxuXG5mdW5jdGlvbiByZWFkZGF0YShwYXRoKSB7XG5cdHZhciBkYXRhID0gZnMucmVhZEZpbGVTeW5jKHBhdGgpO1xuXHRpZiAoZGF0YSkgcmV0dXJuIGRhdGEudG9TdHJpbmcoKTtcblx0Y29uc29sZS5sb2coXCJwcm9ibGVtcyB3aXRoIFwiICsgcGF0aCk7XG59XG5cbkluc3RhbGxEb3RzLnByb3RvdHlwZS5jb21waWxlUGF0aCA9IGZ1bmN0aW9uKHBhdGgpIHtcblx0dmFyIGRhdGEgPSByZWFkZGF0YShwYXRoKTtcblx0aWYgKGRhdGEpIHtcblx0XHRyZXR1cm4gZG9ULnRlbXBsYXRlKGRhdGEsXG5cdFx0XHRcdFx0dGhpcy5fX3NldHRpbmdzIHx8IGRvVC50ZW1wbGF0ZVNldHRpbmdzLFxuXHRcdFx0XHRcdGNvcHkodGhpcy5fX2luY2x1ZGVzKSk7XG5cdH1cbn07XG5cbkluc3RhbGxEb3RzLnByb3RvdHlwZS5jb21waWxlQWxsID0gZnVuY3Rpb24oKSB7XG5cdGNvbnNvbGUubG9nKFwiQ29tcGlsaW5nIGFsbCBkb1QgdGVtcGxhdGVzLi4uXCIpO1xuXG5cdHZhciBkZWZGb2xkZXIgPSB0aGlzLl9fcGF0aCxcblx0XHRzb3VyY2VzID0gZnMucmVhZGRpclN5bmMoZGVmRm9sZGVyKSxcblx0XHRrLCBsLCBuYW1lO1xuXG5cdGZvciggayA9IDAsIGwgPSBzb3VyY2VzLmxlbmd0aDsgayA8IGw7IGsrKykge1xuXHRcdG5hbWUgPSBzb3VyY2VzW2tdO1xuXHRcdGlmICgvXFwuZGVmKFxcLmRvdHxcXC5qc3QpPyQvLnRlc3QobmFtZSkpIHtcblx0XHRcdGNvbnNvbGUubG9nKFwiTG9hZGVkIGRlZiBcIiArIG5hbWUpO1xuXHRcdFx0dGhpcy5fX2luY2x1ZGVzW25hbWUuc3Vic3RyaW5nKDAsIG5hbWUuaW5kZXhPZignLicpKV0gPSByZWFkZGF0YShkZWZGb2xkZXIgKyBuYW1lKTtcblx0XHR9XG5cdH1cblxuXHRmb3IoIGsgPSAwLCBsID0gc291cmNlcy5sZW5ndGg7IGsgPCBsOyBrKyspIHtcblx0XHRuYW1lID0gc291cmNlc1trXTtcblx0XHRpZiAoL1xcLmRvdChcXC5kZWZ8XFwuanN0KT8kLy50ZXN0KG5hbWUpKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhcIkNvbXBpbGluZyBcIiArIG5hbWUgKyBcIiB0byBmdW5jdGlvblwiKTtcblx0XHRcdHRoaXMuX19yZW5kZXJtb2R1bGVbbmFtZS5zdWJzdHJpbmcoMCwgbmFtZS5pbmRleE9mKCcuJykpXSA9IHRoaXMuY29tcGlsZVBhdGgoZGVmRm9sZGVyICsgbmFtZSk7XG5cdFx0fVxuXHRcdGlmICgvXFwuanN0KFxcLmRvdHxcXC5kZWYpPyQvLnRlc3QobmFtZSkpIHtcblx0XHRcdGNvbnNvbGUubG9nKFwiQ29tcGlsaW5nIFwiICsgbmFtZSArIFwiIHRvIGZpbGVcIik7XG5cdFx0XHR0aGlzLmNvbXBpbGVUb0ZpbGUodGhpcy5fX2Rlc3RpbmF0aW9uICsgbmFtZS5zdWJzdHJpbmcoMCwgbmFtZS5pbmRleE9mKCcuJykpICsgJy5qcycsXG5cdFx0XHRcdFx0cmVhZGRhdGEoZGVmRm9sZGVyICsgbmFtZSkpO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gdGhpcy5fX3JlbmRlcm1vZHVsZTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cz17XG5cdFwidmVyc2lvblwiOiBcIjIwMTZkXCIsXG5cdFwiem9uZXNcIjogW1xuXHRcdFwiQWZyaWNhL0FiaWRqYW58TE1UIEdNVHxnLjggMHwwMXwtMmxkWEguUXw0OGU1XCIsXG5cdFx0XCJBZnJpY2EvQWNjcmF8TE1UIEdNVCBHSFNUfC5RIDAgLWt8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0yNkJiWC44IDZ0elguOCBNbkUgMUJBayBNbkUgMUJBayBNbkUgMUJBayBNbkUgMUMwayBNbkUgMUJBayBNbkUgMUJBayBNbkUgMUJBayBNbkUgMUMwayBNbkUgMUJBayBNbkUgMUJBayBNbkUgMUJBayBNbkUgMUMwayBNbkUgMUJBayBNbkUgMUJBayBNbkUgMUJBayBNbkUgMUMwayBNbkUgMUJBayBNbkUgMUJBayBNbkUgMUJBayBNbkUgMUMwayBNbkUgMUJBayBNbkUgMUJBayBNbkV8NDFlNVwiLFxuXHRcdFwiQWZyaWNhL05haXJvYml8TE1UIEVBVCBCRUFUIEJFQVVUfC0yci5nIC0zMCAtMnUgLTJKfDAxMjMxfC0xRjNDci5nIDNEenIuZyBva011IE1GWEp8NDdlNVwiLFxuXHRcdFwiQWZyaWNhL0FsZ2llcnN8UE1UIFdFVCBXRVNUIENFVCBDRVNUfC05LmwgMCAtMTAgLTEwIC0yMHwwMTIxMjEyMTIxMjEyMTIxMzQzNDMxMzEyMTIzNDMxMjEzfC0ybmNvOS5sIGNOYjkubCBIQTAgMTlBMCAxaU0wIDExYzAgMW9vMCBXbzAgMXJjMCBRTTAgMUVNMCBVTTAgREEwIEltbzAgcmQwIERlMCA5WHowIDFmYjAgMWFwMCAxNkswIDJ5bzAgbUVwMCBod0wwIGp4QTAgMTFBMCBkRGQwIDE3YjAgMTFCMCAxY04wIDJEeTAgMWNOMCAxZkIwIDFjTDB8MjZlNVwiLFxuXHRcdFwiQWZyaWNhL0xhZ29zfExNVCBXQVR8LWQuQSAtMTB8MDF8LTIyeTBkLkF8MTdlNlwiLFxuXHRcdFwiQWZyaWNhL0Jpc3NhdXxMTVQgV0FUIEdNVHwxMi5rIDEwIDB8MDEyfC0ybGRXVi5FIDJ4b25WLkV8MzllNFwiLFxuXHRcdFwiQWZyaWNhL01hcHV0b3xMTVQgQ0FUfC0yYS5rIC0yMHwwMXwtMkdKZWEua3wyNmU1XCIsXG5cdFx0XCJBZnJpY2EvQ2Fpcm98RUVUIEVFU1R8LTIwIC0zMHwwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwfC0xYklPMCB2YjAgMWlwMCAxMXowIDFpTjAgMW56MCAxMnAwIDFwejAgMTBOMCAxcHowIDE2cDAgMWp6MCBzM2QwIFZ6MCAxb04wIDExYjAgMW9PMCAxME4wIDFwejAgMTBOMCAxcGIwIDEwTjAgMXBiMCAxME4wIDFwYjAgMTBOMCAxcHowIDEwTjAgMXBiMCAxME4wIDFwYjAgMTFkMCAxb0wwIDExZDAgMXBiMCAxMWQwIDFvTDAgMTFkMCAxb0wwIDExZDAgMW9MMCAxMWQwIDFwYjAgMTFkMCAxb0wwIDExZDAgMW9MMCAxMWQwIDFvTDAgMTFkMCAxcGIwIDExZDAgMW9MMCAxMWQwIDFvTDAgMTFkMCAxb0wwIDExZDAgMXBiMCAxMWQwIDFvTDAgMTFkMCAxV0wwIHJkMCAxUnowIHdwMCAxcGIwIDExZDAgMW9MMCAxMWQwIDFvTDAgMTFkMCAxb0wwIDExZDAgMXBiMCAxMWQwIDFxTDAgWGQwIDFvTDAgMTFkMCAxb0wwIDExZDAgMXBiMCAxMWQwIDFvTDAgMTFkMCAxb0wwIDExZDAgMW55MCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCAxMXowIDFvMTAgMTF6MCAxbzEwIFdMMCAxcU4wIFJiMCAxd3AwIE9uMCAxemQwIEx6MCAxRU4wIEZiMCBjMTAgOG4wIDhOZDAgZ0wwIGUxMCBtbjB8MTVlNlwiLFxuXHRcdFwiQWZyaWNhL0Nhc2FibGFuY2F8TE1UIFdFVCBXRVNUIENFVHx1LmsgMCAtMTAgLTEwfDAxMjEyMTIxMjEyMTIxMjEyMTMxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTJnTW50LkUgMTMwTHQuRSByYjAgRGQwIGRWYjAgYjZwMCBUWDAgRW9CMCBMTDAgZ25kMCByejAgNDNkMCBBTDAgMU5kMCBYWDAgMUNwMCBwejAgZEVwMCA0bW4wIFN5TjAgQUwwIDFOZDAgd24wIDFGQjAgRGIwIDF6ZDAgTHowIDFOZjAgd00wIGNvMCBnbzAgMW8wMCBzMDAgZEEwIHZjMCAxMUEwIEEwMCBlMDAgeTAwIDExQTAgdU0wIGUwMCBEYzAgMTFBMCBzMDAgZTAwIElNMCBXTTAgbW8wIGdNMCBMQTAgV00wIGpBMCBlMDAgUmMwIDExQTAgZTAwIGUwMCBVMDAgMTFBMCA4bzAgZTAwIDExQTAgMTFBMCA1QTAgZTAwIDE3YzAgMWZBMCAxYTAwIDFhMDAgMWZBMCAxN2MwIDFpbzAgMTRvMCAxbGMwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbGMwIDE0bzAgMWZBMHwzMmU1XCIsXG5cdFx0XCJBZnJpY2EvQ2V1dGF8V0VUIFdFU1QgQ0VUIENFU1R8MCAtMTAgLTEwIC0yMHwwMTAxMDEwMTAxMDEwMTAxMDEwMTAyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzJ8LTI1S04wIDExejAgZHJkMCAxOG8wIDNJMDAgMTdjMCAxZkEwIDFhMDAgMWlvMCAxYTAwIDF5N3AwIExMMCBnbmQwIHJ6MCA0M2QwIEFMMCAxTmQwIFhYMCAxQ3AwIHB6MCBkRXAwIDRWQjAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDg1ZTNcIixcblx0XHRcIkFmcmljYS9FbF9BYWl1bnxMTVQgV0FUIFdFVCBXRVNUfFEuTSAxMCAwIC0xMHwwMTIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMnwtMXJEejcuYyAxR1ZBNy5jIDZMMCBBTDAgMU5kMCBYWDAgMUNwMCBwejAgMWNCQjAgQUwwIDFOZDAgd24wIDFGQjAgRGIwIDF6ZDAgTHowIDFOZjAgd00wIGNvMCBnbzAgMW8wMCBzMDAgZEEwIHZjMCAxMUEwIEEwMCBlMDAgeTAwIDExQTAgdU0wIGUwMCBEYzAgMTFBMCBzMDAgZTAwIElNMCBXTTAgbW8wIGdNMCBMQTAgV00wIGpBMCBlMDAgUmMwIDExQTAgZTAwIGUwMCBVMDAgMTFBMCA4bzAgZTAwIDExQTAgMTFBMCA1QTAgZTAwIDE3YzAgMWZBMCAxYTAwIDFhMDAgMWZBMCAxN2MwIDFpbzAgMTRvMCAxbGMwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbGMwIDE0bzAgMWZBMHwyMGU0XCIsXG5cdFx0XCJBZnJpY2EvSm9oYW5uZXNidXJnfFNBU1QgU0FTVCBTQVNUfC0xdSAtMjAgLTMwfDAxMjEyMXwtMkdKZHUgMUFqZHUgMWNMMCAxY04wIDFjTDB8ODRlNVwiLFxuXHRcdFwiQWZyaWNhL0toYXJ0b3VtfExNVCBDQVQgQ0FTVCBFQVR8LTJhLjggLTIwIC0zMCAtMzB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTN8LTF5VzJhLjggMXpLMGEuOCAxNkwwIDFpTjAgMTdiMCAxamQwIDE3YjAgMWlwMCAxN3owIDFpMTAgMTdYMCAxaEIwIDE4bjAgMWhkMCAxOWIwIDFncDAgMTl6MCAxaU4wIDE3YjAgMWlwMCAxN3owIDFpMTAgMThuMCAxaGQwIDE4TDAgMWdOMCAxOWIwIDFncDAgMTl6MCAxaU4wIDE3ejAgMWkxMCAxN1gwIHlHZDB8NTFlNVwiLFxuXHRcdFwiQWZyaWNhL01vbnJvdmlhfE1NVCBMUlQgR01UfEguOCBJLnUgMHwwMTJ8LTIzTHpnLlEgMjlzMDEubXwxMWU1XCIsXG5cdFx0XCJBZnJpY2EvTmRqYW1lbmF8TE1UIFdBVCBXQVNUfC0xMC5jIC0xMCAtMjB8MDEyMXwtMmxlMTAuYyAySjNjMC5jIFduMHwxM2U1XCIsXG5cdFx0XCJBZnJpY2EvVHJpcG9saXxMTVQgQ0VUIENFU1QgRUVUfC1RLkkgLTEwIC0yMCAtMjB8MDEyMTIxMjEzMTIxMjEyMTIxMjEyMTIxMjEzMTIzMTIzfC0yMUpjUS5JIDFobkJRLkkgdngwIDRpUDAgeHgwIDRlTjAgQmIwIDdpcDAgVTBuMCBBMTAgMWRiMCAxY04wIDFkYjAgMWRkMCAxZGIwIDFlTjAgMWJiMCAxZTEwIDFjTDAgMWMxMCAxZGIwIDFkZDAgMWRiMCAxY04wIDFkYjAgMXExMCBmQW4wIDFlcDAgMWRiMCBBS3EwIFRBMCAxbzAwfDExZTVcIixcblx0XHRcIkFmcmljYS9UdW5pc3xQTVQgQ0VUIENFU1R8LTkubCAtMTAgLTIwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTJuY285LmwgMThwYTkubCAxcU0wIERBMCAzVGMwIDExQjAgMXplMCBXTTAgN3owIDNkMCAxNEwwIDFjTjAgMWY5MCAxYXIwIDE2SjAgMWdYQjAgV00wIDFyQTAgMTFjMCBud28wIEtvMCAxY00wIDFjTTAgMXJBMCAxME0wIHp1TTAgMTBOMCAxYU4wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwfDIwZTVcIixcblx0XHRcIkFmcmljYS9XaW5kaG9la3xTV0FUIFNBU1QgU0FTVCBDQVQgV0FUIFdBU1R8LTF1IC0yMCAtMzAgLTIwIC0xMCAtMjB8MDEyMTM0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1fC0yR0pkdSAxQWpkdSAxY0wwIDFTcUwwIDlOQTAgMTFEMCAxblgwIDExQjAgMXFMMCBXTjAgMXFMMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxcUwwIFdOMCAxcUwwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFxTDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMXFMMCBXTjAgMXFMMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxcUwwIFdOMCAxcUwwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMXFMMCBXTjAgMXFMMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxcUwwIFdOMCAxcUwwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFxTDAgMTFCMCAxblgwIDExQjB8MzJlNFwiLFxuXHRcdFwiQW1lcmljYS9BZGFrfE5TVCBOV1QgTlBUIEJTVCBCRFQgQUhTVCBIU1QgSERUfGIwIGEwIGEwIGIwIGEwIGEwIGEwIDkwfDAxMjAzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQ1Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3NnwtMTdTWDAgOHdXMCBpQjAgUWxiMCA1Mk8wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIHMxMCAxVnowIExCMCAxQlgwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgY20wIDEwcTAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjB8MzI2XCIsXG5cdFx0XCJBbWVyaWNhL0FuY2hvcmFnZXxDQVQgQ0FXVCBDQVBUIEFIU1QgQUhEVCBZU1QgQUtTVCBBS0RUfGEwIDkwIDkwIGEwIDkwIDkwIDkwIDgwfDAxMjAzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQ1Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3NnwtMTdUMDAgOHdYMCBpQTAgUWxiMCA1Mk8wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIHMxMCAxVnowIExCMCAxQlgwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgY20wIDEwcTAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjB8MzBlNFwiLFxuXHRcdFwiQW1lcmljYS9Qb3J0X29mX1NwYWlufExNVCBBU1R8NDYuNCA0MHwwMXwtMmtOdlIuVXw0M2UzXCIsXG5cdFx0XCJBbWVyaWNhL0FyYWd1YWluYXxMTVQgQlJUIEJSU1R8M2MuTSAzMCAyMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0yZ2x3TC5jIEhkS0wuYyAxY2MwIDFlMTAgMWJYMCBFemQwIFNvMCAxdkEwIE1uMCAxQkIwIE1MMCAxQkIwIHpYMCBxZTEwIHhiMCAyZXAwIG56MCAxQzEwIHpYMCAxQzEwIExYMCAxQzEwIE1uMCBIMjEwIFJiMCAxdEIwIElMMCAxRmQwIEZYMCAxRU4wIEZYMCAxSEIwIEx6MCBkTU4wIEx6MCAxemQwIFJiMCAxd04wIFduMCAxdEIwIFJiMCAxdEIwIFdMMCAxdEIwIFJiMCAxemQwIE9uMCAxSEIwIEZYMCBueTEwIEx6MHwxNGU0XCIsXG5cdFx0XCJBbWVyaWNhL0FyZ2VudGluYS9CdWVub3NfQWlyZXN8Q01UIEFSVCBBUlNUIEFSVCBBUlNUfDRnLk0gNDAgMzAgMzAgMjB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMzQzNDM0MzQzNDM0MzIzNDM0M3wtMjBVSEguYyBwS25ILmMgTW4wIDFpTjAgVGIwIDFDMTAgTFgwIDFDMTAgTFgwIDFDMTAgTFgwIDFDMTAgTW4wIDFDMTAgTFgwIDFDMTAgTFgwIDFDMTAgTFgwIDFDMTAgTW4wIE1OMCAyanowIE1OMCA0bFgwIHUxMCA1TGIwIDFwQjAgRm56MCB1MTAgdUwwIDF2ZDAgU0wwIDF2ZDAgU0wwIDF2ZDAgMTd6MCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgYXNuMCBEYjAgenZkMCBCejAgMXRCMCBUWDAgMXdwMCBSYjAgMXdwMCBSYjAgMXdwMCBUWDAgZzBwMCAxME0wIGozYzAgdUwwIDFxTjAgV0wwXCIsXG5cdFx0XCJBbWVyaWNhL0FyZ2VudGluYS9DYXRhbWFyY2F8Q01UIEFSVCBBUlNUIEFSVCBBUlNUIFdBUlR8NGcuTSA0MCAzMCAzMCAyMCA0MHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEzNDM0MzQzNDU0MzQzMjM1MzQzfC0yMFVISC5jIHBLbkguYyBNbjAgMWlOMCBUYjAgMUMxMCBMWDAgMUMxMCBMWDAgMUMxMCBMWDAgMUMxMCBNbjAgMUMxMCBMWDAgMUMxMCBMWDAgMUMxMCBMWDAgMUMxMCBNbjAgTU4wIDJqejAgTU4wIDRsWDAgdTEwIDVMYjAgMXBCMCBGbnowIHUxMCB1TDAgMXZkMCBTTDAgMXZkMCBTTDAgMXZkMCAxN3owIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWNOMCBhc24wIERiMCB6dmQwIEJ6MCAxdEIwIFRYMCAxd3AwIFJiMCAxd3EwIFJhMCAxd3AwIFRYMCBnMHAwIDEwTTAgYWtvMCA3QjAgOHpiMCB1TDBcIixcblx0XHRcIkFtZXJpY2EvQXJnZW50aW5hL0NvcmRvYmF8Q01UIEFSVCBBUlNUIEFSVCBBUlNUIFdBUlR8NGcuTSA0MCAzMCAzMCAyMCA0MHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEzNDM0MzQzNDU0MzQzMjM0MzQzfC0yMFVISC5jIHBLbkguYyBNbjAgMWlOMCBUYjAgMUMxMCBMWDAgMUMxMCBMWDAgMUMxMCBMWDAgMUMxMCBNbjAgMUMxMCBMWDAgMUMxMCBMWDAgMUMxMCBMWDAgMUMxMCBNbjAgTU4wIDJqejAgTU4wIDRsWDAgdTEwIDVMYjAgMXBCMCBGbnowIHUxMCB1TDAgMXZkMCBTTDAgMXZkMCBTTDAgMXZkMCAxN3owIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWNOMCBhc24wIERiMCB6dmQwIEJ6MCAxdEIwIFRYMCAxd3AwIFJiMCAxd3EwIFJhMCAxd3AwIFRYMCBnMHAwIDEwTTAgajNjMCB1TDAgMXFOMCBXTDBcIixcblx0XHRcIkFtZXJpY2EvQXJnZW50aW5hL0p1anV5fENNVCBBUlQgQVJTVCBBUlQgQVJTVCBXQVJUIFdBUlNUfDRnLk0gNDAgMzAgMzAgMjAgNDAgMzB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMzQzNDM0NTY1NDM0MzIzNDN8LTIwVUhILmMgcEtuSC5jIE1uMCAxaU4wIFRiMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIE1uMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIE1uMCBNTjAgMmp6MCBNTjAgNGxYMCB1MTAgNUxiMCAxcEIwIEZuejAgdTEwIHVMMCAxdmQwIFNMMCAxdmQwIFNMMCAxdmQwIDE3ejAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIGFzbjAgRGIwIHp2ZDAgQnowIDF0QjAgVFgwIDF6ZTAgVFgwIDFsZDAgV0swIDF3cDAgVFgwIGcwcDAgMTBNMCBqM2MwIHVMMFwiLFxuXHRcdFwiQW1lcmljYS9BcmdlbnRpbmEvTGFfUmlvamF8Q01UIEFSVCBBUlNUIEFSVCBBUlNUIFdBUlR8NGcuTSA0MCAzMCAzMCAyMCA0MHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEzNDM0MzQzNDUzNDM0MzIzNTM0M3wtMjBVSEguYyBwS25ILmMgTW4wIDFpTjAgVGIwIDFDMTAgTFgwIDFDMTAgTFgwIDFDMTAgTFgwIDFDMTAgTW4wIDFDMTAgTFgwIDFDMTAgTFgwIDFDMTAgTFgwIDFDMTAgTW4wIE1OMCAyanowIE1OMCA0bFgwIHUxMCA1TGIwIDFwQjAgRm56MCB1MTAgdUwwIDF2ZDAgU0wwIDF2ZDAgU0wwIDF2ZDAgMTd6MCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgYXNuMCBEYjAgenZkMCBCejAgMXRCMCBUWDAgMXdwMCBRbjAgcU8wIDE2bjAgUmIwIDF3cDAgVFgwIGcwcDAgMTBNMCBha28wIDdCMCA4emIwIHVMMFwiLFxuXHRcdFwiQW1lcmljYS9BcmdlbnRpbmEvTWVuZG96YXxDTVQgQVJUIEFSU1QgQVJUIEFSU1QgV0FSVCBXQVJTVHw0Zy5NIDQwIDMwIDMwIDIwIDQwIDMwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTM0MzQzNDU2NTY1NDMyMzUzNDN8LTIwVUhILmMgcEtuSC5jIE1uMCAxaU4wIFRiMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIE1uMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIE1uMCBNTjAgMmp6MCBNTjAgNGxYMCB1MTAgNUxiMCAxcEIwIEZuejAgdTEwIHVMMCAxdmQwIFNMMCAxdmQwIFNMMCAxdmQwIDE3ejAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIGFzbjAgRGIwIHp2ZDAgQnowIDF0QjAgVFgwIDF1MjAgU0wwIDF2ZDAgVGIwIDF3cDAgVFcwIGcwcDAgMTBNMCBhZ00wIE9wMCA3VFgwIHVMMFwiLFxuXHRcdFwiQW1lcmljYS9BcmdlbnRpbmEvUmlvX0dhbGxlZ29zfENNVCBBUlQgQVJTVCBBUlQgQVJTVCBXQVJUfDRnLk0gNDAgMzAgMzAgMjAgNDB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMzQzNDM0MzQzNDM0MzIzNTM0M3wtMjBVSEguYyBwS25ILmMgTW4wIDFpTjAgVGIwIDFDMTAgTFgwIDFDMTAgTFgwIDFDMTAgTFgwIDFDMTAgTW4wIDFDMTAgTFgwIDFDMTAgTFgwIDFDMTAgTFgwIDFDMTAgTW4wIE1OMCAyanowIE1OMCA0bFgwIHUxMCA1TGIwIDFwQjAgRm56MCB1MTAgdUwwIDF2ZDAgU0wwIDF2ZDAgU0wwIDF2ZDAgMTd6MCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgYXNuMCBEYjAgenZkMCBCejAgMXRCMCBUWDAgMXdwMCBSYjAgMXdwMCBSYjAgMXdwMCBUWDAgZzBwMCAxME0wIGFrbzAgN0IwIDh6YjAgdUwwXCIsXG5cdFx0XCJBbWVyaWNhL0FyZ2VudGluYS9TYWx0YXxDTVQgQVJUIEFSU1QgQVJUIEFSU1QgV0FSVHw0Zy5NIDQwIDMwIDMwIDIwIDQwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTM0MzQzNDM0NTQzNDMyMzQzfC0yMFVISC5jIHBLbkguYyBNbjAgMWlOMCBUYjAgMUMxMCBMWDAgMUMxMCBMWDAgMUMxMCBMWDAgMUMxMCBNbjAgMUMxMCBMWDAgMUMxMCBMWDAgMUMxMCBMWDAgMUMxMCBNbjAgTU4wIDJqejAgTU4wIDRsWDAgdTEwIDVMYjAgMXBCMCBGbnowIHUxMCB1TDAgMXZkMCBTTDAgMXZkMCBTTDAgMXZkMCAxN3owIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWNOMCBhc24wIERiMCB6dmQwIEJ6MCAxdEIwIFRYMCAxd3AwIFJiMCAxd3EwIFJhMCAxd3AwIFRYMCBnMHAwIDEwTTAgajNjMCB1TDBcIixcblx0XHRcIkFtZXJpY2EvQXJnZW50aW5hL1Nhbl9KdWFufENNVCBBUlQgQVJTVCBBUlQgQVJTVCBXQVJUfDRnLk0gNDAgMzAgMzAgMjAgNDB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMzQzNDM0MzQ1MzQzNDMyMzUzNDN8LTIwVUhILmMgcEtuSC5jIE1uMCAxaU4wIFRiMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIE1uMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIE1uMCBNTjAgMmp6MCBNTjAgNGxYMCB1MTAgNUxiMCAxcEIwIEZuejAgdTEwIHVMMCAxdmQwIFNMMCAxdmQwIFNMMCAxdmQwIDE3ejAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIGFzbjAgRGIwIHp2ZDAgQnowIDF0QjAgVFgwIDF3cDAgUW4wIHFPMCAxNm4wIFJiMCAxd3AwIFRYMCBnMHAwIDEwTTAgYWswMCBtMTAgOGxiMCB1TDBcIixcblx0XHRcIkFtZXJpY2EvQXJnZW50aW5hL1Nhbl9MdWlzfENNVCBBUlQgQVJTVCBBUlQgQVJTVCBXQVJUIFdBUlNUfDRnLk0gNDAgMzAgMzAgMjAgNDAgMzB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMzQzNDM0NTY1MzYzNTM0NjU2NTN8LTIwVUhILmMgcEtuSC5jIE1uMCAxaU4wIFRiMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIE1uMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIE1uMCBNTjAgMmp6MCBNTjAgNGxYMCB1MTAgNUxiMCAxcEIwIEZuejAgdTEwIHVMMCAxdmQwIFNMMCAxdmQwIFNMMCAxdmQwIDE3ejAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIGFzbjAgRGIwIHp2ZDAgQnowIDF0QjAgWFgwIDFxMjAgU0wwIEFOMCBraW4wIDEwTTAgYWswMCBtMTAgOGxiMCA4TDAgamQwIDFxTjAgV0wwIDFxTjBcIixcblx0XHRcIkFtZXJpY2EvQXJnZW50aW5hL1R1Y3VtYW58Q01UIEFSVCBBUlNUIEFSVCBBUlNUIFdBUlR8NGcuTSA0MCAzMCAzMCAyMCA0MHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEzNDM0MzQzNDU0MzQzMjM1MzQzNDN8LTIwVUhILmMgcEtuSC5jIE1uMCAxaU4wIFRiMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIE1uMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIE1uMCBNTjAgMmp6MCBNTjAgNGxYMCB1MTAgNUxiMCAxcEIwIEZuejAgdTEwIHVMMCAxdmQwIFNMMCAxdmQwIFNMMCAxdmQwIDE3ejAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIGFzbjAgRGIwIHp2ZDAgQnowIDF0QjAgVFgwIDF3cDAgUmIwIDF3cTAgUmEwIDF3cDAgVFgwIGcwcDAgMTBNMCBha28wIDROMCA4QlgwIHVMMCAxcU4wIFdMMFwiLFxuXHRcdFwiQW1lcmljYS9BcmdlbnRpbmEvVXNodWFpYXxDTVQgQVJUIEFSU1QgQVJUIEFSU1QgV0FSVHw0Zy5NIDQwIDMwIDMwIDIwIDQwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTM0MzQzNDM0MzQzNDMyMzUzNDN8LTIwVUhILmMgcEtuSC5jIE1uMCAxaU4wIFRiMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIE1uMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIExYMCAxQzEwIE1uMCBNTjAgMmp6MCBNTjAgNGxYMCB1MTAgNUxiMCAxcEIwIEZuejAgdTEwIHVMMCAxdmQwIFNMMCAxdmQwIFNMMCAxdmQwIDE3ejAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIGFzbjAgRGIwIHp2ZDAgQnowIDF0QjAgVFgwIDF3cDAgUmIwIDF3cDAgUmIwIDF3cDAgVFgwIGcwcDAgMTBNMCBhakEwIDhwMCA4emIwIHVMMFwiLFxuXHRcdFwiQW1lcmljYS9DdXJhY2FvfExNVCBBTlQgQVNUfDR6LkwgNHUgNDB8MDEyfC0ya1Y3by5kIDI4S0xTLmR8MTVlNFwiLFxuXHRcdFwiQW1lcmljYS9Bc3VuY2lvbnxBTVQgUFlUIFBZVCBQWVNUfDNPLkUgNDAgMzAgMzB8MDEyMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzfC0xeDU4OS5rIDFES005LmsgM0NMMCAzRGQwIDEwTDAgMXBCMCAxMG4wIDFwQjAgMTBuMCAxcEIwIDFjTDAgMWRkMCAxZGIwIDFkZDAgMWNMMCAxZGQwIDFjTDAgMWRkMCAxY0wwIDFkZDAgMWRiMCAxZGQwIDFjTDAgMWRkMCAxY0wwIDFkZDAgMWNMMCAxZGQwIDFkYjAgMWRkMCAxY0wwIDFsQjAgMTRuMCAxZGQwIDFjTDAgMWZkMCBXTDAgMXJkMCAxYUwwIDFkQjAgWHowIDFxcDAgWGIwIDFxTjAgMTBMMCAxckIwIFRYMCAxdEIwIFdMMCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIDFjTDAgV04wIDFxTDAgMTFCMCAxblgwIDFpcDAgV0wwIDFxTjAgV0wwIDFxTjAgV0wwIDF0QjAgVFgwIDF0QjAgVFgwIDF0QjAgMTlYMCAxYTEwIDFmejAgMWExMCAxZnowIDFjTjAgMTdiMCAxaXAwIDE3YjAgMWlwMCAxN2IwIDFpcDAgMTlYMCAxZkIwIDE5WDAgMWZCMCAxOVgwIDFpcDAgMTdiMCAxaXAwIDE3YjAgMWlwMCAxOVgwIDFmQjAgMTlYMCAxZkIwIDE5WDAgMWZCMCAxOVgwIDFpcDAgMTdiMCAxaXAwIDE3YjAgMWlwMCAxOVgwIDFmQjAgMTlYMCAxZkIwIDE5WDAgMWlwMCAxN2IwIDFpcDAgMTdiMCAxaXAwIDE5WDAgMWZCMCAxOVgwIDFmQjAgMTlYMCAxZkIwIDE5WDAgMWlwMCAxN2IwIDFpcDAgMTdiMCAxaXAwfDI4ZTVcIixcblx0XHRcIkFtZXJpY2EvQXRpa29rYW58Q1NUIENEVCBDV1QgQ1BUIEVTVHw2MCA1MCA1MCA1MCA1MHwwMTAxMjM0fC0yNVRRMCAxaW4wIFJuYjAgM2plMCA4eDMwIGl3MHwyOGUyXCIsXG5cdFx0XCJBbWVyaWNhL0JhaGlhfExNVCBCUlQgQlJTVHwyeS40IDMwIDIwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0yZ2x4cC5VIEhkTHAuVSAxY2MwIDFlMTAgMWJYMCBFemQwIFNvMCAxdkEwIE1uMCAxQkIwIE1MMCAxQkIwIHpYMCBxZTEwIHhiMCAyZXAwIG56MCAxQzEwIHpYMCAxQzEwIExYMCAxQzEwIE1uMCBIMjEwIFJiMCAxdEIwIElMMCAxRmQwIEZYMCAxRU4wIEZYMCAxSEIwIEx6MCAxRU4wIEx6MCAxQzEwIElMMCAxSEIwIERiMCAxSEIwIE9uMCAxemQwIE9uMCAxemQwIEx6MCAxemQwIFJiMCAxd04wIFduMCAxdEIwIFJiMCAxdEIwIFdMMCAxdEIwIFJiMCAxemQwIE9uMCAxSEIwIEZYMCBsNUIwIFJiMHwyN2U1XCIsXG5cdFx0XCJBbWVyaWNhL0JhaGlhX0JhbmRlcmFzfExNVCBNU1QgQ1NUIFBTVCBNRFQgQ0RUfDcxIDcwIDYwIDgwIDYwIDUwfDAxMjEyMTIxMzE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTJ8LTFVUUYwIGRlTDAgOGxjMCAxN2MwIDEwTTAgMWRkMCBvdFgwIGdtTjAgUDJOMCAxM1ZkMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxZkIwIFdMMCAxZkIwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5XMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMHw4NGUzXCIsXG5cdFx0XCJBbWVyaWNhL0JhcmJhZG9zfExNVCBCTVQgQVNUIEFEVHwzVy50IDNXLnQgNDAgMzB8MDEyMzIzMjMyMzJ8LTFRMEkxLnYganNNMCAxT0RDMS52IElMMCAxaXAwIDE3YjAgMWlwMCAxN2IwIDFsZDAgMTNiMHwyOGU0XCIsXG5cdFx0XCJBbWVyaWNhL0JlbGVtfExNVCBCUlQgQlJTVHwzZC5VIDMwIDIwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMXwtMmdsd0suNCBIZEtLLjQgMWNjMCAxZTEwIDFiWDAgRXpkMCBTbzAgMXZBMCBNbjAgMUJCMCBNTDAgMUJCMCB6WDAgcWUxMCB4YjAgMmVwMCBuejAgMUMxMCB6WDAgMUMxMCBMWDAgMUMxMCBNbjAgSDIxMCBSYjAgMXRCMCBJTDAgMUZkMCBGWDB8MjBlNVwiLFxuXHRcdFwiQW1lcmljYS9CZWxpemV8TE1UIENTVCBDSERUIENEVHw1US5NIDYwIDV1IDUwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEzMTMxfC0ya0J1Ny5jIGZQQTcuYyBPbnUgMXpjdSBSYnUgMXdvdSBSYnUgMXdvdSBSYnUgMXpjdSBPbnUgMXpjdSBPbnUgMXpjdSBSYnUgMXdvdSBSYnUgMXdvdSBSYnUgMXdvdSBSYnUgMXpjdSBPbnUgMXpjdSBPbnUgMXpjdSBSYnUgMXdvdSBSYnUgMXdvdSBSYnUgMXpjdSBPbnUgMXpjdSBPbnUgMXpjdSBPbnUgMXpjdSBSYnUgMXdvdSBSYnUgMXdvdSBSYnUgMXpjdSBPbnUgMXpjdSBPbnUgMXpjdSBSYnUgMXdvdSBSYnUgMWYwTXUgcW4wIGx4QjAgbW4wfDU3ZTNcIixcblx0XHRcIkFtZXJpY2EvQmxhbmMtU2FibG9ufEFTVCBBRFQgQVdUIEFQVHw0MCAzMCAzMCAzMHwwMTAyMzB8LTI1VFMwIDFpbjAgVUdwMCA4eDUwIGl1MHwxMWUyXCIsXG5cdFx0XCJBbWVyaWNhL0JvYV9WaXN0YXxMTVQgQU1UIEFNU1R8NDIuRSA0MCAzMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0yZ2x2Vi5rIEhkS1YuayAxY2MwIDFlMTAgMWJYMCBFemQwIFNvMCAxdkEwIE1uMCAxQkIwIE1MMCAxQkIwIHpYMCBxZTEwIHhiMCAyZXAwIG56MCAxQzEwIHpYMCAxQzEwIExYMCAxQzEwIE1uMCBIMjEwIFJiMCAxdEIwIElMMCAxRmQwIEZYMCBzbXAwIFdMMCAxdEIwIDJMMHw2MmUyXCIsXG5cdFx0XCJBbWVyaWNhL0JvZ290YXxCTVQgQ09UIENPU1R8NFUuZyA1MCA0MHwwMTIxfC0yZWI3My5JIDM4eW8zLkkgMmVuMHw5MGU1XCIsXG5cdFx0XCJBbWVyaWNhL0JvaXNlfFBTVCBQRFQgTVNUIE1XVCBNUFQgTURUfDgwIDcwIDcwIDYwIDYwIDYwfDAxMDEwMjM0MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTJ8LTI2MXEwIDFuWDAgMTFCMCAxblgwIDhDMTAgSkNMMCA4eDIwIGl4MCBRd04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgRGQwIDFLbjAgTEIwIDFCWDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwfDIxZTRcIixcblx0XHRcIkFtZXJpY2EvQ2FtYnJpZGdlX0JheXx6enogTVNUIE1XVCBNUFQgTUREVCBNRFQgQ1NUIENEVCBFU1R8MCA3MCA2MCA2MCA1MCA2MCA2MCA1MCA1MHwwMTIzMTQxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1Njc4NjUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxfC0yMUpjMCBSTzkwIDh4MjAgaXgwIExDTDAgMWZBMCB6Z08wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQTAgMW5YMCAySzAgV1EwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHwxNWUyXCIsXG5cdFx0XCJBbWVyaWNhL0NhbXBvX0dyYW5kZXxMTVQgQU1UIEFNU1R8M0MucyA0MCAzMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTJ8LTJnbHdsLncgSGRMbC53IDFjYzAgMWUxMCAxYlgwIEV6ZDAgU28wIDF2QTAgTW4wIDFCQjAgTUwwIDFCQjAgelgwIHFlMTAgeGIwIDJlcDAgbnowIDFDMTAgelgwIDFDMTAgTFgwIDFDMTAgTW4wIEgyMTAgUmIwIDF0QjAgSUwwIDFGZDAgRlgwIDFFTjAgRlgwIDFIQjAgTHowIDFFTjAgTHowIDFDMTAgSUwwIDFIQjAgRGIwIDFIQjAgT24wIDF6ZDAgT24wIDF6ZDAgTHowIDF6ZDAgUmIwIDF3TjAgV24wIDF0QjAgUmIwIDF0QjAgV0wwIDF0QjAgUmIwIDF6ZDAgT24wIDFIQjAgRlgwIDFDMTAgTHowIDFJcDAgSFgwIDF6ZDAgT24wIDFIQjAgSUwwIDF3cDAgT24wIDFDMTAgTHowIDFDMTAgT24wIDF6ZDAgT24wIDF6ZDAgUmIwIDF6ZDAgTHowIDFDMTAgTHowIDFDMTAgT24wIDF6ZDAgT24wIDF6ZDAgT24wIDF6ZDAgT24wIDFDMTAgTHowIDFDMTAgTHowIDFDMTAgT24wIDF6ZDAgT24wIDF6ZDAgUmIwIDF3cDAgT24wIDFDMTAgTHowIDFDMTAgT24wIDF6ZDAgT24wIDF6ZDAgT24wIDF6ZDAgT24wIDFDMTAgTHowIDFDMTAgTHowIDFDMTAgTHowIDFDMTAgT24wIDF6ZDAgUmIwIDF3cDAgT24wIDFDMTAgTHowIDFDMTAgT24wIDF6ZDB8NzdlNFwiLFxuXHRcdFwiQW1lcmljYS9DYW5jdW58TE1UIENTVCBFU1QgRURUIENEVHw1TC40IDYwIDUwIDQwIDUwfDAxMjMyMzIzNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTJ8LTFVUUcwIDJxMm8wIHlMQjAgMWxiMCAxNHAwIDFsYjAgMTRwMCBMejAgeEIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMWZCMCBXTDAgMWZCMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIERkMHw2M2U0XCIsXG5cdFx0XCJBbWVyaWNhL0NhcmFjYXN8Q01UIFZFVCBWRVR8NHIuRSA0dSA0MHwwMTIxMnwtMmtWN3cuayAyOEtNMi5rIDFJd091IGtxbzB8MjllNVwiLFxuXHRcdFwiQW1lcmljYS9DYXllbm5lfExNVCBHRlQgR0ZUfDN0LmsgNDAgMzB8MDEyfC0ybXJ3dS5FIDJnV291LkV8NThlM1wiLFxuXHRcdFwiQW1lcmljYS9QYW5hbWF8Q01UIEVTVHw1ai5BIDUwfDAxfC0ydWR1RS5vfDE1ZTVcIixcblx0XHRcIkFtZXJpY2EvQ2hpY2Fnb3xDU1QgQ0RUIEVTVCBDV1QgQ1BUfDYwIDUwIDUwIDUwIDUwfDAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAyMDEwMTAxMDEwMTAzNDAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwfC0yNjFzMCAxblgwIDExQjAgMW5YMCAxd3AwIFRYMCBXTjAgMXFMMCAxY04wIFdMMCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCBXTDAgMXFOMCAxMXowIDFvMTAgMTF6MCAxMUIwIDFIejAgMTRwMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxcU4wIDExejAgMW8xMCAxMXowIFJCMCA4eDMwIGl3MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCBXTDAgMXFOMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCBzMTAgMVZ6MCBMQjAgMUJYMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjB8OTJlNVwiLFxuXHRcdFwiQW1lcmljYS9DaGlodWFodWF8TE1UIE1TVCBDU1QgQ0RUIE1EVHw3NC5rIDcwIDYwIDUwIDYwfDAxMjEyMTIzMjMyNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDF8LTFVUUYwIGRlTDAgOGxjMCAxN2MwIDEwTTAgMWRkMCAyelFOMCAxbGIwIDE0cDAgMWxiMCAxNHEwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxZkIwIFdMMCAxZkIwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMHw4MWU0XCIsXG5cdFx0XCJBbWVyaWNhL0Nvc3RhX1JpY2F8U0pNVCBDU1QgQ0RUfDVBLmQgNjAgNTB8MDEyMTIxMjEyMXwtMVhkNm4uTCAybHUwbi5MIERiMCAxS3AwIERiMCBwUkIwIDE1YjAgMWtwMCBtTDB8MTJlNVwiLFxuXHRcdFwiQW1lcmljYS9DcmVzdG9ufE1TVCBQU1R8NzAgODB8MDEwfC0yOURSMCA0M0IwfDUzZTJcIixcblx0XHRcIkFtZXJpY2EvQ3VpYWJhfExNVCBBTVQgQU1TVHwzSS5rIDQwIDMwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTJ8LTJnbHdmLkUgSGRMZi5FIDFjYzAgMWUxMCAxYlgwIEV6ZDAgU28wIDF2QTAgTW4wIDFCQjAgTUwwIDFCQjAgelgwIHFlMTAgeGIwIDJlcDAgbnowIDFDMTAgelgwIDFDMTAgTFgwIDFDMTAgTW4wIEgyMTAgUmIwIDF0QjAgSUwwIDFGZDAgRlgwIDFFTjAgRlgwIDFIQjAgTHowIDFFTjAgTHowIDFDMTAgSUwwIDFIQjAgRGIwIDFIQjAgT24wIDF6ZDAgT24wIDF6ZDAgTHowIDF6ZDAgUmIwIDF3TjAgV24wIDF0QjAgUmIwIDF0QjAgV0wwIDF0QjAgUmIwIDF6ZDAgT24wIDFIQjAgRlgwIDRhMTAgSFgwIDF6ZDAgT24wIDFIQjAgSUwwIDF3cDAgT24wIDFDMTAgTHowIDFDMTAgT24wIDF6ZDAgT24wIDF6ZDAgUmIwIDF6ZDAgTHowIDFDMTAgTHowIDFDMTAgT24wIDF6ZDAgT24wIDF6ZDAgT24wIDF6ZDAgT24wIDFDMTAgTHowIDFDMTAgTHowIDFDMTAgT24wIDF6ZDAgT24wIDF6ZDAgUmIwIDF3cDAgT24wIDFDMTAgTHowIDFDMTAgT24wIDF6ZDAgT24wIDF6ZDAgT24wIDF6ZDAgT24wIDFDMTAgTHowIDFDMTAgTHowIDFDMTAgTHowIDFDMTAgT24wIDF6ZDAgUmIwIDF3cDAgT24wIDFDMTAgTHowIDFDMTAgT24wIDF6ZDB8NTRlNFwiLFxuXHRcdFwiQW1lcmljYS9EYW5tYXJrc2hhdm58TE1UIFdHVCBXR1NUIEdNVHwxZS5FIDMwIDIwIDB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTN8LTJhNVdKLmsgMno1ZkouayAxOVUwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIERDMHw4XCIsXG5cdFx0XCJBbWVyaWNhL0Rhd3NvbnxZU1QgWURUIFlXVCBZUFQgWUREVCBQU1QgUERUfDkwIDgwIDgwIDgwIDcwIDgwIDcwfDAxMDEwMjMwNDA1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjV8LTI1VE4wIDFpbjAgMW8xMCAxM1YwIFNlcjAgOHgwMCBpejAgTENMMCAxZkEwIGpyQTAgZk5kMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjB8MTNlMlwiLFxuXHRcdFwiQW1lcmljYS9EYXdzb25fQ3JlZWt8UFNUIFBEVCBQV1QgUFBUIE1TVHw4MCA3MCA3MCA3MCA3MHwwMTAyMzAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDE0fC0yNVRPMCAxaW4wIFVHcDAgOHgxMCBpeTAgM05CMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCBXTDAgMXFOMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAgV0wwIDFxTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxY04wIE1MMHwxMmUzXCIsXG5cdFx0XCJBbWVyaWNhL0RlbnZlcnxNU1QgTURUIE1XVCBNUFR8NzAgNjAgNjAgNjB8MDEwMTAxMDEwMjMwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTB8LTI2MXIwIDFuWDAgMTFCMCAxblgwIDExQjAgMXFMMCBXTjAgbW4wIE9yZDAgOHgyMCBpeDAgTENOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgczEwIDFWejAgTEIwIDFCWDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwfDI2ZTVcIixcblx0XHRcIkFtZXJpY2EvRGV0cm9pdHxMTVQgQ1NUIEVTVCBFV1QgRVBUIEVEVHw1dy5iIDYwIDUwIDQwIDQwIDQwfDAxMjM0MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyfC0yQ2dpci5OIHBlcXIuTiAxNTZMMCA4eDQwIGl2MCA2ZmQwIDExejAgSnkxMCBTTDAgZG5CMCAxY0wwIHMxMCAxVnowIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjB8MzdlNVwiLFxuXHRcdFwiQW1lcmljYS9FZG1vbnRvbnxMTVQgTVNUIE1EVCBNV1QgTVBUfDd4LlEgNzAgNjAgNjAgNjB8MDEyMTIxMjEyMTIxMjEzNDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTJ5ZDRxLjggc2hkcS44IDFpbjAgMTdkMCBoejAgMmRCMCAxZnowIDFhMTAgMTF6MCAxcU4wIFdMMCAxcU4wIDExejAgSUdOMCA4eDIwIGl4MCAzTkIwIDExejAgTEZCMCAxY0wwIDNDcDAgMWNMMCA2Nk4wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwfDEwZTVcIixcblx0XHRcIkFtZXJpY2EvRWlydW5lcGV8TE1UIEFDVCBBQ1NUIEFNVHw0RC5zIDUwIDQwIDQwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMzF8LTJnbHZrLncgSGRMay53IDFjYzAgMWUxMCAxYlgwIEV6ZDAgU28wIDF2QTAgTW4wIDFCQjAgTUwwIDFCQjAgelgwIHFlMTAgeGIwIDJlcDAgbnowIDFDMTAgelgwIDFDMTAgTFgwIDFDMTAgTW4wIEgyMTAgUmIwIDF0QjAgSUwwIDFGZDAgRlgwIGRQQjAgT24wIHlUZDAgZDVYMHwzMWUzXCIsXG5cdFx0XCJBbWVyaWNhL0VsX1NhbHZhZG9yfExNVCBDU1QgQ0RUfDVVLk0gNjAgNTB8MDEyMTIxfC0xWGlHMy5jIDJGdmMzLmMgV0wwIDFxTjAgV0wwfDExZTVcIixcblx0XHRcIkFtZXJpY2EvVGlqdWFuYXxMTVQgTVNUIFBTVCBQRFQgUFdUIFBQVHw3TS40IDcwIDgwIDcwIDcwIDcwfDAxMjEyMzI0NTIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMnwtMVVRRTAgNFBYMCA4bU0wIDhsYzAgU04wIDFjTDAgcEhCMCA4M3IwIHpJMCA1TzEwIDFSejAgY09QMCAxMXowIDFvMTAgMTF6MCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIEJVcDAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCBVMTAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHwyMGU1XCIsXG5cdFx0XCJBbWVyaWNhL0ZvcnRfTmVsc29ufFBTVCBQRFQgUFdUIFBQVCBNU1R8ODAgNzAgNzAgNzAgNzB8MDEwMjMwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDR8LTI1VE8wIDFpbjAgVUdwMCA4eDEwIGl5MCAzTkIwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCBXTDAgMXFOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwfDM5ZTJcIixcblx0XHRcIkFtZXJpY2EvRm9ydF9XYXluZXxDU1QgQ0RUIENXVCBDUFQgRVNUIEVEVHw2MCA1MCA1MCA1MCA1MCA0MHwwMTAxMDEwMjMwMTAxMDEwMTAxMDEwMTAxMDEwNDA0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTR8LTI2MXMwIDFuWDAgMTFCMCAxblgwIFFJMTAgRGIwIFJCMCA4eDMwIGl3MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCBXTDAgMXFOMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgNVR6MCAxbzEwIHFMYjAgMWNMMCAxY04wIDFjTDAgMXFoZDAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMFwiLFxuXHRcdFwiQW1lcmljYS9Gb3J0YWxlemF8TE1UIEJSVCBCUlNUfDJ5IDMwIDIwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTJnbHhxIEhkTHEgMWNjMCAxZTEwIDFiWDAgRXpkMCBTbzAgMXZBMCBNbjAgMUJCMCBNTDAgMUJCMCB6WDAgcWUxMCB4YjAgMmVwMCBuejAgMUMxMCB6WDAgMUMxMCBMWDAgMUMxMCBNbjAgSDIxMCBSYjAgMXRCMCBJTDAgMUZkMCBGWDAgMUVOMCBGWDAgMUhCMCBMejAgbnNwMCBXTDAgMXRCMCA1ejAgMm1OMCBPbjB8MzRlNVwiLFxuXHRcdFwiQW1lcmljYS9HbGFjZV9CYXl8TE1UIEFTVCBBRFQgQVdUIEFQVHwzWC5NIDQwIDMwIDMwIDMwfDAxMjEzNDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMXwtMklzSTAuYyBDd08wLmMgMWluMCBVR3AwIDh4NTAgaXUwIGlxMTAgMTF6MCBKZzEwIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwfDE5ZTNcIixcblx0XHRcIkFtZXJpY2EvR29kdGhhYnxMTVQgV0dUIFdHU1R8M3EuVSAzMCAyMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0yYTVVeC40IDJ6NWR4LjQgMTlVMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDE3ZTNcIixcblx0XHRcIkFtZXJpY2EvR29vc2VfQmF5fE5TVCBORFQgTlNUIE5EVCBOV1QgTlBUIEFTVCBBRFQgQUREVHwzdS5RIDJ1LlEgM3UgMnUgMnUgMnUgNDAgMzAgMjB8MDEwMjMyMzIzMjMyMzIzMjQ1MjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzI2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY4Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2fC0yNVRTdC44IDFpbjAgRFhiMCAySGJYLjggV0wwIDFxTjAgV0wwIDFxTjAgV0wwIDF0QjAgVFgwIDF0QjAgV0wwIDFxTjAgV0wwIDFxTjAgN1VIdSBpdHUgMXRCMCBXTDAgMXFOMCBXTDAgMXFOMCBXTDAgMXFOMCBXTDAgMXRCMCBXTDAgMWxkMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgUzEwIGcwdSAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRuMSAxbGIwIDE0cDAgMW5XMCAxMUMwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpjWCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHw3NmUyXCIsXG5cdFx0XCJBbWVyaWNhL0dyYW5kX1R1cmt8S01UIEVTVCBFRFQgQVNUfDU3LmIgNTAgNDAgNDB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyM3wtMmwxdVEuTiAySEhCUS5OIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjB8MzdlMlwiLFxuXHRcdFwiQW1lcmljYS9HdWF0ZW1hbGF8TE1UIENTVCBDRFR8NjIuNCA2MCA1MHwwMTIxMjEyMTIxfC0yNEtoVi5VIDJlZlhWLlUgQW4wIG10ZDAgTnowIGlmQjAgMTdiMCB6REIwIDExejB8MTNlNVwiLFxuXHRcdFwiQW1lcmljYS9HdWF5YXF1aWx8UU1UIEVDVHw1ZSA1MHwwMXwtMXlWU0t8MjdlNVwiLFxuXHRcdFwiQW1lcmljYS9HdXlhbmF8TE1UIEdCR1QgR1lUIEdZVCBHWVR8M1EuRSAzSiAzSiAzMCA0MHwwMTIzNHwtMmR2VTcuayAyNEp6US5rIG1sYzAgQnhiZnw4MGU0XCIsXG5cdFx0XCJBbWVyaWNhL0hhbGlmYXh8TE1UIEFTVCBBRFQgQVdUIEFQVHw0ZS5vIDQwIDMwIDMwIDMwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMzQxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTJJc0hKLkEgeHp6Si5BIDFkYjAgM0kzMCAxaW4wIDNIWDAgSUwwIDFFMTAgTUwwIDF5TjAgUGIwIDFCZDAgTW4wIDFCZDAgUnowIDF3MTAgWGIwIDF3MTAgTFgwIDF3MTAgWGIwIDF3MTAgTHowIDFDMTAgSnowIDFFMTAgT0wwIDF5TjAgVW4wIDFxcDAgWGIwIDFxcDAgMTFYMCAxdzEwIEx6MCAxSEIwIExYMCAxQzEwIEZYMCAxdzEwIFhiMCAxcXAwIFhiMCAxQkIwIExYMCAxdGQwIFhiMCAxcXAwIFhiMCBSZjAgOHg1MCBpdTAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDNRcDAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAzUXAwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgNmkxMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjB8MzllNFwiLFxuXHRcdFwiQW1lcmljYS9IYXZhbmF8SE1UIENTVCBDRFR8NXQuQSA1MCA0MHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTFNZXV1Lm8gNzJ6dS5vIE1MMCBzbGQwIEFuMCAxTmQwIERiMCAxTmQwIEFuMCA2RXAwIEFuMCAxTmQwIEFuMCBKRGQwIE1uMCAxQXAwIE9uMCAxZmQwIDExWDAgMXFOMCBXTDAgMXdwMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWNOMCAxNG4wIDFsZDAgMTRMMCAxa04wIDE1YjAgMWtwMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWZCMCAxMXowIDE0cDAgMW5YMCAxMUIwIDFuWDAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxNG4wIDFsZDAgMTRuMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMWExMCAxaW4wIDFhMTAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxN2MwIDFvMDAgMTFBMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTRvMCAxbGMwIDE0bzAgMWxjMCAxMUEwIDZpMDAgUmMwIDF3bzAgVTAwIDF0QTAgUmMwIDF3bzAgVTAwIDF3bzAgVTAwIDF6YzAgVTAwIDFxTTAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgUmMwIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgUmMwIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgUmMwIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgUmMwIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzB8MjFlNVwiLFxuXHRcdFwiQW1lcmljYS9IZXJtb3NpbGxvfExNVCBNU1QgQ1NUIFBTVCBNRFR8N24uUSA3MCA2MCA4MCA2MHwwMTIxMjEyMTMxNDE0MTQxfC0xVVFGMCBkZUwwIDhsYzAgMTdjMCAxME0wIDFkZDAgb3RYMCBnbU4wIFAyTjAgMTNWZDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwfDY0ZTRcIixcblx0XHRcIkFtZXJpY2EvSW5kaWFuYS9Lbm94fENTVCBDRFQgQ1dUIENQVCBFU1R8NjAgNTAgNTAgNTAgNTB8MDEwMTAyMzAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTA0MDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDE0MTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMHwtMjYxczAgMW5YMCAxMUIwIDFuWDAgU2dOMCA4eDMwIGl3MCAzTkIwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxZnowIDFjTjAgMWNMMCAxY04wIDExejAgMW8xMCAxMXowIDFvMTAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgM0NuMCA4d3AwIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgczEwIDFWejAgTEIwIDFCWDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIHo4bzAgMW8wMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMFwiLFxuXHRcdFwiQW1lcmljYS9JbmRpYW5hL01hcmVuZ298Q1NUIENEVCBDV1QgQ1BUIEVTVCBFRFR8NjAgNTAgNTAgNTAgNTAgNDB8MDEwMTAyMzAxMDEwMTAxMDEwMTAxMDEwNDU0NTQ1NDU0NTQxNDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NHwtMjYxczAgMW5YMCAxMUIwIDFuWDAgU2dOMCA4eDMwIGl3MCBkeU4wIDExejAgNmZkMCAxMXowIDFvMTAgMTF6MCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAganJ6MCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCBzMTAgMVZBMCBMQTAgMUJYMCAxZTZwMCAxblgwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwXCIsXG5cdFx0XCJBbWVyaWNhL0luZGlhbmEvUGV0ZXJzYnVyZ3xDU1QgQ0RUIENXVCBDUFQgRVNUIEVEVHw2MCA1MCA1MCA1MCA1MCA0MHwwMTAxMDIzMDEwMTAxMDEwMTAxMDEwMTAxMDEwNDAxMDEwMTAxMDEwMTAxMDEwMTAxMDE0MTAxNDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NHwtMjYxczAgMW5YMCAxMUIwIDFuWDAgU2dOMCA4eDMwIGl3MCBualgwIFdOMCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDNGYjAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIHMxMCAxVnowIExCMCAxQlgwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMTljbzAgMW8wMCBSZDAgMXpiMCBPbzAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMFwiLFxuXHRcdFwiQW1lcmljYS9JbmRpYW5hL1RlbGxfQ2l0eXxDU1QgQ0RUIENXVCBDUFQgRVNUIEVEVHw2MCA1MCA1MCA1MCA1MCA0MHwwMTAxMDIzMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDQ1NDU0MTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMHwtMjYxczAgMW5YMCAxMUIwIDFuWDAgU2dOMCA4eDMwIGl3MCAxbzEwIDExejAgZzBwMCAxMXowIDFvMTAgMTF6MCAxcUwwIFdOMCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxZnowIDFjTjAgV0wwIDFxTjAgMWNMMCAxY04wIDFjTDAgMWNOMCBjYUwwIDFjTDAgMWNOMCAxY0wwIDFxaGQwIDFvMDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjBcIixcblx0XHRcIkFtZXJpY2EvSW5kaWFuYS9WZXZheXxDU1QgQ0RUIENXVCBDUFQgRVNUIEVEVHw2MCA1MCA1MCA1MCA1MCA0MHwwMTAxMDIzMDQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTR8LTI2MXMwIDFuWDAgMTFCMCAxblgwIFNnTjAgOHgzMCBpdzAga1BCMCBBd24wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWxuZDAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMFwiLFxuXHRcdFwiQW1lcmljYS9JbmRpYW5hL1ZpbmNlbm5lc3xDU1QgQ0RUIENXVCBDUFQgRVNUIEVEVHw2MCA1MCA1MCA1MCA1MCA0MHwwMTAxMDIzMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDQ1NDU0MTAxNDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NHwtMjYxczAgMW5YMCAxMUIwIDFuWDAgU2dOMCA4eDMwIGl3MCAxbzEwIDExejAgZzBwMCAxMXowIDFvMTAgMTF6MCAxcUwwIFdOMCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxZnowIDFjTjAgV0wwIDFxTjAgMWNMMCAxY04wIDFjTDAgMWNOMCBjYUwwIDFjTDAgMWNOMCAxY0wwIDFxaGQwIDFvMDAgUmQwIDF6YjAgT28wIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjBcIixcblx0XHRcIkFtZXJpY2EvSW5kaWFuYS9XaW5hbWFjfENTVCBDRFQgQ1dUIENQVCBFU1QgRURUfDYwIDUwIDUwIDUwIDUwIDQwfDAxMDEwMjMwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwNDU0NTQxMDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0fC0yNjFzMCAxblgwIDExQjAgMW5YMCBTZ04wIDh4MzAgaXcwIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxZnowIDFjTjAgMWNMMCAxY04wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCBqcnowIDFjTDAgMWNOMCAxY0wwIDFxaGQwIDFvMDAgUmQwIDF6YTAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjBcIixcblx0XHRcIkFtZXJpY2EvSW51dmlrfHp6eiBQU1QgUEREVCBNU1QgTURUfDAgODAgNjAgNzAgNjB8MDEyMTM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0M3wtRm5BMCB0V1UwIDFmQTAgd1BlMCAycHowIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHwzNWUyXCIsXG5cdFx0XCJBbWVyaWNhL0lxYWx1aXR8enp6IEVXVCBFUFQgRVNUIEVERFQgRURUIENTVCBDRFR8MCA0MCA0MCA1MCAzMCA0MCA2MCA1MHwwMTIzNDM1MzUzNTM1MzUzNTM1MzUzNTM1MzUzNTM1MzUzNTM1MzUzNTM1MzU2NzM1MzUzNTM1MzUzNTM1MzUzNTM1MzUzNTM1MzUzNTM1MzUzNTM1MzUzNTM1MzUzNTM1MzUzNTM1MzUzNTM1MzUzNTM1MzUzNTM1M3wtMTZLMDAgN25YMCBpdjAgTENMMCAxZkEwIHpnTzAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFDMCAxblgwIDExQTAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwfDY3ZTJcIixcblx0XHRcIkFtZXJpY2EvSmFtYWljYXxLTVQgRVNUIEVEVHw1Ny5iIDUwIDQwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTJsMXVRLk4gMnVNMVEuTiAxVnowIExCMCAxQlgwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejB8OTRlNFwiLFxuXHRcdFwiQW1lcmljYS9KdW5lYXV8UFNUIFBXVCBQUFQgUERUIFlEVCBZU1QgQUtTVCBBS0RUfDgwIDcwIDcwIDcwIDgwIDkwIDkwIDgwfDAxMjAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwNDAzMDMwMzU2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2fC0xN1QyMCA4eDEwIGl5MCBWbzEwIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIHMxMCAxVnowIExCMCAxQlgwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTTAgMWNNMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgY28wIDEwcTAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjB8MzNlM1wiLFxuXHRcdFwiQW1lcmljYS9LZW50dWNreS9Mb3Vpc3ZpbGxlfENTVCBDRFQgQ1dUIENQVCBFU1QgRURUfDYwIDUwIDUwIDUwIDUwIDQwfDAxMDEwMTAxMDIzMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDE0NTQ1NDU0NTQ1NDU0MTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTR8LTI2MXMwIDFuWDAgMTFCMCAxblgwIDNGZDAgTmIwIExQZDAgMTF6MCBSQjAgOHgzMCBpdzAgQmIwIDEwTjAgMmJCMCA4aW4wIDFxTjAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxY04wIHh6MCBnc28wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCBzMTAgMVZBMCBMQTAgMUJYMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjBcIixcblx0XHRcIkFtZXJpY2EvS2VudHVja3kvTW9udGljZWxsb3xDU1QgQ0RUIENXVCBDUFQgRVNUIEVEVHw2MCA1MCA1MCA1MCA1MCA0MHwwMTAxMDIzMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxNDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0fC0yNjFzMCAxblgwIDExQjAgMW5YMCBTZ04wIDh4MzAgaXcwIFNXcDAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIHMxMCAxVnowIExCMCAxQlgwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUEwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMFwiLFxuXHRcdFwiQW1lcmljYS9MYV9QYXp8Q01UIEJPU1QgQk9UfDR3LkEgM3cuQSA0MHwwMTJ8LTF4MzdyLm8gMTNiMHwxOWU1XCIsXG5cdFx0XCJBbWVyaWNhL0xpbWF8TE1UIFBFVCBQRVNUfDU4LkEgNTAgNDB8MDEyMTIxMjEyMTIxMjEyMXwtMnR5R1AubyAxYkR6UC5vIHpYMCAxYU4wIDFjTDAgMWNOMCAxY0wwIDFQckIwIHpYMCAxTzEwIHpYMCA2R3AwIHpYMCA5OHAwIHpYMHwxMWU2XCIsXG5cdFx0XCJBbWVyaWNhL0xvc19BbmdlbGVzfFBTVCBQRFQgUFdUIFBQVHw4MCA3MCA3MCA3MHwwMTAxMDIzMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTB8LTI2MXEwIDFuWDAgMTFCMCAxblgwIFNnTjAgOHgxMCBpeTAgNVdwMCAxVmIwIDNkQjAgV0wwIDFxTjAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxcU4wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCBzMTAgMVZ6MCBMQjAgMUJYMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjB8MTVlNlwiLFxuXHRcdFwiQW1lcmljYS9NYWNlaW98TE1UIEJSVCBCUlNUfDJtLlEgMzAgMjB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0yZ2x4Qi44IEhkTEIuOCAxY2MwIDFlMTAgMWJYMCBFemQwIFNvMCAxdkEwIE1uMCAxQkIwIE1MMCAxQkIwIHpYMCBxZTEwIHhiMCAyZXAwIG56MCAxQzEwIHpYMCAxQzEwIExYMCAxQzEwIE1uMCBIMjEwIFJiMCAxdEIwIElMMCAxRmQwIEZYMCAxRU4wIEZYMCAxSEIwIEx6MCBkTU4wIEx6MCA4UTEwIFdMMCAxdEIwIDV6MCAybU4wIE9uMHw5M2U0XCIsXG5cdFx0XCJBbWVyaWNhL01hbmFndWF8TU1UIENTVCBFU1QgQ0RUfDVKLmMgNjAgNTAgNTB8MDEyMTMxMzEyMTIxMzEzMXwtMXF1aWUuTSAxeUFNZS5NIDRtbjAgOVVwMCBEejAgMUsxMCBEejAgczNGMCAxS0gwIERCMCA5SW4wIGs4cDAgMTlYMCAxbzMwIDExeTB8MjJlNVwiLFxuXHRcdFwiQW1lcmljYS9NYW5hdXN8TE1UIEFNVCBBTVNUfDQwLjQgNDAgMzB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTJnbHZYLlUgSGRLWC5VIDFjYzAgMWUxMCAxYlgwIEV6ZDAgU28wIDF2QTAgTW4wIDFCQjAgTUwwIDFCQjAgelgwIHFlMTAgeGIwIDJlcDAgbnowIDFDMTAgelgwIDFDMTAgTFgwIDFDMTAgTW4wIEgyMTAgUmIwIDF0QjAgSUwwIDFGZDAgRlgwIGRQQjAgT24wfDE5ZTVcIixcblx0XHRcIkFtZXJpY2EvTWFydGluaXF1ZXxGRk1UIEFTVCBBRFR8NDQuayA0MCAzMHwwMTIxfC0ybVBUVC5FIDJMUGJULkUgMTlYMHwzOWU0XCIsXG5cdFx0XCJBbWVyaWNhL01hdGFtb3Jvc3xMTVQgQ1NUIENEVHw2RSA2MCA1MHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0xVVFHMCAyRmpDMCAxblgwIGk2cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMWZCMCBXTDAgMWZCMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCBVMTAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHw0NWU0XCIsXG5cdFx0XCJBbWVyaWNhL01hemF0bGFufExNVCBNU1QgQ1NUIFBTVCBNRFR8NzUuRSA3MCA2MCA4MCA2MHwwMTIxMjEyMTMxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxfC0xVVFGMCBkZUwwIDhsYzAgMTdjMCAxME0wIDFkZDAgb3RYMCBnbU4wIFAyTjAgMTNWZDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMWZCMCBXTDAgMWZCMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjB8NDRlNFwiLFxuXHRcdFwiQW1lcmljYS9NZW5vbWluZWV8Q1NUIENEVCBDV1QgQ1BUIEVTVHw2MCA1MCA1MCA1MCA1MHwwMTAxMDIzMDEwMTA0MTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMHwtMjYxczAgMW5YMCAxMUIwIDFuWDAgU2dOMCA4eDMwIGl3MCAxbzEwIDExejAgTENOMCAxZnowIDY0MTAgOUpiMCAxY00wIHMxMCAxVnowIExCMCAxQlgwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHw4NWUyXCIsXG5cdFx0XCJBbWVyaWNhL01lcmlkYXxMTVQgQ1NUIEVTVCBDRFR8NVcucyA2MCA1MCA1MHwwMTIxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxfC0xVVFHMCAycTJvMCAyaHowIHd1MzAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMWZCMCBXTDAgMWZCMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjB8MTFlNVwiLFxuXHRcdFwiQW1lcmljYS9NZXRsYWthdGxhfFBTVCBQV1QgUFBUIFBEVCBBS1NUIEFLRFR8ODAgNzAgNzAgNzAgOTAgODB8MDEyMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NHwtMTdUMjAgOHgxMCBpeTAgVm8xMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCBzMTAgMVZ6MCBMQjAgMUJYMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFoVTEwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwfDE0ZTJcIixcblx0XHRcIkFtZXJpY2EvTWV4aWNvX0NpdHl8TE1UIE1TVCBDU1QgQ0RUIENXVHw2QS5BIDcwIDYwIDUwIDUwfDAxMjEyMTIzMjMyNDIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMnwtMVVRRjAgZGVMMCA4bGMwIDE3YzAgMTBNMCAxZGQwIGdFbjAgVFgwIDN4ZDAgSmIwIDZ6QjAgU0wwIGU1ZDAgMTdiMCAxUGZmMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxZkIwIFdMMCAxZkIwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMHwyMGU2XCIsXG5cdFx0XCJBbWVyaWNhL01pcXVlbG9ufExNVCBBU1QgUE1TVCBQTURUfDNJLkUgNDAgMzAgMjB8MDEyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyfC0ybUtrZi5rIDJMVEFmLmsgZ1ExMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHw2MWUyXCIsXG5cdFx0XCJBbWVyaWNhL01vbmN0b258RVNUIEFTVCBBRFQgQVdUIEFQVHw1MCA0MCAzMCAzMCAzMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMzQxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTJJc0gwIEN3TjAgMWluMCB6QW8wIEFuMCAxTmQwIEFuMCAxTmQwIEFuMCAxTmQwIEFuMCAxTmQwIEFuMCAxTmQwIEFuMCAxSzEwIEx6MCAxekIwIE5YMCAxdTEwIFduMCBTMjAgOHg1MCBpdTAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAgV0wwIDFxTjAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCAxMXowIDFvMTAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAzQ3AwIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRuMSAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZVggMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHw2NGUzXCIsXG5cdFx0XCJBbWVyaWNhL01vbnRlcnJleXxMTVQgQ1NUIENEVHw2Ri5nIDYwIDUwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTFVUUcwIDJGakMwIDFuWDAgaTZwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxZkIwIFdMMCAxZkIwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMHw0MWU1XCIsXG5cdFx0XCJBbWVyaWNhL01vbnRldmlkZW98TU1UIFVZVCBVWUhTVCBVWVNUIFVZVCBVWUhTVHwzSS5JIDN1IDMwIDIwIDMwIDJ1fDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMzQzNDM0MzQzNDM0NTQ1NDU0MzQ1MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNHwtMjBVSWYuZyA4anpKLmcgMWNMdSAxZGN1IDFjTHUgMWRjdSAxY0x1IGlyY3UgMTF6dSAxbzB1IDExenUgMW8wdSAxMXp1IDFxTXUgV0x1IDFxTXUgV0x1IDFxTXUgV0x1IDFxTXUgMTF6dSAxbzB1IDExenUgTkF1IDExYnUgMmlNdSB6V3UgRHExMCAxOVgwIHBkMCBqejAgY20xMCAxOVgwIDFmQjAgMW9uMCAxMWQwIDFvTDAgMW5CMCAxZnp1IDFhb3UgMWZ6dSAxYW91IDFmenUgM25BdSBKYjAgM01OMCAxU0x1IDRqenUgMlBCMCBMYjAgM0RkMCAxcGIwIGl4ZDAgQW4wIDFNTjAgQW4wIDF3cDAgT24wIDF3cDAgUmIwIDF6ZDAgT24wIDF3cDAgUmIwIHM4cDAgMWZCMCAxaXAwIDExejAgMWxkMCAxNG4wIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxNG4wIDFsZDAgMTRuMCAxbGQwIDE0bjAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejB8MTdlNVwiLFxuXHRcdFwiQW1lcmljYS9Ub3JvbnRvfEVTVCBFRFQgRVdUIEVQVHw1MCA0MCA0MCA0MHwwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMjMwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMHwtMjVUUjAgMWluMCAxMVd1IDFuenUgMWZEMCBXSjAgMXdyMCBOYjAgMUFwMCBPbjAgMXpkMCBPbjAgMXdwMCBUWDAgMXRCMCBUWDAgMXRCMCBUWDAgMXRCMCBXTDAgMXFOMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAgV0wwIDFxTjAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAgV0wwIDFxTjAgNGtNMCA4eDQwIGl2MCAxbzEwIDExejAgMW5YMCAxMXowIDFvMTAgMTF6MCAxbzEwIDFxTDAgMTFEMCAxblgwIDExQjAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCAxMXowIDFvMTAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjB8NjVlNVwiLFxuXHRcdFwiQW1lcmljYS9OYXNzYXV8TE1UIEVTVCBFRFR8NTkudSA1MCA0MHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTJrTnVPLnUgMjZYZE8udSAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwfDI0ZTRcIixcblx0XHRcIkFtZXJpY2EvTmV3X1lvcmt8RVNUIEVEVCBFV1QgRVBUfDUwIDQwIDQwIDQwfDAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAyMzAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwfC0yNjF0MCAxblgwIDExQjAgMW5YMCAxMUIwIDFxTDAgMWExMCAxMXowIDFxTjAgV0wwIDFxTjAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAgV0wwIDFxTjAgMTF6MCAxbzEwIDExejAgUkIwIDh4NDAgaXYwIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIHMxMCAxVnowIExCMCAxQlgwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHwyMWU2XCIsXG5cdFx0XCJBbWVyaWNhL05pcGlnb258RVNUIEVEVCBFV1QgRVBUfDUwIDQwIDQwIDQwfDAxMDEyMzAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMHwtMjVUUjAgMWluMCBSbmIwIDNqZTAgOHg0MCBpdjAgMTl5TjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwfDE2ZTJcIixcblx0XHRcIkFtZXJpY2EvTm9tZXxOU1QgTldUIE5QVCBCU1QgQkRUIFlTVCBBS1NUIEFLRFR8YjAgYTAgYTAgYjAgYTAgOTAgOTAgODB8MDEyMDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDU2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2fC0xN1NYMCA4d1cwIGlCMCBRbGIwIDUyTzAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgczEwIDFWejAgTEIwIDFCWDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCBjbDAgMTBxMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHwzOGUyXCIsXG5cdFx0XCJBbWVyaWNhL05vcm9uaGF8TE1UIEZOVCBGTlNUfDI5LkUgMjAgMTB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMXwtMmdseE8uayBIZEtPLmsgMWNjMCAxZTEwIDFiWDAgRXpkMCBTbzAgMXZBMCBNbjAgMUJCMCBNTDAgMUJCMCB6WDAgcWUxMCB4YjAgMmVwMCBuejAgMUMxMCB6WDAgMUMxMCBMWDAgMUMxMCBNbjAgSDIxMCBSYjAgMXRCMCBJTDAgMUZkMCBGWDAgMUVOMCBGWDAgMUhCMCBMejAgbnNwMCBXTDAgMXRCMCAyTDAgMnBCMCBPbjB8MzBlMlwiLFxuXHRcdFwiQW1lcmljYS9Ob3J0aF9EYWtvdGEvQmV1bGFofE1TVCBNRFQgTVdUIE1QVCBDU1QgQ0RUfDcwIDYwIDYwIDYwIDYwIDUwfDAxMDEwMjMwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxNDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NHwtMjYxcjAgMW5YMCAxMUIwIDFuWDAgU2dOMCA4eDIwIGl4MCBRd04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgczEwIDFWejAgTEIwIDFCWDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9vMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwXCIsXG5cdFx0XCJBbWVyaWNhL05vcnRoX0Rha290YS9DZW50ZXJ8TVNUIE1EVCBNV1QgTVBUIENTVCBDRFR8NzAgNjAgNjAgNjAgNjAgNTB8MDEwMTAyMzAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDE0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0fC0yNjFyMCAxblgwIDExQjAgMW5YMCBTZ04wIDh4MjAgaXgwIFF3TjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCBzMTAgMVZ6MCBMQjAgMUJYMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0bzAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjBcIixcblx0XHRcIkFtZXJpY2EvTm9ydGhfRGFrb3RhL05ld19TYWxlbXxNU1QgTURUIE1XVCBNUFQgQ1NUIENEVHw3MCA2MCA2MCA2MCA2MCA1MHwwMTAxMDIzMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDE0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTR8LTI2MXIwIDFuWDAgMTFCMCAxblgwIFNnTjAgOHgyMCBpeDAgUXdOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIHMxMCAxVnowIExCMCAxQlgwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNG8wIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMFwiLFxuXHRcdFwiQW1lcmljYS9PamluYWdhfExNVCBNU1QgQ1NUIENEVCBNRFR8NlYuRSA3MCA2MCA1MCA2MHwwMTIxMjEyMzIzMjQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxfC0xVVFGMCBkZUwwIDhsYzAgMTdjMCAxME0wIDFkZDAgMnpRTjAgMWxiMCAxNHAwIDFsYjAgMTRxMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMWZCMCBXTDAgMWZCMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCBVMTAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHwyM2UzXCIsXG5cdFx0XCJBbWVyaWNhL1BhbmduaXJ0dW5nfHp6eiBBU1QgQVdUIEFQVCBBRERUIEFEVCBFRFQgRVNUIENTVCBDRFR8MCA0MCAzMCAzMCAyMCAzMCA0MCA1MCA2MCA1MHwwMTIzMTQxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNjc2NzY3Njc2ODk3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njd8LTFYaU0wIFBuRzAgOHg1MCBpdTAgTENMMCAxZkEwIHpnTzAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW8wMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFDMCAxblgwIDExQTAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwfDE0ZTJcIixcblx0XHRcIkFtZXJpY2EvUGFyYW1hcmlib3xMTVQgUE1UIFBNVCBORUdUIFNSVCBTUlR8M0UuRSAzRS5RIDNFLkEgM3UgM3UgMzB8MDEyMzQ1fC0ybkRVai5rIFdxbzAuYyBxYW5YLkkgMWRtTE4ubyBsemMwfDI0ZTRcIixcblx0XHRcIkFtZXJpY2EvUGhvZW5peHxNU1QgTURUIE1XVHw3MCA2MCA2MHwwMTAxMDIwMjAxMHwtMjYxcjAgMW5YMCAxMUIwIDFuWDAgU2dOMCA0QWwxIEFwMCAxZGIwIFNXcVggMWNMMHw0MmU1XCIsXG5cdFx0XCJBbWVyaWNhL1BvcnQtYXUtUHJpbmNlfFBQTVQgRVNUIEVEVHw0TiA1MCA0MHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMXwtMjhSSGIgMkZuTWIgMTlYMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRxMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTRvMCAxbGMwIDE0bzAgMWxjMCAxNG8wIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxNG8wIDFsYzAgMTRvMCAxbGMwIGk2bjAgMW5YMCAxMUIwIDFuWDAgZDQzMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwfDIzZTVcIixcblx0XHRcIkFtZXJpY2EvUmlvX0JyYW5jb3xMTVQgQUNUIEFDU1QgQU1UfDR2LmMgNTAgNDAgNDB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMzF8LTJnbHZzLk0gSGRMcy5NIDFjYzAgMWUxMCAxYlgwIEV6ZDAgU28wIDF2QTAgTW4wIDFCQjAgTUwwIDFCQjAgelgwIHFlMTAgeGIwIDJlcDAgbnowIDFDMTAgelgwIDFDMTAgTFgwIDFDMTAgTW4wIEgyMTAgUmIwIDF0QjAgSUwwIDFGZDAgRlgwIE5CZDAgZDVYMHwzMWU0XCIsXG5cdFx0XCJBbWVyaWNhL1BvcnRvX1ZlbGhvfExNVCBBTVQgQU1TVHw0Zi5BIDQwIDMwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMXwtMmdsdkkubyBIZEtJLm8gMWNjMCAxZTEwIDFiWDAgRXpkMCBTbzAgMXZBMCBNbjAgMUJCMCBNTDAgMUJCMCB6WDAgcWUxMCB4YjAgMmVwMCBuejAgMUMxMCB6WDAgMUMxMCBMWDAgMUMxMCBNbjAgSDIxMCBSYjAgMXRCMCBJTDAgMUZkMCBGWDB8MzdlNFwiLFxuXHRcdFwiQW1lcmljYS9QdWVydG9fUmljb3xBU1QgQVdUIEFQVHw0MCAzMCAzMHwwMTIwfC0xN2xVMCA3WFQwIGl1MHwyNGU1XCIsXG5cdFx0XCJBbWVyaWNhL1JhaW55X1JpdmVyfENTVCBDRFQgQ1dUIENQVHw2MCA1MCA1MCA1MHwwMTAxMjMwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTB8LTI1VFEwIDFpbjAgUm5iMCAzamUwIDh4MzAgaXcwIDE5eU4wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHw4NDJcIixcblx0XHRcIkFtZXJpY2EvUmFua2luX0lubGV0fHp6eiBDU1QgQ0REVCBDRFQgRVNUfDAgNjAgNDAgNTAgNTB8MDEyMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzNDMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxfC12RGMwIGtldTAgMWZBMCB6Z08wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHwyNmUyXCIsXG5cdFx0XCJBbWVyaWNhL1JlY2lmZXxMTVQgQlJUIEJSU1R8MmouQSAzMCAyMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0yZ2x4RS5vIEhkTEUubyAxY2MwIDFlMTAgMWJYMCBFemQwIFNvMCAxdkEwIE1uMCAxQkIwIE1MMCAxQkIwIHpYMCBxZTEwIHhiMCAyZXAwIG56MCAxQzEwIHpYMCAxQzEwIExYMCAxQzEwIE1uMCBIMjEwIFJiMCAxdEIwIElMMCAxRmQwIEZYMCAxRU4wIEZYMCAxSEIwIEx6MCBuc3AwIFdMMCAxdEIwIDJMMCAycEIwIE9uMHwzM2U1XCIsXG5cdFx0XCJBbWVyaWNhL1JlZ2luYXxMTVQgTVNUIE1EVCBNV1QgTVBUIENTVHw2Vy5BIDcwIDYwIDYwIDYwIDYwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTM0MTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxNXwtMkFENTEubyB1SGUxLm8gMWluMCBzMkwwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxcU4wIDExejAgNjZOMCAxY0wwIDFjTjAgMTlYMCAxZkIwIDFjTDAgMWZCMCAxY0wwIDFjTjAgMWNMMCBNMzAgOHgyMCBpeDAgMWlwMCAxY0wwIDFpcDAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAgV0wwIDFxTjAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCAxMXowIDFvMTAgMTF6MCAzTkIwIDFjTDAgMWNOMHwxOWU0XCIsXG5cdFx0XCJBbWVyaWNhL1Jlc29sdXRlfHp6eiBDU1QgQ0REVCBDRFQgRVNUfDAgNjAgNDAgNTAgNTB8MDEyMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzNDMxMzEzMTMxMzEzNDMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxfC1TbkEwIEdXUzAgMWZBMCB6Z08wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHwyMjlcIixcblx0XHRcIkFtZXJpY2EvU2FudGFyZW18TE1UIEFNVCBBTVNUIEJSVHwzQy5NIDQwIDMwIDMwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTN8LTJnbHdsLmMgSGRMbC5jIDFjYzAgMWUxMCAxYlgwIEV6ZDAgU28wIDF2QTAgTW4wIDFCQjAgTUwwIDFCQjAgelgwIHFlMTAgeGIwIDJlcDAgbnowIDFDMTAgelgwIDFDMTAgTFgwIDFDMTAgTW4wIEgyMTAgUmIwIDF0QjAgSUwwIDFGZDAgRlgwIE5CZDB8MjFlNFwiLFxuXHRcdFwiQW1lcmljYS9TYW50aWFnb3xTTVQgQ0xUIENMVCBDTFNUIENMU1R8NEcuSyA1MCA0MCA0MCAzMHwwMTAyMDMxMzEzMTMxMzEyMTI0MjEyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjR8LTJxMmpoLmUgZkpBaC5lIDVrbkcuSyAxVnpoLmUgalJBRy5LIDFwYmguZSAxMWQwIDFvTDAgMTFkMCAxb0wwIDExZDAgMW9MMCAxMWQwIDFwYjAgMTFkMCBuSFgwIG9wMCA5QnowIGpiMCAxb04wIGtvMCBRZW8wIFdMMCAxemQwIE9uMCAxaXAwIDExejAgMW8xMCAxMXowIDFxTjAgV0wwIDFsZDAgMTRuMCAxcU4wIFdMMCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxcU4wIFdMMCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCBXTDAgMXFOMCBXTDAgMXFOMCAxY0wwIDFjTjAgMTF6MCAxbzEwIDExejAgMXFOMCBXTDAgMWZCMCAxOVgwIDFxTjAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxcU4wIDE3YjAgMWlwMCAxMXowIDFpcDAgMWZ6MCAxZkIwIDExejAgMXFOMCBXTDAgMXFOMCBXTDAgMXFOMCBXTDAgMXFOMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCBXTDAgMXFOMCAxN2IwIDFpcDAgMTF6MCAxbzEwIDE5WDAgMWZCMCAxblgwIEcxMCAxRUwwIE9wMCAxemIwIFJkMCAxd24wIFJkMCA0Nm4wIEFwMCAxTmIwIEFwMCAxTmIwIEFwMCAxTmIwIEFwMCAxTmIwIEFwMCAxTmIwIERkMCAxTmIwIEFwMCAxTmIwIEFwMCAxTmIwIEFwMCAxTmIwIEFwMCAxTmIwIEFwMCAxTmIwIERkMCAxTmIwIEFwMCAxTmIwIEFwMCAxTmIwIEFwMCAxTmIwIEFwMCAxTmIwIERkMCAxTmIwIEFwMCAxTmIwIEFwMCAxTmIwIEFwMCAxTmIwIEFwMCAxTmIwIEFwMHw2MmU1XCIsXG5cdFx0XCJBbWVyaWNhL1NhbnRvX0RvbWluZ298U0RNVCBFU1QgRURUIEVIRFQgQVNUfDRFIDUwIDQwIDR1IDQwfDAxMjEzMTMxMzEzMTMxNDE0fC0xdHRqayAxbEpNayBNbjAgNnNwMCBMYnUgMUNvdSB5THUgMVJBdSB3THUgMVFNdSB4enUgMVEwdSB4WHUgMVBBdSAxM2pCMCBlMDB8MjllNVwiLFxuXHRcdFwiQW1lcmljYS9TYW9fUGF1bG98TE1UIEJSVCBCUlNUfDM2LnMgMzAgMjB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyfC0yZ2x3Ui53IEhkS1IudyAxY2MwIDFlMTAgMWJYMCBFemQwIFNvMCAxdkEwIE1uMCAxQkIwIE1MMCAxQkIwIHpYMCBwVGQwIFBYMCAyZXAwIG56MCAxQzEwIHpYMCAxQzEwIExYMCAxQzEwIE1uMCBIMjEwIFJiMCAxdEIwIElMMCAxRmQwIEZYMCAxRU4wIEZYMCAxSEIwIEx6MCAxRU4wIEx6MCAxQzEwIElMMCAxSEIwIERiMCAxSEIwIE9uMCAxemQwIE9uMCAxemQwIEx6MCAxemQwIFJiMCAxd04wIFduMCAxdEIwIFJiMCAxdEIwIFdMMCAxdEIwIFJiMCAxemQwIE9uMCAxSEIwIEZYMCAxQzEwIEx6MCAxSXAwIEhYMCAxemQwIE9uMCAxSEIwIElMMCAxd3AwIE9uMCAxQzEwIEx6MCAxQzEwIE9uMCAxemQwIE9uMCAxemQwIFJiMCAxemQwIEx6MCAxQzEwIEx6MCAxQzEwIE9uMCAxemQwIE9uMCAxemQwIE9uMCAxemQwIE9uMCAxQzEwIEx6MCAxQzEwIEx6MCAxQzEwIE9uMCAxemQwIE9uMCAxemQwIFJiMCAxd3AwIE9uMCAxQzEwIEx6MCAxQzEwIE9uMCAxemQwIE9uMCAxemQwIE9uMCAxemQwIE9uMCAxQzEwIEx6MCAxQzEwIEx6MCAxQzEwIEx6MCAxQzEwIE9uMCAxemQwIFJiMCAxd3AwIE9uMCAxQzEwIEx6MCAxQzEwIE9uMCAxemQwfDIwZTZcIixcblx0XHRcIkFtZXJpY2EvU2NvcmVzYnlzdW5kfExNVCBDR1QgQ0dTVCBFR1NUIEVHVHwxci5RIDIwIDEwIDAgMTB8MDEyMTM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNHwtMmE1V3cuOCAyejVldy44IDFhMDAgMWNLMCAxY0wwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMHw0NTJcIixcblx0XHRcIkFtZXJpY2EvU2l0a2F8UFNUIFBXVCBQUFQgUERUIFlTVCBBS1NUIEFLRFR8ODAgNzAgNzAgNzAgOTAgOTAgODB8MDEyMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzNDU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjV8LTE3VDIwIDh4MTAgaXkwIFZvMTAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgczEwIDFWejAgTEIwIDFCWDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCBjbzAgMTBxMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHw5MGUyXCIsXG5cdFx0XCJBbWVyaWNhL1N0X0pvaG5zfE5TVCBORFQgTlNUIE5EVCBOV1QgTlBUIE5ERFR8M3UuUSAydS5RIDN1IDJ1IDJ1IDJ1IDF1fDAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAyMzIzMjMyMzIzMjMyMzI0NTIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzI2MjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyfC0yOG9pdC44IDE0TDAgMW5CMCAxaW4wIDFnbTAgRHowIDFKQjAgMWNMMCAxY04wIDFjTDAgMWZCMCAxOVgwIDFmQjAgMTlYMCAxZkIwIDE5WDAgMWZCMCAxOVgwIDFmQjAgMWNMMCAxY04wIDFjTDAgMWZCMCAxOVgwIDFmQjAgMTlYMCAxZkIwIDE5WDAgMWZCMCAxOVgwIDFmQjAgMWNMMCAxZkIwIDE5WDAgMWZCMCAxOVgwIDEwTzAgZUtYLjggMTlYMCAxaXEwIFdMMCAxcU4wIFdMMCAxcU4wIFdMMCAxdEIwIFRYMCAxdEIwIFdMMCAxcU4wIFdMMCAxcU4wIDdVSHUgaXR1IDF0QjAgV0wwIDFxTjAgV0wwIDFxTjAgV0wwIDFxTjAgV0wwIDF0QjAgV0wwIDFsZDAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0bjEgMWxiMCAxNHAwIDFuVzAgMTFDMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6Y1ggT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjB8MTFlNFwiLFxuXHRcdFwiQW1lcmljYS9Td2lmdF9DdXJyZW50fExNVCBNU1QgTURUIE1XVCBNUFQgQ1NUfDdiLmsgNzAgNjAgNjAgNjAgNjB8MDEyMTM0MTIxMjEyMTIxMjEyMTIxMjE1fC0yQUQ0TS5FIHVIZE0uRSAxaW4wIFVHcDAgOHgyMCBpeDAgMW8xMCAxN2IwIDFpcDAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIGlzTjAgMWNMMCAzQ3AwIDFjTDAgMWNOMCAxMXowIDFxTjAgV0wwIHBNcDB8MTZlM1wiLFxuXHRcdFwiQW1lcmljYS9UZWd1Y2lnYWxwYXxMTVQgQ1NUIENEVHw1TS5RIDYwIDUwfDAxMjEyMTIxfC0xV0dHYi44IDJFVGNiLjggV0wwIDFxTjAgV0wwIEdSZDAgQUwwfDExZTVcIixcblx0XHRcIkFtZXJpY2EvVGh1bGV8TE1UIEFTVCBBRFR8NHouOCA0MCAzMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTJhNVRvLlEgMzFOQm8uUSAxY0wwIDFjTjAgMWNMMCAxZkIwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwfDY1NlwiLFxuXHRcdFwiQW1lcmljYS9UaHVuZGVyX0JheXxDU1QgRVNUIEVXVCBFUFQgRURUfDYwIDUwIDQwIDQwIDQwfDAxMjMxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDF8LTJxNVMwIDFpYU4wIDh4NDAgaXYwIFhOQjAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIDNDcDAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwfDExZTRcIixcblx0XHRcIkFtZXJpY2EvVmFuY291dmVyfFBTVCBQRFQgUFdUIFBQVHw4MCA3MCA3MCA3MHwwMTAyMzAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwfC0yNVRPMCAxaW4wIFVHcDAgOHgxMCBpeTAgMW8xMCAxN2IwIDFpcDAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAgV0wwIDFxTjAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMXFOMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxcU4wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHwyM2U1XCIsXG5cdFx0XCJBbWVyaWNhL1doaXRlaG9yc2V8WVNUIFlEVCBZV1QgWVBUIFlERFQgUFNUIFBEVHw5MCA4MCA4MCA4MCA3MCA4MCA3MHwwMTAxMDIzMDQwNTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1fC0yNVROMCAxaW4wIDFvMTAgMTNWMCBTZXIwIDh4MDAgaXowIExDTDAgMWZBMCAzTkEwIHZyZDAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwfDIzZTNcIixcblx0XHRcIkFtZXJpY2EvV2lubmlwZWd8Q1NUIENEVCBDV1QgQ1BUfDYwIDUwIDUwIDUwfDAxMDEwMTAyMzAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMHwtMmFJaTAgV0wwIDNORDAgMWluMCBKYXAwIFJiMCBhQ04wIDh4MzAgaXcwIDF0QjAgMTF6MCAxaXAwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcmQwIDEwTDAgMW9wMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxbzEwIDFjTDAgMWNOMCAxMXowIDZpMTAgV0wwIDZpMTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWEwMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWEwMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDE0bzAgMWxjMCAxNG8wIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxNG8wIDFsYzAgMTRvMCAxbGMwIDE0bzAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDE0bzAgMWxjMCAxNG8wIDFsYzAgMTRvMCAxbGMwIDE0bzAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDE0bzAgMWxjMCAxNG8wIDFsYzAgMTRvMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjB8NjZlNFwiLFxuXHRcdFwiQW1lcmljYS9ZYWt1dGF0fFlTVCBZV1QgWVBUIFlEVCBBS1NUIEFLRFR8OTAgODAgODAgODAgOTAgODB8MDEyMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTR8LTE3VDEwIDh4MDAgaXowIFZvMTAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgczEwIDFWejAgTEIwIDFCWDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCBjbjAgMTBxMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHw2NDJcIixcblx0XHRcIkFtZXJpY2EvWWVsbG93a25pZmV8enp6IE1TVCBNV1QgTVBUIE1ERFQgTURUfDAgNzAgNjAgNjAgNTAgNjB8MDEyMzE0MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxNTE1MTUxfC0xcGRBMCBoaXgwIDh4MjAgaXgwIExDTDAgMWZBMCB6Z08wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxYTEwIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBSZDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMCBPcDAgMXpiMHwxOWUzXCIsXG5cdFx0XCJBbnRhcmN0aWNhL0Nhc2V5fHp6eiBBV1NUIENBU1R8MCAtODAgLWIwfDAxMjEyMXwtMnEwMCAxRGpTMCBUOTAgNDBQMCBLTDB8MTBcIixcblx0XHRcIkFudGFyY3RpY2EvRGF2aXN8enp6IERBVlQgREFWVHwwIC03MCAtNTB8MDEwMTIxMjF8LXZ5bzAgaVh0MCBhbGowIDFEN3YwIFZCMCAzV24wIEtOMHw3MFwiLFxuXHRcdFwiQW50YXJjdGljYS9EdW1vbnREVXJ2aWxsZXx6enogUE1UIEREVVR8MCAtYTAgLWEwfDAxMDJ8LVUwbzAgY2ZxMCBiRm0wfDgwXCIsXG5cdFx0XCJBbnRhcmN0aWNhL01hY3F1YXJpZXxBRVNUIEFFRFQgenp6IE1JU1R8LWEwIC1iMCAwIC1iMHwwMTAyMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEzfC0yOUU4MCAxOVgwIDRTTDAgMWF5eTAgTHZzMCAxY00wIDFvMDAgUmMwIDF3bzAgUmMwIDF3bzAgVTAwIDF3bzAgTEEwIDFDMDAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgUmMwIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgMTFBMCAxcU0wIFdNMCAxcU0wIE9vMCAxemMwIE9vMCAxemMwIE9vMCAxd28wIFdNMCAxdEEwIFdNMCAxdEEwIFUwMCAxdEEwIFUwMCAxdEEwIDExQTAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWNNMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMTFBMCAxbzAwIDFpbzAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFjTTAgMWNNMCAxYTAwIDFpbzAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wfDFcIixcblx0XHRcIkFudGFyY3RpY2EvTWF3c29ufHp6eiBNQVdUIE1BV1R8MCAtNjAgLTUwfDAxMnwtQ0VvMCAyZnlrMHw2MFwiLFxuXHRcdFwiUGFjaWZpYy9BdWNrbGFuZHxOWk1UIE5aU1QgTlpTVCBOWkRUfC1idSAtY3UgLWMwIC1kMHwwMTAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyM3wtMUdDVnUgTHowIDF0QjAgMTF6dSAxbzB1IDExenUgMW8wdSAxMXp1IDFvMHUgMTRudSAxbGN1IDE0bnUgMWxjdSAxbGJ1IDExQXUgMW5YdSAxMUF1IDFuWHUgMTFBdSAxblh1IDExQXUgMW5YdSAxMUF1IDFxTHUgV011IDFxTHUgMTFBdSAxbjFidSBJTTAgMUMwMCBSYzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBSYzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBSYzAgMXpjMCBPbzAgMXFNMCAxNG8wIDFsYzAgMTRvMCAxbGMwIDE0bzAgMWxjMCAxN2MwIDFpbzAgMTdjMCAxaW8wIDE3YzAgMWlvMCAxN2MwIDFsYzAgMTRvMCAxbGMwIDE0bzAgMWxjMCAxN2MwIDFpbzAgMTdjMCAxaW8wIDE3YzAgMWxjMCAxNG8wIDFsYzAgMTRvMCAxbGMwIDE3YzAgMWlvMCAxN2MwIDFpbzAgMTdjMCAxaW8wIDE3YzAgMWlvMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxY00wIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxY00wIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWlvMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFjTTAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFjTTAgMWZBMCAxYTAwIDFmQTAgMWEwMHwxNGU1XCIsXG5cdFx0XCJBbnRhcmN0aWNhL1BhbG1lcnx6enogQVJTVCBBUlQgQVJUIEFSU1QgQ0xUIENMU1R8MCAzMCA0MCAzMCAyMCA0MCAzMHwwMTIxMjEyMTIxMjM0MzU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2fC1jYW8wIG5EMCAxdmQwIFNMMCAxdmQwIDE3ejAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIGFzbjAgRGIwIGpzTjAgMTROMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxcU4wIFdMMCAxcU4wIDFjTDAgMWNOMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxZkIwIDE5WDAgMXFOMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAgV0wwIDFxTjAgMTdiMCAxaXAwIDExejAgMWlwMCAxZnowIDFmQjAgMTF6MCAxcU4wIFdMMCAxcU4wIFdMMCAxcU4wIFdMMCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxcU4wIDE3YjAgMWlwMCAxMXowIDFvMTAgMTlYMCAxZkIwIDFuWDAgRzEwIDFFTDAgT3AwIDF6YjAgUmQwIDF3bjAgUmQwIDQ2bjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgRGQwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgRGQwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgRGQwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwfDQwXCIsXG5cdFx0XCJBbnRhcmN0aWNhL1JvdGhlcmF8enp6IFJPVFR8MCAzMHwwMXxnT28wfDEzMFwiLFxuXHRcdFwiQW50YXJjdGljYS9TeW93YXx6enogU1lPVHwwIC0zMHwwMXwtdnMwMHwyMFwiLFxuXHRcdFwiQW50YXJjdGljYS9Ucm9sbHx6enogVVRDIENFU1R8MCAwIC0yMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMXwxcHVvMCBoZDAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDB8NDBcIixcblx0XHRcIkFudGFyY3RpY2EvVm9zdG9rfHp6eiBWT1NUfDAgLTYwfDAxfC10akEwfDI1XCIsXG5cdFx0XCJFdXJvcGUvT3Nsb3xDRVQgQ0VTVHwtMTAgLTIwfDAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMHwtMmF3TTAgUW0wIFc2bzAgNXBmMCBXTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIHdKYzAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFxTTAgV00wIHpwYzAgMWEwMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDYyZTRcIixcblx0XHRcIkFzaWEvUml5YWRofExNVCBBU1R8LTM2LlEgLTMwfDAxfC1UdkQ2LlF8NTdlNVwiLFxuXHRcdFwiQXNpYS9BbG1hdHl8TE1UICswNSArMDYgKzA3fC01Ny5NIC01MCAtNjAgLTcwfDAxMjMyMzIzMjMyMzIzMjMyMzIzMjMyMTIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMnwtMVBjNTcuTSBlVW83Lk0gMjNDTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAycEIwIElNMCByWDAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTB8MTVlNVwiLFxuXHRcdFwiQXNpYS9BbW1hbnxMTVQgRUVUIEVFU1R8LTJuLkkgLTIwIC0zMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0xeVcybi5JIDFIaU1uLkkgS0wwIDFvTjAgMTFiMCAxb04wIDExYjAgMXBkMCAxZHowIDFjcDAgMTFiMCAxb3AwIDExYjAgZk8xMCAxZGIwIDFlMTAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFwZDAgMTBuMCAxbGQwIDE0bjAgMWhCMCAxNWIwIDFpcDAgMTlYMCAxY04wIDFjTDAgMWNOMCAxN2IwIDFsZDAgMTRvMCAxbGMwIDE3YzAgMWlvMCAxN2MwIDFpbzAgMTdjMCAxU28wIHkwMCAxZmMwIDFkYzAgMWNvMCAxZGMwIDFjTTAgMWNNMCAxY00wIDFvMDAgMTFBMCAxbGMwIDE3YzAgMWNNMCAxY00wIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCA0YlgwIERkMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTB8MjVlNVwiLFxuXHRcdFwiQXNpYS9BbmFkeXJ8TE1UIEFOQVQgQU5BVCBBTkFTVCBBTkFTVCBBTkFTVCBBTkFUfC1iTi5VIC1jMCAtZDAgLWUwIC1kMCAtYzAgLWIwfDAxMjMyNDE0MTQxNDE0MTQxNDE0MTQxNTYxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNTYxfC0xUGNiTi5VIGVVbk4uVSAyM0NMMCAxZGIwIDFjTjAgMWRjMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNOMCBJTTAgclgwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU4wIFdNMHwxM2UzXCIsXG5cdFx0XCJBc2lhL0FxdGF1fExNVCArMDQgKzA1ICswNnwtM2wuNCAtNDAgLTUwIC02MHwwMTIzMjMyMzIzMjMyMzIzMjMyMzIxMjMyMzIzMTIxMjEyMTIxMjEyMTIxMjEyMTJ8LTFQYzNsLjQgZVVubC40IDI0UFgwIDJwWDAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAycEIwIElNMCByWDAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTjAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwfDE1ZTRcIixcblx0XHRcIkFzaWEvQXF0b2JlfExNVCArMDQgKzA1ICswNnwtM00uRSAtNDAgLTUwIC02MHwwMTIzMjMyMzIzMjMyMzIzMjMyMzIxMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyfC0xUGMzTS5FIGVVbk0uRSAyM0NMMCAzRGIwIDFjTjAgMWRiMCAxZGQwIDFjTzAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMnBCMCBJTTAgclgwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wfDI3ZTRcIixcblx0XHRcIkFzaWEvQXNoZ2FiYXR8TE1UIEFTSFQgQVNIVCBBU0hTVCBBU0hTVCBUTVQgVE1UfC0zUi53IC00MCAtNTAgLTYwIC01MCAtNDAgLTUwfDAxMjMyMzIzMjMyMzIzMjMyMzIzMjMyNDE1NnwtMVBjM1IudyBlVW5SLncgMjNDTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTjAgYmEwIHhDMHw0MWU0XCIsXG5cdFx0XCJBc2lhL0JhZ2hkYWR8Qk1UIEFTVCBBRFR8LTJWLkEgLTMwIC00MHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTI2QmVWLkEgMkFDblYuQSAxMWIwIDFjcDAgMWR6MCAxZGQwIDFkYjAgMWNOMCAxY3AwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWRlMCAxZGMwIDFkYzAgMWRjMCAxY00wIDFkYzAgMWNNMCAxZGMwIDFjTTAgMWRjMCAxZGMwIDFkYzAgMWNNMCAxZGMwIDFjTTAgMWRjMCAxY00wIDFkYzAgMWRjMCAxZGMwIDFjTTAgMWRjMCAxY00wIDFkYzAgMWNNMCAxZGMwIDFkYzAgMWRjMCAxY00wIDFkYzAgMWNNMCAxZGMwIDFjTTAgMWRjMHw2NmU1XCIsXG5cdFx0XCJBc2lhL1FhdGFyfExNVCBHU1QgQVNUfC0zcS44IC00MCAtMzB8MDEyfC0yMUpmcS44IDI3QlhxLjh8OTZlNFwiLFxuXHRcdFwiQXNpYS9CYWt1fExNVCBCQUtUIEJBS1QgQkFLU1QgQkFLU1QgQVpTVCBBWlQgQVpUIEFaU1R8LTNqLm8gLTMwIC00MCAtNTAgLTQwIC00MCAtMzAgLTQwIC01MHwwMTIzMjMyMzIzMjMyMzIzMjMyMzIzMjQ1NjU3ODc4Nzg3ODc4Nzg3ODc4Nzg3ODc4Nzg3ODc4Nzg3ODc4Nzg3ODc4N3wtMVBjM2oubyAxalVvai5vIFdDTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDEwSzAgYzMwIDFjTTAgMWNJMCA4d3UwIDFvMDAgMTF6MCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDB8MjdlNVwiLFxuXHRcdFwiQXNpYS9CYW5na29rfEJNVCBJQ1R8LTZHLjQgLTcwfDAxfC0yMThTRy40fDE1ZTZcIixcblx0XHRcIkFzaWEvQmFybmF1bHxMTVQgKzA2ICswNyArMDh8LTV6IC02MCAtNzAgLTgwfDAxMjMyMzIzMjMyMzIzMjMyMzIzMjMyMTIzMjMyMzIzMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTJ8LTIxUzV6IHBDbnogMjNDTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAycEIwIElNMCByWDAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgcDkwIExFMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDhIejAgM3JkMFwiLFxuXHRcdFwiQXNpYS9CZWlydXR8RUVUIEVFU1R8LTIwIC0zMHwwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTB8LTIxYXEwIDFvbjAgMTQxMCAxZGIwIDE5QjAgMWluMCAxaXAwIFdMMCAxbFFwMCAxMWIwIDFvTjAgMTFiMCAxb04wIDExYjAgMXBkMCAxMWIwIDFvTjAgMTFiMCBxNk4wIEVuMCAxb04wIDExYjAgMW9OMCAxMWIwIDFvTjAgMTFiMCAxcGQwIDExYjAgMW9OMCAxMWIwIDFvcDAgMTFiMCBkQTEwIDE3YjAgMWlOMCAxN2IwIDFpTjAgMTdiMCAxaU4wIDE3YjAgMXZCMCBTTDAgMW1wMCAxM3owIDFpTjAgMTdiMCAxaU4wIDE3YjAgMWpkMCAxMm4wIDFhMTAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFmQjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMXFMMCBXTjAgMXFMMCBXTjAgMXFMMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMXFMMCBXTjAgMXFMMCBXTjAgMXFMMCBXTjAgMXFMMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMXFMMCBXTjAgMXFMMCBXTjAgMXFMMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFxTDAgV04wIDFxTDAgV04wIDFxTDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFxTDAgV04wIDFxTDAgV04wIDFxTDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxcUwwIFdOMCAxcUwwIFdOMCAxcUwwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxcUwwIFdOMCAxcUwwIFdOMCAxcUwwIFdOMCAxcUwwIDExQjAgMW5YMCAxMUIwIDFuWDB8MjJlNVwiLFxuXHRcdFwiQXNpYS9CaXNoa2VrfExNVCBGUlVUIEZSVVQgRlJVU1QgRlJVU1QgS0dUIEtHU1QgS0dUfC00Vy5vIC01MCAtNjAgLTcwIC02MCAtNTAgLTYwIC02MHwwMTIzMjMyMzIzMjMyMzIzMjMyMzIzMjQ1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2N3wtMVBjNFcubyBlVW5XLm8gMjNDTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDExYzAgMXRYMCAxN2IwIDFpcDAgMTdiMCAxaXAwIDE3YjAgMWlwMCAxN2IwIDFpcDAgMTlYMCAxY1B1IDFuWDAgMTFCMCAxblgwIDExQjAgMXFMMCBXTjAgMXFMMCBXTjAgMXFMMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMXFMMCBXTjAgVDh1fDg3ZTRcIixcblx0XHRcIkFzaWEvQnJ1bmVpfExNVCBCTlQgQk5UfC03RC5FIC03dSAtODB8MDEyfC0xS0lURC5FIGdEYzkuRXw0MmU0XCIsXG5cdFx0XCJBc2lhL0tvbGthdGF8SE1UIEJVUlQgSVNUIElTVHwtNVIuayAtNnUgLTV1IC02dXwwMTIzMnwtMThMRlIuayAxdW5uLmsgSEIwIDd6WDB8MTVlNlwiLFxuXHRcdFwiQXNpYS9DaGl0YXxMTVQgWUFLVCBZQUtUIFlBS1NUIFlBS1NUIFlBS1QgSVJLVHwtN3guUSAtODAgLTkwIC1hMCAtOTAgLWEwIC04MHwwMTIzMjMyMzIzMjMyMzIzMjMyMzIzMjQxMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyNTYyfC0yMVE3eC5RIHBBbnguUSAyM0NMMCAxZGIwIDFjTjAgMWRiMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNOMCBJTTAgclgwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCA4SHowIDNyZTB8MzNlNFwiLFxuXHRcdFwiQXNpYS9DaG9pYmFsc2FufExNVCBVTEFUIFVMQVQgQ0hPU1QgQ0hPVCBDSE9UIENIT1NUfC03QyAtNzAgLTgwIC1hMCAtOTAgLTgwIC05MHwwMTIzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1fC0yQVBIQyAyVWtvQyBjS24wIDFkYTAgMWRkMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWZCMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgNmhEMCAxMXowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgM0RiMCBoMWYwIDFjSjAgMWNQMCAxY0owIDFjUDAgMWZ4MCAxY1AwIDFjSjAgMWNQMCAxY0owIDFjUDAgMWNKMCAxY1AwIDFjSjAgMWNQMCAxY0owIDFjUDAgMWZ4MCAxY1AwIDFjSjAgMWNQMCAxY0owIDFjUDAgMWNKMCAxY1AwIDFjSjAgMWNQMCAxZngwIDFjUDAgMWNKMCAxY1AwIDFjSjAgMWNQMCAxY0owIDFjUDAgMWNKMCAxY1AwIDFjSjAgMWNQMCAxZngwIDFjUDAgMWNKMCAxY1AwIDFjSjAgMWNQMCAxY0owfDM4ZTNcIixcblx0XHRcIkFzaWEvU2hhbmdoYWl8Q1NUIENEVHwtODAgLTkwfDAxMDEwMTAxMDEwMTAxMDEwfC0xYzFJMCBMWDAgMTZwMCAxanowIDFNeXAwIFJiMCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowfDIzZTZcIixcblx0XHRcIkFzaWEvQ29sb21ib3xNTVQgSVNUIElIU1QgSVNUIExLVCBMS1R8LTVqLncgLTV1IC02MCAtNnUgLTZ1IC02MHwwMTIzMTQ1MXwtMnpPdGoudyAxckZiTi53IDF6enUgN0FwdSAyM2R6MCAxMXp1IG4zY3V8MjJlNVwiLFxuXHRcdFwiQXNpYS9EaGFrYXxITVQgQlVSVCBJU1QgREFDVCBCRFQgQkRTVHwtNVIuayAtNnUgLTV1IC02MCAtNjAgLTcwfDAxMjEzNDU0fC0xOExGUi5rIDF1bm4uayBIQjAgbTZuMCBMcU11IDF4Nm4wIDFpMDB8MTZlNlwiLFxuXHRcdFwiQXNpYS9EYW1hc2N1c3xMTVQgRUVUIEVFU1R8LTJwLmMgLTIwIC0zMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMXwtMjFKZXAuYyBIZXAuYyAxN2IwIDFpcDAgMTdiMCAxaXAwIDE3YjAgMWlwMCAxOVgwIDF4UkIwIDExWDAgMW9OMCAxMEwwIDFwQjAgMTFiMCAxb04wIDEwTDAgMW1wMCAxM1gwIDFvTjAgMTFiMCAxcGQwIDExYjAgMW9OMCAxMWIwIDFvTjAgMTFiMCAxb04wIDExYjAgMXBkMCAxMWIwIDFvTjAgMTFiMCAxb04wIDExYjAgMW9OMCAxMWIwIDFwZDAgMTFiMCAxb04wIE5iMCAxQU4wIE5iMCBiY3AwIDE5WDAgMWdwMCAxOVgwIDNsZDAgMXhYMCBWZDAgMUJ6MCBTcDAgMXZYMCAxMHAwIDFkejAgMWNOMCAxY0wwIDFkYjAgMWRiMCAxZzEwIDFhbjAgMWFwMCAxZGIwIDFmZDAgMWRiMCAxY04wIDFkYjAgMWRkMCAxZGIwIDFjcDAgMWR6MCAxYzEwIDFkWDAgMWNOMCAxZGIwIDFkZDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFjTjAgMWRiMCAxZGQwIDFkYjAgMWNOMCAxZGIwIDFjTjAgMTl6MCAxZkIwIDFxTDAgMTFCMCAxb24wIFdwMCAxcUwwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFxTDAgV04wIDFxTDAgV04wIDFxTDAgMTFCMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxcUwwIFdOMCAxcUwwIFdOMCAxcUwwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxcUwwIFdOMCAxcUwwIFdOMCAxcUwwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMXFMMCBXTjAgMXFMMCBXTjAgMXFMMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMXFMMCBXTjAgMXFMMHwyNmU1XCIsXG5cdFx0XCJBc2lhL0RpbGl8TE1UIFRMVCBKU1QgVExUIFdJVEF8LThtLmsgLTgwIC05MCAtOTAgLTgwfDAxMjM0M3wtMmxlOG0uayAxZG5YbS5rIDhIQTAgMWV3MDAgWGxkMHwxOWU0XCIsXG5cdFx0XCJBc2lhL0R1YmFpfExNVCBHU1R8LTNGLmMgLTQwfDAxfC0yMUpmRi5jfDM5ZTVcIixcblx0XHRcIkFzaWEvRHVzaGFuYmV8TE1UIERVU1QgRFVTVCBEVVNTVCBEVVNTVCBUSlR8LTR6LmMgLTUwIC02MCAtNzAgLTYwIC01MHwwMTIzMjMyMzIzMjMyMzIzMjMyMzIzMjQ1fC0xUGM0ei5jIGVVbnouYyAyM0NMMCAxZGIwIDFjTjAgMWRiMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMTROMHw3NmU0XCIsXG5cdFx0XCJBc2lhL0dhemF8RUVUIEVFVCBFRVNUIElTVCBJRFR8LTIwIC0zMCAtMzAgLTIwIC0zMHwwMTAxMDEwMTAxMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjB8LTFjMnEwIDVSYjAgMTByMCAxcHgwIDEwTjAgMXB6MCAxNnAwIDFqQjAgMTZwMCAxangwIHBCZDAgVnowIDFvTjAgMTFiMCAxb08wIDEwTjAgMXB6MCAxME4wIDFwYjAgMTBOMCAxcGIwIDEwTjAgMXBiMCAxME4wIDFwejAgMTBOMCAxcGIwIDEwTjAgMXBiMCAxMWQwIDFvTDAgZFcwIGhmQjAgRGIwIDFmQjAgUmIwIG5wQjAgMTF6MCAxQzEwIElMMCAxczEwIDEwbjAgMW8xMCBXTDAgMXpkMCBPbjAgMWxkMCAxMXowIDFvMTAgMTRuMCAxbzEwIDE0bjAgMW5kMCAxMm4wIDFuZDAgWHowIDFxMTAgMTJuMCBNMTAgQzAwIDE3YzAgMWlvMCAxN2MwIDFpbzAgMTdjMCAxbzAwIDFjTDAgMWZCMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMTdjMCAxaW8wIDE4TjAgMWJ6MCAxOXowIDFncDAgMTYxMCAxaUwwIDExejAgMW8xMCAxNG8wIDFsQTEgU0tYIDF4ZDEgTUtYIDFBTjAgMWEwMCAxZkEwIDFjTDAgMWNOMCAxblgwIDEyMTAgMW56MCAxMjIwIDFueTAgMTIyMCAxcW0wIDEyMjAgMW55MCAxMjIwIDFueTAgMTIyMCAxbnkwIDEyMjAgMW55MCAxMjIwIDFueTAgMTIyMCAxcW0wIDEyMjAgMW55MCAxMjIwIDFueTAgMTIyMCAxbnkwIDEyMjAgMW55MCAxMjIwIDFxbTAgMTIyMCAxbnkwIDEyMjAgMW55MCAxMjIwIDFueTAgMTIyMCAxbnkwIDEyMjAgMW55MCAxMjIwIDFxbTAgMTIyMCAxbnkwIDEyMjAgMW55MCAxMjIwIDFueTB8MThlNVwiLFxuXHRcdFwiQXNpYS9IZWJyb258RUVUIEVFVCBFRVNUIElTVCBJRFR8LTIwIC0zMCAtMzAgLTIwIC0zMHwwMTAxMDEwMTAxMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMDIwMjAyMHwtMWMycTAgNVJiMCAxMHIwIDFweDAgMTBOMCAxcHowIDE2cDAgMWpCMCAxNnAwIDFqeDAgcEJkMCBWejAgMW9OMCAxMWIwIDFvTzAgMTBOMCAxcHowIDEwTjAgMXBiMCAxME4wIDFwYjAgMTBOMCAxcGIwIDEwTjAgMXB6MCAxME4wIDFwYjAgMTBOMCAxcGIwIDExZDAgMW9MMCBkVzAgaGZCMCBEYjAgMWZCMCBSYjAgbnBCMCAxMXowIDFDMTAgSUwwIDFzMTAgMTBuMCAxbzEwIFdMMCAxemQwIE9uMCAxbGQwIDExejAgMW8xMCAxNG4wIDFvMTAgMTRuMCAxbmQwIDEybjAgMW5kMCBYejAgMXExMCAxMm4wIE0xMCBDMDAgMTdjMCAxaW8wIDE3YzAgMWlvMCAxN2MwIDFvMDAgMWNMMCAxZkIwIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxN2MwIDFpbzAgMThOMCAxYnowIDE5ejAgMWdwMCAxNjEwIDFpTDAgMTJMMCAxbU4wIDE0bzAgMWxjMCBUYjAgMXhkMSBNS1ggYkIwIGNuMCAxY04wIDFhMDAgMWZBMCAxY0wwIDFjTjAgMW5YMCAxMjEwIDFuejAgMTIyMCAxbnkwIDEyMjAgMXFtMCAxMjIwIDFueTAgMTIyMCAxbnkwIDEyMjAgMW55MCAxMjIwIDFueTAgMTIyMCAxbnkwIDEyMjAgMXFtMCAxMjIwIDFueTAgMTIyMCAxbnkwIDEyMjAgMW55MCAxMjIwIDFueTAgMTIyMCAxcW0wIDEyMjAgMW55MCAxMjIwIDFueTAgMTIyMCAxbnkwIDEyMjAgMW55MCAxMjIwIDFueTAgMTIyMCAxcW0wIDEyMjAgMW55MCAxMjIwIDFueTAgMTIyMCAxbnkwfDI1ZTRcIixcblx0XHRcIkFzaWEvSG9fQ2hpX01pbmh8TE1UIFBMTVQgSUNUIElEVCBKU1R8LTc2LkUgLTc2LnUgLTcwIC04MCAtOTB8MDEyMzQyMzIzMnwtMnlDNzYuRSBiSzAwLmEgMWg3YjYudSA1bHowIDE4bzAgM09xMCBrNWIwIGFXMDAgQkFNMHw5MGU1XCIsXG5cdFx0XCJBc2lhL0hvbmdfS29uZ3xMTVQgSEtUIEhLU1QgSlNUfC03QS5HIC04MCAtOTAgLTkwfDAxMjEzMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTJDRkhBLkcgMXNFUDYuRyAxY0wwIHlsdSA5M1gwIDFxUXUgMXRYMCBSZDAgMUluMCBOQjAgMWNMMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFrTDAgMTROMCAxblgwIFUxMCAxdHowIFUxMCAxd24wIFJkMCAxd24wIFUxMCAxdHowIFUxMCAxdHowIFUxMCAxdHowIFUxMCAxd24wIFJkMCAxd24wIFJkMCAxd24wIFUxMCAxdHowIFUxMCAxdHowIDE3ZDAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIHMxMCAxVnowIDFjTjAgMWNMMCAxY04wIDFjTDAgNmZkMCAxNG4wfDczZTVcIixcblx0XHRcIkFzaWEvSG92ZHxMTVQgSE9WVCBIT1ZUIEhPVlNUfC02Ni5BIC02MCAtNzAgLTgwfDAxMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMnwtMkFQRzYuQSAyVWtvNi5BIGNLbjAgMWRiMCAxZGQwIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxZkIwIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCA2aEQwIDExejAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCBrRXAwIDFjSjAgMWNQMCAxY0owIDFjUDAgMWZ4MCAxY1AwIDFjSjAgMWNQMCAxY0owIDFjUDAgMWNKMCAxY1AwIDFjSjAgMWNQMCAxY0owIDFjUDAgMWZ4MCAxY1AwIDFjSjAgMWNQMCAxY0owIDFjUDAgMWNKMCAxY1AwIDFjSjAgMWNQMCAxZngwIDFjUDAgMWNKMCAxY1AwIDFjSjAgMWNQMCAxY0owIDFjUDAgMWNKMCAxY1AwIDFjSjAgMWNQMCAxZngwIDFjUDAgMWNKMCAxY1AwIDFjSjAgMWNQMCAxY0owfDgxZTNcIixcblx0XHRcIkFzaWEvSXJrdXRza3xJTVQgSVJLVCBJUktUIElSS1NUIElSS1NUIElSS1R8LTZWLjUgLTcwIC04MCAtOTAgLTgwIC05MHwwMTIzMjMyMzIzMjMyMzIzMjMyMzIzMjQxMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyNTJ8LTIxekdWLjUgcGpYVi41IDIzQ0wwIDFkYjAgMWNOMCAxZGIwIDFjTjAgMWRiMCAxZGQwIDFjTzAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY04wIElNMCByWDAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDhIejB8NjBlNFwiLFxuXHRcdFwiRXVyb3BlL0lzdGFuYnVsfElNVCBFRVQgRUVTVCBUUlNUIFRSVHwtMVUuVSAtMjAgLTMwIC00MCAtMzB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjM0MzQzNDM0MzQyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0yb2dOVS5VIGR6elUuVSAxMWIwIDh0QjAgMW9uMCAxNDEwIDFkYjAgMTlCMCAxaW4wIDNSZDAgVW4wIDFvTjAgMTFiMCB6U3AwIENMMCBtTjAgMVZ6MCAxZ04wIDFwejAgNVJkMCAxZnowIDF5cDAgTUwwIDFrcDAgMTdiMCAxaXAwIDE3YjAgMWZCMCAxOVgwIDFqQjAgMThMMCAxaXAwIDE3ejAgcWRkMCB4WDAgM1MxMCBUejAgZEExMCAxMXowIDFvMTAgMTF6MCAxcU4wIDExejAgMXplMCAxMUIwIFdNMCAxcU8wIFdJMCAxblgwIDFyQjAgMTBMMCAxMUIwIDFpbjAgMTdkMCAxaW4wIDJwWDAgMTlFMCAxZlUwIDE2UTAgMWlJMCAxNlEwIDFpSTAgMVZkMCBwYjAgM0twMCAxNG8wIDFkZjAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNMMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV08wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgWGMwIDFxbzAgV00wIDFxTTAgMTFBMCAxbzAwIDEyMDAgMW5BMCAxMUEwIDF0QTAgVTAwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDB8MTNlNlwiLFxuXHRcdFwiQXNpYS9KYWthcnRhfEJNVCBKQVZUIFdJQiBKU1QgV0lCIFdJQnwtNzcuYyAtN2sgLTd1IC05MCAtODAgLTcwfDAxMjMyNDI1fC0xUTBUayBsdU0wIG1Qek8gOHZXdSA2a3B1IDRQWHUgeGhjdXwzMWU2XCIsXG5cdFx0XCJBc2lhL0pheWFwdXJhfExNVCBXSVQgQUNTVHwtOW0uTSAtOTAgLTl1fDAxMjF8LTF1dTltLk0gc01NbS5NIEw0bnV8MjZlNFwiLFxuXHRcdFwiQXNpYS9KZXJ1c2FsZW18Sk1UIElTVCBJRFQgSUREVHwtMmsuRSAtMjAgLTMwIC00MHwwMTIxMjEyMTIxMjEzMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMXwtMjZCZWsuRSBTeU1rLkUgNVJiMCAxMHIwIDFweDAgMTBOMCAxcHowIDE2cDAgMWpCMCAxNnAwIDFqeDAgM0xCMCBFbTAgb3IwIDFjbjAgMWRCMCAxNm4wIDEwTzAgMWphMCAxdEMwIDE0bzAgMWNNMCAxYTAwIDExQTAgMU5hMCBBbjAgMU1QMCBBSjAgMUtwMCBMQzAgMW9vMCBXbDAgRVFOMCBEYjAgMWZCMCBSYjAgbnBCMCAxMXowIDFDMTAgSUwwIDFzMTAgMTBuMCAxbzEwIFdMMCAxemQwIE9uMCAxbGQwIDExejAgMW8xMCAxNG4wIDFvMTAgMTRuMCAxbmQwIDEybjAgMW5kMCBYejAgMXExMCAxMm4wIDFoQjAgMWRYMCAxZXAwIDFhTDAgMWVOMCAxN1gwIDFuZjAgMTF6MCAxdEIwIDE5VzAgMWUxMCAxN2IwIDFlcDAgMWdMMCAxOE4wIDFmejAgMWVOMCAxN2IwIDFncTAgMWduMCAxOWQwIDFkejAgMWMxMCAxN1gwIDFoQjAgMWduMCAxOWQwIDFkejAgMWMxMCAxN1gwIDFrcDAgMWR6MCAxYzEwIDFhTDAgMWVOMCAxb0wwIDEwTjAgMW9MMCAxME4wIDFvTDAgMTBOMCAxcnowIFcxMCAxcnowIFcxMCAxcnowIDEwTjAgMW9MMCAxME4wIDFvTDAgMTBOMCAxcnowIFcxMCAxcnowIFcxMCAxcnowIDEwTjAgMW9MMCAxME4wIDFvTDAgMTBOMCAxb0wwIDEwTjAgMXJ6MCBXMTAgMXJ6MCBXMTAgMXJ6MCAxME4wIDFvTDAgMTBOMCAxb0wwIDEwTjAgMXJ6MCBXMTAgMXJ6MCBXMTAgMXJ6MCBXMTAgMXJ6MCAxME4wIDFvTDAgMTBOMCAxb0wwfDgxZTRcIixcblx0XHRcIkFzaWEvS2FidWx8QUZUIEFGVHwtNDAgLTR1fDAxfC0xMFFzMHw0NmU1XCIsXG5cdFx0XCJBc2lhL0thbWNoYXRrYXxMTVQgUEVUVCBQRVRUIFBFVFNUIFBFVFNUfC1heS5BIC1iMCAtYzAgLWQwIC1jMHwwMTIzMjMyMzIzMjMyMzIzMjMyMzIzMjQxMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjQxMnwtMVNMS3kuQSBpdlh5LkEgMjNDTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTjAgSU0wIHJYMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFOMCBXTTB8MThlNFwiLFxuXHRcdFwiQXNpYS9LYXJhY2hpfExNVCBJU1QgSVNUIEtBUlQgUEtUIFBLU1R8LTRzLmMgLTV1IC02dSAtNTAgLTUwIC02MHwwMTIxMzQ1NDU0NTR8LTJ4b3NzLmMgMXFPS1cuYyA3elgwIGV1cDAgTHFNdSAxZnkwMCAxY0wwIGRLMTAgMTFiMCAxNjEwIDFqWDB8MjRlNlwiLFxuXHRcdFwiQXNpYS9VcnVtcWl8TE1UIFhKVHwtNU8uayAtNjB8MDF8LTFHZ3RPLmt8MzJlNVwiLFxuXHRcdFwiQXNpYS9LYXRobWFuZHV8TE1UIElTVCBOUFR8LTVGLmcgLTV1IC01SnwwMTJ8LTIxSmhGLmcgMkVHTWIuZ3wxMmU1XCIsXG5cdFx0XCJBc2lhL0toYW5keWdhfExNVCBZQUtUIFlBS1QgWUFLU1QgWUFLU1QgVkxBVCBWTEFTVCBWTEFUIFlBS1R8LTkyLmQgLTgwIC05MCAtYTAgLTkwIC1hMCAtYjAgLWIwIC1hMHwwMTIzMjMyMzIzMjMyMzIzMjMyMzIzMjQxMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjU2NTY1NjU2NTY1NjU2NTc4MnwtMjFROTIuZCBwQXAyLmQgMjNDTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTjAgSU0wIHJYMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIHFLMCB5TjAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMTdWMCA3ekQwfDY2ZTJcIixcblx0XHRcIkFzaWEvS3Jhc25veWFyc2t8TE1UIEtSQVQgS1JBVCBLUkFTVCBLUkFTVCBLUkFUfC02Yi5xIC02MCAtNzAgLTgwIC03MCAtODB8MDEyMzIzMjMyMzIzMjMyMzIzMjMyMzI0MTIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjUyfC0yMUhpYi5xIHByQWIucSAyM0NMMCAxZGIwIDFjTjAgMWRiMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNOMCBJTTAgclgwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCA4SHowfDEwZTVcIixcblx0XHRcIkFzaWEvS3VhbGFfTHVtcHVyfFNNVCBNQUxUIE1BTFNUIE1BTFQgTUFMVCBKU1QgTVlUfC02VC5wIC03MCAtN2sgLTdrIC03dSAtOTAgLTgwfDAxMjM0NTQ2fC0yQmc2VC5wIDE3YW5ULnAgN2hYRSBkTTAwIDE3Yk8gOEZ5dSAxc28xdXw3MWU1XCIsXG5cdFx0XCJBc2lhL0t1Y2hpbmd8TE1UIEJPUlQgQk9SVCBCT1JUU1QgSlNUIE1ZVHwtN2wuayAtN3UgLTgwIC04ayAtOTAgLTgwfDAxMjMyMzIzMjMyMzIzMjMyNDI1fC0xS0lUbC5rIGdEYlAuayA2eW51IEFuRSAxTzBrIEFuRSAxTkFrIEFuRSAxTkFrIEFuRSAxTkFrIEFuRSAxTzBrIEFuRSAxTkFrIEFuRSBwQWsgOEZ6MCAxc28xMHwxM2U0XCIsXG5cdFx0XCJBc2lhL01hY2F1fExNVCBNT1QgTU9TVCBDU1R8LTd5LmsgLTgwIC05MCAtODB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxM3wtMmxlN3kuayAxWE8zNC5rIDF3bjAgUmQwIDF3bjAgUjl1IDF3cXUgVTEwIDF0ejAgVFZ1IDF0ejAgMTdndSAxY0wwIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNKdSAxY0wwIDFjTjAgMWZ6MCAxY04wIDFjT3UgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNKdSAxY0wwIDFjTjAgMWZ6MCAxY04wIDFjTDAgS0VwMHw1N2U0XCIsXG5cdFx0XCJBc2lhL01hZ2FkYW58TE1UIE1BR1QgTUFHVCBNQUdTVCBNQUdTVCBNQUdUfC1hMy5jIC1hMCAtYjAgLWMwIC1iMCAtYzB8MDEyMzIzMjMyMzIzMjMyMzIzMjMyMzI0MTIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjUxMnwtMVBjYTMuYyBlVW8zLmMgMjNDTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTjAgSU0wIHJYMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgOEh6MCAzQ3EwfDk1ZTNcIixcblx0XHRcIkFzaWEvTWFrYXNzYXJ8TE1UIE1NVCBXSVRBIEpTVHwtN1YuQSAtN1YuQSAtODAgLTkwfDAxMjMyfC0yMUpqVi5BIHZmYzAgbXlMVi5BIDhNTDB8MTVlNVwiLFxuXHRcdFwiQXNpYS9NYW5pbGF8UEhUIFBIU1QgSlNUfC04MCAtOTAgLTkwfDAxMDIwMTAxMHwtMWtKSTAgQUwwIGNLMTAgNjVYMCBtWEIwIHZYMCBWSzEwIDFkYjB8MjRlNlwiLFxuXHRcdFwiQXNpYS9OaWNvc2lhfExNVCBFRVQgRUVTVHwtMmQucyAtMjAgLTMwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0xVmMyZC5zIDJhM2NkLnMgMWNMMCAxcXAwIFh6MCAxOUIwIDE5WDAgMWZCMCAxZGIwIDFjcDAgMWNMMCAxZkIwIDE5WDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWZCMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFvMzAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMHwzMmU0XCIsXG5cdFx0XCJBc2lhL05vdm9rdXpuZXRza3xMTVQgS1JBVCBLUkFUIEtSQVNUIEtSQVNUIE5PVlNUIE5PVlQgTk9WVHwtNU0uTSAtNjAgLTcwIC04MCAtNzAgLTcwIC02MCAtNzB8MDEyMzIzMjMyMzIzMjMyMzIzMjMyMzI0MTIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzI1NjcyfC0xUGN0TS5NIGVVTE0uTSAyM0NMMCAxZGIwIDFjTjAgMWRiMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNOMCBJTTAgclgwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU4wIFdNMCA4SHowfDU1ZTRcIixcblx0XHRcIkFzaWEvTm92b3NpYmlyc2t8TE1UIE5PVlQgTk9WVCBOT1ZTVCBOT1ZTVHwtNXYuRSAtNjAgLTcwIC04MCAtNzB8MDEyMzIzMjMyMzIzMjMyMzIzMjMyMzI0MTIzMjM0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDE0MTQxNDEyMXwtMjFRbnYuRSBwQUZ2LkUgMjNDTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTjAgSU0wIHJYMCAxY00wIDFjTTAgbWwwIE9zMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgOEh6MHwxNWU1XCIsXG5cdFx0XCJBc2lhL09tc2t8TE1UIE9NU1QgT01TVCBPTVNTVCBPTVNTVCBPTVNUfC00Ui51IC01MCAtNjAgLTcwIC02MCAtNzB8MDEyMzIzMjMyMzIzMjMyMzIzMjMyMzI0MTIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjUyfC0yMjRzUi51IHBNTFIudSAyM0NMMCAxZGIwIDFjTjAgMWRiMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNOMCBJTTAgclgwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCA4SHowfDEyZTVcIixcblx0XHRcIkFzaWEvT3JhbHxMTVQgKzA0ICswNSArMDZ8LTNwLm8gLTQwIC01MCAtNjB8MDEyMzIzMjMyMzIzMjMyMzIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTJ8LTFQYzNwLm8gZVVucC5vIDIzQ0wwIDNEYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMnBCMCAxY00wIDFmQTAgMWNNMCAxY00wIElNMCAxRU0wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTB8MjdlNFwiLFxuXHRcdFwiQXNpYS9Qb250aWFuYWt8TE1UIFBNVCBXSUIgSlNUIFdJQiBXSVRBIFdJQnwtN2guayAtN2guayAtN3UgLTkwIC04MCAtODAgLTcwfDAxMjMyNDI1NnwtMnVhN2guayBYRTAwIG11bkwuayA4UmF1IDZrcHUgNFBYdSB4aGN1IFdxbnV8MjNlNFwiLFxuXHRcdFwiQXNpYS9QeW9uZ3lhbmd8TE1UIEtTVCBKQ1NUIEpTVCBLU1R8LThuIC04dSAtOTAgLTkwIC05MHwwMTIzNDF8LTJ1bThuIDk3WFIgMTJGWHUgamRBMCAyT25jMHwyOWU1XCIsXG5cdFx0XCJBc2lhL1F5enlsb3JkYXxMTVQgKzA0ICswNSArMDZ8LTRsLlEgLTQwIC01MCAtNjB8MDEyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyM3wtMVBjNGwuUSBlVW9sLlEgMjNDTDAgM0RiMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDNhbzAgMUVNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwfDczZTRcIixcblx0XHRcIkFzaWEvUmFuZ29vbnxSTVQgQlVSVCBKU1QgTU1UfC02by5FIC02dSAtOTAgLTZ1fDAxMjN8LTIxSmlvLkUgU21uUy5FIDdqOXV8NDhlNVwiLFxuXHRcdFwiQXNpYS9TYWtoYWxpbnxMTVQgSkNTVCBKU1QgU0FLVCBTQUtTVCBTQUtTVCBTQUtUfC05dS5NIC05MCAtOTAgLWIwIC1jMCAtYjAgLWEwfDAxMjM0MzQzNDM0MzQzNDM0MzQzNDM0MzU2MzQzNDM0MzQzNDM1NjU2NTY1NjU2NTY1NjU2NTY1NjU2NTY1NjU2MzYzfC0yQUdWdS5NIDFpYU11Lk0gamUwMCAxcUZhMCAxZGIwIDFjTjAgMWRiMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNOMCBJTTAgclgwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8xMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCA4SHowIDNyZDB8NThlNFwiLFxuXHRcdFwiQXNpYS9TYW1hcmthbmR8TE1UIFNBTVQgU0FNVCBTQU1TVCBUQVNUIFVaU1QgVVpUfC00ci5SIC00MCAtNTAgLTYwIC02MCAtNjAgLTUwfDAxMjM0MzIzMjMyMzIzMjMyMzIzMjMyMzU2fC0xUGM0ci5SIGVVb3IuUiAyM0NMMCAxZGIwIDFjTTAgMWRjMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMTF4MCBiZjB8MzZlNFwiLFxuXHRcdFwiQXNpYS9TZW91bHxMTVQgS1NUIEpDU1QgSlNUIEtTVCBLRFQgS0RUfC04ci5RIC04dSAtOTAgLTkwIC05MCAtOXUgLWEwfDAxMjM0MTUxNTE1MTUxNTE1MTQ2NDY0fC0ydW04ci5RIDk3WFYuUSAxMkZYdSBqakEwIGtLbzAgMkkwdSBPTDAgMUZCMCBSYjAgMXFOMCBUWDAgMXRCMCBUWDAgMXRCMCBUWDAgMXRCMCBUWDAgMmFwMCAxMkZCdSAxMUEwIDFvMDAgMTFBMHwyM2U2XCIsXG5cdFx0XCJBc2lhL1NpbmdhcG9yZXxTTVQgTUFMVCBNQUxTVCBNQUxUIE1BTFQgSlNUIFNHVCBTR1R8LTZULnAgLTcwIC03ayAtN2sgLTd1IC05MCAtN3UgLTgwfDAxMjM0NTQ2N3wtMkJnNlQucCAxN2FuVC5wIDdoWEUgZE0wMCAxN2JPIDhGeXUgTXNwdSBEVEEwfDU2ZTVcIixcblx0XHRcIkFzaWEvU3JlZG5la29seW1za3xMTVQgTUFHVCBNQUdUIE1BR1NUIE1BR1NUIE1BR1QgU1JFVHwtYWUuUSAtYTAgLWIwIC1jMCAtYjAgLWMwIC1iMHwwMTIzMjMyMzIzMjMyMzIzMjMyMzIzMjQxMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyNTZ8LTFQY2FlLlEgZVVvZS5RIDIzQ0wwIDFkYjAgMWNOMCAxZGIwIDFjTjAgMWRiMCAxZGQwIDFjTzAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY04wIElNMCByWDAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDhIejB8MzVlMlwiLFxuXHRcdFwiQXNpYS9UYWlwZWl8SldTVCBKU1QgQ1NUIENEVHwtODAgLTkwIC04MCAtOTB8MDEyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzJ8LTFpdzgwIGpvTTAgMXlvMCBUejAgMWlwMCAxalgwIDFjTjAgMTFiMCAxb04wIDExYjAgMW9OMCAxMWIwIDFvTjAgMTFiMCAxME4wIDFCWDAgMTBwMCAxcHowIDEwcDAgMXB6MCAxMHAwIDFkYjAgMWRkMCAxZGIwIDFjTjAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFCQjAgTUwwIDFCZDAgTUwwIHVxMTAgMWRiMCAxY04wIDFkYjAgOTdCMCBBTDB8NzRlNVwiLFxuXHRcdFwiQXNpYS9UYXNoa2VudHxMTVQgVEFTVCBUQVNUIFRBU1NUIFRBU1NUIFVaU1QgVVpUfC00Qi5iIC01MCAtNjAgLTcwIC02MCAtNjAgLTUwfDAxMjMyMzIzMjMyMzIzMjMyMzIzMjMyNDU2fC0xUGM0Qi5iIGVVbkIuYiAyM0NMMCAxZGIwIDFjTjAgMWRiMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMTF5MCBiZjB8MjNlNVwiLFxuXHRcdFwiQXNpYS9UYmlsaXNpfFRCTVQgVEJJVCBUQklUIFRCSVNUIFRCSVNUIEdFU1QgR0VUIEdFVCBHRVNUfC0yWC5iIC0zMCAtNDAgLTUwIC00MCAtNDAgLTMwIC00MCAtNTB8MDEyMzIzMjMyMzIzMjMyMzIzMjMyMzI0NTY1NjU2NTc4Nzg3ODc4Nzg3ODc4Nzg3ODU2N3wtMVBjMlguYiAxalVuWC5iIFdDTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDN5MCAxOWYwIDFjSzAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTTAgMWNMMCAxZkIwIDNOejAgMTFCMCAxblgwIDExQjAgMXFMMCBXTjAgMXFMMCBXTjAgMXFMMCAxMUIwIDFuWDAgMTFCMCAxblgwIDExQjAgQW4wIE9zMCBXTTB8MTFlNVwiLFxuXHRcdFwiQXNpYS9UZWhyYW58TE1UIFRNVCBJUlNUIElSU1QgSVJEVCBJUkRUfC0zcC5JIC0zcC5JIC0zdSAtNDAgLTUwIC00dXwwMTIzNDMyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MjUyNTI1MnwtMmJ0RHAuSSAxZDNjMCAxaHVMVC5JIFRYdSAxcHowIHNOMCB2QXUgMWNMMCAxZEIwIDFlbjAgcE5CMCBVTDAgMWNOMCAxZHowIDFjcDAgMWR6MCAxY3AwIDFkejAgMWNwMCAxZHowIDFjcDAgMWR6MCAxY04wIDFkejAgMWNwMCAxZHowIDFjcDAgMWR6MCAxY3AwIDFkejAgMWNOMCAxZHowIDFjcDAgMWR6MCAxY3AwIDFkejAgMWNwMCAxZHowIDFjTjAgMWR6MCA2NHAwIDFkejAgMWNOMCAxZHowIDFjcDAgMWR6MCAxY3AwIDFkejAgMWNwMCAxZHowIDFjTjAgMWR6MCAxY3AwIDFkejAgMWNwMCAxZHowIDFjcDAgMWR6MCAxY04wIDFkejAgMWNwMCAxZHowIDFjcDAgMWR6MCAxY3AwIDFkejAgMWNOMCAxZHowIDFjcDAgMWR6MCAxY3AwIDFkejAgMWNwMCAxZHowIDFjTjAgMWR6MCAxY3AwIDFkejAgMWNwMCAxZHowIDFjcDAgMWR6MCAxY3AwIDFkejAgMWNOMCAxZHowIDFjcDAgMWR6MCAxY3AwIDFkejAgMWNwMCAxZHowIDFjTjAgMWR6MCAxY3AwIDFkejAgMWNwMCAxZHowIDFjcDAgMWR6MHwxNGU2XCIsXG5cdFx0XCJBc2lhL1RoaW1waHV8TE1UIElTVCBCVFR8LTVXLkEgLTV1IC02MHwwMTJ8LVN1NVcuQSAxQkdNcy5BfDc5ZTNcIixcblx0XHRcIkFzaWEvVG9reW98SkNTVCBKU1QgSkRUfC05MCAtOTAgLWEwfDAxMjEyMTIxMjF8LTFpdzkwIHBLcTAgUUwwIDFsQjAgMTNYMCAxekIwIE5YMCAxekIwIE5YMHwzOGU2XCIsXG5cdFx0XCJBc2lhL1RvbXNrfExNVCArMDYgKzA3ICswOHwtNUQuUCAtNjAgLTcwIC04MHwwMTIzMjMyMzIzMjMyMzIzMjMyMzIzMjEyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjEyMTIxMjEyMTIxMjEyMTIxMjEyfC0yMU5oRC5QIHB4ekQuUCAyM0NMMCAxZGIwIDFjTjAgMWRiMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDJwQjAgSU0wIHJYMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIGNvMCAxYkIwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDhIejAgM1FwMHwxMGU1XCIsXG5cdFx0XCJBc2lhL1VsYWFuYmFhdGFyfExNVCBVTEFUIFVMQVQgVUxBU1R8LTc3LncgLTcwIC04MCAtOTB8MDEyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyfC0yQVBINy53IDJVa283LncgY0tuMCAxZGIwIDFkZDAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFmQjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDZoRDAgMTF6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIGtFcDAgMWNKMCAxY1AwIDFjSjAgMWNQMCAxZngwIDFjUDAgMWNKMCAxY1AwIDFjSjAgMWNQMCAxY0owIDFjUDAgMWNKMCAxY1AwIDFjSjAgMWNQMCAxZngwIDFjUDAgMWNKMCAxY1AwIDFjSjAgMWNQMCAxY0owIDFjUDAgMWNKMCAxY1AwIDFmeDAgMWNQMCAxY0owIDFjUDAgMWNKMCAxY1AwIDFjSjAgMWNQMCAxY0owIDFjUDAgMWNKMCAxY1AwIDFmeDAgMWNQMCAxY0owIDFjUDAgMWNKMCAxY1AwIDFjSjB8MTJlNVwiLFxuXHRcdFwiQXNpYS9Vc3QtTmVyYXxMTVQgWUFLVCBZQUtUIE1BR1NUIE1BR1QgTUFHU1QgTUFHVCBNQUdUIFZMQVQgVkxBVHwtOXcuUyAtODAgLTkwIC1jMCAtYjAgLWIwIC1hMCAtYzAgLWIwIC1hMHwwMTIzNDM0MzQzNDM0MzQzNDM0MzQzNDU2NDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0Nzg5fC0yMVE5dy5TIHBBcHcuUyAyM0NMMCAxZDkwIDFjTjAgMWRiMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNOMCBJTTAgclgwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxN1YwIDd6RDB8NjVlMlwiLFxuXHRcdFwiQXNpYS9WbGFkaXZvc3Rva3xMTVQgVkxBVCBWTEFUIFZMQVNUIFZMQVNUIFZMQVR8LThMLnYgLTkwIC1hMCAtYjAgLWEwIC1iMHwwMTIzMjMyMzIzMjMyMzIzMjMyMzIzMjQxMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyNTJ8LTFTSklMLnYgaXRYTC52IDIzQ0wwIDFkYjAgMWNOMCAxZGIwIDFjTjAgMWRiMCAxZGQwIDFjTzAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY04wIElNMCByWDAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDhIejB8NjBlNFwiLFxuXHRcdFwiQXNpYS9ZYWt1dHNrfExNVCBZQUtUIFlBS1QgWUFLU1QgWUFLU1QgWUFLVHwtOEMuVyAtODAgLTkwIC1hMCAtOTAgLWEwfDAxMjMyMzIzMjMyMzIzMjMyMzIzMjMyNDEyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzI1MnwtMjFROEMuVyBwQW9DLlcgMjNDTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTjAgSU0wIHJYMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgOEh6MHwyOGU0XCIsXG5cdFx0XCJBc2lhL1lla2F0ZXJpbmJ1cmd8TE1UIFBNVCBTVkVUIFNWRVQgU1ZFU1QgU1ZFU1QgWUVLVCBZRUtTVCBZRUtUfC00Mi54IC0zSi41IC00MCAtNTAgLTYwIC01MCAtNTAgLTYwIC02MHwwMTIzNDM0MzQzNDM0MzQzNDM0MzQzNDM1MjY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njg2fC0yYWc0Mi54IDdtUWgucyBxQnZKLjUgMjNDTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTjAgSU0wIHJYMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgOEh6MHwxNGU1XCIsXG5cdFx0XCJBc2lhL1llcmV2YW58TE1UIFlFUlQgWUVSVCBZRVJTVCBZRVJTVCBBTVNUIEFNVCBBTVQgQU1TVHwtMlcgLTMwIC00MCAtNTAgLTQwIC00MCAtMzAgLTQwIC01MHwwMTIzMjMyMzIzMjMyMzIzMjMyMzIzMjQ1NjU2NTY1NjU3ODc4Nzg3ODc4Nzg3ODc4Nzg3ODc4Nzg3ODc4Nzg3fC0xUGMyVyAxalVuVyBXQ0wwIDFkYjAgMWNOMCAxZGIwIDFjTjAgMWRiMCAxZGQwIDFjTzAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxYW0wIDJyMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgM0ZiMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTB8MTNlNVwiLFxuXHRcdFwiQXRsYW50aWMvQXpvcmVzfEhNVCBBWk9UIEFaT1NUIEFaT01UIEFaT1QgQVpPU1QgV0VUfDFTLncgMjAgMTAgMCAxMCAwIDB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMzIxMjMyMTIzMjEyMzIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjE0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTY1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTR8LTJsZFc1LnMgYVBYNS5zIFNwMCBMWDAgMXZjMCBUYzAgMXVNMCBTTTAgMXZjMCBUYzAgMXZjMCBTTTAgMXZjMCA2NjAwIDFjbzAgM0UwMCAxN2MwIDFmQTAgMWEwMCAxaW8wIDFhMDAgMWlvMCAxN2MwIDNJMDAgMTdjMCAxY00wIDFjTTAgM0ZjMCAxY00wIDFhMDAgMWZBMCAxaW8wIDE3YzAgMWNNMCAxY00wIDFhMDAgMWZBMCAxaW8wIDFxTTAgRGMwIDF0QTAgMWNNMCAxZGMwIDE0MDAgZ0wwIElNMCBzMTAgVTAwIGRYMCBSYzAgcGQwIFJjMCBnTDAgT28wIHBkMCBSYzAgZ0wwIE9vMCBwZDAgMTRvMCAxY00wIDFjUDAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDNDbzAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgcUlsMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTjAgMWNMMCAxY04wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNOMCAxY0wwIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTDAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDB8MjVlNFwiLFxuXHRcdFwiQXRsYW50aWMvQmVybXVkYXxMTVQgQVNUIEFEVHw0ai5pIDQwIDMwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTFCblJFLkcgMUxUYkUuRyAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjB8NjVlM1wiLFxuXHRcdFwiQXRsYW50aWMvQ2FuYXJ5fExNVCBDQU5UIFdFVCBXRVNUfDExLkEgMTAgMCAtMTB8MDEyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzJ8LTFVdGFXLm8gWFBBVy5vIDFsQUswIDFhMTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMHw1NGU0XCIsXG5cdFx0XCJBdGxhbnRpYy9DYXBlX1ZlcmRlfExNVCBDVlQgQ1ZTVCBDVlR8MXkuNCAyMCAxMCAxMHwwMTIxM3wtMnhvbXAuVSAxcU9NcC5VIDd6WDAgMWRqZjB8NTBlNFwiLFxuXHRcdFwiQXRsYW50aWMvRmFyb2V8TE1UIFdFVCBXRVNUfHIuNCAwIC0xMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMXwtMnVTbncuVSAyV2dvdy5VIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDQ5ZTNcIixcblx0XHRcIkF0bGFudGljL01hZGVpcmF8Rk1UIE1BRFQgTUFEU1QgTUFETVQgV0VUIFdFU1R8MTcuQSAxMCAwIC0xMCAwIC0xMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIzMjEyMzIxMjMyMTIzMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NHwtMmxkV1EubyBhUFdRLm8gU3AwIExYMCAxdmMwIFRjMCAxdU0wIFNNMCAxdmMwIFRjMCAxdmMwIFNNMCAxdmMwIDY2MDAgMWNvMCAzRTAwIDE3YzAgMWZBMCAxYTAwIDFpbzAgMWEwMCAxaW8wIDE3YzAgM0kwMCAxN2MwIDFjTTAgMWNNMCAzRmMwIDFjTTAgMWEwMCAxZkEwIDFpbzAgMTdjMCAxY00wIDFjTTAgMWEwMCAxZkEwIDFpbzAgMXFNMCBEYzAgMXRBMCAxY00wIDFkYzAgMTQwMCBnTDAgSU0wIHMxMCBVMDAgZFgwIFJjMCBwZDAgUmMwIGdMMCBPbzAgcGQwIFJjMCBnTDAgT28wIHBkMCAxNG8wIDFjTTAgMWNQMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgM0NvMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCBxSWwwIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNOMCAxY0wwIDFjTjAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY04wIDFjTDAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMHwyN2U0XCIsXG5cdFx0XCJBdGxhbnRpYy9SZXlramF2aWt8TE1UIElTVCBJU1NUIEdNVHwxcyAxMCAwIDB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEzfC0ydVdtdyBtZmF3IDFCZDAgTUwwIDFMQjAgQ24wIDFMQjAgM2ZYMCBDMTAgSHJYMCAxY08wIExCMCAxRUwwIExBMCAxQzAwIE9vMCAxd28wIFJjMCAxd28wIFJjMCAxd28wIFJjMCAxemMwIE9vMCAxemMwIDE0bzAgMWxjMCAxNG8wIDFsYzAgMTRvMCAxbzAwIDExQTAgMWxjMCAxNG8wIDFvMDAgMTRvMCAxbGMwIDE0bzAgMWxjMCAxNG8wIDFsYzAgMTRvMCAxbGMwIDE0bzAgMW8wMCAxNG8wIDFsYzAgMTRvMCAxbGMwIDE0bzAgMWxjMCAxNG8wIDFsYzAgMTRvMCAxbGMwIDE0bzAgMW8wMCAxNG8wIDFsYzAgMTRvMCAxbGMwIDE0bzAgMWxjMCAxNG8wIDFsYzAgMTRvMCAxbzAwIDE0bzB8MTJlNFwiLFxuXHRcdFwiQXRsYW50aWMvU291dGhfR2VvcmdpYXxHU1R8MjB8MHx8MzBcIixcblx0XHRcIkF0bGFudGljL1N0YW5sZXl8U01UIEZLVCBGS1NUIEZLVCBGS1NUfDNQLm8gNDAgMzAgMzAgMjB8MDEyMTIxMjEyMTIxMjEzNDM0MzIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMnwtMmtKdzguQSAxMmJBOC5BIDE5WDAgMWZCMCAxOVgwIDFpcDAgMTlYMCAxZkIwIDE5WDAgMWZCMCAxOVgwIDFmQjAgQ24wIDFDYzEwIFdMMCAxcUwwIFUxMCAxdHowIFUxMCAxcU0wIFdOMCAxcUwwIFdOMCAxcUwwIFdOMCAxcUwwIFdOMCAxdHowIFUxMCAxdHowIFdOMCAxcUwwIFdOMCAxcUwwIFdOMCAxcUwwIFdOMCAxcUwwIFdOMCAxdHowIFdOMCAxcUwwIFdOMCAxcUwwIFdOMCAxcUwwIFdOMCAxcUwwIFdOMCAxcU4wIFUxMCAxd24wIFJkMCAxd24wIFUxMCAxdHowIFUxMCAxdHowIFUxMCAxdHowIFUxMCAxdHowIFUxMCAxd24wIFUxMCAxdHowIFUxMCAxdHowIFUxMHwyMWUyXCIsXG5cdFx0XCJBdXN0cmFsaWEvU3lkbmV5fEFFU1QgQUVEVHwtYTAgLWIwfDAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDF8LTI5M2xYIHhjWCAxMGpkMCB5TDAgMWNOMCAxY0wwIDFmQjAgMTlYMCAxN2MxMCBMQTAgMUMwMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBSYzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCAxNG8wIDFvMDAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgVTAwIDFxTTAgV00wIDF0QTAgV00wIDF0QTAgVTAwIDF0QTAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgUmMwIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxMUEwIDFvMDAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgV00wIDFxTTAgMTRvMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTB8NDBlNVwiLFxuXHRcdFwiQXVzdHJhbGlhL0FkZWxhaWRlfEFDU1QgQUNEVHwtOXUgLWF1fDAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDF8LTI5M2x0IHhjWCAxMGpkMCB5TDAgMWNOMCAxY0wwIDFmQjAgMTlYMCAxN2MxMCBMQTAgMUMwMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBSYzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBSYzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBVMDAgMXFNMCBXTTAgMXRBMCBXTTAgMXRBMCBVMDAgMXRBMCBVMDAgMXRBMCBPbzAgMXpjMCBXTTAgMXFNMCBSYzAgMXpjMCBVMDAgMXRBMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIFdNMCAxcU0wIDE0bzAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wfDExZTVcIixcblx0XHRcIkF1c3RyYWxpYS9CcmlzYmFuZXxBRVNUIEFFRFR8LWEwIC1iMHwwMTAxMDEwMTAxMDEwMTAxMHwtMjkzbFggeGNYIDEwamQwIHlMMCAxY04wIDFjTDAgMWZCMCAxOVgwIDE3YzEwIExBMCBIMUEwIE9vMCAxemMwIE9vMCAxemMwIE9vMHwyMGU1XCIsXG5cdFx0XCJBdXN0cmFsaWEvQnJva2VuX0hpbGx8QUNTVCBBQ0RUfC05dSAtYXV8MDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMXwtMjkzbHQgeGNYIDEwamQwIHlMMCAxY04wIDFjTDAgMWZCMCAxOVgwIDE3YzEwIExBMCAxQzAwIE9vMCAxemMwIE9vMCAxemMwIE9vMCAxemMwIFJjMCAxemMwIE9vMCAxemMwIE9vMCAxemMwIE9vMCAxemMwIE9vMCAxemMwIE9vMCAxemMwIDE0bzAgMW8wMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBVMDAgMXFNMCBXTTAgMXRBMCBXTTAgMXRBMCBVMDAgMXRBMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBSYzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIFdNMCAxcU0wIDE0bzAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wfDE4ZTNcIixcblx0XHRcIkF1c3RyYWxpYS9DdXJyaWV8QUVTVCBBRURUfC1hMCAtYjB8MDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMXwtMjlFODAgMTlYMCAxMGpkMCB5TDAgMWNOMCAxY0wwIDFmQjAgMTlYMCAxN2MxMCBMQTAgMUMwMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBSYzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCAxMUEwIDFxTTAgV00wIDFxTTAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF3bzAgV00wIDF0QTAgV00wIDF0QTAgVTAwIDF0QTAgVTAwIDF0QTAgMTFBMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxY00wIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxMUEwIDFvMDAgMWlvMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWNNMCAxY00wIDFhMDAgMWlvMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMHw3NDZcIixcblx0XHRcIkF1c3RyYWxpYS9EYXJ3aW58QUNTVCBBQ0RUfC05dSAtYXV8MDEwMTAxMDEwfC0yOTNsdCB4Y1ggMTBqZDAgeUwwIDFjTjAgMWNMMCAxZkIwIDE5WDB8MTJlNFwiLFxuXHRcdFwiQXVzdHJhbGlhL0V1Y2xhfEFDV1NUIEFDV0RUfC04SiAtOUp8MDEwMTAxMDEwMTAxMDEwMTAxMHwtMjkza0kgeGNYIDEwamQwIHlMMCAxY04wIDFjTDAgMWdTcDAgT28wIGw1QTAgT28wIGlKQTAgRzAwIHpVMDAgSU0wIDFxTTAgMTFBMCAxbzAwIDExQTB8MzY4XCIsXG5cdFx0XCJBdXN0cmFsaWEvSG9iYXJ0fEFFU1QgQUVEVHwtYTAgLWIwfDAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMXwtMjlFODAgMTlYMCAxMGpkMCB5TDAgMWNOMCAxY0wwIDFmQjAgMTlYMCBWZkIwIDFjTTAgMW8wMCBSYzAgMXdvMCBSYzAgMXdvMCBVMDAgMXdvMCBMQTAgMUMwMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBSYzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCBPbzAgMXpjMCAxMUEwIDFxTTAgV00wIDFxTTAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF3bzAgV00wIDF0QTAgV00wIDF0QTAgVTAwIDF0QTAgVTAwIDF0QTAgMTFBMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxY00wIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxMUEwIDFvMDAgMWlvMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWNNMCAxY00wIDFhMDAgMWlvMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMHwyMWU0XCIsXG5cdFx0XCJBdXN0cmFsaWEvTG9yZF9Ib3dlfEFFU1QgTEhTVCBMSERUIExIRFR8LWEwIC1hdSAtYnUgLWIwfDAxMjEyMTIxMjEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTMxMzEzMTN8cmFDMCAxemR1IFJiMCAxemQwIE9uMCAxemQwIE9uMCAxemQwIE9uMCAxemQwIFRYdSAxcU11IFdMdSAxdEF1IFdMdSAxdEF1IFRYdSAxdEF1IE9udSAxemN1IE9udSAxemN1IE9udSAxemN1IFJidSAxemN1IE9udSAxemN1IE9udSAxemN1IDExenUgMW8wdSAxMXp1IDFvMHUgMTF6dSAxbzB1IDExenUgMXFNdSBXTHUgMTFBdSAxblh1IDFxTXUgMTF6dSAxbzB1IDExenUgMW8wdSAxMXp1IDFxTXUgV0x1IDFxTXUgMTF6dSAxbzB1IFdMdSAxcU11IDE0bnUgMWNNdSAxY0x1IDFjTXUgMWNMdSAxY011IDFjTHUgMWNNdSAxY0x1IDFmQXUgMWNMdSAxY011IDFjTHUgMWNNdSAxY0x1IDFjTXUgMWNMdSAxY011IDFjTHUgMWNNdSAxY0x1IDFmQXUgMWNMdSAxY011IDFjTHUgMWNNdSAxY0x1IDFjTXUgMWNMdSAxY011IDFjTHUgMWNNdSAxZnp1IDFjTXUgMWNMdSAxY011IDFjTHUgMWNNdSAxY0x1IDFjTXUgMWNMdSAxY011IDFjTHUgMWZBdSAxY0x1IDFjTXUgMWNMdSAxY011IDFjTHUgMWNNdSAxY0x1IDFjTXUgMWNMdSAxY011IDFjTHUgMWZBdSAxY0x1IDFjTXUgMWNMdSAxY011fDM0N1wiLFxuXHRcdFwiQXVzdHJhbGlhL0xpbmRlbWFufEFFU1QgQUVEVHwtYTAgLWIwfDAxMDEwMTAxMDEwMTAxMDEwMTAxMHwtMjkzbFggeGNYIDEwamQwIHlMMCAxY04wIDFjTDAgMWZCMCAxOVgwIDE3YzEwIExBMCBIMUEwIE9vMCAxemMwIE9vMCAxemMwIE9vMCAxemMwIFJjMCAxemMwIE9vMHwxMFwiLFxuXHRcdFwiQXVzdHJhbGlhL01lbGJvdXJuZXxBRVNUIEFFRFR8LWEwIC1iMHwwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxfC0yOTNsWCB4Y1ggMTBqZDAgeUwwIDFjTjAgMWNMMCAxZkIwIDE5WDAgMTdjMTAgTEEwIDFDMDAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgUmMwIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgUmMwIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgVTAwIDFxTTAgV00wIDFxTTAgMTFBMCAxdEEwIFUwMCAxdEEwIFUwMCAxdEEwIE9vMCAxemMwIE9vMCAxemMwIFJjMCAxemMwIE9vMCAxemMwIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMTFBMCAxbzAwIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIFdNMCAxcU0wIDE0bzAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wfDM5ZTVcIixcblx0XHRcIkF1c3RyYWxpYS9QZXJ0aHxBV1NUIEFXRFR8LTgwIC05MHwwMTAxMDEwMTAxMDEwMTAxMDEwfC0yOTNqWCB4Y1ggMTBqZDAgeUwwIDFjTjAgMWNMMCAxZ1NwMCBPbzAgbDVBMCBPbzAgaUpBMCBHMDAgelUwMCBJTTAgMXFNMCAxMUEwIDFvMDAgMTFBMHwxOGU1XCIsXG5cdFx0XCJDRVR8Q0VUIENFU1R8LTEwIC0yMHwwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMHwtMmFGZTAgMTFkMCAxaU8wIDExQTAgMW8wMCAxMUEwIFFyYzAgNmkwMCBXTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxNk0wIDFnTU0wIDFhMDAgMWZBMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFhMDAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMFwiLFxuXHRcdFwiQ1NUNkNEVHxDU1QgQ0RUIENXVCBDUFR8NjAgNTAgNTAgNTB8MDEwMTAyMzAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwfC0yNjFzMCAxblgwIDExQjAgMW5YMCBTZ04wIDh4MzAgaXcwIFF3TjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCBzMTAgMVZ6MCBMQjAgMUJYMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjBcIixcblx0XHRcIlBhY2lmaWMvRWFzdGVyfEVNVCBFQVNUIEVBU1NUIEVBU1QgRUFTU1R8N2gucyA3MCA2MCA2MCA1MHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0fC0xdVNnRy53IDFzNElHLncgV0wwIDF6ZDAgT24wIDFpcDAgMTF6MCAxbzEwIDExejAgMXFOMCBXTDAgMWxkMCAxNG4wIDFxTjAgV0wwIDFxTjAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAgV0wwIDFxTjAgV0wwIDFxTjAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxcU4wIFdMMCAxcU4wIDFjTDAgMWNOMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxZkIwIDE5WDAgMXFOMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFxTjAgV0wwIDFxTjAgMTdiMCAxaXAwIDExejAgMWlwMCAxZnowIDFmQjAgMTF6MCAxcU4wIFdMMCAxcU4wIFdMMCAxcU4wIFdMMCAxcU4wIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxcU4wIFdMMCAxcU4wIDE3YjAgMWlwMCAxMXowIDFvMTAgMTlYMCAxZkIwIDFuWDAgRzEwIDFFTDAgT3AwIDF6YjAgUmQwIDF3bjAgUmQwIDQ2bjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgRGQwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgRGQwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgRGQwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwIDFOYjAgQXAwfDMwZTJcIixcblx0XHRcIkVFVHxFRVQgRUVTVHwtMjAgLTMwfDAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMHxoREIwIDFhMDAgMWZBMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFhMDAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMFwiLFxuXHRcdFwiRVNUfEVTVHw1MHwwfFwiLFxuXHRcdFwiRVNUNUVEVHxFU1QgRURUIEVXVCBFUFR8NTAgNDAgNDAgNDB8MDEwMTAyMzAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwfC0yNjF0MCAxblgwIDExQjAgMW5YMCBTZ04wIDh4NDAgaXYwIFF3TjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCBzMTAgMVZ6MCBMQjAgMUJYMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjBcIixcblx0XHRcIkV1cm9wZS9EdWJsaW58RE1UIElTVCBHTVQgQlNUIElTVHxwLmwgLXkuRCAwIC0xMCAtMTB8MDEyMzIzMjMyMzIzMjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDI0MjQyNDJ8LTJheDl5LkQgUmMwIDFmenkuRCAxNE0wIDFmYzAgMWcwMCAxY28wIDFkYzAgMWNvMCAxb28wIDE0MDAgMWRjMCAxOUEwIDFpbzAgMWlvMCBXTTAgMW8wMCAxNG8wIDFvMDAgMTdjMCAxaW8wIDE3YzAgMWZBMCAxYTAwIDFsYzAgMTdjMCAxaW8wIDE3YzAgMWZBMCAxYTAwIDFpbzAgMTdjMCAxaW8wIDE3YzAgMWZBMCAxY00wIDFpbzAgMTdjMCAxZkEwIDFhMDAgMWlvMCAxN2MwIDFpbzAgMTdjMCAxZkEwIDFhMDAgMWlvMCAxcU0wIERjMCBnNVgwIDE0cDAgMXduMCAxN2QwIDFpbzAgMTFBMCAxbzAwIDE3YzAgMWZBMCAxYTAwIDFmQTAgMWNNMCAxZkEwIDFhMDAgMTdjMCAxZkEwIDFhMDAgMWlvMCAxN2MwIDFsYzAgMTdjMCAxZkEwIDFhMDAgMWlvMCAxN2MwIDFpbzAgMTdjMCAxZkEwIDFhMDAgMWEwMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXRBMCBJTTAgOTBvMCBVMDAgMXRBMCBVMDAgMXRBMCBVMDAgMXRBMCBVMDAgMXRBMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXRBMCBVMDAgMXRBMCBVMDAgMXRBMCAxMXowIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDE0bzAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDB8MTJlNVwiLFxuXHRcdFwiRXRjL0dNVCswfEdNVHwwfDB8XCIsXG5cdFx0XCJFdGMvR01UKzF8R01UKzF8MTB8MHxcIixcblx0XHRcIkV0Yy9HTVQrMTB8R01UKzEwfGEwfDB8XCIsXG5cdFx0XCJFdGMvR01UKzExfEdNVCsxMXxiMHwwfFwiLFxuXHRcdFwiRXRjL0dNVCsxMnxHTVQrMTJ8YzB8MHxcIixcblx0XHRcIkV0Yy9HTVQrMnxHTVQrMnwyMHwwfFwiLFxuXHRcdFwiRXRjL0dNVCszfEdNVCszfDMwfDB8XCIsXG5cdFx0XCJFdGMvR01UKzR8R01UKzR8NDB8MHxcIixcblx0XHRcIkV0Yy9HTVQrNXxHTVQrNXw1MHwwfFwiLFxuXHRcdFwiRXRjL0dNVCs2fEdNVCs2fDYwfDB8XCIsXG5cdFx0XCJFdGMvR01UKzd8R01UKzd8NzB8MHxcIixcblx0XHRcIkV0Yy9HTVQrOHxHTVQrOHw4MHwwfFwiLFxuXHRcdFwiRXRjL0dNVCs5fEdNVCs5fDkwfDB8XCIsXG5cdFx0XCJFdGMvR01ULTF8R01ULTF8LTEwfDB8XCIsXG5cdFx0XCJFdGMvR01ULTEwfEdNVC0xMHwtYTB8MHxcIixcblx0XHRcIkV0Yy9HTVQtMTF8R01ULTExfC1iMHwwfFwiLFxuXHRcdFwiRXRjL0dNVC0xMnxHTVQtMTJ8LWMwfDB8XCIsXG5cdFx0XCJFdGMvR01ULTEzfEdNVC0xM3wtZDB8MHxcIixcblx0XHRcIkV0Yy9HTVQtMTR8R01ULTE0fC1lMHwwfFwiLFxuXHRcdFwiRXRjL0dNVC0yfEdNVC0yfC0yMHwwfFwiLFxuXHRcdFwiRXRjL0dNVC0zfEdNVC0zfC0zMHwwfFwiLFxuXHRcdFwiRXRjL0dNVC00fEdNVC00fC00MHwwfFwiLFxuXHRcdFwiRXRjL0dNVC01fEdNVC01fC01MHwwfFwiLFxuXHRcdFwiRXRjL0dNVC02fEdNVC02fC02MHwwfFwiLFxuXHRcdFwiRXRjL0dNVC03fEdNVC03fC03MHwwfFwiLFxuXHRcdFwiRXRjL0dNVC04fEdNVC04fC04MHwwfFwiLFxuXHRcdFwiRXRjL0dNVC05fEdNVC05fC05MHwwfFwiLFxuXHRcdFwiRXRjL1VDVHxVQ1R8MHwwfFwiLFxuXHRcdFwiRXRjL1VUQ3xVVEN8MHwwfFwiLFxuXHRcdFwiRXVyb3BlL0Ftc3RlcmRhbXxBTVQgTlNUIE5FU1QgTkVUIENFU1QgQ0VUfC1qLncgLTFqLncgLTFrIC1rIC0yMCAtMTB8MDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEyMzIzMjM0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1fC0yYUZjai53IDExYjAgMWlQMCAxMUEwIDFpbzAgMWNNMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxY28wIDFpbzAgMXlvMCBQYzAgMWEwMCAxZkEwIDFCYzAgTW8wIDF0YzAgVW8wIDF0QTAgVTAwIDF1bzAgVzAwIDFzMDAgVkEwIDFzbzAgVmMwIDFzTTAgVU0wIDF3bzAgUmMwIDF1MDAgV28wIDFyQTAgVzAwIDFzMDAgVkEwIDFzTTAgVU0wIDF3MDAgZlYwIEJDWC53IDF0QTAgVTAwIDF1MDAgV28wIDFzbTAgNjAxayBXTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxNk0wIDFnTU0wIDFhMDAgMWZBMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFhMDAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMHwxNmU1XCIsXG5cdFx0XCJFdXJvcGUvQW5kb3JyYXxXRVQgQ0VUIENFU1R8MCAtMTAgLTIwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMXwtVUJBMCAxeElOMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDc5ZTNcIixcblx0XHRcIkV1cm9wZS9Bc3RyYWtoYW58TE1UICswMyArMDQgKzA1fC0zYy5jIC0zMCAtNDAgLTUwfDAxMjMyMzIzMjMyMzIzMjMyMzIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMnwtMVBjcmMuYyBlVU1jLmMgMjNDTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMnBCMCAxY00wIDFmQTAgMWNNMCAzQ28wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgOEh6MCAzcmQwXCIsXG5cdFx0XCJFdXJvcGUvQXRoZW5zfEFNVCBFRVQgRUVTVCBDRVNUIENFVHwtMXkuUSAtMjAgLTMwIC0yMCAtMTB8MDEyMTIzNDM0MTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0yYTYxeC5RIENOYnguUSBtbjAga1UxMCA5YjAgM0VzMCBYYTAgMWZiMCAxZGQwIGszWDAgTnowIFNDcDAgMXZjMCBTTzAgMWNNMCAxYTAwIDFhbzAgMWZjMCAxYTEwIDFmRzAgMWNnMCAxZFgwIDFiWDAgMWNRMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMHwzNWU1XCIsXG5cdFx0XCJFdXJvcGUvTG9uZG9ufEdNVCBCU1QgQkRTVHwwIC0xMCAtMjB8MDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEyMTIxMjEyMTIxMDEwMTIxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMHwtMmF4YTAgUmMwIDFmQTAgMTRNMCAxZmMwIDFnMDAgMWNvMCAxZGMwIDFjbzAgMW9vMCAxNDAwIDFkYzAgMTlBMCAxaW8wIDFpbzAgV00wIDFvMDAgMTRvMCAxbzAwIDE3YzAgMWlvMCAxN2MwIDFmQTAgMWEwMCAxbGMwIDE3YzAgMWlvMCAxN2MwIDFmQTAgMWEwMCAxaW8wIDE3YzAgMWlvMCAxN2MwIDFmQTAgMWNNMCAxaW8wIDE3YzAgMWZBMCAxYTAwIDFpbzAgMTdjMCAxaW8wIDE3YzAgMWZBMCAxYTAwIDFpbzAgMXFNMCBEYzAgMlJ6MCBEYzAgMXpjMCBPbzAgMXpjMCBSYzAgMXdvMCAxN2MwIDFpTTAgRkEwIHhCMCAxZkEwIDFhMDAgMTRvMCBiYjAgTEEwIHhCMCBSYzAgMXdvMCAxMUEwIDFvMDAgMTdjMCAxZkEwIDFhMDAgMWZBMCAxY00wIDFmQTAgMWEwMCAxN2MwIDFmQTAgMWEwMCAxaW8wIDE3YzAgMWxjMCAxN2MwIDFmQTAgMWEwMCAxaW8wIDE3YzAgMWlvMCAxN2MwIDFmQTAgMWEwMCAxYTAwIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxdEEwIElNMCA5MG8wIFUwMCAxdEEwIFUwMCAxdEEwIFUwMCAxdEEwIFUwMCAxdEEwIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxdEEwIFUwMCAxdEEwIFUwMCAxdEEwIDExejAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTRvMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMHwxMGU2XCIsXG5cdFx0XCJFdXJvcGUvQmVsZ3JhZGV8Q0VUIENFU1R8LTEwIC0yMHwwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMHwtMTlSQzAgM0lQMCBXTTAgMWZBMCAxY00wIDFjTTAgMXJjMCBRbzAgMXZtbzAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDEyZTVcIixcblx0XHRcIkV1cm9wZS9CZXJsaW58Q0VUIENFU1QgQ0VNVHwtMTAgLTIwIC0zMHwwMTAxMDEwMTAxMDEwMTIxMDEwMTIxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMHwtMmFGZTAgMTFkMCAxaU8wIDExQTAgMW8wMCAxMUEwIFFyYzAgNmkwMCBXTTAgMWZBMCAxY00wIDFjTTAgMWNNMCBrTDAgTmMwIG0xMCBXTTAgMWFvMCAxY3AwIGRYMCBqejAgRGQwIDFpbzAgMTdjMCAxZkEwIDFhMDAgMWVoQTAgMWEwMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDQxZTVcIixcblx0XHRcIkV1cm9wZS9QcmFndWV8Q0VUIENFU1R8LTEwIC0yMHwwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTB8LTJhRmUwIDExZDAgMWlPMCAxMUEwIDFvMDAgMTFBMCBRcmMwIDZpMDAgV00wIDFmQTAgMWNNMCAxNk0wIDFsYzAgMXRBMCAxN0EwIDExYzAgMWlvMCAxN2MwIDFpbzAgMTdjMCAxZmMwIDFhbzAgMWJOYzAgMWNNMCAxZkEwIDFhMDAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMHwxM2U1XCIsXG5cdFx0XCJFdXJvcGUvQnJ1c3NlbHN8V0VUIENFVCBDRVNUIFdFU1R8MCAtMTAgLTIwIC0xMHwwMTIxMjEyMTAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0yZWhjMCAzelgwIDExYzAgMWlPMCAxMUEwIDFvMDAgMTFBMCBteTAgSWMwIDFxTTAgUmMwIDFFTTAgVU0wIDF1MDAgMTBvMCAxaW8wIDFpbzAgMTdjMCAxYTAwIDFmQTAgMWNNMCAxY00wIDFpbzAgMTdjMCAxZkEwIDFhMDAgMWlvMCAxYTMwIDFpbzAgMTdjMCAxZkEwIDFhMDAgMWlvMCAxN2MwIDFjTTAgMWNNMCAxYTAwIDFpbzAgMWNNMCAxY00wIDFhMDAgMWZBMCAxaW8wIDE3YzAgMWNNMCAxY00wIDFhMDAgMWZBMCAxaW8wIDFxTTAgRGMwIHkwMCA1V24wIFdNMCAxZkEwIDFjTTAgMTZNMCAxaU0wIDE2TTAgMUMwMCBVbzAgMWVlbzAgMWEwMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFmQTAgMWEwMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDIxZTVcIixcblx0XHRcIkV1cm9wZS9CdWNoYXJlc3R8Qk1UIEVFVCBFRVNUfC0xSS5vIC0yMCAtMzB8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMXwtMXhBcEkubyAyMExJLm8gUkEwIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxQXhjMCBPbjAgMWZBMCAxYTEwIDFjTzAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY0swIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTDAgMWNOMCAxY0wwIDFmQjAgMW5YMCAxMUUwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDB8MTllNVwiLFxuXHRcdFwiRXVyb3BlL0J1ZGFwZXN0fENFVCBDRVNUfC0xMCAtMjB8MDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMHwtMmFGZTAgMTFkMCAxaU8wIDExQTAgMWlwMCAxN2IwIDFvcDAgMXRiMCBRMm0wIDNOZTAgV00wIDFmQTAgMWNNMCAxY00wIDFvSjAgMWRjMCAxMDMwIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFhMDAgMWlNMCAxZkEwIDhIYTAgUmIwIDF3TjAgUmIwIDFCQjAgTHowIDFDMjAgTEIwIFNOWDAgMWExMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDE3ZTVcIixcblx0XHRcIkV1cm9wZS9adXJpY2h8Q0VUIENFU1R8LTEwIC0yMHwwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMHwtMTlMYzAgMTFBMCAxbzAwIDExQTAgMXhHMTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDB8MzhlNFwiLFxuXHRcdFwiRXVyb3BlL0NoaXNpbmF1fENNVCBCTVQgRUVUIEVFU1QgQ0VTVCBDRVQgTVNLIE1TRHwtMVQgLTFJLm8gLTIwIC0zMCAtMjAgLTEwIC0zMCAtNDB8MDEyMzIzMjMyMzIzMjMyMzIzMjM0NTQ1NDY3Njc2NzY3Njc2NzY3Njc2NzY3MzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyMzIzMjMyfC0yNmpkVCB3R01hLkEgMjBMSS5vIFJBMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMjdBMCAyZW4wIDM5ZzAgV00wIDFmQTAgMWNNMCBWOTAgMXQ3ejAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgZ0wwIFdPMCAxY00wIDFjTTAgMWNLMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFmQjAgMW5YMCAxMUQwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDB8NjdlNFwiLFxuXHRcdFwiRXVyb3BlL0NvcGVuaGFnZW58Q0VUIENFU1R8LTEwIC0yMHwwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwfC0yYXpDMCBUejAgVnVPMCA2MHEwIFdNMCAxZkEwIDFjTTAgMWNNMCAxY00wIFMwMCAxSEEwIE5jMCAxQzAwIERjMCAxTmMwIEFvMCAxaDVBMCAxYTAwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDB8MTJlNVwiLFxuXHRcdFwiRXVyb3BlL0dpYnJhbHRhcnxHTVQgQlNUIEJEU1QgQ0VUIENFU1R8MCAtMTAgLTIwIC0xMCAtMjB8MDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEyMTIxMjEyMTIxMDEwMTIxMDEwMTAxMDEwMTAxMDEwMTAxMDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzfC0yYXhhMCBSYzAgMWZBMCAxNE0wIDFmYzAgMWcwMCAxY28wIDFkYzAgMWNvMCAxb28wIDE0MDAgMWRjMCAxOUEwIDFpbzAgMWlvMCBXTTAgMW8wMCAxNG8wIDFvMDAgMTdjMCAxaW8wIDE3YzAgMWZBMCAxYTAwIDFsYzAgMTdjMCAxaW8wIDE3YzAgMWZBMCAxYTAwIDFpbzAgMTdjMCAxaW8wIDE3YzAgMWZBMCAxY00wIDFpbzAgMTdjMCAxZkEwIDFhMDAgMWlvMCAxN2MwIDFpbzAgMTdjMCAxZkEwIDFhMDAgMWlvMCAxcU0wIERjMCAyUnowIERjMCAxemMwIE9vMCAxemMwIFJjMCAxd28wIDE3YzAgMWlNMCBGQTAgeEIwIDFmQTAgMWEwMCAxNG8wIGJiMCBMQTAgeEIwIFJjMCAxd28wIDExQTAgMW8wMCAxN2MwIDFmQTAgMWEwMCAxZkEwIDFjTTAgMWZBMCAxYTAwIDE3YzAgMWZBMCAxYTAwIDFpbzAgMTdjMCAxbGMwIDE3YzAgMWZBMCAxMEp6MCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDMwZTNcIixcblx0XHRcIkV1cm9wZS9IZWxzaW5raXxITVQgRUVUIEVFU1R8LTFELk4gLTIwIC0zMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0xV3VORC5OIE9VTEQuTiAxZEEwIDF4R3EwIDFjTTAgMWNNMCAxY00wIDFjTjAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDEyZTVcIixcblx0XHRcIkV1cm9wZS9LYWxpbmluZ3JhZHxDRVQgQ0VTVCBDRVQgQ0VTVCBNU0sgTVNEIEVFU1QgRUVUIEZFVHwtMTAgLTIwIC0yMCAtMzAgLTMwIC00MCAtMzAgLTIwIC0zMHwwMTAxMDEwMTAxMDEwMjMyNDU0NTQ1NDU0NTQ1NDU0NTQ2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2NzY3Njc2Nzg3fC0yYUZlMCAxMWQwIDFpTzAgMTFBMCAxbzAwIDExQTAgUXJjMCA2aTAwIFdNMCAxZkEwIDFjTTAgMWNNMCBBbTAgTGIwIDFlbjAgb3AwIDFwTnowIDFkYjAgMWNOMCAxZGIwIDFjTjAgMWRiMCAxZGQwIDFjTzAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNOMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDhIejB8NDRlNFwiLFxuXHRcdFwiRXVyb3BlL0tpZXZ8S01UIEVFVCBNU0sgQ0VTVCBDRVQgTVNEIEVFU1R8LTIyLjQgLTIwIC0zMCAtMjAgLTEwIC00MCAtMzB8MDEyMzQzNDI1MjUyNTI1MjUyNTI1MjUyNTI1NjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MXwtMVBjMjIuNCBlVW8yLjQgcm56MCAySGcwIFdNMCAxZkEwIGRhMCAxdjRtMCAxZGIwIDFjTjAgMWRiMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCBEYjAgMzIyMCAxY0swIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY1EwIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMHwzNGU1XCIsXG5cdFx0XCJFdXJvcGUvS2lyb3Z8TE1UICswMyArMDQgKzA1fC0zaS5NIC0zMCAtNDAgLTUwfDAxMjMyMzIzMjMyMzIzMjMyMzIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0yMldOaS5NIHFIYWkuTSAyM0NMMCAxZGIwIDFjTjAgMWRiMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAycEIwIDFjTTAgMWZBMCAxY00wIDNDbzAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCA4SHowfDQ4ZTRcIixcblx0XHRcIkV1cm9wZS9MaXNib258TE1UIFdFVCBXRVNUIFdFTVQgQ0VUIENFU1R8QS5KIDAgLTEwIC0yMCAtMTAgLTIwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjMyMTIzMjEyMzIxMjMyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxNDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyNDU0NTQ1NDIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMXwtMmxkWG4uZiBhUFduLmYgU3AwIExYMCAxdmMwIFRjMCAxdU0wIFNNMCAxdmMwIFRjMCAxdmMwIFNNMCAxdmMwIDY2MDAgMWNvMCAzRTAwIDE3YzAgMWZBMCAxYTAwIDFpbzAgMWEwMCAxaW8wIDE3YzAgM0kwMCAxN2MwIDFjTTAgMWNNMCAzRmMwIDFjTTAgMWEwMCAxZkEwIDFpbzAgMTdjMCAxY00wIDFjTTAgMWEwMCAxZkEwIDFpbzAgMXFNMCBEYzAgMXRBMCAxY00wIDFkYzAgMTQwMCBnTDAgSU0wIHMxMCBVMDAgZFgwIFJjMCBwZDAgUmMwIGdMMCBPbzAgcGQwIFJjMCBnTDAgT28wIHBkMCAxNG8wIDFjTTAgMWNQMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgM0NvMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCBwdnkwIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY04wIDFjTDAgMWNOMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTjAgMWNMMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDI3ZTVcIixcblx0XHRcIkV1cm9wZS9MdXhlbWJvdXJnfExNVCBDRVQgQ0VTVCBXRVQgV0VTVCBXRVNUIFdFVHwtby5BIC0xMCAtMjAgMCAtMTAgLTIwIC0xMHwwMTIxMjEyMTM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0NTY1NjUxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0yREcwby5BIHQ2bW8uQSBUQjAgMW5YMCBVcDAgMW8yMCAxMUEwIHJXMCBDTTAgMXFQMCBSOTAgMUVPMCBVSzAgMXUyMCAxMG0wIDFpcDAgMWluMCAxN2UwIDE5VzAgMWZCMCAxZGIwIDFjcDAgMWluMCAxN2QwIDFmejAgMWExMCAxaW4wIDFhMTAgMWluMCAxN2YwIDFmQTAgMWEwMCAxaW8wIDE3YzAgMWNNMCAxY00wIDFhMDAgMWlvMCAxY00wIDFjTTAgMWEwMCAxZkEwIDFpbzAgMTdjMCAxY00wIDFjTTAgMWEwMCAxZkEwIDFpbzAgMXFNMCBEYzAgdkEwIDYwTDAgV00wIDFmQTAgMWNNMCAxN2MwIDFpbzAgMTZNMCAxQzAwIFVvMCAxZWVvMCAxYTAwIDFmQTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxYTAwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDB8NTRlNFwiLFxuXHRcdFwiRXVyb3BlL01hZHJpZHxXRVQgV0VTVCBXRU1UIENFVCBDRVNUfDAgLTEwIC0yMCAtMTAgLTIwfDAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTIxMjEyMTIxMjM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzfC0yOGRkMCAxMUEwIDFnbzAgMTlBMCAxY28wIDFkQTAgYjFBMCAxOG8wIDNJMDAgMTdjMCAxZkEwIDFhMDAgMWlvMCAxYTAwIDFpbzAgMTdjMCBpeW8wIFJjMCAxOG8wIDFoYzAgMWlvMCAxYTAwIDE0bzAgNWFMMCBNTTAgMXZjMCAxN0EwIDFpMDAgMWJjMCAxZW8wIDE3ZDAgMWluMCAxN0EwIDZoQTAgMTBOMCBYSUwwIDFhMTAgMWluMCAxN2QwIDE5WDAgMWNOMCAxZnowIDFhMTAgMWZYMCAxY3AwIDFjTzAgMWNNMCAxZkEwIDFhMDAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMHw2MmU1XCIsXG5cdFx0XCJFdXJvcGUvTWFsdGF8Q0VUIENFU1R8LTEwIC0yMHwwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwfC0yYXMxMCBNMDAgMWNNMCAxY00wIDE0bzAgMW8wMCBXTTAgMXFNMCAxN2MwIDFjTTAgTTNBMCA1TTIwIFdNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDE2bTAgMWRlMCAxbGMwIDE0bTAgMWxjMCBXTzAgMXFNMCBHVFcwIE9uMCAxQzEwIEx6MCAxQzEwIEx6MCAxRU4wIEx6MCAxQzEwIEx6MCAxemQwIE9vMCAxQzAwIE9uMCAxY3AwIDFjTTAgMWxBMCBYYzAgMXFxMCAxMXowIDFvMTAgMTF6MCAxbzEwIDExejAgMW8xMCAxMXowIDFvMTAgMTF6MCAxaU4wIDE5ejAgMWZCMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMHw0MmU0XCIsXG5cdFx0XCJFdXJvcGUvTWluc2t8TU1UIEVFVCBNU0sgQ0VTVCBDRVQgTVNEIEVFU1QgRkVUfC0xTyAtMjAgLTMwIC0yMCAtMTAgLTQwIC0zMCAtMzB8MDEyMzQzNDMyNTI1MjUyNTI1MjUyNTI1MjUyNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTcyfC0xUGMxTyBlVW5PIHFOWDAgM2dRMCBXTTAgMWZBMCAxY00wIEFsMCAxdHNuMCAxZGIwIDFjTjAgMWRiMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgM0ZjMCAxY04wIDFjSzAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDhIeTB8MTllNVwiLFxuXHRcdFwiRXVyb3BlL01vbmFjb3xQTVQgV0VUIFdFU1QgV0VNVCBDRVQgQ0VTVHwtOS5sIDAgLTEwIC0yMCAtMTAgLTIwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjMyMzIzMjMyMzQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0fC0ybmNvOS5sIGNOYjkubCBIQTAgMTlBMCAxaU0wIDExYzAgMW9vMCBXbzAgMXJjMCBRTTAgMUVNMCBVTTAgMXUwMCAxMG8wIDFpbzAgMXdvMCBSYzAgMWEwMCAxZkEwIDFjTTAgMWNNMCAxaW8wIDE3YzAgMWZBMCAxYTAwIDFpbzAgMWEwMCAxaW8wIDE3YzAgMWZBMCAxYTAwIDFpbzAgMTdjMCAxY00wIDFjTTAgMWEwMCAxaW8wIDFjTTAgMWNNMCAxYTAwIDFmQTAgMWlvMCAxN2MwIDFjTTAgMWNNMCAxYTAwIDFmQTAgMWlvMCAxcU0wIERmMCAyUlYwIDExejAgMTFCMCAxemUwIFdNMCAxZkEwIDFjTTAgMWZhMCAxYXEwIDE2TTAgMWVrbjAgMWNMMCAxZkMwIDFhMDAgMWZBMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFhMDAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMHwzOGUzXCIsXG5cdFx0XCJFdXJvcGUvTW9zY293fE1NVCBNTVQgTVNUIE1EU1QgTVNEIE1TSyBNU00gRUVUIEVFU1QgTVNLfC0ydS5oIC0ydi5qIC0zdi5qIC00di5qIC00MCAtMzAgLTUwIC0yMCAtMzAgLTQwfDAxMjEzMjM0NTQ2NDU3NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1ODc1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU5NXwtMmFnMnUuaCAycHlXLlcgMWJBMCAxMVgwIEdOMCAxSGIwIGMyMCBpbXYuaiAzREEwIGR6MCAxNUEwIGMxMCAycTEwIGlNMTAgMjNDTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTjAgSU0wIHJYMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgOEh6MHwxNmU2XCIsXG5cdFx0XCJFdXJvcGUvUGFyaXN8UE1UIFdFVCBXRVNUIENFU1QgQ0VUIFdFTVR8LTkubCAwIC0xMCAtMjAgLTEwIC0yMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIzNDM0MzUyNTQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0MzQzNDM0fC0ybmNvOC5sIGNOYjgubCBIQTAgMTlBMCAxaU0wIDExYzAgMW9vMCBXbzAgMXJjMCBRTTAgMUVNMCBVTTAgMXUwMCAxMG8wIDFpbzAgMXdvMCBSYzAgMWEwMCAxZkEwIDFjTTAgMWNNMCAxaW8wIDE3YzAgMWZBMCAxYTAwIDFpbzAgMWEwMCAxaW8wIDE3YzAgMWZBMCAxYTAwIDFpbzAgMTdjMCAxY00wIDFjTTAgMWEwMCAxaW8wIDFjTTAgMWNNMCAxYTAwIDFmQTAgMWlvMCAxN2MwIDFjTTAgMWNNMCAxYTAwIDFmQTAgMWlvMCAxcU0wIERmMCBJazAgNU0zMCBXTTAgMWZBMCAxY00wIFZ4MCBoQjAgMWFxMCAxNk0wIDFla24wIDFjTDAgMWZDMCAxYTAwIDFmQTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxYTAwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDB8MTFlNlwiLFxuXHRcdFwiRXVyb3BlL1JpZ2F8Uk1UIExTVCBFRVQgTVNLIENFU1QgQ0VUIE1TRCBFRVNUfC0xQS55IC0yQS55IC0yMCAtMzAgLTIwIC0xMCAtNDAgLTMwfDAxMDEwMjM0NTQ1NDUzNjM2MzYzNjM2MzYzNjM2MzcyNzI3MjcyNzI3MjcyNzI3MjcyNzI3MjcyNzI3MjcyNzI3MjcyNzI3MjcyNzI3MjcyNzI3MjcyNzI3MjcyNzI3MjcyNzI3MjcyNzI3MjcyNzI3MjcyNzI3MjcyNzI3MnwtMjVUekEueSAxMUEwIDFpTTAga28wIGdXbTAgeURYQS55IDJiWDAgM2ZFMCBXTTAgMWZBMCAxY00wIDFjTTAgNG0wIDFzTHkwIDFkYjAgMWNOMCAxZGIwIDFjTjAgMWRiMCAxZGQwIDFjTzAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNOMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFjTTAgMWNOMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgM29vMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMHw2NGU0XCIsXG5cdFx0XCJFdXJvcGUvUm9tZXxDRVQgQ0VTVHwtMTAgLTIwfDAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTB8LTJhczEwIE0wMCAxY00wIDFjTTAgMTRvMCAxbzAwIFdNMCAxcU0wIDE3YzAgMWNNMCBNM0EwIDVNMjAgV00wIDFmQTAgMWNNMCAxNkswIDFpTzAgMTZtMCAxZGUwIDFsYzAgMTRtMCAxbGMwIFdPMCAxcU0wIEdUVzAgT24wIDFDMTAgTHowIDFDMTAgTHowIDFFTjAgTHowIDFDMTAgTHowIDF6ZDAgT28wIDFDMDAgT24wIDFDMTAgTHowIDF6ZDAgT24wIDFDMTAgTEEwIDFDMDAgTEEwIDF6YzAgT28wIDFDMDAgT28wIDF6YzAgT28wIDFmQzAgMWEwMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDM5ZTVcIixcblx0XHRcIkV1cm9wZS9TYW1hcmF8TE1UIFNBTVQgU0FNVCBLVVlUIEtVWVNUIE1TRCBNU0sgRUVTVCBTQU1TVCBTQU1TVHwtM2suayAtMzAgLTQwIC00MCAtNTAgLTQwIC0zMCAtMzAgLTUwIC00MHwwMTIzNDM0MzQzNDM0MzQzNDM0MzU2NTY3MTI4MjgyODI4MjgyODI4MjgyODI4MjgyODI4MjgyODI4MjgyODI5MTJ8LTIyV05rLmsgcUhhay5rIGJjbjAgMVFxbzAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY04wIDFjTTAgMWZBMCAxY00wIDFjTjAgOG8wIDE0bTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTjAgV00wfDEyZTVcIixcblx0XHRcIkV1cm9wZS9TaW1mZXJvcG9sfFNNVCBFRVQgTVNLIENFU1QgQ0VUIE1TRCBFRVNUIE1TS3wtMmcgLTIwIC0zMCAtMjAgLTEwIC00MCAtMzAgLTQwfDAxMjM0MzQzMjUyNTI1MjUyNTI1MjUyNTI1MjE2MTYxNjUyNTI1MjYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE3MnwtMVBjMmcgZVVvZyByRW4wIDJxczAgV00wIDFmQTAgMWNNMCAzVjAgMXUwTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFRMDAgNGVMMCAxY0wwIDFjTjAgMWNMMCAxY04wIGRYMCBXTDAgMWNOMCAxY0wwIDFmQjAgMW8zMCAxMUIwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTF6MCAxblcwfDMzZTRcIixcblx0XHRcIkV1cm9wZS9Tb2ZpYXxFRVQgQ0VUIENFU1QgRUVTVHwtMjAgLTEwIC0yMCAtMzB8MDEyMTIxMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzB8LTE2OEwwIFdNMCAxZkEwIDFjTTAgMWNNMCAxY04wIDFtS0gwIDFkZDAgMWZiMCAxYXAwIDFmYjAgMWEyMCAxZnkwIDFhMzAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY0swIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFmQjAgMW5YMCAxMUUwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDB8MTJlNVwiLFxuXHRcdFwiRXVyb3BlL1N0b2NraG9sbXxDRVQgQ0VTVHwtMTAgLTIwfDAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwfC0yYXpDMCBUQjAgMnlEZTAgMWEwMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDE1ZTVcIixcblx0XHRcIkV1cm9wZS9UYWxsaW5ufFRNVCBDRVQgQ0VTVCBFRVQgTVNLIE1TRCBFRVNUfC0xRCAtMTAgLTIwIC0yMCAtMzAgLTQwIC0zMHwwMTIxMDM0MjEyMTI0NTQ1NDU0NTQ1NDU0NTQ1NDYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjN8LTI2b05EIHRlRCAxMUEwIDFUYTAgNHJYbCBLU0xEIDJGWDAgMkpnMCBXTTAgMWZBMCAxY00wIDE4SjAgMXNUWDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY04wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzEwIDExQTAgMXFNMCA1UU0wIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDB8NDFlNFwiLFxuXHRcdFwiRXVyb3BlL1RpcmFuZXxMTVQgQ0VUIENFU1R8LTFqLmsgLTEwIC0yMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMXwtMmdsQmouayAxNHBjai5rIDVMQzAgV00wIDRNMCAxZkNLMCAxMG4wIDFvcDAgMTF6MCAxcGQwIDExejAgMXFOMCBXTDAgMXFwMCBYYjAgMXFwMCBYYjAgMXFwMCAxMXowIDFsQjAgMTF6MCAxcU4wIDExejAgMWlOMCAxNm4wIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDB8NDJlNFwiLFxuXHRcdFwiRXVyb3BlL1VseWFub3Zza3xMTVQgKzAzICswNCArMDUgKzAyfC0zZC5BIC0zMCAtNDAgLTUwIC0yMHwwMTIzMjMyMzIzMjMyMzIzMjMyMTIxNDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMnwtMjJXTmQuQSBxSGFkLkEgMjNDTDAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMnBCMCAxY00wIDFmQTAgMnBCMCBJTTAgclgwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCA4SHowIDNyZDBcIixcblx0XHRcIkV1cm9wZS9Vemhnb3JvZHxDRVQgQ0VTVCBNU0sgTVNEIEVFVCBFRVNUfC0xMCAtMjAgLTMwIC00MCAtMjAgLTMwfDAxMDEwMTAyMzIzMjMyMzIzMjMyMzIzMjMyMDQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NHwtMWNxTDAgNmkwMCBXTTAgMWZBMCAxY00wIDFtbDAgMUNwMCAxcjNXMCAxZGIwIDFjTjAgMWRiMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMVEwMCAxTmYwIDJwdzAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjUTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDExZTRcIixcblx0XHRcIkV1cm9wZS9WaWVubmF8Q0VUIENFU1R8LTEwIC0yMHwwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwfC0yYUZlMCAxMWQwIDFpTzAgMTFBMCAxbzAwIDExQTAgM0tNMCAxNG8wIExBMDAgNmkwMCBXTTAgMWZBMCAxY00wIDFjTTAgMWNNMCA0MDAgMnFNMCAxYTAwIDFjTTAgMWNNMCAxaW8wIDE3YzAgMWdIYTAgMTlYMCAxY1AwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDE4ZTVcIixcblx0XHRcIkV1cm9wZS9WaWxuaXVzfFdNVCBLTVQgQ0VUIEVFVCBNU0sgQ0VTVCBNU0QgRUVTVHwtMW8gLTF6LkEgLTEwIC0yMCAtMzAgLTIwIC00MCAtMzB8MDEyMzI0NTI1MjU0NjQ2NDY0NjQ2NDY0NjQ2NDczNzM3MzczNzM3MzczNzM3MzUyNTM3MzczNzM3MzczNzM3MzczNzM3MzczNzM3MzczNzM3MzczNzM3MzczNzM3MzczNzM3MzczNzM3MzczNzM3MzczNzM3MzczfC0yOTNkbyA2SUxNLm8gMU9vei5BIHp6MCBNZmQwIDI5VzAgM2lzMCBXTTAgMWZBMCAxY00wIExWMCAxdGdMMCAxZGIwIDFjTjAgMWRiMCAxY04wIDFkYjAgMWRkMCAxY08wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTjAgMWNNMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxbzAwIDExQTAgMW8wMCAxMUIwIDFvMDAgMTFBMCAxcU0wIDhpbzAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDU0ZTRcIixcblx0XHRcIkV1cm9wZS9Wb2xnb2dyYWR8TE1UIFRTQVQgU1RBVCBTVEFUIFZPTFQgVk9MU1QgVk9MU1QgVk9MVCBNU0QgTVNLIE1TS3wtMlYuRSAtMzAgLTMwIC00MCAtNDAgLTUwIC00MCAtMzAgLTQwIC0zMCAtNDB8MDEyMzQ1NDU0NTQ1NDU0NTQ1NDY3Njc2NzQ4OTg5ODk4OTg5ODk4OTg5ODk4OTg5ODk4OTg5ODk4OTg5ODk4OWE5fC0yMUlxVi5FIGNMWFYuRSBjRU0wIDFncW4wIExjbzAgMWRiMCAxY04wIDFkYjAgMWNOMCAxZGIwIDFkZDAgMWNPMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTjAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDJwejAgMWNOMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDhIejB8MTBlNVwiLFxuXHRcdFwiRXVyb3BlL1dhcnNhd3xXTVQgQ0VUIENFU1QgRUVUIEVFU1R8LTFvIC0xMCAtMjAgLTIwIC0zMHwwMTIxMjEyMzQzMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTJjdGRvIDFMWG8gMTFkMCAxaU8wIDExQTAgMW8wMCAxMUEwIDFvbjAgMTFBMCA2enkwIEhXUDAgNUlNMCBXTTAgMWZBMCAxY00wIDFkejAgMW1MMCAxZW4wIDE1QjAgMWFxMCAxbkEwIDExQTAgMWlvMCAxN2MwIDFmQTAgMWEwMCBpRFgwIExBMCAxY00wIDFjTTAgMUMwMCBPbzAgMWNNMCAxY00wIDF6YzAgT28wIDF6YzAgT28wIDF6YzAgT28wIDFDMDAgTEEwIHVzbzAgMWEwMCAxZkEwIDFjTTAgMWNNMCAxY00wIDFmQTAgMWEwMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNOMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDE3ZTVcIixcblx0XHRcIkV1cm9wZS9aYXBvcm96aHllfENVVCBFRVQgTVNLIENFU1QgQ0VUIE1TRCBFRVNUfC0yayAtMjAgLTMwIC0yMCAtMTAgLTQwIC0zMHwwMTIzNDM0MjUyNTI1MjUyNTI1MjUyNTI1MjUyNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MTYxNjE2MXwtMVBjMmsgZVVvayByZGIwIDJSRTAgV00wIDFmQTAgOG0wIDF2OWEwIDFkYjAgMWNOMCAxZGIwIDFjTjAgMWRiMCAxZGQwIDFjTzAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMWNNMCAxY0swIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjUTAgMWNNMCAxZkEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwfDc3ZTRcIixcblx0XHRcIkhTVHxIU1R8YTB8MHxcIixcblx0XHRcIkluZGlhbi9DaGFnb3N8TE1UIElPVCBJT1R8LTROLkUgLTUwIC02MHwwMTJ8LTJ4b3NOLkUgM0FHTE4uRXwzMGUyXCIsXG5cdFx0XCJJbmRpYW4vQ2hyaXN0bWFzfENYVHwtNzB8MHx8MjFlMlwiLFxuXHRcdFwiSW5kaWFuL0NvY29zfENDVHwtNnV8MHx8NTk2XCIsXG5cdFx0XCJJbmRpYW4vS2VyZ3VlbGVufHp6eiBURlR8MCAtNTB8MDF8LU1HMDB8MTMwXCIsXG5cdFx0XCJJbmRpYW4vTWFoZXxMTVQgU0NUfC0zRi5NIC00MHwwMXwtMnlPM0YuTXw3OWUzXCIsXG5cdFx0XCJJbmRpYW4vTWFsZGl2ZXN8TU1UIE1WVHwtNFMgLTUwfDAxfC1vbGdTfDM1ZTRcIixcblx0XHRcIkluZGlhbi9NYXVyaXRpdXN8TE1UIE1VVCBNVVNUfC0zTyAtNDAgLTUwfDAxMjEyMXwtMnhvck8gMzR1bk8gMTRMMCAxMmtyMCAxMXowfDE1ZTRcIixcblx0XHRcIkluZGlhbi9SZXVuaW9ufExNVCBSRVR8LTNGLlEgLTQwfDAxfC0ybURERi5RfDg0ZTRcIixcblx0XHRcIlBhY2lmaWMvS3dhamFsZWlufE1IVCBLV0FUIE1IVHwtYjAgYzAgLWMwfDAxMnwtQVgwIFc5WDB8MTRlM1wiLFxuXHRcdFwiTUVUfE1FVCBNRVNUfC0xMCAtMjB8MDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTB8LTJhRmUwIDExZDAgMWlPMCAxMUEwIDFvMDAgMTFBMCBRcmMwIDZpMDAgV00wIDFmQTAgMWNNMCAxY00wIDFjTTAgMTZNMCAxZ01NMCAxYTAwIDFmQTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxYTAwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDBcIixcblx0XHRcIk1TVHxNU1R8NzB8MHxcIixcblx0XHRcIk1TVDdNRFR8TVNUIE1EVCBNV1QgTVBUfDcwIDYwIDYwIDYwfDAxMDEwMjMwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMHwtMjYxcjAgMW5YMCAxMUIwIDFuWDAgU2dOMCA4eDIwIGl4MCBRd04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgczEwIDFWejAgTEIwIDFCWDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxZnowIDFhMTAgMWZ6MCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIFJkMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwIE9wMCAxemIwXCIsXG5cdFx0XCJQYWNpZmljL0NoYXRoYW18Q0hBU1QgQ0hBU1QgQ0hBRFR8LWNmIC1jSiAtZEp8MDEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyfC1XcUFmIDFhZGVmIElNMCAxQzAwIFJjMCAxemMwIE9vMCAxemMwIE9vMCAxemMwIE9vMCAxemMwIE9vMCAxemMwIE9vMCAxemMwIFJjMCAxemMwIE9vMCAxemMwIE9vMCAxemMwIE9vMCAxemMwIE9vMCAxemMwIE9vMCAxemMwIFJjMCAxemMwIE9vMCAxcU0wIDE0bzAgMWxjMCAxNG8wIDFsYzAgMTRvMCAxbGMwIDE3YzAgMWlvMCAxN2MwIDFpbzAgMTdjMCAxaW8wIDE3YzAgMWxjMCAxNG8wIDFsYzAgMTRvMCAxbGMwIDE3YzAgMWlvMCAxN2MwIDFpbzAgMTdjMCAxbGMwIDE0bzAgMWxjMCAxNG8wIDFsYzAgMTdjMCAxaW8wIDE3YzAgMWlvMCAxN2MwIDFpbzAgMTdjMCAxaW8wIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFjTTAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFjTTAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxaW8wIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWNNMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWNNMCAxZkEwIDFhMDAgMWZBMCAxYTAwfDYwMFwiLFxuXHRcdFwiUFNUOFBEVHxQU1QgUERUIFBXVCBQUFR8ODAgNzAgNzAgNzB8MDEwMTAyMzAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwfC0yNjFxMCAxblgwIDExQjAgMW5YMCBTZ04wIDh4MTAgaXkwIFF3TjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWNOMCAxY0wwIDFjTjAgMWNMMCBzMTAgMVZ6MCBMQjAgMUJYMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFmejAgMWExMCAxZnowIDFjTjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDE0cDAgMWxiMCAxNHAwIDFuWDAgMTFCMCAxblgwIDExQjAgMW5YMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxbGIwIDE0cDAgMW5YMCAxMUIwIDFuWDAgMTFCMCAxblgwIDE0cDAgMWxiMCAxNHAwIDFsYjAgMTRwMCAxblgwIDExQjAgMW5YMCAxMUIwIDFuWDAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgUmQwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjAgT3AwIDF6YjBcIixcblx0XHRcIlBhY2lmaWMvQXBpYXxMTVQgV1NTVCBTU1QgU0RUIFdTRFQgV1NTVHxicS5VIGJ1IGIwIGEwIC1lMCAtZDB8MDEyMzIzNDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTQ1NDU0NTR8LTJuRE14LjQgMXlXMDMuNCAyclJidSAxZmYwIDFhMDAgQ0kwIEFRMCAxY00wIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxY00wIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWlvMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFjTTAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFhMDAgMWZBMCAxYTAwIDFmQTAgMWEwMCAxZkEwIDFjTTAgMWZBMCAxYTAwIDFmQTAgMWEwMHwzN2UzXCIsXG5cdFx0XCJQYWNpZmljL0JvdWdhaW52aWxsZXxQR1QgSlNUIEJTVHwtYTAgLTkwIC1iMHwwMTAyfC0xNld5MCA3Q04wIDJNUXAwfDE4ZTRcIixcblx0XHRcIlBhY2lmaWMvQ2h1dWt8Q0hVVHwtYTB8MHx8NDllM1wiLFxuXHRcdFwiUGFjaWZpYy9FZmF0ZXxMTVQgVlVUIFZVU1R8LWJkLmcgLWIwIC1jMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxfC0ybDluZC5nIDJTemNkLmcgMWNMMCAxb04wIDEwTDAgMWZCMCAxOVgwIDFmQjAgMWNMMCAxY04wIDFjTDAgMWNOMCAxY0wwIDFjTjAgMWNMMCAxY04wIDFjTDAgMWZCMCBMejAgMU5kMCBBbjB8NjZlM1wiLFxuXHRcdFwiUGFjaWZpYy9FbmRlcmJ1cnl8UEhPVCBQSE9UIFBIT1R8YzAgYjAgLWQwfDAxMnxuSWMwIEI4bjB8MVwiLFxuXHRcdFwiUGFjaWZpYy9GYWthb2ZvfFRLVCBUS1R8YjAgLWQwfDAxfDFHZm4wfDQ4M1wiLFxuXHRcdFwiUGFjaWZpYy9GaWppfExNVCBGSlQgRkpTVHwtYlQuSSAtYzAgLWQwfDAxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjF8LTJiVXpULkkgM204TlQuSSBMQTAgMUVNMCBJTTAgbkpjMCBMQTAgMW8wMCBSYzAgMXdvMCBBbzAgMU5jMCBBbzAgMVEwMCB4ejAgMVNOMCB1TTAgMVNNMCB1TTAgMVZBMCBzMDAgMVZBMCB1TTAgMVNNMCB1TTAgMVNNMCB1TTAgMVNNMCB1TTAgMVZBMCBzMDAgMVZBMCBzMDAgMVZBMCB1TTAgMVNNMCB1TTAgMVNNMCB1TTAgMVNNMCB1TTAgMVZBMCBzMDAgMVZBMCB1TTAgMVNNMCB1TTAgMVNNMCB1TTAgMVNNMCB1TTAgMVZBMCBzMDAgMVZBMCBzMDAgMVZBMCB1TTAgMVNNMCB1TTAgMVNNMCB1TTAgMVNNMCB1TTB8ODhlNFwiLFxuXHRcdFwiUGFjaWZpYy9GdW5hZnV0aXxUVlR8LWMwfDB8fDQ1ZTJcIixcblx0XHRcIlBhY2lmaWMvR2FsYXBhZ29zfExNVCBFQ1QgR0FMVHw1Vy5vIDUwIDYwfDAxMnwtMXlWUzEuQSAyZFR6MS5BfDI1ZTNcIixcblx0XHRcIlBhY2lmaWMvR2FtYmllcnxMTVQgR0FNVHw4WC5NIDkwfDAxfC0yam9mMC5jfDEyNVwiLFxuXHRcdFwiUGFjaWZpYy9HdWFkYWxjYW5hbHxMTVQgU0JUfC1hRC5NIC1iMHwwMXwtMmpveUQuTXwxMWU0XCIsXG5cdFx0XCJQYWNpZmljL0d1YW18R1NUIENoU1R8LWEwIC1hMHwwMXwxZnBxMHwxN2U0XCIsXG5cdFx0XCJQYWNpZmljL0hvbm9sdWx1fEhTVCBIRFQgSFNUfGF1IDl1IGEwfDAxMDEwMnwtMXRoTHUgOHgwIGxlZjAgOFB6MCA0NnAwfDM3ZTRcIixcblx0XHRcIlBhY2lmaWMvS2lyaXRpbWF0aXxMSU5UIExJTlQgTElOVHxhRSBhMCAtZTB8MDEyfG5JYUUgQjhua3w1MWUyXCIsXG5cdFx0XCJQYWNpZmljL0tvc3JhZXxLT1NUIEtPU1R8LWIwIC1jMHwwMTB8LUFYMCAxYmR6MHw2NmUyXCIsXG5cdFx0XCJQYWNpZmljL01hanVyb3xNSFQgTUhUfC1iMCAtYzB8MDF8LUFYMHwyOGUzXCIsXG5cdFx0XCJQYWNpZmljL01hcnF1ZXNhc3xMTVQgTUFSVHw5aSA5dXwwMXwtMmpvZUd8ODZlMlwiLFxuXHRcdFwiUGFjaWZpYy9QYWdvX1BhZ298TE1UIE5TVCBCU1QgU1NUfGJtLk0gYjAgYjAgYjB8MDEyM3wtMm5ETUIuYyAyZ1Z6Qi5jIEV5TTB8MzdlMlwiLFxuXHRcdFwiUGFjaWZpYy9OYXVydXxMTVQgTlJUIEpTVCBOUlR8LWI3LkUgLWJ1IC05MCAtYzB8MDEyMTN8LTFYZG43LkUgUHZ6Qi5FIDVSQ3UgMW91SnV8MTBlM1wiLFxuXHRcdFwiUGFjaWZpYy9OaXVlfE5VVCBOVVQgTlVUfGJrIGJ1IGIwfDAxMnwtS2ZNRSAxN3kwYXwxMmUyXCIsXG5cdFx0XCJQYWNpZmljL05vcmZvbGt8Tk1UIE5GVCBORlNUIE5GVHwtYmMgLWJ1IC1jdSAtYjB8MDEyMTN8LUtnYmMgVzAxRyBPbjAgMUNPcDB8MjVlNFwiLFxuXHRcdFwiUGFjaWZpYy9Ob3VtZWF8TE1UIE5DVCBOQ1NUfC1iNS5NIC1iMCAtYzB8MDEyMTIxMjF8LTJsOW41Lk0gMkVxTTUuTSB4WDAgMVBCMCB5bjAgSGVQMCBBbzB8OThlM1wiLFxuXHRcdFwiUGFjaWZpYy9QYWxhdXxQV1R8LTkwfDB8fDIxZTNcIixcblx0XHRcIlBhY2lmaWMvUGl0Y2Fpcm58UE5UIFBTVHw4dSA4MHwwMXwxOFZrdXw1NlwiLFxuXHRcdFwiUGFjaWZpYy9Qb2hucGVpfFBPTlR8LWIwfDB8fDM0ZTNcIixcblx0XHRcIlBhY2lmaWMvUG9ydF9Nb3Jlc2J5fFBHVHwtYTB8MHx8MjVlNFwiLFxuXHRcdFwiUGFjaWZpYy9SYXJvdG9uZ2F8Q0tUIENLSFNUIENLVHxhdSA5dSBhMHwwMTIxMjEyMTIxMjEyMTIxMjEyMTIxMjEyMTJ8bHlXdSBJTDAgMXpjdSBPbnUgMXpjdSBPbnUgMXpjdSBSYnUgMXpjdSBPbnUgMXpjdSBPbnUgMXpjdSBPbnUgMXpjdSBPbnUgMXpjdSBPbnUgMXpjdSBSYnUgMXpjdSBPbnUgMXpjdSBPbnUgMXpjdSBPbnV8MTNlM1wiLFxuXHRcdFwiUGFjaWZpYy9UYWhpdGl8TE1UIFRBSFR8OVcuZyBhMHwwMXwtMmpvZTEuSXwxOGU0XCIsXG5cdFx0XCJQYWNpZmljL1RhcmF3YXxHSUxUfC1jMHwwfHwyOWUzXCIsXG5cdFx0XCJQYWNpZmljL1RvbmdhdGFwdXxUT1QgVE9UIFRPU1R8LWNrIC1kMCAtZTB8MDEyMTIxMjF8LTFhQjBrIDJuNWRrIDE1QTAgMXdvMCB4ejAgMVExMCB4ejB8NzVlM1wiLFxuXHRcdFwiUGFjaWZpYy9XYWtlfFdBS1R8LWMwfDB8fDE2ZTNcIixcblx0XHRcIlBhY2lmaWMvV2FsbGlzfFdGVHwtYzB8MHx8OTRcIixcblx0XHRcIldFVHxXRVQgV0VTVHwwIC0xMHwwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTB8aERCMCAxYTAwIDFmQTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxYTAwIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWZBMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFjTTAgMWNNMCAxY00wIDFmQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMXFNMCBXTTAgMXFNMCBXTTAgMXFNMCAxMUEwIDFvMDAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFxTTAgV00wIDFxTTAgV00wIDFxTTAgMTFBMCAxbzAwIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDAgMTFBMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIFdNMCAxcU0wIDExQTAgMW8wMCAxMUEwIDFvMDBcIlxuXHRdLFxuXHRcImxpbmtzXCI6IFtcblx0XHRcIkFmcmljYS9BYmlkamFufEFmcmljYS9CYW1ha29cIixcblx0XHRcIkFmcmljYS9BYmlkamFufEFmcmljYS9CYW5qdWxcIixcblx0XHRcIkFmcmljYS9BYmlkamFufEFmcmljYS9Db25ha3J5XCIsXG5cdFx0XCJBZnJpY2EvQWJpZGphbnxBZnJpY2EvRGFrYXJcIixcblx0XHRcIkFmcmljYS9BYmlkamFufEFmcmljYS9GcmVldG93blwiLFxuXHRcdFwiQWZyaWNhL0FiaWRqYW58QWZyaWNhL0xvbWVcIixcblx0XHRcIkFmcmljYS9BYmlkamFufEFmcmljYS9Ob3Vha2Nob3R0XCIsXG5cdFx0XCJBZnJpY2EvQWJpZGphbnxBZnJpY2EvT3VhZ2Fkb3Vnb3VcIixcblx0XHRcIkFmcmljYS9BYmlkamFufEFmcmljYS9TYW9fVG9tZVwiLFxuXHRcdFwiQWZyaWNhL0FiaWRqYW58QWZyaWNhL1RpbWJ1a3R1XCIsXG5cdFx0XCJBZnJpY2EvQWJpZGphbnxBdGxhbnRpYy9TdF9IZWxlbmFcIixcblx0XHRcIkFmcmljYS9DYWlyb3xFZ3lwdFwiLFxuXHRcdFwiQWZyaWNhL0pvaGFubmVzYnVyZ3xBZnJpY2EvTWFzZXJ1XCIsXG5cdFx0XCJBZnJpY2EvSm9oYW5uZXNidXJnfEFmcmljYS9NYmFiYW5lXCIsXG5cdFx0XCJBZnJpY2EvS2hhcnRvdW18QWZyaWNhL0p1YmFcIixcblx0XHRcIkFmcmljYS9MYWdvc3xBZnJpY2EvQmFuZ3VpXCIsXG5cdFx0XCJBZnJpY2EvTGFnb3N8QWZyaWNhL0JyYXp6YXZpbGxlXCIsXG5cdFx0XCJBZnJpY2EvTGFnb3N8QWZyaWNhL0RvdWFsYVwiLFxuXHRcdFwiQWZyaWNhL0xhZ29zfEFmcmljYS9LaW5zaGFzYVwiLFxuXHRcdFwiQWZyaWNhL0xhZ29zfEFmcmljYS9MaWJyZXZpbGxlXCIsXG5cdFx0XCJBZnJpY2EvTGFnb3N8QWZyaWNhL0x1YW5kYVwiLFxuXHRcdFwiQWZyaWNhL0xhZ29zfEFmcmljYS9NYWxhYm9cIixcblx0XHRcIkFmcmljYS9MYWdvc3xBZnJpY2EvTmlhbWV5XCIsXG5cdFx0XCJBZnJpY2EvTGFnb3N8QWZyaWNhL1BvcnRvLU5vdm9cIixcblx0XHRcIkFmcmljYS9NYXB1dG98QWZyaWNhL0JsYW50eXJlXCIsXG5cdFx0XCJBZnJpY2EvTWFwdXRvfEFmcmljYS9CdWp1bWJ1cmFcIixcblx0XHRcIkFmcmljYS9NYXB1dG98QWZyaWNhL0dhYm9yb25lXCIsXG5cdFx0XCJBZnJpY2EvTWFwdXRvfEFmcmljYS9IYXJhcmVcIixcblx0XHRcIkFmcmljYS9NYXB1dG98QWZyaWNhL0tpZ2FsaVwiLFxuXHRcdFwiQWZyaWNhL01hcHV0b3xBZnJpY2EvTHVidW1iYXNoaVwiLFxuXHRcdFwiQWZyaWNhL01hcHV0b3xBZnJpY2EvTHVzYWthXCIsXG5cdFx0XCJBZnJpY2EvTmFpcm9iaXxBZnJpY2EvQWRkaXNfQWJhYmFcIixcblx0XHRcIkFmcmljYS9OYWlyb2JpfEFmcmljYS9Bc21hcmFcIixcblx0XHRcIkFmcmljYS9OYWlyb2JpfEFmcmljYS9Bc21lcmFcIixcblx0XHRcIkFmcmljYS9OYWlyb2JpfEFmcmljYS9EYXJfZXNfU2FsYWFtXCIsXG5cdFx0XCJBZnJpY2EvTmFpcm9iaXxBZnJpY2EvRGppYm91dGlcIixcblx0XHRcIkFmcmljYS9OYWlyb2JpfEFmcmljYS9LYW1wYWxhXCIsXG5cdFx0XCJBZnJpY2EvTmFpcm9iaXxBZnJpY2EvTW9nYWRpc2h1XCIsXG5cdFx0XCJBZnJpY2EvTmFpcm9iaXxJbmRpYW4vQW50YW5hbmFyaXZvXCIsXG5cdFx0XCJBZnJpY2EvTmFpcm9iaXxJbmRpYW4vQ29tb3JvXCIsXG5cdFx0XCJBZnJpY2EvTmFpcm9iaXxJbmRpYW4vTWF5b3R0ZVwiLFxuXHRcdFwiQWZyaWNhL1RyaXBvbGl8TGlieWFcIixcblx0XHRcIkFtZXJpY2EvQWRha3xBbWVyaWNhL0F0a2FcIixcblx0XHRcIkFtZXJpY2EvQWRha3xVUy9BbGV1dGlhblwiLFxuXHRcdFwiQW1lcmljYS9BbmNob3JhZ2V8VVMvQWxhc2thXCIsXG5cdFx0XCJBbWVyaWNhL0FyZ2VudGluYS9CdWVub3NfQWlyZXN8QW1lcmljYS9CdWVub3NfQWlyZXNcIixcblx0XHRcIkFtZXJpY2EvQXJnZW50aW5hL0NhdGFtYXJjYXxBbWVyaWNhL0FyZ2VudGluYS9Db21vZFJpdmFkYXZpYVwiLFxuXHRcdFwiQW1lcmljYS9BcmdlbnRpbmEvQ2F0YW1hcmNhfEFtZXJpY2EvQ2F0YW1hcmNhXCIsXG5cdFx0XCJBbWVyaWNhL0FyZ2VudGluYS9Db3Jkb2JhfEFtZXJpY2EvQ29yZG9iYVwiLFxuXHRcdFwiQW1lcmljYS9BcmdlbnRpbmEvQ29yZG9iYXxBbWVyaWNhL1Jvc2FyaW9cIixcblx0XHRcIkFtZXJpY2EvQXJnZW50aW5hL0p1anV5fEFtZXJpY2EvSnVqdXlcIixcblx0XHRcIkFtZXJpY2EvQXJnZW50aW5hL01lbmRvemF8QW1lcmljYS9NZW5kb3phXCIsXG5cdFx0XCJBbWVyaWNhL0F0aWtva2FufEFtZXJpY2EvQ29yYWxfSGFyYm91clwiLFxuXHRcdFwiQW1lcmljYS9DaGljYWdvfFVTL0NlbnRyYWxcIixcblx0XHRcIkFtZXJpY2EvQ3VyYWNhb3xBbWVyaWNhL0FydWJhXCIsXG5cdFx0XCJBbWVyaWNhL0N1cmFjYW98QW1lcmljYS9LcmFsZW5kaWprXCIsXG5cdFx0XCJBbWVyaWNhL0N1cmFjYW98QW1lcmljYS9Mb3dlcl9QcmluY2VzXCIsXG5cdFx0XCJBbWVyaWNhL0RlbnZlcnxBbWVyaWNhL1NoaXByb2NrXCIsXG5cdFx0XCJBbWVyaWNhL0RlbnZlcnxOYXZham9cIixcblx0XHRcIkFtZXJpY2EvRGVudmVyfFVTL01vdW50YWluXCIsXG5cdFx0XCJBbWVyaWNhL0RldHJvaXR8VVMvTWljaGlnYW5cIixcblx0XHRcIkFtZXJpY2EvRWRtb250b258Q2FuYWRhL01vdW50YWluXCIsXG5cdFx0XCJBbWVyaWNhL0ZvcnRfV2F5bmV8QW1lcmljYS9JbmRpYW5hL0luZGlhbmFwb2xpc1wiLFxuXHRcdFwiQW1lcmljYS9Gb3J0X1dheW5lfEFtZXJpY2EvSW5kaWFuYXBvbGlzXCIsXG5cdFx0XCJBbWVyaWNhL0ZvcnRfV2F5bmV8VVMvRWFzdC1JbmRpYW5hXCIsXG5cdFx0XCJBbWVyaWNhL0hhbGlmYXh8Q2FuYWRhL0F0bGFudGljXCIsXG5cdFx0XCJBbWVyaWNhL0hhdmFuYXxDdWJhXCIsXG5cdFx0XCJBbWVyaWNhL0luZGlhbmEvS25veHxBbWVyaWNhL0tub3hfSU5cIixcblx0XHRcIkFtZXJpY2EvSW5kaWFuYS9Lbm94fFVTL0luZGlhbmEtU3RhcmtlXCIsXG5cdFx0XCJBbWVyaWNhL0phbWFpY2F8SmFtYWljYVwiLFxuXHRcdFwiQW1lcmljYS9LZW50dWNreS9Mb3Vpc3ZpbGxlfEFtZXJpY2EvTG91aXN2aWxsZVwiLFxuXHRcdFwiQW1lcmljYS9Mb3NfQW5nZWxlc3xVUy9QYWNpZmljXCIsXG5cdFx0XCJBbWVyaWNhL0xvc19BbmdlbGVzfFVTL1BhY2lmaWMtTmV3XCIsXG5cdFx0XCJBbWVyaWNhL01hbmF1c3xCcmF6aWwvV2VzdFwiLFxuXHRcdFwiQW1lcmljYS9NYXphdGxhbnxNZXhpY28vQmFqYVN1clwiLFxuXHRcdFwiQW1lcmljYS9NZXhpY29fQ2l0eXxNZXhpY28vR2VuZXJhbFwiLFxuXHRcdFwiQW1lcmljYS9OZXdfWW9ya3xVUy9FYXN0ZXJuXCIsXG5cdFx0XCJBbWVyaWNhL05vcm9uaGF8QnJhemlsL0RlTm9yb25oYVwiLFxuXHRcdFwiQW1lcmljYS9QYW5hbWF8QW1lcmljYS9DYXltYW5cIixcblx0XHRcIkFtZXJpY2EvUGhvZW5peHxVUy9Bcml6b25hXCIsXG5cdFx0XCJBbWVyaWNhL1BvcnRfb2ZfU3BhaW58QW1lcmljYS9Bbmd1aWxsYVwiLFxuXHRcdFwiQW1lcmljYS9Qb3J0X29mX1NwYWlufEFtZXJpY2EvQW50aWd1YVwiLFxuXHRcdFwiQW1lcmljYS9Qb3J0X29mX1NwYWlufEFtZXJpY2EvRG9taW5pY2FcIixcblx0XHRcIkFtZXJpY2EvUG9ydF9vZl9TcGFpbnxBbWVyaWNhL0dyZW5hZGFcIixcblx0XHRcIkFtZXJpY2EvUG9ydF9vZl9TcGFpbnxBbWVyaWNhL0d1YWRlbG91cGVcIixcblx0XHRcIkFtZXJpY2EvUG9ydF9vZl9TcGFpbnxBbWVyaWNhL01hcmlnb3RcIixcblx0XHRcIkFtZXJpY2EvUG9ydF9vZl9TcGFpbnxBbWVyaWNhL01vbnRzZXJyYXRcIixcblx0XHRcIkFtZXJpY2EvUG9ydF9vZl9TcGFpbnxBbWVyaWNhL1N0X0JhcnRoZWxlbXlcIixcblx0XHRcIkFtZXJpY2EvUG9ydF9vZl9TcGFpbnxBbWVyaWNhL1N0X0tpdHRzXCIsXG5cdFx0XCJBbWVyaWNhL1BvcnRfb2ZfU3BhaW58QW1lcmljYS9TdF9MdWNpYVwiLFxuXHRcdFwiQW1lcmljYS9Qb3J0X29mX1NwYWlufEFtZXJpY2EvU3RfVGhvbWFzXCIsXG5cdFx0XCJBbWVyaWNhL1BvcnRfb2ZfU3BhaW58QW1lcmljYS9TdF9WaW5jZW50XCIsXG5cdFx0XCJBbWVyaWNhL1BvcnRfb2ZfU3BhaW58QW1lcmljYS9Ub3J0b2xhXCIsXG5cdFx0XCJBbWVyaWNhL1BvcnRfb2ZfU3BhaW58QW1lcmljYS9WaXJnaW5cIixcblx0XHRcIkFtZXJpY2EvUmVnaW5hfENhbmFkYS9FYXN0LVNhc2thdGNoZXdhblwiLFxuXHRcdFwiQW1lcmljYS9SZWdpbmF8Q2FuYWRhL1Nhc2thdGNoZXdhblwiLFxuXHRcdFwiQW1lcmljYS9SaW9fQnJhbmNvfEFtZXJpY2EvUG9ydG9fQWNyZVwiLFxuXHRcdFwiQW1lcmljYS9SaW9fQnJhbmNvfEJyYXppbC9BY3JlXCIsXG5cdFx0XCJBbWVyaWNhL1NhbnRpYWdvfENoaWxlL0NvbnRpbmVudGFsXCIsXG5cdFx0XCJBbWVyaWNhL1Nhb19QYXVsb3xCcmF6aWwvRWFzdFwiLFxuXHRcdFwiQW1lcmljYS9TdF9Kb2huc3xDYW5hZGEvTmV3Zm91bmRsYW5kXCIsXG5cdFx0XCJBbWVyaWNhL1RpanVhbmF8QW1lcmljYS9FbnNlbmFkYVwiLFxuXHRcdFwiQW1lcmljYS9UaWp1YW5hfEFtZXJpY2EvU2FudGFfSXNhYmVsXCIsXG5cdFx0XCJBbWVyaWNhL1RpanVhbmF8TWV4aWNvL0JhamFOb3J0ZVwiLFxuXHRcdFwiQW1lcmljYS9Ub3JvbnRvfEFtZXJpY2EvTW9udHJlYWxcIixcblx0XHRcIkFtZXJpY2EvVG9yb250b3xDYW5hZGEvRWFzdGVyblwiLFxuXHRcdFwiQW1lcmljYS9WYW5jb3V2ZXJ8Q2FuYWRhL1BhY2lmaWNcIixcblx0XHRcIkFtZXJpY2EvV2hpdGVob3JzZXxDYW5hZGEvWXVrb25cIixcblx0XHRcIkFtZXJpY2EvV2lubmlwZWd8Q2FuYWRhL0NlbnRyYWxcIixcblx0XHRcIkFzaWEvQXNoZ2FiYXR8QXNpYS9Bc2hraGFiYWRcIixcblx0XHRcIkFzaWEvQmFuZ2tva3xBc2lhL1Bobm9tX1BlbmhcIixcblx0XHRcIkFzaWEvQmFuZ2tva3xBc2lhL1ZpZW50aWFuZVwiLFxuXHRcdFwiQXNpYS9EaGFrYXxBc2lhL0RhY2NhXCIsXG5cdFx0XCJBc2lhL0R1YmFpfEFzaWEvTXVzY2F0XCIsXG5cdFx0XCJBc2lhL0hvX0NoaV9NaW5ofEFzaWEvU2FpZ29uXCIsXG5cdFx0XCJBc2lhL0hvbmdfS29uZ3xIb25na29uZ1wiLFxuXHRcdFwiQXNpYS9KZXJ1c2FsZW18QXNpYS9UZWxfQXZpdlwiLFxuXHRcdFwiQXNpYS9KZXJ1c2FsZW18SXNyYWVsXCIsXG5cdFx0XCJBc2lhL0thdGhtYW5kdXxBc2lhL0thdG1hbmR1XCIsXG5cdFx0XCJBc2lhL0tvbGthdGF8QXNpYS9DYWxjdXR0YVwiLFxuXHRcdFwiQXNpYS9NYWNhdXxBc2lhL01hY2FvXCIsXG5cdFx0XCJBc2lhL01ha2Fzc2FyfEFzaWEvVWp1bmdfUGFuZGFuZ1wiLFxuXHRcdFwiQXNpYS9OaWNvc2lhfEV1cm9wZS9OaWNvc2lhXCIsXG5cdFx0XCJBc2lhL1FhdGFyfEFzaWEvQmFocmFpblwiLFxuXHRcdFwiQXNpYS9SaXlhZGh8QXNpYS9BZGVuXCIsXG5cdFx0XCJBc2lhL1JpeWFkaHxBc2lhL0t1d2FpdFwiLFxuXHRcdFwiQXNpYS9TZW91bHxST0tcIixcblx0XHRcIkFzaWEvU2hhbmdoYWl8QXNpYS9DaG9uZ3FpbmdcIixcblx0XHRcIkFzaWEvU2hhbmdoYWl8QXNpYS9DaHVuZ2tpbmdcIixcblx0XHRcIkFzaWEvU2hhbmdoYWl8QXNpYS9IYXJiaW5cIixcblx0XHRcIkFzaWEvU2hhbmdoYWl8UFJDXCIsXG5cdFx0XCJBc2lhL1NpbmdhcG9yZXxTaW5nYXBvcmVcIixcblx0XHRcIkFzaWEvVGFpcGVpfFJPQ1wiLFxuXHRcdFwiQXNpYS9UZWhyYW58SXJhblwiLFxuXHRcdFwiQXNpYS9UaGltcGh1fEFzaWEvVGhpbWJ1XCIsXG5cdFx0XCJBc2lhL1Rva3lvfEphcGFuXCIsXG5cdFx0XCJBc2lhL1VsYWFuYmFhdGFyfEFzaWEvVWxhbl9CYXRvclwiLFxuXHRcdFwiQXNpYS9VcnVtcWl8QXNpYS9LYXNoZ2FyXCIsXG5cdFx0XCJBdGxhbnRpYy9GYXJvZXxBdGxhbnRpYy9GYWVyb2VcIixcblx0XHRcIkF0bGFudGljL1JleWtqYXZpa3xJY2VsYW5kXCIsXG5cdFx0XCJBdXN0cmFsaWEvQWRlbGFpZGV8QXVzdHJhbGlhL1NvdXRoXCIsXG5cdFx0XCJBdXN0cmFsaWEvQnJpc2JhbmV8QXVzdHJhbGlhL1F1ZWVuc2xhbmRcIixcblx0XHRcIkF1c3RyYWxpYS9Ccm9rZW5fSGlsbHxBdXN0cmFsaWEvWWFuY293aW5uYVwiLFxuXHRcdFwiQXVzdHJhbGlhL0RhcndpbnxBdXN0cmFsaWEvTm9ydGhcIixcblx0XHRcIkF1c3RyYWxpYS9Ib2JhcnR8QXVzdHJhbGlhL1Rhc21hbmlhXCIsXG5cdFx0XCJBdXN0cmFsaWEvTG9yZF9Ib3dlfEF1c3RyYWxpYS9MSElcIixcblx0XHRcIkF1c3RyYWxpYS9NZWxib3VybmV8QXVzdHJhbGlhL1ZpY3RvcmlhXCIsXG5cdFx0XCJBdXN0cmFsaWEvUGVydGh8QXVzdHJhbGlhL1dlc3RcIixcblx0XHRcIkF1c3RyYWxpYS9TeWRuZXl8QXVzdHJhbGlhL0FDVFwiLFxuXHRcdFwiQXVzdHJhbGlhL1N5ZG5leXxBdXN0cmFsaWEvQ2FuYmVycmFcIixcblx0XHRcIkF1c3RyYWxpYS9TeWRuZXl8QXVzdHJhbGlhL05TV1wiLFxuXHRcdFwiRXRjL0dNVCswfEV0Yy9HTVRcIixcblx0XHRcIkV0Yy9HTVQrMHxFdGMvR01ULTBcIixcblx0XHRcIkV0Yy9HTVQrMHxFdGMvR01UMFwiLFxuXHRcdFwiRXRjL0dNVCswfEV0Yy9HcmVlbndpY2hcIixcblx0XHRcIkV0Yy9HTVQrMHxHTVRcIixcblx0XHRcIkV0Yy9HTVQrMHxHTVQrMFwiLFxuXHRcdFwiRXRjL0dNVCswfEdNVC0wXCIsXG5cdFx0XCJFdGMvR01UKzB8R01UMFwiLFxuXHRcdFwiRXRjL0dNVCswfEdyZWVud2ljaFwiLFxuXHRcdFwiRXRjL1VDVHxVQ1RcIixcblx0XHRcIkV0Yy9VVEN8RXRjL1VuaXZlcnNhbFwiLFxuXHRcdFwiRXRjL1VUQ3xFdGMvWnVsdVwiLFxuXHRcdFwiRXRjL1VUQ3xVVENcIixcblx0XHRcIkV0Yy9VVEN8VW5pdmVyc2FsXCIsXG5cdFx0XCJFdGMvVVRDfFp1bHVcIixcblx0XHRcIkV1cm9wZS9CZWxncmFkZXxFdXJvcGUvTGp1YmxqYW5hXCIsXG5cdFx0XCJFdXJvcGUvQmVsZ3JhZGV8RXVyb3BlL1BvZGdvcmljYVwiLFxuXHRcdFwiRXVyb3BlL0JlbGdyYWRlfEV1cm9wZS9TYXJhamV2b1wiLFxuXHRcdFwiRXVyb3BlL0JlbGdyYWRlfEV1cm9wZS9Ta29wamVcIixcblx0XHRcIkV1cm9wZS9CZWxncmFkZXxFdXJvcGUvWmFncmViXCIsXG5cdFx0XCJFdXJvcGUvQ2hpc2luYXV8RXVyb3BlL1RpcmFzcG9sXCIsXG5cdFx0XCJFdXJvcGUvRHVibGlufEVpcmVcIixcblx0XHRcIkV1cm9wZS9IZWxzaW5raXxFdXJvcGUvTWFyaWVoYW1uXCIsXG5cdFx0XCJFdXJvcGUvSXN0YW5idWx8QXNpYS9Jc3RhbmJ1bFwiLFxuXHRcdFwiRXVyb3BlL0lzdGFuYnVsfFR1cmtleVwiLFxuXHRcdFwiRXVyb3BlL0xpc2JvbnxQb3J0dWdhbFwiLFxuXHRcdFwiRXVyb3BlL0xvbmRvbnxFdXJvcGUvQmVsZmFzdFwiLFxuXHRcdFwiRXVyb3BlL0xvbmRvbnxFdXJvcGUvR3Vlcm5zZXlcIixcblx0XHRcIkV1cm9wZS9Mb25kb258RXVyb3BlL0lzbGVfb2ZfTWFuXCIsXG5cdFx0XCJFdXJvcGUvTG9uZG9ufEV1cm9wZS9KZXJzZXlcIixcblx0XHRcIkV1cm9wZS9Mb25kb258R0JcIixcblx0XHRcIkV1cm9wZS9Mb25kb258R0ItRWlyZVwiLFxuXHRcdFwiRXVyb3BlL01vc2Nvd3xXLVNVXCIsXG5cdFx0XCJFdXJvcGUvT3Nsb3xBcmN0aWMvTG9uZ3llYXJieWVuXCIsXG5cdFx0XCJFdXJvcGUvT3Nsb3xBdGxhbnRpYy9KYW5fTWF5ZW5cIixcblx0XHRcIkV1cm9wZS9QcmFndWV8RXVyb3BlL0JyYXRpc2xhdmFcIixcblx0XHRcIkV1cm9wZS9Sb21lfEV1cm9wZS9TYW5fTWFyaW5vXCIsXG5cdFx0XCJFdXJvcGUvUm9tZXxFdXJvcGUvVmF0aWNhblwiLFxuXHRcdFwiRXVyb3BlL1dhcnNhd3xQb2xhbmRcIixcblx0XHRcIkV1cm9wZS9adXJpY2h8RXVyb3BlL0J1c2luZ2VuXCIsXG5cdFx0XCJFdXJvcGUvWnVyaWNofEV1cm9wZS9WYWR1elwiLFxuXHRcdFwiUGFjaWZpYy9BdWNrbGFuZHxBbnRhcmN0aWNhL01jTXVyZG9cIixcblx0XHRcIlBhY2lmaWMvQXVja2xhbmR8QW50YXJjdGljYS9Tb3V0aF9Qb2xlXCIsXG5cdFx0XCJQYWNpZmljL0F1Y2tsYW5kfE5aXCIsXG5cdFx0XCJQYWNpZmljL0NoYXRoYW18TlotQ0hBVFwiLFxuXHRcdFwiUGFjaWZpYy9DaHV1a3xQYWNpZmljL1RydWtcIixcblx0XHRcIlBhY2lmaWMvQ2h1dWt8UGFjaWZpYy9ZYXBcIixcblx0XHRcIlBhY2lmaWMvRWFzdGVyfENoaWxlL0Vhc3RlcklzbGFuZFwiLFxuXHRcdFwiUGFjaWZpYy9HdWFtfFBhY2lmaWMvU2FpcGFuXCIsXG5cdFx0XCJQYWNpZmljL0hvbm9sdWx1fFBhY2lmaWMvSm9obnN0b25cIixcblx0XHRcIlBhY2lmaWMvSG9ub2x1bHV8VVMvSGF3YWlpXCIsXG5cdFx0XCJQYWNpZmljL0t3YWphbGVpbnxLd2FqYWxlaW5cIixcblx0XHRcIlBhY2lmaWMvUGFnb19QYWdvfFBhY2lmaWMvTWlkd2F5XCIsXG5cdFx0XCJQYWNpZmljL1BhZ29fUGFnb3xQYWNpZmljL1NhbW9hXCIsXG5cdFx0XCJQYWNpZmljL1BhZ29fUGFnb3xVUy9TYW1vYVwiLFxuXHRcdFwiUGFjaWZpYy9Qb2hucGVpfFBhY2lmaWMvUG9uYXBlXCJcblx0XVxufSIsInZhciBtb21lbnQgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL21vbWVudC10aW1lem9uZVwiKTtcbm1vbWVudC50ei5sb2FkKHJlcXVpcmUoJy4vZGF0YS9wYWNrZWQvbGF0ZXN0Lmpzb24nKSk7XG4iLCIvLyEgbW9tZW50LXRpbWV6b25lLmpzXG4vLyEgdmVyc2lvbiA6IDAuNS40XG4vLyEgYXV0aG9yIDogVGltIFdvb2Rcbi8vISBsaWNlbnNlIDogTUlUXG4vLyEgZ2l0aHViLmNvbS9tb21lbnQvbW9tZW50LXRpbWV6b25lXG5cbihmdW5jdGlvbiAocm9vdCwgZmFjdG9yeSkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuXHQvKmdsb2JhbCBkZWZpbmUqL1xuXHRpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG5cdFx0ZGVmaW5lKFsnbW9tZW50J10sIGZhY3RvcnkpOyAgICAgICAgICAgICAgICAgLy8gQU1EXG5cdH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcblx0XHRtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkocmVxdWlyZSgnbW9tZW50JykpOyAvLyBOb2RlXG5cdH0gZWxzZSB7XG5cdFx0ZmFjdG9yeShyb290Lm1vbWVudCk7ICAgICAgICAgICAgICAgICAgICAgICAgLy8gQnJvd3NlclxuXHR9XG59KHRoaXMsIGZ1bmN0aW9uIChtb21lbnQpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0Ly8gRG8gbm90IGxvYWQgbW9tZW50LXRpbWV6b25lIGEgc2Vjb25kIHRpbWUuXG5cdGlmIChtb21lbnQudHogIT09IHVuZGVmaW5lZCkge1xuXHRcdGxvZ0Vycm9yKCdNb21lbnQgVGltZXpvbmUgJyArIG1vbWVudC50ei52ZXJzaW9uICsgJyB3YXMgYWxyZWFkeSBsb2FkZWQgJyArIChtb21lbnQudHouZGF0YVZlcnNpb24gPyAnd2l0aCBkYXRhIGZyb20gJyA6ICd3aXRob3V0IGFueSBkYXRhJykgKyBtb21lbnQudHouZGF0YVZlcnNpb24pO1xuXHRcdHJldHVybiBtb21lbnQ7XG5cdH1cblxuXHR2YXIgVkVSU0lPTiA9IFwiMC41LjRcIixcblx0XHR6b25lcyA9IHt9LFxuXHRcdGxpbmtzID0ge30sXG5cdFx0bmFtZXMgPSB7fSxcblx0XHRndWVzc2VzID0ge30sXG5cdFx0Y2FjaGVkR3Vlc3MsXG5cblx0XHRtb21lbnRWZXJzaW9uID0gbW9tZW50LnZlcnNpb24uc3BsaXQoJy4nKSxcblx0XHRtYWpvciA9ICttb21lbnRWZXJzaW9uWzBdLFxuXHRcdG1pbm9yID0gK21vbWVudFZlcnNpb25bMV07XG5cblx0Ly8gTW9tZW50LmpzIHZlcnNpb24gY2hlY2tcblx0aWYgKG1ham9yIDwgMiB8fCAobWFqb3IgPT09IDIgJiYgbWlub3IgPCA2KSkge1xuXHRcdGxvZ0Vycm9yKCdNb21lbnQgVGltZXpvbmUgcmVxdWlyZXMgTW9tZW50LmpzID49IDIuNi4wLiBZb3UgYXJlIHVzaW5nIE1vbWVudC5qcyAnICsgbW9tZW50LnZlcnNpb24gKyAnLiBTZWUgbW9tZW50anMuY29tJyk7XG5cdH1cblxuXHQvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG5cdFx0VW5wYWNraW5nXG5cdCoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuXHRmdW5jdGlvbiBjaGFyQ29kZVRvSW50KGNoYXJDb2RlKSB7XG5cdFx0aWYgKGNoYXJDb2RlID4gOTYpIHtcblx0XHRcdHJldHVybiBjaGFyQ29kZSAtIDg3O1xuXHRcdH0gZWxzZSBpZiAoY2hhckNvZGUgPiA2NCkge1xuXHRcdFx0cmV0dXJuIGNoYXJDb2RlIC0gMjk7XG5cdFx0fVxuXHRcdHJldHVybiBjaGFyQ29kZSAtIDQ4O1xuXHR9XG5cblx0ZnVuY3Rpb24gdW5wYWNrQmFzZTYwKHN0cmluZykge1xuXHRcdHZhciBpID0gMCxcblx0XHRcdHBhcnRzID0gc3RyaW5nLnNwbGl0KCcuJyksXG5cdFx0XHR3aG9sZSA9IHBhcnRzWzBdLFxuXHRcdFx0ZnJhY3Rpb25hbCA9IHBhcnRzWzFdIHx8ICcnLFxuXHRcdFx0bXVsdGlwbGllciA9IDEsXG5cdFx0XHRudW0sXG5cdFx0XHRvdXQgPSAwLFxuXHRcdFx0c2lnbiA9IDE7XG5cblx0XHQvLyBoYW5kbGUgbmVnYXRpdmUgbnVtYmVyc1xuXHRcdGlmIChzdHJpbmcuY2hhckNvZGVBdCgwKSA9PT0gNDUpIHtcblx0XHRcdGkgPSAxO1xuXHRcdFx0c2lnbiA9IC0xO1xuXHRcdH1cblxuXHRcdC8vIGhhbmRsZSBkaWdpdHMgYmVmb3JlIHRoZSBkZWNpbWFsXG5cdFx0Zm9yIChpOyBpIDwgd2hvbGUubGVuZ3RoOyBpKyspIHtcblx0XHRcdG51bSA9IGNoYXJDb2RlVG9JbnQod2hvbGUuY2hhckNvZGVBdChpKSk7XG5cdFx0XHRvdXQgPSA2MCAqIG91dCArIG51bTtcblx0XHR9XG5cblx0XHQvLyBoYW5kbGUgZGlnaXRzIGFmdGVyIHRoZSBkZWNpbWFsXG5cdFx0Zm9yIChpID0gMDsgaSA8IGZyYWN0aW9uYWwubGVuZ3RoOyBpKyspIHtcblx0XHRcdG11bHRpcGxpZXIgPSBtdWx0aXBsaWVyIC8gNjA7XG5cdFx0XHRudW0gPSBjaGFyQ29kZVRvSW50KGZyYWN0aW9uYWwuY2hhckNvZGVBdChpKSk7XG5cdFx0XHRvdXQgKz0gbnVtICogbXVsdGlwbGllcjtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0ICogc2lnbjtcblx0fVxuXG5cdGZ1bmN0aW9uIGFycmF5VG9JbnQgKGFycmF5KSB7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuXHRcdFx0YXJyYXlbaV0gPSB1bnBhY2tCYXNlNjAoYXJyYXlbaV0pO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGludFRvVW50aWwgKGFycmF5LCBsZW5ndGgpIHtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdFx0XHRhcnJheVtpXSA9IE1hdGgucm91bmQoKGFycmF5W2kgLSAxXSB8fCAwKSArIChhcnJheVtpXSAqIDYwMDAwKSk7IC8vIG1pbnV0ZXMgdG8gbWlsbGlzZWNvbmRzXG5cdFx0fVxuXG5cdFx0YXJyYXlbbGVuZ3RoIC0gMV0gPSBJbmZpbml0eTtcblx0fVxuXG5cdGZ1bmN0aW9uIG1hcEluZGljZXMgKHNvdXJjZSwgaW5kaWNlcykge1xuXHRcdHZhciBvdXQgPSBbXSwgaTtcblxuXHRcdGZvciAoaSA9IDA7IGkgPCBpbmRpY2VzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRvdXRbaV0gPSBzb3VyY2VbaW5kaWNlc1tpXV07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dDtcblx0fVxuXG5cdGZ1bmN0aW9uIHVucGFjayAoc3RyaW5nKSB7XG5cdFx0dmFyIGRhdGEgPSBzdHJpbmcuc3BsaXQoJ3wnKSxcblx0XHRcdG9mZnNldHMgPSBkYXRhWzJdLnNwbGl0KCcgJyksXG5cdFx0XHRpbmRpY2VzID0gZGF0YVszXS5zcGxpdCgnJyksXG5cdFx0XHR1bnRpbHMgID0gZGF0YVs0XS5zcGxpdCgnICcpO1xuXG5cdFx0YXJyYXlUb0ludChvZmZzZXRzKTtcblx0XHRhcnJheVRvSW50KGluZGljZXMpO1xuXHRcdGFycmF5VG9JbnQodW50aWxzKTtcblxuXHRcdGludFRvVW50aWwodW50aWxzLCBpbmRpY2VzLmxlbmd0aCk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZSAgICAgICA6IGRhdGFbMF0sXG5cdFx0XHRhYmJycyAgICAgIDogbWFwSW5kaWNlcyhkYXRhWzFdLnNwbGl0KCcgJyksIGluZGljZXMpLFxuXHRcdFx0b2Zmc2V0cyAgICA6IG1hcEluZGljZXMob2Zmc2V0cywgaW5kaWNlcyksXG5cdFx0XHR1bnRpbHMgICAgIDogdW50aWxzLFxuXHRcdFx0cG9wdWxhdGlvbiA6IGRhdGFbNV0gfCAwXG5cdFx0fTtcblx0fVxuXG5cdC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcblx0XHRab25lIG9iamVjdFxuXHQqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblx0ZnVuY3Rpb24gWm9uZSAocGFja2VkU3RyaW5nKSB7XG5cdFx0aWYgKHBhY2tlZFN0cmluZykge1xuXHRcdFx0dGhpcy5fc2V0KHVucGFjayhwYWNrZWRTdHJpbmcpKTtcblx0XHR9XG5cdH1cblxuXHRab25lLnByb3RvdHlwZSA9IHtcblx0XHRfc2V0IDogZnVuY3Rpb24gKHVucGFja2VkKSB7XG5cdFx0XHR0aGlzLm5hbWUgICAgICAgPSB1bnBhY2tlZC5uYW1lO1xuXHRcdFx0dGhpcy5hYmJycyAgICAgID0gdW5wYWNrZWQuYWJicnM7XG5cdFx0XHR0aGlzLnVudGlscyAgICAgPSB1bnBhY2tlZC51bnRpbHM7XG5cdFx0XHR0aGlzLm9mZnNldHMgICAgPSB1bnBhY2tlZC5vZmZzZXRzO1xuXHRcdFx0dGhpcy5wb3B1bGF0aW9uID0gdW5wYWNrZWQucG9wdWxhdGlvbjtcblx0XHR9LFxuXG5cdFx0X2luZGV4IDogZnVuY3Rpb24gKHRpbWVzdGFtcCkge1xuXHRcdFx0dmFyIHRhcmdldCA9ICt0aW1lc3RhbXAsXG5cdFx0XHRcdHVudGlscyA9IHRoaXMudW50aWxzLFxuXHRcdFx0XHRpO1xuXG5cdFx0XHRmb3IgKGkgPSAwOyBpIDwgdW50aWxzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmICh0YXJnZXQgPCB1bnRpbHNbaV0pIHtcblx0XHRcdFx0XHRyZXR1cm4gaTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRwYXJzZSA6IGZ1bmN0aW9uICh0aW1lc3RhbXApIHtcblx0XHRcdHZhciB0YXJnZXQgID0gK3RpbWVzdGFtcCxcblx0XHRcdFx0b2Zmc2V0cyA9IHRoaXMub2Zmc2V0cyxcblx0XHRcdFx0dW50aWxzICA9IHRoaXMudW50aWxzLFxuXHRcdFx0XHRtYXggICAgID0gdW50aWxzLmxlbmd0aCAtIDEsXG5cdFx0XHRcdG9mZnNldCwgb2Zmc2V0TmV4dCwgb2Zmc2V0UHJldiwgaTtcblxuXHRcdFx0Zm9yIChpID0gMDsgaSA8IG1heDsgaSsrKSB7XG5cdFx0XHRcdG9mZnNldCAgICAgPSBvZmZzZXRzW2ldO1xuXHRcdFx0XHRvZmZzZXROZXh0ID0gb2Zmc2V0c1tpICsgMV07XG5cdFx0XHRcdG9mZnNldFByZXYgPSBvZmZzZXRzW2kgPyBpIC0gMSA6IGldO1xuXG5cdFx0XHRcdGlmIChvZmZzZXQgPCBvZmZzZXROZXh0ICYmIHR6Lm1vdmVBbWJpZ3VvdXNGb3J3YXJkKSB7XG5cdFx0XHRcdFx0b2Zmc2V0ID0gb2Zmc2V0TmV4dDtcblx0XHRcdFx0fSBlbHNlIGlmIChvZmZzZXQgPiBvZmZzZXRQcmV2ICYmIHR6Lm1vdmVJbnZhbGlkRm9yd2FyZCkge1xuXHRcdFx0XHRcdG9mZnNldCA9IG9mZnNldFByZXY7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGFyZ2V0IDwgdW50aWxzW2ldIC0gKG9mZnNldCAqIDYwMDAwKSkge1xuXHRcdFx0XHRcdHJldHVybiBvZmZzZXRzW2ldO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBvZmZzZXRzW21heF07XG5cdFx0fSxcblxuXHRcdGFiYnIgOiBmdW5jdGlvbiAobW9tKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5hYmJyc1t0aGlzLl9pbmRleChtb20pXTtcblx0XHR9LFxuXG5cdFx0b2Zmc2V0IDogZnVuY3Rpb24gKG1vbSkge1xuXHRcdFx0cmV0dXJuIHRoaXMub2Zmc2V0c1t0aGlzLl9pbmRleChtb20pXTtcblx0XHR9XG5cdH07XG5cblx0LyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuXHRcdEN1cnJlbnQgVGltZXpvbmVcblx0KioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5cdGZ1bmN0aW9uIE9mZnNldEF0KGF0KSB7XG5cdFx0dmFyIHRpbWVTdHJpbmcgPSBhdC50b1RpbWVTdHJpbmcoKTtcblx0XHR2YXIgYWJiciA9IHRpbWVTdHJpbmcubWF0Y2goL1xcKFthLXogXStcXCkvaSk7XG5cdFx0aWYgKGFiYnIgJiYgYWJiclswXSkge1xuXHRcdFx0Ly8gMTc6NTY6MzEgR01ULTA2MDAgKENTVClcblx0XHRcdC8vIDE3OjU2OjMxIEdNVC0wNjAwIChDZW50cmFsIFN0YW5kYXJkIFRpbWUpXG5cdFx0XHRhYmJyID0gYWJiclswXS5tYXRjaCgvW0EtWl0vZyk7XG5cdFx0XHRhYmJyID0gYWJiciA/IGFiYnIuam9pbignJykgOiB1bmRlZmluZWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIDE3OjU2OjMxIENTVFxuXHRcdFx0Ly8gMTc6NTY6MzEgR01UKzA4MDAgKOWPsOWMl+aomea6luaZgumWkylcblx0XHRcdGFiYnIgPSB0aW1lU3RyaW5nLm1hdGNoKC9bQS1aXXszLDV9L2cpO1xuXHRcdFx0YWJiciA9IGFiYnIgPyBhYmJyWzBdIDogdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmIChhYmJyID09PSAnR01UJykge1xuXHRcdFx0YWJiciA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHR0aGlzLmF0ID0gK2F0O1xuXHRcdHRoaXMuYWJiciA9IGFiYnI7XG5cdFx0dGhpcy5vZmZzZXQgPSBhdC5nZXRUaW1lem9uZU9mZnNldCgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gWm9uZVNjb3JlKHpvbmUpIHtcblx0XHR0aGlzLnpvbmUgPSB6b25lO1xuXHRcdHRoaXMub2Zmc2V0U2NvcmUgPSAwO1xuXHRcdHRoaXMuYWJiclNjb3JlID0gMDtcblx0fVxuXG5cdFpvbmVTY29yZS5wcm90b3R5cGUuc2NvcmVPZmZzZXRBdCA9IGZ1bmN0aW9uIChvZmZzZXRBdCkge1xuXHRcdHRoaXMub2Zmc2V0U2NvcmUgKz0gTWF0aC5hYnModGhpcy56b25lLm9mZnNldChvZmZzZXRBdC5hdCkgLSBvZmZzZXRBdC5vZmZzZXQpO1xuXHRcdGlmICh0aGlzLnpvbmUuYWJicihvZmZzZXRBdC5hdCkucmVwbGFjZSgvW15BLVpdL2csICcnKSAhPT0gb2Zmc2V0QXQuYWJicikge1xuXHRcdFx0dGhpcy5hYmJyU2NvcmUrKztcblx0XHR9XG5cdH07XG5cblx0ZnVuY3Rpb24gZmluZENoYW5nZShsb3csIGhpZ2gpIHtcblx0XHR2YXIgbWlkLCBkaWZmO1xuXG5cdFx0d2hpbGUgKChkaWZmID0gKChoaWdoLmF0IC0gbG93LmF0KSAvIDEyZTQgfCAwKSAqIDZlNCkpIHtcblx0XHRcdG1pZCA9IG5ldyBPZmZzZXRBdChuZXcgRGF0ZShsb3cuYXQgKyBkaWZmKSk7XG5cdFx0XHRpZiAobWlkLm9mZnNldCA9PT0gbG93Lm9mZnNldCkge1xuXHRcdFx0XHRsb3cgPSBtaWQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRoaWdoID0gbWlkO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBsb3c7XG5cdH1cblxuXHRmdW5jdGlvbiB1c2VyT2Zmc2V0cygpIHtcblx0XHR2YXIgc3RhcnRZZWFyID0gbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpIC0gMixcblx0XHRcdGxhc3QgPSBuZXcgT2Zmc2V0QXQobmV3IERhdGUoc3RhcnRZZWFyLCAwLCAxKSksXG5cdFx0XHRvZmZzZXRzID0gW2xhc3RdLFxuXHRcdFx0Y2hhbmdlLCBuZXh0LCBpO1xuXG5cdFx0Zm9yIChpID0gMTsgaSA8IDQ4OyBpKyspIHtcblx0XHRcdG5leHQgPSBuZXcgT2Zmc2V0QXQobmV3IERhdGUoc3RhcnRZZWFyLCBpLCAxKSk7XG5cdFx0XHRpZiAobmV4dC5vZmZzZXQgIT09IGxhc3Qub2Zmc2V0KSB7XG5cdFx0XHRcdGNoYW5nZSA9IGZpbmRDaGFuZ2UobGFzdCwgbmV4dCk7XG5cdFx0XHRcdG9mZnNldHMucHVzaChjaGFuZ2UpO1xuXHRcdFx0XHRvZmZzZXRzLnB1c2gobmV3IE9mZnNldEF0KG5ldyBEYXRlKGNoYW5nZS5hdCArIDZlNCkpKTtcblx0XHRcdH1cblx0XHRcdGxhc3QgPSBuZXh0O1xuXHRcdH1cblxuXHRcdGZvciAoaSA9IDA7IGkgPCA0OyBpKyspIHtcblx0XHRcdG9mZnNldHMucHVzaChuZXcgT2Zmc2V0QXQobmV3IERhdGUoc3RhcnRZZWFyICsgaSwgMCwgMSkpKTtcblx0XHRcdG9mZnNldHMucHVzaChuZXcgT2Zmc2V0QXQobmV3IERhdGUoc3RhcnRZZWFyICsgaSwgNiwgMSkpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gb2Zmc2V0cztcblx0fVxuXG5cdGZ1bmN0aW9uIHNvcnRab25lU2NvcmVzIChhLCBiKSB7XG5cdFx0aWYgKGEub2Zmc2V0U2NvcmUgIT09IGIub2Zmc2V0U2NvcmUpIHtcblx0XHRcdHJldHVybiBhLm9mZnNldFNjb3JlIC0gYi5vZmZzZXRTY29yZTtcblx0XHR9XG5cdFx0aWYgKGEuYWJiclNjb3JlICE9PSBiLmFiYnJTY29yZSkge1xuXHRcdFx0cmV0dXJuIGEuYWJiclNjb3JlIC0gYi5hYmJyU2NvcmU7XG5cdFx0fVxuXHRcdHJldHVybiBiLnpvbmUucG9wdWxhdGlvbiAtIGEuem9uZS5wb3B1bGF0aW9uO1xuXHR9XG5cblx0ZnVuY3Rpb24gYWRkVG9HdWVzc2VzIChuYW1lLCBvZmZzZXRzKSB7XG5cdFx0dmFyIGksIG9mZnNldDtcblx0XHRhcnJheVRvSW50KG9mZnNldHMpO1xuXHRcdGZvciAoaSA9IDA7IGkgPCBvZmZzZXRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRvZmZzZXQgPSBvZmZzZXRzW2ldO1xuXHRcdFx0Z3Vlc3Nlc1tvZmZzZXRdID0gZ3Vlc3Nlc1tvZmZzZXRdIHx8IHt9O1xuXHRcdFx0Z3Vlc3Nlc1tvZmZzZXRdW25hbWVdID0gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBndWVzc2VzRm9yVXNlck9mZnNldHMgKG9mZnNldHMpIHtcblx0XHR2YXIgb2Zmc2V0c0xlbmd0aCA9IG9mZnNldHMubGVuZ3RoLFxuXHRcdFx0ZmlsdGVyZWRHdWVzc2VzID0ge30sXG5cdFx0XHRvdXQgPSBbXSxcblx0XHRcdGksIGosIGd1ZXNzZXNPZmZzZXQ7XG5cblx0XHRmb3IgKGkgPSAwOyBpIDwgb2Zmc2V0c0xlbmd0aDsgaSsrKSB7XG5cdFx0XHRndWVzc2VzT2Zmc2V0ID0gZ3Vlc3Nlc1tvZmZzZXRzW2ldLm9mZnNldF0gfHwge307XG5cdFx0XHRmb3IgKGogaW4gZ3Vlc3Nlc09mZnNldCkge1xuXHRcdFx0XHRpZiAoZ3Vlc3Nlc09mZnNldC5oYXNPd25Qcm9wZXJ0eShqKSkge1xuXHRcdFx0XHRcdGZpbHRlcmVkR3Vlc3Nlc1tqXSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRmb3IgKGkgaW4gZmlsdGVyZWRHdWVzc2VzKSB7XG5cdFx0XHRpZiAoZmlsdGVyZWRHdWVzc2VzLmhhc093blByb3BlcnR5KGkpKSB7XG5cdFx0XHRcdG91dC5wdXNoKG5hbWVzW2ldKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0O1xuXHR9XG5cblx0ZnVuY3Rpb24gcmVidWlsZEd1ZXNzICgpIHtcblxuXHRcdC8vIHVzZSBJbnRsIEFQSSB3aGVuIGF2YWlsYWJsZSBhbmQgcmV0dXJuaW5nIHZhbGlkIHRpbWUgem9uZVxuXHRcdHRyeSB7XG5cdFx0XHR2YXIgaW50bE5hbWUgPSBJbnRsLkRhdGVUaW1lRm9ybWF0KCkucmVzb2x2ZWRPcHRpb25zKCkudGltZVpvbmU7XG5cdFx0XHRpZiAoaW50bE5hbWUpe1xuXHRcdFx0XHR2YXIgbmFtZSA9IG5hbWVzW25vcm1hbGl6ZU5hbWUoaW50bE5hbWUpXTtcblx0XHRcdFx0aWYgKG5hbWUpIHtcblx0XHRcdFx0XHRyZXR1cm4gbmFtZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRsb2dFcnJvcihcIk1vbWVudCBUaW1lem9uZSBmb3VuZCBcIiArIGludGxOYW1lICsgXCIgZnJvbSB0aGUgSW50bCBhcGksIGJ1dCBkaWQgbm90IGhhdmUgdGhhdCBkYXRhIGxvYWRlZC5cIik7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Ly8gSW50bCB1bmF2YWlsYWJsZSwgZmFsbCBiYWNrIHRvIG1hbnVhbCBndWVzc2luZy5cblx0XHR9XG5cblx0XHR2YXIgb2Zmc2V0cyA9IHVzZXJPZmZzZXRzKCksXG5cdFx0XHRvZmZzZXRzTGVuZ3RoID0gb2Zmc2V0cy5sZW5ndGgsXG5cdFx0XHRndWVzc2VzID0gZ3Vlc3Nlc0ZvclVzZXJPZmZzZXRzKG9mZnNldHMpLFxuXHRcdFx0em9uZVNjb3JlcyA9IFtdLFxuXHRcdFx0em9uZVNjb3JlLCBpLCBqO1xuXG5cdFx0Zm9yIChpID0gMDsgaSA8IGd1ZXNzZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHpvbmVTY29yZSA9IG5ldyBab25lU2NvcmUoZ2V0Wm9uZShndWVzc2VzW2ldKSwgb2Zmc2V0c0xlbmd0aCk7XG5cdFx0XHRmb3IgKGogPSAwOyBqIDwgb2Zmc2V0c0xlbmd0aDsgaisrKSB7XG5cdFx0XHRcdHpvbmVTY29yZS5zY29yZU9mZnNldEF0KG9mZnNldHNbal0pO1xuXHRcdFx0fVxuXHRcdFx0em9uZVNjb3Jlcy5wdXNoKHpvbmVTY29yZSk7XG5cdFx0fVxuXG5cdFx0em9uZVNjb3Jlcy5zb3J0KHNvcnRab25lU2NvcmVzKTtcblxuXHRcdHJldHVybiB6b25lU2NvcmVzLmxlbmd0aCA+IDAgPyB6b25lU2NvcmVzWzBdLnpvbmUubmFtZSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdGZ1bmN0aW9uIGd1ZXNzIChpZ25vcmVDYWNoZSkge1xuXHRcdGlmICghY2FjaGVkR3Vlc3MgfHwgaWdub3JlQ2FjaGUpIHtcblx0XHRcdGNhY2hlZEd1ZXNzID0gcmVidWlsZEd1ZXNzKCk7XG5cdFx0fVxuXHRcdHJldHVybiBjYWNoZWRHdWVzcztcblx0fVxuXG5cdC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcblx0XHRHbG9iYWwgTWV0aG9kc1xuXHQqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblx0ZnVuY3Rpb24gbm9ybWFsaXplTmFtZSAobmFtZSkge1xuXHRcdHJldHVybiAobmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9cXC8vZywgJ18nKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFkZFpvbmUgKHBhY2tlZCkge1xuXHRcdHZhciBpLCBuYW1lLCBzcGxpdCwgbm9ybWFsaXplZDtcblxuXHRcdGlmICh0eXBlb2YgcGFja2VkID09PSBcInN0cmluZ1wiKSB7XG5cdFx0XHRwYWNrZWQgPSBbcGFja2VkXTtcblx0XHR9XG5cblx0XHRmb3IgKGkgPSAwOyBpIDwgcGFja2VkLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRzcGxpdCA9IHBhY2tlZFtpXS5zcGxpdCgnfCcpO1xuXHRcdFx0bmFtZSA9IHNwbGl0WzBdO1xuXHRcdFx0bm9ybWFsaXplZCA9IG5vcm1hbGl6ZU5hbWUobmFtZSk7XG5cdFx0XHR6b25lc1tub3JtYWxpemVkXSA9IHBhY2tlZFtpXTtcblx0XHRcdG5hbWVzW25vcm1hbGl6ZWRdID0gbmFtZTtcblx0XHRcdGlmIChzcGxpdFs1XSkge1xuXHRcdFx0XHRhZGRUb0d1ZXNzZXMobm9ybWFsaXplZCwgc3BsaXRbMl0uc3BsaXQoJyAnKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0Wm9uZSAobmFtZSwgY2FsbGVyKSB7XG5cdFx0bmFtZSA9IG5vcm1hbGl6ZU5hbWUobmFtZSk7XG5cblx0XHR2YXIgem9uZSA9IHpvbmVzW25hbWVdO1xuXHRcdHZhciBsaW5rO1xuXG5cdFx0aWYgKHpvbmUgaW5zdGFuY2VvZiBab25lKSB7XG5cdFx0XHRyZXR1cm4gem9uZTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHpvbmUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR6b25lID0gbmV3IFpvbmUoem9uZSk7XG5cdFx0XHR6b25lc1tuYW1lXSA9IHpvbmU7XG5cdFx0XHRyZXR1cm4gem9uZTtcblx0XHR9XG5cblx0XHQvLyBQYXNzIGdldFpvbmUgdG8gcHJldmVudCByZWN1cnNpb24gbW9yZSB0aGFuIDEgbGV2ZWwgZGVlcFxuXHRcdGlmIChsaW5rc1tuYW1lXSAmJiBjYWxsZXIgIT09IGdldFpvbmUgJiYgKGxpbmsgPSBnZXRab25lKGxpbmtzW25hbWVdLCBnZXRab25lKSkpIHtcblx0XHRcdHpvbmUgPSB6b25lc1tuYW1lXSA9IG5ldyBab25lKCk7XG5cdFx0XHR6b25lLl9zZXQobGluayk7XG5cdFx0XHR6b25lLm5hbWUgPSBuYW1lc1tuYW1lXTtcblx0XHRcdHJldHVybiB6b25lO1xuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0TmFtZXMgKCkge1xuXHRcdHZhciBpLCBvdXQgPSBbXTtcblxuXHRcdGZvciAoaSBpbiBuYW1lcykge1xuXHRcdFx0aWYgKG5hbWVzLmhhc093blByb3BlcnR5KGkpICYmICh6b25lc1tpXSB8fCB6b25lc1tsaW5rc1tpXV0pICYmIG5hbWVzW2ldKSB7XG5cdFx0XHRcdG91dC5wdXNoKG5hbWVzW2ldKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0LnNvcnQoKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFkZExpbmsgKGFsaWFzZXMpIHtcblx0XHR2YXIgaSwgYWxpYXMsIG5vcm1hbDAsIG5vcm1hbDE7XG5cblx0XHRpZiAodHlwZW9mIGFsaWFzZXMgPT09IFwic3RyaW5nXCIpIHtcblx0XHRcdGFsaWFzZXMgPSBbYWxpYXNlc107XG5cdFx0fVxuXG5cdFx0Zm9yIChpID0gMDsgaSA8IGFsaWFzZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGFsaWFzID0gYWxpYXNlc1tpXS5zcGxpdCgnfCcpO1xuXG5cdFx0XHRub3JtYWwwID0gbm9ybWFsaXplTmFtZShhbGlhc1swXSk7XG5cdFx0XHRub3JtYWwxID0gbm9ybWFsaXplTmFtZShhbGlhc1sxXSk7XG5cblx0XHRcdGxpbmtzW25vcm1hbDBdID0gbm9ybWFsMTtcblx0XHRcdG5hbWVzW25vcm1hbDBdID0gYWxpYXNbMF07XG5cblx0XHRcdGxpbmtzW25vcm1hbDFdID0gbm9ybWFsMDtcblx0XHRcdG5hbWVzW25vcm1hbDFdID0gYWxpYXNbMV07XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gbG9hZERhdGEgKGRhdGEpIHtcblx0XHRhZGRab25lKGRhdGEuem9uZXMpO1xuXHRcdGFkZExpbmsoZGF0YS5saW5rcyk7XG5cdFx0dHouZGF0YVZlcnNpb24gPSBkYXRhLnZlcnNpb247XG5cdH1cblxuXHRmdW5jdGlvbiB6b25lRXhpc3RzIChuYW1lKSB7XG5cdFx0aWYgKCF6b25lRXhpc3RzLmRpZFNob3dFcnJvcikge1xuXHRcdFx0em9uZUV4aXN0cy5kaWRTaG93RXJyb3IgPSB0cnVlO1xuXHRcdFx0XHRsb2dFcnJvcihcIm1vbWVudC50ei56b25lRXhpc3RzKCdcIiArIG5hbWUgKyBcIicpIGhhcyBiZWVuIGRlcHJlY2F0ZWQgaW4gZmF2b3Igb2YgIW1vbWVudC50ei56b25lKCdcIiArIG5hbWUgKyBcIicpXCIpO1xuXHRcdH1cblx0XHRyZXR1cm4gISFnZXRab25lKG5hbWUpO1xuXHR9XG5cblx0ZnVuY3Rpb24gbmVlZHNPZmZzZXQgKG0pIHtcblx0XHRyZXR1cm4gISEobS5fYSAmJiAobS5fdHptID09PSB1bmRlZmluZWQpKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGxvZ0Vycm9yIChtZXNzYWdlKSB7XG5cdFx0aWYgKHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgY29uc29sZS5lcnJvciA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0Y29uc29sZS5lcnJvcihtZXNzYWdlKTtcblx0XHR9XG5cdH1cblxuXHQvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG5cdFx0bW9tZW50LnR6IG5hbWVzcGFjZVxuXHQqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblx0ZnVuY3Rpb24gdHogKGlucHV0KSB7XG5cdFx0dmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDAsIC0xKSxcblx0XHRcdG5hbWUgPSBhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdLFxuXHRcdFx0em9uZSA9IGdldFpvbmUobmFtZSksXG5cdFx0XHRvdXQgID0gbW9tZW50LnV0Yy5hcHBseShudWxsLCBhcmdzKTtcblxuXHRcdGlmICh6b25lICYmICFtb21lbnQuaXNNb21lbnQoaW5wdXQpICYmIG5lZWRzT2Zmc2V0KG91dCkpIHtcblx0XHRcdG91dC5hZGQoem9uZS5wYXJzZShvdXQpLCAnbWludXRlcycpO1xuXHRcdH1cblxuXHRcdG91dC50eihuYW1lKTtcblxuXHRcdHJldHVybiBvdXQ7XG5cdH1cblxuXHR0ei52ZXJzaW9uICAgICAgPSBWRVJTSU9OO1xuXHR0ei5kYXRhVmVyc2lvbiAgPSAnJztcblx0dHouX3pvbmVzICAgICAgID0gem9uZXM7XG5cdHR6Ll9saW5rcyAgICAgICA9IGxpbmtzO1xuXHR0ei5fbmFtZXMgICAgICAgPSBuYW1lcztcblx0dHouYWRkICAgICAgICAgID0gYWRkWm9uZTtcblx0dHoubGluayAgICAgICAgID0gYWRkTGluaztcblx0dHoubG9hZCAgICAgICAgID0gbG9hZERhdGE7XG5cdHR6LnpvbmUgICAgICAgICA9IGdldFpvbmU7XG5cdHR6LnpvbmVFeGlzdHMgICA9IHpvbmVFeGlzdHM7IC8vIGRlcHJlY2F0ZWQgaW4gMC4xLjBcblx0dHouZ3Vlc3MgICAgICAgID0gZ3Vlc3M7XG5cdHR6Lm5hbWVzICAgICAgICA9IGdldE5hbWVzO1xuXHR0ei5ab25lICAgICAgICAgPSBab25lO1xuXHR0ei51bnBhY2sgICAgICAgPSB1bnBhY2s7XG5cdHR6LnVucGFja0Jhc2U2MCA9IHVucGFja0Jhc2U2MDtcblx0dHoubmVlZHNPZmZzZXQgID0gbmVlZHNPZmZzZXQ7XG5cdHR6Lm1vdmVJbnZhbGlkRm9yd2FyZCAgID0gdHJ1ZTtcblx0dHoubW92ZUFtYmlndW91c0ZvcndhcmQgPSBmYWxzZTtcblxuXHQvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG5cdFx0SW50ZXJmYWNlIHdpdGggTW9tZW50LmpzXG5cdCoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuXHR2YXIgZm4gPSBtb21lbnQuZm47XG5cblx0bW9tZW50LnR6ID0gdHo7XG5cblx0bW9tZW50LmRlZmF1bHRab25lID0gbnVsbDtcblxuXHRtb21lbnQudXBkYXRlT2Zmc2V0ID0gZnVuY3Rpb24gKG1vbSwga2VlcFRpbWUpIHtcblx0XHR2YXIgem9uZSA9IG1vbWVudC5kZWZhdWx0Wm9uZSxcblx0XHRcdG9mZnNldDtcblxuXHRcdGlmIChtb20uX3ogPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0aWYgKHpvbmUgJiYgbmVlZHNPZmZzZXQobW9tKSAmJiAhbW9tLl9pc1VUQykge1xuXHRcdFx0XHRtb20uX2QgPSBtb21lbnQudXRjKG1vbS5fYSkuX2Q7XG5cdFx0XHRcdG1vbS51dGMoKS5hZGQoem9uZS5wYXJzZShtb20pLCAnbWludXRlcycpO1xuXHRcdFx0fVxuXHRcdFx0bW9tLl96ID0gem9uZTtcblx0XHR9XG5cdFx0aWYgKG1vbS5feikge1xuXHRcdFx0b2Zmc2V0ID0gbW9tLl96Lm9mZnNldChtb20pO1xuXHRcdFx0aWYgKE1hdGguYWJzKG9mZnNldCkgPCAxNikge1xuXHRcdFx0XHRvZmZzZXQgPSBvZmZzZXQgLyA2MDtcblx0XHRcdH1cblx0XHRcdGlmIChtb20udXRjT2Zmc2V0ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0bW9tLnV0Y09mZnNldCgtb2Zmc2V0LCBrZWVwVGltZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtb20uem9uZShvZmZzZXQsIGtlZXBUaW1lKTtcblx0XHRcdH1cblx0XHR9XG5cdH07XG5cblx0Zm4udHogPSBmdW5jdGlvbiAobmFtZSkge1xuXHRcdGlmIChuYW1lKSB7XG5cdFx0XHR0aGlzLl96ID0gZ2V0Wm9uZShuYW1lKTtcblx0XHRcdGlmICh0aGlzLl96KSB7XG5cdFx0XHRcdG1vbWVudC51cGRhdGVPZmZzZXQodGhpcyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsb2dFcnJvcihcIk1vbWVudCBUaW1lem9uZSBoYXMgbm8gZGF0YSBmb3IgXCIgKyBuYW1lICsgXCIuIFNlZSBodHRwOi8vbW9tZW50anMuY29tL3RpbWV6b25lL2RvY3MvIy9kYXRhLWxvYWRpbmcvLlwiKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0XHRpZiAodGhpcy5feikgeyByZXR1cm4gdGhpcy5fei5uYW1lOyB9XG5cdH07XG5cblx0ZnVuY3Rpb24gYWJicldyYXAgKG9sZCkge1xuXHRcdHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAodGhpcy5feikgeyByZXR1cm4gdGhpcy5fei5hYmJyKHRoaXMpOyB9XG5cdFx0XHRyZXR1cm4gb2xkLmNhbGwodGhpcyk7XG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIHJlc2V0Wm9uZVdyYXAgKG9sZCkge1xuXHRcdHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdFx0XHR0aGlzLl96ID0gbnVsbDtcblx0XHRcdHJldHVybiBvbGQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblx0XHR9O1xuXHR9XG5cblx0Zm4uem9uZU5hbWUgPSBhYmJyV3JhcChmbi56b25lTmFtZSk7XG5cdGZuLnpvbmVBYmJyID0gYWJicldyYXAoZm4uem9uZUFiYnIpO1xuXHRmbi51dGMgICAgICA9IHJlc2V0Wm9uZVdyYXAoZm4udXRjKTtcblxuXHRtb21lbnQudHouc2V0RGVmYXVsdCA9IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRpZiAobWFqb3IgPCAyIHx8IChtYWpvciA9PT0gMiAmJiBtaW5vciA8IDkpKSB7XG5cdFx0XHRsb2dFcnJvcignTW9tZW50IFRpbWV6b25lIHNldERlZmF1bHQoKSByZXF1aXJlcyBNb21lbnQuanMgPj0gMi45LjAuIFlvdSBhcmUgdXNpbmcgTW9tZW50LmpzICcgKyBtb21lbnQudmVyc2lvbiArICcuJyk7XG5cdFx0fVxuXHRcdG1vbWVudC5kZWZhdWx0Wm9uZSA9IG5hbWUgPyBnZXRab25lKG5hbWUpIDogbnVsbDtcblx0XHRyZXR1cm4gbW9tZW50O1xuXHR9O1xuXG5cdC8vIENsb25pbmcgYSBtb21lbnQgc2hvdWxkIGluY2x1ZGUgdGhlIF96IHByb3BlcnR5LlxuXHR2YXIgbW9tZW50UHJvcGVydGllcyA9IG1vbWVudC5tb21lbnRQcm9wZXJ0aWVzO1xuXHRpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG1vbWVudFByb3BlcnRpZXMpID09PSAnW29iamVjdCBBcnJheV0nKSB7XG5cdFx0Ly8gbW9tZW50IDIuOC4xK1xuXHRcdG1vbWVudFByb3BlcnRpZXMucHVzaCgnX3onKTtcblx0XHRtb21lbnRQcm9wZXJ0aWVzLnB1c2goJ19hJyk7XG5cdH0gZWxzZSBpZiAobW9tZW50UHJvcGVydGllcykge1xuXHRcdC8vIG1vbWVudCAyLjcuMFxuXHRcdG1vbWVudFByb3BlcnRpZXMuX3ogPSBudWxsO1xuXHR9XG5cblx0Ly8gSU5KRUNUIERBVEFcblxuXHRyZXR1cm4gbW9tZW50O1xufSkpO1xuIiwiLy8hIG1vbWVudC5qc1xuLy8hIHZlcnNpb24gOiAyLjEzLjBcbi8vISBhdXRob3JzIDogVGltIFdvb2QsIElza3JlbiBDaGVybmV2LCBNb21lbnQuanMgY29udHJpYnV0b3JzXG4vLyEgbGljZW5zZSA6IE1JVFxuLy8hIG1vbWVudGpzLmNvbVxuXG47KGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcbiAgICB0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKSA6XG4gICAgdHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lKGZhY3RvcnkpIDpcbiAgICBnbG9iYWwubW9tZW50ID0gZmFjdG9yeSgpXG59KHRoaXMsIGZ1bmN0aW9uICgpIHsgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGhvb2tDYWxsYmFjaztcblxuICAgIGZ1bmN0aW9uIHV0aWxzX2hvb2tzX19ob29rcyAoKSB7XG4gICAgICAgIHJldHVybiBob29rQ2FsbGJhY2suYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGlzIGRvbmUgdG8gcmVnaXN0ZXIgdGhlIG1ldGhvZCBjYWxsZWQgd2l0aCBtb21lbnQoKVxuICAgIC8vIHdpdGhvdXQgY3JlYXRpbmcgY2lyY3VsYXIgZGVwZW5kZW5jaWVzLlxuICAgIGZ1bmN0aW9uIHNldEhvb2tDYWxsYmFjayAoY2FsbGJhY2spIHtcbiAgICAgICAgaG9va0NhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNBcnJheShpbnB1dCkge1xuICAgICAgICByZXR1cm4gaW5wdXQgaW5zdGFuY2VvZiBBcnJheSB8fCBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaW5wdXQpID09PSAnW29iamVjdCBBcnJheV0nO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzRGF0ZShpbnB1dCkge1xuICAgICAgICByZXR1cm4gaW5wdXQgaW5zdGFuY2VvZiBEYXRlIHx8IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChpbnB1dCkgPT09ICdbb2JqZWN0IERhdGVdJztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtYXAoYXJyLCBmbikge1xuICAgICAgICB2YXIgcmVzID0gW10sIGk7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKGZuKGFycltpXSwgaSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaGFzT3duUHJvcChhLCBiKSB7XG4gICAgICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYSwgYik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZXh0ZW5kKGEsIGIpIHtcbiAgICAgICAgZm9yICh2YXIgaSBpbiBiKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duUHJvcChiLCBpKSkge1xuICAgICAgICAgICAgICAgIGFbaV0gPSBiW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhhc093blByb3AoYiwgJ3RvU3RyaW5nJykpIHtcbiAgICAgICAgICAgIGEudG9TdHJpbmcgPSBiLnRvU3RyaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhhc093blByb3AoYiwgJ3ZhbHVlT2YnKSkge1xuICAgICAgICAgICAgYS52YWx1ZU9mID0gYi52YWx1ZU9mO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGE7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlX3V0Y19fY3JlYXRlVVRDIChpbnB1dCwgZm9ybWF0LCBsb2NhbGUsIHN0cmljdCkge1xuICAgICAgICByZXR1cm4gY3JlYXRlTG9jYWxPclVUQyhpbnB1dCwgZm9ybWF0LCBsb2NhbGUsIHN0cmljdCwgdHJ1ZSkudXRjKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGVmYXVsdFBhcnNpbmdGbGFncygpIHtcbiAgICAgICAgLy8gV2UgbmVlZCB0byBkZWVwIGNsb25lIHRoaXMgb2JqZWN0LlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZW1wdHkgICAgICAgICAgIDogZmFsc2UsXG4gICAgICAgICAgICB1bnVzZWRUb2tlbnMgICAgOiBbXSxcbiAgICAgICAgICAgIHVudXNlZElucHV0ICAgICA6IFtdLFxuICAgICAgICAgICAgb3ZlcmZsb3cgICAgICAgIDogLTIsXG4gICAgICAgICAgICBjaGFyc0xlZnRPdmVyICAgOiAwLFxuICAgICAgICAgICAgbnVsbElucHV0ICAgICAgIDogZmFsc2UsXG4gICAgICAgICAgICBpbnZhbGlkTW9udGggICAgOiBudWxsLFxuICAgICAgICAgICAgaW52YWxpZEZvcm1hdCAgIDogZmFsc2UsXG4gICAgICAgICAgICB1c2VySW52YWxpZGF0ZWQgOiBmYWxzZSxcbiAgICAgICAgICAgIGlzbyAgICAgICAgICAgICA6IGZhbHNlLFxuICAgICAgICAgICAgcGFyc2VkRGF0ZVBhcnRzIDogW10sXG4gICAgICAgICAgICBtZXJpZGllbSAgICAgICAgOiBudWxsXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0UGFyc2luZ0ZsYWdzKG0pIHtcbiAgICAgICAgaWYgKG0uX3BmID09IG51bGwpIHtcbiAgICAgICAgICAgIG0uX3BmID0gZGVmYXVsdFBhcnNpbmdGbGFncygpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtLl9wZjtcbiAgICB9XG5cbiAgICB2YXIgc29tZTtcbiAgICBpZiAoQXJyYXkucHJvdG90eXBlLnNvbWUpIHtcbiAgICAgICAgc29tZSA9IEFycmF5LnByb3RvdHlwZS5zb21lO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHNvbWUgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgICAgICAgICB2YXIgdCA9IE9iamVjdCh0aGlzKTtcbiAgICAgICAgICAgIHZhciBsZW4gPSB0Lmxlbmd0aCA+Pj4gMDtcblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChpIGluIHQgJiYgZnVuLmNhbGwodGhpcywgdFtpXSwgaSwgdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdmFsaWRfX2lzVmFsaWQobSkge1xuICAgICAgICBpZiAobS5faXNWYWxpZCA9PSBudWxsKSB7XG4gICAgICAgICAgICB2YXIgZmxhZ3MgPSBnZXRQYXJzaW5nRmxhZ3MobSk7XG4gICAgICAgICAgICB2YXIgcGFyc2VkUGFydHMgPSBzb21lLmNhbGwoZmxhZ3MucGFyc2VkRGF0ZVBhcnRzLCBmdW5jdGlvbiAoaSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBpICE9IG51bGw7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIG0uX2lzVmFsaWQgPSAhaXNOYU4obS5fZC5nZXRUaW1lKCkpICYmXG4gICAgICAgICAgICAgICAgZmxhZ3Mub3ZlcmZsb3cgPCAwICYmXG4gICAgICAgICAgICAgICAgIWZsYWdzLmVtcHR5ICYmXG4gICAgICAgICAgICAgICAgIWZsYWdzLmludmFsaWRNb250aCAmJlxuICAgICAgICAgICAgICAgICFmbGFncy5pbnZhbGlkV2Vla2RheSAmJlxuICAgICAgICAgICAgICAgICFmbGFncy5udWxsSW5wdXQgJiZcbiAgICAgICAgICAgICAgICAhZmxhZ3MuaW52YWxpZEZvcm1hdCAmJlxuICAgICAgICAgICAgICAgICFmbGFncy51c2VySW52YWxpZGF0ZWQgJiZcbiAgICAgICAgICAgICAgICAoIWZsYWdzLm1lcmlkaWVtIHx8IChmbGFncy5tZXJpZGllbSAmJiBwYXJzZWRQYXJ0cykpO1xuXG4gICAgICAgICAgICBpZiAobS5fc3RyaWN0KSB7XG4gICAgICAgICAgICAgICAgbS5faXNWYWxpZCA9IG0uX2lzVmFsaWQgJiZcbiAgICAgICAgICAgICAgICAgICAgZmxhZ3MuY2hhcnNMZWZ0T3ZlciA9PT0gMCAmJlxuICAgICAgICAgICAgICAgICAgICBmbGFncy51bnVzZWRUb2tlbnMubGVuZ3RoID09PSAwICYmXG4gICAgICAgICAgICAgICAgICAgIGZsYWdzLmJpZ0hvdXIgPT09IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbS5faXNWYWxpZDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB2YWxpZF9fY3JlYXRlSW52YWxpZCAoZmxhZ3MpIHtcbiAgICAgICAgdmFyIG0gPSBjcmVhdGVfdXRjX19jcmVhdGVVVEMoTmFOKTtcbiAgICAgICAgaWYgKGZsYWdzICE9IG51bGwpIHtcbiAgICAgICAgICAgIGV4dGVuZChnZXRQYXJzaW5nRmxhZ3MobSksIGZsYWdzKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGdldFBhcnNpbmdGbGFncyhtKS51c2VySW52YWxpZGF0ZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNVbmRlZmluZWQoaW5wdXQpIHtcbiAgICAgICAgcmV0dXJuIGlucHV0ID09PSB2b2lkIDA7XG4gICAgfVxuXG4gICAgLy8gUGx1Z2lucyB0aGF0IGFkZCBwcm9wZXJ0aWVzIHNob3VsZCBhbHNvIGFkZCB0aGUga2V5IGhlcmUgKG51bGwgdmFsdWUpLFxuICAgIC8vIHNvIHdlIGNhbiBwcm9wZXJseSBjbG9uZSBvdXJzZWx2ZXMuXG4gICAgdmFyIG1vbWVudFByb3BlcnRpZXMgPSB1dGlsc19ob29rc19faG9va3MubW9tZW50UHJvcGVydGllcyA9IFtdO1xuXG4gICAgZnVuY3Rpb24gY29weUNvbmZpZyh0bywgZnJvbSkge1xuICAgICAgICB2YXIgaSwgcHJvcCwgdmFsO1xuXG4gICAgICAgIGlmICghaXNVbmRlZmluZWQoZnJvbS5faXNBTW9tZW50T2JqZWN0KSkge1xuICAgICAgICAgICAgdG8uX2lzQU1vbWVudE9iamVjdCA9IGZyb20uX2lzQU1vbWVudE9iamVjdDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWlzVW5kZWZpbmVkKGZyb20uX2kpKSB7XG4gICAgICAgICAgICB0by5faSA9IGZyb20uX2k7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpc1VuZGVmaW5lZChmcm9tLl9mKSkge1xuICAgICAgICAgICAgdG8uX2YgPSBmcm9tLl9mO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaXNVbmRlZmluZWQoZnJvbS5fbCkpIHtcbiAgICAgICAgICAgIHRvLl9sID0gZnJvbS5fbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWlzVW5kZWZpbmVkKGZyb20uX3N0cmljdCkpIHtcbiAgICAgICAgICAgIHRvLl9zdHJpY3QgPSBmcm9tLl9zdHJpY3Q7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpc1VuZGVmaW5lZChmcm9tLl90em0pKSB7XG4gICAgICAgICAgICB0by5fdHptID0gZnJvbS5fdHptO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaXNVbmRlZmluZWQoZnJvbS5faXNVVEMpKSB7XG4gICAgICAgICAgICB0by5faXNVVEMgPSBmcm9tLl9pc1VUQztcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWlzVW5kZWZpbmVkKGZyb20uX29mZnNldCkpIHtcbiAgICAgICAgICAgIHRvLl9vZmZzZXQgPSBmcm9tLl9vZmZzZXQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpc1VuZGVmaW5lZChmcm9tLl9wZikpIHtcbiAgICAgICAgICAgIHRvLl9wZiA9IGdldFBhcnNpbmdGbGFncyhmcm9tKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWlzVW5kZWZpbmVkKGZyb20uX2xvY2FsZSkpIHtcbiAgICAgICAgICAgIHRvLl9sb2NhbGUgPSBmcm9tLl9sb2NhbGU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobW9tZW50UHJvcGVydGllcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBmb3IgKGkgaW4gbW9tZW50UHJvcGVydGllcykge1xuICAgICAgICAgICAgICAgIHByb3AgPSBtb21lbnRQcm9wZXJ0aWVzW2ldO1xuICAgICAgICAgICAgICAgIHZhbCA9IGZyb21bcHJvcF07XG4gICAgICAgICAgICAgICAgaWYgKCFpc1VuZGVmaW5lZCh2YWwpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRvW3Byb3BdID0gdmFsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0bztcbiAgICB9XG5cbiAgICB2YXIgdXBkYXRlSW5Qcm9ncmVzcyA9IGZhbHNlO1xuXG4gICAgLy8gTW9tZW50IHByb3RvdHlwZSBvYmplY3RcbiAgICBmdW5jdGlvbiBNb21lbnQoY29uZmlnKSB7XG4gICAgICAgIGNvcHlDb25maWcodGhpcywgY29uZmlnKTtcbiAgICAgICAgdGhpcy5fZCA9IG5ldyBEYXRlKGNvbmZpZy5fZCAhPSBudWxsID8gY29uZmlnLl9kLmdldFRpbWUoKSA6IE5hTik7XG4gICAgICAgIC8vIFByZXZlbnQgaW5maW5pdGUgbG9vcCBpbiBjYXNlIHVwZGF0ZU9mZnNldCBjcmVhdGVzIG5ldyBtb21lbnRcbiAgICAgICAgLy8gb2JqZWN0cy5cbiAgICAgICAgaWYgKHVwZGF0ZUluUHJvZ3Jlc3MgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICB1cGRhdGVJblByb2dyZXNzID0gdHJ1ZTtcbiAgICAgICAgICAgIHV0aWxzX2hvb2tzX19ob29rcy51cGRhdGVPZmZzZXQodGhpcyk7XG4gICAgICAgICAgICB1cGRhdGVJblByb2dyZXNzID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc01vbWVudCAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogaW5zdGFuY2VvZiBNb21lbnQgfHwgKG9iaiAhPSBudWxsICYmIG9iai5faXNBTW9tZW50T2JqZWN0ICE9IG51bGwpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFic0Zsb29yIChudW1iZXIpIHtcbiAgICAgICAgaWYgKG51bWJlciA8IDApIHtcbiAgICAgICAgICAgIHJldHVybiBNYXRoLmNlaWwobnVtYmVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBNYXRoLmZsb29yKG51bWJlcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0b0ludChhcmd1bWVudEZvckNvZXJjaW9uKSB7XG4gICAgICAgIHZhciBjb2VyY2VkTnVtYmVyID0gK2FyZ3VtZW50Rm9yQ29lcmNpb24sXG4gICAgICAgICAgICB2YWx1ZSA9IDA7XG5cbiAgICAgICAgaWYgKGNvZXJjZWROdW1iZXIgIT09IDAgJiYgaXNGaW5pdGUoY29lcmNlZE51bWJlcikpIHtcbiAgICAgICAgICAgIHZhbHVlID0gYWJzRmxvb3IoY29lcmNlZE51bWJlcik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgLy8gY29tcGFyZSB0d28gYXJyYXlzLCByZXR1cm4gdGhlIG51bWJlciBvZiBkaWZmZXJlbmNlc1xuICAgIGZ1bmN0aW9uIGNvbXBhcmVBcnJheXMoYXJyYXkxLCBhcnJheTIsIGRvbnRDb252ZXJ0KSB7XG4gICAgICAgIHZhciBsZW4gPSBNYXRoLm1pbihhcnJheTEubGVuZ3RoLCBhcnJheTIubGVuZ3RoKSxcbiAgICAgICAgICAgIGxlbmd0aERpZmYgPSBNYXRoLmFicyhhcnJheTEubGVuZ3RoIC0gYXJyYXkyLmxlbmd0aCksXG4gICAgICAgICAgICBkaWZmcyA9IDAsXG4gICAgICAgICAgICBpO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmICgoZG9udENvbnZlcnQgJiYgYXJyYXkxW2ldICE9PSBhcnJheTJbaV0pIHx8XG4gICAgICAgICAgICAgICAgKCFkb250Q29udmVydCAmJiB0b0ludChhcnJheTFbaV0pICE9PSB0b0ludChhcnJheTJbaV0pKSkge1xuICAgICAgICAgICAgICAgIGRpZmZzKys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRpZmZzICsgbGVuZ3RoRGlmZjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB3YXJuKG1zZykge1xuICAgICAgICBpZiAodXRpbHNfaG9va3NfX2hvb2tzLnN1cHByZXNzRGVwcmVjYXRpb25XYXJuaW5ncyA9PT0gZmFsc2UgJiZcbiAgICAgICAgICAgICAgICAodHlwZW9mIGNvbnNvbGUgIT09ICAndW5kZWZpbmVkJykgJiYgY29uc29sZS53YXJuKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ0RlcHJlY2F0aW9uIHdhcm5pbmc6ICcgKyBtc2cpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGVwcmVjYXRlKG1zZywgZm4pIHtcbiAgICAgICAgdmFyIGZpcnN0VGltZSA9IHRydWU7XG5cbiAgICAgICAgcmV0dXJuIGV4dGVuZChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAodXRpbHNfaG9va3NfX2hvb2tzLmRlcHJlY2F0aW9uSGFuZGxlciAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdXRpbHNfaG9va3NfX2hvb2tzLmRlcHJlY2F0aW9uSGFuZGxlcihudWxsLCBtc2cpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGZpcnN0VGltZSkge1xuICAgICAgICAgICAgICAgIHdhcm4obXNnICsgJ1xcbkFyZ3VtZW50czogJyArIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykuam9pbignLCAnKSArICdcXG4nICsgKG5ldyBFcnJvcigpKS5zdGFjayk7XG4gICAgICAgICAgICAgICAgZmlyc3RUaW1lID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgfSwgZm4pO1xuICAgIH1cblxuICAgIHZhciBkZXByZWNhdGlvbnMgPSB7fTtcblxuICAgIGZ1bmN0aW9uIGRlcHJlY2F0ZVNpbXBsZShuYW1lLCBtc2cpIHtcbiAgICAgICAgaWYgKHV0aWxzX2hvb2tzX19ob29rcy5kZXByZWNhdGlvbkhhbmRsZXIgIT0gbnVsbCkge1xuICAgICAgICAgICAgdXRpbHNfaG9va3NfX2hvb2tzLmRlcHJlY2F0aW9uSGFuZGxlcihuYW1lLCBtc2cpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghZGVwcmVjYXRpb25zW25hbWVdKSB7XG4gICAgICAgICAgICB3YXJuKG1zZyk7XG4gICAgICAgICAgICBkZXByZWNhdGlvbnNbbmFtZV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLnN1cHByZXNzRGVwcmVjYXRpb25XYXJuaW5ncyA9IGZhbHNlO1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy5kZXByZWNhdGlvbkhhbmRsZXIgPSBudWxsO1xuXG4gICAgZnVuY3Rpb24gaXNGdW5jdGlvbihpbnB1dCkge1xuICAgICAgICByZXR1cm4gaW5wdXQgaW5zdGFuY2VvZiBGdW5jdGlvbiB8fCBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaW5wdXQpID09PSAnW29iamVjdCBGdW5jdGlvbl0nO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzT2JqZWN0KGlucHV0KSB7XG4gICAgICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaW5wdXQpID09PSAnW29iamVjdCBPYmplY3RdJztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2NhbGVfc2V0X19zZXQgKGNvbmZpZykge1xuICAgICAgICB2YXIgcHJvcCwgaTtcbiAgICAgICAgZm9yIChpIGluIGNvbmZpZykge1xuICAgICAgICAgICAgcHJvcCA9IGNvbmZpZ1tpXTtcbiAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKHByb3ApKSB7XG4gICAgICAgICAgICAgICAgdGhpc1tpXSA9IHByb3A7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXNbJ18nICsgaV0gPSBwcm9wO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2NvbmZpZyA9IGNvbmZpZztcbiAgICAgICAgLy8gTGVuaWVudCBvcmRpbmFsIHBhcnNpbmcgYWNjZXB0cyBqdXN0IGEgbnVtYmVyIGluIGFkZGl0aW9uIHRvXG4gICAgICAgIC8vIG51bWJlciArIChwb3NzaWJseSkgc3R1ZmYgY29taW5nIGZyb20gX29yZGluYWxQYXJzZUxlbmllbnQuXG4gICAgICAgIHRoaXMuX29yZGluYWxQYXJzZUxlbmllbnQgPSBuZXcgUmVnRXhwKHRoaXMuX29yZGluYWxQYXJzZS5zb3VyY2UgKyAnfCcgKyAoL1xcZHsxLDJ9Lykuc291cmNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtZXJnZUNvbmZpZ3MocGFyZW50Q29uZmlnLCBjaGlsZENvbmZpZykge1xuICAgICAgICB2YXIgcmVzID0gZXh0ZW5kKHt9LCBwYXJlbnRDb25maWcpLCBwcm9wO1xuICAgICAgICBmb3IgKHByb3AgaW4gY2hpbGRDb25maWcpIHtcbiAgICAgICAgICAgIGlmIChoYXNPd25Qcm9wKGNoaWxkQ29uZmlnLCBwcm9wKSkge1xuICAgICAgICAgICAgICAgIGlmIChpc09iamVjdChwYXJlbnRDb25maWdbcHJvcF0pICYmIGlzT2JqZWN0KGNoaWxkQ29uZmlnW3Byb3BdKSkge1xuICAgICAgICAgICAgICAgICAgICByZXNbcHJvcF0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgZXh0ZW5kKHJlc1twcm9wXSwgcGFyZW50Q29uZmlnW3Byb3BdKTtcbiAgICAgICAgICAgICAgICAgICAgZXh0ZW5kKHJlc1twcm9wXSwgY2hpbGRDb25maWdbcHJvcF0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2hpbGRDb25maWdbcHJvcF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICByZXNbcHJvcF0gPSBjaGlsZENvbmZpZ1twcm9wXTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgcmVzW3Byb3BdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIExvY2FsZShjb25maWcpIHtcbiAgICAgICAgaWYgKGNvbmZpZyAhPSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLnNldChjb25maWcpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGtleXM7XG5cbiAgICBpZiAoT2JqZWN0LmtleXMpIHtcbiAgICAgICAga2V5cyA9IE9iamVjdC5rZXlzO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGtleXMgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICB2YXIgaSwgcmVzID0gW107XG4gICAgICAgICAgICBmb3IgKGkgaW4gb2JqKSB7XG4gICAgICAgICAgICAgICAgaWYgKGhhc093blByb3Aob2JqLCBpKSkge1xuICAgICAgICAgICAgICAgICAgICByZXMucHVzaChpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIGludGVybmFsIHN0b3JhZ2UgZm9yIGxvY2FsZSBjb25maWcgZmlsZXNcbiAgICB2YXIgbG9jYWxlcyA9IHt9O1xuICAgIHZhciBnbG9iYWxMb2NhbGU7XG5cbiAgICBmdW5jdGlvbiBub3JtYWxpemVMb2NhbGUoa2V5KSB7XG4gICAgICAgIHJldHVybiBrZXkgPyBrZXkudG9Mb3dlckNhc2UoKS5yZXBsYWNlKCdfJywgJy0nKSA6IGtleTtcbiAgICB9XG5cbiAgICAvLyBwaWNrIHRoZSBsb2NhbGUgZnJvbSB0aGUgYXJyYXlcbiAgICAvLyB0cnkgWydlbi1hdScsICdlbi1nYiddIGFzICdlbi1hdScsICdlbi1nYicsICdlbicsIGFzIGluIG1vdmUgdGhyb3VnaCB0aGUgbGlzdCB0cnlpbmcgZWFjaFxuICAgIC8vIHN1YnN0cmluZyBmcm9tIG1vc3Qgc3BlY2lmaWMgdG8gbGVhc3QsIGJ1dCBtb3ZlIHRvIHRoZSBuZXh0IGFycmF5IGl0ZW0gaWYgaXQncyBhIG1vcmUgc3BlY2lmaWMgdmFyaWFudCB0aGFuIHRoZSBjdXJyZW50IHJvb3RcbiAgICBmdW5jdGlvbiBjaG9vc2VMb2NhbGUobmFtZXMpIHtcbiAgICAgICAgdmFyIGkgPSAwLCBqLCBuZXh0LCBsb2NhbGUsIHNwbGl0O1xuXG4gICAgICAgIHdoaWxlIChpIDwgbmFtZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBzcGxpdCA9IG5vcm1hbGl6ZUxvY2FsZShuYW1lc1tpXSkuc3BsaXQoJy0nKTtcbiAgICAgICAgICAgIGogPSBzcGxpdC5sZW5ndGg7XG4gICAgICAgICAgICBuZXh0ID0gbm9ybWFsaXplTG9jYWxlKG5hbWVzW2kgKyAxXSk7XG4gICAgICAgICAgICBuZXh0ID0gbmV4dCA/IG5leHQuc3BsaXQoJy0nKSA6IG51bGw7XG4gICAgICAgICAgICB3aGlsZSAoaiA+IDApIHtcbiAgICAgICAgICAgICAgICBsb2NhbGUgPSBsb2FkTG9jYWxlKHNwbGl0LnNsaWNlKDAsIGopLmpvaW4oJy0nKSk7XG4gICAgICAgICAgICAgICAgaWYgKGxvY2FsZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbG9jYWxlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAobmV4dCAmJiBuZXh0Lmxlbmd0aCA+PSBqICYmIGNvbXBhcmVBcnJheXMoc3BsaXQsIG5leHQsIHRydWUpID49IGogLSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vdGhlIG5leHQgYXJyYXkgaXRlbSBpcyBiZXR0ZXIgdGhhbiBhIHNoYWxsb3dlciBzdWJzdHJpbmcgb2YgdGhpcyBvbmVcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGotLTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkTG9jYWxlKG5hbWUpIHtcbiAgICAgICAgdmFyIG9sZExvY2FsZSA9IG51bGw7XG4gICAgICAgIC8vIFRPRE86IEZpbmQgYSBiZXR0ZXIgd2F5IHRvIHJlZ2lzdGVyIGFuZCBsb2FkIGFsbCB0aGUgbG9jYWxlcyBpbiBOb2RlXG4gICAgICAgIGlmICghbG9jYWxlc1tuYW1lXSAmJiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcpICYmXG4gICAgICAgICAgICAgICAgbW9kdWxlICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIG9sZExvY2FsZSA9IGdsb2JhbExvY2FsZS5fYWJicjtcbiAgICAgICAgICAgICAgICByZXF1aXJlKCcuL2xvY2FsZS8nICsgbmFtZSk7XG4gICAgICAgICAgICAgICAgLy8gYmVjYXVzZSBkZWZpbmVMb2NhbGUgY3VycmVudGx5IGFsc28gc2V0cyB0aGUgZ2xvYmFsIGxvY2FsZSwgd2VcbiAgICAgICAgICAgICAgICAvLyB3YW50IHRvIHVuZG8gdGhhdCBmb3IgbGF6eSBsb2FkZWQgbG9jYWxlc1xuICAgICAgICAgICAgICAgIGxvY2FsZV9sb2NhbGVzX19nZXRTZXRHbG9iYWxMb2NhbGUob2xkTG9jYWxlKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHsgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBsb2NhbGVzW25hbWVdO1xuICAgIH1cblxuICAgIC8vIFRoaXMgZnVuY3Rpb24gd2lsbCBsb2FkIGxvY2FsZSBhbmQgdGhlbiBzZXQgdGhlIGdsb2JhbCBsb2NhbGUuICBJZlxuICAgIC8vIG5vIGFyZ3VtZW50cyBhcmUgcGFzc2VkIGluLCBpdCB3aWxsIHNpbXBseSByZXR1cm4gdGhlIGN1cnJlbnQgZ2xvYmFsXG4gICAgLy8gbG9jYWxlIGtleS5cbiAgICBmdW5jdGlvbiBsb2NhbGVfbG9jYWxlc19fZ2V0U2V0R2xvYmFsTG9jYWxlIChrZXksIHZhbHVlcykge1xuICAgICAgICB2YXIgZGF0YTtcbiAgICAgICAgaWYgKGtleSkge1xuICAgICAgICAgICAgaWYgKGlzVW5kZWZpbmVkKHZhbHVlcykpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gbG9jYWxlX2xvY2FsZXNfX2dldExvY2FsZShrZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9IGRlZmluZUxvY2FsZShrZXksIHZhbHVlcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgLy8gbW9tZW50LmR1cmF0aW9uLl9sb2NhbGUgPSBtb21lbnQuX2xvY2FsZSA9IGRhdGE7XG4gICAgICAgICAgICAgICAgZ2xvYmFsTG9jYWxlID0gZGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBnbG9iYWxMb2NhbGUuX2FiYnI7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGVmaW5lTG9jYWxlIChuYW1lLCBjb25maWcpIHtcbiAgICAgICAgaWYgKGNvbmZpZyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY29uZmlnLmFiYnIgPSBuYW1lO1xuICAgICAgICAgICAgaWYgKGxvY2FsZXNbbmFtZV0gIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGRlcHJlY2F0ZVNpbXBsZSgnZGVmaW5lTG9jYWxlT3ZlcnJpZGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3VzZSBtb21lbnQudXBkYXRlTG9jYWxlKGxvY2FsZU5hbWUsIGNvbmZpZykgdG8gY2hhbmdlICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ2FuIGV4aXN0aW5nIGxvY2FsZS4gbW9tZW50LmRlZmluZUxvY2FsZShsb2NhbGVOYW1lLCAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdjb25maWcpIHNob3VsZCBvbmx5IGJlIHVzZWQgZm9yIGNyZWF0aW5nIGEgbmV3IGxvY2FsZScpO1xuICAgICAgICAgICAgICAgIGNvbmZpZyA9IG1lcmdlQ29uZmlncyhsb2NhbGVzW25hbWVdLl9jb25maWcsIGNvbmZpZyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNvbmZpZy5wYXJlbnRMb2NhbGUgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGlmIChsb2NhbGVzW2NvbmZpZy5wYXJlbnRMb2NhbGVdICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnID0gbWVyZ2VDb25maWdzKGxvY2FsZXNbY29uZmlnLnBhcmVudExvY2FsZV0uX2NvbmZpZywgY29uZmlnKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyB0cmVhdCBhcyBpZiB0aGVyZSBpcyBubyBiYXNlIGNvbmZpZ1xuICAgICAgICAgICAgICAgICAgICBkZXByZWNhdGVTaW1wbGUoJ3BhcmVudExvY2FsZVVuZGVmaW5lZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3NwZWNpZmllZCBwYXJlbnRMb2NhbGUgaXMgbm90IGRlZmluZWQgeWV0Jyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9jYWxlc1tuYW1lXSA9IG5ldyBMb2NhbGUoY29uZmlnKTtcblxuICAgICAgICAgICAgLy8gYmFja3dhcmRzIGNvbXBhdCBmb3Igbm93OiBhbHNvIHNldCB0aGUgbG9jYWxlXG4gICAgICAgICAgICBsb2NhbGVfbG9jYWxlc19fZ2V0U2V0R2xvYmFsTG9jYWxlKG5hbWUpO1xuXG4gICAgICAgICAgICByZXR1cm4gbG9jYWxlc1tuYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHVzZWZ1bCBmb3IgdGVzdGluZ1xuICAgICAgICAgICAgZGVsZXRlIGxvY2FsZXNbbmFtZV07XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHVwZGF0ZUxvY2FsZShuYW1lLCBjb25maWcpIHtcbiAgICAgICAgaWYgKGNvbmZpZyAhPSBudWxsKSB7XG4gICAgICAgICAgICB2YXIgbG9jYWxlO1xuICAgICAgICAgICAgaWYgKGxvY2FsZXNbbmFtZV0gIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbmZpZyA9IG1lcmdlQ29uZmlncyhsb2NhbGVzW25hbWVdLl9jb25maWcsIGNvbmZpZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsb2NhbGUgPSBuZXcgTG9jYWxlKGNvbmZpZyk7XG4gICAgICAgICAgICBsb2NhbGUucGFyZW50TG9jYWxlID0gbG9jYWxlc1tuYW1lXTtcbiAgICAgICAgICAgIGxvY2FsZXNbbmFtZV0gPSBsb2NhbGU7XG5cbiAgICAgICAgICAgIC8vIGJhY2t3YXJkcyBjb21wYXQgZm9yIG5vdzogYWxzbyBzZXQgdGhlIGxvY2FsZVxuICAgICAgICAgICAgbG9jYWxlX2xvY2FsZXNfX2dldFNldEdsb2JhbExvY2FsZShuYW1lKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHBhc3MgbnVsbCBmb3IgY29uZmlnIHRvIHVudXBkYXRlLCB1c2VmdWwgZm9yIHRlc3RzXG4gICAgICAgICAgICBpZiAobG9jYWxlc1tuYW1lXSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgaWYgKGxvY2FsZXNbbmFtZV0ucGFyZW50TG9jYWxlICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxlc1tuYW1lXSA9IGxvY2FsZXNbbmFtZV0ucGFyZW50TG9jYWxlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobG9jYWxlc1tuYW1lXSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBsb2NhbGVzW25hbWVdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbG9jYWxlc1tuYW1lXTtcbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIGxvY2FsZSBkYXRhXG4gICAgZnVuY3Rpb24gbG9jYWxlX2xvY2FsZXNfX2dldExvY2FsZSAoa2V5KSB7XG4gICAgICAgIHZhciBsb2NhbGU7XG5cbiAgICAgICAgaWYgKGtleSAmJiBrZXkuX2xvY2FsZSAmJiBrZXkuX2xvY2FsZS5fYWJicikge1xuICAgICAgICAgICAga2V5ID0ga2V5Ll9sb2NhbGUuX2FiYnI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWtleSkge1xuICAgICAgICAgICAgcmV0dXJuIGdsb2JhbExvY2FsZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaXNBcnJheShrZXkpKSB7XG4gICAgICAgICAgICAvL3Nob3J0LWNpcmN1aXQgZXZlcnl0aGluZyBlbHNlXG4gICAgICAgICAgICBsb2NhbGUgPSBsb2FkTG9jYWxlKGtleSk7XG4gICAgICAgICAgICBpZiAobG9jYWxlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxvY2FsZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGtleSA9IFtrZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNob29zZUxvY2FsZShrZXkpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvY2FsZV9sb2NhbGVzX19saXN0TG9jYWxlcygpIHtcbiAgICAgICAgcmV0dXJuIGtleXMobG9jYWxlcyk7XG4gICAgfVxuXG4gICAgdmFyIGFsaWFzZXMgPSB7fTtcblxuICAgIGZ1bmN0aW9uIGFkZFVuaXRBbGlhcyAodW5pdCwgc2hvcnRoYW5kKSB7XG4gICAgICAgIHZhciBsb3dlckNhc2UgPSB1bml0LnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGFsaWFzZXNbbG93ZXJDYXNlXSA9IGFsaWFzZXNbbG93ZXJDYXNlICsgJ3MnXSA9IGFsaWFzZXNbc2hvcnRoYW5kXSA9IHVuaXQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbm9ybWFsaXplVW5pdHModW5pdHMpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiB1bml0cyA9PT0gJ3N0cmluZycgPyBhbGlhc2VzW3VuaXRzXSB8fCBhbGlhc2VzW3VuaXRzLnRvTG93ZXJDYXNlKCldIDogdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG5vcm1hbGl6ZU9iamVjdFVuaXRzKGlucHV0T2JqZWN0KSB7XG4gICAgICAgIHZhciBub3JtYWxpemVkSW5wdXQgPSB7fSxcbiAgICAgICAgICAgIG5vcm1hbGl6ZWRQcm9wLFxuICAgICAgICAgICAgcHJvcDtcblxuICAgICAgICBmb3IgKHByb3AgaW4gaW5wdXRPYmplY3QpIHtcbiAgICAgICAgICAgIGlmIChoYXNPd25Qcm9wKGlucHV0T2JqZWN0LCBwcm9wKSkge1xuICAgICAgICAgICAgICAgIG5vcm1hbGl6ZWRQcm9wID0gbm9ybWFsaXplVW5pdHMocHJvcCk7XG4gICAgICAgICAgICAgICAgaWYgKG5vcm1hbGl6ZWRQcm9wKSB7XG4gICAgICAgICAgICAgICAgICAgIG5vcm1hbGl6ZWRJbnB1dFtub3JtYWxpemVkUHJvcF0gPSBpbnB1dE9iamVjdFtwcm9wXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbm9ybWFsaXplZElucHV0O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1ha2VHZXRTZXQgKHVuaXQsIGtlZXBUaW1lKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgZ2V0X3NldF9fc2V0KHRoaXMsIHVuaXQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1dGlsc19ob29rc19faG9va3MudXBkYXRlT2Zmc2V0KHRoaXMsIGtlZXBUaW1lKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldF9zZXRfX2dldCh0aGlzLCB1bml0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRfc2V0X19nZXQgKG1vbSwgdW5pdCkge1xuICAgICAgICByZXR1cm4gbW9tLmlzVmFsaWQoKSA/XG4gICAgICAgICAgICBtb20uX2RbJ2dldCcgKyAobW9tLl9pc1VUQyA/ICdVVEMnIDogJycpICsgdW5pdF0oKSA6IE5hTjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRfc2V0X19zZXQgKG1vbSwgdW5pdCwgdmFsdWUpIHtcbiAgICAgICAgaWYgKG1vbS5pc1ZhbGlkKCkpIHtcbiAgICAgICAgICAgIG1vbS5fZFsnc2V0JyArIChtb20uX2lzVVRDID8gJ1VUQycgOiAnJykgKyB1bml0XSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNT01FTlRTXG5cbiAgICBmdW5jdGlvbiBnZXRTZXQgKHVuaXRzLCB2YWx1ZSkge1xuICAgICAgICB2YXIgdW5pdDtcbiAgICAgICAgaWYgKHR5cGVvZiB1bml0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGZvciAodW5pdCBpbiB1bml0cykge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0KHVuaXQsIHVuaXRzW3VuaXRdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVuaXRzID0gbm9ybWFsaXplVW5pdHModW5pdHMpO1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24odGhpc1t1bml0c10pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXNbdW5pdHNdKHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB6ZXJvRmlsbChudW1iZXIsIHRhcmdldExlbmd0aCwgZm9yY2VTaWduKSB7XG4gICAgICAgIHZhciBhYnNOdW1iZXIgPSAnJyArIE1hdGguYWJzKG51bWJlciksXG4gICAgICAgICAgICB6ZXJvc1RvRmlsbCA9IHRhcmdldExlbmd0aCAtIGFic051bWJlci5sZW5ndGgsXG4gICAgICAgICAgICBzaWduID0gbnVtYmVyID49IDA7XG4gICAgICAgIHJldHVybiAoc2lnbiA/IChmb3JjZVNpZ24gPyAnKycgOiAnJykgOiAnLScpICtcbiAgICAgICAgICAgIE1hdGgucG93KDEwLCBNYXRoLm1heCgwLCB6ZXJvc1RvRmlsbCkpLnRvU3RyaW5nKCkuc3Vic3RyKDEpICsgYWJzTnVtYmVyO1xuICAgIH1cblxuICAgIHZhciBmb3JtYXR0aW5nVG9rZW5zID0gLyhcXFtbXlxcW10qXFxdKXwoXFxcXCk/KFtIaF1tbShzcyk/fE1vfE1NP00/TT98RG98REREb3xERD9EP0Q/fGRkZD9kP3xkbz98d1tvfHddP3xXW298V10/fFFvP3xZWVlZWVl8WVlZWVl8WVlZWXxZWXxnZyhnZ2c/KT98R0coR0dHPyk/fGV8RXxhfEF8aGg/fEhIP3xraz98bW0/fHNzP3xTezEsOX18eHxYfHp6P3xaWj98LikvZztcblxuICAgIHZhciBsb2NhbEZvcm1hdHRpbmdUb2tlbnMgPSAvKFxcW1teXFxbXSpcXF0pfChcXFxcKT8oTFRTfExUfExMP0w/TD98bHsxLDR9KS9nO1xuXG4gICAgdmFyIGZvcm1hdEZ1bmN0aW9ucyA9IHt9O1xuXG4gICAgdmFyIGZvcm1hdFRva2VuRnVuY3Rpb25zID0ge307XG5cbiAgICAvLyB0b2tlbjogICAgJ00nXG4gICAgLy8gcGFkZGVkOiAgIFsnTU0nLCAyXVxuICAgIC8vIG9yZGluYWw6ICAnTW8nXG4gICAgLy8gY2FsbGJhY2s6IGZ1bmN0aW9uICgpIHsgdGhpcy5tb250aCgpICsgMSB9XG4gICAgZnVuY3Rpb24gYWRkRm9ybWF0VG9rZW4gKHRva2VuLCBwYWRkZWQsIG9yZGluYWwsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBmdW5jID0gY2FsbGJhY2s7XG4gICAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBmdW5jID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzW2NhbGxiYWNrXSgpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgICAgIGZvcm1hdFRva2VuRnVuY3Rpb25zW3Rva2VuXSA9IGZ1bmM7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhZGRlZCkge1xuICAgICAgICAgICAgZm9ybWF0VG9rZW5GdW5jdGlvbnNbcGFkZGVkWzBdXSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gemVyb0ZpbGwoZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpLCBwYWRkZWRbMV0sIHBhZGRlZFsyXSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcmRpbmFsKSB7XG4gICAgICAgICAgICBmb3JtYXRUb2tlbkZ1bmN0aW9uc1tvcmRpbmFsXSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5sb2NhbGVEYXRhKCkub3JkaW5hbChmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyksIHRva2VuKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZW1vdmVGb3JtYXR0aW5nVG9rZW5zKGlucHV0KSB7XG4gICAgICAgIGlmIChpbnB1dC5tYXRjaCgvXFxbW1xcc1xcU10vKSkge1xuICAgICAgICAgICAgcmV0dXJuIGlucHV0LnJlcGxhY2UoL15cXFt8XFxdJC9nLCAnJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGlucHV0LnJlcGxhY2UoL1xcXFwvZywgJycpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1ha2VGb3JtYXRGdW5jdGlvbihmb3JtYXQpIHtcbiAgICAgICAgdmFyIGFycmF5ID0gZm9ybWF0Lm1hdGNoKGZvcm1hdHRpbmdUb2tlbnMpLCBpLCBsZW5ndGg7XG5cbiAgICAgICAgZm9yIChpID0gMCwgbGVuZ3RoID0gYXJyYXkubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChmb3JtYXRUb2tlbkZ1bmN0aW9uc1thcnJheVtpXV0pIHtcbiAgICAgICAgICAgICAgICBhcnJheVtpXSA9IGZvcm1hdFRva2VuRnVuY3Rpb25zW2FycmF5W2ldXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXJyYXlbaV0gPSByZW1vdmVGb3JtYXR0aW5nVG9rZW5zKGFycmF5W2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAobW9tKSB7XG4gICAgICAgICAgICB2YXIgb3V0cHV0ID0gJycsIGk7XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBvdXRwdXQgKz0gYXJyYXlbaV0gaW5zdGFuY2VvZiBGdW5jdGlvbiA/IGFycmF5W2ldLmNhbGwobW9tLCBmb3JtYXQpIDogYXJyYXlbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIGZvcm1hdCBkYXRlIHVzaW5nIG5hdGl2ZSBkYXRlIG9iamVjdFxuICAgIGZ1bmN0aW9uIGZvcm1hdE1vbWVudChtLCBmb3JtYXQpIHtcbiAgICAgICAgaWYgKCFtLmlzVmFsaWQoKSkge1xuICAgICAgICAgICAgcmV0dXJuIG0ubG9jYWxlRGF0YSgpLmludmFsaWREYXRlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3JtYXQgPSBleHBhbmRGb3JtYXQoZm9ybWF0LCBtLmxvY2FsZURhdGEoKSk7XG4gICAgICAgIGZvcm1hdEZ1bmN0aW9uc1tmb3JtYXRdID0gZm9ybWF0RnVuY3Rpb25zW2Zvcm1hdF0gfHwgbWFrZUZvcm1hdEZ1bmN0aW9uKGZvcm1hdCk7XG5cbiAgICAgICAgcmV0dXJuIGZvcm1hdEZ1bmN0aW9uc1tmb3JtYXRdKG0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGV4cGFuZEZvcm1hdChmb3JtYXQsIGxvY2FsZSkge1xuICAgICAgICB2YXIgaSA9IDU7XG5cbiAgICAgICAgZnVuY3Rpb24gcmVwbGFjZUxvbmdEYXRlRm9ybWF0VG9rZW5zKGlucHV0KSB7XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxlLmxvbmdEYXRlRm9ybWF0KGlucHV0KSB8fCBpbnB1dDtcbiAgICAgICAgfVxuXG4gICAgICAgIGxvY2FsRm9ybWF0dGluZ1Rva2Vucy5sYXN0SW5kZXggPSAwO1xuICAgICAgICB3aGlsZSAoaSA+PSAwICYmIGxvY2FsRm9ybWF0dGluZ1Rva2Vucy50ZXN0KGZvcm1hdCkpIHtcbiAgICAgICAgICAgIGZvcm1hdCA9IGZvcm1hdC5yZXBsYWNlKGxvY2FsRm9ybWF0dGluZ1Rva2VucywgcmVwbGFjZUxvbmdEYXRlRm9ybWF0VG9rZW5zKTtcbiAgICAgICAgICAgIGxvY2FsRm9ybWF0dGluZ1Rva2Vucy5sYXN0SW5kZXggPSAwO1xuICAgICAgICAgICAgaSAtPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZvcm1hdDtcbiAgICB9XG5cbiAgICB2YXIgbWF0Y2gxICAgICAgICAgPSAvXFxkLzsgICAgICAgICAgICAvLyAgICAgICAwIC0gOVxuICAgIHZhciBtYXRjaDIgICAgICAgICA9IC9cXGRcXGQvOyAgICAgICAgICAvLyAgICAgIDAwIC0gOTlcbiAgICB2YXIgbWF0Y2gzICAgICAgICAgPSAvXFxkezN9LzsgICAgICAgICAvLyAgICAgMDAwIC0gOTk5XG4gICAgdmFyIG1hdGNoNCAgICAgICAgID0gL1xcZHs0fS87ICAgICAgICAgLy8gICAgMDAwMCAtIDk5OTlcbiAgICB2YXIgbWF0Y2g2ICAgICAgICAgPSAvWystXT9cXGR7Nn0vOyAgICAvLyAtOTk5OTk5IC0gOTk5OTk5XG4gICAgdmFyIG1hdGNoMXRvMiAgICAgID0gL1xcZFxcZD8vOyAgICAgICAgIC8vICAgICAgIDAgLSA5OVxuICAgIHZhciBtYXRjaDN0bzQgICAgICA9IC9cXGRcXGRcXGRcXGQ/LzsgICAgIC8vICAgICA5OTkgLSA5OTk5XG4gICAgdmFyIG1hdGNoNXRvNiAgICAgID0gL1xcZFxcZFxcZFxcZFxcZFxcZD8vOyAvLyAgIDk5OTk5IC0gOTk5OTk5XG4gICAgdmFyIG1hdGNoMXRvMyAgICAgID0gL1xcZHsxLDN9LzsgICAgICAgLy8gICAgICAgMCAtIDk5OVxuICAgIHZhciBtYXRjaDF0bzQgICAgICA9IC9cXGR7MSw0fS87ICAgICAgIC8vICAgICAgIDAgLSA5OTk5XG4gICAgdmFyIG1hdGNoMXRvNiAgICAgID0gL1srLV0/XFxkezEsNn0vOyAgLy8gLTk5OTk5OSAtIDk5OTk5OVxuXG4gICAgdmFyIG1hdGNoVW5zaWduZWQgID0gL1xcZCsvOyAgICAgICAgICAgLy8gICAgICAgMCAtIGluZlxuICAgIHZhciBtYXRjaFNpZ25lZCAgICA9IC9bKy1dP1xcZCsvOyAgICAgIC8vICAgIC1pbmYgLSBpbmZcblxuICAgIHZhciBtYXRjaE9mZnNldCAgICA9IC9afFsrLV1cXGRcXGQ6P1xcZFxcZC9naTsgLy8gKzAwOjAwIC0wMDowMCArMDAwMCAtMDAwMCBvciBaXG4gICAgdmFyIG1hdGNoU2hvcnRPZmZzZXQgPSAvWnxbKy1dXFxkXFxkKD86Oj9cXGRcXGQpPy9naTsgLy8gKzAwIC0wMCArMDA6MDAgLTAwOjAwICswMDAwIC0wMDAwIG9yIFpcblxuICAgIHZhciBtYXRjaFRpbWVzdGFtcCA9IC9bKy1dP1xcZCsoXFwuXFxkezEsM30pPy87IC8vIDEyMzQ1Njc4OSAxMjM0NTY3ODkuMTIzXG5cbiAgICAvLyBhbnkgd29yZCAob3IgdHdvKSBjaGFyYWN0ZXJzIG9yIG51bWJlcnMgaW5jbHVkaW5nIHR3by90aHJlZSB3b3JkIG1vbnRoIGluIGFyYWJpYy5cbiAgICAvLyBpbmNsdWRlcyBzY290dGlzaCBnYWVsaWMgdHdvIHdvcmQgYW5kIGh5cGhlbmF0ZWQgbW9udGhzXG4gICAgdmFyIG1hdGNoV29yZCA9IC9bMC05XSpbJ2EtelxcdTAwQTAtXFx1MDVGRlxcdTA3MDAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0rfFtcXHUwNjAwLVxcdTA2RkZcXC9dKyhcXHMqP1tcXHUwNjAwLVxcdTA2RkZdKyl7MSwyfS9pO1xuXG5cbiAgICB2YXIgcmVnZXhlcyA9IHt9O1xuXG4gICAgZnVuY3Rpb24gYWRkUmVnZXhUb2tlbiAodG9rZW4sIHJlZ2V4LCBzdHJpY3RSZWdleCkge1xuICAgICAgICByZWdleGVzW3Rva2VuXSA9IGlzRnVuY3Rpb24ocmVnZXgpID8gcmVnZXggOiBmdW5jdGlvbiAoaXNTdHJpY3QsIGxvY2FsZURhdGEpIHtcbiAgICAgICAgICAgIHJldHVybiAoaXNTdHJpY3QgJiYgc3RyaWN0UmVnZXgpID8gc3RyaWN0UmVnZXggOiByZWdleDtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRQYXJzZVJlZ2V4Rm9yVG9rZW4gKHRva2VuLCBjb25maWcpIHtcbiAgICAgICAgaWYgKCFoYXNPd25Qcm9wKHJlZ2V4ZXMsIHRva2VuKSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBSZWdFeHAodW5lc2NhcGVGb3JtYXQodG9rZW4pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZWdleGVzW3Rva2VuXShjb25maWcuX3N0cmljdCwgY29uZmlnLl9sb2NhbGUpO1xuICAgIH1cblxuICAgIC8vIENvZGUgZnJvbSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzM1NjE0OTMvaXMtdGhlcmUtYS1yZWdleHAtZXNjYXBlLWZ1bmN0aW9uLWluLWphdmFzY3JpcHRcbiAgICBmdW5jdGlvbiB1bmVzY2FwZUZvcm1hdChzKSB7XG4gICAgICAgIHJldHVybiByZWdleEVzY2FwZShzLnJlcGxhY2UoJ1xcXFwnLCAnJykucmVwbGFjZSgvXFxcXChcXFspfFxcXFwoXFxdKXxcXFsoW15cXF1cXFtdKilcXF18XFxcXCguKS9nLCBmdW5jdGlvbiAobWF0Y2hlZCwgcDEsIHAyLCBwMywgcDQpIHtcbiAgICAgICAgICAgIHJldHVybiBwMSB8fCBwMiB8fCBwMyB8fCBwNDtcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlZ2V4RXNjYXBlKHMpIHtcbiAgICAgICAgcmV0dXJuIHMucmVwbGFjZSgvWy1cXC9cXFxcXiQqKz8uKCl8W1xcXXt9XS9nLCAnXFxcXCQmJyk7XG4gICAgfVxuXG4gICAgdmFyIHRva2VucyA9IHt9O1xuXG4gICAgZnVuY3Rpb24gYWRkUGFyc2VUb2tlbiAodG9rZW4sIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBpLCBmdW5jID0gY2FsbGJhY2s7XG4gICAgICAgIGlmICh0eXBlb2YgdG9rZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB0b2tlbiA9IFt0b2tlbl07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGZ1bmMgPSBmdW5jdGlvbiAoaW5wdXQsIGFycmF5KSB7XG4gICAgICAgICAgICAgICAgYXJyYXlbY2FsbGJhY2tdID0gdG9JbnQoaW5wdXQpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdG9rZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRva2Vuc1t0b2tlbltpXV0gPSBmdW5jO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkV2Vla1BhcnNlVG9rZW4gKHRva2VuLCBjYWxsYmFjaykge1xuICAgICAgICBhZGRQYXJzZVRva2VuKHRva2VuLCBmdW5jdGlvbiAoaW5wdXQsIGFycmF5LCBjb25maWcsIHRva2VuKSB7XG4gICAgICAgICAgICBjb25maWcuX3cgPSBjb25maWcuX3cgfHwge307XG4gICAgICAgICAgICBjYWxsYmFjayhpbnB1dCwgY29uZmlnLl93LCBjb25maWcsIHRva2VuKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkVGltZVRvQXJyYXlGcm9tVG9rZW4odG9rZW4sIGlucHV0LCBjb25maWcpIHtcbiAgICAgICAgaWYgKGlucHV0ICE9IG51bGwgJiYgaGFzT3duUHJvcCh0b2tlbnMsIHRva2VuKSkge1xuICAgICAgICAgICAgdG9rZW5zW3Rva2VuXShpbnB1dCwgY29uZmlnLl9hLCBjb25maWcsIHRva2VuKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBZRUFSID0gMDtcbiAgICB2YXIgTU9OVEggPSAxO1xuICAgIHZhciBEQVRFID0gMjtcbiAgICB2YXIgSE9VUiA9IDM7XG4gICAgdmFyIE1JTlVURSA9IDQ7XG4gICAgdmFyIFNFQ09ORCA9IDU7XG4gICAgdmFyIE1JTExJU0VDT05EID0gNjtcbiAgICB2YXIgV0VFSyA9IDc7XG4gICAgdmFyIFdFRUtEQVkgPSA4O1xuXG4gICAgdmFyIGluZGV4T2Y7XG5cbiAgICBpZiAoQXJyYXkucHJvdG90eXBlLmluZGV4T2YpIHtcbiAgICAgICAgaW5kZXhPZiA9IEFycmF5LnByb3RvdHlwZS5pbmRleE9mO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGluZGV4T2YgPSBmdW5jdGlvbiAobykge1xuICAgICAgICAgICAgLy8gSSBrbm93XG4gICAgICAgICAgICB2YXIgaTtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXNbaV0gPT09IG8pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRheXNJbk1vbnRoKHllYXIsIG1vbnRoKSB7XG4gICAgICAgIHJldHVybiBuZXcgRGF0ZShEYXRlLlVUQyh5ZWFyLCBtb250aCArIDEsIDApKS5nZXRVVENEYXRlKCk7XG4gICAgfVxuXG4gICAgLy8gRk9STUFUVElOR1xuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ00nLCBbJ01NJywgMl0sICdNbycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubW9udGgoKSArIDE7XG4gICAgfSk7XG5cbiAgICBhZGRGb3JtYXRUb2tlbignTU1NJywgMCwgMCwgZnVuY3Rpb24gKGZvcm1hdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbGVEYXRhKCkubW9udGhzU2hvcnQodGhpcywgZm9ybWF0KTtcbiAgICB9KTtcblxuICAgIGFkZEZvcm1hdFRva2VuKCdNTU1NJywgMCwgMCwgZnVuY3Rpb24gKGZvcm1hdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbGVEYXRhKCkubW9udGhzKHRoaXMsIGZvcm1hdCk7XG4gICAgfSk7XG5cbiAgICAvLyBBTElBU0VTXG5cbiAgICBhZGRVbml0QWxpYXMoJ21vbnRoJywgJ00nKTtcblxuICAgIC8vIFBBUlNJTkdcblxuICAgIGFkZFJlZ2V4VG9rZW4oJ00nLCAgICBtYXRjaDF0bzIpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ01NJywgICBtYXRjaDF0bzIsIG1hdGNoMik7XG4gICAgYWRkUmVnZXhUb2tlbignTU1NJywgIGZ1bmN0aW9uIChpc1N0cmljdCwgbG9jYWxlKSB7XG4gICAgICAgIHJldHVybiBsb2NhbGUubW9udGhzU2hvcnRSZWdleChpc1N0cmljdCk7XG4gICAgfSk7XG4gICAgYWRkUmVnZXhUb2tlbignTU1NTScsIGZ1bmN0aW9uIChpc1N0cmljdCwgbG9jYWxlKSB7XG4gICAgICAgIHJldHVybiBsb2NhbGUubW9udGhzUmVnZXgoaXNTdHJpY3QpO1xuICAgIH0pO1xuXG4gICAgYWRkUGFyc2VUb2tlbihbJ00nLCAnTU0nXSwgZnVuY3Rpb24gKGlucHV0LCBhcnJheSkge1xuICAgICAgICBhcnJheVtNT05USF0gPSB0b0ludChpbnB1dCkgLSAxO1xuICAgIH0pO1xuXG4gICAgYWRkUGFyc2VUb2tlbihbJ01NTScsICdNTU1NJ10sIGZ1bmN0aW9uIChpbnB1dCwgYXJyYXksIGNvbmZpZywgdG9rZW4pIHtcbiAgICAgICAgdmFyIG1vbnRoID0gY29uZmlnLl9sb2NhbGUubW9udGhzUGFyc2UoaW5wdXQsIHRva2VuLCBjb25maWcuX3N0cmljdCk7XG4gICAgICAgIC8vIGlmIHdlIGRpZG4ndCBmaW5kIGEgbW9udGggbmFtZSwgbWFyayB0aGUgZGF0ZSBhcyBpbnZhbGlkLlxuICAgICAgICBpZiAobW9udGggIT0gbnVsbCkge1xuICAgICAgICAgICAgYXJyYXlbTU9OVEhdID0gbW9udGg7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBnZXRQYXJzaW5nRmxhZ3MoY29uZmlnKS5pbnZhbGlkTW9udGggPSBpbnB1dDtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gTE9DQUxFU1xuXG4gICAgdmFyIE1PTlRIU19JTl9GT1JNQVQgPSAvRFtvRF0/KFxcW1teXFxbXFxdXSpcXF18XFxzKykrTU1NTT8vO1xuICAgIHZhciBkZWZhdWx0TG9jYWxlTW9udGhzID0gJ0phbnVhcnlfRmVicnVhcnlfTWFyY2hfQXByaWxfTWF5X0p1bmVfSnVseV9BdWd1c3RfU2VwdGVtYmVyX09jdG9iZXJfTm92ZW1iZXJfRGVjZW1iZXInLnNwbGl0KCdfJyk7XG4gICAgZnVuY3Rpb24gbG9jYWxlTW9udGhzIChtLCBmb3JtYXQpIHtcbiAgICAgICAgcmV0dXJuIGlzQXJyYXkodGhpcy5fbW9udGhzKSA/IHRoaXMuX21vbnRoc1ttLm1vbnRoKCldIDpcbiAgICAgICAgICAgIHRoaXMuX21vbnRoc1tNT05USFNfSU5fRk9STUFULnRlc3QoZm9ybWF0KSA/ICdmb3JtYXQnIDogJ3N0YW5kYWxvbmUnXVttLm1vbnRoKCldO1xuICAgIH1cblxuICAgIHZhciBkZWZhdWx0TG9jYWxlTW9udGhzU2hvcnQgPSAnSmFuX0ZlYl9NYXJfQXByX01heV9KdW5fSnVsX0F1Z19TZXBfT2N0X05vdl9EZWMnLnNwbGl0KCdfJyk7XG4gICAgZnVuY3Rpb24gbG9jYWxlTW9udGhzU2hvcnQgKG0sIGZvcm1hdCkge1xuICAgICAgICByZXR1cm4gaXNBcnJheSh0aGlzLl9tb250aHNTaG9ydCkgPyB0aGlzLl9tb250aHNTaG9ydFttLm1vbnRoKCldIDpcbiAgICAgICAgICAgIHRoaXMuX21vbnRoc1Nob3J0W01PTlRIU19JTl9GT1JNQVQudGVzdChmb3JtYXQpID8gJ2Zvcm1hdCcgOiAnc3RhbmRhbG9uZSddW20ubW9udGgoKV07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdW5pdHNfbW9udGhfX2hhbmRsZVN0cmljdFBhcnNlKG1vbnRoTmFtZSwgZm9ybWF0LCBzdHJpY3QpIHtcbiAgICAgICAgdmFyIGksIGlpLCBtb20sIGxsYyA9IG1vbnRoTmFtZS50b0xvY2FsZUxvd2VyQ2FzZSgpO1xuICAgICAgICBpZiAoIXRoaXMuX21vbnRoc1BhcnNlKSB7XG4gICAgICAgICAgICAvLyB0aGlzIGlzIG5vdCB1c2VkXG4gICAgICAgICAgICB0aGlzLl9tb250aHNQYXJzZSA9IFtdO1xuICAgICAgICAgICAgdGhpcy5fbG9uZ01vbnRoc1BhcnNlID0gW107XG4gICAgICAgICAgICB0aGlzLl9zaG9ydE1vbnRoc1BhcnNlID0gW107XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgMTI7ICsraSkge1xuICAgICAgICAgICAgICAgIG1vbSA9IGNyZWF0ZV91dGNfX2NyZWF0ZVVUQyhbMjAwMCwgaV0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX3Nob3J0TW9udGhzUGFyc2VbaV0gPSB0aGlzLm1vbnRoc1Nob3J0KG1vbSwgJycpLnRvTG9jYWxlTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9uZ01vbnRoc1BhcnNlW2ldID0gdGhpcy5tb250aHMobW9tLCAnJykudG9Mb2NhbGVMb3dlckNhc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzdHJpY3QpIHtcbiAgICAgICAgICAgIGlmIChmb3JtYXQgPT09ICdNTU0nKSB7XG4gICAgICAgICAgICAgICAgaWkgPSBpbmRleE9mLmNhbGwodGhpcy5fc2hvcnRNb250aHNQYXJzZSwgbGxjKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gaWkgIT09IC0xID8gaWkgOiBudWxsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpaSA9IGluZGV4T2YuY2FsbCh0aGlzLl9sb25nTW9udGhzUGFyc2UsIGxsYyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGlpICE9PSAtMSA/IGlpIDogbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChmb3JtYXQgPT09ICdNTU0nKSB7XG4gICAgICAgICAgICAgICAgaWkgPSBpbmRleE9mLmNhbGwodGhpcy5fc2hvcnRNb250aHNQYXJzZSwgbGxjKTtcbiAgICAgICAgICAgICAgICBpZiAoaWkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpaTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWkgPSBpbmRleE9mLmNhbGwodGhpcy5fbG9uZ01vbnRoc1BhcnNlLCBsbGMpO1xuICAgICAgICAgICAgICAgIHJldHVybiBpaSAhPT0gLTEgPyBpaSA6IG51bGw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlpID0gaW5kZXhPZi5jYWxsKHRoaXMuX2xvbmdNb250aHNQYXJzZSwgbGxjKTtcbiAgICAgICAgICAgICAgICBpZiAoaWkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpaTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWkgPSBpbmRleE9mLmNhbGwodGhpcy5fc2hvcnRNb250aHNQYXJzZSwgbGxjKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gaWkgIT09IC0xID8gaWkgOiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9jYWxlTW9udGhzUGFyc2UgKG1vbnRoTmFtZSwgZm9ybWF0LCBzdHJpY3QpIHtcbiAgICAgICAgdmFyIGksIG1vbSwgcmVnZXg7XG5cbiAgICAgICAgaWYgKHRoaXMuX21vbnRoc1BhcnNlRXhhY3QpIHtcbiAgICAgICAgICAgIHJldHVybiB1bml0c19tb250aF9faGFuZGxlU3RyaWN0UGFyc2UuY2FsbCh0aGlzLCBtb250aE5hbWUsIGZvcm1hdCwgc3RyaWN0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fbW9udGhzUGFyc2UpIHtcbiAgICAgICAgICAgIHRoaXMuX21vbnRoc1BhcnNlID0gW107XG4gICAgICAgICAgICB0aGlzLl9sb25nTW9udGhzUGFyc2UgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuX3Nob3J0TW9udGhzUGFyc2UgPSBbXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRPRE86IGFkZCBzb3J0aW5nXG4gICAgICAgIC8vIFNvcnRpbmcgbWFrZXMgc3VyZSBpZiBvbmUgbW9udGggKG9yIGFiYnIpIGlzIGEgcHJlZml4IG9mIGFub3RoZXJcbiAgICAgICAgLy8gc2VlIHNvcnRpbmcgaW4gY29tcHV0ZU1vbnRoc1BhcnNlXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCAxMjsgaSsrKSB7XG4gICAgICAgICAgICAvLyBtYWtlIHRoZSByZWdleCBpZiB3ZSBkb24ndCBoYXZlIGl0IGFscmVhZHlcbiAgICAgICAgICAgIG1vbSA9IGNyZWF0ZV91dGNfX2NyZWF0ZVVUQyhbMjAwMCwgaV0pO1xuICAgICAgICAgICAgaWYgKHN0cmljdCAmJiAhdGhpcy5fbG9uZ01vbnRoc1BhcnNlW2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9uZ01vbnRoc1BhcnNlW2ldID0gbmV3IFJlZ0V4cCgnXicgKyB0aGlzLm1vbnRocyhtb20sICcnKS5yZXBsYWNlKCcuJywgJycpICsgJyQnLCAnaScpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3Nob3J0TW9udGhzUGFyc2VbaV0gPSBuZXcgUmVnRXhwKCdeJyArIHRoaXMubW9udGhzU2hvcnQobW9tLCAnJykucmVwbGFjZSgnLicsICcnKSArICckJywgJ2knKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghc3RyaWN0ICYmICF0aGlzLl9tb250aHNQYXJzZVtpXSkge1xuICAgICAgICAgICAgICAgIHJlZ2V4ID0gJ14nICsgdGhpcy5tb250aHMobW9tLCAnJykgKyAnfF4nICsgdGhpcy5tb250aHNTaG9ydChtb20sICcnKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9tb250aHNQYXJzZVtpXSA9IG5ldyBSZWdFeHAocmVnZXgucmVwbGFjZSgnLicsICcnKSwgJ2knKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHRlc3QgdGhlIHJlZ2V4XG4gICAgICAgICAgICBpZiAoc3RyaWN0ICYmIGZvcm1hdCA9PT0gJ01NTU0nICYmIHRoaXMuX2xvbmdNb250aHNQYXJzZVtpXS50ZXN0KG1vbnRoTmFtZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RyaWN0ICYmIGZvcm1hdCA9PT0gJ01NTScgJiYgdGhpcy5fc2hvcnRNb250aHNQYXJzZVtpXS50ZXN0KG1vbnRoTmFtZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXN0cmljdCAmJiB0aGlzLl9tb250aHNQYXJzZVtpXS50ZXN0KG1vbnRoTmFtZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1PTUVOVFNcblxuICAgIGZ1bmN0aW9uIHNldE1vbnRoIChtb20sIHZhbHVlKSB7XG4gICAgICAgIHZhciBkYXlPZk1vbnRoO1xuXG4gICAgICAgIGlmICghbW9tLmlzVmFsaWQoKSkge1xuICAgICAgICAgICAgLy8gTm8gb3BcbiAgICAgICAgICAgIHJldHVybiBtb207XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgaWYgKC9eXFxkKyQvLnRlc3QodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSB0b0ludCh2YWx1ZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gbW9tLmxvY2FsZURhdGEoKS5tb250aHNQYXJzZSh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgLy8gVE9ETzogQW5vdGhlciBzaWxlbnQgZmFpbHVyZT9cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbW9tO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGRheU9mTW9udGggPSBNYXRoLm1pbihtb20uZGF0ZSgpLCBkYXlzSW5Nb250aChtb20ueWVhcigpLCB2YWx1ZSkpO1xuICAgICAgICBtb20uX2RbJ3NldCcgKyAobW9tLl9pc1VUQyA/ICdVVEMnIDogJycpICsgJ01vbnRoJ10odmFsdWUsIGRheU9mTW9udGgpO1xuICAgICAgICByZXR1cm4gbW9tO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNldE1vbnRoICh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgc2V0TW9udGgodGhpcywgdmFsdWUpO1xuICAgICAgICAgICAgdXRpbHNfaG9va3NfX2hvb2tzLnVwZGF0ZU9mZnNldCh0aGlzLCB0cnVlKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGdldF9zZXRfX2dldCh0aGlzLCAnTW9udGgnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldERheXNJbk1vbnRoICgpIHtcbiAgICAgICAgcmV0dXJuIGRheXNJbk1vbnRoKHRoaXMueWVhcigpLCB0aGlzLm1vbnRoKCkpO1xuICAgIH1cblxuICAgIHZhciBkZWZhdWx0TW9udGhzU2hvcnRSZWdleCA9IG1hdGNoV29yZDtcbiAgICBmdW5jdGlvbiBtb250aHNTaG9ydFJlZ2V4IChpc1N0cmljdCkge1xuICAgICAgICBpZiAodGhpcy5fbW9udGhzUGFyc2VFeGFjdCkge1xuICAgICAgICAgICAgaWYgKCFoYXNPd25Qcm9wKHRoaXMsICdfbW9udGhzUmVnZXgnKSkge1xuICAgICAgICAgICAgICAgIGNvbXB1dGVNb250aHNQYXJzZS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzU3RyaWN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21vbnRoc1Nob3J0U3RyaWN0UmVnZXg7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9tb250aHNTaG9ydFJlZ2V4O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21vbnRoc1Nob3J0U3RyaWN0UmVnZXggJiYgaXNTdHJpY3QgP1xuICAgICAgICAgICAgICAgIHRoaXMuX21vbnRoc1Nob3J0U3RyaWN0UmVnZXggOiB0aGlzLl9tb250aHNTaG9ydFJlZ2V4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGRlZmF1bHRNb250aHNSZWdleCA9IG1hdGNoV29yZDtcbiAgICBmdW5jdGlvbiBtb250aHNSZWdleCAoaXNTdHJpY3QpIHtcbiAgICAgICAgaWYgKHRoaXMuX21vbnRoc1BhcnNlRXhhY3QpIHtcbiAgICAgICAgICAgIGlmICghaGFzT3duUHJvcCh0aGlzLCAnX21vbnRoc1JlZ2V4JykpIHtcbiAgICAgICAgICAgICAgICBjb21wdXRlTW9udGhzUGFyc2UuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpc1N0cmljdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9tb250aHNTdHJpY3RSZWdleDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21vbnRoc1JlZ2V4O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21vbnRoc1N0cmljdFJlZ2V4ICYmIGlzU3RyaWN0ID9cbiAgICAgICAgICAgICAgICB0aGlzLl9tb250aHNTdHJpY3RSZWdleCA6IHRoaXMuX21vbnRoc1JlZ2V4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY29tcHV0ZU1vbnRoc1BhcnNlICgpIHtcbiAgICAgICAgZnVuY3Rpb24gY21wTGVuUmV2KGEsIGIpIHtcbiAgICAgICAgICAgIHJldHVybiBiLmxlbmd0aCAtIGEubGVuZ3RoO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHNob3J0UGllY2VzID0gW10sIGxvbmdQaWVjZXMgPSBbXSwgbWl4ZWRQaWVjZXMgPSBbXSxcbiAgICAgICAgICAgIGksIG1vbTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IDEyOyBpKyspIHtcbiAgICAgICAgICAgIC8vIG1ha2UgdGhlIHJlZ2V4IGlmIHdlIGRvbid0IGhhdmUgaXQgYWxyZWFkeVxuICAgICAgICAgICAgbW9tID0gY3JlYXRlX3V0Y19fY3JlYXRlVVRDKFsyMDAwLCBpXSk7XG4gICAgICAgICAgICBzaG9ydFBpZWNlcy5wdXNoKHRoaXMubW9udGhzU2hvcnQobW9tLCAnJykpO1xuICAgICAgICAgICAgbG9uZ1BpZWNlcy5wdXNoKHRoaXMubW9udGhzKG1vbSwgJycpKTtcbiAgICAgICAgICAgIG1peGVkUGllY2VzLnB1c2godGhpcy5tb250aHMobW9tLCAnJykpO1xuICAgICAgICAgICAgbWl4ZWRQaWVjZXMucHVzaCh0aGlzLm1vbnRoc1Nob3J0KG1vbSwgJycpKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBTb3J0aW5nIG1ha2VzIHN1cmUgaWYgb25lIG1vbnRoIChvciBhYmJyKSBpcyBhIHByZWZpeCBvZiBhbm90aGVyIGl0XG4gICAgICAgIC8vIHdpbGwgbWF0Y2ggdGhlIGxvbmdlciBwaWVjZS5cbiAgICAgICAgc2hvcnRQaWVjZXMuc29ydChjbXBMZW5SZXYpO1xuICAgICAgICBsb25nUGllY2VzLnNvcnQoY21wTGVuUmV2KTtcbiAgICAgICAgbWl4ZWRQaWVjZXMuc29ydChjbXBMZW5SZXYpO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgMTI7IGkrKykge1xuICAgICAgICAgICAgc2hvcnRQaWVjZXNbaV0gPSByZWdleEVzY2FwZShzaG9ydFBpZWNlc1tpXSk7XG4gICAgICAgICAgICBsb25nUGllY2VzW2ldID0gcmVnZXhFc2NhcGUobG9uZ1BpZWNlc1tpXSk7XG4gICAgICAgICAgICBtaXhlZFBpZWNlc1tpXSA9IHJlZ2V4RXNjYXBlKG1peGVkUGllY2VzW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX21vbnRoc1JlZ2V4ID0gbmV3IFJlZ0V4cCgnXignICsgbWl4ZWRQaWVjZXMuam9pbignfCcpICsgJyknLCAnaScpO1xuICAgICAgICB0aGlzLl9tb250aHNTaG9ydFJlZ2V4ID0gdGhpcy5fbW9udGhzUmVnZXg7XG4gICAgICAgIHRoaXMuX21vbnRoc1N0cmljdFJlZ2V4ID0gbmV3IFJlZ0V4cCgnXignICsgbG9uZ1BpZWNlcy5qb2luKCd8JykgKyAnKScsICdpJyk7XG4gICAgICAgIHRoaXMuX21vbnRoc1Nob3J0U3RyaWN0UmVnZXggPSBuZXcgUmVnRXhwKCdeKCcgKyBzaG9ydFBpZWNlcy5qb2luKCd8JykgKyAnKScsICdpJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2hlY2tPdmVyZmxvdyAobSkge1xuICAgICAgICB2YXIgb3ZlcmZsb3c7XG4gICAgICAgIHZhciBhID0gbS5fYTtcblxuICAgICAgICBpZiAoYSAmJiBnZXRQYXJzaW5nRmxhZ3MobSkub3ZlcmZsb3cgPT09IC0yKSB7XG4gICAgICAgICAgICBvdmVyZmxvdyA9XG4gICAgICAgICAgICAgICAgYVtNT05USF0gICAgICAgPCAwIHx8IGFbTU9OVEhdICAgICAgID4gMTEgID8gTU9OVEggOlxuICAgICAgICAgICAgICAgIGFbREFURV0gICAgICAgIDwgMSB8fCBhW0RBVEVdICAgICAgICA+IGRheXNJbk1vbnRoKGFbWUVBUl0sIGFbTU9OVEhdKSA/IERBVEUgOlxuICAgICAgICAgICAgICAgIGFbSE9VUl0gICAgICAgIDwgMCB8fCBhW0hPVVJdICAgICAgICA+IDI0IHx8IChhW0hPVVJdID09PSAyNCAmJiAoYVtNSU5VVEVdICE9PSAwIHx8IGFbU0VDT05EXSAhPT0gMCB8fCBhW01JTExJU0VDT05EXSAhPT0gMCkpID8gSE9VUiA6XG4gICAgICAgICAgICAgICAgYVtNSU5VVEVdICAgICAgPCAwIHx8IGFbTUlOVVRFXSAgICAgID4gNTkgID8gTUlOVVRFIDpcbiAgICAgICAgICAgICAgICBhW1NFQ09ORF0gICAgICA8IDAgfHwgYVtTRUNPTkRdICAgICAgPiA1OSAgPyBTRUNPTkQgOlxuICAgICAgICAgICAgICAgIGFbTUlMTElTRUNPTkRdIDwgMCB8fCBhW01JTExJU0VDT05EXSA+IDk5OSA/IE1JTExJU0VDT05EIDpcbiAgICAgICAgICAgICAgICAtMTtcblxuICAgICAgICAgICAgaWYgKGdldFBhcnNpbmdGbGFncyhtKS5fb3ZlcmZsb3dEYXlPZlllYXIgJiYgKG92ZXJmbG93IDwgWUVBUiB8fCBvdmVyZmxvdyA+IERBVEUpKSB7XG4gICAgICAgICAgICAgICAgb3ZlcmZsb3cgPSBEQVRFO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGdldFBhcnNpbmdGbGFncyhtKS5fb3ZlcmZsb3dXZWVrcyAmJiBvdmVyZmxvdyA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICBvdmVyZmxvdyA9IFdFRUs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZ2V0UGFyc2luZ0ZsYWdzKG0pLl9vdmVyZmxvd1dlZWtkYXkgJiYgb3ZlcmZsb3cgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgb3ZlcmZsb3cgPSBXRUVLREFZO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBnZXRQYXJzaW5nRmxhZ3MobSkub3ZlcmZsb3cgPSBvdmVyZmxvdztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBtO1xuICAgIH1cblxuICAgIC8vIGlzbyA4NjAxIHJlZ2V4XG4gICAgLy8gMDAwMC0wMC0wMCAwMDAwLVcwMCBvciAwMDAwLVcwMC0wICsgVCArIDAwIG9yIDAwOjAwIG9yIDAwOjAwOjAwIG9yIDAwOjAwOjAwLjAwMCArICswMDowMCBvciArMDAwMCBvciArMDApXG4gICAgdmFyIGV4dGVuZGVkSXNvUmVnZXggPSAvXlxccyooKD86WystXVxcZHs2fXxcXGR7NH0pLSg/OlxcZFxcZC1cXGRcXGR8V1xcZFxcZC1cXGR8V1xcZFxcZHxcXGRcXGRcXGR8XFxkXFxkKSkoPzooVHwgKShcXGRcXGQoPzo6XFxkXFxkKD86OlxcZFxcZCg/OlsuLF1cXGQrKT8pPyk/KShbXFwrXFwtXVxcZFxcZCg/Ojo/XFxkXFxkKT98XFxzKlopPyk/LztcbiAgICB2YXIgYmFzaWNJc29SZWdleCA9IC9eXFxzKigoPzpbKy1dXFxkezZ9fFxcZHs0fSkoPzpcXGRcXGRcXGRcXGR8V1xcZFxcZFxcZHxXXFxkXFxkfFxcZFxcZFxcZHxcXGRcXGQpKSg/OihUfCApKFxcZFxcZCg/OlxcZFxcZCg/OlxcZFxcZCg/OlsuLF1cXGQrKT8pPyk/KShbXFwrXFwtXVxcZFxcZCg/Ojo/XFxkXFxkKT98XFxzKlopPyk/LztcblxuICAgIHZhciB0elJlZ2V4ID0gL1p8WystXVxcZFxcZCg/Ojo/XFxkXFxkKT8vO1xuXG4gICAgdmFyIGlzb0RhdGVzID0gW1xuICAgICAgICBbJ1lZWVlZWS1NTS1ERCcsIC9bKy1dXFxkezZ9LVxcZFxcZC1cXGRcXGQvXSxcbiAgICAgICAgWydZWVlZLU1NLUREJywgL1xcZHs0fS1cXGRcXGQtXFxkXFxkL10sXG4gICAgICAgIFsnR0dHRy1bV11XVy1FJywgL1xcZHs0fS1XXFxkXFxkLVxcZC9dLFxuICAgICAgICBbJ0dHR0ctW1ddV1cnLCAvXFxkezR9LVdcXGRcXGQvLCBmYWxzZV0sXG4gICAgICAgIFsnWVlZWS1EREQnLCAvXFxkezR9LVxcZHszfS9dLFxuICAgICAgICBbJ1lZWVktTU0nLCAvXFxkezR9LVxcZFxcZC8sIGZhbHNlXSxcbiAgICAgICAgWydZWVlZWVlNTUREJywgL1srLV1cXGR7MTB9L10sXG4gICAgICAgIFsnWVlZWU1NREQnLCAvXFxkezh9L10sXG4gICAgICAgIC8vIFlZWVlNTSBpcyBOT1QgYWxsb3dlZCBieSB0aGUgc3RhbmRhcmRcbiAgICAgICAgWydHR0dHW1ddV1dFJywgL1xcZHs0fVdcXGR7M30vXSxcbiAgICAgICAgWydHR0dHW1ddV1cnLCAvXFxkezR9V1xcZHsyfS8sIGZhbHNlXSxcbiAgICAgICAgWydZWVlZREREJywgL1xcZHs3fS9dXG4gICAgXTtcblxuICAgIC8vIGlzbyB0aW1lIGZvcm1hdHMgYW5kIHJlZ2V4ZXNcbiAgICB2YXIgaXNvVGltZXMgPSBbXG4gICAgICAgIFsnSEg6bW06c3MuU1NTUycsIC9cXGRcXGQ6XFxkXFxkOlxcZFxcZFxcLlxcZCsvXSxcbiAgICAgICAgWydISDptbTpzcyxTU1NTJywgL1xcZFxcZDpcXGRcXGQ6XFxkXFxkLFxcZCsvXSxcbiAgICAgICAgWydISDptbTpzcycsIC9cXGRcXGQ6XFxkXFxkOlxcZFxcZC9dLFxuICAgICAgICBbJ0hIOm1tJywgL1xcZFxcZDpcXGRcXGQvXSxcbiAgICAgICAgWydISG1tc3MuU1NTUycsIC9cXGRcXGRcXGRcXGRcXGRcXGRcXC5cXGQrL10sXG4gICAgICAgIFsnSEhtbXNzLFNTU1MnLCAvXFxkXFxkXFxkXFxkXFxkXFxkLFxcZCsvXSxcbiAgICAgICAgWydISG1tc3MnLCAvXFxkXFxkXFxkXFxkXFxkXFxkL10sXG4gICAgICAgIFsnSEhtbScsIC9cXGRcXGRcXGRcXGQvXSxcbiAgICAgICAgWydISCcsIC9cXGRcXGQvXVxuICAgIF07XG5cbiAgICB2YXIgYXNwTmV0SnNvblJlZ2V4ID0gL15cXC8/RGF0ZVxcKChcXC0/XFxkKykvaTtcblxuICAgIC8vIGRhdGUgZnJvbSBpc28gZm9ybWF0XG4gICAgZnVuY3Rpb24gY29uZmlnRnJvbUlTTyhjb25maWcpIHtcbiAgICAgICAgdmFyIGksIGwsXG4gICAgICAgICAgICBzdHJpbmcgPSBjb25maWcuX2ksXG4gICAgICAgICAgICBtYXRjaCA9IGV4dGVuZGVkSXNvUmVnZXguZXhlYyhzdHJpbmcpIHx8IGJhc2ljSXNvUmVnZXguZXhlYyhzdHJpbmcpLFxuICAgICAgICAgICAgYWxsb3dUaW1lLCBkYXRlRm9ybWF0LCB0aW1lRm9ybWF0LCB0ekZvcm1hdDtcblxuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIGdldFBhcnNpbmdGbGFncyhjb25maWcpLmlzbyA9IHRydWU7XG5cbiAgICAgICAgICAgIGZvciAoaSA9IDAsIGwgPSBpc29EYXRlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNvRGF0ZXNbaV1bMV0uZXhlYyhtYXRjaFsxXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0ZUZvcm1hdCA9IGlzb0RhdGVzW2ldWzBdO1xuICAgICAgICAgICAgICAgICAgICBhbGxvd1RpbWUgPSBpc29EYXRlc1tpXVsyXSAhPT0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkYXRlRm9ybWF0ID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb25maWcuX2lzVmFsaWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobWF0Y2hbM10pIHtcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwLCBsID0gaXNvVGltZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc29UaW1lc1tpXVsxXS5leGVjKG1hdGNoWzNdKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbWF0Y2hbMl0gc2hvdWxkIGJlICdUJyBvciBzcGFjZVxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZUZvcm1hdCA9IChtYXRjaFsyXSB8fCAnICcpICsgaXNvVGltZXNbaV1bMF07XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodGltZUZvcm1hdCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZy5faXNWYWxpZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFhbGxvd1RpbWUgJiYgdGltZUZvcm1hdCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY29uZmlnLl9pc1ZhbGlkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG1hdGNoWzRdKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR6UmVnZXguZXhlYyhtYXRjaFs0XSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdHpGb3JtYXQgPSAnWic7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnLl9pc1ZhbGlkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25maWcuX2YgPSBkYXRlRm9ybWF0ICsgKHRpbWVGb3JtYXQgfHwgJycpICsgKHR6Rm9ybWF0IHx8ICcnKTtcbiAgICAgICAgICAgIGNvbmZpZ0Zyb21TdHJpbmdBbmRGb3JtYXQoY29uZmlnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbmZpZy5faXNWYWxpZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZGF0ZSBmcm9tIGlzbyBmb3JtYXQgb3IgZmFsbGJhY2tcbiAgICBmdW5jdGlvbiBjb25maWdGcm9tU3RyaW5nKGNvbmZpZykge1xuICAgICAgICB2YXIgbWF0Y2hlZCA9IGFzcE5ldEpzb25SZWdleC5leGVjKGNvbmZpZy5faSk7XG5cbiAgICAgICAgaWYgKG1hdGNoZWQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbmZpZy5fZCA9IG5ldyBEYXRlKCttYXRjaGVkWzFdKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbmZpZ0Zyb21JU08oY29uZmlnKTtcbiAgICAgICAgaWYgKGNvbmZpZy5faXNWYWxpZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBjb25maWcuX2lzVmFsaWQ7XG4gICAgICAgICAgICB1dGlsc19ob29rc19faG9va3MuY3JlYXRlRnJvbUlucHV0RmFsbGJhY2soY29uZmlnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHV0aWxzX2hvb2tzX19ob29rcy5jcmVhdGVGcm9tSW5wdXRGYWxsYmFjayA9IGRlcHJlY2F0ZShcbiAgICAgICAgJ21vbWVudCBjb25zdHJ1Y3Rpb24gZmFsbHMgYmFjayB0byBqcyBEYXRlLiBUaGlzIGlzICcgK1xuICAgICAgICAnZGlzY291cmFnZWQgYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiB1cGNvbWluZyBtYWpvciAnICtcbiAgICAgICAgJ3JlbGVhc2UuIFBsZWFzZSByZWZlciB0byAnICtcbiAgICAgICAgJ2h0dHBzOi8vZ2l0aHViLmNvbS9tb21lbnQvbW9tZW50L2lzc3Vlcy8xNDA3IGZvciBtb3JlIGluZm8uJyxcbiAgICAgICAgZnVuY3Rpb24gKGNvbmZpZykge1xuICAgICAgICAgICAgY29uZmlnLl9kID0gbmV3IERhdGUoY29uZmlnLl9pICsgKGNvbmZpZy5fdXNlVVRDID8gJyBVVEMnIDogJycpKTtcbiAgICAgICAgfVxuICAgICk7XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVEYXRlICh5LCBtLCBkLCBoLCBNLCBzLCBtcykge1xuICAgICAgICAvL2Nhbid0IGp1c3QgYXBwbHkoKSB0byBjcmVhdGUgYSBkYXRlOlxuICAgICAgICAvL2h0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTgxMzQ4L2luc3RhbnRpYXRpbmctYS1qYXZhc2NyaXB0LW9iamVjdC1ieS1jYWxsaW5nLXByb3RvdHlwZS1jb25zdHJ1Y3Rvci1hcHBseVxuICAgICAgICB2YXIgZGF0ZSA9IG5ldyBEYXRlKHksIG0sIGQsIGgsIE0sIHMsIG1zKTtcblxuICAgICAgICAvL3RoZSBkYXRlIGNvbnN0cnVjdG9yIHJlbWFwcyB5ZWFycyAwLTk5IHRvIDE5MDAtMTk5OVxuICAgICAgICBpZiAoeSA8IDEwMCAmJiB5ID49IDAgJiYgaXNGaW5pdGUoZGF0ZS5nZXRGdWxsWWVhcigpKSkge1xuICAgICAgICAgICAgZGF0ZS5zZXRGdWxsWWVhcih5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGF0ZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVVVENEYXRlICh5KSB7XG4gICAgICAgIHZhciBkYXRlID0gbmV3IERhdGUoRGF0ZS5VVEMuYXBwbHkobnVsbCwgYXJndW1lbnRzKSk7XG5cbiAgICAgICAgLy90aGUgRGF0ZS5VVEMgZnVuY3Rpb24gcmVtYXBzIHllYXJzIDAtOTkgdG8gMTkwMC0xOTk5XG4gICAgICAgIGlmICh5IDwgMTAwICYmIHkgPj0gMCAmJiBpc0Zpbml0ZShkYXRlLmdldFVUQ0Z1bGxZZWFyKCkpKSB7XG4gICAgICAgICAgICBkYXRlLnNldFVUQ0Z1bGxZZWFyKHkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkYXRlO1xuICAgIH1cblxuICAgIC8vIEZPUk1BVFRJTkdcblxuICAgIGFkZEZvcm1hdFRva2VuKCdZJywgMCwgMCwgZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgeSA9IHRoaXMueWVhcigpO1xuICAgICAgICByZXR1cm4geSA8PSA5OTk5ID8gJycgKyB5IDogJysnICsgeTtcbiAgICB9KTtcblxuICAgIGFkZEZvcm1hdFRva2VuKDAsIFsnWVknLCAyXSwgMCwgZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy55ZWFyKCkgJSAxMDA7XG4gICAgfSk7XG5cbiAgICBhZGRGb3JtYXRUb2tlbigwLCBbJ1lZWVknLCAgIDRdLCAgICAgICAwLCAneWVhcicpO1xuICAgIGFkZEZvcm1hdFRva2VuKDAsIFsnWVlZWVknLCAgNV0sICAgICAgIDAsICd5ZWFyJyk7XG4gICAgYWRkRm9ybWF0VG9rZW4oMCwgWydZWVlZWVknLCA2LCB0cnVlXSwgMCwgJ3llYXInKTtcblxuICAgIC8vIEFMSUFTRVNcblxuICAgIGFkZFVuaXRBbGlhcygneWVhcicsICd5Jyk7XG5cbiAgICAvLyBQQVJTSU5HXG5cbiAgICBhZGRSZWdleFRva2VuKCdZJywgICAgICBtYXRjaFNpZ25lZCk7XG4gICAgYWRkUmVnZXhUb2tlbignWVknLCAgICAgbWF0Y2gxdG8yLCBtYXRjaDIpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ1lZWVknLCAgIG1hdGNoMXRvNCwgbWF0Y2g0KTtcbiAgICBhZGRSZWdleFRva2VuKCdZWVlZWScsICBtYXRjaDF0bzYsIG1hdGNoNik7XG4gICAgYWRkUmVnZXhUb2tlbignWVlZWVlZJywgbWF0Y2gxdG82LCBtYXRjaDYpO1xuXG4gICAgYWRkUGFyc2VUb2tlbihbJ1lZWVlZJywgJ1lZWVlZWSddLCBZRUFSKTtcbiAgICBhZGRQYXJzZVRva2VuKCdZWVlZJywgZnVuY3Rpb24gKGlucHV0LCBhcnJheSkge1xuICAgICAgICBhcnJheVtZRUFSXSA9IGlucHV0Lmxlbmd0aCA9PT0gMiA/IHV0aWxzX2hvb2tzX19ob29rcy5wYXJzZVR3b0RpZ2l0WWVhcihpbnB1dCkgOiB0b0ludChpbnB1dCk7XG4gICAgfSk7XG4gICAgYWRkUGFyc2VUb2tlbignWVknLCBmdW5jdGlvbiAoaW5wdXQsIGFycmF5KSB7XG4gICAgICAgIGFycmF5W1lFQVJdID0gdXRpbHNfaG9va3NfX2hvb2tzLnBhcnNlVHdvRGlnaXRZZWFyKGlucHV0KTtcbiAgICB9KTtcbiAgICBhZGRQYXJzZVRva2VuKCdZJywgZnVuY3Rpb24gKGlucHV0LCBhcnJheSkge1xuICAgICAgICBhcnJheVtZRUFSXSA9IHBhcnNlSW50KGlucHV0LCAxMCk7XG4gICAgfSk7XG5cbiAgICAvLyBIRUxQRVJTXG5cbiAgICBmdW5jdGlvbiBkYXlzSW5ZZWFyKHllYXIpIHtcbiAgICAgICAgcmV0dXJuIGlzTGVhcFllYXIoeWVhcikgPyAzNjYgOiAzNjU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNMZWFwWWVhcih5ZWFyKSB7XG4gICAgICAgIHJldHVybiAoeWVhciAlIDQgPT09IDAgJiYgeWVhciAlIDEwMCAhPT0gMCkgfHwgeWVhciAlIDQwMCA9PT0gMDtcbiAgICB9XG5cbiAgICAvLyBIT09LU1xuXG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLnBhcnNlVHdvRGlnaXRZZWFyID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgICAgIHJldHVybiB0b0ludChpbnB1dCkgKyAodG9JbnQoaW5wdXQpID4gNjggPyAxOTAwIDogMjAwMCk7XG4gICAgfTtcblxuICAgIC8vIE1PTUVOVFNcblxuICAgIHZhciBnZXRTZXRZZWFyID0gbWFrZUdldFNldCgnRnVsbFllYXInLCB0cnVlKTtcblxuICAgIGZ1bmN0aW9uIGdldElzTGVhcFllYXIgKCkge1xuICAgICAgICByZXR1cm4gaXNMZWFwWWVhcih0aGlzLnllYXIoKSk7XG4gICAgfVxuXG4gICAgLy8gc3RhcnQtb2YtZmlyc3Qtd2VlayAtIHN0YXJ0LW9mLXllYXJcbiAgICBmdW5jdGlvbiBmaXJzdFdlZWtPZmZzZXQoeWVhciwgZG93LCBkb3kpIHtcbiAgICAgICAgdmFyIC8vIGZpcnN0LXdlZWsgZGF5IC0tIHdoaWNoIGphbnVhcnkgaXMgYWx3YXlzIGluIHRoZSBmaXJzdCB3ZWVrICg0IGZvciBpc28sIDEgZm9yIG90aGVyKVxuICAgICAgICAgICAgZndkID0gNyArIGRvdyAtIGRveSxcbiAgICAgICAgICAgIC8vIGZpcnN0LXdlZWsgZGF5IGxvY2FsIHdlZWtkYXkgLS0gd2hpY2ggbG9jYWwgd2Vla2RheSBpcyBmd2RcbiAgICAgICAgICAgIGZ3ZGx3ID0gKDcgKyBjcmVhdGVVVENEYXRlKHllYXIsIDAsIGZ3ZCkuZ2V0VVRDRGF5KCkgLSBkb3cpICUgNztcblxuICAgICAgICByZXR1cm4gLWZ3ZGx3ICsgZndkIC0gMTtcbiAgICB9XG5cbiAgICAvL2h0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSVNPX3dlZWtfZGF0ZSNDYWxjdWxhdGluZ19hX2RhdGVfZ2l2ZW5fdGhlX3llYXIuMkNfd2Vla19udW1iZXJfYW5kX3dlZWtkYXlcbiAgICBmdW5jdGlvbiBkYXlPZlllYXJGcm9tV2Vla3MoeWVhciwgd2Vlaywgd2Vla2RheSwgZG93LCBkb3kpIHtcbiAgICAgICAgdmFyIGxvY2FsV2Vla2RheSA9ICg3ICsgd2Vla2RheSAtIGRvdykgJSA3LFxuICAgICAgICAgICAgd2Vla09mZnNldCA9IGZpcnN0V2Vla09mZnNldCh5ZWFyLCBkb3csIGRveSksXG4gICAgICAgICAgICBkYXlPZlllYXIgPSAxICsgNyAqICh3ZWVrIC0gMSkgKyBsb2NhbFdlZWtkYXkgKyB3ZWVrT2Zmc2V0LFxuICAgICAgICAgICAgcmVzWWVhciwgcmVzRGF5T2ZZZWFyO1xuXG4gICAgICAgIGlmIChkYXlPZlllYXIgPD0gMCkge1xuICAgICAgICAgICAgcmVzWWVhciA9IHllYXIgLSAxO1xuICAgICAgICAgICAgcmVzRGF5T2ZZZWFyID0gZGF5c0luWWVhcihyZXNZZWFyKSArIGRheU9mWWVhcjtcbiAgICAgICAgfSBlbHNlIGlmIChkYXlPZlllYXIgPiBkYXlzSW5ZZWFyKHllYXIpKSB7XG4gICAgICAgICAgICByZXNZZWFyID0geWVhciArIDE7XG4gICAgICAgICAgICByZXNEYXlPZlllYXIgPSBkYXlPZlllYXIgLSBkYXlzSW5ZZWFyKHllYXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzWWVhciA9IHllYXI7XG4gICAgICAgICAgICByZXNEYXlPZlllYXIgPSBkYXlPZlllYXI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeWVhcjogcmVzWWVhcixcbiAgICAgICAgICAgIGRheU9mWWVhcjogcmVzRGF5T2ZZZWFyXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gd2Vla09mWWVhcihtb20sIGRvdywgZG95KSB7XG4gICAgICAgIHZhciB3ZWVrT2Zmc2V0ID0gZmlyc3RXZWVrT2Zmc2V0KG1vbS55ZWFyKCksIGRvdywgZG95KSxcbiAgICAgICAgICAgIHdlZWsgPSBNYXRoLmZsb29yKChtb20uZGF5T2ZZZWFyKCkgLSB3ZWVrT2Zmc2V0IC0gMSkgLyA3KSArIDEsXG4gICAgICAgICAgICByZXNXZWVrLCByZXNZZWFyO1xuXG4gICAgICAgIGlmICh3ZWVrIDwgMSkge1xuICAgICAgICAgICAgcmVzWWVhciA9IG1vbS55ZWFyKCkgLSAxO1xuICAgICAgICAgICAgcmVzV2VlayA9IHdlZWsgKyB3ZWVrc0luWWVhcihyZXNZZWFyLCBkb3csIGRveSk7XG4gICAgICAgIH0gZWxzZSBpZiAod2VlayA+IHdlZWtzSW5ZZWFyKG1vbS55ZWFyKCksIGRvdywgZG95KSkge1xuICAgICAgICAgICAgcmVzV2VlayA9IHdlZWsgLSB3ZWVrc0luWWVhcihtb20ueWVhcigpLCBkb3csIGRveSk7XG4gICAgICAgICAgICByZXNZZWFyID0gbW9tLnllYXIoKSArIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXNZZWFyID0gbW9tLnllYXIoKTtcbiAgICAgICAgICAgIHJlc1dlZWsgPSB3ZWVrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHdlZWs6IHJlc1dlZWssXG4gICAgICAgICAgICB5ZWFyOiByZXNZZWFyXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gd2Vla3NJblllYXIoeWVhciwgZG93LCBkb3kpIHtcbiAgICAgICAgdmFyIHdlZWtPZmZzZXQgPSBmaXJzdFdlZWtPZmZzZXQoeWVhciwgZG93LCBkb3kpLFxuICAgICAgICAgICAgd2Vla09mZnNldE5leHQgPSBmaXJzdFdlZWtPZmZzZXQoeWVhciArIDEsIGRvdywgZG95KTtcbiAgICAgICAgcmV0dXJuIChkYXlzSW5ZZWFyKHllYXIpIC0gd2Vla09mZnNldCArIHdlZWtPZmZzZXROZXh0KSAvIDc7XG4gICAgfVxuXG4gICAgLy8gUGljayB0aGUgZmlyc3QgZGVmaW5lZCBvZiB0d28gb3IgdGhyZWUgYXJndW1lbnRzLlxuICAgIGZ1bmN0aW9uIGRlZmF1bHRzKGEsIGIsIGMpIHtcbiAgICAgICAgaWYgKGEgIT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIGE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGIgIT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIGI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3VycmVudERhdGVBcnJheShjb25maWcpIHtcbiAgICAgICAgLy8gaG9va3MgaXMgYWN0dWFsbHkgdGhlIGV4cG9ydGVkIG1vbWVudCBvYmplY3RcbiAgICAgICAgdmFyIG5vd1ZhbHVlID0gbmV3IERhdGUodXRpbHNfaG9va3NfX2hvb2tzLm5vdygpKTtcbiAgICAgICAgaWYgKGNvbmZpZy5fdXNlVVRDKSB7XG4gICAgICAgICAgICByZXR1cm4gW25vd1ZhbHVlLmdldFVUQ0Z1bGxZZWFyKCksIG5vd1ZhbHVlLmdldFVUQ01vbnRoKCksIG5vd1ZhbHVlLmdldFVUQ0RhdGUoKV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtub3dWYWx1ZS5nZXRGdWxsWWVhcigpLCBub3dWYWx1ZS5nZXRNb250aCgpLCBub3dWYWx1ZS5nZXREYXRlKCldO1xuICAgIH1cblxuICAgIC8vIGNvbnZlcnQgYW4gYXJyYXkgdG8gYSBkYXRlLlxuICAgIC8vIHRoZSBhcnJheSBzaG91bGQgbWlycm9yIHRoZSBwYXJhbWV0ZXJzIGJlbG93XG4gICAgLy8gbm90ZTogYWxsIHZhbHVlcyBwYXN0IHRoZSB5ZWFyIGFyZSBvcHRpb25hbCBhbmQgd2lsbCBkZWZhdWx0IHRvIHRoZSBsb3dlc3QgcG9zc2libGUgdmFsdWUuXG4gICAgLy8gW3llYXIsIG1vbnRoLCBkYXkgLCBob3VyLCBtaW51dGUsIHNlY29uZCwgbWlsbGlzZWNvbmRdXG4gICAgZnVuY3Rpb24gY29uZmlnRnJvbUFycmF5IChjb25maWcpIHtcbiAgICAgICAgdmFyIGksIGRhdGUsIGlucHV0ID0gW10sIGN1cnJlbnREYXRlLCB5ZWFyVG9Vc2U7XG5cbiAgICAgICAgaWYgKGNvbmZpZy5fZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY3VycmVudERhdGUgPSBjdXJyZW50RGF0ZUFycmF5KGNvbmZpZyk7XG5cbiAgICAgICAgLy9jb21wdXRlIGRheSBvZiB0aGUgeWVhciBmcm9tIHdlZWtzIGFuZCB3ZWVrZGF5c1xuICAgICAgICBpZiAoY29uZmlnLl93ICYmIGNvbmZpZy5fYVtEQVRFXSA9PSBudWxsICYmIGNvbmZpZy5fYVtNT05USF0gPT0gbnVsbCkge1xuICAgICAgICAgICAgZGF5T2ZZZWFyRnJvbVdlZWtJbmZvKGNvbmZpZyk7XG4gICAgICAgIH1cblxuICAgICAgICAvL2lmIHRoZSBkYXkgb2YgdGhlIHllYXIgaXMgc2V0LCBmaWd1cmUgb3V0IHdoYXQgaXQgaXNcbiAgICAgICAgaWYgKGNvbmZpZy5fZGF5T2ZZZWFyKSB7XG4gICAgICAgICAgICB5ZWFyVG9Vc2UgPSBkZWZhdWx0cyhjb25maWcuX2FbWUVBUl0sIGN1cnJlbnREYXRlW1lFQVJdKTtcblxuICAgICAgICAgICAgaWYgKGNvbmZpZy5fZGF5T2ZZZWFyID4gZGF5c0luWWVhcih5ZWFyVG9Vc2UpKSB7XG4gICAgICAgICAgICAgICAgZ2V0UGFyc2luZ0ZsYWdzKGNvbmZpZykuX292ZXJmbG93RGF5T2ZZZWFyID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGF0ZSA9IGNyZWF0ZVVUQ0RhdGUoeWVhclRvVXNlLCAwLCBjb25maWcuX2RheU9mWWVhcik7XG4gICAgICAgICAgICBjb25maWcuX2FbTU9OVEhdID0gZGF0ZS5nZXRVVENNb250aCgpO1xuICAgICAgICAgICAgY29uZmlnLl9hW0RBVEVdID0gZGF0ZS5nZXRVVENEYXRlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEZWZhdWx0IHRvIGN1cnJlbnQgZGF0ZS5cbiAgICAgICAgLy8gKiBpZiBubyB5ZWFyLCBtb250aCwgZGF5IG9mIG1vbnRoIGFyZSBnaXZlbiwgZGVmYXVsdCB0byB0b2RheVxuICAgICAgICAvLyAqIGlmIGRheSBvZiBtb250aCBpcyBnaXZlbiwgZGVmYXVsdCBtb250aCBhbmQgeWVhclxuICAgICAgICAvLyAqIGlmIG1vbnRoIGlzIGdpdmVuLCBkZWZhdWx0IG9ubHkgeWVhclxuICAgICAgICAvLyAqIGlmIHllYXIgaXMgZ2l2ZW4sIGRvbid0IGRlZmF1bHQgYW55dGhpbmdcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IDMgJiYgY29uZmlnLl9hW2ldID09IG51bGw7ICsraSkge1xuICAgICAgICAgICAgY29uZmlnLl9hW2ldID0gaW5wdXRbaV0gPSBjdXJyZW50RGF0ZVtpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFplcm8gb3V0IHdoYXRldmVyIHdhcyBub3QgZGVmYXVsdGVkLCBpbmNsdWRpbmcgdGltZVxuICAgICAgICBmb3IgKDsgaSA8IDc7IGkrKykge1xuICAgICAgICAgICAgY29uZmlnLl9hW2ldID0gaW5wdXRbaV0gPSAoY29uZmlnLl9hW2ldID09IG51bGwpID8gKGkgPT09IDIgPyAxIDogMCkgOiBjb25maWcuX2FbaV07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDaGVjayBmb3IgMjQ6MDA6MDAuMDAwXG4gICAgICAgIGlmIChjb25maWcuX2FbSE9VUl0gPT09IDI0ICYmXG4gICAgICAgICAgICAgICAgY29uZmlnLl9hW01JTlVURV0gPT09IDAgJiZcbiAgICAgICAgICAgICAgICBjb25maWcuX2FbU0VDT05EXSA9PT0gMCAmJlxuICAgICAgICAgICAgICAgIGNvbmZpZy5fYVtNSUxMSVNFQ09ORF0gPT09IDApIHtcbiAgICAgICAgICAgIGNvbmZpZy5fbmV4dERheSA9IHRydWU7XG4gICAgICAgICAgICBjb25maWcuX2FbSE9VUl0gPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uZmlnLl9kID0gKGNvbmZpZy5fdXNlVVRDID8gY3JlYXRlVVRDRGF0ZSA6IGNyZWF0ZURhdGUpLmFwcGx5KG51bGwsIGlucHV0KTtcbiAgICAgICAgLy8gQXBwbHkgdGltZXpvbmUgb2Zmc2V0IGZyb20gaW5wdXQuIFRoZSBhY3R1YWwgdXRjT2Zmc2V0IGNhbiBiZSBjaGFuZ2VkXG4gICAgICAgIC8vIHdpdGggcGFyc2Vab25lLlxuICAgICAgICBpZiAoY29uZmlnLl90em0gIT0gbnVsbCkge1xuICAgICAgICAgICAgY29uZmlnLl9kLnNldFVUQ01pbnV0ZXMoY29uZmlnLl9kLmdldFVUQ01pbnV0ZXMoKSAtIGNvbmZpZy5fdHptKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb25maWcuX25leHREYXkpIHtcbiAgICAgICAgICAgIGNvbmZpZy5fYVtIT1VSXSA9IDI0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGF5T2ZZZWFyRnJvbVdlZWtJbmZvKGNvbmZpZykge1xuICAgICAgICB2YXIgdywgd2Vla1llYXIsIHdlZWssIHdlZWtkYXksIGRvdywgZG95LCB0ZW1wLCB3ZWVrZGF5T3ZlcmZsb3c7XG5cbiAgICAgICAgdyA9IGNvbmZpZy5fdztcbiAgICAgICAgaWYgKHcuR0cgIT0gbnVsbCB8fCB3LlcgIT0gbnVsbCB8fCB3LkUgIT0gbnVsbCkge1xuICAgICAgICAgICAgZG93ID0gMTtcbiAgICAgICAgICAgIGRveSA9IDQ7XG5cbiAgICAgICAgICAgIC8vIFRPRE86IFdlIG5lZWQgdG8gdGFrZSB0aGUgY3VycmVudCBpc29XZWVrWWVhciwgYnV0IHRoYXQgZGVwZW5kcyBvblxuICAgICAgICAgICAgLy8gaG93IHdlIGludGVycHJldCBub3cgKGxvY2FsLCB1dGMsIGZpeGVkIG9mZnNldCkuIFNvIGNyZWF0ZVxuICAgICAgICAgICAgLy8gYSBub3cgdmVyc2lvbiBvZiBjdXJyZW50IGNvbmZpZyAodGFrZSBsb2NhbC91dGMvb2Zmc2V0IGZsYWdzLCBhbmRcbiAgICAgICAgICAgIC8vIGNyZWF0ZSBub3cpLlxuICAgICAgICAgICAgd2Vla1llYXIgPSBkZWZhdWx0cyh3LkdHLCBjb25maWcuX2FbWUVBUl0sIHdlZWtPZlllYXIobG9jYWxfX2NyZWF0ZUxvY2FsKCksIDEsIDQpLnllYXIpO1xuICAgICAgICAgICAgd2VlayA9IGRlZmF1bHRzKHcuVywgMSk7XG4gICAgICAgICAgICB3ZWVrZGF5ID0gZGVmYXVsdHMody5FLCAxKTtcbiAgICAgICAgICAgIGlmICh3ZWVrZGF5IDwgMSB8fCB3ZWVrZGF5ID4gNykge1xuICAgICAgICAgICAgICAgIHdlZWtkYXlPdmVyZmxvdyA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkb3cgPSBjb25maWcuX2xvY2FsZS5fd2Vlay5kb3c7XG4gICAgICAgICAgICBkb3kgPSBjb25maWcuX2xvY2FsZS5fd2Vlay5kb3k7XG5cbiAgICAgICAgICAgIHdlZWtZZWFyID0gZGVmYXVsdHMody5nZywgY29uZmlnLl9hW1lFQVJdLCB3ZWVrT2ZZZWFyKGxvY2FsX19jcmVhdGVMb2NhbCgpLCBkb3csIGRveSkueWVhcik7XG4gICAgICAgICAgICB3ZWVrID0gZGVmYXVsdHMody53LCAxKTtcblxuICAgICAgICAgICAgaWYgKHcuZCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gd2Vla2RheSAtLSBsb3cgZGF5IG51bWJlcnMgYXJlIGNvbnNpZGVyZWQgbmV4dCB3ZWVrXG4gICAgICAgICAgICAgICAgd2Vla2RheSA9IHcuZDtcbiAgICAgICAgICAgICAgICBpZiAod2Vla2RheSA8IDAgfHwgd2Vla2RheSA+IDYpIHtcbiAgICAgICAgICAgICAgICAgICAgd2Vla2RheU92ZXJmbG93ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHcuZSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gbG9jYWwgd2Vla2RheSAtLSBjb3VudGluZyBzdGFydHMgZnJvbSBiZWdpbmluZyBvZiB3ZWVrXG4gICAgICAgICAgICAgICAgd2Vla2RheSA9IHcuZSArIGRvdztcbiAgICAgICAgICAgICAgICBpZiAody5lIDwgMCB8fCB3LmUgPiA2KSB7XG4gICAgICAgICAgICAgICAgICAgIHdlZWtkYXlPdmVyZmxvdyA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBkZWZhdWx0IHRvIGJlZ2luaW5nIG9mIHdlZWtcbiAgICAgICAgICAgICAgICB3ZWVrZGF5ID0gZG93O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh3ZWVrIDwgMSB8fCB3ZWVrID4gd2Vla3NJblllYXIod2Vla1llYXIsIGRvdywgZG95KSkge1xuICAgICAgICAgICAgZ2V0UGFyc2luZ0ZsYWdzKGNvbmZpZykuX292ZXJmbG93V2Vla3MgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHdlZWtkYXlPdmVyZmxvdyAhPSBudWxsKSB7XG4gICAgICAgICAgICBnZXRQYXJzaW5nRmxhZ3MoY29uZmlnKS5fb3ZlcmZsb3dXZWVrZGF5ID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRlbXAgPSBkYXlPZlllYXJGcm9tV2Vla3Mod2Vla1llYXIsIHdlZWssIHdlZWtkYXksIGRvdywgZG95KTtcbiAgICAgICAgICAgIGNvbmZpZy5fYVtZRUFSXSA9IHRlbXAueWVhcjtcbiAgICAgICAgICAgIGNvbmZpZy5fZGF5T2ZZZWFyID0gdGVtcC5kYXlPZlllYXI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjb25zdGFudCB0aGF0IHJlZmVycyB0byB0aGUgSVNPIHN0YW5kYXJkXG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLklTT184NjAxID0gZnVuY3Rpb24gKCkge307XG5cbiAgICAvLyBkYXRlIGZyb20gc3RyaW5nIGFuZCBmb3JtYXQgc3RyaW5nXG4gICAgZnVuY3Rpb24gY29uZmlnRnJvbVN0cmluZ0FuZEZvcm1hdChjb25maWcpIHtcbiAgICAgICAgLy8gVE9ETzogTW92ZSB0aGlzIHRvIGFub3RoZXIgcGFydCBvZiB0aGUgY3JlYXRpb24gZmxvdyB0byBwcmV2ZW50IGNpcmN1bGFyIGRlcHNcbiAgICAgICAgaWYgKGNvbmZpZy5fZiA9PT0gdXRpbHNfaG9va3NfX2hvb2tzLklTT184NjAxKSB7XG4gICAgICAgICAgICBjb25maWdGcm9tSVNPKGNvbmZpZyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25maWcuX2EgPSBbXTtcbiAgICAgICAgZ2V0UGFyc2luZ0ZsYWdzKGNvbmZpZykuZW1wdHkgPSB0cnVlO1xuXG4gICAgICAgIC8vIFRoaXMgYXJyYXkgaXMgdXNlZCB0byBtYWtlIGEgRGF0ZSwgZWl0aGVyIHdpdGggYG5ldyBEYXRlYCBvciBgRGF0ZS5VVENgXG4gICAgICAgIHZhciBzdHJpbmcgPSAnJyArIGNvbmZpZy5faSxcbiAgICAgICAgICAgIGksIHBhcnNlZElucHV0LCB0b2tlbnMsIHRva2VuLCBza2lwcGVkLFxuICAgICAgICAgICAgc3RyaW5nTGVuZ3RoID0gc3RyaW5nLmxlbmd0aCxcbiAgICAgICAgICAgIHRvdGFsUGFyc2VkSW5wdXRMZW5ndGggPSAwO1xuXG4gICAgICAgIHRva2VucyA9IGV4cGFuZEZvcm1hdChjb25maWcuX2YsIGNvbmZpZy5fbG9jYWxlKS5tYXRjaChmb3JtYXR0aW5nVG9rZW5zKSB8fCBbXTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdG9rZW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcbiAgICAgICAgICAgIHBhcnNlZElucHV0ID0gKHN0cmluZy5tYXRjaChnZXRQYXJzZVJlZ2V4Rm9yVG9rZW4odG9rZW4sIGNvbmZpZykpIHx8IFtdKVswXTtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCd0b2tlbicsIHRva2VuLCAncGFyc2VkSW5wdXQnLCBwYXJzZWRJbnB1dCxcbiAgICAgICAgICAgIC8vICAgICAgICAgJ3JlZ2V4JywgZ2V0UGFyc2VSZWdleEZvclRva2VuKHRva2VuLCBjb25maWcpKTtcbiAgICAgICAgICAgIGlmIChwYXJzZWRJbnB1dCkge1xuICAgICAgICAgICAgICAgIHNraXBwZWQgPSBzdHJpbmcuc3Vic3RyKDAsIHN0cmluZy5pbmRleE9mKHBhcnNlZElucHV0KSk7XG4gICAgICAgICAgICAgICAgaWYgKHNraXBwZWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBnZXRQYXJzaW5nRmxhZ3MoY29uZmlnKS51bnVzZWRJbnB1dC5wdXNoKHNraXBwZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzdHJpbmcgPSBzdHJpbmcuc2xpY2Uoc3RyaW5nLmluZGV4T2YocGFyc2VkSW5wdXQpICsgcGFyc2VkSW5wdXQubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICB0b3RhbFBhcnNlZElucHV0TGVuZ3RoICs9IHBhcnNlZElucHV0Lmxlbmd0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGRvbid0IHBhcnNlIGlmIGl0J3Mgbm90IGEga25vd24gdG9rZW5cbiAgICAgICAgICAgIGlmIChmb3JtYXRUb2tlbkZ1bmN0aW9uc1t0b2tlbl0pIHtcbiAgICAgICAgICAgICAgICBpZiAocGFyc2VkSW5wdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2V0UGFyc2luZ0ZsYWdzKGNvbmZpZykuZW1wdHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGdldFBhcnNpbmdGbGFncyhjb25maWcpLnVudXNlZFRva2Vucy5wdXNoKHRva2VuKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYWRkVGltZVRvQXJyYXlGcm9tVG9rZW4odG9rZW4sIHBhcnNlZElucHV0LCBjb25maWcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY29uZmlnLl9zdHJpY3QgJiYgIXBhcnNlZElucHV0KSB7XG4gICAgICAgICAgICAgICAgZ2V0UGFyc2luZ0ZsYWdzKGNvbmZpZykudW51c2VkVG9rZW5zLnB1c2godG9rZW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIHJlbWFpbmluZyB1bnBhcnNlZCBpbnB1dCBsZW5ndGggdG8gdGhlIHN0cmluZ1xuICAgICAgICBnZXRQYXJzaW5nRmxhZ3MoY29uZmlnKS5jaGFyc0xlZnRPdmVyID0gc3RyaW5nTGVuZ3RoIC0gdG90YWxQYXJzZWRJbnB1dExlbmd0aDtcbiAgICAgICAgaWYgKHN0cmluZy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBnZXRQYXJzaW5nRmxhZ3MoY29uZmlnKS51bnVzZWRJbnB1dC5wdXNoKHN0cmluZyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjbGVhciBfMTJoIGZsYWcgaWYgaG91ciBpcyA8PSAxMlxuICAgICAgICBpZiAoZ2V0UGFyc2luZ0ZsYWdzKGNvbmZpZykuYmlnSG91ciA9PT0gdHJ1ZSAmJlxuICAgICAgICAgICAgICAgIGNvbmZpZy5fYVtIT1VSXSA8PSAxMiAmJlxuICAgICAgICAgICAgICAgIGNvbmZpZy5fYVtIT1VSXSA+IDApIHtcbiAgICAgICAgICAgIGdldFBhcnNpbmdGbGFncyhjb25maWcpLmJpZ0hvdXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBnZXRQYXJzaW5nRmxhZ3MoY29uZmlnKS5wYXJzZWREYXRlUGFydHMgPSBjb25maWcuX2Euc2xpY2UoMCk7XG4gICAgICAgIGdldFBhcnNpbmdGbGFncyhjb25maWcpLm1lcmlkaWVtID0gY29uZmlnLl9tZXJpZGllbTtcbiAgICAgICAgLy8gaGFuZGxlIG1lcmlkaWVtXG4gICAgICAgIGNvbmZpZy5fYVtIT1VSXSA9IG1lcmlkaWVtRml4V3JhcChjb25maWcuX2xvY2FsZSwgY29uZmlnLl9hW0hPVVJdLCBjb25maWcuX21lcmlkaWVtKTtcblxuICAgICAgICBjb25maWdGcm9tQXJyYXkoY29uZmlnKTtcbiAgICAgICAgY2hlY2tPdmVyZmxvdyhjb25maWcpO1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gbWVyaWRpZW1GaXhXcmFwIChsb2NhbGUsIGhvdXIsIG1lcmlkaWVtKSB7XG4gICAgICAgIHZhciBpc1BtO1xuXG4gICAgICAgIGlmIChtZXJpZGllbSA9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBub3RoaW5nIHRvIGRvXG4gICAgICAgICAgICByZXR1cm4gaG91cjtcbiAgICAgICAgfVxuICAgICAgICBpZiAobG9jYWxlLm1lcmlkaWVtSG91ciAhPSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxlLm1lcmlkaWVtSG91cihob3VyLCBtZXJpZGllbSk7XG4gICAgICAgIH0gZWxzZSBpZiAobG9jYWxlLmlzUE0gIT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2tcbiAgICAgICAgICAgIGlzUG0gPSBsb2NhbGUuaXNQTShtZXJpZGllbSk7XG4gICAgICAgICAgICBpZiAoaXNQbSAmJiBob3VyIDwgMTIpIHtcbiAgICAgICAgICAgICAgICBob3VyICs9IDEyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFpc1BtICYmIGhvdXIgPT09IDEyKSB7XG4gICAgICAgICAgICAgICAgaG91ciA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gaG91cjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHRoaXMgaXMgbm90IHN1cHBvc2VkIHRvIGhhcHBlblxuICAgICAgICAgICAgcmV0dXJuIGhvdXI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBkYXRlIGZyb20gc3RyaW5nIGFuZCBhcnJheSBvZiBmb3JtYXQgc3RyaW5nc1xuICAgIGZ1bmN0aW9uIGNvbmZpZ0Zyb21TdHJpbmdBbmRBcnJheShjb25maWcpIHtcbiAgICAgICAgdmFyIHRlbXBDb25maWcsXG4gICAgICAgICAgICBiZXN0TW9tZW50LFxuXG4gICAgICAgICAgICBzY29yZVRvQmVhdCxcbiAgICAgICAgICAgIGksXG4gICAgICAgICAgICBjdXJyZW50U2NvcmU7XG5cbiAgICAgICAgaWYgKGNvbmZpZy5fZi5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGdldFBhcnNpbmdGbGFncyhjb25maWcpLmludmFsaWRGb3JtYXQgPSB0cnVlO1xuICAgICAgICAgICAgY29uZmlnLl9kID0gbmV3IERhdGUoTmFOKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBjb25maWcuX2YubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGN1cnJlbnRTY29yZSA9IDA7XG4gICAgICAgICAgICB0ZW1wQ29uZmlnID0gY29weUNvbmZpZyh7fSwgY29uZmlnKTtcbiAgICAgICAgICAgIGlmIChjb25maWcuX3VzZVVUQyAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGVtcENvbmZpZy5fdXNlVVRDID0gY29uZmlnLl91c2VVVEM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0ZW1wQ29uZmlnLl9mID0gY29uZmlnLl9mW2ldO1xuICAgICAgICAgICAgY29uZmlnRnJvbVN0cmluZ0FuZEZvcm1hdCh0ZW1wQ29uZmlnKTtcblxuICAgICAgICAgICAgaWYgKCF2YWxpZF9faXNWYWxpZCh0ZW1wQ29uZmlnKSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiB0aGVyZSBpcyBhbnkgaW5wdXQgdGhhdCB3YXMgbm90IHBhcnNlZCBhZGQgYSBwZW5hbHR5IGZvciB0aGF0IGZvcm1hdFxuICAgICAgICAgICAgY3VycmVudFNjb3JlICs9IGdldFBhcnNpbmdGbGFncyh0ZW1wQ29uZmlnKS5jaGFyc0xlZnRPdmVyO1xuXG4gICAgICAgICAgICAvL29yIHRva2Vuc1xuICAgICAgICAgICAgY3VycmVudFNjb3JlICs9IGdldFBhcnNpbmdGbGFncyh0ZW1wQ29uZmlnKS51bnVzZWRUb2tlbnMubGVuZ3RoICogMTA7XG5cbiAgICAgICAgICAgIGdldFBhcnNpbmdGbGFncyh0ZW1wQ29uZmlnKS5zY29yZSA9IGN1cnJlbnRTY29yZTtcblxuICAgICAgICAgICAgaWYgKHNjb3JlVG9CZWF0ID09IG51bGwgfHwgY3VycmVudFNjb3JlIDwgc2NvcmVUb0JlYXQpIHtcbiAgICAgICAgICAgICAgICBzY29yZVRvQmVhdCA9IGN1cnJlbnRTY29yZTtcbiAgICAgICAgICAgICAgICBiZXN0TW9tZW50ID0gdGVtcENvbmZpZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGV4dGVuZChjb25maWcsIGJlc3RNb21lbnQgfHwgdGVtcENvbmZpZyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY29uZmlnRnJvbU9iamVjdChjb25maWcpIHtcbiAgICAgICAgaWYgKGNvbmZpZy5fZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGkgPSBub3JtYWxpemVPYmplY3RVbml0cyhjb25maWcuX2kpO1xuICAgICAgICBjb25maWcuX2EgPSBtYXAoW2kueWVhciwgaS5tb250aCwgaS5kYXkgfHwgaS5kYXRlLCBpLmhvdXIsIGkubWludXRlLCBpLnNlY29uZCwgaS5taWxsaXNlY29uZF0sIGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIHJldHVybiBvYmogJiYgcGFyc2VJbnQob2JqLCAxMCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbmZpZ0Zyb21BcnJheShjb25maWcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZUZyb21Db25maWcgKGNvbmZpZykge1xuICAgICAgICB2YXIgcmVzID0gbmV3IE1vbWVudChjaGVja092ZXJmbG93KHByZXBhcmVDb25maWcoY29uZmlnKSkpO1xuICAgICAgICBpZiAocmVzLl9uZXh0RGF5KSB7XG4gICAgICAgICAgICAvLyBBZGRpbmcgaXMgc21hcnQgZW5vdWdoIGFyb3VuZCBEU1RcbiAgICAgICAgICAgIHJlcy5hZGQoMSwgJ2QnKTtcbiAgICAgICAgICAgIHJlcy5fbmV4dERheSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcHJlcGFyZUNvbmZpZyAoY29uZmlnKSB7XG4gICAgICAgIHZhciBpbnB1dCA9IGNvbmZpZy5faSxcbiAgICAgICAgICAgIGZvcm1hdCA9IGNvbmZpZy5fZjtcblxuICAgICAgICBjb25maWcuX2xvY2FsZSA9IGNvbmZpZy5fbG9jYWxlIHx8IGxvY2FsZV9sb2NhbGVzX19nZXRMb2NhbGUoY29uZmlnLl9sKTtcblxuICAgICAgICBpZiAoaW5wdXQgPT09IG51bGwgfHwgKGZvcm1hdCA9PT0gdW5kZWZpbmVkICYmIGlucHV0ID09PSAnJykpIHtcbiAgICAgICAgICAgIHJldHVybiB2YWxpZF9fY3JlYXRlSW52YWxpZCh7bnVsbElucHV0OiB0cnVlfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgY29uZmlnLl9pID0gaW5wdXQgPSBjb25maWcuX2xvY2FsZS5wcmVwYXJzZShpbnB1dCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNNb21lbnQoaW5wdXQpKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IE1vbWVudChjaGVja092ZXJmbG93KGlucHV0KSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNBcnJheShmb3JtYXQpKSB7XG4gICAgICAgICAgICBjb25maWdGcm9tU3RyaW5nQW5kQXJyYXkoY29uZmlnKTtcbiAgICAgICAgfSBlbHNlIGlmIChmb3JtYXQpIHtcbiAgICAgICAgICAgIGNvbmZpZ0Zyb21TdHJpbmdBbmRGb3JtYXQoY29uZmlnKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc0RhdGUoaW5wdXQpKSB7XG4gICAgICAgICAgICBjb25maWcuX2QgPSBpbnB1dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbmZpZ0Zyb21JbnB1dChjb25maWcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF2YWxpZF9faXNWYWxpZChjb25maWcpKSB7XG4gICAgICAgICAgICBjb25maWcuX2QgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvbmZpZztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjb25maWdGcm9tSW5wdXQoY29uZmlnKSB7XG4gICAgICAgIHZhciBpbnB1dCA9IGNvbmZpZy5faTtcbiAgICAgICAgaWYgKGlucHV0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbmZpZy5fZCA9IG5ldyBEYXRlKHV0aWxzX2hvb2tzX19ob29rcy5ub3coKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNEYXRlKGlucHV0KSkge1xuICAgICAgICAgICAgY29uZmlnLl9kID0gbmV3IERhdGUoaW5wdXQudmFsdWVPZigpKTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBjb25maWdGcm9tU3RyaW5nKGNvbmZpZyk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNBcnJheShpbnB1dCkpIHtcbiAgICAgICAgICAgIGNvbmZpZy5fYSA9IG1hcChpbnB1dC5zbGljZSgwKSwgZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZUludChvYmosIDEwKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uZmlnRnJvbUFycmF5KGNvbmZpZyk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mKGlucHV0KSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGNvbmZpZ0Zyb21PYmplY3QoY29uZmlnKTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YoaW5wdXQpID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgLy8gZnJvbSBtaWxsaXNlY29uZHNcbiAgICAgICAgICAgIGNvbmZpZy5fZCA9IG5ldyBEYXRlKGlucHV0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHV0aWxzX2hvb2tzX19ob29rcy5jcmVhdGVGcm9tSW5wdXRGYWxsYmFjayhjb25maWcpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlTG9jYWxPclVUQyAoaW5wdXQsIGZvcm1hdCwgbG9jYWxlLCBzdHJpY3QsIGlzVVRDKSB7XG4gICAgICAgIHZhciBjID0ge307XG5cbiAgICAgICAgaWYgKHR5cGVvZihsb2NhbGUpID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgIHN0cmljdCA9IGxvY2FsZTtcbiAgICAgICAgICAgIGxvY2FsZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICAvLyBvYmplY3QgY29uc3RydWN0aW9uIG11c3QgYmUgZG9uZSB0aGlzIHdheS5cbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21vbWVudC9tb21lbnQvaXNzdWVzLzE0MjNcbiAgICAgICAgYy5faXNBTW9tZW50T2JqZWN0ID0gdHJ1ZTtcbiAgICAgICAgYy5fdXNlVVRDID0gYy5faXNVVEMgPSBpc1VUQztcbiAgICAgICAgYy5fbCA9IGxvY2FsZTtcbiAgICAgICAgYy5faSA9IGlucHV0O1xuICAgICAgICBjLl9mID0gZm9ybWF0O1xuICAgICAgICBjLl9zdHJpY3QgPSBzdHJpY3Q7XG5cbiAgICAgICAgcmV0dXJuIGNyZWF0ZUZyb21Db25maWcoYyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9jYWxfX2NyZWF0ZUxvY2FsIChpbnB1dCwgZm9ybWF0LCBsb2NhbGUsIHN0cmljdCkge1xuICAgICAgICByZXR1cm4gY3JlYXRlTG9jYWxPclVUQyhpbnB1dCwgZm9ybWF0LCBsb2NhbGUsIHN0cmljdCwgZmFsc2UpO1xuICAgIH1cblxuICAgIHZhciBwcm90b3R5cGVNaW4gPSBkZXByZWNhdGUoXG4gICAgICAgICAnbW9tZW50KCkubWluIGlzIGRlcHJlY2F0ZWQsIHVzZSBtb21lbnQubWF4IGluc3RlYWQuIGh0dHBzOi8vZ2l0aHViLmNvbS9tb21lbnQvbW9tZW50L2lzc3Vlcy8xNTQ4JyxcbiAgICAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICB2YXIgb3RoZXIgPSBsb2NhbF9fY3JlYXRlTG9jYWwuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICBpZiAodGhpcy5pc1ZhbGlkKCkgJiYgb3RoZXIuaXNWYWxpZCgpKSB7XG4gICAgICAgICAgICAgICAgIHJldHVybiBvdGhlciA8IHRoaXMgPyB0aGlzIDogb3RoZXI7XG4gICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbGlkX19jcmVhdGVJbnZhbGlkKCk7XG4gICAgICAgICAgICAgfVxuICAgICAgICAgfVxuICAgICApO1xuXG4gICAgdmFyIHByb3RvdHlwZU1heCA9IGRlcHJlY2F0ZShcbiAgICAgICAgJ21vbWVudCgpLm1heCBpcyBkZXByZWNhdGVkLCB1c2UgbW9tZW50Lm1pbiBpbnN0ZWFkLiBodHRwczovL2dpdGh1Yi5jb20vbW9tZW50L21vbWVudC9pc3N1ZXMvMTU0OCcsXG4gICAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBvdGhlciA9IGxvY2FsX19jcmVhdGVMb2NhbC5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgaWYgKHRoaXMuaXNWYWxpZCgpICYmIG90aGVyLmlzVmFsaWQoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvdGhlciA+IHRoaXMgPyB0aGlzIDogb3RoZXI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWxpZF9fY3JlYXRlSW52YWxpZCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgKTtcblxuICAgIC8vIFBpY2sgYSBtb21lbnQgbSBmcm9tIG1vbWVudHMgc28gdGhhdCBtW2ZuXShvdGhlcikgaXMgdHJ1ZSBmb3IgYWxsXG4gICAgLy8gb3RoZXIuIFRoaXMgcmVsaWVzIG9uIHRoZSBmdW5jdGlvbiBmbiB0byBiZSB0cmFuc2l0aXZlLlxuICAgIC8vXG4gICAgLy8gbW9tZW50cyBzaG91bGQgZWl0aGVyIGJlIGFuIGFycmF5IG9mIG1vbWVudCBvYmplY3RzIG9yIGFuIGFycmF5LCB3aG9zZVxuICAgIC8vIGZpcnN0IGVsZW1lbnQgaXMgYW4gYXJyYXkgb2YgbW9tZW50IG9iamVjdHMuXG4gICAgZnVuY3Rpb24gcGlja0J5KGZuLCBtb21lbnRzKSB7XG4gICAgICAgIHZhciByZXMsIGk7XG4gICAgICAgIGlmIChtb21lbnRzLmxlbmd0aCA9PT0gMSAmJiBpc0FycmF5KG1vbWVudHNbMF0pKSB7XG4gICAgICAgICAgICBtb21lbnRzID0gbW9tZW50c1swXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW1vbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxfX2NyZWF0ZUxvY2FsKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmVzID0gbW9tZW50c1swXTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IG1vbWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGlmICghbW9tZW50c1tpXS5pc1ZhbGlkKCkgfHwgbW9tZW50c1tpXVtmbl0ocmVzKSkge1xuICAgICAgICAgICAgICAgIHJlcyA9IG1vbWVudHNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBVc2UgW10uc29ydCBpbnN0ZWFkP1xuICAgIGZ1bmN0aW9uIG1pbiAoKSB7XG4gICAgICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDApO1xuXG4gICAgICAgIHJldHVybiBwaWNrQnkoJ2lzQmVmb3JlJywgYXJncyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWF4ICgpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCk7XG5cbiAgICAgICAgcmV0dXJuIHBpY2tCeSgnaXNBZnRlcicsIGFyZ3MpO1xuICAgIH1cblxuICAgIHZhciBub3cgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBEYXRlLm5vdyA/IERhdGUubm93KCkgOiArKG5ldyBEYXRlKCkpO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBEdXJhdGlvbiAoZHVyYXRpb24pIHtcbiAgICAgICAgdmFyIG5vcm1hbGl6ZWRJbnB1dCA9IG5vcm1hbGl6ZU9iamVjdFVuaXRzKGR1cmF0aW9uKSxcbiAgICAgICAgICAgIHllYXJzID0gbm9ybWFsaXplZElucHV0LnllYXIgfHwgMCxcbiAgICAgICAgICAgIHF1YXJ0ZXJzID0gbm9ybWFsaXplZElucHV0LnF1YXJ0ZXIgfHwgMCxcbiAgICAgICAgICAgIG1vbnRocyA9IG5vcm1hbGl6ZWRJbnB1dC5tb250aCB8fCAwLFxuICAgICAgICAgICAgd2Vla3MgPSBub3JtYWxpemVkSW5wdXQud2VlayB8fCAwLFxuICAgICAgICAgICAgZGF5cyA9IG5vcm1hbGl6ZWRJbnB1dC5kYXkgfHwgMCxcbiAgICAgICAgICAgIGhvdXJzID0gbm9ybWFsaXplZElucHV0LmhvdXIgfHwgMCxcbiAgICAgICAgICAgIG1pbnV0ZXMgPSBub3JtYWxpemVkSW5wdXQubWludXRlIHx8IDAsXG4gICAgICAgICAgICBzZWNvbmRzID0gbm9ybWFsaXplZElucHV0LnNlY29uZCB8fCAwLFxuICAgICAgICAgICAgbWlsbGlzZWNvbmRzID0gbm9ybWFsaXplZElucHV0Lm1pbGxpc2Vjb25kIHx8IDA7XG5cbiAgICAgICAgLy8gcmVwcmVzZW50YXRpb24gZm9yIGRhdGVBZGRSZW1vdmVcbiAgICAgICAgdGhpcy5fbWlsbGlzZWNvbmRzID0gK21pbGxpc2Vjb25kcyArXG4gICAgICAgICAgICBzZWNvbmRzICogMWUzICsgLy8gMTAwMFxuICAgICAgICAgICAgbWludXRlcyAqIDZlNCArIC8vIDEwMDAgKiA2MFxuICAgICAgICAgICAgaG91cnMgKiAxMDAwICogNjAgKiA2MDsgLy91c2luZyAxMDAwICogNjAgKiA2MCBpbnN0ZWFkIG9mIDM2ZTUgdG8gYXZvaWQgZmxvYXRpbmcgcG9pbnQgcm91bmRpbmcgZXJyb3JzIGh0dHBzOi8vZ2l0aHViLmNvbS9tb21lbnQvbW9tZW50L2lzc3Vlcy8yOTc4XG4gICAgICAgIC8vIEJlY2F1c2Ugb2YgZGF0ZUFkZFJlbW92ZSB0cmVhdHMgMjQgaG91cnMgYXMgZGlmZmVyZW50IGZyb20gYVxuICAgICAgICAvLyBkYXkgd2hlbiB3b3JraW5nIGFyb3VuZCBEU1QsIHdlIG5lZWQgdG8gc3RvcmUgdGhlbSBzZXBhcmF0ZWx5XG4gICAgICAgIHRoaXMuX2RheXMgPSArZGF5cyArXG4gICAgICAgICAgICB3ZWVrcyAqIDc7XG4gICAgICAgIC8vIEl0IGlzIGltcG9zc2libGUgdHJhbnNsYXRlIG1vbnRocyBpbnRvIGRheXMgd2l0aG91dCBrbm93aW5nXG4gICAgICAgIC8vIHdoaWNoIG1vbnRocyB5b3UgYXJlIGFyZSB0YWxraW5nIGFib3V0LCBzbyB3ZSBoYXZlIHRvIHN0b3JlXG4gICAgICAgIC8vIGl0IHNlcGFyYXRlbHkuXG4gICAgICAgIHRoaXMuX21vbnRocyA9ICttb250aHMgK1xuICAgICAgICAgICAgcXVhcnRlcnMgKiAzICtcbiAgICAgICAgICAgIHllYXJzICogMTI7XG5cbiAgICAgICAgdGhpcy5fZGF0YSA9IHt9O1xuXG4gICAgICAgIHRoaXMuX2xvY2FsZSA9IGxvY2FsZV9sb2NhbGVzX19nZXRMb2NhbGUoKTtcblxuICAgICAgICB0aGlzLl9idWJibGUoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0R1cmF0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiBpbnN0YW5jZW9mIER1cmF0aW9uO1xuICAgIH1cblxuICAgIC8vIEZPUk1BVFRJTkdcblxuICAgIGZ1bmN0aW9uIG9mZnNldCAodG9rZW4sIHNlcGFyYXRvcikge1xuICAgICAgICBhZGRGb3JtYXRUb2tlbih0b2tlbiwgMCwgMCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG9mZnNldCA9IHRoaXMudXRjT2Zmc2V0KCk7XG4gICAgICAgICAgICB2YXIgc2lnbiA9ICcrJztcbiAgICAgICAgICAgIGlmIChvZmZzZXQgPCAwKSB7XG4gICAgICAgICAgICAgICAgb2Zmc2V0ID0gLW9mZnNldDtcbiAgICAgICAgICAgICAgICBzaWduID0gJy0nO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNpZ24gKyB6ZXJvRmlsbCh+fihvZmZzZXQgLyA2MCksIDIpICsgc2VwYXJhdG9yICsgemVyb0ZpbGwofn4ob2Zmc2V0KSAlIDYwLCAyKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgb2Zmc2V0KCdaJywgJzonKTtcbiAgICBvZmZzZXQoJ1paJywgJycpO1xuXG4gICAgLy8gUEFSU0lOR1xuXG4gICAgYWRkUmVnZXhUb2tlbignWicsICBtYXRjaFNob3J0T2Zmc2V0KTtcbiAgICBhZGRSZWdleFRva2VuKCdaWicsIG1hdGNoU2hvcnRPZmZzZXQpO1xuICAgIGFkZFBhcnNlVG9rZW4oWydaJywgJ1paJ10sIGZ1bmN0aW9uIChpbnB1dCwgYXJyYXksIGNvbmZpZykge1xuICAgICAgICBjb25maWcuX3VzZVVUQyA9IHRydWU7XG4gICAgICAgIGNvbmZpZy5fdHptID0gb2Zmc2V0RnJvbVN0cmluZyhtYXRjaFNob3J0T2Zmc2V0LCBpbnB1dCk7XG4gICAgfSk7XG5cbiAgICAvLyBIRUxQRVJTXG5cbiAgICAvLyB0aW1lem9uZSBjaHVua2VyXG4gICAgLy8gJysxMDowMCcgPiBbJzEwJywgICcwMCddXG4gICAgLy8gJy0xNTMwJyAgPiBbJy0xNScsICczMCddXG4gICAgdmFyIGNodW5rT2Zmc2V0ID0gLyhbXFwrXFwtXXxcXGRcXGQpL2dpO1xuXG4gICAgZnVuY3Rpb24gb2Zmc2V0RnJvbVN0cmluZyhtYXRjaGVyLCBzdHJpbmcpIHtcbiAgICAgICAgdmFyIG1hdGNoZXMgPSAoKHN0cmluZyB8fCAnJykubWF0Y2gobWF0Y2hlcikgfHwgW10pO1xuICAgICAgICB2YXIgY2h1bmsgICA9IG1hdGNoZXNbbWF0Y2hlcy5sZW5ndGggLSAxXSB8fCBbXTtcbiAgICAgICAgdmFyIHBhcnRzICAgPSAoY2h1bmsgKyAnJykubWF0Y2goY2h1bmtPZmZzZXQpIHx8IFsnLScsIDAsIDBdO1xuICAgICAgICB2YXIgbWludXRlcyA9ICsocGFydHNbMV0gKiA2MCkgKyB0b0ludChwYXJ0c1syXSk7XG5cbiAgICAgICAgcmV0dXJuIHBhcnRzWzBdID09PSAnKycgPyBtaW51dGVzIDogLW1pbnV0ZXM7XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIGEgbW9tZW50IGZyb20gaW5wdXQsIHRoYXQgaXMgbG9jYWwvdXRjL3pvbmUgZXF1aXZhbGVudCB0byBtb2RlbC5cbiAgICBmdW5jdGlvbiBjbG9uZVdpdGhPZmZzZXQoaW5wdXQsIG1vZGVsKSB7XG4gICAgICAgIHZhciByZXMsIGRpZmY7XG4gICAgICAgIGlmIChtb2RlbC5faXNVVEMpIHtcbiAgICAgICAgICAgIHJlcyA9IG1vZGVsLmNsb25lKCk7XG4gICAgICAgICAgICBkaWZmID0gKGlzTW9tZW50KGlucHV0KSB8fCBpc0RhdGUoaW5wdXQpID8gaW5wdXQudmFsdWVPZigpIDogbG9jYWxfX2NyZWF0ZUxvY2FsKGlucHV0KS52YWx1ZU9mKCkpIC0gcmVzLnZhbHVlT2YoKTtcbiAgICAgICAgICAgIC8vIFVzZSBsb3ctbGV2ZWwgYXBpLCBiZWNhdXNlIHRoaXMgZm4gaXMgbG93LWxldmVsIGFwaS5cbiAgICAgICAgICAgIHJlcy5fZC5zZXRUaW1lKHJlcy5fZC52YWx1ZU9mKCkgKyBkaWZmKTtcbiAgICAgICAgICAgIHV0aWxzX2hvb2tzX19ob29rcy51cGRhdGVPZmZzZXQocmVzLCBmYWxzZSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGxvY2FsX19jcmVhdGVMb2NhbChpbnB1dCkubG9jYWwoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldERhdGVPZmZzZXQgKG0pIHtcbiAgICAgICAgLy8gT24gRmlyZWZveC4yNCBEYXRlI2dldFRpbWV6b25lT2Zmc2V0IHJldHVybnMgYSBmbG9hdGluZyBwb2ludC5cbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21vbWVudC9tb21lbnQvcHVsbC8xODcxXG4gICAgICAgIHJldHVybiAtTWF0aC5yb3VuZChtLl9kLmdldFRpbWV6b25lT2Zmc2V0KCkgLyAxNSkgKiAxNTtcbiAgICB9XG5cbiAgICAvLyBIT09LU1xuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiB3aWxsIGJlIGNhbGxlZCB3aGVuZXZlciBhIG1vbWVudCBpcyBtdXRhdGVkLlxuICAgIC8vIEl0IGlzIGludGVuZGVkIHRvIGtlZXAgdGhlIG9mZnNldCBpbiBzeW5jIHdpdGggdGhlIHRpbWV6b25lLlxuICAgIHV0aWxzX2hvb2tzX19ob29rcy51cGRhdGVPZmZzZXQgPSBmdW5jdGlvbiAoKSB7fTtcblxuICAgIC8vIE1PTUVOVFNcblxuICAgIC8vIGtlZXBMb2NhbFRpbWUgPSB0cnVlIG1lYW5zIG9ubHkgY2hhbmdlIHRoZSB0aW1lem9uZSwgd2l0aG91dFxuICAgIC8vIGFmZmVjdGluZyB0aGUgbG9jYWwgaG91ci4gU28gNTozMToyNiArMDMwMCAtLVt1dGNPZmZzZXQoMiwgdHJ1ZSldLS0+XG4gICAgLy8gNTozMToyNiArMDIwMCBJdCBpcyBwb3NzaWJsZSB0aGF0IDU6MzE6MjYgZG9lc24ndCBleGlzdCB3aXRoIG9mZnNldFxuICAgIC8vICswMjAwLCBzbyB3ZSBhZGp1c3QgdGhlIHRpbWUgYXMgbmVlZGVkLCB0byBiZSB2YWxpZC5cbiAgICAvL1xuICAgIC8vIEtlZXBpbmcgdGhlIHRpbWUgYWN0dWFsbHkgYWRkcy9zdWJ0cmFjdHMgKG9uZSBob3VyKVxuICAgIC8vIGZyb20gdGhlIGFjdHVhbCByZXByZXNlbnRlZCB0aW1lLiBUaGF0IGlzIHdoeSB3ZSBjYWxsIHVwZGF0ZU9mZnNldFxuICAgIC8vIGEgc2Vjb25kIHRpbWUuIEluIGNhc2UgaXQgd2FudHMgdXMgdG8gY2hhbmdlIHRoZSBvZmZzZXQgYWdhaW5cbiAgICAvLyBfY2hhbmdlSW5Qcm9ncmVzcyA9PSB0cnVlIGNhc2UsIHRoZW4gd2UgaGF2ZSB0byBhZGp1c3QsIGJlY2F1c2VcbiAgICAvLyB0aGVyZSBpcyBubyBzdWNoIHRpbWUgaW4gdGhlIGdpdmVuIHRpbWV6b25lLlxuICAgIGZ1bmN0aW9uIGdldFNldE9mZnNldCAoaW5wdXQsIGtlZXBMb2NhbFRpbWUpIHtcbiAgICAgICAgdmFyIG9mZnNldCA9IHRoaXMuX29mZnNldCB8fCAwLFxuICAgICAgICAgICAgbG9jYWxBZGp1c3Q7XG4gICAgICAgIGlmICghdGhpcy5pc1ZhbGlkKCkpIHtcbiAgICAgICAgICAgIHJldHVybiBpbnB1dCAhPSBudWxsID8gdGhpcyA6IE5hTjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5wdXQgIT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBpbnB1dCA9IG9mZnNldEZyb21TdHJpbmcobWF0Y2hTaG9ydE9mZnNldCwgaW5wdXQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChNYXRoLmFicyhpbnB1dCkgPCAxNikge1xuICAgICAgICAgICAgICAgIGlucHV0ID0gaW5wdXQgKiA2MDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghdGhpcy5faXNVVEMgJiYga2VlcExvY2FsVGltZSkge1xuICAgICAgICAgICAgICAgIGxvY2FsQWRqdXN0ID0gZ2V0RGF0ZU9mZnNldCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX29mZnNldCA9IGlucHV0O1xuICAgICAgICAgICAgdGhpcy5faXNVVEMgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKGxvY2FsQWRqdXN0ICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZChsb2NhbEFkanVzdCwgJ20nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChvZmZzZXQgIT09IGlucHV0KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFrZWVwTG9jYWxUaW1lIHx8IHRoaXMuX2NoYW5nZUluUHJvZ3Jlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgYWRkX3N1YnRyYWN0X19hZGRTdWJ0cmFjdCh0aGlzLCBjcmVhdGVfX2NyZWF0ZUR1cmF0aW9uKGlucHV0IC0gb2Zmc2V0LCAnbScpLCAxLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICghdGhpcy5fY2hhbmdlSW5Qcm9ncmVzcykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jaGFuZ2VJblByb2dyZXNzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdXRpbHNfaG9va3NfX2hvb2tzLnVwZGF0ZU9mZnNldCh0aGlzLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2hhbmdlSW5Qcm9ncmVzcyA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5faXNVVEMgPyBvZmZzZXQgOiBnZXREYXRlT2Zmc2V0KHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0U2V0Wm9uZSAoaW5wdXQsIGtlZXBMb2NhbFRpbWUpIHtcbiAgICAgICAgaWYgKGlucHV0ICE9IG51bGwpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgaW5wdXQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgaW5wdXQgPSAtaW5wdXQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMudXRjT2Zmc2V0KGlucHV0LCBrZWVwTG9jYWxUaW1lKTtcblxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gLXRoaXMudXRjT2Zmc2V0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZXRPZmZzZXRUb1VUQyAoa2VlcExvY2FsVGltZSkge1xuICAgICAgICByZXR1cm4gdGhpcy51dGNPZmZzZXQoMCwga2VlcExvY2FsVGltZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0T2Zmc2V0VG9Mb2NhbCAoa2VlcExvY2FsVGltZSkge1xuICAgICAgICBpZiAodGhpcy5faXNVVEMpIHtcbiAgICAgICAgICAgIHRoaXMudXRjT2Zmc2V0KDAsIGtlZXBMb2NhbFRpbWUpO1xuICAgICAgICAgICAgdGhpcy5faXNVVEMgPSBmYWxzZTtcblxuICAgICAgICAgICAgaWYgKGtlZXBMb2NhbFRpbWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN1YnRyYWN0KGdldERhdGVPZmZzZXQodGhpcyksICdtJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0T2Zmc2V0VG9QYXJzZWRPZmZzZXQgKCkge1xuICAgICAgICBpZiAodGhpcy5fdHptKSB7XG4gICAgICAgICAgICB0aGlzLnV0Y09mZnNldCh0aGlzLl90em0pO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB0aGlzLl9pID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdGhpcy51dGNPZmZzZXQob2Zmc2V0RnJvbVN0cmluZyhtYXRjaE9mZnNldCwgdGhpcy5faSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhc0FsaWduZWRIb3VyT2Zmc2V0IChpbnB1dCkge1xuICAgICAgICBpZiAoIXRoaXMuaXNWYWxpZCgpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaW5wdXQgPSBpbnB1dCA/IGxvY2FsX19jcmVhdGVMb2NhbChpbnB1dCkudXRjT2Zmc2V0KCkgOiAwO1xuXG4gICAgICAgIHJldHVybiAodGhpcy51dGNPZmZzZXQoKSAtIGlucHV0KSAlIDYwID09PSAwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzRGF5bGlnaHRTYXZpbmdUaW1lICgpIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIHRoaXMudXRjT2Zmc2V0KCkgPiB0aGlzLmNsb25lKCkubW9udGgoMCkudXRjT2Zmc2V0KCkgfHxcbiAgICAgICAgICAgIHRoaXMudXRjT2Zmc2V0KCkgPiB0aGlzLmNsb25lKCkubW9udGgoNSkudXRjT2Zmc2V0KClcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0RheWxpZ2h0U2F2aW5nVGltZVNoaWZ0ZWQgKCkge1xuICAgICAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX2lzRFNUU2hpZnRlZCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9pc0RTVFNoaWZ0ZWQ7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgYyA9IHt9O1xuXG4gICAgICAgIGNvcHlDb25maWcoYywgdGhpcyk7XG4gICAgICAgIGMgPSBwcmVwYXJlQ29uZmlnKGMpO1xuXG4gICAgICAgIGlmIChjLl9hKSB7XG4gICAgICAgICAgICB2YXIgb3RoZXIgPSBjLl9pc1VUQyA/IGNyZWF0ZV91dGNfX2NyZWF0ZVVUQyhjLl9hKSA6IGxvY2FsX19jcmVhdGVMb2NhbChjLl9hKTtcbiAgICAgICAgICAgIHRoaXMuX2lzRFNUU2hpZnRlZCA9IHRoaXMuaXNWYWxpZCgpICYmXG4gICAgICAgICAgICAgICAgY29tcGFyZUFycmF5cyhjLl9hLCBvdGhlci50b0FycmF5KCkpID4gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2lzRFNUU2hpZnRlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2lzRFNUU2hpZnRlZDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0xvY2FsICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNWYWxpZCgpID8gIXRoaXMuX2lzVVRDIDogZmFsc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNVdGNPZmZzZXQgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pc1ZhbGlkKCkgPyB0aGlzLl9pc1VUQyA6IGZhbHNlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzVXRjICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNWYWxpZCgpID8gdGhpcy5faXNVVEMgJiYgdGhpcy5fb2Zmc2V0ID09PSAwIDogZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gQVNQLk5FVCBqc29uIGRhdGUgZm9ybWF0IHJlZ2V4XG4gICAgdmFyIGFzcE5ldFJlZ2V4ID0gL14oXFwtKT8oPzooXFxkKilbLiBdKT8oXFxkKylcXDooXFxkKykoPzpcXDooXFxkKylcXC4/KFxcZHszfSk/XFxkKik/JC87XG5cbiAgICAvLyBmcm9tIGh0dHA6Ly9kb2NzLmNsb3N1cmUtbGlicmFyeS5nb29nbGVjb2RlLmNvbS9naXQvY2xvc3VyZV9nb29nX2RhdGVfZGF0ZS5qcy5zb3VyY2UuaHRtbFxuICAgIC8vIHNvbWV3aGF0IG1vcmUgaW4gbGluZSB3aXRoIDQuNC4zLjIgMjAwNCBzcGVjLCBidXQgYWxsb3dzIGRlY2ltYWwgYW55d2hlcmVcbiAgICAvLyBhbmQgZnVydGhlciBtb2RpZmllZCB0byBhbGxvdyBmb3Igc3RyaW5ncyBjb250YWluaW5nIGJvdGggd2VlayBhbmQgZGF5XG4gICAgdmFyIGlzb1JlZ2V4ID0gL14oLSk/UCg/OigtP1swLTksLl0qKVkpPyg/OigtP1swLTksLl0qKU0pPyg/OigtP1swLTksLl0qKVcpPyg/OigtP1swLTksLl0qKUQpPyg/OlQoPzooLT9bMC05LC5dKilIKT8oPzooLT9bMC05LC5dKilNKT8oPzooLT9bMC05LC5dKilTKT8pPyQvO1xuXG4gICAgZnVuY3Rpb24gY3JlYXRlX19jcmVhdGVEdXJhdGlvbiAoaW5wdXQsIGtleSkge1xuICAgICAgICB2YXIgZHVyYXRpb24gPSBpbnB1dCxcbiAgICAgICAgICAgIC8vIG1hdGNoaW5nIGFnYWluc3QgcmVnZXhwIGlzIGV4cGVuc2l2ZSwgZG8gaXQgb24gZGVtYW5kXG4gICAgICAgICAgICBtYXRjaCA9IG51bGwsXG4gICAgICAgICAgICBzaWduLFxuICAgICAgICAgICAgcmV0LFxuICAgICAgICAgICAgZGlmZlJlcztcblxuICAgICAgICBpZiAoaXNEdXJhdGlvbihpbnB1dCkpIHtcbiAgICAgICAgICAgIGR1cmF0aW9uID0ge1xuICAgICAgICAgICAgICAgIG1zIDogaW5wdXQuX21pbGxpc2Vjb25kcyxcbiAgICAgICAgICAgICAgICBkICA6IGlucHV0Ll9kYXlzLFxuICAgICAgICAgICAgICAgIE0gIDogaW5wdXQuX21vbnRoc1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgaW5wdXQgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBkdXJhdGlvbiA9IHt9O1xuICAgICAgICAgICAgaWYgKGtleSkge1xuICAgICAgICAgICAgICAgIGR1cmF0aW9uW2tleV0gPSBpbnB1dDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZHVyYXRpb24ubWlsbGlzZWNvbmRzID0gaW5wdXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoISEobWF0Y2ggPSBhc3BOZXRSZWdleC5leGVjKGlucHV0KSkpIHtcbiAgICAgICAgICAgIHNpZ24gPSAobWF0Y2hbMV0gPT09ICctJykgPyAtMSA6IDE7XG4gICAgICAgICAgICBkdXJhdGlvbiA9IHtcbiAgICAgICAgICAgICAgICB5ICA6IDAsXG4gICAgICAgICAgICAgICAgZCAgOiB0b0ludChtYXRjaFtEQVRFXSkgICAgICAgICogc2lnbixcbiAgICAgICAgICAgICAgICBoICA6IHRvSW50KG1hdGNoW0hPVVJdKSAgICAgICAgKiBzaWduLFxuICAgICAgICAgICAgICAgIG0gIDogdG9JbnQobWF0Y2hbTUlOVVRFXSkgICAgICAqIHNpZ24sXG4gICAgICAgICAgICAgICAgcyAgOiB0b0ludChtYXRjaFtTRUNPTkRdKSAgICAgICogc2lnbixcbiAgICAgICAgICAgICAgICBtcyA6IHRvSW50KG1hdGNoW01JTExJU0VDT05EXSkgKiBzaWduXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKCEhKG1hdGNoID0gaXNvUmVnZXguZXhlYyhpbnB1dCkpKSB7XG4gICAgICAgICAgICBzaWduID0gKG1hdGNoWzFdID09PSAnLScpID8gLTEgOiAxO1xuICAgICAgICAgICAgZHVyYXRpb24gPSB7XG4gICAgICAgICAgICAgICAgeSA6IHBhcnNlSXNvKG1hdGNoWzJdLCBzaWduKSxcbiAgICAgICAgICAgICAgICBNIDogcGFyc2VJc28obWF0Y2hbM10sIHNpZ24pLFxuICAgICAgICAgICAgICAgIHcgOiBwYXJzZUlzbyhtYXRjaFs0XSwgc2lnbiksXG4gICAgICAgICAgICAgICAgZCA6IHBhcnNlSXNvKG1hdGNoWzVdLCBzaWduKSxcbiAgICAgICAgICAgICAgICBoIDogcGFyc2VJc28obWF0Y2hbNl0sIHNpZ24pLFxuICAgICAgICAgICAgICAgIG0gOiBwYXJzZUlzbyhtYXRjaFs3XSwgc2lnbiksXG4gICAgICAgICAgICAgICAgcyA6IHBhcnNlSXNvKG1hdGNoWzhdLCBzaWduKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIGlmIChkdXJhdGlvbiA9PSBudWxsKSB7Ly8gY2hlY2tzIGZvciBudWxsIG9yIHVuZGVmaW5lZFxuICAgICAgICAgICAgZHVyYXRpb24gPSB7fTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZHVyYXRpb24gPT09ICdvYmplY3QnICYmICgnZnJvbScgaW4gZHVyYXRpb24gfHwgJ3RvJyBpbiBkdXJhdGlvbikpIHtcbiAgICAgICAgICAgIGRpZmZSZXMgPSBtb21lbnRzRGlmZmVyZW5jZShsb2NhbF9fY3JlYXRlTG9jYWwoZHVyYXRpb24uZnJvbSksIGxvY2FsX19jcmVhdGVMb2NhbChkdXJhdGlvbi50bykpO1xuXG4gICAgICAgICAgICBkdXJhdGlvbiA9IHt9O1xuICAgICAgICAgICAgZHVyYXRpb24ubXMgPSBkaWZmUmVzLm1pbGxpc2Vjb25kcztcbiAgICAgICAgICAgIGR1cmF0aW9uLk0gPSBkaWZmUmVzLm1vbnRocztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldCA9IG5ldyBEdXJhdGlvbihkdXJhdGlvbik7XG5cbiAgICAgICAgaWYgKGlzRHVyYXRpb24oaW5wdXQpICYmIGhhc093blByb3AoaW5wdXQsICdfbG9jYWxlJykpIHtcbiAgICAgICAgICAgIHJldC5fbG9jYWxlID0gaW5wdXQuX2xvY2FsZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXQ7XG4gICAgfVxuXG4gICAgY3JlYXRlX19jcmVhdGVEdXJhdGlvbi5mbiA9IER1cmF0aW9uLnByb3RvdHlwZTtcblxuICAgIGZ1bmN0aW9uIHBhcnNlSXNvIChpbnAsIHNpZ24pIHtcbiAgICAgICAgLy8gV2UnZCBub3JtYWxseSB1c2Ugfn5pbnAgZm9yIHRoaXMsIGJ1dCB1bmZvcnR1bmF0ZWx5IGl0IGFsc29cbiAgICAgICAgLy8gY29udmVydHMgZmxvYXRzIHRvIGludHMuXG4gICAgICAgIC8vIGlucCBtYXkgYmUgdW5kZWZpbmVkLCBzbyBjYXJlZnVsIGNhbGxpbmcgcmVwbGFjZSBvbiBpdC5cbiAgICAgICAgdmFyIHJlcyA9IGlucCAmJiBwYXJzZUZsb2F0KGlucC5yZXBsYWNlKCcsJywgJy4nKSk7XG4gICAgICAgIC8vIGFwcGx5IHNpZ24gd2hpbGUgd2UncmUgYXQgaXRcbiAgICAgICAgcmV0dXJuIChpc05hTihyZXMpID8gMCA6IHJlcykgKiBzaWduO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBvc2l0aXZlTW9tZW50c0RpZmZlcmVuY2UoYmFzZSwgb3RoZXIpIHtcbiAgICAgICAgdmFyIHJlcyA9IHttaWxsaXNlY29uZHM6IDAsIG1vbnRoczogMH07XG5cbiAgICAgICAgcmVzLm1vbnRocyA9IG90aGVyLm1vbnRoKCkgLSBiYXNlLm1vbnRoKCkgK1xuICAgICAgICAgICAgKG90aGVyLnllYXIoKSAtIGJhc2UueWVhcigpKSAqIDEyO1xuICAgICAgICBpZiAoYmFzZS5jbG9uZSgpLmFkZChyZXMubW9udGhzLCAnTScpLmlzQWZ0ZXIob3RoZXIpKSB7XG4gICAgICAgICAgICAtLXJlcy5tb250aHM7XG4gICAgICAgIH1cblxuICAgICAgICByZXMubWlsbGlzZWNvbmRzID0gK290aGVyIC0gKyhiYXNlLmNsb25lKCkuYWRkKHJlcy5tb250aHMsICdNJykpO1xuXG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbW9tZW50c0RpZmZlcmVuY2UoYmFzZSwgb3RoZXIpIHtcbiAgICAgICAgdmFyIHJlcztcbiAgICAgICAgaWYgKCEoYmFzZS5pc1ZhbGlkKCkgJiYgb3RoZXIuaXNWYWxpZCgpKSkge1xuICAgICAgICAgICAgcmV0dXJuIHttaWxsaXNlY29uZHM6IDAsIG1vbnRoczogMH07XG4gICAgICAgIH1cblxuICAgICAgICBvdGhlciA9IGNsb25lV2l0aE9mZnNldChvdGhlciwgYmFzZSk7XG4gICAgICAgIGlmIChiYXNlLmlzQmVmb3JlKG90aGVyKSkge1xuICAgICAgICAgICAgcmVzID0gcG9zaXRpdmVNb21lbnRzRGlmZmVyZW5jZShiYXNlLCBvdGhlcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXMgPSBwb3NpdGl2ZU1vbWVudHNEaWZmZXJlbmNlKG90aGVyLCBiYXNlKTtcbiAgICAgICAgICAgIHJlcy5taWxsaXNlY29uZHMgPSAtcmVzLm1pbGxpc2Vjb25kcztcbiAgICAgICAgICAgIHJlcy5tb250aHMgPSAtcmVzLm1vbnRocztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWJzUm91bmQgKG51bWJlcikge1xuICAgICAgICBpZiAobnVtYmVyIDwgMCkge1xuICAgICAgICAgICAgcmV0dXJuIE1hdGgucm91bmQoLTEgKiBudW1iZXIpICogLTE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChudW1iZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gVE9ETzogcmVtb3ZlICduYW1lJyBhcmcgYWZ0ZXIgZGVwcmVjYXRpb24gaXMgcmVtb3ZlZFxuICAgIGZ1bmN0aW9uIGNyZWF0ZUFkZGVyKGRpcmVjdGlvbiwgbmFtZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHZhbCwgcGVyaW9kKSB7XG4gICAgICAgICAgICB2YXIgZHVyLCB0bXA7XG4gICAgICAgICAgICAvL2ludmVydCB0aGUgYXJndW1lbnRzLCBidXQgY29tcGxhaW4gYWJvdXQgaXRcbiAgICAgICAgICAgIGlmIChwZXJpb2QgIT09IG51bGwgJiYgIWlzTmFOKCtwZXJpb2QpKSB7XG4gICAgICAgICAgICAgICAgZGVwcmVjYXRlU2ltcGxlKG5hbWUsICdtb21lbnQoKS4nICsgbmFtZSAgKyAnKHBlcmlvZCwgbnVtYmVyKSBpcyBkZXByZWNhdGVkLiBQbGVhc2UgdXNlIG1vbWVudCgpLicgKyBuYW1lICsgJyhudW1iZXIsIHBlcmlvZCkuJyk7XG4gICAgICAgICAgICAgICAgdG1wID0gdmFsOyB2YWwgPSBwZXJpb2Q7IHBlcmlvZCA9IHRtcDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFsID0gdHlwZW9mIHZhbCA9PT0gJ3N0cmluZycgPyArdmFsIDogdmFsO1xuICAgICAgICAgICAgZHVyID0gY3JlYXRlX19jcmVhdGVEdXJhdGlvbih2YWwsIHBlcmlvZCk7XG4gICAgICAgICAgICBhZGRfc3VidHJhY3RfX2FkZFN1YnRyYWN0KHRoaXMsIGR1ciwgZGlyZWN0aW9uKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZF9zdWJ0cmFjdF9fYWRkU3VidHJhY3QgKG1vbSwgZHVyYXRpb24sIGlzQWRkaW5nLCB1cGRhdGVPZmZzZXQpIHtcbiAgICAgICAgdmFyIG1pbGxpc2Vjb25kcyA9IGR1cmF0aW9uLl9taWxsaXNlY29uZHMsXG4gICAgICAgICAgICBkYXlzID0gYWJzUm91bmQoZHVyYXRpb24uX2RheXMpLFxuICAgICAgICAgICAgbW9udGhzID0gYWJzUm91bmQoZHVyYXRpb24uX21vbnRocyk7XG5cbiAgICAgICAgaWYgKCFtb20uaXNWYWxpZCgpKSB7XG4gICAgICAgICAgICAvLyBObyBvcFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdXBkYXRlT2Zmc2V0ID0gdXBkYXRlT2Zmc2V0ID09IG51bGwgPyB0cnVlIDogdXBkYXRlT2Zmc2V0O1xuXG4gICAgICAgIGlmIChtaWxsaXNlY29uZHMpIHtcbiAgICAgICAgICAgIG1vbS5fZC5zZXRUaW1lKG1vbS5fZC52YWx1ZU9mKCkgKyBtaWxsaXNlY29uZHMgKiBpc0FkZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRheXMpIHtcbiAgICAgICAgICAgIGdldF9zZXRfX3NldChtb20sICdEYXRlJywgZ2V0X3NldF9fZ2V0KG1vbSwgJ0RhdGUnKSArIGRheXMgKiBpc0FkZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1vbnRocykge1xuICAgICAgICAgICAgc2V0TW9udGgobW9tLCBnZXRfc2V0X19nZXQobW9tLCAnTW9udGgnKSArIG1vbnRocyAqIGlzQWRkaW5nKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodXBkYXRlT2Zmc2V0KSB7XG4gICAgICAgICAgICB1dGlsc19ob29rc19faG9va3MudXBkYXRlT2Zmc2V0KG1vbSwgZGF5cyB8fCBtb250aHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGFkZF9zdWJ0cmFjdF9fYWRkICAgICAgPSBjcmVhdGVBZGRlcigxLCAnYWRkJyk7XG4gICAgdmFyIGFkZF9zdWJ0cmFjdF9fc3VidHJhY3QgPSBjcmVhdGVBZGRlcigtMSwgJ3N1YnRyYWN0Jyk7XG5cbiAgICBmdW5jdGlvbiBtb21lbnRfY2FsZW5kYXJfX2NhbGVuZGFyICh0aW1lLCBmb3JtYXRzKSB7XG4gICAgICAgIC8vIFdlIHdhbnQgdG8gY29tcGFyZSB0aGUgc3RhcnQgb2YgdG9kYXksIHZzIHRoaXMuXG4gICAgICAgIC8vIEdldHRpbmcgc3RhcnQtb2YtdG9kYXkgZGVwZW5kcyBvbiB3aGV0aGVyIHdlJ3JlIGxvY2FsL3V0Yy9vZmZzZXQgb3Igbm90LlxuICAgICAgICB2YXIgbm93ID0gdGltZSB8fCBsb2NhbF9fY3JlYXRlTG9jYWwoKSxcbiAgICAgICAgICAgIHNvZCA9IGNsb25lV2l0aE9mZnNldChub3csIHRoaXMpLnN0YXJ0T2YoJ2RheScpLFxuICAgICAgICAgICAgZGlmZiA9IHRoaXMuZGlmZihzb2QsICdkYXlzJywgdHJ1ZSksXG4gICAgICAgICAgICBmb3JtYXQgPSBkaWZmIDwgLTYgPyAnc2FtZUVsc2UnIDpcbiAgICAgICAgICAgICAgICBkaWZmIDwgLTEgPyAnbGFzdFdlZWsnIDpcbiAgICAgICAgICAgICAgICBkaWZmIDwgMCA/ICdsYXN0RGF5JyA6XG4gICAgICAgICAgICAgICAgZGlmZiA8IDEgPyAnc2FtZURheScgOlxuICAgICAgICAgICAgICAgIGRpZmYgPCAyID8gJ25leHREYXknIDpcbiAgICAgICAgICAgICAgICBkaWZmIDwgNyA/ICduZXh0V2VlaycgOiAnc2FtZUVsc2UnO1xuXG4gICAgICAgIHZhciBvdXRwdXQgPSBmb3JtYXRzICYmIChpc0Z1bmN0aW9uKGZvcm1hdHNbZm9ybWF0XSkgPyBmb3JtYXRzW2Zvcm1hdF0oKSA6IGZvcm1hdHNbZm9ybWF0XSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0KG91dHB1dCB8fCB0aGlzLmxvY2FsZURhdGEoKS5jYWxlbmRhcihmb3JtYXQsIHRoaXMsIGxvY2FsX19jcmVhdGVMb2NhbChub3cpKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2xvbmUgKCkge1xuICAgICAgICByZXR1cm4gbmV3IE1vbWVudCh0aGlzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0FmdGVyIChpbnB1dCwgdW5pdHMpIHtcbiAgICAgICAgdmFyIGxvY2FsSW5wdXQgPSBpc01vbWVudChpbnB1dCkgPyBpbnB1dCA6IGxvY2FsX19jcmVhdGVMb2NhbChpbnB1dCk7XG4gICAgICAgIGlmICghKHRoaXMuaXNWYWxpZCgpICYmIGxvY2FsSW5wdXQuaXNWYWxpZCgpKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHVuaXRzID0gbm9ybWFsaXplVW5pdHMoIWlzVW5kZWZpbmVkKHVuaXRzKSA/IHVuaXRzIDogJ21pbGxpc2Vjb25kJyk7XG4gICAgICAgIGlmICh1bml0cyA9PT0gJ21pbGxpc2Vjb25kJykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudmFsdWVPZigpID4gbG9jYWxJbnB1dC52YWx1ZU9mKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxJbnB1dC52YWx1ZU9mKCkgPCB0aGlzLmNsb25lKCkuc3RhcnRPZih1bml0cykudmFsdWVPZigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNCZWZvcmUgKGlucHV0LCB1bml0cykge1xuICAgICAgICB2YXIgbG9jYWxJbnB1dCA9IGlzTW9tZW50KGlucHV0KSA/IGlucHV0IDogbG9jYWxfX2NyZWF0ZUxvY2FsKGlucHV0KTtcbiAgICAgICAgaWYgKCEodGhpcy5pc1ZhbGlkKCkgJiYgbG9jYWxJbnB1dC5pc1ZhbGlkKCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgdW5pdHMgPSBub3JtYWxpemVVbml0cyghaXNVbmRlZmluZWQodW5pdHMpID8gdW5pdHMgOiAnbWlsbGlzZWNvbmQnKTtcbiAgICAgICAgaWYgKHVuaXRzID09PSAnbWlsbGlzZWNvbmQnKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy52YWx1ZU9mKCkgPCBsb2NhbElucHV0LnZhbHVlT2YoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNsb25lKCkuZW5kT2YodW5pdHMpLnZhbHVlT2YoKSA8IGxvY2FsSW5wdXQudmFsdWVPZigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNCZXR3ZWVuIChmcm9tLCB0bywgdW5pdHMsIGluY2x1c2l2aXR5KSB7XG4gICAgICAgIGluY2x1c2l2aXR5ID0gaW5jbHVzaXZpdHkgfHwgJygpJztcbiAgICAgICAgcmV0dXJuIChpbmNsdXNpdml0eVswXSA9PT0gJygnID8gdGhpcy5pc0FmdGVyKGZyb20sIHVuaXRzKSA6ICF0aGlzLmlzQmVmb3JlKGZyb20sIHVuaXRzKSkgJiZcbiAgICAgICAgICAgIChpbmNsdXNpdml0eVsxXSA9PT0gJyknID8gdGhpcy5pc0JlZm9yZSh0bywgdW5pdHMpIDogIXRoaXMuaXNBZnRlcih0bywgdW5pdHMpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc1NhbWUgKGlucHV0LCB1bml0cykge1xuICAgICAgICB2YXIgbG9jYWxJbnB1dCA9IGlzTW9tZW50KGlucHV0KSA/IGlucHV0IDogbG9jYWxfX2NyZWF0ZUxvY2FsKGlucHV0KSxcbiAgICAgICAgICAgIGlucHV0TXM7XG4gICAgICAgIGlmICghKHRoaXMuaXNWYWxpZCgpICYmIGxvY2FsSW5wdXQuaXNWYWxpZCgpKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHVuaXRzID0gbm9ybWFsaXplVW5pdHModW5pdHMgfHwgJ21pbGxpc2Vjb25kJyk7XG4gICAgICAgIGlmICh1bml0cyA9PT0gJ21pbGxpc2Vjb25kJykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudmFsdWVPZigpID09PSBsb2NhbElucHV0LnZhbHVlT2YoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlucHV0TXMgPSBsb2NhbElucHV0LnZhbHVlT2YoKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNsb25lKCkuc3RhcnRPZih1bml0cykudmFsdWVPZigpIDw9IGlucHV0TXMgJiYgaW5wdXRNcyA8PSB0aGlzLmNsb25lKCkuZW5kT2YodW5pdHMpLnZhbHVlT2YoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzU2FtZU9yQWZ0ZXIgKGlucHV0LCB1bml0cykge1xuICAgICAgICByZXR1cm4gdGhpcy5pc1NhbWUoaW5wdXQsIHVuaXRzKSB8fCB0aGlzLmlzQWZ0ZXIoaW5wdXQsdW5pdHMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzU2FtZU9yQmVmb3JlIChpbnB1dCwgdW5pdHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNTYW1lKGlucHV0LCB1bml0cykgfHwgdGhpcy5pc0JlZm9yZShpbnB1dCx1bml0cyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlmZiAoaW5wdXQsIHVuaXRzLCBhc0Zsb2F0KSB7XG4gICAgICAgIHZhciB0aGF0LFxuICAgICAgICAgICAgem9uZURlbHRhLFxuICAgICAgICAgICAgZGVsdGEsIG91dHB1dDtcblxuICAgICAgICBpZiAoIXRoaXMuaXNWYWxpZCgpKSB7XG4gICAgICAgICAgICByZXR1cm4gTmFOO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhhdCA9IGNsb25lV2l0aE9mZnNldChpbnB1dCwgdGhpcyk7XG5cbiAgICAgICAgaWYgKCF0aGF0LmlzVmFsaWQoKSkge1xuICAgICAgICAgICAgcmV0dXJuIE5hTjtcbiAgICAgICAgfVxuXG4gICAgICAgIHpvbmVEZWx0YSA9ICh0aGF0LnV0Y09mZnNldCgpIC0gdGhpcy51dGNPZmZzZXQoKSkgKiA2ZTQ7XG5cbiAgICAgICAgdW5pdHMgPSBub3JtYWxpemVVbml0cyh1bml0cyk7XG5cbiAgICAgICAgaWYgKHVuaXRzID09PSAneWVhcicgfHwgdW5pdHMgPT09ICdtb250aCcgfHwgdW5pdHMgPT09ICdxdWFydGVyJykge1xuICAgICAgICAgICAgb3V0cHV0ID0gbW9udGhEaWZmKHRoaXMsIHRoYXQpO1xuICAgICAgICAgICAgaWYgKHVuaXRzID09PSAncXVhcnRlcicpIHtcbiAgICAgICAgICAgICAgICBvdXRwdXQgPSBvdXRwdXQgLyAzO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh1bml0cyA9PT0gJ3llYXInKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0IC8gMTI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWx0YSA9IHRoaXMgLSB0aGF0O1xuICAgICAgICAgICAgb3V0cHV0ID0gdW5pdHMgPT09ICdzZWNvbmQnID8gZGVsdGEgLyAxZTMgOiAvLyAxMDAwXG4gICAgICAgICAgICAgICAgdW5pdHMgPT09ICdtaW51dGUnID8gZGVsdGEgLyA2ZTQgOiAvLyAxMDAwICogNjBcbiAgICAgICAgICAgICAgICB1bml0cyA9PT0gJ2hvdXInID8gZGVsdGEgLyAzNmU1IDogLy8gMTAwMCAqIDYwICogNjBcbiAgICAgICAgICAgICAgICB1bml0cyA9PT0gJ2RheScgPyAoZGVsdGEgLSB6b25lRGVsdGEpIC8gODY0ZTUgOiAvLyAxMDAwICogNjAgKiA2MCAqIDI0LCBuZWdhdGUgZHN0XG4gICAgICAgICAgICAgICAgdW5pdHMgPT09ICd3ZWVrJyA/IChkZWx0YSAtIHpvbmVEZWx0YSkgLyA2MDQ4ZTUgOiAvLyAxMDAwICogNjAgKiA2MCAqIDI0ICogNywgbmVnYXRlIGRzdFxuICAgICAgICAgICAgICAgIGRlbHRhO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhc0Zsb2F0ID8gb3V0cHV0IDogYWJzRmxvb3Iob3V0cHV0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtb250aERpZmYgKGEsIGIpIHtcbiAgICAgICAgLy8gZGlmZmVyZW5jZSBpbiBtb250aHNcbiAgICAgICAgdmFyIHdob2xlTW9udGhEaWZmID0gKChiLnllYXIoKSAtIGEueWVhcigpKSAqIDEyKSArIChiLm1vbnRoKCkgLSBhLm1vbnRoKCkpLFxuICAgICAgICAgICAgLy8gYiBpcyBpbiAoYW5jaG9yIC0gMSBtb250aCwgYW5jaG9yICsgMSBtb250aClcbiAgICAgICAgICAgIGFuY2hvciA9IGEuY2xvbmUoKS5hZGQod2hvbGVNb250aERpZmYsICdtb250aHMnKSxcbiAgICAgICAgICAgIGFuY2hvcjIsIGFkanVzdDtcblxuICAgICAgICBpZiAoYiAtIGFuY2hvciA8IDApIHtcbiAgICAgICAgICAgIGFuY2hvcjIgPSBhLmNsb25lKCkuYWRkKHdob2xlTW9udGhEaWZmIC0gMSwgJ21vbnRocycpO1xuICAgICAgICAgICAgLy8gbGluZWFyIGFjcm9zcyB0aGUgbW9udGhcbiAgICAgICAgICAgIGFkanVzdCA9IChiIC0gYW5jaG9yKSAvIChhbmNob3IgLSBhbmNob3IyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFuY2hvcjIgPSBhLmNsb25lKCkuYWRkKHdob2xlTW9udGhEaWZmICsgMSwgJ21vbnRocycpO1xuICAgICAgICAgICAgLy8gbGluZWFyIGFjcm9zcyB0aGUgbW9udGhcbiAgICAgICAgICAgIGFkanVzdCA9IChiIC0gYW5jaG9yKSAvIChhbmNob3IyIC0gYW5jaG9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vY2hlY2sgZm9yIG5lZ2F0aXZlIHplcm8sIHJldHVybiB6ZXJvIGlmIG5lZ2F0aXZlIHplcm9cbiAgICAgICAgcmV0dXJuIC0od2hvbGVNb250aERpZmYgKyBhZGp1c3QpIHx8IDA7XG4gICAgfVxuXG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLmRlZmF1bHRGb3JtYXQgPSAnWVlZWS1NTS1ERFRISDptbTpzc1onO1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy5kZWZhdWx0Rm9ybWF0VXRjID0gJ1lZWVktTU0tRERUSEg6bW06c3NbWl0nO1xuXG4gICAgZnVuY3Rpb24gdG9TdHJpbmcgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jbG9uZSgpLmxvY2FsZSgnZW4nKS5mb3JtYXQoJ2RkZCBNTU0gREQgWVlZWSBISDptbTpzcyBbR01UXVpaJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbW9tZW50X2Zvcm1hdF9fdG9JU09TdHJpbmcgKCkge1xuICAgICAgICB2YXIgbSA9IHRoaXMuY2xvbmUoKS51dGMoKTtcbiAgICAgICAgaWYgKDAgPCBtLnllYXIoKSAmJiBtLnllYXIoKSA8PSA5OTk5KSB7XG4gICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihEYXRlLnByb3RvdHlwZS50b0lTT1N0cmluZykpIHtcbiAgICAgICAgICAgICAgICAvLyBuYXRpdmUgaW1wbGVtZW50YXRpb24gaXMgfjUweCBmYXN0ZXIsIHVzZSBpdCB3aGVuIHdlIGNhblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnRvRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBmb3JtYXRNb21lbnQobSwgJ1lZWVktTU0tRERbVF1ISDptbTpzcy5TU1NbWl0nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBmb3JtYXRNb21lbnQobSwgJ1lZWVlZWS1NTS1ERFtUXUhIOm1tOnNzLlNTU1taXScpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZm9ybWF0IChpbnB1dFN0cmluZykge1xuICAgICAgICBpZiAoIWlucHV0U3RyaW5nKSB7XG4gICAgICAgICAgICBpbnB1dFN0cmluZyA9IHRoaXMuaXNVdGMoKSA/IHV0aWxzX2hvb2tzX19ob29rcy5kZWZhdWx0Rm9ybWF0VXRjIDogdXRpbHNfaG9va3NfX2hvb2tzLmRlZmF1bHRGb3JtYXQ7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG91dHB1dCA9IGZvcm1hdE1vbWVudCh0aGlzLCBpbnB1dFN0cmluZyk7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsZURhdGEoKS5wb3N0Zm9ybWF0KG91dHB1dCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZnJvbSAodGltZSwgd2l0aG91dFN1ZmZpeCkge1xuICAgICAgICBpZiAodGhpcy5pc1ZhbGlkKCkgJiZcbiAgICAgICAgICAgICAgICAoKGlzTW9tZW50KHRpbWUpICYmIHRpbWUuaXNWYWxpZCgpKSB8fFxuICAgICAgICAgICAgICAgICBsb2NhbF9fY3JlYXRlTG9jYWwodGltZSkuaXNWYWxpZCgpKSkge1xuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZV9fY3JlYXRlRHVyYXRpb24oe3RvOiB0aGlzLCBmcm9tOiB0aW1lfSkubG9jYWxlKHRoaXMubG9jYWxlKCkpLmh1bWFuaXplKCF3aXRob3V0U3VmZml4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxvY2FsZURhdGEoKS5pbnZhbGlkRGF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZnJvbU5vdyAod2l0aG91dFN1ZmZpeCkge1xuICAgICAgICByZXR1cm4gdGhpcy5mcm9tKGxvY2FsX19jcmVhdGVMb2NhbCgpLCB3aXRob3V0U3VmZml4KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0byAodGltZSwgd2l0aG91dFN1ZmZpeCkge1xuICAgICAgICBpZiAodGhpcy5pc1ZhbGlkKCkgJiZcbiAgICAgICAgICAgICAgICAoKGlzTW9tZW50KHRpbWUpICYmIHRpbWUuaXNWYWxpZCgpKSB8fFxuICAgICAgICAgICAgICAgICBsb2NhbF9fY3JlYXRlTG9jYWwodGltZSkuaXNWYWxpZCgpKSkge1xuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZV9fY3JlYXRlRHVyYXRpb24oe2Zyb206IHRoaXMsIHRvOiB0aW1lfSkubG9jYWxlKHRoaXMubG9jYWxlKCkpLmh1bWFuaXplKCF3aXRob3V0U3VmZml4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxvY2FsZURhdGEoKS5pbnZhbGlkRGF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdG9Ob3cgKHdpdGhvdXRTdWZmaXgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudG8obG9jYWxfX2NyZWF0ZUxvY2FsKCksIHdpdGhvdXRTdWZmaXgpO1xuICAgIH1cblxuICAgIC8vIElmIHBhc3NlZCBhIGxvY2FsZSBrZXksIGl0IHdpbGwgc2V0IHRoZSBsb2NhbGUgZm9yIHRoaXNcbiAgICAvLyBpbnN0YW5jZS4gIE90aGVyd2lzZSwgaXQgd2lsbCByZXR1cm4gdGhlIGxvY2FsZSBjb25maWd1cmF0aW9uXG4gICAgLy8gdmFyaWFibGVzIGZvciB0aGlzIGluc3RhbmNlLlxuICAgIGZ1bmN0aW9uIGxvY2FsZSAoa2V5KSB7XG4gICAgICAgIHZhciBuZXdMb2NhbGVEYXRhO1xuXG4gICAgICAgIGlmIChrZXkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2xvY2FsZS5fYWJicjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5ld0xvY2FsZURhdGEgPSBsb2NhbGVfbG9jYWxlc19fZ2V0TG9jYWxlKGtleSk7XG4gICAgICAgICAgICBpZiAobmV3TG9jYWxlRGF0YSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9jYWxlID0gbmV3TG9jYWxlRGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGxhbmcgPSBkZXByZWNhdGUoXG4gICAgICAgICdtb21lbnQoKS5sYW5nKCkgaXMgZGVwcmVjYXRlZC4gSW5zdGVhZCwgdXNlIG1vbWVudCgpLmxvY2FsZURhdGEoKSB0byBnZXQgdGhlIGxhbmd1YWdlIGNvbmZpZ3VyYXRpb24uIFVzZSBtb21lbnQoKS5sb2NhbGUoKSB0byBjaGFuZ2UgbGFuZ3VhZ2VzLicsXG4gICAgICAgIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIGlmIChrZXkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmxvY2FsZURhdGEoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxlKGtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICApO1xuXG4gICAgZnVuY3Rpb24gbG9jYWxlRGF0YSAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2NhbGU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc3RhcnRPZiAodW5pdHMpIHtcbiAgICAgICAgdW5pdHMgPSBub3JtYWxpemVVbml0cyh1bml0cyk7XG4gICAgICAgIC8vIHRoZSBmb2xsb3dpbmcgc3dpdGNoIGludGVudGlvbmFsbHkgb21pdHMgYnJlYWsga2V5d29yZHNcbiAgICAgICAgLy8gdG8gdXRpbGl6ZSBmYWxsaW5nIHRocm91Z2ggdGhlIGNhc2VzLlxuICAgICAgICBzd2l0Y2ggKHVuaXRzKSB7XG4gICAgICAgIGNhc2UgJ3llYXInOlxuICAgICAgICAgICAgdGhpcy5tb250aCgwKTtcbiAgICAgICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgICAgY2FzZSAncXVhcnRlcic6XG4gICAgICAgIGNhc2UgJ21vbnRoJzpcbiAgICAgICAgICAgIHRoaXMuZGF0ZSgxKTtcbiAgICAgICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgICAgY2FzZSAnd2Vlayc6XG4gICAgICAgIGNhc2UgJ2lzb1dlZWsnOlxuICAgICAgICBjYXNlICdkYXknOlxuICAgICAgICBjYXNlICdkYXRlJzpcbiAgICAgICAgICAgIHRoaXMuaG91cnMoMCk7XG4gICAgICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICAgIGNhc2UgJ2hvdXInOlxuICAgICAgICAgICAgdGhpcy5taW51dGVzKDApO1xuICAgICAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgICBjYXNlICdtaW51dGUnOlxuICAgICAgICAgICAgdGhpcy5zZWNvbmRzKDApO1xuICAgICAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgICBjYXNlICdzZWNvbmQnOlxuICAgICAgICAgICAgdGhpcy5taWxsaXNlY29uZHMoMCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB3ZWVrcyBhcmUgYSBzcGVjaWFsIGNhc2VcbiAgICAgICAgaWYgKHVuaXRzID09PSAnd2VlaycpIHtcbiAgICAgICAgICAgIHRoaXMud2Vla2RheSgwKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodW5pdHMgPT09ICdpc29XZWVrJykge1xuICAgICAgICAgICAgdGhpcy5pc29XZWVrZGF5KDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcXVhcnRlcnMgYXJlIGFsc28gc3BlY2lhbFxuICAgICAgICBpZiAodW5pdHMgPT09ICdxdWFydGVyJykge1xuICAgICAgICAgICAgdGhpcy5tb250aChNYXRoLmZsb29yKHRoaXMubW9udGgoKSAvIDMpICogMyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBlbmRPZiAodW5pdHMpIHtcbiAgICAgICAgdW5pdHMgPSBub3JtYWxpemVVbml0cyh1bml0cyk7XG4gICAgICAgIGlmICh1bml0cyA9PT0gdW5kZWZpbmVkIHx8IHVuaXRzID09PSAnbWlsbGlzZWNvbmQnKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICdkYXRlJyBpcyBhbiBhbGlhcyBmb3IgJ2RheScsIHNvIGl0IHNob3VsZCBiZSBjb25zaWRlcmVkIGFzIHN1Y2guXG4gICAgICAgIGlmICh1bml0cyA9PT0gJ2RhdGUnKSB7XG4gICAgICAgICAgICB1bml0cyA9ICdkYXknO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhcnRPZih1bml0cykuYWRkKDEsICh1bml0cyA9PT0gJ2lzb1dlZWsnID8gJ3dlZWsnIDogdW5pdHMpKS5zdWJ0cmFjdCgxLCAnbXMnKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0b190eXBlX192YWx1ZU9mICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2QudmFsdWVPZigpIC0gKCh0aGlzLl9vZmZzZXQgfHwgMCkgKiA2MDAwMCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdW5peCAoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLmZsb29yKHRoaXMudmFsdWVPZigpIC8gMTAwMCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdG9EYXRlICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX29mZnNldCA/IG5ldyBEYXRlKHRoaXMudmFsdWVPZigpKSA6IHRoaXMuX2Q7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdG9BcnJheSAoKSB7XG4gICAgICAgIHZhciBtID0gdGhpcztcbiAgICAgICAgcmV0dXJuIFttLnllYXIoKSwgbS5tb250aCgpLCBtLmRhdGUoKSwgbS5ob3VyKCksIG0ubWludXRlKCksIG0uc2Vjb25kKCksIG0ubWlsbGlzZWNvbmQoKV07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdG9PYmplY3QgKCkge1xuICAgICAgICB2YXIgbSA9IHRoaXM7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB5ZWFyczogbS55ZWFyKCksXG4gICAgICAgICAgICBtb250aHM6IG0ubW9udGgoKSxcbiAgICAgICAgICAgIGRhdGU6IG0uZGF0ZSgpLFxuICAgICAgICAgICAgaG91cnM6IG0uaG91cnMoKSxcbiAgICAgICAgICAgIG1pbnV0ZXM6IG0ubWludXRlcygpLFxuICAgICAgICAgICAgc2Vjb25kczogbS5zZWNvbmRzKCksXG4gICAgICAgICAgICBtaWxsaXNlY29uZHM6IG0ubWlsbGlzZWNvbmRzKClcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0b0pTT04gKCkge1xuICAgICAgICAvLyBuZXcgRGF0ZShOYU4pLnRvSlNPTigpID09PSBudWxsXG4gICAgICAgIHJldHVybiB0aGlzLmlzVmFsaWQoKSA/IHRoaXMudG9JU09TdHJpbmcoKSA6IG51bGw7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbW9tZW50X3ZhbGlkX19pc1ZhbGlkICgpIHtcbiAgICAgICAgcmV0dXJuIHZhbGlkX19pc1ZhbGlkKHRoaXMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBhcnNpbmdGbGFncyAoKSB7XG4gICAgICAgIHJldHVybiBleHRlbmQoe30sIGdldFBhcnNpbmdGbGFncyh0aGlzKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW52YWxpZEF0ICgpIHtcbiAgICAgICAgcmV0dXJuIGdldFBhcnNpbmdGbGFncyh0aGlzKS5vdmVyZmxvdztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjcmVhdGlvbkRhdGEoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpbnB1dDogdGhpcy5faSxcbiAgICAgICAgICAgIGZvcm1hdDogdGhpcy5fZixcbiAgICAgICAgICAgIGxvY2FsZTogdGhpcy5fbG9jYWxlLFxuICAgICAgICAgICAgaXNVVEM6IHRoaXMuX2lzVVRDLFxuICAgICAgICAgICAgc3RyaWN0OiB0aGlzLl9zdHJpY3RcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBGT1JNQVRUSU5HXG5cbiAgICBhZGRGb3JtYXRUb2tlbigwLCBbJ2dnJywgMl0sIDAsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2Vla1llYXIoKSAlIDEwMDtcbiAgICB9KTtcblxuICAgIGFkZEZvcm1hdFRva2VuKDAsIFsnR0cnLCAyXSwgMCwgZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pc29XZWVrWWVhcigpICUgMTAwO1xuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gYWRkV2Vla1llYXJGb3JtYXRUb2tlbiAodG9rZW4sIGdldHRlcikge1xuICAgICAgICBhZGRGb3JtYXRUb2tlbigwLCBbdG9rZW4sIHRva2VuLmxlbmd0aF0sIDAsIGdldHRlcik7XG4gICAgfVxuXG4gICAgYWRkV2Vla1llYXJGb3JtYXRUb2tlbignZ2dnZycsICAgICAnd2Vla1llYXInKTtcbiAgICBhZGRXZWVrWWVhckZvcm1hdFRva2VuKCdnZ2dnZycsICAgICd3ZWVrWWVhcicpO1xuICAgIGFkZFdlZWtZZWFyRm9ybWF0VG9rZW4oJ0dHR0cnLCAgJ2lzb1dlZWtZZWFyJyk7XG4gICAgYWRkV2Vla1llYXJGb3JtYXRUb2tlbignR0dHR0cnLCAnaXNvV2Vla1llYXInKTtcblxuICAgIC8vIEFMSUFTRVNcblxuICAgIGFkZFVuaXRBbGlhcygnd2Vla1llYXInLCAnZ2cnKTtcbiAgICBhZGRVbml0QWxpYXMoJ2lzb1dlZWtZZWFyJywgJ0dHJyk7XG5cbiAgICAvLyBQQVJTSU5HXG5cbiAgICBhZGRSZWdleFRva2VuKCdHJywgICAgICBtYXRjaFNpZ25lZCk7XG4gICAgYWRkUmVnZXhUb2tlbignZycsICAgICAgbWF0Y2hTaWduZWQpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ0dHJywgICAgIG1hdGNoMXRvMiwgbWF0Y2gyKTtcbiAgICBhZGRSZWdleFRva2VuKCdnZycsICAgICBtYXRjaDF0bzIsIG1hdGNoMik7XG4gICAgYWRkUmVnZXhUb2tlbignR0dHRycsICAgbWF0Y2gxdG80LCBtYXRjaDQpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ2dnZ2cnLCAgIG1hdGNoMXRvNCwgbWF0Y2g0KTtcbiAgICBhZGRSZWdleFRva2VuKCdHR0dHRycsICBtYXRjaDF0bzYsIG1hdGNoNik7XG4gICAgYWRkUmVnZXhUb2tlbignZ2dnZ2cnLCAgbWF0Y2gxdG82LCBtYXRjaDYpO1xuXG4gICAgYWRkV2Vla1BhcnNlVG9rZW4oWydnZ2dnJywgJ2dnZ2dnJywgJ0dHR0cnLCAnR0dHR0cnXSwgZnVuY3Rpb24gKGlucHV0LCB3ZWVrLCBjb25maWcsIHRva2VuKSB7XG4gICAgICAgIHdlZWtbdG9rZW4uc3Vic3RyKDAsIDIpXSA9IHRvSW50KGlucHV0KTtcbiAgICB9KTtcblxuICAgIGFkZFdlZWtQYXJzZVRva2VuKFsnZ2cnLCAnR0cnXSwgZnVuY3Rpb24gKGlucHV0LCB3ZWVrLCBjb25maWcsIHRva2VuKSB7XG4gICAgICAgIHdlZWtbdG9rZW5dID0gdXRpbHNfaG9va3NfX2hvb2tzLnBhcnNlVHdvRGlnaXRZZWFyKGlucHV0KTtcbiAgICB9KTtcblxuICAgIC8vIE1PTUVOVFNcblxuICAgIGZ1bmN0aW9uIGdldFNldFdlZWtZZWFyIChpbnB1dCkge1xuICAgICAgICByZXR1cm4gZ2V0U2V0V2Vla1llYXJIZWxwZXIuY2FsbCh0aGlzLFxuICAgICAgICAgICAgICAgIGlucHV0LFxuICAgICAgICAgICAgICAgIHRoaXMud2VlaygpLFxuICAgICAgICAgICAgICAgIHRoaXMud2Vla2RheSgpLFxuICAgICAgICAgICAgICAgIHRoaXMubG9jYWxlRGF0YSgpLl93ZWVrLmRvdyxcbiAgICAgICAgICAgICAgICB0aGlzLmxvY2FsZURhdGEoKS5fd2Vlay5kb3kpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNldElTT1dlZWtZZWFyIChpbnB1dCkge1xuICAgICAgICByZXR1cm4gZ2V0U2V0V2Vla1llYXJIZWxwZXIuY2FsbCh0aGlzLFxuICAgICAgICAgICAgICAgIGlucHV0LCB0aGlzLmlzb1dlZWsoKSwgdGhpcy5pc29XZWVrZGF5KCksIDEsIDQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldElTT1dlZWtzSW5ZZWFyICgpIHtcbiAgICAgICAgcmV0dXJuIHdlZWtzSW5ZZWFyKHRoaXMueWVhcigpLCAxLCA0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRXZWVrc0luWWVhciAoKSB7XG4gICAgICAgIHZhciB3ZWVrSW5mbyA9IHRoaXMubG9jYWxlRGF0YSgpLl93ZWVrO1xuICAgICAgICByZXR1cm4gd2Vla3NJblllYXIodGhpcy55ZWFyKCksIHdlZWtJbmZvLmRvdywgd2Vla0luZm8uZG95KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRTZXRXZWVrWWVhckhlbHBlcihpbnB1dCwgd2Vlaywgd2Vla2RheSwgZG93LCBkb3kpIHtcbiAgICAgICAgdmFyIHdlZWtzVGFyZ2V0O1xuICAgICAgICBpZiAoaW5wdXQgPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIHdlZWtPZlllYXIodGhpcywgZG93LCBkb3kpLnllYXI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3ZWVrc1RhcmdldCA9IHdlZWtzSW5ZZWFyKGlucHV0LCBkb3csIGRveSk7XG4gICAgICAgICAgICBpZiAod2VlayA+IHdlZWtzVGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgd2VlayA9IHdlZWtzVGFyZ2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNldFdlZWtBbGwuY2FsbCh0aGlzLCBpbnB1dCwgd2Vlaywgd2Vla2RheSwgZG93LCBkb3kpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0V2Vla0FsbCh3ZWVrWWVhciwgd2Vlaywgd2Vla2RheSwgZG93LCBkb3kpIHtcbiAgICAgICAgdmFyIGRheU9mWWVhckRhdGEgPSBkYXlPZlllYXJGcm9tV2Vla3Mod2Vla1llYXIsIHdlZWssIHdlZWtkYXksIGRvdywgZG95KSxcbiAgICAgICAgICAgIGRhdGUgPSBjcmVhdGVVVENEYXRlKGRheU9mWWVhckRhdGEueWVhciwgMCwgZGF5T2ZZZWFyRGF0YS5kYXlPZlllYXIpO1xuXG4gICAgICAgIHRoaXMueWVhcihkYXRlLmdldFVUQ0Z1bGxZZWFyKCkpO1xuICAgICAgICB0aGlzLm1vbnRoKGRhdGUuZ2V0VVRDTW9udGgoKSk7XG4gICAgICAgIHRoaXMuZGF0ZShkYXRlLmdldFVUQ0RhdGUoKSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8vIEZPUk1BVFRJTkdcblxuICAgIGFkZEZvcm1hdFRva2VuKCdRJywgMCwgJ1FvJywgJ3F1YXJ0ZXInKTtcblxuICAgIC8vIEFMSUFTRVNcblxuICAgIGFkZFVuaXRBbGlhcygncXVhcnRlcicsICdRJyk7XG5cbiAgICAvLyBQQVJTSU5HXG5cbiAgICBhZGRSZWdleFRva2VuKCdRJywgbWF0Y2gxKTtcbiAgICBhZGRQYXJzZVRva2VuKCdRJywgZnVuY3Rpb24gKGlucHV0LCBhcnJheSkge1xuICAgICAgICBhcnJheVtNT05USF0gPSAodG9JbnQoaW5wdXQpIC0gMSkgKiAzO1xuICAgIH0pO1xuXG4gICAgLy8gTU9NRU5UU1xuXG4gICAgZnVuY3Rpb24gZ2V0U2V0UXVhcnRlciAoaW5wdXQpIHtcbiAgICAgICAgcmV0dXJuIGlucHV0ID09IG51bGwgPyBNYXRoLmNlaWwoKHRoaXMubW9udGgoKSArIDEpIC8gMykgOiB0aGlzLm1vbnRoKChpbnB1dCAtIDEpICogMyArIHRoaXMubW9udGgoKSAlIDMpO1xuICAgIH1cblxuICAgIC8vIEZPUk1BVFRJTkdcblxuICAgIGFkZEZvcm1hdFRva2VuKCd3JywgWyd3dycsIDJdLCAnd28nLCAnd2VlaycpO1xuICAgIGFkZEZvcm1hdFRva2VuKCdXJywgWydXVycsIDJdLCAnV28nLCAnaXNvV2VlaycpO1xuXG4gICAgLy8gQUxJQVNFU1xuXG4gICAgYWRkVW5pdEFsaWFzKCd3ZWVrJywgJ3cnKTtcbiAgICBhZGRVbml0QWxpYXMoJ2lzb1dlZWsnLCAnVycpO1xuXG4gICAgLy8gUEFSU0lOR1xuXG4gICAgYWRkUmVnZXhUb2tlbigndycsICBtYXRjaDF0bzIpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ3d3JywgbWF0Y2gxdG8yLCBtYXRjaDIpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ1cnLCAgbWF0Y2gxdG8yKTtcbiAgICBhZGRSZWdleFRva2VuKCdXVycsIG1hdGNoMXRvMiwgbWF0Y2gyKTtcblxuICAgIGFkZFdlZWtQYXJzZVRva2VuKFsndycsICd3dycsICdXJywgJ1dXJ10sIGZ1bmN0aW9uIChpbnB1dCwgd2VlaywgY29uZmlnLCB0b2tlbikge1xuICAgICAgICB3ZWVrW3Rva2VuLnN1YnN0cigwLCAxKV0gPSB0b0ludChpbnB1dCk7XG4gICAgfSk7XG5cbiAgICAvLyBIRUxQRVJTXG5cbiAgICAvLyBMT0NBTEVTXG5cbiAgICBmdW5jdGlvbiBsb2NhbGVXZWVrIChtb20pIHtcbiAgICAgICAgcmV0dXJuIHdlZWtPZlllYXIobW9tLCB0aGlzLl93ZWVrLmRvdywgdGhpcy5fd2Vlay5kb3kpLndlZWs7XG4gICAgfVxuXG4gICAgdmFyIGRlZmF1bHRMb2NhbGVXZWVrID0ge1xuICAgICAgICBkb3cgOiAwLCAvLyBTdW5kYXkgaXMgdGhlIGZpcnN0IGRheSBvZiB0aGUgd2Vlay5cbiAgICAgICAgZG95IDogNiAgLy8gVGhlIHdlZWsgdGhhdCBjb250YWlucyBKYW4gMXN0IGlzIHRoZSBmaXJzdCB3ZWVrIG9mIHRoZSB5ZWFyLlxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBsb2NhbGVGaXJzdERheU9mV2VlayAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl93ZWVrLmRvdztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2NhbGVGaXJzdERheU9mWWVhciAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl93ZWVrLmRveTtcbiAgICB9XG5cbiAgICAvLyBNT01FTlRTXG5cbiAgICBmdW5jdGlvbiBnZXRTZXRXZWVrIChpbnB1dCkge1xuICAgICAgICB2YXIgd2VlayA9IHRoaXMubG9jYWxlRGF0YSgpLndlZWsodGhpcyk7XG4gICAgICAgIHJldHVybiBpbnB1dCA9PSBudWxsID8gd2VlayA6IHRoaXMuYWRkKChpbnB1dCAtIHdlZWspICogNywgJ2QnKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRTZXRJU09XZWVrIChpbnB1dCkge1xuICAgICAgICB2YXIgd2VlayA9IHdlZWtPZlllYXIodGhpcywgMSwgNCkud2VlaztcbiAgICAgICAgcmV0dXJuIGlucHV0ID09IG51bGwgPyB3ZWVrIDogdGhpcy5hZGQoKGlucHV0IC0gd2VlaykgKiA3LCAnZCcpO1xuICAgIH1cblxuICAgIC8vIEZPUk1BVFRJTkdcblxuICAgIGFkZEZvcm1hdFRva2VuKCdEJywgWydERCcsIDJdLCAnRG8nLCAnZGF0ZScpO1xuXG4gICAgLy8gQUxJQVNFU1xuXG4gICAgYWRkVW5pdEFsaWFzKCdkYXRlJywgJ0QnKTtcblxuICAgIC8vIFBBUlNJTkdcblxuICAgIGFkZFJlZ2V4VG9rZW4oJ0QnLCAgbWF0Y2gxdG8yKTtcbiAgICBhZGRSZWdleFRva2VuKCdERCcsIG1hdGNoMXRvMiwgbWF0Y2gyKTtcbiAgICBhZGRSZWdleFRva2VuKCdEbycsIGZ1bmN0aW9uIChpc1N0cmljdCwgbG9jYWxlKSB7XG4gICAgICAgIHJldHVybiBpc1N0cmljdCA/IGxvY2FsZS5fb3JkaW5hbFBhcnNlIDogbG9jYWxlLl9vcmRpbmFsUGFyc2VMZW5pZW50O1xuICAgIH0pO1xuXG4gICAgYWRkUGFyc2VUb2tlbihbJ0QnLCAnREQnXSwgREFURSk7XG4gICAgYWRkUGFyc2VUb2tlbignRG8nLCBmdW5jdGlvbiAoaW5wdXQsIGFycmF5KSB7XG4gICAgICAgIGFycmF5W0RBVEVdID0gdG9JbnQoaW5wdXQubWF0Y2gobWF0Y2gxdG8yKVswXSwgMTApO1xuICAgIH0pO1xuXG4gICAgLy8gTU9NRU5UU1xuXG4gICAgdmFyIGdldFNldERheU9mTW9udGggPSBtYWtlR2V0U2V0KCdEYXRlJywgdHJ1ZSk7XG5cbiAgICAvLyBGT1JNQVRUSU5HXG5cbiAgICBhZGRGb3JtYXRUb2tlbignZCcsIDAsICdkbycsICdkYXknKTtcblxuICAgIGFkZEZvcm1hdFRva2VuKCdkZCcsIDAsIDAsIGZ1bmN0aW9uIChmb3JtYXQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxlRGF0YSgpLndlZWtkYXlzTWluKHRoaXMsIGZvcm1hdCk7XG4gICAgfSk7XG5cbiAgICBhZGRGb3JtYXRUb2tlbignZGRkJywgMCwgMCwgZnVuY3Rpb24gKGZvcm1hdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbGVEYXRhKCkud2Vla2RheXNTaG9ydCh0aGlzLCBmb3JtYXQpO1xuICAgIH0pO1xuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ2RkZGQnLCAwLCAwLCBmdW5jdGlvbiAoZm9ybWF0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsZURhdGEoKS53ZWVrZGF5cyh0aGlzLCBmb3JtYXQpO1xuICAgIH0pO1xuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ2UnLCAwLCAwLCAnd2Vla2RheScpO1xuICAgIGFkZEZvcm1hdFRva2VuKCdFJywgMCwgMCwgJ2lzb1dlZWtkYXknKTtcblxuICAgIC8vIEFMSUFTRVNcblxuICAgIGFkZFVuaXRBbGlhcygnZGF5JywgJ2QnKTtcbiAgICBhZGRVbml0QWxpYXMoJ3dlZWtkYXknLCAnZScpO1xuICAgIGFkZFVuaXRBbGlhcygnaXNvV2Vla2RheScsICdFJyk7XG5cbiAgICAvLyBQQVJTSU5HXG5cbiAgICBhZGRSZWdleFRva2VuKCdkJywgICAgbWF0Y2gxdG8yKTtcbiAgICBhZGRSZWdleFRva2VuKCdlJywgICAgbWF0Y2gxdG8yKTtcbiAgICBhZGRSZWdleFRva2VuKCdFJywgICAgbWF0Y2gxdG8yKTtcbiAgICBhZGRSZWdleFRva2VuKCdkZCcsICAgZnVuY3Rpb24gKGlzU3RyaWN0LCBsb2NhbGUpIHtcbiAgICAgICAgcmV0dXJuIGxvY2FsZS53ZWVrZGF5c01pblJlZ2V4KGlzU3RyaWN0KTtcbiAgICB9KTtcbiAgICBhZGRSZWdleFRva2VuKCdkZGQnLCAgIGZ1bmN0aW9uIChpc1N0cmljdCwgbG9jYWxlKSB7XG4gICAgICAgIHJldHVybiBsb2NhbGUud2Vla2RheXNTaG9ydFJlZ2V4KGlzU3RyaWN0KTtcbiAgICB9KTtcbiAgICBhZGRSZWdleFRva2VuKCdkZGRkJywgICBmdW5jdGlvbiAoaXNTdHJpY3QsIGxvY2FsZSkge1xuICAgICAgICByZXR1cm4gbG9jYWxlLndlZWtkYXlzUmVnZXgoaXNTdHJpY3QpO1xuICAgIH0pO1xuXG4gICAgYWRkV2Vla1BhcnNlVG9rZW4oWydkZCcsICdkZGQnLCAnZGRkZCddLCBmdW5jdGlvbiAoaW5wdXQsIHdlZWssIGNvbmZpZywgdG9rZW4pIHtcbiAgICAgICAgdmFyIHdlZWtkYXkgPSBjb25maWcuX2xvY2FsZS53ZWVrZGF5c1BhcnNlKGlucHV0LCB0b2tlbiwgY29uZmlnLl9zdHJpY3QpO1xuICAgICAgICAvLyBpZiB3ZSBkaWRuJ3QgZ2V0IGEgd2Vla2RheSBuYW1lLCBtYXJrIHRoZSBkYXRlIGFzIGludmFsaWRcbiAgICAgICAgaWYgKHdlZWtkYXkgIT0gbnVsbCkge1xuICAgICAgICAgICAgd2Vlay5kID0gd2Vla2RheTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGdldFBhcnNpbmdGbGFncyhjb25maWcpLmludmFsaWRXZWVrZGF5ID0gaW5wdXQ7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGFkZFdlZWtQYXJzZVRva2VuKFsnZCcsICdlJywgJ0UnXSwgZnVuY3Rpb24gKGlucHV0LCB3ZWVrLCBjb25maWcsIHRva2VuKSB7XG4gICAgICAgIHdlZWtbdG9rZW5dID0gdG9JbnQoaW5wdXQpO1xuICAgIH0pO1xuXG4gICAgLy8gSEVMUEVSU1xuXG4gICAgZnVuY3Rpb24gcGFyc2VXZWVrZGF5KGlucHV0LCBsb2NhbGUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBpbnB1dCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHJldHVybiBpbnB1dDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaXNOYU4oaW5wdXQpKSB7XG4gICAgICAgICAgICByZXR1cm4gcGFyc2VJbnQoaW5wdXQsIDEwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlucHV0ID0gbG9jYWxlLndlZWtkYXlzUGFyc2UoaW5wdXQpO1xuICAgICAgICBpZiAodHlwZW9mIGlucHV0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgcmV0dXJuIGlucHV0O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gTE9DQUxFU1xuXG4gICAgdmFyIGRlZmF1bHRMb2NhbGVXZWVrZGF5cyA9ICdTdW5kYXlfTW9uZGF5X1R1ZXNkYXlfV2VkbmVzZGF5X1RodXJzZGF5X0ZyaWRheV9TYXR1cmRheScuc3BsaXQoJ18nKTtcbiAgICBmdW5jdGlvbiBsb2NhbGVXZWVrZGF5cyAobSwgZm9ybWF0KSB7XG4gICAgICAgIHJldHVybiBpc0FycmF5KHRoaXMuX3dlZWtkYXlzKSA/IHRoaXMuX3dlZWtkYXlzW20uZGF5KCldIDpcbiAgICAgICAgICAgIHRoaXMuX3dlZWtkYXlzW3RoaXMuX3dlZWtkYXlzLmlzRm9ybWF0LnRlc3QoZm9ybWF0KSA/ICdmb3JtYXQnIDogJ3N0YW5kYWxvbmUnXVttLmRheSgpXTtcbiAgICB9XG5cbiAgICB2YXIgZGVmYXVsdExvY2FsZVdlZWtkYXlzU2hvcnQgPSAnU3VuX01vbl9UdWVfV2VkX1RodV9GcmlfU2F0Jy5zcGxpdCgnXycpO1xuICAgIGZ1bmN0aW9uIGxvY2FsZVdlZWtkYXlzU2hvcnQgKG0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dlZWtkYXlzU2hvcnRbbS5kYXkoKV07XG4gICAgfVxuXG4gICAgdmFyIGRlZmF1bHRMb2NhbGVXZWVrZGF5c01pbiA9ICdTdV9Nb19UdV9XZV9UaF9Gcl9TYScuc3BsaXQoJ18nKTtcbiAgICBmdW5jdGlvbiBsb2NhbGVXZWVrZGF5c01pbiAobSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fd2Vla2RheXNNaW5bbS5kYXkoKV07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGF5X29mX3dlZWtfX2hhbmRsZVN0cmljdFBhcnNlKHdlZWtkYXlOYW1lLCBmb3JtYXQsIHN0cmljdCkge1xuICAgICAgICB2YXIgaSwgaWksIG1vbSwgbGxjID0gd2Vla2RheU5hbWUudG9Mb2NhbGVMb3dlckNhc2UoKTtcbiAgICAgICAgaWYgKCF0aGlzLl93ZWVrZGF5c1BhcnNlKSB7XG4gICAgICAgICAgICB0aGlzLl93ZWVrZGF5c1BhcnNlID0gW107XG4gICAgICAgICAgICB0aGlzLl9zaG9ydFdlZWtkYXlzUGFyc2UgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuX21pbldlZWtkYXlzUGFyc2UgPSBbXTtcblxuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IDc7ICsraSkge1xuICAgICAgICAgICAgICAgIG1vbSA9IGNyZWF0ZV91dGNfX2NyZWF0ZVVUQyhbMjAwMCwgMV0pLmRheShpKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9taW5XZWVrZGF5c1BhcnNlW2ldID0gdGhpcy53ZWVrZGF5c01pbihtb20sICcnKS50b0xvY2FsZUxvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3Nob3J0V2Vla2RheXNQYXJzZVtpXSA9IHRoaXMud2Vla2RheXNTaG9ydChtb20sICcnKS50b0xvY2FsZUxvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3dlZWtkYXlzUGFyc2VbaV0gPSB0aGlzLndlZWtkYXlzKG1vbSwgJycpLnRvTG9jYWxlTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3RyaWN0KSB7XG4gICAgICAgICAgICBpZiAoZm9ybWF0ID09PSAnZGRkZCcpIHtcbiAgICAgICAgICAgICAgICBpaSA9IGluZGV4T2YuY2FsbCh0aGlzLl93ZWVrZGF5c1BhcnNlLCBsbGMpO1xuICAgICAgICAgICAgICAgIHJldHVybiBpaSAhPT0gLTEgPyBpaSA6IG51bGw7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZvcm1hdCA9PT0gJ2RkZCcpIHtcbiAgICAgICAgICAgICAgICBpaSA9IGluZGV4T2YuY2FsbCh0aGlzLl9zaG9ydFdlZWtkYXlzUGFyc2UsIGxsYyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGlpICE9PSAtMSA/IGlpIDogbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWkgPSBpbmRleE9mLmNhbGwodGhpcy5fbWluV2Vla2RheXNQYXJzZSwgbGxjKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gaWkgIT09IC0xID8gaWkgOiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGZvcm1hdCA9PT0gJ2RkZGQnKSB7XG4gICAgICAgICAgICAgICAgaWkgPSBpbmRleE9mLmNhbGwodGhpcy5fd2Vla2RheXNQYXJzZSwgbGxjKTtcbiAgICAgICAgICAgICAgICBpZiAoaWkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpaTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWkgPSBpbmRleE9mLmNhbGwodGhpcy5fc2hvcnRXZWVrZGF5c1BhcnNlLCBsbGMpO1xuICAgICAgICAgICAgICAgIGlmIChpaSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGlpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpaSA9IGluZGV4T2YuY2FsbCh0aGlzLl9taW5XZWVrZGF5c1BhcnNlLCBsbGMpO1xuICAgICAgICAgICAgICAgIHJldHVybiBpaSAhPT0gLTEgPyBpaSA6IG51bGw7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZvcm1hdCA9PT0gJ2RkZCcpIHtcbiAgICAgICAgICAgICAgICBpaSA9IGluZGV4T2YuY2FsbCh0aGlzLl9zaG9ydFdlZWtkYXlzUGFyc2UsIGxsYyk7XG4gICAgICAgICAgICAgICAgaWYgKGlpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaWk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlpID0gaW5kZXhPZi5jYWxsKHRoaXMuX3dlZWtkYXlzUGFyc2UsIGxsYyk7XG4gICAgICAgICAgICAgICAgaWYgKGlpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaWk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlpID0gaW5kZXhPZi5jYWxsKHRoaXMuX21pbldlZWtkYXlzUGFyc2UsIGxsYyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGlpICE9PSAtMSA/IGlpIDogbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWkgPSBpbmRleE9mLmNhbGwodGhpcy5fbWluV2Vla2RheXNQYXJzZSwgbGxjKTtcbiAgICAgICAgICAgICAgICBpZiAoaWkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpaTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWkgPSBpbmRleE9mLmNhbGwodGhpcy5fd2Vla2RheXNQYXJzZSwgbGxjKTtcbiAgICAgICAgICAgICAgICBpZiAoaWkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpaTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWkgPSBpbmRleE9mLmNhbGwodGhpcy5fc2hvcnRXZWVrZGF5c1BhcnNlLCBsbGMpO1xuICAgICAgICAgICAgICAgIHJldHVybiBpaSAhPT0gLTEgPyBpaSA6IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2NhbGVXZWVrZGF5c1BhcnNlICh3ZWVrZGF5TmFtZSwgZm9ybWF0LCBzdHJpY3QpIHtcbiAgICAgICAgdmFyIGksIG1vbSwgcmVnZXg7XG5cbiAgICAgICAgaWYgKHRoaXMuX3dlZWtkYXlzUGFyc2VFeGFjdCkge1xuICAgICAgICAgICAgcmV0dXJuIGRheV9vZl93ZWVrX19oYW5kbGVTdHJpY3RQYXJzZS5jYWxsKHRoaXMsIHdlZWtkYXlOYW1lLCBmb3JtYXQsIHN0cmljdCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuX3dlZWtkYXlzUGFyc2UpIHtcbiAgICAgICAgICAgIHRoaXMuX3dlZWtkYXlzUGFyc2UgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuX21pbldlZWtkYXlzUGFyc2UgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuX3Nob3J0V2Vla2RheXNQYXJzZSA9IFtdO1xuICAgICAgICAgICAgdGhpcy5fZnVsbFdlZWtkYXlzUGFyc2UgPSBbXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCA3OyBpKyspIHtcbiAgICAgICAgICAgIC8vIG1ha2UgdGhlIHJlZ2V4IGlmIHdlIGRvbid0IGhhdmUgaXQgYWxyZWFkeVxuXG4gICAgICAgICAgICBtb20gPSBjcmVhdGVfdXRjX19jcmVhdGVVVEMoWzIwMDAsIDFdKS5kYXkoaSk7XG4gICAgICAgICAgICBpZiAoc3RyaWN0ICYmICF0aGlzLl9mdWxsV2Vla2RheXNQYXJzZVtpXSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2Z1bGxXZWVrZGF5c1BhcnNlW2ldID0gbmV3IFJlZ0V4cCgnXicgKyB0aGlzLndlZWtkYXlzKG1vbSwgJycpLnJlcGxhY2UoJy4nLCAnXFwuPycpICsgJyQnLCAnaScpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3Nob3J0V2Vla2RheXNQYXJzZVtpXSA9IG5ldyBSZWdFeHAoJ14nICsgdGhpcy53ZWVrZGF5c1Nob3J0KG1vbSwgJycpLnJlcGxhY2UoJy4nLCAnXFwuPycpICsgJyQnLCAnaScpO1xuICAgICAgICAgICAgICAgIHRoaXMuX21pbldlZWtkYXlzUGFyc2VbaV0gPSBuZXcgUmVnRXhwKCdeJyArIHRoaXMud2Vla2RheXNNaW4obW9tLCAnJykucmVwbGFjZSgnLicsICdcXC4/JykgKyAnJCcsICdpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRoaXMuX3dlZWtkYXlzUGFyc2VbaV0pIHtcbiAgICAgICAgICAgICAgICByZWdleCA9ICdeJyArIHRoaXMud2Vla2RheXMobW9tLCAnJykgKyAnfF4nICsgdGhpcy53ZWVrZGF5c1Nob3J0KG1vbSwgJycpICsgJ3xeJyArIHRoaXMud2Vla2RheXNNaW4obW9tLCAnJyk7XG4gICAgICAgICAgICAgICAgdGhpcy5fd2Vla2RheXNQYXJzZVtpXSA9IG5ldyBSZWdFeHAocmVnZXgucmVwbGFjZSgnLicsICcnKSwgJ2knKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHRlc3QgdGhlIHJlZ2V4XG4gICAgICAgICAgICBpZiAoc3RyaWN0ICYmIGZvcm1hdCA9PT0gJ2RkZGQnICYmIHRoaXMuX2Z1bGxXZWVrZGF5c1BhcnNlW2ldLnRlc3Qod2Vla2RheU5hbWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHN0cmljdCAmJiBmb3JtYXQgPT09ICdkZGQnICYmIHRoaXMuX3Nob3J0V2Vla2RheXNQYXJzZVtpXS50ZXN0KHdlZWtkYXlOYW1lKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzdHJpY3QgJiYgZm9ybWF0ID09PSAnZGQnICYmIHRoaXMuX21pbldlZWtkYXlzUGFyc2VbaV0udGVzdCh3ZWVrZGF5TmFtZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXN0cmljdCAmJiB0aGlzLl93ZWVrZGF5c1BhcnNlW2ldLnRlc3Qod2Vla2RheU5hbWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNT01FTlRTXG5cbiAgICBmdW5jdGlvbiBnZXRTZXREYXlPZldlZWsgKGlucHV0KSB7XG4gICAgICAgIGlmICghdGhpcy5pc1ZhbGlkKCkpIHtcbiAgICAgICAgICAgIHJldHVybiBpbnB1dCAhPSBudWxsID8gdGhpcyA6IE5hTjtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZGF5ID0gdGhpcy5faXNVVEMgPyB0aGlzLl9kLmdldFVUQ0RheSgpIDogdGhpcy5fZC5nZXREYXkoKTtcbiAgICAgICAgaWYgKGlucHV0ICE9IG51bGwpIHtcbiAgICAgICAgICAgIGlucHV0ID0gcGFyc2VXZWVrZGF5KGlucHV0LCB0aGlzLmxvY2FsZURhdGEoKSk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5hZGQoaW5wdXQgLSBkYXksICdkJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZGF5O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0U2V0TG9jYWxlRGF5T2ZXZWVrIChpbnB1dCkge1xuICAgICAgICBpZiAoIXRoaXMuaXNWYWxpZCgpKSB7XG4gICAgICAgICAgICByZXR1cm4gaW5wdXQgIT0gbnVsbCA/IHRoaXMgOiBOYU47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHdlZWtkYXkgPSAodGhpcy5kYXkoKSArIDcgLSB0aGlzLmxvY2FsZURhdGEoKS5fd2Vlay5kb3cpICUgNztcbiAgICAgICAgcmV0dXJuIGlucHV0ID09IG51bGwgPyB3ZWVrZGF5IDogdGhpcy5hZGQoaW5wdXQgLSB3ZWVrZGF5LCAnZCcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNldElTT0RheU9mV2VlayAoaW5wdXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLmlzVmFsaWQoKSkge1xuICAgICAgICAgICAgcmV0dXJuIGlucHV0ICE9IG51bGwgPyB0aGlzIDogTmFOO1xuICAgICAgICB9XG4gICAgICAgIC8vIGJlaGF2ZXMgdGhlIHNhbWUgYXMgbW9tZW50I2RheSBleGNlcHRcbiAgICAgICAgLy8gYXMgYSBnZXR0ZXIsIHJldHVybnMgNyBpbnN0ZWFkIG9mIDAgKDEtNyByYW5nZSBpbnN0ZWFkIG9mIDAtNilcbiAgICAgICAgLy8gYXMgYSBzZXR0ZXIsIHN1bmRheSBzaG91bGQgYmVsb25nIHRvIHRoZSBwcmV2aW91cyB3ZWVrLlxuICAgICAgICByZXR1cm4gaW5wdXQgPT0gbnVsbCA/IHRoaXMuZGF5KCkgfHwgNyA6IHRoaXMuZGF5KHRoaXMuZGF5KCkgJSA3ID8gaW5wdXQgOiBpbnB1dCAtIDcpO1xuICAgIH1cblxuICAgIHZhciBkZWZhdWx0V2Vla2RheXNSZWdleCA9IG1hdGNoV29yZDtcbiAgICBmdW5jdGlvbiB3ZWVrZGF5c1JlZ2V4IChpc1N0cmljdCkge1xuICAgICAgICBpZiAodGhpcy5fd2Vla2RheXNQYXJzZUV4YWN0KSB7XG4gICAgICAgICAgICBpZiAoIWhhc093blByb3AodGhpcywgJ193ZWVrZGF5c1JlZ2V4JykpIHtcbiAgICAgICAgICAgICAgICBjb21wdXRlV2Vla2RheXNQYXJzZS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzU3RyaWN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3dlZWtkYXlzU3RyaWN0UmVnZXg7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl93ZWVrZGF5c1JlZ2V4O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3dlZWtkYXlzU3RyaWN0UmVnZXggJiYgaXNTdHJpY3QgP1xuICAgICAgICAgICAgICAgIHRoaXMuX3dlZWtkYXlzU3RyaWN0UmVnZXggOiB0aGlzLl93ZWVrZGF5c1JlZ2V4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGRlZmF1bHRXZWVrZGF5c1Nob3J0UmVnZXggPSBtYXRjaFdvcmQ7XG4gICAgZnVuY3Rpb24gd2Vla2RheXNTaG9ydFJlZ2V4IChpc1N0cmljdCkge1xuICAgICAgICBpZiAodGhpcy5fd2Vla2RheXNQYXJzZUV4YWN0KSB7XG4gICAgICAgICAgICBpZiAoIWhhc093blByb3AodGhpcywgJ193ZWVrZGF5c1JlZ2V4JykpIHtcbiAgICAgICAgICAgICAgICBjb21wdXRlV2Vla2RheXNQYXJzZS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzU3RyaWN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3dlZWtkYXlzU2hvcnRTdHJpY3RSZWdleDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3dlZWtkYXlzU2hvcnRSZWdleDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl93ZWVrZGF5c1Nob3J0U3RyaWN0UmVnZXggJiYgaXNTdHJpY3QgP1xuICAgICAgICAgICAgICAgIHRoaXMuX3dlZWtkYXlzU2hvcnRTdHJpY3RSZWdleCA6IHRoaXMuX3dlZWtkYXlzU2hvcnRSZWdleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBkZWZhdWx0V2Vla2RheXNNaW5SZWdleCA9IG1hdGNoV29yZDtcbiAgICBmdW5jdGlvbiB3ZWVrZGF5c01pblJlZ2V4IChpc1N0cmljdCkge1xuICAgICAgICBpZiAodGhpcy5fd2Vla2RheXNQYXJzZUV4YWN0KSB7XG4gICAgICAgICAgICBpZiAoIWhhc093blByb3AodGhpcywgJ193ZWVrZGF5c1JlZ2V4JykpIHtcbiAgICAgICAgICAgICAgICBjb21wdXRlV2Vla2RheXNQYXJzZS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzU3RyaWN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3dlZWtkYXlzTWluU3RyaWN0UmVnZXg7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl93ZWVrZGF5c01pblJlZ2V4O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3dlZWtkYXlzTWluU3RyaWN0UmVnZXggJiYgaXNTdHJpY3QgP1xuICAgICAgICAgICAgICAgIHRoaXMuX3dlZWtkYXlzTWluU3RyaWN0UmVnZXggOiB0aGlzLl93ZWVrZGF5c01pblJlZ2V4O1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBjb21wdXRlV2Vla2RheXNQYXJzZSAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIGNtcExlblJldihhLCBiKSB7XG4gICAgICAgICAgICByZXR1cm4gYi5sZW5ndGggLSBhLmxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBtaW5QaWVjZXMgPSBbXSwgc2hvcnRQaWVjZXMgPSBbXSwgbG9uZ1BpZWNlcyA9IFtdLCBtaXhlZFBpZWNlcyA9IFtdLFxuICAgICAgICAgICAgaSwgbW9tLCBtaW5wLCBzaG9ydHAsIGxvbmdwO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgNzsgaSsrKSB7XG4gICAgICAgICAgICAvLyBtYWtlIHRoZSByZWdleCBpZiB3ZSBkb24ndCBoYXZlIGl0IGFscmVhZHlcbiAgICAgICAgICAgIG1vbSA9IGNyZWF0ZV91dGNfX2NyZWF0ZVVUQyhbMjAwMCwgMV0pLmRheShpKTtcbiAgICAgICAgICAgIG1pbnAgPSB0aGlzLndlZWtkYXlzTWluKG1vbSwgJycpO1xuICAgICAgICAgICAgc2hvcnRwID0gdGhpcy53ZWVrZGF5c1Nob3J0KG1vbSwgJycpO1xuICAgICAgICAgICAgbG9uZ3AgPSB0aGlzLndlZWtkYXlzKG1vbSwgJycpO1xuICAgICAgICAgICAgbWluUGllY2VzLnB1c2gobWlucCk7XG4gICAgICAgICAgICBzaG9ydFBpZWNlcy5wdXNoKHNob3J0cCk7XG4gICAgICAgICAgICBsb25nUGllY2VzLnB1c2gobG9uZ3ApO1xuICAgICAgICAgICAgbWl4ZWRQaWVjZXMucHVzaChtaW5wKTtcbiAgICAgICAgICAgIG1peGVkUGllY2VzLnB1c2goc2hvcnRwKTtcbiAgICAgICAgICAgIG1peGVkUGllY2VzLnB1c2gobG9uZ3ApO1xuICAgICAgICB9XG4gICAgICAgIC8vIFNvcnRpbmcgbWFrZXMgc3VyZSBpZiBvbmUgd2Vla2RheSAob3IgYWJicikgaXMgYSBwcmVmaXggb2YgYW5vdGhlciBpdFxuICAgICAgICAvLyB3aWxsIG1hdGNoIHRoZSBsb25nZXIgcGllY2UuXG4gICAgICAgIG1pblBpZWNlcy5zb3J0KGNtcExlblJldik7XG4gICAgICAgIHNob3J0UGllY2VzLnNvcnQoY21wTGVuUmV2KTtcbiAgICAgICAgbG9uZ1BpZWNlcy5zb3J0KGNtcExlblJldik7XG4gICAgICAgIG1peGVkUGllY2VzLnNvcnQoY21wTGVuUmV2KTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IDc7IGkrKykge1xuICAgICAgICAgICAgc2hvcnRQaWVjZXNbaV0gPSByZWdleEVzY2FwZShzaG9ydFBpZWNlc1tpXSk7XG4gICAgICAgICAgICBsb25nUGllY2VzW2ldID0gcmVnZXhFc2NhcGUobG9uZ1BpZWNlc1tpXSk7XG4gICAgICAgICAgICBtaXhlZFBpZWNlc1tpXSA9IHJlZ2V4RXNjYXBlKG1peGVkUGllY2VzW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3dlZWtkYXlzUmVnZXggPSBuZXcgUmVnRXhwKCdeKCcgKyBtaXhlZFBpZWNlcy5qb2luKCd8JykgKyAnKScsICdpJyk7XG4gICAgICAgIHRoaXMuX3dlZWtkYXlzU2hvcnRSZWdleCA9IHRoaXMuX3dlZWtkYXlzUmVnZXg7XG4gICAgICAgIHRoaXMuX3dlZWtkYXlzTWluUmVnZXggPSB0aGlzLl93ZWVrZGF5c1JlZ2V4O1xuXG4gICAgICAgIHRoaXMuX3dlZWtkYXlzU3RyaWN0UmVnZXggPSBuZXcgUmVnRXhwKCdeKCcgKyBsb25nUGllY2VzLmpvaW4oJ3wnKSArICcpJywgJ2knKTtcbiAgICAgICAgdGhpcy5fd2Vla2RheXNTaG9ydFN0cmljdFJlZ2V4ID0gbmV3IFJlZ0V4cCgnXignICsgc2hvcnRQaWVjZXMuam9pbignfCcpICsgJyknLCAnaScpO1xuICAgICAgICB0aGlzLl93ZWVrZGF5c01pblN0cmljdFJlZ2V4ID0gbmV3IFJlZ0V4cCgnXignICsgbWluUGllY2VzLmpvaW4oJ3wnKSArICcpJywgJ2knKTtcbiAgICB9XG5cbiAgICAvLyBGT1JNQVRUSU5HXG5cbiAgICBhZGRGb3JtYXRUb2tlbignREREJywgWydEREREJywgM10sICdERERvJywgJ2RheU9mWWVhcicpO1xuXG4gICAgLy8gQUxJQVNFU1xuXG4gICAgYWRkVW5pdEFsaWFzKCdkYXlPZlllYXInLCAnREREJyk7XG5cbiAgICAvLyBQQVJTSU5HXG5cbiAgICBhZGRSZWdleFRva2VuKCdEREQnLCAgbWF0Y2gxdG8zKTtcbiAgICBhZGRSZWdleFRva2VuKCdEREREJywgbWF0Y2gzKTtcbiAgICBhZGRQYXJzZVRva2VuKFsnREREJywgJ0REREQnXSwgZnVuY3Rpb24gKGlucHV0LCBhcnJheSwgY29uZmlnKSB7XG4gICAgICAgIGNvbmZpZy5fZGF5T2ZZZWFyID0gdG9JbnQoaW5wdXQpO1xuICAgIH0pO1xuXG4gICAgLy8gSEVMUEVSU1xuXG4gICAgLy8gTU9NRU5UU1xuXG4gICAgZnVuY3Rpb24gZ2V0U2V0RGF5T2ZZZWFyIChpbnB1dCkge1xuICAgICAgICB2YXIgZGF5T2ZZZWFyID0gTWF0aC5yb3VuZCgodGhpcy5jbG9uZSgpLnN0YXJ0T2YoJ2RheScpIC0gdGhpcy5jbG9uZSgpLnN0YXJ0T2YoJ3llYXInKSkgLyA4NjRlNSkgKyAxO1xuICAgICAgICByZXR1cm4gaW5wdXQgPT0gbnVsbCA/IGRheU9mWWVhciA6IHRoaXMuYWRkKChpbnB1dCAtIGRheU9mWWVhciksICdkJyk7XG4gICAgfVxuXG4gICAgLy8gRk9STUFUVElOR1xuXG4gICAgZnVuY3Rpb24gaEZvcm1hdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaG91cnMoKSAlIDEyIHx8IDEyO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGtGb3JtYXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmhvdXJzKCkgfHwgMjQ7XG4gICAgfVxuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ0gnLCBbJ0hIJywgMl0sIDAsICdob3VyJyk7XG4gICAgYWRkRm9ybWF0VG9rZW4oJ2gnLCBbJ2hoJywgMl0sIDAsIGhGb3JtYXQpO1xuICAgIGFkZEZvcm1hdFRva2VuKCdrJywgWydraycsIDJdLCAwLCBrRm9ybWF0KTtcblxuICAgIGFkZEZvcm1hdFRva2VuKCdobW0nLCAwLCAwLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAnJyArIGhGb3JtYXQuYXBwbHkodGhpcykgKyB6ZXJvRmlsbCh0aGlzLm1pbnV0ZXMoKSwgMik7XG4gICAgfSk7XG5cbiAgICBhZGRGb3JtYXRUb2tlbignaG1tc3MnLCAwLCAwLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAnJyArIGhGb3JtYXQuYXBwbHkodGhpcykgKyB6ZXJvRmlsbCh0aGlzLm1pbnV0ZXMoKSwgMikgK1xuICAgICAgICAgICAgemVyb0ZpbGwodGhpcy5zZWNvbmRzKCksIDIpO1xuICAgIH0pO1xuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ0htbScsIDAsIDAsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcnICsgdGhpcy5ob3VycygpICsgemVyb0ZpbGwodGhpcy5taW51dGVzKCksIDIpO1xuICAgIH0pO1xuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ0htbXNzJywgMCwgMCwgZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJycgKyB0aGlzLmhvdXJzKCkgKyB6ZXJvRmlsbCh0aGlzLm1pbnV0ZXMoKSwgMikgK1xuICAgICAgICAgICAgemVyb0ZpbGwodGhpcy5zZWNvbmRzKCksIDIpO1xuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gbWVyaWRpZW0gKHRva2VuLCBsb3dlcmNhc2UpIHtcbiAgICAgICAgYWRkRm9ybWF0VG9rZW4odG9rZW4sIDAsIDAsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxvY2FsZURhdGEoKS5tZXJpZGllbSh0aGlzLmhvdXJzKCksIHRoaXMubWludXRlcygpLCBsb3dlcmNhc2UpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBtZXJpZGllbSgnYScsIHRydWUpO1xuICAgIG1lcmlkaWVtKCdBJywgZmFsc2UpO1xuXG4gICAgLy8gQUxJQVNFU1xuXG4gICAgYWRkVW5pdEFsaWFzKCdob3VyJywgJ2gnKTtcblxuICAgIC8vIFBBUlNJTkdcblxuICAgIGZ1bmN0aW9uIG1hdGNoTWVyaWRpZW0gKGlzU3RyaWN0LCBsb2NhbGUpIHtcbiAgICAgICAgcmV0dXJuIGxvY2FsZS5fbWVyaWRpZW1QYXJzZTtcbiAgICB9XG5cbiAgICBhZGRSZWdleFRva2VuKCdhJywgIG1hdGNoTWVyaWRpZW0pO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ0EnLCAgbWF0Y2hNZXJpZGllbSk7XG4gICAgYWRkUmVnZXhUb2tlbignSCcsICBtYXRjaDF0bzIpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ2gnLCAgbWF0Y2gxdG8yKTtcbiAgICBhZGRSZWdleFRva2VuKCdISCcsIG1hdGNoMXRvMiwgbWF0Y2gyKTtcbiAgICBhZGRSZWdleFRva2VuKCdoaCcsIG1hdGNoMXRvMiwgbWF0Y2gyKTtcblxuICAgIGFkZFJlZ2V4VG9rZW4oJ2htbScsIG1hdGNoM3RvNCk7XG4gICAgYWRkUmVnZXhUb2tlbignaG1tc3MnLCBtYXRjaDV0bzYpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ0htbScsIG1hdGNoM3RvNCk7XG4gICAgYWRkUmVnZXhUb2tlbignSG1tc3MnLCBtYXRjaDV0bzYpO1xuXG4gICAgYWRkUGFyc2VUb2tlbihbJ0gnLCAnSEgnXSwgSE9VUik7XG4gICAgYWRkUGFyc2VUb2tlbihbJ2EnLCAnQSddLCBmdW5jdGlvbiAoaW5wdXQsIGFycmF5LCBjb25maWcpIHtcbiAgICAgICAgY29uZmlnLl9pc1BtID0gY29uZmlnLl9sb2NhbGUuaXNQTShpbnB1dCk7XG4gICAgICAgIGNvbmZpZy5fbWVyaWRpZW0gPSBpbnB1dDtcbiAgICB9KTtcbiAgICBhZGRQYXJzZVRva2VuKFsnaCcsICdoaCddLCBmdW5jdGlvbiAoaW5wdXQsIGFycmF5LCBjb25maWcpIHtcbiAgICAgICAgYXJyYXlbSE9VUl0gPSB0b0ludChpbnB1dCk7XG4gICAgICAgIGdldFBhcnNpbmdGbGFncyhjb25maWcpLmJpZ0hvdXIgPSB0cnVlO1xuICAgIH0pO1xuICAgIGFkZFBhcnNlVG9rZW4oJ2htbScsIGZ1bmN0aW9uIChpbnB1dCwgYXJyYXksIGNvbmZpZykge1xuICAgICAgICB2YXIgcG9zID0gaW5wdXQubGVuZ3RoIC0gMjtcbiAgICAgICAgYXJyYXlbSE9VUl0gPSB0b0ludChpbnB1dC5zdWJzdHIoMCwgcG9zKSk7XG4gICAgICAgIGFycmF5W01JTlVURV0gPSB0b0ludChpbnB1dC5zdWJzdHIocG9zKSk7XG4gICAgICAgIGdldFBhcnNpbmdGbGFncyhjb25maWcpLmJpZ0hvdXIgPSB0cnVlO1xuICAgIH0pO1xuICAgIGFkZFBhcnNlVG9rZW4oJ2htbXNzJywgZnVuY3Rpb24gKGlucHV0LCBhcnJheSwgY29uZmlnKSB7XG4gICAgICAgIHZhciBwb3MxID0gaW5wdXQubGVuZ3RoIC0gNDtcbiAgICAgICAgdmFyIHBvczIgPSBpbnB1dC5sZW5ndGggLSAyO1xuICAgICAgICBhcnJheVtIT1VSXSA9IHRvSW50KGlucHV0LnN1YnN0cigwLCBwb3MxKSk7XG4gICAgICAgIGFycmF5W01JTlVURV0gPSB0b0ludChpbnB1dC5zdWJzdHIocG9zMSwgMikpO1xuICAgICAgICBhcnJheVtTRUNPTkRdID0gdG9JbnQoaW5wdXQuc3Vic3RyKHBvczIpKTtcbiAgICAgICAgZ2V0UGFyc2luZ0ZsYWdzKGNvbmZpZykuYmlnSG91ciA9IHRydWU7XG4gICAgfSk7XG4gICAgYWRkUGFyc2VUb2tlbignSG1tJywgZnVuY3Rpb24gKGlucHV0LCBhcnJheSwgY29uZmlnKSB7XG4gICAgICAgIHZhciBwb3MgPSBpbnB1dC5sZW5ndGggLSAyO1xuICAgICAgICBhcnJheVtIT1VSXSA9IHRvSW50KGlucHV0LnN1YnN0cigwLCBwb3MpKTtcbiAgICAgICAgYXJyYXlbTUlOVVRFXSA9IHRvSW50KGlucHV0LnN1YnN0cihwb3MpKTtcbiAgICB9KTtcbiAgICBhZGRQYXJzZVRva2VuKCdIbW1zcycsIGZ1bmN0aW9uIChpbnB1dCwgYXJyYXksIGNvbmZpZykge1xuICAgICAgICB2YXIgcG9zMSA9IGlucHV0Lmxlbmd0aCAtIDQ7XG4gICAgICAgIHZhciBwb3MyID0gaW5wdXQubGVuZ3RoIC0gMjtcbiAgICAgICAgYXJyYXlbSE9VUl0gPSB0b0ludChpbnB1dC5zdWJzdHIoMCwgcG9zMSkpO1xuICAgICAgICBhcnJheVtNSU5VVEVdID0gdG9JbnQoaW5wdXQuc3Vic3RyKHBvczEsIDIpKTtcbiAgICAgICAgYXJyYXlbU0VDT05EXSA9IHRvSW50KGlucHV0LnN1YnN0cihwb3MyKSk7XG4gICAgfSk7XG5cbiAgICAvLyBMT0NBTEVTXG5cbiAgICBmdW5jdGlvbiBsb2NhbGVJc1BNIChpbnB1dCkge1xuICAgICAgICAvLyBJRTggUXVpcmtzIE1vZGUgJiBJRTcgU3RhbmRhcmRzIE1vZGUgZG8gbm90IGFsbG93IGFjY2Vzc2luZyBzdHJpbmdzIGxpa2UgYXJyYXlzXG4gICAgICAgIC8vIFVzaW5nIGNoYXJBdCBzaG91bGQgYmUgbW9yZSBjb21wYXRpYmxlLlxuICAgICAgICByZXR1cm4gKChpbnB1dCArICcnKS50b0xvd2VyQ2FzZSgpLmNoYXJBdCgwKSA9PT0gJ3AnKTtcbiAgICB9XG5cbiAgICB2YXIgZGVmYXVsdExvY2FsZU1lcmlkaWVtUGFyc2UgPSAvW2FwXVxcLj9tP1xcLj8vaTtcbiAgICBmdW5jdGlvbiBsb2NhbGVNZXJpZGllbSAoaG91cnMsIG1pbnV0ZXMsIGlzTG93ZXIpIHtcbiAgICAgICAgaWYgKGhvdXJzID4gMTEpIHtcbiAgICAgICAgICAgIHJldHVybiBpc0xvd2VyID8gJ3BtJyA6ICdQTSc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gaXNMb3dlciA/ICdhbScgOiAnQU0nO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICAvLyBNT01FTlRTXG5cbiAgICAvLyBTZXR0aW5nIHRoZSBob3VyIHNob3VsZCBrZWVwIHRoZSB0aW1lLCBiZWNhdXNlIHRoZSB1c2VyIGV4cGxpY2l0bHlcbiAgICAvLyBzcGVjaWZpZWQgd2hpY2ggaG91ciBoZSB3YW50cy4gU28gdHJ5aW5nIHRvIG1haW50YWluIHRoZSBzYW1lIGhvdXIgKGluXG4gICAgLy8gYSBuZXcgdGltZXpvbmUpIG1ha2VzIHNlbnNlLiBBZGRpbmcvc3VidHJhY3RpbmcgaG91cnMgZG9lcyBub3QgZm9sbG93XG4gICAgLy8gdGhpcyBydWxlLlxuICAgIHZhciBnZXRTZXRIb3VyID0gbWFrZUdldFNldCgnSG91cnMnLCB0cnVlKTtcblxuICAgIC8vIEZPUk1BVFRJTkdcblxuICAgIGFkZEZvcm1hdFRva2VuKCdtJywgWydtbScsIDJdLCAwLCAnbWludXRlJyk7XG5cbiAgICAvLyBBTElBU0VTXG5cbiAgICBhZGRVbml0QWxpYXMoJ21pbnV0ZScsICdtJyk7XG5cbiAgICAvLyBQQVJTSU5HXG5cbiAgICBhZGRSZWdleFRva2VuKCdtJywgIG1hdGNoMXRvMik7XG4gICAgYWRkUmVnZXhUb2tlbignbW0nLCBtYXRjaDF0bzIsIG1hdGNoMik7XG4gICAgYWRkUGFyc2VUb2tlbihbJ20nLCAnbW0nXSwgTUlOVVRFKTtcblxuICAgIC8vIE1PTUVOVFNcblxuICAgIHZhciBnZXRTZXRNaW51dGUgPSBtYWtlR2V0U2V0KCdNaW51dGVzJywgZmFsc2UpO1xuXG4gICAgLy8gRk9STUFUVElOR1xuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ3MnLCBbJ3NzJywgMl0sIDAsICdzZWNvbmQnKTtcblxuICAgIC8vIEFMSUFTRVNcblxuICAgIGFkZFVuaXRBbGlhcygnc2Vjb25kJywgJ3MnKTtcblxuICAgIC8vIFBBUlNJTkdcblxuICAgIGFkZFJlZ2V4VG9rZW4oJ3MnLCAgbWF0Y2gxdG8yKTtcbiAgICBhZGRSZWdleFRva2VuKCdzcycsIG1hdGNoMXRvMiwgbWF0Y2gyKTtcbiAgICBhZGRQYXJzZVRva2VuKFsncycsICdzcyddLCBTRUNPTkQpO1xuXG4gICAgLy8gTU9NRU5UU1xuXG4gICAgdmFyIGdldFNldFNlY29uZCA9IG1ha2VHZXRTZXQoJ1NlY29uZHMnLCBmYWxzZSk7XG5cbiAgICAvLyBGT1JNQVRUSU5HXG5cbiAgICBhZGRGb3JtYXRUb2tlbignUycsIDAsIDAsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIH5+KHRoaXMubWlsbGlzZWNvbmQoKSAvIDEwMCk7XG4gICAgfSk7XG5cbiAgICBhZGRGb3JtYXRUb2tlbigwLCBbJ1NTJywgMl0sIDAsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIH5+KHRoaXMubWlsbGlzZWNvbmQoKSAvIDEwKTtcbiAgICB9KTtcblxuICAgIGFkZEZvcm1hdFRva2VuKDAsIFsnU1NTJywgM10sIDAsICdtaWxsaXNlY29uZCcpO1xuICAgIGFkZEZvcm1hdFRva2VuKDAsIFsnU1NTUycsIDRdLCAwLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1pbGxpc2Vjb25kKCkgKiAxMDtcbiAgICB9KTtcbiAgICBhZGRGb3JtYXRUb2tlbigwLCBbJ1NTU1NTJywgNV0sIDAsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWlsbGlzZWNvbmQoKSAqIDEwMDtcbiAgICB9KTtcbiAgICBhZGRGb3JtYXRUb2tlbigwLCBbJ1NTU1NTUycsIDZdLCAwLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1pbGxpc2Vjb25kKCkgKiAxMDAwO1xuICAgIH0pO1xuICAgIGFkZEZvcm1hdFRva2VuKDAsIFsnU1NTU1NTUycsIDddLCAwLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1pbGxpc2Vjb25kKCkgKiAxMDAwMDtcbiAgICB9KTtcbiAgICBhZGRGb3JtYXRUb2tlbigwLCBbJ1NTU1NTU1NTJywgOF0sIDAsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWlsbGlzZWNvbmQoKSAqIDEwMDAwMDtcbiAgICB9KTtcbiAgICBhZGRGb3JtYXRUb2tlbigwLCBbJ1NTU1NTU1NTUycsIDldLCAwLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1pbGxpc2Vjb25kKCkgKiAxMDAwMDAwO1xuICAgIH0pO1xuXG5cbiAgICAvLyBBTElBU0VTXG5cbiAgICBhZGRVbml0QWxpYXMoJ21pbGxpc2Vjb25kJywgJ21zJyk7XG5cbiAgICAvLyBQQVJTSU5HXG5cbiAgICBhZGRSZWdleFRva2VuKCdTJywgICAgbWF0Y2gxdG8zLCBtYXRjaDEpO1xuICAgIGFkZFJlZ2V4VG9rZW4oJ1NTJywgICBtYXRjaDF0bzMsIG1hdGNoMik7XG4gICAgYWRkUmVnZXhUb2tlbignU1NTJywgIG1hdGNoMXRvMywgbWF0Y2gzKTtcblxuICAgIHZhciB0b2tlbjtcbiAgICBmb3IgKHRva2VuID0gJ1NTU1MnOyB0b2tlbi5sZW5ndGggPD0gOTsgdG9rZW4gKz0gJ1MnKSB7XG4gICAgICAgIGFkZFJlZ2V4VG9rZW4odG9rZW4sIG1hdGNoVW5zaWduZWQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBhcnNlTXMoaW5wdXQsIGFycmF5KSB7XG4gICAgICAgIGFycmF5W01JTExJU0VDT05EXSA9IHRvSW50KCgnMC4nICsgaW5wdXQpICogMTAwMCk7XG4gICAgfVxuXG4gICAgZm9yICh0b2tlbiA9ICdTJzsgdG9rZW4ubGVuZ3RoIDw9IDk7IHRva2VuICs9ICdTJykge1xuICAgICAgICBhZGRQYXJzZVRva2VuKHRva2VuLCBwYXJzZU1zKTtcbiAgICB9XG4gICAgLy8gTU9NRU5UU1xuXG4gICAgdmFyIGdldFNldE1pbGxpc2Vjb25kID0gbWFrZUdldFNldCgnTWlsbGlzZWNvbmRzJywgZmFsc2UpO1xuXG4gICAgLy8gRk9STUFUVElOR1xuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ3onLCAgMCwgMCwgJ3pvbmVBYmJyJyk7XG4gICAgYWRkRm9ybWF0VG9rZW4oJ3p6JywgMCwgMCwgJ3pvbmVOYW1lJyk7XG5cbiAgICAvLyBNT01FTlRTXG5cbiAgICBmdW5jdGlvbiBnZXRab25lQWJiciAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pc1VUQyA/ICdVVEMnIDogJyc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0Wm9uZU5hbWUgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXNVVEMgPyAnQ29vcmRpbmF0ZWQgVW5pdmVyc2FsIFRpbWUnIDogJyc7XG4gICAgfVxuXG4gICAgdmFyIG1vbWVudFByb3RvdHlwZV9fcHJvdG8gPSBNb21lbnQucHJvdG90eXBlO1xuXG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5hZGQgICAgICAgICAgICAgICA9IGFkZF9zdWJ0cmFjdF9fYWRkO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uY2FsZW5kYXIgICAgICAgICAgPSBtb21lbnRfY2FsZW5kYXJfX2NhbGVuZGFyO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uY2xvbmUgICAgICAgICAgICAgPSBjbG9uZTtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmRpZmYgICAgICAgICAgICAgID0gZGlmZjtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmVuZE9mICAgICAgICAgICAgID0gZW5kT2Y7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5mb3JtYXQgICAgICAgICAgICA9IGZvcm1hdDtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmZyb20gICAgICAgICAgICAgID0gZnJvbTtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmZyb21Ob3cgICAgICAgICAgID0gZnJvbU5vdztcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLnRvICAgICAgICAgICAgICAgID0gdG87XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by50b05vdyAgICAgICAgICAgICA9IHRvTm93O1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uZ2V0ICAgICAgICAgICAgICAgPSBnZXRTZXQ7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5pbnZhbGlkQXQgICAgICAgICA9IGludmFsaWRBdDtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmlzQWZ0ZXIgICAgICAgICAgID0gaXNBZnRlcjtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmlzQmVmb3JlICAgICAgICAgID0gaXNCZWZvcmU7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5pc0JldHdlZW4gICAgICAgICA9IGlzQmV0d2VlbjtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmlzU2FtZSAgICAgICAgICAgID0gaXNTYW1lO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNTYW1lT3JBZnRlciAgICAgPSBpc1NhbWVPckFmdGVyO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNTYW1lT3JCZWZvcmUgICAgPSBpc1NhbWVPckJlZm9yZTtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmlzVmFsaWQgICAgICAgICAgID0gbW9tZW50X3ZhbGlkX19pc1ZhbGlkO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8ubGFuZyAgICAgICAgICAgICAgPSBsYW5nO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8ubG9jYWxlICAgICAgICAgICAgPSBsb2NhbGU7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5sb2NhbGVEYXRhICAgICAgICA9IGxvY2FsZURhdGE7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5tYXggICAgICAgICAgICAgICA9IHByb3RvdHlwZU1heDtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLm1pbiAgICAgICAgICAgICAgID0gcHJvdG90eXBlTWluO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8ucGFyc2luZ0ZsYWdzICAgICAgPSBwYXJzaW5nRmxhZ3M7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5zZXQgICAgICAgICAgICAgICA9IGdldFNldDtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLnN0YXJ0T2YgICAgICAgICAgID0gc3RhcnRPZjtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLnN1YnRyYWN0ICAgICAgICAgID0gYWRkX3N1YnRyYWN0X19zdWJ0cmFjdDtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLnRvQXJyYXkgICAgICAgICAgID0gdG9BcnJheTtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLnRvT2JqZWN0ICAgICAgICAgID0gdG9PYmplY3Q7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by50b0RhdGUgICAgICAgICAgICA9IHRvRGF0ZTtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLnRvSVNPU3RyaW5nICAgICAgID0gbW9tZW50X2Zvcm1hdF9fdG9JU09TdHJpbmc7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by50b0pTT04gICAgICAgICAgICA9IHRvSlNPTjtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLnRvU3RyaW5nICAgICAgICAgID0gdG9TdHJpbmc7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by51bml4ICAgICAgICAgICAgICA9IHVuaXg7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by52YWx1ZU9mICAgICAgICAgICA9IHRvX3R5cGVfX3ZhbHVlT2Y7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5jcmVhdGlvbkRhdGEgICAgICA9IGNyZWF0aW9uRGF0YTtcblxuICAgIC8vIFllYXJcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLnllYXIgICAgICAgPSBnZXRTZXRZZWFyO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNMZWFwWWVhciA9IGdldElzTGVhcFllYXI7XG5cbiAgICAvLyBXZWVrIFllYXJcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLndlZWtZZWFyICAgID0gZ2V0U2V0V2Vla1llYXI7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5pc29XZWVrWWVhciA9IGdldFNldElTT1dlZWtZZWFyO1xuXG4gICAgLy8gUXVhcnRlclxuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8ucXVhcnRlciA9IG1vbWVudFByb3RvdHlwZV9fcHJvdG8ucXVhcnRlcnMgPSBnZXRTZXRRdWFydGVyO1xuXG4gICAgLy8gTW9udGhcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLm1vbnRoICAgICAgID0gZ2V0U2V0TW9udGg7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5kYXlzSW5Nb250aCA9IGdldERheXNJbk1vbnRoO1xuXG4gICAgLy8gV2Vla1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8ud2VlayAgICAgICAgICAgPSBtb21lbnRQcm90b3R5cGVfX3Byb3RvLndlZWtzICAgICAgICA9IGdldFNldFdlZWs7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5pc29XZWVrICAgICAgICA9IG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNvV2Vla3MgICAgID0gZ2V0U2V0SVNPV2VlaztcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLndlZWtzSW5ZZWFyICAgID0gZ2V0V2Vla3NJblllYXI7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5pc29XZWVrc0luWWVhciA9IGdldElTT1dlZWtzSW5ZZWFyO1xuXG4gICAgLy8gRGF5XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5kYXRlICAgICAgID0gZ2V0U2V0RGF5T2ZNb250aDtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmRheSAgICAgICAgPSBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmRheXMgICAgICAgICAgICAgPSBnZXRTZXREYXlPZldlZWs7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by53ZWVrZGF5ICAgID0gZ2V0U2V0TG9jYWxlRGF5T2ZXZWVrO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNvV2Vla2RheSA9IGdldFNldElTT0RheU9mV2VlaztcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmRheU9mWWVhciAgPSBnZXRTZXREYXlPZlllYXI7XG5cbiAgICAvLyBIb3VyXG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5ob3VyID0gbW9tZW50UHJvdG90eXBlX19wcm90by5ob3VycyA9IGdldFNldEhvdXI7XG5cbiAgICAvLyBNaW51dGVcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLm1pbnV0ZSA9IG1vbWVudFByb3RvdHlwZV9fcHJvdG8ubWludXRlcyA9IGdldFNldE1pbnV0ZTtcblxuICAgIC8vIFNlY29uZFxuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uc2Vjb25kID0gbW9tZW50UHJvdG90eXBlX19wcm90by5zZWNvbmRzID0gZ2V0U2V0U2Vjb25kO1xuXG4gICAgLy8gTWlsbGlzZWNvbmRcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLm1pbGxpc2Vjb25kID0gbW9tZW50UHJvdG90eXBlX19wcm90by5taWxsaXNlY29uZHMgPSBnZXRTZXRNaWxsaXNlY29uZDtcblxuICAgIC8vIE9mZnNldFxuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8udXRjT2Zmc2V0ICAgICAgICAgICAgPSBnZXRTZXRPZmZzZXQ7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by51dGMgICAgICAgICAgICAgICAgICA9IHNldE9mZnNldFRvVVRDO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8ubG9jYWwgICAgICAgICAgICAgICAgPSBzZXRPZmZzZXRUb0xvY2FsO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8ucGFyc2Vab25lICAgICAgICAgICAgPSBzZXRPZmZzZXRUb1BhcnNlZE9mZnNldDtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmhhc0FsaWduZWRIb3VyT2Zmc2V0ID0gaGFzQWxpZ25lZEhvdXJPZmZzZXQ7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5pc0RTVCAgICAgICAgICAgICAgICA9IGlzRGF5bGlnaHRTYXZpbmdUaW1lO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNEU1RTaGlmdGVkICAgICAgICAgPSBpc0RheWxpZ2h0U2F2aW5nVGltZVNoaWZ0ZWQ7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5pc0xvY2FsICAgICAgICAgICAgICA9IGlzTG9jYWw7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by5pc1V0Y09mZnNldCAgICAgICAgICA9IGlzVXRjT2Zmc2V0O1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uaXNVdGMgICAgICAgICAgICAgICAgPSBpc1V0YztcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmlzVVRDICAgICAgICAgICAgICAgID0gaXNVdGM7XG5cbiAgICAvLyBUaW1lem9uZVxuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8uem9uZUFiYnIgPSBnZXRab25lQWJicjtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLnpvbmVOYW1lID0gZ2V0Wm9uZU5hbWU7XG5cbiAgICAvLyBEZXByZWNhdGlvbnNcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLmRhdGVzICA9IGRlcHJlY2F0ZSgnZGF0ZXMgYWNjZXNzb3IgaXMgZGVwcmVjYXRlZC4gVXNlIGRhdGUgaW5zdGVhZC4nLCBnZXRTZXREYXlPZk1vbnRoKTtcbiAgICBtb21lbnRQcm90b3R5cGVfX3Byb3RvLm1vbnRocyA9IGRlcHJlY2F0ZSgnbW9udGhzIGFjY2Vzc29yIGlzIGRlcHJlY2F0ZWQuIFVzZSBtb250aCBpbnN0ZWFkJywgZ2V0U2V0TW9udGgpO1xuICAgIG1vbWVudFByb3RvdHlwZV9fcHJvdG8ueWVhcnMgID0gZGVwcmVjYXRlKCd5ZWFycyBhY2Nlc3NvciBpcyBkZXByZWNhdGVkLiBVc2UgeWVhciBpbnN0ZWFkJywgZ2V0U2V0WWVhcik7XG4gICAgbW9tZW50UHJvdG90eXBlX19wcm90by56b25lICAgPSBkZXByZWNhdGUoJ21vbWVudCgpLnpvbmUgaXMgZGVwcmVjYXRlZCwgdXNlIG1vbWVudCgpLnV0Y09mZnNldCBpbnN0ZWFkLiBodHRwczovL2dpdGh1Yi5jb20vbW9tZW50L21vbWVudC9pc3N1ZXMvMTc3OScsIGdldFNldFpvbmUpO1xuXG4gICAgdmFyIG1vbWVudFByb3RvdHlwZSA9IG1vbWVudFByb3RvdHlwZV9fcHJvdG87XG5cbiAgICBmdW5jdGlvbiBtb21lbnRfX2NyZWF0ZVVuaXggKGlucHV0KSB7XG4gICAgICAgIHJldHVybiBsb2NhbF9fY3JlYXRlTG9jYWwoaW5wdXQgKiAxMDAwKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtb21lbnRfX2NyZWF0ZUluWm9uZSAoKSB7XG4gICAgICAgIHJldHVybiBsb2NhbF9fY3JlYXRlTG9jYWwuYXBwbHkobnVsbCwgYXJndW1lbnRzKS5wYXJzZVpvbmUoKTtcbiAgICB9XG5cbiAgICB2YXIgZGVmYXVsdENhbGVuZGFyID0ge1xuICAgICAgICBzYW1lRGF5IDogJ1tUb2RheSBhdF0gTFQnLFxuICAgICAgICBuZXh0RGF5IDogJ1tUb21vcnJvdyBhdF0gTFQnLFxuICAgICAgICBuZXh0V2VlayA6ICdkZGRkIFthdF0gTFQnLFxuICAgICAgICBsYXN0RGF5IDogJ1tZZXN0ZXJkYXkgYXRdIExUJyxcbiAgICAgICAgbGFzdFdlZWsgOiAnW0xhc3RdIGRkZGQgW2F0XSBMVCcsXG4gICAgICAgIHNhbWVFbHNlIDogJ0wnXG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGxvY2FsZV9jYWxlbmRhcl9fY2FsZW5kYXIgKGtleSwgbW9tLCBub3cpIHtcbiAgICAgICAgdmFyIG91dHB1dCA9IHRoaXMuX2NhbGVuZGFyW2tleV07XG4gICAgICAgIHJldHVybiBpc0Z1bmN0aW9uKG91dHB1dCkgPyBvdXRwdXQuY2FsbChtb20sIG5vdykgOiBvdXRwdXQ7XG4gICAgfVxuXG4gICAgdmFyIGRlZmF1bHRMb25nRGF0ZUZvcm1hdCA9IHtcbiAgICAgICAgTFRTICA6ICdoOm1tOnNzIEEnLFxuICAgICAgICBMVCAgIDogJ2g6bW0gQScsXG4gICAgICAgIEwgICAgOiAnTU0vREQvWVlZWScsXG4gICAgICAgIExMICAgOiAnTU1NTSBELCBZWVlZJyxcbiAgICAgICAgTExMICA6ICdNTU1NIEQsIFlZWVkgaDptbSBBJyxcbiAgICAgICAgTExMTCA6ICdkZGRkLCBNTU1NIEQsIFlZWVkgaDptbSBBJ1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBsb25nRGF0ZUZvcm1hdCAoa2V5KSB7XG4gICAgICAgIHZhciBmb3JtYXQgPSB0aGlzLl9sb25nRGF0ZUZvcm1hdFtrZXldLFxuICAgICAgICAgICAgZm9ybWF0VXBwZXIgPSB0aGlzLl9sb25nRGF0ZUZvcm1hdFtrZXkudG9VcHBlckNhc2UoKV07XG5cbiAgICAgICAgaWYgKGZvcm1hdCB8fCAhZm9ybWF0VXBwZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBmb3JtYXQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb25nRGF0ZUZvcm1hdFtrZXldID0gZm9ybWF0VXBwZXIucmVwbGFjZSgvTU1NTXxNTXxERHxkZGRkL2csIGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgICAgICAgIHJldHVybiB2YWwuc2xpY2UoMSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9sb25nRGF0ZUZvcm1hdFtrZXldO1xuICAgIH1cblxuICAgIHZhciBkZWZhdWx0SW52YWxpZERhdGUgPSAnSW52YWxpZCBkYXRlJztcblxuICAgIGZ1bmN0aW9uIGludmFsaWREYXRlICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ludmFsaWREYXRlO1xuICAgIH1cblxuICAgIHZhciBkZWZhdWx0T3JkaW5hbCA9ICclZCc7XG4gICAgdmFyIGRlZmF1bHRPcmRpbmFsUGFyc2UgPSAvXFxkezEsMn0vO1xuXG4gICAgZnVuY3Rpb24gb3JkaW5hbCAobnVtYmVyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vcmRpbmFsLnJlcGxhY2UoJyVkJywgbnVtYmVyKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcmVQYXJzZVBvc3RGb3JtYXQgKHN0cmluZykge1xuICAgICAgICByZXR1cm4gc3RyaW5nO1xuICAgIH1cblxuICAgIHZhciBkZWZhdWx0UmVsYXRpdmVUaW1lID0ge1xuICAgICAgICBmdXR1cmUgOiAnaW4gJXMnLFxuICAgICAgICBwYXN0ICAgOiAnJXMgYWdvJyxcbiAgICAgICAgcyAgOiAnYSBmZXcgc2Vjb25kcycsXG4gICAgICAgIG0gIDogJ2EgbWludXRlJyxcbiAgICAgICAgbW0gOiAnJWQgbWludXRlcycsXG4gICAgICAgIGggIDogJ2FuIGhvdXInLFxuICAgICAgICBoaCA6ICclZCBob3VycycsXG4gICAgICAgIGQgIDogJ2EgZGF5JyxcbiAgICAgICAgZGQgOiAnJWQgZGF5cycsXG4gICAgICAgIE0gIDogJ2EgbW9udGgnLFxuICAgICAgICBNTSA6ICclZCBtb250aHMnLFxuICAgICAgICB5ICA6ICdhIHllYXInLFxuICAgICAgICB5eSA6ICclZCB5ZWFycydcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gcmVsYXRpdmVfX3JlbGF0aXZlVGltZSAobnVtYmVyLCB3aXRob3V0U3VmZml4LCBzdHJpbmcsIGlzRnV0dXJlKSB7XG4gICAgICAgIHZhciBvdXRwdXQgPSB0aGlzLl9yZWxhdGl2ZVRpbWVbc3RyaW5nXTtcbiAgICAgICAgcmV0dXJuIChpc0Z1bmN0aW9uKG91dHB1dCkpID9cbiAgICAgICAgICAgIG91dHB1dChudW1iZXIsIHdpdGhvdXRTdWZmaXgsIHN0cmluZywgaXNGdXR1cmUpIDpcbiAgICAgICAgICAgIG91dHB1dC5yZXBsYWNlKC8lZC9pLCBudW1iZXIpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBhc3RGdXR1cmUgKGRpZmYsIG91dHB1dCkge1xuICAgICAgICB2YXIgZm9ybWF0ID0gdGhpcy5fcmVsYXRpdmVUaW1lW2RpZmYgPiAwID8gJ2Z1dHVyZScgOiAncGFzdCddO1xuICAgICAgICByZXR1cm4gaXNGdW5jdGlvbihmb3JtYXQpID8gZm9ybWF0KG91dHB1dCkgOiBmb3JtYXQucmVwbGFjZSgvJXMvaSwgb3V0cHV0KTtcbiAgICB9XG5cbiAgICB2YXIgcHJvdG90eXBlX19wcm90byA9IExvY2FsZS5wcm90b3R5cGU7XG5cbiAgICBwcm90b3R5cGVfX3Byb3RvLl9jYWxlbmRhciAgICAgICA9IGRlZmF1bHRDYWxlbmRhcjtcbiAgICBwcm90b3R5cGVfX3Byb3RvLmNhbGVuZGFyICAgICAgICA9IGxvY2FsZV9jYWxlbmRhcl9fY2FsZW5kYXI7XG4gICAgcHJvdG90eXBlX19wcm90by5fbG9uZ0RhdGVGb3JtYXQgPSBkZWZhdWx0TG9uZ0RhdGVGb3JtYXQ7XG4gICAgcHJvdG90eXBlX19wcm90by5sb25nRGF0ZUZvcm1hdCAgPSBsb25nRGF0ZUZvcm1hdDtcbiAgICBwcm90b3R5cGVfX3Byb3RvLl9pbnZhbGlkRGF0ZSAgICA9IGRlZmF1bHRJbnZhbGlkRGF0ZTtcbiAgICBwcm90b3R5cGVfX3Byb3RvLmludmFsaWREYXRlICAgICA9IGludmFsaWREYXRlO1xuICAgIHByb3RvdHlwZV9fcHJvdG8uX29yZGluYWwgICAgICAgID0gZGVmYXVsdE9yZGluYWw7XG4gICAgcHJvdG90eXBlX19wcm90by5vcmRpbmFsICAgICAgICAgPSBvcmRpbmFsO1xuICAgIHByb3RvdHlwZV9fcHJvdG8uX29yZGluYWxQYXJzZSAgID0gZGVmYXVsdE9yZGluYWxQYXJzZTtcbiAgICBwcm90b3R5cGVfX3Byb3RvLnByZXBhcnNlICAgICAgICA9IHByZVBhcnNlUG9zdEZvcm1hdDtcbiAgICBwcm90b3R5cGVfX3Byb3RvLnBvc3Rmb3JtYXQgICAgICA9IHByZVBhcnNlUG9zdEZvcm1hdDtcbiAgICBwcm90b3R5cGVfX3Byb3RvLl9yZWxhdGl2ZVRpbWUgICA9IGRlZmF1bHRSZWxhdGl2ZVRpbWU7XG4gICAgcHJvdG90eXBlX19wcm90by5yZWxhdGl2ZVRpbWUgICAgPSByZWxhdGl2ZV9fcmVsYXRpdmVUaW1lO1xuICAgIHByb3RvdHlwZV9fcHJvdG8ucGFzdEZ1dHVyZSAgICAgID0gcGFzdEZ1dHVyZTtcbiAgICBwcm90b3R5cGVfX3Byb3RvLnNldCAgICAgICAgICAgICA9IGxvY2FsZV9zZXRfX3NldDtcblxuICAgIC8vIE1vbnRoXG4gICAgcHJvdG90eXBlX19wcm90by5tb250aHMgICAgICAgICAgICA9ICAgICAgICBsb2NhbGVNb250aHM7XG4gICAgcHJvdG90eXBlX19wcm90by5fbW9udGhzICAgICAgICAgICA9IGRlZmF1bHRMb2NhbGVNb250aHM7XG4gICAgcHJvdG90eXBlX19wcm90by5tb250aHNTaG9ydCAgICAgICA9ICAgICAgICBsb2NhbGVNb250aHNTaG9ydDtcbiAgICBwcm90b3R5cGVfX3Byb3RvLl9tb250aHNTaG9ydCAgICAgID0gZGVmYXVsdExvY2FsZU1vbnRoc1Nob3J0O1xuICAgIHByb3RvdHlwZV9fcHJvdG8ubW9udGhzUGFyc2UgICAgICAgPSAgICAgICAgbG9jYWxlTW9udGhzUGFyc2U7XG4gICAgcHJvdG90eXBlX19wcm90by5fbW9udGhzUmVnZXggICAgICA9IGRlZmF1bHRNb250aHNSZWdleDtcbiAgICBwcm90b3R5cGVfX3Byb3RvLm1vbnRoc1JlZ2V4ICAgICAgID0gbW9udGhzUmVnZXg7XG4gICAgcHJvdG90eXBlX19wcm90by5fbW9udGhzU2hvcnRSZWdleCA9IGRlZmF1bHRNb250aHNTaG9ydFJlZ2V4O1xuICAgIHByb3RvdHlwZV9fcHJvdG8ubW9udGhzU2hvcnRSZWdleCAgPSBtb250aHNTaG9ydFJlZ2V4O1xuXG4gICAgLy8gV2Vla1xuICAgIHByb3RvdHlwZV9fcHJvdG8ud2VlayA9IGxvY2FsZVdlZWs7XG4gICAgcHJvdG90eXBlX19wcm90by5fd2VlayA9IGRlZmF1bHRMb2NhbGVXZWVrO1xuICAgIHByb3RvdHlwZV9fcHJvdG8uZmlyc3REYXlPZlllYXIgPSBsb2NhbGVGaXJzdERheU9mWWVhcjtcbiAgICBwcm90b3R5cGVfX3Byb3RvLmZpcnN0RGF5T2ZXZWVrID0gbG9jYWxlRmlyc3REYXlPZldlZWs7XG5cbiAgICAvLyBEYXkgb2YgV2Vla1xuICAgIHByb3RvdHlwZV9fcHJvdG8ud2Vla2RheXMgICAgICAgPSAgICAgICAgbG9jYWxlV2Vla2RheXM7XG4gICAgcHJvdG90eXBlX19wcm90by5fd2Vla2RheXMgICAgICA9IGRlZmF1bHRMb2NhbGVXZWVrZGF5cztcbiAgICBwcm90b3R5cGVfX3Byb3RvLndlZWtkYXlzTWluICAgID0gICAgICAgIGxvY2FsZVdlZWtkYXlzTWluO1xuICAgIHByb3RvdHlwZV9fcHJvdG8uX3dlZWtkYXlzTWluICAgPSBkZWZhdWx0TG9jYWxlV2Vla2RheXNNaW47XG4gICAgcHJvdG90eXBlX19wcm90by53ZWVrZGF5c1Nob3J0ICA9ICAgICAgICBsb2NhbGVXZWVrZGF5c1Nob3J0O1xuICAgIHByb3RvdHlwZV9fcHJvdG8uX3dlZWtkYXlzU2hvcnQgPSBkZWZhdWx0TG9jYWxlV2Vla2RheXNTaG9ydDtcbiAgICBwcm90b3R5cGVfX3Byb3RvLndlZWtkYXlzUGFyc2UgID0gICAgICAgIGxvY2FsZVdlZWtkYXlzUGFyc2U7XG5cbiAgICBwcm90b3R5cGVfX3Byb3RvLl93ZWVrZGF5c1JlZ2V4ICAgICAgPSBkZWZhdWx0V2Vla2RheXNSZWdleDtcbiAgICBwcm90b3R5cGVfX3Byb3RvLndlZWtkYXlzUmVnZXggICAgICAgPSAgICAgICAgd2Vla2RheXNSZWdleDtcbiAgICBwcm90b3R5cGVfX3Byb3RvLl93ZWVrZGF5c1Nob3J0UmVnZXggPSBkZWZhdWx0V2Vla2RheXNTaG9ydFJlZ2V4O1xuICAgIHByb3RvdHlwZV9fcHJvdG8ud2Vla2RheXNTaG9ydFJlZ2V4ICA9ICAgICAgICB3ZWVrZGF5c1Nob3J0UmVnZXg7XG4gICAgcHJvdG90eXBlX19wcm90by5fd2Vla2RheXNNaW5SZWdleCAgID0gZGVmYXVsdFdlZWtkYXlzTWluUmVnZXg7XG4gICAgcHJvdG90eXBlX19wcm90by53ZWVrZGF5c01pblJlZ2V4ICAgID0gICAgICAgIHdlZWtkYXlzTWluUmVnZXg7XG5cbiAgICAvLyBIb3Vyc1xuICAgIHByb3RvdHlwZV9fcHJvdG8uaXNQTSA9IGxvY2FsZUlzUE07XG4gICAgcHJvdG90eXBlX19wcm90by5fbWVyaWRpZW1QYXJzZSA9IGRlZmF1bHRMb2NhbGVNZXJpZGllbVBhcnNlO1xuICAgIHByb3RvdHlwZV9fcHJvdG8ubWVyaWRpZW0gPSBsb2NhbGVNZXJpZGllbTtcblxuICAgIGZ1bmN0aW9uIGxpc3RzX19nZXQgKGZvcm1hdCwgaW5kZXgsIGZpZWxkLCBzZXR0ZXIpIHtcbiAgICAgICAgdmFyIGxvY2FsZSA9IGxvY2FsZV9sb2NhbGVzX19nZXRMb2NhbGUoKTtcbiAgICAgICAgdmFyIHV0YyA9IGNyZWF0ZV91dGNfX2NyZWF0ZVVUQygpLnNldChzZXR0ZXIsIGluZGV4KTtcbiAgICAgICAgcmV0dXJuIGxvY2FsZVtmaWVsZF0odXRjLCBmb3JtYXQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpc3RNb250aHNJbXBsIChmb3JtYXQsIGluZGV4LCBmaWVsZCkge1xuICAgICAgICBpZiAodHlwZW9mIGZvcm1hdCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGluZGV4ID0gZm9ybWF0O1xuICAgICAgICAgICAgZm9ybWF0ID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9ybWF0ID0gZm9ybWF0IHx8ICcnO1xuXG4gICAgICAgIGlmIChpbmRleCAhPSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gbGlzdHNfX2dldChmb3JtYXQsIGluZGV4LCBmaWVsZCwgJ21vbnRoJyk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaTtcbiAgICAgICAgdmFyIG91dCA9IFtdO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgMTI7IGkrKykge1xuICAgICAgICAgICAgb3V0W2ldID0gbGlzdHNfX2dldChmb3JtYXQsIGksIGZpZWxkLCAnbW9udGgnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3V0O1xuICAgIH1cblxuICAgIC8vICgpXG4gICAgLy8gKDUpXG4gICAgLy8gKGZtdCwgNSlcbiAgICAvLyAoZm10KVxuICAgIC8vICh0cnVlKVxuICAgIC8vICh0cnVlLCA1KVxuICAgIC8vICh0cnVlLCBmbXQsIDUpXG4gICAgLy8gKHRydWUsIGZtdClcbiAgICBmdW5jdGlvbiBsaXN0V2Vla2RheXNJbXBsIChsb2NhbGVTb3J0ZWQsIGZvcm1hdCwgaW5kZXgsIGZpZWxkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbG9jYWxlU29ydGVkID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZm9ybWF0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIGluZGV4ID0gZm9ybWF0O1xuICAgICAgICAgICAgICAgIGZvcm1hdCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9ybWF0ID0gZm9ybWF0IHx8ICcnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9ybWF0ID0gbG9jYWxlU29ydGVkO1xuICAgICAgICAgICAgaW5kZXggPSBmb3JtYXQ7XG4gICAgICAgICAgICBsb2NhbGVTb3J0ZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBmb3JtYXQgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgaW5kZXggPSBmb3JtYXQ7XG4gICAgICAgICAgICAgICAgZm9ybWF0ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3JtYXQgPSBmb3JtYXQgfHwgJyc7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbG9jYWxlID0gbG9jYWxlX2xvY2FsZXNfX2dldExvY2FsZSgpLFxuICAgICAgICAgICAgc2hpZnQgPSBsb2NhbGVTb3J0ZWQgPyBsb2NhbGUuX3dlZWsuZG93IDogMDtcblxuICAgICAgICBpZiAoaW5kZXggIT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIGxpc3RzX19nZXQoZm9ybWF0LCAoaW5kZXggKyBzaGlmdCkgJSA3LCBmaWVsZCwgJ2RheScpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGk7XG4gICAgICAgIHZhciBvdXQgPSBbXTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IDc7IGkrKykge1xuICAgICAgICAgICAgb3V0W2ldID0gbGlzdHNfX2dldChmb3JtYXQsIChpICsgc2hpZnQpICUgNywgZmllbGQsICdkYXknKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3V0O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpc3RzX19saXN0TW9udGhzIChmb3JtYXQsIGluZGV4KSB7XG4gICAgICAgIHJldHVybiBsaXN0TW9udGhzSW1wbChmb3JtYXQsIGluZGV4LCAnbW9udGhzJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGlzdHNfX2xpc3RNb250aHNTaG9ydCAoZm9ybWF0LCBpbmRleCkge1xuICAgICAgICByZXR1cm4gbGlzdE1vbnRoc0ltcGwoZm9ybWF0LCBpbmRleCwgJ21vbnRoc1Nob3J0Jyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGlzdHNfX2xpc3RXZWVrZGF5cyAobG9jYWxlU29ydGVkLCBmb3JtYXQsIGluZGV4KSB7XG4gICAgICAgIHJldHVybiBsaXN0V2Vla2RheXNJbXBsKGxvY2FsZVNvcnRlZCwgZm9ybWF0LCBpbmRleCwgJ3dlZWtkYXlzJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGlzdHNfX2xpc3RXZWVrZGF5c1Nob3J0IChsb2NhbGVTb3J0ZWQsIGZvcm1hdCwgaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIGxpc3RXZWVrZGF5c0ltcGwobG9jYWxlU29ydGVkLCBmb3JtYXQsIGluZGV4LCAnd2Vla2RheXNTaG9ydCcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpc3RzX19saXN0V2Vla2RheXNNaW4gKGxvY2FsZVNvcnRlZCwgZm9ybWF0LCBpbmRleCkge1xuICAgICAgICByZXR1cm4gbGlzdFdlZWtkYXlzSW1wbChsb2NhbGVTb3J0ZWQsIGZvcm1hdCwgaW5kZXgsICd3ZWVrZGF5c01pbicpO1xuICAgIH1cblxuICAgIGxvY2FsZV9sb2NhbGVzX19nZXRTZXRHbG9iYWxMb2NhbGUoJ2VuJywge1xuICAgICAgICBvcmRpbmFsUGFyc2U6IC9cXGR7MSwyfSh0aHxzdHxuZHxyZCkvLFxuICAgICAgICBvcmRpbmFsIDogZnVuY3Rpb24gKG51bWJlcikge1xuICAgICAgICAgICAgdmFyIGIgPSBudW1iZXIgJSAxMCxcbiAgICAgICAgICAgICAgICBvdXRwdXQgPSAodG9JbnQobnVtYmVyICUgMTAwIC8gMTApID09PSAxKSA/ICd0aCcgOlxuICAgICAgICAgICAgICAgIChiID09PSAxKSA/ICdzdCcgOlxuICAgICAgICAgICAgICAgIChiID09PSAyKSA/ICduZCcgOlxuICAgICAgICAgICAgICAgIChiID09PSAzKSA/ICdyZCcgOiAndGgnO1xuICAgICAgICAgICAgcmV0dXJuIG51bWJlciArIG91dHB1dDtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gU2lkZSBlZmZlY3QgaW1wb3J0c1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy5sYW5nID0gZGVwcmVjYXRlKCdtb21lbnQubGFuZyBpcyBkZXByZWNhdGVkLiBVc2UgbW9tZW50LmxvY2FsZSBpbnN0ZWFkLicsIGxvY2FsZV9sb2NhbGVzX19nZXRTZXRHbG9iYWxMb2NhbGUpO1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy5sYW5nRGF0YSA9IGRlcHJlY2F0ZSgnbW9tZW50LmxhbmdEYXRhIGlzIGRlcHJlY2F0ZWQuIFVzZSBtb21lbnQubG9jYWxlRGF0YSBpbnN0ZWFkLicsIGxvY2FsZV9sb2NhbGVzX19nZXRMb2NhbGUpO1xuXG4gICAgdmFyIG1hdGhBYnMgPSBNYXRoLmFicztcblxuICAgIGZ1bmN0aW9uIGR1cmF0aW9uX2Fic19fYWJzICgpIHtcbiAgICAgICAgdmFyIGRhdGEgICAgICAgICAgID0gdGhpcy5fZGF0YTtcblxuICAgICAgICB0aGlzLl9taWxsaXNlY29uZHMgPSBtYXRoQWJzKHRoaXMuX21pbGxpc2Vjb25kcyk7XG4gICAgICAgIHRoaXMuX2RheXMgICAgICAgICA9IG1hdGhBYnModGhpcy5fZGF5cyk7XG4gICAgICAgIHRoaXMuX21vbnRocyAgICAgICA9IG1hdGhBYnModGhpcy5fbW9udGhzKTtcblxuICAgICAgICBkYXRhLm1pbGxpc2Vjb25kcyAgPSBtYXRoQWJzKGRhdGEubWlsbGlzZWNvbmRzKTtcbiAgICAgICAgZGF0YS5zZWNvbmRzICAgICAgID0gbWF0aEFicyhkYXRhLnNlY29uZHMpO1xuICAgICAgICBkYXRhLm1pbnV0ZXMgICAgICAgPSBtYXRoQWJzKGRhdGEubWludXRlcyk7XG4gICAgICAgIGRhdGEuaG91cnMgICAgICAgICA9IG1hdGhBYnMoZGF0YS5ob3Vycyk7XG4gICAgICAgIGRhdGEubW9udGhzICAgICAgICA9IG1hdGhBYnMoZGF0YS5tb250aHMpO1xuICAgICAgICBkYXRhLnllYXJzICAgICAgICAgPSBtYXRoQWJzKGRhdGEueWVhcnMpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGR1cmF0aW9uX2FkZF9zdWJ0cmFjdF9fYWRkU3VidHJhY3QgKGR1cmF0aW9uLCBpbnB1dCwgdmFsdWUsIGRpcmVjdGlvbikge1xuICAgICAgICB2YXIgb3RoZXIgPSBjcmVhdGVfX2NyZWF0ZUR1cmF0aW9uKGlucHV0LCB2YWx1ZSk7XG5cbiAgICAgICAgZHVyYXRpb24uX21pbGxpc2Vjb25kcyArPSBkaXJlY3Rpb24gKiBvdGhlci5fbWlsbGlzZWNvbmRzO1xuICAgICAgICBkdXJhdGlvbi5fZGF5cyAgICAgICAgICs9IGRpcmVjdGlvbiAqIG90aGVyLl9kYXlzO1xuICAgICAgICBkdXJhdGlvbi5fbW9udGhzICAgICAgICs9IGRpcmVjdGlvbiAqIG90aGVyLl9tb250aHM7XG5cbiAgICAgICAgcmV0dXJuIGR1cmF0aW9uLl9idWJibGUoKTtcbiAgICB9XG5cbiAgICAvLyBzdXBwb3J0cyBvbmx5IDIuMC1zdHlsZSBhZGQoMSwgJ3MnKSBvciBhZGQoZHVyYXRpb24pXG4gICAgZnVuY3Rpb24gZHVyYXRpb25fYWRkX3N1YnRyYWN0X19hZGQgKGlucHV0LCB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gZHVyYXRpb25fYWRkX3N1YnRyYWN0X19hZGRTdWJ0cmFjdCh0aGlzLCBpbnB1dCwgdmFsdWUsIDEpO1xuICAgIH1cblxuICAgIC8vIHN1cHBvcnRzIG9ubHkgMi4wLXN0eWxlIHN1YnRyYWN0KDEsICdzJykgb3Igc3VidHJhY3QoZHVyYXRpb24pXG4gICAgZnVuY3Rpb24gZHVyYXRpb25fYWRkX3N1YnRyYWN0X19zdWJ0cmFjdCAoaW5wdXQsIHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBkdXJhdGlvbl9hZGRfc3VidHJhY3RfX2FkZFN1YnRyYWN0KHRoaXMsIGlucHV0LCB2YWx1ZSwgLTEpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFic0NlaWwgKG51bWJlcikge1xuICAgICAgICBpZiAobnVtYmVyIDwgMCkge1xuICAgICAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IobnVtYmVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBNYXRoLmNlaWwobnVtYmVyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJ1YmJsZSAoKSB7XG4gICAgICAgIHZhciBtaWxsaXNlY29uZHMgPSB0aGlzLl9taWxsaXNlY29uZHM7XG4gICAgICAgIHZhciBkYXlzICAgICAgICAgPSB0aGlzLl9kYXlzO1xuICAgICAgICB2YXIgbW9udGhzICAgICAgID0gdGhpcy5fbW9udGhzO1xuICAgICAgICB2YXIgZGF0YSAgICAgICAgID0gdGhpcy5fZGF0YTtcbiAgICAgICAgdmFyIHNlY29uZHMsIG1pbnV0ZXMsIGhvdXJzLCB5ZWFycywgbW9udGhzRnJvbURheXM7XG5cbiAgICAgICAgLy8gaWYgd2UgaGF2ZSBhIG1peCBvZiBwb3NpdGl2ZSBhbmQgbmVnYXRpdmUgdmFsdWVzLCBidWJibGUgZG93biBmaXJzdFxuICAgICAgICAvLyBjaGVjazogaHR0cHM6Ly9naXRodWIuY29tL21vbWVudC9tb21lbnQvaXNzdWVzLzIxNjZcbiAgICAgICAgaWYgKCEoKG1pbGxpc2Vjb25kcyA+PSAwICYmIGRheXMgPj0gMCAmJiBtb250aHMgPj0gMCkgfHxcbiAgICAgICAgICAgICAgICAobWlsbGlzZWNvbmRzIDw9IDAgJiYgZGF5cyA8PSAwICYmIG1vbnRocyA8PSAwKSkpIHtcbiAgICAgICAgICAgIG1pbGxpc2Vjb25kcyArPSBhYnNDZWlsKG1vbnRoc1RvRGF5cyhtb250aHMpICsgZGF5cykgKiA4NjRlNTtcbiAgICAgICAgICAgIGRheXMgPSAwO1xuICAgICAgICAgICAgbW9udGhzID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBmb2xsb3dpbmcgY29kZSBidWJibGVzIHVwIHZhbHVlcywgc2VlIHRoZSB0ZXN0cyBmb3JcbiAgICAgICAgLy8gZXhhbXBsZXMgb2Ygd2hhdCB0aGF0IG1lYW5zLlxuICAgICAgICBkYXRhLm1pbGxpc2Vjb25kcyA9IG1pbGxpc2Vjb25kcyAlIDEwMDA7XG5cbiAgICAgICAgc2Vjb25kcyAgICAgICAgICAgPSBhYnNGbG9vcihtaWxsaXNlY29uZHMgLyAxMDAwKTtcbiAgICAgICAgZGF0YS5zZWNvbmRzICAgICAgPSBzZWNvbmRzICUgNjA7XG5cbiAgICAgICAgbWludXRlcyAgICAgICAgICAgPSBhYnNGbG9vcihzZWNvbmRzIC8gNjApO1xuICAgICAgICBkYXRhLm1pbnV0ZXMgICAgICA9IG1pbnV0ZXMgJSA2MDtcblxuICAgICAgICBob3VycyAgICAgICAgICAgICA9IGFic0Zsb29yKG1pbnV0ZXMgLyA2MCk7XG4gICAgICAgIGRhdGEuaG91cnMgICAgICAgID0gaG91cnMgJSAyNDtcblxuICAgICAgICBkYXlzICs9IGFic0Zsb29yKGhvdXJzIC8gMjQpO1xuXG4gICAgICAgIC8vIGNvbnZlcnQgZGF5cyB0byBtb250aHNcbiAgICAgICAgbW9udGhzRnJvbURheXMgPSBhYnNGbG9vcihkYXlzVG9Nb250aHMoZGF5cykpO1xuICAgICAgICBtb250aHMgKz0gbW9udGhzRnJvbURheXM7XG4gICAgICAgIGRheXMgLT0gYWJzQ2VpbChtb250aHNUb0RheXMobW9udGhzRnJvbURheXMpKTtcblxuICAgICAgICAvLyAxMiBtb250aHMgLT4gMSB5ZWFyXG4gICAgICAgIHllYXJzID0gYWJzRmxvb3IobW9udGhzIC8gMTIpO1xuICAgICAgICBtb250aHMgJT0gMTI7XG5cbiAgICAgICAgZGF0YS5kYXlzICAgPSBkYXlzO1xuICAgICAgICBkYXRhLm1vbnRocyA9IG1vbnRocztcbiAgICAgICAgZGF0YS55ZWFycyAgPSB5ZWFycztcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkYXlzVG9Nb250aHMgKGRheXMpIHtcbiAgICAgICAgLy8gNDAwIHllYXJzIGhhdmUgMTQ2MDk3IGRheXMgKHRha2luZyBpbnRvIGFjY291bnQgbGVhcCB5ZWFyIHJ1bGVzKVxuICAgICAgICAvLyA0MDAgeWVhcnMgaGF2ZSAxMiBtb250aHMgPT09IDQ4MDBcbiAgICAgICAgcmV0dXJuIGRheXMgKiA0ODAwIC8gMTQ2MDk3O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1vbnRoc1RvRGF5cyAobW9udGhzKSB7XG4gICAgICAgIC8vIHRoZSByZXZlcnNlIG9mIGRheXNUb01vbnRoc1xuICAgICAgICByZXR1cm4gbW9udGhzICogMTQ2MDk3IC8gNDgwMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhcyAodW5pdHMpIHtcbiAgICAgICAgdmFyIGRheXM7XG4gICAgICAgIHZhciBtb250aHM7XG4gICAgICAgIHZhciBtaWxsaXNlY29uZHMgPSB0aGlzLl9taWxsaXNlY29uZHM7XG5cbiAgICAgICAgdW5pdHMgPSBub3JtYWxpemVVbml0cyh1bml0cyk7XG5cbiAgICAgICAgaWYgKHVuaXRzID09PSAnbW9udGgnIHx8IHVuaXRzID09PSAneWVhcicpIHtcbiAgICAgICAgICAgIGRheXMgICA9IHRoaXMuX2RheXMgICArIG1pbGxpc2Vjb25kcyAvIDg2NGU1O1xuICAgICAgICAgICAgbW9udGhzID0gdGhpcy5fbW9udGhzICsgZGF5c1RvTW9udGhzKGRheXMpO1xuICAgICAgICAgICAgcmV0dXJuIHVuaXRzID09PSAnbW9udGgnID8gbW9udGhzIDogbW9udGhzIC8gMTI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBoYW5kbGUgbWlsbGlzZWNvbmRzIHNlcGFyYXRlbHkgYmVjYXVzZSBvZiBmbG9hdGluZyBwb2ludCBtYXRoIGVycm9ycyAoaXNzdWUgIzE4NjcpXG4gICAgICAgICAgICBkYXlzID0gdGhpcy5fZGF5cyArIE1hdGgucm91bmQobW9udGhzVG9EYXlzKHRoaXMuX21vbnRocykpO1xuICAgICAgICAgICAgc3dpdGNoICh1bml0cykge1xuICAgICAgICAgICAgICAgIGNhc2UgJ3dlZWsnICAgOiByZXR1cm4gZGF5cyAvIDcgICAgICsgbWlsbGlzZWNvbmRzIC8gNjA0OGU1O1xuICAgICAgICAgICAgICAgIGNhc2UgJ2RheScgICAgOiByZXR1cm4gZGF5cyAgICAgICAgICsgbWlsbGlzZWNvbmRzIC8gODY0ZTU7XG4gICAgICAgICAgICAgICAgY2FzZSAnaG91cicgICA6IHJldHVybiBkYXlzICogMjQgICAgKyBtaWxsaXNlY29uZHMgLyAzNmU1O1xuICAgICAgICAgICAgICAgIGNhc2UgJ21pbnV0ZScgOiByZXR1cm4gZGF5cyAqIDE0NDAgICsgbWlsbGlzZWNvbmRzIC8gNmU0O1xuICAgICAgICAgICAgICAgIGNhc2UgJ3NlY29uZCcgOiByZXR1cm4gZGF5cyAqIDg2NDAwICsgbWlsbGlzZWNvbmRzIC8gMTAwMDtcbiAgICAgICAgICAgICAgICAvLyBNYXRoLmZsb29yIHByZXZlbnRzIGZsb2F0aW5nIHBvaW50IG1hdGggZXJyb3JzIGhlcmVcbiAgICAgICAgICAgICAgICBjYXNlICdtaWxsaXNlY29uZCc6IHJldHVybiBNYXRoLmZsb29yKGRheXMgKiA4NjRlNSkgKyBtaWxsaXNlY29uZHM7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDogdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIHVuaXQgJyArIHVuaXRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFRPRE86IFVzZSB0aGlzLmFzKCdtcycpP1xuICAgIGZ1bmN0aW9uIGR1cmF0aW9uX2FzX192YWx1ZU9mICgpIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIHRoaXMuX21pbGxpc2Vjb25kcyArXG4gICAgICAgICAgICB0aGlzLl9kYXlzICogODY0ZTUgK1xuICAgICAgICAgICAgKHRoaXMuX21vbnRocyAlIDEyKSAqIDI1OTJlNiArXG4gICAgICAgICAgICB0b0ludCh0aGlzLl9tb250aHMgLyAxMikgKiAzMTUzNmU2XG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWFrZUFzIChhbGlhcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXMoYWxpYXMpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHZhciBhc01pbGxpc2Vjb25kcyA9IG1ha2VBcygnbXMnKTtcbiAgICB2YXIgYXNTZWNvbmRzICAgICAgPSBtYWtlQXMoJ3MnKTtcbiAgICB2YXIgYXNNaW51dGVzICAgICAgPSBtYWtlQXMoJ20nKTtcbiAgICB2YXIgYXNIb3VycyAgICAgICAgPSBtYWtlQXMoJ2gnKTtcbiAgICB2YXIgYXNEYXlzICAgICAgICAgPSBtYWtlQXMoJ2QnKTtcbiAgICB2YXIgYXNXZWVrcyAgICAgICAgPSBtYWtlQXMoJ3cnKTtcbiAgICB2YXIgYXNNb250aHMgICAgICAgPSBtYWtlQXMoJ00nKTtcbiAgICB2YXIgYXNZZWFycyAgICAgICAgPSBtYWtlQXMoJ3knKTtcblxuICAgIGZ1bmN0aW9uIGR1cmF0aW9uX2dldF9fZ2V0ICh1bml0cykge1xuICAgICAgICB1bml0cyA9IG5vcm1hbGl6ZVVuaXRzKHVuaXRzKTtcbiAgICAgICAgcmV0dXJuIHRoaXNbdW5pdHMgKyAncyddKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWFrZUdldHRlcihuYW1lKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fZGF0YVtuYW1lXTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICB2YXIgbWlsbGlzZWNvbmRzID0gbWFrZUdldHRlcignbWlsbGlzZWNvbmRzJyk7XG4gICAgdmFyIHNlY29uZHMgICAgICA9IG1ha2VHZXR0ZXIoJ3NlY29uZHMnKTtcbiAgICB2YXIgbWludXRlcyAgICAgID0gbWFrZUdldHRlcignbWludXRlcycpO1xuICAgIHZhciBob3VycyAgICAgICAgPSBtYWtlR2V0dGVyKCdob3VycycpO1xuICAgIHZhciBkYXlzICAgICAgICAgPSBtYWtlR2V0dGVyKCdkYXlzJyk7XG4gICAgdmFyIG1vbnRocyAgICAgICA9IG1ha2VHZXR0ZXIoJ21vbnRocycpO1xuICAgIHZhciB5ZWFycyAgICAgICAgPSBtYWtlR2V0dGVyKCd5ZWFycycpO1xuXG4gICAgZnVuY3Rpb24gd2Vla3MgKCkge1xuICAgICAgICByZXR1cm4gYWJzRmxvb3IodGhpcy5kYXlzKCkgLyA3KTtcbiAgICB9XG5cbiAgICB2YXIgcm91bmQgPSBNYXRoLnJvdW5kO1xuICAgIHZhciB0aHJlc2hvbGRzID0ge1xuICAgICAgICBzOiA0NSwgIC8vIHNlY29uZHMgdG8gbWludXRlXG4gICAgICAgIG06IDQ1LCAgLy8gbWludXRlcyB0byBob3VyXG4gICAgICAgIGg6IDIyLCAgLy8gaG91cnMgdG8gZGF5XG4gICAgICAgIGQ6IDI2LCAgLy8gZGF5cyB0byBtb250aFxuICAgICAgICBNOiAxMSAgIC8vIG1vbnRocyB0byB5ZWFyXG4gICAgfTtcblxuICAgIC8vIGhlbHBlciBmdW5jdGlvbiBmb3IgbW9tZW50LmZuLmZyb20sIG1vbWVudC5mbi5mcm9tTm93LCBhbmQgbW9tZW50LmR1cmF0aW9uLmZuLmh1bWFuaXplXG4gICAgZnVuY3Rpb24gc3Vic3RpdHV0ZVRpbWVBZ28oc3RyaW5nLCBudW1iZXIsIHdpdGhvdXRTdWZmaXgsIGlzRnV0dXJlLCBsb2NhbGUpIHtcbiAgICAgICAgcmV0dXJuIGxvY2FsZS5yZWxhdGl2ZVRpbWUobnVtYmVyIHx8IDEsICEhd2l0aG91dFN1ZmZpeCwgc3RyaW5nLCBpc0Z1dHVyZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZHVyYXRpb25faHVtYW5pemVfX3JlbGF0aXZlVGltZSAocG9zTmVnRHVyYXRpb24sIHdpdGhvdXRTdWZmaXgsIGxvY2FsZSkge1xuICAgICAgICB2YXIgZHVyYXRpb24gPSBjcmVhdGVfX2NyZWF0ZUR1cmF0aW9uKHBvc05lZ0R1cmF0aW9uKS5hYnMoKTtcbiAgICAgICAgdmFyIHNlY29uZHMgID0gcm91bmQoZHVyYXRpb24uYXMoJ3MnKSk7XG4gICAgICAgIHZhciBtaW51dGVzICA9IHJvdW5kKGR1cmF0aW9uLmFzKCdtJykpO1xuICAgICAgICB2YXIgaG91cnMgICAgPSByb3VuZChkdXJhdGlvbi5hcygnaCcpKTtcbiAgICAgICAgdmFyIGRheXMgICAgID0gcm91bmQoZHVyYXRpb24uYXMoJ2QnKSk7XG4gICAgICAgIHZhciBtb250aHMgICA9IHJvdW5kKGR1cmF0aW9uLmFzKCdNJykpO1xuICAgICAgICB2YXIgeWVhcnMgICAgPSByb3VuZChkdXJhdGlvbi5hcygneScpKTtcblxuICAgICAgICB2YXIgYSA9IHNlY29uZHMgPCB0aHJlc2hvbGRzLnMgJiYgWydzJywgc2Vjb25kc10gIHx8XG4gICAgICAgICAgICAgICAgbWludXRlcyA8PSAxICAgICAgICAgICAmJiBbJ20nXSAgICAgICAgICAgfHxcbiAgICAgICAgICAgICAgICBtaW51dGVzIDwgdGhyZXNob2xkcy5tICYmIFsnbW0nLCBtaW51dGVzXSB8fFxuICAgICAgICAgICAgICAgIGhvdXJzICAgPD0gMSAgICAgICAgICAgJiYgWydoJ10gICAgICAgICAgIHx8XG4gICAgICAgICAgICAgICAgaG91cnMgICA8IHRocmVzaG9sZHMuaCAmJiBbJ2hoJywgaG91cnNdICAgfHxcbiAgICAgICAgICAgICAgICBkYXlzICAgIDw9IDEgICAgICAgICAgICYmIFsnZCddICAgICAgICAgICB8fFxuICAgICAgICAgICAgICAgIGRheXMgICAgPCB0aHJlc2hvbGRzLmQgJiYgWydkZCcsIGRheXNdICAgIHx8XG4gICAgICAgICAgICAgICAgbW9udGhzICA8PSAxICAgICAgICAgICAmJiBbJ00nXSAgICAgICAgICAgfHxcbiAgICAgICAgICAgICAgICBtb250aHMgIDwgdGhyZXNob2xkcy5NICYmIFsnTU0nLCBtb250aHNdICB8fFxuICAgICAgICAgICAgICAgIHllYXJzICAgPD0gMSAgICAgICAgICAgJiYgWyd5J10gICAgICAgICAgIHx8IFsneXknLCB5ZWFyc107XG5cbiAgICAgICAgYVsyXSA9IHdpdGhvdXRTdWZmaXg7XG4gICAgICAgIGFbM10gPSArcG9zTmVnRHVyYXRpb24gPiAwO1xuICAgICAgICBhWzRdID0gbG9jYWxlO1xuICAgICAgICByZXR1cm4gc3Vic3RpdHV0ZVRpbWVBZ28uYXBwbHkobnVsbCwgYSk7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBhbGxvd3MgeW91IHRvIHNldCBhIHRocmVzaG9sZCBmb3IgcmVsYXRpdmUgdGltZSBzdHJpbmdzXG4gICAgZnVuY3Rpb24gZHVyYXRpb25faHVtYW5pemVfX2dldFNldFJlbGF0aXZlVGltZVRocmVzaG9sZCAodGhyZXNob2xkLCBsaW1pdCkge1xuICAgICAgICBpZiAodGhyZXNob2xkc1t0aHJlc2hvbGRdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobGltaXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRocmVzaG9sZHNbdGhyZXNob2xkXTtcbiAgICAgICAgfVxuICAgICAgICB0aHJlc2hvbGRzW3RocmVzaG9sZF0gPSBsaW1pdDtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaHVtYW5pemUgKHdpdGhTdWZmaXgpIHtcbiAgICAgICAgdmFyIGxvY2FsZSA9IHRoaXMubG9jYWxlRGF0YSgpO1xuICAgICAgICB2YXIgb3V0cHV0ID0gZHVyYXRpb25faHVtYW5pemVfX3JlbGF0aXZlVGltZSh0aGlzLCAhd2l0aFN1ZmZpeCwgbG9jYWxlKTtcblxuICAgICAgICBpZiAod2l0aFN1ZmZpeCkge1xuICAgICAgICAgICAgb3V0cHV0ID0gbG9jYWxlLnBhc3RGdXR1cmUoK3RoaXMsIG91dHB1dCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbG9jYWxlLnBvc3Rmb3JtYXQob3V0cHV0KTtcbiAgICB9XG5cbiAgICB2YXIgaXNvX3N0cmluZ19fYWJzID0gTWF0aC5hYnM7XG5cbiAgICBmdW5jdGlvbiBpc29fc3RyaW5nX190b0lTT1N0cmluZygpIHtcbiAgICAgICAgLy8gZm9yIElTTyBzdHJpbmdzIHdlIGRvIG5vdCB1c2UgdGhlIG5vcm1hbCBidWJibGluZyBydWxlczpcbiAgICAgICAgLy8gICogbWlsbGlzZWNvbmRzIGJ1YmJsZSB1cCB1bnRpbCB0aGV5IGJlY29tZSBob3Vyc1xuICAgICAgICAvLyAgKiBkYXlzIGRvIG5vdCBidWJibGUgYXQgYWxsXG4gICAgICAgIC8vICAqIG1vbnRocyBidWJibGUgdXAgdW50aWwgdGhleSBiZWNvbWUgeWVhcnNcbiAgICAgICAgLy8gVGhpcyBpcyBiZWNhdXNlIHRoZXJlIGlzIG5vIGNvbnRleHQtZnJlZSBjb252ZXJzaW9uIGJldHdlZW4gaG91cnMgYW5kIGRheXNcbiAgICAgICAgLy8gKHRoaW5rIG9mIGNsb2NrIGNoYW5nZXMpXG4gICAgICAgIC8vIGFuZCBhbHNvIG5vdCBiZXR3ZWVuIGRheXMgYW5kIG1vbnRocyAoMjgtMzEgZGF5cyBwZXIgbW9udGgpXG4gICAgICAgIHZhciBzZWNvbmRzID0gaXNvX3N0cmluZ19fYWJzKHRoaXMuX21pbGxpc2Vjb25kcykgLyAxMDAwO1xuICAgICAgICB2YXIgZGF5cyAgICAgICAgID0gaXNvX3N0cmluZ19fYWJzKHRoaXMuX2RheXMpO1xuICAgICAgICB2YXIgbW9udGhzICAgICAgID0gaXNvX3N0cmluZ19fYWJzKHRoaXMuX21vbnRocyk7XG4gICAgICAgIHZhciBtaW51dGVzLCBob3VycywgeWVhcnM7XG5cbiAgICAgICAgLy8gMzYwMCBzZWNvbmRzIC0+IDYwIG1pbnV0ZXMgLT4gMSBob3VyXG4gICAgICAgIG1pbnV0ZXMgICAgICAgICAgID0gYWJzRmxvb3Ioc2Vjb25kcyAvIDYwKTtcbiAgICAgICAgaG91cnMgICAgICAgICAgICAgPSBhYnNGbG9vcihtaW51dGVzIC8gNjApO1xuICAgICAgICBzZWNvbmRzICU9IDYwO1xuICAgICAgICBtaW51dGVzICU9IDYwO1xuXG4gICAgICAgIC8vIDEyIG1vbnRocyAtPiAxIHllYXJcbiAgICAgICAgeWVhcnMgID0gYWJzRmxvb3IobW9udGhzIC8gMTIpO1xuICAgICAgICBtb250aHMgJT0gMTI7XG5cblxuICAgICAgICAvLyBpbnNwaXJlZCBieSBodHRwczovL2dpdGh1Yi5jb20vZG9yZGlsbGUvbW9tZW50LWlzb2R1cmF0aW9uL2Jsb2IvbWFzdGVyL21vbWVudC5pc29kdXJhdGlvbi5qc1xuICAgICAgICB2YXIgWSA9IHllYXJzO1xuICAgICAgICB2YXIgTSA9IG1vbnRocztcbiAgICAgICAgdmFyIEQgPSBkYXlzO1xuICAgICAgICB2YXIgaCA9IGhvdXJzO1xuICAgICAgICB2YXIgbSA9IG1pbnV0ZXM7XG4gICAgICAgIHZhciBzID0gc2Vjb25kcztcbiAgICAgICAgdmFyIHRvdGFsID0gdGhpcy5hc1NlY29uZHMoKTtcblxuICAgICAgICBpZiAoIXRvdGFsKSB7XG4gICAgICAgICAgICAvLyB0aGlzIGlzIHRoZSBzYW1lIGFzIEMjJ3MgKE5vZGEpIGFuZCBweXRob24gKGlzb2RhdGUpLi4uXG4gICAgICAgICAgICAvLyBidXQgbm90IG90aGVyIEpTIChnb29nLmRhdGUpXG4gICAgICAgICAgICByZXR1cm4gJ1AwRCc7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gKHRvdGFsIDwgMCA/ICctJyA6ICcnKSArXG4gICAgICAgICAgICAnUCcgK1xuICAgICAgICAgICAgKFkgPyBZICsgJ1knIDogJycpICtcbiAgICAgICAgICAgIChNID8gTSArICdNJyA6ICcnKSArXG4gICAgICAgICAgICAoRCA/IEQgKyAnRCcgOiAnJykgK1xuICAgICAgICAgICAgKChoIHx8IG0gfHwgcykgPyAnVCcgOiAnJykgK1xuICAgICAgICAgICAgKGggPyBoICsgJ0gnIDogJycpICtcbiAgICAgICAgICAgIChtID8gbSArICdNJyA6ICcnKSArXG4gICAgICAgICAgICAocyA/IHMgKyAnUycgOiAnJyk7XG4gICAgfVxuXG4gICAgdmFyIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8gPSBEdXJhdGlvbi5wcm90b3R5cGU7XG5cbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLmFicyAgICAgICAgICAgID0gZHVyYXRpb25fYWJzX19hYnM7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by5hZGQgICAgICAgICAgICA9IGR1cmF0aW9uX2FkZF9zdWJ0cmFjdF9fYWRkO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8uc3VidHJhY3QgICAgICAgPSBkdXJhdGlvbl9hZGRfc3VidHJhY3RfX3N1YnRyYWN0O1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8uYXMgICAgICAgICAgICAgPSBhcztcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLmFzTWlsbGlzZWNvbmRzID0gYXNNaWxsaXNlY29uZHM7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by5hc1NlY29uZHMgICAgICA9IGFzU2Vjb25kcztcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLmFzTWludXRlcyAgICAgID0gYXNNaW51dGVzO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8uYXNIb3VycyAgICAgICAgPSBhc0hvdXJzO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8uYXNEYXlzICAgICAgICAgPSBhc0RheXM7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by5hc1dlZWtzICAgICAgICA9IGFzV2Vla3M7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by5hc01vbnRocyAgICAgICA9IGFzTW9udGhzO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8uYXNZZWFycyAgICAgICAgPSBhc1llYXJzO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8udmFsdWVPZiAgICAgICAgPSBkdXJhdGlvbl9hc19fdmFsdWVPZjtcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLl9idWJibGUgICAgICAgID0gYnViYmxlO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8uZ2V0ICAgICAgICAgICAgPSBkdXJhdGlvbl9nZXRfX2dldDtcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLm1pbGxpc2Vjb25kcyAgID0gbWlsbGlzZWNvbmRzO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8uc2Vjb25kcyAgICAgICAgPSBzZWNvbmRzO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8ubWludXRlcyAgICAgICAgPSBtaW51dGVzO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8uaG91cnMgICAgICAgICAgPSBob3VycztcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLmRheXMgICAgICAgICAgID0gZGF5cztcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLndlZWtzICAgICAgICAgID0gd2Vla3M7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by5tb250aHMgICAgICAgICA9IG1vbnRocztcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLnllYXJzICAgICAgICAgID0geWVhcnM7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by5odW1hbml6ZSAgICAgICA9IGh1bWFuaXplO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8udG9JU09TdHJpbmcgICAgPSBpc29fc3RyaW5nX190b0lTT1N0cmluZztcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLnRvU3RyaW5nICAgICAgID0gaXNvX3N0cmluZ19fdG9JU09TdHJpbmc7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by50b0pTT04gICAgICAgICA9IGlzb19zdHJpbmdfX3RvSVNPU3RyaW5nO1xuICAgIGR1cmF0aW9uX3Byb3RvdHlwZV9fcHJvdG8ubG9jYWxlICAgICAgICAgPSBsb2NhbGU7XG4gICAgZHVyYXRpb25fcHJvdG90eXBlX19wcm90by5sb2NhbGVEYXRhICAgICA9IGxvY2FsZURhdGE7XG5cbiAgICAvLyBEZXByZWNhdGlvbnNcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLnRvSXNvU3RyaW5nID0gZGVwcmVjYXRlKCd0b0lzb1N0cmluZygpIGlzIGRlcHJlY2F0ZWQuIFBsZWFzZSB1c2UgdG9JU09TdHJpbmcoKSBpbnN0ZWFkIChub3RpY2UgdGhlIGNhcGl0YWxzKScsIGlzb19zdHJpbmdfX3RvSVNPU3RyaW5nKTtcbiAgICBkdXJhdGlvbl9wcm90b3R5cGVfX3Byb3RvLmxhbmcgPSBsYW5nO1xuXG4gICAgLy8gU2lkZSBlZmZlY3QgaW1wb3J0c1xuXG4gICAgLy8gRk9STUFUVElOR1xuXG4gICAgYWRkRm9ybWF0VG9rZW4oJ1gnLCAwLCAwLCAndW5peCcpO1xuICAgIGFkZEZvcm1hdFRva2VuKCd4JywgMCwgMCwgJ3ZhbHVlT2YnKTtcblxuICAgIC8vIFBBUlNJTkdcblxuICAgIGFkZFJlZ2V4VG9rZW4oJ3gnLCBtYXRjaFNpZ25lZCk7XG4gICAgYWRkUmVnZXhUb2tlbignWCcsIG1hdGNoVGltZXN0YW1wKTtcbiAgICBhZGRQYXJzZVRva2VuKCdYJywgZnVuY3Rpb24gKGlucHV0LCBhcnJheSwgY29uZmlnKSB7XG4gICAgICAgIGNvbmZpZy5fZCA9IG5ldyBEYXRlKHBhcnNlRmxvYXQoaW5wdXQsIDEwKSAqIDEwMDApO1xuICAgIH0pO1xuICAgIGFkZFBhcnNlVG9rZW4oJ3gnLCBmdW5jdGlvbiAoaW5wdXQsIGFycmF5LCBjb25maWcpIHtcbiAgICAgICAgY29uZmlnLl9kID0gbmV3IERhdGUodG9JbnQoaW5wdXQpKTtcbiAgICB9KTtcblxuICAgIC8vIFNpZGUgZWZmZWN0IGltcG9ydHNcblxuXG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLnZlcnNpb24gPSAnMi4xMy4wJztcblxuICAgIHNldEhvb2tDYWxsYmFjayhsb2NhbF9fY3JlYXRlTG9jYWwpO1xuXG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLmZuICAgICAgICAgICAgICAgICAgICA9IG1vbWVudFByb3RvdHlwZTtcbiAgICB1dGlsc19ob29rc19faG9va3MubWluICAgICAgICAgICAgICAgICAgID0gbWluO1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy5tYXggICAgICAgICAgICAgICAgICAgPSBtYXg7XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLm5vdyAgICAgICAgICAgICAgICAgICA9IG5vdztcbiAgICB1dGlsc19ob29rc19faG9va3MudXRjICAgICAgICAgICAgICAgICAgID0gY3JlYXRlX3V0Y19fY3JlYXRlVVRDO1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy51bml4ICAgICAgICAgICAgICAgICAgPSBtb21lbnRfX2NyZWF0ZVVuaXg7XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLm1vbnRocyAgICAgICAgICAgICAgICA9IGxpc3RzX19saXN0TW9udGhzO1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy5pc0RhdGUgICAgICAgICAgICAgICAgPSBpc0RhdGU7XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLmxvY2FsZSAgICAgICAgICAgICAgICA9IGxvY2FsZV9sb2NhbGVzX19nZXRTZXRHbG9iYWxMb2NhbGU7XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLmludmFsaWQgICAgICAgICAgICAgICA9IHZhbGlkX19jcmVhdGVJbnZhbGlkO1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy5kdXJhdGlvbiAgICAgICAgICAgICAgPSBjcmVhdGVfX2NyZWF0ZUR1cmF0aW9uO1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy5pc01vbWVudCAgICAgICAgICAgICAgPSBpc01vbWVudDtcbiAgICB1dGlsc19ob29rc19faG9va3Mud2Vla2RheXMgICAgICAgICAgICAgID0gbGlzdHNfX2xpc3RXZWVrZGF5cztcbiAgICB1dGlsc19ob29rc19faG9va3MucGFyc2Vab25lICAgICAgICAgICAgID0gbW9tZW50X19jcmVhdGVJblpvbmU7XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLmxvY2FsZURhdGEgICAgICAgICAgICA9IGxvY2FsZV9sb2NhbGVzX19nZXRMb2NhbGU7XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLmlzRHVyYXRpb24gICAgICAgICAgICA9IGlzRHVyYXRpb247XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLm1vbnRoc1Nob3J0ICAgICAgICAgICA9IGxpc3RzX19saXN0TW9udGhzU2hvcnQ7XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLndlZWtkYXlzTWluICAgICAgICAgICA9IGxpc3RzX19saXN0V2Vla2RheXNNaW47XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLmRlZmluZUxvY2FsZSAgICAgICAgICA9IGRlZmluZUxvY2FsZTtcbiAgICB1dGlsc19ob29rc19faG9va3MudXBkYXRlTG9jYWxlICAgICAgICAgID0gdXBkYXRlTG9jYWxlO1xuICAgIHV0aWxzX2hvb2tzX19ob29rcy5sb2NhbGVzICAgICAgICAgICAgICAgPSBsb2NhbGVfbG9jYWxlc19fbGlzdExvY2FsZXM7XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLndlZWtkYXlzU2hvcnQgICAgICAgICA9IGxpc3RzX19saXN0V2Vla2RheXNTaG9ydDtcbiAgICB1dGlsc19ob29rc19faG9va3Mubm9ybWFsaXplVW5pdHMgICAgICAgID0gbm9ybWFsaXplVW5pdHM7XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLnJlbGF0aXZlVGltZVRocmVzaG9sZCA9IGR1cmF0aW9uX2h1bWFuaXplX19nZXRTZXRSZWxhdGl2ZVRpbWVUaHJlc2hvbGQ7XG4gICAgdXRpbHNfaG9va3NfX2hvb2tzLnByb3RvdHlwZSAgICAgICAgICAgICA9IG1vbWVudFByb3RvdHlwZTtcblxuICAgIHZhciBfbW9tZW50ID0gdXRpbHNfaG9va3NfX2hvb2tzO1xuXG4gICAgcmV0dXJuIF9tb21lbnQ7XG5cbn0pKTsiLCJpbXBvcnQge0Rhc2hib2FyZH0gZnJvbSAnLi9kYXNoYm9hcmQvZGFzaGJvYXJkLmpzJztcblxuY29uc3QgY29uZmlnID0ge1xuICB0YXJnZXRFbDogZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI21haW4tY29udGVudCcpXG59O1xuXG5jbGFzcyBBcHAge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmRhc2hib2FyZCA9IG5ldyBEYXNoYm9hcmQoY29uZmlnKTtcbiAgfVxufVxuXG5pZiAoIXdpbmRvdy5fX2thcm1hX18pIHtcbiAgY29uc3QgYXBwID0gbmV3IEFwcCgpOy8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcbn1cblxuZXhwb3J0IHtBcHAsIGNvbmZpZ307XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICc8bWFpbiBjbGFzcz1cInRleHQtY2VudGVyIGNvbnRhaW5lci1mbHVpZFwiPlxcbicgK1xuICAgICcgIDxzZWN0aW9uIGNsYXNzPVwicm93IGNlbnRlcmVkXCI+XFxuJyArXG4gICAgJyAgICA8ZGl2IGlkPVwibWFpbi10aW1lem9uZXMtY29udGFpbmVyXCIgY2xhc3M9XCJjb2wteHMtMTIgY29sLW1kLTZcIj48L2Rpdj5cXG4nICtcbiAgICAnICA8L3NlY3Rpb24+XFxuJyArXG4gICAgJyAgPHNlY3Rpb24gaWQ9XCJhZGQtdGltZXpvbmUtY29udGFpbmVyXCIgY2xhc3M9XCJyb3dcIj48L3NlY3Rpb24+XFxuJyArXG4gICAgJyAgPHNlY3Rpb24gaWQ9XCJhZGRpdGlvbmFsLXRpbWV6b25lcy1jb250YWluZXJcIiBjbGFzcz1cInJvd1wiPjwvc2VjdGlvbj5cXG4nICtcbiAgICAnPC9tYWluPlxcbicgK1xuICAgICcnOyIsImltcG9ydCB0ZW1wbGF0ZSBmcm9tICcuL2Rhc2hib2FyZC5odG1sJztcbmltcG9ydCB7TmV3VGltZXpvbmVGb3JtfSBmcm9tICcuL25ldy10aW1lem9uZS1mb3JtL25ldy10aW1lem9uZS1mb3JtLmpzJztcbmltcG9ydCB7VGltZXpvbmVDYXJkfSBmcm9tICcuL3RpbWV6b25lLWNhcmQvdGltZXpvbmUtY2FyZC5qcyc7XG5pbXBvcnQge1N0b3JlQ3VycmVudFRpbWV9IGZyb20gJy4vc3RvcmUtY3VycmVudC10aW1lL3N0b3JlLWN1cnJlbnQtdGltZS5qcyc7XG5pbXBvcnQge0VsZW1lbnQsIGV4Y2VwdGlvbk1zZ30gZnJvbSAnLi9lbGVtZW50L2VsZW1lbnQuanMnO1xuaW1wb3J0IGRvVCBmcm9tICdkb3QnO1xuaW1wb3J0IG1vbWVudCBmcm9tICdtb21lbnQtdGltZXpvbmUnO1xuXG5leHBvcnQge2V4Y2VwdGlvbk1zZ307XG5cbmV4cG9ydCBjb25zdCBlbGVtZW50c1F1ZXJ5ID0ge1xuICBtYWluVHpDb250YWluZXI6ICcjbWFpbi10aW1lem9uZXMtY29udGFpbmVyJyxcbiAgYWRkVHpDb250YWluZXI6ICcjYWRkLXRpbWV6b25lLWNvbnRhaW5lcicsXG4gIGFkZGl0aW9uYWxUekNvbnRhaW5lcjogJyNhZGRpdGlvbmFsLXRpbWV6b25lcy1jb250YWluZXInXG59O1xuXG5leHBvcnQgY2xhc3MgRGFzaGJvYXJkIGV4dGVuZHMgRWxlbWVudCB7XG4gIGNvbnN0cnVjdG9yKGNvbmZpZyA9IHt9KSB7XG4gICAgc3VwZXIoY29uZmlnLCBlbGVtZW50c1F1ZXJ5KTtcbiAgICB0aGlzLnRpbWV6b25lcyA9IFtdO1xuICB9XG5cbiAgcmVuZGVyKCkge1xuICAgIHN1cGVyLnJlbmRlcigpO1xuICAgIHRoaXMuY29uZmlnLnRhcmdldEVsLmlubmVySFRNTCA9IGRvVC50ZW1wbGF0ZSh0ZW1wbGF0ZSkoKTtcbiAgfVxuXG4gIHBvc3QoKSB7XG4gICAgc3VwZXIucG9zdCgpO1xuICAgIHRoaXMuc3RvcmVDdXJyZW50VGltZSA9IG5ldyBTdG9yZUN1cnJlbnRUaW1lKCk7XG4gICAgdGhpcy5hZGRFbGVtZW50cygpO1xuICB9XG5cbiAgYWRkRWxlbWVudHMoKSB7XG4gICAgdGhpcy5hZGROZXdUaW1lem9uZUZvcm0oKTtcbiAgICB0aGlzLmluaXRNYWluVGltZXpvbmVzKCk7XG4gIH1cblxuICBhZGROZXdUaW1lem9uZUZvcm0oKSB7XG4gICAgbmV3IE5ld1RpbWV6b25lRm9ybSh7XG4gICAgICB0YXJnZXRFbDogdGhpcy5kb21FbC5hZGRUekNvbnRhaW5lcixcbiAgICAgIG9uQWRkVGltZXpvbmU6IHRoaXMuYWRkTmV3VGltZVpvbmUuYmluZCh0aGlzKVxuICAgIH0pO1xuICB9XG5cbiAgaW5pdE1haW5UaW1lem9uZXMoKSB7XG4gICAgbmV3IFRpbWV6b25lQ2FyZCh7XG4gICAgICB0YXJnZXRFbDogdGhpcy5kb21FbC5tYWluVHpDb250YWluZXIsXG4gICAgICBjc3NDbGFzczogJ2NvbC14cy0xMiBjb2wtbWQtNicsXG4gICAgICB0aW1lOiB0aGlzLnN0b3JlQ3VycmVudFRpbWUudmFsdWUsXG4gICAgICB0aW1lem9uZTogbW9tZW50LnR6Lmd1ZXNzKCksXG4gICAgICBzdG9yZUN1cnJlbnRUaW1lOiB0aGlzLnN0b3JlQ3VycmVudFRpbWVcbiAgICB9KTtcbiAgICBuZXcgVGltZXpvbmVDYXJkKHtcbiAgICAgIHRhcmdldEVsOiB0aGlzLmRvbUVsLm1haW5UekNvbnRhaW5lcixcbiAgICAgIGNzc0NsYXNzOiAnY29sLXhzLTEyIGNvbC1tZC02JyxcbiAgICAgIHRpbWU6IHRoaXMuc3RvcmVDdXJyZW50VGltZS52YWx1ZSxcbiAgICAgIHRpbWV6b25lOiAnR01UJyxcbiAgICAgIHN0b3JlQ3VycmVudFRpbWU6IHRoaXMuc3RvcmVDdXJyZW50VGltZVxuICAgIH0pO1xuICB9XG5cbiAgYWRkTmV3VGltZVpvbmUodmFsdWUpIHtcbiAgICBuZXcgVGltZXpvbmVDYXJkKHtcbiAgICAgIHRhcmdldEVsOiB0aGlzLmRvbUVsLmFkZGl0aW9uYWxUekNvbnRhaW5lcixcbiAgICAgIHRpbWU6IHRoaXMuc3RvcmVDdXJyZW50VGltZS52YWx1ZSxcbiAgICAgIHRpbWV6b25lOiB2YWx1ZSxcbiAgICAgIHN0b3JlQ3VycmVudFRpbWU6IHRoaXMuc3RvcmVDdXJyZW50VGltZVxuICAgIH0pO1xuICB9XG59XG4iLCJleHBvcnQgY29uc3QgZXhjZXB0aW9uTXNnID0ge1xuICBub1RhcmdldEVsOiAnWW91IHNob3VsZCBwYXNzIHRhcmdldEVsIChET00gZWxlbWVudCkgaW4gY29uZmlnJyxcbiAgbm9Eb21UYXJnZXRFbDogJ1lvdSBzaG91bGQgRE9NIGVsZW1lbnQgYXMgYSB0YXJnZXRFbCBpbiBjb25maWcnXG59O1xuXG5leHBvcnQgY2xhc3MgRWxlbWVudCB7XG4gIGNvbnN0cnVjdG9yKGNvbmZpZyA9IHt9LCBlbGVtZW50c1F1ZXJ5ID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLmVsZW1lbnRzUXVlcnkgPSBlbGVtZW50c1F1ZXJ5O1xuICAgIHRoaXMuY2hlY2tDb25maWcoKTtcbiAgICB0aGlzLmRvbUVsID0ge307XG5cbiAgICAvLyBpbml0XG4gICAgdGhpcy5wcmVSZW5kZXIoKTtcbiAgICB0aGlzLnJlbmRlcigpO1xuICAgIHRoaXMucG9zdFJlbmRlcigpO1xuICAgIHRoaXMuYXNzaWduRG9tRWxlbWVudHMoKTtcbiAgICB0aGlzLnBvc3QoKTtcblxuICAgIHRoaXMuc21hcnRMaXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLmFkZExpc3RlbmVycygpO1xuICB9XG5cbiAgY2hlY2tDb25maWcoKSB7XG4gICAgaWYgKCF0aGlzLmNvbmZpZy50YXJnZXRFbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGV4Y2VwdGlvbk1zZy5ub1RhcmdldEVsKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuY29uZmlnLnRhcmdldEVsICYmICF0aGlzLmNvbmZpZy50YXJnZXRFbC50YWdOYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXhjZXB0aW9uTXNnLm5vRG9tVGFyZ2V0RWwpO1xuICAgIH1cbiAgfVxuXG4gIHByZVJlbmRlcigpIHt9XG5cbiAgcmVuZGVyKCkge31cblxuICBwb3N0UmVuZGVyKCkge31cblxuICBhZGRMaXN0ZW5lcnMoKSB7fVxuXG4gIHBvc3QoKSB7fVxuXG4gIGFkZFNtYXJ0TGlzdGVuZXJzKGVsS2V5LCBldmVudE5hbWUsIGNiKSB7XG4gICAgaWYgKCF0aGlzLnNtYXJ0TGlzdGVuZXJzW2VsS2V5XSkge1xuICAgICAgdGhpcy5zbWFydExpc3RlbmVyc1tlbEtleV0gPSB7fTtcbiAgICB9XG5cbiAgICB0aGlzLnNtYXJ0TGlzdGVuZXJzW2VsS2V5XVtldmVudE5hbWVdID0gY2I7XG4gICAgdGhpcy5kb21FbFtlbEtleV0uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBjYik7XG4gIH1cblxuICByZW1vdmVBbGxTbWFydExpc3RlbmVycygpIHtcbiAgICBPYmplY3Qua2V5cyh0aGlzLnNtYXJ0TGlzdGVuZXJzKS5mb3JFYWNoKChlbEtleSkgPT4ge1xuICAgICAgT2JqZWN0LmtleXModGhpcy5zbWFydExpc3RlbmVyc1tlbEtleV0pLmZvckVhY2goKGV2ZW50TmFtZSkgPT4ge1xuICAgICAgICB0aGlzLmRvbUVsW2VsS2V5XVxuICAgICAgICAgIC5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgZXZlbnROYW1lLFxuICAgICAgICAgICAgdGhpcy5zbWFydExpc3RlbmVyc1tlbEtleV1bZXZlbnROYW1lXVxuICAgICAgICAgICk7XG5cbiAgICAgICAgZGVsZXRlIHRoaXMuc21hcnRMaXN0ZW5lcnNbZWxLZXldW2V2ZW50TmFtZV07XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGFzc2lnbkRvbUVsZW1lbnRzKCkge1xuICAgIGZvciAobGV0IGtleSBpbiB0aGlzLmVsZW1lbnRzUXVlcnkpIHtcbiAgICAgIGlmICh0aGlzLmVsZW1lbnRzUXVlcnkuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICB0aGlzLmRvbUVsW2tleV0gPSB0aGlzLmNvbmZpZ1xuICAgICAgICAgIC50YXJnZXRFbFxuICAgICAgICAgIC5xdWVyeVNlbGVjdG9yKHRoaXMuZWxlbWVudHNRdWVyeVtrZXldKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZW1vdmVFbGVtZW50KCkge1xuICAgIHRoaXMucmVtb3ZlQWxsU21hcnRMaXN0ZW5lcnMoKTtcbiAgICB0aGlzLmNvbmZpZy50YXJnZXRFbC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuY29uZmlnLnRhcmdldEVsKTtcbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSAnPGkgY2xhc3M9XCJmYSBmYS1jbG9jay1vIGZhLTEweCBmYS1sZ1wiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjwvaT5cXG4nICtcbiAgICAnPHAgY2xhc3M9XCJsZWFkXCI+V2VsY29tZSBhdCBicmFuZCBuZXcgdGltZXpvbmUgZGFzaGJvYXJkITxicj4gQ2xpY2sgb24gdGhlIGNhcmQgdG8gZmxpcCBpdCE8L3A+XFxuJyArXG4gICAgJzxmb3JtIG5hbWU9XCJhZGQtdGltZXpvbmVcIiBjbGFzcz1cImZvcm0taW5saW5lXCIgb25rZXlwcmVzcz1cInJldHVybiBldmVudC5rZXlDb2RlICE9IDEzXCIgb25TdWJtaXQ9XCJyZXR1cm4gZmFsc2U7XCI+XFxuJyArXG4gICAgJyAgPHNlbGVjdCBpZD1cImRkVGltZXpvbmVcIiBjbGFzcz1cImZvcm0tY29udHJvbCBpbnB1dC1sZ1wiPlxcbicgK1xuICAgICcgICAge3t+aXQudGltZXpvbmVzIDp2YWx1ZTppbmRleH19XFxuJyArXG4gICAgJyAgICAgIDxvcHRpb24gdmFsdWU9XCJ7ez12YWx1ZX19XCI+e3s9dmFsdWV9fTwvb3B0aW9uPlxcbicgK1xuICAgICcgICAge3t+fX1cXG4nICtcbiAgICAnICA8L3NlbGVjdD5cXG4nICtcbiAgICAnICA8YnV0dG9uIHR5cGU9XCJzdWJtaXRcIiBjbGFzcz1cImJ0biBidG4tcHJpbWFyeSBidG4tbGdcIj5BZGQgdGltZXpvbmU8L2J1dHRvbj5cXG4nICtcbiAgICAnPC9mb3JtPic7IiwiaW1wb3J0IHRlbXBsYXRlIGZyb20gJy4vbmV3LXRpbWV6b25lLWZvcm0uaHRtbCc7XG5pbXBvcnQgbW9tZW50IGZyb20gJ21vbWVudC10aW1lem9uZSc7XG5pbXBvcnQge0VsZW1lbnQsIGV4Y2VwdGlvbk1zZ30gZnJvbSAnLi8uLi9lbGVtZW50L2VsZW1lbnQuanMnO1xuaW1wb3J0IGRvVCBmcm9tICdkb3QnO1xuXG5leHBvcnQge2V4Y2VwdGlvbk1zZ307XG5cbmV4cG9ydCBjb25zdCBlbGVtZW50c1F1ZXJ5ID0ge1xuICBzdWJtaXRCdXR0b246ICdidXR0b25bdHlwZT1cInN1Ym1pdFwiXScsXG4gIHNlbGVjdExpc3Q6ICcjZGRUaW1lem9uZSdcbn07XG5cbmV4cG9ydCBjbGFzcyBOZXdUaW1lem9uZUZvcm0gZXh0ZW5kcyBFbGVtZW50IHtcbiAgY29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcbiAgICBzdXBlcihjb25maWcsIGVsZW1lbnRzUXVlcnkpO1xuICAgIHRoaXMudGltZXpvbmVzID0gW107XG4gIH1cblxuICBwcmVSZW5kZXIoKSB7XG4gICAgdGhpcy5wcmVwYXJlVGltZVpvbmVMaXN0KCk7XG4gIH1cblxuICByZW5kZXIoKSB7XG4gICAgbGV0IHRlbXBGbiA9IGRvVC50ZW1wbGF0ZSh0ZW1wbGF0ZSk7XG5cbiAgICB0aGlzLmNvbmZpZy50YXJnZXRFbC5pbm5lckhUTUwgPSB0ZW1wRm4oe1xuICAgICAgdGltZXpvbmVzOiB0aGlzLnRpbWV6b25lc1xuICAgIH0pO1xuICB9XG5cbiAgcHJlcGFyZVRpbWVab25lTGlzdCgpIHtcbiAgICB0aGlzLnRpbWV6b25lcyA9IG1vbWVudC50ei5uYW1lcygpO1xuICB9XG5cbiAgYWRkTGlzdGVuZXJzKCkge1xuICAgIHRoaXMuYWRkU21hcnRMaXN0ZW5lcnMoJ3N1Ym1pdEJ1dHRvbicsICdjbGljaycsIHRoaXMuYWRkVGltZXpvbmUuYmluZCh0aGlzKSk7XG4gIH1cblxuICBhZGRUaW1lem9uZSgpIHtcbiAgICBsZXQgc2VsZWN0ZWRJbmRleCA9IHRoaXMuZG9tRWwuc2VsZWN0TGlzdC5zZWxlY3RlZEluZGV4O1xuICAgIGxldCBjdXJyZW50VmFsdWUgPSB0aGlzLmRvbUVsLnNlbGVjdExpc3Qub3B0aW9uc1tzZWxlY3RlZEluZGV4XS52YWx1ZTtcblxuICAgIGlmICh0aGlzLmNvbmZpZy5vbkFkZFRpbWV6b25lKSB7XG4gICAgICB0aGlzLmNvbmZpZy5vbkFkZFRpbWV6b25lKGN1cnJlbnRWYWx1ZSk7XG4gICAgfVxuICB9XG59XG4iLCJjbGFzcyBPYnNlcnZlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMucmVnaXN0ZXJlZCA9IFtdO1xuICB9XG5cbiAgcmVnaXN0ZXIoZm4pIHtcbiAgICB0aGlzLnJlZ2lzdGVyZWQucHVzaChmbik7XG4gIH1cblxuICB1bnJlZ2lzdGVyKGZuKSB7XG4gICAgdGhpcy5yZWdpc3RlcmVkID0gdGhpcy5yZWdpc3RlcmVkLmZpbHRlcigoaXRlbSkgPT4ge1xuICAgICAgaWYgKGl0ZW0gIT09IGZuKSB7XG4gICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG4gIH1cblxuICBmaXJlKHZhbHVlKSB7XG4gICAgdGhpcy5yZWdpc3RlcmVkLmZvckVhY2goKGZuKSA9PiB7XG4gICAgICBmbih2YWx1ZSk7XG4gICAgfSk7XG4gIH1cblxufVxuXG5leHBvcnQge09ic2VydmVyfTtcbiIsImltcG9ydCB7T2JzZXJ2ZXJ9IGZyb20gJy4vLi4vb2JzZXJ2ZXIvb2JzZXJ2ZXIuanMnO1xuaW1wb3J0IG1vbWVudCBmcm9tICdtb21lbnQtdGltZXpvbmUnO1xuXG5jbGFzcyBTdG9yZUN1cnJlbnRUaW1lIGV4dGVuZHMgT2JzZXJ2ZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMudmFsdWUgPSBtb21lbnQoKTtcbiAgfVxuXG4gIHVwZGF0ZShuZXdUaW1lKSB7XG4gICAgdGhpcy52YWx1ZSA9IG5ld1RpbWU7XG4gICAgdGhpcy5maXJlKHRoaXMudmFsdWUpO1xuICB9XG59XG5cbmV4cG9ydCB7U3RvcmVDdXJyZW50VGltZX07XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICc8YXJ0aWNsZSBjbGFzcz1cInRpbWV6b25lLWNhcmQge3s9aXQuY3NzQ2xhc3N9fVwiPlxcbicgK1xuICAgICcgIDxkaXYgY2xhc3M9XCJ0aW1lem9uZS1jYXJkX19mbGlwLWNvbnRhaW5lclwiPlxcbicgK1xuICAgICcgICAgPHNlY3Rpb24gY2xhc3M9XCJ0aW1lem9uZS1jYXJkX19mcm9udFwiPlxcbicgK1xuICAgICcgICAgICA8aDIgY2xhc3M9XCJ0aW1lem9uZS1jYXJkX190aW1lLWNvbnRhaW5lclwiPnt7PWl0LnRpbWV9fTwvaDI+XFxuJyArXG4gICAgJyAgICAgIDxoND57ez1pdC50aW1lem9uZX19PC9oND5cXG4nICtcbiAgICAnICAgICAgPGkgY2xhc3M9XCJmYSBmYS10aW1lcyBmYS0yeCB0aW1lem9uZS1jYXJkX19kZWxldGVcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48L2k+XFxuJyArXG4gICAgJyAgICA8L3NlY3Rpb24+XFxuJyArXG4gICAgJyAgICA8c2VjdGlvbiBjbGFzcz1cInRpbWV6b25lLWNhcmRfX2JhY2tcIj5cXG4nICtcbiAgICAnICAgICAgPGZvcm0gY2xhc3M9XCJ0ZXh0LWNlbnRlclwiIG5hbWU9XCJjaGFuZ2UtZGF0ZXRpbWVcIiBvbmtleXByZXNzPVwicmV0dXJuIGV2ZW50LmtleUNvZGUgIT0gMTNcIiBvblN1Ym1pdD1cInJldHVybiBmYWxzZTtcIj5cXG4nICtcbiAgICAnICAgICAgICAgIDxoMz5DaGFuZ2UgdGltZTwvaDM+XFxuJyArXG4gICAgJyAgICAgICAgICA8aW5wdXQgdHlwZT1cImRhdGVcIiBjbGFzcz1cImZvcm0tY29udHJvbCBpbnB1dC1tZFwiIHZhbHVlPVwie3s9aXQuZGF0ZUZvcm1hdH19XCIgbmFtZT1cIm5ld0RhdGVcIj5cXG4nICtcbiAgICAnICAgICAgICAgIDxpbnB1dCB0eXBlPVwidGltZVwiIGNsYXNzPVwiZm9ybS1jb250cm9sIGlucHV0LW1kXCIgdmFsdWU9XCJ7ez1pdC50aW1lRm9ybWF0fX1cIiBuYW1lPVwibmV3VGltZVwiPlxcbicgK1xuICAgICcgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJ0aW1lem9uZS1jYXJkX19iYWNrQnV0dG9uIGJ0biBidG4tZGVmYXVsdFwiPkJhY2s8L2J1dHRvbj5cXG4nICtcbiAgICAnICAgICAgICAgIDxidXR0b24gdHlwZT1cInN1Ym1pdFwiIGNsYXNzPVwiYnRuIGJ0bi1tZCBidG4tcHJpbWFyeVwiPkNoYW5nZTwvYnV0dG9uPlxcbicgK1xuICAgICcgICAgICA8L2Zvcm0+XFxuJyArXG4gICAgJyAgICA8L3NlY3Rpb24+XFxuJyArXG4gICAgJyAgPC9kaXY+XFxuJyArXG4gICAgJzwvYXJ0aWNsZT4nOyIsImltcG9ydCB0ZW1wbGF0ZSBmcm9tICcuL3RpbWV6b25lLWNhcmQuaHRtbCc7XG5pbXBvcnQgbW9tZW50IGZyb20gJ21vbWVudC10aW1lem9uZSc7XG5pbXBvcnQge1N0b3JlQ3VycmVudFRpbWV9IGZyb20gJy4vLi4vc3RvcmUtY3VycmVudC10aW1lL3N0b3JlLWN1cnJlbnQtdGltZS5qcyc7XG5pbXBvcnQge0VsZW1lbnQsIGV4Y2VwdGlvbk1zZ30gZnJvbSAnLi8uLi9lbGVtZW50L2VsZW1lbnQuanMnO1xuaW1wb3J0IGRvVCBmcm9tICdkb3QnO1xuXG5jb25zdCBleGNlcHRpb25Nc2dJbnRlcm5hbCA9IE9iamVjdC5hc3NpZ24oe30sIGV4Y2VwdGlvbk1zZywge1xuICBub1N0b3JlQ3VycmVudFRpbWU6ICdQbGVhc2UgcGFzcyBzdG9yZSBjdXJyZW50IHRpbWUgaW4gY29uZmlnJyxcbiAgd3JvbmdJbnN0YW5jZTogJ1N0b3JlIGN1cnJlbnQgdGltZSBwcm9wZXJ0eSBzaG91bGQgYmUgaW5zdGFuY2Ugb2YgU3RvcmVDdXJyZW50VGltZScsXG4gIG5vVGltZTogJ1BsZWFzZSBwYXNzIHRpbWUgdmFsdWUnLFxuICBub1RpbWVab25lOiAnUGxlYXNlIHBhc3MgdGltZXpvbmUnXG59KTtcblxuY29uc3QgZGVmYXVsdENzc0NsYXNzID0gJ2NvbC14cy0xMiBjb2wtc20tNiBjb2wtbWQtMyBjb2wtbGctMic7XG5cbmV4cG9ydCB7ZXhjZXB0aW9uTXNnSW50ZXJuYWwgYXMgZXhjZXB0aW9uTXNnfTtcblxuZXhwb3J0IGNvbnN0IGVsZW1lbnRzUXVlcnkgPSB7XG4gIGZsaXBDb250YWluZXI6ICcudGltZXpvbmUtY2FyZF9fZmxpcC1jb250YWluZXInLFxuICB0aW1lQ29udGFpbmVyOiAnLnRpbWV6b25lLWNhcmRfX3RpbWUtY29udGFpbmVyJyxcbiAgZGVsZXRlSWNvbjogJy50aW1lem9uZS1jYXJkX19kZWxldGUnLFxuICBiYWNrQnV0dG9uOiAnLnRpbWV6b25lLWNhcmRfX2JhY2tCdXR0b24nLFxuICBkYXRlSW5wdXQ6ICdpbnB1dFt0eXBlPVwiZGF0ZVwiXScsXG4gIHRpbWVJbnB1dDogJ2lucHV0W3R5cGU9XCJ0aW1lXCJdJyxcbiAgY2hhbmdlQnV0dG9uOiAnYnV0dG9uW3R5cGU9XCJzdWJtaXRcIl0nXG59O1xuXG5leHBvcnQgY2xhc3MgVGltZXpvbmVDYXJkIGV4dGVuZHMgRWxlbWVudCB7XG4gIGNvbnN0cnVjdG9yKGNvbmZpZyA9IHt9KSB7XG4gICAgc3VwZXIoY29uZmlnLCBlbGVtZW50c1F1ZXJ5KTtcbiAgfVxuXG4gIGNoZWNrQ29uZmlnKCkge1xuICAgIHN1cGVyLmNoZWNrQ29uZmlnKCk7XG4gICAgaWYgKCF0aGlzLmNvbmZpZy5zdG9yZUN1cnJlbnRUaW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXhjZXB0aW9uTXNnSW50ZXJuYWwubm9TdG9yZUN1cnJlbnRUaW1lKTtcbiAgICB9IGVsc2UgaWYgKCEodGhpcy5jb25maWcuc3RvcmVDdXJyZW50VGltZSBpbnN0YW5jZW9mIFN0b3JlQ3VycmVudFRpbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXhjZXB0aW9uTXNnSW50ZXJuYWwud3JvbmdJbnN0YW5jZSk7XG4gICAgfSBlbHNlIGlmICghdGhpcy5jb25maWcudGltZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGV4Y2VwdGlvbk1zZ0ludGVybmFsLm5vVGltZSk7XG4gICAgfSBlbHNlIGlmICghdGhpcy5jb25maWcudGltZXpvbmUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihleGNlcHRpb25Nc2dJbnRlcm5hbC5ub1RpbWVab25lKTtcbiAgICB9XG4gIH1cblxuICByZW5kZXIoKSB7XG4gICAgbGV0IHRlbXBGbiA9IGRvVC50ZW1wbGF0ZSh0ZW1wbGF0ZSk7XG4gICAgbGV0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGxldCB0YXJnZXRFbCA9IHRoaXMuY29uZmlnLnRhcmdldEVsO1xuXG4gICAgZGl2LmlubmVySFRNTCA9IHRlbXBGbih7XG4gICAgICB0aW1lOiB0aGlzLmNvbmZpZy50aW1lLmNsb25lKCkudHoodGhpcy5jb25maWcudGltZXpvbmUpLmZvcm1hdCgnbGxsJyksXG4gICAgICBkYXRlRm9ybWF0OiB0aGlzLmNvbmZpZy50aW1lLmNsb25lKCkudHoodGhpcy5jb25maWcudGltZXpvbmUpLmZvcm1hdCgnWVlZWS1NTS1ERCcpLFxuICAgICAgdGltZUZvcm1hdDogdGhpcy5jb25maWcudGltZS5jbG9uZSgpLnR6KHRoaXMuY29uZmlnLnRpbWV6b25lKS5mb3JtYXQoJ2hoOm1tJyksXG4gICAgICB0aW1lem9uZTogdGhpcy5jb25maWcudGltZXpvbmUsXG4gICAgICBjc3NDbGFzczogdGhpcy5jb25maWcuY3NzQ2xhc3MgfHwgZGVmYXVsdENzc0NsYXNzXG4gICAgfSk7XG5cbiAgICB0aGlzLmNvbmZpZy50YXJnZXRFbCA9IGRpdjtcbiAgICB0YXJnZXRFbC5hcHBlbmRDaGlsZChkaXYpO1xuICB9XG5cbiAgcG9zdCgpIHtcbiAgICBzdXBlci5wb3N0KCk7XG4gICAgdGhpcy5zdG9yZUN1cnJlbnRUaW1lID0gdGhpcy5jb25maWcuc3RvcmVDdXJyZW50VGltZTtcbiAgICB0aGlzLm9uQ3VycmVudFRpbWVDaGFuZ2UgPSB0aGlzLm9uTmV3VGltZS5iaW5kKHRoaXMpO1xuICAgIHRoaXMuc3RvcmVDdXJyZW50VGltZS5yZWdpc3Rlcih0aGlzLm9uQ3VycmVudFRpbWVDaGFuZ2UpO1xuICB9XG5cbiAgYWRkTGlzdGVuZXJzKCkge1xuICAgIHRoaXMuYWRkU21hcnRMaXN0ZW5lcnMoJ2RlbGV0ZUljb24nLCAnY2xpY2snLCB0aGlzLnJlbW92ZUVsZW1lbnQuYmluZCh0aGlzKSk7XG4gICAgdGhpcy5hZGRTbWFydExpc3RlbmVycygnY2hhbmdlQnV0dG9uJywgJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgbGV0IG5ld0RhdGVUaW1lID0gW1xuICAgICAgICB0aGlzLmRvbUVsLmRhdGVJbnB1dC52YWx1ZSxcbiAgICAgICAgdGhpcy5kb21FbC50aW1lSW5wdXQudmFsdWVcbiAgICAgIF0uam9pbignICcpO1xuICAgICAgbGV0IG5ld0RhdGVUaW1lTW9tZW50ID0gbW9tZW50LnR6KG5ld0RhdGVUaW1lLCB0aGlzLmNvbmZpZy50aW1lem9uZSk7XG5cbiAgICAgIHRoaXMuc3RvcmVDdXJyZW50VGltZS51cGRhdGUobmV3RGF0ZVRpbWVNb21lbnQpO1xuICAgIH0pO1xuICAgIHRoaXMuYWRkU21hcnRMaXN0ZW5lcnMoJ2ZsaXBDb250YWluZXInLCAnY2xpY2snLCAoZSkgPT4ge1xuICAgICAgaWYgKGUudGFyZ2V0LmNsYXNzTmFtZSA9PT0gJ3RpbWV6b25lLWNhcmRfX2Zyb250J1xuICAgICAgIHx8IGUudGFyZ2V0LmNsYXNzTmFtZSA9PT0gJ3RpbWV6b25lLWNhcmRfX2JhY2snKSB7XG4gICAgICAgIHRoaXMuZG9tRWwuZmxpcENvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCd0aW1lem9uZS1jYXJkLS1mbGlwcGVkJyk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5hZGRTbWFydExpc3RlbmVycygnYmFja0J1dHRvbicsICdjbGljaycsICgpID0+IHtcbiAgICAgIHRoaXMuZG9tRWwuZmxpcENvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCd0aW1lem9uZS1jYXJkLS1mbGlwcGVkJyk7XG4gICAgfSk7XG4gIH1cblxuICByZW1vdmVFbGVtZW50KCkge1xuICAgIHN1cGVyLnJlbW92ZUVsZW1lbnQoKTtcbiAgICB0aGlzLnN0b3JlQ3VycmVudFRpbWUudW5yZWdpc3Rlcih0aGlzLm9uQ3VycmVudFRpbWVDaGFuZ2UpO1xuICB9XG5cbiAgb25OZXdUaW1lKG5ld01vbWVudFRpbWUpIHtcbiAgICB0aGlzLnVwZGF0ZVRpbWUobmV3TW9tZW50VGltZSk7XG4gIH1cblxuICB1cGRhdGVUaW1lKHRpbWUpIHtcbiAgICB0aGlzLmNvbmZpZy50aW1lID0gdGltZS5jbG9uZSgpLnR6KHRoaXMuY29uZmlnLnRpbWV6b25lKS5mb3JtYXQoJ2xsbCcpO1xuICAgIHRoaXMuZG9tRWwudGltZUNvbnRhaW5lci5pbm5lckhUTUwgPSB0aGlzLmNvbmZpZy50aW1lO1xuICB9XG59XG4iXX0=
