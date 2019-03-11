import React, { Component } from 'react'
import {
  StyleSheet,
  View
} from 'react-native'

import { WebView } from 'react-native-webview'

import resolveDatPath from 'resolve-dat-path'

import { PassThrough }  from 'stream'

import mime from 'mime/lite'

const DAT_REGEX = /dat:\/\/([^/]+)\/?(.*)?/i

function parseDatURL(url) {
  const matches = url.match(DAT_REGEX)
  if (!matches) throw new TypeError(`Invalid dat URL: ${url}`)

  let key = matches[1]
  let version = null
  if (key.includes('+')) {
    [key, version] = key.split('+')
  }
  const path = matches[2] || ''

  return {key, path, version}
}

function showError({url}, err) {
  const body = `
<!DOCTYPE html>
<meta name="viewport" content="width=device-width">
<h1>Something went wrong:</h1>
<p>
${err.message}
</p>
`
  return {
    type: 'response',
    url,
    body,
    status: 500,
  }
}

function showDirectory(archive, {url}, resolvedPath) {
  return new Promise((resolve, reject) => {
    archive.readdir(resolvedPath, (err, items) => {
      if(err) return reject(err)
      const body = `
<!DOCTYPE html>
<meta charset="utf-8" />
<title>dat://${archive.key.toString('hex')}</title>
<meta name="viewport" content="width=device-width" />
<h1>${resolvedPath}</h1>
<ul>
  <li>
    <a href="../">../</a>
  </li>
  <li>
    <a href="/">/</a>
  </li>
  ${items.map((item) => `
    <li>
      <a href="./${item}">./${item}</a>
    </li>
  `).join('\n')}
</ul>
`
      resolve({
        type: 'response',
        url,
        body,
        status: 200
      })
    })
  })
}

function showFile(archive, { url }, resolvedPath) {
  console.log(`loading dat://${archive.key.toString('hex')}${resolvedPath}`)

  return new Promise((resolve, reject) => {
    archive.readFile(resolvedPath, 'utf-8', (err, body) => {
      const mimeType = mime.getType(resolvedPath)
      const headers = {
        'content-type': mimeType
      }

      resolve({
        url: url,
        headers,
        body,
        status: 200
      })
    })
  })
}

function resolveDatPathPromise(archive, path) {
  return new Promise((resolve, reject) => {
    resolveDatPath(archive, path, (err, resolution) => {
      if(err) reject(err)
      else resolve(resolution)
    })
  })
}

async function loadContent(dat, request) {
  const { url } = request
  const {key, path} = parseDatURL(url)
  const archive = await dat.get(`dat://${key}`)

  const resolution = await resolveDatPath(archive, path)

  if(err) return showError(request, new Error("Not found"));

  const resolvedPath = resolution.path
  const type = resolution.type
  if(type === 'directory') return showDirectory(archive, request, resolvedPath)
  if(type === 'file') return showFile(archive, request, resolvedPath)

      // This should never happen
  return showError(request, new Error("Not found"))
}

export class DatWebView extends Component{
  onUrlSchemeRequest = async (request) => {
    return loadContent(this.props.dat, request)
  }

  render () {
    return (
      <WebView
        {...this.props}
        urlScheme='dat'
        onUrlSchemeRequest={this.onUrlSchemeRequest}
      />
    )
  }
}
