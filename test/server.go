package main

import (
	"fmt"
	"log"
	"math/rand"
	"strconv"

	"github.com/go-martini/martini"
	// "github.com/martini-contrib/gzip"
	"github.com/martini-contrib/render"
)

type A struct {
	A string
	B int
	C float32
}

func (a A) Print() {
	log.Println("logging", a)
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
	m := martini.Classic()
	// m.Use(gzip.All())
	m.Use(martini.Static("static"))
	m.Use(render.Renderer())

	m.Get("/json/:param1", func(args martini.Params, r render.Render) {
		r.JSON(200, map[string]interface{}{"json": args["param1"]})
	})

	m.Post("/nestedjson", func(r render.Render) {
		r.JSON(200, map[string]interface{}{"success": true, "message": "Welcome!", "nested": map[string]interface{}{"moresuccess": true, "level": 1}})
	})

	m.Post("/:name", func(args martini.Params) string {
		return "Welcome " + args["name"]
	})

	m.Get("/data/:n", func(params martini.Params, r render.Render) {
		s := params["n"]
		n, err := strconv.Atoi(s)
		if err != nil {
			r.JSON(501, err.Error())
			return
		}
		r.JSON(200, gen(n))
	})

	m.Run()
}
