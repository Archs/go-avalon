package avalon

import (
	"github.com/gopherjs/gopherjs/js"
	"reflect"
)

const (
	AV = "avalon"
)

// noop， 一个空函数
var (
	// noop， 一个空函数
	Noop = js.Global.Get(AV).Get("noop")
)

type ViewModel struct {
	js.Object
}

// Val defines helper functions for use in VmHandler
type Val struct {
	js.Object
	vm   *ViewModel
	Name string
}

// VmHandler defines the handler for view model
type VmHandler func(*ViewModel)

// Callback general callback for js.Object
type Callback func(js.Object)

func NewVM(o js.Object) *ViewModel {
	return &ViewModel{o}
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

func (v *Val) Pop() js.Object {
	return v.Object.Call("pop")
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

// log(s)， 打印日志
func Log(val interface{}) {
	js.Global.Get(AV).Call("log", val)
}

// error(s)，抛出异常
func Error(obj js.Object) {
	js.Global.Get(AV).Call("error", obj)
}

// mix(a,b)， 相当于jQuery.extend
func Mix(a, b js.Object) js.Object {
	return js.Global.Get(AV).Call("mix", a, b)
}

// ready(fn), domReady，将回调延迟到DOM树后才执行
func Ready(fn js.Object) {
	js.Global.Get(AV).Call("ready", fn)
}

// oneObject(str|array, val?)， 如果传入一个字符串则将它以逗号转换为一个字符串数组，
// 否则一定要传字符串数组，第二个参数可选，为生成的对象的值。
// 此方法是用于生成一个键名不一样，但键值都一样的对象。如{a:1,b:1,c:1,d:1}
func OneObject(objs ...interface{}) js.Object {
	return js.Global.Get(AV).Call("oneObject", objs...)
}

// type(obj), 返回传参的数据类型，
// 值可能为array, date, object, json, number,string, null, undefined
func Type(obj interface{}) string {
	return js.Global.Get(AV).Call("type", obj).Str()
}

// isWindow(obj), 判定是否为window对象
func IsWindow(obj interface{}) bool {
	return js.Global.Get(AV).Call("isWindow", obj).Bool()
}

// isPlainObject(obj), 判定是否是一个朴素的javascript对象（Object），
// 不是DOM对象，不是BOM对象，不是自定义类的实例。
func IsPlainObject(obj interface{}) bool {
	return js.Global.Get(AV).Call("isPlainObject", obj).Bool()
}

// slice(obj, start?, end?), 用于转换一个类数组对象为一个纯数组，
// 后面两个为索引值，可以只取原对象的一部分元素。
func Slice(obj interface{}, idxs ...int) js.Object {
	if len(idxs) == 0 {
		return js.Global.Get(AV).Call("slice", obj)
	}
	if len(idxs) == 1 {
		return js.Global.Get(AV).Call("slice", obj, idxs[0])
	}
	return js.Global.Get(AV).Call("slice", obj, idxs[0], idxs[1])
}

// range(start, end, step)，生成一个整数数组，功能与underscorejs或python的同名函数一致。
func Range(start, end, step int) js.Object {
	return js.Global.Get(AV).Call("range", start, end, step)
}

// bind(el, type, fn, phase)，绑定事件，返回一个回调给你行卸载
// unbind(el, type, fn, phase)，卸载事件
// TODO

// each，功能同jQuery.each， 都是索引值或键名在前，值或元素在后
func EachIdx(ojb js.Object, fn func(idx int, ojb js.Object)) {
	js.Global.Get(AV).Call("each", fn)
}
func EachKey(ojb js.Object, fn func(key string, ojb js.Object)) {
	js.Global.Get(AV).Call("each", fn)
}

// avalon.define(id?, factory)，定义一个ViewModel
func Define(name string, h VmHandler) *ViewModel {
	var vm *ViewModel
	cb := func(o js.Object) {
		vm = NewVM(o)
		h(vm)
	}
	js.Global.Get(AV).Call("define", name, cb)
	return vm
}

// scan(element?, ViewModel?)，开始扫描DOM树，抽取绑定。
func Scan(ojbs ...interface{}) {
	js.Global.Get(AV).Call("scan", ojbs...)
}

// define(id?, deps?, factory),一个全局方法，用于定义AMD规范的JS模块
// TODO 这个可以没有

// require( deps, callback)，一个全局方法，用于加载JS模块
func Require(cb Callback, deps ...string) {
	js.Global.Get(AV).Call("require", deps, cb)
}

// css( node, name, value?)，如果只有两个参数，读取元素的某个样式，
// 三个参数时，设置元素某个样式
func CSS(node js.Object, name string) js.Object {
	return js.Global.Get(AV).Call("css", name)
}
func SetCSS(node js.Object, name string, value interface{}) {
	js.Global.Get(AV).Call("css", name, value)
}

// nextTick(fn)，延迟执行某个函数，类似于setTimeout(fn, 0)
func NextTick(fn func()) {
	js.Global.Get(AV).Call("nextTick", fn)
}

// contains(a, b)，判定A元素包含B元素
func Contains(a, b js.Object) bool {
	return js.Global.Get(AV).Call("contains", a, b).Bool()
}

// parseHTML(str)，将一段字符串转换为文档碎片
func ParseHTML(str string) js.Object {
	return js.Global.Get(AV).Call("parseHTML", str)
}

// innerHTML(node, str)，对节点node进行innerHTML操作，
// 在旧式IE下，head, table, td, tr, th等元素的innerHTML是只读，这个方法进行了兼容处理。
func InnerHTML(node js.Object, str string) {
	js.Global.Get(AV).Call("innerHTML", node, str)
}

// clearHTML(node)，清空元素的所有子节点。
func ClearHTML(node js.Object) {
	js.Global.Get(AV).Call("clearHTML", node)
}
