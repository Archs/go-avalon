package main

import (
	"github.com/Archs/avalon"
	"github.com/gopherjs/gopherjs/js"
	// "log"
)

type A struct {
	A string
	B int
	C float32
}

func main() {
	avalon.Log("hello")
	avalon.Log(A{"asdf", 16, 3.2})
	avalon.Log(avalon.Type(1))
	avalon.Log(avalon.Type(1.2))
	avalon.Log(avalon.Type("asdfa"))
	avalon.Log(avalon.Type(A{}))
	// avalon.Scan()
	avalon.Require(func(val js.Object) {
		avalon.Log("require result")
		avalon.Log(val)
	}, "test")
	// avalon.Define("test", func(vm js.Object) {
	// 	array := []int{1, 2, 3, 4, 5, 6, 7, 8}
	// 	vm.Set("a", "asdfasdf")
	// 	vm.Set("array", avalon.Slice(array))
	// 	vm.Set("click", func(v js.Object) {
	// 		avalon.Log(v)
	// 		avalon.Log(vm.Get("array"))
	// 		vm.Get("array").Call("push", 1)
	// 	})
	// 	vm.Call("$watch", "a", func(val, oval string) {
	// 		println(val, oval)
	// 	})
	// })
	a := avalon.New()
	a.Define("test", func(vm *avalon.ViewModel) {
		array := []int{1, 2, 3, 4, 5, 6, 7, 8}
		vm.Set("a", "asdfasdf")
		// vm.Set("array", avalon.Slice(array))
		vm.Set("array", array)
		vm.Set("click", func(v js.Object) {
			defer func() {
				if e := recover(); e != nil {
					a.Log(e)
				}
			}()
			panic("click")
			a.Log(v)
			a.Log(vm.Get("array"))
			vm.Push("array", 1)
		})
	})

	avalon.Scan()
}
