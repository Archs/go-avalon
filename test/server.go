package main

import (
	"github.com/go-martini/martini"
	"github.com/martini-contrib/gzip"
	"github.com/martini-contrib/render"
)

func main() {
	m := martini.Classic()
	m.Use(gzip.All())
	m.Use(martini.Static("static"))

	m.Get("/json/:param1", func(args martini.Params, r render.Render) {
		r.JSON(200, map[string]interface{}{"json": args["param1"]})
	})

	m.Post("/nestedjson", func(r render.Render) {
		r.JSON(200, map[string]interface{}{"success": true, "message": "Welcome!", "nested": map[string]interface{}{"moresuccess": true, "level": 1}})
	})

	m.Post("/:name", func(args martini.Params) string {
		return "Welcome " + args["name"]
	})

	m.Run()
}
