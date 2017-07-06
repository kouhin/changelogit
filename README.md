# Changelogit (Changelog for Git/Github)

A JavaScript-Library version of [git-extras/git-changelog](https://github.com/tj/git-extras/blob/master/bin/git-changelog)

[![npm](https://img.shields.io/npm/v/changelogit.svg)](https://www.npmjs.com/package/changelogit)
[![dependency status](https://david-dm.org/kouhin/changelogit.svg?style=flat-square)](https://david-dm.org/kouhin/changelogit)
[![airbnb style](https://img.shields.io/badge/code_style-airbnb-blue.svg)](https://github.com/airbnb/javascript)

## Installation

- npm

``` shell
npm install changelogit --save
```

## Usage

``` javascript
import changelogit from 'changelogit';

changelogit('v1.0.0', 'v2.0.0', {
  titleTag: 'n.n.n', // [default: n.n.n] Tag for untagged commits
  listAll: false, // [default: false] true: Retrieve all commits, false: Only untagged commits
  noMerges: false, // [default: false] true: Suppress commits from merged branches
  mergesOnly: false, // [default: false] true: Only uses merge commits
}).then((changelog) => {
  // Print changelog (in JSON)
  console.info(JSON.stringify(changelog, null, '  '));
});
```

## License

MIT
