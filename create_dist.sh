#!/bin/sh

# build the new files
grunt build

# remove the old files
rm -rf ../dist/*

# copy new contents
cp -r ./dist ../ 