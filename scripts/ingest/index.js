const fs = require('fs')
const path = require('path')

const { create, globSource } = require('ipfs-http-client')
const { parse } = require('node-html-parser')

const packageInfo = require('../../package.json')
const description = 'A unique and hand-drawn image from Jon Sarkin\'s "12x12" collection'

const { bs58toHex } = require('../utils')

function extractTags(str) {
  const tags = str.split(' ')
    .filter(t => t !== '#12x12')
    .filter(t => t.startsWith('#'))
    .map(t => t.substr(1))

  return tags
}

async function ingest (instaloaderFolder, htmlTemplate) {
  const AggregatorV3Abi = require('@chainlink/contracts/abi/v0.8/AggregatorV3Interface.json')
  const ipfs = create(process.env.IPFS_API_URL)

  // TODO: Only jpg for now, other media types later
  const files = fs.readdirSync(instaloaderFolder)
    .filter(f => f.match(/UTC\.json/))
  const timestamps = new Set(files.map(f => f.split('.')[0]))
  const artifact = fs.readFileSync('./artifacts/contracts/721-SarkinNFTs.sol/SarkinNFTs.json')
  const abi = JSON.parse(artifact).abi

  const root = parse(htmlTemplate.toString())
  const nftsList = root.querySelector('#nfts')

  fs.mkdirSync(path.join(__dirname, '../../.build/token/'), { recursive: true })
  fs.mkdirSync(path.join(__dirname, '../../.build/tags/'), { recursive: true })

  let count = 1
  let tags = []

  for (let it = timestamps.values(), timestamp = null; timestamp = it.next().value;) { // eslint-disable-line
    // TODO: Better Insta handling parsing
    try {
      const nftTemplate = parse('<nft-listing></nft-listing>').firstChild
      const hash = await ipfs.add(globSource(instaloaderFolder + `/${timestamp}.jpg`))

      const postTxt = fs.readFileSync(instaloaderFolder + `/${timestamp}.txt`)
      const postTags = extractTags(postTxt.toString().trim())
      tags = [].concat(postTags, tags)

      const nftMetadata = {
        name: (count++).toString().padStart(5, '0'),
        description,
        image: `ipfs://${hash.cid.toString()}`
      }

      const metadata = await ipfs.add(JSON.stringify(nftMetadata))
      fs.writeFileSync(`.build/token/${bs58toHex(metadata.cid.toString())}.json`, JSON.stringify(nftMetadata))

      nftTemplate.setAttributes({
        id: bs58toHex(metadata.cid.toString()),
        'image-src': hash.cid.toString(),
        name: timestamp,
        description
      })

      nftsList.appendChild(nftTemplate)
    } catch (err) {
      console.warn(err.message)
    }
  }

  nftsList.childNodes.reverse()

  const uniqueTags = [...new Set(tags)]
  let tagList = '<ul>'
  for (const tag of uniqueTags.sort()) {
    tagList += `<li><a href="./tags/${tag}.html">${tag}</a>`
    fs.writeFileSync(`.build/tags/${tag}.html`, 'tag')
  }
  tagList += '</ul>'

  root.innerHTML = root.innerHTML.replace(/%TAGS%/g, tagList)

  root.innerHTML = root.innerHTML.replace(/%COUNT%/g, nftsList.childNodes.length)
  root.innerHTML = root.innerHTML.replace(/%VERSION%/g, packageInfo.version)
  root.innerHTML = root.innerHTML.replace(/%IPFS_GATEWAY_URL%/g, process.env.IPFS_GATEWAY_URL)
  root.innerHTML = root.innerHTML.replace(/%CONTRACT_ADDRESS%/g, process.env.CONTRACT_ADDRESS)
  root.innerHTML = root.innerHTML.replace(/%CHAINLINK_ADDRESS%/g, process.env.CHAINLINK_ADDRESS)
  const abiScriptTag =
    parse(`<script id="abi" type="application/json">${JSON.stringify(abi)}</script>`)
  const chainlinkAbiScriptTag =
    parse(`<script id="chainlinkAbi" type="application/json">${JSON.stringify(AggregatorV3Abi)}</script>`)

  root.appendChild(abiScriptTag)
  root.appendChild(chainlinkAbiScriptTag)
  return root
}

module.exports = { ingest }
