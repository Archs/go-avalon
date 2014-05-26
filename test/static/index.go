package main

import (
	"fmt"
	"github.com/Archs/avalon"
	"github.com/gopherjs/gopherjs/js"
	"math/rand"
	"strings"
	"time"
	// "log"
)

type A struct {
	A string
	B int
	C float32
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
	// avalon.Scan()
	avalon.Require(func(val js.Object) {
		avalon.Log("require result")
		avalon.Log(val)
	}, "test")
	a := avalon.New()
	array := gen(20)
	avalon.Log(array)
	js.Global.Set("data", map[string]interface{}{
		"array": array,
	})
	model := a.Define("test", func(vm *avalon.ViewModel) {
		vm.Set("$skipArray", []string{"go$val"})
		vm.Set("text", "asdfasdf")
		// arr := vm.Set("array", []int{1, 2, 3, 4, 5, 6})
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
			a.Log(vm.Get("c").Int())
			a.Log("del called")
			a.Log(vm.Get("e").Int())
			arr.Pop()
		})
		vm.Func("add", func() {
			// vm.Get("array").Push(randomA())
			a.Log(vm.Get("c").Int())
			a.Log(vm.Get("e").Int())
			arr.Push(randomA())
			// arr.Push(1)
		})
		vm.Func("click", func(obj js.Object) {
			avalon.Log(obj)
			vm.Set("text", 11111111)
			arr.Update(array)
			avalon.Log(vm.Get("array"))
		})
		vm.Watch("text", func(val, oval js.Object) {
			println("watching", val, oval)
		})
		avalon.Log("vm.obj")
		avalon.Log(vm.Object)
		avalon.Log(vm.Object.Get("$skipArray"))
	})

	avalon.Scan()
	// time.AfterFunc(1000, func() {
	// 	// model.Get("text").Update(time.Now().Format("2006-01-02 15:04:05"))
	// 	println("afterfunc", model)
	// })
	js.Global.Call("setTimeout", func() {
		// model.Get("text").Update(time.Now().Format("2006-01-02 15:04:05"))
		model.Get("text").Update(rand.Int())
	}, 1000)
}
