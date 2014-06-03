// Package mmRequest is a binding of mmRequest.js which is a sub project of avalon.js.
// This binding provides ajax requesting ablity for go-avalon.
package mmRequest

import (
	"github.com/Archs/go-avalon"
	"github.com/gopherjs/gopherjs/js"
)

const (
	AV = "avalon"
)

// avalon.ajax 要求传入一个对象，
// 对象要有url, type, success, dataType等属性，这与jQuery的设置保持一致
func Ajax(options map[string]interface{}) Promise {
	return Promise{js.Global.Get(AV).Call("ajax", options)}
}

// avlaon.get( url [, data ] [, success(data, textStatus, XHR) ] [, dataType ] )
func Get(i ...interface{}) Promise {
	return Promise{js.Global.Get(AV).Call("get", i...)}
}

// avlaon.post( url [, data ] [, success(data, textStatus, XHR) ] [, dataType ] )
func Post(i ...interface{}) Promise {
	return Promise{js.Global.Get(AV).Call("post", i...)}
}

// avlaon.upload( url, form [,data] [,success(data, textStatus, XHR)] [, dataType])
func Upload(i ...interface{}) Promise {
	return Promise{js.Global.Get(AV).Call("upload", i...)}
}

// avalon.getJSON( url [, data ] [, success( data, textStatus, jqXHR ) ] )
func GetJSON(i ...interface{}) Promise {
	return Promise{js.Global.Get(AV).Call("getJSON", i...)}
}

// avalon.getScript( url [, success(script, textStatus, jqXHR) ] )
func GetScript(i ...interface{}) Promise {
	return Promise{js.Global.Get(AV).Call("getScript", i...)}
}

// avalon.param(obj) 将一个对象转换为字符串
func Param(params map[string]interface{}) string {
	return js.Global.Get(AV).Call("param", params).Str()
}

// avalon.unparam(str) 将一个字符串转换为对象
func Unparam(str string) map[string]interface{} {
	nm := make(map[string]interface{})
	j := js.Global.Get(AV).Call("unparam", str)
	if j.IsUndefined() {
		return nm
	}
	return j.Interface().(map[string]interface{})
}

// avalon.serializ(form) 将表单元素变字符串
func Serialize(form js.Object) string {
	return js.Global.Get(AV).Call("serialize", form).Str()
}

type Deferred struct {
	j js.Object
}

type Promise struct {
	j js.Object
}

func NewDeferred() Deferred {
	return Deferred{js.Global.Call("Deferred")}
}

func (d Deferred) Resolve(i ...interface{}) {
	d.j.Call("resolve", i...)
}

func (d Deferred) Reject(i ...interface{}) {
	d.j.Call("reject", i...)
}

func (d Deferred) Notify(i interface{}) {
	d.j.Call("notify", i)
}

func (d Deferred) State() string {
	return d.j.Call("state").Str()
}

func (d Deferred) Ditry() bool {
	return d.j.Call("dirty").Bool()
}

func (d Deferred) All(ps ...Promise) Promise {
	return Promise{d.j.Call("all", ps)}
}

func (d Deferred) Any(ps ...Promise) Promise {
	return Promise{d.j.Call("any", ps)}
}

func (p Promise) Then(fn ...interface{}) Promise {
	return Promise{p.j.Call("then", fn...)}
}
func (p Promise) Otherwise(fn interface{}) Promise {
	return Promise{p.j.Call("otherwise", fn)}
}

func (p Promise) Ensure(fn interface{}) Promise {
	return Promise{p.j.Call("ensure", fn)}
}

func init() {
	avalon.Require(nil, "mmRequest")
}
