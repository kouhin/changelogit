// @flow

export type PersonObject = {
  date: string, /* strict ISO 8601 format*/
  name: string,
  email: string,
};

export type CommitObject = {
  sha: string,
  author: PersonObject,
  commiter: PersonObject,
  tree: {
    sha: string,
  },
  parents: Array<{
    sha: string,
  }>,
  message: string,
  body: string,
};

export type TagObject = {
  sha: string,
  tag: string,
  message: string,
  tagger: PersonObject,
  commits: Array<string>,
};

export type ChangeLogObject = {
  tags: Array<TagObject>,
  commits: { [string]: CommitObject }
}
