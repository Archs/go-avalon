// Package avalon is a `gophserjs` binding of avalon.js,
// which is a MVVM javascript framework like `Angular.js`, but more simpler yet powerful.
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
	if cb == nil {
		js.Global.Get(AV).Call("require", deps, Noop)
	} else {
		js.Global.Get(AV).Call("require", deps, cb)
	}
}

// css( node, name, value?)，如果只有两个参数，读取元素的某个样式，
// 三个参数时，设置元素某个样式
func Css(node js.Object, name string) string {
	return js.Global.Get(AV).Call("css", name).Str()
}
func SetCss(node js.Object, name string, value interface{}) {
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

type Element struct {
	js.Object
}

// NewElement get avalon.Element from js.Object
func NewElement(obj js.Object) Element {
	return Element{js.Global.Get(AV).Invoke(obj)}
}

// NewElementById get avalon.Element from id
func NewElementById(id string) Element {
	obj := js.Global.Get("document").Call("getElementById", id)
	return NewElement(obj)
}

// hasClass(cls)，判定有没有此类名
func (e Element) HasClass(cls string) bool {
	return e.Object.Call("hasClass", cls).Bool()
}

// addClass(cls)，只有元素不存在时才添加此类名（可同时添加多个）
func (e Element) AddClass(cls string) {
	e.Object.Call("addClass", cls)
}

// remvoeClass(cls)，移除多个类名
func (e Element) AemvoeClass(cls string) {
	e.Object.Call("remvoeClass", cls)
}

// toggleClass(cls, state?),切换多个类名，如果第2个参数为布尔，则根据它强行添加或删除类名
func (e Element) ToggleClass(i ...interface{}) {
	e.Object.Call("toggleClass", i...)
}

// attr(name,value?)， 读写特性（此方法非常弱，直接使用setAttribute, getAttribute实现，没有做任何兼容性处理）
func (e Element) Attr(name string) {
	e.Object.Call("attr", name)
}

func (e Element) SetAttr(name string, val interface{}) {
	e.Object.Call("attr", name, val)
}

// data(name, value?)， 读写数据，使用HTML5的data-*特性实现。它会parse一下，让数据更为实用，思路同jQuery，如果一个传参也没有，将元素的data-*属性组成一个对象返回
func (e Element) Data(name string) {
	e.Object.Call("data", name)
}

func (e Element) SetData(name string, val interface{}) {
	e.Object.Call("data", name, val)
}

// removeData(name)， 移除数据
func (e Element) RemoveData(name string) {
	e.Object.Call("removeData", name)
}

// css(name,value?)，读写样式，这个兼容性做得很好，因为长达一百行，连HTML5的私有前缀都能你补上。
func (e Element) Css(name string) {
	e.Object.Call("css", name)
}

func (e Element) SetCss(name string, val interface{}) {
	e.Object.Call("css", name, val)
}

// width(val?), 读写宽度，注意对隐藏元素没有处理。
func (e Element) Width() int {
	return e.Object.Call("width").Int()
}

func (e Element) SetWidth(name string, val int) {
	e.Object.Call("width", name, val)
}

// height(val?), 读写高度，注意对隐藏元素没有处理。
func (e Element) Height() int {
	return e.Object.Call("height").Int()
}

func (e Element) SetHeight(name string, val int) {
	e.Object.Call("height", name, val)
}

// TODO refine bind/unbind
// bind(type, fn, phase)，绑定事件，这个没有做链式操作，目的是为了返回回调给你卸载。
func (e Element) Bind(typ, fn, phase interface{}) js.Object {
	return e.Object.Call("bind", typ, fn, phase)
}

// unbind(type,fn, phase)，卸载事件。
func (e Element) Unbind(typ, fn, phase interface{}) js.Object {
	return e.Object.Call("unbind", typ, fn, phase)
}

// val，读取表单元素的value值，功能同jQuery。
func (e Element) Val() string {
	return e.Object.Call("val").Str()
}

func (e Element) SetVal(i interface{}) {
	e.Object.Call("val", i)
}

type Coordinates struct {
	Left int
	Top  int
}

// offset，取得元素在文档中的坐标，功能只实现了jQuery的一半，只能读不能写。
func (e Element) Offset() Coordinates {
	obj := e.Object.Call("offset")
	return Coordinates{Left: obj.Get("left").Int(), Top: obj.Get("top").Int()}
}

// scrollLeft，取得水平滚动条的位置。
func (e Element) ScrollLeft() int {
	return e.Object.Call("scrollLeft").Int()
}
func (e Element) SetScrollLeft(value int) {
	e.Object.Call("scrollLeft", value)
}

// scrollTop，取得垂直滚动条的位置。
func (e Element) ScrollTop() int {
	return e.Object.Call("scrollTop").Int()
}
func (e Element) SetScrollTop(value int) {
	e.Object.Call("scrollTop", value)
}
