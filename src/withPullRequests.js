// @flow

import GithubAPI from 'github';
import type { Github, Auth, Options as GithubOptions } from 'github';

import type { TagObject, ChangeLogObject, CommitObject } from './types';

type Options = GithubOptions & {
  owner: string,
  repo: string,
};

type ChangeLogWithPrObject = {
  tags: Array<TagObject>,
  commits: { [string]: CommitObject & { pullRequest?: ?string } },
  pullRequests?: { [string]: any },
}

class PullRequestSeeker {
  page: number;
  pullRequests: { [string]: any };
  isFinished: boolean;
  github: Github;
  owner: string;
  repo: string;

  constructor(github, owner, repo) {
    this.github = github;
    this.owner = owner;
    this.repo = repo;
    this.page = 0;
    this.pullRequests = {};
    this.isFinished = false;
  }

  fetchPullRequest(): Promise<any> {
    const page = this.page;
    this.page += 1;
    return this.github.pullRequests.getAll({
      owner: this.owner,
      repo: this.repo,
      state: 'closed',
      page,
    }).then(({ data }) => {
      if (data) {
        data.forEach((d) => {
          this.pullRequests[`${d.number}`] = d;
        });
      }
      return data;
    });
  }

  seek(id: string): Promise<any> {
    const pr = this.pullRequests[id];
    if (pr) {
      return Promise.resolve(pr);
    }
    if (!pr && !this.isFinished) {
      return this.fetchPullRequest().then((data) => {
        if (!data || data.length < 1) {
          this.isFinished = true;
        }
        return this.seek(id);
      });
    }
    return Promise.resolve(null);
  }
}

export default function withPullRequest(options?: Options, auth?: Auth): Function {
  const github = new GithubAPI(options);
  if (auth) {
    github.authenticate(auth);
  }
  const opts = options || {};
  return (changelog: ChangeLogObject): Promise<ChangeLogWithPrObject> => {
    const seeker = new PullRequestSeeker(github, opts.owner, opts.repo);
    const result: ChangeLogWithPrObject = {
      tags: changelog.tags,
      commits: {},
      pullRequests: {},
    };

    return Object.keys(changelog.commits).reduce((promise, commitKey) => (
      promise.then(() => {
        const commit = changelog.commits[commitKey];
        if (!(/^Merge pull request #\d+ /.test(commit.message))) {
          result.commits[commitKey] = Object.assign({}, commit, { pullRequest: null });
          return null;
        }
        const prId = commit.message.split(/\s+/).map(s => s.trim()).filter(s => /^#\d+/.test(s)).map(s => s.replace('#', ''))[0];
        if (!prId) {
          result.commits[commitKey] = Object.assign({}, commit, { pullRequest: null });
          return Promise.resolve(null);
        }
        return seeker.seek(prId).then((pr) => {
          if (!pr) {
            result.commits[commitKey] = Object.assign({}, commit, {
              pullRequest: null,
            });
            return;
          }
          if (!result || !result.pullRequests) {
            return;
          }
          result.pullRequests[prId] = pr;
          result.commits[commitKey] = Object.assign({}, commit, {
            pullRequest: prId,
          });
        });
      })
    ), Promise.resolve()).then(() => result);
  };
}
