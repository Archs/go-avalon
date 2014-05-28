package mmRequest

import (
	"github.com/Archs/avalon"
	"github.com/gopherjs/gopherjs/js"
)

const (
	AV = "avalon"
)

// avalon.ajax 要求传入一个对象，
// 对象要有url, type, success, dataType等属性，这与jQuery的设置保持一致
func Ajax(options map[string]interface{}) Deferred {
	return Deferred{js.Global.Get(AV).Call("ajax", options)}
}

// avlaon.get( url [, data ] [, success(data, textStatus, XHR) ] [, dataType ] )
func Get(i ...interface{}) Deferred {
	return Deferred{js.Global.Get(AV).Call("get", i...)}
}

// avlaon.post( url [, data ] [, success(data, textStatus, XHR) ] [, dataType ] )
func Post(i ...interface{}) Deferred {
	return Deferred{js.Global.Get(AV).Call("post", i...)}
}

// avlaon.upload( url, form [,data] [,success(data, textStatus, XHR)] [, dataType])
func Upload(i ...interface{}) Deferred {
	return Deferred{js.Global.Get(AV).Call("upload", i...)}
}

// avalon.getJSON( url [, data ] [, success( data, textStatus, jqXHR ) ] )
func GetJSON(i ...interface{}) Deferred {
	return Deferred{js.Global.Get(AV).Call("getJSON", i...)}
}

// avalon.getScript( url [, success(script, textStatus, jqXHR) ] )
func GetScript(i ...interface{}) Deferred {
	return Deferred{js.Global.Get(AV).Call("getScript", i...)}
}

// avalon.param(obj) 将一个对象转换为字符串
func Param(params map[string]interface{}) {
	js.Global.Get(AV).Call("param", params)
}

// avalon.unparam(str) 将一个字符串转换为对象

// avalon.serializ(form) 将表单元素变字符串
func Serialize(form js.Object) string {
	return js.Global.Get(AV).Call("serialize", form).Str()
}

type Deferred struct {
	js.Object
}

type Promise struct {
	js.Object
}

func NewDeferred() Deferred {
	return Deferred{js.Global.Call("Deferred")}
}

func (d Deferred) Resolve(i ...interface{}) {
	d.Call("resolve", i...)
}

func (d Deferred) Reject(i ...interface{}) {
	d.Call("reject", i...)
}

func (d Deferred) Notify(i interface{}) {
	d.Call("notify", i)
}

func (d Deferred) State() string {
	return d.Call("state").Str()
}

func (d Deferred) Ditry() bool {
	return d.Call("dirty").Bool()
}

func (d Deferred) All(ps ...Promise) Promise {
	return Promise{d.Call("all", ps)}
}

func (d Deferred) Any(ps ...Promise) Promise {
	return Promise{d.Call("any", ps)}
}

func (p Promise) Then(fn ...interface{}) Promise {
	return Promise{p.Object.Call("then", fn...)}
}
func (p Promise) Otherwise(fn interface{}) Promise {
	return Promise{p.Object.Call("otherwise", fn)}
}

func (p Promise) Ensure(fn interface{}) Promise {
	return Promise{p.Object.Call("ensure", fn)}
}

func init() {
	avalon.Require(nil, "mmRequest")
}
