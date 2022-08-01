#!/bin/bash

echo "//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}" >.npmrc

git checkout -- packages/webpackPartialConfig.js

cd ./packages

cd modelize-actions
cp README.md build/ && cp ../../LICENSE build/
cd ../

cd modelize-interop
cp README.md build/ && cp ../../LICENSE build/
cd ../

cd modelize-transfer
cp README.md build/ && cp ../../LICENSE build/
cd ../

cd ../

#npm run release
npm run release -- --yes

rm .npmrc
