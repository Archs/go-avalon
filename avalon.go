package avalon

import (
	"github.com/gopherjs/gopherjs/js"
	"reflect"
)

const (
	AV = "avalon"
)

type Avalon struct {
	js.Object
	// Jquery   string `js:"jquery"`
	// Selector string `js:"selector"` //deprecated according jquery docs
	// Length   string `js:"length"`
	// Context  string `js:"context"`
}

func New() *Avalon {
	return &Avalon{js.Global.Get("avalon")}
}

type ViewModel struct {
	js.Object
}

func NewVM(o js.Object) *ViewModel {
	return &ViewModel{o}
}

func (v *ViewModel) Set(name string, val interface{}) *ViewModel {
	// array or slice
	if isArray(val) {
		v.setArray(name, val)
		return v
	}
	// other object
	v.Object.Set(name, val)
	return v
}

func (v *ViewModel) Get(name string) js.Object {
	return v.Object.Get(name)
}

func isArray(i interface{}) bool {
	typ := reflect.TypeOf(i)
	if typ.Kind() == reflect.Slice || typ.Kind() == reflect.Array {
		return true
	}
	return false
}

func (v *ViewModel) setArray(name string, i interface{}) error {
	v.Object.Set(name, []int{})
	val := reflect.ValueOf(i)
	for idx := 0; idx < val.Len(); idx++ {
		v.Object.Get(name).SetIndex(idx, val.Index(idx).Interface())
	}
	return nil
}

// Push push i into name val in view model
func (v *ViewModel) Push(name string, i interface{}) *ViewModel {
	if !isArray(name) {
		panic("not array")
	}
	v.Get(name).Call("push", i)
	return v
}

// VmHandler defines the handler for view model
type VmHandler func(*ViewModel)

// Callback general callback for js.Object
type Callback func(js.Object)

// Define is the viewmodel define function, maps to avalon.define
func (a *Avalon) Define(name string, h VmHandler) *ViewModel {
	var vm *ViewModel
	cb := func(o js.Object) {
		vm = NewVM(o)
		h(vm)
	}
	a.Call("define", name, cb)
	return vm
}

func (a *Avalon) Log(val interface{}) {
	a.Call("log", val)
}

// Define define view model
func Define(name string, cb Callback) js.Object {
	return js.Global.Get(AV).Call("define", name, cb)
}

func Slice(obj interface{}, idxs ...int) js.Object {
	if len(idxs) == 0 {
		return js.Global.Get(AV).Call("slice", obj)
	}
	if len(idxs) == 1 {
		return js.Global.Get(AV).Call("slice", obj, idxs[0])
	}
	return js.Global.Get(AV).Call("slice", obj, idxs[0], idxs[1])
}

//static function
func Log(val interface{}) {
	js.Global.Get(AV).Call("log", val)
}

//static function
func Scan() {
	js.Global.Get(AV).Call("scan")
}

// Type type(obj), 返回传参的数据类型，
// 值可能为array, date, object, json, number,string, null, undefined
func Type(obj interface{}) js.Object {
	return js.Global.Get(AV).Call("type", obj)
}

// define(id?, deps?, factory),一个全局方法，用于定义AMD规范的JS模块
// func Define(id string, deps []string, fac??) {

// }

// require( deps, callback)，一个全局方法，用于加载JS模块
func Require(callback Callback, deps ...string) {
	js.Global.Get(AV).Call("require", deps, callback)
}
