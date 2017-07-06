// @flow
/**
 * A JavaScript-Library version of [git-extras/git-changelog](https://github.com/tj/git-extras/blob/master/bin/git-changelog)
 *
 * MIT License
 * Copyright (c) 2017 - 2018 HOU Bin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { exec as origExec } from 'child_process';
import promisify from 'util.promisify';

import type { CommitObject, TagObject, ChangeLogObject } from './types';

const exec = promisify(origExec);

const GIT_FORMAT_TAB = '%x09';
const GIT_LOG_FORMAT_TAG = '%H %d %an %ae %aI %s'.split(' ').join(GIT_FORMAT_TAB);
const GIT_LOG_FORMAT_COMMIT = '%H %T %an %ae %aI %cn %ce %cI %s %b %P'.split(' ').join(GIT_FORMAT_TAB);

function execCmd(cmd: string): Promise<string> {
  return exec(cmd)
    .then(({ stdout, stderr }) => {
      if (stderr) {
        throw new Error(stderr);
      }
      return stdout;
    });
}

function fetchCommitRange(
  startTag: ?string,
  finalTag: ?string,
  listAll: boolean = false,
  opts = {},
): Promise<Array<CommitObject>> {
  let GIT_LOG_OPTS = '';

  if (opts.noMerges) {
    GIT_LOG_OPTS = '--no-merges';
  }

  if (opts.mergesOnly) {
    GIT_LOG_OPTS = '--merges';
  }

  let promise;
  if (listAll) {
    promise = execCmd(`git log --date=iso ${GIT_LOG_OPTS} --pretty=format:"${GIT_LOG_FORMAT_COMMIT}"`);
  } else if (finalTag && !startTag) {
    promise = execCmd(`git log --date=iso ${GIT_LOG_OPTS} --pretty=format:"${GIT_LOG_FORMAT_COMMIT}" "${finalTag}"`);
  } else if (finalTag && startTag) {
    promise = execCmd(`git log --date=iso ${GIT_LOG_OPTS} --pretty=format:"${GIT_LOG_FORMAT_COMMIT}" "${startTag}..${finalTag}"`);
  } else if (startTag) {
    promise = execCmd(`git log --date=iso ${GIT_LOG_OPTS} --pretty=format:"${GIT_LOG_FORMAT_COMMIT}" "${startTag}.."`);
  }

  if (!promise) {
    throw new Error('execCmd Error');
  }

  return promise
    .then((result) => {
      if (!result) {
        return [];
      }

      return result
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const segs = line.split('\t');
          return ({
            sha: segs[0],
            author: {
              name: segs[2],
              email: segs[3],
              date: segs[4],
            },
            commiter: {
              name: segs[5],
              email: segs[6],
              date: segs[7],
            },
            tree: {
              sha: segs[1],
            },
            parents: (segs[10] || '').split(/\s+/).filter(Boolean).map(s => ({ sha: s })),
            message: segs[8],
            body: segs[9],
          }: CommitObject);
        });
    });
}

function getTag(str: string): ?string {
  if (!str) return null;
  return str
    .replace(/[()]/g, '')
    .split(',')
    .map(s => s.trim())
    .filter(s => /tag: .*/.test(s))
    .map(s => s.replace('tag: ', '').trim())[0];
}

function getTagList(): Promise<Array<TagObject>> {
  return execCmd(`git log --tags --simplify-by-decoration --date=iso --pretty="format:${GIT_LOG_FORMAT_TAG}"`)
    .then(output => (
      output
        .split('\n')
        .map((x) => {
          const segs = x.split('\t');
          if (segs.length !== 6 || !(/tag: .*/.test(segs[1]))) {
            return null;
          }
          const tag = getTag(segs[1]);
          if (!tag) return null;
          segs[1] = tag;
          return segs;
        })
        .filter(Boolean)
        .map(x => ({
          sha: x[0],
          tag: x[1],
          message: x[5],
          tagger: {
            name: x[2],
            email: x[3],
            date: x[4],
          },
          commits: [],
        }))
    ));
}

export type Options = {
  titleTag?: string, /* Tag label to use for most-recent (untagged) commits */
  listAll?: boolean, /* Retrieve all commits (ignores --start-tag, --final-tag) */
  noMerges?: boolean, /* Suppress commits from merged branches */
  mergesOnly?: boolean, /* Only uses merge commits (uses both subject and body of commit) */
};

export default function changelogit(
  startTag: ?string,
  finalTag: ?string,
  options: Options = {},
): Promise<ChangeLogObject> {
  const opts: Options = Object.assign({}, ({
    titleTag: 'n.n.n',
    listAll: false,
    noMerges: false,
    mergesOnly: false,
  }: Options), options);

  let startTagFound = false;
  let finalTagFound = false;

  return getTagList()
    .then((tags) => {
      const promises = [];
      const allTags = [];
      const allCommits = {};
      for (let i = 0, len = tags.length; i < len; i += 1) {
        const currTag = tags[i];
        const prevTag = tags[i + 1] || null;
        if (i === 0 && !finalTag) {
          const headTag: TagObject = {
            sha: '',
            tag: opts.titleTag || 'n.n.n',
            message: '',
            tagger: {
              name: '',
              date: '',
              email: '',
            },
            commits: [],
          };
          allTags.push(headTag);
          promises.push(fetchCommitRange(currTag.tag, null, false, opts)
            .then((commits) => {
              commits.forEach((c) => {
                headTag.commits.push(c.sha);
                allCommits[c.sha] = c;
              });
            }));
        }

        if (!finalTag && !startTag && !opts.listAll) {
          break;
        }

        if (finalTag && !opts.listAll) {
          if (finalTag === currTag.tag) {
            finalTagFound = true;
          }

          if (finalTag !== currTag.tag && !finalTagFound) {
            continue; // eslint-disable-line no-continue
          }
        }

        if (startTag && !opts.listAll) {
          if (startTag === currTag.tag) {
            startTagFound = true;
          }

          if (startTag !== currTag.tag && startTagFound) {
            break;
          }
        }

        allTags.push(currTag);
        promises.push(
          fetchCommitRange(prevTag ? prevTag.tag : null, currTag.tag, false, opts)
            .then((commits) => {
              commits.forEach((c) => {
                currTag.commits.push(c.sha);
                allCommits[c.sha] = c;
              });
            }));
      }
      return Promise.all(promises).then(() => ({
        tags: allTags,
        commits: allCommits,
      }));
    });
}
