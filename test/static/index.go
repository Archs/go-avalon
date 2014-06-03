package main

import (
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/Archs/go-avalon"
	"github.com/Archs/go-avalon/mmRequest"
	"github.com/gopherjs/gopherjs/js"
	"honnef.co/go/js/console"
)

var (
	model *avalon.ViewModel
)

type A struct {
	A string
	B int
	C float32
}

func (a A) Print() {
	console.Log("A.Print", a)
}

type B struct {
	D string
}

func (a B) Print() {
	console.Log("B.Print", a)
}

func randomA() A {
	return A{
		fmt.Sprintf("%x", rand.Int63n(1000)),
		rand.Int(),
		rand.Float32(),
	}
}

func gen(n int) []A {
	ret := []A{}
	for i := 0; i < n; i++ {
		ret = append(ret, randomA())
	}
	return ret
}

func onClick(obj js.Object) {
	mmRequest.Post("/"+model.Get("text").Str(), func(ret js.Object) {
		avalon.Log(ret)
		console.Dir(ret)
		model.Get("dt").Update(ret)
	}).Then(func() {
		console.Log("post ok")
	}).Otherwise(func() {
		console.Log("post failed")
	})
}
func onGetData(obj js.Object) {
	mmRequest.Get("/data/10", func(data []B) {
		console.Log("data:", data)
		for _, v := range data {
			v.Print()
		}
	}).Then(func() {
		console.Log("get data ok")
	}).Otherwise(func() {
		console.Log("get data failed")
	})
}

func main() {
	avalon.Log("hello")
	avalon.Log(A{"asdf", 16, 3.2})
	avalon.Log(avalon.Type(1))
	avalon.Log(avalon.Type(1.2))
	avalon.Log(avalon.Type("asdfa"))
	avalon.Log(avalon.Type(A{}))
	avalon.Filters("tf", func(str string) string {
		return strings.ToTitle(str)
	})
	avalon.Filters("ndate", func(str string) string {
		t, err := time.Parse("2006-01-02 15:04:05", str)
		if err != nil {
			return str + err.Error()
		}
		return t.Format(time.Kitchen)
	})
	array := gen(5)
	console.Log("array:", array)
	js.Global.Set("data", map[string]interface{}{
		"array": array,
	})

	model = avalon.Define("test", func(vm *avalon.ViewModel) {
		vm.Set("$skipArray", []string{"go$val"})
		vm.Set("text", "asdfasdf")
		vm.Set("dt", "val")
		arr := vm.Set("array", array)
		vm.Set("c", map[string]interface{}{
			"get": func() int {
				return arr.Length()
			},
		})
		vm.Compute("e", func() int {
			return rand.Int()
		})
		// vm.Get("$skipArray").Push("go$val")
		vm.Func("del", func() {
			// vm.Get("array").Pop()
			avalon.Log(vm.Get("c").Int())
			avalon.Log("del called")
			avalon.Log(vm.Get("e").Int())
			arr.Pop()
		})
		vm.Func("add", func() {
			// vm.Get("array").Push(randomA())
			avalon.Log(vm.Get("c").Int())
			avalon.Log(vm.Get("e").Int())
			arr.Push(randomA())
			// arr.Push(1)
		})
		vm.Func("click", onClick)
		vm.Func("reload", onGetData)
		vm.Watch("text", func(val, oval js.Object) {
			console.Log("watching", val, oval)
		})
		avalon.Log("vm.obj")
		avalon.Log(vm.Object)
		avalon.Log(vm.Object.Get("$skipArray"))
	})

	avalon.Scan()
	// time.AfterFunc(1000, func() {
	// 	model.Get("text").Update(time.Now().Format("2006-01-02 15:04:05"))
	// 	println("afterfunc", model)
	// rand.Int()// })
	console.Log(time.Now().String(), model)
	// js.Global.Call("setTimeout", func() {
	// 	// model.Get("text").Update(time.Now().Format("2006-01-02 15:04:05"))
	// 	model.Get("text").Update(time.Now().String())
	// }, 1000)
}
