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
	obj := js.Global.Get("avalon")
	return &Avalon{obj}
}

type ViewModel struct {
	js.Object
}

func NewVM(o js.Object) *ViewModel {
	return &ViewModel{o}
}

// Val defines helper functions for use in VmHandler
type Val struct {
	js.Object
	vm   *ViewModel
	Name string
}

// Set set the named value i in the avalon ViewModel
func (v *ViewModel) Set(name string, val interface{}) *Val {
	// array or slice
	if isArray(val) {
		v.setArray(name, val)
		return v.Get(name)
	}
	// other object
	v.Object.Set(name, val)
	return v.Get(name)
}

func isFunc(i interface{}) bool {
	return reflect.TypeOf(i).Kind() == reflect.Func
}

func (v *ViewModel) Func(name string, cb interface{}) *Val {
	if !isFunc(cb) {
		panic("callback is not a valid function")
	}
	return v.Set(name, cb)
}

func (v *ViewModel) Get(name string) *Val {
	return &Val{v.Object.Get(name), v, name}
}

// Skip add name into vm.$skipArray
func (v *ViewModel) Skip(name string) {
	skp := v.Object.Get("$skipArray")
	if skp.IsNull() {
		v.Object.Set("$skipArray", []string{name})
		return
	}
	skp.SetIndex(skp.Length(), name)
}

// Skip add name into vm.$skipArray
func (v *ViewModel) Watch(name string, fn func(js.Object, js.Object)) {
	v.Object.Call("$watch", name, fn)
}

func (v *ViewModel) Compute(name string, getter interface{}, setters ...interface{}) *Val {
	var setter interface{} = nil
	if !isFunc(getter) {
		panic("getter must be a function")
	}
	if len(setters) >= 1 {
		setter = setters[0]
		if !isFunc(setter) {
			panic("setter must be a function")
		}
	}
	if setter == nil {
		v.Object.Set(name, map[string]interface{}{
			"get": getter,
		})
	} else {
		v.Object.Set(name, map[string]interface{}{
			"get": getter,
			"set": setter,
		})
	}
	return v.Get(name)
}

// Update updates val in the underlying view model
func (v *Val) Update(i interface{}) *Val {
	v.vm.Set(v.Name, i)
	return v
}

// Push push i into name val in view model
func (v *Val) Push(i interface{}) *Val {
	v.Object.Call("push", i)
	return v
}

func (v *Val) Pop() *Val {
	v.Object.Call("pop")
	return v
}

func isArray(i interface{}) bool {
	typ := reflect.TypeOf(i)
	if typ.Kind() == reflect.Slice || typ.Kind() == reflect.Array {
		return true
	}
	return false
}

func (v *ViewModel) setArray(name string, i interface{}) error {
	v.Object.Set(name, Slice(i))
	return nil
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

func Filters(name string, fn interface{}) {
	if !isFunc(fn) {
		panic("filter must be a function")
	}
	js.Global.Get(AV).Get("filters").Set(name, fn)
}

func Fn(name string, fn interface{}) {
	if !isFunc(fn) {
		panic("filter must be a function")
	}
	js.Global.Get(AV).Get("fn").Set(name, fn)
}

// Define define view model
func Define(name string, cb Callback) *ViewModel {
	return &ViewModel{js.Global.Get(AV).Call("define", name, cb)}
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
