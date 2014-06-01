# go-avalon 

go-avalon是avalon.js的gopherjs绑定，如果前段的代码也可以用go编写，那就太好了

# 完成的绑定

1. avalon.js API
2. VM模型

# 存在的问题

目前最主要的问题是gopherjs对go的数据结构都会生成一个名为`go$val`的属性，该
属性，以

    go$val = this

的方式存在，在avalon.js中，这个形式的赋值会导致ViewModel模型扫描阶段的
循环引用。目前该问题尚不能直接避免，需要修改`gopherjs`或者`avalon.js`
的代码。