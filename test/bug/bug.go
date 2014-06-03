package main

import (
	"fmt"
	"math/rand"

	"github.com/Archs/go-avalon"
	"github.com/gopherjs/gopherjs/js"
	"honnef.co/go/js/console"
)

type A struct {
	A string  `js:"a"`
	B int     `js:"b"`
	C float32 `js:"c"`
}

func (a A) Print() {
	console.Log("logging", a)
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
	array := gen(5i)
	avalon.Log(array)
	js.Global.Set("data", map[string]interface{}{
		"array": array,
	})
	avalon.Define("test", func(vm *avalon.ViewModel) {
		arr := vm.Set("array", array)
		vm.Func("del", func() {
			arr.Pop()
		})
		vm.Func("add", func() {
			arr.Push(randomA())
		})
		vm.Func("log", func(a A) {
			a.Print()
		})
	})
}
