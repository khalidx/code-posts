/**
 * # code posts
 */

/**
 * ## tldr
 * 
 * - get every ts file in this directory
 * - turn it into a blog post
 * - wow, it even does itself
 * 
 * Keep reading for the long-winded version.
 */

/** 
 * ## introduction
 * 
 * This file, "code posts", is an experiment in both
 * literate programming as well as the concept of treating
 * many programming tasks as file transformations.
 * 
 * This is metaprogramming in a sense, since we will be "transforming" -
 * writing a program to create other programs (writing a file
 * to create other files).
 */

/**
 * ## comment
 * 
 * Every multiline comment that is followed by a newline
 * in this file (and every TypeScript `.ts` file in this directory)
 * is turned into a blog post style html page.
 * 
 * > Wow, it even transforms itself!
 */

/**
 * ## comment + function
 * 
 * Multiline comments that are followed by a function are inserted
 * into the page as markdown + a corresponding code block for the
 * function.
 */

import globby from 'globby'
import { readFile, writeFile } from 'fs-extra'
import { parse } from './extract-comments'
import marked from 'marked'

/**
 * ## files
 * 
 * Finds all TypeScript `.ts` file paths at the top-level
 * in the current working directory.
 */
export function files () {
  return globby('*.ts')
}

/**
 * ## transform
 * 
 * Transforms an array of TypeScript files into an array of
 * markdown blog post files.
 */
export function transform (paths: ReturnType<typeof files>) {
  return Promise
  .resolve(paths)
  .then(paths => Promise.all(paths.map(async path => ({ path, content: await readFile(path, 'utf-8') }))))
  .then(files => Promise.all(files.map(async file => ({ ...file, parse: await parse(file.path) }))))
  .then(files => files.map(file => ({ ...file, content: marked(file.parse.join('\n')) })))
}

/**
 * ## write
 * 
 * Writes an array of files to the filesystem. 
 */
export function write (files: ReturnType<typeof transform>) {
  return Promise
  .resolve(files)
  .then(files => Promise.all(files.map(file => writeFile(file.path + '.html', file.content))))
}

/**
 * ## cli
 * 
 * To generate the posts in this repo, enter the src/
 * directory and run `npx ts-node code-posts.ts`.
 * 
 * To use elsewhere, run it with
 * `npx ts-node src/code-posts.ts`
 */
export function cli () {
  return write(transform(files()))
}

if (require.main === module) cli()
