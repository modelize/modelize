const path = require('path');
const {packer} = require('lerna-packer');
const {copyRootPackageJson} = require('lerna-packer/packer/modulePackages');
const fs = require('fs');

packer(
    {
        packages: {
            modelizeActions: {
                name: '@modelize/actions',
                root: path.resolve(__dirname, 'packages', 'modelize-actions'),
                entry: path.resolve(__dirname, 'packages', 'modelize-actions/src/'),
                esmOnly: true,
                doServeWatch: true,
                babelTargets: [
                    {distSuffix: '', args: ['--no-comments', '--extensions', '.ts', '--extensions', '.js', '--ignore', '**/*.d.ts']},
                ],
            },
            modelizeInterop: {
                name: '@modelize/interop',
                root: path.resolve(__dirname, 'packages', 'modelize-interop'),
                entry: path.resolve(__dirname, 'packages', 'modelize-interop/src/'),
                esmOnly: true,
                doServeWatch: true,
                babelTargets: [
                    {distSuffix: '', args: ['--no-comments', '--extensions', '.ts', '--extensions', '.js', '--ignore', '**/*.d.ts']},
                ],
            },
            modelizeTransfer: {
                name: '@modelize/transfer',
                root: path.resolve(__dirname, 'packages', 'modelize-transfer'),
                entry: path.resolve(__dirname, 'packages', 'modelize-transfer/src/'),
                esmOnly: true,
                doServeWatch: true,
                babelTargets: [
                    {distSuffix: '', args: ['--no-comments', '--extensions', '.ts', '--extensions', '.js', '--ignore', '**/*.d.ts']},
                ],
            },
        },
        backends: {
        },
    },
    __dirname, {
        afterEsModules: (packages, pathBuild, isServing) => {
            return Promise.all([
                ...(isServing ? [] : [copyRootPackageJson()(packages, pathBuild)]),
            ]).then(() => undefined).catch((e) => {
                console.error('ERROR after-es-mod', e)
                return Promise.reject(e)
            })
        },
    },
)
    .then(([execs, elapsed]) => {
        if(execs.indexOf('doServe') !== -1) {
            console.log('[packer] is now serving (after ' + elapsed + 'ms)')
        } else {
            if(execs.indexOf('doBuild') !== -1 && execs.indexOf('doBuildBackend') !== -1) {
                const nodePackages = [
                    path.resolve(__dirname, 'packages', 'modelize-interop'),
                    path.resolve(__dirname, 'packages', 'modelize-transfer'),
                ]

                const saver = nodePackages.map((pkg) => {
                    return new Promise(((resolve) => {
                        const packageFile = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json')).toString())
                        // todo: for backends: here check all `devPackages` etc. an replace local-packages with `file:` references,
                        //       then copy the `build` of that package to e.g. `_modules` in the backend `build`
                        if(packageFile.exports) {
                            packageFile.exports = Object.keys(packageFile.exports).reduce((exp, pkgName) => ({
                                ...exp,
                                [pkgName]:
                                    packageFile.exports[pkgName].startsWith('./build/') ?
                                        '.' + packageFile.exports[pkgName].slice('./build'.length) :
                                        packageFile.exports[pkgName].startsWith('./src/') ?
                                            '.' + packageFile.exports[pkgName].slice('./src'.length) :
                                            packageFile.exports[pkgName],
                            }), packageFile.exports)
                        }
                        if(packageFile.main && packageFile.main.startsWith('build/')) {
                            packageFile.main = packageFile.main.slice('build/'.length)
                        }
                        if(packageFile.main && packageFile.main.startsWith('src/')) {
                            packageFile.main = packageFile.main.slice('src/'.length)
                        }
                        if(packageFile.typings && packageFile.typings.startsWith('build/')) {
                            packageFile.typings = packageFile.typings.slice('build/'.length)
                        }
                        if(packageFile.typings && packageFile.typings.startsWith('src/')) {
                            packageFile.typings = packageFile.typings.slice('src/'.length)
                        }
                        if(packageFile.types && packageFile.types.startsWith('build/')) {
                            packageFile.types = packageFile.types.slice('build/'.length)
                        }
                        if(packageFile.types && packageFile.types.startsWith('src/')) {
                            packageFile.types = packageFile.types.slice('src/'.length)
                        }
                        fs.writeFile(path.join(pkg, 'build', 'package.json'), JSON.stringify(packageFile, null, 4), () => {
                            resolve()
                        })
                    }))
                })
                Promise.all(saver)
                    .then(() => {
                        console.log('[packer] finished successfully (after ' + elapsed + 'ms)', execs)
                        process.exit(0)
                    })
                    .catch((e) => {
                        console.error('packerConfig', e)
                    })
            } else {
                console.log('[packer] finished successfully (after ' + elapsed + 'ms)', execs)
                process.exit(0)
            }
        }
    })
    .catch((e) => {
        console.error('[packer] finished with error(s)', e)
        process.exit(1)
    })

