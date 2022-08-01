
const path = require('path');

module.exports = {
    resolve: {
        alias: {
            '@modelize/actions': path.resolve(__dirname, './modelize-actions/src'),
'@modelize/interop': path.resolve(__dirname, './modelize-interop/src'),
'@modelize/transfer': path.resolve(__dirname, './modelize-transfer/src'),

        }
    }
}