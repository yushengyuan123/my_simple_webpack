const fs = require('fs')
const parser = require('@babel/parser')
const traver = require('@babel/traverse').default
const babel = require('@babel/core')
const path = require('path')

let ID = 0

function createAssets(filename) {
    //获得项目根路径
    const root = path.join(__dirname, '../src/')
    //文件查询
    const content = fs.readFileSync(root + filename, 'utf-8')
    //将ES6代码解析成AST
    const ast = parser.parse(content, {
        sourceType: "module"
    })

    const dependencies = []

    //ast递归查找文件依赖
    traver(ast, {
        ImportDeclaration: ({node}) => {
            dependencies.push(node.source.value)
        }
    })

    //把ES6解析成ES5
    const {code} = babel.transformFromAstSync(ast, null, {
        presets: ['@babel/preset-env']
    })

    let id = ID++

    return {
        code,
        id,
        dependencies,
        filename,
    }
}

function createGraph(filename) {
    let entry = createAssets(filename)

    const queue = [entry]

    for (let i = 0; i < queue.length; i++) {
        queue[i].mapping = {}
        queue[i].dependencies.forEach(filename => {
            //参数filename是文件写的相对路径，需要转变成文件名称
            const files = filename.substring(2) + '.js'
            const child = createAssets(files)
            queue[i].mapping[filename] = child.id
            queue.push(child)
        })
    }

    return queue
}

function bundle(graph) {
    let module = ''
    graph.forEach(map => {
        module +=
            `${map.id} : [
                function (require, module, exports) {
                    ${map.code}
                },
                ${JSON.stringify(map.mapping)},
            ],`
    })


    return `(function (modules) {
        function require(id) {
            const [fn, mapping] = modules[id]

            function localRequire (relativePath) {
                return require(mapping[relativePath])
            }

            const module = {
                exports: {}
            }

            fn(localRequire, module, module.exports)

            return module.exports
        }
        //运行第一个模块
        require(0)
    }({${module}}))`
}

function createFile(content) {
    const filePath = path.join(__dirname, '../build/')

    fs.writeFile(filePath + "bundle.js", content, function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("The file was saved!");
    });
}


let graph = createGraph('index.js')


let ES5_code = bundle(graph)

createFile(ES5_code)


