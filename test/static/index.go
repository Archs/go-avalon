package main

import (
	"fmt"
	"github.com/Archs/avalon"
	"github.com/gopherjs/gopherjs/js"
	"math/rand"
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
	// avalon.Scan()
	avalon.Require(func(val js.Object) {
		avalon.Log("require result")
		avalon.Log(val)
	}, "test")
	a := avalon.New()
	array := gen(20)
	avalon.Log(array)
	a.Define("test", func(vm *avalon.ViewModel) {
		vm.Set("a", "asdfasdf")
		vm.Set("array", array)
		vm.Set("$skipArray", []string{"go$val"})
		vm.Func("del", func() {
			vm.Get("array").Pop()
		})
		vm.Func("add", func() {
			vm.Get("array").Push(randomA())
		})
		avalon.Log("vm.obj")
		avalon.Log(vm.Object.Get("$skipArray"))
	})

	avalon.Scan()
}
