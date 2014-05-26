"use strict";
(function() {

Error.stackTraceLimit = -1;

var go$global;
if (typeof window !== "undefined") {
	go$global = window;
} else if (typeof GLOBAL !== "undefined") {
	go$global = GLOBAL;
	go$global.require = require;
}

var go$idCounter = 0;
var go$keys = function(m) { return m ? Object.keys(m) : []; };
var go$min = Math.min;
var go$parseInt = parseInt;
var go$parseFloat = function(f) {
	if (f.constructor === Number) {
		return f;
	}
	return parseFloat(f);
};
var go$mod = function(x, y) { return x % y; };
var go$toString = String;
var go$reflect, go$newStringPtr;
var Go$Array = Array;

var go$floatKey = function(f) {
	if (f !== f) {
		go$idCounter++;
		return "NaN$" + go$idCounter;
	}
	return String(f);
};

var go$mapArray = function(array, f) {
	var newArray = new array.constructor(array.length), i;
	for (i = 0; i < array.length; i++) {
		newArray[i] = f(array[i]);
	}
	return newArray;
};

var go$newType = function(size, kind, string, name, pkgPath, constructor) {
	var typ;
	switch(kind) {
	case "Bool":
	case "Int":
	case "Int8":
	case "Int16":
	case "Int32":
	case "Uint":
	case "Uint8" :
	case "Uint16":
	case "Uint32":
	case "Uintptr":
	case "String":
	case "UnsafePointer":
		typ = function(v) { this.go$val = v; };
		typ.prototype.go$key = function() { return string + "$" + this.go$val; };
		break;

	case "Float32":
	case "Float64":
		typ = function(v) { this.go$val = v; };
		typ.prototype.go$key = function() { return string + "$" + go$floatKey(this.go$val); };
		break;

	case "Int64":
		typ = function(high, low) {
			this.high = (high + Math.floor(Math.ceil(low) / 4294967296)) >> 0;
			this.low = low >>> 0;
			this.go$val = this;
		};
		typ.prototype.go$key = function() { return string + "$" + this.high + "$" + this.low; };
		break;

	case "Uint64":
		typ = function(high, low) {
			this.high = (high + Math.floor(Math.ceil(low) / 4294967296)) >>> 0;
			this.low = low >>> 0;
			this.go$val = this;
		};
		typ.prototype.go$key = function() { return string + "$" + this.high + "$" + this.low; };
		break;

	case "Complex64":
	case "Complex128":
		typ = function(real, imag) {
			this.real = real;
			this.imag = imag;
			this.go$val = this;
		};
		typ.prototype.go$key = function() { return string + "$" + this.real + "$" + this.imag; };
		break;

	case "Array":
		typ = function(v) { this.go$val = v; };
		typ.Ptr = go$newType(4, "Ptr", "*" + string, "", "", function(array) {
			this.go$get = function() { return array; };
			this.go$val = array;
		});
		typ.init = function(elem, len) {
			typ.elem = elem;
			typ.len = len;
			typ.prototype.go$key = function() {
				return string + "$" + Array.prototype.join.call(go$mapArray(this.go$val, function(e) {
					var key = e.go$key ? e.go$key() : String(e);
					return key.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
				}), "$");
			};
			typ.extendReflectType = function(rt) {
				rt.arrayType = new go$reflect.arrayType.Ptr(rt, elem.reflectType(), undefined, len);
			};
			typ.Ptr.init(typ);
		};
		break;

	case "Chan":
		typ = function() { this.go$val = this; };
		typ.prototype.go$key = function() {
			if (this.go$id === undefined) {
				go$idCounter++;
				this.go$id = go$idCounter;
			}
			return String(this.go$id);
		};
		typ.init = function(elem, sendOnly, recvOnly) {
			typ.nil = new typ();
			typ.extendReflectType = function(rt) {
				rt.chanType = new go$reflect.chanType.Ptr(rt, elem.reflectType(), sendOnly ? go$reflect.SendDir : (recvOnly ? go$reflect.RecvDir : go$reflect.BothDir));
			};
		};
		break;

	case "Func":
		typ = function(v) { this.go$val = v; };
		typ.init = function(params, results, variadic) {
			typ.params = params;
			typ.results = results;
			typ.variadic = variadic;
			typ.extendReflectType = function(rt) {
				var typeSlice = (go$sliceType(go$ptrType(go$reflect.rtype.Ptr)));
				rt.funcType = new go$reflect.funcType.Ptr(rt, variadic, new typeSlice(go$mapArray(params, function(p) { return p.reflectType(); })), new typeSlice(go$mapArray(results, function(p) { return p.reflectType(); })));
			};
		};
		break;

	case "Interface":
		typ = { implementedBy: [] };
		typ.init = function(methods) {
			typ.extendReflectType = function(rt) {
				var imethods = go$mapArray(methods, function(m) {
					return new go$reflect.imethod.Ptr(go$newStringPtr(m[0]), go$newStringPtr(m[1]), m[2].reflectType());
				});
				var methodSlice = (go$sliceType(go$ptrType(go$reflect.imethod.Ptr)));
				rt.interfaceType = new go$reflect.interfaceType.Ptr(rt, new methodSlice(imethods));
			};
		};
		break;

	case "Map":
		typ = function(v) { this.go$val = v; };
		typ.init = function(key, elem) {
			typ.key = key;
			typ.elem = elem;
			typ.extendReflectType = function(rt) {
				rt.mapType = new go$reflect.mapType.Ptr(rt, key.reflectType(), elem.reflectType(), undefined, undefined);
			};
		};
		break;

	case "Ptr":
		typ = constructor || function(getter, setter) {
			this.go$get = getter;
			this.go$set = setter;
			this.go$val = this;
		};
		typ.prototype.go$key = function() {
			if (this.go$id === undefined) {
				go$idCounter++;
				this.go$id = go$idCounter;
			}
			return String(this.go$id);
		};
		typ.init = function(elem) {
			typ.nil = new typ(go$throwNilPointerError, go$throwNilPointerError);
			typ.extendReflectType = function(rt) {
				rt.ptrType = new go$reflect.ptrType.Ptr(rt, elem.reflectType());
			};
		};
		break;

	case "Slice":
		var nativeArray;
		typ = function(array) {
			if (array.constructor !== nativeArray) {
				array = new nativeArray(array);
			}
			this.array = array;
			this.offset = 0;
			this.length = array.length;
			this.capacity = array.length;
			this.go$val = this;
		};
		typ.make = function(length, capacity, zero) {
			capacity = capacity || length;
			var array = new nativeArray(capacity), i;
			for (i = 0; i < capacity; i++) {
				array[i] = zero();
			}
			var slice = new typ(array);
			slice.length = length;
			return slice;
		};
		typ.init = function(elem) {
			typ.elem = elem;
			nativeArray = go$nativeArray(elem.kind);
			typ.nil = new typ([]);
			typ.extendReflectType = function(rt) {
				rt.sliceType = new go$reflect.sliceType.Ptr(rt, elem.reflectType());
			};
		};
		break;

	case "Struct":
		typ = function(v) { this.go$val = v; };
		typ.Ptr = go$newType(4, "Ptr", "*" + string, "", "", constructor);
		typ.Ptr.Struct = typ;
		typ.init = function(fields) {
			var i;
			typ.fields = fields;
			typ.Ptr.init(typ);
			// nil value
			typ.Ptr.nil = new constructor();
			for (i = 0; i < fields.length; i++) {
				var field = fields[i];
				Object.defineProperty(typ.Ptr.nil, field[1], { get: go$throwNilPointerError, set: go$throwNilPointerError });
			}
			// methods for embedded fields
			for (i = 0; i < typ.methods.length; i++) {
				var method = typ.methods[i];
				if (method[6] != -1) {
					(function(field, methodName) {
						typ.prototype[methodName] = function() {
							var v = this.go$val[field[0]];
							return v[methodName].apply(v, arguments);
						};
					})(fields[method[6]], method[0]);
				}
			}
			for (i = 0; i < typ.Ptr.methods.length; i++) {
				var method = typ.Ptr.methods[i];
				if (method[6] != -1) {
					(function(field, methodName) {
						typ.Ptr.prototype[methodName] = function() {
							var v = this[field[0]];
							if (v.go$val === undefined) {
								v = new field[3](v);
							}
							return v[methodName].apply(v, arguments);
						};
					})(fields[method[6]], method[0]);
				}
			}
			// map key
			typ.prototype.go$key = function() {
				var keys = new Array(fields.length);
				for (i = 0; i < fields.length; i++) {
					var v = this.go$val[fields[i][0]];
					var key = v.go$key ? v.go$key() : String(v);
					keys[i] = key.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
				}
				return string + "$" + keys.join("$");
			};
			// reflect type
			typ.extendReflectType = function(rt) {
				var reflectFields = new Array(fields.length), i;
				for (i = 0; i < fields.length; i++) {
					var field = fields[i];
					reflectFields[i] = new go$reflect.structField.Ptr(go$newStringPtr(field[1]), go$newStringPtr(field[2]), field[3].reflectType(), go$newStringPtr(field[4]), i);
				}
				rt.structType = new go$reflect.structType.Ptr(rt, new (go$sliceType(go$reflect.structField.Ptr))(reflectFields));
			};
		};
		break;

	default:
		throw go$panic(new Go$String("invalid kind: " + kind));
	}

	typ.kind = kind;
	typ.string = string;
	typ.typeName = name;
	typ.pkgPath = pkgPath;
	typ.methods = [];
	var rt = null;
	typ.reflectType = function() {
		if (rt === null) {
			rt = new go$reflect.rtype.Ptr(size, 0, 0, 0, 0, go$reflect.kinds[kind], undefined, undefined, go$newStringPtr(string), undefined, undefined);
			rt.jsType = typ;

			var methods = [];
			if (typ.methods !== undefined) {
				var i;
				for (i = 0; i < typ.methods.length; i++) {
					var m = typ.methods[i];
					methods.push(new go$reflect.method.Ptr(go$newStringPtr(m[1]), go$newStringPtr(m[2]), go$funcType(m[3], m[4], m[5]).reflectType(), go$funcType([typ].concat(m[3]), m[4], m[5]).reflectType(), undefined, undefined));
				}
			}
			if (name !== "" || methods.length !== 0) {
				var methodSlice = (go$sliceType(go$ptrType(go$reflect.method.Ptr)));
				rt.uncommonType = new go$reflect.uncommonType.Ptr(go$newStringPtr(name), go$newStringPtr(pkgPath), new methodSlice(methods));
				rt.uncommonType.jsType = typ;
			}

			if (typ.extendReflectType !== undefined) {
				typ.extendReflectType(rt);
			}
		}
		return rt;
	};
	return typ;
};

var Go$Bool          = go$newType( 1, "Bool",          "bool",           "bool",       "", null);
var Go$Int           = go$newType( 4, "Int",           "int",            "int",        "", null);
var Go$Int8          = go$newType( 1, "Int8",          "int8",           "int8",       "", null);
var Go$Int16         = go$newType( 2, "Int16",         "int16",          "int16",      "", null);
var Go$Int32         = go$newType( 4, "Int32",         "int32",          "int32",      "", null);
var Go$Int64         = go$newType( 8, "Int64",         "int64",          "int64",      "", null);
var Go$Uint          = go$newType( 4, "Uint",          "uint",           "uint",       "", null);
var Go$Uint8         = go$newType( 1, "Uint8",         "uint8",          "uint8",      "", null);
var Go$Uint16        = go$newType( 2, "Uint16",        "uint16",         "uint16",     "", null);
var Go$Uint32        = go$newType( 4, "Uint32",        "uint32",         "uint32",     "", null);
var Go$Uint64        = go$newType( 8, "Uint64",        "uint64",         "uint64",     "", null);
var Go$Uintptr       = go$newType( 4, "Uintptr",       "uintptr",        "uintptr",    "", null);
var Go$Float32       = go$newType( 4, "Float32",       "float32",        "float32",    "", null);
var Go$Float64       = go$newType( 8, "Float64",       "float64",        "float64",    "", null);
var Go$Complex64     = go$newType( 8, "Complex64",     "complex64",      "complex64",  "", null);
var Go$Complex128    = go$newType(16, "Complex128",    "complex128",     "complex128", "", null);
var Go$String        = go$newType( 8, "String",        "string",         "string",     "", null);
var Go$UnsafePointer = go$newType( 4, "UnsafePointer", "unsafe.Pointer", "Pointer",    "", null);

var go$nativeArray = function(elemKind) {
	return ({ Int: Int32Array, Int8: Int8Array, Int16: Int16Array, Int32: Int32Array, Uint: Uint32Array, Uint8: Uint8Array, Uint16: Uint16Array, Uint32: Uint32Array, Uintptr: Uint32Array, Float32: Float32Array, Float64: Float64Array })[elemKind] || Array;
};
var go$toNativeArray = function(elemKind, array) {
	var nativeArray = go$nativeArray(elemKind);
	if (nativeArray === Array) {
		return array;
	}
	return new nativeArray(array);
};
var go$makeNativeArray = function(elemKind, length, zero) {
	var array = new (go$nativeArray(elemKind))(length), i;
	for (i = 0; i < length; i++) {
		array[i] = zero();
	}
	return array;
};
var go$arrayTypes = {};
var go$arrayType = function(elem, len) {
	var string = "[" + len + "]" + elem.string;
	var typ = go$arrayTypes[string];
	if (typ === undefined) {
		typ = go$newType(12, "Array", string, "", "", null);
		typ.init(elem, len);
		go$arrayTypes[string] = typ;
	}
	return typ;
};

var go$chanType = function(elem, sendOnly, recvOnly) {
	var string = (recvOnly ? "<-" : "") + "chan" + (sendOnly ? "<- " : " ") + elem.string;
	var field = sendOnly ? "SendChan" : (recvOnly ? "RecvChan" : "Chan");
	var typ = elem[field];
	if (typ === undefined) {
		typ = go$newType(4, "Chan", string, "", "", null);
		typ.init(elem, sendOnly, recvOnly);
		elem[field] = typ;
	}
	return typ;
};

var go$funcTypes = {};
var go$funcType = function(params, results, variadic) {
	var paramTypes = go$mapArray(params, function(p) { return p.string; });
	if (variadic) {
		paramTypes[paramTypes.length - 1] = "..." + paramTypes[paramTypes.length - 1].substr(2);
	}
	var string = "func(" + paramTypes.join(", ") + ")";
	if (results.length === 1) {
		string += " " + results[0].string;
	} else if (results.length > 1) {
		string += " (" + go$mapArray(results, function(r) { return r.string; }).join(", ") + ")";
	}
	var typ = go$funcTypes[string];
	if (typ === undefined) {
		typ = go$newType(4, "Func", string, "", "", null);
		typ.init(params, results, variadic);
		go$funcTypes[string] = typ;
	}
	return typ;
};

var go$interfaceTypes = {};
var go$interfaceType = function(methods) {
	var string = "interface {}";
	if (methods.length !== 0) {
		string = "interface { " + go$mapArray(methods, function(m) {
			return (m[1] !== "" ? m[1] + "." : "") + m[0] + m[2].string.substr(4);
		}).join("; ") + " }";
	}
	var typ = go$interfaceTypes[string];
	if (typ === undefined) {
		typ = go$newType(8, "Interface", string, "", "", null);
		typ.init(methods);
		go$interfaceTypes[string] = typ;
	}
	return typ;
};
var go$emptyInterface = go$interfaceType([]);
var go$interfaceNil = { go$key: function() { return "nil"; } };
var go$error = go$newType(8, "Interface", "error", "error", "", null);
go$error.init([["Error", "", go$funcType([], [Go$String], false)]]);

var Go$Map = function() {};
(function() {
	var names = Object.getOwnPropertyNames(Object.prototype), i;
	for (i = 0; i < names.length; i++) {
		Go$Map.prototype[names[i]] = undefined;
	}
})();
var go$mapTypes = {};
var go$mapType = function(key, elem) {
	var string = "map[" + key.string + "]" + elem.string;
	var typ = go$mapTypes[string];
	if (typ === undefined) {
		typ = go$newType(4, "Map", string, "", "", null);
		typ.init(key, elem);
		go$mapTypes[string] = typ;
	}
	return typ;
};

var go$throwNilPointerError = function() { go$throwRuntimeError("invalid memory address or nil pointer dereference"); };
var go$ptrType = function(elem) {
	var typ = elem.Ptr;
	if (typ === undefined) {
		typ = go$newType(4, "Ptr", "*" + elem.string, "", "", null);
		typ.init(elem);
		elem.Ptr = typ;
	}
	return typ;
};

var go$sliceType = function(elem) {
	var typ = elem.Slice;
	if (typ === undefined) {
		typ = go$newType(12, "Slice", "[]" + elem.string, "", "", null);
		typ.init(elem);
		elem.Slice = typ;
	}
	return typ;
};

var go$structTypes = {};
var go$structType = function(fields) {
	var string = "struct { " + go$mapArray(fields, function(f) {
		return f[1] + " " + f[3].string + (f[4] !== "" ? (' "' + f[4].replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"') : "");
	}).join("; ") + " }";
	var typ = go$structTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Struct", string, "", "", function() {
			this.go$val = this;
			var i;
			for (i = 0; i < fields.length; i++) {
				this[fields[i][0]] = arguments[i];
			}
		});
		typ.init(fields);
		go$structTypes[string] = typ;
	}
	return typ;
};

var go$stringPtrMap = new Go$Map();
go$newStringPtr = function(str) {
	if (str === undefined || str === "") {
		return go$ptrType(Go$String).nil;
	}
	var ptr = go$stringPtrMap[str];
	if (ptr === undefined) {
		ptr = new (go$ptrType(Go$String))(function() { return str; }, function(v) { str = v; });
		go$stringPtrMap[str] = ptr;
	}
	return ptr;
};
var go$newDataPointer = function(data, constructor) {
	return new constructor(function() { return data; }, function(v) { data = v; });
};

var go$coerceFloat32 = function(f) {
	var math = go$packages["math"];
	if (math === undefined) {
		return f;
	}
	return math.Float32frombits(math.Float32bits(f));
};
var go$flatten64 = function(x) {
	return x.high * 4294967296 + x.low;
};
var go$shiftLeft64 = function(x, y) {
	if (y === 0) {
		return x;
	}
	if (y < 32) {
		return new x.constructor(x.high << y | x.low >>> (32 - y), (x.low << y) >>> 0);
	}
	if (y < 64) {
		return new x.constructor(x.low << (y - 32), 0);
	}
	return new x.constructor(0, 0);
};
var go$shiftRightInt64 = function(x, y) {
	if (y === 0) {
		return x;
	}
	if (y < 32) {
		return new x.constructor(x.high >> y, (x.low >>> y | x.high << (32 - y)) >>> 0);
	}
	if (y < 64) {
		return new x.constructor(x.high >> 31, (x.high >> (y - 32)) >>> 0);
	}
	if (x.high < 0) {
		return new x.constructor(-1, 4294967295);
	}
	return new x.constructor(0, 0);
};
var go$shiftRightUint64 = function(x, y) {
	if (y === 0) {
		return x;
	}
	if (y < 32) {
		return new x.constructor(x.high >>> y, (x.low >>> y | x.high << (32 - y)) >>> 0);
	}
	if (y < 64) {
		return new x.constructor(0, x.high >>> (y - 32));
	}
	return new x.constructor(0, 0);
};
var go$mul64 = function(x, y) {
	var high = 0, low = 0, i;
	if ((y.low & 1) !== 0) {
		high = x.high;
		low = x.low;
	}
	for (i = 1; i < 32; i++) {
		if ((y.low & 1<<i) !== 0) {
			high += x.high << i | x.low >>> (32 - i);
			low += (x.low << i) >>> 0;
		}
	}
	for (i = 0; i < 32; i++) {
		if ((y.high & 1<<i) !== 0) {
			high += x.low << i;
		}
	}
	return new x.constructor(high, low);
};
var go$div64 = function(x, y, returnRemainder) {
	if (y.high === 0 && y.low === 0) {
		go$throwRuntimeError("integer divide by zero");
	}

	var s = 1;
	var rs = 1;

	var xHigh = x.high;
	var xLow = x.low;
	if (xHigh < 0) {
		s = -1;
		rs = -1;
		xHigh = -xHigh;
		if (xLow !== 0) {
			xHigh--;
			xLow = 4294967296 - xLow;
		}
	}

	var yHigh = y.high;
	var yLow = y.low;
	if (y.high < 0) {
		s *= -1;
		yHigh = -yHigh;
		if (yLow !== 0) {
			yHigh--;
			yLow = 4294967296 - yLow;
		}
	}

	var high = 0, low = 0, n = 0, i;
	while (yHigh < 2147483648 && ((xHigh > yHigh) || (xHigh === yHigh && xLow > yLow))) {
		yHigh = (yHigh << 1 | yLow >>> 31) >>> 0;
		yLow = (yLow << 1) >>> 0;
		n++;
	}
	for (i = 0; i <= n; i++) {
		high = high << 1 | low >>> 31;
		low = (low << 1) >>> 0;
		if ((xHigh > yHigh) || (xHigh === yHigh && xLow >= yLow)) {
			xHigh = xHigh - yHigh;
			xLow = xLow - yLow;
			if (xLow < 0) {
				xHigh--;
				xLow += 4294967296;
			}
			low++;
			if (low === 4294967296) {
				high++;
				low = 0;
			}
		}
		yLow = (yLow >>> 1 | yHigh << (32 - 1)) >>> 0;
		yHigh = yHigh >>> 1;
	}

	if (returnRemainder) {
		return new x.constructor(xHigh * rs, xLow * rs);
	}
	return new x.constructor(high * s, low * s);
};

var go$divComplex = function(n, d) {
	var ninf = n.real === 1/0 || n.real === -1/0 || n.imag === 1/0 || n.imag === -1/0;
	var dinf = d.real === 1/0 || d.real === -1/0 || d.imag === 1/0 || d.imag === -1/0;
	var nnan = !ninf && (n.real !== n.real || n.imag !== n.imag);
	var dnan = !dinf && (d.real !== d.real || d.imag !== d.imag);
	if(nnan || dnan) {
		return new n.constructor(0/0, 0/0);
	}
	if (ninf && !dinf) {
		return new n.constructor(1/0, 1/0);
	}
	if (!ninf && dinf) {
		return new n.constructor(0, 0);
	}
	if (d.real === 0 && d.imag === 0) {
		if (n.real === 0 && n.imag === 0) {
			return new n.constructor(0/0, 0/0);
		}
		return new n.constructor(1/0, 1/0);
	}
	var a = Math.abs(d.real);
	var b = Math.abs(d.imag);
	if (a <= b) {
		var ratio = d.real / d.imag;
		var denom = d.real * ratio + d.imag;
		return new n.constructor((n.real * ratio + n.imag) / denom, (n.imag * ratio - n.real) / denom);
	}
	var ratio = d.imag / d.real;
	var denom = d.imag * ratio + d.real;
	return new n.constructor((n.imag * ratio + n.real) / denom, (n.imag - n.real * ratio) / denom);
};

var go$subslice = function(slice, low, high, max) {
	if (low < 0 || high < low || max < high || high > slice.capacity || max > slice.capacity) {
		go$throwRuntimeError("slice bounds out of range");
	}
	var s = new slice.constructor(slice.array);
	s.offset = slice.offset + low;
	s.length = slice.length - low;
	s.capacity = slice.capacity - low;
	if (high !== undefined) {
		s.length = high - low;
	}
	if (max !== undefined) {
		s.capacity = max - low;
	}
	return s;
};

var go$sliceToArray = function(slice) {
	if (slice.length === 0) {
		return [];
	}
	if (slice.array.constructor !== Array) {
		return slice.array.subarray(slice.offset, slice.offset + slice.length);
	}
	return slice.array.slice(slice.offset, slice.offset + slice.length);
};

var go$decodeRune = function(str, pos) {
	var c0 = str.charCodeAt(pos);

	if (c0 < 0x80) {
		return [c0, 1];
	}

	if (c0 !== c0 || c0 < 0xC0) {
		return [0xFFFD, 1];
	}

	var c1 = str.charCodeAt(pos + 1);
	if (c1 !== c1 || c1 < 0x80 || 0xC0 <= c1) {
		return [0xFFFD, 1];
	}

	if (c0 < 0xE0) {
		var r = (c0 & 0x1F) << 6 | (c1 & 0x3F);
		if (r <= 0x7F) {
			return [0xFFFD, 1];
		}
		return [r, 2];
	}

	var c2 = str.charCodeAt(pos + 2);
	if (c2 !== c2 || c2 < 0x80 || 0xC0 <= c2) {
		return [0xFFFD, 1];
	}

	if (c0 < 0xF0) {
		var r = (c0 & 0x0F) << 12 | (c1 & 0x3F) << 6 | (c2 & 0x3F);
		if (r <= 0x7FF) {
			return [0xFFFD, 1];
		}
		if (0xD800 <= r && r <= 0xDFFF) {
			return [0xFFFD, 1];
		}
		return [r, 3];
	}

	var c3 = str.charCodeAt(pos + 3);
	if (c3 !== c3 || c3 < 0x80 || 0xC0 <= c3) {
		return [0xFFFD, 1];
	}

	if (c0 < 0xF8) {
		var r = (c0 & 0x07) << 18 | (c1 & 0x3F) << 12 | (c2 & 0x3F) << 6 | (c3 & 0x3F);
		if (r <= 0xFFFF || 0x10FFFF < r) {
			return [0xFFFD, 1];
		}
		return [r, 4];
	}

	return [0xFFFD, 1];
};

var go$encodeRune = function(r) {
	if (r < 0 || r > 0x10FFFF || (0xD800 <= r && r <= 0xDFFF)) {
		r = 0xFFFD;
	}
	if (r <= 0x7F) {
		return String.fromCharCode(r);
	}
	if (r <= 0x7FF) {
		return String.fromCharCode(0xC0 | r >> 6, 0x80 | (r & 0x3F));
	}
	if (r <= 0xFFFF) {
		return String.fromCharCode(0xE0 | r >> 12, 0x80 | (r >> 6 & 0x3F), 0x80 | (r & 0x3F));
	}
	return String.fromCharCode(0xF0 | r >> 18, 0x80 | (r >> 12 & 0x3F), 0x80 | (r >> 6 & 0x3F), 0x80 | (r & 0x3F));
};

var go$stringToBytes = function(str, terminateWithNull) {
	var array = new Uint8Array(terminateWithNull ? str.length + 1 : str.length), i;
	for (i = 0; i < str.length; i++) {
		array[i] = str.charCodeAt(i);
	}
	if (terminateWithNull) {
		array[str.length] = 0;
	}
	return array;
};

var go$bytesToString = function(slice) {
	if (slice.length === 0) {
		return "";
	}
	var str = "", i;
	for (i = 0; i < slice.length; i += 10000) {
		str += String.fromCharCode.apply(null, slice.array.subarray(slice.offset + i, slice.offset + Math.min(slice.length, i + 10000)));
	}
	return str;
};

var go$stringToRunes = function(str) {
	var array = new Int32Array(str.length);
	var rune, i, j = 0;
	for (i = 0; i < str.length; i += rune[1], j++) {
		rune = go$decodeRune(str, i);
		array[j] = rune[0];
	}
	return array.subarray(0, j);
};

var go$runesToString = function(slice) {
	if (slice.length === 0) {
		return "";
	}
	var str = "", i;
	for (i = 0; i < slice.length; i++) {
		str += go$encodeRune(slice.array[slice.offset + i]);
	}
	return str;
};

var go$needsExternalization = function(t) {
	switch (t.kind) {
		case "Int64":
		case "Uint64":
		case "Array":
		case "Func":
		case "Map":
		case "Slice":
		case "String":
			return true;
		case "Interface":
			return t !== go$packages["github.com/gopherjs/gopherjs/js"].Object;
		default:
			return false;
	}
};

var go$externalize = function(v, t) {
	switch (t.kind) {
	case "Int64":
	case "Uint64":
		return go$flatten64(v);
	case "Array":
		if (go$needsExternalization(t.elem)) {
			return go$mapArray(v, function(e) { return go$externalize(e, t.elem); });
		}
		return v;
	case "Func":
		if (v === go$throwNilPointerError) {
			return null;
		}
		var convert = false;
		var i;
		for (i = 0; i < t.params.length; i++) {
			convert = convert || (t.params[i] !== go$packages["github.com/gopherjs/gopherjs/js"].Object);
		}
		for (i = 0; i < t.results.length; i++) {
			convert = convert || go$needsExternalization(t.results[i]);
		}
		if (!convert) {
			return v;
		}
		return function() {
			var args = [], i;
			for (i = 0; i < t.params.length; i++) {
				if (t.variadic && i === t.params.length - 1) {
					var vt = t.params[i].elem, varargs = [], j;
					for (j = i; j < arguments.length; j++) {
						varargs.push(go$internalize(arguments[j], vt));
					}
					args.push(new (t.params[i])(varargs));
					break;
				}
				args.push(go$internalize(arguments[i], t.params[i]));
			}
			var result = v.apply(undefined, args);
			switch (t.results.length) {
			case 0:
				return;
			case 1:
				return go$externalize(result, t.results[0]);
			default:
				for (i = 0; i < t.results.length; i++) {
					result[i] = go$externalize(result[i], t.results[i]);
				}
				return result;
			}
		};
	case "Interface":
		if (v === null) {
			return null;
		}
		if (t === go$packages["github.com/gopherjs/gopherjs/js"].Object || v.constructor.kind === undefined) {
			return v;
		}
		return go$externalize(v.go$val, v.constructor);
	case "Map":
		var m = {};
		var keys = go$keys(v), i;
		for (i = 0; i < keys.length; i++) {
			var entry = v[keys[i]];
			m[go$externalize(entry.k, t.key)] = go$externalize(entry.v, t.elem);
		}
		return m;
	case "Slice":
		if (go$needsExternalization(t.elem)) {
			return go$mapArray(go$sliceToArray(v), function(e) { return go$externalize(e, t.elem); });
		}
		return go$sliceToArray(v);
	case "String":
		var s = "", r, i, j = 0;
		for (i = 0; i < v.length; i += r[1], j++) {
			r = go$decodeRune(v, i);
			s += String.fromCharCode(r[0]);
		}
		return s;
	case "Struct":
		var timePkg = go$packages["time"];
		if (timePkg && v.constructor === timePkg.Time.Ptr) {
			var milli = go$div64(v.UnixNano(), new Go$Int64(0, 1000000));
			return new Date(go$flatten64(milli));
		}
		return v;
	default:
		return v;
	}
};

var go$internalize = function(v, t, recv) {
	switch (t.kind) {
	case "Bool":
		return !!v;
	case "Int":
		return parseInt(v);
	case "Int8":
		return parseInt(v) << 24 >> 24;
	case "Int16":
		return parseInt(v) << 16 >> 16;
	case "Int32":
		return parseInt(v) >> 0;
	case "Uint":
		return parseInt(v);
	case "Uint8" :
		return parseInt(v) << 24 >>> 24;
	case "Uint16":
		return parseInt(v) << 16 >>> 16;
	case "Uint32":
	case "Uintptr":
		return parseInt(v) >>> 0;
	case "Int64":
	case "Uint64":
		return new t(0, v);
	case "Float32":
	case "Float64":
		return parseFloat(v);
	case "Array":
		if (v.length !== t.len) {
			go$throwRuntimeError("got array with wrong size from JavaScript native");
		}
		return go$mapArray(v, function(e) { return go$internalize(e, t.elem); });
	case "Func":
		return function() {
			var args = [], i;
			for (i = 0; i < t.params.length; i++) {
				if (t.variadic && i === t.params.length - 1) {
					var vt = t.params[i].elem, varargs = arguments[i], j;
					for (j = 0; j < varargs.length; j++) {
						args.push(go$externalize(varargs.array[varargs.offset + j], vt));
					}
					break;
				}
				args.push(go$externalize(arguments[i], t.params[i]));
			}
			var result = v.apply(recv, args);
			switch (t.results.length) {
			case 0:
				return;
			case 1:
				return go$internalize(result, t.results[0]);
			default:
				for (i = 0; i < t.results.length; i++) {
					result[i] = go$internalize(result[i], t.results[i]);
				}
				return result;
			}
		};
	case "Interface":
		if (v === null || t === go$packages["github.com/gopherjs/gopherjs/js"].Object) {
			return v;
		}
		switch (v.constructor) {
		case Int8Array:
			return new (go$sliceType(Go$Int8))(v);
		case Int16Array:
			return new (go$sliceType(Go$Int16))(v);
		case Int32Array:
			return new (go$sliceType(Go$Int))(v);
		case Uint8Array:
			return new (go$sliceType(Go$Uint8))(v);
		case Uint16Array:
			return new (go$sliceType(Go$Uint16))(v);
		case Uint32Array:
			return new (go$sliceType(Go$Uint))(v);
		case Float32Array:
			return new (go$sliceType(Go$Float32))(v);
		case Float64Array:
			return new (go$sliceType(Go$Float64))(v);
		case Array:
			return go$internalize(v, go$sliceType(go$emptyInterface));
		case Boolean:
			return new Go$Bool(!!v);
		case Date:
			var timePkg = go$packages["time"];
			if (timePkg) {
				return new timePkg.Time(timePkg.Unix(new Go$Int64(0, 0), new Go$Int64(0, v.getTime() * 1000000)));
			}
		case Function:
			var funcType = go$funcType([go$sliceType(go$emptyInterface)], [go$packages["github.com/gopherjs/gopherjs/js"].Object], true);
			return new funcType(go$internalize(v, funcType));
		case Number:
			return new Go$Float64(parseFloat(v));
		case Object:
			var mapType = go$mapType(Go$String, go$emptyInterface);
			return new mapType(go$internalize(v, mapType));
		case String:
			return new Go$String(go$internalize(v, Go$String));
		}
		return v;
	case "Map":
		var m = new Go$Map();
		var keys = go$keys(v), i;
		for (i = 0; i < keys.length; i++) {
			var key = go$internalize(keys[i], t.key);
			m[key.go$key ? key.go$key() : key] = { k: key, v: go$internalize(v[keys[i]], t.elem) };
		}
		return m;
	case "Slice":
		return new t(go$mapArray(v, function(e) { return go$internalize(e, t.elem); }));
	case "String":
		v = String(v);
		var s = "", i;
		for (i = 0; i < v.length; i++) {
			s += go$encodeRune(v.charCodeAt(i));
		}
		return s;
	default:
		return v;
	}
};

var go$copySlice = function(dst, src) {
	var n = Math.min(src.length, dst.length), i;
	if (dst.array.constructor !== Array && n !== 0) {
		dst.array.set(src.array.subarray(src.offset, src.offset + n), dst.offset);
		return n;
	}
	for (i = 0; i < n; i++) {
		dst.array[dst.offset + i] = src.array[src.offset + i];
	}
	return n;
};

var go$copyString = function(dst, src) {
	var n = Math.min(src.length, dst.length), i;
	for (i = 0; i < n; i++) {
		dst.array[dst.offset + i] = src.charCodeAt(i);
	}
	return n;
};

var go$copyArray = function(dst, src) {
	var i;
	for (i = 0; i < src.length; i++) {
		dst[i] = src[i];
	}
};

var go$growSlice = function(slice, length) {
	var newCapacity = Math.max(length, slice.capacity < 1024 ? slice.capacity * 2 : Math.floor(slice.capacity * 5 / 4));

	var newArray;
	if (slice.array.constructor === Array) {
		newArray = slice.array;
		if (slice.offset !== 0 || newArray.length !== slice.offset + slice.capacity) {
			newArray = newArray.slice(slice.offset);
		}
		newArray.length = newCapacity;
	} else {
		newArray = new slice.array.constructor(newCapacity);
		newArray.set(slice.array.subarray(slice.offset));
	}

	var newSlice = new slice.constructor(newArray);
	newSlice.length = slice.length;
	newSlice.capacity = newCapacity;
	return newSlice;
};

var go$append = function(slice) {
	if (arguments.length === 1) {
		return slice;
	}

	var newLength = slice.length + arguments.length - 1;
	if (newLength > slice.capacity) {
		slice = go$growSlice(slice, newLength);
	}

	var array = slice.array;
	var leftOffset = slice.offset + slice.length - 1, i;
	for (i = 1; i < arguments.length; i++) {
		array[leftOffset + i] = arguments[i];
	}

	var newSlice = new slice.constructor(array);
	newSlice.offset = slice.offset;
	newSlice.length = newLength;
	newSlice.capacity = slice.capacity;
	return newSlice;
};

var go$appendSlice = function(slice, toAppend) {
	if (toAppend.length === 0) {
		return slice;
	}

	var newLength = slice.length + toAppend.length;
	if (newLength > slice.capacity) {
		slice = go$growSlice(slice, newLength);
	}

	var array = slice.array;
	var leftOffset = slice.offset + slice.length, rightOffset = toAppend.offset, i;
	for (i = 0; i < toAppend.length; i++) {
		array[leftOffset + i] = toAppend.array[rightOffset + i];
	}

	var newSlice = new slice.constructor(array);
	newSlice.offset = slice.offset;
	newSlice.length = newLength;
	newSlice.capacity = slice.capacity;
	return newSlice;
};

var go$panic = function(value) {
	var message;
	if (value.constructor === Go$String) {
		message = value.go$val;
	} else if (value.Error !== undefined) {
		message = value.Error();
	} else if (value.String !== undefined) {
		message = value.String();
	} else {
		message = value;
	}
	var err = new Error(message);
	err.go$panicValue = value;
	return err;
};
var go$notSupported = function(feature) {
	var err = new Error("not supported by GopherJS: " + feature);
	err.go$notSupported = feature;
	throw err;
};
var go$throwRuntimeError; // set by package "runtime"

var go$errorStack = [], go$jsErr = null;

var go$pushErr = function(err) {
	if (err.go$panicValue === undefined) {
		if (err.go$exit || err.go$notSupported) {
			go$jsErr = err;
			return;
		}
		err.go$panicValue = new go$packages["github.com/gopherjs/gopherjs/js"].Error.Ptr(err);
	}
	go$errorStack.push({ frame: go$getStackDepth(), error: err });
};

var go$callDeferred = function(deferred) {
	if (go$jsErr !== null) {
		throw go$jsErr;
	}
	var i;
	for (i = deferred.length - 1; i >= 0; i--) {
		var call = deferred[i];
		try {
			if (call.recv !== undefined) {
				call.recv[call.method].apply(call.recv, call.args);
				continue;
			}
			call.fun.apply(undefined, call.args);
		} catch (err) {
			go$errorStack.push({ frame: go$getStackDepth(), error: err });
		}
	}
	var err = go$errorStack[go$errorStack.length - 1];
	if (err !== undefined && err.frame === go$getStackDepth()) {
		go$errorStack.pop();
		throw err.error;
	}
};

var go$recover = function() {
	var err = go$errorStack[go$errorStack.length - 1];
	if (err === undefined || err.frame !== go$getStackDepth()) {
		return null;
	}
	go$errorStack.pop();
	return err.error.go$panicValue;
};

var go$getStack = function() {
	return (new Error()).stack.split("\n");
};

var go$getStackDepth = function() {
	var s = go$getStack(), d = 0, i;
	for (i = 0; i < s.length; i++) {
		if (s[i].indexOf("go$") === -1) {
			d++;
		}
	}
	return d;
};

var go$interfaceIsEqual = function(a, b) {
	if (a === b) {
		return true;
	}
	if (a === null || b === null || a === undefined || b === undefined || a.constructor !== b.constructor) {
		return false;
	}
	switch (a.constructor.kind) {
	case "Float32":
		return go$float32IsEqual(a.go$val, b.go$val);
	case "Complex64":
		return go$float32IsEqual(a.go$val.real, b.go$val.real) && go$float32IsEqual(a.go$val.imag, b.go$val.imag);
	case "Complex128":
		return a.go$val.real === b.go$val.real && a.go$val.imag === b.go$val.imag;
	case "Int64":
	case "Uint64":
		return a.go$val.high === b.go$val.high && a.go$val.low === b.go$val.low;
	case "Array":
		return go$arrayIsEqual(a.go$val, b.go$val);
	case "Ptr":
		if (a.constructor.Struct) {
			return false;
		}
		return go$pointerIsEqual(a, b);
	case "Func":
	case "Map":
	case "Slice":
	case "Struct":
		go$throwRuntimeError("comparing uncomparable type " + a.constructor);
	case undefined: // js.Object
		return false;
	default:
		return a.go$val === b.go$val;
	}
};
var go$float32IsEqual = function(a, b) {
	if (a === b) {
		return true;
	}
	if (a === 0 || b === 0 || a === 1/0 || b === 1/0 || a === -1/0 || b === -1/0 || a !== a || b !== b) {
		return false;
	}
	var math = go$packages["math"];
	return math !== undefined && math.Float32bits(a) === math.Float32bits(b);
}
var go$arrayIsEqual = function(a, b) {
	if (a.length != b.length) {
		return false;
	}
	var i;
	for (i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
};
var go$sliceIsEqual = function(a, ai, b, bi) {
	return a.array === b.array && a.offset + ai === b.offset + bi;
};
var go$pointerIsEqual = function(a, b) {
	if (a === b) {
		return true;
	}
	if (a.go$get === go$throwNilPointerError || b.go$get === go$throwNilPointerError) {
		return a.go$get === go$throwNilPointerError && b.go$get === go$throwNilPointerError;
	}
	var old = a.go$get();
	var dummy = new Object();
	a.go$set(dummy);
	var equal = b.go$get() === dummy;
	a.go$set(old);
	return equal;
};

var go$typeAssertionFailed = function(obj, expected) {
	var got = "";
	if (obj !== null) {
		got = obj.constructor.string;
	}
	throw go$panic(new go$packages["runtime"].TypeAssertionError.Ptr("", got, expected.string, ""));
};

var go$now = function() { var msec = (new Date()).getTime(); return [new Go$Int64(0, Math.floor(msec / 1000)), (msec % 1000) * 1000000]; };

var go$packages = {};
go$packages["github.com/gopherjs/gopherjs/js"] = (function() {
	var go$pkg = {}, Object, Error;
	Object = go$pkg.Object = go$newType(8, "Interface", "js.Object", "Object", "github.com/gopherjs/gopherjs/js", null);
	Error = go$pkg.Error = go$newType(0, "Struct", "js.Error", "Error", "github.com/gopherjs/gopherjs/js", function(Object_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
	Error.Ptr.prototype.Error = function() {
		var err;
		err = this;
		return "JavaScript error: " + go$internalize(err.Object.message, Go$String);
	};
	Error.prototype.Error = function() { return this.go$val.Error(); };
	go$pkg.init = function() {
		Object.init([["Bool", "", (go$funcType([], [Go$Bool], false))], ["Call", "", (go$funcType([Go$String, (go$sliceType(go$emptyInterface))], [Object], true))], ["Delete", "", (go$funcType([Go$String], [], false))], ["Float", "", (go$funcType([], [Go$Float64], false))], ["Get", "", (go$funcType([Go$String], [Object], false))], ["Index", "", (go$funcType([Go$Int], [Object], false))], ["Int", "", (go$funcType([], [Go$Int], false))], ["Int64", "", (go$funcType([], [Go$Int64], false))], ["Interface", "", (go$funcType([], [go$emptyInterface], false))], ["Invoke", "", (go$funcType([(go$sliceType(go$emptyInterface))], [Object], true))], ["IsNull", "", (go$funcType([], [Go$Bool], false))], ["IsUndefined", "", (go$funcType([], [Go$Bool], false))], ["Length", "", (go$funcType([], [Go$Int], false))], ["New", "", (go$funcType([(go$sliceType(go$emptyInterface))], [Object], true))], ["Set", "", (go$funcType([Go$String, go$emptyInterface], [], false))], ["SetIndex", "", (go$funcType([Go$Int, go$emptyInterface], [], false))], ["Str", "", (go$funcType([], [Go$String], false))], ["Uint64", "", (go$funcType([], [Go$Uint64], false))], ["Unsafe", "", (go$funcType([], [Go$Uintptr], false))]]);
		Error.methods = [["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [Object], true, 0], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Get", "Get", "", [Go$String], [Object], false, 0], ["Index", "Index", "", [Go$Int], [Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["Set", "Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["Str", "Str", "", [], [Go$String], false, 0], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0]];
		(go$ptrType(Error)).methods = [["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [Object], true, 0], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Error", "Error", "", [], [Go$String], false, -1], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Get", "Get", "", [Go$String], [Object], false, 0], ["Index", "Index", "", [Go$Int], [Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["Set", "Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["Str", "Str", "", [], [Go$String], false, 0], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0]];
		Error.init([["Object", "", "", Object, ""]]);
		var e;
		e = new Error.Ptr(null);
	}
	return go$pkg;
})();
go$packages["runtime"] = (function() {
	var go$pkg = {}, js = go$packages["github.com/gopherjs/gopherjs/js"], TypeAssertionError, errorString, goexit, sizeof_C_MStats;
	TypeAssertionError = go$pkg.TypeAssertionError = go$newType(0, "Struct", "runtime.TypeAssertionError", "TypeAssertionError", "runtime", function(interfaceString_, concreteString_, assertedString_, missingMethod_) {
		this.go$val = this;
		this.interfaceString = interfaceString_ !== undefined ? interfaceString_ : "";
		this.concreteString = concreteString_ !== undefined ? concreteString_ : "";
		this.assertedString = assertedString_ !== undefined ? assertedString_ : "";
		this.missingMethod = missingMethod_ !== undefined ? missingMethod_ : "";
	});
	errorString = go$pkg.errorString = go$newType(8, "String", "runtime.errorString", "errorString", "runtime", null);
	TypeAssertionError.Ptr.prototype.RuntimeError = function() {
	};
	TypeAssertionError.prototype.RuntimeError = function() { return this.go$val.RuntimeError(); };
	TypeAssertionError.Ptr.prototype.Error = function() {
		var e, inter;
		e = this;
		inter = e.interfaceString;
		if (inter === "") {
			inter = "interface";
		}
		if (e.concreteString === "") {
			return "interface conversion: " + inter + " is nil, not " + e.assertedString;
		}
		if (e.missingMethod === "") {
			return "interface conversion: " + inter + " is " + e.concreteString + ", not " + e.assertedString;
		}
		return "interface conversion: " + e.concreteString + " is not " + e.assertedString + ": missing method " + e.missingMethod;
	};
	TypeAssertionError.prototype.Error = function() { return this.go$val.Error(); };
	errorString.prototype.RuntimeError = function() {
		var e;
		e = this.go$val;
	};
	go$ptrType(errorString).prototype.RuntimeError = function() { return new errorString(this.go$get()).RuntimeError(); };
	errorString.prototype.Error = function() {
		var e;
		e = this.go$val;
		return "runtime error: " + e;
	};
	go$ptrType(errorString).prototype.Error = function() { return new errorString(this.go$get()).Error(); };
	go$pkg.init = function() {
		(go$ptrType(TypeAssertionError)).methods = [["Error", "Error", "", [], [Go$String], false, -1], ["RuntimeError", "RuntimeError", "", [], [], false, -1]];
		TypeAssertionError.init([["interfaceString", "interfaceString", "runtime", Go$String, ""], ["concreteString", "concreteString", "runtime", Go$String, ""], ["assertedString", "assertedString", "runtime", Go$String, ""], ["missingMethod", "missingMethod", "runtime", Go$String, ""]]);
		errorString.methods = [["Error", "Error", "", [], [Go$String], false, -1], ["RuntimeError", "RuntimeError", "", [], [], false, -1]];
		(go$ptrType(errorString)).methods = [["Error", "Error", "", [], [Go$String], false, -1], ["RuntimeError", "RuntimeError", "", [], [], false, -1]];
		sizeof_C_MStats = 3712;
		goexit = go$global.eval(go$externalize("(function() {\n\tvar err = new Error();\n\terr.go$exit = true;\n\tthrow err;\n})", Go$String));
		var e;
		go$throwRuntimeError = go$externalize((function(msg) {
			throw go$panic(new errorString(msg));
		}), (go$funcType([Go$String], [], false)));
		e = new TypeAssertionError.Ptr("", "", "", "");
		if (!((sizeof_C_MStats === 3712))) {
			console.log(sizeof_C_MStats, 3712);
			throw go$panic(new Go$String("MStats vs MemStatsType size mismatch"));
		}
	}
	return go$pkg;
})();
go$packages["math"] = (function() {
	var go$pkg = {}, js = go$packages["github.com/gopherjs/gopherjs/js"], Ldexp, Float32bits, Float32frombits, math, zero, negInf, nan, pow10tab;
	Ldexp = go$pkg.Ldexp = function(frac, exp$1) {
		if (frac === 0) {
			return frac;
		}
		if (exp$1 >= 1024) {
			return frac * go$parseFloat(math.pow(2, 1023)) * go$parseFloat(math.pow(2, exp$1 - 1023 >> 0));
		}
		if (exp$1 <= -1024) {
			return frac * go$parseFloat(math.pow(2, -1023)) * go$parseFloat(math.pow(2, exp$1 + 1023 >> 0));
		}
		return frac * go$parseFloat(math.pow(2, exp$1));
	};
	Float32bits = go$pkg.Float32bits = function(f) {
		var s, e, r;
		if (go$float32IsEqual(f, 0)) {
			if (go$float32IsEqual(1 / f, negInf)) {
				return 2147483648;
			}
			return 0;
		}
		if (!((go$float32IsEqual(f, f)))) {
			return 2143289344;
		}
		s = 0;
		if (f < 0) {
			s = 2147483648;
			f = -f;
		}
		e = 150;
		while (f >= 1.6777216e+07) {
			f = f / 2;
			if (e === 255) {
				break;
			}
			e = e + 1 >>> 0;
		}
		while (f < 8.388608e+06) {
			e = e - 1 >>> 0;
			if (e === 0) {
				break;
			}
			f = f * 2;
		}
		r = go$parseFloat(go$mod(f, 2));
		if ((r > 0.5 && r < 1) || r >= 1.5) {
			f = f + 1;
		}
		return (((s | (e << 23 >>> 0)) >>> 0) | (((f >> 0) & ~8388608))) >>> 0;
	};
	Float32frombits = go$pkg.Float32frombits = function(b) {
		var s, e, m;
		s = 1;
		if (!((((b & 2147483648) >>> 0) === 0))) {
			s = -1;
		}
		e = (((b >>> 23 >>> 0)) & 255) >>> 0;
		m = (b & 8388607) >>> 0;
		if (e === 255) {
			if (m === 0) {
				return s / 0;
			}
			return nan;
		}
		if (!((e === 0))) {
			m = m + 8388608 >>> 0;
		}
		if (e === 0) {
			e = 1;
		}
		return Ldexp(m, ((e >> 0) - 127 >> 0) - 23 >> 0) * s;
	};
	go$pkg.init = function() {
		pow10tab = go$makeNativeArray("Float64", 70, function() { return 0; });
		math = go$global.Math;
		zero = 0;
		negInf = -1 / zero;
		nan = 0 / zero;
		var i, _q, m;
		Float32bits(0);
		Float32frombits(0);
		pow10tab[0] = 1;
		pow10tab[1] = 10;
		i = 2;
		while (i < 70) {
			m = (_q = i / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
			pow10tab[i] = pow10tab[m] * pow10tab[(i - m >> 0)];
			i = i + 1 >> 0;
		}
	}
	return go$pkg;
})();
go$packages["errors"] = (function() {
	var go$pkg = {}, errorString, New;
	errorString = go$pkg.errorString = go$newType(0, "Struct", "errors.errorString", "errorString", "errors", function(s_) {
		this.go$val = this;
		this.s = s_ !== undefined ? s_ : "";
	});
	New = go$pkg.New = function(text) {
		return new errorString.Ptr(text);
	};
	errorString.Ptr.prototype.Error = function() {
		var e;
		e = this;
		return e.s;
	};
	errorString.prototype.Error = function() { return this.go$val.Error(); };
	go$pkg.init = function() {
		(go$ptrType(errorString)).methods = [["Error", "Error", "", [], [Go$String], false, -1]];
		errorString.init([["s", "s", "errors", Go$String, ""]]);
	}
	return go$pkg;
})();
go$packages["unicode/utf8"] = (function() {
	var go$pkg = {}, decodeRuneInStringInternal, DecodeRuneInString, EncodeRune;
	decodeRuneInStringInternal = function(s) {
		var r, size, short$1, n, _tmp, _tmp$1, _tmp$2, c0, _tmp$3, _tmp$4, _tmp$5, _tmp$6, _tmp$7, _tmp$8, _tmp$9, _tmp$10, _tmp$11, c1, _tmp$12, _tmp$13, _tmp$14, _tmp$15, _tmp$16, _tmp$17, _tmp$18, _tmp$19, _tmp$20, _tmp$21, _tmp$22, _tmp$23, c2, _tmp$24, _tmp$25, _tmp$26, _tmp$27, _tmp$28, _tmp$29, _tmp$30, _tmp$31, _tmp$32, _tmp$33, _tmp$34, _tmp$35, _tmp$36, _tmp$37, _tmp$38, c3, _tmp$39, _tmp$40, _tmp$41, _tmp$42, _tmp$43, _tmp$44, _tmp$45, _tmp$46, _tmp$47, _tmp$48, _tmp$49, _tmp$50;
		r = 0;
		size = 0;
		short$1 = false;
		n = s.length;
		if (n < 1) {
			_tmp = 65533; _tmp$1 = 0; _tmp$2 = true; r = _tmp; size = _tmp$1; short$1 = _tmp$2;
			return [r, size, short$1];
		}
		c0 = s.charCodeAt(0);
		if (c0 < 128) {
			_tmp$3 = (c0 >> 0); _tmp$4 = 1; _tmp$5 = false; r = _tmp$3; size = _tmp$4; short$1 = _tmp$5;
			return [r, size, short$1];
		}
		if (c0 < 192) {
			_tmp$6 = 65533; _tmp$7 = 1; _tmp$8 = false; r = _tmp$6; size = _tmp$7; short$1 = _tmp$8;
			return [r, size, short$1];
		}
		if (n < 2) {
			_tmp$9 = 65533; _tmp$10 = 1; _tmp$11 = true; r = _tmp$9; size = _tmp$10; short$1 = _tmp$11;
			return [r, size, short$1];
		}
		c1 = s.charCodeAt(1);
		if (c1 < 128 || 192 <= c1) {
			_tmp$12 = 65533; _tmp$13 = 1; _tmp$14 = false; r = _tmp$12; size = _tmp$13; short$1 = _tmp$14;
			return [r, size, short$1];
		}
		if (c0 < 224) {
			r = ((((c0 & 31) >>> 0) >> 0) << 6 >> 0) | (((c1 & 63) >>> 0) >> 0);
			if (r <= 127) {
				_tmp$15 = 65533; _tmp$16 = 1; _tmp$17 = false; r = _tmp$15; size = _tmp$16; short$1 = _tmp$17;
				return [r, size, short$1];
			}
			_tmp$18 = r; _tmp$19 = 2; _tmp$20 = false; r = _tmp$18; size = _tmp$19; short$1 = _tmp$20;
			return [r, size, short$1];
		}
		if (n < 3) {
			_tmp$21 = 65533; _tmp$22 = 1; _tmp$23 = true; r = _tmp$21; size = _tmp$22; short$1 = _tmp$23;
			return [r, size, short$1];
		}
		c2 = s.charCodeAt(2);
		if (c2 < 128 || 192 <= c2) {
			_tmp$24 = 65533; _tmp$25 = 1; _tmp$26 = false; r = _tmp$24; size = _tmp$25; short$1 = _tmp$26;
			return [r, size, short$1];
		}
		if (c0 < 240) {
			r = (((((c0 & 15) >>> 0) >> 0) << 12 >> 0) | ((((c1 & 63) >>> 0) >> 0) << 6 >> 0)) | (((c2 & 63) >>> 0) >> 0);
			if (r <= 2047) {
				_tmp$27 = 65533; _tmp$28 = 1; _tmp$29 = false; r = _tmp$27; size = _tmp$28; short$1 = _tmp$29;
				return [r, size, short$1];
			}
			if (55296 <= r && r <= 57343) {
				_tmp$30 = 65533; _tmp$31 = 1; _tmp$32 = false; r = _tmp$30; size = _tmp$31; short$1 = _tmp$32;
				return [r, size, short$1];
			}
			_tmp$33 = r; _tmp$34 = 3; _tmp$35 = false; r = _tmp$33; size = _tmp$34; short$1 = _tmp$35;
			return [r, size, short$1];
		}
		if (n < 4) {
			_tmp$36 = 65533; _tmp$37 = 1; _tmp$38 = true; r = _tmp$36; size = _tmp$37; short$1 = _tmp$38;
			return [r, size, short$1];
		}
		c3 = s.charCodeAt(3);
		if (c3 < 128 || 192 <= c3) {
			_tmp$39 = 65533; _tmp$40 = 1; _tmp$41 = false; r = _tmp$39; size = _tmp$40; short$1 = _tmp$41;
			return [r, size, short$1];
		}
		if (c0 < 248) {
			r = ((((((c0 & 7) >>> 0) >> 0) << 18 >> 0) | ((((c1 & 63) >>> 0) >> 0) << 12 >> 0)) | ((((c2 & 63) >>> 0) >> 0) << 6 >> 0)) | (((c3 & 63) >>> 0) >> 0);
			if (r <= 65535 || 1114111 < r) {
				_tmp$42 = 65533; _tmp$43 = 1; _tmp$44 = false; r = _tmp$42; size = _tmp$43; short$1 = _tmp$44;
				return [r, size, short$1];
			}
			_tmp$45 = r; _tmp$46 = 4; _tmp$47 = false; r = _tmp$45; size = _tmp$46; short$1 = _tmp$47;
			return [r, size, short$1];
		}
		_tmp$48 = 65533; _tmp$49 = 1; _tmp$50 = false; r = _tmp$48; size = _tmp$49; short$1 = _tmp$50;
		return [r, size, short$1];
	};
	DecodeRuneInString = go$pkg.DecodeRuneInString = function(s) {
		var r, size, _tuple;
		r = 0;
		size = 0;
		_tuple = decodeRuneInStringInternal(s); r = _tuple[0]; size = _tuple[1];
		return [r, size];
	};
	EncodeRune = go$pkg.EncodeRune = function(p, r) {
		if ((r >>> 0) <= 127) {
			(0 < 0 || 0 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 0] = (r << 24 >>> 24);
			return 1;
		}
		if ((r >>> 0) <= 2047) {
			(0 < 0 || 0 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 0] = (192 | ((r >> 6 >> 0) << 24 >>> 24)) >>> 0;
			(1 < 0 || 1 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 1] = (128 | (((r << 24 >>> 24) & 63) >>> 0)) >>> 0;
			return 2;
		}
		if ((r >>> 0) > 1114111) {
			r = 65533;
		}
		if (55296 <= r && r <= 57343) {
			r = 65533;
		}
		if ((r >>> 0) <= 65535) {
			(0 < 0 || 0 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 0] = (224 | ((r >> 12 >> 0) << 24 >>> 24)) >>> 0;
			(1 < 0 || 1 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 1] = (128 | ((((r >> 6 >> 0) << 24 >>> 24) & 63) >>> 0)) >>> 0;
			(2 < 0 || 2 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 2] = (128 | (((r << 24 >>> 24) & 63) >>> 0)) >>> 0;
			return 3;
		}
		(0 < 0 || 0 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 0] = (240 | ((r >> 18 >> 0) << 24 >>> 24)) >>> 0;
		(1 < 0 || 1 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 1] = (128 | ((((r >> 12 >> 0) << 24 >>> 24) & 63) >>> 0)) >>> 0;
		(2 < 0 || 2 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 2] = (128 | ((((r >> 6 >> 0) << 24 >>> 24) & 63) >>> 0)) >>> 0;
		(3 < 0 || 3 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 3] = (128 | (((r << 24 >>> 24) & 63) >>> 0)) >>> 0;
		return 4;
	};
	go$pkg.init = function() {
	}
	return go$pkg;
})();
go$packages["strconv"] = (function() {
	var go$pkg = {}, math = go$packages["math"], errors = go$packages["errors"], utf8 = go$packages["unicode/utf8"], FormatInt, Itoa, formatBits, unhex, UnquoteChar, Unquote, contains, shifts;
	FormatInt = go$pkg.FormatInt = function(i, base) {
		var _tuple, s;
		_tuple = formatBits((go$sliceType(Go$Uint8)).nil, new Go$Uint64(i.high, i.low), base, (i.high < 0 || (i.high === 0 && i.low < 0)), false); s = _tuple[1];
		return s;
	};
	Itoa = go$pkg.Itoa = function(i) {
		return FormatInt(new Go$Int64(0, i), 10);
	};
	formatBits = function(dst, u, base, neg, append_) {
		var d, s, a, i, q, x, j, q$1, x$1, s$1, b, m, b$1;
		d = (go$sliceType(Go$Uint8)).nil;
		s = "";
		if (base < 2 || base > 36) {
			throw go$panic(new Go$String("strconv: illegal AppendInt/FormatInt base"));
		}
		a = go$makeNativeArray("Uint8", 65, function() { return 0; });
		i = 65;
		if (neg) {
			u = new Go$Uint64(-u.high, -u.low);
		}
		if (base === 10) {
			while ((u.high > 0 || (u.high === 0 && u.low >= 100))) {
				i = i - 2 >> 0;
				q = go$div64(u, new Go$Uint64(0, 100), false);
				j = ((x = go$mul64(q, new Go$Uint64(0, 100)), new Go$Uint64(u.high - x.high, u.low - x.low)).low >>> 0);
				a[(i + 1 >> 0)] = "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789".charCodeAt(j);
				a[(i + 0 >> 0)] = "0000000000111111111122222222223333333333444444444455555555556666666666777777777788888888889999999999".charCodeAt(j);
				u = q;
			}
			if ((u.high > 0 || (u.high === 0 && u.low >= 10))) {
				i = i - 1 >> 0;
				q$1 = go$div64(u, new Go$Uint64(0, 10), false);
				a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt(((x$1 = go$mul64(q$1, new Go$Uint64(0, 10)), new Go$Uint64(u.high - x$1.high, u.low - x$1.low)).low >>> 0));
				u = q$1;
			}
		} else {
			s$1 = shifts[base];
			if (s$1 > 0) {
				b = new Go$Uint64(0, base);
				m = (b.low >>> 0) - 1 >>> 0;
				while ((u.high > b.high || (u.high === b.high && u.low >= b.low))) {
					i = i - 1 >> 0;
					a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt((((u.low >>> 0) & m) >>> 0));
					u = go$shiftRightUint64(u, (s$1));
				}
			} else {
				b$1 = new Go$Uint64(0, base);
				while ((u.high > b$1.high || (u.high === b$1.high && u.low >= b$1.low))) {
					i = i - 1 >> 0;
					a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt((go$div64(u, b$1, true).low >>> 0));
					u = go$div64(u, (b$1), false);
				}
			}
		}
		i = i - 1 >> 0;
		a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt((u.low >>> 0));
		if (neg) {
			i = i - 1 >> 0;
			a[i] = 45;
		}
		if (append_) {
			d = go$appendSlice(dst, go$subslice(new (go$sliceType(Go$Uint8))(a), i));
			return [d, s];
		}
		s = go$bytesToString(go$subslice(new (go$sliceType(Go$Uint8))(a), i));
		return [d, s];
	};
	unhex = function(b) {
		var v, ok, c, _tmp, _tmp$1, _tmp$2, _tmp$3, _tmp$4, _tmp$5;
		v = 0;
		ok = false;
		c = (b >> 0);
		if (48 <= c && c <= 57) {
			_tmp = c - 48 >> 0; _tmp$1 = true; v = _tmp; ok = _tmp$1;
			return [v, ok];
		} else if (97 <= c && c <= 102) {
			_tmp$2 = (c - 97 >> 0) + 10 >> 0; _tmp$3 = true; v = _tmp$2; ok = _tmp$3;
			return [v, ok];
		} else if (65 <= c && c <= 70) {
			_tmp$4 = (c - 65 >> 0) + 10 >> 0; _tmp$5 = true; v = _tmp$4; ok = _tmp$5;
			return [v, ok];
		}
		return [v, ok];
	};
	UnquoteChar = go$pkg.UnquoteChar = function(s, quote) {
		var value, multibyte, tail, err, c, _tuple, r, size, _tmp, _tmp$1, _tmp$2, _tmp$3, _tmp$4, _tmp$5, _tmp$6, _tmp$7, c$1, _ref, n, _ref$1, v, j, _tuple$1, x, ok, v$1, j$1, x$1;
		value = 0;
		multibyte = false;
		tail = "";
		err = null;
		c = s.charCodeAt(0);
		if ((c === quote) && ((quote === 39) || (quote === 34))) {
			err = go$pkg.ErrSyntax;
			return [value, multibyte, tail, err];
		} else if (c >= 128) {
			_tuple = utf8.DecodeRuneInString(s); r = _tuple[0]; size = _tuple[1];
			_tmp = r; _tmp$1 = true; _tmp$2 = s.substring(size); _tmp$3 = null; value = _tmp; multibyte = _tmp$1; tail = _tmp$2; err = _tmp$3;
			return [value, multibyte, tail, err];
		} else if (!((c === 92))) {
			_tmp$4 = (s.charCodeAt(0) >> 0); _tmp$5 = false; _tmp$6 = s.substring(1); _tmp$7 = null; value = _tmp$4; multibyte = _tmp$5; tail = _tmp$6; err = _tmp$7;
			return [value, multibyte, tail, err];
		}
		if (s.length <= 1) {
			err = go$pkg.ErrSyntax;
			return [value, multibyte, tail, err];
		}
		c$1 = s.charCodeAt(1);
		s = s.substring(2);
		_ref = c$1;
		switch (0) { default: if (_ref === 97) {
			value = 7;
		} else if (_ref === 98) {
			value = 8;
		} else if (_ref === 102) {
			value = 12;
		} else if (_ref === 110) {
			value = 10;
		} else if (_ref === 114) {
			value = 13;
		} else if (_ref === 116) {
			value = 9;
		} else if (_ref === 118) {
			value = 11;
		} else if (_ref === 120 || _ref === 117 || _ref === 85) {
			n = 0;
			_ref$1 = c$1;
			if (_ref$1 === 120) {
				n = 2;
			} else if (_ref$1 === 117) {
				n = 4;
			} else if (_ref$1 === 85) {
				n = 8;
			}
			v = 0;
			if (s.length < n) {
				err = go$pkg.ErrSyntax;
				return [value, multibyte, tail, err];
			}
			j = 0;
			while (j < n) {
				_tuple$1 = unhex(s.charCodeAt(j)); x = _tuple$1[0]; ok = _tuple$1[1];
				if (!ok) {
					err = go$pkg.ErrSyntax;
					return [value, multibyte, tail, err];
				}
				v = (v << 4 >> 0) | x;
				j = j + 1 >> 0;
			}
			s = s.substring(n);
			if (c$1 === 120) {
				value = v;
				break;
			}
			if (v > 1114111) {
				err = go$pkg.ErrSyntax;
				return [value, multibyte, tail, err];
			}
			value = v;
			multibyte = true;
		} else if (_ref === 48 || _ref === 49 || _ref === 50 || _ref === 51 || _ref === 52 || _ref === 53 || _ref === 54 || _ref === 55) {
			v$1 = (c$1 >> 0) - 48 >> 0;
			if (s.length < 2) {
				err = go$pkg.ErrSyntax;
				return [value, multibyte, tail, err];
			}
			j$1 = 0;
			while (j$1 < 2) {
				x$1 = (s.charCodeAt(j$1) >> 0) - 48 >> 0;
				if (x$1 < 0 || x$1 > 7) {
					err = go$pkg.ErrSyntax;
					return [value, multibyte, tail, err];
				}
				v$1 = ((v$1 << 3 >> 0)) | x$1;
				j$1 = j$1 + 1 >> 0;
			}
			s = s.substring(2);
			if (v$1 > 255) {
				err = go$pkg.ErrSyntax;
				return [value, multibyte, tail, err];
			}
			value = v$1;
		} else if (_ref === 92) {
			value = 92;
		} else if (_ref === 39 || _ref === 34) {
			if (!((c$1 === quote))) {
				err = go$pkg.ErrSyntax;
				return [value, multibyte, tail, err];
			}
			value = (c$1 >> 0);
		} else {
			err = go$pkg.ErrSyntax;
			return [value, multibyte, tail, err];
		} }
		tail = s;
		return [value, multibyte, tail, err];
	};
	Unquote = go$pkg.Unquote = function(s) {
		var t, err, n, _tmp, _tmp$1, quote, _tmp$2, _tmp$3, _tmp$4, _tmp$5, _tmp$6, _tmp$7, _tmp$8, _tmp$9, _tmp$10, _tmp$11, _ref, _tmp$12, _tmp$13, _tuple, r, size, _tmp$14, _tmp$15, runeTmp, _q, x, buf, _tuple$1, c, multibyte, ss, err$1, _tmp$16, _tmp$17, n$1, _tmp$18, _tmp$19, _tmp$20, _tmp$21;
		t = "";
		err = null;
		n = s.length;
		if (n < 2) {
			_tmp = ""; _tmp$1 = go$pkg.ErrSyntax; t = _tmp; err = _tmp$1;
			return [t, err];
		}
		quote = s.charCodeAt(0);
		if (!((quote === s.charCodeAt((n - 1 >> 0))))) {
			_tmp$2 = ""; _tmp$3 = go$pkg.ErrSyntax; t = _tmp$2; err = _tmp$3;
			return [t, err];
		}
		s = s.substring(1, (n - 1 >> 0));
		if (quote === 96) {
			if (contains(s, 96)) {
				_tmp$4 = ""; _tmp$5 = go$pkg.ErrSyntax; t = _tmp$4; err = _tmp$5;
				return [t, err];
			}
			_tmp$6 = s; _tmp$7 = null; t = _tmp$6; err = _tmp$7;
			return [t, err];
		}
		if (!((quote === 34)) && !((quote === 39))) {
			_tmp$8 = ""; _tmp$9 = go$pkg.ErrSyntax; t = _tmp$8; err = _tmp$9;
			return [t, err];
		}
		if (contains(s, 10)) {
			_tmp$10 = ""; _tmp$11 = go$pkg.ErrSyntax; t = _tmp$10; err = _tmp$11;
			return [t, err];
		}
		if (!contains(s, 92) && !contains(s, quote)) {
			_ref = quote;
			if (_ref === 34) {
				_tmp$12 = s; _tmp$13 = null; t = _tmp$12; err = _tmp$13;
				return [t, err];
			} else if (_ref === 39) {
				_tuple = utf8.DecodeRuneInString(s); r = _tuple[0]; size = _tuple[1];
				if ((size === s.length) && (!((r === 65533)) || !((size === 1)))) {
					_tmp$14 = s; _tmp$15 = null; t = _tmp$14; err = _tmp$15;
					return [t, err];
				}
			}
		}
		runeTmp = go$makeNativeArray("Uint8", 4, function() { return 0; });
		buf = (go$sliceType(Go$Uint8)).make(0, (_q = (x = s.length, (((3 >>> 16 << 16) * x >> 0) + (3 << 16 >>> 16) * x) >> 0) / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")), function() { return 0; });
		while (s.length > 0) {
			_tuple$1 = UnquoteChar(s, quote); c = _tuple$1[0]; multibyte = _tuple$1[1]; ss = _tuple$1[2]; err$1 = _tuple$1[3];
			if (!(go$interfaceIsEqual(err$1, null))) {
				_tmp$16 = ""; _tmp$17 = err$1; t = _tmp$16; err = _tmp$17;
				return [t, err];
			}
			s = ss;
			if (c < 128 || !multibyte) {
				buf = go$append(buf, (c << 24 >>> 24));
			} else {
				n$1 = utf8.EncodeRune(new (go$sliceType(Go$Uint8))(runeTmp), c);
				buf = go$appendSlice(buf, go$subslice(new (go$sliceType(Go$Uint8))(runeTmp), 0, n$1));
			}
			if ((quote === 39) && !((s.length === 0))) {
				_tmp$18 = ""; _tmp$19 = go$pkg.ErrSyntax; t = _tmp$18; err = _tmp$19;
				return [t, err];
			}
		}
		_tmp$20 = go$bytesToString(buf); _tmp$21 = null; t = _tmp$20; err = _tmp$21;
		return [t, err];
	};
	contains = function(s, c) {
		var i;
		i = 0;
		while (i < s.length) {
			if (s.charCodeAt(i) === c) {
				return true;
			}
			i = i + 1 >> 0;
		}
		return false;
	};
	go$pkg.init = function() {
		go$pkg.ErrRange = errors.New("value out of range");
		go$pkg.ErrSyntax = errors.New("invalid syntax");
		shifts = go$toNativeArray("Uint", [0, 0, 1, 0, 2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0]);
	}
	return go$pkg;
})();
go$packages["sync/atomic"] = (function() {
	var go$pkg = {};
	go$pkg.init = function() {
	}
	return go$pkg;
})();
go$packages["sync"] = (function() {
	var go$pkg = {}, atomic = go$packages["sync/atomic"], runtime_Syncsemcheck;
	runtime_Syncsemcheck = function(size) {
	};
	go$pkg.init = function() {
		var s;
		s = go$makeNativeArray("Uintptr", 3, function() { return 0; });
		runtime_Syncsemcheck(12);
	}
	return go$pkg;
})();
go$packages["reflect"] = (function() {
	var go$pkg = {}, js = go$packages["github.com/gopherjs/gopherjs/js"], strconv = go$packages["strconv"], sync = go$packages["sync"], math = go$packages["math"], runtime = go$packages["runtime"], mapIter, Type, Kind, rtype, method, uncommonType, ChanDir, arrayType, chanType, funcType, imethod, interfaceType, mapType, ptrType, sliceType, structField, structType, Method, StructField, StructTag, fieldScan, Value, flag, ValueError, iword, jsType, reflectType, isWrapped, copyStruct, zeroVal, makeIword, makeValue, MakeSlice, jsObject, TypeOf, ValueOf, SliceOf, Zero, unsafe_New, makeInt, chanclose, chanrecv, chansend, mapaccess, mapassign, mapiterinit, mapiterkey, mapiternext, maplen, cvtDirect, methodReceiver, valueInterface, ifaceE2I, methodName, makeMethodValue, PtrTo, implements$1, directlyAssignable, haveIdenticalUnderlyingType, toType, overflowFloat32, New, convertOp, makeFloat, makeComplex, makeString, makeBytes, makeRunes, cvtInt, cvtUint, cvtFloatInt, cvtFloatUint, cvtIntFloat, cvtUintFloat, cvtFloat, cvtComplex, cvtIntString, cvtUintString, cvtBytesString, cvtStringBytes, cvtRunesString, cvtStringRunes, cvtT2I, cvtI2I, call, initialized, kindNames, uint8Type;
	mapIter = go$pkg.mapIter = go$newType(0, "Struct", "reflect.mapIter", "mapIter", "reflect", function(t_, m_, keys_, i_) {
		this.go$val = this;
		this.t = t_ !== undefined ? t_ : null;
		this.m = m_ !== undefined ? m_ : null;
		this.keys = keys_ !== undefined ? keys_ : null;
		this.i = i_ !== undefined ? i_ : 0;
	});
	Type = go$pkg.Type = go$newType(8, "Interface", "reflect.Type", "Type", "reflect", null);
	Kind = go$pkg.Kind = go$newType(4, "Uint", "reflect.Kind", "Kind", "reflect", null);
	rtype = go$pkg.rtype = go$newType(0, "Struct", "reflect.rtype", "rtype", "reflect", function(size_, hash_, _$2_, align_, fieldAlign_, kind_, alg_, gc_, string_, uncommonType_, ptrToThis_) {
		this.go$val = this;
		this.size = size_ !== undefined ? size_ : 0;
		this.hash = hash_ !== undefined ? hash_ : 0;
		this._$2 = _$2_ !== undefined ? _$2_ : 0;
		this.align = align_ !== undefined ? align_ : 0;
		this.fieldAlign = fieldAlign_ !== undefined ? fieldAlign_ : 0;
		this.kind = kind_ !== undefined ? kind_ : 0;
		this.alg = alg_ !== undefined ? alg_ : (go$ptrType(Go$Uintptr)).nil;
		this.gc = gc_ !== undefined ? gc_ : 0;
		this.string = string_ !== undefined ? string_ : (go$ptrType(Go$String)).nil;
		this.uncommonType = uncommonType_ !== undefined ? uncommonType_ : (go$ptrType(uncommonType)).nil;
		this.ptrToThis = ptrToThis_ !== undefined ? ptrToThis_ : (go$ptrType(rtype)).nil;
	});
	method = go$pkg.method = go$newType(0, "Struct", "reflect.method", "method", "reflect", function(name_, pkgPath_, mtyp_, typ_, ifn_, tfn_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgPath = pkgPath_ !== undefined ? pkgPath_ : (go$ptrType(Go$String)).nil;
		this.mtyp = mtyp_ !== undefined ? mtyp_ : (go$ptrType(rtype)).nil;
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(rtype)).nil;
		this.ifn = ifn_ !== undefined ? ifn_ : 0;
		this.tfn = tfn_ !== undefined ? tfn_ : 0;
	});
	uncommonType = go$pkg.uncommonType = go$newType(0, "Struct", "reflect.uncommonType", "uncommonType", "reflect", function(name_, pkgPath_, methods_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgPath = pkgPath_ !== undefined ? pkgPath_ : (go$ptrType(Go$String)).nil;
		this.methods = methods_ !== undefined ? methods_ : (go$sliceType(method)).nil;
	});
	ChanDir = go$pkg.ChanDir = go$newType(4, "Int", "reflect.ChanDir", "ChanDir", "reflect", null);
	arrayType = go$pkg.arrayType = go$newType(0, "Struct", "reflect.arrayType", "arrayType", "reflect", function(rtype_, elem_, slice_, len_) {
		this.go$val = this;
		this.rtype = rtype_ !== undefined ? rtype_ : new rtype.Ptr();
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(rtype)).nil;
		this.slice = slice_ !== undefined ? slice_ : (go$ptrType(rtype)).nil;
		this.len = len_ !== undefined ? len_ : 0;
	});
	chanType = go$pkg.chanType = go$newType(0, "Struct", "reflect.chanType", "chanType", "reflect", function(rtype_, elem_, dir_) {
		this.go$val = this;
		this.rtype = rtype_ !== undefined ? rtype_ : new rtype.Ptr();
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(rtype)).nil;
		this.dir = dir_ !== undefined ? dir_ : 0;
	});
	funcType = go$pkg.funcType = go$newType(0, "Struct", "reflect.funcType", "funcType", "reflect", function(rtype_, dotdotdot_, in$2_, out_) {
		this.go$val = this;
		this.rtype = rtype_ !== undefined ? rtype_ : new rtype.Ptr();
		this.dotdotdot = dotdotdot_ !== undefined ? dotdotdot_ : false;
		this.in$2 = in$2_ !== undefined ? in$2_ : (go$sliceType((go$ptrType(rtype)))).nil;
		this.out = out_ !== undefined ? out_ : (go$sliceType((go$ptrType(rtype)))).nil;
	});
	imethod = go$pkg.imethod = go$newType(0, "Struct", "reflect.imethod", "imethod", "reflect", function(name_, pkgPath_, typ_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgPath = pkgPath_ !== undefined ? pkgPath_ : (go$ptrType(Go$String)).nil;
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(rtype)).nil;
	});
	interfaceType = go$pkg.interfaceType = go$newType(0, "Struct", "reflect.interfaceType", "interfaceType", "reflect", function(rtype_, methods_) {
		this.go$val = this;
		this.rtype = rtype_ !== undefined ? rtype_ : new rtype.Ptr();
		this.methods = methods_ !== undefined ? methods_ : (go$sliceType(imethod)).nil;
	});
	mapType = go$pkg.mapType = go$newType(0, "Struct", "reflect.mapType", "mapType", "reflect", function(rtype_, key_, elem_, bucket_, hmap_) {
		this.go$val = this;
		this.rtype = rtype_ !== undefined ? rtype_ : new rtype.Ptr();
		this.key = key_ !== undefined ? key_ : (go$ptrType(rtype)).nil;
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(rtype)).nil;
		this.bucket = bucket_ !== undefined ? bucket_ : (go$ptrType(rtype)).nil;
		this.hmap = hmap_ !== undefined ? hmap_ : (go$ptrType(rtype)).nil;
	});
	ptrType = go$pkg.ptrType = go$newType(0, "Struct", "reflect.ptrType", "ptrType", "reflect", function(rtype_, elem_) {
		this.go$val = this;
		this.rtype = rtype_ !== undefined ? rtype_ : new rtype.Ptr();
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(rtype)).nil;
	});
	sliceType = go$pkg.sliceType = go$newType(0, "Struct", "reflect.sliceType", "sliceType", "reflect", function(rtype_, elem_) {
		this.go$val = this;
		this.rtype = rtype_ !== undefined ? rtype_ : new rtype.Ptr();
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(rtype)).nil;
	});
	structField = go$pkg.structField = go$newType(0, "Struct", "reflect.structField", "structField", "reflect", function(name_, pkgPath_, typ_, tag_, offset_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgPath = pkgPath_ !== undefined ? pkgPath_ : (go$ptrType(Go$String)).nil;
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(rtype)).nil;
		this.tag = tag_ !== undefined ? tag_ : (go$ptrType(Go$String)).nil;
		this.offset = offset_ !== undefined ? offset_ : 0;
	});
	structType = go$pkg.structType = go$newType(0, "Struct", "reflect.structType", "structType", "reflect", function(rtype_, fields_) {
		this.go$val = this;
		this.rtype = rtype_ !== undefined ? rtype_ : new rtype.Ptr();
		this.fields = fields_ !== undefined ? fields_ : (go$sliceType(structField)).nil;
	});
	Method = go$pkg.Method = go$newType(0, "Struct", "reflect.Method", "Method", "reflect", function(Name_, PkgPath_, Type_, Func_, Index_) {
		this.go$val = this;
		this.Name = Name_ !== undefined ? Name_ : "";
		this.PkgPath = PkgPath_ !== undefined ? PkgPath_ : "";
		this.Type = Type_ !== undefined ? Type_ : null;
		this.Func = Func_ !== undefined ? Func_ : new Value.Ptr();
		this.Index = Index_ !== undefined ? Index_ : 0;
	});
	StructField = go$pkg.StructField = go$newType(0, "Struct", "reflect.StructField", "StructField", "reflect", function(Name_, PkgPath_, Type_, Tag_, Offset_, Index_, Anonymous_) {
		this.go$val = this;
		this.Name = Name_ !== undefined ? Name_ : "";
		this.PkgPath = PkgPath_ !== undefined ? PkgPath_ : "";
		this.Type = Type_ !== undefined ? Type_ : null;
		this.Tag = Tag_ !== undefined ? Tag_ : "";
		this.Offset = Offset_ !== undefined ? Offset_ : 0;
		this.Index = Index_ !== undefined ? Index_ : (go$sliceType(Go$Int)).nil;
		this.Anonymous = Anonymous_ !== undefined ? Anonymous_ : false;
	});
	StructTag = go$pkg.StructTag = go$newType(8, "String", "reflect.StructTag", "StructTag", "reflect", null);
	fieldScan = go$pkg.fieldScan = go$newType(0, "Struct", "reflect.fieldScan", "fieldScan", "reflect", function(typ_, index_) {
		this.go$val = this;
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(structType)).nil;
		this.index = index_ !== undefined ? index_ : (go$sliceType(Go$Int)).nil;
	});
	Value = go$pkg.Value = go$newType(0, "Struct", "reflect.Value", "Value", "reflect", function(typ_, val_, flag_) {
		this.go$val = this;
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(rtype)).nil;
		this.val = val_ !== undefined ? val_ : 0;
		this.flag = flag_ !== undefined ? flag_ : 0;
	});
	flag = go$pkg.flag = go$newType(4, "Uintptr", "reflect.flag", "flag", "reflect", null);
	ValueError = go$pkg.ValueError = go$newType(0, "Struct", "reflect.ValueError", "ValueError", "reflect", function(Method_, Kind_) {
		this.go$val = this;
		this.Method = Method_ !== undefined ? Method_ : "";
		this.Kind = Kind_ !== undefined ? Kind_ : 0;
	});
	iword = go$pkg.iword = go$newType(4, "UnsafePointer", "reflect.iword", "iword", "reflect", null);
	jsType = function(typ) {
		return typ.jsType;
	};
	reflectType = function(typ) {
		var x;
		return (x = go$internalize(typ.reflectType(), go$emptyInterface), (x !== null && x.constructor === (go$ptrType(rtype)) ? x.go$val : go$typeAssertionFailed(x, (go$ptrType(rtype)))));
	};
	isWrapped = function(typ) {
		var _ref;
		_ref = typ.Kind();
		if (_ref === 1 || _ref === 2 || _ref === 3 || _ref === 4 || _ref === 5 || _ref === 7 || _ref === 8 || _ref === 9 || _ref === 10 || _ref === 12 || _ref === 13 || _ref === 14 || _ref === 17 || _ref === 21 || _ref === 19 || _ref === 24 || _ref === 25) {
			return true;
		} else if (_ref === 22) {
			return typ.Elem().Kind() === 17;
		}
		return false;
	};
	copyStruct = function(dst, src, typ) {
		var fields, i, name;
		fields = jsType(typ).fields;
		i = 0;
		while (i < go$parseInt(fields.length)) {
			name = go$internalize(fields[i][0], Go$String);
			dst[go$externalize(name, Go$String)] = src[go$externalize(name, Go$String)];
			i = i + 1 >> 0;
		}
	};
	zeroVal = function(typ) {
		var _ref, elemType;
		_ref = typ.Kind();
		if (_ref === 1) {
			return false;
		} else if (_ref === 2 || _ref === 3 || _ref === 4 || _ref === 5 || _ref === 7 || _ref === 8 || _ref === 9 || _ref === 10 || _ref === 12 || _ref === 13 || _ref === 14) {
			return 0;
		} else if (_ref === 6 || _ref === 11 || _ref === 15 || _ref === 16) {
			return new (jsType(typ))(0, 0);
		} else if (_ref === 17) {
			elemType = typ.Elem();
			return go$makeNativeArray(jsType(elemType).kind, typ.Len(), go$externalize((function() {
				return zeroVal(elemType);
			}), (go$funcType([], [js.Object], false))));
		} else if (_ref === 19) {
			return go$throwNilPointerError;
		} else if (_ref === 20) {
			return null;
		} else if (_ref === 21) {
			return false;
		} else if (_ref === 18 || _ref === 22 || _ref === 23) {
			return jsType(typ).nil;
		} else if (_ref === 24) {
			return "";
		} else if (_ref === 25) {
			return new (jsType(typ).Ptr)();
		} else {
			throw go$panic(new ValueError.Ptr("reflect.Zero", typ.Kind()));
		}
	};
	makeIword = function(t, v) {
		if (t.Size() > 4 && !((t.Kind() === 17)) && !((t.Kind() === 25))) {
			return go$newDataPointer(v, jsType(PtrTo(t)));
		}
		return v;
	};
	makeValue = function(t, v, fl) {
		var rt;
		rt = t.common();
		if (t.Size() > 4 && !((t.Kind() === 17)) && !((t.Kind() === 25))) {
			return new Value.Ptr(rt, go$newDataPointer(v, jsType(rt.ptrTo())), (((fl | ((t.Kind() >>> 0) << 4 >>> 0)) >>> 0) | 2) >>> 0);
		}
		return new Value.Ptr(rt, v, (fl | ((t.Kind() >>> 0) << 4 >>> 0)) >>> 0);
	};
	MakeSlice = go$pkg.MakeSlice = function(typ, len, cap) {
		var _struct;
		if (!((typ.Kind() === 23))) {
			throw go$panic(new Go$String("reflect.MakeSlice of non-slice type"));
		}
		if (len < 0) {
			throw go$panic(new Go$String("reflect.MakeSlice: negative len"));
		}
		if (cap < 0) {
			throw go$panic(new Go$String("reflect.MakeSlice: negative cap"));
		}
		if (len > cap) {
			throw go$panic(new Go$String("reflect.MakeSlice: len > cap"));
		}
		return (_struct = makeValue(typ, jsType(typ).make(len, cap, go$externalize((function() {
			return zeroVal(typ.Elem());
		}), (go$funcType([], [js.Object], false)))), 0), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	jsObject = function() {
		return reflectType(go$packages[go$externalize("github.com/gopherjs/gopherjs/js", Go$String)].Object);
	};
	TypeOf = go$pkg.TypeOf = function(i) {
		var c;
		if (!initialized) {
			return new rtype.Ptr(0, 0, 0, 0, 0, 0, (go$ptrType(Go$Uintptr)).nil, 0, (go$ptrType(Go$String)).nil, (go$ptrType(uncommonType)).nil, (go$ptrType(rtype)).nil);
		}
		if (go$interfaceIsEqual(i, null)) {
			return null;
		}
		c = i.constructor;
		if (c.kind === undefined) {
			return jsObject();
		}
		return reflectType(c);
	};
	ValueOf = go$pkg.ValueOf = function(i) {
		var c, _struct;
		if (go$interfaceIsEqual(i, null)) {
			return new Value.Ptr((go$ptrType(rtype)).nil, 0, 0);
		}
		c = i.constructor;
		if (c.kind === undefined) {
			return new Value.Ptr(jsObject(), i, 320);
		}
		return (_struct = makeValue(reflectType(c), i.go$val, 0), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	rtype.Ptr.prototype.ptrTo = function() {
		var t;
		t = this;
		return reflectType(go$ptrType(jsType(t)));
	};
	rtype.prototype.ptrTo = function() { return this.go$val.ptrTo(); };
	SliceOf = go$pkg.SliceOf = function(t) {
		return reflectType(go$sliceType(jsType(t)));
	};
	Zero = go$pkg.Zero = function(typ) {
		return new Value.Ptr(typ.common(), zeroVal(typ), (typ.Kind() >>> 0) << 4 >>> 0);
	};
	unsafe_New = function(typ) {
		var _ref;
		_ref = typ.Kind();
		if (_ref === 25) {
			return new (jsType(typ).Ptr)();
		} else if (_ref === 17) {
			return zeroVal(typ);
		} else {
			return go$newDataPointer(zeroVal(typ), jsType(typ.ptrTo()));
		}
	};
	makeInt = function(f, bits, t) {
		var typ, ptr, w, _ref, v, v$1, v$2, v$3, v$4, v$5;
		typ = t.common();
		if (typ.size > 4) {
			ptr = unsafe_New(typ);
			ptr.go$set(bits);
			return new Value.Ptr(typ, ptr, (((f | 2) >>> 0) | ((typ.Kind() >>> 0) << 4 >>> 0)) >>> 0);
		}
		w = 0;
		_ref = typ.Kind();
		if (_ref === 3) {
			new (go$ptrType(iword))(function() { return w; }, function(v) { w = v;; }).go$set((bits.low << 24 >> 24));
		} else if (_ref === 4) {
			new (go$ptrType(iword))(function() { return w; }, function(v$1) { w = v$1;; }).go$set((bits.low << 16 >> 16));
		} else if (_ref === 2 || _ref === 5) {
			new (go$ptrType(iword))(function() { return w; }, function(v$2) { w = v$2;; }).go$set((bits.low >> 0));
		} else if (_ref === 8) {
			new (go$ptrType(iword))(function() { return w; }, function(v$3) { w = v$3;; }).go$set((bits.low << 24 >>> 24));
		} else if (_ref === 9) {
			new (go$ptrType(iword))(function() { return w; }, function(v$4) { w = v$4;; }).go$set((bits.low << 16 >>> 16));
		} else if (_ref === 7 || _ref === 10 || _ref === 12) {
			new (go$ptrType(iword))(function() { return w; }, function(v$5) { w = v$5;; }).go$set((bits.low >>> 0));
		}
		return new Value.Ptr(typ, w, (f | ((typ.Kind() >>> 0) << 4 >>> 0)) >>> 0);
	};
	chanclose = function(ch) {
		go$notSupported(go$externalize("channels", Go$String));
		throw go$panic(new Go$String("unreachable"));
	};
	chanrecv = function(t, ch, nb) {
		var val, selected, received;
		val = 0;
		selected = false;
		received = false;
		go$notSupported(go$externalize("channels", Go$String));
		throw go$panic(new Go$String("unreachable"));
	};
	chansend = function(t, ch, val, nb) {
		go$notSupported(go$externalize("channels", Go$String));
		throw go$panic(new Go$String("unreachable"));
	};
	mapaccess = function(t, m, key) {
		var val, ok, k, entry, _tmp, _tmp$1, _tmp$2, _tmp$3;
		val = 0;
		ok = false;
		k = key;
		if (!(k.go$key === undefined)) {
			k = k.go$key();
		}
		entry = m[go$externalize(go$internalize(k, Go$String), Go$String)];
		if (entry === undefined) {
			_tmp = 0; _tmp$1 = false; val = _tmp; ok = _tmp$1;
			return [val, ok];
		}
		_tmp$2 = makeIword(t.Elem(), entry.v); _tmp$3 = true; val = _tmp$2; ok = _tmp$3;
		return [val, ok];
	};
	mapassign = function(t, m, key, val, ok) {
		var k, jsVal, newVal, entry;
		k = key;
		if (!(k.go$key === undefined)) {
			k = k.go$key();
		}
		if (!ok) {
			delete m[go$externalize(go$internalize(k, Go$String), Go$String)];
			return;
		}
		jsVal = val;
		if (t.Elem().Kind() === 25) {
			newVal = new (go$global.Object)();
			copyStruct(newVal, jsVal, t.Elem());
			jsVal = newVal;
		}
		entry = new (go$global.Object)();
		entry.k = go$externalize(key, iword);
		entry.v = jsVal;
		m[go$externalize(go$internalize(k, Go$String), Go$String)] = entry;
	};
	mapiterinit = function(t, m) {
		return new mapIter.Ptr(t, m, go$keys(go$externalize(m, iword)), 0);
	};
	mapiterkey = function(it) {
		var key, ok, iter, k, _tmp, x, _tmp$1;
		key = 0;
		ok = false;
		iter = it;
		k = iter.keys[(go$parseInt(iter.i) >> 0)];
		_tmp = makeIword((x = go$internalize(iter.t, go$emptyInterface), (x !== null && x.constructor === (go$ptrType(rtype)) ? x.go$val : go$typeAssertionFailed(x, (go$ptrType(rtype))))).Key(), iter.m[go$externalize(go$internalize(k, Go$String), Go$String)].k); _tmp$1 = true; key = _tmp; ok = _tmp$1;
		return [key, ok];
	};
	mapiternext = function(it) {
		var iter;
		iter = it;
		iter.i = (go$parseInt(iter.i) >> 0) + 1 >> 0;
	};
	maplen = function(m) {
		return go$parseInt(go$keys(go$externalize(m, iword)).length);
	};
	cvtDirect = function(v, typ) {
		var srcVal, _struct, val, k, _ref, slice;
		srcVal = v.iword();
		if (srcVal === jsType(v.typ).nil) {
			return (_struct = makeValue(typ, jsType(typ).nil, v.flag), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		}
		val = null;
		k = typ.Kind();
		_ref = k;
		switch (0) { default: if (_ref === 18) {
			val = new (jsType(typ))();
		} else if (_ref === 23) {
			slice = new (jsType(typ))(srcVal.array);
			slice.offset = srcVal.offset;
			slice.length = srcVal.length;
			slice.capacity = srcVal.capacity;
			val = go$newDataPointer(slice, jsType(PtrTo(typ)));
		} else if (_ref === 22) {
			if (typ.Elem().Kind() === 25) {
				if (go$interfaceIsEqual(typ.Elem(), v.typ.Elem())) {
					val = srcVal;
					break;
				}
				val = new (jsType(typ))();
				copyStruct(val, srcVal, typ.Elem());
				break;
			}
			val = new (jsType(typ))(srcVal.go$get, srcVal.go$set);
		} else if (_ref === 25) {
			val = new (jsType(typ).Ptr)();
			copyStruct(val, srcVal, typ);
		} else if (_ref === 17 || _ref === 19 || _ref === 20 || _ref === 21 || _ref === 24) {
			val = v.val;
		} else {
			throw go$panic(new ValueError.Ptr("reflect.Convert", k));
		} }
		return new Value.Ptr(typ.common(), val, (((v.flag & 3) >>> 0) | ((typ.Kind() >>> 0) << 4 >>> 0)) >>> 0);
	};
	methodReceiver = function(op, v, i) {
		var t, name, tt, x, m, ut, x$1, m$1, rcvr;
		t = (go$ptrType(rtype)).nil;
		name = "";
		if (v.typ.Kind() === 20) {
			tt = v.typ.interfaceType;
			if (i < 0 || i >= tt.methods.length) {
				throw go$panic(new Go$String("reflect: internal error: invalid method index"));
			}
			if (v.IsNil()) {
				throw go$panic(new Go$String("reflect: " + op + " of method on nil interface value"));
			}
			m = (x = tt.methods, ((i < 0 || i >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + i]));
			if (!(go$pointerIsEqual(m.pkgPath, (go$ptrType(Go$String)).nil))) {
				throw go$panic(new Go$String("reflect: " + op + " of unexported method"));
			}
			t = m.typ;
			name = m.name.go$get();
		} else {
			ut = v.typ.uncommonType.uncommon();
			if (ut === (go$ptrType(uncommonType)).nil || i < 0 || i >= ut.methods.length) {
				throw go$panic(new Go$String("reflect: internal error: invalid method index"));
			}
			m$1 = (x$1 = ut.methods, ((i < 0 || i >= x$1.length) ? go$throwRuntimeError("index out of range") : x$1.array[x$1.offset + i]));
			if (!(go$pointerIsEqual(m$1.pkgPath, (go$ptrType(Go$String)).nil))) {
				throw go$panic(new Go$String("reflect: " + op + " of unexported method"));
			}
			t = m$1.mtyp;
			name = go$internalize(jsType(v.typ).methods[i][0], Go$String);
		}
		rcvr = v.iword();
		if (isWrapped(v.typ)) {
			rcvr = new (jsType(v.typ))(rcvr);
		}
		return [t, rcvr[go$externalize(name, Go$String)], rcvr];
	};
	valueInterface = function(v, safe) {
		var _struct, _struct$1;
		if (v.flag === 0) {
			throw go$panic(new ValueError.Ptr("reflect.Value.Interface", 0));
		}
		if (safe && !((((v.flag & 1) >>> 0) === 0))) {
			throw go$panic(new Go$String("reflect.Value.Interface: cannot return value obtained from unexported field or method"));
		}
		if (!((((v.flag & 8) >>> 0) === 0))) {
			v = (_struct$1 = makeMethodValue("Interface", (_struct = v, new Value.Ptr(_struct.typ, _struct.val, _struct.flag))), new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag));
		}
		if (isWrapped(v.typ)) {
			return new (jsType(v.typ))(v.iword());
		}
		return v.iword();
	};
	ifaceE2I = function(t, src, dst) {
		dst.go$set(src);
	};
	methodName = function() {
		return "?FIXME?";
	};
	makeMethodValue = function(op, v) {
		var _tuple, _struct, fn, rcvr, fv;
		if (((v.flag & 8) >>> 0) === 0) {
			throw go$panic(new Go$String("reflect: internal error: invalid use of makePartialFunc"));
		}
		_tuple = methodReceiver(op, (_struct = v, new Value.Ptr(_struct.typ, _struct.val, _struct.flag)), (v.flag >> 0) >> 9 >> 0); fn = _tuple[1]; rcvr = _tuple[2];
		fv = (function() {
			return fn.apply(go$externalize(rcvr, iword), go$externalize(new (go$sliceType(js.Object))(go$global.Array.prototype.slice.call(arguments)), (go$sliceType(js.Object))));
		});
		return new Value.Ptr(v.Type().common(), fv, (((v.flag & 1) >>> 0) | 304) >>> 0);
	};
	uncommonType.Ptr.prototype.Method = function(i) {
		var m, t, x, p, fl, mt, name, fn, _struct, _struct$1;
		m = new Method.Ptr();
		t = this;
		if (t === (go$ptrType(uncommonType)).nil || i < 0 || i >= t.methods.length) {
			throw go$panic(new Go$String("reflect: Method index out of range"));
		}
		p = (x = t.methods, ((i < 0 || i >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + i]));
		if (!(go$pointerIsEqual(p.name, (go$ptrType(Go$String)).nil))) {
			m.Name = p.name.go$get();
		}
		fl = 304;
		if (!(go$pointerIsEqual(p.pkgPath, (go$ptrType(Go$String)).nil))) {
			m.PkgPath = p.pkgPath.go$get();
			fl = (fl | 1) >>> 0;
		}
		mt = p.typ;
		m.Type = mt;
		name = go$internalize(t.jsType.methods[i][0], Go$String);
		fn = (function(rcvr) {
			return rcvr[go$externalize(name, Go$String)].apply(rcvr, go$externalize(go$subslice(new (go$sliceType(js.Object))(go$global.Array.prototype.slice.call(arguments)), 1), (go$sliceType(js.Object))));
		});
		m.Func = new Value.Ptr(mt, fn, fl);
		m.Index = i;
		return (_struct = m, new Method.Ptr(_struct.Name, _struct.PkgPath, _struct.Type, (_struct$1 = _struct.Func, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag)), _struct.Index));
	};
	uncommonType.prototype.Method = function(i) { return this.go$val.Method(i); };
	Value.Ptr.prototype.iword = function() {
		var _struct, v, val, _ref, newVal;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		if (!((((v.flag & 2) >>> 0) === 0)) && !((v.typ.Kind() === 17)) && !((v.typ.Kind() === 25))) {
			val = v.val.go$get();
			if (!(val === null) && !(val.constructor === jsType(v.typ))) {
				_ref = v.typ.Kind();
				switch (0) { default: if (_ref === 11 || _ref === 6) {
					val = new (jsType(v.typ))(val.high, val.low);
				} else if (_ref === 15 || _ref === 16) {
					val = new (jsType(v.typ))(val.real, val.imag);
				} else if (_ref === 23) {
					if (val === val.constructor.nil) {
						val = jsType(v.typ).nil;
						break;
					}
					newVal = new (jsType(v.typ))(val.array);
					newVal.offset = val.offset;
					newVal.length = val.length;
					newVal.capacity = val.capacity;
					val = newVal;
				} }
			}
			return val;
		}
		return v.val;
	};
	Value.prototype.iword = function() { return this.go$val.iword(); };
	Value.Ptr.prototype.call = function(op, in$1) {
		var _struct, v, t, fn, rcvr, _tuple, _struct$1, isSlice, n, _ref, _i, _struct$2, x, i, _tmp, _tmp$1, xt, targ, m, _struct$3, slice, elem, i$1, x$1, _struct$4, x$2, xt$1, _struct$5, origIn, _struct$6, nin, nout, argsArray, _ref$1, _i$1, _struct$7, arg, i$2, results, _ref$2, _struct$8, ret, _ref$3, _i$2, i$3, _struct$9;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		t = v.typ;
		fn = 0;
		rcvr = 0;
		if (!((((v.flag & 8) >>> 0) === 0))) {
			_tuple = methodReceiver(op, (_struct$1 = v, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag)), (v.flag >> 0) >> 9 >> 0); t = _tuple[0]; fn = _tuple[1]; rcvr = _tuple[2];
		} else {
			fn = v.iword();
		}
		if (fn === 0) {
			throw go$panic(new Go$String("reflect.Value.Call: call of nil function"));
		}
		isSlice = op === "CallSlice";
		n = t.NumIn();
		if (isSlice) {
			if (!t.IsVariadic()) {
				throw go$panic(new Go$String("reflect: CallSlice of non-variadic function"));
			}
			if (in$1.length < n) {
				throw go$panic(new Go$String("reflect: CallSlice with too few input arguments"));
			}
			if (in$1.length > n) {
				throw go$panic(new Go$String("reflect: CallSlice with too many input arguments"));
			}
		} else {
			if (t.IsVariadic()) {
				n = n - 1 >> 0;
			}
			if (in$1.length < n) {
				throw go$panic(new Go$String("reflect: Call with too few input arguments"));
			}
			if (!t.IsVariadic() && in$1.length > n) {
				throw go$panic(new Go$String("reflect: Call with too many input arguments"));
			}
		}
		_ref = in$1;
		_i = 0;
		while (_i < _ref.length) {
			x = (_struct$2 = ((_i < 0 || _i >= _ref.length) ? go$throwRuntimeError("index out of range") : _ref.array[_ref.offset + _i]), new Value.Ptr(_struct$2.typ, _struct$2.val, _struct$2.flag));
			if (x.Kind() === 0) {
				throw go$panic(new Go$String("reflect: " + op + " using zero Value argument"));
			}
			_i++;
		}
		i = 0;
		while (i < n) {
			_tmp = ((i < 0 || i >= in$1.length) ? go$throwRuntimeError("index out of range") : in$1.array[in$1.offset + i]).Type(); _tmp$1 = t.In(i); xt = _tmp; targ = _tmp$1;
			if (!xt.AssignableTo(targ)) {
				throw go$panic(new Go$String("reflect: " + op + " using " + xt.String() + " as type " + targ.String()));
			}
			i = i + 1 >> 0;
		}
		if (!isSlice && t.IsVariadic()) {
			m = in$1.length - n >> 0;
			slice = (_struct$3 = MakeSlice(t.In(n), m, m), new Value.Ptr(_struct$3.typ, _struct$3.val, _struct$3.flag));
			elem = t.In(n).Elem();
			i$1 = 0;
			while (i$1 < m) {
				x$2 = (_struct$4 = (x$1 = n + i$1 >> 0, ((x$1 < 0 || x$1 >= in$1.length) ? go$throwRuntimeError("index out of range") : in$1.array[in$1.offset + x$1])), new Value.Ptr(_struct$4.typ, _struct$4.val, _struct$4.flag));
				xt$1 = x$2.Type();
				if (!xt$1.AssignableTo(elem)) {
					throw go$panic(new Go$String("reflect: cannot use " + xt$1.String() + " as type " + elem.String() + " in " + op));
				}
				slice.Index(i$1).Set((_struct$5 = x$2, new Value.Ptr(_struct$5.typ, _struct$5.val, _struct$5.flag)));
				i$1 = i$1 + 1 >> 0;
			}
			origIn = in$1;
			in$1 = (go$sliceType(Value)).make((n + 1 >> 0), 0, function() { return new Value.Ptr(); });
			go$copySlice(go$subslice(in$1, 0, n), origIn);
			(n < 0 || n >= in$1.length) ? go$throwRuntimeError("index out of range") : in$1.array[in$1.offset + n] = (_struct$6 = slice, new Value.Ptr(_struct$6.typ, _struct$6.val, _struct$6.flag));
		}
		nin = in$1.length;
		if (!((nin === t.NumIn()))) {
			throw go$panic(new Go$String("reflect.Value.Call: wrong argument count"));
		}
		nout = t.NumOut();
		argsArray = new (go$global.Array)(t.NumIn());
		_ref$1 = in$1;
		_i$1 = 0;
		while (_i$1 < _ref$1.length) {
			arg = (_struct$7 = ((_i$1 < 0 || _i$1 >= _ref$1.length) ? go$throwRuntimeError("index out of range") : _ref$1.array[_ref$1.offset + _i$1]), new Value.Ptr(_struct$7.typ, _struct$7.val, _struct$7.flag));
			i$2 = _i$1;
			argsArray[i$2] = go$externalize(arg.assignTo("reflect.Value.Call", t.In(i$2).common(), (go$ptrType(go$emptyInterface)).nil).iword(), iword);
			_i$1++;
		}
		results = fn.apply(go$externalize(rcvr, iword), argsArray);
		_ref$2 = nout;
		if (_ref$2 === 0) {
			return (go$sliceType(Value)).nil;
		} else if (_ref$2 === 1) {
			return new (go$sliceType(Value))([(_struct$8 = makeValue(t.Out(0), results, 0), new Value.Ptr(_struct$8.typ, _struct$8.val, _struct$8.flag))]);
		} else {
			ret = (go$sliceType(Value)).make(nout, 0, function() { return new Value.Ptr(); });
			_ref$3 = ret;
			_i$2 = 0;
			while (_i$2 < _ref$3.length) {
				i$3 = _i$2;
				(i$3 < 0 || i$3 >= ret.length) ? go$throwRuntimeError("index out of range") : ret.array[ret.offset + i$3] = (_struct$9 = makeValue(t.Out(i$3), results[i$3], 0), new Value.Ptr(_struct$9.typ, _struct$9.val, _struct$9.flag));
				_i$2++;
			}
			return ret;
		}
	};
	Value.prototype.call = function(op, in$1) { return this.go$val.call(op, in$1); };
	Value.Ptr.prototype.Cap = function() {
		var _struct, v, k, _ref;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 17) {
			return v.typ.Len();
		} else if (_ref === 23) {
			return go$parseInt(v.iword().capacity) >> 0;
		}
		throw go$panic(new ValueError.Ptr("reflect.Value.Cap", k));
	};
	Value.prototype.Cap = function() { return this.go$val.Cap(); };
	Value.Ptr.prototype.Elem = function() {
		var _struct, v, k, _ref, val, typ, _struct$1, val$1, tt, fl;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 20) {
			val = v.iword();
			if (val === null) {
				return new Value.Ptr((go$ptrType(rtype)).nil, 0, 0);
			}
			typ = reflectType(val.constructor);
			return (_struct$1 = makeValue(typ, val.go$val, (v.flag & 1) >>> 0), new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag));
		} else if (_ref === 22) {
			if (v.IsNil()) {
				return new Value.Ptr((go$ptrType(rtype)).nil, 0, 0);
			}
			val$1 = v.iword();
			tt = v.typ.ptrType;
			fl = (((((v.flag & 1) >>> 0) | 2) >>> 0) | 4) >>> 0;
			fl = (fl | (((tt.elem.Kind() >>> 0) << 4 >>> 0))) >>> 0;
			return new Value.Ptr(tt.elem, val$1, fl);
		} else {
			throw go$panic(new ValueError.Ptr("reflect.Value.Elem", k));
		}
	};
	Value.prototype.Elem = function() { return this.go$val.Elem(); };
	Value.Ptr.prototype.Field = function(i) {
		var _struct, v, tt, x, field, name, typ, fl, s, _struct$1;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(25);
		tt = v.typ.structType;
		if (i < 0 || i >= tt.fields.length) {
			throw go$panic(new Go$String("reflect: Field index out of range"));
		}
		field = (x = tt.fields, ((i < 0 || i >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + i]));
		name = go$internalize(jsType(v.typ).fields[i][0], Go$String);
		typ = field.typ;
		fl = (v.flag & 7) >>> 0;
		if (!(go$pointerIsEqual(field.pkgPath, (go$ptrType(Go$String)).nil))) {
			fl = (fl | 1) >>> 0;
		}
		fl = (fl | (((typ.Kind() >>> 0) << 4 >>> 0))) >>> 0;
		s = v.val;
		if (!((((fl & 2) >>> 0) === 0)) && !((typ.Kind() === 17)) && !((typ.Kind() === 25))) {
			return new Value.Ptr(typ, new (jsType(PtrTo(typ)))(go$externalize((function() {
				return s[go$externalize(name, Go$String)];
			}), (go$funcType([], [js.Object], false))), go$externalize((function(v$1) {
				s[go$externalize(name, Go$String)] = v$1;
			}), (go$funcType([js.Object], [], false)))), fl);
		}
		return (_struct$1 = makeValue(typ, s[go$externalize(name, Go$String)], fl), new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag));
	};
	Value.prototype.Field = function(i) { return this.go$val.Field(i); };
	Value.Ptr.prototype.Index = function(i) {
		var _struct, v, k, _ref, tt, typ, fl, a, _struct$1, s, tt$1, typ$1, fl$1, a$1, _struct$2, str, fl$2;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 17) {
			tt = v.typ.arrayType;
			if (i < 0 || i > (tt.len >> 0)) {
				throw go$panic(new Go$String("reflect: array index out of range"));
			}
			typ = tt.elem;
			fl = (v.flag & 7) >>> 0;
			fl = (fl | (((typ.Kind() >>> 0) << 4 >>> 0))) >>> 0;
			a = v.val;
			if (!((((fl & 2) >>> 0) === 0)) && !((typ.Kind() === 17)) && !((typ.Kind() === 25))) {
				return new Value.Ptr(typ, new (jsType(PtrTo(typ)))(go$externalize((function() {
					return a[i];
				}), (go$funcType([], [js.Object], false))), go$externalize((function(v$1) {
					a[i] = v$1;
				}), (go$funcType([js.Object], [], false)))), fl);
			}
			return (_struct$1 = makeValue(typ, a[i], fl), new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag));
		} else if (_ref === 23) {
			s = v.iword();
			if (i < 0 || i >= go$parseInt(s.length)) {
				throw go$panic(new Go$String("reflect: slice index out of range"));
			}
			tt$1 = v.typ.sliceType;
			typ$1 = tt$1.elem;
			fl$1 = (6 | ((v.flag & 1) >>> 0)) >>> 0;
			fl$1 = (fl$1 | (((typ$1.Kind() >>> 0) << 4 >>> 0))) >>> 0;
			i = i + ((go$parseInt(s.offset) >> 0)) >> 0;
			a$1 = s.array;
			if (!((((fl$1 & 2) >>> 0) === 0)) && !((typ$1.Kind() === 17)) && !((typ$1.Kind() === 25))) {
				return new Value.Ptr(typ$1, new (jsType(PtrTo(typ$1)))(go$externalize((function() {
					return a$1[i];
				}), (go$funcType([], [js.Object], false))), go$externalize((function(v$1) {
					a$1[i] = v$1;
				}), (go$funcType([js.Object], [], false)))), fl$1);
			}
			return (_struct$2 = makeValue(typ$1, a$1[i], fl$1), new Value.Ptr(_struct$2.typ, _struct$2.val, _struct$2.flag));
		} else if (_ref === 24) {
			str = v.val.go$get();
			if (i < 0 || i >= str.length) {
				throw go$panic(new Go$String("reflect: string index out of range"));
			}
			fl$2 = (((v.flag & 1) >>> 0) | 128) >>> 0;
			return new Value.Ptr(uint8Type, (str.charCodeAt(i) >>> 0), fl$2);
		} else {
			throw go$panic(new ValueError.Ptr("reflect.Value.Index", k));
		}
	};
	Value.prototype.Index = function(i) { return this.go$val.Index(i); };
	Value.Ptr.prototype.IsNil = function() {
		var _struct, v, k, _ref;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 18 || _ref === 22 || _ref === 23) {
			return v.iword() === jsType(v.typ).nil;
		} else if (_ref === 19) {
			return v.iword() === go$throwNilPointerError;
		} else if (_ref === 21) {
			return v.iword() === false;
		} else if (_ref === 20) {
			return v.iword() === null;
		} else {
			throw go$panic(new ValueError.Ptr("reflect.Value.IsNil", k));
		}
	};
	Value.prototype.IsNil = function() { return this.go$val.IsNil(); };
	Value.Ptr.prototype.Len = function() {
		var _struct, v, k, _ref;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 17 || _ref === 23 || _ref === 24) {
			return go$parseInt(v.iword().length);
		} else if (_ref === 21) {
			return go$parseInt(go$keys(go$externalize(v.iword(), iword)).length);
		} else {
			throw go$panic(new ValueError.Ptr("reflect.Value.Len", k));
		}
	};
	Value.prototype.Len = function() { return this.go$val.Len(); };
	Value.Ptr.prototype.Pointer = function() {
		var _struct, v, k, _ref;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 18 || _ref === 21 || _ref === 22 || _ref === 23 || _ref === 26) {
			if (v.IsNil()) {
				return 0;
			}
			return v.iword();
		} else if (_ref === 19) {
			if (v.IsNil()) {
				return 0;
			}
			return 1;
		} else {
			throw go$panic(new ValueError.Ptr("reflect.Value.Pointer", k));
		}
	};
	Value.prototype.Pointer = function() { return this.go$val.Pointer(); };
	Value.Ptr.prototype.Set = function(x) {
		var _struct, v, _ref, _struct$1;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBeAssignable();
		(new flag(x.flag)).mustBeExported();
		if (!((((v.flag & 2) >>> 0) === 0))) {
			_ref = v.typ.Kind();
			if (_ref === 17) {
				go$copyArray(go$externalize(v.val, Go$UnsafePointer), go$externalize(x.val, Go$UnsafePointer));
			} else if (_ref === 20) {
				v.val.go$set(valueInterface((_struct$1 = x, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag)), false));
			} else if (_ref === 25) {
				copyStruct(v.val, x.val, v.typ);
			} else {
				v.val.go$set(go$externalize(x.iword(), iword));
			}
			return;
		}
		v.val = x.val;
	};
	Value.prototype.Set = function(x) { return this.go$val.Set(x); };
	Value.Ptr.prototype.SetCap = function(n) {
		var _struct, v, s, newSlice;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBeAssignable();
		(new flag(v.flag)).mustBe(23);
		s = v.val.go$get();
		if (n < go$parseInt(s.length) || n > (go$parseInt(s.capacity) >> 0)) {
			throw go$panic(new Go$String("reflect: slice capacity out of range in SetCap"));
		}
		newSlice = new (jsType(v.typ))(s.array);
		newSlice.offset = s.offset;
		newSlice.length = s.length;
		newSlice.capacity = n;
		v.val.go$set(newSlice);
	};
	Value.prototype.SetCap = function(n) { return this.go$val.SetCap(n); };
	Value.Ptr.prototype.SetLen = function(n) {
		var _struct, v, s, newSlice;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBeAssignable();
		(new flag(v.flag)).mustBe(23);
		s = v.val.go$get();
		if (n < 0 || n > (go$parseInt(s.capacity) >> 0)) {
			throw go$panic(new Go$String("reflect: slice length out of range in SetLen"));
		}
		newSlice = new (jsType(v.typ))(s.array);
		newSlice.offset = s.offset;
		newSlice.length = n;
		newSlice.capacity = s.capacity;
		v.val.go$set(newSlice);
	};
	Value.prototype.SetLen = function(n) { return this.go$val.SetLen(n); };
	Value.Ptr.prototype.Slice = function(i, j) {
		var _struct, v, cap, typ, s, kind, _ref, tt, str, _struct$1, _struct$2;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		cap = 0;
		typ = null;
		s = null;
		kind = (new flag(v.flag)).kind();
		_ref = kind;
		if (_ref === 17) {
			if (((v.flag & 4) >>> 0) === 0) {
				throw go$panic(new Go$String("reflect.Value.Slice: slice of unaddressable array"));
			}
			tt = v.typ.arrayType;
			cap = (tt.len >> 0);
			typ = SliceOf(tt.elem);
			s = new (jsType(typ))(go$externalize(v.iword(), iword));
		} else if (_ref === 23) {
			typ = v.typ;
			s = v.iword();
			cap = go$parseInt(s.capacity) >> 0;
		} else if (_ref === 24) {
			str = v.val.go$get();
			if (i < 0 || j < i || j > str.length) {
				throw go$panic(new Go$String("reflect.Value.Slice: string slice index out of bounds"));
			}
			return (_struct$1 = ValueOf(new Go$String(str.substring(i, j))), new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag));
		} else {
			throw go$panic(new ValueError.Ptr("reflect.Value.Slice", kind));
		}
		if (i < 0 || j < i || j > cap) {
			throw go$panic(new Go$String("reflect.Value.Slice: slice index out of bounds"));
		}
		return (_struct$2 = makeValue(typ, go$subslice(s, i, j), (v.flag & 1) >>> 0), new Value.Ptr(_struct$2.typ, _struct$2.val, _struct$2.flag));
	};
	Value.prototype.Slice = function(i, j) { return this.go$val.Slice(i, j); };
	Value.Ptr.prototype.Slice3 = function(i, j, k) {
		var _struct, v, cap, typ, s, kind, _ref, tt, _struct$1;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		cap = 0;
		typ = null;
		s = null;
		kind = (new flag(v.flag)).kind();
		_ref = kind;
		if (_ref === 17) {
			if (((v.flag & 4) >>> 0) === 0) {
				throw go$panic(new Go$String("reflect.Value.Slice: slice of unaddressable array"));
			}
			tt = v.typ.arrayType;
			cap = (tt.len >> 0);
			typ = SliceOf(tt.elem);
			s = new (jsType(typ))(go$externalize(v.iword(), iword));
		} else if (_ref === 23) {
			typ = v.typ;
			s = v.iword();
			cap = go$parseInt(s.capacity) >> 0;
		} else {
			throw go$panic(new ValueError.Ptr("reflect.Value.Slice3", kind));
		}
		if (i < 0 || j < i || k < j || k > cap) {
			throw go$panic(new Go$String("reflect.Value.Slice3: slice index out of bounds"));
		}
		return (_struct$1 = makeValue(typ, go$subslice(s, i, j, k), (v.flag & 1) >>> 0), new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag));
	};
	Value.prototype.Slice3 = function(i, j, k) { return this.go$val.Slice3(i, j, k); };
	Kind.prototype.String = function() {
		var k;
		k = this.go$val;
		if ((k >> 0) < kindNames.length) {
			return ((k < 0 || k >= kindNames.length) ? go$throwRuntimeError("index out of range") : kindNames.array[kindNames.offset + k]);
		}
		return "kind" + strconv.Itoa((k >> 0));
	};
	go$ptrType(Kind).prototype.String = function() { return new Kind(this.go$get()).String(); };
	uncommonType.Ptr.prototype.uncommon = function() {
		var t;
		t = this;
		return t;
	};
	uncommonType.prototype.uncommon = function() { return this.go$val.uncommon(); };
	uncommonType.Ptr.prototype.PkgPath = function() {
		var t;
		t = this;
		if (t === (go$ptrType(uncommonType)).nil || go$pointerIsEqual(t.pkgPath, (go$ptrType(Go$String)).nil)) {
			return "";
		}
		return t.pkgPath.go$get();
	};
	uncommonType.prototype.PkgPath = function() { return this.go$val.PkgPath(); };
	uncommonType.Ptr.prototype.Name = function() {
		var t;
		t = this;
		if (t === (go$ptrType(uncommonType)).nil || go$pointerIsEqual(t.name, (go$ptrType(Go$String)).nil)) {
			return "";
		}
		return t.name.go$get();
	};
	uncommonType.prototype.Name = function() { return this.go$val.Name(); };
	rtype.Ptr.prototype.String = function() {
		var t;
		t = this;
		return t.string.go$get();
	};
	rtype.prototype.String = function() { return this.go$val.String(); };
	rtype.Ptr.prototype.Size = function() {
		var t;
		t = this;
		return t.size;
	};
	rtype.prototype.Size = function() { return this.go$val.Size(); };
	rtype.Ptr.prototype.Bits = function() {
		var t, k, x;
		t = this;
		if (t === (go$ptrType(rtype)).nil) {
			throw go$panic(new Go$String("reflect: Bits of nil Type"));
		}
		k = t.Kind();
		if (k < 2 || k > 16) {
			throw go$panic(new Go$String("reflect: Bits of non-arithmetic Type " + t.String()));
		}
		return (x = (t.size >> 0), (((x >>> 16 << 16) * 8 >> 0) + (x << 16 >>> 16) * 8) >> 0);
	};
	rtype.prototype.Bits = function() { return this.go$val.Bits(); };
	rtype.Ptr.prototype.Align = function() {
		var t;
		t = this;
		return (t.align >> 0);
	};
	rtype.prototype.Align = function() { return this.go$val.Align(); };
	rtype.Ptr.prototype.FieldAlign = function() {
		var t;
		t = this;
		return (t.fieldAlign >> 0);
	};
	rtype.prototype.FieldAlign = function() { return this.go$val.FieldAlign(); };
	rtype.Ptr.prototype.Kind = function() {
		var t;
		t = this;
		return (((t.kind & 127) >>> 0) >>> 0);
	};
	rtype.prototype.Kind = function() { return this.go$val.Kind(); };
	rtype.Ptr.prototype.common = function() {
		var t;
		t = this;
		return t;
	};
	rtype.prototype.common = function() { return this.go$val.common(); };
	uncommonType.Ptr.prototype.NumMethod = function() {
		var t;
		t = this;
		if (t === (go$ptrType(uncommonType)).nil) {
			return 0;
		}
		return t.methods.length;
	};
	uncommonType.prototype.NumMethod = function() { return this.go$val.NumMethod(); };
	uncommonType.Ptr.prototype.MethodByName = function(name) {
		var m, ok, t, _struct, _struct$1, p, _ref, _i, i, x, _tmp, _struct$2, _struct$3, _tmp$1, _struct$4, _struct$5, _struct$6, _struct$7;
		m = new Method.Ptr();
		ok = false;
		t = this;
		if (t === (go$ptrType(uncommonType)).nil) {
			return [(_struct = m, new Method.Ptr(_struct.Name, _struct.PkgPath, _struct.Type, (_struct$1 = _struct.Func, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag)), _struct.Index)), ok];
		}
		p = (go$ptrType(method)).nil;
		_ref = t.methods;
		_i = 0;
		while (_i < _ref.length) {
			i = _i;
			p = (x = t.methods, ((i < 0 || i >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + i]));
			if (!(go$pointerIsEqual(p.name, (go$ptrType(Go$String)).nil)) && p.name.go$get() === name) {
				_tmp = (_struct$2 = t.Method(i), new Method.Ptr(_struct$2.Name, _struct$2.PkgPath, _struct$2.Type, (_struct$3 = _struct$2.Func, new Value.Ptr(_struct$3.typ, _struct$3.val, _struct$3.flag)), _struct$2.Index)); _tmp$1 = true; m = _tmp; ok = _tmp$1;
				return [(_struct$4 = m, new Method.Ptr(_struct$4.Name, _struct$4.PkgPath, _struct$4.Type, (_struct$5 = _struct$4.Func, new Value.Ptr(_struct$5.typ, _struct$5.val, _struct$5.flag)), _struct$4.Index)), ok];
			}
			_i++;
		}
		return [(_struct$6 = m, new Method.Ptr(_struct$6.Name, _struct$6.PkgPath, _struct$6.Type, (_struct$7 = _struct$6.Func, new Value.Ptr(_struct$7.typ, _struct$7.val, _struct$7.flag)), _struct$6.Index)), ok];
	};
	uncommonType.prototype.MethodByName = function(name) { return this.go$val.MethodByName(name); };
	rtype.Ptr.prototype.NumMethod = function() {
		var t, tt;
		t = this;
		if (t.Kind() === 20) {
			tt = t.interfaceType;
			return tt.NumMethod();
		}
		return t.uncommonType.NumMethod();
	};
	rtype.prototype.NumMethod = function() { return this.go$val.NumMethod(); };
	rtype.Ptr.prototype.Method = function(i) {
		var m, t, tt, _struct, _struct$1, _struct$2, _struct$3, _struct$4, _struct$5, _struct$6, _struct$7;
		m = new Method.Ptr();
		t = this;
		if (t.Kind() === 20) {
			tt = t.interfaceType;
			m = (_struct = tt.Method(i), new Method.Ptr(_struct.Name, _struct.PkgPath, _struct.Type, (_struct$1 = _struct.Func, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag)), _struct.Index));
			return (_struct$2 = m, new Method.Ptr(_struct$2.Name, _struct$2.PkgPath, _struct$2.Type, (_struct$3 = _struct$2.Func, new Value.Ptr(_struct$3.typ, _struct$3.val, _struct$3.flag)), _struct$2.Index));
		}
		m = (_struct$4 = t.uncommonType.Method(i), new Method.Ptr(_struct$4.Name, _struct$4.PkgPath, _struct$4.Type, (_struct$5 = _struct$4.Func, new Value.Ptr(_struct$5.typ, _struct$5.val, _struct$5.flag)), _struct$4.Index));
		return (_struct$6 = m, new Method.Ptr(_struct$6.Name, _struct$6.PkgPath, _struct$6.Type, (_struct$7 = _struct$6.Func, new Value.Ptr(_struct$7.typ, _struct$7.val, _struct$7.flag)), _struct$6.Index));
	};
	rtype.prototype.Method = function(i) { return this.go$val.Method(i); };
	rtype.Ptr.prototype.MethodByName = function(name) {
		var m, ok, t, tt, _tuple, _struct, _struct$1, _struct$2, _struct$3, _tuple$1, _struct$4, _struct$5, _struct$6, _struct$7;
		m = new Method.Ptr();
		ok = false;
		t = this;
		if (t.Kind() === 20) {
			tt = t.interfaceType;
			_tuple = tt.MethodByName(name); m = (_struct = _tuple[0], new Method.Ptr(_struct.Name, _struct.PkgPath, _struct.Type, (_struct$1 = _struct.Func, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag)), _struct.Index)); ok = _tuple[1];
			return [(_struct$2 = m, new Method.Ptr(_struct$2.Name, _struct$2.PkgPath, _struct$2.Type, (_struct$3 = _struct$2.Func, new Value.Ptr(_struct$3.typ, _struct$3.val, _struct$3.flag)), _struct$2.Index)), ok];
		}
		_tuple$1 = t.uncommonType.MethodByName(name); m = (_struct$4 = _tuple$1[0], new Method.Ptr(_struct$4.Name, _struct$4.PkgPath, _struct$4.Type, (_struct$5 = _struct$4.Func, new Value.Ptr(_struct$5.typ, _struct$5.val, _struct$5.flag)), _struct$4.Index)); ok = _tuple$1[1];
		return [(_struct$6 = m, new Method.Ptr(_struct$6.Name, _struct$6.PkgPath, _struct$6.Type, (_struct$7 = _struct$6.Func, new Value.Ptr(_struct$7.typ, _struct$7.val, _struct$7.flag)), _struct$6.Index)), ok];
	};
	rtype.prototype.MethodByName = function(name) { return this.go$val.MethodByName(name); };
	rtype.Ptr.prototype.PkgPath = function() {
		var t;
		t = this;
		return t.uncommonType.PkgPath();
	};
	rtype.prototype.PkgPath = function() { return this.go$val.PkgPath(); };
	rtype.Ptr.prototype.Name = function() {
		var t;
		t = this;
		return t.uncommonType.Name();
	};
	rtype.prototype.Name = function() { return this.go$val.Name(); };
	rtype.Ptr.prototype.ChanDir = function() {
		var t, tt;
		t = this;
		if (!((t.Kind() === 18))) {
			throw go$panic(new Go$String("reflect: ChanDir of non-chan type"));
		}
		tt = t.chanType;
		return (tt.dir >> 0);
	};
	rtype.prototype.ChanDir = function() { return this.go$val.ChanDir(); };
	rtype.Ptr.prototype.IsVariadic = function() {
		var t, tt;
		t = this;
		if (!((t.Kind() === 19))) {
			throw go$panic(new Go$String("reflect: IsVariadic of non-func type"));
		}
		tt = t.funcType;
		return tt.dotdotdot;
	};
	rtype.prototype.IsVariadic = function() { return this.go$val.IsVariadic(); };
	rtype.Ptr.prototype.Elem = function() {
		var t, _ref, tt, tt$1, tt$2, tt$3, tt$4;
		t = this;
		_ref = t.Kind();
		if (_ref === 17) {
			tt = t.arrayType;
			return toType(tt.elem);
		} else if (_ref === 18) {
			tt$1 = t.chanType;
			return toType(tt$1.elem);
		} else if (_ref === 21) {
			tt$2 = t.mapType;
			return toType(tt$2.elem);
		} else if (_ref === 22) {
			tt$3 = t.ptrType;
			return toType(tt$3.elem);
		} else if (_ref === 23) {
			tt$4 = t.sliceType;
			return toType(tt$4.elem);
		}
		throw go$panic(new Go$String("reflect: Elem of invalid type"));
	};
	rtype.prototype.Elem = function() { return this.go$val.Elem(); };
	rtype.Ptr.prototype.Field = function(i) {
		var t, tt, _struct;
		t = this;
		if (!((t.Kind() === 25))) {
			throw go$panic(new Go$String("reflect: Field of non-struct type"));
		}
		tt = t.structType;
		return (_struct = tt.Field(i), new StructField.Ptr(_struct.Name, _struct.PkgPath, _struct.Type, _struct.Tag, _struct.Offset, _struct.Index, _struct.Anonymous));
	};
	rtype.prototype.Field = function(i) { return this.go$val.Field(i); };
	rtype.Ptr.prototype.FieldByIndex = function(index) {
		var t, tt, _struct;
		t = this;
		if (!((t.Kind() === 25))) {
			throw go$panic(new Go$String("reflect: FieldByIndex of non-struct type"));
		}
		tt = t.structType;
		return (_struct = tt.FieldByIndex(index), new StructField.Ptr(_struct.Name, _struct.PkgPath, _struct.Type, _struct.Tag, _struct.Offset, _struct.Index, _struct.Anonymous));
	};
	rtype.prototype.FieldByIndex = function(index) { return this.go$val.FieldByIndex(index); };
	rtype.Ptr.prototype.FieldByName = function(name) {
		var t, tt;
		t = this;
		if (!((t.Kind() === 25))) {
			throw go$panic(new Go$String("reflect: FieldByName of non-struct type"));
		}
		tt = t.structType;
		return tt.FieldByName(name);
	};
	rtype.prototype.FieldByName = function(name) { return this.go$val.FieldByName(name); };
	rtype.Ptr.prototype.FieldByNameFunc = function(match) {
		var t, tt;
		t = this;
		if (!((t.Kind() === 25))) {
			throw go$panic(new Go$String("reflect: FieldByNameFunc of non-struct type"));
		}
		tt = t.structType;
		return tt.FieldByNameFunc(match);
	};
	rtype.prototype.FieldByNameFunc = function(match) { return this.go$val.FieldByNameFunc(match); };
	rtype.Ptr.prototype.In = function(i) {
		var t, tt, x;
		t = this;
		if (!((t.Kind() === 19))) {
			throw go$panic(new Go$String("reflect: In of non-func type"));
		}
		tt = t.funcType;
		return toType((x = tt.in$2, ((i < 0 || i >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + i])));
	};
	rtype.prototype.In = function(i) { return this.go$val.In(i); };
	rtype.Ptr.prototype.Key = function() {
		var t, tt;
		t = this;
		if (!((t.Kind() === 21))) {
			throw go$panic(new Go$String("reflect: Key of non-map type"));
		}
		tt = t.mapType;
		return toType(tt.key);
	};
	rtype.prototype.Key = function() { return this.go$val.Key(); };
	rtype.Ptr.prototype.Len = function() {
		var t, tt;
		t = this;
		if (!((t.Kind() === 17))) {
			throw go$panic(new Go$String("reflect: Len of non-array type"));
		}
		tt = t.arrayType;
		return (tt.len >> 0);
	};
	rtype.prototype.Len = function() { return this.go$val.Len(); };
	rtype.Ptr.prototype.NumField = function() {
		var t, tt;
		t = this;
		if (!((t.Kind() === 25))) {
			throw go$panic(new Go$String("reflect: NumField of non-struct type"));
		}
		tt = t.structType;
		return tt.fields.length;
	};
	rtype.prototype.NumField = function() { return this.go$val.NumField(); };
	rtype.Ptr.prototype.NumIn = function() {
		var t, tt;
		t = this;
		if (!((t.Kind() === 19))) {
			throw go$panic(new Go$String("reflect: NumIn of non-func type"));
		}
		tt = t.funcType;
		return tt.in$2.length;
	};
	rtype.prototype.NumIn = function() { return this.go$val.NumIn(); };
	rtype.Ptr.prototype.NumOut = function() {
		var t, tt;
		t = this;
		if (!((t.Kind() === 19))) {
			throw go$panic(new Go$String("reflect: NumOut of non-func type"));
		}
		tt = t.funcType;
		return tt.out.length;
	};
	rtype.prototype.NumOut = function() { return this.go$val.NumOut(); };
	rtype.Ptr.prototype.Out = function(i) {
		var t, tt, x;
		t = this;
		if (!((t.Kind() === 19))) {
			throw go$panic(new Go$String("reflect: Out of non-func type"));
		}
		tt = t.funcType;
		return toType((x = tt.out, ((i < 0 || i >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + i])));
	};
	rtype.prototype.Out = function(i) { return this.go$val.Out(i); };
	ChanDir.prototype.String = function() {
		var d, _ref;
		d = this.go$val;
		_ref = d;
		if (_ref === 2) {
			return "chan<-";
		} else if (_ref === 1) {
			return "<-chan";
		} else if (_ref === 3) {
			return "chan";
		}
		return "ChanDir" + strconv.Itoa((d >> 0));
	};
	go$ptrType(ChanDir).prototype.String = function() { return new ChanDir(this.go$get()).String(); };
	interfaceType.Ptr.prototype.Method = function(i) {
		var m, t, _struct, _struct$1, x, p, _struct$2, _struct$3;
		m = new Method.Ptr();
		t = this;
		if (i < 0 || i >= t.methods.length) {
			return (_struct = m, new Method.Ptr(_struct.Name, _struct.PkgPath, _struct.Type, (_struct$1 = _struct.Func, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag)), _struct.Index));
		}
		p = (x = t.methods, ((i < 0 || i >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + i]));
		m.Name = p.name.go$get();
		if (!(go$pointerIsEqual(p.pkgPath, (go$ptrType(Go$String)).nil))) {
			m.PkgPath = p.pkgPath.go$get();
		}
		m.Type = toType(p.typ);
		m.Index = i;
		return (_struct$2 = m, new Method.Ptr(_struct$2.Name, _struct$2.PkgPath, _struct$2.Type, (_struct$3 = _struct$2.Func, new Value.Ptr(_struct$3.typ, _struct$3.val, _struct$3.flag)), _struct$2.Index));
	};
	interfaceType.prototype.Method = function(i) { return this.go$val.Method(i); };
	interfaceType.Ptr.prototype.NumMethod = function() {
		var t;
		t = this;
		return t.methods.length;
	};
	interfaceType.prototype.NumMethod = function() { return this.go$val.NumMethod(); };
	interfaceType.Ptr.prototype.MethodByName = function(name) {
		var m, ok, t, _struct, _struct$1, p, _ref, _i, i, x, _tmp, _struct$2, _struct$3, _tmp$1, _struct$4, _struct$5, _struct$6, _struct$7;
		m = new Method.Ptr();
		ok = false;
		t = this;
		if (t === (go$ptrType(interfaceType)).nil) {
			return [(_struct = m, new Method.Ptr(_struct.Name, _struct.PkgPath, _struct.Type, (_struct$1 = _struct.Func, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag)), _struct.Index)), ok];
		}
		p = (go$ptrType(imethod)).nil;
		_ref = t.methods;
		_i = 0;
		while (_i < _ref.length) {
			i = _i;
			p = (x = t.methods, ((i < 0 || i >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + i]));
			if (p.name.go$get() === name) {
				_tmp = (_struct$2 = t.Method(i), new Method.Ptr(_struct$2.Name, _struct$2.PkgPath, _struct$2.Type, (_struct$3 = _struct$2.Func, new Value.Ptr(_struct$3.typ, _struct$3.val, _struct$3.flag)), _struct$2.Index)); _tmp$1 = true; m = _tmp; ok = _tmp$1;
				return [(_struct$4 = m, new Method.Ptr(_struct$4.Name, _struct$4.PkgPath, _struct$4.Type, (_struct$5 = _struct$4.Func, new Value.Ptr(_struct$5.typ, _struct$5.val, _struct$5.flag)), _struct$4.Index)), ok];
			}
			_i++;
		}
		return [(_struct$6 = m, new Method.Ptr(_struct$6.Name, _struct$6.PkgPath, _struct$6.Type, (_struct$7 = _struct$6.Func, new Value.Ptr(_struct$7.typ, _struct$7.val, _struct$7.flag)), _struct$6.Index)), ok];
	};
	interfaceType.prototype.MethodByName = function(name) { return this.go$val.MethodByName(name); };
	StructTag.prototype.Get = function(key) {
		var tag, i, name, qvalue, _tuple, value;
		tag = this.go$val;
		while (!(tag === "")) {
			i = 0;
			while (i < tag.length && (tag.charCodeAt(i) === 32)) {
				i = i + 1 >> 0;
			}
			tag = tag.substring(i);
			if (tag === "") {
				break;
			}
			i = 0;
			while (i < tag.length && !((tag.charCodeAt(i) === 32)) && !((tag.charCodeAt(i) === 58)) && !((tag.charCodeAt(i) === 34))) {
				i = i + 1 >> 0;
			}
			if ((i + 1 >> 0) >= tag.length || !((tag.charCodeAt(i) === 58)) || !((tag.charCodeAt((i + 1 >> 0)) === 34))) {
				break;
			}
			name = tag.substring(0, i);
			tag = tag.substring((i + 1 >> 0));
			i = 1;
			while (i < tag.length && !((tag.charCodeAt(i) === 34))) {
				if (tag.charCodeAt(i) === 92) {
					i = i + 1 >> 0;
				}
				i = i + 1 >> 0;
			}
			if (i >= tag.length) {
				break;
			}
			qvalue = tag.substring(0, (i + 1 >> 0));
			tag = tag.substring((i + 1 >> 0));
			if (key === name) {
				_tuple = strconv.Unquote(qvalue); value = _tuple[0];
				return value;
			}
		}
		return "";
	};
	go$ptrType(StructTag).prototype.Get = function(key) { return new StructTag(this.go$get()).Get(key); };
	structType.Ptr.prototype.Field = function(i) {
		var f, t, _struct, x, p, t$1, _struct$1;
		f = new StructField.Ptr();
		t = this;
		if (i < 0 || i >= t.fields.length) {
			return (_struct = f, new StructField.Ptr(_struct.Name, _struct.PkgPath, _struct.Type, _struct.Tag, _struct.Offset, _struct.Index, _struct.Anonymous));
		}
		p = (x = t.fields, ((i < 0 || i >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + i]));
		f.Type = toType(p.typ);
		if (!(go$pointerIsEqual(p.name, (go$ptrType(Go$String)).nil))) {
			f.Name = p.name.go$get();
		} else {
			t$1 = f.Type;
			if (t$1.Kind() === 22) {
				t$1 = t$1.Elem();
			}
			f.Name = t$1.Name();
			f.Anonymous = true;
		}
		if (!(go$pointerIsEqual(p.pkgPath, (go$ptrType(Go$String)).nil))) {
			f.PkgPath = p.pkgPath.go$get();
		}
		if (!(go$pointerIsEqual(p.tag, (go$ptrType(Go$String)).nil))) {
			f.Tag = p.tag.go$get();
		}
		f.Offset = p.offset;
		f.Index = new (go$sliceType(Go$Int))([i]);
		return (_struct$1 = f, new StructField.Ptr(_struct$1.Name, _struct$1.PkgPath, _struct$1.Type, _struct$1.Tag, _struct$1.Offset, _struct$1.Index, _struct$1.Anonymous));
	};
	structType.prototype.Field = function(i) { return this.go$val.Field(i); };
	structType.Ptr.prototype.FieldByIndex = function(index) {
		var f, t, _ref, _i, x, i, ft, _struct, _struct$1;
		f = new StructField.Ptr();
		t = this;
		f.Type = toType(t.rtype);
		_ref = index;
		_i = 0;
		while (_i < _ref.length) {
			x = ((_i < 0 || _i >= _ref.length) ? go$throwRuntimeError("index out of range") : _ref.array[_ref.offset + _i]);
			i = _i;
			if (i > 0) {
				ft = f.Type;
				if ((ft.Kind() === 22) && (ft.Elem().Kind() === 25)) {
					ft = ft.Elem();
				}
				f.Type = ft;
			}
			f = (_struct = f.Type.Field(x), new StructField.Ptr(_struct.Name, _struct.PkgPath, _struct.Type, _struct.Tag, _struct.Offset, _struct.Index, _struct.Anonymous));
			_i++;
		}
		return (_struct$1 = f, new StructField.Ptr(_struct$1.Name, _struct$1.PkgPath, _struct$1.Type, _struct$1.Tag, _struct$1.Offset, _struct$1.Index, _struct$1.Anonymous));
	};
	structType.prototype.FieldByIndex = function(index) { return this.go$val.FieldByIndex(index); };
	structType.Ptr.prototype.FieldByNameFunc = function(match) {
		var result, ok, t, current, next, nextCount, _map, _key, visited, _tmp, _tmp$1, count, _ref, _i, _struct, scan, t$1, _entry, _key$1, _ref$1, _i$1, i, x, f, fname, ntyp, _entry$1, _tmp$2, _tmp$3, _struct$1, _struct$2, styp, _entry$2, _key$2, _map$1, _key$3, _key$4, _entry$3, _key$5, index, _struct$3;
		result = new StructField.Ptr();
		ok = false;
		t = this;
		current = new (go$sliceType(fieldScan))([]);
		next = new (go$sliceType(fieldScan))([new fieldScan.Ptr(t, (go$sliceType(Go$Int)).nil)]);
		nextCount = false;
		visited = (_map = new Go$Map(), _map);
		while (next.length > 0) {
			_tmp = next; _tmp$1 = go$subslice(current, 0, 0); current = _tmp; next = _tmp$1;
			count = nextCount;
			nextCount = false;
			_ref = current;
			_i = 0;
			while (_i < _ref.length) {
				scan = (_struct = ((_i < 0 || _i >= _ref.length) ? go$throwRuntimeError("index out of range") : _ref.array[_ref.offset + _i]), new fieldScan.Ptr(_struct.typ, _struct.index));
				t$1 = scan.typ;
				if ((_entry = visited[t$1.go$key()], _entry !== undefined ? _entry.v : false)) {
					_i++;
					continue;
				}
				_key$1 = t$1; (visited || go$throwRuntimeError("assignment to entry in nil map"))[_key$1.go$key()] = { k: _key$1, v: true };
				_ref$1 = t$1.fields;
				_i$1 = 0;
				while (_i$1 < _ref$1.length) {
					i = _i$1;
					f = (x = t$1.fields, ((i < 0 || i >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + i]));
					fname = "";
					ntyp = (go$ptrType(rtype)).nil;
					if (!(go$pointerIsEqual(f.name, (go$ptrType(Go$String)).nil))) {
						fname = f.name.go$get();
					} else {
						ntyp = f.typ;
						if (ntyp.Kind() === 22) {
							ntyp = ntyp.Elem().common();
						}
						fname = ntyp.Name();
					}
					if (match(fname)) {
						if ((_entry$1 = count[t$1.go$key()], _entry$1 !== undefined ? _entry$1.v : 0) > 1 || ok) {
							_tmp$2 = new StructField.Ptr("", "", null, "", 0, (go$sliceType(Go$Int)).nil, false); _tmp$3 = false; result = _tmp$2; ok = _tmp$3;
							return [(_struct$1 = result, new StructField.Ptr(_struct$1.Name, _struct$1.PkgPath, _struct$1.Type, _struct$1.Tag, _struct$1.Offset, _struct$1.Index, _struct$1.Anonymous)), ok];
						}
						result = (_struct$2 = t$1.Field(i), new StructField.Ptr(_struct$2.Name, _struct$2.PkgPath, _struct$2.Type, _struct$2.Tag, _struct$2.Offset, _struct$2.Index, _struct$2.Anonymous));
						result.Index = (go$sliceType(Go$Int)).nil;
						result.Index = go$appendSlice(result.Index, scan.index);
						result.Index = go$append(result.Index, i);
						ok = true;
						_i$1++;
						continue;
					}
					if (ok || ntyp === (go$ptrType(rtype)).nil || !((ntyp.Kind() === 25))) {
						_i$1++;
						continue;
					}
					styp = ntyp.structType;
					if ((_entry$2 = nextCount[styp.go$key()], _entry$2 !== undefined ? _entry$2.v : 0) > 0) {
						_key$2 = styp; (nextCount || go$throwRuntimeError("assignment to entry in nil map"))[_key$2.go$key()] = { k: _key$2, v: 2 };
						_i$1++;
						continue;
					}
					if (nextCount === false) {
						nextCount = (_map$1 = new Go$Map(), _map$1);
					}
					_key$4 = styp; (nextCount || go$throwRuntimeError("assignment to entry in nil map"))[_key$4.go$key()] = { k: _key$4, v: 1 };
					if ((_entry$3 = count[t$1.go$key()], _entry$3 !== undefined ? _entry$3.v : 0) > 1) {
						_key$5 = styp; (nextCount || go$throwRuntimeError("assignment to entry in nil map"))[_key$5.go$key()] = { k: _key$5, v: 2 };
					}
					index = (go$sliceType(Go$Int)).nil;
					index = go$appendSlice(index, scan.index);
					index = go$append(index, i);
					next = go$append(next, new fieldScan.Ptr(styp, index));
					_i$1++;
				}
				_i++;
			}
			if (ok) {
				break;
			}
		}
		return [(_struct$3 = result, new StructField.Ptr(_struct$3.Name, _struct$3.PkgPath, _struct$3.Type, _struct$3.Tag, _struct$3.Offset, _struct$3.Index, _struct$3.Anonymous)), ok];
	};
	structType.prototype.FieldByNameFunc = function(match) { return this.go$val.FieldByNameFunc(match); };
	structType.Ptr.prototype.FieldByName = function(name) {
		var f, present, t, hasAnon, _ref, _i, i, x, tf, _tmp, _struct, _tmp$1, _struct$1, _struct$2, _tuple, _struct$3, _struct$4;
		f = new StructField.Ptr();
		present = false;
		t = this;
		hasAnon = false;
		if (!(name === "")) {
			_ref = t.fields;
			_i = 0;
			while (_i < _ref.length) {
				i = _i;
				tf = (x = t.fields, ((i < 0 || i >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + i]));
				if (go$pointerIsEqual(tf.name, (go$ptrType(Go$String)).nil)) {
					hasAnon = true;
					_i++;
					continue;
				}
				if (tf.name.go$get() === name) {
					_tmp = (_struct = t.Field(i), new StructField.Ptr(_struct.Name, _struct.PkgPath, _struct.Type, _struct.Tag, _struct.Offset, _struct.Index, _struct.Anonymous)); _tmp$1 = true; f = _tmp; present = _tmp$1;
					return [(_struct$1 = f, new StructField.Ptr(_struct$1.Name, _struct$1.PkgPath, _struct$1.Type, _struct$1.Tag, _struct$1.Offset, _struct$1.Index, _struct$1.Anonymous)), present];
				}
				_i++;
			}
		}
		if (!hasAnon) {
			return [(_struct$2 = f, new StructField.Ptr(_struct$2.Name, _struct$2.PkgPath, _struct$2.Type, _struct$2.Tag, _struct$2.Offset, _struct$2.Index, _struct$2.Anonymous)), present];
		}
		_tuple = t.FieldByNameFunc((function(s) {
			return s === name;
		})); f = (_struct$3 = _tuple[0], new StructField.Ptr(_struct$3.Name, _struct$3.PkgPath, _struct$3.Type, _struct$3.Tag, _struct$3.Offset, _struct$3.Index, _struct$3.Anonymous)); present = _tuple[1];
		return [(_struct$4 = f, new StructField.Ptr(_struct$4.Name, _struct$4.PkgPath, _struct$4.Type, _struct$4.Tag, _struct$4.Offset, _struct$4.Index, _struct$4.Anonymous)), present];
	};
	structType.prototype.FieldByName = function(name) { return this.go$val.FieldByName(name); };
	PtrTo = go$pkg.PtrTo = function(t) {
		return (t !== null && t.constructor === (go$ptrType(rtype)) ? t.go$val : go$typeAssertionFailed(t, (go$ptrType(rtype)))).ptrTo();
	};
	rtype.Ptr.prototype.Implements = function(u) {
		var t;
		t = this;
		if (go$interfaceIsEqual(u, null)) {
			throw go$panic(new Go$String("reflect: nil type passed to Type.Implements"));
		}
		if (!((u.Kind() === 20))) {
			throw go$panic(new Go$String("reflect: non-interface type passed to Type.Implements"));
		}
		return implements$1((u !== null && u.constructor === (go$ptrType(rtype)) ? u.go$val : go$typeAssertionFailed(u, (go$ptrType(rtype)))), t);
	};
	rtype.prototype.Implements = function(u) { return this.go$val.Implements(u); };
	rtype.Ptr.prototype.AssignableTo = function(u) {
		var t, uu;
		t = this;
		if (go$interfaceIsEqual(u, null)) {
			throw go$panic(new Go$String("reflect: nil type passed to Type.AssignableTo"));
		}
		uu = (u !== null && u.constructor === (go$ptrType(rtype)) ? u.go$val : go$typeAssertionFailed(u, (go$ptrType(rtype))));
		return directlyAssignable(uu, t) || implements$1(uu, t);
	};
	rtype.prototype.AssignableTo = function(u) { return this.go$val.AssignableTo(u); };
	rtype.Ptr.prototype.ConvertibleTo = function(u) {
		var t, uu;
		t = this;
		if (go$interfaceIsEqual(u, null)) {
			throw go$panic(new Go$String("reflect: nil type passed to Type.ConvertibleTo"));
		}
		uu = (u !== null && u.constructor === (go$ptrType(rtype)) ? u.go$val : go$typeAssertionFailed(u, (go$ptrType(rtype))));
		return !(convertOp(uu, t) === go$throwNilPointerError);
	};
	rtype.prototype.ConvertibleTo = function(u) { return this.go$val.ConvertibleTo(u); };
	implements$1 = function(T, V) {
		var t, v, i, j, x, tm, x$1, vm, v$1, i$1, j$1, x$2, tm$1, x$3, vm$1;
		if (!((T.Kind() === 20))) {
			return false;
		}
		t = T.interfaceType;
		if (t.methods.length === 0) {
			return true;
		}
		if (V.Kind() === 20) {
			v = V.interfaceType;
			i = 0;
			j = 0;
			while (j < v.methods.length) {
				tm = (x = t.methods, ((i < 0 || i >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + i]));
				vm = (x$1 = v.methods, ((j < 0 || j >= x$1.length) ? go$throwRuntimeError("index out of range") : x$1.array[x$1.offset + j]));
				if (go$pointerIsEqual(vm.name, tm.name) && go$pointerIsEqual(vm.pkgPath, tm.pkgPath) && vm.typ === tm.typ) {
					i = i + 1 >> 0;
					if (i >= t.methods.length) {
						return true;
					}
				}
				j = j + 1 >> 0;
			}
			return false;
		}
		v$1 = V.uncommonType.uncommon();
		if (v$1 === (go$ptrType(uncommonType)).nil) {
			return false;
		}
		i$1 = 0;
		j$1 = 0;
		while (j$1 < v$1.methods.length) {
			tm$1 = (x$2 = t.methods, ((i$1 < 0 || i$1 >= x$2.length) ? go$throwRuntimeError("index out of range") : x$2.array[x$2.offset + i$1]));
			vm$1 = (x$3 = v$1.methods, ((j$1 < 0 || j$1 >= x$3.length) ? go$throwRuntimeError("index out of range") : x$3.array[x$3.offset + j$1]));
			if (go$pointerIsEqual(vm$1.name, tm$1.name) && go$pointerIsEqual(vm$1.pkgPath, tm$1.pkgPath) && vm$1.mtyp === tm$1.typ) {
				i$1 = i$1 + 1 >> 0;
				if (i$1 >= t.methods.length) {
					return true;
				}
			}
			j$1 = j$1 + 1 >> 0;
		}
		return false;
	};
	directlyAssignable = function(T, V) {
		if (T === V) {
			return true;
		}
		if (!(T.Name() === "") && !(V.Name() === "") || !((T.Kind() === V.Kind()))) {
			return false;
		}
		return haveIdenticalUnderlyingType(T, V);
	};
	haveIdenticalUnderlyingType = function(T, V) {
		var kind, _ref, t, v, _ref$1, _i, typ, i, x, _ref$2, _i$1, typ$1, i$1, x$1, t$1, v$1, t$2, v$2, _ref$3, _i$2, i$2, x$2, tf, x$3, vf;
		if (T === V) {
			return true;
		}
		kind = T.Kind();
		if (!((kind === V.Kind()))) {
			return false;
		}
		if (1 <= kind && kind <= 16 || (kind === 24) || (kind === 26)) {
			return true;
		}
		_ref = kind;
		if (_ref === 17) {
			return go$interfaceIsEqual(T.Elem(), V.Elem()) && (T.Len() === V.Len());
		} else if (_ref === 18) {
			if ((V.ChanDir() === 3) && go$interfaceIsEqual(T.Elem(), V.Elem())) {
				return true;
			}
			return (V.ChanDir() === T.ChanDir()) && go$interfaceIsEqual(T.Elem(), V.Elem());
		} else if (_ref === 19) {
			t = T.funcType;
			v = V.funcType;
			if (!(t.dotdotdot === v.dotdotdot) || !((t.in$2.length === v.in$2.length)) || !((t.out.length === v.out.length))) {
				return false;
			}
			_ref$1 = t.in$2;
			_i = 0;
			while (_i < _ref$1.length) {
				typ = ((_i < 0 || _i >= _ref$1.length) ? go$throwRuntimeError("index out of range") : _ref$1.array[_ref$1.offset + _i]);
				i = _i;
				if (!(typ === (x = v.in$2, ((i < 0 || i >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + i])))) {
					return false;
				}
				_i++;
			}
			_ref$2 = t.out;
			_i$1 = 0;
			while (_i$1 < _ref$2.length) {
				typ$1 = ((_i$1 < 0 || _i$1 >= _ref$2.length) ? go$throwRuntimeError("index out of range") : _ref$2.array[_ref$2.offset + _i$1]);
				i$1 = _i$1;
				if (!(typ$1 === (x$1 = v.out, ((i$1 < 0 || i$1 >= x$1.length) ? go$throwRuntimeError("index out of range") : x$1.array[x$1.offset + i$1])))) {
					return false;
				}
				_i$1++;
			}
			return true;
		} else if (_ref === 20) {
			t$1 = T.interfaceType;
			v$1 = V.interfaceType;
			if ((t$1.methods.length === 0) && (v$1.methods.length === 0)) {
				return true;
			}
			return false;
		} else if (_ref === 21) {
			return go$interfaceIsEqual(T.Key(), V.Key()) && go$interfaceIsEqual(T.Elem(), V.Elem());
		} else if (_ref === 22 || _ref === 23) {
			return go$interfaceIsEqual(T.Elem(), V.Elem());
		} else if (_ref === 25) {
			t$2 = T.structType;
			v$2 = V.structType;
			if (!((t$2.fields.length === v$2.fields.length))) {
				return false;
			}
			_ref$3 = t$2.fields;
			_i$2 = 0;
			while (_i$2 < _ref$3.length) {
				i$2 = _i$2;
				tf = (x$2 = t$2.fields, ((i$2 < 0 || i$2 >= x$2.length) ? go$throwRuntimeError("index out of range") : x$2.array[x$2.offset + i$2]));
				vf = (x$3 = v$2.fields, ((i$2 < 0 || i$2 >= x$3.length) ? go$throwRuntimeError("index out of range") : x$3.array[x$3.offset + i$2]));
				if (!(go$pointerIsEqual(tf.name, vf.name)) && (go$pointerIsEqual(tf.name, (go$ptrType(Go$String)).nil) || go$pointerIsEqual(vf.name, (go$ptrType(Go$String)).nil) || !(tf.name.go$get() === vf.name.go$get()))) {
					return false;
				}
				if (!(go$pointerIsEqual(tf.pkgPath, vf.pkgPath)) && (go$pointerIsEqual(tf.pkgPath, (go$ptrType(Go$String)).nil) || go$pointerIsEqual(vf.pkgPath, (go$ptrType(Go$String)).nil) || !(tf.pkgPath.go$get() === vf.pkgPath.go$get()))) {
					return false;
				}
				if (!(tf.typ === vf.typ)) {
					return false;
				}
				if (!(go$pointerIsEqual(tf.tag, vf.tag)) && (go$pointerIsEqual(tf.tag, (go$ptrType(Go$String)).nil) || go$pointerIsEqual(vf.tag, (go$ptrType(Go$String)).nil) || !(tf.tag.go$get() === vf.tag.go$get()))) {
					return false;
				}
				if (!((tf.offset === vf.offset))) {
					return false;
				}
				_i$2++;
			}
			return true;
		}
		return false;
	};
	toType = function(t) {
		if (t === (go$ptrType(rtype)).nil) {
			return null;
		}
		return t;
	};
	flag.prototype.kind = function() {
		var f;
		f = this.go$val;
		return (((((f >>> 4 >>> 0)) & 31) >>> 0) >>> 0);
	};
	go$ptrType(flag).prototype.kind = function() { return new flag(this.go$get()).kind(); };
	ValueError.Ptr.prototype.Error = function() {
		var e;
		e = this;
		if (e.Kind === 0) {
			return "reflect: call of " + e.Method + " on zero Value";
		}
		return "reflect: call of " + e.Method + " on " + (new Kind(e.Kind)).String() + " Value";
	};
	ValueError.prototype.Error = function() { return this.go$val.Error(); };
	flag.prototype.mustBe = function(expected) {
		var f, k;
		f = this.go$val;
		k = (new flag(f)).kind();
		if (!((k === expected))) {
			throw go$panic(new ValueError.Ptr(methodName(), k));
		}
	};
	go$ptrType(flag).prototype.mustBe = function(expected) { return new flag(this.go$get()).mustBe(expected); };
	flag.prototype.mustBeExported = function() {
		var f;
		f = this.go$val;
		if (f === 0) {
			throw go$panic(new ValueError.Ptr(methodName(), 0));
		}
		if (!((((f & 1) >>> 0) === 0))) {
			throw go$panic(new Go$String("reflect: " + methodName() + " using value obtained using unexported field"));
		}
	};
	go$ptrType(flag).prototype.mustBeExported = function() { return new flag(this.go$get()).mustBeExported(); };
	flag.prototype.mustBeAssignable = function() {
		var f;
		f = this.go$val;
		if (f === 0) {
			throw go$panic(new ValueError.Ptr(methodName(), 0));
		}
		if (!((((f & 1) >>> 0) === 0))) {
			throw go$panic(new Go$String("reflect: " + methodName() + " using value obtained using unexported field"));
		}
		if (((f & 4) >>> 0) === 0) {
			throw go$panic(new Go$String("reflect: " + methodName() + " using unaddressable value"));
		}
	};
	go$ptrType(flag).prototype.mustBeAssignable = function() { return new flag(this.go$get()).mustBeAssignable(); };
	Value.Ptr.prototype.Addr = function() {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		if (((v.flag & 4) >>> 0) === 0) {
			throw go$panic(new Go$String("reflect.Value.Addr of unaddressable value"));
		}
		return new Value.Ptr(v.typ.ptrTo(), v.val, ((((v.flag & 1) >>> 0)) | 352) >>> 0);
	};
	Value.prototype.Addr = function() { return this.go$val.Addr(); };
	Value.Ptr.prototype.Bool = function() {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(1);
		if (!((((v.flag & 2) >>> 0) === 0))) {
			return v.val.go$get();
		}
		return v.val;
	};
	Value.prototype.Bool = function() { return this.go$val.Bool(); };
	Value.Ptr.prototype.Bytes = function() {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(23);
		if (!((v.typ.Elem().Kind() === 8))) {
			throw go$panic(new Go$String("reflect.Value.Bytes of non-byte slice"));
		}
		return v.val.go$get();
	};
	Value.prototype.Bytes = function() { return this.go$val.Bytes(); };
	Value.Ptr.prototype.runes = function() {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(23);
		if (!((v.typ.Elem().Kind() === 5))) {
			throw go$panic(new Go$String("reflect.Value.Bytes of non-rune slice"));
		}
		return v.val.go$get();
	};
	Value.prototype.runes = function() { return this.go$val.runes(); };
	Value.Ptr.prototype.CanAddr = function() {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		return !((((v.flag & 4) >>> 0) === 0));
	};
	Value.prototype.CanAddr = function() { return this.go$val.CanAddr(); };
	Value.Ptr.prototype.CanSet = function() {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		return ((v.flag & 5) >>> 0) === 4;
	};
	Value.prototype.CanSet = function() { return this.go$val.CanSet(); };
	Value.Ptr.prototype.Call = function(in$1) {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(19);
		(new flag(v.flag)).mustBeExported();
		return v.call("Call", in$1);
	};
	Value.prototype.Call = function(in$1) { return this.go$val.Call(in$1); };
	Value.Ptr.prototype.CallSlice = function(in$1) {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(19);
		(new flag(v.flag)).mustBeExported();
		return v.call("CallSlice", in$1);
	};
	Value.prototype.CallSlice = function(in$1) { return this.go$val.CallSlice(in$1); };
	Value.Ptr.prototype.Close = function() {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(18);
		(new flag(v.flag)).mustBeExported();
		chanclose(v.iword());
	};
	Value.prototype.Close = function() { return this.go$val.Close(); };
	Value.Ptr.prototype.Complex = function() {
		var _struct, v, k, _ref, x, x$1;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 15) {
			if (!((((v.flag & 2) >>> 0) === 0))) {
				return (x = v.val.go$get(), new Go$Complex128(x.real, x.imag));
			}
			return (x$1 = v.val, new Go$Complex128(x$1.real, x$1.imag));
		} else if (_ref === 16) {
			return v.val.go$get();
		}
		throw go$panic(new ValueError.Ptr("reflect.Value.Complex", k));
	};
	Value.prototype.Complex = function() { return this.go$val.Complex(); };
	Value.Ptr.prototype.FieldByIndex = function(index) {
		var _struct, v, _ref, _i, x, i, _struct$1, _struct$2, _struct$3;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(25);
		_ref = index;
		_i = 0;
		while (_i < _ref.length) {
			x = ((_i < 0 || _i >= _ref.length) ? go$throwRuntimeError("index out of range") : _ref.array[_ref.offset + _i]);
			i = _i;
			if (i > 0) {
				if ((v.Kind() === 22) && (v.Elem().Kind() === 25)) {
					v = (_struct$1 = v.Elem(), new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag));
				}
			}
			v = (_struct$2 = v.Field(x), new Value.Ptr(_struct$2.typ, _struct$2.val, _struct$2.flag));
			_i++;
		}
		return (_struct$3 = v, new Value.Ptr(_struct$3.typ, _struct$3.val, _struct$3.flag));
	};
	Value.prototype.FieldByIndex = function(index) { return this.go$val.FieldByIndex(index); };
	Value.Ptr.prototype.FieldByName = function(name) {
		var _struct, v, _tuple, _struct$1, f, ok, _struct$2;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(25);
		_tuple = v.typ.FieldByName(name); f = (_struct$1 = _tuple[0], new StructField.Ptr(_struct$1.Name, _struct$1.PkgPath, _struct$1.Type, _struct$1.Tag, _struct$1.Offset, _struct$1.Index, _struct$1.Anonymous)); ok = _tuple[1];
		if (ok) {
			return (_struct$2 = v.FieldByIndex(f.Index), new Value.Ptr(_struct$2.typ, _struct$2.val, _struct$2.flag));
		}
		return new Value.Ptr((go$ptrType(rtype)).nil, 0, 0);
	};
	Value.prototype.FieldByName = function(name) { return this.go$val.FieldByName(name); };
	Value.Ptr.prototype.FieldByNameFunc = function(match) {
		var _struct, v, _tuple, _struct$1, f, ok, _struct$2;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(25);
		_tuple = v.typ.FieldByNameFunc(match); f = (_struct$1 = _tuple[0], new StructField.Ptr(_struct$1.Name, _struct$1.PkgPath, _struct$1.Type, _struct$1.Tag, _struct$1.Offset, _struct$1.Index, _struct$1.Anonymous)); ok = _tuple[1];
		if (ok) {
			return (_struct$2 = v.FieldByIndex(f.Index), new Value.Ptr(_struct$2.typ, _struct$2.val, _struct$2.flag));
		}
		return new Value.Ptr((go$ptrType(rtype)).nil, 0, 0);
	};
	Value.prototype.FieldByNameFunc = function(match) { return this.go$val.FieldByNameFunc(match); };
	Value.Ptr.prototype.Float = function() {
		var _struct, v, k, _ref;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 13) {
			if (!((((v.flag & 2) >>> 0) === 0))) {
				return go$coerceFloat32(v.val.go$get());
			}
			return go$coerceFloat32(v.val);
		} else if (_ref === 14) {
			if (!((((v.flag & 2) >>> 0) === 0))) {
				return v.val.go$get();
			}
			return v.val;
		}
		throw go$panic(new ValueError.Ptr("reflect.Value.Float", k));
	};
	Value.prototype.Float = function() { return this.go$val.Float(); };
	Value.Ptr.prototype.Int = function() {
		var _struct, v, k, p, v$1, _ref;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		k = (new flag(v.flag)).kind();
		p = 0;
		if (!((((v.flag & 2) >>> 0) === 0))) {
			p = v.val;
		} else {
			p = new (go$ptrType(Go$UnsafePointer))(function() { return v.val; }, function(v$1) { v.val = v$1;; });
		}
		_ref = k;
		if (_ref === 2) {
			return new Go$Int64(0, p.go$get());
		} else if (_ref === 3) {
			return new Go$Int64(0, p.go$get());
		} else if (_ref === 4) {
			return new Go$Int64(0, p.go$get());
		} else if (_ref === 5) {
			return new Go$Int64(0, p.go$get());
		} else if (_ref === 6) {
			return p.go$get();
		}
		throw go$panic(new ValueError.Ptr("reflect.Value.Int", k));
	};
	Value.prototype.Int = function() { return this.go$val.Int(); };
	Value.Ptr.prototype.CanInterface = function() {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		if (v.flag === 0) {
			throw go$panic(new ValueError.Ptr("reflect.Value.CanInterface", 0));
		}
		return ((v.flag & 1) >>> 0) === 0;
	};
	Value.prototype.CanInterface = function() { return this.go$val.CanInterface(); };
	Value.Ptr.prototype.Interface = function() {
		var i, _struct, v, _struct$1;
		i = null;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		i = valueInterface((_struct$1 = v, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag)), true);
		return i;
	};
	Value.prototype.Interface = function() { return this.go$val.Interface(); };
	Value.Ptr.prototype.InterfaceData = function() {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(20);
		return go$mapArray(v.val, function(entry) { return entry; });
	};
	Value.prototype.InterfaceData = function() { return this.go$val.InterfaceData(); };
	Value.Ptr.prototype.IsValid = function() {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		return !((v.flag === 0));
	};
	Value.prototype.IsValid = function() { return this.go$val.IsValid(); };
	Value.Ptr.prototype.Kind = function() {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		return (new flag(v.flag)).kind();
	};
	Value.prototype.Kind = function() { return this.go$val.Kind(); };
	Value.Ptr.prototype.MapIndex = function(key) {
		var _struct, v, tt, _struct$1, _tuple, word, ok, typ, fl;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(21);
		tt = v.typ.mapType;
		key = (_struct$1 = key.assignTo("reflect.Value.MapIndex", tt.key, (go$ptrType(go$emptyInterface)).nil), new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag));
		_tuple = mapaccess(v.typ, v.iword(), key.iword()); word = _tuple[0]; ok = _tuple[1];
		if (!ok) {
			return new Value.Ptr((go$ptrType(rtype)).nil, 0, 0);
		}
		typ = tt.elem;
		fl = ((((v.flag | key.flag) >>> 0)) & 1) >>> 0;
		if (typ.size > 4) {
			fl = (fl | 2) >>> 0;
		}
		fl = (fl | (((typ.Kind() >>> 0) << 4 >>> 0))) >>> 0;
		return new Value.Ptr(typ, word, fl);
	};
	Value.prototype.MapIndex = function(key) { return this.go$val.MapIndex(key); };
	Value.Ptr.prototype.MapKeys = function() {
		var _struct, v, tt, keyType, fl, m, mlen, it, a, i, _tuple, keyWord, ok;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(21);
		tt = v.typ.mapType;
		keyType = tt.key;
		fl = (v.flag & 1) >>> 0;
		fl = (fl | (((keyType.Kind() >>> 0) << 4 >>> 0))) >>> 0;
		if (keyType.size > 4) {
			fl = (fl | 2) >>> 0;
		}
		m = v.iword();
		mlen = 0;
		if (!(m === 0)) {
			mlen = maplen(m);
		}
		it = mapiterinit(v.typ, m);
		a = (go$sliceType(Value)).make(mlen, 0, function() { return new Value.Ptr(); });
		i = 0;
		i = 0;
		while (i < a.length) {
			_tuple = mapiterkey(it); keyWord = _tuple[0]; ok = _tuple[1];
			if (!ok) {
				break;
			}
			(i < 0 || i >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + i] = new Value.Ptr(keyType, keyWord, fl);
			mapiternext(it);
			i = i + 1 >> 0;
		}
		return go$subslice(a, 0, i);
	};
	Value.prototype.MapKeys = function() { return this.go$val.MapKeys(); };
	Value.Ptr.prototype.Method = function(i) {
		var _struct, v, fl;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		if (v.typ === (go$ptrType(rtype)).nil) {
			throw go$panic(new ValueError.Ptr("reflect.Value.Method", 0));
		}
		if (!((((v.flag & 8) >>> 0) === 0)) || i < 0 || i >= v.typ.NumMethod()) {
			throw go$panic(new Go$String("reflect: Method index out of range"));
		}
		if ((v.typ.Kind() === 20) && v.IsNil()) {
			throw go$panic(new Go$String("reflect: Method on nil interface value"));
		}
		fl = (v.flag & 3) >>> 0;
		fl = (fl | 304) >>> 0;
		fl = (fl | (((((i >>> 0) << 9 >>> 0) | 8) >>> 0))) >>> 0;
		return new Value.Ptr(v.typ, v.val, fl);
	};
	Value.prototype.Method = function(i) { return this.go$val.Method(i); };
	Value.Ptr.prototype.NumMethod = function() {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		if (v.typ === (go$ptrType(rtype)).nil) {
			throw go$panic(new ValueError.Ptr("reflect.Value.NumMethod", 0));
		}
		if (!((((v.flag & 8) >>> 0) === 0))) {
			return 0;
		}
		return v.typ.NumMethod();
	};
	Value.prototype.NumMethod = function() { return this.go$val.NumMethod(); };
	Value.Ptr.prototype.MethodByName = function(name) {
		var _struct, v, _tuple, _struct$1, _struct$2, m, ok, _struct$3;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		if (v.typ === (go$ptrType(rtype)).nil) {
			throw go$panic(new ValueError.Ptr("reflect.Value.MethodByName", 0));
		}
		if (!((((v.flag & 8) >>> 0) === 0))) {
			return new Value.Ptr((go$ptrType(rtype)).nil, 0, 0);
		}
		_tuple = v.typ.MethodByName(name); m = (_struct$1 = _tuple[0], new Method.Ptr(_struct$1.Name, _struct$1.PkgPath, _struct$1.Type, (_struct$2 = _struct$1.Func, new Value.Ptr(_struct$2.typ, _struct$2.val, _struct$2.flag)), _struct$1.Index)); ok = _tuple[1];
		if (!ok) {
			return new Value.Ptr((go$ptrType(rtype)).nil, 0, 0);
		}
		return (_struct$3 = v.Method(m.Index), new Value.Ptr(_struct$3.typ, _struct$3.val, _struct$3.flag));
	};
	Value.prototype.MethodByName = function(name) { return this.go$val.MethodByName(name); };
	Value.Ptr.prototype.NumField = function() {
		var _struct, v, tt;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(25);
		tt = v.typ.structType;
		return tt.fields.length;
	};
	Value.prototype.NumField = function() { return this.go$val.NumField(); };
	Value.Ptr.prototype.OverflowComplex = function(x) {
		var _struct, v, k, _ref;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 15) {
			return overflowFloat32(x.real) || overflowFloat32(x.imag);
		} else if (_ref === 16) {
			return false;
		}
		throw go$panic(new ValueError.Ptr("reflect.Value.OverflowComplex", k));
	};
	Value.prototype.OverflowComplex = function(x) { return this.go$val.OverflowComplex(x); };
	Value.Ptr.prototype.OverflowFloat = function(x) {
		var _struct, v, k, _ref;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 13) {
			return overflowFloat32(x);
		} else if (_ref === 14) {
			return false;
		}
		throw go$panic(new ValueError.Ptr("reflect.Value.OverflowFloat", k));
	};
	Value.prototype.OverflowFloat = function(x) { return this.go$val.OverflowFloat(x); };
	overflowFloat32 = function(x) {
		if (x < 0) {
			x = -x;
		}
		return 3.4028234663852886e+38 < x && x <= 1.7976931348623157e+308;
	};
	Value.Ptr.prototype.OverflowInt = function(x) {
		var _struct, v, k, _ref, x$1, bitSize, trunc;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 2 || _ref === 3 || _ref === 4 || _ref === 5 || _ref === 6) {
			bitSize = (x$1 = v.typ.size, (((x$1 >>> 16 << 16) * 8 >>> 0) + (x$1 << 16 >>> 16) * 8) >>> 0);
			trunc = go$shiftRightInt64((go$shiftLeft64(x, ((64 - bitSize >>> 0)))), ((64 - bitSize >>> 0)));
			return !((x.high === trunc.high && x.low === trunc.low));
		}
		throw go$panic(new ValueError.Ptr("reflect.Value.OverflowInt", k));
	};
	Value.prototype.OverflowInt = function(x) { return this.go$val.OverflowInt(x); };
	Value.Ptr.prototype.OverflowUint = function(x) {
		var _struct, v, k, _ref, x$1, bitSize, trunc;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 7 || _ref === 12 || _ref === 8 || _ref === 9 || _ref === 10 || _ref === 11) {
			bitSize = (x$1 = v.typ.size, (((x$1 >>> 16 << 16) * 8 >>> 0) + (x$1 << 16 >>> 16) * 8) >>> 0);
			trunc = go$shiftRightUint64((go$shiftLeft64(x, ((64 - bitSize >>> 0)))), ((64 - bitSize >>> 0)));
			return !((x.high === trunc.high && x.low === trunc.low));
		}
		throw go$panic(new ValueError.Ptr("reflect.Value.OverflowUint", k));
	};
	Value.prototype.OverflowUint = function(x) { return this.go$val.OverflowUint(x); };
	Value.Ptr.prototype.Recv = function() {
		var x, ok, _struct, v, _tuple, _struct$1, _struct$2;
		x = new Value.Ptr();
		ok = false;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(18);
		(new flag(v.flag)).mustBeExported();
		_tuple = v.recv(false); x = (_struct$1 = _tuple[0], new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag)); ok = _tuple[1];
		return [(_struct$2 = x, new Value.Ptr(_struct$2.typ, _struct$2.val, _struct$2.flag)), ok];
	};
	Value.prototype.Recv = function() { return this.go$val.Recv(); };
	Value.Ptr.prototype.recv = function(nb) {
		var val, ok, _struct, v, tt, _tuple, word, selected, typ, fl, _struct$1;
		val = new Value.Ptr();
		ok = false;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		tt = v.typ.chanType;
		if (((tt.dir >> 0) & 1) === 0) {
			throw go$panic(new Go$String("reflect: recv on send-only channel"));
		}
		_tuple = chanrecv(v.typ, v.iword(), nb); word = _tuple[0]; selected = _tuple[1]; ok = _tuple[2];
		if (selected) {
			typ = tt.elem;
			fl = (typ.Kind() >>> 0) << 4 >>> 0;
			if (typ.size > 4) {
				fl = (fl | 2) >>> 0;
			}
			val = new Value.Ptr(typ, word, fl);
		}
		return [(_struct$1 = val, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag)), ok];
	};
	Value.prototype.recv = function(nb) { return this.go$val.recv(nb); };
	Value.Ptr.prototype.Send = function(x) {
		var _struct, v, _struct$1;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(18);
		(new flag(v.flag)).mustBeExported();
		v.send((_struct$1 = x, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag)), false);
	};
	Value.prototype.Send = function(x) { return this.go$val.Send(x); };
	Value.Ptr.prototype.send = function(x, nb) {
		var selected, _struct, v, tt, _struct$1;
		selected = false;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		tt = v.typ.chanType;
		if (((tt.dir >> 0) & 2) === 0) {
			throw go$panic(new Go$String("reflect: send on recv-only channel"));
		}
		(new flag(x.flag)).mustBeExported();
		x = (_struct$1 = x.assignTo("reflect.Value.Send", tt.elem, (go$ptrType(go$emptyInterface)).nil), new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag));
		selected = chansend(v.typ, v.iword(), x.iword(), nb);
		return selected;
	};
	Value.prototype.send = function(x, nb) { return this.go$val.send(x, nb); };
	Value.Ptr.prototype.SetBool = function(x) {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBeAssignable();
		(new flag(v.flag)).mustBe(1);
		v.val.go$set(x);
	};
	Value.prototype.SetBool = function(x) { return this.go$val.SetBool(x); };
	Value.Ptr.prototype.SetBytes = function(x) {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBeAssignable();
		(new flag(v.flag)).mustBe(23);
		if (!((v.typ.Elem().Kind() === 8))) {
			throw go$panic(new Go$String("reflect.Value.SetBytes of non-byte slice"));
		}
		v.val.go$set(x);
	};
	Value.prototype.SetBytes = function(x) { return this.go$val.SetBytes(x); };
	Value.Ptr.prototype.setRunes = function(x) {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBeAssignable();
		(new flag(v.flag)).mustBe(23);
		if (!((v.typ.Elem().Kind() === 5))) {
			throw go$panic(new Go$String("reflect.Value.setRunes of non-rune slice"));
		}
		v.val.go$set(x);
	};
	Value.prototype.setRunes = function(x) { return this.go$val.setRunes(x); };
	Value.Ptr.prototype.SetComplex = function(x) {
		var _struct, v, k, _ref;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBeAssignable();
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 15) {
			v.val.go$set(new Go$Complex64(x.real, x.imag));
		} else if (_ref === 16) {
			v.val.go$set(x);
		} else {
			throw go$panic(new ValueError.Ptr("reflect.Value.SetComplex", k));
		}
	};
	Value.prototype.SetComplex = function(x) { return this.go$val.SetComplex(x); };
	Value.Ptr.prototype.SetFloat = function(x) {
		var _struct, v, k, _ref;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBeAssignable();
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 13) {
			v.val.go$set(x);
		} else if (_ref === 14) {
			v.val.go$set(x);
		} else {
			throw go$panic(new ValueError.Ptr("reflect.Value.SetFloat", k));
		}
	};
	Value.prototype.SetFloat = function(x) { return this.go$val.SetFloat(x); };
	Value.Ptr.prototype.SetInt = function(x) {
		var _struct, v, k, _ref;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBeAssignable();
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 2) {
			v.val.go$set(((x.low + ((x.high >> 31) * 4294967296)) >> 0));
		} else if (_ref === 3) {
			v.val.go$set(((x.low + ((x.high >> 31) * 4294967296)) << 24 >> 24));
		} else if (_ref === 4) {
			v.val.go$set(((x.low + ((x.high >> 31) * 4294967296)) << 16 >> 16));
		} else if (_ref === 5) {
			v.val.go$set(((x.low + ((x.high >> 31) * 4294967296)) >> 0));
		} else if (_ref === 6) {
			v.val.go$set(x);
		} else {
			throw go$panic(new ValueError.Ptr("reflect.Value.SetInt", k));
		}
	};
	Value.prototype.SetInt = function(x) { return this.go$val.SetInt(x); };
	Value.Ptr.prototype.SetMapIndex = function(key, val) {
		var _struct, v, tt, _struct$1, _struct$2;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(21);
		(new flag(v.flag)).mustBeExported();
		(new flag(key.flag)).mustBeExported();
		tt = v.typ.mapType;
		key = (_struct$1 = key.assignTo("reflect.Value.SetMapIndex", tt.key, (go$ptrType(go$emptyInterface)).nil), new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag));
		if (!(val.typ === (go$ptrType(rtype)).nil)) {
			(new flag(val.flag)).mustBeExported();
			val = (_struct$2 = val.assignTo("reflect.Value.SetMapIndex", tt.elem, (go$ptrType(go$emptyInterface)).nil), new Value.Ptr(_struct$2.typ, _struct$2.val, _struct$2.flag));
		}
		mapassign(v.typ, v.iword(), key.iword(), val.iword(), !(val.typ === (go$ptrType(rtype)).nil));
	};
	Value.prototype.SetMapIndex = function(key, val) { return this.go$val.SetMapIndex(key, val); };
	Value.Ptr.prototype.SetUint = function(x) {
		var _struct, v, k, _ref;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBeAssignable();
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 7) {
			v.val.go$set((x.low >>> 0));
		} else if (_ref === 8) {
			v.val.go$set((x.low << 24 >>> 24));
		} else if (_ref === 9) {
			v.val.go$set((x.low << 16 >>> 16));
		} else if (_ref === 10) {
			v.val.go$set((x.low >>> 0));
		} else if (_ref === 11) {
			v.val.go$set(x);
		} else if (_ref === 12) {
			v.val.go$set((x.low >>> 0));
		} else {
			throw go$panic(new ValueError.Ptr("reflect.Value.SetUint", k));
		}
	};
	Value.prototype.SetUint = function(x) { return this.go$val.SetUint(x); };
	Value.Ptr.prototype.SetPointer = function(x) {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBeAssignable();
		(new flag(v.flag)).mustBe(26);
		v.val.go$set(x);
	};
	Value.prototype.SetPointer = function(x) { return this.go$val.SetPointer(x); };
	Value.Ptr.prototype.SetString = function(x) {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBeAssignable();
		(new flag(v.flag)).mustBe(24);
		v.val.go$set(x);
	};
	Value.prototype.SetString = function(x) { return this.go$val.SetString(x); };
	Value.Ptr.prototype.String = function() {
		var _struct, v, k, _ref;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		k = (new flag(v.flag)).kind();
		_ref = k;
		if (_ref === 0) {
			return "<invalid Value>";
		} else if (_ref === 24) {
			return v.val.go$get();
		}
		return "<" + v.typ.String() + " Value>";
	};
	Value.prototype.String = function() { return this.go$val.String(); };
	Value.Ptr.prototype.TryRecv = function() {
		var x, ok, _struct, v, _tuple, _struct$1, _struct$2;
		x = new Value.Ptr();
		ok = false;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(18);
		(new flag(v.flag)).mustBeExported();
		_tuple = v.recv(true); x = (_struct$1 = _tuple[0], new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag)); ok = _tuple[1];
		return [(_struct$2 = x, new Value.Ptr(_struct$2.typ, _struct$2.val, _struct$2.flag)), ok];
	};
	Value.prototype.TryRecv = function() { return this.go$val.TryRecv(); };
	Value.Ptr.prototype.TrySend = function(x) {
		var _struct, v, _struct$1;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		(new flag(v.flag)).mustBe(18);
		(new flag(v.flag)).mustBeExported();
		return v.send((_struct$1 = x, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag)), true);
	};
	Value.prototype.TrySend = function(x) { return this.go$val.TrySend(x); };
	Value.Ptr.prototype.Type = function() {
		var _struct, v, f, i, tt, x, m, ut, x$1, m$1;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		f = v.flag;
		if (f === 0) {
			throw go$panic(new ValueError.Ptr("reflect.Value.Type", 0));
		}
		if (((f & 8) >>> 0) === 0) {
			return v.typ;
		}
		i = (v.flag >> 0) >> 9 >> 0;
		if (v.typ.Kind() === 20) {
			tt = v.typ.interfaceType;
			if (i < 0 || i >= tt.methods.length) {
				throw go$panic(new Go$String("reflect: internal error: invalid method index"));
			}
			m = (x = tt.methods, ((i < 0 || i >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + i]));
			return m.typ;
		}
		ut = v.typ.uncommonType.uncommon();
		if (ut === (go$ptrType(uncommonType)).nil || i < 0 || i >= ut.methods.length) {
			throw go$panic(new Go$String("reflect: internal error: invalid method index"));
		}
		m$1 = (x$1 = ut.methods, ((i < 0 || i >= x$1.length) ? go$throwRuntimeError("index out of range") : x$1.array[x$1.offset + i]));
		return m$1.mtyp;
	};
	Value.prototype.Type = function() { return this.go$val.Type(); };
	Value.Ptr.prototype.Uint = function() {
		var _struct, v, k, p, v$1, _ref, x;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		k = (new flag(v.flag)).kind();
		p = 0;
		if (!((((v.flag & 2) >>> 0) === 0))) {
			p = v.val;
		} else {
			p = new (go$ptrType(Go$UnsafePointer))(function() { return v.val; }, function(v$1) { v.val = v$1;; });
		}
		_ref = k;
		if (_ref === 7) {
			return new Go$Uint64(0, p.go$get());
		} else if (_ref === 8) {
			return new Go$Uint64(0, p.go$get());
		} else if (_ref === 9) {
			return new Go$Uint64(0, p.go$get());
		} else if (_ref === 10) {
			return new Go$Uint64(0, p.go$get());
		} else if (_ref === 11) {
			return p.go$get();
		} else if (_ref === 12) {
			return (x = p.go$get(), new Go$Uint64(0, x.constructor === Number ? x : 1));
		}
		throw go$panic(new ValueError.Ptr("reflect.Value.Uint", k));
	};
	Value.prototype.Uint = function() { return this.go$val.Uint(); };
	Value.Ptr.prototype.UnsafeAddr = function() {
		var _struct, v;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		if (v.typ === (go$ptrType(rtype)).nil) {
			throw go$panic(new ValueError.Ptr("reflect.Value.UnsafeAddr", 0));
		}
		if (((v.flag & 4) >>> 0) === 0) {
			throw go$panic(new Go$String("reflect.Value.UnsafeAddr of unaddressable value"));
		}
		return v.val;
	};
	Value.prototype.UnsafeAddr = function() { return this.go$val.UnsafeAddr(); };
	New = go$pkg.New = function(typ) {
		var ptr, fl;
		if (go$interfaceIsEqual(typ, null)) {
			throw go$panic(new Go$String("reflect: New(nil)"));
		}
		ptr = unsafe_New((typ !== null && typ.constructor === (go$ptrType(rtype)) ? typ.go$val : go$typeAssertionFailed(typ, (go$ptrType(rtype)))));
		fl = 352;
		return new Value.Ptr(typ.common().ptrTo(), ptr, fl);
	};
	Value.Ptr.prototype.assignTo = function(context, dst, target) {
		var _struct, v, _struct$1, _struct$2, fl, _struct$3, x;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		if (!((((v.flag & 8) >>> 0) === 0))) {
			v = (_struct$2 = makeMethodValue(context, (_struct$1 = v, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag))), new Value.Ptr(_struct$2.typ, _struct$2.val, _struct$2.flag));
		}
		if (directlyAssignable(dst, v.typ)) {
			v.typ = dst;
			fl = (v.flag & 7) >>> 0;
			fl = (fl | (((dst.Kind() >>> 0) << 4 >>> 0))) >>> 0;
			return new Value.Ptr(dst, v.val, fl);
		} else if (implements$1(dst, v.typ)) {
			if (target === (go$ptrType(go$emptyInterface)).nil) {
				target = go$newDataPointer(null, (go$ptrType(go$emptyInterface)));
			}
			x = valueInterface((_struct$3 = v, new Value.Ptr(_struct$3.typ, _struct$3.val, _struct$3.flag)), false);
			if (dst.NumMethod() === 0) {
				target.go$set(x);
			} else {
				ifaceE2I(dst, x, target);
			}
			return new Value.Ptr(dst, target, 322);
		}
		throw go$panic(new Go$String(context + ": value of type " + v.typ.String() + " is not assignable to type " + dst.String()));
	};
	Value.prototype.assignTo = function(context, dst, target) { return this.go$val.assignTo(context, dst, target); };
	Value.Ptr.prototype.Convert = function(t) {
		var _struct, v, _struct$1, _struct$2, op, _struct$3, _struct$4;
		v = (_struct = this, new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		if (!((((v.flag & 8) >>> 0) === 0))) {
			v = (_struct$2 = makeMethodValue("Convert", (_struct$1 = v, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag))), new Value.Ptr(_struct$2.typ, _struct$2.val, _struct$2.flag));
		}
		op = convertOp(t.common(), v.typ);
		if (op === go$throwNilPointerError) {
			throw go$panic(new Go$String("reflect.Value.Convert: value of type " + v.typ.String() + " cannot be converted to type " + t.String()));
		}
		return (_struct$4 = op((_struct$3 = v, new Value.Ptr(_struct$3.typ, _struct$3.val, _struct$3.flag)), t), new Value.Ptr(_struct$4.typ, _struct$4.val, _struct$4.flag));
	};
	Value.prototype.Convert = function(t) { return this.go$val.Convert(t); };
	convertOp = function(dst, src) {
		var _ref, _ref$1, _ref$2, _ref$3, _ref$4, _ref$5, _ref$6;
		_ref = src.Kind();
		if (_ref === 2 || _ref === 3 || _ref === 4 || _ref === 5 || _ref === 6) {
			_ref$1 = dst.Kind();
			if (_ref$1 === 2 || _ref$1 === 3 || _ref$1 === 4 || _ref$1 === 5 || _ref$1 === 6 || _ref$1 === 7 || _ref$1 === 8 || _ref$1 === 9 || _ref$1 === 10 || _ref$1 === 11 || _ref$1 === 12) {
				return cvtInt;
			} else if (_ref$1 === 13 || _ref$1 === 14) {
				return cvtIntFloat;
			} else if (_ref$1 === 24) {
				return cvtIntString;
			}
		} else if (_ref === 7 || _ref === 8 || _ref === 9 || _ref === 10 || _ref === 11 || _ref === 12) {
			_ref$2 = dst.Kind();
			if (_ref$2 === 2 || _ref$2 === 3 || _ref$2 === 4 || _ref$2 === 5 || _ref$2 === 6 || _ref$2 === 7 || _ref$2 === 8 || _ref$2 === 9 || _ref$2 === 10 || _ref$2 === 11 || _ref$2 === 12) {
				return cvtUint;
			} else if (_ref$2 === 13 || _ref$2 === 14) {
				return cvtUintFloat;
			} else if (_ref$2 === 24) {
				return cvtUintString;
			}
		} else if (_ref === 13 || _ref === 14) {
			_ref$3 = dst.Kind();
			if (_ref$3 === 2 || _ref$3 === 3 || _ref$3 === 4 || _ref$3 === 5 || _ref$3 === 6) {
				return cvtFloatInt;
			} else if (_ref$3 === 7 || _ref$3 === 8 || _ref$3 === 9 || _ref$3 === 10 || _ref$3 === 11 || _ref$3 === 12) {
				return cvtFloatUint;
			} else if (_ref$3 === 13 || _ref$3 === 14) {
				return cvtFloat;
			}
		} else if (_ref === 15 || _ref === 16) {
			_ref$4 = dst.Kind();
			if (_ref$4 === 15 || _ref$4 === 16) {
				return cvtComplex;
			}
		} else if (_ref === 24) {
			if ((dst.Kind() === 23) && dst.Elem().PkgPath() === "") {
				_ref$5 = dst.Elem().Kind();
				if (_ref$5 === 8) {
					return cvtStringBytes;
				} else if (_ref$5 === 5) {
					return cvtStringRunes;
				}
			}
		} else if (_ref === 23) {
			if ((dst.Kind() === 24) && src.Elem().PkgPath() === "") {
				_ref$6 = src.Elem().Kind();
				if (_ref$6 === 8) {
					return cvtBytesString;
				} else if (_ref$6 === 5) {
					return cvtRunesString;
				}
			}
		}
		if (haveIdenticalUnderlyingType(dst, src)) {
			return cvtDirect;
		}
		if ((dst.Kind() === 22) && dst.Name() === "" && (src.Kind() === 22) && src.Name() === "" && haveIdenticalUnderlyingType(dst.Elem().common(), src.Elem().common())) {
			return cvtDirect;
		}
		if (implements$1(dst, src)) {
			if (src.Kind() === 20) {
				return cvtI2I;
			}
			return cvtT2I;
		}
		return go$throwNilPointerError;
	};
	makeFloat = function(f, v, t) {
		var typ, ptr, w, _ref, v$1, v$2;
		typ = t.common();
		if (typ.size > 4) {
			ptr = unsafe_New(typ);
			ptr.go$set(v);
			return new Value.Ptr(typ, ptr, (((f | 2) >>> 0) | ((typ.Kind() >>> 0) << 4 >>> 0)) >>> 0);
		}
		w = 0;
		_ref = typ.size;
		if (_ref === 4) {
			new (go$ptrType(iword))(function() { return w; }, function(v$1) { w = v$1;; }).go$set(v);
		} else if (_ref === 8) {
			new (go$ptrType(iword))(function() { return w; }, function(v$2) { w = v$2;; }).go$set(v);
		}
		return new Value.Ptr(typ, w, (f | ((typ.Kind() >>> 0) << 4 >>> 0)) >>> 0);
	};
	makeComplex = function(f, v, t) {
		var typ, ptr, _ref, w, v$1;
		typ = t.common();
		if (typ.size > 4) {
			ptr = unsafe_New(typ);
			_ref = typ.size;
			if (_ref === 8) {
				ptr.go$set(new Go$Complex64(v.real, v.imag));
			} else if (_ref === 16) {
				ptr.go$set(v);
			}
			return new Value.Ptr(typ, ptr, (((f | 2) >>> 0) | ((typ.Kind() >>> 0) << 4 >>> 0)) >>> 0);
		}
		w = 0;
		new (go$ptrType(iword))(function() { return w; }, function(v$1) { w = v$1;; }).go$set(new Go$Complex64(v.real, v.imag));
		return new Value.Ptr(typ, w, (f | ((typ.Kind() >>> 0) << 4 >>> 0)) >>> 0);
	};
	makeString = function(f, v, t) {
		var _struct, ret, _struct$1;
		ret = (_struct = New(t).Elem(), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		ret.SetString(v);
		ret.flag = ((ret.flag & ~4) | f) >>> 0;
		return (_struct$1 = ret, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag));
	};
	makeBytes = function(f, v, t) {
		var _struct, ret, _struct$1;
		ret = (_struct = New(t).Elem(), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		ret.SetBytes(v);
		ret.flag = ((ret.flag & ~4) | f) >>> 0;
		return (_struct$1 = ret, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag));
	};
	makeRunes = function(f, v, t) {
		var _struct, ret, _struct$1;
		ret = (_struct = New(t).Elem(), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		ret.setRunes(v);
		ret.flag = ((ret.flag & ~4) | f) >>> 0;
		return (_struct$1 = ret, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag));
	};
	cvtInt = function(v, t) {
		var x, _struct;
		return (_struct = makeInt((v.flag & 1) >>> 0, (x = v.Int(), new Go$Uint64(x.high, x.low)), t), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	cvtUint = function(v, t) {
		var _struct;
		return (_struct = makeInt((v.flag & 1) >>> 0, v.Uint(), t), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	cvtFloatInt = function(v, t) {
		var x, _struct;
		return (_struct = makeInt((v.flag & 1) >>> 0, (x = new Go$Int64(0, v.Float()), new Go$Uint64(x.high, x.low)), t), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	cvtFloatUint = function(v, t) {
		var _struct;
		return (_struct = makeInt((v.flag & 1) >>> 0, new Go$Uint64(0, v.Float()), t), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	cvtIntFloat = function(v, t) {
		var _struct;
		return (_struct = makeFloat((v.flag & 1) >>> 0, go$flatten64(v.Int()), t), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	cvtUintFloat = function(v, t) {
		var _struct;
		return (_struct = makeFloat((v.flag & 1) >>> 0, go$flatten64(v.Uint()), t), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	cvtFloat = function(v, t) {
		var _struct;
		return (_struct = makeFloat((v.flag & 1) >>> 0, v.Float(), t), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	cvtComplex = function(v, t) {
		var _struct;
		return (_struct = makeComplex((v.flag & 1) >>> 0, v.Complex(), t), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	cvtIntString = function(v, t) {
		var _struct;
		return (_struct = makeString((v.flag & 1) >>> 0, go$encodeRune(v.Int().low), t), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	cvtUintString = function(v, t) {
		var _struct;
		return (_struct = makeString((v.flag & 1) >>> 0, go$encodeRune(v.Uint().low), t), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	cvtBytesString = function(v, t) {
		var _struct;
		return (_struct = makeString((v.flag & 1) >>> 0, go$bytesToString(v.Bytes()), t), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	cvtStringBytes = function(v, t) {
		var _struct;
		return (_struct = makeBytes((v.flag & 1) >>> 0, new (go$sliceType(Go$Uint8))(go$stringToBytes(v.String())), t), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	cvtRunesString = function(v, t) {
		var _struct;
		return (_struct = makeString((v.flag & 1) >>> 0, go$runesToString(v.runes()), t), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	cvtStringRunes = function(v, t) {
		var _struct;
		return (_struct = makeRunes((v.flag & 1) >>> 0, new (go$sliceType(Go$Int32))(go$stringToRunes(v.String())), t), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
	};
	cvtT2I = function(v, typ) {
		var target, _struct, x;
		target = go$newDataPointer(null, (go$ptrType(go$emptyInterface)));
		x = valueInterface((_struct = v, new Value.Ptr(_struct.typ, _struct.val, _struct.flag)), false);
		if (typ.NumMethod() === 0) {
			target.go$set(x);
		} else {
			ifaceE2I((typ !== null && typ.constructor === (go$ptrType(rtype)) ? typ.go$val : go$typeAssertionFailed(typ, (go$ptrType(rtype)))), x, target);
		}
		return new Value.Ptr(typ.common(), target, (((((v.flag & 1) >>> 0) | 2) >>> 0) | 320) >>> 0);
	};
	cvtI2I = function(v, typ) {
		var _struct, ret, _struct$1, _struct$2, _struct$3;
		if (v.IsNil()) {
			ret = (_struct = Zero(typ), new Value.Ptr(_struct.typ, _struct.val, _struct.flag));
			ret.flag = (ret.flag | (((v.flag & 1) >>> 0))) >>> 0;
			return (_struct$1 = ret, new Value.Ptr(_struct$1.typ, _struct$1.val, _struct$1.flag));
		}
		return (_struct$3 = cvtT2I((_struct$2 = v.Elem(), new Value.Ptr(_struct$2.typ, _struct$2.val, _struct$2.flag)), typ), new Value.Ptr(_struct$3.typ, _struct$3.val, _struct$3.flag));
	};
	call = function() {
		throw go$panic("Native function not implemented: call");
	};
	go$pkg.init = function() {
		mapIter.init([["t", "t", "reflect", Type, ""], ["m", "m", "reflect", js.Object, ""], ["keys", "keys", "reflect", js.Object, ""], ["i", "i", "reflect", Go$Int, ""]]);
		Type.init([["Align", "", (go$funcType([], [Go$Int], false))], ["AssignableTo", "", (go$funcType([Type], [Go$Bool], false))], ["Bits", "", (go$funcType([], [Go$Int], false))], ["ChanDir", "", (go$funcType([], [ChanDir], false))], ["ConvertibleTo", "", (go$funcType([Type], [Go$Bool], false))], ["Elem", "", (go$funcType([], [Type], false))], ["Field", "", (go$funcType([Go$Int], [StructField], false))], ["FieldAlign", "", (go$funcType([], [Go$Int], false))], ["FieldByIndex", "", (go$funcType([(go$sliceType(Go$Int))], [StructField], false))], ["FieldByName", "", (go$funcType([Go$String], [StructField, Go$Bool], false))], ["FieldByNameFunc", "", (go$funcType([(go$funcType([Go$String], [Go$Bool], false))], [StructField, Go$Bool], false))], ["Implements", "", (go$funcType([Type], [Go$Bool], false))], ["In", "", (go$funcType([Go$Int], [Type], false))], ["IsVariadic", "", (go$funcType([], [Go$Bool], false))], ["Key", "", (go$funcType([], [Type], false))], ["Kind", "", (go$funcType([], [Kind], false))], ["Len", "", (go$funcType([], [Go$Int], false))], ["Method", "", (go$funcType([Go$Int], [Method], false))], ["MethodByName", "", (go$funcType([Go$String], [Method, Go$Bool], false))], ["Name", "", (go$funcType([], [Go$String], false))], ["NumField", "", (go$funcType([], [Go$Int], false))], ["NumIn", "", (go$funcType([], [Go$Int], false))], ["NumMethod", "", (go$funcType([], [Go$Int], false))], ["NumOut", "", (go$funcType([], [Go$Int], false))], ["Out", "", (go$funcType([Go$Int], [Type], false))], ["PkgPath", "", (go$funcType([], [Go$String], false))], ["Size", "", (go$funcType([], [Go$Uintptr], false))], ["String", "", (go$funcType([], [Go$String], false))], ["common", "reflect", (go$funcType([], [(go$ptrType(rtype))], false))], ["uncommon", "reflect", (go$funcType([], [(go$ptrType(uncommonType))], false))]]);
		Kind.methods = [["String", "String", "", [], [Go$String], false, -1]];
		(go$ptrType(Kind)).methods = [["String", "String", "", [], [Go$String], false, -1]];
		rtype.methods = [["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 9]];
		(go$ptrType(rtype)).methods = [["Align", "Align", "", [], [Go$Int], false, -1], ["AssignableTo", "AssignableTo", "", [Type], [Go$Bool], false, -1], ["Bits", "Bits", "", [], [Go$Int], false, -1], ["ChanDir", "ChanDir", "", [], [ChanDir], false, -1], ["ConvertibleTo", "ConvertibleTo", "", [Type], [Go$Bool], false, -1], ["Elem", "Elem", "", [], [Type], false, -1], ["Field", "Field", "", [Go$Int], [StructField], false, -1], ["FieldAlign", "FieldAlign", "", [], [Go$Int], false, -1], ["FieldByIndex", "FieldByIndex", "", [(go$sliceType(Go$Int))], [StructField], false, -1], ["FieldByName", "FieldByName", "", [Go$String], [StructField, Go$Bool], false, -1], ["FieldByNameFunc", "FieldByNameFunc", "", [(go$funcType([Go$String], [Go$Bool], false))], [StructField, Go$Bool], false, -1], ["Implements", "Implements", "", [Type], [Go$Bool], false, -1], ["In", "In", "", [Go$Int], [Type], false, -1], ["IsVariadic", "IsVariadic", "", [], [Go$Bool], false, -1], ["Key", "Key", "", [], [Type], false, -1], ["Kind", "Kind", "", [], [Kind], false, -1], ["Len", "Len", "", [], [Go$Int], false, -1], ["Method", "Method", "", [Go$Int], [Method], false, -1], ["MethodByName", "MethodByName", "", [Go$String], [Method, Go$Bool], false, -1], ["Name", "Name", "", [], [Go$String], false, -1], ["NumField", "NumField", "", [], [Go$Int], false, -1], ["NumIn", "NumIn", "", [], [Go$Int], false, -1], ["NumMethod", "NumMethod", "", [], [Go$Int], false, -1], ["NumOut", "NumOut", "", [], [Go$Int], false, -1], ["Out", "Out", "", [Go$Int], [Type], false, -1], ["PkgPath", "PkgPath", "", [], [Go$String], false, -1], ["Size", "Size", "", [], [Go$Uintptr], false, -1], ["String", "String", "", [], [Go$String], false, -1], ["common", "common", "reflect", [], [(go$ptrType(rtype))], false, -1], ["ptrTo", "ptrTo", "reflect", [], [(go$ptrType(rtype))], false, -1], ["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 9]];
		rtype.init([["size", "size", "reflect", Go$Uintptr, ""], ["hash", "hash", "reflect", Go$Uint32, ""], ["_$2", "_", "reflect", Go$Uint8, ""], ["align", "align", "reflect", Go$Uint8, ""], ["fieldAlign", "fieldAlign", "reflect", Go$Uint8, ""], ["kind", "kind", "reflect", Go$Uint8, ""], ["alg", "alg", "reflect", (go$ptrType(Go$Uintptr)), ""], ["gc", "gc", "reflect", Go$UnsafePointer, ""], ["string", "string", "reflect", (go$ptrType(Go$String)), ""], ["uncommonType", "", "reflect", (go$ptrType(uncommonType)), ""], ["ptrToThis", "ptrToThis", "reflect", (go$ptrType(rtype)), ""]]);
		method.init([["name", "name", "reflect", (go$ptrType(Go$String)), ""], ["pkgPath", "pkgPath", "reflect", (go$ptrType(Go$String)), ""], ["mtyp", "mtyp", "reflect", (go$ptrType(rtype)), ""], ["typ", "typ", "reflect", (go$ptrType(rtype)), ""], ["ifn", "ifn", "reflect", Go$UnsafePointer, ""], ["tfn", "tfn", "reflect", Go$UnsafePointer, ""]]);
		(go$ptrType(uncommonType)).methods = [["Method", "Method", "", [Go$Int], [Method], false, -1], ["MethodByName", "MethodByName", "", [Go$String], [Method, Go$Bool], false, -1], ["Name", "Name", "", [], [Go$String], false, -1], ["NumMethod", "NumMethod", "", [], [Go$Int], false, -1], ["PkgPath", "PkgPath", "", [], [Go$String], false, -1], ["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, -1]];
		uncommonType.init([["name", "name", "reflect", (go$ptrType(Go$String)), ""], ["pkgPath", "pkgPath", "reflect", (go$ptrType(Go$String)), ""], ["methods", "methods", "reflect", (go$sliceType(method)), ""]]);
		ChanDir.methods = [["String", "String", "", [], [Go$String], false, -1]];
		(go$ptrType(ChanDir)).methods = [["String", "String", "", [], [Go$String], false, -1]];
		arrayType.methods = [["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		(go$ptrType(arrayType)).methods = [["Align", "Align", "", [], [Go$Int], false, 0], ["AssignableTo", "AssignableTo", "", [Type], [Go$Bool], false, 0], ["Bits", "Bits", "", [], [Go$Int], false, 0], ["ChanDir", "ChanDir", "", [], [ChanDir], false, 0], ["ConvertibleTo", "ConvertibleTo", "", [Type], [Go$Bool], false, 0], ["Elem", "Elem", "", [], [Type], false, 0], ["Field", "Field", "", [Go$Int], [StructField], false, 0], ["FieldAlign", "FieldAlign", "", [], [Go$Int], false, 0], ["FieldByIndex", "FieldByIndex", "", [(go$sliceType(Go$Int))], [StructField], false, 0], ["FieldByName", "FieldByName", "", [Go$String], [StructField, Go$Bool], false, 0], ["FieldByNameFunc", "FieldByNameFunc", "", [(go$funcType([Go$String], [Go$Bool], false))], [StructField, Go$Bool], false, 0], ["Implements", "Implements", "", [Type], [Go$Bool], false, 0], ["In", "In", "", [Go$Int], [Type], false, 0], ["IsVariadic", "IsVariadic", "", [], [Go$Bool], false, 0], ["Key", "Key", "", [], [Type], false, 0], ["Kind", "Kind", "", [], [Kind], false, 0], ["Len", "Len", "", [], [Go$Int], false, 0], ["Method", "Method", "", [Go$Int], [Method], false, 0], ["MethodByName", "MethodByName", "", [Go$String], [Method, Go$Bool], false, 0], ["Name", "Name", "", [], [Go$String], false, 0], ["NumField", "NumField", "", [], [Go$Int], false, 0], ["NumIn", "NumIn", "", [], [Go$Int], false, 0], ["NumMethod", "NumMethod", "", [], [Go$Int], false, 0], ["NumOut", "NumOut", "", [], [Go$Int], false, 0], ["Out", "Out", "", [Go$Int], [Type], false, 0], ["PkgPath", "PkgPath", "", [], [Go$String], false, 0], ["Size", "Size", "", [], [Go$Uintptr], false, 0], ["String", "String", "", [], [Go$String], false, 0], ["common", "common", "reflect", [], [(go$ptrType(rtype))], false, 0], ["ptrTo", "ptrTo", "reflect", [], [(go$ptrType(rtype))], false, 0], ["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		arrayType.init([["rtype", "", "reflect", rtype, "reflect:\"array\""], ["elem", "elem", "reflect", (go$ptrType(rtype)), ""], ["slice", "slice", "reflect", (go$ptrType(rtype)), ""], ["len", "len", "reflect", Go$Uintptr, ""]]);
		chanType.methods = [["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		(go$ptrType(chanType)).methods = [["Align", "Align", "", [], [Go$Int], false, 0], ["AssignableTo", "AssignableTo", "", [Type], [Go$Bool], false, 0], ["Bits", "Bits", "", [], [Go$Int], false, 0], ["ChanDir", "ChanDir", "", [], [ChanDir], false, 0], ["ConvertibleTo", "ConvertibleTo", "", [Type], [Go$Bool], false, 0], ["Elem", "Elem", "", [], [Type], false, 0], ["Field", "Field", "", [Go$Int], [StructField], false, 0], ["FieldAlign", "FieldAlign", "", [], [Go$Int], false, 0], ["FieldByIndex", "FieldByIndex", "", [(go$sliceType(Go$Int))], [StructField], false, 0], ["FieldByName", "FieldByName", "", [Go$String], [StructField, Go$Bool], false, 0], ["FieldByNameFunc", "FieldByNameFunc", "", [(go$funcType([Go$String], [Go$Bool], false))], [StructField, Go$Bool], false, 0], ["Implements", "Implements", "", [Type], [Go$Bool], false, 0], ["In", "In", "", [Go$Int], [Type], false, 0], ["IsVariadic", "IsVariadic", "", [], [Go$Bool], false, 0], ["Key", "Key", "", [], [Type], false, 0], ["Kind", "Kind", "", [], [Kind], false, 0], ["Len", "Len", "", [], [Go$Int], false, 0], ["Method", "Method", "", [Go$Int], [Method], false, 0], ["MethodByName", "MethodByName", "", [Go$String], [Method, Go$Bool], false, 0], ["Name", "Name", "", [], [Go$String], false, 0], ["NumField", "NumField", "", [], [Go$Int], false, 0], ["NumIn", "NumIn", "", [], [Go$Int], false, 0], ["NumMethod", "NumMethod", "", [], [Go$Int], false, 0], ["NumOut", "NumOut", "", [], [Go$Int], false, 0], ["Out", "Out", "", [Go$Int], [Type], false, 0], ["PkgPath", "PkgPath", "", [], [Go$String], false, 0], ["Size", "Size", "", [], [Go$Uintptr], false, 0], ["String", "String", "", [], [Go$String], false, 0], ["common", "common", "reflect", [], [(go$ptrType(rtype))], false, 0], ["ptrTo", "ptrTo", "reflect", [], [(go$ptrType(rtype))], false, 0], ["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		chanType.init([["rtype", "", "reflect", rtype, "reflect:\"chan\""], ["elem", "elem", "reflect", (go$ptrType(rtype)), ""], ["dir", "dir", "reflect", Go$Uintptr, ""]]);
		funcType.methods = [["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		(go$ptrType(funcType)).methods = [["Align", "Align", "", [], [Go$Int], false, 0], ["AssignableTo", "AssignableTo", "", [Type], [Go$Bool], false, 0], ["Bits", "Bits", "", [], [Go$Int], false, 0], ["ChanDir", "ChanDir", "", [], [ChanDir], false, 0], ["ConvertibleTo", "ConvertibleTo", "", [Type], [Go$Bool], false, 0], ["Elem", "Elem", "", [], [Type], false, 0], ["Field", "Field", "", [Go$Int], [StructField], false, 0], ["FieldAlign", "FieldAlign", "", [], [Go$Int], false, 0], ["FieldByIndex", "FieldByIndex", "", [(go$sliceType(Go$Int))], [StructField], false, 0], ["FieldByName", "FieldByName", "", [Go$String], [StructField, Go$Bool], false, 0], ["FieldByNameFunc", "FieldByNameFunc", "", [(go$funcType([Go$String], [Go$Bool], false))], [StructField, Go$Bool], false, 0], ["Implements", "Implements", "", [Type], [Go$Bool], false, 0], ["In", "In", "", [Go$Int], [Type], false, 0], ["IsVariadic", "IsVariadic", "", [], [Go$Bool], false, 0], ["Key", "Key", "", [], [Type], false, 0], ["Kind", "Kind", "", [], [Kind], false, 0], ["Len", "Len", "", [], [Go$Int], false, 0], ["Method", "Method", "", [Go$Int], [Method], false, 0], ["MethodByName", "MethodByName", "", [Go$String], [Method, Go$Bool], false, 0], ["Name", "Name", "", [], [Go$String], false, 0], ["NumField", "NumField", "", [], [Go$Int], false, 0], ["NumIn", "NumIn", "", [], [Go$Int], false, 0], ["NumMethod", "NumMethod", "", [], [Go$Int], false, 0], ["NumOut", "NumOut", "", [], [Go$Int], false, 0], ["Out", "Out", "", [Go$Int], [Type], false, 0], ["PkgPath", "PkgPath", "", [], [Go$String], false, 0], ["Size", "Size", "", [], [Go$Uintptr], false, 0], ["String", "String", "", [], [Go$String], false, 0], ["common", "common", "reflect", [], [(go$ptrType(rtype))], false, 0], ["ptrTo", "ptrTo", "reflect", [], [(go$ptrType(rtype))], false, 0], ["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		funcType.init([["rtype", "", "reflect", rtype, "reflect:\"func\""], ["dotdotdot", "dotdotdot", "reflect", Go$Bool, ""], ["in$2", "in", "reflect", (go$sliceType((go$ptrType(rtype)))), ""], ["out", "out", "reflect", (go$sliceType((go$ptrType(rtype)))), ""]]);
		imethod.init([["name", "name", "reflect", (go$ptrType(Go$String)), ""], ["pkgPath", "pkgPath", "reflect", (go$ptrType(Go$String)), ""], ["typ", "typ", "reflect", (go$ptrType(rtype)), ""]]);
		interfaceType.methods = [["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		(go$ptrType(interfaceType)).methods = [["Align", "Align", "", [], [Go$Int], false, 0], ["AssignableTo", "AssignableTo", "", [Type], [Go$Bool], false, 0], ["Bits", "Bits", "", [], [Go$Int], false, 0], ["ChanDir", "ChanDir", "", [], [ChanDir], false, 0], ["ConvertibleTo", "ConvertibleTo", "", [Type], [Go$Bool], false, 0], ["Elem", "Elem", "", [], [Type], false, 0], ["Field", "Field", "", [Go$Int], [StructField], false, 0], ["FieldAlign", "FieldAlign", "", [], [Go$Int], false, 0], ["FieldByIndex", "FieldByIndex", "", [(go$sliceType(Go$Int))], [StructField], false, 0], ["FieldByName", "FieldByName", "", [Go$String], [StructField, Go$Bool], false, 0], ["FieldByNameFunc", "FieldByNameFunc", "", [(go$funcType([Go$String], [Go$Bool], false))], [StructField, Go$Bool], false, 0], ["Implements", "Implements", "", [Type], [Go$Bool], false, 0], ["In", "In", "", [Go$Int], [Type], false, 0], ["IsVariadic", "IsVariadic", "", [], [Go$Bool], false, 0], ["Key", "Key", "", [], [Type], false, 0], ["Kind", "Kind", "", [], [Kind], false, 0], ["Len", "Len", "", [], [Go$Int], false, 0], ["Method", "Method", "", [Go$Int], [Method], false, -1], ["MethodByName", "MethodByName", "", [Go$String], [Method, Go$Bool], false, -1], ["Name", "Name", "", [], [Go$String], false, 0], ["NumField", "NumField", "", [], [Go$Int], false, 0], ["NumIn", "NumIn", "", [], [Go$Int], false, 0], ["NumMethod", "NumMethod", "", [], [Go$Int], false, -1], ["NumOut", "NumOut", "", [], [Go$Int], false, 0], ["Out", "Out", "", [Go$Int], [Type], false, 0], ["PkgPath", "PkgPath", "", [], [Go$String], false, 0], ["Size", "Size", "", [], [Go$Uintptr], false, 0], ["String", "String", "", [], [Go$String], false, 0], ["common", "common", "reflect", [], [(go$ptrType(rtype))], false, 0], ["ptrTo", "ptrTo", "reflect", [], [(go$ptrType(rtype))], false, 0], ["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		interfaceType.init([["rtype", "", "reflect", rtype, "reflect:\"interface\""], ["methods", "methods", "reflect", (go$sliceType(imethod)), ""]]);
		mapType.methods = [["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		(go$ptrType(mapType)).methods = [["Align", "Align", "", [], [Go$Int], false, 0], ["AssignableTo", "AssignableTo", "", [Type], [Go$Bool], false, 0], ["Bits", "Bits", "", [], [Go$Int], false, 0], ["ChanDir", "ChanDir", "", [], [ChanDir], false, 0], ["ConvertibleTo", "ConvertibleTo", "", [Type], [Go$Bool], false, 0], ["Elem", "Elem", "", [], [Type], false, 0], ["Field", "Field", "", [Go$Int], [StructField], false, 0], ["FieldAlign", "FieldAlign", "", [], [Go$Int], false, 0], ["FieldByIndex", "FieldByIndex", "", [(go$sliceType(Go$Int))], [StructField], false, 0], ["FieldByName", "FieldByName", "", [Go$String], [StructField, Go$Bool], false, 0], ["FieldByNameFunc", "FieldByNameFunc", "", [(go$funcType([Go$String], [Go$Bool], false))], [StructField, Go$Bool], false, 0], ["Implements", "Implements", "", [Type], [Go$Bool], false, 0], ["In", "In", "", [Go$Int], [Type], false, 0], ["IsVariadic", "IsVariadic", "", [], [Go$Bool], false, 0], ["Key", "Key", "", [], [Type], false, 0], ["Kind", "Kind", "", [], [Kind], false, 0], ["Len", "Len", "", [], [Go$Int], false, 0], ["Method", "Method", "", [Go$Int], [Method], false, 0], ["MethodByName", "MethodByName", "", [Go$String], [Method, Go$Bool], false, 0], ["Name", "Name", "", [], [Go$String], false, 0], ["NumField", "NumField", "", [], [Go$Int], false, 0], ["NumIn", "NumIn", "", [], [Go$Int], false, 0], ["NumMethod", "NumMethod", "", [], [Go$Int], false, 0], ["NumOut", "NumOut", "", [], [Go$Int], false, 0], ["Out", "Out", "", [Go$Int], [Type], false, 0], ["PkgPath", "PkgPath", "", [], [Go$String], false, 0], ["Size", "Size", "", [], [Go$Uintptr], false, 0], ["String", "String", "", [], [Go$String], false, 0], ["common", "common", "reflect", [], [(go$ptrType(rtype))], false, 0], ["ptrTo", "ptrTo", "reflect", [], [(go$ptrType(rtype))], false, 0], ["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		mapType.init([["rtype", "", "reflect", rtype, "reflect:\"map\""], ["key", "key", "reflect", (go$ptrType(rtype)), ""], ["elem", "elem", "reflect", (go$ptrType(rtype)), ""], ["bucket", "bucket", "reflect", (go$ptrType(rtype)), ""], ["hmap", "hmap", "reflect", (go$ptrType(rtype)), ""]]);
		ptrType.methods = [["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		(go$ptrType(ptrType)).methods = [["Align", "Align", "", [], [Go$Int], false, 0], ["AssignableTo", "AssignableTo", "", [Type], [Go$Bool], false, 0], ["Bits", "Bits", "", [], [Go$Int], false, 0], ["ChanDir", "ChanDir", "", [], [ChanDir], false, 0], ["ConvertibleTo", "ConvertibleTo", "", [Type], [Go$Bool], false, 0], ["Elem", "Elem", "", [], [Type], false, 0], ["Field", "Field", "", [Go$Int], [StructField], false, 0], ["FieldAlign", "FieldAlign", "", [], [Go$Int], false, 0], ["FieldByIndex", "FieldByIndex", "", [(go$sliceType(Go$Int))], [StructField], false, 0], ["FieldByName", "FieldByName", "", [Go$String], [StructField, Go$Bool], false, 0], ["FieldByNameFunc", "FieldByNameFunc", "", [(go$funcType([Go$String], [Go$Bool], false))], [StructField, Go$Bool], false, 0], ["Implements", "Implements", "", [Type], [Go$Bool], false, 0], ["In", "In", "", [Go$Int], [Type], false, 0], ["IsVariadic", "IsVariadic", "", [], [Go$Bool], false, 0], ["Key", "Key", "", [], [Type], false, 0], ["Kind", "Kind", "", [], [Kind], false, 0], ["Len", "Len", "", [], [Go$Int], false, 0], ["Method", "Method", "", [Go$Int], [Method], false, 0], ["MethodByName", "MethodByName", "", [Go$String], [Method, Go$Bool], false, 0], ["Name", "Name", "", [], [Go$String], false, 0], ["NumField", "NumField", "", [], [Go$Int], false, 0], ["NumIn", "NumIn", "", [], [Go$Int], false, 0], ["NumMethod", "NumMethod", "", [], [Go$Int], false, 0], ["NumOut", "NumOut", "", [], [Go$Int], false, 0], ["Out", "Out", "", [Go$Int], [Type], false, 0], ["PkgPath", "PkgPath", "", [], [Go$String], false, 0], ["Size", "Size", "", [], [Go$Uintptr], false, 0], ["String", "String", "", [], [Go$String], false, 0], ["common", "common", "reflect", [], [(go$ptrType(rtype))], false, 0], ["ptrTo", "ptrTo", "reflect", [], [(go$ptrType(rtype))], false, 0], ["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		ptrType.init([["rtype", "", "reflect", rtype, "reflect:\"ptr\""], ["elem", "elem", "reflect", (go$ptrType(rtype)), ""]]);
		sliceType.methods = [["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		(go$ptrType(sliceType)).methods = [["Align", "Align", "", [], [Go$Int], false, 0], ["AssignableTo", "AssignableTo", "", [Type], [Go$Bool], false, 0], ["Bits", "Bits", "", [], [Go$Int], false, 0], ["ChanDir", "ChanDir", "", [], [ChanDir], false, 0], ["ConvertibleTo", "ConvertibleTo", "", [Type], [Go$Bool], false, 0], ["Elem", "Elem", "", [], [Type], false, 0], ["Field", "Field", "", [Go$Int], [StructField], false, 0], ["FieldAlign", "FieldAlign", "", [], [Go$Int], false, 0], ["FieldByIndex", "FieldByIndex", "", [(go$sliceType(Go$Int))], [StructField], false, 0], ["FieldByName", "FieldByName", "", [Go$String], [StructField, Go$Bool], false, 0], ["FieldByNameFunc", "FieldByNameFunc", "", [(go$funcType([Go$String], [Go$Bool], false))], [StructField, Go$Bool], false, 0], ["Implements", "Implements", "", [Type], [Go$Bool], false, 0], ["In", "In", "", [Go$Int], [Type], false, 0], ["IsVariadic", "IsVariadic", "", [], [Go$Bool], false, 0], ["Key", "Key", "", [], [Type], false, 0], ["Kind", "Kind", "", [], [Kind], false, 0], ["Len", "Len", "", [], [Go$Int], false, 0], ["Method", "Method", "", [Go$Int], [Method], false, 0], ["MethodByName", "MethodByName", "", [Go$String], [Method, Go$Bool], false, 0], ["Name", "Name", "", [], [Go$String], false, 0], ["NumField", "NumField", "", [], [Go$Int], false, 0], ["NumIn", "NumIn", "", [], [Go$Int], false, 0], ["NumMethod", "NumMethod", "", [], [Go$Int], false, 0], ["NumOut", "NumOut", "", [], [Go$Int], false, 0], ["Out", "Out", "", [Go$Int], [Type], false, 0], ["PkgPath", "PkgPath", "", [], [Go$String], false, 0], ["Size", "Size", "", [], [Go$Uintptr], false, 0], ["String", "String", "", [], [Go$String], false, 0], ["common", "common", "reflect", [], [(go$ptrType(rtype))], false, 0], ["ptrTo", "ptrTo", "reflect", [], [(go$ptrType(rtype))], false, 0], ["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		sliceType.init([["rtype", "", "reflect", rtype, "reflect:\"slice\""], ["elem", "elem", "reflect", (go$ptrType(rtype)), ""]]);
		structField.init([["name", "name", "reflect", (go$ptrType(Go$String)), ""], ["pkgPath", "pkgPath", "reflect", (go$ptrType(Go$String)), ""], ["typ", "typ", "reflect", (go$ptrType(rtype)), ""], ["tag", "tag", "reflect", (go$ptrType(Go$String)), ""], ["offset", "offset", "reflect", Go$Uintptr, ""]]);
		structType.methods = [["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		(go$ptrType(structType)).methods = [["Align", "Align", "", [], [Go$Int], false, 0], ["AssignableTo", "AssignableTo", "", [Type], [Go$Bool], false, 0], ["Bits", "Bits", "", [], [Go$Int], false, 0], ["ChanDir", "ChanDir", "", [], [ChanDir], false, 0], ["ConvertibleTo", "ConvertibleTo", "", [Type], [Go$Bool], false, 0], ["Elem", "Elem", "", [], [Type], false, 0], ["Field", "Field", "", [Go$Int], [StructField], false, -1], ["FieldAlign", "FieldAlign", "", [], [Go$Int], false, 0], ["FieldByIndex", "FieldByIndex", "", [(go$sliceType(Go$Int))], [StructField], false, -1], ["FieldByName", "FieldByName", "", [Go$String], [StructField, Go$Bool], false, -1], ["FieldByNameFunc", "FieldByNameFunc", "", [(go$funcType([Go$String], [Go$Bool], false))], [StructField, Go$Bool], false, -1], ["Implements", "Implements", "", [Type], [Go$Bool], false, 0], ["In", "In", "", [Go$Int], [Type], false, 0], ["IsVariadic", "IsVariadic", "", [], [Go$Bool], false, 0], ["Key", "Key", "", [], [Type], false, 0], ["Kind", "Kind", "", [], [Kind], false, 0], ["Len", "Len", "", [], [Go$Int], false, 0], ["Method", "Method", "", [Go$Int], [Method], false, 0], ["MethodByName", "MethodByName", "", [Go$String], [Method, Go$Bool], false, 0], ["Name", "Name", "", [], [Go$String], false, 0], ["NumField", "NumField", "", [], [Go$Int], false, 0], ["NumIn", "NumIn", "", [], [Go$Int], false, 0], ["NumMethod", "NumMethod", "", [], [Go$Int], false, 0], ["NumOut", "NumOut", "", [], [Go$Int], false, 0], ["Out", "Out", "", [Go$Int], [Type], false, 0], ["PkgPath", "PkgPath", "", [], [Go$String], false, 0], ["Size", "Size", "", [], [Go$Uintptr], false, 0], ["String", "String", "", [], [Go$String], false, 0], ["common", "common", "reflect", [], [(go$ptrType(rtype))], false, 0], ["ptrTo", "ptrTo", "reflect", [], [(go$ptrType(rtype))], false, 0], ["uncommon", "uncommon", "reflect", [], [(go$ptrType(uncommonType))], false, 0]];
		structType.init([["rtype", "", "reflect", rtype, "reflect:\"struct\""], ["fields", "fields", "reflect", (go$sliceType(structField)), ""]]);
		Method.init([["Name", "Name", "", Go$String, ""], ["PkgPath", "PkgPath", "", Go$String, ""], ["Type", "Type", "", Type, ""], ["Func", "Func", "", Value, ""], ["Index", "Index", "", Go$Int, ""]]);
		StructField.init([["Name", "Name", "", Go$String, ""], ["PkgPath", "PkgPath", "", Go$String, ""], ["Type", "Type", "", Type, ""], ["Tag", "Tag", "", StructTag, ""], ["Offset", "Offset", "", Go$Uintptr, ""], ["Index", "Index", "", (go$sliceType(Go$Int)), ""], ["Anonymous", "Anonymous", "", Go$Bool, ""]]);
		StructTag.methods = [["Get", "Get", "", [Go$String], [Go$String], false, -1]];
		(go$ptrType(StructTag)).methods = [["Get", "Get", "", [Go$String], [Go$String], false, -1]];
		fieldScan.init([["typ", "typ", "reflect", (go$ptrType(structType)), ""], ["index", "index", "reflect", (go$sliceType(Go$Int)), ""]]);
		Value.methods = [["Addr", "Addr", "", [], [Value], false, -1], ["Bool", "Bool", "", [], [Go$Bool], false, -1], ["Bytes", "Bytes", "", [], [(go$sliceType(Go$Uint8))], false, -1], ["Call", "Call", "", [(go$sliceType(Value))], [(go$sliceType(Value))], false, -1], ["CallSlice", "CallSlice", "", [(go$sliceType(Value))], [(go$sliceType(Value))], false, -1], ["CanAddr", "CanAddr", "", [], [Go$Bool], false, -1], ["CanInterface", "CanInterface", "", [], [Go$Bool], false, -1], ["CanSet", "CanSet", "", [], [Go$Bool], false, -1], ["Cap", "Cap", "", [], [Go$Int], false, -1], ["Close", "Close", "", [], [], false, -1], ["Complex", "Complex", "", [], [Go$Complex128], false, -1], ["Convert", "Convert", "", [Type], [Value], false, -1], ["Elem", "Elem", "", [], [Value], false, -1], ["Field", "Field", "", [Go$Int], [Value], false, -1], ["FieldByIndex", "FieldByIndex", "", [(go$sliceType(Go$Int))], [Value], false, -1], ["FieldByName", "FieldByName", "", [Go$String], [Value], false, -1], ["FieldByNameFunc", "FieldByNameFunc", "", [(go$funcType([Go$String], [Go$Bool], false))], [Value], false, -1], ["Float", "Float", "", [], [Go$Float64], false, -1], ["Index", "Index", "", [Go$Int], [Value], false, -1], ["Int", "Int", "", [], [Go$Int64], false, -1], ["Interface", "Interface", "", [], [go$emptyInterface], false, -1], ["InterfaceData", "InterfaceData", "", [], [(go$arrayType(Go$Uintptr, 2))], false, -1], ["IsNil", "IsNil", "", [], [Go$Bool], false, -1], ["IsValid", "IsValid", "", [], [Go$Bool], false, -1], ["Kind", "Kind", "", [], [Kind], false, -1], ["Len", "Len", "", [], [Go$Int], false, -1], ["MapIndex", "MapIndex", "", [Value], [Value], false, -1], ["MapKeys", "MapKeys", "", [], [(go$sliceType(Value))], false, -1], ["Method", "Method", "", [Go$Int], [Value], false, -1], ["MethodByName", "MethodByName", "", [Go$String], [Value], false, -1], ["NumField", "NumField", "", [], [Go$Int], false, -1], ["NumMethod", "NumMethod", "", [], [Go$Int], false, -1], ["OverflowComplex", "OverflowComplex", "", [Go$Complex128], [Go$Bool], false, -1], ["OverflowFloat", "OverflowFloat", "", [Go$Float64], [Go$Bool], false, -1], ["OverflowInt", "OverflowInt", "", [Go$Int64], [Go$Bool], false, -1], ["OverflowUint", "OverflowUint", "", [Go$Uint64], [Go$Bool], false, -1], ["Pointer", "Pointer", "", [], [Go$Uintptr], false, -1], ["Recv", "Recv", "", [], [Value, Go$Bool], false, -1], ["Send", "Send", "", [Value], [], false, -1], ["Set", "Set", "", [Value], [], false, -1], ["SetBool", "SetBool", "", [Go$Bool], [], false, -1], ["SetBytes", "SetBytes", "", [(go$sliceType(Go$Uint8))], [], false, -1], ["SetCap", "SetCap", "", [Go$Int], [], false, -1], ["SetComplex", "SetComplex", "", [Go$Complex128], [], false, -1], ["SetFloat", "SetFloat", "", [Go$Float64], [], false, -1], ["SetInt", "SetInt", "", [Go$Int64], [], false, -1], ["SetLen", "SetLen", "", [Go$Int], [], false, -1], ["SetMapIndex", "SetMapIndex", "", [Value, Value], [], false, -1], ["SetPointer", "SetPointer", "", [Go$UnsafePointer], [], false, -1], ["SetString", "SetString", "", [Go$String], [], false, -1], ["SetUint", "SetUint", "", [Go$Uint64], [], false, -1], ["Slice", "Slice", "", [Go$Int, Go$Int], [Value], false, -1], ["Slice3", "Slice3", "", [Go$Int, Go$Int, Go$Int], [Value], false, -1], ["String", "String", "", [], [Go$String], false, -1], ["TryRecv", "TryRecv", "", [], [Value, Go$Bool], false, -1], ["TrySend", "TrySend", "", [Value], [Go$Bool], false, -1], ["Type", "Type", "", [], [Type], false, -1], ["Uint", "Uint", "", [], [Go$Uint64], false, -1], ["UnsafeAddr", "UnsafeAddr", "", [], [Go$Uintptr], false, -1], ["assignTo", "assignTo", "reflect", [Go$String, (go$ptrType(rtype)), (go$ptrType(go$emptyInterface))], [Value], false, -1], ["call", "call", "reflect", [Go$String, (go$sliceType(Value))], [(go$sliceType(Value))], false, -1], ["iword", "iword", "reflect", [], [iword], false, -1], ["kind", "kind", "reflect", [], [Kind], false, 2], ["mustBe", "mustBe", "reflect", [Kind], [], false, 2], ["mustBeAssignable", "mustBeAssignable", "reflect", [], [], false, 2], ["mustBeExported", "mustBeExported", "reflect", [], [], false, 2], ["recv", "recv", "reflect", [Go$Bool], [Value, Go$Bool], false, -1], ["runes", "runes", "reflect", [], [(go$sliceType(Go$Int32))], false, -1], ["send", "send", "reflect", [Value, Go$Bool], [Go$Bool], false, -1], ["setRunes", "setRunes", "reflect", [(go$sliceType(Go$Int32))], [], false, -1]];
		(go$ptrType(Value)).methods = [["Addr", "Addr", "", [], [Value], false, -1], ["Bool", "Bool", "", [], [Go$Bool], false, -1], ["Bytes", "Bytes", "", [], [(go$sliceType(Go$Uint8))], false, -1], ["Call", "Call", "", [(go$sliceType(Value))], [(go$sliceType(Value))], false, -1], ["CallSlice", "CallSlice", "", [(go$sliceType(Value))], [(go$sliceType(Value))], false, -1], ["CanAddr", "CanAddr", "", [], [Go$Bool], false, -1], ["CanInterface", "CanInterface", "", [], [Go$Bool], false, -1], ["CanSet", "CanSet", "", [], [Go$Bool], false, -1], ["Cap", "Cap", "", [], [Go$Int], false, -1], ["Close", "Close", "", [], [], false, -1], ["Complex", "Complex", "", [], [Go$Complex128], false, -1], ["Convert", "Convert", "", [Type], [Value], false, -1], ["Elem", "Elem", "", [], [Value], false, -1], ["Field", "Field", "", [Go$Int], [Value], false, -1], ["FieldByIndex", "FieldByIndex", "", [(go$sliceType(Go$Int))], [Value], false, -1], ["FieldByName", "FieldByName", "", [Go$String], [Value], false, -1], ["FieldByNameFunc", "FieldByNameFunc", "", [(go$funcType([Go$String], [Go$Bool], false))], [Value], false, -1], ["Float", "Float", "", [], [Go$Float64], false, -1], ["Index", "Index", "", [Go$Int], [Value], false, -1], ["Int", "Int", "", [], [Go$Int64], false, -1], ["Interface", "Interface", "", [], [go$emptyInterface], false, -1], ["InterfaceData", "InterfaceData", "", [], [(go$arrayType(Go$Uintptr, 2))], false, -1], ["IsNil", "IsNil", "", [], [Go$Bool], false, -1], ["IsValid", "IsValid", "", [], [Go$Bool], false, -1], ["Kind", "Kind", "", [], [Kind], false, -1], ["Len", "Len", "", [], [Go$Int], false, -1], ["MapIndex", "MapIndex", "", [Value], [Value], false, -1], ["MapKeys", "MapKeys", "", [], [(go$sliceType(Value))], false, -1], ["Method", "Method", "", [Go$Int], [Value], false, -1], ["MethodByName", "MethodByName", "", [Go$String], [Value], false, -1], ["NumField", "NumField", "", [], [Go$Int], false, -1], ["NumMethod", "NumMethod", "", [], [Go$Int], false, -1], ["OverflowComplex", "OverflowComplex", "", [Go$Complex128], [Go$Bool], false, -1], ["OverflowFloat", "OverflowFloat", "", [Go$Float64], [Go$Bool], false, -1], ["OverflowInt", "OverflowInt", "", [Go$Int64], [Go$Bool], false, -1], ["OverflowUint", "OverflowUint", "", [Go$Uint64], [Go$Bool], false, -1], ["Pointer", "Pointer", "", [], [Go$Uintptr], false, -1], ["Recv", "Recv", "", [], [Value, Go$Bool], false, -1], ["Send", "Send", "", [Value], [], false, -1], ["Set", "Set", "", [Value], [], false, -1], ["SetBool", "SetBool", "", [Go$Bool], [], false, -1], ["SetBytes", "SetBytes", "", [(go$sliceType(Go$Uint8))], [], false, -1], ["SetCap", "SetCap", "", [Go$Int], [], false, -1], ["SetComplex", "SetComplex", "", [Go$Complex128], [], false, -1], ["SetFloat", "SetFloat", "", [Go$Float64], [], false, -1], ["SetInt", "SetInt", "", [Go$Int64], [], false, -1], ["SetLen", "SetLen", "", [Go$Int], [], false, -1], ["SetMapIndex", "SetMapIndex", "", [Value, Value], [], false, -1], ["SetPointer", "SetPointer", "", [Go$UnsafePointer], [], false, -1], ["SetString", "SetString", "", [Go$String], [], false, -1], ["SetUint", "SetUint", "", [Go$Uint64], [], false, -1], ["Slice", "Slice", "", [Go$Int, Go$Int], [Value], false, -1], ["Slice3", "Slice3", "", [Go$Int, Go$Int, Go$Int], [Value], false, -1], ["String", "String", "", [], [Go$String], false, -1], ["TryRecv", "TryRecv", "", [], [Value, Go$Bool], false, -1], ["TrySend", "TrySend", "", [Value], [Go$Bool], false, -1], ["Type", "Type", "", [], [Type], false, -1], ["Uint", "Uint", "", [], [Go$Uint64], false, -1], ["UnsafeAddr", "UnsafeAddr", "", [], [Go$Uintptr], false, -1], ["assignTo", "assignTo", "reflect", [Go$String, (go$ptrType(rtype)), (go$ptrType(go$emptyInterface))], [Value], false, -1], ["call", "call", "reflect", [Go$String, (go$sliceType(Value))], [(go$sliceType(Value))], false, -1], ["iword", "iword", "reflect", [], [iword], false, -1], ["kind", "kind", "reflect", [], [Kind], false, 2], ["mustBe", "mustBe", "reflect", [Kind], [], false, 2], ["mustBeAssignable", "mustBeAssignable", "reflect", [], [], false, 2], ["mustBeExported", "mustBeExported", "reflect", [], [], false, 2], ["recv", "recv", "reflect", [Go$Bool], [Value, Go$Bool], false, -1], ["runes", "runes", "reflect", [], [(go$sliceType(Go$Int32))], false, -1], ["send", "send", "reflect", [Value, Go$Bool], [Go$Bool], false, -1], ["setRunes", "setRunes", "reflect", [(go$sliceType(Go$Int32))], [], false, -1]];
		Value.init([["typ", "typ", "reflect", (go$ptrType(rtype)), ""], ["val", "val", "reflect", Go$UnsafePointer, ""], ["flag", "", "reflect", flag, ""]]);
		flag.methods = [["kind", "kind", "reflect", [], [Kind], false, -1], ["mustBe", "mustBe", "reflect", [Kind], [], false, -1], ["mustBeAssignable", "mustBeAssignable", "reflect", [], [], false, -1], ["mustBeExported", "mustBeExported", "reflect", [], [], false, -1]];
		(go$ptrType(flag)).methods = [["kind", "kind", "reflect", [], [Kind], false, -1], ["mustBe", "mustBe", "reflect", [Kind], [], false, -1], ["mustBeAssignable", "mustBeAssignable", "reflect", [], [], false, -1], ["mustBeExported", "mustBeExported", "reflect", [], [], false, -1]];
		(go$ptrType(ValueError)).methods = [["Error", "Error", "", [], [Go$String], false, -1]];
		ValueError.init([["Method", "Method", "", Go$String, ""], ["Kind", "Kind", "", Kind, ""]]);
		initialized = false;
		kindNames = new (go$sliceType(Go$String))(["invalid", "bool", "int", "int8", "int16", "int32", "int64", "uint", "uint8", "uint16", "uint32", "uint64", "uintptr", "float32", "float64", "complex64", "complex128", "array", "chan", "func", "interface", "map", "ptr", "slice", "string", "struct", "unsafe.Pointer"]);
		var x;
		uint8Type = (x = TypeOf(new Go$Uint8(0)), (x !== null && x.constructor === (go$ptrType(rtype)) ? x.go$val : go$typeAssertionFailed(x, (go$ptrType(rtype)))));
		var used, x$1, x$2, x$3, x$4, x$5, x$6, x$7, x$8, x$9, x$10, x$11, x$12, x$13, pkg, _map, _key, x$14;
		used = (function(i) {
		});
		used((x$1 = new rtype.Ptr(0, 0, 0, 0, 0, 0, (go$ptrType(Go$Uintptr)).nil, 0, (go$ptrType(Go$String)).nil, (go$ptrType(uncommonType)).nil, (go$ptrType(rtype)).nil), new x$1.constructor.Struct(x$1)));
		used((x$2 = new uncommonType.Ptr((go$ptrType(Go$String)).nil, (go$ptrType(Go$String)).nil, (go$sliceType(method)).nil), new x$2.constructor.Struct(x$2)));
		used((x$3 = new method.Ptr((go$ptrType(Go$String)).nil, (go$ptrType(Go$String)).nil, (go$ptrType(rtype)).nil, (go$ptrType(rtype)).nil, 0, 0), new x$3.constructor.Struct(x$3)));
		used((x$4 = new arrayType.Ptr(new rtype.Ptr(), (go$ptrType(rtype)).nil, (go$ptrType(rtype)).nil, 0), new x$4.constructor.Struct(x$4)));
		used((x$5 = new chanType.Ptr(new rtype.Ptr(), (go$ptrType(rtype)).nil, 0), new x$5.constructor.Struct(x$5)));
		used((x$6 = new funcType.Ptr(new rtype.Ptr(), false, (go$sliceType((go$ptrType(rtype)))).nil, (go$sliceType((go$ptrType(rtype)))).nil), new x$6.constructor.Struct(x$6)));
		used((x$7 = new interfaceType.Ptr(new rtype.Ptr(), (go$sliceType(imethod)).nil), new x$7.constructor.Struct(x$7)));
		used((x$8 = new mapType.Ptr(new rtype.Ptr(), (go$ptrType(rtype)).nil, (go$ptrType(rtype)).nil, (go$ptrType(rtype)).nil, (go$ptrType(rtype)).nil), new x$8.constructor.Struct(x$8)));
		used((x$9 = new ptrType.Ptr(new rtype.Ptr(), (go$ptrType(rtype)).nil), new x$9.constructor.Struct(x$9)));
		used((x$10 = new sliceType.Ptr(new rtype.Ptr(), (go$ptrType(rtype)).nil), new x$10.constructor.Struct(x$10)));
		used((x$11 = new structType.Ptr(new rtype.Ptr(), (go$sliceType(structField)).nil), new x$11.constructor.Struct(x$11)));
		used((x$12 = new imethod.Ptr((go$ptrType(Go$String)).nil, (go$ptrType(Go$String)).nil, (go$ptrType(rtype)).nil), new x$12.constructor.Struct(x$12)));
		used((x$13 = new structField.Ptr((go$ptrType(Go$String)).nil, (go$ptrType(Go$String)).nil, (go$ptrType(rtype)).nil, (go$ptrType(Go$String)).nil, 0), new x$13.constructor.Struct(x$13)));
		pkg = go$pkg;
		pkg.kinds = go$externalize((_map = new Go$Map(), _key = "Bool", _map[_key] = { k: _key, v: 1 }, _key = "Int", _map[_key] = { k: _key, v: 2 }, _key = "Int8", _map[_key] = { k: _key, v: 3 }, _key = "Int16", _map[_key] = { k: _key, v: 4 }, _key = "Int32", _map[_key] = { k: _key, v: 5 }, _key = "Int64", _map[_key] = { k: _key, v: 6 }, _key = "Uint", _map[_key] = { k: _key, v: 7 }, _key = "Uint8", _map[_key] = { k: _key, v: 8 }, _key = "Uint16", _map[_key] = { k: _key, v: 9 }, _key = "Uint32", _map[_key] = { k: _key, v: 10 }, _key = "Uint64", _map[_key] = { k: _key, v: 11 }, _key = "Uintptr", _map[_key] = { k: _key, v: 12 }, _key = "Float32", _map[_key] = { k: _key, v: 13 }, _key = "Float64", _map[_key] = { k: _key, v: 14 }, _key = "Complex64", _map[_key] = { k: _key, v: 15 }, _key = "Complex128", _map[_key] = { k: _key, v: 16 }, _key = "Array", _map[_key] = { k: _key, v: 17 }, _key = "Chan", _map[_key] = { k: _key, v: 18 }, _key = "Func", _map[_key] = { k: _key, v: 19 }, _key = "Interface", _map[_key] = { k: _key, v: 20 }, _key = "Map", _map[_key] = { k: _key, v: 21 }, _key = "Ptr", _map[_key] = { k: _key, v: 22 }, _key = "Slice", _map[_key] = { k: _key, v: 23 }, _key = "String", _map[_key] = { k: _key, v: 24 }, _key = "Struct", _map[_key] = { k: _key, v: 25 }, _key = "UnsafePointer", _map[_key] = { k: _key, v: 26 }, _map), (go$mapType(Go$String, Kind)));
		pkg.RecvDir = 1;
		pkg.SendDir = 2;
		pkg.BothDir = 3;
		go$reflect = pkg;
		initialized = true;
		uint8Type = (x$14 = TypeOf(new Go$Uint8(0)), (x$14 !== null && x$14.constructor === (go$ptrType(rtype)) ? x$14.go$val : go$typeAssertionFailed(x$14, (go$ptrType(rtype)))));
	}
	return go$pkg;
})();
go$packages["github.com/Archs/avalon"] = (function() {
	var go$pkg = {}, js = go$packages["github.com/gopherjs/gopherjs/js"], reflect = go$packages["reflect"], Avalon, ViewModel, VmHandler, Callback, New, NewVM, isArray, Log, Scan, Type, Require;
	Avalon = go$pkg.Avalon = go$newType(0, "Struct", "avalon.Avalon", "Avalon", "github.com/Archs/avalon", function(Object_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
	ViewModel = go$pkg.ViewModel = go$newType(0, "Struct", "avalon.ViewModel", "ViewModel", "github.com/Archs/avalon", function(Object_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
	VmHandler = go$pkg.VmHandler = go$newType(4, "Func", "avalon.VmHandler", "VmHandler", "github.com/Archs/avalon", null);
	Callback = go$pkg.Callback = go$newType(4, "Func", "avalon.Callback", "Callback", "github.com/Archs/avalon", null);
	New = go$pkg.New = function() {
		return new Avalon.Ptr(go$global.avalon);
	};
	NewVM = go$pkg.NewVM = function(o) {
		return new ViewModel.Ptr(o);
	};
	ViewModel.Ptr.prototype.Set = function(name, val) {
		var v;
		v = this;
		if (isArray(val)) {
			v.setArray(name, val);
			return v;
		}
		v.Object[go$externalize(name, Go$String)] = go$externalize(val, go$emptyInterface);
		return v;
	};
	ViewModel.prototype.Set = function(name, val) { return this.go$val.Set(name, val); };
	ViewModel.Ptr.prototype.Get = function(name) {
		var v;
		v = this;
		return v.Object[go$externalize(name, Go$String)];
	};
	ViewModel.prototype.Get = function(name) { return this.go$val.Get(name); };
	isArray = function(i) {
		var typ;
		typ = reflect.TypeOf(i);
		if ((typ.Kind() === 23) || (typ.Kind() === 17)) {
			return true;
		}
		return false;
	};
	ViewModel.Ptr.prototype.setArray = function(name, i) {
		var v, _struct, val, idx;
		v = this;
		v.Object[go$externalize(name, Go$String)] = go$externalize(new (go$sliceType(Go$Int))([]), (go$sliceType(Go$Int)));
		val = (_struct = reflect.ValueOf(i), new reflect.Value.Ptr(_struct.typ, _struct.val, _struct.flag));
		idx = 0;
		while (idx < val.Len()) {
			v.Object[go$externalize(name, Go$String)][idx] = go$externalize(val.Index(idx).Interface(), go$emptyInterface);
			idx = idx + 1 >> 0;
		}
		return null;
	};
	ViewModel.prototype.setArray = function(name, i) { return this.go$val.setArray(name, i); };
	ViewModel.Ptr.prototype.Push = function(name, i) {
		var v;
		v = this;
		if (!isArray(new Go$String(name))) {
			throw go$panic(new Go$String("not array"));
		}
		v.Get(name).push(go$externalize(i, go$emptyInterface));
		return v;
	};
	ViewModel.prototype.Push = function(name, i) { return this.go$val.Push(name, i); };
	Avalon.Ptr.prototype.Define = function(name, h) {
		var a, vm, cb;
		a = this;
		vm = (go$ptrType(ViewModel)).nil;
		cb = (function(o) {
			vm = NewVM(o);
			h(vm);
		});
		a.Object.define(go$externalize(name, Go$String), go$externalize(cb, (go$funcType([js.Object], [], false))));
		return vm;
	};
	Avalon.prototype.Define = function(name, h) { return this.go$val.Define(name, h); };
	Avalon.Ptr.prototype.Log = function(val) {
		var a;
		a = this;
		a.Object.log(go$externalize(val, go$emptyInterface));
	};
	Avalon.prototype.Log = function(val) { return this.go$val.Log(val); };
	Log = go$pkg.Log = function(val) {
		go$global.avalon.log(go$externalize(val, go$emptyInterface));
	};
	Scan = go$pkg.Scan = function() {
		go$global.avalon.scan();
	};
	Type = go$pkg.Type = function(obj) {
		return go$global.avalon.type(go$externalize(obj, go$emptyInterface));
	};
	Require = go$pkg.Require = function(callback, deps) {
		go$global.avalon.require(go$externalize(deps, (go$sliceType(Go$String))), go$externalize(callback, Callback));
	};
	go$pkg.init = function() {
		Avalon.methods = [["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Get", "Get", "", [Go$String], [js.Object], false, 0], ["Index", "Index", "", [Go$Int], [js.Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Set", "Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["Str", "Str", "", [], [Go$String], false, 0], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0]];
		(go$ptrType(Avalon)).methods = [["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Define", "Define", "", [Go$String, VmHandler], [(go$ptrType(ViewModel))], false, -1], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Get", "Get", "", [Go$String], [js.Object], false, 0], ["Index", "Index", "", [Go$Int], [js.Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["Log", "Log", "", [go$emptyInterface], [], false, -1], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Set", "Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["Str", "Str", "", [], [Go$String], false, 0], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0]];
		Avalon.init([["Object", "", "", js.Object, ""]]);
		ViewModel.methods = [["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Index", "Index", "", [Go$Int], [js.Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["Str", "Str", "", [], [Go$String], false, 0], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0]];
		(go$ptrType(ViewModel)).methods = [["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Get", "Get", "", [Go$String], [js.Object], false, -1], ["Index", "Index", "", [Go$Int], [js.Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Push", "Push", "", [Go$String, go$emptyInterface], [(go$ptrType(ViewModel))], false, -1], ["Set", "Set", "", [Go$String, go$emptyInterface], [(go$ptrType(ViewModel))], false, -1], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["Str", "Str", "", [], [Go$String], false, 0], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0], ["setArray", "setArray", "github.com/Archs/avalon", [Go$String, go$emptyInterface], [go$error], false, -1]];
		ViewModel.init([["Object", "", "", js.Object, ""]]);
		VmHandler.init([(go$ptrType(ViewModel))], [], false);
		Callback.init([js.Object], [], false);
	}
	return go$pkg;
})();
go$packages["main"] = (function() {
	var go$pkg = {}, avalon = go$packages["github.com/Archs/avalon"], js = go$packages["github.com/gopherjs/gopherjs/js"], A, main;
	A = go$pkg.A = go$newType(0, "Struct", "main.A", "A", "main", function(A_, B_, C_) {
		this.go$val = this;
		this.A = A_ !== undefined ? A_ : "";
		this.B = B_ !== undefined ? B_ : 0;
		this.C = C_ !== undefined ? C_ : 0;
	});
	main = go$pkg.main = function() {
		var x, x$1, a;
		avalon.Log(new Go$String("hello"));
		avalon.Log((x = new A.Ptr("asdf", 16, 3.200000047683716), new x.constructor.Struct(x)));
		avalon.Log(avalon.Type(new Go$Int(1)));
		avalon.Log(avalon.Type(new Go$Float64(1.2)));
		avalon.Log(avalon.Type(new Go$String("asdfa")));
		avalon.Log(avalon.Type((x$1 = new A.Ptr("", 0, 0), new x$1.constructor.Struct(x$1))));
		avalon.Require((function(val) {
			avalon.Log(new Go$String("require result"));
			avalon.Log(val);
		}), new (go$sliceType(Go$String))(["test"]));
		a = avalon.New();
		a.Define("test", (function(vm) {
			var array;
			array = new (go$sliceType(Go$Int))([1, 2, 3, 4, 5, 6, 7, 8]);
			vm.Set("a", new Go$String("asdfasdf"));
			vm.Set("array", array);
			vm.Set("click", new (go$funcType([js.Object], [], false))((function(v) {
				var go$deferred = [];
				try {
					go$deferred.push({ fun: (function() {
						var e;
						e = go$recover();
						if (!(go$interfaceIsEqual(e, null))) {
							a.Log(e);
						}
					}), args: [] });
					throw go$panic(new Go$String("click"));
					a.Log(v);
					a.Log(vm.Get("array"));
					vm.Push("array", new Go$Int(1));
				} catch(go$err) {
					go$pushErr(go$err);
				} finally {
					go$callDeferred(go$deferred);
				}
			})));
		}));
		avalon.Scan();
	};
	go$pkg.init = function() {
		A.init([["A", "A", "", Go$String, ""], ["B", "B", "", Go$Int, ""], ["C", "C", "", Go$Float32, ""]]);
	}
	return go$pkg;
})();
go$error.implementedBy = [go$packages["errors"].errorString.Ptr, go$packages["github.com/gopherjs/gopherjs/js"].Error.Ptr, go$packages["reflect"].ValueError.Ptr, go$packages["runtime"].TypeAssertionError.Ptr, go$packages["runtime"].errorString, go$ptrType(go$packages["runtime"].errorString)];
go$packages["github.com/gopherjs/gopherjs/js"].Object.implementedBy = [go$packages["github.com/Archs/avalon"].Avalon, go$packages["github.com/Archs/avalon"].Avalon.Ptr, go$packages["github.com/gopherjs/gopherjs/js"].Error, go$packages["github.com/gopherjs/gopherjs/js"].Error.Ptr];
go$packages["reflect"].Type.implementedBy = [go$packages["reflect"].arrayType.Ptr, go$packages["reflect"].chanType.Ptr, go$packages["reflect"].funcType.Ptr, go$packages["reflect"].interfaceType.Ptr, go$packages["reflect"].mapType.Ptr, go$packages["reflect"].ptrType.Ptr, go$packages["reflect"].rtype.Ptr, go$packages["reflect"].sliceType.Ptr, go$packages["reflect"].structType.Ptr];
go$packages["github.com/gopherjs/gopherjs/js"].init();
go$packages["runtime"].init();
go$packages["math"].init();
go$packages["errors"].init();
go$packages["unicode/utf8"].init();
go$packages["strconv"].init();
go$packages["sync/atomic"].init();
go$packages["sync"].init();
go$packages["reflect"].init();
go$packages["github.com/Archs/avalon"].init();
go$packages["main"].init();
go$packages["main"].main();

})();
//# sourceMappingURL=index.js.map
