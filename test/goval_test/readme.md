In fact this is a very specific example or need.

When I was doing the gopherjs bindings of [avalon.js][], I want to generate test data in gopherjs using a struct type:

    type A struct {
        A string
        B int
        C float32
    }

in line `12088` of the geneated `val.js`, where `go$val` refers to the struct itself:

    A = go$pkg.A = go$newType(0, "Struct", "main.A", "A", "main", function(A_, B_, C_) {
        this.go$val = this; // it's this line that causes the problem
                            // if you comment it out, it will work
        this.A = A_ !== undefined ? A_ : "";
        this.B = B_ !== undefined ? B_ : 0;
        this.C = C_ !== undefined ? C_ : 0;
    });


The reason `this.go$val = this` would cause problem is that `avalon.js` would scan all the objects in the `ViewModel` it defines, except of those variables
with prefix `$`, which is quite like `angular.js`. This problem can be bypassed if I change the `avalon.js` code to skip the scanning of object attribute `go$val`, but this in `avalon.js` can only be done through a hard coded javascript array of special variable names, which is not a good solution.

    



[avalon.js]: https://github.com/RubyLouvre/avalon